/**
 * Everything that touches the DOM outside the map itself: the cards
 * panel, score bar, the claim/discard modal, and toast messages.
 *
 * The modal is a tiny state machine (`Modal.view` + `Modal.context`) so
 * the claim flow (detail -> confirm -> result) and the discard flow
 * (pick -> confirm -> result) can share one overlay and one render
 * function instead of five separate popups.
 *
 * The discard flow is the one view nobody opens on purpose: the rules
 * make a discard mandatory after a claim, and the server refuses the
 * next claim until it happens, so `Modal.blocking` turns the overlay
 * into a full-screen wall. The one way past it is peeking (below), which
 * trades the wall for a read-only board; only a completed discard puts
 * the game back in the team's hands.
 *
 * That wall goes up on *every* team's board, not just on the one that
 * is discarding: a discard in progress freezes the whole game. The teams
 * who aren't the one discarding get the waiting screen instead of the
 * picker, but
 * otherwise the same treatment - claiming refused, the deck readable but
 * unplayable - since nobody may move until that card is gone.
 */

/**
 * Set while the team is looking at the board instead of the freeze screen
 * (the discard picker, or the waiting screen when it's someone else's
 * discard). Everything the board can normally *do* is off in this mode -
 * claiming is refused, and the deck is there to read rather than to play
 * from - so all peeking buys is a look at where the gemeentes stand and
 * what's on the table, which is exactly what you want before choosing
 * what to throw away, or while waiting out a team that's choosing.
 */
let freezePeek = false;

const UI = {
  init() {
    document
      .getElementById("cards-panel-handle")
      .addEventListener("click", () => {
        document.getElementById("cards-panel").classList.toggle("expanded");
      });

    document.getElementById("modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") Modal.close();
    });

    document
      .getElementById("discard-nag-btn")
      .addEventListener("click", () => UI.resumeFreezeScreen());

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      // Escape can't finish the discard, only step aside from it.
      if (Modal.blocking) UI.peekBoard();
      else Modal.close();
    });
  },

  /** Redraw the cards panel and score bar from the current State. Call after every refresh. */
  render() {
    renderCardsPanel();
    renderScoreBar();
    syncFreezeState();
  },

  openCardModal(name) {
    Modal.showGemeente(name);
  },

  /** Leave the freeze screen for the frozen board behind it. */
  peekBoard() {
    freezePeek = true;
    Modal.blocking = false;
    Modal.close();
  },

  /** Back from the frozen board to the freeze screen. */
  resumeFreezeScreen() {
    freezePeek = false;
    showFreezeScreen();
  },

  toast(message, tone = "info") {
    const container = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = `toast toast--${tone}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.classList.add("toast--visible"), 10);
    setTimeout(() => {
      el.classList.remove("toast--visible");
      setTimeout(() => el.remove(), 250);
    }, 3200);
  },
};

// ---------------------------------------------------------------------
// Cards panel
// ---------------------------------------------------------------------

function renderCardsPanel() {
  const cards = State.panelCards();
  // A frozen deck looks exactly like a playable one - same cards, still
  // tappable to read - so the handle is where that difference gets said.
  const count = cards.length === 1 ? "1 card" : `${cards.length} cards`;
  document.getElementById("cards-count").textContent = State.isFrozen()
    ? `${count} · frozen`
    : count;

  const list = document.getElementById("cards-list");
  list.innerHTML = "";

  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cards-empty";
    empty.textContent = "No cards on the board yet. Try refreshing.";
    list.appendChild(empty);
    return;
  }

  for (const card of cards) {
    const isMine = card.card_state === "OnPrivateBoard";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `playing-card${isMine ? " playing-card--private" : ""}${
      card.is_wild_card ? " playing-card--wild" : ""
    }`;
    button.setAttribute("aria-label", `Open ${card.card_name}`);
    if (isMine) {
      team_color = CONFIG.TEAM_COLORS[State.myTeamColor];
      button.setAttribute("style", `background-color: ${team_color}52;`);
    }
    // The shape is what you recognise a card by at a glance; the name is
    // underneath to settle the ones that look alike. A wild card isn't a
    // place, so it wears a star instead of an outline; a gemeente whose
    // outline didn't load has nothing to draw and falls back to name-only.
    //
    // Absolute for the same reason GemeenteShapes hands out absolute URLs:
    // this lands in a CSS url() inside a custom property, and a relative one
    // there is resolved against the stylesheet rather than against the page.
    const shapeUrl = card.is_wild_card
      ? new URL(CONFIG.WILDCARD_SHAPE_PATH, document.baseURI).href
      : GemeenteShapes.urlFor(card.card_name);
    const shape = shapeUrl ? '<span class="playing-card__shape"></span>' : "";

    button.innerHTML = `
      ${shape}
      <span class="playing-card__name">${escapeHtml(card.card_name)}</span>
    `;

    // Through the CSSOM rather than the markup above, so the URL needs no
    // HTML escaping, and after the private-card branch, which assigns the
    // whole style attribute and would otherwise drop this again.
    if (shapeUrl) {
      button.style.setProperty("--shape", `url("${shapeUrl}")`);
    }
    // A gemeente opens the same panel a tap on the map does, so the one
    // place that answers "what can I do with this gemeente" doesn't depend
    // on where you tapped it. A wild card has no gemeente to open, so it
    // opens itself and picks a target from a list.
    button.addEventListener("click", () =>
      card.is_wild_card
        ? Modal.showCardDetail(card)
        : Modal.showGemeente(card.card_name),
    );
    list.appendChild(button);
  }
}

// ---------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------

function renderScoreBar() {
  const scores = State.scores();
  const container = document.getElementById("score-chips");
  container.innerHTML = "";

  for (const team of State.teams) {
    const score = scores[team.team_color] || { connected: 0, total: 0 };
    const chip = document.createElement("div");
    chip.className = "score-chip";
    chip.title = "Team score (total claimed)";
    chip.innerHTML = `
      <span class="score-chip__dot" style="background:${CONFIG.TEAM_COLORS[team.team_color] || "#999"}"></span>
      <span class="score-chip__name">${escapeHtml(team.team_name)}</span>
      <span class="score-chip__value">${score.connected}</span>
      <span class="score-chip__total">(${score.total})</span>
    `;
    container.appendChild(chip);
  }
}

/**
 * Puts the whole app in (or out of) frozen mode after every refresh: deck
 * flagged read-only, return bar shown, freeze screen up unless the team
 * stepped aside to read the board.
 *
 * Which freeze screen that is depends on whose discard it is, but the
 * lockout itself doesn't: a team waiting on someone else's discard can't
 * claim either, so their board is shut down just as thoroughly. Only the
 * copy differs, since they have nothing to do about it but wait.
 *
 * A pending discard of our own usually arrives while the claim result is
 * still on screen, so an open modal is left alone - `Modal.close()` picks
 * the freeze up as soon as that modal is dismissed. The release case
 * covers both a teammate on another phone doing our discard for us and
 * the team we were waiting on finally doing theirs: the wall comes down
 * instead of sitting there over a discard that's already settled.
 */
function syncFreezeState() {
  const frozen = State.isFrozen();
  const isDiscarding = State.canDiscard();

  // Nothing is taken away: reading the deck is how a team decides what to
  // throw away, and how everyone else follows what's on the table. It's
  // the *acting* on it that's off, so the panel is only flagged frozen
  // (see renderCardsPanel and .cards-panel--readonly) - the claim itself
  // is refused in buildDetailView, behind the wall, and by the server.
  document
    .getElementById("cards-panel")
    .classList.toggle("cards-panel--readonly", frozen);
  document.getElementById("discard-nag").hidden = !frozen;

  if (frozen) {
    const nagText = document.getElementById("discard-nag-text");
    const nagButton = document.getElementById("discard-nag-btn");
    if (isDiscarding) {
      nagText.textContent =
        "You need to discard a card. The board is frozen until you pick one.";
      nagButton.textContent = "Discard a card";
    } else {
      nagText.textContent = `${pendingTeamLabel()} is discarding a card. The game is frozen for everyone until they pick one.`;
      nagButton.textContent = "Back to waiting";
    }
  }

  if (!frozen) {
    freezePeek = false;
    if (Modal.blocking) {
      Modal.blocking = false;
      Modal.close();
    }
    return;
  }

  // A freeze screen already up can be the wrong side of the freeze by now
  // - a teammate's phone paying off our discard while another team's
  // claim froze the game again, say. Swapping it beats leaving a picker
  // up for a discard the server would no longer accept from us.
  const ourScreen =
    Modal.view === "discard-pick" || Modal.view === "discard-confirm";
  if (ourScreen && !isDiscarding) Modal.showDiscardWait();
  else if (Modal.view === "discard-wait" && isDiscarding)
    Modal.showDiscardPick();

  if (!Modal.view && !freezePeek) showFreezeScreen();
}

/**
 * The wall for whichever side of the freeze we're on: the picker if the
 * discard is ours to make, the waiting screen if we're only held up by
 * it. Every path back to a blocked board goes through here so the two
 * can't get mixed up.
 */
function showFreezeScreen() {
  if (State.canDiscard()) Modal.showDiscardPick();
  else Modal.showDiscardWait();
}

/** Name of the team the rest of the game is waiting on. */
function pendingTeamLabel() {
  const pending = State.pendingDiscardTeam();
  return pending ? pending.team_name : "Another team";
}

// ---------------------------------------------------------------------
// Modal: claim + discard flows
// ---------------------------------------------------------------------

const Modal = {
  view: null,
  context: {},
  /**
   * While set, the overlay is full-screen and `close()` does nothing -
   * the only exits are finishing the discard or peeking, and both clear
   * this flag themselves rather than going through `close()`.
   */
  blocking: false,

  showCardDetail(card) {
    this.view = "detail";
    this.context = { card, targetName: null, error: null, returnTo: null };
    this._open();
  },

  /**
   * The panel for one gemeente: its own challenge, plus every wild card
   * that can be played on it. Same view as showCardDetail - a gemeente
   * card *is* what that view shows - named separately because the map and
   * the deck have a name to open rather than a card in hand.
   */
  showGemeente(name) {
    const card = State.cardByName(name);
    if (!card) {
      // Every gemeente in the KML is a card in the deck, so this only
      // happens if the two ever drift apart.
      UI.toast(`${name} isn't in the deck the server sent.`, "error");
      return;
    }
    this.showCardDetail(card);
  },

  showConfirm() {
    this.view = "confirm";
    this.context.error = null;
    this._render();
  },

  showDiscardPick() {
    this.view = "discard-pick";
    this.context = { selected: null, error: null };
    this.blocking = true;
    this._open();
  },

  /**
   * The other side of a freeze: another team is discarding, so there's
   * nothing to pick here - just the wall, and a way to check whether
   * they're done yet.
   */
  showDiscardWait() {
    this.view = "discard-wait";
    this.context = {};
    this.blocking = true;
    this._open();
  },

  showDiscardConfirm() {
    this.view = "discard-confirm";
    this.context.error = null;
    this._render();
  },

  showResult(kind, newCards) {
    this.view = "result";
    this.context = { kind, newCards };
    // The discard is settled by the time its result shows, so the wall
    // comes down here - and `_open()` rather than `_render()` because
    // the refresh behind the discard already closed the overlay.
    this.blocking = false;
    this._open();
  },

  close() {
    if (this.blocking) return;

    this.view = null;
    this.context = {};
    document.getElementById("modal-overlay").hidden = true;

    // A claim hands out a discard while its own result modal is still
    // up; this is where that queued freeze finally gets the screen.
    // Peeking is the one case where closing a modal is meant to land on
    // the board rather than back on the freeze screen.
    if (State.isFrozen() && !freezePeek) showFreezeScreen();
  },

  _open() {
    document.getElementById("modal-overlay").hidden = false;
    this._render();
  },

  _render() {
    document
      .getElementById("modal-overlay")
      .classList.toggle("modal-overlay--blocking", this.blocking);

    const content = document.getElementById("modal-content");
    content.innerHTML = "";
    content.appendChild(this._buildView());
    // Focus moves into the dialog so the keyboard and screen readers follow
    // it, but it lands on the sheet rather than the first control: focusing
    // the top card of the discard list paints a ring on it that reads as a
    // pick the team never made.
    document.getElementById("modal-sheet").focus();
  },

  _buildView() {
    switch (this.view) {
      case "detail":
        return buildDetailView(this.context);
      case "confirm":
        return buildConfirmView(this.context);
      case "discard-pick":
        return buildDiscardPickView(this.context);
      case "discard-wait":
        return buildDiscardWaitView();
      case "discard-confirm":
        return buildDiscardConfirmView(this.context);
      case "result":
        return buildResultView(this.context);
      default:
        return document.createElement("div");
    }
  },
};

/**
 * True when a wild card is the only way this gemeente can still be taken:
 * nothing has claimed it, its own challenge isn't on a board for us, and a
 * wild card that applies here is in play.
 *
 * The one case where the gemeente's own challenge folds shut. It stays at
 * the top of the sheet either way - it is the gemeente you tapped - but
 * printed open it spends half the sheet on the one challenge here that
 * can't be played, which leaves the card that can looking like a footnote
 * under it.
 */
function wildcardLeads(card) {
  if (card.is_wild_card || card.card_state === "Claimed") return false;
  if (State.isOnBoardForMe(card)) return false;
  return State.wildcardsFor(card.card_name).some((c) =>
    State.isOnBoardForMe(c),
  );
}

function buildDetailView(context) {
  const { card, error } = context;
  const wrap = document.createElement("div");
  // Whether a wild card is the only way this gemeente can still be taken.
  // Nothing moves on the sheet if so - only which of the two challenges is
  // printed open, and which is a line to unfold.
  const wildLead = wildcardLeads(card);
  wrap.className = card.is_wild_card
    ? "card-detail card-detail--wild"
    : "card-detail";

  const badge = card.is_wild_card
    ? ' <span class="modal-badge">Wild card</span>'
    : "";

  // The challenge title is the line a team is actually here to read, so it
  // takes the heading and the gemeente steps down to a kicker above it.
  // Plenty of cards have no title yet; there the gemeente keeps the
  // heading, and the rule and text panel below carry the layout instead.
  // Both stay inside the one <h2> so the heading still reads as
  // "<gemeente>, <challenge>" to a screen reader.
  const kicker = card.challenge_title
    ? `<span class="card-detail__kicker">${escapeHtml(card.card_name)}${badge}</span>`
    : "";
  const headline = card.challenge_title
    ? escapeHtml(card.challenge_title)
    : `${escapeHtml(card.card_name)}${badge}`;

  wrap.innerHTML = `
    <div class="modal-header">
      <h2 class="card-detail__title">${kicker}${headline}</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <span class="card-detail__rule" aria-hidden="true"></span>
    ${statusPillHtml(card)}
    ${wildLead ? foldedChallengeHtml(card) : challengeBodyHtml(card)}
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;

  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

  // Peeking at the board with a discard outstanding: the card is still
  // worth reading, but the server would reject a claim anyway, so every
  // claim button stays out rather than failing on tap - the wild cards
  // below included. Someone else's outstanding discard blocks us exactly
  // as hard as our own.
  const frozen = State.isFrozen();
  if (card.card_state !== "Claimed" && frozen) {
    const note = document.createElement("p");
    note.className = "modal-tag";
    note.textContent = State.canDiscard()
      ? "Discard a card first to claim anything else."
      : `Waiting for ${pendingTeamLabel()} to discard a card.`;
    wrap.appendChild(note);
  } else if (State.isOnBoardForMe(card)) {
    // Not merely "on a board": another team's private card would be theirs
    // to claim, and a button here would only be refused. In a wild-card-led
    // sheet this is what keeps the unplayable challenge buttonless.
    appendClaimBlock(wrap, context);
  }

  // A gemeente's own challenge is only one way to take it: any wild card
  // that applies here is another, and which of them are in play is the
  // thing you came to the map to find out.
  if (!card.is_wild_card) {
    const wilds = buildWildcardSection(card.card_name, {
      playable: !frozen && card.card_state !== "Claimed",
      lead: wildLead,
    });
    if (wilds) wrap.appendChild(wilds);
  }

  return wrap;
}

/**
 * Where a card stands on the board, as a pill under its title: on the
 * public board, on ours, claimed, or nowhere yet. The whole point of the
 * panel listing cards you *can't* play is that it says so about each one,
 * so this is never left off.
 *
 * "Not on the board" covers a card in the deck and one on another team's
 * private board alike - the server hands both to us as InDeck, and from
 * here they amount to the same thing: not yours to claim yet.
 */
function statusPillHtml(card, extraClass = "") {
  const classes = (modifier) =>
    `card-detail__status card-detail__status--${modifier}${extraClass ? ` ${extraClass}` : ""}`;

  if (card.card_state === "Claimed") {
    const color = CONFIG.TEAM_COLORS[card.claimed_team] || "#999";
    return `<span class="${classes("claimed")}"><span class="card-detail__status-dot" style="background:${color}"></span>Claimed by ${escapeHtml(teamName(card.claimed_team))}</span>`;
  }
  if (card.card_state === "OnPublicBoard") {
    return `<span class="${classes("board")}">On the public board</span>`;
  }
  if (
    card.card_state === "OnPrivateBoard" &&
    card.private_board_team === State.myTeamColor
  ) {
    return `<span class="${classes("board")}">On your private board</span>`;
  }
  return `<span class="${classes("off")}">Not on the board</span>`;
}

/**
 * A challenge's text and its link, as every part of the sheet shows them:
 * the gemeente at the top, open or behind its fold, and each wild card in
 * the list below.
 */
function challengeBodyHtml(card) {
  return `
    ${
      card.challenge_description
        ? `<p class="card-detail__body">${escapeHtml(card.challenge_description)}</p>`
        : `<p class="card-detail__body card-detail__body--empty">No challenge text has been added for this card yet.</p>`
    }
    ${
      card.challenge_link
        ? `<p class="modal-link"><a href="${escapeHtml(card.challenge_link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(card.challenge_link)}</a></p>`
        : ""
    }
  `;
}

/**
 * The same challenge text, folded shut - what a gemeente's own challenge
 * gets when a wild card is the only way to take it. It keeps the top of the
 * sheet, title and status pill and all, because it is still the gemeente
 * you tapped; it just stops spending half the sheet on a challenge that
 * can't be played, which is what left the wild cards below it looking like
 * a footnote.
 */
function foldedChallengeHtml(card) {
  return `
    <details class="card-detail__fold">
      <summary class="card-detail__fold-summary">
        <span>Read the challenge</span>
        <span class="wild-entry__chevron" aria-hidden="true"></span>
      </summary>
      ${challengeBodyHtml(card)}
    </details>
  `;
}

/**
 * Adds the "Challenge complete!" button for `context.card`, and for a wild
 * card the gemeente picker it needs first.
 *
 * That picker only offers the gemeentes the wild card actually applies to
 * - a Burger King card is no use where there's no Burger King, and the
 * server refuses it anyway. Opening a wild card from the deck is the one
 * route that needs it: come in from the map and the gemeente is already
 * settled by which one you tapped.
 */
function appendClaimBlock(wrap, context) {
  const { card } = context;

  let targetSelect = null;
  if (card.is_wild_card) {
    const targets = State.wildcardTargets(card.card_name);
    if (targets.length === 0) {
      const note = document.createElement("p");
      note.className = "modal-tag";
      note.textContent = State.wildcardScopeLoaded(card.card_name)
        ? "Every gemeente this wild card applies to has been claimed already."
        : "Couldn't load the gemeentes this wild card applies to. Try refreshing.";
      wrap.appendChild(note);
      return;
    }

    const field = document.createElement("div");
    field.className = "modal-field";
    const label = document.createElement("label");
    label.textContent = "Claim which gemeente with this wild card?";
    label.htmlFor = "wildcard-target";
    targetSelect = document.createElement("select");
    targetSelect.id = "wildcard-target";
    targetSelect.innerHTML =
      `<option value="">Choose a gemeente...</option>` +
      targets
        .map(
          (name) =>
            `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
        )
        .join("");
    const hint = document.createElement("p");
    hint.className = "modal-field__hint";
    hint.textContent = `Only the ${targets.length} unclaimed ${
      targets.length === 1 ? "gemeente" : "gemeentes"
    } are displayed.`;
    field.appendChild(label);
    field.appendChild(targetSelect);
    field.appendChild(hint);
    wrap.appendChild(field);
  }

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const completeBtn = document.createElement("button");
  completeBtn.type = "button";
  completeBtn.className = "btn btn--primary";
  completeBtn.textContent = "Challenge complete!";
  completeBtn.disabled = card.is_wild_card; // needs a target picked first

  if (targetSelect) {
    targetSelect.addEventListener("change", () => {
      context.targetName = targetSelect.value || null;
      completeBtn.disabled = !context.targetName;
    });
  }

  completeBtn.addEventListener("click", () => Modal.showConfirm());
  actions.appendChild(completeBtn);
  wrap.appendChild(actions);
}

/**
 * The wild cards that can be played on `gemeenteName`, listed under its
 * own challenge. Returns null when none apply, which is most gemeentes.
 *
 * Only the ones actually on a board are listed outright - those are the
 * ones you can do something about. The rest still apply here, and knowing
 * that "this is a Burger King gemeente" is worth something before the card
 * turns up, but they'd bury the two lines that matter if they sat at the
 * same level. So they go behind one fold, which most gemeentes leave
 * closed.
 *
 * `playable` is false when a claim couldn't go through anyway - the game
 * is frozen, or this gemeente is already taken - and then no entry gets a
 * button, however well placed the card is.
 *
 * `lead` is true when these wild cards are the only way left to take the
 * gemeente. The list keeps its place under the gemeente's own challenge -
 * that challenge is still what the sheet is about - but the cards in play
 * open on arrival, since with the challenge above them folded shut they are
 * the only text here worth reading.
 */
function buildWildcardSection(gemeenteName, { playable, lead = false }) {
  const wildcards = State.wildcardsFor(gemeenteName);
  if (wildcards.length === 0) return null;

  const section = document.createElement("section");
  section.className = "card-detail__wilds";
  section.innerHTML = `
    <h3 class="card-detail__wilds-title">Wild cards for ${escapeHtml(gemeenteName)}</h3>
  `;

  const inPlay = wildcards.filter((c) => State.isOnBoardForMe(c));
  const rest = wildcards.filter((c) => !State.isOnBoardForMe(c));

  for (const wildcard of inPlay) {
    section.appendChild(
      buildWildcardEntry(wildcard, gemeenteName, { playable, open: lead }),
    );
  }

  if (rest.length > 0) {
    const more = document.createElement("details");
    more.className = "wild-more";
    const one = rest.length === 1;
    // "more" only when something is listed above it to be more than.
    const count = `${rest.length}${inPlay.length > 0 ? " more" : ""}`;
    more.innerHTML = `
      <summary class="wild-more__summary">
        <span>${count} wild card${one ? "" : "s"} ${
          one ? "applies" : "apply"
        } here</span>
        <span class="wild-entry__chevron" aria-hidden="true"></span>
      </summary>
    `;
    for (const wildcard of rest) {
      more.appendChild(
        buildWildcardEntry(wildcard, gemeenteName, { playable }),
      );
    }
    section.appendChild(more);
  }

  return section;
}

/**
 * One wild card in that list: name and board status on the row, the
 * challenge text behind a <details> because these descriptions run long
 * and the list is there to be scanned first. A real element rather than a
 * hand-rolled toggle, so it keeps its keyboard handling for free.
 *
 * `open` starts it unfolded, for a wild card that is the only way left to
 * take the gemeente - with the gemeente's own challenge folded shut above,
 * this is the text the team came for, not something to dig for.
 */
function buildWildcardEntry(
  wildcard,
  gemeenteName,
  { playable, open = false },
) {
  const entry = document.createElement("details");
  entry.className = "wild-entry";
  entry.open = open;
  entry.innerHTML = `
    <summary class="wild-entry__summary">
      <span class="wild-entry__name">${escapeHtml(wildcard.card_name)}</span>
      ${statusPillHtml(wildcard, "wild-entry__status")}
      <span class="wild-entry__chevron" aria-hidden="true"></span>
    </summary>
    ${challengeBodyHtml(wildcard)}
  `;

  if (playable && State.isOnBoardForMe(wildcard)) {
    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn btn--primary";
    useBtn.textContent = "Use this wild card here";
    useBtn.addEventListener("click", () => {
      // No picker to fill in: the gemeente is the panel we're standing
      // in. `returnTo` is how Cancel gets back here rather than landing
      // on the wild card's own view, which isn't where we came from.
      Modal.context.card = wildcard;
      Modal.context.targetName = gemeenteName;
      Modal.context.returnTo = gemeenteName;
      Modal.showConfirm();
    });

    actions.appendChild(useBtn);
    entry.appendChild(actions);
  }

  return entry;
}

function buildConfirmView(context) {
  const { card, targetName, error } = context;
  const wrap = document.createElement("div");

  const question = card.is_wild_card
    ? `Use the wild card to claim <strong>${escapeHtml(targetName)}</strong>?`
    : `Mark the <strong>${escapeHtml(card.card_name)}</strong> challenge as complete?`;

  wrap.innerHTML = `
    <div class="modal-header">
      <h2>Are you sure?</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <p class="modal-description">${question}</p>
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;
  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

  // Whichever card is being played, a claim is of a gemeente - its own
  // for a regular card, the one picked for it if this is a wild card - so
  // the last screen before the claim shows which gemeente that is. A name
  // two taps deep in a list is easy to misread; a shape is the thing you
  // recognise from the map, which is what makes this worth stopping on.
  //
  // Added only once there's an outline to add, so a gemeente the index
  // doesn't know leaves the question where it was rather than above an
  // empty gap.
  const claimed = card.is_wild_card ? targetName : card.card_name;
  const url = GemeenteShapes.urlFor(claimed);
  if (url) {
    const shape = document.createElement("div");
    shape.className = "claim-shape";
    wrap.insertBefore(shape, wrap.querySelector(".modal-description"));
    traceOutline(shape, url);
  }

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () =>
    context.returnTo
      ? Modal.showGemeente(context.returnTo)
      : Modal.showCardDetail(card),
  );

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "btn btn--primary";
  confirmBtn.textContent = "Yes, confirm";
  confirmBtn.addEventListener("click", () =>
    performClaim(card, targetName, confirmBtn),
  );

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  wrap.appendChild(actions);
  return wrap;
}

async function performClaim(card, targetName, triggerBtn) {
  triggerBtn.disabled = true;
  triggerBtn.textContent = "Claiming...";
  try {
    const targetId = card.is_wild_card
      ? State.cardByName(targetName).card_id
      : null;
    const newCards = await Api.claimCard(
      State.gameId,
      State.myTeamColor,
      card.card_id,
      targetId,
    );
    await window.refreshAll();
    Modal.showResult("claim", newCards);
  } catch (err) {
    // A claim the server refuses because a discard is outstanding means
    // our board simply hadn't heard about the freeze yet - the error to
    // show for that is the wall itself, not a line of red text under a
    // confirm button that can't work.
    await window.refreshAll();
    if (State.isFrozen()) {
      showFreezeScreen();
      return;
    }
    Modal.context.error = err.message;
    Modal.showConfirm();
  }
}

function buildDiscardPickView(context) {
  const { error } = context;
  const wrap = document.createElement("div");
  wrap.className = "discard-screen";
  const publicCards = State.publicBoardCards();

  // The other teams get a say in what leaves the board, and this is the
  // screen with time to ask them - by the confirm step a thumb is already
  // on its way to "Yes, discard". Loud enough to stop that thumb: a pick
  // nobody cleared is the mistake this screen exists to prevent. Only
  // worth saying when there's actually something to pick, hence the
  // length check rather than a flat line.
  const vetoReminder =
    publicCards.length > 0
      ? `<p class="discard-screen__reminder">
           <strong>Reminder:</strong> the other teams can veto your pick.
           Check with them before you discard.
         </p>`
      : "";

  wrap.innerHTML = `
    <p class="discard-screen__eyebrow">Before you play</p>
    <h2 class="discard-screen__title">Discard a card</h2>
    ${vetoReminder}
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;

  // Shouldn't happen - a claim replenishes the board it emptied - but a
  // blocking screen with nothing to click would brick the game, so leave
  // a way to refetch rather than a dead end.
  if (publicCards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "modal-description";
    empty.textContent =
      "There are no cards on the public board right now. Refresh to look again.";
    wrap.appendChild(empty);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "btn btn--ghost";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      await window.refreshAll();
      if (Modal.view === "discard-pick") Modal.showDiscardPick();
    });
    actions.appendChild(buildPeekButton());
    actions.appendChild(refreshBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  const list = document.createElement("div");
  list.className = "discard-list";
  for (const card of publicCards) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "discard-option";
    option.textContent = card.card_name;
    option.addEventListener("click", () => {
      list
        .querySelectorAll(".discard-option")
        .forEach((el) => el.classList.remove("discard-option--selected"));
      option.classList.add("discard-option--selected");
      context.selected = card;
      discardBtn.disabled = false;
    });
    list.appendChild(option);
  }
  wrap.appendChild(list);

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const discardBtn = document.createElement("button");
  discardBtn.type = "button";
  discardBtn.className = "btn btn--danger";
  discardBtn.textContent = "Discard";
  discardBtn.disabled = true;
  discardBtn.addEventListener("click", () => Modal.showDiscardConfirm());
  actions.appendChild(buildPeekButton());
  actions.appendChild(discardBtn);
  wrap.appendChild(actions);

  return wrap;
}

/** The way out of the discard screen: the board, minus everything you can do to it. */
function buildPeekButton() {
  const peekBtn = document.createElement("button");
  peekBtn.type = "button";
  peekBtn.className = "btn btn--ghost";
  peekBtn.textContent = "View the board";
  peekBtn.addEventListener("click", () => UI.peekBoard());
  return peekBtn;
}

/**
 * The freeze screen for everyone who isn't the one discarding. It can't
 * offer the picker - the server only takes a discard from the team that
 * is discarding - so all it can do is name who's holding the game up and let
 * the board be checked again. There's no polling anywhere in this app, so
 * that check is a button: the freeze lifts on the refresh that first sees
 * the discard land.
 */
function buildDiscardWaitView() {
  const wrap = document.createElement("div");
  wrap.className = "discard-screen discard-screen--centered";
  const pending = escapeHtml(pendingTeamLabel());

  wrap.innerHTML = `
    <p class="discard-screen__eyebrow">Game frozen</p>
    <h2 class="discard-screen__title">${pending} is discarding</h2>
    <p class="modal-description">
      ${pending} completed a challenge and is discarding a card.
      The game is frozen until they picked one.
    </p>
  `;

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const checkBtn = document.createElement("button");
  checkBtn.type = "button";
  checkBtn.className = "btn btn--primary";
  checkBtn.textContent = "Check again";
  checkBtn.addEventListener("click", async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = "Checking...";
    await window.refreshAll();
    // Either the discard landed and the refresh already took this screen
    // down, or it didn't and the button has to come back to life. A
    // rebuild also picks up a different team having taken over the
    // freeze in the meantime.
    if (Modal.view === "discard-wait") Modal.showDiscardWait();
  });

  actions.appendChild(buildPeekButton());
  actions.appendChild(checkBtn);
  wrap.appendChild(actions);
  return wrap;
}

function buildDiscardConfirmView(context) {
  const { selected, error } = context;
  const wrap = document.createElement("div");
  wrap.className = "discard-screen discard-screen--centered";

  wrap.innerHTML = `
    <h2 class="discard-screen__title">Are you sure?</h2>
    <p class="modal-description">Discard <strong>${escapeHtml(selected.card_name)}</strong> and draw a new card onto the public board?</p>
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => Modal.showDiscardPick());

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "btn btn--danger";
  confirmBtn.textContent = "Yes, discard";
  confirmBtn.addEventListener("click", () =>
    performDiscard(selected, confirmBtn),
  );

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  wrap.appendChild(actions);
  return wrap;
}

async function performDiscard(card, triggerBtn) {
  triggerBtn.disabled = true;
  triggerBtn.textContent = "Discarding...";
  try {
    const newCard = await Api.discardCard(
      State.gameId,
      State.myTeamColor,
      card.card_id,
    );
    // The discard is done server-side; clear it locally too, so a refresh
    // that fails right after can't leave the blocking screen stuck up.
    const team = State.myTeam();
    if (team) team.can_discard_card = false;
    await window.refreshAll();
    Modal.showResult("discard", newCard ? [newCard] : []);
  } catch (err) {
    Modal.context.error = err.message;
    Modal.showDiscardConfirm();
  }
}

/**
 * The end of a claim or a discard. What replaced the card that left is
 * the news here, so it's dealt onto the sheet as the card it now is on
 * the public board - outline above, name below, the way the deck draws
 * one - rather than written out as a line of text.
 *
 * A hand rather than a single card, because a wild-card claim can empty
 * two board slots at once and refill both. It can also be no cards at
 * all: claiming something that was only ever on our private board takes
 * nothing off the public board, so nothing is drawn to replace it.
 */
function buildResultView(context) {
  const { kind, newCards } = context;
  const wrap = document.createElement("div");

  const heading = kind === "claim" ? "Challenge complete!" : "Card discarded";
  const drawn = newCards || [];

  wrap.innerHTML = `
    <div class="modal-header">
      <h2>${heading}</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    ${
      drawn.length > 0
        ? `<p class="draw-result__caption">Drawn onto the public board</p>`
        : `<p class="modal-description">No new cards were drawn onto the public board.</p>`
    }
  `;
  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

  if (drawn.length > 0) {
    const hand = document.createElement("div");
    hand.className = "drawn-cards";
    drawn.forEach((card, index) =>
      hand.appendChild(buildDrawnCard(card, index)),
    );
    wrap.appendChild(hand);
  }

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "btn btn--primary";
  doneBtn.textContent = "Done";
  doneBtn.addEventListener("click", () => Modal.close());
  actions.appendChild(doneBtn);
  wrap.appendChild(actions);

  return wrap;
}

/**
 * One dealt card, at the size of something meant to be looked at rather
 * than picked out of a row. `index` is only its place in the hand: it
 * staggers the reveal, so a second card lands after the first instead of
 * alongside it.
 */
function buildDrawnCard(card, index) {
  const tile = document.createElement("div");
  tile.className = `drawn-card${card.is_wild_card ? " drawn-card--wild" : ""}`;
  tile.style.setProperty("--i", String(index));

  const stage = document.createElement("div");
  stage.className = "drawn-card__stage";

  const name = document.createElement("p");
  name.className = "drawn-card__name";
  name.textContent = card.card_name;

  tile.appendChild(stage);
  tile.appendChild(name);

  // The same two sources the deck draws from: the index for a gemeente,
  // the hand-drawn star for a wild card, which isn't a place.
  const url = card.is_wild_card
    ? new URL(CONFIG.WILDCARD_SHAPE_PATH, document.baseURI).href
    : GemeenteShapes.urlFor(card.card_name);
  if (url) traceOutline(stage, url);

  return tile;
}

/**
 * Inks an outline into the box it was given: fetches the SVG, tells each
 * of its paths how long it is, and starts the trace. Both screens that
 * draw a gemeente this way - the confirm step before a claim and the
 * reveal after one - come through here; how long the trace takes and what
 * it's framed in is the caller's business, in CSS.
 *
 * Deliberately not awaited - the modal is built synchronously and is on
 * screen before this lands. The trace is timed from the moment the
 * outline arrives rather than from the render, so a cold fetch delays the
 * animation instead of half-playing it, and an outline that never arrives
 * leaves what's around it alone, exactly as the deck does.
 */
async function traceOutline(stage, url) {
  const svg = await GemeenteShapes.fetchOutline(url);
  // The modal moved on while this was in flight - another card opened, a
  // claim confirmed, a freeze coming down - so there's nothing left to ink.
  if (!svg || !stage.isConnected) return;

  svg.classList.add("traced-outline");
  // The gemeente is named in words either side of this on both screens;
  // the file's own <title> would only have a screen reader say it twice.
  svg.setAttribute("aria-hidden", "true");

  // The line the trace draws with, as a fraction of the shape's own
  // longest side rather than a flat number of user units: the generated
  // gemeentes are all fitted to a 1000-unit viewBox, but the wild card's
  // star is hand-drawn in a box a tenth of that, where the same number
  // would come out ten times as heavy.
  const box = svg.viewBox.baseVal;
  const longest = Math.max(box.width, box.height) || 1000;
  svg.style.setProperty("--outline-stroke", longest * 0.012);

  stage.appendChild(svg);

  // How long a dash has to be to cover the whole outline, which is the
  // dash the trace slides into place (see .traced-outline path).
  // Measured here rather than normalised away with the `pathLength`
  // attribute, which not every browser applies to dash arrays - and
  // measured after the append, since getTotalLength() wants the path in a
  // document. Before the next paint either way, so nothing shows
  // undashed.
  for (const path of svg.querySelectorAll("path")) {
    path.style.setProperty("--outline-length", path.getTotalLength());
  }

  svg.classList.add("traced-outline--inking");
}

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

function teamName(teamColor) {
  const team = State.teams.find((t) => t.team_color === teamColor);
  return team ? team.team_name : teamColor;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
