# Wave 5: Gargantuar

`miniBoss` now uses `behavior: 'gargantuar'` and `CONFIG.GARGANTUAR`. It stays in the third pack of wave 5; the B debug key also spawns it. Boss counts remain independent of squad size.

## Art and animation

The supplied image guides the silhouette, olive skin, unequal eyes, broken teeth, torn brown vest, red leather harness, rope belt, dark trousers, heavy boots, telephone pole and red-shirted Imp in a metal bin. Everything is procedural geometry, including the arm surfaces, facial folds, fingers, nails, rope strands, cloth tears, buckles, rivets, corrugations, wood grain and ceramic insulators. Small bump textures are generated locally on canvas.

The model has independently animated legs, shoulders, head, jaw, eyelids, bin and rider. Walking includes weight shifts, breathing, head movement, rider bounce and positional footfalls. Attacks have distinct anticipation, impact and recovery poses. The defeated body falls, lands with a heavy sound, then fades. Static details are batched per bone and material: approximately 366,000 triangles in 78 meshes, with template geometry shared across instances and separate hit-flash materials. This is a detailed procedural recreation, not the original game's asset or a claim of production AAA equivalence.

## Combat and fidelity

The [GW2 Gargantuar reference](https://plantsvszombies.wiki.gg/wiki/Gargantuar_%28Boss%29) describes a pole slam, a roar and charge ending in a smash, and an explosive Imp projectile. It reports 40 damage for the melee attacks and 25 for the Imp, knockback with ability disruption, a pause before charging, and pathfinding toward the plant's former position. Those attack identities and damage amounts are implemented here.

Movement speed, 3,000 encounter HP, cooldowns, ranges, warning ring, flight trajectory, hit volumes, animation timings and death treatment are adaptations for this game's map and plant roster. No electricity beam or triple-Imp shot is added: those belong to Giga Gargantuar. There is no ordinary firearm.

- The ground slam locks its area when the pole rises. It strikes once after the windup, checks cover and height, knocks plants back and uproots Sunbeam or Pea Gatling. Both human-controlled and AI plants use the same damage path.
- The charge remembers a destination, roars for two seconds, follows a navigation path and ends in a pole slam. It obeys terrain and obstacle collision and stops if blocked. Moving away from the remembered position avoids it.
- The ranged attack crouches and launches the visible rider's matching model on a ballistic arc. Collision is substepped, the explosion checks cover, and its damage is applied only once. The rider returns after a reload interval. Elevated plants remain valid targets.
- The garden can be damaged by slams and exploding Imps. Butter temporarily pauses the boss through the existing stun system. Launched Imps finish their flight if their owner dies; a match reset clears all Imps and corpses.

## Validation

`tests/gargantuar.cjs` runs the actual game in headless Chromium, renders front/side/back/slam views and checks windup timing, single-hit damage, dodging, vertical reach, cover, rooted ability interruption, AI companions, the charge sequence, ranged attacks, high-ground acquisition, garden damage, wave placement, separate instance materials, death and reset cleanup. Use the existing Playwright setup; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium browser.

Preview renders: `gargantuar-front.png`, `gargantuar-side.png`, `gargantuar-back.png`, `gargantuar-slam.png`.
