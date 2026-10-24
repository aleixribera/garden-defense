# Garden Ops economy

Section "Garden Ops economy" in `index.html`, tuning in `CONFIG.economy` and `CONFIG.POTS`.

## Coins
- Every killed zombie drops its value as spinning coin pickups (`coinValue`: zombie 5, agent 20, boss 150;
  per-type override `ZOMBIE_TYPES[t].coins`). Despawns and buried zombies drop nothing.
- One shared squad wallet (`state.coins`, HUD under the wave line). Any standing plant within `magnetRadius`
  pulls coins in, AI companions included.
- Coins left on the ground are collected anyway after `coinLife` and swept up when the wave is cleared.
- Coins draw as one `InstancedMesh` (`maxCoins`), prewarmed with the pot models in `prewarmAssets()`.

## Shop (between waves)
- After each cleared wave the countdown becomes `shopTime` (30 s); **Enter** cuts it to `readyTime`.
- Walk onto a glowing pot spot (ring of 8 around the statue): **C** plants the offered pot, **Z** cycles the type.
- Stand by the statue: **C** repairs `repair.hp` for `repair.cost`.
- Debug: **J** adds 500 coins.

## Potted plants (`POTS.types`)
Stationary and invulnerable; they stay for the rest of the match.

| Pot | Cost | Attack |
| --- | --- | --- |
| Peashooter | 100 | Pea Cannon (`PLANTS.peashooter.weapon` + override), splash |
| Kernel | 125 | Cob Busters (`CONFIG.weapon` + override), fast kernels |
| Snapdragon | 150 | Fire cone, `damage` every `tick` to all zombies inside |
| Chomper | 175 | Swallows the nearest zombie (bosses: `bossDamage`), then chews for `chew` s |

Test: `tests/economy.cjs` → `docs/economy.png`.
