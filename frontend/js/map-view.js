/**
 * Owns the MapLibre GL map instance and the single GeoJSON source
 * holding every gemeente polygon. `applyStyles()` mutates each
 * feature's paint-relevant properties (fillColor, fillOpacity, ...)
 * from the current State and re-sets the source data - called once
 * after every state refresh, never incrementally, so the map can never
 * end up showing a stale color for one gemeente.
 *
 * Highlighting one gemeente and its neighbours is deliberately *not*
 * part of that pass: it swaps the filters on four dedicated layers
 * instead, so moving the mouse never re-uploads the (fairly large)
 * polygon source.
 */
const MapView = {
  map: null,
  geojson: null,
  loaded: false,
  onGemeenteClick: null,
  highlightedName: null,
  baseMapOpacity: CONFIG.BASEMAP_OPACITY,
  _basemapOpacityControl: null,
  _pendingStyleUpdate: false,
  _stripedNames: [],
  _lastPointerType: null,
  _touchStart: null,
  _longPressTimer: null,
  _longPressFired: false,

  /**
   * @param {HTMLElement} mapDiv
   * @param {GeoJSON.FeatureCollection} geojson gemeente polygons, from KmlParser.parse()
   * @param {(name: string) => void} onGemeenteClick
   */
  init(mapDiv, geojson, onGemeenteClick) {
    this.geojson = geojson;
    this.onGemeenteClick = onGemeenteClick;
    this.baseMapOpacity = CONFIG.BASEMAP_OPACITY;  // load default basemap_opacity from config

    this.map = new maplibregl.Map({
      container: mapDiv,
      style: buildBaseStyle(this.baseMapOpacity),
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      attributionControl: CONFIG.SHOW_BASEMAP, // only needed when we're actually using OSM tiles
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    this.map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
      }),
      "top-right",
    );

    if (CONFIG.SHOW_BASEMAP) {
      this._basemapOpacityControl = createBasemapOpacityControl(
        (opacity) => this.setBaseMapOpacity(opacity),
      );
      this.map.addControl(this._basemapOpacityControl, "top-right");
    }

    this.map.on("load", () => {
      const fill = CONFIG.MAP_FILL;

      this.map.addSource("gemeentes", { type: "geojson", data: this.geojson });

      this.map.addLayer({
        id: "gemeentes-fill",
        type: "fill",
        source: "gemeentes",
        paint: {
          "fill-color": ["get", "fillColor"],
          "fill-opacity": ["get", "fillOpacity"],
        },
      });

      // Stripes over every gemeente an in-play wild card can be used on,
      // over the state colors so a striped gemeente still shows whether
      // it's on the board, and under the hover tints and every outline so
      // it never competes with those. Filtered to nothing until
      // applyStyles() says which gemeentes those are.
      //
      // A separate layer rather than a property on gemeentes-fill because
      // fill-pattern ignores fill-color: one layer can draw the state
      // color or the stripes, not both.
      // Skipped rather than fatal if the stripe tile can't be drawn: the
      // stripes are a way of reading the board, and everything below here
      // - the click handlers, the labels, the opening fitBounds - is the
      // board itself.
      const stripes = buildStripePattern();
      if (stripes) {
        this.map.addImage(WILDCARD_PATTERN_ID, stripes.image, {
          pixelRatio: stripes.pixelRatio,
        });
        this.map.addLayer({
          id: "gemeentes-wildcard-fill",
          type: "fill",
          source: "gemeentes",
          filter: matchNames([]),
          paint: {
            "fill-pattern": WILDCARD_PATTERN_ID,
            "fill-opacity": fill.wildcardStripeOpacity,
          },
        });
      }

      // Tint over the gemeentes bordering the hovered one, under the
      // outlines so it never washes them out. Filtered to nothing until
      // something is actually hovered.
      this.map.addLayer({
        id: "gemeentes-neighbour-fill",
        type: "fill",
        source: "gemeentes",
        filter: matchNames([]),
        paint: {
          "fill-color": fill.neighbourColor,
          "fill-opacity": fill.neighbourOpacity,
        },
      });

      // The hovered gemeente itself, over the neighbour tint so it stays
      // the one that reads as picked out even where the two meet.
      this.map.addLayer({
        id: "gemeentes-hover-fill",
        type: "fill",
        source: "gemeentes",
        filter: matchNames([]),
        paint: {
          "fill-color": fill.hoverColor,
          "fill-opacity": fill.hoverOpacity,
        },
      });

      this.map.addLayer({
        id: "gemeentes-outline",
        type: "line",
        source: "gemeentes",
        paint: {
          "line-color": ["get", "strokeColor"],
          "line-opacity": ["get", "strokeOpacity"],
          "line-width": ["get", "strokeWidth"],
        },
      });

      this.map.addLayer({
        id: "gemeentes-neighbour-outline",
        type: "line",
        source: "gemeentes",
        filter: matchNames([]),
        paint: {
          "line-color": fill.neighbourColor,
          "line-width": fill.neighbourStrokeWidth,
        },
      });

      // Last, so the hovered gemeente's own outline wins wherever it
      // shares a border with one of its neighbours - which is everywhere.
      this.map.addLayer({
        id: "gemeentes-hover-outline",
        type: "line",
        source: "gemeentes",
        filter: matchNames([]),
        paint: {
          "line-color": fill.hoverStrokeColor,
          "line-width": fill.hoverStrokeWidth,
        },
      });

      // Names last, so nothing is drawn over them. Their own point
      // source rather than a symbol layer on the polygons: MapLibre
      // labels every part of a multipolygon, so a gemeente with an
      // exclave or an island would get its name repeated on each.
      if (CONFIG.GLYPHS_URL) {
        const labels = CONFIG.MAP_LABELS;

        this.map.addSource("gemeente-labels", {
          type: "geojson",
          data: buildLabelPoints(this.geojson),
        });

        this.map.addLayer({
          id: "gemeentes-label",
          type: "symbol",
          source: "gemeente-labels",
          minzoom: labels.minZoom,
          layout: {
            "text-field": ["get", "name"],
            "text-font": labels.font,
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              labels.minZoom,
              labels.minSize,
              labels.minZoom + 4,
              labels.maxSize,
            ],
            // Long names ("Oude IJsselstreek") wrap instead of covering
            // the gemeentes either side of the one they belong to.
            "text-max-width": 8,
            "text-padding": 3,
          },
          paint: {
            "text-color": labels.color,
            "text-halo-color": labels.haloColor,
            "text-halo-width": labels.haloWidth,
          },
        });
      }

      this.map.on("click", "gemeentes-fill", (e) => {
        // A long press has already highlighted this gemeente, and the
        // release turns into a click too - which shouldn't then open the
        // card over the highlight the press just asked for.
        if (this._longPressFired) return;
        if (e.features && e.features[0]) {
          this.onGemeenteClick(e.features[0].properties.name);
        }
      });

      // Ungated: asking CSS whether this device can hover doesn't work.
      // `(hover: hover)` only describes the *primary* input, so it says
      // "none" on a stylus phone, and `(any-hover: hover)` isn't reliable
      // either - Chrome on Android reports "none" for a stowed S Pen,
      // since it can't know the pen hovers until it does. So we just
      // listen, and let whatever the device actually sends decide.
      //
      // mousemove rather than mouseenter: the pointer can cross from one
      // gemeente straight into the next without ever leaving the layer.
      //
      // A finger tap also fires a synthetic mousemove, which would
      // highlight on every tap - so these bail on touch, whose highlight
      // is the long press's job below.
      this.map.on("mousemove", "gemeentes-fill", (e) => {
        if (this._lastPointerType === "touch") return;
        this.map.getCanvas().style.cursor = "pointer";
        this._setHighlighted(
          e.features && e.features[0] ? e.features[0].properties.name : null,
        );
      });
      this.map.on("mouseleave", "gemeentes-fill", () => {
        if (this._lastPointerType === "touch") return;
        this.map.getCanvas().style.cursor = "";
        this._setHighlighted(null);
      });

      // The stylus, straight off the pointer events rather than hoping
      // the browser also synthesises the mouse ones above for a pen that
      // is hovering rather than touching. Restricted to pens so a finger
      // drag doesn't drag the highlight around with it while panning -
      // touch goes through the long-press handlers instead.
      const canvas = this.map.getCanvasContainer();
      canvas.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "pen") return;
        const rect = canvas.getBoundingClientRect();
        const hits = this.map.queryRenderedFeatures(
          [e.clientX - rect.left, e.clientY - rect.top],
          { layers: ["gemeentes-fill"] },
        );
        this._setHighlighted(hits.length ? hits[0].properties.name : null);
      });
      // Pen lifted out of hover range, or moved off the map entirely.
      canvas.addEventListener("pointerout", (e) => {
        if (e.pointerType === "pen") this._setHighlighted(null);
      });

      // Which input last did something. The mouse handlers above need it
      // to tell a real mouse from the synthetic events a finger tap
      // fires, and those arrive after the pointer ones - so recording it
      // on down as well as move matters: a tap never sends a pointermove,
      // and without the down it would still read as whatever came before.
      const notePointerType = (e) => {
        this._lastPointerType = e.pointerType;
      };
      canvas.addEventListener("pointerdown", notePointerType, true);
      canvas.addEventListener("pointermove", notePointerType, true);

      // The finger: a tap opens the card, holding still highlights
      // instead. Keyed off pointerType rather than a media query, so a
      // mouse or pen on the same device keeps its own behaviour.
      canvas.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") return;
        this._cancelLongPress();
        // A second finger landing means a pinch, so the press that was in
        // progress is off - and a pinch held still shouldn't start a new
        // one either, hence cancelling before this rather than after.
        if (!e.isPrimary) return;
        this._longPressFired = false;
        this._touchStart = { x: e.clientX, y: e.clientY };
        this._longPressTimer = setTimeout(() => this._onLongPress(), LONG_PRESS_MS);
      });

      // Drifting past the tolerance means this is a pan, not a press.
      canvas.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "touch" || !this._touchStart) return;
        const drift = Math.hypot(
          e.clientX - this._touchStart.x,
          e.clientY - this._touchStart.y,
        );
        if (drift > LONG_PRESS_MOVE_TOLERANCE) this._cancelLongPress();
      });

      // Lifting early makes it a tap. _longPressFired deliberately isn't
      // reset here - the click it turns into still has to see it, and the
      // next pointerdown clears it.
      for (const type of ["pointerup", "pointercancel"]) {
        canvas.addEventListener(type, (e) => {
          if (e.pointerType === "touch") this._cancelLongPress();
        });
      }

      // What takes the place of mouseleave for a finger: a tap that lands
      // on no gemeente at all clears the highlight. Queried rather than
      // relying on this firing before or after the layer handler above,
      // since both run for a tap that did hit one.
      this.map.on("click", (e) => {
        if (this._lastPointerType !== "touch" || this._longPressFired) return;
        const hits = this.map.queryRenderedFeatures(e.point, {
          layers: ["gemeentes-fill"],
        });
        if (hits.length === 0) this._setHighlighted(null);
      });

      const bounds = computeBounds(this.geojson);
      if (bounds) this.map.fitBounds(bounds, { padding: 24, duration: 0 });

      this.loaded = true;
      this._applyBaseMapOpacity();
      this._applyWildcardFilter();
      if (this._pendingStyleUpdate) {
        this._pendingStyleUpdate = false;
        this.applyStyles();
      }
    });
  },

  /**
   * The finger has been held still long enough: highlight whatever is
   * under where it went down, and flag the press so the click its release
   * turns into doesn't also open the card.
   *
   * Uses the *start* position rather than wherever the finger is now, so
   * the highlight matches the gemeente the press began on even if it
   * drifted a little within the tolerance.
   */
  _onLongPress() {
    this._longPressTimer = null;
    if (!this._touchStart) return;

    this._longPressFired = true;
    const rect = this.map.getCanvasContainer().getBoundingClientRect();
    const hits = this.map.queryRenderedFeatures(
      [this._touchStart.x - rect.left, this._touchStart.y - rect.top],
      { layers: ["gemeentes-fill"] },
    );
    this._setHighlighted(hits.length ? hits[0].properties.name : null);
  },

  /** Stop a press in progress from becoming a long press. */
  _cancelLongPress() {
    clearTimeout(this._longPressTimer);
    this._longPressTimer = null;
    this._touchStart = null;
  },

  /** Apply the current basemap opacity to the raster layer, if it exists. */
  _applyBaseMapOpacity() {
    if (!this.loaded) return;
    if (!this.map.getLayer(BASEMAP_LAYER_ID)) return;
    this.map.setPaintProperty(BASEMAP_LAYER_ID, "raster-opacity", this.baseMapOpacity);
  },

  /** Set the basemap opacity and keep the control state in sync. */
  setBaseMapOpacity(opacity) {
    this.baseMapOpacity = opacity;
    this._applyBaseMapOpacity();
  },

  /**
   * Fill and outline `name`, and highlight every gemeente it borders;
   * pass null to clear. Only the four highlight layers' filters change,
   * so this is cheap enough to run straight off mousemove.
   *
   * Borders come from State, which only has them once GET /pairs has
   * landed - before that (or if it failed) the picked gemeente still
   * gets its own highlight, just with nothing highlighted around it.
   */
  _setHighlighted(name) {
    if (!this.loaded || name === this.highlightedName) return;
    this.highlightedName = name;

    const hovered = matchNames(name ? [name] : []);
    const neighbours = name ? [...State.neighboursOf(name)] : [];
    this.map.setFilter("gemeentes-hover-fill", hovered);
    this.map.setFilter("gemeentes-hover-outline", hovered);
    this.map.setFilter("gemeentes-neighbour-fill", matchNames(neighbours));
    this.map.setFilter("gemeentes-neighbour-outline", matchNames(neighbours));
  },

  /** Recolor every polygon from the current State. Call after any refresh. */
  applyStyles() {
    if (!this.geojson) return;

    // Computed once for the whole pass, not per feature.
    const scoring = State.scoringGemeenteNames();

    for (const feature of this.geojson.features) {
      const card = State.cardByName(feature.properties.name);
      const isScoring = scoring.has(feature.properties.name);
      Object.assign(feature.properties, this._styleFor(card, isScoring));
    }

    // Not a per-feature property: fill-pattern can't be data-driven off
    // the source the way the colors are, so the striped gemeentes go into
    // a layer filter instead. Stashed before the early return below so the
    // load handler can apply it too.
    this._stripedNames = [...State.stripedGemeenteNames()];

    if (!this.loaded) {
      // Map style/source isn't ready yet - applied as soon as it is.
      this._pendingStyleUpdate = true;
      return;
    }

    this._applyWildcardFilter();

    const source = this.map.getSource("gemeentes");
    if (source) source.setData(this.geojson);
  },

  /** Stripe exactly the gemeentes in `_stripedNames`, once the map is up. */
  _applyWildcardFilter() {
    if (!this.loaded) return;
    if (!this.map.getLayer("gemeentes-wildcard-fill")) return;
    this.map.setFilter("gemeentes-wildcard-fill", matchNames(this._stripedNames));
  },

  /**
   * Paint properties for one gemeente. `isScoring` means the gemeente is
   * part of its team's counting cluster and gets the heavier outline.
   *
   * Every branch must set every property: applyStyles() merges the result
   * into the feature rather than replacing it, so anything left out here
   * would keep whatever the previous render pass put there.
   */
  _styleFor(card, isScoring) {
    const fill = CONFIG.MAP_FILL;

    if (!card) {
      // Not on the public or private board, as far as we can see.
      return {
        fillColor: fill.hidden,
        fillOpacity: fill.hiddenOpacity,
        strokeColor: fill.strokeColor,
        strokeOpacity: 0.35,
        strokeWidth: fill.strokeWidth,
      };
    }

    if (card.card_state === "Claimed") {
      const color = CONFIG.TEAM_COLORS[card.claimed_team] || "#999999";
      return {
        fillColor: color,
        fillOpacity: fill.claimedOpacity,
        strokeColor: color,
        strokeOpacity: 1,
        strokeWidth: fill.claimedStrokeWidth,
      };
    }

    if (card.card_state === "OnPublicBoard") {
      return {
        fillColor: fill.public,
        fillOpacity: fill.publicOpacity,
        strokeColor: fill.strokeColor,
        strokeOpacity: 0.6,
        strokeWidth: fill.strokeWidth,
      };
    }

    if (card.card_state === "OnPrivateBoard") {
      // Only ever true for our own team - other teams' private cards never appear in our card list.
      const color = CONFIG.TEAM_COLORS[card.private_board_team] || fill.public;
      return {
        fillColor: color,
        fillOpacity: fill.privateOpacity,
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWidth: fill.strokeWidth,
      };
    }

    return {
      fillColor: fill.hidden,
      fillOpacity: fill.hiddenOpacity,
      strokeColor: fill.strokeColor,
      strokeOpacity: 0.35,
      strokeWidth: fill.strokeWidth,
    };
  },
};

/** Layer filter matching exactly the gemeentes in `names` - nothing when it's empty. */
function matchNames(names) {
  return ["in", ["get", "name"], ["literal", names]];
}

/** Image id the wild-card stripe pattern is registered under. */
const WILDCARD_PATTERN_ID = "wildcard-stripes";

/**
 * Draws the repeating diagonal stripe tile the wild-card layer fills with,
 * as {image, pixelRatio} for map.addImage(), or null if this browser won't
 * give us a 2D canvas to draw it on.
 *
 * A pattern image rather than a paint property because MapLibre fills are
 * WebGL: there's no CSS gradient to hand it, so the stripes have to arrive
 * as pixels, with their color baked in (fill-pattern ignores fill-color).
 *
 * Seamless at 45 degrees: the line is drawn three times, offset by a full
 * tile left and right, so the part that runs off one edge is the part that
 * arrives on the other. Rendered at devicePixelRatio and handed back with
 * that as `pixelRatio`, so the tile is still a CONFIG-sized square in
 * screen pixels but isn't soft on a phone.
 *
 * Each line is drawn a tile longer than it needs to be at both ends, so
 * that the stroke crossing the tile is a full-width band all the way to
 * the edge. Ending a line *on* the corner instead leaves the default butt
 * cap slicing the band off diagonally right where one tile has to hand
 * over to the next - which every tile does identically, so the join goes
 * missing and continuous stripes come out as dashes.
 */
function buildStripePattern() {
  const fill = CONFIG.MAP_FILL;
  const size = fill.wildcardStripeSize;
  const scale = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const side = size * scale;

  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.strokeStyle = fill.wildcardStripeColor;
  ctx.lineWidth = fill.wildcardStripeWidth;

  // Past the edges by a whole tile either way: the caps end up well
  // outside the canvas, and what's left inside is exactly the band an
  // endless 45-degree line would leave there.
  for (const offset of [-size, 0, size]) {
    ctx.beginPath();
    ctx.moveTo(offset - size, -size);
    ctx.lineTo(offset + 2 * size, 2 * size);
    ctx.stroke();
  }

  const { data } = ctx.getImageData(0, 0, side, side);
  return {
    image: { width: side, height: side, data: new Uint8Array(data) },
    pixelRatio: scale,
  };
}

/** How long (ms) a finger must stay down before it highlights rather than opening a card. */
const LONG_PRESS_MS = 350;

/** How far (px) a finger may drift during that and still count as held rather than panning. */
const LONG_PRESS_MOVE_TOLERANCE = 10;

/** The raster layer id used for the OpenStreetMap basemap. */
const BASEMAP_LAYER_ID = "osm";

/** Compact +/- control that adjusts the basemap raster opacity. */
function createBasemapOpacityControl(setOpacity) {
  let container = null;
  let toggleGroup = null;
  let opacityGroup = null;

  return {
    onAdd() {
      container = document.createElement("div");

      toggleGroup = document.createElement("div");
      toggleGroup.className = "maplibregl-ctrl maplibregl-ctrl-group";

      toggleButton = document.createElement("button");
      toggleButton.className = "maplibregl-ctrl-basemap-opacity";
      toggleButton.type = "button";
      toggleButton.addEventListener("click", () => {
        opacityGroup.style.display = opacityGroup.style.display === "none" ? "block" : "none";
      });
      toggleGroup.append(toggleButton)

      toggleButtonIcon = document.createElement("span");
      toggleButtonIcon.className = "maplibregl-ctrl-icon";
      toggleButton.append(toggleButtonIcon)

      opacityGroup = document.createElement("div")
      opacityGroup.className = "maplibregl-ctrl maplibregl-ctrl-group";
      opacityGroup.style.display = "none";

      opacityInput = document.createElement("input");
      opacityInput.type = "range";
      opacityInput.min = "0";
      opacityInput.max = "1";
      opacityInput.step = "0.01";
      opacityInput.value = CONFIG.BASEMAP_OPACITY;
      opacityInput.addEventListener("input", (event) => {
        const opacity = Number(event.target.value);
        setOpacity(opacity)
      });
      opacityGroup.append(opacityInput)

      container.append(toggleGroup, opacityGroup);
      return container;
    },

    onRemove() {
      container?.remove();
      container = null;
      toggleButton = null;
      opacityInput = null;
    },
  };
}

/**
 * Builds the MapLibre style JSON for the base map, honoring
 * CONFIG.SHOW_BASEMAP. When it's off, no tiles are requested at all -
 * just a flat background color behind the gemeente polygons.
 */
function buildBaseStyle(baseMapOpacity = CONFIG.BASEMAP_OPACITY) {
  const style = CONFIG.SHOW_BASEMAP
    ? // Plain OpenStreetMap raster tiles - free, no API key required. Swap
      // this for a vector style (e.g. from MapTiler/Stadia/etc., which do
      // need a key) if you want nicer basemap styling or expect traffic
      // beyond OSM's fair-use tile policy - see README.md.
      {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: BASEMAP_LAYER_ID,
            type: "raster",
            source: BASEMAP_LAYER_ID,
            paint: {
              "raster-opacity": baseMapOpacity,
            },
          },
        ],
      }
    : {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": CONFIG.MAP_FILL.background },
          },
        ],
      };

  // Where the gemeente name labels get their glyphs. Left off entirely
  // when no URL is configured, which is also what turns the labels off.
  if (CONFIG.GLYPHS_URL) style.glyphs = CONFIG.GLYPHS_URL;

  return style;
}

/**
 * Point FeatureCollection with one labelled point per gemeente, at the
 * spot its name should sit. Built once at load - the polygons never
 * change, so neither do these.
 */
function buildLabelPoints(geojson) {
  return {
    type: "FeatureCollection",
    features: geojson.features.map((feature) => ({
      type: "Feature",
      properties: { name: feature.properties.name },
      geometry: { type: "Point", coordinates: labelPoint(feature.geometry) },
    })),
  };
}

/**
 * Where to put one gemeente's name: the center of its largest part, so a
 * gemeente with islands or an exclave gets labelled on the mainland.
 *
 * "Center" is the polygon's area centroid, which for the blob-ish shapes
 * gemeentes have is both inside the polygon and where the eye expects
 * the name. It isn't guaranteed to be inside, though - a crescent-shaped
 * gemeente, or one wrapped around an enclave like Rozendaal, can put its
 * centroid outside its own borders - so that case falls back to a point
 * that definitely is inside.
 */
function labelPoint(geometry) {
  const polygons =
    geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];

  // [outerRing, ...holes] of the biggest part.
  const polygon = polygons.reduce((largest, candidate) =>
    ringArea(candidate[0]) > ringArea(largest[0]) ? candidate : largest,
  );

  const centroid = ringCentroid(polygon[0]);
  if (!centroid) return polygon[0][0]; // zero-area ring; nothing better to offer
  if (containsPoint(polygon, centroid)) return centroid;
  return interiorPointAtLatitude(polygon, centroid[1]) || centroid;
}

/** Twice the signed area of a ring - the shared term in the area and centroid sums. */
function ringDoubleSignedArea(ring) {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    total += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return total;
}

/** Ring area in square degrees. Only ever compared against other rings nearby, so the distortion doesn't matter. */
function ringArea(ring) {
  return Math.abs(ringDoubleSignedArea(ring)) / 2;
}

/** Area centroid of a ring, or null if it encloses no area. */
function ringCentroid(ring) {
  const doubleArea = ringDoubleSignedArea(ring);
  if (doubleArea === 0) return null;

  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  return [x / (3 * doubleArea), y / (3 * doubleArea)];
}

/**
 * Whether [lng, lat] is inside `polygon` ([outerRing, ...holes]).
 *
 * Ray casting, counting crossings of every ring at once: a point inside
 * a hole crosses that hole's edge an extra time on its way out, which
 * flips it back to "outside" without needing to test the holes
 * separately.
 */
function containsPoint(polygon, [lng, lat]) {
  let inside = false;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      if (y1 > lat !== y2 > lat && lng < x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1)) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * Midpoint of the widest stretch of `polygon` that lies on the given
 * latitude, or null if the line misses it entirely. Used when the
 * centroid falls outside: the result is inside by construction, and
 * taking the widest stretch keeps the name off a narrow spur.
 */
function interiorPointAtLatitude(polygon, lat) {
  const crossings = [];
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      if (y1 > lat !== y2 > lat) {
        crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
  }

  // Sorted crossings pair up into inside/outside spans, so every even
  // index opens a span that lies within the polygon.
  crossings.sort((a, b) => a - b);

  let widest = -Infinity;
  let point = null;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const width = crossings[i + 1] - crossings[i];
    if (width > widest) {
      widest = width;
      point = [(crossings[i] + crossings[i + 1]) / 2, lat];
    }
  }
  return point;
}

/** [[minLng, minLat], [maxLng, maxLat]] across every coordinate in a FeatureCollection, or null if empty. */
function computeBounds(geojson) {
  const points = [];
  for (const feature of geojson.features)
    collectPoints(feature.geometry.coordinates, points);
  if (points.length === 0) return null;

  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Recursively flattens Polygon/MultiPolygon coordinate arrays down to raw [lng, lat] pairs. */
function collectPoints(coords, out) {
  if (typeof coords[0] === "number") {
    out.push(coords);
  } else {
    for (const c of coords) collectPoints(c, out);
  }
}
