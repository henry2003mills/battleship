import {
  BOARD_SIZE,
  FLEET,
  createBoard,
  canPlaceShip,
  placeShip,
  placeFleetRandomly,
  receiveAttack,
  allShipsSunk,
  getShipCells,
  createComputerPlayer,
} from './game.js';

const $ = (id) => document.getElementById(id);
const els = {
  status: $('status'),
  setup: $('setup-panel'),
  shipList: $('ship-list'),
  orientation: $('orientation'),
  rotate: $('rotate-btn'),
  random: $('random-btn'),
  clear: $('clear-btn'),
  start: $('start-btn'),
  restart: $('restart-btn'),
  playerBoard: $('player-board'),
  computerBoard: $('computer-board'),
  playerFleet: $('player-fleet'),
  computerFleet: $('computer-fleet'),
  log: $('log'),
  overlay: $('overlay'),
  overlayTitle: $('overlay-title'),
  overlayText: $('overlay-text'),
  overlayRestart: $('overlay-restart'),
};

const COMPUTER_DELAY_MS = 600;
const SHIP_COLORS = {
  Carrier: '#a7b1bd',
  Battleship: '#c9ad74',
  Cruiser: '#86b894',
  Submarine: '#b493c2',
  Destroyer: '#7fbcd6',
};
const JOIN_DIRS = [
  ['up', -1, 0, '0 -2px'],
  ['down', 1, 0, '0 2px'],
  ['left', 0, -1, '-2px 0'],
  ['right', 0, 1, '2px 0'],
];
const COLS = 'ABCDEFGHIJ';
const coord = (r, c) => `${COLS[c]}${r + 1}`;

let state;

function newGame() {
  state = {
    phase: 'setup', // setup | player | computer | over
    horizontal: true,
    selected: 0,
    player: createBoard(),
    computer: placeFleetRandomly(createBoard()),
    ai: createComputerPlayer(),
    hover: null,
    lastShot: { player: null, computer: null },
  };
  els.log.innerHTML = '';
  els.overlay.classList.add('hidden');
  els.setup.classList.remove('hidden');
  renderAll();
}

function placedNames() {
  return new Set(state.player.ships.map((s) => s.name));
}

function nextUnplaced() {
  const placed = placedNames();
  const idx = FLEET.findIndex((s) => !placed.has(s.name));
  return idx === -1 ? null : idx;
}

function buildGrid(container, onCell) {
  container.innerHTML = '';
  container.appendChild(document.createElement('div'));
  for (let c = 0; c < BOARD_SIZE; c++) {
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = COLS[c];
    container.appendChild(l);
  }
  for (let r = 0; r < BOARD_SIZE; r++) {
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = r + 1;
    container.appendChild(l);
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('aria-label', coord(r, c));
      onCell?.(cell, r, c);
      container.appendChild(cell);
    }
  }
}

function cellEl(container, r, c) {
  return container.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function paintBoard(container, board, { revealShips, last }) {
  const visibleShip = (r, c) => {
    const index = board.cells[r]?.[c]?.shipIndex;
    if (index === null || index === undefined) return null;
    const ship = board.ships[index];
    return revealShips || ship.hits >= ship.length ? index : null;
  };
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const el = cellEl(container, r, c);
      const { shipIndex, shot } = board.cells[r][c];
      const ship = shipIndex === null ? null : board.ships[shipIndex];
      const sunk = ship && ship.hits >= ship.length;
      const shown = visibleShip(r, c);
      el.className = 'cell';
      el.style.removeProperty('--ship-color');
      el.style.boxShadow = '';
      if (shown !== null) {
        el.classList.add('ship');
        el.style.setProperty('--ship-color', SHIP_COLORS[ship.name]);
        const shadows = [];
        for (const [name, dr, dc, offset] of JOIN_DIRS) {
          if (visibleShip(r + dr, c + dc) === shown) {
            el.classList.add(`join-${name}`);
            shadows.push(`${offset} 0 var(--fill)`);
          }
        }
        el.style.boxShadow = shadows.join(', ');
      }
      if (shot) el.classList.add(ship ? (sunk ? 'sunk' : 'hit') : 'miss');
      else el.classList.add('targetable');
      if (last && last[0] === r && last[1] === c) el.classList.add('last-shot');
    }
  }
}

function paintPreview() {
  if (state.phase !== 'setup' || !state.hover || state.selected === null) return;
  const { length } = FLEET[state.selected];
  const [row, col] = state.hover;
  const ok = canPlaceShip(state.player, length, row, col, state.horizontal);
  for (const [r, c] of getShipCells(length, row, col, state.horizontal)) {
    const el = r < BOARD_SIZE && c < BOARD_SIZE ? cellEl(els.playerBoard, r, c) : null;
    el?.classList.add(ok ? 'preview-ok' : 'preview-bad');
  }
}

function renderFleetStatus(listEl, board, showAll) {
  listEl.innerHTML = '';
  for (const spec of FLEET) {
    const ship = board.ships.find((s) => s.name === spec.name);
    const li = document.createElement('li');
    const sunk = ship && ship.hits >= ship.length;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = SHIP_COLORS[spec.name];
    li.append(swatch, `${spec.name} (${spec.length})${sunk ? ' - sunk' : ''}`);
    if (sunk) li.classList.add('sunk');
    if (showAll || ship) listEl.appendChild(li);
  }
}

function renderSetup() {
  els.shipList.innerHTML = '';
  const placed = placedNames();
  FLEET.forEach((spec, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ship-choice';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = SHIP_COLORS[spec.name];
    b.append(swatch, `${spec.name} (${spec.length})`);
    if (placed.has(spec.name)) {
      b.classList.add('placed');
      b.disabled = true;
    }
    if (i === state.selected) b.classList.add('selected');
    b.addEventListener('click', () => {
      state.selected = i;
      renderAll();
    });
    els.shipList.appendChild(b);
  });
  els.orientation.textContent = state.horizontal ? 'Horizontal' : 'Vertical';
  els.start.disabled = state.player.ships.length !== FLEET.length;
}

function renderStatus() {
  const msg = {
    setup:
      state.selected !== null
        ? `Place your ${FLEET[state.selected].name} (${FLEET[state.selected].length}). Click a cell on your board.`
        : 'Fleet ready. Press "Start game".',
    player: 'Your turn: fire at the enemy waters.',
    computer: 'Computer is aiming...',
    over: state.winner === 'player' ? 'You win!' : 'You lose.',
  }[state.phase];
  els.status.textContent = msg;
}

function renderAll() {
  paintBoard(els.playerBoard, state.player, { revealShips: true, last: state.lastShot.computer });
  paintBoard(els.computerBoard, state.computer, {
    revealShips: state.phase === 'over',
    last: state.lastShot.player,
  });
  paintPreview();
  els.computerBoard.classList.toggle('active', state.phase === 'player');
  els.setup.classList.toggle('hidden', state.phase !== 'setup');
  renderSetup();
  renderFleetStatus(els.playerFleet, state.player, state.phase !== 'setup');
  renderFleetStatus(els.computerFleet, state.computer, true);
  renderStatus();
}

function log(text, cls) {
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  els.log.prepend(li);
}

function describe(shooter, r, c, res) {
  if (res.result === 'miss') return `${shooter} fired at ${coord(r, c)}: miss.`;
  if (res.result === 'hit') return `${shooter} fired at ${coord(r, c)}: hit!`;
  const whose = shooter === 'You' ? "the enemy's" : 'your';
  return `${shooter} fired at ${coord(r, c)}: sunk ${whose} ${res.ship.name}!`;
}

function endGame(winner) {
  state.phase = 'over';
  state.winner = winner;
  renderAll();
  els.overlayTitle.textContent = winner === 'player' ? 'Victory!' : 'Defeat';
  els.overlayText.textContent =
    winner === 'player'
      ? 'You sank the entire enemy fleet.'
      : 'The computer sank your entire fleet.';
  els.overlay.classList.remove('hidden');
}

function playerFire(r, c) {
  if (state.phase !== 'player') return;
  const res = receiveAttack(state.computer, r, c);
  if (res.result === 'repeat' || res.result === 'invalid') return;
  state.lastShot.player = [r, c];
  log(describe('You', r, c, res), res.result === 'sunk' ? 'sunk' : '');
  if (res.result === 'sunk') announce(`You sank the enemy's ${res.ship.name}!`);
  if (allShipsSunk(state.computer)) return endGame('player');
  state.phase = 'computer';
  renderAll();
  if (res.result === 'sunk') els.status.textContent = `You sank the enemy's ${res.ship.name}! Computer is aiming...`;
  setTimeout(computerTurn, COMPUTER_DELAY_MS);
}

function computerTurn() {
  if (state.phase !== 'computer') return;
  const [r, c] = state.ai.chooseShot();
  const res = receiveAttack(state.player, r, c);
  state.ai.recordResult(r, c, res.result, res.result === 'sunk' ? res.ship.cells : []);
  state.lastShot.computer = [r, c];
  log(describe('Computer', r, c, res), res.result === 'sunk' ? 'sunk' : '');
  if (allShipsSunk(state.player)) return endGame('computer');
  state.phase = 'player';
  renderAll();
  if (res.result === 'sunk') announce(`The computer sank your ${res.ship.name}! Your turn.`);
}

function announce(text) {
  els.status.textContent = text;
}

function rotate() {
  if (state.phase !== 'setup') return;
  state.horizontal = !state.horizontal;
  renderAll();
}

buildGrid(els.playerBoard, (cell, r, c) => {
  cell.addEventListener('mouseenter', () => {
    state.hover = [r, c];
    if (state.phase === 'setup') renderAll();
  });
  cell.addEventListener('click', () => {
    if (state.phase !== 'setup' || state.selected === null) return;
    if (placeShip(state.player, FLEET[state.selected], r, c, state.horizontal)) {
      state.selected = nextUnplaced();
      renderAll();
    }
  });
  cell.addEventListener('contextmenu', (e) => {
    if (state.phase !== 'setup') return;
    e.preventDefault();
    rotate();
  });
});
els.playerBoard.addEventListener('mouseleave', () => {
  state.hover = null;
  if (state.phase === 'setup') renderAll();
});

buildGrid(els.computerBoard, (cell, r, c) => {
  cell.addEventListener('click', () => playerFire(r, c));
});

els.rotate.addEventListener('click', rotate);
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') rotate();
});
els.random.addEventListener('click', () => {
  state.player = placeFleetRandomly(createBoard());
  state.selected = null;
  renderAll();
});
els.clear.addEventListener('click', () => {
  state.player = createBoard();
  state.selected = 0;
  renderAll();
});
els.start.addEventListener('click', () => {
  if (state.player.ships.length !== FLEET.length) return;
  state.phase = 'player';
  log('Battle started. You fire first.');
  renderAll();
});
els.restart.addEventListener('click', newGame);
els.overlayRestart.addEventListener('click', newGame);

newGame();
