/**
 * Thin wrapper around the jetlag-api backend. Every call throws a
 * regular Error with a human-readable message on failure, so callers
 * can just try/catch and show err.message.
 */
const Api = {
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

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${CONFIG.API_BASE_URL}${path}`, options);
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
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}
