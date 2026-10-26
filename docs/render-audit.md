# Garden Defense — Rendering System Audit Report

**Date:** 2026-10-25  
**Scope:** `index.html` (24,223 lines) — Three.js rendering, game loop, HUD, camera, animations, effects  
**Engine:** Three.js (WebGLRenderer, PCFSoft shadows, ACES Filmic tone mapping)  

## Status (v1.30.1)

| Finding | Status |
|---------|--------|
| C1 pea / kernel shot meshes | Fixed: `takeShotMesh` / `freeShotMesh` pool per geometry + material |
| H1 / H2 / animator + input + camera `right` vectors | Fixed: `yawForward(yaw, out)` with scratch vectors |
| H3 `damageMultiplierFor` | Fixed: scalar maths, no allocation |
| H4 thistle clones | Fixed: `thistlePool` |
| M1 particle allocations | Fixed: `particlePool`, swap-remove, round-robin recycle at the cap (no `shift()`) |
| M2 obstacle loops | Fixed: `OBST_GRID` buckets (`obstaclesNear`) for `solidAt`, `groundAt`, `losClear`, `asSolid` |
| L1 frame cap | Not done on purpose: rAF already follows the display, and a cap would add input latency on 120/144 Hz screens; allocations no longer scale with frame rate after the fixes above |
| L2 distance update culling | Not done on purpose: off-screen zombies still path, attack the garden and need correct AI; their render cost is already cut by instancing + horde LOD |
| (new) horde triangle load | Fixed: far horde zombies draw a coarse sculpt (`CONFIG.render.hordeLod`, ~3.5× fewer triangles; 240 zombies 3.9 M → 2.2 M triangles per frame) |
| (new) route planner frame peak | Reduced: the A* deadline is checked every `AI.path.chunk` (150) nodes instead of 400 |

---

## Executive Summary

The rendering system is generally well-architected with several strong optimizations already in place (rig baking, instanced particle batches, FX light pooling, guarded DOM writes). However, **eight performance bugs and anti-patterns** were identified across four categories (one previously-reported finding — C2 — was corrected as already fixed):

| Severity | Count | Category |
|----------|-------|----------|
| **Critical** | 1 | Per-frame Mesh allocation / GC pressure |
| **High** | 3 | Per-frame Vector3 allocations in hot paths |
| **Medium** | 2 | Unbounded iteration / CPU cost |
| **Low** | 2 | Missing frame budget / culling guards |

---

## Critical Findings

### C1. New THREE.Mesh per Pea Shot — JS GC Pressure (Not GPU Leak)
- **File:** `index.html`
- **Line:** 10584 (`firePea`)
- **Code:**
  ```javascript
  const mesh = new THREE.Mesh(peaShotGeo, peaShotMat); mesh.position.copy(start);
  mesh.scale.setScalar(gatling ? 0.085 : W.kernelRadius); scene.add(mesh);
  ```
- **Problem:** Every pea shot creates a new `Mesh` object. The geometry (`peaShotGeo`, line 10532) and material (`peaShotMat`, line 10533) are shared singletons and are **not leaked**. The mesh is removed from the scene at line 22359 (`scene.remove(p.mesh); projectiles.splice(i, 1);`) and becomes JS-GC-eligible. With gatling fire rates (dozens of shots/sec across multiple heroes), this generates JS object allocation pressure but **no GPU memory leak**.
- **Impact:** During sustained fire, frequent micro-GC pauses may cause frame drops. Lower severity than originally reported.
- **Fix (optional):** Use an object pool of reusable pea-shot meshes. On "death," return to pool instead of removing from scene. Reduces JS allocation pressure, not a memory leak fix.

### C2. ~~Effect Materials Never Disposed — Memory Leak~~ (CORRECTED: Already Disposed)
- **File:** `index.html`
- **Line:** 9427 (`updateEffects`)
- **Actual Code:**
  ```javascript
  if (k >= 1) { scene.remove(e.mesh); e.mesh.material.dispose(); effects.splice(i, 1); }
  ```
- **Resolution:** This finding was **incorrect**. The material IS disposed at line 9427. The geometry is shared (`EFFECT_GEO` singleton), so it is correctly not disposed. No fix needed.

---

## High Findings

### H1. Vector3 Allocation in `animateCorn` — Per-Frame Allocation
- **File:** `index.html`
- **Line:** 10471
- **Code:**
  ```javascript
  const fwd = yawForward(h.yaw);
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  ```
- **Problem:** `right` is allocated every frame for a hero that is almost always on screen. Used exactly once for `leanS`. The `new THREE.Vector3()` allocation happens every frame for every corn plant.
- **Impact:** With dozens of corn plants active during horde waves, this is dozens of Vector3 allocations per frame.
- **Fix:** Add a pooled `_cornRight` Vector3 on the hero or game state. Reuse via `right.copy(pooled).setX(-fwd.z).setZ(fwd.x)`.

### H2. Vector3 Allocation in `animateSunflower` — Same Pattern
- **File:** `index.html`
- **Line:** 10419
- **Problem:** Identical pattern — `new THREE.Vector3(-forward.z, 0, forward.x)` allocated once per sunflower per frame, used exactly once for `leanS`.
- **Fix:** Same approach — pooled Vector3.

### H3. Vector3 Allocations in `damageMultiplierFor` — Per-Hit Allocations
- **File:** `index.html`
- **Lines:** 22280-22281
- **Code:**
  ```javascript
  const facing = new THREE.Vector3(Math.sin(z.mesh.rotation.y), 0, Math.cos(z.mesh.rotation.y));
  const incoming = shotVel.clone().setY(0).normalize();
  ```
- **Problem:** Called from every projectile-zombie hit. Both `facing` and `incoming` are allocated per hit. During horde waves with hundreds of hits/sec, this is significant.
- **Impact:** Hundreds of Vector3 allocations per second during peak combat.
- **Fix:** Add a pooled `_damageFacing` Vector3 and reuse `shotVel` directly without cloning when possible.

### H4. Thistle Template Clone per Shot
- **File:** `index.html`
- **Line:** 11271 (`fireMagicThistle`)
- **Code:**
  ```javascript
  const mesh = THISTLE_TEMPLATE.clone();
  ```
- **Problem:** Clones the entire thistle `Group` (with all child meshes and materials) for every magic thistle shot. `Group.clone()` is deep — it copies the hierarchy, materials, and transforms.
- **Impact:** Moderate GC pressure during sustained thistle use.
- **Fix:** Use an object pool of thistle meshes, or clone only the minimal needed geometry.

---

## Medium Findings

### M1. Particle Allocations — Four Objects per Particle
- **File:** `index.html`
- **Lines:** 9346-9350 (`spawnParticle`)
- **Code:**
  ```javascript
  new THREE.Color(color),
  pos.clone(),
  new THREE.Euler(...),
  new THREE.Vector3(...)
  ```
- **Problem:** Each particle spawns four object allocations. During burst effects (explosions, death animations), dozens of particles spawn simultaneously, each with four allocations.
- **Impact:** Burst-heavy moments cause allocation spikes that trigger GC.
- **Fix:** Pool `Color`, `Euler`, and `Vector3` objects. Use `pos` directly if the original position isn't needed.

### M2. `solidAt` — Unbounded CPU Cost from Obstacle × Projectile Cross-Product
- **File:** `index.html`
- **Lines:** (projectile update loop)
- **Problem:** CPU cost is O(obstacles × projectiles × substeps). With ~20-50 obstacles and ~20-50 projectiles at 4 substeps: **400–2,500 collision checks per frame**. No spatial partitioning is used.
- **Impact:** During horde waves with max projectiles and many cliff/ledge obstacles, this becomes a significant CPU burden.
- **Fix:** Add spatial hashing for obstacle queries, or cull obstacles by bounding box before detailed checks.

---

## Low Findings

### L1. No Frame Rate Target / Cap
- **File:** `index.html`
- **Lines:** 23989-23991 (game loop)
- **Code:**
  ```javascript
  if (AUTOPLAY) setTimeout(loop, 16); else requestAnimationFrame(loop);
  ```
- **Problem:** No frame rate cap. On 144Hz+ displays, the game runs at 144fps, multiplying all per-frame allocations by 2.4× compared to 60fps. Background panes use `setTimeout(loop, 16)` (~60fps cap) but the main game loop is uncapped.
- **Impact:** On high-refresh displays, all per-frame allocations (Vector3, Mesh, etc.) scale with refresh rate. Battery/thermal throttling on laptops.
- **Fix:** Add a frame cap (e.g., 120fps via `setTimeout` with delta tracking, or `renderer.setAnimationLoop` with delta gating).

### L2. No Frustum-Based Culling for Entity Updates
- **File:** `index.html`
- **Lines:** 23994-24022 (main loop)
- **Problem:** The game loop iterates ALL heroes, ALL zombies, ALL projectiles regardless of screen position. Three.js frustum culling handles rendering, but the JS-side update loop processes off-screen entities.
- **Impact:** During spectator mode or wide camera angles, many entities are processed every frame despite being off-screen.
- **Fix:** Add a simple distance check (e.g., `dist > 80`) to skip entity updates for out-of-range zombies.

---

## Architecture Notes (Not Problems)

### What's Done Well

1. **Rig baking (`bakeRig`)** — Merges 200-300 small meshes per zombie rig at boot into single draw-call-efficient meshes. Reduces thousands of draw calls to hundreds.

2. **Instanced particle batches (`PARTICLE_BATCH`)** — Each batch is one draw call regardless of particle count.

3. **FX light pooling (`FX_LIGHTS`)** — All effect point lights pre-created at boot with intensity 0 when idle. Avoids mid-match shader recompilation.

4. **Guarded DOM writes** — `setText` and `setHtml` skip DOM updates when value unchanged. Prevents unnecessary style/layout recalculation.

5. **Radar throttled to 15 Hz** — Radar iteration over all zombies is capped, not every frame.

6. **No render-to-texture overhead** — Single `renderer.render(scene, camera)` pass. No `RenderTarget`, `EffectComposer`, or post-processing pipeline.

7. **Shared effect geometries** — `EFFECT_GEO` singleton (sphere, ring, decal) reused across all effects.

8. **Shadow optimization** — Meshes smaller than a shadow-map texel are disabled from casting shadows. Single directional light with 2048×2048 shadow map.

### Camera System
- FOV updated only if change > 0.01 degrees (guarded).
- Pivot interpolation via exponential smoothing (no jitter).
- Camera blocking allies check iterates all heroes — unavoidable for correct occlusion.
- Trauma shake: two sine waves per axis — cheap math, negligible cost.

### HUD System
- FPS display every 250ms.
- World health bars every frame for active heroes + garden statue.
- Ability cooldowns iterates all ability keys per frame — cheap math, DOM writes guarded.

---

## Priority Fix Order

| Priority | Issue | Estimated Fix Effort | Expected Impact |
|----------|-------|---------------------|-----------------|
| **P0** | C1: Pea shot Mesh allocation | 15 min | Eliminates GC spikes during fire |
| **P1** | H3: `damageMultiplierFor` Vector3 | 5 min | Reduces per-hit allocations |
| **P1** | H1/H2: Animate Vector3s | 10 min | Reduces per-frame allocations |
| **P2** | M2: `solidAt` spatial partitioning | 30 min | Reduces CPU during horde waves |
| **P2** | H4: Thistle clone pooling | 10 min | Reduces moderate GC pressure |
| **P3** | M1: Particle object pooling | 20 min | Reduces burst allocation spikes |
| **P3** | L1: Frame rate cap | 10 min | Reduces all per-frame costs by ~50% |
| **P3** | L2: Distance-based update culling | 15 min | Reduces off-screen entity cost |

---

## Methodology

This audit was conducted by:
1. Reading the full `index.html` source (24,223 lines)
2. Scanning for allocation patterns (`new THREE.`, `clone()`, `Instantiate`, etc.) in hot paths
3. Analyzing the game loop, camera, HUD, and animation update frequencies
4. Cross-referencing draw call paths, shadow costs, and particle batch systems
5. Reviewing memory lifecycle (creation → usage → disposal) for all persistent objects

