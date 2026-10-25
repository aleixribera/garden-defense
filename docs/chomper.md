# Chomper — Ambusher / melee

The purple flytrap (PvZ: Garden Warfare). The only melee plant: it bites, and anything it reaches from behind — or that
can't fight back — it swallows whole, then has to chew. Code: section "Chomper combat", model in "Chomper" (sculpt),
tuning `CONFIG.PLANTS.chomper` (kit) and `CONFIG.CHOMPER` (fx, AI). Test: `tests/new-plants.cjs`.

| Slot | GW / GW2 (source) | Garden Defense |
|---|---|---|
| Health | 175 | 190; 10.2 m/s, personal regen 4 HP/s after 4 s out of damage |
| Primary | Chomp: melee bite; swallowing from behind is an instant vanquish, then Chomper chews (vulnerable, no abilities) | Bite every 0.46 s: 50 dmg to the best target in a ±80° cone within 3.4 m, 55 % to two more, small lunge + knockback. From behind (or on a held / stunned / goat zombie) it swallows instead: instant vanquish, +25 HP, no corpse, then 1.6 s of chewing (1.1 s for a Spikeweed catch) at 0.9× speed with no bites or abilities. Never bosses, Z-Mechs or turrets |
| Q Goop | 7 s; slows and blocks abilities for 3 s, 5 dmg over time | 7 s; arcing goo blob, 2.6 m splash: 0.45× speed and no attacks for 4 s, 5 dmg/s (bosses half) |
| E Burrow | 15 s; tunnel, pop up under zombies to swallow them | 14 s (starts on popping up); up to 8 s underground, untargetable and immune, 1.35× speed; LMB / E / timeout pops up: swallows the nearest ordinary zombie within 2.5 m, 35 dmg + knockback to others within 3.4 m, 160 to a boss on top |
| F Spikeweed | 60 s, holds 3 (max 4 out); holds approaching zombies, 25 ×2; swallowing a trapped zombie refunds | 3 charges (18 s each), 4 out at once; arms in 0.5 s, holds the first zombie for 5 s with 25 dmg in and out; bosses just take 50 and break it; swallowing the held zombie refunds a charge |

Horde adaptations: the swallow also works on disabled zombies (held, stunned, goats) so the squad's crowd control feeds
him; chewing is shorter than GW2 because waves never pause.

**AI** (`driveChomper`): hunts the nearest zombie (garden attackers and disabled zombies first, bosses last), circles
to its back when close so the bite becomes a swallow, backs off while chewing, goops agents / garden attackers / packs
6–28 m away, burrows to travel more than 18 m or to escape a mob below 30 % health, and drops Spikeweed at its feet when
swarmed or on the garden approach when idle.

Sources: [Burrow](https://plantsvszombies.wiki.gg/wiki/Burrow), [Goop](https://plantsvszombies.wiki.gg/wiki/Goop),
[Spikeweed (ability)](https://plantsvszombies.wiki.gg/wiki/Spikeweed_(Ability)),
[Hot Rod Chomper](https://plantsvszombies.wiki.gg/wiki/Hot_Rod_Chomper).
