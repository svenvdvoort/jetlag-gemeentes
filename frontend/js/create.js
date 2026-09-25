/**
 * Create page (create.html): pick a game code, set up the teams, POST it,
 * then hand off to the join page with the new game pre-selected.
 *
 * Loads only config.js + api.js, same as join.js, and builds its nodes
 * with createElement/textContent rather than innerHTML.
 */

// The backend's own rule for a game id (see GameIdPath in
// app/routers/games.py) - checked here so the button can stay disabled
// instead of letting the request come back as an unreadable 422.
const GAME_ID_PATTERN = /^[A-Za-z0-9]+$/;

// Only ever the starting name for a row. Matches the naming in the
// README's example body; a Dutch colour per team colour.
const DEFAULT_TEAM_NAMES = {
  orange: "Team Oranje",
  purple: "Team Paars",
  pink: "Team Roze",
  green: "Team Groen",
  yellow: "Team Geel",
};

// Same five the backend's TeamColor enum allows, so its length is also
// the team limit.
const TEAM_COLORS = Object.keys(CONFIG.TEAM_COLORS);

// One row per team to create. Colours have to stay unique - the backend
// rejects duplicates - so each row's dropdown only offers the colours no
// other row has taken, plus its own.
const rows = TEAM_COLORS.slice(0, 2).map(makeRow);

function makeRow(color) {
  return { color, name: DEFAULT_TEAM_NAMES[color] || "" };
}

function initCreate() {
  const codeInput = document.getElementById("create-game");

  codeInput.addEventListener("input", updateSubmitState);
  document.getElementById("create-add-team").addEventListener("click", addTeam);
  document.getElementById("create-btn").addEventListener("click", submit);

  renderRows();
  codeInput.focus();
}

// ---------------------------------------------------------------------
// Team rows
// ---------------------------------------------------------------------

/**
 * Rebuilds the whole row list. Called on add/remove/colour change only -
 * doing it per keystroke would rebuild the name input the user is typing
 * in and drop the caret, so that path updates `rows` in place instead.
 */
function renderRows() {
  document
    .getElementById("create-teams")
    .replaceChildren(...rows.map(makeRowNode));

  document.getElementById("create-add-team").disabled =
    rows.length >= TEAM_COLORS.length;
  updateSubmitState();
}

function makeRowNode(row, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "create-team";

  const dot = document.createElement("span");
  dot.className = "join-team__dot";
  dot.style.background = CONFIG.TEAM_COLORS[row.color] || "#999";

  wrapper.append(dot, makeColorSelect(row, index), makeNameInput(row, index));

  // Dropping below two teams isn't a state the backend accepts, so the
  // last two rows simply can't be removed.
  if (rows.length > 2) {
    wrapper.appendChild(makeRemoveButton(index));
  }
  return wrapper;
}

function makeColorSelect(row, index) {
  const select = document.createElement("select");
  select.className = "create-team__color";
  select.setAttribute("aria-label", `Team ${index + 1} color`);

  const taken = new Set(rows.map((other) => other.color));
  for (const color of TEAM_COLORS) {
    if (color !== row.color && taken.has(color)) continue;
    const option = document.createElement("option");
    option.value = color;
    option.textContent = color;
    select.appendChild(option);
  }

  select.value = row.color;
  select.addEventListener("change", () => changeColor(index, select.value));
  return select;
}

function makeNameInput(row, index) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "create-team__name";
  input.value = row.name;
  input.autocomplete = "off";
  input.setAttribute("aria-label", `Team ${index + 1} name`);

  input.addEventListener("input", () => {
    rows[index].name = input.value;
    updateSubmitState();
  });
  return input;
}

function makeRemoveButton(index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn--ghost btn--small create-team__remove";
  button.textContent = "×";
  // Positional rather than the team's name, which is edited without a
  // re-render and would leave this label describing the old one.
  button.setAttribute("aria-label", `Remove team ${index + 1}`);
  button.addEventListener("click", () => removeTeam(index));
  return button;
}

function addTeam() {
  const free = TEAM_COLORS.find(
    (color) => !rows.some((row) => row.color === color)
  );
  if (!free) return;

  rows.push(makeRow(free));
  renderRows();
}

function removeTeam(index) {
  if (rows.length <= 2) return;

  rows.splice(index, 1);
  renderRows();
}

/** Swaps a row's colour, carrying the name along if it was never edited. */
function changeColor(index, color) {
  const row = rows[index];
  if (row.name === DEFAULT_TEAM_NAMES[row.color]) {
    row.name = DEFAULT_TEAM_NAMES[color] || row.name;
  }
  row.color = color;
  renderRows();
}

// ---------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------

/**
 * The typed game code. Trimmed because a code arriving by paste tends to
 * bring whitespace with it, and the pattern below rejects that - leaving
 * the button dead with nothing on screen explaining why.
 */
function gameCode() {
  return document.getElementById("create-game").value.trim();
}

/** Enables the create button only once the form would actually be accepted. */
function updateSubmitState() {
  const isValid =
    GAME_ID_PATTERN.test(gameCode()) &&
    rows.length >= 2 &&
    rows.every((row) => row.name.trim() !== "");

  document.getElementById("create-btn").disabled = !isValid;
}

async function submit() {
  const button = document.getElementById("create-btn");
  const gameId = gameCode();

  button.disabled = true;
  button.textContent = "Creating...";
  hideCreateError();

  try {
    await Api.createGame(
      gameId,
      rows.map((row) => ({
        team_color: row.color,
        team_name: row.name.trim(),
      }))
    );
  } catch (err) {
    // Covers the case that matters: a code that's already taken comes
    // back as "Game 'X' already exists." from the backend.
    showCreateError(err.message);
    button.textContent = "Create game";
    updateSubmitState();
    return;
  }

  // The join page reads this back, so it opens with the game that was
  // just created already selected. Deliberately not skipping it: the
  // organiser still has to say which team they're on.
  writeRemembered(gameId, rows[0].color);
  window.location.href = "/";
}

// ---------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------

function showCreateError(message) {
  const el = document.getElementById("create-error");
  el.textContent = message;
  el.hidden = false;
}

function hideCreateError() {
  document.getElementById("create-error").hidden = true;
}

document.addEventListener("DOMContentLoaded", initCreate);
