# Jetlag Game API

REST API backing our version of the Jetlag "Hide and Seek" card game.

## Stack

- **[FastAPI](https://fastapi.tiangolo.com/)** - web framework. Chosen because
  new endpoints are just a Python function + a decorator, it gives you
  request validation and interactive docs (`/docs`) for free, and it pairs
  natively with SQLModel.
- **[SQLModel](https://sqlmodel.tiangolo.com/)** - ORM. A thin layer on top of
  SQLAlchemy + Pydantic, so each model class doubles as both the DB table
  definition and the API schema. Works unchanged against SQLite or
  PostgreSQL - only the connection URL differs.

## Project structure

```
jetlag-api/
├── app/
│   ├── __init__.py
│   ├── models.py     # ORM data model: Card, Team, CardState, TeamColor
│   ├── database.py   # engine/session setup, driven by DATABASE_URL
│   └── main.py       # FastAPI app entrypoint (endpoints added here next)
├── requirements.txt
├── .env.example
└── README.md
```

## Data model

### Cards (table `cards`)

Composite primary key: `(game_id, card_id)`.

| Field                 | Type                  | Notes                                             |
| --------------------- | --------------------- | ------------------------------------------------- |
| game_id               | str (PK)              |                                                   |
| card_id               | int (PK)              |                                                   |
| card_name             | str                   |                                                   |
| card_state            | enum `CardState`      | InDeck / OnPublicBoard / OnPrivateBoard / Claimed |
| challenge_title       | str                   |                                                   |
| challenge_description | str                   |                                                   |
| challenge_link        | str, optional         | from the sheet; shown as a link under the text    |
| visible_from          | datetime, optional    |                                                   |
| private_board_team    | str, optional         |                                                   |
| claimed_team          | str, optional         |                                                   |
| is_wild_card          | bool, default `False` |                                                   |
| updated_timestamp     | datetime, default now |                                                   |

### Teams (table `teams`)

Composite primary key: `(game_id, team_color)`.

| Field            | Type                  | Notes                  |
| ---------------- | --------------------- | ---------------------- |
| game_id          | str (PK)              |                        |
| team_color       | enum `TeamColor` (PK) | orange / blue / purple |
| team_name        | str                   |                        |
| can_discard_card | bool, default `False` |                        |

## Endpoints

### `GET /games`

Returns every game that exists, as `[{"game_id": ..., "team_count": ...}]`,
sorted by id. There is no games table, a game exists implicitly as a
`game_id` shared by its teams. The list is derived by grouping the
teams table. Added for the frontend's join page; an empty list is a
normal response, not a 404.

### `POST /{game_id}/create`

Creates a game: registers teams, seeds the full deck (all gemeentes +
wild cards, `InDeck`, each with its challenge text from
[Importing challenges](#importing-challenges)), deals 4 random cards to
each team's private board, and reveals 7 random cards on the public board.

Body:

```json
{
  "teams": [
    { "team_color": "orange", "team_name": "Team Oranje" },
    { "team_color": "blue", "team_name": "Team Blauw" },
    { "team_color": "purple", "team_name": "Team Paars" }
  ]
}
```

Rules: more than 1 team, team colors unique within the game, `game_id`
must not already exist.

Each team's 4 private cards get staggered reveal times (today): 2 cards
at 10:00, 1 at 12:00, 1 at 14:00.

### `GET /{game_id}/teams`

Returns every team registered in the game (`team_color`, `team_name`,
`can_discard_card`) - added for the frontend's score bar and to know
when a team is currently allowed to discard. There's no per-team
filtering: any client can see the full roster, which is also how a team
finds out that *another* team is discarding and the game is frozen.

### `GET /{game_id}/{team_color}/cards`

Returns all cards currently visible to `team_color`: claimed cards (any
team), public-board cards, and that team's private-board cards whose
`visible_from` has passed. Shared visibility logic lives in
`app/services.py::card_visible_to_team`.

### `PUT /{game_id}/{team_color}/claim/{card_id}`

Claims `card_id` for `team_color`, after checking it's visible to that
team and that no discard is outstanding anywhere in the game.

A mandatory discard freezes the whole game, not just the team that is
discarding: while any team's `can_discard_card` is `True`, every claim in that
game is refused with `400`. The error names the team being waited on so
the frontend can say who's holding things up.
`get_pending_discard_team()` in `app/services.py` is the one place that
answers "is this game frozen, and by whom?".

- Non-wild card: card -> `Claimed`, `claimed_team` set, and the team's
  `can_discard_card` is set to `True`.
- Wild card: requires a `target_card_id` query parameter naming the
  (not-yet-claimed, non-wild) card being claimed with it. Both the wild
  card and the target card are set to `Claimed`. `can_discard_card` is
  **not** granted for wild-card claims, per spec. A wild card can target
  any not-yet-claimed regular card, even one not currently visible to the
  team - that's the point of a wild card.

Either way, 1 new random `InDeck` card is drawn onto the public board,
and that new card is returned in the response.

Example: `PUT /ABC123/orange/claim/42?target_card_id=7`

### `PUT /{game_id}/{team_color}/discard/{card_id}`

Requires `card_id` to be on the public board and the team's
`can_discard_card` to be `True` - only the team that is discarding can
complete it, so this is also what refuses a team trying to unfreeze the
game on someone else's behalf. Resets the card to `InDeck`, resets
`can_discard_card` to `False`, draws 1 new random `InDeck` card onto the
public board, and returns that new card.

## True randomness for card selection

Every "pick N random cards" operation (dealing private boards, filling
the public board, replenishing after a claim/discard) goes through
`draw_random_cards()` in `app/services.py`, which issues:

```python
select(Card).where(...).order_by(func.random()).limit(n)
```

`func.random()` compiles to SQL `RANDOM()`, which both SQLite and
PostgreSQL support natively - so the ordering (and therefore the
selection) is genuinely randomized by the database on every call, rather
than depending on row insertion order the way a plain `LIMIT n` would.
"Without replacement" is enforced by state transitions: each draw only
looks at cards still in `InDeck`, and a card's state is flushed to the
DB before the next draw runs, so it can't be picked twice.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # defaults to local SQLite
```

## Run

```bash
uvicorn app.main:app --reload
```

- App: http://127.0.0.1:8000
- Interactive API docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

Tables are created automatically on startup (`init_db()` in
`app/database.py`), for both SQLite and PostgreSQL.

## Switching to PostgreSQL

Set `DATABASE_URL` (in `.env` or the environment) to something like:

```
postgresql://user:password@localhost:5432/jetlag
```

No code changes needed - `app/database.py` picks it up automatically.

## Running with Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

Three services: `postgres`, `webserver`, and `caddy`, which
is the only one publishing ports (80 and 443) and terminates TLS in
front of the webserver.

Caddy's config is the `Caddyfile` at the repo root, mounted read-only
into the container. It's one site block, parameterised by two
environment variables:

| Variable            | Notes                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| `DOMAIN`            | Hostname Caddy answers on. Falls back to `localhost`.                        |
| `TLS_MODE`          | `internal`, or an email address for Let's Encrypt. Falls back to `internal`. |
| `POSTGRES_PASSWORD` | Postgres database password, change to a random value.                        |

Those fallbacks are set in `compose.yaml`, missing or empty `.env` entry
still brings up a working local stack. The `Caddyfile` reads both variables.

`TLS_MODE=internal` makes Caddy issue the certificate from its own
local CA instead of going through ACME, useful for local testing.
`localhost` (and any domain that doesn't resolve publicly) can't pass
an ACME challenge. Browsers will warn about the certificate unless you
install Caddy's root CA from the `caddy_data` volume
(`/data/caddy/pki/authorities/local/root.crt`), or just use
`curl -k` / `--insecure`.

For a real deployment set `DOMAIN` to a hostname pointing at the box
with ports 80 and 443 reachable, and `TLS_MODE` to your email address -
Caddy then obtains and renews Let's Encrypt certificates on its own.
Certificates live in the `caddy_data` volume, so don't delete it between
restarts or you'll re-issue (and can hit rate limits).

## Project structure (updated)

```
jetlag-api/
├── app/
│   ├── __init__.py
│   ├── models.py       # ORM data model: Card, Team, CardState, TeamColor
│   ├── database.py     # engine/session setup, driven by DATABASE_URL
│   ├── game_data.py    # static gemeente + wild card list used to seed a deck
│   ├── challenges.py   # generated: challenge text per card (see below)
│   ├── schemas.py       # request/response schemas that aren't 1:1 with a table
│   ├── services.py      # game logic: seeding, random draws, visibility, claim/discard
│   ├── routers/
│   │   ├── __init__.py
│   │   └── games.py     # the game endpoints
│   └── main.py          # FastAPI app entrypoint
├── scripts/
│   └── import_challenges.py  # challenges.csv -> app/challenges.py
├── requirements.txt
├── .env.example
└── README.md
```

## Importing challenges

`challenges.csv` - a Google Sheets export - is the source of truth for the
challenge title, description and link of every card. It is gitignored and
lives only on whoever's machine exported it: `app/challenges.py` is generated
from it and committed, so the app never needs the CSV at all, at runtime
or in a checkout.

After re-exporting the sheet into the repo root, regenerate the module:

```bash
python -m scripts.import_challenges            # --dry-run to only see the report
```

It prints how many cards have text or a link, which ones are still empty,
and which took their description from the column next to
`Challenge description` (someone typed one cell too far right - worth
fixing in the sheet). It refuses to write anything if a card name in the
sheet isn't in `GEMEENTES` or `WILD_CARDS`, if a card in the deck has no
row, or if the `Challenge title` or `Challenge links` column is missing,
so the deck and the sheet can't silently drift apart. Columns are matched
by their header text rather than position, so inserting a column in the
sheet is safe.

The `Challenge links` column is a card's optional reference URL, kept out
of the description so the frontend can render it as a link; a card with an
empty cell there seeds `challenge_link` as `NULL`. Cards whose challenge
hasn't been written yet seed with empty text, which the frontend renders as
a card with no description.

## Next steps

- Write the challenges that are still empty (see the importer's report) and
  re-run it.
- Add auth so one team can't act as another.
- Consider row-level locking (`SELECT ... FOR UPDATE`, PostgreSQL only)
  around the random-draw queries if you expect concurrent requests for
  the same game - the current code is safe for sequential/typical
  gameplay traffic but two simultaneous claims for the same game could
  theoretically race on SQLite.
