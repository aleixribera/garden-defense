# Kernel Corn companion behavior

This recreation targets **the friendly Kernel Corn companion in GW2 Garden / Solo Ops**.
It does not use the enemy Corn hero's Graveyard Ops behavior as a substitute.

## Evidence

- [Firsthand Solo Ops teammate observations, September 2024](https://www.reddit.com/r/PvZGardenWarfare/comments/1fi89ix/): Corn prioritizes nearby zombie bosses unless ordinary zombies overwhelm him. The same account distinguishes base-defending snipers from roaming and attacking classes.
- [EA's GW2 manual, pages 9 and 12](https://eaassets-a.akamaihd.net/eahelp/manuals/pvz-garden-warfare-2-manual_Sony%20PlayStation%204_ukanz.pdf): confirms Ops with AI allies and Corn's Cob Busters, Butter Barrage, Husk Hop, and Shuck Shot. It does not disclose companion targeting thresholds, navigation, or ability conditions.

The online material does not expose PopCap's original AI logic or numeric thresholds. An exact reproduction cannot be verified from these sources. Distances, timing, navigation, and ability decisions below are explicit adaptations to Garden Defense's terrain and existing abilities.

## Implementation

- Roam outward and pursue local fights rather than maintain a statue guard post. Low health does not trigger a retreat to the statue.
- Rank nearby bosses ahead of ordinary enemies. A local swarm overrides that preference until the immediate pressure subsides. Priority changes bypass the ordinary retarget cooldown.
- Keep the smooth firing system: readiness and some settled accuracy carry between targets, similar-priority targets favor small aim changes, and the actual next muzzle must have a clear firing ray.
- Perceive visible enemies or hear enemies at close range; briefly search an enemy's last sensed location after losing sight. No indefinite tracking or shooting through cover.
- Approach along walkable ground and A* paths. Firing positions are sampled around the enemy, rather than around the statue.
- Use Shuck Shot against bosses, armor, and clusters; Butter Barrage on visible bosses or groups anywhere within range; Husk Hop offensively through nearby enemies with a checked landing. Remove random movement hops and idle ability spending.
- Keep shared weapon stats, ability mechanics, damage rules, cooldowns, death, revive, and respawn handling. This change concerns companion decisions.

All new behavior tuning lives in `CONFIG.TEAMMATE_AI`. In particular, the swarm count, awareness, hearing, memory, patrol distances, and ability thresholds are our choices, not measured GW2 constants.

## Validation

`tests/corn-ops.cjs` runs browser scenarios against the actual game module without its animation loop. It requires Playwright and a Chromium installation. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using a separately installed browser. The test's module can be located through standard Node `NODE_PATH` if Playwright is installed outside this repository.
