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
| challenge_link        | str, optional         | shown as a link under the description             |
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
│   ├── import_challenges.py     # challenges.csv -> app/challenges.py
│   └── export_gemeente_svgs.py  # the CBS KML -> frontend/img/gemeentes/
├── requirements.txt
├── .env.example
└── README.md
```

## Importing challenges

`challenges.csv` - a Google Sheets export - is the source of truth for the
challenge title and description of every card. It is gitignored and lives
only on whoever's machine exported it: `app/challenges.py` is generated
from it and committed, so the app never needs the CSV at all, at runtime
or in a checkout.

After re-exporting the sheet into the repo root, regenerate the module:

```bash
python -m scripts.import_challenges            # --dry-run to only see the report
```

It prints how many cards have text, which ones are still empty, and which
took their description from the column next to `Challenge description`
(someone typed one cell too far right - worth fixing in the sheet). It
refuses to write anything if a card name in the sheet isn't in `GEMEENTES`
or `WILD_CARDS`, or if a card in the deck has no row, so the deck and the
sheet can't silently drift apart. Columns are matched by their header text
rather than position, so inserting a column in the sheet is safe.

Cards whose challenge hasn't been written yet seed with empty text, which
the frontend renders as a card with no description.

## Gemeente shapes

`frontend/data/CBS_2025_filtered_gemeenten.kml` is the source of truth for
where the gemeentes are. It is also 6 MB of survey-grade lon/lat rings, which
is the right thing for working out which gemeentes border each other
(`app/game_data.py` does that at startup) and much too much to hand a browser
just to draw an outline on a card.

`scripts/export_gemeente_svgs.py` renders it down to one small SVG per
gemeente:

```bash
python -m scripts.export_gemeente_svgs        # --dry-run to only see the report
```

That writes `frontend/img/gemeentes/<slug>.svg` - 60 files, ~160 KiB in total -
plus an `index.json` listing every gemeente with its filename, viewBox size and
the lon/lat box it came from. The SVGs are generated but committed, so a
checkout and a deploy never have to run the script.

Each shape is projected to metres, simplified, and fitted to its own viewBox,
so a gemeente fills whatever box CSS gives it no matter how big it really is.
Everything is one `<path>` with `fill-rule="evenodd"`, which covers the
gemeentes made of several disjoint polygons (Kampen has 17, most of them
islets in the IJsselmeer) and the two with a hole in them.

The deck in the sidebar draws them: `js/gemeente-shapes.js` reads the index
once at startup and hands `renderCardsPanel()` a URL per card, and the
outline fills the card above its name. It's painted as a CSS `mask-image`
rather than an `<img>` so the silhouette takes a colour from the stylesheet -
the SVGs fill with `currentColor`, which an `<img>` has nothing to resolve
against. Note that a relative `url()` inside a custom property resolves
against the *stylesheet*, not the page, so `GemeenteShapes` hands out
absolute URLs.

A wild card isn't a place, so it wears a star (`img/wildcard.svg`) in the
same slot. That one is hand-drawn rather than generated - there's nothing in
the KML to derive it from - and `renderCardsPanel()` points at it through
`CONFIG.WILDCARD_SHAPE_PATH`, the same way it points at an outline.

Shapes are decoration - the card still names its gemeente - so if the index
fails to load the deck falls back to name-only cards and logs a warning
rather than taking the board down.

`--tolerance` is how far a simplified outline may stray from the real one, in
metres, and defaults to 20 - about a fifth of a pixel at the size a card draws
a gemeente. That drops 94% of the points and moves the largest shape by 0.2%
of its area, which is why the report prints how many points survived. Pass
`--tolerance 0` to keep every point (2.4 MiB), or a larger number for
something blockier.

The script refuses to write anything if the KML and `GEMEENTES` in
`app/game_data.py` disagree about which gemeentes exist, so the cards and the
shapes can't silently drift apart.

## Next steps

- Write the challenges that are still empty (see the importer's report) and
  re-run it.
- Add auth so one team can't act as another.
- Consider row-level locking (`SELECT ... FOR UPDATE`, PostgreSQL only)
  around the random-draw queries if you expect concurrent requests for
  the same game - the current code is safe for sequential/typical
  gameplay traffic but two simultaneous claims for the same game could
  theoretically race on SQLite.
