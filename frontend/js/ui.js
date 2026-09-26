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
    const card = State.cardByName(name);
    if (!card) {
      UI.toast("That gemeente hasn't been revealed yet.");
      return;
    }
    Modal.showCardDetail(card);
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
    button.innerHTML = `
      <span class="playing-card__name">${escapeHtml(card.card_name)}</span>
    `;
    button.addEventListener("click", () => Modal.showCardDetail(card));
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
    this.context = { card, targetName: null, error: null };
    this._open();
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

function buildDetailView(context) {
  const { card, error } = context;
  const wrap = document.createElement("div");
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

  const claimedTag =
    card.card_state === "Claimed"
      ? `<p class="card-detail__claimed"><span class="card-detail__claimed-dot" style="background:${
          CONFIG.TEAM_COLORS[card.claimed_team] || "#999"
        }"></span>Claimed by ${escapeHtml(teamName(card.claimed_team))}</p>`
      : "";

  wrap.innerHTML = `
    <div class="modal-header">
      <h2 class="card-detail__title">${kicker}${headline}</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <span class="card-detail__rule" aria-hidden="true"></span>
    ${claimedTag}
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
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;

  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

  // Peeking at the board with a discard outstanding: the card is still
  // worth reading, but the server would reject a claim anyway, so the
  // whole claim block stays out rather than failing on tap. Someone
  // else's outstanding discard blocks us exactly as hard as our own.
  if (card.card_state !== "Claimed" && State.isFrozen()) {
    const note = document.createElement("p");
    note.className = "modal-tag";
    note.textContent = State.canDiscard()
      ? "Discard a card first to claim anything else."
      : `Waiting for ${pendingTeamLabel()} to discard a card.`;
    wrap.appendChild(note);
    return wrap;
  }

  if (card.card_state !== "Claimed") {
    const actions = document.createElement("div");
    actions.className = "modal-actions";

    let targetSelect = null;
    if (card.is_wild_card) {
      const field = document.createElement("div");
      field.className = "modal-field";
      const label = document.createElement("label");
      label.textContent = "Claim which gemeente with this wild card?";
      label.htmlFor = "wildcard-target";
      targetSelect = document.createElement("select");
      targetSelect.id = "wildcard-target";
      targetSelect.innerHTML =
        `<option value="">Choose a gemeente...</option>` +
        State.unclaimedGemeentes()
          .map(
            (name) =>
              `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
          )
          .join("");
      field.appendChild(label);
      field.appendChild(targetSelect);
      wrap.appendChild(field);
    }

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

  return wrap;
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

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn--ghost";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => Modal.showCardDetail(card));

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
    const targetId = card.is_wild_card ? State.cardByName(targetName).card_id : null;
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

function buildResultView(context) {
  const { kind, newCards } = context;
  const wrap = document.createElement("div");

  const heading = kind === "claim" ? "Challenge complete!" : "Card discarded";
  const cardsHtml =
    newCards && newCards.length > 0
      ? `<p class="modal-description">New card${newCards.length > 1 ? "s" : ""} added to the public board:</p>
         <ul class="modal-list">${newCards.map((c) => `<li>${escapeHtml(c.card_name)}</li>`).join("")}</ul>`
      : `<p class="modal-description">No new cards were drawn onto the public board.</p>`;

  wrap.innerHTML = `
    <div class="modal-header">
      <h2>${heading}</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    ${cardsHtml}
  `;
  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

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
