import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  FLEET,
  createBoard,
  canPlaceShip,
  placeShip,
  placeFleetRandomly,
  touchesOtherShip,
  receiveAttack,
  isSunk,
  allShipsSunk,
  createComputerPlayer,
} from '../src/game.js';

function seededRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const destroyer = { name: 'Destroyer', length: 2 };
const cruiser = { name: 'Cruiser', length: 3 };

describe('placement', () => {
  test('places a horizontal ship on the expected cells', () => {
    const board = createBoard();
    const ship = placeShip(board, cruiser, 2, 3, true);
    assert.deepEqual(ship.cells, [[2, 3], [2, 4], [2, 5]]);
    for (const [r, c] of ship.cells) assert.equal(board.cells[r][c].shipIndex, 0);
  });

  test('places a vertical ship on the expected cells', () => {
    const board = createBoard();
    const ship = placeShip(board, cruiser, 2, 3, false);
    assert.deepEqual(ship.cells, [[2, 3], [3, 3], [4, 3]]);
  });

  test('rejects ships that go out of bounds', () => {
    const board = createBoard();
    assert.equal(canPlaceShip(board, 5, 0, 6, true), false);
    assert.equal(canPlaceShip(board, 5, 6, 0, false), false);
    assert.equal(canPlaceShip(board, 2, -1, 0, true), false);
    assert.equal(placeShip(board, { name: 'Carrier', length: 5 }, 9, 9, true), null);
    assert.equal(board.ships.length, 0);
  });

  test('allows ships that end exactly on the edge', () => {
    const board = createBoard();
    assert.ok(placeShip(board, { name: 'Carrier', length: 5 }, 0, 5, true));
    assert.ok(placeShip(board, { name: 'Battleship', length: 4 }, 6, 9, false));
  });

  test('rejects overlapping ships', () => {
    const board = createBoard();
    placeShip(board, cruiser, 4, 4, true);
    assert.equal(canPlaceShip(board, 3, 3, 5, false), false);
    assert.equal(placeShip(board, destroyer, 4, 6, true), null);
    assert.equal(board.ships.length, 1);
  });

  test('random placement places the full fleet without overlap, in bounds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const board = placeFleetRandomly(createBoard(), FLEET, seededRng(seed));
      assert.equal(board.ships.length, FLEET.length);
      const seen = new Set();
      for (const ship of board.ships) {
        for (const [r, c] of ship.cells) {
          assert.ok(r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE);
          const key = `${r},${c}`;
          assert.ok(!seen.has(key), `overlap at ${key}`);
          seen.add(key);
        }
      }
      assert.equal(seen.size, 17);
    }
  });

  test('random placement never lets ships touch, even diagonally', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const board = placeFleetRandomly(createBoard(), FLEET, seededRng(seed));
      board.ships.forEach((ship, i) => {
        for (const [r, c] of ship.cells)
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              const n = board.cells[r + dr]?.[c + dc];
              if (n && n.shipIndex !== null) assert.equal(n.shipIndex, i, `seed ${seed}: ships touch`);
            }
      });
    }
  });

  test('touchesOtherShip detects side and diagonal contact', () => {
    const board = createBoard();
    placeShip(board, cruiser, 4, 4, true); // (4,4)-(4,6)
    assert.equal(touchesOtherShip(board, 2, 5, 4, true), true); // directly below
    assert.equal(touchesOtherShip(board, 2, 3, 7, true), true); // diagonal
    assert.equal(touchesOtherShip(board, 2, 6, 4, true), false); // one row gap
  });
});

describe('hit detection', () => {
  test('reports a miss on empty water', () => {
    const board = createBoard();
    placeShip(board, destroyer, 0, 0, true);
    assert.equal(receiveAttack(board, 5, 5).result, 'miss');
    assert.equal(board.cells[5][5].shot, true);
  });

  test('reports a hit on a ship and counts it', () => {
    const board = createBoard();
    const ship = placeShip(board, cruiser, 0, 0, true);
    const res = receiveAttack(board, 0, 1);
    assert.equal(res.result, 'hit');
    assert.equal(res.ship, ship);
    assert.equal(ship.hits, 1);
  });

  test('repeat shots are rejected and do not double count', () => {
    const board = createBoard();
    const ship = placeShip(board, cruiser, 0, 0, true);
    receiveAttack(board, 0, 0);
    assert.equal(receiveAttack(board, 0, 0).result, 'repeat');
    assert.equal(ship.hits, 1);
    receiveAttack(board, 9, 9);
    assert.equal(receiveAttack(board, 9, 9).result, 'repeat');
  });

  test('out of bounds shots are invalid', () => {
    const board = createBoard();
    assert.equal(receiveAttack(board, 10, 0).result, 'invalid');
    assert.equal(receiveAttack(board, 0, -1).result, 'invalid');
  });
});

describe('sinking', () => {
  test('a ship sinks only once every cell is hit', () => {
    const board = createBoard();
    const ship = placeShip(board, cruiser, 3, 3, false);
    assert.equal(receiveAttack(board, 3, 3).result, 'hit');
    assert.equal(receiveAttack(board, 4, 3).result, 'hit');
    assert.equal(isSunk(ship), false);
    const res = receiveAttack(board, 5, 3);
    assert.equal(res.result, 'sunk');
    assert.equal(res.ship.name, 'Cruiser');
    assert.equal(isSunk(ship), true);
  });

  test('sinking one ship does not affect another', () => {
    const board = createBoard();
    const a = placeShip(board, destroyer, 0, 0, true);
    const b = placeShip(board, destroyer, 1, 0, true);
    receiveAttack(board, 0, 0);
    receiveAttack(board, 0, 1);
    assert.equal(isSunk(a), true);
    assert.equal(isSunk(b), false);
  });
});

describe('win logic', () => {
  test('empty board is not a win', () => {
    assert.equal(allShipsSunk(createBoard()), false);
  });

  test('not won while any ship is afloat', () => {
    const board = createBoard();
    placeShip(board, destroyer, 0, 0, true);
    placeShip(board, destroyer, 2, 0, true);
    receiveAttack(board, 0, 0);
    receiveAttack(board, 0, 1);
    receiveAttack(board, 2, 0);
    assert.equal(allShipsSunk(board), false);
    receiveAttack(board, 2, 1);
    assert.equal(allShipsSunk(board), true);
  });

  test('sinking the whole standard fleet wins after exactly 17 hits', () => {
    const board = placeFleetRandomly(createBoard(), FLEET, seededRng(7));
    let hits = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const { result } = receiveAttack(board, r, c);
        if (result === 'hit' || result === 'sunk') hits++;
      }
    }
    assert.equal(hits, 17);
    assert.equal(allShipsSunk(board), true);
  });
});

describe('computer player (hunt and target)', () => {
  test('hunts randomly and never repeats a shot', () => {
    const ai = createComputerPlayer(BOARD_SIZE, seededRng(3));
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const [r, c] = ai.chooseShot();
      const key = `${r},${c}`;
      assert.ok(!seen.has(key));
      seen.add(key);
      ai.recordResult(r, c, 'miss');
    }
    assert.equal(ai.chooseShot(), null);
  });

  test('after a hit it targets adjacent cells', () => {
    const ai = createComputerPlayer(BOARD_SIZE, seededRng(5));
    ai.recordResult(4, 4, 'hit');
    assert.equal(ai.mode, 'target');
    const expected = new Set(['3,4', '5,4', '4,3', '4,5']);
    for (let i = 0; i < 20; i++) {
      const [r, c] = ai.chooseShot();
      assert.ok(expected.has(`${r},${c}`));
    }
  });

  test('after two aligned hits it extends along the line', () => {
    const ai = createComputerPlayer(BOARD_SIZE, seededRng(5));
    ai.recordResult(4, 4, 'hit');
    ai.recordResult(4, 5, 'hit');
    const candidates = ai.candidates().map(([r, c]) => `${r},${c}`).sort();
    assert.deepEqual(candidates, ['4,3', '4,6']);
  });

  test('returns to hunting once the targeted ship is sunk', () => {
    const ai = createComputerPlayer(BOARD_SIZE, seededRng(5));
    ai.recordResult(0, 0, 'hit');
    ai.recordResult(0, 1, 'sunk', [[0, 0], [0, 1]]);
    assert.equal(ai.mode, 'hunt');
  });

  test('sinks a whole fleet in a full game within 100 shots', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seededRng(seed);
      const board = placeFleetRandomly(createBoard(), FLEET, rng);
      const ai = createComputerPlayer(BOARD_SIZE, rng);
      let shots = 0;
      while (!allShipsSunk(board)) {
        const [r, c] = ai.chooseShot();
        const res = receiveAttack(board, r, c);
        assert.notEqual(res.result, 'repeat');
        ai.recordResult(r, c, res.result, res.result === 'sunk' ? res.ship.cells : []);
        shots++;
      }
      assert.ok(shots <= 100);
    }
  });
});
