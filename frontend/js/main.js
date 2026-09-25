/**
 * Bootstraps the app once the DOM (and the maplibre-gl script tag,
 * loaded before this file in board.html) is ready. Unlike the Google
 * Maps JS API, MapLibre needs no API key and no async callback dance -
 * we can just call this directly.
 */
async function initApp() {
  const gameId = getGameId();
  const myTeamColor = getMyTeamColor();

  if (!gameId || !myTeamColor) {
    // Nothing to load without both - send them to the join page to pick.
    // replace() rather than assign() so Back doesn't bounce them here again.
    window.location.replace("/");
    return;
  }

  State.init(gameId, myTeamColor);
  UI.init();

  let geojson;
  try {
    const kmlText = await fetch(CONFIG.KML_PATH).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    geojson = KmlParser.parse(kmlText);
  } catch (err) {
    showFatalError(
      `Couldn't load the gemeente boundaries from ${CONFIG.KML_PATH} (${err.message}). ` +
        "Check CONFIG.KML_PATH in js/config.js."
    );
    return;
  }

  if (geojson.features.length === 0) {
    showFatalError("The KML file loaded, but no gemeente polygons were found in it.");
    return;
  }

  MapView.init(document.getElementById("map"), geojson, (name) => UI.openCardModal(name));

  // Static data, so it's fetched once here rather than in refreshAll().
  // Both have to land before the first refresh, since that's what triggers
  // the opening map paint and the first draw of the deck.
  try {
    State.setPairs(await Api.getPairs());
  } catch (err) {
    console.warn("Couldn't load gemeente borders; scores fall back to total claimed.", err);
  }

  try {
    await GemeenteShapes.load();
  } catch (err) {
    console.warn("Couldn't load gemeente shapes; cards fall back to their name alone.", err);
  }

  document.getElementById("refresh-btn").addEventListener("click", () => window.refreshAll());

  await window.refreshAll();
}

/** Re-fetches cards + teams and redraws the map, cards panel, and score bar. */
window.refreshAll = async function refreshAll() {
  const refreshBtn = document.getElementById("refresh-btn");
  refreshBtn.classList.add("spinning");
  try {
    const [cards, teams] = await Promise.all([
      Api.getCards(State.gameId, State.myTeamColor),
      Api.getTeams(State.gameId),
    ]);
    State.setCards(cards);
    State.setTeams(teams);
    MapView.applyStyles();
    UI.render();
  } catch (err) {
    UI.toast(`Couldn't refresh: ${err.message}`, "error");
  } finally {
    refreshBtn.classList.remove("spinning");
  }
};

function showFatalError(html) {
  const el = document.getElementById("fatal-error");
  el.innerHTML = html;
  el.hidden = false;
  document.getElementById("app").hidden = true;
}

document.addEventListener("DOMContentLoaded", initApp);
