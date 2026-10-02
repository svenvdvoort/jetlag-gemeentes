# JetLag: Gemeente Gathering

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
   least one game to exist. If the list is empty, follow the create link
   at the bottom of the page.

## Pages

- **`index.html`** - the join page at `/`. Lists games from `GET /games`
  and the chosen game's teams from `GET /{game_id}/teams`, takes your
  team's code, and `POST`s it to `/{game_id}/{team_color}/login` before
  sending you to the board - so a wrong code is reported here, next to
  the field that fixes it, rather than on a board that can't load. It
  pre-fills your last game and team from `localStorage` but never the
  code, and never skips itself, so switching teams stays possible. Links
  that still point at `/?game=…&team=…` are redirected to the board.

  If you're already signed in, a **Continue as …** button appears above the
  form and goes straight to the board. The cookie is `HttpOnly`, so the
  page can't read it to find that out: it asks
  `GET /{game_id}/{team_color}/session` about the remembered game and
  team, and only shows the button on a `200`. That request isn't awaited
  before the pickers render, and a `401` is passed over in silence -
  the form is already what you'd do instead.
- **`create.html`** - the create page. A game code plus one row per team
  (colour + name, two to five of them), posted to
  `POST /{game_id}/create`. The button stays disabled until the form
  would actually be accepted, so the only errors that surface are the
  server's - chiefly a code that's already taken. On success the form is
  replaced by the per-team join codes the backend generated. That's the
  only time they're shown - they're generated server-side and no endpoint
  hands them back - so the page stops here instead of navigating on. It
  does still write the new game into the same `localStorage` entry the
  join page reads, so the game is already selected when you go there.
- **`board.html`** - the map board, opened as
  `board.html?game=<GAME_ID>&team=<TEAM_COLOR>`. Without both parameters
  it redirects back to the join page, and so does a `401` from any
  refresh: the URL says which team to draw, but the cookie set at login
  is what decides which team you may draw, so hand-editing `?team=` to
  peek at another board lands you back at the join page. Opened before
  the game starts it shows a countdown instead of the board - see "Kickoff" below.

## Architecture

```
jetlag-frontend/
├── index.html                  # join page: pick a game + team
├── create.html                 # create page: new game + its teams
├── board.html                  # the map board
├── css/styles.css
├── data/
│   ├── gemeentes.sample.kml    # replace with your real export
│   └── fonts/                  # glyphs for the map labels (see its README)
├── img/gemeentes/              # generated: one SVG outline per gemeente + index.json
└── js/
    ├── config.js       # all tunables: API URL, colors, basemap toggle, gemeente list
    ├── api.js          # fetch wrappers for the backend endpoints (incl. login)
    ├── join.js         # join page: game/team pickers (loads only config.js + api.js)
    ├── create.js       # create page: game code + team rows (loads only config.js + api.js)
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
see its effect. The two countdowns below are the only things that ask on
their own, and each only when its own clock runs out: the kickoff screen on
load and again at zero, a face-down card the moment it's due to open.
To see _other_ teams' moves, someone has to tap refresh.

**Kickoff**: the board isn't built before the game starts. `main.js` asks
`GET /{game_id}/status` first and, for a game that hasn't started, puts
the countdown screen up (`#pregame` in `board.html`) in the app's place -
in its place rather than over it because a MapLibre map initialised inside
a hidden container comes up sized 0x0 and stays that way, so `MapView` is
only ever handed a visible one. The KML, the border graph and the gemeente
shapes all load behind the countdown, so the board draws the moment it
runs out.

The server is what decides whether the game is on - it returns every card
as still in the deck until then, and refuses claims - which makes the
countdown a scheduler rather than a gate: it decides when to ask again,
and the answer always comes from `/status`.

Both countdowns on the board tick off the server's clock rather than this
device's: `Api.getStatus()` records how far apart the two are and
`serverNow()` in `js/api.js` hands out the result. A phone running a minute
fast therefore can't open an empty board - or a card the server is still
sitting on - a minute early.

**Face-down cards**: the private cards that open later in the day arrive
stripped of everything that identifies them - no name, no challenge text,
not even a card id (see the cards endpoint in the root README). That is
what `isFaceDown()` in `js/state.js` recognises: a private card with no
name _is_ a face-down one, so there's no flag to keep in sync. They're
drawn blacked out - a question mark where the other cards carry their
gemeente's outline, and a countdown to the moment they open - sorted to
the end of the deck since they can't be played, and they're the one card
in the panel that isn't a button: there is nothing behind them to open.
They also stay out of the wild-card target dropdown, which would otherwise
carry a nameless option that names nothing.

One interval ticks all of them (`faceDownClock` in `js/ui.js`), and only
while the panel is holding one. The panel is rebuilt from scratch on every
refresh, so each card carries the instant it opens on itself as
`data-opens-at` rather than the clock keeping hold of cards or of State.
When a countdown runs out, the card is already open server-side and only
this board hasn't heard, so the tick fetches the board - which is the card
turning itself face up. Counting on the server's clock is what keeps that
to a single request; `FACE_DOWN_OPEN_RETRY_MS` is the floor under it for
the case where the server disagrees anyway.

That instant is read off a naive UTC timestamp, unlike the ones
`GET /{game_id}/status` sends, so `parseApiUtc()` in `js/ui.js` says the
zone out loud first - `new Date("...T10:00:00")` is read as _local_ time,
which would have an Amsterdam summer card opening two hours early.

**The draw reveal**: a claim or a discard ends on whatever replaced the
card that left, dealt onto the sheet as a card rather than named in a
list - outline above, name below, the way the deck draws one. The outline
is a live `<svg>` here instead of the deck's `mask-image`, which is what
lets it trace itself; the `Drawn cards` block in `css/styles.css` owns the
timeline, and `traceOutline()` in `js/ui.js` supplies the two things only
JS can measure. It degrades the way the deck does: an outline that never
arrives leaves a card wearing its name.

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
