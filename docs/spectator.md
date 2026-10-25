# Watching a Garden Defense match

Choose a squad normally, then use the small **◉ Watch squad** button beneath **Defend the garden**.
Every selected plant plays itself, including the first slot. After loading, click **Click to watch** to enter the camera.
The same ten waves, boss rolls, difficulty and extraction rules apply. Spectating earns no class mastery or saved victories.

| Control | Action |
|---|---|
| Mouse | Orbit the watched plant (orbit camera) or look around (free camera) |
| Mouse wheel | Adjust orbit distance |
| Tab / Shift+Tab, ] / [ | Watch the next / previous plant |
| 1–4 | Watch that squad slot, including fallen plants waiting to respawn |
| F | Cycle plant view → orbit camera → free camera |
| R | Return to plant view |
| WASD | Fly in free camera |
| E / Space, Q / Ctrl | Fly up / down |
| Shift | Fly faster |
| Esc | Pause; select a plant or camera mode in the pause panel |

**Plant view** (the default) is exactly what that plant's player would see: the regular over-the-shoulder camera,
aimed by the plant's AI (`followPlantAim` eases onto its aim point, so the crosshair sits where it shoots), with the
crosshair, hit / kill markers, ammo, ability cooldowns, class HUDs (scope, Garlic Drone, Rose lock, Chomper hints),
damage vignette, hit arcs, recoil and shake. Camera feedback goes through `ownsView(h)`: the human's plant, or the
watched plant in plant view. Human-only prompts (revive, tips, targeting, mastery) stay hidden.

Switching views leaves each plant's AI, abilities, cooldowns and active objects alone. Plant view and orbit stay with
a fallen plant through its respawn. Orbit and free camera hide the plant HUD; free camera stays inside the map and
above the terrain. The watched plant's health and match vanquishes remain visible, alongside the squad total.

After the match, **Defend again** starts normal play; **Watch squad** starts another spectated match.
Camera tuning lives in `CONFIG.spectator`; `tests/spectator.cjs` covers ownership, input separation, cameras,
plant-view aim alignment, vanquish counters, all ten wave transitions, extraction and normal rematch in one browser boot.
