# Gemeentejacht - Jetlag game frontend

Mobile-first web frontend for the jetlag-api backend: a MapLibre map of
gemeente boundaries, a cards panel, a score bar, and the claim/discard
flows.

## Stack

Plain HTML/CSS/JS - no build step, no framework, no bundler. Open
`index.html` (via a local static server - see below) and it runs.

- **[MapLibre GL JS](https://maplibre.org/)** for the map - open source,
  no API key required. Gemeente polygons are parsed from your KML file
  client-side and added as a GeoJSON source, so every polygon can be
  recolored instantly from game state.
- Everything else is vanilla JS, split into small single-purpose files
  under `js/` (see "Architecture" below).

## Setup

1. Have the [jetlag-api](../jetlag-api) backend running somewhere reachable
   (defaults to `http://localhost:8000`).
2. Replace `data/gemeentes.sample.kml` with your real My Maps KML export
   (same filename, or update `CONFIG.KML_PATH` in `js/config.js`). It
   must use `<ExtendedData><SchemaData><SimpleData name="gemeentenaam">`
   for each placemark's name - that's what the parser looks for.
3. Edit `js/config.js`: at minimum, check `API_BASE_URL`.
4. Serve the folder over HTTP (KML/JS fetches need a real origin, not
   `file://`):
   ```bash
   python3 -m http.server 8000
   ```
5. Open `http://localhost:8000/?game=<GAME_ID>&team=<TEAM_COLOR>` - e.g.
   `?game=ABC123&team=orange`. There's no login flow yet, so the game id
   and your team color are just URL parameters for now.

## Architecture

```
jetlag-frontend/
├── index.html
├── css/styles.css
├── data/
│   ├── gemeentes.sample.kml    # replace with your real export
│   └── fonts/                  # glyphs for the map labels (see its README)
└── js/
    ├── config.js       # all tunables: API URL, colors, basemap toggle, gemeente list
    ├── api.js          # fetch wrappers for the 4 backend endpoints
    ├── kml-parser.js   # KML -> GeoJSON, using the browser's DOMParser
    ├── state.js        # single source of truth + derived views (panel cards, scores, ...)
    ├── map-view.js      # MapLibre map, GeoJSON source, per-feature styling
    ├── ui.js            # cards panel, score bar, claim/discard modal, toasts
    └── main.js          # bootstraps everything, owns the refresh cycle
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

**Hover highlighting**: hovering a gemeente fills and outlines it, and
tints every gemeente it borders, so you can see at a glance what a claim
would connect to. This is the one thing that deliberately sits outside
the redraw-everything flow above: it only swaps the `filter` on four
dedicated highlight layers (`MapView._setHovered()`) rather than
re-uploading the whole polygon source on every mouse move. Borders come
from the same `GET /pairs` graph scoring uses, so before that request
lands only the hovered gemeente's own outline shows. It's wired up only
on devices with a real pointer - touch browsers fire a mousemove on tap
but never a matching mouseleave, which would leave the highlight stuck on
the last gemeente tapped, and a tap already opens its card.

**Refreshing**: per your instructions, there's no polling and no
websockets - only the refresh button (spinner icon, top right), plus an
automatic refresh right after your own claim/discard so you immediately
see its effect. To see *other* teams' moves, someone has to tap refresh.

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
  offer *every* unclaimed gemeente as a target, including ones this team
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
