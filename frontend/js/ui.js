/**
 * Everything that touches the DOM outside the map itself: the cards
 * panel, score bar, the claim/discard modal, and toast messages.
 *
 * The modal is a tiny state machine (`Modal.view` + `Modal.context`) so
 * the claim flow (detail -> confirm -> result) and the discard flow
 * (pick -> confirm -> result) can share one overlay and one render
 * function instead of five separate popups.
 */
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

    document.getElementById("discard-btn").addEventListener("click", () => {
      Modal.showDiscardPick();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") Modal.close();
    });
  },

  /** Redraw the cards panel and score bar from the current State. Call after every refresh. */
  render() {
    renderCardsPanel();
    renderScoreBar();
  },

  openCardModal(name) {
    const card = State.cardByName(name);
    if (!card) {
      UI.toast("That gemeente hasn't been revealed yet.");
      return;
    }
    Modal.showCardDetail(card);
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
  document.getElementById("cards-count").textContent =
    cards.length === 1 ? "1 card" : `${cards.length} cards`;

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

  const discardBtn = document.getElementById("discard-btn");
  discardBtn.hidden = !State.canDiscard();
}

// ---------------------------------------------------------------------
// Modal: claim + discard flows
// ---------------------------------------------------------------------

const Modal = {
  view: null,
  context: {},

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
    this._render();
  },

  close() {
    this.view = null;
    this.context = {};
    document.getElementById("modal-overlay").hidden = true;
  },

  _open() {
    document.getElementById("modal-overlay").hidden = false;
    this._render();
  },

  _render() {
    const content = document.getElementById("modal-content");
    content.innerHTML = "";
    content.appendChild(this._buildView());
    const firstFocusable = content.querySelector("button, select");
    if (firstFocusable) firstFocusable.focus();
  },

  _buildView() {
    switch (this.view) {
      case "detail":
        return buildDetailView(this.context);
      case "confirm":
        return buildConfirmView(this.context);
      case "discard-pick":
        return buildDiscardPickView(this.context);
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

  const claimedTag =
    card.card_state === "Claimed"
      ? `<p class="modal-tag">Claimed by ${escapeHtml(teamName(card.claimed_team))}</p>`
      : "";

  wrap.innerHTML = `
    <div class="modal-header">
      <h2>${escapeHtml(card.card_name)}${card.is_wild_card ? ' <span class="modal-badge">Wild card</span>' : ""}</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    ${claimedTag}
    ${card.challenge_title ? `<p class="modal-challenge-title">${escapeHtml(card.challenge_title)}</p>` : ""}
    <p class="modal-description">${
      card.challenge_description
        ? escapeHtml(card.challenge_description)
        : "No challenge text has been added for this card yet."
    }</p>
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;

  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

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
    const targetId = card.is_wild_card ? gemeenteCardId(targetName) : null;
    const newCards = await Api.claimCard(
      State.gameId,
      State.myTeamColor,
      card.card_id,
      targetId,
    );
    await window.refreshAll();
    Modal.showResult("claim", newCards);
  } catch (err) {
    Modal.context.error = err.message;
    Modal.showConfirm();
  }
}

function buildDiscardPickView(context) {
  const { error } = context;
  const wrap = document.createElement("div");
  const publicCards = State.publicBoardCards();

  wrap.innerHTML = `
    <div class="modal-header">
      <h2>Discard a card</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <p class="modal-description">Pick a card from the public board to send back to the deck.</p>
    ${error ? `<p class="modal-error">${escapeHtml(error)}</p>` : ""}
  `;
  wrap
    .querySelector(".modal-close")
    .addEventListener("click", () => Modal.close());

  if (publicCards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "modal-description";
    empty.textContent = "There are no cards on the public board right now.";
    wrap.appendChild(empty);
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
  actions.appendChild(discardBtn);
  wrap.appendChild(actions);

  return wrap;
}

function buildDiscardConfirmView(context) {
  const { selected, error } = context;
  const wrap = document.createElement("div");

  wrap.innerHTML = `
    <div class="modal-header">
      <h2>Are you sure?</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <p class="modal-description">Discard <strong>${escapeHtml(selected.card_name)}</strong> and draw a new card onto the public board?</p>
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
