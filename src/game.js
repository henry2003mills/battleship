export const BOARD_SIZE = 10;

export const FLEET = Object.freeze([
  { name: 'Liparus', length: 5 },
  { name: 'Disco Volante', length: 4 },
  { name: 'Q-Boat', length: 3 },
  { name: 'Wet Nellie', length: 3 },
  { name: 'Glastron', length: 2 },
]);

export function createBoard(size = BOARD_SIZE) {
  return {
    size,
    ships: [],
    cells: Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ shipIndex: null, shot: false }))
    ),
  };
}

export function inBounds(board, row, col) {
  return (
    Number.isInteger(row) && Number.isInteger(col) &&
    row >= 0 && col >= 0 && row < board.size && col < board.size
  );
}

export function getShipCells(length, row, col, horizontal) {
  return Array.from({ length }, (_, i) =>
    horizontal ? [row, col + i] : [row + i, col]
  );
}

export function isValidLength(length) {
  return Number.isInteger(length) && length > 0;
}

export function canPlaceShip(board, length, row, col, horizontal) {
  if (!isValidLength(length)) return false;
  return getShipCells(length, row, col, horizontal).every(
    ([r, c]) => inBounds(board, r, c) && board.cells[r][c].shipIndex === null
  );
}

export function placeShip(board, { name, length }, row, col, horizontal) {
  if (!canPlaceShip(board, length, row, col, horizontal)) return null;
  if (board.ships.some((s) => s.name === name)) return null;
  const ship = {
    name,
    length,
    cells: getShipCells(length, row, col, horizontal),
    hits: 0,
  };
  const index = board.ships.push(ship) - 1;
  for (const [r, c] of ship.cells) board.cells[r][c].shipIndex = index;
  return ship;
}

export function touchesOtherShip(board, length, row, col, horizontal) {
  return getShipCells(length, row, col, horizontal).some(([r, c]) => {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (inBounds(board, r + dr, c + dc) && board.cells[r + dr][c + dc].shipIndex !== null)
          return true;
    return false;
  });
}

/**
 * Places the fleet at random. By default ships never touch (not even diagonally),
 * so every ship is visually distinct; pass { allowTouching: true } to relax this.
 */
export function placeFleetRandomly(
  board,
  fleet = FLEET,
  rng = Math.random,
  { allowTouching = false } = {}
) {
  const placedBefore = board.ships.length;
  const rollBack = () => {
    for (const ship of board.ships.splice(placedBefore))
      for (const [r, c] of ship.cells) board.cells[r][c].shipIndex = null;
  };
  for (const spec of fleet) {
    for (let attempt = 0; ; attempt++) {
      if (attempt > 10000) {
        rollBack();
        throw new Error(`Could not place ${spec.name}`);
      }
      const horizontal = rng() < 0.5;
      const row = Math.floor(rng() * board.size);
      const col = Math.floor(rng() * board.size);
      if (!allowTouching && touchesOtherShip(board, spec.length, row, col, horizontal)) continue;
      if (placeShip(board, spec, row, col, horizontal)) break;
    }
  }
  return board;
}

export function isSunk(ship) {
  return ship.hits >= ship.length;
}

export function allShipsSunk(board) {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/**
 * Fire at a cell. Returns { result: 'miss' | 'hit' | 'sunk' | 'repeat' | 'invalid', ship? }.
 */
export function receiveAttack(board, row, col) {
  if (!inBounds(board, row, col)) return { result: 'invalid' };
  const cell = board.cells[row][col];
  if (cell.shot) return { result: 'repeat' };
  cell.shot = true;
  if (cell.shipIndex === null) return { result: 'miss' };
  const ship = board.ships[cell.shipIndex];
  ship.hits += 1;
  return { result: isSunk(ship) ? 'sunk' : 'hit', ship };
}

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Hunt-and-target computer opponent. It only learns what a real player would:
 * miss / hit / sunk (with the sunk ship's cells revealed).
 */
export function createComputerPlayer(size = BOARD_SIZE, rng = Math.random) {
  // 'unknown' | 'miss' | 'hit' (unresolved) | 'sunk'
  const knowledge = Array.from({ length: size }, () => Array(size).fill('unknown'));
  const isUnknown = (r, c) =>
    r >= 0 && c >= 0 && r < size && c < size && knowledge[r][c] === 'unknown';
  const pick = (list) => list[Math.floor(rng() * list.length)];

  function openHits() {
    const hits = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) if (knowledge[r][c] === 'hit') hits.push([r, c]);
    return hits;
  }

  function targetCandidates() {
    const hits = openHits();
    if (hits.length === 0) return [];
    const isHit = (r, c) =>
      r >= 0 && c >= 0 && r < size && c < size && knowledge[r][c] === 'hit';

    // Prefer extending a line of two or more adjacent hits.
    const lineEnds = new Map();
    for (const [r, c] of hits) {
      for (const [dr, dc] of DIRECTIONS) {
        if (!isHit(r + dr, c + dc)) continue;
        let er = r + dr, ec = c + dc;
        while (isHit(er, ec)) { er += dr; ec += dc; }
        if (isUnknown(er, ec)) lineEnds.set(`${er},${ec}`, [er, ec]);
      }
    }
    if (lineEnds.size) return [...lineEnds.values()];

    const adjacent = new Map();
    for (const [r, c] of hits)
      for (const [dr, dc] of DIRECTIONS)
        if (isUnknown(r + dr, c + dc)) adjacent.set(`${r + dr},${c + dc}`, [r + dr, c + dc]);
    return [...adjacent.values()];
  }

  return {
    get mode() {
      return openHits().length ? 'target' : 'hunt';
    },
    knowledge,
    candidates: targetCandidates,
    chooseShot() {
      const targets = targetCandidates();
      if (targets.length) return pick(targets);
      const unknown = [];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++) if (knowledge[r][c] === 'unknown') unknown.push([r, c]);
      return unknown.length ? pick(unknown) : null;
    },
    recordResult(row, col, result, sunkCells = []) {
      if (result === 'miss') knowledge[row][col] = 'miss';
      else if (result === 'hit') knowledge[row][col] = 'hit';
      else if (result === 'sunk') {
        knowledge[row][col] = 'hit';
        for (const [r, c] of sunkCells) knowledge[r][c] = 'sunk';
      }
    },
  };
}
