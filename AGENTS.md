# Garden Defense — Agent Guide

## Main idea
Third-person wave-defense browser game inspired by *Plants vs Zombies: Garden Warfare 2 — Garden Ops*.
The player is a plant hero defending a statue in a huge beautifully made map from waves of zombies.

## Current state (v1.10.5)
- Single file: `index.html`, three.js via CDN (importmap, plus `three/addons/` for RoomEnvironment). No build step.
- Rendering: ACES tone mapping, soft shadows (sun follows the player), PMREM room environment for the hero's PBR materials.
- Statue: box at center, 1000 HP, world + HUD health bar. Statue at 0 HP = lose.
- Heroes: `heroes = [player, mate]`, both Kernel Corn made by `makeHero()` (mesh group at capsule center, corn model,
  hp/vel/ammo/cooldowns/anim, per-hero zombie info + flow fields + surround `slots`). **Every hero is driven by
  `h.input`** (`newInput()`: move, yaw, aimPoint, zoom, fire, jump/jumpHeld, reload, shuck, hop, butter point, interact);
  `readPlayerInput` fills the human's from keys/mouse (`pressed` queues edge presses), `driveTeammate` fills the AI's;
  `updateHero(h)` runs movement/weapon/abilities identically for both. Hero functions take `h` (`fireKernel(h)`,
  `useHuskHop(h)`, `callButterBarrage(h, point)`, `damageHero(h, n)`, `animateCorn(h)`); camera/recoil/shake/hitmarkers
  are the human's only. `targetable(h)` = active and not dead/downed. `state` keeps only global game state.
- Player (125 HP) respawns at the statue after 3 s. `playerMesh`/`corn` alias the player's hero. `buildKernelCorn()` builds the model procedurally: `makeLeaf` (bent/folded
  vertex-colored planes), `makeCob` (lathe core + instanced kernels, `skip` carves the face), `placeLeaf` pivots
  keep their rest rotation in `userData.base`. `animateCorn()` is the procedural rig (waddle, lean, squash/stretch,
  leaf feet, collar flutter, aiming arms, recoil, spinning cob barrels, blink).
- Controls: WASD (accelerated), Shift sprint (`sprintMult`, forward only; fire/zoom/reload cancel), Space jump,
  over-the-shoulder camera, RMB zoom, R reload.
- Camera feel (`updateCamera`, tuning in `CONFIG.camera`, state in `state.cam`): smoothed pivot, speed/sprint FOV +
  pull-back, head bob, strafe roll, landing spring dip, hurt flinch + FOV punch, layered-sine trauma shake. Overlays:
  `#hurtTint` red flash on damage, `#vignette` hurt + low-HP heartbeat pulse, `#speedFx` sprint tunnel.
  Weapon `CONFIG.weapon`: Cob Busters — alternating-arm kernel shots, clip/reload, spread + bloom.
  Abilities `CONFIG.abilities`: Q Shuck Shot (cob missile volley, AoE), E Husk Hop (leap, hold Space to glide,
  ground slam), F Butter Barrage (target area → falling butter, damage + stun; stunned zombies show butter).
- AI teammate (`CONFIG.TEAMMATE_AI`, section "Teammate AI"): statue guard within `guardRadius`. `thinkTeammate` at
  `thinkRate`: `pickTarget` (needs `shotClear`; priority Bomber near statue → Spitter → Banner → nearest to statue;
  retarget cooldown) → state station / engage / reposition (`findVantage`) / retreat (low hp) / downed / reviveWait →
  A* `findPath` on the nav grid + `smoothPath` string pulling, repath every `repathInterval` → abilities (Husk Hop to
  escape or travel via `pendingHop`, Butter on a big pack near the statue when safe, Shuck on clusters/tough targets).
  Never static: station = patrol random points out to `patrol.radius` + base check every `baseCheckEvery` s; engage =
  `orbitSteer` circle-strafe (flips direction, `dodge` repels zombies, `steerWalkable` keeps it on ground) + jump/hop flair.
  Fires only when `shotClear` from the next muzzle to the aim point is clear (`eyeOf` = muzzle height).
  Per frame: path following, stuck → jump, reaction delay, aim wobble shrinking with tracking
  time, target lead, turn-speed limit, `difficulty` multiplier. Downed: hold X near it 5 s → revive at half hp, else
  respawn after 20 s (`#revive` prompt + ring). `ZOMBIE_SCALE_PER_HERO` scales non-boss wave counts (`scaledCount`).
- Feedback: hitmarkers, damage numbers, particles (`spawnParticle`), rings/decals, camera shake, hurt vignette.
  Zombie damage goes through `damageZombie()`; area damage through `explodeAt()`.
- Zombies: roster in `CONFIG.ZOMBIE_TYPES` (shambler, sprinter, plated, spitter, bomber, banner, climber, howler,
  burrower), each a colored capsule plus small primitive extras (`makeZombieMesh` returns `{ mesh, parts }`).
  Shared brain tuned in `CONFIG.AI` (section "Zombie AI"). Per frame: banner buffs → `updateHeroInfo` (each hero
  reachable by ground? standing on a prop = no) → spatial hash (`forNeighbors`) → per zombie: knockback, stun,
  `think` (perception/targeting at 5–10 Hz, staggered; picks a hero into `z.heroTgt` by `heroScore` = distance minus a
  bonus for whoever hurt it recently (`z.lastHitBy`), switching only past `heroSwitchMargin`) → `resolveTarget` (fills `z.tgt`) → `BEHAVIORS[def.behavior]`
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
- Map (`CONFIG.MAP`, grey-box, 440×440 m): terrain = bowl (sunken Statue Court, tier 0) + mid ring (tier 3) walled by
  cliffs (tier 14) + `plateaus` (rect/circle, `edge` ≈1 = cliff, 4+ = slope) + smooth `ramps` (high end inside the
  plateau), sampled into a 1 m heightfield (`heightAt`). `obstacles` (cover / hedge / building / platform) sit on the
  terrain; hedges+buildings block line of sight. Queries: `groundAt`, `solidAt`, `losClear`, `raycastWorld`, `pushOut`.
- Pathing: 2 m nav grid (`NAV`, slope ≤ `maxSlope`, obstacles inflated; `NAV.climb` = every step, cliffs cost
  `climbCost`). `STATUE_FIELD` / `CLIMB_STATUE_FIELD` are static Dijkstra flow fields; hero fields (ground/climb)
  are rebuilt only while someone needs them. Steering = flow dir + separation + obstacle feelers + ±10% speed.
  The map is static, so fields never need runtime rebuilds.
- Spawns + routes (`CONFIG.SPAWN_POINTS`): each spawn has two routes `A`/`B` = waypoint lists (`via`); every waypoint
  has its own static flow field. Zombies carry `z.route`/`z.wp`; `routeField()` returns the current waypoint field
  (skips reached/passed ones, so a chase never sends them back) and `fieldDir` falls back to the statue field.
  `traceRoute` gives each route's polyline + length. Walk times (Shambler, measured): Orchard Road A 59 s / B over
  Windmill Ridge 63 s; Greenhouse Gap A 21 s / B 20 s; West Gates A Garden Gate 45 s / B Sluice Pass 57 s;
  Quarry Top (cliff lane) A west ramp 49 s / B east ramp 56 s.
- Vantages: Windmill Ridge (far, ramps N+S), Rampart (west wall top, inside ramp), Bandstand (near, exposed),
  Water Tower (jump-only), Well Mound (in the road). Kite loops: Fountain, Tool Shed, Hedge Wall.
- Aggro: acquire with LOS within aggroRange, drop past deaggroRange / 4 s unseen (search last known pos) /
  10 s chase without a hit; retarget + re-aggro cooldowns; pack alert (0.2–0.8 s delay); unreachable hero is
  ignored except by Spitters/Climbers; a hero's death/downing/removal drops all aggro on that hero. Distractions (`distractAt`) beat all but stun.
- Attack slots: `STATUE_SLOTS` ring on the statue faces (extras queue), `h.slots` ring to surround each hero.
- Waves: `resolvePacks` turns each pack into { spawn, route }: `spawn` or the wave's `lanes` in turn; `route`
  'A' | 'B' | 'split' (alternates through the pack) or `CONFIG.routeCycle` rotation. Packs spawn in order; `delay` is
  a hidden timer shrunk per wave by `packDelayTighten` (floor `packDelayMin`). Pack counts ramp 4 → 20 over waves 1–10
  (gaps ~6 s in waves 1–2, ~7–8 s in 3–4, ~10–13 s after; one longer lull before each wave's heaviest pack; bosses after it); 5 s countdown between waves.
- Telegraphs: countdown shows spawn beacons + pulsing ground chevrons along each active route + HUD `#laneArrow`
  to the first pack's spawn; each pack drops a primitive ghost skull (`spawnSkull`, `skullTime` 20 s) at its spawn.
- HUD (minimal, CSS tokens on `:root`): top-center Garden (statue) bar + wave/zombie line + boss bar; bottom-left
  player HP (+ AI teammate bar above it); bottom-center abilities; bottom-right ammo. All HP bars use `setHudBar()`:
  white lag chip that drains after a hit, shake + flash on damage, red pulse < 30%, glow while regenerating.
- Passive regen: heroes (player + AI teammate) heal `regenRate` hp/s after `regenDelay` s without damage (`h.lastHurt`).
- Audio (section "Audio", tuning `CONFIG.audio`): `SFX` = procedural WebAudio, no sample files. `SFX.init()` on the
  overlay click; `SFX.setActive` suspends all audio while paused / unfocused; `SFX.play(name, pos?, ...)` (pos = 3D: distance roll-off, air low-pass, camera pan, more reverb far;
  null = 2D) with per-name throttling; buses sfx/ui/ambience → compressor → limiter, convolver reverb. Helpers
  `tone`/`hiss`/`crackle`/`vocal` (formant-synth moans/roars)/`brass`. `SFX.update(dt)`: footsteps, wind rush, breeze
  bed, low-hp heartbeat, random zombie moans, burrow rumble, birdsong when calm, ability-ready pings, countdown ticks.
  New sound = entry in the `S` library + a `SFX.play` at the event.
- HUD corners: FPS counter top-right, `VERSION` bottom-right.
- Nav fields are Float64 (`buildFlowField`): Float32 rounding made Dijkstra re-push cells forever (freeze).
- Debug: T spawn/remove teammate; F1 teammate overlay (state, target, threat, path line, cooldowns); keys 1–9 spawn `debugPackSize` of a type at a random lane; N next wave; B Brute; V Zombie King; G test distraction at aim point; M top-down map
  (tiers, both routes per spawn + walk times, statue flow-field arrows, landmarks, live zombies; times also console.table); K spawns a 120-zombie stress horde. `?autoplay` runs
  without pointer lock (headless playtests).
  `window.__game` exposes state/heroes/player/mate/camera/CONFIG/explodeAt/findPath/damageHero for console inspection.

## Code rules
- All tuning numbers live in the `CONFIG` object at the top of the file.
- Waves are data (`WAVES` array), never hardcoded logic.
- Keep code readable and commented.

## Direction
- New zombie types: add an entry to `ZOMBIE_TYPES`; new special abilities get their own behavior function.
- Likely next: special waves (via `modifiers`), a Chili Bean Bomb (`distractAt`), boss models, more plant heroes / AI roles
  (new hero = `makeHero` + something that fills its `input`), music.
- "Primitive shapes only" now means procedural geometry built in code (no external models/textures).

## Maintaining this file
If considerable changes are made (new systems, new direction, structural changes), update this file to
reflect them. Keep it compact: replace outdated info rather than appending history.

## Always commit tag push to GitHub
Just before committing, bump `VERSION` at the top of the `index.html` script (shown bottom-right in game) to the
new tag, and update the version in "Current state" above. Then commit, tag that version, push (with tags).
