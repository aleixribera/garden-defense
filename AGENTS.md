# Garden Defense — Agent Guide

## Main idea
Third-person wave-defense browser game inspired by *Plants vs Zombies: Garden Warfare 2 — Garden Ops*.
The player is a plant hero defending a statue in the center of a flat arena from waves of zombies.

## Current state (v1.0.0)
- Single file: `index.html`, three.js via CDN (importmap). No build step.
- Statue: box at center, 1000 HP, world + HUD health bar. Statue at 0 HP = lose.
- Player: capsule, WASD + pointer-lock mouse aim, left click fires fast projectiles, 100 HP, respawns at statue after 3s.
- Zombies: one basic type (capsule). Spawn as one pack at a single edge spawn point, walk to statue.
  Aggro: chase player within `aggroRange` (15), return to statue beyond `deaggroRange` (25). Contact damage on cooldown.
- Waves: data array `WAVES`; next wave a few seconds after the last zombie dies. Win after wave 10.

## Code rules
- Primitive shapes only — no models, textures, or sounds (until direction changes).
- All tuning numbers live in the `CONFIG` object at the top of the file.
- Waves are data (`WAVES` array), never hardcoded logic.
- Keep code readable and commented.

## Direction
- Future zombie types will differ in stats and targeting ranges — keep per-type values in `CONFIG` and
  let waves reference types by name.
- Likely next: more zombie types, multiple spawn points, player classes/abilities, real art & audio.

## Maintaining this file
If considerable changes are made (new systems, new direction, structural changes), update this file to
reflect them. Keep it compact: replace outdated info rather than appending history.
