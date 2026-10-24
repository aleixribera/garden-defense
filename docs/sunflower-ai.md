# Sunflower: model, kit and Solo Garden Ops companion behavior

Sunflower is selectable as the human or any AI squad member, including duplicates.
The sculpted model is entirely procedural: 39 closed petal volumes with longitudinal
grooves, a vertex-colored face with glossy amber-rimmed eyes, smile and freckles,
a ribbed stem, six-point leaf hands, four veined feet, overlapping calyx sepals,
and spiral florets on the back of the head. Each rig owns its materials and expression.

## Controls and kit

- Sun Pulse: automatic primary, 50 shots, 2 s reload, distance falloff and critical hits.
- Q: toggle Heal Beam on an allied plant. Movement and primary fire remain available.
  The tether breaks on death, blocked sight, distance or its usage limit. It cannot heal its owner.
- E: root for Sunbeam, with a separate 100-charge magazine. Hold fire to use the beam;
  E or Space uproots. The 30 s cooldown starts on exit. World surfaces clip the beam.
- F: place a destructible Heal Flower. Over 30 s it produces 12 groups of three
  sundrops; each collected sun restores 5 HP. Injured allies and the owner can collect them.
- Sunflower revives in 3 s rather than the shared 5 s. Revived health remains the
  project's configured half-health policy; the squad's 8 s respawn rule is unchanged.

## Researched behavior and implementation

The research concerns **friendly Solo Garden Ops companions in GW2**, rather than
enemy Sunflowers in Graveyard Ops or the different Battle for Neighborville AI.

| Evidence | Implemented behavior |
| --- | --- |
| The Solo Ops reference describes medic companions as healing teammates despite danger. | Low personal HP and nearby enemies never disable seeking or maintaining an ally's healing. |
| Companion observations describe Sunflower staying near teammates, including when everyone is healthy. | Persistent escort target; follows allies around the map with no garden guard leash. Other Sunflowers are valid partners. |
| Sunflower's kit supports healing and shooting together. | Independent healing tether and enemy aim; cover fire never replaces the escort goal. |
| Sunflower is the plant medic and revives faster. | Approaches fallen allies whose timers allow a rescue, then uses the same revive system as human control. |

Once a patient is selected, the medic stays with that plant until it is fully healed,
dies or becomes unavailable. It then selects another wounded ally, or remains with a
healthy teammate. This avoids retarget flicker and premature abandonment. A distant
patient takes precedence over chasing a zombie, even far outside the central court.
Sunbeam is an offensive support opportunity from the escort position; it is cancelled
when the ally moves away or needs the medic to move. Heal Flowers supply self-healing
and local group healing without interrupting the tether.

## Fidelity limits

Neither EA's manual nor the public companion references publish the original AI
decision tree, path costs, targeting scores, heal thresholds or ability timers.
This reproduces the documented medic role; **it is not a verified exact copy of the
original AI**. Patient persistence, rescue selection and Sunbeam opportunities are
implementation choices consistent with that role. All decision distances, priorities,
navigation cadence and combat feel are this game's tuning in `CONFIG.SUNFLOWER`.
The original multiplayer game's full-health medic revive differs from the explicit
half-health revival rule used by this project.

## Sources

- [EA's GW2 PC manual](https://eaassets-a.akamaihd.net/eahelp/manuals/pvz-garden-warfare-2-manual_PC_na.pdf): Solo Ops and Sunflower's named weapon and abilities.
- [Solo Ops reference](https://plantsvszombies.wiki.gg/wiki/Solo_Ops): class-specific medic companion behavior.
- [Companion behavior observations](https://www.reddit.com/r/PvZGardenWarfare/comments/1fi89ix/): Sunflower staying with teammates. Community observation, not an official specification.
- [Sunflower guide](https://www.trueachievements.com/game/Plants-vs-Zombies-Garden-Warfare-2/walkthrough/3): 110 HP, automatic primary, simultaneous healing/fire, and faster reviving.
- [Sunflower reference](https://plantsvszombies.wiki.gg/wiki/Sunflower_%28PvZ%3A_GW%29), [Heal Beam](https://plantsvszombies.wiki.gg/wiki/Heal_Beam), [Sunbeam](https://plantsvszombies.wiki.gg/wiki/Sunbeam), [Heal Flower](https://plantsvszombies.wiki.gg/wiki/Heal_Flower): kit descriptions and balance context. Entries can mix GW1/GW2 patch values; local constants are explicit adaptations.

## Validation

`tests/sunflower-hero.cjs` runs real Three.js/browser scenarios for independent duplicate
rigs, healing rate, firing while healing, tether range, projectile damage, rooting,
deploy delay, beam damage/ammo/HUD, cancellation cooldown, sundrop healing and flower
expiry, medic persistence under pressure, changing patients after full healing,
supporting other Sunflowers, healthy escort, following beyond the garden, faster
revival, death cleanup, respawning and control handoff. It also renders optional
front/back portraits with `SUNFLOWER_SCREENSHOTS=docs`.
