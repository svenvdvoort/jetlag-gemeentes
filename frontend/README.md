# Gemeentejacht - Jetlag game frontend

Mobile-first web frontend for the jetlag-api backend: a MapLibre map of
gemeente boundaries, a cards panel, a score bar, and the claim/discard
flows.

## Stack

Plain HTML/CSS/JS - no build step, no framework, no bundler. Every file
is a classic `<script src>` defining globals (`CONFIG`, `Api`, `State`,
`UI`, ...); there are no ES modules. Start the backend and it runs - see
Setup below.

- **[MapLibre GL JS](https://maplibre.org/)** for the map - open source,
  no API key required. Gemeente polygons are parsed from your KML file
  client-side and added as a GeoJSON source, so every polygon can be
  recolored instantly from game state.
- Everything else is vanilla JS, split into small single-purpose files
  under `js/` (see "Architecture" below).

## Setup

The backend serves this folder itself (`app.frontend("/", directory="frontend")`
in `app/main.py`), so there's no separate static server and no CORS to
configure - `CONFIG.API_BASE_URL` is deliberately empty, making every
request same-origin.

1. Replace `data/gemeentes.sample.kml` with your real My Maps KML export
   (same filename, or update `CONFIG.KML_PATH` in `js/config.js`). It
   must use `<ExtendedData><SchemaData><SimpleData name="gemeentenaam">`
   for each placemark's name - that's what the parser looks for.
2. Run the backend from the repo root (the `frontend` path is relative to
   the working directory):
   ```bash
   uvicorn app.main:app --reload
   ```
3. Open `http://localhost:8000/` and pick a game and a team. You need at
   least one game to exist - create one with
   `POST /{game_id}/create` if the list is empty.

## Pages

- **`index.html`** - the join page at `/`. Lists games from `GET /games`
  and the chosen game's teams from `GET /{game_id}/teams`, then sends you
  to the board. It pre-fills your last pick from `localStorage` but never
  skips itself, so switching teams stays possible. Links that still point
  at `/?game=…&team=…` are redirected to the board.
- **`board.html`** - the map board, opened as
  `board.html?game=<GAME_ID>&team=<TEAM_COLOR>`. Without both parameters
  it redirects back to the join page. There's no login flow, so the game
  id and team color are still just URL parameters.

## Architecture

```
jetlag-frontend/
├── index.html                  # join page: pick a game + team
├── board.html                  # the map board
├── css/styles.css
├── data/
│   ├── gemeentes.sample.kml    # replace with your real export
│   └── fonts/                  # glyphs for the map labels (see its README)
├── img/gemeentes/              # generated: one SVG outline per gemeente + index.json
└── js/
    ├── config.js       # all tunables: API URL, colors, basemap toggle, gemeente list
    ├── api.js          # fetch wrappers for the backend endpoints
    ├── join.js         # join page: game/team pickers (loads only config.js + api.js)
    ├── kml-parser.js   # KML -> GeoJSON, using the browser's DOMParser
    ├── gemeente-shapes.js  # gemeente name -> its SVG outline, from img/gemeentes/index.json
    ├── state.js        # single source of truth + derived views (panel cards, scores, ...)
    ├── map-view.js      # MapLibre map, GeoJSON source, per-feature styling
    ├── ui.js            # cards panel, score bar, claim/discard modal, toasts
    └── main.js          # bootstraps the board, owns the refresh cycle
```

**State flow**: every API response is written into `State`. After any
change - initial load, manual refresh, or the result of a claim/discard

- `MapView.applyStyles()` and `UI.render()` redraw the map, cards panel,
  and score bar entirely from `State`. Nothing is patched incrementally, so
  the UI can't drift out of sync with itself. At this game's scale
  (~60 cards, a handful of teams) a full redraw is cheap.

**Name labels**: every gemeente is labelled at the center of its largest
part, from a separate point source built once at load
(`buildLabelPoints()` in `js/map-view.js`). Labelling the polygon layer
directly would have been less code, but MapLibre labels every part of a
multipolygon, so the seven gemeentes with an exclave or an island would
each get their name twice. "Center" is the area centroid, with a
fallback for the case where that lands outside the gemeente's own
borders - a crescent shape, or one wrapped around an enclave the way
Rheden wraps around Rozendaal. All 60 currently land inside the gemeente
they name. MapLibre drops any label that would collide with one already
placed, so small gemeentes stay unnamed until you zoom in; below
`MAP_LABELS.minZoom` they're all hidden.

Text needs glyphs, which is what `CONFIG.GLYPHS_URL` points at. They're
served from `data/fonts/` rather than a font server, so labels work
offline and don't break if someone else's hosting goes away - see
`data/fonts/README.md`. Setting `GLYPHS_URL` to `""` turns labels off
entirely and stops the map requesting any glyphs at all.

**Neighbour highlighting**: picking a gemeente fills and outlines it, and
tints every gemeente it borders, so you can see at a glance what a claim
would connect to. This is the one thing that deliberately sits outside
the redraw-everything flow above: it only swaps the `filter` on four
dedicated highlight layers (`MapView._setHighlighted()`) rather than
re-uploading the whole polygon source on every mouse move. Borders come
from the same `GET /pairs` graph scoring uses, so before that request
lands only the picked gemeente's own outline shows.

What counts as picking it depends on what you're pointing with, and a
device can offer more than one - a Galaxy with an S Pen hovers with the
pen and taps with a finger, so all of these are wired up at once rather
than either/or:

- **A mouse** drives it from `mousemove`, cleared on `mouseleave`.
- **A stylus** drives it from `pointermove` with `pointerType === "pen"`,
  cleared on `pointerout` when the pen leaves hover range. Handled
  separately from the mouse because a browser won't necessarily
  synthesise mouse events for a pen that's hovering rather than touching.
- **A finger** can't hover, so the two things get a gesture each: a tap
  opens a gemeente's card, and holding still on one for `LONG_PRESS_MS`
  highlights it instead (without opening the card - the press swallows
  the click its release turns into). A tap that lands on no gemeente
  clears the highlight. Drifting more than `LONG_PRESS_MOVE_TOLERANCE`
  means you're panning, and a second finger means you're pinching; either
  one calls the press off.

Note what is _not_ here: a media query deciding whether to listen for
hover at all. `(hover: hover)` only describes the _primary_ input, so it
reads "none" on a stylus phone; `(any-hover: hover)` is no better, since
Chrome on Android reports "none" for a stowed S Pen - it can't know the
pen hovers until it does. Nothing here asks CSS what the hardware is any
more. The handlers are keyed off `pointerType` on the events themselves,
which is the device telling us what it actually is rather than us
guessing in advance.

The one piece of bookkeeping that needs is `_lastPointerType`: a finger
tap fires a _synthetic_ mousemove, which the ungated mouse handlers would
otherwise treat as a hover and highlight on every tap. Recording the last
real pointer event lets them bail on touch. It's recorded on `pointerdown`
as well as `pointermove`, because a tap never sends a pointermove at all.

**Refreshing**: per your instructions, there's no polling and no
websockets - only the refresh button (spinner icon, top right), plus an
automatic refresh right after your own claim/discard so you immediately
see its effect. To see _other_ teams' moves, someone has to tap refresh.

**The freeze**: a mandatory discard stops the whole game, not just the
team that is discarding - nobody may claim until that card is gone - so every
board is frozen behind the same full-screen wall. Frozen, not
gone: the deck stays where it is and its cards still open, since reading
them is how a team picks what to throw away and how everyone else follows
what's on the table. They just don't offer a claim, the panel's handle
says `frozen`, and its edge turns red to match the bar below it. The
team that is discarding gets the picker - which carries a reminder to
clear the pick with the other teams first, a discard being the one move the
table gets a veto on; everyone else gets a waiting screen naming them,
with a **Check again** button, and either screen can
be stepped aside from to read the map (see `freezePeek` in `js/ui.js`).
With no polling, a waiting board only thaws on the refresh that first
sees the discard land - but the rule itself is the server's, so a claim
sent from a board that hasn't refreshed yet comes back refused, and that
refusal puts the waiting screen up rather than an error message.

## The basemap toggle

`CONFIG.SHOW_BASEMAP` (in `js/config.js`):

- `true` (default): renders plain OpenStreetMap raster tiles behind the
  polygons. Free, no API key - but it is a shared public service, so
  it's meant for light/occasional use (a friend group's game night), not
  heavy production traffic. If you outgrow it, swap `buildBaseStyle()`
  in `js/map-view.js` for a vector style from a provider that does need
  a key (MapTiler, Stadia, etc.) - everything else (the GeoJSON source,
  the fill/line layers, the click handling) stays the same.
- `false`: no basemap at all, not even a tile request - just a flat
  background color behind the polygons.

## Known limitations / things worth revisiting

- **The `GEMEENTES` list in `js/config.js` duplicates
  `app/game_data.py`** in the backend. The wild-card claim flow needs to
  offer _every_ unclaimed gemeente as a target, including ones this team
  has never seen a `Card` object for (still `InDeck`, or on another
  team's unrevealed private board) - so it can't rely on data the API
  has actually sent. Instead it recomputes the same `card_id` the
  backend would have assigned (`index + 1` in that list) and trusts that
  the two lists stay in sync. If they ever drift, wild-card claims will
  target the wrong card. The clean fix is a small backend endpoint that
  returns "all card names + ids" directly; worth adding once this proves
  out.
- **No team roster caching**: `GET /{game_id}/teams` is re-fetched on
  every refresh alongside cards. Teams rarely change mid-game, so this
  is deliberate simplicity over a micro-optimization, not an oversight.
- **Scoring** counts connected areas, not raw claims (`State.scores()` in
  `js/state.js`). A team's score is its largest group of claimed
  gemeentes that border each other, so a team holding two separate
  groups only scores the bigger one. The score bar shows that number
  with the total claimed in brackets after it - `8 (14)` - and the map
  highlights every team's counting group. When several groups tie for
  largest, one of them is picked at random - outlining all of them would
  suggest more gemeentes are scoring than the score says. The pick is
  re-rolled on each render, so a tie can land on a different group from
  one refresh to the next.
  The adjacency graph comes from `GET /pairs`, fetched once at startup
  in `initApp()` rather than on every refresh, since gemeente borders
  are static. If that request fails the score falls back to the plain
  claimed count, nothing is outlined, and a `console.warn` is logged -
  scoring degrades, but the board stays playable.
- **No auth**: `game` and `team` are plain URL query parameters. Anyone
  with the URL can act as that team. Fine for a friend group who trust
  each other; not fine beyond that.
