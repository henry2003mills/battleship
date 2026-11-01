// Edge cases and regression tests for bugs found during QA.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE, FLEET, createBoard, canPlaceShip, placeShip, placeFleetRandomly,
  receiveAttack, isSunk, allShipsSunk, createComputerPlayer,
} from '../src/game.js';

function seededRng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const destroyer = { name: 'Destroyer', length: 2 };
const patrol = { name: 'Patrol Boat', length: 2 };

describe('ship placement input validation', () => {
  test('zero-length ship is rejected', () => {
    const board = createBoard();
    assert.equal(placeShip(board, { name: 'Ghost', length: 0 }, 0, 0, true), null);
  });

  test('negative-length ship is rejected', () => {
    const board = createBoard();
    assert.equal(placeShip(board, { name: 'Ghost', length: -3 }, 0, 0, true), null);
  });

  test('a zero-length ship cannot cause an instant win', () => {
    const board = createBoard();
    placeShip(board, { name: 'Ghost', length: 0 }, 0, 0, true);
    assert.equal(allShipsSunk(board), false, 'board with no real ships reported as all sunk');
  });

  test('fractional-length ship is either rejected or sinkable', () => {
    const board = createBoard();
    const ship = placeShip(board, { name: 'Odd', length: 2.5 }, 0, 0, true);
    if (ship === null) return;
    for (const [r, c] of ship.cells) receiveAttack(board, r, c);
    assert.equal(isSunk(ship), true, `ship has ${ship.cells.length} cells but needs ${ship.length} hits; can never sink`);
  });

  test('canPlaceShip with fractional coordinates returns false instead of throwing', () => {
    const board = createBoard();
    assert.doesNotThrow(() => canPlaceShip(board, 2, 1.5, 0, true));
    assert.equal(canPlaceShip(board, 2, 1.5, 0, true), false);
  });

  test('receiveAttack with fractional coordinates returns invalid instead of throwing', () => {
    const board = createBoard();
    assert.doesNotThrow(() => receiveAttack(board, 2.5, 3));
    assert.equal(receiveAttack(board, 2.5, 3).result, 'invalid');
  });

  test('string coordinates are handled consistently by placeShip and receiveAttack', () => {
    const board = createBoard();
    const attackAccepted = receiveAttack(createBoard(), '0', '3').result !== 'invalid';
    const placed = placeShip(board, destroyer, 0, '3', true) !== null;
    assert.equal(placed, attackAccepted,
      `receiveAttack accepts string coords=${attackAccepted}, placeShip accepts them=${placed} ("3"+1 becomes "31")`);
  });

  test('the same ship cannot be placed twice', () => {
    const board = createBoard();
    placeShip(board, destroyer, 0, 0, true);
    assert.equal(placeShip(board, destroyer, 5, 5, true), null);
  });

  test('failed random placement leaves the board unchanged', () => {
    const board = createBoard(3);
    const fleet = [{ name: 'A', length: 3 }, { name: 'B', length: 3 }];
    assert.throws(() => placeFleetRandomly(board, fleet, seededRng(1)));
    assert.equal(board.ships.length, 0, 'board left with a partially placed fleet');
  });
});

describe('placement robustness', () => {
  test('standard fleet random placement never throws (20,000 seeds)', () => {
    for (let seed = 1; seed <= 20000; seed++) placeFleetRandomly(createBoard(), FLEET, seededRng(seed));
  });

  test('ships fit exactly in every corner, both orientations', () => {
    for (const [r, c, h] of [[0, 0, true], [0, 0, false], [0, 5, true], [5, 9, false], [9, 5, true], [5, 0, false]]) {
      assert.ok(canPlaceShip(createBoard(), 5, r, c, h), `${r},${c},${h}`);
    }
    assert.equal(canPlaceShip(createBoard(), 5, 0, 6, true), false);
    assert.equal(canPlaceShip(createBoard(), 5, 6, 0, false), false);
  });

  test('NaN / Infinity coordinates are invalid shots', () => {
    const board = createBoard();
    for (const [r, c] of [[NaN, 0], [0, NaN], [Infinity, 0], [0, -Infinity]]) {
      assert.equal(receiveAttack(board, r, c).result, 'invalid');
    }
  });
});

describe('hit detection and sinking', () => {
  test('corner and edge hits register', () => {
    const board = createBoard();
    placeShip(board, destroyer, 0, 0, true);
    placeShip(board, { name: 'Sub', length: 3 }, 7, 9, false);
    assert.equal(receiveAttack(board, 0, 0).result, 'hit');
    assert.equal(receiveAttack(board, 9, 9).result, 'hit');
  });

  test('hitting a sunk ship again is a repeat and does not over-count', () => {
    const board = createBoard();
    const ship = placeShip(board, destroyer, 0, 0, true);
    receiveAttack(board, 0, 0); receiveAttack(board, 0, 1);
    assert.equal(receiveAttack(board, 0, 1).result, 'repeat');
    assert.equal(ship.hits, 2);
  });

  test('touching ships sink independently', () => {
    const board = createBoard();
    const a = placeShip(board, destroyer, 0, 0, true);
    const b = placeShip(board, patrol, 1, 0, true);
    receiveAttack(board, 0, 0); receiveAttack(board, 1, 0);
    assert.equal(isSunk(a), false); assert.equal(isSunk(b), false);
    assert.equal(receiveAttack(board, 1, 1).result, 'sunk');
    assert.equal(allShipsSunk(board), false);
  });
});

describe('computer player', () => {
  test('never repeats or fires out of bounds, finishes in <=100 shots, even with touching ships (1,000 games)', () => {
    let total = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const rng = seededRng(seed);
      const board = placeFleetRandomly(createBoard(), FLEET, rng, { allowTouching: seed % 2 === 0 });
      const ai = createComputerPlayer(BOARD_SIZE, rng);
      let shots = 0;
      while (!allShipsSunk(board)) {
        const shot = ai.chooseShot();
        assert.ok(shot, `seed ${seed}: AI returned no shot before the game ended`);
        const [r, c] = shot;
        const res = receiveAttack(board, r, c);
        assert.ok(res.result !== 'repeat' && res.result !== 'invalid', `seed ${seed}: ${res.result} at ${r},${c}`);
        ai.recordResult(r, c, res.result, res.result === 'sunk' ? res.ship.cells : []);
        shots++;
      }
      assert.ok(shots <= 100);
      total += shots;
    }
    const avg = total / 1000;
    assert.ok(avg < 75, `average ${avg} shots per game; hunt-and-target should beat pure random (~96)`);
  });

  test('keeps targeting a leftover hit after sinking an adjacent ship', () => {
    const ai = createComputerPlayer(BOARD_SIZE, seededRng(2));
    ai.recordResult(4, 4, 'hit');
    ai.recordResult(4, 5, 'hit');
    ai.recordResult(5, 5, 'sunk', [[4, 5], [5, 5]]);
    assert.equal(ai.mode, 'target');
    const cand = ai.candidates().map(String).sort();
    assert.deepEqual(cand, ['3,4', '4,3', '5,4']);
  });

  test('chooseShot returns null when every cell has been fired at', () => {
    const ai = createComputerPlayer(BOARD_SIZE, seededRng(4));
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) ai.recordResult(r, c, 'miss');
    assert.equal(ai.chooseShot(), null);
  });
});
