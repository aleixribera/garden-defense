# Garden Defense — Agent Guide

## Main idea
Third-person wave-defense browser game inspired by *Plants vs Zombies: Garden Warfare 2 — Garden Ops*.
The player is a plant hero defending a statue in a huge beautifully made map from waves of zombies.

## Current state (v1.4.0)
- Single file: `index.html`, three.js via CDN (importmap, plus `three/addons/` for RoomEnvironment). No build step.
- Rendering: ACES tone mapping, soft shadows (sun follows the player), PMREM room environment for the hero's PBR materials.
- Statue: box at center, 1000 HP, world + HUD health bar. Statue at 0 HP = lose.
- Player = **Kernel Corn** (125 HP, respawns at statue after 3s). `playerMesh` is a group at capsule center
  (collision is still the capsule); `buildKernelCorn()` builds the model procedurally: `makeLeaf` (bent/folded
  vertex-colored planes), `makeCob` (lathe core + instanced kernels, `skip` carves the face), `placeLeaf` pivots
  keep their rest rotation in `userData.base`. `animateCorn()` is the procedural rig (waddle, lean, squash/stretch,
  leaf feet, collar flutter, aiming arms, recoil, spinning cob barrels, blink).
- Controls: WASD (accelerated), Space jump, over-the-shoulder camera, RMB zoom, R reload.
  Weapon `CONFIG.weapon`: Cob Busters — alternating-arm kernel shots, clip/reload, spread + bloom.
  Abilities `CONFIG.abilities`: Q Shuck Shot (cob missile volley, AoE), E Husk Hop (leap, hold Space to glide,
  ground slam), F Butter Barrage (target area → falling butter, damage + stun; stunned zombies show butter).
- Feedback: hitmarkers, damage numbers, particles (`spawnParticle`), rings/decals, camera shake, hurt vignette.
  Zombie damage goes through `damageZombie()`; area damage through `explodeAt()`.
- Zombies: roster in `CONFIG.ZOMBIE_TYPES` (shambler, sprinter, plated, spitter, bomber, banner), each a
  colored capsule plus small primitive extras. Per frame: `applyBannerBuffs` → `selectTarget` (uses
  `targetPreference`: statue / player / statueOnly, with aggro/deaggro hysteresis) → `BEHAVIORS[def.behavior]`
  (melee, ranged, bomber, banner — one small function each). Plated takes reduced front damage.
  Bosses (`miniBoss`, `finalBoss`) are placeholder scaled-up Plated (`boss: true`, `look: 'plated'`), HUD boss bar.
- Map (`CONFIG.MAP`, grey-box, 300×300 m): terrain = bowl (sunken Statue Court, tier 0) + `plateaus`
  (rect/circle, `edge` ≈1 = cliff, 4+ = slope) + `ramps`, sampled into a 1 m heightfield (`heightAt`).
  `obstacles` (cover / hedge / building / platform) sit on the terrain; hedges+buildings block line of sight.
  Queries: `groundAt`, `solidAt`, `losClear`, `raycastWorld`, `pushOut`. Landmark names (`landmarks`) are theming anchors.
- Pathing: 2 m nav grid (`NAV`, slope ≤ `maxSlope`, obstacles inflated). `STATUE_FIELD` = Dijkstra flow field
  to the statue; a player field is rebuilt while anyone chases. `flowDir` steers, `constrainZombie` keeps them
  out of props/off cliffs. Future Climbers can ignore the cliff slope check.
- Aggro: needs line of sight; `CONFIG.leash` drops the chase after losing sight / being dragged too far.
- Lanes (`CONFIG.SPAWN_POINTS`): longRoad (Orchard Road, ~44 s), flank (Greenhouse Gap, ~17 s),
  choke (Garden Gate), climb (Quarry Top, ramp beside cliffs). Vantages: Windmill Ridge (far), Bandstand (near,
  exposed), Water Tower (jump-only), Well Mound (in the lane). Kite loops: Fountain, Tool Shed, hedges.
- Waves: packs spawn in order; `delay` is a hidden timer after the previous pack, shrunk per wave by
  `packDelayTighten` (floor `packDelayMin`). Lanes rotate per wave.
- HUD: wave, zombies remaining (alive + queued), boss bar, statue/player HP.
- Debug: keys 1–6 spawn `debugPackSize` of a type at a random lane; N next wave; B mini-boss; M top-down map
  (tiers, lanes + walk times, landmarks, live zombies); K spawns a 120-zombie stress horde. `?autoplay` runs
  without pointer lock (headless playtests).
  `window.__game` exposes state/corn/camera/CONFIG/explodeAt for console inspection.

## Code rules
- All tuning numbers live in the `CONFIG` object at the top of the file.
- Waves are data (`WAVES` array), never hardcoded logic.
- Keep code readable and commented.

## Direction
- New zombie types: add an entry to `ZOMBIE_TYPES`; new special abilities get their own behavior function.
- Likely next: special waves (via `modifiers`), real bosses, more plant heroes (same builder helpers), audio.
- "Primitive shapes only" now means procedural geometry built in code (no external models/textures).

## Maintaining this file
If considerable changes are made (new systems, new direction, structural changes), update this file to
reflect them. Keep it compact: replace outdated info rather than appending history.

## Always commit tag push to GitHub
