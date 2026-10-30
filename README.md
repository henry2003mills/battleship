# Battleship

Single-page Battleship in plain HTML, CSS and JavaScript (no build step, no dependencies). You play against a computer opponent.

## How to play

1. **Place your fleet** (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2):
   - Pick a ship, then click a cell on *Your fleet*. A green/red preview shows whether it fits.
   - Rotate with the **Rotate** button, the **R** key, or right-click.
   - Or click **Place randomly**. **Clear** removes all placed ships.
2. Press **Start game**, then click cells in *Enemy waters* to fire. You go first.
3. Misses show a dot, hits a factory icon on red, and sunk ships turn dark red. Sunk ships are announced and logged.
4. Sink all 5 enemy ships to win. **Restart** starts a new game at any time.

The computer places its ships randomly and uses a **hunt-and-target** strategy: it fires at random until it gets a hit, then tries adjacent cells (and follows the line once it has two hits in a row) until the ship sinks, then goes back to hunting.

## Project layout

- `index.html`, `styles.css`: page and styling
- `src/game.js`: game logic (board, placement, attacks, sinking, win detection, computer AI). No DOM access.
- `src/ui.js`: DOM rendering and event handling
- `tests/game.test.js`: unit tests

## Run locally

ES modules need to be served over HTTP:

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Tests

Requires Node.js 18+ (uses the built-in `node:test` runner, no install needed):

```sh
npm test
```

The tests cover ship placement (bounds, overlap, random fleet placement), hit/miss/repeat detection, sinking, win logic, and the computer's hunt-and-target behaviour.
