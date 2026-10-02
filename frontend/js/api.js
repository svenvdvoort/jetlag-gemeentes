/**
 * Thin wrapper around the jetlag-api backend. Every call throws a
 * regular Error with a human-readable message on failure, so callers
 * can just try/catch and show err.message.
 *
 * The team's token isn't passed around here: login() has the backend set
 * an HttpOnly cookie, which the browser then attaches to every
 * same-origin request by itself. Nothing below has to know about it.
 */
const Api = {
  /**
   * Whether the cookie this browser already holds still signs it in as
   * `teamColor`. Resolves with the team if it does; throws otherwise,
   * which is a normal answer and not a failure worth showing.
   */
  getSession(gameId, teamColor) {
    return request(`${gameId}/${teamColor}/session`);
  },

  /**
   * Trades a team's token for that cookie. Resolves with the team on
   * success; a wrong token throws with `unauthorized` set.
   */
  login(gameId, teamColor, token) {
    return request(`${gameId}/${teamColor}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  },

  /** Every game that exists, as [{game_id, team_count}] - drives the join page. */
  getGames() {
    return request("games");
  },

  /** Creates a game and seeds its deck. `teams` is [{team_color, team_name}]. */
  createGame(gameId, teams) {
    return request(`${gameId}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teams }),
    });
  },

  getPairs() {
    return request("pairs");
  },

  /**
   * Whether the game has started yet, as
   * `{game_id, starts_at, started, server_time}`. The two timestamps are
   * UTC with an offset on them, so Date.parse reads them as the instants
   * they are; `server_time` is the clock the countdown runs off.
   */
  async getStatus(gameId) {
    const status = await request(`${gameId}/status`);
    // The one response that carries the server's clock, so this is where
    // the offset below gets set - see serverNow().
    serverClockOffsetMs = Date.parse(status.server_time) - Date.now();
    return status;
  },

  getTeams(gameId) {
    return request(`${gameId}/teams`);
  },

  getCards(gameId, teamColor) {
    return request(`${gameId}/${teamColor}/cards`);
  },

  /** Returns the list of newly-drawn replacement cards (may be empty). */
  claimCard(gameId, teamColor, cardId, targetCardId) {
    const qs =
      targetCardId != null
        ? `?target_card_id=${encodeURIComponent(targetCardId)}`
        : "";
    return request(`${gameId}/${teamColor}/claim/${cardId}${qs}`, {
      method: "PUT",
    });
  },

  /** Returns the single newly-drawn replacement card. */
  discardCard(gameId, teamColor, cardId) {
    return request(`${gameId}/${teamColor}/discard/${cardId}`, {
      method: "PUT",
    });
  },
};

/**
 * How far this device's clock is behind the server's, in ms.
 *
 * Everything on the board that counts towards a moment - the kickoff
 * screen, the face-down cards - is counting towards one the *server*
 * decides has arrived, so they tick on its clock rather than on this
 * device's, which may be minutes out. Set from `server_time` on every
 * /status response, and 0 until the first of those lands: without an
 * answer, this device's clock is the only one there is.
 */
let serverClockOffsetMs = 0;

/** The server's idea of now, in ms since the epoch. */
function serverNow() {
  return Date.now() + serverClockOffsetMs;
}

async function request(path, options = {}) {
  let response;
  try {
    // Spread last so a caller could still override it; "same-origin" is
    // already the default, but the token cookie rides on it, so it's
    // worth saying out loud rather than inheriting.
    response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      credentials: "same-origin",
      ...options,
    });
  } catch (networkErr) {
    throw new Error(
      "Can't reach the server. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    let detail = response.statusText || `Request failed (${response.status})`;
    try {
      const body = await response.json();
      // The backend's own errors put a plain sentence in `detail`, but
      // FastAPI's request validation (422) puts a list of error objects
      // there instead - which would stringify to "[object Object]".
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch (_) {
      // Response wasn't JSON - keep the status text.
    }
    const error = new Error(detail);
    // Lets a caller tell "your token is wrong or gone" apart from every
    // other failure: the board sends you back to the join page for this
    // one rather than toasting something you can't act on.
    error.unauthorized = response.status === 401;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}
