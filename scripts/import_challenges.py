"""
Turn challenges.csv into app/challenges.py.

    python -m scripts.import_challenges [--dry-run]

challenges.csv is a Google Sheets export and is the source of truth for the
challenge text; app/challenges.py is generated from it and committed, so the
running app never has to read the CSV. Re-run this after every re-export.

The sheet holds several unrelated blocks side by side - prose guidelines, a
packing list, a "Generic ideas" list - so the card rows have to be located
rather than assumed: columns come from the header row by name (they shift
whenever someone inserts a column) and the block ends at the first row
without a card name.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from app.game_data import GEMEENTES, WILD_CARDS, Challenge

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CSV = REPO_ROOT / "challenges.csv"
DEFAULT_OUT = REPO_ROOT / "app" / "challenges.py"

# Header labels we need. The name column itself is unlabeled in the sheet.
TITLE_HEADER = "Challenge title"
LINK_HEADER = "Challenge links"
DESCRIPTION_HEADER = "Challenge description"

# The card name sits in the first column, which has no header text.
NAME_COLUMN = 0

DECK = GEMEENTES + WILD_CARDS


class SheetError(Exception):
    """Something about the CSV means we must not write a new module."""


def _cell(row: Sequence[str], index: int) -> str:
    """The stripped cell at `index`, or "" if the row is shorter than that."""
    return row[index].strip() if index < len(row) else ""


def _find_header(rows: List[List[str]]) -> Tuple[int, Dict[str, int]]:
    """The index of the header row and its label -> column mapping."""
    for number, row in enumerate(rows):
        labels = {cell.strip(): index for index, cell in enumerate(row) if cell.strip()}
        if DESCRIPTION_HEADER in labels:
            return number, labels

    raise SheetError(
        f"No header row found: expected a row containing a {DESCRIPTION_HEADER!r} cell."
    )


def parse(csv_path: Path) -> Tuple[Dict[str, Challenge], List[str]]:
    """
    Read the card rows out of the sheet.

    Returns the challenges by card name, plus the names whose description was
    taken from the overflow column (see below) so the caller can report them.
    """
    with csv_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))

    header_number, labels = _find_header(rows)
    for header in (TITLE_HEADER, LINK_HEADER):
        if header not in labels:
            raise SheetError(
                f"The header row (row {header_number + 1}) has no {header!r} column; "
                f"found {sorted(labels)}."
            )

    title_column = labels[TITLE_HEADER]
    link_column = labels[LINK_HEADER]
    description_column = labels[DESCRIPTION_HEADER]

    # Text typed one cell too far right lands in the unlabeled column next to
    # the description. That is a data-entry slip, not an input we bless, so we
    # only fall back to it when the description cell is empty - which is also
    # what keeps the wild cards' "Gemeenten met ..." notes, which live in that
    # same column, from being mistaken for challenge text.
    overflow_column = description_column + 1

    challenges: Dict[str, Challenge] = {}
    overflowed: List[str] = []

    for row in rows[header_number + 1 :]:
        name = _cell(row, NAME_COLUMN)
        if not name:
            # First row without a card name ends the block; everything below
            # it belongs to another part of the sheet.
            break

        if name in challenges:
            raise SheetError(f"Card {name!r} appears twice in {csv_path.name}.")
        if name not in DECK:
            raise SheetError(
                f"Card {name!r} in {csv_path.name} is not in GEMEENTES or WILD_CARDS "
                f"(app/game_data.py). Add it there, or fix the name in the sheet."
            )

        description = _cell(row, description_column)
        if not description:
            description = _cell(row, overflow_column)
            if description:
                overflowed.append(name)

        challenges[name] = Challenge(
            title=_cell(row, title_column),
            description=description,
            link=_cell(row, link_column),
        )

    missing = [name for name in DECK if name not in challenges]
    if missing:
        raise SheetError(
            f"{len(missing)} card(s) have no row in {csv_path.name}: {', '.join(missing)}."
        )

    return challenges, overflowed


def render(challenges: Dict[str, Challenge], csv_name: str) -> str:
    """The text of the generated module, with the cards in deck order."""
    lines = [
        '"""',
        f"Challenge text per card, generated from {csv_name}.",
        "",
        "Do not edit by hand - run `python -m scripts.import_challenges` instead.",
        "Cards are in deck order (GEMEENTES, then WILD_CARDS) and every card in",
        "the deck has an entry, so an empty title, description or link means the",
        "sheet itself is still empty there.",
        '"""',
        "",
        "from typing import Dict",
        "",
        "from app.game_data import Challenge",
        "",
        "CHALLENGES: Dict[str, Challenge] = {",
    ]

    for name in DECK:
        challenge = challenges[name]
        lines.append(f"    {name!r}: Challenge(")
        lines.append(f"        title={challenge.title!r},")
        lines.append(f"        description={challenge.description!r},")
        lines.append(f"        link={challenge.link!r},")
        lines.append("    ),")

    lines.append("}")
    return "\n".join(lines) + "\n"


def report(challenges: Dict[str, Challenge], overflowed: List[str]) -> None:
    described = [name for name, c in challenges.items() if c.description]
    titled = [name for name, c in challenges.items() if c.title]
    linked = [name for name, c in challenges.items() if c.link]
    empty = [name for name, c in challenges.items() if not c.description]

    print(
        f"{len(challenges)} cards, {len(described)} with a description, "
        f"{len(titled)} with a title, {len(linked)} with a link."
    )
    if empty:
        print(f"\nNo description yet ({len(empty)}):")
        for name in empty:
            print(f"  - {name}")
    if overflowed:
        print(
            f"\nDescription taken from the column right of "
            f"{DESCRIPTION_HEADER!r} ({len(overflowed)}) - worth fixing in the sheet:"
        )
        for name in overflowed:
            print(f"  - {name}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="sheet export to read")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="module to write")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would be imported without writing the module",
    )
    args = parser.parse_args(argv)

    try:
        challenges, overflowed = parse(args.csv)
    except (SheetError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    report(challenges, overflowed)

    if args.dry_run:
        print(f"\nDry run: {args.out} not written.")
        return 0

    args.out.write_text(render(challenges, args.csv.name), encoding="utf-8")
    print(f"\nWrote {args.out}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
