# Garden Defense — Agent Guide
**Keep this file small:** short, current facts only; replace outdated lines, never append history.
**Always commit, tag, push:** bump `VERSION` in `index.html`, `package.json` and the version below, commit, tag it, push with tags.
If another session is making changes, only commit, tag, push your changes, and let the other session handle its own changes.

## Game
Third-person wave defense inspired by *PvZ Garden Warfare 2 — Garden Ops*: a squad of plant heroes defends the
garden statue (center, 1000 HP; 0 = lose) on a 440×440 m map against 10 waves of zombies, agents and bosses.

## Current state (v1.32.1)
- `index.html` (game module) + native ES modules, no build step: `src/config.js` (CONFIG, imported statically: no
  dependencies) and `src/plants/<plant>.js` (one per plant: model, gadget models, animator, render poses; loaded in
  parallel after three.js, section "Plant models"; helpers + particle hook `usePlantFx` in `src/plants/shared.js`;
  combat / AI / HUD stay in index.html). three.js 0.160 vendored in `vendor/three` (import map; serve over http, not
  file://). Procedural geometry + WebAudio only.
- **Failure handling:** a plain boot-guard script turns any error before `gardenBoot.ready` into a menu message + Reload;
  refused pointer lock says so on the menu (`lockPointer`). `loop()` steps `SIM_SYSTEMS` via `simulate(dt, skip)`, then
  `FRAME_SYSTEMS`, each `guarded()` (a throwing system is logged once, counted in `loopErrors`, and skips the frame).
- **Loading rule:** the main menu shows instantly. All loading (three.js, map, nav fields, models, templates, shader
  compiles) runs after the squad is chosen, behind the loading screen (section "Main menu + boot"). Anything built
  lazily must be prewarmed in `prewarmAssets()`; per-spawn procedural rigs come from `RIG_POOL` via `takeRig()`.
  `?autoplay` and automated browsers skip the menu gate.
- **No-stutter rules:** never add/remove lights mid-match (borrow `takeFxLight()`); shader programs are pinned and new
  variants compile in parallel behind `updateShaderGuard`; agent rigs are baked (`bakeRig`) templates cloned by
  `cloneRig` (~1 ms); plain zombie bodies and particles draw instanced (`ZOMBIE_BATCH`, `PARTICLE_BATCH`); share
  geometry for per-shot/per-effect meshes instead of building it each spawn; plant shots use `takeShotMesh` /
  `freeShotMesh`, particles are pooled, prop point queries go through `obstaclesNear`. Audit: docs/render-audit.md.
- Squad: picker = your plant (random visible selection, editable; automated boots default Corn) + 0–3 AI companions (default Random, no repeats; pool = `CONFIG.PLANTS`). `makeHero`
  gives each hero its own stats/weapon/abilities/brain; every hero is driven by `h.input` (human: `readPlayerInput`,
  AI: `PLANT_TYPES[type].drive`). Tab / [ ] switch control. Down → respawn after `CONFIG.squad.respawnDelay` (20 s),
  hold X to revive; squad cards + floating tags show respawn timers. AI rooted abilities are cancelled when stalled
  (`aiRootedWatchdog`); stuck AI plants escalate jump → escape walk → snap (`aiUnstick`, `CONFIG.squad.aiStuck`).
- Hidden garden alert (`CONFIG.gardenAlert`): a zombie hitting the garden becomes the priority target of AI plants
  near home; distant AI plants shrink their roam radius for a while.
- Heroes: data in `CONFIG.PLANTS`, class tuning in `CONFIG.SUNFLOWER` / `CONFIG.PEASHOOTER` / `CONFIG.cactus`,
  Corn in `CONFIG.weapon` / `CONFIG.abilities` / `CONFIG.TEAMMATE_AI`. Docs per hero in `docs/*.md`. AI Cactus fortifies
  the statue with mines/walls (`cactus.ai.fortify`). Plant bullets fly until they hit something or leave the map.
- Roster balance: GW2 references, role budgets and measured before/after sustained damage in `docs/balance.md`.
  Citron damage traces have no range cutoff (cover still blocks); `weapon.range` limits its drawing only.
  Regression: `tests/balance.cjs` (all seven primaries + solo AI fights, range, cover and melee downtime).
- Citron (tank: heat beam, EMPeach, Citron Ball + Spin Dash, Peel Shield), Rose (homing thistles, Goatify, Time Snare,
  Arcane Enigma) and Chomper (bite / swallow from behind + chew, Goop, Burrow, Spikeweed): `CONFIG.CITRON` / `ROSE` /
  `CHOMPER`, sections "<Name> combat" + the shared "New plant kits" (zombie status `z.pfx` via `plantStatus`: slow, goop,
  hold, goat; `rayZombie`; `np*` AI helpers). Optional `PLANT_TYPES` hooks (all seven plants; shared code
  never checks `h.type`): reset, onDown, dispose, speedMult/jumpMult, absorb, stance, hud, rooted (`heroRooted`),
  stanceFire, eye, camera, healer, groundTarget, ownAbilityAI — listed above `PLANT_TYPES`. `h.cloak` (Burrow, Enigma) makes `targetable()` false; the human's aim / squad switching use `standing()`.
  Docs: docs/citron.md, rose.md, chomper.md. Test: `tests/new-plants.cjs`; renders: `npm run renders:plants` (`tools/plant-models.cjs`).
- Horde models (section "Horde models"): the 8 basic zombies are sculpted merged meshes, GPU-skinned (16 bones,
  per-instance bone texture) and instanced per type; clips are procedural in `HORDE_MODELS[type].pose/attack` plus
  shared layers (`hordeOverlays`: look, wind-up/strike, flinch, stun, spawn); deaths become `hordeCorpses`. Far
  zombies draw a coarse copy of the sculpt in `kit.far` (`CONFIG.render.hordeLod`, segment counts × `hgDetail.k`).
  Renders: `tests/horde-models.cjs` → `docs/horde-*.png`.
- Zombies: `CONFIG.ZOMBIE_TYPES` (behavior key → `BEHAVIORS`), shared brain `CONFIG.AI`. Tactical agents (Imp, Foot
  Soldier, All-Star, Captain Deadbeard, Super Brainz, Engineer, Scientist) use `thinkAgent` + own kits, tuning
  `CONFIG.AGENTS` (`damageMult`). All enemy sizes use `CONFIG.enemySize` (capsule height relative to plants), applied
  by `scaleEnemyDef` to model + collision; local rig offsets use `rigHalf`. Reference: docs/enemy-scale.png;
  test: `tests/enemy-scale.cjs` (including Z-Mech boarding/ejection and corpses). Bosses spawn at a random lane and prefer plants
  (`heroFirst`). Boss slot machine (`CONFIG.BOSS_SLOT`): waves 5 and 10 roll Gargantuar / Mecha / agent squad / mixed
  pack for the pack marked `bossSlot` (reel in the countdown banner). After wave 10 the extraction finale
  (`CONFIG.FINALE`, phase `'extract'`): hold a random landing zone until charged under a plant-hunting horde (120 s solo,
  240 s deadline); AI plants path there (`finaleSteer`). Test: `tests/boss-finale.cjs`. Escort agents: `AGENTS.escort` (chained `moreChance` rolls).
- Map/nav: heightfield terrain + obstacles (`CONFIG.MAP`), 2 m nav grid, static statue flow fields, A* for AI plants.
  Ramps start exactly on their plateau edge (else a lip blocks nav); sides blend like cliffs (`rampEdge`). Nav steps are
  symmetric (4 sub-step slope test); `NAV.ledge` marks cells beside a drop, which zombie routes, lanes and `findPath`
  avoid (`ledgeCost`). `constrainZombie` refuses steps onto ground steeper than walkable, so only knockback, jumps or
  an already-slipping zombie go over a ledge. Test: `tests/terrain.cjs`. Spawn areas (`CONFIG.SPAWN_POINTS`: center, `r`, `minStatue`) — zombies appear anywhere inside; packs roll a random
  area (`randomPackSpawns`), part of a pack clusters on an anchor. Waves are data in `CONFIG.WAVES`.
- Zombie routing (`ZROUTE`, section "Zombie routing", tuning `CONFIG.AI.path` / `AI.life`): no fixed lanes; each zombie
  plans its own A* route (cost = length × personal noise + shared traffic + jams + cactus walls, heuristic = statue
  field), budgeted + resumable (one search at a time, ms cap). Re-plans when off-route/other level, walled, stuck, no
  headway, or now and then. Horde adds lanes, wander, speed surges, pauses. Test: `tests/routing.cjs`.
- Animation juice (`CONFIG.juice`, section "Animation juice"): layered on every rig after its animator — heroes lean
  into acceleration, flinch on hits, topple/bounce when downed, spring up, pop in on respawn, and play ability gestures
  (`heroAction` → `JH.gestures`); agents flinch away from hits, pop in on spawn and leave a toppling corpse
  (`agentCorpse`, deferred dispose) whose rig joints, found by ref name at spawn (`collectLimpJoints`), spring into a
  per-class `JA.deathPose` and flop on landing. Agent offsets are undone before behaviors (`unJuiceAgent`). Test: `tests/animation.cjs`.
- Between waves: `offerBoons()` opens a 1-of-3 squad boon pick (`CONFIG.boons`, ← → + Enter; auto for spectators /
  automated runs) read through `boon(stat)` (damage, health, cooldown, speed, reload, respawn → `respawnDelay()`).
  Per-match wave mutators (`CONFIG.MUTATORS`, `state.mutators`, `mutator(stat)`: hp, count, speed, damage) show on the
  countdown banner. No shop, potted plants, garden repairs or currency. Test: `tests/boons.cjs`.
- World art (section "World art", `CONFIG.art`): visual only over the grey-box collision (terrain painted by vertex
  colours + detail map, cliff strata in the ground shader, dressed props merged by material via `bakeRig`, instanced
  trees/rocks/graves/tufts/flowers, sky dome). The garden statue is a gnome (`gardenStatue`; hit flash, grime, hat tip
  off < 50%); the `statueMesh` box stays as the logical statue. New props: add a case in `buildProp`.
- Awareness + onboarding (section "Situational awareness", `CONFIG.hudAware`, `CONFIG.tips`): radar, hit arcs
  (`damageHero(h, amount, src)`; src = zombie / position, else nearest attacker), garden alert, straggler pips, one-time
  tips (localStorage), H help panel from `PLANTS[type].info`. Pacing: `CONFIG.hurry` (far horde zombies walk faster).
  Audit + rationale: docs/experience.md. Test: `tests/experience.cjs`.
- Camera (`CONFIG.camera`): plant sits low-left (`shoulder`, `lift`); `clearZone` slides the shoulder out if the
  plant's silhouette reaches the crosshair; allies blocking the camera hide (`hideBlockingAllies`, `allyBlock`).
  Walls/cover (`camera.walls`, `placeCameraBoom` + `freeFraction`): shoulder and boom sweep `solidAt` (no zombie
  shields), snap in / ease out, keep a clear line to the plant, shrink together; own plant hides when the lens is on it.
  Human jumps have landing buffering / ledge grace (`CONFIG.movement`). Tests: `tests/controls.cjs`, `tests/camera-walls.cjs`.
- Music (section "Music" inside the audio module, `CONFIG.music`): procedural 16-step sequencer; mode calm / combat /
  boss / off from match state fades layer gains. Music volume setting. Feedback: `callout()` for wave start / clear /
  boss, pooled damage numbers (`spawnPopup` style: yours / 'minor' allies (numbers off: `feedback.allyDamageNumbers`) / 'kill'). HUD writes go through
  `setText` / `setHtml` (DOM only on change). Polish audit: docs/experience.md. Test: `tests/polish.cjs`.
- HUD v2 / Menu v2 (stylesheet sections, appended last so they override): information only when it matters, toggled by
  body classes set in `updateHud` (`betweenWaves`, `firstWave`, `soloSquad`; FPS always shows) and `matchOver` / `settingsOpen`.
  Top strip = garden bar + `renderWavePips` + `#waveLine` + `#waveTags`; things under it follow `--topB`. `#opsHud` stays
  hidden (kept for tests). Rationale table: docs/experience.md "HUD and menu redesign". Test: `tests/hud.cjs`.
- Match flow: vanquishes on the player plate (squad total while spectating); `state.stats` (per squad slot, match + wave) via `recordStat` from `damageZombie`/`damageHero`/`downHero`/revive;
  between-waves summary (`showWaveSummary`: totals + MVP, under the countdown banner) and end-of-match table (`showMatchStats`).
- Spectator: discreet Watch squad menu button makes every selected plant AI; `spectator.view` = plant (default: the
  player camera + full HUD aimed by the AI via `followPlantAim`; feedback via `ownsView(h)`) / orbit / free. Tab / [ ] /
  1–4 watch plants; F cycles views, R plant view; orbit: mouse + wheel; free: WASD + E/Q fly, Shift faster; Esc pause.
  Tuning: `CONFIG.spectator`; docs/spectator.md; test: `tests/spectator.cjs`. Spectating awards no mastery or saved wins.
- Engagement (`CONFIG.engagement`, docs/gw2-engagement.md): menu weapon sidegrades; saved class mastery (XP only for the currently controlled plant; levels/titles,
  no power gating); assists, healing/revive XP and per-hero vanquish chains; themed waves remix base packs. No bonus missions.
  `advanceQuietPack` shortens quiet gaps only for a healthy squad. Test: `tests/engagement.cjs`.
- Difficulty presets `CONFIG.DIFFICULTY` (`DIFF()`, locked per match in `state.difficulty`): zombieHp (scales hits in
  `damageZombie`), zombieDamage (`damageHero`), statueDamage (per-frame statue loss in `loop`), count (`scaledCount`).
  Wave tuning was eased zombie-side in v1.27.1 (Normal = 1×; levers in docs/balance.md "Wave difficulty").
- Settings (`CONFIG.settings`, `SETTINGS` in localStorage): sensitivity, volume, music, camera motion, FOV, quality;
  menu + Esc pause panel; systems register appliers with `onSettings()`. Focus loss pauses and clears input.
- Debug keys only with `?debug` (or `?autoplay`): F1 AI overlay, Shift+1–8 spawn packs, Shift+0 all agents, N next wave,
  B/V bosses, M map, K stress horde. 1–4 always take a plant, H help.
  `window.__game` exposes state and hooks. Browser tests: `tests/*.cjs` (Playwright), served by `tests/lib/game-server.cjs`
  (the patched page + repo files). `npm test` = the short tests in pairs (~6 min); `npm run test:full` adds the slow real-time runs listed in `SLOW` (tests/run-all.cjs: boss-finale,
  experience, full-match, polish, cactus). Keep new tests short (one boot, simulated steps, no real-time waits).

## Code rules
- All tuning numbers live in `CONFIG` (`src/config.js`); waves are data, never hardcoded logic.
- Keep code readable and commented; match the surrounding style.
- New zombie = `ZOMBIE_TYPES` entry + its own behavior function. New hero = `CONFIG.PLANTS` + `PLANT_TYPES` hooks.
- Damage: zombies via `damageZombie()`, plant areas via `explodeAt()`, enemy areas via `enemyBlast()`, heroes via
  `damageHero()`, the garden statue via `damageStatue()` (difficulty, hit flash, garden alert).
