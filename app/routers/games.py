"""
Game endpoints:

    GET  /games
    POST /{game_id}/create
    GET  /{game_id}/status
    GET  /{game_id}/teams
    POST /{game_id}/{team_color}/login
    GET  /{game_id}/{team_color}/session          (needs the team's cookie)
    GET  /{game_id}/{team_color}/cards            (needs the team's cookie)
    PUT  /{game_id}/{team_color}/claim/{card_id}  (needs the team's cookie)
    PUT  /{game_id}/{team_color}/discard/{card_id} (needs the team's cookie)

The marked routes are the ones that act *as* a team, so they carry
require_team (app/auth.py). The rest stay open: the join page has to list
games and teams before anyone has a token, and creating a new game is no
way to cheat in an existing one.

Routers stay thin: parse/validate the request, call into app.services,
translate service-layer errors into HTTP responses.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlmodel import Session

from app.auth import require_team, set_team_cookie, token_matches
from app.database import get_session
from app.models import Card, Team, TeamColor
from app.schemas import (
    GameCreateRequest,
    GameCreateResponse,
    GameStatus,
    GameSummary,
    TeamLoginRequest,
    TeamPublic,
)
from app.services import (
    CardNotFoundError,
    CardNotVisibleError,
    GameAlreadyExistsError,
    GameNotFoundError,
    InvalidActionError,
    claim_card,
    create_game,
    discard_card,
    game_status,
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
        teams_created=len(result.teams),
        cards_seeded=result.cards_seeded,
        cards_on_public_board=result.cards_on_public_board,
        teams=result.teams,
    )


@router.get(
    "/{game_id}/status",
    response_model=GameStatus,
    summary="Whether the game has started yet, and the instant it does",
)
def game_status_endpoint(
    game_id: str = GameIdPath,
    session: Session = Depends(get_session),
):
    try:
        return game_status(session, game_id)
    except GameNotFoundError as exc:
        _raise_as_http(exc)


@router.get(
    "/{game_id}/teams",
    response_model=List[TeamPublic],
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


@router.post(
    "/{game_id}/{team_color}/login",
    response_model=TeamPublic,
    summary="Exchange a team's token for the cookie the other endpoints want",
)
def login_endpoint(
    body: TeamLoginRequest,
    response: Response,
    game_id: str = GameIdPath,
    team_color: TeamColor = Path(...),
    session: Session = Depends(get_session),
):
    """
    The one place a token is sent by hand. Everything after this rides on
    the cookie, which the browser attaches to same-origin requests itself.

    The comparison is exact - the join page uppercases what was typed
    before sending it, rather than the server guessing at what someone
    meant.
    """
    try:
        team = get_team_or_raise(session, game_id, team_color)
    except GameNotFoundError as exc:
        _raise_as_http(exc)

    if not token_matches(team, body.token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"That's not the code for {team.team_name}.",
        )

    set_team_cookie(response, body.token)
    return team


@router.get(
    "/{game_id}/{team_color}/session",
    response_model=TeamPublic,
    summary="Whether the cookie already signs this browser in as this team",
)
def session_endpoint(team: Team = Depends(require_team)):
    """
    Nothing but the require_team check, surfaced as an endpoint.

    The token lives in an HttpOnly cookie, so the join page can't read it
    and can't work out on its own whether it's still valid - or which
    team it belongs to. This answers that, and the team it returns is
    what the resume button gets labelled with. 401 means "no shortcut",
    which is a normal answer here rather than an error.

    The path parameters are declared by require_team itself, which is why
    this takes none of its own.
    """
    return team


@router.get(
    "/{game_id}/{team_color}/cards",
    response_model=List[Card],
    dependencies=[Depends(require_team)],
    summary="List cards currently visible to a team",
)
def get_cards_endpoint(
    game_id: str = GameIdPath,
    team_color: TeamColor = Path(...),
    session: Session = Depends(get_session),
):
    # No team lookup here: require_team has already 404'd an unknown team
    # and 401'd anyone without that team's token.
    return get_cards_for_team(session, game_id, team_color)


@router.put(
    "/{game_id}/{team_color}/claim/{card_id}",
    response_model=List[Card],
    dependencies=[Depends(require_team)],
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
    dependencies=[Depends(require_team)],
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
