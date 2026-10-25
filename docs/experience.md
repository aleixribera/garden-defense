# Player experience audit (v1.22.0)

A full pass over the game as a player meets it: menu, first wave, the fight, wave breaks, falling, bosses, the finale.
Findings first, then what changed. Tuning lives in `CONFIG.art`, `CONFIG.hudAware`, `CONFIG.tips` and `CONFIG.hurry`.
Test: `tests/experience.cjs` (renders `docs/experience.png` and `docs/world-court.png`).

## Findings

| Area | Problem found | Severity |
| --- | --- | --- |
| Input | Developer keys were live in every match: `1`–`8` spawned zombie packs, `K` a 120-zombie horde, `J` gave +500 coins, `N` skipped waves, `B`/`V` spawned bosses. Players reaching for number keys wrecked their own match. | Critical |
| World | The map was still grey-box: grey checkered terrain, grey boxes for every prop, and the garden statue was a plain grey cube, next to fully sculpted plant and zombie models. | High |
| Awareness | A 440 m map with four spawn areas and no radar, no hit-direction cue and no visible "garden under attack" signal (only a horn). Players could not tell where the horde was or what was eating the garden. | High |
| Pacing | Zombies spawn 95–190 m out and walk at 3.5 m/s: ~25 s of nothing at the start of each wave, then the last 2–5 stragglers wandered for another ~25 s. Wave 1 took ~95 s for ~45 s of fighting. | High |
| Onboarding | Ability names were hidden (`display: none`); the squad picker showed only plant names; nothing explained the shop, reviving or switching plants. | Medium |
| HUD | Ally health bars were world-space planes: an ally beside the camera covered the crosshair with a giant bar (same for the statue bar up close). | Medium |
| Flow | Pause menu had no way out of a match; after loading, the button still read "Defend the garden" though it only grabs the mouse; the menu title was clipped on short windows. | Low |

## Changes

- **Debug keys** only with `?debug` (or `?autoplay`). In a normal match `1`–`4` take control of that squad member.
- **World art** (section "World art", `CONFIG.art`), purely visual over the unchanged collision:
  painted terrain (grass variation, mowing stripes, worn dirt paths along the approaches, dead ground at the zombie
  spawns, gravel quarry shelf, meadows on the wall tops), per-pixel rock strata on cliff faces (ground shader), a paved
  statue court, dressed props (fountain, brick planters with flowers, stone walls, crates, hay, tool shed, greenhouse,
  turning windmill, gate pillars, lookout), instanced trees, boulders, gravestones, grass tufts (hidden on Low quality)
  and flowers, a gradient sky dome with clouds. Static props are merged by material (~100 draw calls total).
- **Garden statue**: a painted gnome on a stone plinth. It flashes and chips on hits, its paint grimes with damage,
  the hat tip breaks off below 50% (reset for each match) and it leans below 25%.
- **Awareness** (section "Situational awareness", `CONFIG.hudAware`): rotating radar (garden, squad, horde,
  agents, bosses, active spawn areas, landing zone; off-range threats on the rim; garden attackers flash), red hit arcs
  around the crosshair pointing at the source (`damageHero(h, amount, src)`), a pulsing "Garden under attack" banner
  with an arrow + distance, and pips over the last zombies of a wave.
- **Pacing** (`CONFIG.hurry`): horde zombies far from the garden and from every plant walk ×1.75; the last six of a wave
  hurry anywhere outside 25 m of the garden. Never bosses, agents, chasers or distracted zombies. Wave 1 with a full
  AI squad: ~95 s → ~50 s.
- **Onboarding**: plant cards in the squad picker (role, pitch, Q/E/F kit), ability names under the ability bar, `H`
  help panel with the controlled plant's full kit and the controls, one-time contextual tips (start, abilities,
  switching, garden attack, revive, downed, boss, extraction) remembered in localStorage.
- **HUD/flow**: world bars keep a steady screen size and hide beside the camera; pause menu "Abandon match"; after
  loading the button reads "Click to start"; the menu scrolls instead of clipping.

## Polish pass (v1.23.0)

A second audit, played in autoplay with the camera following an AI-driven plant. Test: `tests/polish.cjs`.
Menu preview: [polish-menu.png](polish-menu.png).

| Area | Problem found | Change |
| --- | --- | --- |
| Camera | AI companions follow you and often stand between the camera and your plant: a corn cob or sunflower petals filled half the screen. | Allies crossing the camera → crosshair or camera → plant line (or on the lens) hide until they step aside; their health bar stays (`hideBlockingAllies`, `CONFIG.camera.allyBlock`). |
| Audio | No music at all: long shop breaks and big fights had the same sound bed. | Adaptive procedural score (section "Music", `CONFIG.music`): calm marimba + pad during countdowns, bass + drums in a wave (full kit when zombies are near you), minor key + brass + toms for bosses and the extraction. New **Music** volume setting. |
| Feedback | Every hit by every plant spawned a full-size number (DOM node created and destroyed per hit): AI hits cluttered the view. | Your numbers are bigger and pop/drift, kills are biggest, allies' hits are small and dim (culled past 45 m); nodes are pooled and capped at 48. |
| Pacing beats | Wave start and wave clear were a horn and a banner that just vanished. | "HERE THEY COME!" / "WAVE N CLEARED" / boss-name call-outs on a dark band; the next-wave banner waits for the clear call-out; the banner title pops in. |
| HUD | Cooldown numbers sat on a full-brightness emoji; Cactus charges ("3 / 3") covered its icons. Every HUD label was rewritten every frame. | Cooling icons dim; Cactus charges are a corner badge; a slot pops when it comes off cooldown. HUD text/HTML only touches the DOM when the value changes. |
| Readability | Wave banner subtitle ("Incoming…") was dim text on bright sky. | Stronger shadow and brighter text. |
| Menu | Plain black menu and loading screen, no sign of progress while the world builds. | Painted CSS garden backdrop (sky, sun, hills, drifting clouds; no assets, still instant), chunky title and button, compositor-animated loading bar. |
| Effects | Shockwave rings and splat decals were placed at y = 0, so on the mid (3 m) and high tiers they were buried. | They sit on the terrain (`heightAt`). |
| Movement | A jump pressed just before landing or just after leaving a ledge was discarded. | Human-only 140 ms landing buffer and 120 ms ledge grace (`CONFIG.movement`). Each press is consumed once; rooted, floating and Husk Hop states cancel it. |
| Comfort | Continuous bob, roll, shake and movement FOV changes could be uncomfortable. | Saved **Camera motion** slider: zero removes these effects while preserving aim zoom and weapon recoil. |
| Interruptions | Focus loss cleared input but relied on the browser to release pointer lock. | Explicitly release it on blur / hidden-tab events and stop normal gameplay while unfocused. Pending jumps are cleared too. |
| Cactus AI | Fortification or drone deployment could interrupt a clear rifle shot; construction could delay a displaced guard's return home. | Keep the rifle on clear shots, reserve drones for blocked distant targets, and return inside the guard radius before choosing a construction spot. Idle fortification remains active. |

Control regression coverage: `tests/controls.cjs` exercises all four plants, expired presses, double-jump prevention,
focus loss, saved settings, and a stable camera with motion disabled.
