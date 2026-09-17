/**
 * Owns the MapLibre GL map instance and the single GeoJSON source
 * holding every gemeente polygon. `applyStyles()` mutates each
 * feature's paint-relevant properties (fillColor, fillOpacity, ...)
 * from the current State and re-sets the source data - called once
 * after every state refresh, never incrementally, so the map can never
 * end up showing a stale color for one gemeente.
 *
 * Hover highlighting is deliberately *not* part of that pass: it swaps
 * the filters on four dedicated layers instead, so moving the mouse
 * never re-uploads the (fairly large) polygon source.
 */
const MapView = {
  map: null,
  geojson: null,
  loaded: false,
  onGemeenteClick: null,
  hoveredName: null,
  _pendingStyleUpdate: false,

  /**
   * @param {HTMLElement} mapDiv
   * @param {GeoJSON.FeatureCollection} geojson gemeente polygons, from KmlParser.parse()
   * @param {(name: string) => void} onGemeenteClick
   */
  init(mapDiv, geojson, onGemeenteClick) {
    this.geojson = geojson;
    this.onGemeenteClick = onGemeenteClick;

    this.map = new maplibregl.Map({
      container: mapDiv,
      style: buildBaseStyle(),
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      attributionControl: CONFIG.SHOW_BASEMAP, // only needed when we're actually using OSM tiles
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

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
        if (e.features && e.features[0]) {
          this.onGemeenteClick(e.features[0].properties.name);
        }
      });
      if (supportsHover()) {
        // mousemove rather than mouseenter: the pointer can cross from one
        // gemeente straight into the next without ever leaving the layer.
        this.map.on("mousemove", "gemeentes-fill", (e) => {
          this.map.getCanvas().style.cursor = "pointer";
          this._setHovered(e.features && e.features[0] ? e.features[0].properties.name : null);
        });
        this.map.on("mouseleave", "gemeentes-fill", () => {
          this.map.getCanvas().style.cursor = "";
          this._setHovered(null);
        });
      }

      const bounds = computeBounds(this.geojson);
      if (bounds) this.map.fitBounds(bounds, { padding: 24, duration: 0 });

      this.loaded = true;
      if (this._pendingStyleUpdate) {
        this._pendingStyleUpdate = false;
        this.applyStyles();
      }
    });
  },

  /**
   * Fill and outline `name`, and highlight every gemeente it borders;
   * pass null to clear. Only the four highlight layers' filters change,
   * so this is cheap enough to run straight off mousemove.
   *
   * Borders come from State, which only has them once GET /pairs has
   * landed - before that (or if it failed) the hovered gemeente still
   * gets its own highlight, just with nothing highlighted around it.
   */
  _setHovered(name) {
    if (!this.loaded || name === this.hoveredName) return;
    this.hoveredName = name;

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

    if (!this.loaded) {
      // Map style/source isn't ready yet - applied as soon as it is.
      this._pendingStyleUpdate = true;
      return;
    }

    const source = this.map.getSource("gemeentes");
    if (source) source.setData(this.geojson);
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
        fillOpacity: fill.claimedOpacity * (isScoring ? 1 : 0.8),
        strokeColor: color,
        strokeOpacity: 1,
        strokeWidth: isScoring ? fill.claimedStrokeWidth : fill.strokeWidth,
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

/**
 * Whether this device has a real pointer. Touch browsers fire a synthetic
 * mousemove on tap but no matching mouseleave, so wiring hover up there
 * would leave the highlight stuck on whatever was tapped last - and a tap
 * already opens that gemeente's card anyway.
 */
function supportsHover() {
  return window.matchMedia("(hover: hover)").matches;
}

/**
 * Builds the MapLibre style JSON for the base map, honoring
 * CONFIG.SHOW_BASEMAP. When it's off, no tiles are requested at all -
 * just a flat background color behind the gemeente polygons.
 */
function buildBaseStyle() {
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
        layers: [{ id: "osm", type: "raster", source: "osm" }],
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
