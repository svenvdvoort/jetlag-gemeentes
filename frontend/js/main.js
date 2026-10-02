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

  // Static data, so it's fetched once here rather than in refreshAll().
  // Both have to land before the first refresh, since that's what triggers
  // the opening map paint and the first draw of the deck - and fetching
  // them before the kickoff screen means a game that's still counting down
  // has them in hand by the time it opens the board.
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

  // Nothing of the board exists before the game starts, so nothing of it
  // is built either - the map included, which is why this sits in front
  // of MapView.init() rather than hiding a board that's already drawn.
  await waitForKickoff();

  MapView.init(document.getElementById("map"), geojson, (name) => UI.openCardModal(name));

  await window.refreshAll();
}

/**
 * Counts down to kickoff on the pregame screen, and resolves the moment
 * the game is on - immediately, for one that already started.
 *
 * The server is what decides that: it returns every card as still in the
 * deck until the game starts, and refuses claims until then. So the
 * countdown is a scheduler rather than a gate - it decides when to ask
 * again, and the answer always comes from GET /{game}/status. It ticks off
 * the server's clock (`serverNow()`, recorded from that same answer) so it
 * can't disagree with the board it's counting towards, and a phone running
 * a minute fast can't open an empty board a minute early.
 */
async function waitForKickoff() {
  const screen = document.getElementById("pregame");
  const app = document.getElementById("app");

  for (;;) {
    let status;
    try {
      status = await Api.getStatus(State.gameId);
    } catch (err) {
      // No way to tell whether the game is on. The cards stay hidden
      // server-side either way, so a board the team can refresh beats a
      // countdown with nothing to count.
      console.warn("Couldn't check whether the game has started.", err);
      break;
    }
    if (status.started) break;

    const startsAt = Date.parse(status.starts_at);

    app.hidden = true;
    document.getElementById("pregame-time").textContent = formatClockTime(startsAt);
    document.getElementById("pregame-meta").textContent =
      `Game ${State.gameId} - ${State.myTeamColor} team`;
    screen.hidden = false;

    const countdown = document.getElementById("pregame-countdown");
    let remaining;
    while ((remaining = startsAt - serverNow()) > 0) {
      countdown.textContent = formatCountdown(remaining);
      await sleep(Math.min(remaining, 1000));
    }
    countdown.textContent = formatCountdown(0);
    // Back round to the server for the final word, with a floor under how
    // often that happens in case its clock says "not yet" a moment longer.
    await sleep(KICKOFF_RECHECK_MS);
  }

  screen.hidden = true;
  app.hidden = false;
}

/** How long to sit on a finished countdown before asking the server again. */
const KICKOFF_RECHECK_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (err.unauthorized) {
      // Either the cookie is for a different team than the URL asks for -
      // someone hand-editing ?team= to peek at another board - or it
      // expired. Both are fixed by joining again, and neither is
      // something a toast on a board that can't load would help with.
      // replace() so Back doesn't bounce straight back here.
      window.location.replace("index.html");
      return;
    }
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
