"""
Reference data about the gemeentes and the deck:

    GET /pairs
    GET /wildcards

Both are static - the borders are derived from the CBS KML export, the
wild-card scopes are hand-maintained in app/game_data.py - so neither
takes a game_id nor touches the database.
"""

from typing import Dict, List, Tuple

from fastapi import APIRouter

from app.game_data import WILD_CARDS, get_gemeente_pairs

router = APIRouter()


@router.get(
    "/pairs",
    response_model=List[Tuple[str, str]],
    summary="Every pair of gemeentes that border each other",
)
def get_gemeente_pairs_endpoint():
    return get_gemeente_pairs()


@router.get(
    "/wildcards",
    response_model=Dict[str, List[str]],
    summary="Which gemeentes each wild card may be played on",
)
def get_wild_card_gemeentes_endpoint():
    """
    Wild card name -> the gemeentes that card applies to.

    A wild card's challenge hangs off something that only exists in some
    gemeentes, so claiming with it only works on these. The board uses
    this to stripe them, and to list the wild cards that apply when you
    open a gemeente.
    """
    return WILD_CARDS
