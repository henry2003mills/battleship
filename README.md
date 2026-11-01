# Battleship

Single-page Battleship in plain HTML, CSS and JavaScript (no build step, no dependencies). You play against a computer opponent.

## How to play

1. **Place your fleet** from James Bond films: Liparus 5 (The Spy Who Loved Me), Disco Volante 4 (Thunderball), Q-Boat 3 (The World Is Not Enough), Wet Nellie 3 (The Spy Who Loved Me), Glastron 2 (Live and Let Die):
   - Pick a ship, then click a cell on *Your fleet*. A preview in the ship's color shows where it goes (red if it doesn't fit). Ships may touch when placed by hand.
   - Rotate with the **Rotate** button, the **R** key, or right-click.
   - Or click **Place randomly** (random placement never lets ships touch). **Clear** removes all placed ships.
   - Each ship has its own color, shown in the legend under each board.
2. Press **Start game**, then click cells in *Enemy waters* to fire. You go first.
3. Misses show a dot, hits on the enemy board a 🏭 factory emoji on red (an X on your board), and sunk ships turn dark red. Sunk ships are announced and logged.
4. Sink all 5 enemy ships to win. **Restart** starts a new game at any time.

The computer places its ships randomly and uses a **hunt-and-target** strategy: it fires at random until it gets a hit, then tries adjacent cells (and follows the line once it has two hits in a row) until the ship sinks, then goes back to hunting.

## Project layout

- `index.html`, `styles.css`, `assets/`: page, styling and gun-barrel backdrop
- `sw.js`: service worker that always fetches the newest version, so updates show up without waiting on the browser cache
- `src/game.js`: game logic (board, placement, attacks, sinking, win detection, computer AI). No DOM access.
- `src/ui.js`: DOM rendering and event handling
- `tests/game.test.js`, `tests/edge-cases.test.js`: unit tests

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

The tests cover ship placement (bounds, overlap, random fleet placement), hit/miss/repeat detection, sinking, win logic, the computer's hunt-and-target behaviour, and invalid input (bad lengths/coordinates, duplicate ships).
