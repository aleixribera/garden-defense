# Garden Defense — Agent Guide

## Main idea
Third-person wave-defense browser game inspired by *Plants vs Zombies: Garden Warfare 2 — Garden Ops*.
The player is a plant hero defending a statue in a huge beautifully made map from waves of zombies.

## Current state (v1.5.0)
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
- Zombies: roster in `CONFIG.ZOMBIE_TYPES` (shambler, sprinter, plated, spitter, bomber, banner, climber, howler,
  burrower), each a colored capsule plus small primitive extras (`makeZombieMesh` returns `{ mesh, parts }`).
  Shared brain tuned in `CONFIG.AI` (section "Zombie AI"). Per frame: banner buffs → `updateHeroInfo` (hero
  reachable by ground? standing on a prop = no) → spatial hash (`forNeighbors`) → per zombie: knockback, stun,
  `think` (perception/targeting at 5–10 Hz, staggered) → `resolveTarget` (fills `z.tgt`) → `BEHAVIORS[def.behavior]`
  → `checkStuck`; then hard separation and `constrainZombie`. `z.mode` = stunned/distracted/special/attack/chase/advance.
  `targetPreference` (`z.pref`): statue / player / statueOnly / none / highGround / closest. Flags: `noLos`,
  `ignoreLeash`, `canClimb`, `reachesHighGround`.
- Types: Sprinter weaves + lunges; Plated loses 3 plate pieces at hp thresholds → glowing weak-point core, knockback
  resistant; Spitter keeps 18 m with a clear shot, backs off; Bomber glows/beeps faster near the statue (WebAudio);
  Banner hangs 8 m behind the pack, flees the hero; Climber uses the climb nav layer and scales cliffs/props to a
  high hero; Howler senses the hero, screams to pull nearby zombies; Burrower tunnels (untargetable mound) and
  pops up near the statue. Explosions are heavy hits and knock back.
- Bosses: `miniBoss` Brute (`brute`: closest target, never gives up, telegraphed charge → dazed if dodged);
  `finalBoss` Zombie King (`overlord`: phases at 66/33% change targeting + call reinforcements; phase 2 armor
  only heavy hits break, hp locked; phase 3 enraged + charges). HUD boss bar shows armor.
- Map (`CONFIG.MAP`, grey-box, 300×300 m): terrain = bowl (sunken Statue Court, tier 0) + `plateaus`
  (rect/circle, `edge` ≈1 = cliff, 4+ = slope) + `ramps`, sampled into a 1 m heightfield (`heightAt`).
  `obstacles` (cover / hedge / building / platform) sit on the terrain; hedges+buildings block line of sight.
  Queries: `groundAt`, `solidAt`, `losClear`, `raycastWorld`, `pushOut`. Landmark names (`landmarks`) are theming anchors.
- Pathing: 2 m nav grid (`NAV`, slope ≤ `maxSlope`, obstacles inflated; `NAV.climb` = every step, cliffs cost
  `climbCost`). `STATUE_FIELD` / `CLIMB_STATUE_FIELD` are static Dijkstra flow fields; hero fields (ground/climb)
  are rebuilt only while someone needs them. Steering = flow dir + separation + obstacle feelers + ±10% speed.
  The map is static (no destructible cover), so fields never need runtime rebuilds.
- Aggro: acquire with LOS within aggroRange, drop past deaggroRange / 4 s unseen (search last known pos) /
  10 s chase without a hit; retarget + re-aggro cooldowns; pack alert (0.2–0.8 s delay); unreachable hero is
  ignored except by Spitters/Climbers; hero death drops all aggro. Distractions (`distractAt`) beat all but stun.
- Attack slots: `STATUE_SLOTS` ring on the statue faces (extras queue), `HERO_SLOTS` ring to surround the hero.
- Lanes (`CONFIG.SPAWN_POINTS`): longRoad (Orchard Road, ~44 s), flank (Greenhouse Gap, ~17 s),
  choke (Garden Gate), climb (Quarry Top, ramp beside cliffs). Vantages: Windmill Ridge (far), Bandstand (near,
  exposed), Water Tower (jump-only), Well Mound (in the lane). Kite loops: Fountain, Tool Shed, hedges.
- Waves: packs spawn in order; `delay` is a hidden timer after the previous pack, shrunk per wave by
  `packDelayTighten` (floor `packDelayMin`). Lanes rotate per wave.
- HUD: wave, zombies remaining (alive + queued), boss bar, statue/player HP.
- Debug: keys 1–9 spawn `debugPackSize` of a type at a random lane; N next wave; B Brute; V Zombie King; G test distraction at aim point; M top-down map
  (tiers, lanes + walk times, landmarks, live zombies); K spawns a 120-zombie stress horde. `?autoplay` runs
  without pointer lock (headless playtests).
  `window.__game` exposes state/corn/camera/CONFIG/explodeAt for console inspection.

## Code rules
- All tuning numbers live in the `CONFIG` object at the top of the file.
- Waves are data (`WAVES` array), never hardcoded logic.
- Keep code readable and commented.

## Direction
- New zombie types: add an entry to `ZOMBIE_TYPES`; new special abilities get their own behavior function.
- Likely next: special waves (via `modifiers`), a Chili Bean Bomb (`distractAt`), boss models, more plant heroes (same builder helpers), audio.
- "Primitive shapes only" now means procedural geometry built in code (no external models/textures).

## Maintaining this file
If considerable changes are made (new systems, new direction, structural changes), update this file to
reflect them. Keep it compact: replace outdated info rather than appending history.

## Always commit tag push to GitHub
