# Controller

Garden Defense plays fully with a game controller (Gamepad API, "standard" mapping; glyphs are PlayStation-style,
since the arcade cabinet uses a DualShock 4). Code: `src/gamepad.js` (pad polling, menu navigation) and the
"Game controller" blocks of `index.html` (glyphs + menus before boot, `padGame` in a match). Tuning: `CONFIG.gamepad`. Test: `tests/gamepad.cjs`;
screenshots: `node tools/pad-shots.cjs <outDir> [W] [H]`.

## Button map

| Input | Play | Menus |
|---|---|---|
| Left stick | move (analog) | move focus |
| L3 | sprint (toggle, ends when the stick eases off) | |
| Right stick | aim (response curve, slows over a zombie) | |
| R2 | fire / confirm Butter Barrage | |
| L2 | zoom / cancel targeting | |
| ✕ | jump (hold to glide) | select, or advance a list / slider |
| ☐ | reload, hold to revive | step a list / slider back |
| ◯ | drone descend, cancel targeting | back / resume |
| L1 / R1 / △ | abilities 1 / 2 / 3 | |
| D-pad ← → | switch plant; between waves choose a boon | move focus; ← → change a slider |
| D-pad ↑ | take the highlighted boon | move focus |
| Touchpad / Share | help panel | |
| Options | pause | resume |

Spectating: D-pad ← → plant, △ view, ☐ reset view, sticks move the orbit / free camera (R1 / ✕ up, L1 / ◯ down,
L3 fast), L2 / R2 orbit zoom.

## Rules

- Several pads (Steam adds a virtual Xbox pad beside the real one): the game follows the pad used last, and another
  pad takes over only when the current one is idle, so a mirrored pair never fires a press twice.
- A pad press can't take pointer lock, so a match started from the pad runs with `padPlaying` instead
  (`captured()` = lock or `padPlaying`). Clicking the canvas hands control back to the mouse. A pad that drops out
  pauses the match; buttons held when play resumes count only after they are released (`padState.ignore`).
- Browsers may not count pad presses as the gesture that unlocks audio; any key or click unlocks it too.
- `inputMode` ('kbm' / 'pad') follows the last real input. In pad mode `body.padMode` shows the focus highlight,
  a one-column settings list and, on screens ≥ 1600×900, a larger HUD for a TV. Text with key names goes through
  `key()` / `kbd()` / `glyphText()`; anything rendered once re-renders through `onGlyphs()`.
