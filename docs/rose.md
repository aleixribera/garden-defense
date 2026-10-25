# Rose — Sorceress / crowd control

A seer from the Dark Ages (PvZ: Garden Warfare 2). She never walks — she floats — and she controls fights rather than
winning them alone: homing thistles, goats, frozen time and an untouchable escape. Code: section "Rose combat", model in
"Rose" (sculpt), tuning `CONFIG.PLANTS.rose` (kit) and `CONFIG.ROSE` (fx, goat pool, AI). Test: `tests/new-plants.cjs`.

| Slot | GW2 (source) | Garden Defense |
|---|---|---|
| Health | 100 (110 upgraded); floats, jumps a little higher | 110; floatier gravity (19 vs 26), more air control |
| Primary | Magic Thistles: automatic, slow homing bolts, ~9 dmg, 20-round clip; homes only while the reticle is on a target | 0.19 s auto, 15 dmg, clip 20, 1.4 s reload; 72 m/s bolts lock onto the zombie nearest the reticle within ~5° and 55 m (kept 0.4 s after it slips) and turn at 7.5 rad/s; shared projectile lifetime, a diamond marker shows the lock |
| Q Goatify | 30–36 s; turns zombies into goats for 7 s; hits a few standing together; not bosses / Z-Mechs | 28 s; 0.32 s cast, then a fast bolt: up to 4 zombies within 3.2 m become wandering goats for 7 s (agents 4 s); bosses, Z-Mechs and turrets are immune; a goat that dies leaves no corpse |
| E Time Snare | 25 s, 1.5 s; slows and disables, stuns bosses | 22 s; thrown orb opens a 7 m time dome for 6 s: zombies at 0.32× speed with slowed wind-ups; bosses are stunned 1.5 s once |
| F Arcane Enigma | 35 s, 18 s; near-invulnerable and faster; area pulses 20 dmg | 32 s (starts when it ends); 6 s untargetable and immune, 1.4× speed, no attacks, a 22 dmg pulse every second within 4.2 m |

Horde adaptations: Time Snare lasts 6 s (1.5 s was a PvP number against single players); Enigma is shorter but fully
untargetable since every zombie in a wave would otherwise pile on her.

**AI** (`driveRose`): back line, 14–26 m from her target, kiting when anything gets within 7 m. Thistles home, so her
aim only needs to be near the target. Goatifies agents, tough bodies and tight packs; Time Snares packs of four or
any boss within 24 m; uses Arcane Enigma below 35 % health with zombies close and drifts back toward the garden.

Sources: [Rose (PvZ: GW2)](https://plantsvszombies.wiki.gg/wiki/Rose_(PvZ:_GW2)),
[Goatify](https://plantsvszombies.wiki.gg/wiki/Goatify), [Time Snare](https://plantsvszombies.wiki.gg/wiki/Time_Snare),
[Arcane Enigma](https://plantsvszombies.wiki.gg/wiki/Arcane_Enigma).
