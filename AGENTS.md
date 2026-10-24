# Garden Defense — Agent Guide

## Main idea
Third-person wave-defense browser game inspired by *Plants vs Zombies: Garden Warfare 2 — Garden Ops*.
The player is a plant hero defending a statue in a huge beautifully made map from waves of zombies.

## Current state (v1.12.2)
- Single file: `index.html`, three.js via CDN (importmap, plus `three/addons/` for RoomEnvironment). No build step.
- Rendering: ACES tone mapping, soft shadows (sun follows the player), PMREM room environment for the hero's PBR materials.
- Statue: box at center, 1000 HP, world + HUD health bar. Statue at 0 HP = lose.
- Squad: pre-match picker selects a plant plus 0–3 autonomous AI companions; duplicates allowed.
  Default lineup is one each of Corn, Peashooter, Sunflower and Cactus, shuffled uniformly before the picker and
  initial spawn (25% chance to start as each). Untouched defaults reshuffle between matches; manual picker choices
  are retained. Respawns and control switches never reshuffle the squad.
  `CONFIG.PLANTS` holds roster/loadout data, `PLANT_TYPES` supplies model, animation, AI, weapon and ability hooks. `makeHero(type, ...)`
  gives every character its own stats, weapon, ability tuning, input, brain, health, ammo, cooldowns and animation.
  `heroes` holds 1–4 persistent characters; `player` / `playerMesh` / `corn` follow current human control; `mate` is
  a legacy alias for the first AI companion (null in solo play). Tab / ] cycles living members; [ goes backward.
  Handoff changes input ownership, camera, audio listener and HUD without copying or resetting combat state.
- Heroes: made by `makeHero()` (mesh group at capsule center, procedural model,
  hp/vel/ammo/cooldowns/anim, per-hero zombie info + flow fields + surround `slots`). **Every hero is driven by
  `h.input`** (`newInput()`: move, yaw, aimPoint, zoom, fire, jump/jumpHeld, reload, shuck, hop, butter point, interact);
  `readPlayerInput` fills the human's from keys/mouse (`pressed` queues edge presses), `driveTeammate` fills the AI's;
  `updateHero(h)` runs movement/weapon/abilities identically for both. Hero functions take `h` (`fireKernel(h)`,
  `useHuskHop(h)`, `callButterBarrage(h, point)`, `damageHero(h, n)`, `animateCorn(h)`); camera/recoil/shake/hitmarkers
  are the human's only. `targetable(h)` = active and not dead/downed. `state` keeps only global game state.
- Death is controller-independent: every plant goes down and respawns after `CONFIG.squad.respawnDelay` (8 s).
  Hold X near a fallen ally for 5 s to revive at half health. Timers stay on the character across switches;
  a full squad wipe waits for respawns while the garden stays vulnerable. Only garden destruction loses.
- Kernel Corn (125 HP): `buildKernelCorn()` builds the model procedurally: `makeLeaf` (bent/folded
  vertex-colored planes), `makeCob` (lathe core + instanced kernels, `skip` carves the face), `placeLeaf` pivots
  keep their rest rotation in `userData.base`. `animateCorn()` is the procedural rig (waddle, lean, squash/stretch,
  leaf feet, collar flutter, aiming arms, recoil, spinning cob barrels, blink).
- Peashooter (125 HP): `buildPeashooter` / `animatePeashooter` create a hollow sculpted muzzle, waxy rind with
  procedural pore relief, jade eyes, folded crown, raised leaf veins/rims, pea pods, spiral tendrils and leaf feet.
  Pea Cannon: 10-round clip, direct impact + separate 3D splash (cover checked). Q Chili Bean Bomb: arcing,
  bouncing, ticking lure → delayed blast; E Pea Gatling: rooted deployment, helmet/rotor, 100 separate rounds,
  E again uproots; F Hyper: timed speed + jump boost. No Husk Hop slam/glide. Mode timers, ammo and cooldowns
  belong to the character across switches; death clears active modes. Settings: `CONFIG.PLANTS.peashooter` and
  `CONFIG.PEASHOOTER`; `drivePeashooter` patrols the middle ring, favors groups, checks bean arcs, uses Hyper
  for travel/escape and commits Gatling against durable targets until danger/lost sight requires uprooting.
  Browser checks: `tests/peashooter.cjs`; mechanics and source notes: `docs/peashooter.md`.
- Sunflower (110 HP, `CONFIG.SUNFLOWER`): `buildSunflower` sculpts 39 closed grooved petals, a warm face,
  glossy eyes/freckles/smile, ribbed stem, leaf hands, veined feet and layered calyx/spiral florets. Per-rig materials;
  `animateSunflower` handles gait, sway, aim/recoil, reload, blink, petal follow-through and rooting.
  Sun Pulse (50 shots, 2 s reload, falloff/crit); Q Heal Beam toggles an ally tether while moving/firing;
  E Sunbeam roots with a separate 100-charge magazine (E/Space exits, cooldown starts on exit);
  F destructible Heal Flower releases 3 collectible healing suns every 2.5 s for 30 s. `updateSunflowerWorld`
  handles solar shots/flowers/sundrops; per-hero `h.sun` holds tether/stance state across control switches.
  `driveSunflower` follows teammates even at full health, commits to a patient until healed, heals under pressure,
  supports other Sunflowers, rescues fallen allies and supplies cover fire without leaving its escort.
  No garden leash or low-HP healing veto. Faster 3 s revive uses the shared half-health policy.
  Researched role and explicit fidelity limits: `docs/sunflower-ai.md`; scenarios: `tests/sunflower-hero.cjs`.
- Cactus (125 HP): `buildCactus` / `animateCactus` create a continuous fluted trunk and unequal bent arms,
  inset sleepy eyes, hollow muzzle, instanced areoles/spines, burgundy crown and cream/rose flower buds.
  Spike Shot: 12 rounds, precise scope, 25 body / 30 critical damage. Q Potato Mines: arming, proximity blasts,
  three replenishing charges; F Tallnut Battlements: four charges, 200 HP, block bodies/projectiles and take
  zombie melee damage. Placement checks slopes/props/allies; static nav fields remain unchanged.
  E Garlic Drone roots the owner: WASD flight, Space/Ctrl altitude, LMB overheating needles, Q Corn Strike,
  E return. Drone has 5 HP; owner death / handoff ends remote control. Reset disposes all Cactus objects.
  `driveCactus` is an independent Solo Ops home-defender brain: patrol/hold posts near the garden, scope
  visible incoming threats, return if displaced, backpedal + mine at close range. No Corn assault/boss bias,
  autonomous drones or battlements. Public sources do not establish exact original thresholds or all friendly
  ability decisions; adaptations and source distinctions: `docs/cactus-ai.md`; tests: `tests/cactus.cjs`.
  Per-instance tuning/resources: `CONFIG.PLANTS.cactus`, `CONFIG.cactus`, `h.cactus`.
- Controls: WASD (accelerated), Shift sprint (`sprintMult`, forward only; fire/zoom/reload cancel), Space jump,
  over-the-shoulder camera, RMB zoom, R reload.
- Camera feel (`updateCamera`, tuning in `CONFIG.camera`, state in `state.cam`): smoothed pivot, speed/sprint FOV +
  pull-back, head bob, strafe roll, landing spring dip, hurt flinch + FOV punch, layered-sine trauma shake. Overlays:
  `#hurtTint` red flash on damage, `#vignette` hurt + low-HP heartbeat pulse, `#speedFx` sprint tunnel.
  Weapon `CONFIG.weapon`: Cob Busters — alternating-arm kernel shots, clip/reload, spread + bloom.
  Abilities `CONFIG.abilities`: Q Shuck Shot (cob missile volley, AoE), E Husk Hop (leap, hold Space to glide,
  ground slam), F Butter Barrage (target area → falling butter, damage + stun; stunned zombies show butter).
- Corn companion AI (`CONFIG.TEAMMATE_AI`, section "Teammate AI"): Solo Ops soldier role: roam outward,
  prioritize nearby bosses, switch to local regular zombies when overwhelmed, and keep fighting at low HP.
  `pickTarget` uses local sight/hearing, timed last-position memory, priority changes that override retarget cooldown,
  and aim-weighted selection within a priority. `thinkTeammate` chooses station / engage / reposition / downed / reviveWait;
  A* + string pulling pursue enemies and `findVantage` samples around the enemy. No statue guard leash / base-check loop.
  Combat abilities: offensive Husk Hop with checked landing, Shuck against bosses/armor/clusters, Butter against visible
  bosses/packs anywhere in range. No random travel hops. The firing frame rechecks Shuck intent, aim and next-muzzle clearance.
  Smooth firing keeps fight readiness and some settled aim between kills (`combatMemory`); eased turning remains bounded,
  dead/buried targets are replaced immediately, and idle reload waits for a lull. Every AI hero has its own brain.
  Sources, fidelity limits and adapted tuning: `docs/kernel-corn-ai.md`; browser scenarios: `tests/corn-ops.cjs`.
  All new thresholds are adaptations to this game, not claimed original GW2 constants.
  `ZOMBIE_SCALE_PER_HERO` scales non-boss wave counts (`scaledCount`).
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
- Tactical zombie agents (section "Tactical zombie agents", shared tuning `CONFIG.AGENTS`): Imp, Foot Soldier, All-Star,
  Captain Deadbeard (pirate), Super Brainz, Engineer (mechanic), Scientist = `ZOMBIE_TYPES` entries with `behavior: 'agent'`,
  `targetPreference: 'agent'` and an `agent` role block (range band, placeholder weapon, `unlockWave`). Placeholder bean
  capsules + generic shot/swing; real models, weapons and abilities not built yet. `thinkAgent` picks a plant (distance −
  `h.opening` − squad focus, crowd penalty), human and AI alike; `updateHeroTactics` sets `h.opening` (reloading, low ammo,
  spent abilities, low HP, isolated, busy with horde, airborne) and `h.hordeAng`. States hunt / stalk (screened behind the
  horde side, slow pokes) / commit (opening or `groupPush` agents: flank angles off the horde side, full fire). No healing,
  retreat or leash. Spawning: `queueEscorts` gives each wave pack a chance (`AGENTS.escort`) to bring 1–2 agents
  `escort.delay` s after its burst, same spawn/route, capped by `WAVES[i].agentCap`; they 'guard' (trail the pack) until a
  plant nears the pack or hits them, or the pack dies. Weapon damage × `AGENTS.damageMult`. Debug key 0 spawns one of each.
- Imp agent (section "Imp", tuning `CONFIG.IMP`, `behavior: 'imp'`): `buildImp` procedural rig (pear head with bulging
  eyes/lids, grin, helmet + headphones + spring antenna, orange suit, stripes, canisters, twin yellow blasters) on the
  invisible zombie capsule (`setupImp`, `z.rig`, `z.imp`); `animateImp` runs from `updateZombieLook` (gait, springs,
  aim/recoil, reload twirl, blink). `impBehavior`: thinkAgent target/state, circle-strafe band, double-jump hops +
  evasive dodges (`impVertical` after `constrainZombie`), alternating Imp Blaster bursts, Gravity Grenade (vortex sets
  hero `floatT` — `updateHero` hovers/slows them), Impkata star barrage. Z-Mech (`buildZMech`): charges over time, drops
  onto the Imp, swaps `z.def` to `IMP_MECH_DEF`, own hp via `damageZMech`; minigun, Robo-Stomp, jet dash, Eject at low hp
  (empty mech blows up). World objects in `updateImpWorld` / `clearImpWorld`; enemy projectiles accept `r`, `onEnd`, `spin`, `trail`.
- Scientist agent (section "Scientist", tuning `ZOMBIE_TYPES.scientist.agent/kit`, `healStation`): procedural rig
  (`buildScientistTemplate` built once, cloned per spawn with own materials via `attachAgentRig` → parts.animate /
  flashMats / dispose): wild white hair locks, riveted goggles with magnified eyes, open toothy mouth, stained lab coat,
  striped tie, rubber gloves, bare foot + boot, goo tank with antenna dish, triple-barrel Goo Blaster. `animateScientist`:
  shamble gait, aim/recoil/reload pump, throw, hair spring, eye darts, warp spin-shrink. Goo Blaster = pellet shotgun
  (`gooPellets`, distance falloff). `scientistBehave`: Warp behind a plant (commit, plant opening or long stalk) or away
  when low; Sticky Explody Ball (`stickyBalls`, sticks to plants, beeps, AoE); Heal Station = a destructible zombie
  (`healStation` behavior) healing zombies in its aura; holds there until healed. Tests: `tests/scientist.cjs`.
- Engineer agent (`mechanic`, section "Engineer", tuning `CONFIG.ENGINEER`, kit via `agent.kit: 'engineer'` →
  `AGENT_KITS.engineer` called by `agentBehavior` after movement; `a.ram` / `a.moveMult` steer it): `engineerTemplate`
  (built once, cloned per spawn with own materials in `makeEngineerBody`): glossy hard hat with ridges + pencil, one
  bulging eye + droopy eye with blinking lids, gap-toothed jaw, open orange shirt over undershirt belly, hi-vis vest with
  reflective bands, belt + tool pouch + wrench, jeans with one boot and one torn hem / bare foot, back tank, hazard-striped
  Concrete Launcher (canvas textures). `animateEngineer`: waddle/belly jiggle, lob-elevation aim, recoil + flash, reload,
  overhand throw, jackhammer ride buzz + dust; death pops the hat and launcher off (`engineerDebris`). Kit: Concrete
  Launcher lobs (`engineerShells`, direct + cover-checked splash); Q Sonic Grenade (`sonicGrenades`, bounces → pulse sets
  hero `h.jam`: `updateHero` blocks new Q/E/F unless exiting a rooted mode, slows; human gets the `jamFx` overlay);
  E Jackhammer (fast ram, knockback, no shooting); F Turret = `engineerTurret` stationary zombie (`turretBehavior`,
  `mechanical`: no moans, expires / dies with its owner). Use: jackhammer for long travel or push gap-close; grenade vs
  rooted / exposed / clustered plants or when hurt; turret once a fight starts. `__game` exposes engineer hooks.
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
  (gaps ~6 s in waves 1–2, ~7–8 s in 3–4, ~10–13 s after; one longer lull before each wave's heaviest pack).
  Brute leads pack 3 of wave 5 (~17 s); Zombie King leads pack 9 of wave 10 (~74 s), giving later packs time to catch up; 5 s countdown between waves.
- Telegraphs: countdown shows spawn beacons + pulsing ground chevrons along each active route + HUD `#laneArrow`
  to the first pack's spawn; each pack drops a primitive ghost skull (`spawnSkull`, `skullTime` 20 s) at its spawn.
- HUD (minimal, CSS tokens on `:root`): top-center Garden (statue) bar + wave/zombie line + boss bar; bottom-left
  current plant HP + full squad list (YOU / AI, health, respawn timers); bottom-center current plant abilities;
  bottom-right current weapon/ammo. AI characters have individual world health bars. All HP bars use `setHudBar()`:
  white lag chip that drains after a hit, shake + flash on damage, red pulse < 30%, glow while regenerating.
- Passive regen: every squad member heals its own `stats.regenRate` hp/s after `stats.regenDelay` s without damage (`h.lastHurt`).
- Audio (section "Audio", tuning `CONFIG.audio`): `SFX` = procedural WebAudio, no sample files. `SFX.init()` on the
  overlay click; `SFX.setActive` suspends all audio while paused / unfocused; `SFX.play(name, pos?, ...)` (pos = 3D: distance roll-off, air low-pass, camera pan, more reverb far;
  null = 2D) with per-name throttling; buses sfx/ui/ambience → compressor → limiter, convolver reverb. Helpers
  `tone`/`hiss`/`crackle`/`vocal` (formant-synth moans/roars)/`brass`. `SFX.update(dt)`: footsteps, wind rush, breeze
  bed, low-hp heartbeat, random zombie moans, burrow rumble, birdsong when calm, ability-ready pings, countdown ticks.
  New sound = entry in the `S` library + a `SFX.play` at the event.
- HUD corners: FPS counter top-right, `VERSION` bottom-right.
- Nav fields are Float64 (`buildFlowField`): Float32 rounding made Dijkstra re-push cells forever (freeze).
- Debug: F1 first AI companion overlay (state, target, threat, path line, cooldowns; safe in solo); keys 1–9 spawn `debugPackSize` of a type at a random lane; N next wave; B Brute; V Zombie King; G test distraction at aim point; M top-down map
  (tiers, both routes per spawn + walk times, statue flow-field arrows, landmarks, live zombies; times also console.table); K spawns a 120-zombie stress horde. `?autoplay` runs
  without pointer lock (headless playtests).
  `window.__game` exposes state/heroes/player/mate/corn/camera/CONFIG/PLANT_TYPES, `configureSquad` (pre-match / game-over
  only), `switchSquadMember`, explodeAt/findPath/damageHero for console inspection. Dynamic getters track handoff.

- Super Brainz (section "Super Brainz", `CONFIG.SUPER_BRAINZ`): sculpted procedural model + rig (`attachSuperBrainzRig`,
  `animateSuperBrainz`), kit Heroic Fists combo / Heroic Beam / Super Ultra Ball / Heroic Kick / Turbo Twister, own brain
  `superBrainzBehavior` on top of thinkAgent. Damage below plants.

## Code rules
- All tuning numbers live in the `CONFIG` object at the top of the file.
- Waves are data (`WAVES` array), never hardcoded logic.
- Keep code readable and commented.

## Direction
- New zombie types: add an entry to `ZOMBIE_TYPES`; new special abilities get their own behavior function.
- Likely next: special waves (via `modifiers`), boss models, more plant heroes / AI roles
  (new hero = `CONFIG.PLANTS` data + `PLANT_TYPES` hooks; `makeHero` creates independent instances), music.
- "Primitive shapes only" now means procedural geometry built in code (no external models/textures).

## Maintaining this file
If considerable changes are made (new systems, new direction, structural changes), update this file to
reflect them. Keep it compact: replace outdated info rather than appending history.

## Always commit tag push to GitHub
Just before committing, bump `VERSION` at the top of the `index.html` script (shown bottom-right in game) to the
new tag, and update the version in "Current state" above. Then commit, tag that version, push (with tags).
