"""
Game business logic, kept separate from the routers so the endpoints stay
thin and the random-draw / visibility rules are defined exactly once.
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func
from sqlalchemy.orm.session import make_transient
from sqlmodel import Session, select

from app.auth import generate_team_token
from app.challenges import CHALLENGES
from app.game_data import EMPTY_CHALLENGE, GEMEENTES, WILD_CARDS
from app.models import Card, CardState, Team, TeamColor
from app.schemas import GameStatus, GameSummary, TeamCreate, TeamToken

PRIVATE_BOARD_CARDS_PER_TEAM = 4
PUBLIC_BOARD_INITIAL_CARDS = 7

# The game runs on Amsterdam wall-clock time: the times below are the
# ones the players read off their own phones, whatever timezone the server
# happens to be in and whichever side of the DST switch the game falls on.
# Everything stored in - and compared against - the database stays naive
# UTC, so these only become an instant through _utc_instant().
AMSTERDAM = ZoneInfo("Europe/Amsterdam")

# Kickoff. Creating a game deals every board straight away, but that
# usually happens the evening before, so until this time the deal is kept
# out of sight: every card reads as still in the deck and no claim is
# accepted. See game_starts_at().
GAME_START_TIME = time(10, 0)

# The 4 cards dealt to each team's private board get staggered reveal
# times: 2 at kickoff, 1 at 12:00, 1 at 14:00. Order doesn't matter
# since the 4 cards themselves were already drawn randomly.
PRIVATE_REVEAL_TIMES = [GAME_START_TIME, GAME_START_TIME, time(12, 0), time(14, 0)]


# --------------------------------------------------------------------------
# Errors - routers translate these into the appropriate HTTP status codes.
# --------------------------------------------------------------------------

class GameServiceError(Exception):
    """Base class for all game-logic errors."""


class GameAlreadyExistsError(GameServiceError):
    pass


class GameNotFoundError(GameServiceError):
    pass


class CardNotFoundError(GameServiceError):
    pass


class CardNotVisibleError(GameServiceError):
    pass


class InvalidActionError(GameServiceError):
    pass


# --------------------------------------------------------------------------
# Random card selection
# --------------------------------------------------------------------------

def draw_random_cards(session: Session, game_id: str, state: CardState, count: int, include_wildcards: bool = True) -> List[Card]:
    """
    Draw up to `count` random cards for a game currently in `state`.

    Uses the database's own RANDOM() function in ORDER BY, so the result
    does not depend on primary-key/insertion order the way a plain
    `... LIMIT n` query would - it's a genuine random sample each call.
    `func.random()` is supported by both SQLite and PostgreSQL, so this
    works unchanged against either backend.

    "Without replacement" across a *sequence* of draws (e.g. dealing to
    several teams in a row) is guaranteed because each draw only looks at
    cards still in `state`; as soon as a card's state is changed and
    flushed, it drops out of the pool for the next draw.
    """
    statement = (
        _current_cards(game_id)
        .where(Card.card_state == state)
    )
    if not include_wildcards:
        statement = statement.where(Card.is_wild_card == False)
    statement = (
        statement
        .order_by(func.random())
        .limit(count)
    )
    return list(session.exec(statement).all())


# --------------------------------------------------------------------------
# Kickoff (nothing is revealed, and nothing can be claimed, before it)
# --------------------------------------------------------------------------

def _amsterdam_date(moment: datetime) -> date:
    """The Amsterdam calendar day a naive-UTC instant falls on."""
    return moment.replace(tzinfo=timezone.utc).astimezone(AMSTERDAM).date()


def _utc_instant(day: date, local_time: time) -> datetime:
    """`local_time` on `day`, Amsterdam, as the naive UTC the database stores."""
    return (
        datetime.combine(day, local_time, tzinfo=AMSTERDAM)
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )


def game_starts_at(session: Session, game_id: str) -> Optional[datetime]:
    """
    When this game kicks off: GAME_START_TIME (Amsterdam) on the day it
    was created, as naive UTC. None for a game that has no cards, which
    isn't a game anyone can play.

    Derived rather than stored. There's no games table - a game exists
    implicitly as a game_id shared by its rows - and the schedule is a
    constant of this event rather than a per-game setting (same as
    PRIVATE_REVEAL_TIMES), so the only thing needed from the game itself
    is the day it was created. The cards table is an append-only ledger,
    which makes its oldest row for a game exactly the moment create_game
    ran - no column, and no backfill for games created before this rule
    existed.
    """
    created = session.exec(
        select(func.min(Card.updated_timestamp)).where(Card.game_id == game_id)
    ).one()
    if created is None:
        return None
    return _utc_instant(_amsterdam_date(created), GAME_START_TIME)


def game_has_started(session: Session, game_id: str, now: Optional[datetime] = None) -> bool:
    """Whether the game is on yet. A game with no cards counts as started - it has nothing to hide."""
    starts_at = game_starts_at(session, game_id)
    if starts_at is None:
        return True
    return (now or datetime.utcnow()) >= starts_at


def game_status(session: Session, game_id: str) -> GameStatus:
    """
    What the board needs to know before it draws anything: whether the
    game is on, and if not, the instant it will be - see GameStatus.
    """
    starts_at = game_starts_at(session, game_id)
    if starts_at is None:
        raise GameNotFoundError(f"Game '{game_id}' not found.")

    now = datetime.utcnow()
    return GameStatus(
        game_id=game_id,
        starts_at=starts_at.replace(tzinfo=timezone.utc),
        started=now >= starts_at,
        server_time=now.replace(tzinfo=timezone.utc),
    )


# --------------------------------------------------------------------------
# Visibility rule (shared by GET /cards and the claim endpoint)
# --------------------------------------------------------------------------

def card_on_board_for_team(card: Card, team_color: TeamColor, now: Optional[datetime] = None) -> bool:
    """
    A card is visible to `team_color` if:
      - it has already been claimed (by anyone), or
      - it's on the public board, or
      - it's on this team's private board and its reveal time has passed.
    """
    now = now or datetime.utcnow()

    if card.card_state == CardState.ON_PUBLIC_BOARD:
        return True
    if card.card_state == CardState.ON_PRIVATE_BOARD and \
       card.private_board_team == team_color.value and \
       card.visible_from is not None and \
       card.visible_from <= now:
        return True
    return False


def _hide_as_in_deck(card: Card) -> None:
    """
    Rewrite one card into "still in the deck" for one team's response.

    The stored row is left alone: this edits the objects on their way out
    through the response model, and the request's session is closed
    without ever committing them, so hiding a card from one team can't
    hide it from the game.
    """
    card.card_state = CardState.IN_DECK
    card.private_board_team = None
    card.visible_from = None
    card.claimed_team = None


def _redact_as_face_down(card: Card) -> None:
    """
    Turn one of the team's own private cards that isn't due yet into a
    face-down one: it keeps its state, its team and the time it opens, so
    the team knows a card is coming and when, but loses everything that
    would say which card it is.

    The id goes too, not just the name: ids are handed out in GEMEENTES
    order (see create_game), so it would name the gemeente on its own.

    Same deal as _hide_as_in_deck - the stored row is untouched, this only
    rewrites the object on its way out through the response model.
    """
    card.card_id = -1
    card.card_name = ""
    card.challenge_title = ""
    card.challenge_description = ""
    card.challenge_link = None
    card.claimed_team = None
    card.is_wild_card = False


def get_cards_for_team(session: Session, game_id: str, team_color: TeamColor) -> List[Card]:
    """
    All cards as they are visible to this team.
    Accounts for a game that hasn't kicked off yet, for private cards of
    other teams, and for the team's own private cards that aren't due yet.
    """
    now = datetime.utcnow()
    # Asked before any card is touched: a query run after the edits below
    # would autoflush them into the database on its way out.
    started = game_has_started(session, game_id, now)
    all_cards = session.exec(_current_cards(game_id)).all()
    for card in all_cards:
        card.updated_timestamp = now
        if not started:
            # The deal happens when the game is created, but nobody sees
            # it before kickoff: no public board, no private cards,
            # nothing claimed. Every card still comes back - an InDeck
            # card always does, challenge text and all - just as a deck
            # nobody has dealt from yet.
            _hide_as_in_deck(card)
        elif card.card_state == CardState.ON_PRIVATE_BOARD:
            if card.private_board_team != team_color:
                # Another team's private card: not ours to know about at all.
                _hide_as_in_deck(card)
            elif card.visible_from > now:
                # Ours, but not open yet - the team sees a blacked-out
                # card with the time on it rather than nothing at all.
                _redact_as_face_down(card)
    # Sort card by gemeente naam before returning to web client
    all_cards = sorted(all_cards, key=lambda card: card.card_name)
    return all_cards


# --------------------------------------------------------------------------
# Lookups
# --------------------------------------------------------------------------

def get_team_or_raise(session: Session, game_id: str, team_color: TeamColor) -> Team:
    team = session.get(Team, (game_id, team_color))
    if team is None:
        raise GameNotFoundError(f"Team '{team_color.value}' not found in game '{game_id}'.")
    return team


def get_pending_discard_team(session: Session, game_id: str) -> Optional[Team]:
    """
    The team that is discarding, or None if nobody does.

    A mandatory discard freezes the whole game, not just the team that
    is discarding: while a card is waiting to be thrown away, no team may
    claim. That makes "is a discard pending?" a question about the game
    rather than about one team, which is why this looks at every team in
    it. At most one team can be discarding at a time, since the claim
    that hands a discard out is itself blocked while one is in progress.
    """
    statement = select(Team).where(Team.game_id == game_id, Team.can_discard_card)
    return session.exec(statement).first()


def list_teams(session: Session, game_id: str) -> List[Team]:
    """All teams registered for a game, e.g. for a score bar or lobby view."""
    teams = session.exec(select(Team).where(Team.game_id == game_id)).all()
    if not teams:
        raise GameNotFoundError(f"Game '{game_id}' not found.")
    return list(teams)


def list_games(session: Session) -> List[GameSummary]:
    """
    Every game that has at least one team, with how many teams it has.

    There is no games table - a game exists implicitly as a game_id shared
    by its teams - so the list is derived by grouping the teams table.
    Unlike list_teams, an empty result is not an error: "no games yet" is a
    normal state for the join page to render.
    """
    statement = (
        select(Team.game_id, func.count().label("team_count"))
        .group_by(Team.game_id)
        .order_by(Team.game_id)
    )
    return [
        GameSummary(game_id=game_id, team_count=team_count)
        for game_id, team_count in session.exec(statement)
    ]


def get_card_or_raise(session: Session, game_id: str, card_id: int) -> Card:
    card = _current_cards(game_id).where(Card.card_id == card_id)
    card = session.exec(card).first()
    if card is None:
        raise CardNotFoundError(f"Card {card_id} not found in game '{game_id}'.")
    return card


def _current_cards(game_id: str, when: Optional[datetime] = None):
    """
    Returns query for the current state of all cards in the game.
    This is where we account for the 'ledger'-style updates we do
    in the Cards database table; instead of overwriting the state
    of a card on an update, we append a new record to the table
    with the new state and a more recent timestamp.
    """
    latest_versions = (
        select(
            Card.game_id.label("game_id"),
            Card.card_id.label("card_id"),
            func.max(Card.updated_timestamp).label("updated_timestamp"),
        )
        .where(Card.game_id == game_id)
    )
    if when:
        latest_versions = latest_versions.where(Card.updated_timestamp <= when)
    latest_versions = (
        latest_versions
        .group_by(Card.game_id, Card.card_id)
        .subquery()
    )
    return (
        select(Card)
        .join(
            latest_versions,
            and_(
                Card.game_id == latest_versions.c.game_id,
                Card.card_id == latest_versions.c.card_id,
                Card.updated_timestamp == latest_versions.c.updated_timestamp,
            ),
        )
        .where(Card.game_id == game_id)
    )


# --------------------------------------------------------------------------
# POST /{game_id}/create
# --------------------------------------------------------------------------

def create_game(session: Session, game_id: str, teams: List[TeamCreate]) -> GameCreationResult:
    existing_team = session.exec(select(Team).where(Team.game_id == game_id)).first()
    if existing_team is not None:
        raise GameAlreadyExistsError(f"Game '{game_id}' already exists.")

    try:
        now = datetime.utcnow()
        # 1. Teams, each with a freshly generated token. The tokens are
        #    collected as plain schema objects here rather than read back
        #    off the rows later: after the commit at the end of this
        #    function those rows are expired, and this is the only moment
        #    the API ever hands a token out.
        created_teams: List[TeamToken] = []
        for t in teams:
            token = generate_team_token()
            session.add(Team(
                game_id=game_id,
                team_color=t.team_color,
                team_name=t.team_name,
                token=token,
            ))
            created_teams.append(TeamToken(
                team_color=t.team_color,
                team_name=t.team_name,
                token=token,
            ))

        # 2. Seed the full deck: all gemeentes + wild cards, InDeck, with the
        #    challenge text imported from the sheet. A card whose challenge
        #    hasn't been written yet just gets empty text - the front end
        #    renders that fine - and so does one missing from CHALLENGES
        #    altogether, so an out-of-date app/challenges.py degrades to a
        #    blank card instead of breaking game creation.
        card_id = 1
        for name in GEMEENTES:
            challenge = CHALLENGES.get(name, EMPTY_CHALLENGE)
            session.add(Card(
                game_id=game_id,
                card_id=card_id,
                card_name=name,
                card_state=CardState.IN_DECK,
                challenge_title=challenge.title,
                challenge_description=challenge.description,
                challenge_link=challenge.link or None,
                is_wild_card=False,
            ))
            card_id += 1
        for name in WILD_CARDS:
            challenge = CHALLENGES.get(name, EMPTY_CHALLENGE)
            session.add(Card(
                game_id=game_id,
                card_id=card_id,
                card_name=name,
                card_state=CardState.IN_DECK,
                challenge_title=challenge.title,
                challenge_description=challenge.description,
                challenge_link=challenge.link or None,
                is_wild_card=True,
            ))
            card_id += 1
        total_cards_seeded = card_id - 1
        session.flush()

        # 3. Deal 4 random private-board cards to each team, staggered
        #    reveal times. Flushing after each team's draw is what makes
        #    the *next* team's random draw exclude these cards.
        # Amsterdam's day rather than UTC's, so a game created late in the
        # evening still schedules onto the day its players call today -
        # and so it agrees with what game_starts_at() derives later.
        game_day = _amsterdam_date(now)
        for t in teams:
            drawn = draw_random_cards(session, game_id, CardState.IN_DECK, PRIVATE_BOARD_CARDS_PER_TEAM, include_wildcards=False)
            if len(drawn) < PRIVATE_BOARD_CARDS_PER_TEAM:
                raise InvalidActionError(
                    "Not enough cards left in the deck to deal private boards to every team."
                )
            for card, reveal_time in zip(drawn, PRIVATE_REVEAL_TIMES):
                card.card_state = CardState.ON_PRIVATE_BOARD
                card.private_board_team = t.team_color.value
                card.visible_from = _utc_instant(game_day, reveal_time)
                card.updated_timestamp = now
                session.add(card)
            session.flush()

        # 4. Reveal 7 random cards on the public board.
        public_cards = draw_random_cards(session, game_id, CardState.IN_DECK, PUBLIC_BOARD_INITIAL_CARDS)
        if len(public_cards) < PUBLIC_BOARD_INITIAL_CARDS:
            raise InvalidActionError("Not enough cards left in the deck to fill the public board.")
        for card in public_cards:
            card.card_state = CardState.ON_PUBLIC_BOARD
            card.updated_timestamp = now
            session.add(card)
        session.flush()

        session.commit()
    except Exception:
        session.rollback()
        raise

    return GameCreationResult(
        teams=created_teams,
        cards_seeded=total_cards_seeded,
        cards_on_public_board=len(public_cards),
    )


class GameCreationResult:
    def __init__(self, teams: List[TeamToken], cards_seeded: int, cards_on_public_board: int):
        self.teams = teams
        self.cards_seeded = cards_seeded
        self.cards_on_public_board = cards_on_public_board


# --------------------------------------------------------------------------
# PUT /{game_id}/{team_color}/claim/{card_id}
# --------------------------------------------------------------------------

def _clone_card(session: Session, card: Card) -> Card:
    # remove the object from the session (set its state to detached)
    session.expunge(card)
    # make it transient (set its state to transient)
    make_transient(card)
    return card


def _replenish_public_board(session: Session, game_id: str, now: datetime) -> Card:
    """Draw 1 random InDeck card and move it to the public board."""
    drawn = draw_random_cards(session, game_id, CardState.IN_DECK, 1)
    if not drawn:
        raise InvalidActionError("No cards left in the deck to replenish the public board.")
    new_card = _clone_card(session, drawn[0])
    new_card.card_state = CardState.ON_PUBLIC_BOARD
    new_card.updated_timestamp = now
    session.add(new_card)
    session.flush()
    return new_card


def claim_card(
    session: Session,
    game_id: str,
    team_color: TeamColor,
    card_id: int,
    target_card_id: Optional[int] = None,
) -> List[Card]:
    """
    Claim `card_id` for `team_color`.

    Returns the list of newly-drawn cards that replenished the public
    board - 0, 1, or 2 of them:
      - a non-wild claim frees at most 1 slot (the claimed card itself,
        if it was on the public board)
      - a wild-card claim can free up to 2 slots (the wild card and/or
        the target card, independently, if either was on the public
        board)
    """
    team = get_team_or_raise(session, game_id, team_color)
    card = get_card_or_raise(session, game_id, card_id)

    # Nothing is claimable before kickoff. A board that hasn't heard the
    # game is on yet can't offer this anyway (every card reads as InDeck
    # to it), so this is the backstop for one that asks regardless.
    starts_at = game_starts_at(session, game_id)
    if starts_at is not None and datetime.utcnow() < starts_at:
        local_start = starts_at.replace(tzinfo=timezone.utc).astimezone(AMSTERDAM)
        raise InvalidActionError(
            f"The game hasn't started yet - it starts at {local_start:%H:%M}."
        )

    # Claims are frozen for everyone while a discard is outstanding, so
    # this looks at the whole game and not just at `team`.
    pending_team = get_pending_discard_team(session, game_id)
    if pending_team is not None:
        if pending_team.team_color == team_color:
            raise InvalidActionError(f"Team {team_color.value} has to discard a card first!")
        else:
            raise InvalidActionError(
                f"The game is frozen until team {pending_team.team_color.value} discards a card!"
            )

    if card.card_state == CardState.CLAIMED:
        raise InvalidActionError(
            f"Card {card_id} has already been claimed!"
        )

    if not card_on_board_for_team(card, team_color):
        raise CardNotVisibleError(f"Card {card_id} is not visible to team '{team_color.value}'.")

    try:
        now = datetime.utcnow()
        new_cards: List[Card] = []
        was_public_card = card.card_state == CardState.ON_PUBLIC_BOARD

        card = _clone_card(session, card)
        card.card_state = CardState.CLAIMED
        card.claimed_team = team_color.value
        card.updated_timestamp = now
        session.add(card)
        session.flush()

        if card.is_wild_card:
            # A wild card lets the team claim any not-yet-claimed regular
            # card, regardless of that card's current visibility - that's
            # the whole point of a wild card.
            if target_card_id is None:
                raise InvalidActionError(
                    "Claiming a wild card requires a 'target_card_id' query parameter "
                    "identifying the gemeente card being claimed with it."
                )
            target_card = get_card_or_raise(session, game_id, target_card_id)
            if target_card.is_wild_card:
                raise InvalidActionError("The target card must be a regular (non-wild) card.")
            if target_card.card_state == CardState.CLAIMED:
                raise InvalidActionError(f"Target card {target_card_id} has already been claimed.")

            target_card_was_public = target_card.card_state == CardState.ON_PUBLIC_BOARD

            target_card = _clone_card(session, target_card)
            target_card.card_state = CardState.CLAIMED
            target_card.claimed_team = team_color.value
            target_card.updated_timestamp = now
            session.add(target_card)
            session.flush()
            
            if target_card_was_public:
                new_card = _replenish_public_board(session, game_id, now)
                new_cards.append(new_card)
        
        if was_public_card:
            new_card = _replenish_public_board(session, game_id, now)
            new_cards.append(new_card)
        
        team.can_discard_card = True
        session.add(team)
        
        session.commit()
    except Exception:
        session.rollback()
        raise

    for card in new_cards:
        session.refresh(card)
    return new_cards


# --------------------------------------------------------------------------
# PUT /{game_id}/{team_color}/discard/{card_id}
# --------------------------------------------------------------------------

def discard_card(session: Session, game_id: str, team_color: TeamColor, card_id: int) -> Card:
    team = get_team_or_raise(session, game_id, team_color)
    card = get_card_or_raise(session, game_id, card_id)

    if card.card_state != CardState.ON_PUBLIC_BOARD:
        raise InvalidActionError(f"Card {card_id} is not on the public board.")
    if not team.can_discard_card:
        raise InvalidActionError(f"Team '{team_color.value}' is not currently allowed to discard.")

    try:
        now = datetime.utcnow()
        card = _clone_card(session, card)
        card.card_state = CardState.IN_DECK
        card.private_board_team = None
        card.claimed_team = None
        card.visible_from = None
        card.updated_timestamp = now
        session.add(card)

        team.can_discard_card = False
        session.add(team)

        session.flush()
        new_card = _replenish_public_board(session, game_id, now)
        session.commit()
    except Exception:
        session.rollback()
        raise

    session.refresh(new_card)
    return new_card
