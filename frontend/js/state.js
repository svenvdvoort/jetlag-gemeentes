/**
 * Single source of truth for the current game state. Every render pass
 * (map colors, cards panel, score bar) reads from here; every API call
 * result gets written here first, then `render()` (in main.js) redraws
 * everything from scratch. That keeps the UI from drifting out of sync
 * with itself, at the cost of a full re-render on every change - fine at
 * this game's scale (~60 cards, a handful of teams).
 */
const State = {
  gameId: null,
  myTeamColor: null,
  cards: [], // raw response from GET /{game}/{team}/cards
  teams: [], // raw response from GET /{game}/teams

  _neighbours: new Map(), // gemeente name -> Set of gemeentes it borders
  _pairsLoaded: false,

  init(gameId, myTeamColor) {
    this.gameId = gameId;
    this.myTeamColor = myTeamColor;
  },

  setCards(cards) {
    this.cards = cards;
  },

  setTeams(teams) {
    this.teams = teams;
  },

  /**
   * Expands the [["Aalten", "Oost Gelre"], ...] pairs from GET /pairs into
   * a both-ways lookup. Called once at startup - gemeente borders are
   * static map data, unlike cards and teams which are refetched on every
   * refresh - so scoring never has to rebuild this.
   */
  setPairs(pairs) {
    const neighbours = new Map();
    for (const [a, b] of pairs) {
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      if (!neighbours.has(b)) neighbours.set(b, new Set());
      neighbours.get(a).add(b);
      neighbours.get(b).add(a);
    }
    this._neighbours = neighbours;
    this._pairsLoaded = true;
  },

  /**
   * The gemeentes bordering `name`, as a Set - empty when /pairs never
   * loaded or the name isn't a gemeente (e.g. a wild card). Read-only:
   * this hands out the internal set rather than a copy.
   */
  neighboursOf(name) {
    return this._neighbours.get(name) || new Set();
  },

  /** Card object for a gemeente/wild-card name, or undefined if we can't see it. */
  cardByName(name) {
    return this.cards.find((c) => c.card_name === name);
  },

  cardById(cardId) {
    return this.cards.find((c) => c.card_id === cardId);
  },

  /** Cards shown in the bottom cards panel: public board + our own visible private cards. */
  panelCards() {
    return this.cards
      .filter(
        (c) =>
          c.card_state === "OnPublicBoard" ||
          (c.card_state === "OnPrivateBoard" &&
            c.private_board_team === this.myTeamColor),
      )
      .sort((a, b) => {
        // First sort on public vs private cards (public cards are shown first)
        if (
          a.card_state === "OnPublicBoard" &&
          b.card_state === "OnPrivateBoard"
        ) {
          return -1;
        } else if (
          a.card_state === "OnPrivateBoard" &&
          b.card_state === "OnPublicBoard"
        ) {
          return 1;
        }
        // Then sort alphabetically
        return a.card_name.localeCompare(b.card_name);
      });
  },

  /** Current public-board cards, for the discard picker. */
  publicBoardCards() {
    return this.cards
      .filter((c) => c.card_state === "OnPublicBoard")
      .sort((a, b) => a.card_name.localeCompare(b.card_name));
  },

  myTeam() {
    return this.teams.find((t) => t.team_color === this.myTeamColor);
  },

  /** True while *our* team is the one that is discarding. */
  canDiscard() {
    const team = this.myTeam();
    return Boolean(team && team.can_discard_card);
  },

  /**
   * The team that is discarding a card, if any. At most one team can be
   * discarding at a time, since the claim that hands a discard out is
   * refused while another discard is still in progress.
   */
  pendingDiscardTeam() {
    return this.teams.find((t) => t.can_discard_card);
  },

  /**
   * True while any team is discarding. A discard in progress freezes the
   * whole game - not just the team that is discarding - so every board
   * goes frozen until that card is discarded, ours included.
   */
  isFrozen() {
    return Boolean(this.pendingDiscardTeam());
  },

  /** Unclaimed regular gemeentes, for the wild-card target dropdown. */
  unclaimedGemeentes() {
    return this.cards
      .filter((c) => c.card_state !== "Claimed" && !c.is_wild_card)
      .map((c) => c.card_name)
  },

  /**
   * Score per team color: `{ connected, total, cluster }`.
   *
   * `connected` is the score that actually counts - the size of the
   * team's largest group of claimed gemeentes that border each other. A
   * team holding two separate groups only scores the bigger one.
   * `total` is every gemeente they claimed, connected or not, and
   * `cluster` is the names making up the counting group, which the map
   * outlines.
   *
   * Without the /pairs data there's no graph to walk, so `connected`
   * falls back to `total` and nothing gets highlighted.
   */
  scores() {
    const claimedByColor = new Map();
    for (const team of this.teams)
      claimedByColor.set(team.team_color, new Set());

    for (const card of this.cards) {
      if (
        card.card_state !== "Claimed" ||
        card.is_wild_card ||
        !card.claimed_team
      )
        continue;
      // A color we don't have a team for shouldn't happen, but scoring it
      // is friendlier than dropping it on the floor.
      if (!claimedByColor.has(card.claimed_team))
        claimedByColor.set(card.claimed_team, new Set());
      claimedByColor.get(card.claimed_team).add(card.card_name);
    }

    const byColor = {};
    for (const [color, claimed] of claimedByColor) {
      byColor[color] = this._pairsLoaded
        ? scoreClaimed(claimed, this._neighbours)
        : { connected: claimed.size, total: claimed.size, cluster: new Set() };
    }
    return byColor;
  },

  /** Every team's counting cluster in one set - what the map outlines. */
  scoringGemeenteNames() {
    const names = new Set();
    for (const score of Object.values(this.scores())) {
      for (const name of score.cluster) names.add(name);
    }
    return names;
  },
};

/**
 * Scores one team's claimed gemeentes: flood-fills them over the
 * adjacency graph and keeps the largest group.
 *
 * When several groups tie for largest, one of them is picked at random
 * to be `cluster`. Outlining all of them would suggest more gemeentes
 * are scoring than the score says, and always taking the first would
 * quietly favor whichever group the flood-fill happened to reach first.
 * The pick is re-rolled on every call, so a tie can land on a different
 * group from one refresh to the next.
 */
function scoreClaimed(claimed, neighbours) {
  const unvisited = new Set(claimed);
  const groups = [];

  for (const start of claimed) {
    if (!unvisited.has(start)) continue;

    const group = [];
    const queue = [start];
    unvisited.delete(start);

    while (queue.length > 0) {
      const name = queue.pop();
      group.push(name);
      for (const neighbour of neighbours.get(name) || []) {
        if (unvisited.has(neighbour)) {
          unvisited.delete(neighbour);
          queue.push(neighbour);
        }
      }
    }

    groups.push(group);
  }

  const connected = groups.reduce(
    (largest, group) => Math.max(largest, group.length),
    0,
  );

  const tied = groups.filter((group) => group.length === connected);
  const winner = tied[Math.floor(Math.random() * tied.length)] || [];

  return { connected, total: claimed.size, cluster: new Set(winner) };
}
