"""
Gemeente reference data:

    GET /pairs

This is static map data derived from the CBS KML export, not game state,
so it takes no game_id and touches no database.
"""

from typing import List, Tuple

from fastapi import APIRouter

from app.game_data import get_gemeente_pairs

router = APIRouter()


@router.get(
    "/pairs",
    response_model=List[Tuple[str, str]],
    summary="Every pair of gemeentes that border each other",
)
def get_gemeente_pairs_endpoint():
    return get_gemeente_pairs()
