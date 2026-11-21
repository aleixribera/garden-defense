# Garden Defense — Agent Guide
**Keep this file small:** short, current facts only; replace outdated lines, never append history.
**Always commit, tag, push:** bump `VERSION` in `index.html`, `package.json` and the version below, commit, tag it, push with tags.
A release players can notice also adds its entry at the top of `changelog.json` (players' words; the Arcade page on the home server shows it). Tooling and refactors stay out.
If another session is making changes, only commit, tag, push your changes, and let the other session handle its own changes.

## Game
Third-person co-op wave defense (PvZ Garden Warfare 2 Garden Ops): plant heroes defend the garden statue from 10 waves.
**Systems reference: `docs/systems.md`** (where each system lives, its CONFIG block, docs and test). Read the part you touch.

## Current state (v1.33.1)
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
- **Rules from the systems** (details in docs/systems.md): shared code never checks `h.type` (use the optional
  `PLANT_TYPES` hooks); enemy sizes only via `CONFIG.enemySize` / `scaleEnemyDef`; ramps start exactly on their plateau
  edge; new props = a case in `buildProp`; HUD writes go through `setText` / `setHtml`; pad hint text goes through
  `key()` / `kbd()` / `glyphText()`; spectating awards no mastery or saved wins; debug keys only with `?debug` / `?autoplay`; no shop, potted plants,
  garden repairs, currency, bonus missions or mastery power gating; keep the hidden `#opsHud` (tests read it).

## Tests
- Browser tests `tests/*.cjs` (Playwright, one headless Chromium each) served by `tests/lib/game-server.cjs` (the patched
  page + repo files); `window.__game` exposes state and hooks. Keep new tests short (one boot, simulated steps, no
  real-time waits). Run `tests/gamepad-screens.cjs` after changing any menu. Renders go to `tests/.logs/renders`;
  `DOC_RENDERS=1` refreshes the committed images in `docs/`.
- **Test time budget:** `npm test` (fast tier) <= 150 s, `npm run test:full` <= 270 s on the idle 16-thread laptop;
  the runner prints `TEST TIME BUDGET EXCEEDED` past it (a failure when `CI` is set). A file over 120 s is flagged SLOW.
- While working run only what you touched: `npm test -- routing hud` (file-name prefixes). The slow real-time tier
  (`SLOW` in tests/run-all.cjs: boss-finale, experience, full-match, polish, cactus) runs in `npm run test:full`, once
  before a release. Output is one line per file; a failing file prints its log, all logs are in `tests/.logs/`.

## Code rules
- All tuning numbers live in `CONFIG` (`src/config.js`); waves are data, never hardcoded logic.
- Keep code readable and commented; match the surrounding style.
- New zombie = `ZOMBIE_TYPES` entry + its own behavior function. New hero = `CONFIG.PLANTS` + `PLANT_TYPES` hooks.
- Damage: zombies via `damageZombie()`, plant areas via `explodeAt()`, enemy areas via `enemyBlast()`, heroes via
  `damageHero()`, the garden statue via `damageStatue()` (difficulty, hit flash, garden alert).
