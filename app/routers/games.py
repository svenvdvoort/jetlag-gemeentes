"""
Game endpoints:

    GET  /games
    POST /{game_id}/create
    GET  /{game_id}/teams
    GET  /{game_id}/{team_color}/cards
    PUT  /{game_id}/{team_color}/claim/{card_id}
    PUT  /{game_id}/{team_color}/discard/{card_id}

Routers stay thin: parse/validate the request, call into app.services,
translate service-layer errors into HTTP responses.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlmodel import Session

from app.database import get_session
from app.models import Card, Team, TeamColor
from app.schemas import GameCreateRequest, GameCreateResponse, GameSummary
from app.services import (
    CardNotFoundError,
    CardNotVisibleError,
    GameAlreadyExistsError,
    GameNotFoundError,
    InvalidActionError,
    claim_card,
    create_game,
    discard_card,
    get_team_or_raise,
    get_cards_for_team,
    list_games,
    list_teams,
)

router = APIRouter()

# GameID is alphanumeric, no spaces - enforced on every route that takes one.
GameIdPath = Path(
    ...,
    pattern=r"^[A-Za-z0-9]+$",
    description="Alphanumeric game identifier, no spaces.",
)


def _raise_as_http(exc: Exception) -> None:
    if isinstance(exc, (GameNotFoundError, CardNotFoundError)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, GameAlreadyExistsError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, CardNotVisibleError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, InvalidActionError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "/games",
    response_model=List[GameSummary],
    summary="List every game, with how many teams each has",
)
def list_games_endpoint(session: Session = Depends(get_session)):
    return list_games(session)


@router.post(
    "/{game_id}/create",
    response_model=GameCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a game: set up teams and deal the starting cards",
)
def create_game_endpoint(
    body: GameCreateRequest,
    game_id: str = GameIdPath,
    session: Session = Depends(get_session),
):
    try:
        result = create_game(session, game_id, body.teams)
    except (GameAlreadyExistsError, InvalidActionError) as exc:
        _raise_as_http(exc)
    return GameCreateResponse(
        game_id=game_id,
        teams_created=result.teams_created,
        cards_seeded=result.cards_seeded,
        cards_on_public_board=result.cards_on_public_board,
    )


@router.get(
    "/{game_id}/teams",
    response_model=List[Team],
    summary="List all teams in a game (name, color, can_discard_card)",
)
def list_teams_endpoint(
    game_id: str = GameIdPath,
    session: Session = Depends(get_session),
):
    try:
        return list_teams(session, game_id)
    except GameNotFoundError as exc:
        _raise_as_http(exc)


@router.get(
    "/{game_id}/{team_color}/cards",
    response_model=List[Card],
    summary="List cards currently visible to a team",
)
def get_cards_endpoint(
    game_id: str = GameIdPath,
    team_color: TeamColor = Path(...),
    session: Session = Depends(get_session),
):
    try:
        get_team_or_raise(session, game_id, team_color)
    except GameNotFoundError as exc:
        _raise_as_http(exc)
    return get_cards_for_team(session, game_id, team_color)


@router.put(
    "/{game_id}/{team_color}/claim/{card_id}",
    response_model=List[Card],
    summary="Claim a card for a team; returns the card that replenished the public board",
)
def claim_card_endpoint(
    game_id: str = GameIdPath,
    team_color: TeamColor = Path(...),
    card_id: int = Path(..., description="ID of the card being claimed."),
    target_card_id: Optional[int] = Query(
        default=None,
        description=(
            "Required if and only if `card_id` is a wild card: the ID of the "
            "gemeente card being claimed with it."
        ),
    ),
    session: Session = Depends(get_session),
):
    try:
        return claim_card(session, game_id, team_color, card_id, target_card_id)
    except (GameNotFoundError, CardNotFoundError, CardNotVisibleError, InvalidActionError) as exc:
        _raise_as_http(exc)


@router.put(
    "/{game_id}/{team_color}/discard/{card_id}",
    response_model=Card,
    summary="Discard a public-board card for a team; returns the card that replenished the public board",
)
def discard_card_endpoint(
    game_id: str = GameIdPath,
    team_color: TeamColor = Path(...),
    card_id: int = Path(..., description="ID of the card being discarded."),
    session: Session = Depends(get_session),
):
    try:
        return discard_card(session, game_id, team_color, card_id)
    except (GameNotFoundError, CardNotFoundError, InvalidActionError) as exc:
        _raise_as_http(exc)
