# Watching a Garden Defense match

Choose a squad normally, then use the small **◉ Watch squad** button beneath **Defend the garden**.
Every selected plant plays itself, including the first slot. After loading, click **Click to watch** to enter the camera.
The same ten waves, boss rolls, difficulty and extraction rules apply. Spectating earns no class mastery or saved victories.

| Control | Action |
|---|---|
| Mouse | Orbit the watched plant or look around in free camera |
| Mouse wheel | Adjust follow distance |
| Tab / Shift+Tab, ] / [ | Watch the next / previous plant |
| 1–4 | Watch that squad slot, including fallen plants waiting to respawn |
| F | Toggle follow / free camera |
| R | Return to the default follow view |
| WASD | Fly in free camera |
| E / Space, Q / Ctrl | Fly up / down |
| Shift | Fly faster |
| Esc | Pause; select a plant or camera mode in the pause panel |

Switching views leaves each plant's AI, abilities, cooldowns and active objects alone. Follow mode stays with a
fallen plant through its respawn. Free camera stays inside the map and above the terrain. The watched plant's health
and match vanquishes remain visible, alongside the whole squad's vanquish total. Normal combat controls are hidden.

After the match, **Defend again** starts normal play; **Watch squad** starts another spectated match.
Camera tuning lives in `CONFIG.spectator`; `tests/spectator.cjs` covers ownership, input separation, cameras,
vanquish counters, all ten wave transitions, extraction and normal rematch in one browser boot.
