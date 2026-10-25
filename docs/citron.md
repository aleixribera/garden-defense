# Citron — Tank / bounty hunter

A cyborg orange from the future (PvZ: Garden Warfare 2). In Garden Defense he anchors the line: the highest health in
the squad, a beam that never reloads, a shield the squad can stand behind, and a rolling ball that crosses the map and
bowls through packs. Code: section "Citron combat" (`index.html`), model in "Citron" (sculpt), tuning
`CONFIG.PLANTS.citron` (kit) and `CONFIG.CITRON` (fx, AI). Test: `tests/new-plants.cjs`.

| Slot | GW2 (source) | Garden Defense |
|---|---|---|
| Health | 200 | 200 |
| Primary | Orange Beam: continuous laser, infinite ammo, overheats when held; 400 ticks/min, 2–9 dmg with falloff | Hitscan beam tick every 0.15 s (400/min), 12 → 6 dmg (16–42 m falloff), heat 5.2 %/tick (~2.9 s of fire), 2.2 s overheat lockout, cools after 0.3 s |
| Q EMPeach | 36 s; stuns every zombie in a medium area, 10 + 5/s, Z-Mechs take up to 60 | 26 s; lobbed peach bursts on contact: 8 m stun 3.5 s (bosses 1.2 s), 20 dmg, ×5 vs machines (Z-Mech, turrets, Mecha); lightning arcs to every victim |
| E Citron Ball | instant; fast, no attacks; Spin Dash (charge + launch, 50 to the unaware) | toggle (2 s re-roll cooldown); 2.05× speed, rams for 14 dmg + knockback; hold LMB to charge a Spin Dash (0.75 s), release to launch at up to 30 m/s for up to 65 dmg + big knockback; bosses stop the dash |
| F Peel Shield | 30 s, up to 30 s, absorbs 75; can shoot through it | 24 s (starts when lowered); up to 15 s, absorbs 160 from the front ±60°, destroys enemy projectiles that reach it, 0.72× move speed; keep firing through it |

Horde adaptations: the shield soaks more because Garden Ops packs hit far harder than one PvP opponent; EMPeach bursts
on contact rather than on a timer so it's a reliable panic button; Ball and Shield are exclusive (as in GW2).

**AI** (`driveCitron`): holds 9–20 m from its target in front of the garden and beams the closest threat (garden
attackers first), releasing the trigger at 86 % heat; raises the Peel Shield after taking hits with two or more zombies
within 10 m (or a boss close), lowers it once things calm down; EMPeaches packs of four, or any agent / machine within
24 m; rolls as a ball to travel more than 22 m, and charges a Spin Dash into a clear lane holding three or more.

Sources: [Citron (PvZ: GW2)](https://plantsvszombies.wiki.gg/wiki/Citron_(PvZ:_GW2)),
[GamingTrend class preview](https://gamingtrend.com/feature/previews/plants-vs-zombies-garden-warfare-2-get-to-know-the-new-classes).
