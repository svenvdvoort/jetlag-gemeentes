"""
Turn the CBS KML export into one SVG per gemeente.

    python -m scripts.export_gemeente_svgs [--dry-run]

The KML is 6 MB of lon/lat rings - far too much to hand to a browser just to
draw a gemeente's outline on a card. This writes frontend/img/gemeentes/<slug>.svg,
one small self-contained shape each, plus an index.json mapping gemeente name
to file so the frontend never has to re-derive the slug.

Each SVG is normalised on its own: the shape is projected to metres, scaled to
fit --size, and the viewBox is fitted to it, so a gemeente fills whatever box
CSS gives it regardless of how big it really is. The geographic bounds it came
from are kept on the root element as data-bounds, so the shapes can still be
placed on a map later.

The path is one <path> with a subpath per ring and fill-rule="evenodd", which
covers both the gemeentes made of several disjoint polygons and the ones with
a hole in them. It fills with currentColor, so inlined SVGs take their colour
from CSS `color` and an <img src> still renders as black.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, NamedTuple, Sequence, Tuple

# _placemark_name is reached into deliberately: the "gemeentenaam schema field,
# else <name>" rule has to stay identical to the one adjacency uses, or the two
# would disagree about what a gemeente is called.
from app.game_data import (
    GEMEENTES,
    KML_NS,
    KML_PATH,
    METRES_PER_DEGREE,
    NS,
    _placemark_name,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "frontend" / "img" / "gemeentes"
INDEX_NAME = "index.json"

# Length of the longest side of the generated viewBox, in SVG user units.
DEFAULT_SIZE = 1000.0

# Blank margin on every side, in those same user units. Not needed for a plain
# fill, but it keeps a stroke added in CSS from being clipped at the edge.
DEFAULT_PADDING = 4.0

# How far a simplified outline may move from the real one, in metres. The
# rings carry survey-grade detail - vertices a few centimetres apart - and a
# gemeente ~20 km across drawn 200 px wide is only about 100 m per pixel, so
# this is invisible at any size a card uses while cutting the output ~20x.
DEFAULT_TOLERANCE_M = 20.0

# Decimals kept per coordinate. At --size 1000 this is far finer than a pixel.
COORDINATE_PRECISION = 2

Point = Tuple[float, float]
Ring = List[Point]


class Shape(NamedTuple):
    """One gemeente's rings, in (lon, lat), outer and inner together."""

    name: str
    rings: List[Ring]


class ExportError(Exception):
    """Something about the KML means we must not write the SVGs."""


def slug(name: str) -> str:
    """
    Filename-safe form of a gemeente name: "Hof van Twente" -> hof-van-twente.

    Only has to cope with the 60 CBS names, which are letters, spaces and
    hyphens; anything else would be a new kind of name and is worth failing on
    rather than silently mangling.
    """
    cleaned = name.strip().lower().replace(" ", "-")
    if not cleaned or not all(character.isalpha() or character == "-" for character in cleaned):
        raise ExportError(f"Gemeente name {name!r} does not slug cleanly: got {cleaned!r}.")
    return cleaned


def _ring(boundary: ET.Element) -> Ring:
    """The (lon, lat) points of an outerBoundaryIs/innerBoundaryIs element."""
    coordinates = boundary.find(".//k:coordinates", NS)
    if coordinates is None or not coordinates.text:
        return []

    points: Ring = []
    for token in coordinates.text.split():
        lon, lat = token.split(",")[:2]
        points.append((float(lon), float(lat)))
    return points


def read_shapes(kml_path: Path) -> List[Shape]:
    """Every placemark in the KML as a Shape, in document order."""
    root = ET.parse(kml_path).getroot()

    shapes: List[Shape] = []
    for placemark in root.iter(f"{{{KML_NS}}}Placemark"):
        name = _placemark_name(placemark)

        rings: List[Ring] = []
        for polygon in placemark.iter(f"{{{KML_NS}}}Polygon"):
            # Outer first so the subpaths of a polygon stay together, though
            # evenodd fill does not care which order they end up in.
            for tag in ("outerBoundaryIs", "innerBoundaryIs"):
                for boundary in polygon.iter(f"{{{KML_NS}}}{tag}"):
                    ring = _ring(boundary)
                    if len(ring) >= 4:  # 3 distinct points plus the repeated close
                        rings.append(ring)

        if not rings:
            raise ExportError(f"Gemeente {name!r} has no usable polygon in the KML.")
        shapes.append(Shape(name=name, rings=rings))

    if not shapes:
        raise ExportError(f"No placemarks found in {kml_path}.")
    return shapes


def _simplify(ring: Ring, tolerance: float) -> Ring:
    """
    Ramer-Douglas-Peucker, iterative so a 3000-point ring can't blow the stack.

    A KML ring is closed, so its first and last point are the same one. The
    opening segment is then degenerate, and falling back to the distance from
    that point splits the ring at the vertex furthest from it - which is
    exactly how a closed ring wants to be split anyway.
    """
    if tolerance <= 0 or len(ring) < 3:
        return ring

    keep = [False] * len(ring)
    keep[0] = keep[-1] = True

    segments = [(0, len(ring) - 1)]
    while segments:
        start, end = segments.pop()
        if end - start < 2:
            continue

        (start_x, start_y), (end_x, end_y) = ring[start], ring[end]
        span_x, span_y = end_x - start_x, end_y - start_y
        span = math.hypot(span_x, span_y)

        furthest = start
        furthest_distance = -1.0
        for index in range(start + 1, end):
            x, y = ring[index]
            if span == 0:
                distance = math.dist((x, y), (start_x, start_y))
            else:
                distance = abs(span_x * (y - start_y) - span_y * (x - start_x)) / span
            if distance > furthest_distance:
                furthest, furthest_distance = index, distance

        if furthest_distance > tolerance:
            keep[furthest] = True
            segments.append((start, furthest))
            segments.append((furthest, end))

    simplified = [point for point, kept in zip(ring, keep) if kept]

    # A tiny exclave can simplify away entirely; drawing it roughly beats
    # dropping it off the map, so keep the full ring in that case.
    return simplified if len(simplified) >= 4 else ring


def _format(value: float) -> str:
    """Trim a coordinate to COORDINATE_PRECISION without a trailing ".0"."""
    text = f"{value:.{COORDINATE_PRECISION}f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def _path_data(rings: List[Ring]) -> str:
    """The d attribute: one M/L subpath per ring, points as "x,y" pairs."""
    subpaths = []
    for ring in rings:
        # The ring's repeated closing point is redundant next to Z.
        points = ring[:-1] if ring[0] == ring[-1] else ring
        head, *rest = (f"{_format(x)},{_format(y)}" for x, y in points)
        subpaths.append(f"M{head}" + (f"L{' '.join(rest)}" if rest else "") + "Z")
    return "".join(subpaths)


def render(shape: Shape, lon_scale: float, size: float, padding: float, tolerance: float) -> Tuple[str, dict]:
    """
    The SVG text for one gemeente, plus the index entry describing it.

    Projects to metres, simplifies at that scale so the tolerance is a real
    distance, then scales and flips into SVG space - where y grows downwards,
    the opposite of latitude.
    """
    # Slugged up front rather than where the filename is built: it is also what
    # rejects a name that isn't plain letters, and the name goes into the
    # markup below unescaped.
    filename = f"{slug(shape.name)}.svg"

    projected = [[(lon * lon_scale, lat * METRES_PER_DEGREE) for lon, lat in ring] for ring in shape.rings]
    projected = [_simplify(ring, tolerance) for ring in projected]

    xs = [x for ring in projected for x, _ in ring]
    ys = [y for ring in projected for _, y in ring]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)

    # A gemeente is never a point, but never divide by a zero extent anyway.
    scale = (size - 2 * padding) / max(max_x - min_x, max_y - min_y, 1e-9)
    width = (max_x - min_x) * scale + 2 * padding
    height = (max_y - min_y) * scale + 2 * padding

    placed = [
        [(padding + (x - min_x) * scale, padding + (max_y - y) * scale) for x, y in ring]
        for ring in projected
    ]

    lons = [lon for ring in shape.rings for lon, _ in ring]
    lats = [lat for ring in shape.rings for _, lat in ring]
    bounds = [min(lons), min(lats), max(lons), max(lats)]

    view_box = f"0 0 {_format(width)} {_format(height)}"
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" role="img"'
        f' data-gemeente="{shape.name}"'
        f' data-bounds="{",".join(f"{value:.6f}" for value in bounds)}">'
        f"<title>{shape.name}</title>"
        f'<path fill="currentColor" fill-rule="evenodd" d="{_path_data(placed)}"/>'
        f"</svg>\n"
    )

    entry = {
        "name": shape.name,
        "file": filename,
        "width": round(width, COORDINATE_PRECISION),
        "height": round(height, COORDINATE_PRECISION),
        "bounds": [round(value, 6) for value in bounds],
        "points": sum(len(ring) for ring in placed),
    }
    return svg, entry


def check_deck(shapes: List[Shape]) -> None:
    """Refuse to export if the KML and the card deck disagree on the gemeentes."""
    names = [shape.name for shape in shapes]

    duplicates = sorted({name for name in names if names.count(name) > 1})
    if duplicates:
        raise ExportError(f"Gemeente(s) appear in more than one placemark: {', '.join(duplicates)}.")

    missing = [name for name in GEMEENTES if name not in names]
    if missing:
        raise ExportError(
            f"{len(missing)} gemeente(s) in GEMEENTES have no placemark in the KML: "
            f"{', '.join(missing)}."
        )

    extra = sorted(set(names) - set(GEMEENTES))
    if extra:
        raise ExportError(
            f"{len(extra)} gemeente(s) in the KML are not in GEMEENTES (app/game_data.py): "
            f"{', '.join(extra)}."
        )


def export(
    kml_path: Path,
    size: float,
    padding: float,
    tolerance: float,
) -> Tuple[Dict[str, str], List[dict], int]:
    """Render every gemeente. Returns filename -> SVG, index entries, source points."""
    shapes = read_shapes(kml_path)
    check_deck(shapes)

    # One shared longitude scale, taken from the middle of the whole export, so
    # every shape is projected the same way and stays comparable.
    all_lats = [lat for shape in shapes for ring in shape.rings for _, lat in ring]
    mean_lat = sum(all_lats) / len(all_lats)
    lon_scale = METRES_PER_DEGREE * math.cos(math.radians(mean_lat))

    files: Dict[str, str] = {}
    entries: List[dict] = []
    for shape in sorted(shapes, key=lambda shape: shape.name):
        svg, entry = render(shape, lon_scale, size, padding, tolerance)
        files[entry["file"]] = svg
        entries.append(entry)

    source_points = sum(len(ring) for shape in shapes for ring in shape.rings)
    return files, entries, source_points


def report(files: Dict[str, str], entries: List[dict], source_points: int) -> None:
    kept = sum(entry["points"] for entry in entries)
    total_bytes = sum(len(svg.encode("utf-8")) for svg in files.values())
    biggest = max(entries, key=lambda entry: entry["points"])

    print(
        f"{len(entries)} gemeentes, {kept} points kept of {source_points} "
        f"({kept / source_points:.1%}), {total_bytes / 1024:.0f} KiB of SVG total."
    )
    print(
        f"Largest: {biggest['name']} at {biggest['points']} points, "
        f"{len(files[biggest['file']].encode('utf-8')) / 1024:.1f} KiB."
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--kml", type=Path, default=KML_PATH, help="KML export to read")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="directory to write SVGs to")
    parser.add_argument(
        "--size", type=float, default=DEFAULT_SIZE, help="longest viewBox side, in SVG user units"
    )
    parser.add_argument(
        "--padding", type=float, default=DEFAULT_PADDING, help="margin on every side, same units"
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=DEFAULT_TOLERANCE_M,
        help="how far a simplified outline may move from the real one, in metres (0 to keep every point)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would be written without writing anything",
    )
    args = parser.parse_args(argv)

    try:
        files, entries, source_points = export(args.kml, args.size, args.padding, args.tolerance)
    except (ExportError, ET.ParseError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    report(files, entries, source_points)

    if args.dry_run:
        print(f"\nDry run: {args.out} not written.")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    for filename, svg in files.items():
        (args.out / filename).write_text(svg, encoding="utf-8")

    index = {
        "generated_from": args.kml.name,
        "tolerance_m": args.tolerance,
        "gemeentes": entries,
    }
    (args.out / INDEX_NAME).write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\nWrote {len(files)} SVGs and {INDEX_NAME} to {args.out}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
