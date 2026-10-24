# Garden Defense — Agent Guide
**Keep this file small:** short, current facts only; replace outdated lines, never append history.
**Always commit, tag, push:** bump `VERSION` in `index.html` and the version below, commit, tag it, push with tags.

## Game
Third-person wave defense inspired by *PvZ Garden Warfare 2 — Garden Ops*: a squad of plant heroes defends the
garden statue (center, 1000 HP; 0 = lose) on a 440×440 m map against 10 waves of zombies, agents and bosses.

## Current state (v1.17.2)
- Single file `index.html`, three.js 0.160 from unpkg (dynamic `import()`), no build step, procedural geometry and
  WebAudio only (no external models, textures or samples).
- **Loading rule:** the main menu shows instantly. All loading (three.js, map, nav fields, models, templates, shader
  compiles) runs after the squad is chosen, behind the loading screen (section "Main menu + boot"). Anything built
  lazily must be prewarmed in `prewarmAssets()`; per-spawn procedural rigs come from `RIG_POOL` via `takeRig()`.
  `?autoplay` and automated browsers skip the menu gate.
- **No-stutter rules:** never add/remove lights mid-match (borrow `takeFxLight()`); shader programs are pinned and new
  variants compile in parallel behind `updateShaderGuard`; agent rigs are baked (`bakeRig`) templates cloned by
  `cloneRig` (~1 ms); plain zombie bodies and particles draw instanced (`ZOMBIE_BATCH`, `PARTICLE_BATCH`); share
  geometry for per-shot/per-effect meshes instead of building it each spawn.
- Squad: picker = your plant + 0–3 AI companions (Corn, Peashooter, Sunflower, Cactus; default shuffled). `makeHero`
  gives each hero its own stats/weapon/abilities/brain; every hero is driven by `h.input` (human: `readPlayerInput`,
  AI: `PLANT_TYPES[type].drive`). Tab / [ ] switch control. Down → respawn after `CONFIG.squad.respawnDelay` (20 s),
  hold X to revive; squad cards + floating tags show respawn timers. AI rooted abilities are cancelled when stalled
  (`aiRootedWatchdog`); stuck AI plants escalate jump → escape walk → snap (`aiUnstick`, `CONFIG.squad.aiStuck`).
- Hidden garden alert (`CONFIG.gardenAlert`): a zombie hitting the garden becomes the priority target of AI plants
  near home; distant AI plants shrink their roam radius for a while.
- Heroes: data in `CONFIG.PLANTS`, class tuning in `CONFIG.SUNFLOWER` / `CONFIG.PEASHOOTER` / `CONFIG.cactus`,
  Corn in `CONFIG.weapon` / `CONFIG.abilities` / `CONFIG.TEAMMATE_AI`. Docs per hero in `docs/*.md`. AI Cactus fortifies
  the statue with mines/walls (`cactus.ai.fortify`). Plant bullets fly until they hit something or leave the map.
- Zombies: `CONFIG.ZOMBIE_TYPES` (behavior key → `BEHAVIORS`), shared brain `CONFIG.AI`. Tactical agents (Imp, Foot
  Soldier, All-Star, Captain Deadbeard, Super Brainz, Engineer, Scientist) use `thinkAgent` + own kits, tuning
  `CONFIG.AGENTS` (`damageMult`, `sizeMult` 2× size: hitbox scaled in `scaleAgentDef`, models built at base size then mesh-scaled; local rig offsets use `rigHalf`). Bosses (Gargantuar wave 5, Mecha Gargantuar wave 10)
  spawn at a random lane and prefer plants (`heroFirst`). Escort agents: `AGENTS.escort` (chained `moreChance` rolls).
- Map/nav: heightfield terrain + obstacles (`CONFIG.MAP`), 2 m nav grid, static Float64 flow fields per route
  waypoint, A* for AI plants. Spawns/routes in `CONFIG.SPAWN_POINTS`; waves are data in `CONFIG.WAVES`;
  every pack rolls a random spawn + route (`CONFIG.randomPackSpawns`).
- Animation juice (`CONFIG.juice`, section "Animation juice"): layered on every rig after its animator — heroes lean
  into acceleration, flinch on hits, topple/bounce when downed, spring up, pop in on respawn, and play ability gestures
  (`heroAction` → `JH.gestures`); agents flinch away from hits, pop in on spawn and leave a toppling corpse
  (`agentCorpse`, deferred dispose) whose rig joints, found by ref name at spawn (`collectLimpJoints`), spring into a
  per-class `JA.deathPose` and flop on landing. Agent offsets are undone before behaviors (`unJuiceAgent`). Test: `tests/animation.cjs`.
- Camera (`CONFIG.camera`): plant sits low-left (`shoulder`, `lift`); `clearZone` slides the shoulder out if the
  plant's silhouette reaches the crosshair.
- Debug: F1 AI overlay, 1–8 spawn packs, 0 all agents, N next wave, B/V bosses, M map, K stress horde.
  `window.__game` exposes state and hooks. Browser tests: `tests/*.cjs` (Playwright).
- Horde models (section "Horde models"): the 8 basic zombies are sculpted merged meshes, GPU-skinned (16 bones,
  per-instance bone texture) and instanced per type; clips are procedural in `HORDE_MODELS[type].pose/attack` plus
  shared layers (`hordeOverlays`: look, wind-up/strike, flinch, stun, spawn); deaths become `hordeCorpses`.
  Renders: `tests/horde-models.cjs` → `docs/horde-*.png`.

## Code rules
- All tuning numbers live in `CONFIG` at the top of the script; waves are data, never hardcoded logic.
- Keep code readable and commented; match the surrounding style.
- New zombie = `ZOMBIE_TYPES` entry + its own behavior function. New hero = `CONFIG.PLANTS` + `PLANT_TYPES` hooks.
- Damage: zombies via `damageZombie()`, areas via `explodeAt()`, heroes via `damageHero()`.
