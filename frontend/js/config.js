/**
 * App configuration.
 *
 * Fill in API_BASE_URL before running this for real. GAME_ID and
 * MY_TEAM_COLOR are read from the URL for now (?game=ABC123&team=orange)
 * since there's no login flow yet - see README.md.
 */
const CONFIG = {
  // Point this at your running backend, including a trailing slash (see the jetlag-api project).
  API_BASE_URL: "",

  // Path to the KML file with gemeente boundary polygons. Replace
  // data/gemeentes.sample.kml with your real My Maps export (same
  // filename, or update this path).
  KML_PATH: "data/CBS_2025_filtered_gemeenten.kml",

  // Directory (trailing slash) holding one SVG outline per gemeente plus
  // the index.json that maps gemeente name to filename. Both are generated
  // from the KML above by scripts/export_gemeente_svgs.py - see the README.
  GEMEENTE_SHAPES_PATH: "img/gemeentes/",

  // The star a wild card wears in place of an outline. Wild cards aren't a
  // place, so there's nothing in the KML to generate one from - this is a
  // hand-drawn file rather than a generated one.
  WILDCARD_SHAPE_PATH: "img/wildcard.svg",

  // Whether to render an actual basemap (OpenStreetMap tiles) behind the
  // gemeente polygons, or just a flat background color. Turning this off
  // avoids any tile requests entirely - useful if you'd rather keep the
  // focus on the polygons, or want to swap in your own basemap later.
  SHOW_BASEMAP: true,

  // Initial opacity for the basemap tiles when SHOW_BASEMAP is on.
  BASEMAP_OPACITY: 0.4,

  // MapLibre uses [lng, lat] order (opposite of some other map APIs).
  // Roughly centers on the eastern Netherlands; adjust to taste.
  MAP_CENTER: [6.15, 52.25],
  MAP_ZOOM: 9,

  // Where MapLibre fetches its text glyphs from. Rendering *any* text on
  // the map needs these - without a glyphs URL the gemeente name labels
  // can't be drawn at all, so setting this to "" turns the labels off.
  // The fonts ship with the app (data/fonts, see the README in there),
  // so labels work offline and don't depend on a font server staying up.
  GLYPHS_URL: "data/fonts/{fontstack}/{range}.pbf",

  // Gemeente name labels, drawn on top of everything else. MapLibre
  // hides any label that would collide with one already placed, so the
  // smaller gemeentes lose their name until you zoom in far enough for
  // it to fit - that's why the size grows with zoom.
  MAP_LABELS: {
    font: ["Noto Sans Regular"], // must exist on the GLYPHS_URL server
    color: "#22211C",
    haloColor: "#FBFAF4", // halo, not a fill, so team colors stay readable underneath
    haloWidth: 1.2,
    minZoom: 8, // below this the map is mostly a shape overview; names just clutter
    minSize: 11,
    maxSize: 16,
  },

  TEAM_COLORS: {
    orange: "#E2762A",
    purple: "#552b7f",
    pink: "#FF46A2",
    green: "#008000",
    yellow: "#FFED29",
  },

  MAP_FILL: {
    background: "#EEEEEE", // if no BASEMAP is configured
    hidden: "#FFFFFF", // not on the public or private board (to us)
    hiddenOpacity: 0.5,
    public: "#93c4d4",
    publicOpacity: 0.5,
    privateOpacity: 0.5,
    claimedOpacity: 0.8,
    strokeColor: "#615f57",
    strokeWidth: 1.5,
    claimedStrokeWidth: 1.5,

    // Diagonal stripes over every gemeente an in-play wild card can be
    // used on - the same idiom a wild card wears in the deck (see
    // .playing-card--wild in css/styles.css). Drawn into a repeating tile
    // at runtime, since WebGL fills can't take a CSS gradient, so the
    // color lives in the image and not in a paint property.
    //
    // These are screen pixels, not metres: the tile repeats in screen
    // space, so stripes keep their width at every zoom.
    wildcardStripeColor: "#50a0b9",
    wildcardStripeOpacity: 0.7,
    wildcardStripeWidth: 3, // thickness of one stripe
    wildcardStripeSize: 10, // tile size, so the gap is size - width

    // Hovering a gemeente (tapping it, on touch) outlines it and
    // highlights everything it borders (see MapView._setHighlighted).
    // Drawn on top of the regular fills, so these have to read against
    // both the pale unclaimed colors and the saturated team ones.
    hoverColor: "#22211C", // same ink as its outline, so the two read as one shape
    hoverOpacity: 0.8,
    hoverStrokeColor: "#22211C",
    hoverStrokeWidth: 1.5,
    neighbourColor: "#22211C",
    neighbourOpacity: 0.28,
    neighbourStrokeWidth: 1.5,
  },
};

function getGameId() {
  return new URLSearchParams(window.location.search).get("game");
}

function getMyTeamColor() {
  return new URLSearchParams(window.location.search).get("team");
}

// ---------------------------------------------------------------------
// Remembered pick
// ---------------------------------------------------------------------
// The last game + team the user picked, so returning players don't have
// to hunt for their game again. Only ever used to pre-select the join
// form, never to skip it - switching teams mid-game has to stay
// possible. Shared because the create page writes the entry too: after
// creating a game it sends you to the join page, which should already
// have that game selected.
const LAST_JOIN_KEY = "gemeentegathering:last-join";

/** Storage throws in Safari private mode, so both helpers are best-effort. */
function readRemembered() {
  try {
    return JSON.parse(window.localStorage.getItem(LAST_JOIN_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function writeRemembered(gameId, teamColor) {
  try {
    window.localStorage.setItem(
      LAST_JOIN_KEY,
      JSON.stringify({ game: gameId, team: teamColor }),
    );
  } catch (_) {
    // Not being able to remember the pick isn't worth interrupting the join.
  }
}
