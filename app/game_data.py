"""
Static source data used to seed a new game's deck.

GEMEENTES become regular challenge cards; WILD_CARDS become wild cards.
Challenge title/description are intentionally left empty at seed time -
fill those in separately (e.g. a follow-up admin endpoint or a seed
script) once the actual challenge text is ready.
"""

import math
import xml.etree.ElementTree as ET
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterator, List, Set, Tuple

GEMEENTES = [
    "Aalten",
    "Almelo",
    "Apeldoorn",
    "Arnhem",
    "Barneveld",
    "Berkelland",
    "Borne",
    "Bronckhorst",
    "Brummen",
    "Dalfsen",
    "Deventer",
    "Dinkelland",
    "Doesburg",
    "Doetinchem",
    "Duiven",
    "Ede",
    "Elburg",
    "Enschede",
    "Epe",
    "Ermelo",
    "Haaksbergen",
    "Hardenberg",
    "Harderwijk",
    "Hattem",
    "Heerde",
    "Hellendoorn",
    "Hengelo",
    "Hof van Twente",
    "Kampen",
    "Lochem",
    "Losser",
    "Montferland",
    "Nijkerk",
    "Nunspeet",
    "Oldebroek",
    "Oldenzaal",
    "Olst-Wijhe",
    "Ommen",
    "Oost Gelre",
    "Oude IJsselstreek",
    "Putten",
    "Raalte",
    "Renkum",
    "Rheden",
    "Rijssen-Holten",
    "Rozendaal",
    "Scherpenzeel",
    "Staphorst",
    "Steenwijkerland",
    "Tubbergen",
    "Twenterand",
    "Voorst",
    "Wageningen",
    "Westervoort",
    "Wierden",
    "Winterswijk",
    "Zevenaar",
    "Zutphen",
    "Zwartewaterland",
    "Zwolle",
]

WILD_CARDS = [
    "Pieterpad Wild Card",
    "Nationale parken Wild Card",
    "Burger King Wild Card",
    "Station Wild Card",
]


# --------------------------------------------------------------------------
# Which gemeentes border each other, derived from the CBS KML export.
#
# The KML is a topologically clean export: where two gemeentes share a
# border, both polygons contain the exact same vertices along that border.
# So adjacency is simply "these two polygons have boundary points in
# common" - no polygon intersection needed. Points are compared in a local
# metric projection with a small tolerance, so the result survives an
# export that rounds coordinates slightly differently.
# --------------------------------------------------------------------------

KML_PATH = Path(__file__).resolve().parent.parent / "frontend" / "data" / "CBS_2025_filtered_gemeenten.kml"

KML_NS = "http://www.opengis.net/kml/2.2"
NS = {"k": KML_NS}

# Two boundary points this close together (metres) are the same point.
DEFAULT_TOLERANCE_M = 1.0

# A shared border is a line, so neighbours share many points. Requiring more
# than one keeps gemeentes that only meet in a single corner out of the result.
DEFAULT_MIN_SHARED_POINTS = 2

# Metres per degree of latitude; longitude is scaled by cos(latitude).
METRES_PER_DEGREE = 111_320.0

Pair = Tuple[str, str]


def _placemark_name(placemark: ET.Element) -> str:
    """Gemeente name from the CBS schema field, falling back to <name>."""
    field = placemark.find(".//k:SimpleData[@name='gemeentenaam']", NS)
    if field is not None and field.text:
        return field.text.strip()

    name = placemark.find("k:name", NS)
    if name is not None and name.text:
        return name.text.strip()

    raise ValueError(f"Placemark {placemark.get('id')!r} has no gemeente name")


def _boundary_points(placemark: ET.Element) -> Iterator[Tuple[float, float]]:
    """Every (lon, lat) on the placemark's rings - outer, inner and all parts."""
    for coordinates in placemark.iter(f"{{{KML_NS}}}coordinates"):
        if not coordinates.text:
            continue
        for token in coordinates.text.split():
            lon, lat = token.split(",")[:2]
            yield float(lon), float(lat)


def _read_gemeentes(kml_path: Path) -> Dict[str, List[Tuple[float, float]]]:
    """Map every gemeente in the KML to its boundary points in (lon, lat)."""
    root = ET.parse(kml_path).getroot()

    gemeentes: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
    for placemark in root.iter(f"{{{KML_NS}}}Placemark"):
        gemeentes[_placemark_name(placemark)].extend(_boundary_points(placemark))

    if not gemeentes:
        raise ValueError(f"No placemarks found in {kml_path}")

    return dict(gemeentes)


def _find_touching_pairs(
    gemeentes: Dict[str, List[Tuple[float, float]]],
    tolerance_m: float = DEFAULT_TOLERANCE_M,
    min_shared_points: int = DEFAULT_MIN_SHARED_POINTS,
) -> List[Pair]:
    """
    Return the alphabetically sorted (a, b) pairs that share a border.

    Boundary points are projected to metres and dropped into a grid of
    `tolerance_m` cells. Two points can only be within tolerance of each
    other if they land in the same cell or one of its 8 neighbours, which
    turns the comparison into a linear scan instead of 187k x 187k.
    """
    all_points = [point for points in gemeentes.values() for point in points]
    mean_lat = sum(lat for _, lat in all_points) / len(all_points)
    lon_scale = METRES_PER_DEGREE * math.cos(math.radians(mean_lat))

    def project(lon: float, lat: float) -> Tuple[float, float]:
        return lon * lon_scale, lat * METRES_PER_DEGREE

    # Cell -> the projected points in it, tagged with their gemeente.
    grid: Dict[Tuple[int, int], List[Tuple[float, float, str]]] = defaultdict(list)
    for name, points in gemeentes.items():
        for lon, lat in points:
            x, y = project(lon, lat)
            grid[(int(x // tolerance_m), int(y // tolerance_m))].append((x, y, name))

    # Pair -> the distinct cells where the two gemeentes meet. Counting cells
    # rather than point comparisons keeps duplicated vertices from inflating
    # a single contact point into a whole "shared border".
    contacts: Dict[Pair, Set[Tuple[int, int]]] = defaultdict(set)
    for cell, points in grid.items():
        cell_x, cell_y = cell
        neighbourhood = [
            other
            for dx in (-1, 0, 1)
            for dy in (-1, 0, 1)
            for other in grid.get((cell_x + dx, cell_y + dy), ())
        ]
        for x, y, name in points:
            for other_x, other_y, other_name in neighbourhood:
                if other_name == name:
                    continue
                if math.dist((x, y), (other_x, other_y)) <= tolerance_m:
                    pair = (name, other_name) if name < other_name else (other_name, name)
                    contacts[pair].add(cell)

    return sorted(pair for pair, cells in contacts.items() if len(cells) >= min_shared_points)


@lru_cache(maxsize=1)
def get_gemeente_pairs() -> List[Pair]:
    """
    Every pair of gemeentes that border each other, as (a, b) sorted by name.

    Reading the KML takes about a second, and the boundaries are a file on
    disk that cannot change while the server runs, so the result is cached
    for the lifetime of the process. app/main.py warms it at startup.

    The cached list is handed to every caller - treat it as read-only.
    """
    return _find_touching_pairs(_read_gemeentes(KML_PATH))
