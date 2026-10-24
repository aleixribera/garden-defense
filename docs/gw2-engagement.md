# Why GW2 keeps a defense match lively

Research and implementation audit for Garden Defense v1.25.0 (25 October 2026).
“Addictive” is treated here as engaging, varied and worth replaying. These are design inferences from documented
systems and contemporary criticism, not a measured claim about player psychology.

## Findings and sources

The [official GW2 manual](https://eaassets-a.akamaihd.net/eahelp/manuals/pvz-garden-warfare-2-manual_PC_na.pdf)
describes complementary classes and variants, participation XP for combat and support, character levels and promotions,
quests with immediate rewards, and ten-wave Ops with bonus challenges and bosses. These create several concurrent goals:
keep the garden alive, contribute through your class, finish a smaller task, and move toward the next personal milestone.
The class roster changes how the same situation is approached; progression makes even an unsuccessful attempt count.

[GameSpot’s GW2 review](https://www.gamespot.com/reviews/plants-vs-zombies-garden-warfare-2-review/1900-6416360/)
highlights mechanical diversity, counters, ability-driven action, teamwork, and maps with hazards, bottlenecks and height.
It also criticizes repetitive solo missions and slow, random unlocks. The useful lesson is to vary decisions and encounters,
reward contribution promptly, and keep class experimentation accessible. Copying a long unlock grind would work against that.

[GamesRadar’s GW2 review](https://www.gamesradar.com/plants-vs-zombies-garden-warfare-2-review/)
emphasizes comic kill feedback, layered progression goals, contrasting classes and expressive presentation. Its account
supports a practical inference: frequent, legible acknowledgments help connect a player’s action with its result. Feedback
should celebrate achievements without obscuring enemy attacks or taking control away.

[EA’s Backyard Battleground announcement](https://news.ea.com/press-releases/press-releases-details/2015/Plants-vs.-Zombies-Garden-Warfare-2-Introduces-More-Ways-to-Play-With-New-Backyard-Battleground/default.aspx)
describes a hub with dynamic events, exploration and quests. The relevant principle for this smaller game is to layer
optional activities over the main fight. A separate online social hub would require a different product scope.

## Implementation map

| Principle | Existing foundation | v1.25 implementation |
| --- | --- | --- |
| Distinct tactical identities | Four weapons, full ability kits, switching and autonomous squadmates | One primary-weapon sidegrade per class, selected per slot before play. All options immediately available. |
| Small goals within the big goal | Garden defense and extraction | Optional garden guard, timed clear, contested supply circle, and marked bounty challenges. Failure never loses the match. |
| Encounter variation | Mixed horde, tactical agents, random routes and boss slots | Sprint Convention, Bucket Brigade and Spit Take remix selected waves, with a tactical hint and preview. |
| Contribution beyond kills | Healing, reviving, per-slot statistics | Assist and actual-healing credit, support XP, revive XP, and support-aware MVP scoring. |
| Immediate recognition | Hit/kill markers, damage numbers, sounds, animation and callouts | Bounded reward feed, per-hero timed vanquish chains and level-up feedback. |
| Longer goals | Match summary and coins | Saved per-class XP, ten mastery levels, titles, victory count and bonus medals; current progress in menu and HUD. |
| Tension and release | Pack timing, shops, boss waves, extraction | Healthy squads advance quiet packs; bosses, agents, garden danger, injuries and fallen allies preserve breathing room. |
| Risk and reward | Leave home to fight; buy defenses between waves | Supplies draw one volunteer away, are contested by enemies, and reward shared coins and controlled-plant XP. |
| Readable spatial decisions | Heightfield, cover, routes, radar, attack directions | Gold objective outline, world label, distance/bearing, countdown and capture progress. |
| Personality and team spectacle | Procedural art, gnome garden, class animations, music | Playful wave identities and chain celebrations reuse the existing audiovisual vocabulary. |

## Rules and balance

All new tuning is in `CONFIG.engagement`. Sidegrades multiply a fresh copy of the base primary weapon, never an already
modified copy; health and abilities remain intact. Corn trades cadence/ammo for impact; Peashooter trades individual
impact for rate/ammo; Sunflower trades cadence/ammo for accurate heavy pulses; Cactus trades damage/precision for follow-up
shots. Pots retain their existing weapon balance. Loadouts persist through respawns and control switches within a match.

Mastery records only the currently player-controlled hero’s contributions locally; AI companions earn no XP, including
when they share the player’s class. Switching control changes which hero can earn XP. XP rewards kills, qualifying recent assists, effective
healing of other plants, revives, wave clears, bonuses and extraction victory. It unlocks recognition, not combat power.
No daily attendance requirement, decay, randomized purchases, or time-limited unlocks are introduced. Save writes are
batched and flushed on level-ups, wave clears, match end and hiding/leaving the page. Unavailable storage leaves play functional.

Themes replace only part of ordinary shambler packs. Counts stay unchanged; original wave data and boss packs stay intact.
Types respect their normal introduction wave. Boss slots, extraction, potted defenses, existing music and weapon feedback
already express the relevant GW2 principles and are preserved.

Bonuses pay once, with a modest shared-wallet reward and XP for the currently controlled plant. Supply positions must
have connected navigation and an actual path; only one healthy non-medic AI volunteers, and garden danger takes priority.
Bounties mark an existing enemy instead of adding an unbudgeted pack. Repair cannot reverse a failed guard objective.
The reusable gold marker is built and compiled behind the loading screen, with no new lights or runtime shader variants.

## Verification and remaining judgment

`tests/engagement.cjs` exercises sidegrade lifecycle, assists, capped effective healing, revives, chain timing, persistence,
theme invariants, objective payouts/failures, contested capture, AI volunteering, safe pacing, and the real menu loading gate.
It saves menu and gameplay views to `docs/engagement-menu.png` and `docs/engagement.png`. Existing browser regressions cover
economy, combat, squad ownership, awareness, bosses and complete match flow.

Validation result: all 21 browser suites passed (run in groups), including the ten-wave autoplay match and extraction.
The engagement suite also checks bounded Z-Mech damage credit through ejection, support MVP scoring, rematch loadouts,
and corrupted/disabled storage. Module syntax and Git whitespace checks passed. Both new preview images were inspected.

Automated checks establish behavior and integration. Human playtesting is still needed to judge preferred loadouts,
challenge generosity, match excitement and whether HUD information is comfortable over a whole match.
