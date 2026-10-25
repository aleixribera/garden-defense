# Roster balance — v1.27.0

Every plant should earn its squad slot, including when controlled by the player. Preserve different jobs rather than
giving every class the same DPS. This pass changes plant power, not enemy health or difficulty presets.

## GW2 reference research

Inspected 25 October 2026: FlameCaster's [GW2 Stats](https://gw2-stats.netlify.app/about), the interactive weapon tables
by the author of the original DPS chart. These are the site's **Current Patch**, distance **0**, unmodified stock
weapons, body damage, no upgrades. Damage includes splash on the directly hit target. Small decimal fractions are
reported as displayed; these are reference data, not values to copy blindly into this adaptation.

| Stock plant | HP | Damage / shot | Shots / minute | Burst DPS | Clip / reload |
|---|---:|---:|---:|---:|---|
| [Kernel Corn](https://gw2-stats.netlify.app/characters/kernel-corn/stats) | 150 | 7.6 | 575 | 72.83 | 45 / 2.5 s |
| [Peashooter](https://gw2-stats.netlify.app/characters/peashooter/stats) | 125 | 25.1 impact + 10.1 splash | 100 | 58.67 | 10 / 1.5 s |
| [Sunflower](https://gw2-stats.netlify.app/characters/sunflower/stats) | 110 | 9.1 | 370 | 56.12 | 50 / 2 s |
| [Cactus](https://gw2-stats.netlify.app/characters/cactus/stats) | 125 | 25.1 | 150 | 62.75 | 12 / 2 s |
| [Citron](https://gw2-stats.netlify.app/characters/citron/stats) | 200 | 9.1 impact + 2.1 splash | 400 | 74.67 | Heat |
| [Rose](https://gw2-stats.netlify.app/characters/rose/stats) | 100 | 9.5 | 270 | 42.75 | 20 / 2 s |
| [Chomper](https://gw2-stats.netlify.app/characters/chomper/stats) | 175 | 25 | 135 | 56.25 | No reload; 4 s digestion |

Also checked the original [PopCap beta-to-launch tuning notes](https://forums.ea.com/discussions/plants-vs-zombies-franchise-en/gw2-tuningbalance-notes-feedback-from-beta/10150177)
and [Trouble in Zombopolis Part Two notes](https://forums.ea.com/discussions/plants-vs-zombies-franchise-en/introducing-trouble-in-zombopolis-part-two-and-community-challenges/10250531).
These are historical changes, not current-patch stat sheets: they establish intentional weapon, heat, magazine and
survivability tradeoffs. The source game itself changed those values over time.

Useful reference relationships: Sunflower is a credible shooter as well as a medic; Corn is a sustained-fire soldier,
not several times stronger than the medic; Cactus keeps damage at range; Citron trades range damage for tank tools;
Rose sacrifices raw output for tracking and control; Chomper must get into melee and survive digestion.

## Decisions for this mode

The 440 m map, persistent waves, projectile/capsule collision and sparse natural healing make a literal PvP port
unsuitable. These numbers deliberately adapt the roles:

- **Corn:** primary 12 every 0.075 s → 9 every 0.09 s; clip 60 → 50, reload 1.7 → 1.9 s. Still the strongest ranged
  sustained shooter in the controlled benchmark. HP 125 → 150 restores soldier durability. Shuck Shot remains a
  six-missile volley, but 35 per missile / 16 s cooldown replaces 45 / 9 s. Husk Hop cooldown 7 → 12 s. Butter Barrage
  becomes ten 32-damage pats / 28 s cooldown / 1.5 s stun, replacing twelve 40-damage pats / 18 s / 2.5 s stun. It can
  still burst packs and bosses without monopolizing damage, mobility and repeated crowd control.
- **Peashooter:** 0.34 → 0.44 s between peas, 27 impact + 12 splash instead of 25 + 15, splash radius 4 → 3.5 m.
  A slightly harder impact rewards direct shots; slower, tighter splash reduces effortless pack deletion. Gatling
  damage 12 → 10 (133 raw DPS); Bean Bomb and Hyper remain strong reasons to pick the class.
- **Sunflower:** 10 damage every 0.14 s instead of 8 every 0.15 s. Minimum damage 4 → 6, falloff 20–60 → 30–65 m.
  Heal Beam 10 → 14 HP/s and sundrops 5 → 7 HP each. Still 110 HP and still vulnerable when rooted; can fight alone,
  and healing competes with incoming pressure. Sunbeam's high output already pays for deployment and immobility.
- **Cactus:** body shots 25 → 32; critical multiplier 2 → 1.75, giving 56 head damage instead of 50. This raises
  the ordinary player's floor while preserving precision's reward. Mine recharge 30 → 24 s. Repeater Spikes retains
  its lower damage/accuracy but critical multiplier scaling improves 0.75 → 0.9 so its penalties do not compound
  excessively. Drone and walls already provide substantial utility.
- **Citron:** beam 12–6 → 13–7, heat per tick 0.052 → 0.045. Roughly 3.3 s firing before overheat, with the same
  cooling delay and lockout. **No damage-range cutoff:** any enemy intersected by the ray is hittable; falloff still
  bottoms out at 42 m. The visible beam remains capped at 58 m, without a fake impact/light at its visual endpoint.
  Find the nearest enemy first, then test the world up to that hit. Empty rays terminate after clearing the map;
  Infinity never reaches the world-marching loop. Human reticle aiming also uses the real distant hit instead of
  converging on the previous 150 m aim plane. Cover and intervening enemies still block. AI acquisition expands
  46 → 65 m while retaining its preferred 9–20 m fighting distance. Shield, EMP and rolling retain their tank role.
- **Rose:** damage 14 → 15, reload 1.5 → 1.4 s, projectile speed 46 → 72 m/s, lock range 42 → 55 m and grace
  0.25 → 0.4 s. Thistles now use the shared projectile lifetime rather than disappearing after 1.45 s. AI engagement
  range matches the lock range. She earns damage by landing more of her existing shots; control and Enigma remain
  the defining utility rather than receiving more damage or longer disables.
- **Chomper:** a 50-damage frontal bite now kills a basic 50-HP zombie in one action (previously 46 damage required
  two). Cleave remains limited to two secondary victims at 55%. Digestion 3.2 → 1.6 s, trapped digestion 2 → 1.1 s,
  chewing movement 0.8 → 0.9, swallow healing 20 → 25. HP 175 → 190, speed 9.6 → 10.2; personal recovery starts after
  4 s at 4 HP/s. Melee needs the best contact DPS because travel, exposure and digestion all cost uptime. Bosses and
  machines remain immune to swallowing, and chewing still blocks attacks and abilities.

## Measured validation

`tests/balance.cjs`: one browser boot, fixed random seed, actual firing cadence, hit collision, reload and overheat
code, 12 simulated seconds. Standardized perfect body aim against a stationary high-HP target at 20 m; Chomper at
2.8 m. Abilities disabled by lack of input, no incoming damage. The old column was measured from v1.26.1 with
`node tests/balance.cjs --baseline` before committing. These are fixture results, **not match win rates**, and the
window includes projectile travel and partially completed reload/heat cycles.

| Plant | Before sustained DPS | After sustained DPS |
|---|---:|---:|
| Corn | 120.0 | 75.0 |
| Peashooter (direct + splash) | 94.3 | 72.8 |
| Sunflower | 44.7 | 60.0 |
| Cactus (body) | 50.0 | 64.0 |
| Citron (20 m, heat included) | 47.7 | 52.0 |
| Rose | 56.0 | 62.5 |
| Chomper (frontal bite, no swallowing) | 99.7 | 108.3 |

Additional regression fixtures check distant beam damage at 180 m and across the full map diagonal, nearest-hit
ordering, unchanged visual length, terrain blocking, empty-sky termination, useful long-range Rose fire, one-bite
basic zombie kills, swallow recovery/healing, support healing, and primary damage against the current boss roster.
Seven separate 24 s solo AI fights exercise each kit against the same seeded mixed horde using ordinary targeting,
movement, abilities, enemy attacks and healing. These are contribution/smoke checks, not a claim that every AI can
solo every difficulty or that different team roles should produce identical kill counts.

| Solo AI | Kills / 12 | Damage | HP remaining |
|---|---:|---:|---:|
| Corn | 11 | 1007 | 150 |
| Peashooter | 12 | 1275 | 125 |
| Sunflower | 11 | 1109 | 110 |
| Cactus | 10 | 935 | 125 |
| Citron | 11 | 1247 | 196 |
| Rose | 11 | 1099 | 110 |
| Chomper | 12 | 1275 | 137 |

All seven survived this fixture. Corn retains offensive abilities, Citron's kit compensates for its lower continuous
beam uptime, and Chomper's contact power has a visible health cost. No assertion depends on these exact kill counts.

Validation covered all 17 short browser suites and the additional live Cactus suite. Healing and Cactus damage
assertions now follow the revised tuning; their range, cover, timing, cleanup and control assertions remain intact.
