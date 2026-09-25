/**
 * Looks up the SVG outline to draw on a gemeente's card.
 *
 * img/gemeentes/ is generated from the CBS KML by
 * scripts/export_gemeente_svgs.py, which also writes the index.json this
 * reads. The filenames are slugged gemeente names, but deriving that slug
 * again here would be the same rule written in a second language and free
 * to drift from the first, so the index stays the only place the
 * name -> file mapping lives.
 *
 * Shapes are decoration: a card without one still says which gemeente it
 * is. So a failed load leaves every lookup returning null and the deck
 * falling back to name-only cards, rather than taking the board down.
 */
const GemeenteShapes = {
  _urls: new Map(),

  /** Fetch the index. Throws; the caller decides how loudly to fail. */
  async load() {
    const base = CONFIG.GEMEENTE_SHAPES_PATH;
    const index = await fetch(`${base}index.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });

    for (const gemeente of index.gemeentes) {
      // Absolute, deliberately. These end up in a CSS url() inside a custom
      // property, and a relative one there is resolved against the
      // stylesheet that substitutes the var - css/styles.css - rather than
      // against the page, so it would go looking in css/img/gemeentes/.
      // Resolving against the document here settles it for every consumer.
      this._urls.set(gemeente.name, new URL(`${base}${gemeente.file}`, document.baseURI).href);
    }
  },

  /**
   * Absolute URL of the gemeente's SVG, or null if there isn't one - which
   * is the normal answer for a wild card, since those aren't a place.
   */
  urlFor(name) {
    return this._urls.get(name) || null;
  },
};
