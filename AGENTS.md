# Garden Defense — Agent Guide

## Main idea
Third-person wave-defense browser game inspired by *Plants vs Zombies: Garden Warfare 2 — Garden Ops*.
The player is a plant hero defending a statue in the center of a flat arena from waves of zombies.

## Current state (v1.1.0)
- Single file: `index.html`, three.js via CDN (importmap). No build step.
- Statue: box at center, 1000 HP, world + HUD health bar. Statue at 0 HP = lose.
- Player: capsule, WASD + pointer-lock mouse aim, left click fires fast projectiles, 100 HP, respawns at statue after 3s.
- Zombies: roster in `CONFIG.ZOMBIE_TYPES` (shambler, sprinter, plated, spitter, bomber, banner), each a
  colored capsule plus small primitive extras. Per frame: `applyBannerBuffs` → `selectTarget` (uses
  `targetPreference`: statue / player / statueOnly, with aggro/deaggro hysteresis) → `BEHAVIORS[def.behavior]`
  (melee, ranged, bomber, banner — one small function each). Plated takes reduced front damage.
  All spawn as one pack at a single edge spawn point.
- Waves: `WAVES` entries map type name → count (currently shamblers only). Next wave a few seconds after the
  last zombie dies. Win after wave 10.
- Debug: keys 1–6 spawn `debugPackSize` of the type in `DEBUG_SPAWN_KEYS`.

## Code rules
- Primitive shapes only — no models, textures, or sounds (until direction changes).
- All tuning numbers live in the `CONFIG` object at the top of the file.
- Waves are data (`WAVES` array), never hardcoded logic.
- Keep code readable and commented.

## Direction
- New zombie types: add an entry to `ZOMBIE_TYPES`; new special abilities get their own behavior function.
- Likely next: mixed-type waves, multiple spawn points, player classes/abilities, real art & audio.

## Maintaining this file
If considerable changes are made (new systems, new direction, structural changes), update this file to
reflect them. Keep it compact: replace outdated info rather than appending history.

## Always commit tag push to GitHub
