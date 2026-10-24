# Cactus: model, controls and Garden Ops companion

Cactus is a playable, swappable 125-HP sniper. The procedural model follows the supplied reference: fluted trunk, asymmetric raised arms, inset amber eyes with heavy lids, hollow funnel muzzle, clustered areoles/spines, burgundy crown and three cream/rose flower buds. The rind uses procedural pore shading; thorn clusters use instancing. Each rig owns its resources.

## Controls and mechanics

- Spike Shot: 12 rounds, 25 body / 30 critical damage, two-second reload, precise scoped fire with reduced aiming sensitivity. Hits resolve instantly against the nearest enemy capsule or solid cover, up to 340 m. A soft smoke wake appears along the complete muzzle-to-impact path on the same frame, then expands, drifts and fades; there is no travelling Spike Shot mesh. Garlic Drone needles retain distance-based collision stepping.
- Q Potato Mine: three stored charges, one replenishes every 30 seconds. Mines visibly arm, trigger near zombies, take 10 HP of enemy fire and deal up to 175 area damage. At most four placed mines per Cactus.
- E Garlic Drone: remotely pilot with WASD; Space ascends, Ctrl descends, LMB fires needles, Q calls a delayed Corn Strike, E returns. The five-HP drone has a limited flight time and an overheating weapon. The grounded Cactus remains vulnerable. Death or control handoff ends the drone safely.
- F Tallnut Battlement: four stored charges, 30-second replenishment, 200-HP destructible cover. Blocks characters and shots; zombies attack obstructing walls. Placement checks terrain, slope, props and allies. The rigid battlement seats on the highest sampled edge of an allowed slope.

Deployables, remote-control state, ammunition and charge recovery belong to their owner. Human and AI inputs use the same simulation. Match reset disposes every Cactus combat object.

## Online evidence and limits

- [EA's GW2 manual, plant class table](https://eaassets-a.akamaihd.net/eahelp/manuals/pvz-garden-warfare-2-manual_Microsoft%20Xbox%20One_anz.pdf) identifies Spike Shot, Potato Mine, Garlic Drone and Tallnut Battlement. It does not publish the companion decision logic.
- [Solo Ops class-role description](https://plantsvszombies.wiki.gg/wiki/Solo_Ops#Trivia) identifies friendly Cactus and Deadbeard companions as home defenders that keep the base safe. This is community documentation, not original source code.
- [Firsthand EA forum comparison of Ops AI](https://forums.ea.com/discussions/plants-vs-zombies-franchise-en/analyzing-the-ai-of-ops-in-all-3-games/10486713) reports GW2 Cactus staying back, sniping, backing away from approaching opponents and dropping mines; no other abilities were observed. That section describes hostile Cactus in **Graveyard Ops**, not friendly Solo Ops companions. It is corroborating evidence for the sniper's combat style, not proof of every friendly decision.

The requested original behavior cannot be reproduced *exactly* from these public descriptions: they do not expose PopCap's behavior trees, target scores, timings or distance thresholds. The implementation matches the documented friendly defensive role and uses the reported sniper responses conservatively. The selection weights, guard boundary, perception ranges, navigation, aim smoothing, ability balance and timings are explicit adaptations to this map.

## Companion decisions

`driveCactus` is independent of Corn's aggressive roaming AI. It:

- Patrols firing posts near the garden and returns when displaced outside the defensive area. It does not chase targets across the map.
- Holds a clear sniping position and scopes visible targets. Nearby threats take precedence; otherwise it favors enemies approaching the garden, without inheriting Corn's boss preference.
- Backpedals along a checked walkable direction when approached and drops a spaced defensive mine. Low health does not turn it into an assault class.
- Repositions within the defensive area when its firing ray is blocked. Uses local sight/hearing, brief last-position memory, bounded turning and gradual aim settling. Instant shots aim at the target's current position without travel-time leading. It cannot fire through solid cover.
- Does not autonomously launch drones or place battlements. Their use by friendly original AI was not established by the sources. Both abilities remain fully available to the human after switching to Cactus.

All decision thresholds live in `CONFIG.cactus.ai`. Brain state and combat resources remain independent for duplicate Cacti.

## Validation

`node tests/cactus.cjs` runs browser scenarios against the real game module. Playwright must resolve through normal Node resolution (or `NODE_PATH`); `PLAYWRIGHT_CHROMIUM_EXECUTABLE` selects an installed Chromium. Set `CACTUS_SCREENSHOTS` to an output directory to render a portrait of the actual rig.

Coverage includes model detail, movement/jump, instant primary/critical damage, complete smoke creation/fade/cleanup, nearest-hit ordering, cover clipping, buried-target exclusion, remote parrot hits, reload, mine arming and recharge, shallow-slope Tallnut placement and collision/destruction, remote flight and body rooting, independent drone ammunition and overheating/recovery, enemy fire destroying the drone, Corn Strike cooldown, return/death/reset/handoff, long-range sniping, close-threat retreat/mines, defensive patrol bounds, and blocked firing rays. A second browser run exercises the actual animation loop with all four classes, real Q/E/F keyboard deployment, drone altitude controls, return and Tab handoff. Browser script and shader errors fail the suite. `CACTUS_SCREENSHOTS` also captures the smoke on its firing frame and during its fade.
