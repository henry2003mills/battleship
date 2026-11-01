# Battleship – Bug List

Game: https://henry2003mills.github.io/battleship/ · Repo: https://github.com/henry2003mills/battleship

**27 bugs in total: 11 flagged by Henry (listed first) and 16 found in QA testing. 24 are fixed, 1 needs a check on a real iPhone, and 2 are not code bugs (a cached page, and a rule difference kept on purpose).**

Fixes were checked with 40 unit tests, 11 scripted browser checks, iPhone/iPad emulation and a full game on the live site. Ship names below use the current Bond fleet (Liparus was the Carrier, Disco Volante the Battleship, Q-Boat the Cruiser, Wet Nellie the Submarine, Glastron the Destroyer).

## Bugs flagged by Henry

| ID | Bug | What happened | Cause | Status and fix |
|---|---|---|---|---|
| F-1 | Ships looked incomplete: not enough squares for the Battleship and Destroyer | With random placement, the Carrier and Cruiser/Submarine were visible, but the Battleship and Destroyer seemed to be missing squares. | All ships were the same gray. Random placement put the Battleship and Destroyer end to end, so they looked like one 6-square ship, and another ship was touching the Carrier. | **Fixed**: Each ship has its own color and is drawn as one joined piece, with a color legend. Random placement keeps ships apart. |
| F-2 | My ships aren't color-coded (Devin preview) | After the color update, ships on your board still looked gray in the preview window. | The preview window kept old cached copies of the style and script files. | **Fixed**: The preview server sends no-cache headers. |
| F-3 | Factory emoji and ship colors not showing on the live site | After an update, the live link still showed the red X and gray ships. | GitHub Pages lets browsers reuse files for up to 10 minutes, and the file names never changed. | **Fixed**: Style and script links carry a version number that changes with each update, and a service worker always fetches the newest page. |
| F-4 | Changes not showing when playing through the Devin window | The game in the Devin preview window stayed on an old version. | That preview had cached the old files before caching was turned off. | **Fixed**: Opened a new "Battleship (latest)" preview at a fresh address. |
| F-5 | Phone: the tapped square turns faded blue | On iPhone, the last square you tapped showed faded blue instead of the ship color, so the Destroyer looked like 1 square. | Board squares are buttons, and the general button hover color painted over the ship color. Phones keep "hover" on the last tapped square. | **Fixed**: The hover color no longer applies to board squares. Checked in iPhone emulation. |
| F-6 | Phone: the Carrier showed 3 squares plus 1 grey square | After placing the Carrier vertically on iPhone, 3 of its squares turned red and one stayed grey. | The next ship's placement preview stayed drawn on top of the ship you had just placed, shown red as "can't place here". | **Fixed**: The preview now follows only a real mouse and clears after each placement. Checked in iPhone emulation. |
| F-7 | Phone: hard to tap Rotate | Tapping Rotate on iPhone often didn't switch between horizontal and vertical. | Not reproduced in emulation. Likely Safari's double-tap-to-zoom delay swallowing taps. | **Needs iPhone check**: Buttons now turn off double-tap zoom, so taps register immediately. Needs a test on a real iPhone. |
| F-8 | Placement preview is faded blue, not the ship's color | While choosing where to place a ship, the preview squares were a generic faded color. | The preview always used one fixed color. | **Fixed**: The preview shows in the color of the ship being placed. |
| F-9 | Fleet key not showing on the game link | After the Bond update, the key wasn't visible on the live link. | The browser showed its cached copy of the old page. The live page did have the key. | **Not a code bug**: The page was cached for up to 10 minutes. The service worker fix for P-2 now stops this for returning players. |
| F-10 | Pressing Rotate changes the screen layout | Switching to Vertical shifted the controls and boards on the page. | The button text changes between "Horizontal" and "Vertical", which changed the button's width. On wide screens the controls then fit on one line instead of two, moving everything below. | **Fixed**: The Rotate button has a fixed width. Checked at desktop, tablet and phone sizes. |
| F-11 | Game says a ship can't be placed next to another ship | Placing the Liparus directly above the Disco Volante showed red "can't place here", although standard rules allow touching ships. | The P-8 fix made hand placement keep ships apart to match random placement. | **Fixed**: Hand placement allows touching ships again. "Place randomly" still spreads ships out. |

## Bugs found in QA testing

### Bugs a player can hit

| ID | Bug | What happened | Cause | Status and fix |
|---|---|---|---|---|
| P-1 | Hit and sunk ships lose their color on your board | Hit squares turned plain red and sunk ships dark red. | The hit and sunk colors replaced the ship color. | **Fixed**: Hit squares keep the ship color with a red X; sunk ships are dimmed. |
| P-2 | Players can see an old version for up to 10 minutes after an update | Normal reloads showed old styles and scripts. | GitHub Pages cache headers plus file names that never changed. | **Fixed**: Style and script files are versioned, and a service worker always fetches the newest page. A player's first visit after this fix can still be up to 10 minutes old; every visit after that is current. |
| P-3 | Factory emoji shows as an empty box on systems without an emoji font | Seen on a Linux machine without a color emoji font. | The 🏭 symbol depends on the device having an emoji font. | **Fixed**: Such devices get a drawn factory icon instead. |
| P-4 | Screen readers never hear hit, miss or sunk | Squares were only read as their coordinate, e.g. "J10". | Labels were set once and never updated. | **Fixed**: Labels update, e.g. "J10, hit" or "C4, Wet Nellie, sunk". |
| P-5 | "You sank X!" disappears almost immediately | Replaced by "Your turn" about 0.6 seconds later. | The computer's turn overwrote the message. | **Fixed**: The message stays until your next shot. |
| P-6 | Squares already fired at still act like buttons | They could be focused and clicked with no effect. | Shot squares were never marked inactive. | **Fixed**: They are marked disabled and skipped by the Tab key. |
| P-7 | Game-over popup doesn't take keyboard focus | Focus stayed on the board behind the popup. | The popup didn't move or trap focus. | **Fixed**: Focus moves to "Play again" and the page behind is locked. |
| P-8 | Manual and random placement follow different rules | Ships could touch when placed by hand but never with "Place randomly". | Only random placement checked for touching ships. | **Not a code bug**: Kept as intended: standard rules allow touching ships by hand (see F-11), and random placement spreads ships out for readability. |
| P-9 | Restart during the computer's turn could trigger its shot early | Pressing Restart while the computer was aiming, then firing quickly, let the old turn fire in the new game. | The computer's delayed turn wasn't cancelled on restart. | **Fixed**: Restart cancels the pending turn. |

### Bugs only reachable from code (bad input to the game functions)

| ID | Bug | What happened | Cause | Status and fix |
|---|---|---|---|---|
| C-1 | Zero- or negative-length ships are accepted | placeShip(board, {name:"X", length:0}, 0, 0, true) succeeded. | No length check. | **Fixed**: Rejected. |
| C-2 | A zero-length ship makes the board count as already won | allShipsSunk returned true with only a length-0 ship. | Same as C-1. | **Fixed**: Such ships can't be placed. |
| C-3 | A fractional-length ship can never be sunk | A length-2.5 ship took 2 squares but needed 2.5 hits. | No whole-number check. | **Fixed**: Rejected. |
| C-4 | Fractional coordinates crash | receiveAttack(board, 2.5, 3) threw a TypeError. | Coordinates weren't checked for whole numbers. | **Fixed**: Returns "invalid". |
| C-5 | Text coordinates behave inconsistently | Attacks with "3" worked, but placement built column "31". | No type check. | **Fixed**: Text coordinates are rejected everywhere. |
| C-6 | The same ship can be placed twice | Two Glastrons could be placed through the code. | No duplicate check. | **Fixed**: The second one is rejected. |
| C-7 | Failed random placement leaves a half-filled board | Ships placed before the failure stayed on the board. | No rollback on failure. | **Fixed**: The board is restored before the error. |

## Still open

- F-7: confirm Rotate on a real iPhone in Safari.
