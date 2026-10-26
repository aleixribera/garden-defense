// =====================================================================
// Garden Defense CONFIG — every tuning number lives here. index.html imports it statically (it has no
// dependencies, so the main menu still shows instantly); waves are data (CONFIG.WAVES), never hardcoded logic.
// =====================================================================
export const CONFIG = {
  statue: { hp: 1000, size: 4 },
  // Hidden garden alert: a zombie hitting the garden draws nearby AI plants onto it and pulls distant ones closer
  gardenAlert: { duration: 10, respondRadius: 40, pullScale: 0.55 },
  squad: { maxCompanions: 3, defaultPlayer: 'corn', respawnDelay: 20,
    aiRooted: { maxTime: 8, idleTime: 2 },
    // AI plants that push a direction but barely move escalate: jump + repath → escape walk → snap to an open cell
    aiStuck: { window: 1, minProgress: 0.9, escapeTime: 1, probe: 4, snapStrikes: 3 },   // AI cancels a rooted ability after this long, or after this long without firing
    spawnPoints: [[0, 6], [6, 0], [0, -6], [-6, 0]] },
  // Roster data only: future entries supply their own stats, weapon, abilities and rig / AI hooks.
  // Empty overrides inherit Kernel Corn's existing tuning below. Every hero gets its own copy.
  PLANTS: {
    sunflower: { name: 'Sunflower', weaponName: 'Sun Pulse',
      stats: { hp: 110, speed: 10.8, accel: 15, jumpSpeed: 9.5, reviveMult: 0.6 },
      weapon: { fireRate: 0.14, damage: 10, minDamage: 6, falloffStart: 30, falloffEnd: 65,
        criticalMult: 1.25, clip: 50, reloadTime: 2, kernelSpeed: 260, kernelLife: 0.5,
        kernelRadius: 0.11, spread: 0.012, aimSpread: 0.003, bloomPerShot: 0.0015,
        bloomMax: 0.014, bloomRecovery: 0.09, recoilKick: 0.0013 },
      abilities: {
        shuckShot: { cooldown: 0, range: 12, breakRange: 16, rate: 14, duration: 240, aimCone: 0.55 },
        huskHop: { cooldown: 30, deployTime: 0.8, ammo: 100, fireRate: 0.06,
          damage: 9, minDamage: 7, criticalMult: 1.15, range: 100, radius: 0.12 },
        butterBarrage: { cooldown: 35, duration: 30, hp: 25, interval: 2.5, suns: 3,
          heal: 7, magnetRange: 5, pickupRange: 0.85, sunLife: 9, placeDistance: 1.5 },
      },
      abilityNames: { shuckShot: 'Heal Beam', huskHop: 'Sunbeam', butterBarrage: 'Heal Flower' },
      abilityIcons: { shuckShot: '✚', huskHop: '☀', butterBarrage: '✿' },
      // Squad picker card + H help panel (player-facing descriptions)
      info: { role: 'Medic', blurb: 'Keeps the squad alive and revives fallen plants faster.',
        primary: 'Sun Pulse: fast, accurate sun bolts with a big clip.',
        shuckShot: 'Toggle a healing tether on the ally you aim at.',
        huskHop: 'Root in place and fire a powerful Sunbeam (E or Space to uproot).',
        butterBarrage: 'Plant a Heal Flower that drops healing suns for 30 s.' } },
    corn: { name: 'Kernel Corn', weaponName: 'Cob Busters', stats: {}, weapon: {}, abilities: {},
      abilityNames: { shuckShot: 'Shuck Shot', huskHop: 'Husk Hop', butterBarrage: 'Butter Barrage' },
      abilityIcons: { shuckShot: '🌽', huskHop: '🍃', butterBarrage: '🧈' },
      info: { role: 'Assault', blurb: 'Mobile all-rounder that shreds packs and bosses.',
        primary: 'Cob Busters: twin rapid-fire kernel blasters.',
        shuckShot: 'Fire a volley of six explosive cob missiles.',
        huskHop: 'Leap high (hold Space to glide) and slam down on landing.',
        butterBarrage: 'Aim a butter strike, click to call it: damages and stuns.' } },
    cactus: { name: 'Cactus', weaponName: 'Spike Shot',
      stats: { hp: 125, speed: 7.2, accel: 10, aimSpeedMult: 0.42, jumpSpeed: 8.4 },
      weapon: { fireRate: 0.4, damage: 32, criticalMult: 1.75, clip: 12, reloadTime: 2,
        spread: 0.027, aimSpread: 0.00065, bloomPerShot: 0.004, bloomMax: 0.018, bloomRecovery: 0.055,
        hitscan: true, range: 340, kernelRadius: 0.065, recoilKick: 0.012 },
      // Q / E / F are the shared ability slots; actions and HUD labels belong to each class.
      abilities: {
        shuckShot: { cooldown: 24, maxCharges: 3, maxActive: 4, hp: 10, armTime: 1.25, triggerRadius: 1.6,
          radius: 3.5, damage: 175, placeDistance: 1.35, life: 180 },
        huskHop: { cooldown: 60, duration: 40, hp: 5, speed: 12, verticalSpeed: 7, altitude: 18,
          launchHeight: 3, fireRate: 0.105, damage: 8, projectileSpeed: 120, projectileLife: 1.8,
          heatPerShot: 0.07, cooling: 0.3, overheatTime: 1.6, aiRange: 32,
          strikeCooldown: 12, strikeInitial: 5, strikeDelay: 1.1, strikeDamage: 65, strikeRadius: 4,
          strikeCount: 8, strikeInterval: 0.14, strikeArea: 4.5 },
        butterBarrage: { cooldown: 30, maxCharges: 4, maxActive: 4, hp: 200,
          range: 6, width: 3.4, depth: 0.85, height: 1.65, life: 120, placeDistance: 3 },
      },
      abilityNames: { shuckShot: 'Potato Mine', huskHop: 'Garlic Drone', butterBarrage: 'Tallnut Battlement' },
      abilityIcons: { shuckShot: '🥔', huskHop: '🧄', butterBarrage: '🪵' },
      info: { role: 'Sniper', blurb: 'Long-range precision and defenses: mines and walls.',
        primary: 'Spike Shot: hitscan rifle; zoom with RMB, head hits deal 1.75× damage.',
        shuckShot: 'Plant a Potato Mine (up to 3 charges) that arms after a moment.',
        huskHop: 'Pilot a Garlic Drone: WASD fly, LMB fire, Q Corn Strike, E return.',
        butterBarrage: 'Raise a Tallnut Battlement wall that zombies must bash through.' } },
    peashooter: { name: 'Peashooter', weaponName: 'Pea Cannon',
      stats: { hp: 125, speed: 10.5, jumpSpeed: 10, accel: 16 },
      weapon: { fireRate: 0.44, damage: 27, splashDamage: 12, splashRadius: 3.5, clip: 10, reloadTime: 1.5,
        kernelSpeed: 170, kernelLife: 0.8, kernelRadius: 0.3, spread: 0.012, aimSpread: 0.003,
        bloomPerShot: 0.006, bloomMax: 0.025, bloomRecovery: 0.09, recoilKick: 0.009 },
      // Shared Q/E/F action slots; each class provides its own implementation and labels.
      abilities: {
        shuckShot: { cooldown: 30, fuse: 2.5, damage: 175, radius: 8, range: 34, flightTime: 0.85,
          gravity: 24, bounce: 0.3, drag: 3, attractRadius: 18, minFlight: 0.32 },
        huskHop: { cooldown: 30, duration: 12, deployTime: 0.65, ammo: 100, fireRate: 0.075,
          damage: 10, speed: 240, spread: 0.007, life: 0.65 },
        butterBarrage: { cooldown: 25, duration: 8, speedMult: 1.75, jumpMult: 1.75, trailInterval: 0.09 },
      },
      abilityNames: { shuckShot: 'Chili Bean Bomb', huskHop: 'Pea Gatling', butterBarrage: 'Hyper' },
      abilityIcons: { shuckShot: '🫘', huskHop: '✺', butterBarrage: '⚡' },
      info: { role: 'Artillery', blurb: 'Splash damage that breaks up crowds.',
        primary: 'Pea Cannon: slow, heavy peas that splash on impact.',
        shuckShot: 'Throw a Chili Bean Bomb: lures nearby zombies, then explodes.',
        huskHop: 'Root into a Pea Gatling for 12 s of rapid fire (E to uproot).',
        butterBarrage: 'Hyper: run faster and jump higher for 8 s.' } },
    citron: { name: 'Citron', weaponName: 'Orange Beam',
      // GW2: 200 HP tank; slowest on foot, fastest rolling. Heat replaces the magazine (no reload).
      stats: { hp: 200, speed: 8.2, accel: 11, jumpSpeed: 8.6, aimSpeedMult: 0.62 },
      // range caps the drawing only; damage traces have no distance cutoff (cover still blocks them).
      weapon: { fireRate: 0.15, damage: 13, minDamage: 7, falloffStart: 16, falloffEnd: 42, range: 58, clip: 1, reloadTime: 0.1,
        kernelRadius: 0.16, spread: 0.006, aimSpread: 0.002, bloomPerShot: 0, bloomMax: 0, bloomRecovery: 1, recoilKick: 0.0011,
        heatPerTick: 0.03, cooling: 0.55, coolDelay: 0.3, overheatTime: 2.2 },
      abilities: {
        shuckShot: { cooldown: 26, range: 34, speed: 26, gravity: 22, fuse: 1.6, radius: 8, stun: 3.5, bossStun: 1.2,
          damage: 20, mechMult: 5, arcTime: 0.35 },
        huskHop: { cooldown: 2, speedMult: 2.05, jumpMult: 1.15, ramSpeed: 6, ramRadius: 1.25, ramDamage: 14, ramGap: 0.7, ramPush: 9,
          chargeTime: 0.75, chargeSlow: 0.25, minCharge: 0.3, dashSpeed: 30, dashTime: 0.5, dashRadius: 1.7, dashDamage: 65,
          dashPush: 18 },
        butterBarrage: { cooldown: 24, duration: 15, absorb: 160, arc: 0.5, speedMult: 0.72, reach: [0.5, 2.2], height: 2.6 },
      },
      abilityNames: { shuckShot: 'EMPeach', huskHop: 'Citron Ball', butterBarrage: 'Peel Shield' },
      abilityIcons: { shuckShot: '🍑', huskHop: '⚪', butterBarrage: '🛡️' },
      info: { role: 'Tank', blurb: 'Armored bounty hunter: shields the line and bowls through hordes.',
        primary: 'Orange Beam: hits at any distance, strongest up close; no reload, but overheats.',
        shuckShot: 'Throw an EMPeach: stuns every zombie in the blast; wrecks Z-Mechs and turrets.',
        huskHop: 'Curl into the Citron Ball: roll fast and ram; hold LMB to charge a Spin Dash (E to unroll).',
        butterBarrage: 'Raise a Peel Shield in front of you; you can keep firing through it (F to lower).' } },
    rose: { name: 'Rose', weaponName: 'Magic Thistles',
      // GW2: 100 HP floating sorceress; thistles home on whatever is under the reticle.
      stats: { hp: 110, speed: 10.6, accel: 12, jumpSpeed: 9.4, gravity: 19, aimSpeedMult: 0.7, airControl: 0.55 },
      weapon: { fireRate: 0.19, damage: 15, clip: 20, reloadTime: 1.4, kernelSpeed: 72, kernelLife: 6, kernelRadius: 0.2,
        spread: 0.012, aimSpread: 0.004, bloomPerShot: 0.002, bloomMax: 0.012, bloomRecovery: 0.08, recoilKick: 0.0014,
        lockRange: 55, lockCone: 0.085, turnRate: 7.5, lockGrace: 0.4 },
      abilities: {
        shuckShot: { cooldown: 28, castTime: 0.32, speed: 72, range: 45, radius: 3.2, maxTargets: 4, duration: 7, agentDuration: 4 },
        huskHop: { cooldown: 22, range: 30, speed: 30, gravity: 20, radius: 7, duration: 6, slowMult: 0.32, attackSlow: 0.5,
          bossStun: 1.5 },
        butterBarrage: { cooldown: 32, duration: 6, speedMult: 1.4, pulseEvery: 1, pulseRadius: 4.2, pulseDamage: 22, lift: 0.35 },
      },
      abilityNames: { shuckShot: 'Goatify', huskHop: 'Time Snare', butterBarrage: 'Arcane Enigma' },
      abilityIcons: { shuckShot: '🐐', huskHop: '⌛', butterBarrage: '🔮' },
      info: { role: 'Sorceress', blurb: 'Crowd control: turns threats into goats and freezes time.',
        primary: 'Magic Thistles: thistles home in on the zombie under your reticle.',
        shuckShot: 'Goatify: a bolt that turns zombies (not bosses) into harmless goats for 7 s.',
        huskHop: 'Time Snare: throw a time bubble that slows every zombie inside (stuns bosses briefly).',
        butterBarrage: 'Arcane Enigma: become untouchable and fast for 6 s; pulses hurt nearby zombies.' } },
    chomper: { name: 'Chomper', weaponName: 'Chomp',
      // GW2: 175 HP melee ambusher. Bites, swallows zombies whole from behind, then has to chew.
      stats: { hp: 190, speed: 10.2, accel: 16, jumpSpeed: 9.2, aimSpeedMult: 0.85, regenDelay: 4, regenRate: 4 },
      weapon: { fireRate: 0.46, damage: 50, clip: 1, reloadTime: 0.1, range: 3.4, arc: 0.45, cleave: 2, cleaveMult: 0.55,
        snap: 0.075, lunge: 5, push: 4, kernelRadius: 0.3, spread: 0, aimSpread: 0, bloomPerShot: 0, bloomMax: 0, bloomRecovery: 1,
        recoilKick: 0.004, behind: -0.25, chew: 1.6, chewSpeed: 0.9, heldChew: 1.1, swallowHeal: 25 },
      abilities: {
        shuckShot: { cooldown: 7, speed: 42, gravity: 9, life: 1.4, radius: 2.6, duration: 4, slow: 0.45, dps: 5 },
        huskHop: { cooldown: 14, duration: 8, speedMult: 1.35, eatRadius: 2.5, hitRadius: 3.4, hitDamage: 35, bossDamage: 160,
          lift: 7, diveTime: 0.35 },
        butterBarrage: { cooldown: 18, maxCharges: 3, maxActive: 4, placeDistance: 1.7, armTime: 0.5, radius: 1.25, hold: 5,
          damage: 25, bossDamage: 50, life: 120 },
      },
      abilityNames: { shuckShot: 'Goop', huskHop: 'Burrow', butterBarrage: 'Spikeweed' },
      abilityIcons: { shuckShot: '🟣', huskHop: '🕳️', butterBarrage: '🌵' },
      info: { role: 'Ambusher', blurb: 'Melee predator: swallow zombies whole from behind.',
        primary: 'Chomp: a sweeping bite. From behind (or on a trapped / stunned zombie) it swallows it whole (+25 HP), then you chew briefly.',
        shuckShot: 'Goop: spit goo that slows zombies and stops their attacks.',
        huskHop: 'Burrow: travel underground unseen; pop up (E or LMB) to swallow the zombie above you.',
        butterBarrage: 'Spikeweed: plant a trap (3 charges) that holds the first zombie to step on it.' } },
  },
  cactus: {
    model: { height: 2.64, radius: 0.46, ribs: 10, radialSegments: 100, heightSegments: 64 },
    camera: { aimFov: 27, aimDistance: 2.8, sensitivity: 0.37, droneFov: 76, droneDistance: 3.6,
      droneShoulder: 0.7, dronePivotHeight: 0.4 },
    deploymentLock: 0.4, placementSlope: 0.65, headshotHeight: 0.24, projectileStep: 0.22,
    smokeTrail: { life: 0.42, spacing: 0.09, maxPoints: 3800, width: 0.17, opacity: 0.42,
      color: 0xe5dfd5, expansion: 1.8, drift: 0.16, rise: 0.22, ripple: 0.018 },
    // Friendly Solo Ops sniper role. Numeric thresholds are adaptations; see docs/cactus-ai.md.
    ai: { thinkRate: 8, guardRadius: 28, postRadii: [7, 12, 18, 24], postSamples: 12,
      patrolRadius: [8, 18], patrolTime: [5, 9], arrival: 1.2, repath: 0.8,
      awarenessRange: 70, hearingRange: 8, memory: 2.5, retarget: 0.65, switchMargin: 3,
      reaction: 0.22, turnSpeed: 4.2, aimResponse: 10, settleTime: 0.7, aimError: [0.024, 0.003],
      fireCone: 0.055, headAim: 0.3, comfortableRange: [20, 38], retreatRange: 12,
      mineRange: 9, mineSpacing: 3.5, mineEvery: 2.5, stuckJump: 0.65,
      gardenWeight: 1, distanceWeight: 0.2, postHeightWeight: 0.8, postMoveWeight: 0.15,
      retreatSamples: 12, retreatStep: 4, guardMargin: 1,
      // Fortify: between clear shots, with no close threat and inside the guard radius, walk to a ring, face
      // outward and plants a Potato Mine or Tallnut Battlement where its defenses are thinnest (toward the horde).
      fortify: { every: 3, busyRange: 26, mineRing: [9, 15], wallRing: [11, 17], angles: 16, wallChance: 0.45,
        timeout: 10, alignCone: 0.12, hordeWeight: 1.2 },
      // Garlic Drone: seek a new angle on a blocked distant target, with nothing inside droneSafe of the body
      droneRange: 24, droneSafe: 14 },
  },
  SUNFLOWER: {
    camera: { shoulder: 2.1, aimShoulder: 2.15, clearRadius: 1 }, // keep the broad crown clear of the reticle
    // Model coordinates are in metres: feet at zero, face looking along +Z.
    model: { headY: 2.18, faceWidth: 0.65, faceHeight: 0.54, faceDepth: 0.29,
      petalCount: 22, backPetals: 17, petalLength: 0.62, petalWidth: 0.31,
      petalBase: 0.53, stemHeight: 1.83, stemRadius: 0.075,
      face: 0xf39421, petalRoot: 0xe6a01a, petalGold: 0xffc928, petalTip: 0xffdf49,
      stem: 0x649829, leaf: 0x629631, leafTip: 0x83ac37, leafDark: 0x2c5a14,
      strideRate: 12, bob: 0.065, sway: 0.045, breathe: 2.2,
      recoil: 0.065, recoilRecovery: 17, petalFlutter: 0.035, blinkInterval: [2.6, 5.7],
      petalSegments: 26, petalSides: 18, leafSegments: 24, leafSides: 12,
      faceSegments: 64, faceRings: 48, freckles: 76 },
    fx: { pulseColor: 0xffd34e, coreColor: 0xfff7c0, healColor: 0xffd45b,
      beamColor: 0xffbf2b, beamWidth: 0.105, beamGlow: 0.3, healWidth: 0.035,
      shake: 0.018, beamShake: 0.022, particleInterval: 0.08, healSoundInterval: 0.55,
      sunSpeed: 7, sunGravity: 8, sunBounce: 0.35, beamSegments: 24 },
    // Solo Ops medic role: teammates first, including at low health and under fire.
    // Exact decision constants are adaptations; sources/limits: docs/sunflower-ai.md.
    ai: { followRange: [2.5, 7], followBehind: 7.5, followSide: 2.8,   // escort spot behind + beside the ally (see escortSpot)
       healThreshold: 1, selfFlowerHp: 0.72, allyFlowerHp: 0.65,
      dangerRadius: 5, sunbeamMinRange: 12, sunbeamMaxRange: 55, sunbeamCommit: 1.8,
      sunbeamSettle: 0.65, supportMovingSpeed: 1.5, healPriority: 2.5,
      thinkInterval: 0.25, flowerAllyRange: 6, turnSpeed: 5.5,
      aimResponse: 10, fireCone: 0.13, leadSkill: 0.75, engageRange: 58, preferredRange: [14, 24],
      supportEnemyWeight: 0.3, strafe: 0.3, dodgeWeight: 0.65, minAllySpace: 1.7,
      reviveTravelMargin: 0.3, patrolRadius: 6, repathInterval: 0.45,
      waypointReach: 1.2, pathLookAhead: 1.5, stuckJumpTime: 0.5 },
    audio: { pulsePitch: 730, pulseEnd: 310, pulseVolume: 0.32,
      beamPitch: 165, beamVolume: 0.28, healPitch: 880, healVolume: 0.22 },
  },
  PEASHOOTER: {
    model: { headY: 2.02, headScale: [0.57, 0.61, 0.53], stemHeight: 1.65,
      skin: 0xa4bd36, leafDark: 0x214e22, leafLight: 0x699440, vein: 0x9bad56,
      strideRate: 13, bob: 0.065, lean: 0.17, recoil: 0.11, recoilRecovery: 13, breathe: 2.6,
      rootSpread: 1.25, hyperLean: 0.1, gatlingSpin: 24, blinkInterval: [2.4, 5.2],
      skinPoreDepth: 0.00028, skinPoreFrequency: 155 },
    fx: { peaColor: 0x8cdb35, splashColor: 0xb9ed5c, impactParticles: 9, trailInterval: 0.045,
      bombColor: 0x982d20, bombPulseRate: 9, bombSparkInterval: 0.09, bombParticles: 24,
      cameraShake: 0.075, gatlingShake: 0.025, hyperFov: 7 },
    ai: { guardRadius: 40, patrolRadius: [18, 33], preferredRange: [14, 25], engageRange: 52,
      clusterRadius: 4.5, groupWeight: 13, bossWeight: 22, emergencyBomberWeight: 70,
      minBombCluster: 3, bombSafeDistance: 5, gatlingMinHp: 220, gatlingRange: [12, 42],
      gatlingSafeRadius: 7, gatlingMinCommit: 2.5, gatlingLostTime: 1.2, retreatHp: 0.35,
      hyperTravel: 13, hyperEscape: 6, patrolTime: [4, 7], repath: 0.7, clusterRefresh: 0.35,
      reactionTime: 0.18, aimError: 0.012, turnSpeed: 6, fireCone: 0.12, leadSkill: 0.9,
      strafeRate: 0.65, jumpInterval: 1.1, bombLead: 0.5, bomberAlertRange: 18, retreatRadius: 8,
      threatMargin: 20, statueWeight: 0.25, gatlingCloseMult: 0.6, velocitySmooth: 6,
      stuckSpeedFraction: 0.15, packAimLower: 0.4, aimLower: 0.3, idleReloadFraction: 0.5 },
  },
  // Citron / Rose / Chomper (sections "Citron combat", "Rose combat", "Chomper combat"). Kit numbers live in
  // CONFIG.PLANTS.<type>; these hold effects and the AI. GW2 sources + horde adaptations: docs/citron.md, rose.md, chomper.md.
  CITRON: {
    fx: { beamColor: 0xff8a1c, coreColor: 0xfff1c4, coreWidth: 0.05, glowWidth: 0.16, impactLight: 9,
      empColor: 0x6ff4ff, empLight: 40, arcs: 10, arcLife: 0.35, shieldColor: 0xffa431 },
    ai: { thinkRate: 10, engageRange: 65, preferRange: [9, 20], guardRadius: 34, patrol: [10, 24], patrolTime: [4, 8],
      turnSpeed: 5, fireCone: 0.07, aimError: 0.01, reaction: 0.2, stickiness: 6, ventAt: 0.86, ventTime: 0.9,
      ballTravel: 22, unballDist: 9, dashPack: 3, dashRange: [5, 15], dashLane: 2.2, dashPlanTime: 2.5,
      shieldCrowd: 2, shieldRange: 10, shieldHurt: 1.5, shieldDrop: 4,
      empCluster: 4, empRange: [7, 30], empRadius: 7, empAgentRange: 24, retreatHp: 0.3,
      // target score = distance + garden distance × garden − boss − hunter (zombie hunting this plant); lowest wins
      targetBias: { garden: 0.35, boss: 12, hunter: 6 } },
    model: {
      scale: 1.1,                                                  // whole model (sculpted at 1.0, built a size up for the tank role)
      bodyY: 1.38, peelR: 0.76, peelSquash: 0.965, ballR: 0.862,   // orange centre (walking), peel radius, ball radius
      peel: 0xf5841b, peelDeep: 0xd2520a, peelLight: 0xffa83e, peelStem: 0xc79a2c,
      poreFreq: [16, 41], poreDepth: [0.0024, 0.0008],             // oil-gland cells per metre / pit depth (m), two octaves
      gunmetal: 0x67727f, darkMetal: 0x2a3038, paint: 0xf37a14, chrome: 0xc9d0d6, rubber: 0x17191c, glass: 0x0d2a34,
      seamGlow: 0xff7417, heatGlow: 0xff6418, visorGlow: 0x3feeff, emitterGlow: 0xff9636, shieldGlow: 0xff8f1f,
      gores: 8, goreGap: 0.034, goreIn: 0.818, goreOut: 0.862, hubAngle: 0.34,   // armour gores (rad gap) and hub cap size
      stowAngle: Math.PI - 0.42, stowStep: 0.028,                  // walking: gores stack over the top-back like a helmet shell
      hipX: 0.33, hipDrop: 0.6, thigh: 0.32, shin: 0.32, ankleY: 0.185, footX: 0.4, footZ: 0.03,
      shoulderX: 0.9, cannonDrop: 0.27,
      shield: { halfW: 1.1, halfH: 1.2, y: 1.28, distance: 1.15, curve: 2.6, cell: 0.118 },
    },
    anim: {
      morphTime: 0.35, cycle: 2.0, stride: 0.33, lift: 0.17, crouch: 0.07, bob: 0.045,   // gait (m) — cycle = 2 steps
      bodyK: 420, bodyD: 22, jiggleK: 260, jiggleD: 9, footfall: 1.5, lean: 0.14,          // servo spring, peel jiggle
      recoilRecovery: 11, recoilKick: 0.07, blinkInterval: [2.4, 5.5], scanInterval: [3, 6.5], scanTime: 0.7,
      dashSpin: 42, shieldTime: 0.18, throwTime: 0.5, ventOpen: 0.72,
    },
  },
  ROSE: {
    fx: { thistleColor: 0xd94cff, trailColor: 0xff7ae0, goatColor: 0xf3e6ff, snareColor: 0x9c6bff, enigmaColor: 0xc86bff,
      trailEvery: 0.035 },
    goats: 10,   // prebuilt goat rigs (the most zombies that can be goats at once)
    goatWander: { speed: 2.4, turn: [0.7, 1.8], hop: 0.18 },
    ai: { thinkRate: 10, engageRange: 55, preferRange: [14, 26], kiteRange: 7, guardRadius: 36, patrol: [12, 24], patrolTime: [4, 8],
      turnSpeed: 5.5, fireCone: 0.06, reaction: 0.2, stickiness: 8, goatRange: 34, goatCluster: 3, snareCluster: 4, snareRange: [6, 28],
      snareBoss: 24, enigmaHp: 0.35, enigmaCrowd: 7,
      targetBias: { garden: 0.4, boss: 8, hunter: 10 } },   // see CITRON.ai.targetBias
    model: {
      waistY: 1.12, headY: 2.17, headScale: 1.22, shoulderY: 1.45, shoulderX: 0.135,
      upperArm: 0.3, foreArm: 0.27, wandLength: 0.5,
      petalDeep: 0x4a0420, petalBase: 0x8e0a3e, petalMid: 0xdc2477, petalRim: 0xff9ccc, petalBack: 0x6a0a30,
      leafDark: 0x0b2e17, leafMid: 0x1d5a2a, leafLight: 0x5d9c42, stem: 0x3a7330, thorn: 0x6e2234,
      skin: 0xf3b2d4, skinShade: 0xdc96c6, blush: 0xff5c9e, shadow: 0x6e2f9e, lip: 0xd03a78, brow: 0x3a0b30,
      iris: 0x1e0730, irisRim: 0x7a3cb8, wood: 0x3d2219, orb: 0xd23cff, orbCore: 0xffe0ff,
    },
    anim: {
      hover: 0.0, bob: 0.04, bobRate: 1.6, breathe: 2.2, lean: 0.22, headTurn: 0.14,
      skirtTrail: 0.05, skirtK: 38, skirtD: 7, airFlare: 0.5,
      recoilRecovery: 11, wandFlick: 0.45, aimHold: 0.7,
      castTime: 0.7, enigmaLift: 0.35, enigmaFade: 0.3, enigmaOpacity: 0.55, enigmaGlow: 0xa040ff,
      blinkInterval: [2.2, 5.5], tiltEvery: 6.5,
    },
    goat: {
    wool: 0xf8f2e6, woolShade: 0xcbbca6, skin: 0xece0d0, muzzle: 0xf4d8d0, nose: 0x7a3c46, hoof: 0x433631,
    horn: 0xc2a882, pupil: 0x1a1210, bodyY: 0.55,
    trotRate: 13, bounce: 0.07, stride: 0.6, chewRate: 9, earFlick: [1.5, 4],
  },
  },
  CHOMPER: {
    fx: { goopColor: 0x9b3fd0, goopDark: 0x5a1a80, dirt: 0x6b4a2e, moundEvery: 0.06 },
    ai: { thinkRate: 10, huntRange: 40, guardRadius: 38, patrol: [8, 22], patrolTime: [4, 8], turnSpeed: 7, biteRange: 2.9,
      flankDist: 1.7, flankRange: 12, goopRange: [6, 28], burrowTravel: 18, emergeDist: 1.4, escapeHp: 0.3, escapeCrowd: 3,
      spikeCrowd: 2, spikeEvery: 7, spikeRing: [6, 12], reaction: 0.12, stickiness: 5, retreatHp: 0.35,
      mobRadius: 6,      // zombies this close count as the mob around the Chomper (escape / Spikeweed)
      safeRadius: 18,    // a hurt, burrowed Chomper with no mob pops up inside this distance of the garden
      // see CITRON.ai.targetBias; held = goated / snared / stunned prey (easy meals); boss < 0 avoids bosses
      targetBias: { garden: 0.5, held: 8, boss: -14, hunter: 4 } },
    model: {
      headLength: 1.5, headWidth: 1.22,     // jaw rim outline (m)
      domeUp: 0.72, domeDown: 0.46,         // outer dome height of the upper / lower jaw above / below the lip line
      domeCenterZ: 0.16, lowCenterZ: 0.0,   // upper apex sits well forward (bulbous overbite brow), lower one centred
      bulb: 0.8,                            // dome fullness (< 1 = steeper sides, rounder head)
      cheek: 0.1, cheekLow: 0.06,           // lobes swell past the lip line, so the lip sits in a groove
      ridge: 0.022,                         // midrib ridge over the top of the upper lobe
      lip: 0.075, shell: 0.085,             // lip roll radius (thick rim the fangs grow from), shell thickness
      hingeInset: 0.06,                     // hinge forward of the back of the rim
      jawSides: 128,
      headRest: [0, 1.96, 0.58],             // head pivot (lip-line centre) in body space: jutting forward
      neckBase: [0, 0.6, -0.12], neckBaseDir: [0, 1, -0.6],
      neckAnchor: [0, -0.455, -0.14], neckAnchorDir: [0, 0.98, 0.18],   // where / how the neck enters the head (head space)
      neckRadius: [0.27, 0.2, 0.225, 0.245], // base, waist, upper, flare into the head
      teeth: 10, toothTilt: 0.36,
      burrowDepth: 2.8,
      skin: 0x7a35a8, skinTop: 0x9a58c8, skinBelly: 0x8a4ab6, spot: 0xd8b6f4, spotScale: 5.0,
      lipColor: 0x6a1252, mouth: 0xd8445f, throat: 0x3b0716, tongue: 0xf06a86,
      tooth: 0xfbf4e2, toothShade: 0xe2d2b0,
      leafDark: 0x2c6a1d, leafLight: 0x8ccc3e, stem: 0x4f8f2a, stemLight: 0x7fbd43,
      dirt: 0x2e1d10, dirtLight: 0x6a4a2c,
    },
    anim: {
      breathe: 1.7, restPitch: -0.12, stride: 8.2, bob: 0.05, lean: 0.16,
      biteOpen: 1.2, biteOpenLow: 0.38, biteLunge: 0.38, biteTime: 0.45,
      gulpOpen: 1.42, gulpOpenLow: 0.5, gulpLunge: 0.5, gulpTime: 1.05, bulge: 0.22,
      chewRate: 3, chewPuff: 0.13, snackTime: 1,
      spitTime: 0.35, diveTime: 0.35, emergeTime: 0.6,
      lagK: 70, lagD: 7,                    // head-on-neck follow-through spring
      recoilRecovery: 12,
    },
    web: { nT: 14, nW: 8, span: 0.56, reach: 0.42, thick: 0.024, sag: 0.1 },
  },
  // Kernel Corn (the hero). Collision is still a capsule of radius/height; the model is cosmetic.
  player: {
    hp: 150, speed: 10, radius: 0.6, height: 1.4,
    accel: 14,                 // how fast velocity approaches the wished velocity (1/s)
    airControl: 0.35,          // fraction of accel available while airborne
    jumpSpeed: 9, gravity: 26,
    aimSpeedMult: 0.65,        // move speed while zoomed (RMB)
    sprintMult: 1.5,           // hold Shift: faster, forward-ish only; firing, zooming or reloading cancels it
    regenDelay: 6,             // seconds without taking damage before passive regen starts
    regenRate: 1.5,            // hp per second (very slow; applies to the player and the AI teammate)
  },
  // Primary weapon: twin cob blasters that alternate kernel shots
  weapon: {
    fireRate: 0.09, damage: 9, clip: 50, reloadTime: 1.9,
    spread: 0.02, aimSpread: 0.004,   // radians of random deviation (hip / zoomed)
    bloomPerShot: 0.004, bloomMax: 0.03, bloomRecovery: 0.12,
    kernelSpeed: 240, kernelLife: 0.4, kernelRadius: 0.12,
    muzzleDrop: 0.55,                 // m below the body centre where Corn's cobs fire from (AI line-of-fire checks)
    recoilKick: 0.0022,        // camera pitch kick per shot
  },
  abilities: {
    // Volley of explosive corn-cob missiles, alternating arms
    shuckShot: { cooldown: 16, missiles: 6, interval: 0.09, speed: 38, spread: 0.035, damage: 35, radius: 3.2, life: 2.5 },
    // Leaf-powered leap; hold Space while falling to glide; slams on landing
    huskHop: { cooldown: 12, upSpeed: 16, forwardSpeed: 10, slamDamage: 50, slamRadius: 4.5, glideGravity: 0.22 },
    // Call a rain of butter on a ground target: damages and stuns ("buttered")
    butterBarrage: { cooldown: 28, range: 45, delay: 0.7, pats: 10, interval: 0.11, areaRadius: 6,
                     damage: 32, splashRadius: 2.6, stun: 1.5, dropHeight: 26, fallSpeed: 34 },
  },
  // Procedural sound (section "Audio"): mix levels, 3D falloff, ambient timing
  audio: {
    master: 0.8, sfx: 1, ui: 0.75, ambience: 0.3,   // bus gains
    music: 0.5,                                       // music bus at 100 % on the Music slider (section "Music")
    reverb: 0.55, reverbTime: 1.9, reverbSend: 0.12, // outdoor tail; send grows with distance
    refDistance: 6, rolloff: 0.75, maxDistance: 95,  // 3D: full volume inside refDistance, silent past maxDistance
    airAbsorb: 45,                                    // m: distant sounds lose their highs
    moanRange: 55, moanInterval: [1.2, 3], maxMoans: 3,
    stepDistance: 1.6,                                // m walked per footstep
    killStreakWindow: 1.2,                            // s: kills closer than this raise the kill chime's pitch
    statueAlarmGap: 9,                                // s between "statue under attack" horns
    voicePitch: { shambler: 105, sprinter: 150, plated: 82, spitter: 125, bomber: 175, banner: 135, climber: 140,
                  howler: 115, miniBoss: 58, finalBoss: 46 },   // moan pitch (Hz)
  },
  // Secondary animation layered on top of every hero / agent rig (section "Animation juice")
  juice: {
    hero: { accelTilt: 0.006, maxTilt: 0.16, tiltK: 140, tiltD: 15,      // lean the whole plant into acceleration
            flinch: 0.16, flinchMax: 0.32,                                // hit kick (rad) per hit, scaled by damage
            fallGravity: 22, lieAngle: 1.45, bounce: 0.32, riseK: 170, riseD: 13,   // downed topple / revive spring
            popK: 260, popD: 19, popStart: 0.12,                          // respawn pop-in
            // whole-body ability gestures (curves in heroGesturePose), by plant type and action key
            gestureTime: { throw: 0.5, plant: 0.55, cast: 0.45, root: 0.5 },
            gestures: { corn: { shuckShot: 'cast', butterBarrage: 'cast' },
                        peashooter: { shuckShot: 'throw', huskHop: 'root', butterBarrage: 'cast' },
                        sunflower: { shuckShot: 'cast', huskHop: 'root', butterBarrage: 'plant' },
                        cactus: { shuckShot: 'plant', huskHop: 'cast', butterBarrage: 'plant' },
                        citron: { shuckShot: 'throw', butterBarrage: 'cast' },
                        rose: { shuckShot: 'cast', huskHop: 'throw', butterBarrage: 'cast' },
                        chomper: { shuckShot: 'throw', butterBarrage: 'plant' } } },
    agent: { flinch: 0.28, flinchMax: 0.4, k: 190, d: 12, punch: 0.12,  // directional hit kick + squash
             spawnTime: 0.55, spawnK: 240, spawnD: 12,                     // pop-in when an agent spawns
             corpseFall: 0.55, corpseHold: 2.4, corpseSink: 1.1, maxCorpses: 10, corpseSlide: 0.9,   // slide: knockback m
             // Limp death: rig joints (found by ref name) spring loosely from the death pose to a relaxed pose and flop
             // on landing. Offsets are added to each joint's spawn (rest) rotation as [x, y, z]; arm/leg z mirrors by side.
             limpK: 55, limpD: 5.5, landKick: 9,
             deathPose: {
               default:     { head: [0.45, 0.2, 0.15], jaw: [0.4, 0, 0], arm: [-0.3, 0, 0.5], leg: [-0.25, 0, 0.18], spine: [-0.2, 0, 0.05] },
               imp:         { head: [0.6, 0.4, 0.3], jaw: [0.5, 0, 0], arm: [-0.9, 0, 1.2], leg: [-0.8, 0, 0.4], spine: [-0.3, 0, 0] },        // starfish
               soldier:     { head: [0.7, -0.3, 0.2], jaw: [0.55, 0, 0], arm: [-0.2, 0, 0.35], leg: [-0.5, 0, 0.12], spine: [-0.35, 0.2, 0] },
               pirate:      { head: [0.3, 0.5, 0.25], jaw: [0.5, 0, 0], arm: [-1.4, 0, 0.6], leg: [-0.3, 0, 0.3], spine: [-0.15, -0.3, 0.1] },  // arms up, hat over the eyes
               superBrainz: { head: [-0.3, 0.3, 0], jaw: [0.6, 0, 0], arm: [-0.4, 0, 1.4], leg: [-0.6, 0, 0.45], spine: [-0.4, 0, 0] },    // flung wide, chin up
               mechanic:    { head: [0.55, -0.4, 0.2], jaw: [0.45, 0, 0], arm: [-0.2, 0, 0.7], leg: [-0.4, 0, 0.25], spine: [-0.25, 0.25, 0] },
               scientist:   { head: [0.5, 0.35, -0.2], jaw: [0.5, 0, 0], arm: [-0.7, 0, 0.9], leg: [-0.35, 0, 0.3], spine: [-0.2, -0.2, 0] },
             } },
  },
  spectator: { distance: 12, minDistance: 4, maxDistance: 36, zoomSpeed: 0.012, height: 1.4,
    pitch: 0.35, minPitch: -0.8, maxPitch: 1.35, follow: 8, flySpeed: 18, fastMult: 3,
    groundClearance: 0.8, maxHeight: 100, collisionMargin: 0.4,
    aimFollow: 10,       // plant view: how fast the camera eases onto the watched plant's aim (1/s)
    minAimDistance: 2 }, // closer aim points are ignored (the plant's facing is used instead)
  camera: {
    distance: 5.2, aimDistance: 3.4,  // hip / zoomed
    height: 1.0, shoulder: 1.75,      // pivot above player center, and to the right
    lift: 0.7,                        // look point above the pivot: the plant sits low-left of the crosshair
    // Crosshair zone (NDC half-size) kept free of the plant: if its silhouette enters, the shoulder slides out
    clearZone: { x: 0.1, y: 0.14, rate: 3, max: 1.4 },
    fov: 70, aimFov: 50, sensitivity: 0.0025,
    aimSensitivity: 0.65,             // look speed while zoomed (× sensitivity); a plant's camera.sensitivity overrides
    recoilRecovery: 8, recoilMax: 0.08, // temporary pitch kick: return rate (1/s) and maximum rise (rad)
    // Dynamic feel (all small on purpose — readable, never dizzy)
    follow: 16, followY: 9,           // pivot catch-up rate (1/s); vertical is softer so steps/jumps glide
    sprintFov: 9, sprintDistance: 0.6, // extra FOV / pull-back at full sprint
    speedFov: 3,                      // extra FOV from plain movement speed
    bob: 0.035, bobSide: 0.025, sprintBob: 2.2,  // head bob (m) while walking; sprint multiplies it
    strafeRoll: 0.022,                // roll (rad) leaning into sideways motion
    landDip: 0.35,                    // camera dip on hard landings (m at max impact)
    speedFxBoost: 1.5,                // a plant speed boost above this shows the full speed-line vignette (Hyper)
    hurtRoll: 0.05, hurtFov: -3,      // flinch when hit: roll kick + quick FOV punch-in
    shakeRot: 0.022, shakePos: 0.12,  // trauma shake amplitude (rad / m) at full trauma
    lowHp: 0.35,                      // below this hp fraction the screen edges pulse red
    // Allies standing between the camera and your plant (or right on the lens) hide until they step aside
    allyBlock: { pad: 0.45, near: 1.6, hold: 0.25 },   // m added to their radius, m from the lens, s before reappearing
    // Walls / cover: the shoulder and the camera boom stop `pad` m short of any prop (keeps the near plane out of
    // it), snap in at once and ease back out at `easeOut` (1/s); your own plant hides once the lens is within
    // `selfPad` m of its body (backed into a wall it would fill half the screen)
    walls: { pad: 0.3, step: 0.2, easeOut: 5, selfPad: 0.45 },
  },
  // Zombie roster. Shared fields:
  //   hp, speed, damage, attackCooldown (s), aggroRange / deaggroRange (hero chase hysteresis),
  //   radius, height, color, behavior (key into BEHAVIORS), knockbackResist (0..1), targetPreference:
  //     'statue'     — advances on the statue; chases the hero if seen within aggroRange,
  //                    but once it's hitting the statue it stays on it
  //     'player'     — prefers the hero: switches whenever they're seen within aggroRange
  //     'statueOnly' — ignores the hero entirely
  //     'none'       — no target of its own (Banner: follows the pack)
  //     'highGround' — hero only when they're up high / out of ground reach (Climber)
  //     'closest'    — whichever of hero / statue is nearer, no sight needed (bosses)
  //     'heroFirst'  — any plant within aggroRange before the statue, no sight needed (bosses)
  //   Optional: noLos (senses the hero without sight), ignoreLeash (no chase timeout / sight loss),
  //   canClimb (uses the climb nav layer), reachesHighGround (may target a hero with no ground path).
  // Total hit-capsule height relative to the plants' shared capsule (player.radius * 2 + player.height).
  // Sculpted hats, hair, flags and weapons may extend beyond it. Keep plants as the fixed size reference:
  // ordinary zombies ≈ a plant, Imp ≈ half a plant, bruisers taller, then Z-Mech → Gargantuar → Mecha.
  enemySize: {
    shambler: 1, sprinter: 0.82, plated: 1.25, spitter: 0.95,
    bomber: 0.75, banner: 0.85, climber: 0.9, howler: 0.8,
    imp: 0.6, soldier: 1, allStar: 1.25, pirate: 1.05, superBrainz: 1.3, mechanic: 0.9, scientist: 0.95,
    engineerTurret: 0.55, healStation: 0.5, zmech: 1.65, miniBoss: 2.25, finalBoss: 3,
  },
  ZOMBIE_TYPES: {
    shambler: {
      hp: 50, speed: 3.5, damage: 8, attackCooldown: 1.0,
      aggroRange: 15, deaggroRange: 25, targetPreference: 'statue',
      radius: 0.6, height: 1.2, color: 0x6a8f3a, behavior: 'melee',
    },
    sprinter: {
      hp: 25, speed: 8, damage: 5, attackCooldown: 0.6,
      aggroRange: 25, deaggroRange: 34, targetPreference: 'player',
      radius: 0.45, height: 0.9, color: 0xe0c020, behavior: 'melee',
      weave: { amp: 0.45, freq: 3.2 },   // side-to-side wobble while running
      lunge: { range: 4, speed: 17, time: 0.25, cooldown: 2.5 },
    },
    plated: {
      hp: 240, speed: 2.2, damage: 15, attackCooldown: 1.5,
      aggroRange: 6, deaggroRange: 12, targetPreference: 'statue',
      radius: 0.9, height: 1.6, color: 0x5a6f7f, behavior: 'melee', knockbackResist: 0.85,
      frontArc: 0.5,                     // cos of half-angle that counts as "front" (0.5 = ±60°)
      plateBreaks: [0.75, 0.5, 0.25],    // hp fractions where a plate piece falls off (one per piece)
      frontMults: [0.25, 0.45, 0.7],     // front damage multiplier with 0 / 1 / 2 pieces broken
      weakPointMult: 1.5,                // all plates gone: front hits strike the glowing core
    },
    spitter: {
      hp: 40, speed: 3, damage: 6, attackCooldown: 2.0,
      aggroRange: 20, deaggroRange: 28, targetPreference: 'statue', reachesHighGround: true,
      radius: 0.55, height: 1.1, color: 0x9a40c0, behavior: 'ranged',
      range: 18,               // stops this far from its target (with a clear shot) and fires
      backoffRange: 7,         // backs away from a hero closer than this
      projectileSpeed: 12, projectileRadius: 0.35, projectileLife: 4,
    },
    bomber: {
      hp: 35, speed: 6.5, damage: 0, attackCooldown: 0,
      aggroRange: 0, deaggroRange: 0, targetPreference: 'statueOnly',
      radius: 0.7, height: 0.6, color: 0xd03020, behavior: 'bomber',
      explosionDamage: 100,    // statue damage on contact
      explosionRadius: 5,      // player within this also takes playerExplosionDamage
      playerExplosionDamage: 30,
      beepRange: 45,           // the hero hears the beeping within this
    },
    banner: {
      hp: 30, speed: 3.5, damage: 5, attackCooldown: 1.0,
      aggroRange: 0, deaggroRange: 0, targetPreference: 'none',
      radius: 0.5, height: 1.0, color: 0xf08aa0, behavior: 'banner',
      buffRadius: 8,           // allies inside this circle are buffed
      speedMult: 1.25, damageMult: 1.3,
      backOffset: 8,           // walking metres it hangs behind the pack average
      fleeRange: 10,           // runs from a visible hero inside this
    },
    climber: {
      hp: 45, speed: 4, damage: 7, attackCooldown: 0.9,
      aggroRange: 35, deaggroRange: 45, targetPreference: 'highGround', canClimb: true, reachesHighGround: true,
      radius: 0.5, height: 1.0, color: 0x3a6a6a, behavior: 'melee',
      climbSpeed: 3,           // vertical metres per second up cliffs and props
      highGround: 2.5,         // hero feet this far above the climber's feet counts as high ground
    },
    howler: {
      hp: 20, speed: 7, damage: 3, attackCooldown: 0.8,
      aggroRange: 40, deaggroRange: 55, targetPreference: 'player', noLos: true,
      radius: 0.45, height: 0.9, color: 0xe08a30, behavior: 'howler',
      scream: { range: 14, windup: 0.8, radius: 30, cooldown: 7 },
    },
    // TACTICAL AGENTS — hero-class zombies that hunt plant heroes (section "Tactical zombie agents", tuning in
    // CONFIG.AGENTS). Placeholder bean bodies and a generic shot / swing for now; real models, weapons and abilities
    // come later. `agent` holds the role: range = [commit, stalk] distance band, weapon numbers (lower DPS than plants),
    // unlockWave = first wave index it may escort a pack. They never heal, retreat or give up on the plants.
    imp: {
      name: 'Imp', hp: 100, speed: 7.2, damage: 2.5, attackCooldown: 0.3, radius: 0.42, height: 0.5, color: 0xf2661c,
      behavior: 'imp', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999,
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.1,
      // Real model / kit: section "Imp", tuning CONFIG.IMP. range = [commit, stalk] band for thinkAgent
      agent: { role: 'skirmisher', range: [6, 15], commitSpeed: 1.15, unlockWave: 0 },
    },
    // Foot Soldier: sculpted model + Z-6000 / Stink Cloud / Rocket Jump / ZPG kit (section "Foot Soldier", CONFIG.SOLDIER)
    soldier: {
      name: 'Foot Soldier', hp: 125, speed: 5, damage: 6, attackCooldown: 0.6, radius: 0.5, height: 1.0, color: 0x6f7f34,
      behavior: 'agent', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999, model: 'soldier',
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.3,
      agent: { role: 'rifleman', kit: 'soldier', range: [13, 26], commitSpeed: 1, unlockWave: 0 },
    },
    allStar: {
      name: 'All-Star', hp: 250, speed: 4.0, damage: 3, attackCooldown: 0.1, radius: 0.75, height: 1.1, color: 0xb03a2a,
      behavior: 'agent', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999,
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.7,
      agent: { role: 'anchor', range: [8, 20], fireRate: 0.1, clip: 60, reloadTime: 2.6, spread: 0.04,
               shotSpeed: 58, lead: 0.7, commitSpeed: 1, unlockWave: 1 },
      // Kit (section "All-Star"): GW2-style Football Cannon, Sprint Tackle, Imp Punt, Dummy Shield. Damage is lower
      // than the plants' (a plant hero's clip does ~2-3x this). Adapted numbers, not original constants.
      kit: {
        cannon: { damage: 3, falloff: [18, 34, 0.55], spinUp: 0.4, spinDown: 1.1, bloom: 0.003, bloomMax: 0.045,
                  zoomRange: 16, zoomSpread: 0.6, gravity: 7, radius: 0.22, size: 0.34, life: 1.6, push: 0.4,
                  moveMult: 0.7, stalkMult: 1.35, suppressTime: 0.7 },
        tackle: { range: [5, 17], shove: 4.5, opening: 1.5, finishFrac: 0.4, windup: 0.32, duration: 2.0, speed: 12.5,
                  turnRate: 1.6, damage: 20, knock: 15, lift: 7, followThrough: 0.3, wallDamage: 60, recover: 0.45,
                  bonk: 1.2, cooldown: 11 },
        punt: { range: [7, 26], cluster: 6, windup: 0.36, recover: 0.35, gravity: 18, flightSpeed: 15, flight: [0.6, 1.5],
                lobMult: 1.35, lead: 0.6, contact: 0.5, damage: 30, radius: 3.6, knock: 9, fuse: 3.2, cooldown: 9 },
        shield: { hp: 250, life: 14, width: 2.1, depth: 0.6, height: 1.45, dist: 1.6, hold: 1.3, deploy: 0.45,
                  minDist: 6, hurtFrac: 0.8, anchorArc: 1.0, cooldown: 18,
                  blastMult: 0.6 },   // plant explosions deal damage × blastMult to a shield in range
        decide: 0.25, chance: 0.65,
      },
    },
    pirate: {
      name: 'Captain Deadbeard', hp: 125, speed: 4.6, damage: 22, attackCooldown: 1.1, radius: 0.55, height: 0.95, color: 0x3a3060,
      behavior: 'agent', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999,
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.3,
      // Full kit (model, Scallywag Shooter, Barrel Blast, Cannon Rodeo, Parrot Pal, perch brain): CONFIG.PIRATE
      agent: { role: 'sniper', kit: 'pirate', range: [24, 42], fireRate: 1.25, clip: 4, reloadTime: 2.4, spread: 0.008,
               shotSpeed: 120, lead: 1, commitSpeed: 1, unlockWave: 2 },
    },
    superBrainz: {
      // Full model + GW2 kit (section "Super Brainz", tuning CONFIG.SUPER_BRAINZ). Capsule = hit volume only.
      name: 'Super Brainz', hp: 225, speed: 6.4, damage: 10, attackCooldown: 0.4, radius: 0.62, height: 1.3, color: 0x7d34c8,
      behavior: 'agent', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999,
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.5,
      agent: { role: 'brawler', melee: true, range: [0, 14], fireRate: 0.4, commitSpeed: 1.25, unlockWave: 3 },
    },
    mechanic: {
      name: 'Engineer', hp: 150, speed: 4.8, damage: 9, attackCooldown: 0.35, radius: 0.55, height: 0.9, color: 0xc89020,
      behavior: 'agent', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999,
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.4,
      // Real kit (section "Engineer"): Concrete Launcher lobs, Q Sonic Grenade, E Jackhammer, F Turret. damage is unused
      agent: { role: 'breacher', kit: 'engineer', range: [8, 18], fireRate: 0.7, clip: 6, reloadTime: 2.2, spread: 0.035,
               lead: 0.7, commitSpeed: 1.1, unlockWave: 4 },
    },
    // Engineer's deployable turret: a stationary zombie (every plant weapon / AI already handles it). Never in waves.
    engineerTurret: {
      name: 'Turret', hp: 90, speed: 0, damage: 0, attackCooldown: 1, radius: 0.5, height: 0.5, color: 0xf2b81c,
      behavior: 'turret', targetPreference: 'none', aggroRange: 0, deaggroRange: 0, knockbackResist: 1, mechanical: true,
    },
    scientist: {
      name: 'Scientist', hp: 125, speed: 5.6, damage: 12, attackCooldown: 0.5, radius: 0.5, height: 0.85, color: 0xe8e8f0,
      behavior: 'agent', targetPreference: 'agent', aggroRange: 999, deaggroRange: 999,
      ignoreLeash: true, noLos: true, reachesHighGround: true, knockbackResist: 0.3,
      // Goo Blaster: short-range goo shotgun (pellets × pelletDamage × AGENTS.damageMult, falloff in kit) — below plant DPS
      agent: { role: 'flanker', range: [4, 10], fireRate: 0.75, clip: 4, reloadTime: 1.9, spread: 0.12, pellets: 7,
               pelletDamage: 3.5, shotSpeed: 52, lead: 0.4, commitSpeed: 1.2, unlockWave: 5 },
      // Scientist kit (section "Scientist"): initial = first cooldown after spawning
      kit: {
        pelletRadius: 0.1, pelletLife: 0.36, falloff: [4, 13], falloffMin: 0.3,   // damage × 1 → falloffMin over [near, far] m
        warp: { cooldown: 8, initial: 3, range: 13, behind: 3.5, minDist: 8, escapeHp: 0.4, escapeNear: 8, fade: 0.26,
                opening: 1, stalkTime: 5 },   // stalking warp-in: hero opening ≥ this, or after stalkTime s
        sticky: { cooldown: 13, initial: 5, range: [6, 22], speed: 16, gravity: 18, fuse: 1.6, radius: 4, damage: 40, knock: 6 },
        station: { cooldown: 22, initial: 8, hurtFrac: 0.6, allyHurt: 3, holdUntil: 0.9 },
      },
    },
    // Scientist's deployable: a destructible zombie-side object that heals nearby zombies until it expires
    healStation: {
      name: 'Heal Station', hp: 110, speed: 0, damage: 0, attackCooldown: 1, radius: 0.45, height: 0.5, color: 0x9aa0aa,
      behavior: 'healStation', targetPreference: 'none', aggroRange: 0, deaggroRange: 0, knockbackResist: 1,
      station: { life: 12, radius: 7, heal: 14 },   // seconds, aura radius (m), hp/s to every hurt zombie inside
    },
    // BOSSES — they break the shared rules instead of being plain health sponges.
    miniBoss: {
      name: 'Gargantuar', boss: true,
      hp: 4800, speed: 2.6, damage: 40, attackCooldown: 1.5,
      aggroRange: 90, deaggroRange: 110, targetPreference: 'heroFirst', ignoreLeash: true, noLos: true,
      reachesHighGround: true, radius: 1.35, height: 3.8, color: 0x829166, behavior: 'gargantuar', knockbackResist: 1,
    },
    finalBoss: {
      name: 'Mecha Gargantuar', boss: true, mechanical: true,
      hp: 5100, speed: 2.5, damage: 40, attackCooldown: 2.8,
      aggroRange: 90, deaggroRange: 110, targetPreference: 'heroFirst', ignoreLeash: true, noLos: true,
      reachesHighGround: true, radius: 2.15, height: 5.1, color: 0x713e3d, behavior: 'mecha', knockbackResist: 1,
    },
  },
  // Mecha Gargantuar: GW2 attack identities; timings/ranges are adapted to this map and plant roster.
  MECHA: {
    armorMult: 0.35, heavyMult: 0.7, headHeight: 6.25,
    turnSpeed: 2.4, alignAngle: 0.2, recovery: 1.25, stepDistance: 2.4,
    initialCooldown: { smash: 2, charge: 4, pulse: 2, bomb: 7 },
    smash: { range: 7, reach: 2.6, radius: 5.5, windup: 1.2, strikeTime: 0.22, chargeWindupMult: 0.65, holdRangeMult: 0.8, damage: 40, statueDamage: 40, knock: 13, cooldown: 3.2 },
    charge: { minRange: 10, maxRange: 32, windup: 1.45, speed: 19, maxDist: 30, stopRange: 5.5, cooldown: 11, recovery: 2.2 },
    pulse: { range: 60, windup: 0.9, interval: 0.26, count: 3, speed: 36, radius: 0.38, damage: 12, cooldown: 3.6, collisionStep: 0.25 },
    bomb: { minRange: 9, range: 52, windup: 1.65, flightTime: 1.3, gravity: 22, fuse: 4, radius: 7, damage: 30, cooldown: 13, bounce: 0.25 },
    fx: { sparkRate: 24, smokeRate: 5, lowHp: 0.35, deathChips: 38, shake: 0.55 },
  },
  // Gargantuar: GW2 attack identities; timings, movement and encounter HP adapted to this map.
  GARGANTUAR: {
    slam: { range: 4.6, windup: 0.8, strike: 0.19, recover: 0.85, cooldown: 1.65,
      reach: 2.5, radius: 2.75, damage: 40, statueDamage: 30, knock: 12, lift: 6, vertical: 3.2 },
    charge: { range: [9, 32], windup: 2, speed: 12, duration: 4, cooldown: 9,
      arrive: 2.7, nodeReach: 1.2, stuckTime: 0.6, minProgress: 0.08 },
    imp: { range: [10, 65], windup: 1.25, recover: 0.8, cooldown: 7, firstDelay: 3,
      gravity: 20, speed: 23, flight: [0.8, 2.5], radius: 3.5, damage: 25,
      projectileRadius: 0.35, step: 0.18, life: 6, reload: 2.5 },
    anim: { stride: 0.85, walkSwing: 0.28, breathe: 1.6, settle: 10, blinkPeriod: 5.4 },
    death: { life: 3.5, fall: 1.1, fade: 1.5, sink: 0.4 },
    fx: { dust: 18, chips: 14, shake: 0.55, stepShake: 0.07, trailInterval: 0.09,
      warningColor: 0xff6e36, dustColor: 0xa38f6c },
  },
  // Tactical zombie agents: shared brain tuning (types above carry their own role / weapon numbers).
  // Adaptations for this game, not Garden Warfare constants.
  AGENTS: {
    thinkRate: 6,                // decisions per second
    // Target choice: lower score wins = distance − opening·openingWeight − focus bonus (+ crowd penalty past focusCap)
    target: { openingWeight: 6, focusBonus: 6, focusCap: 2, crowdPenalty: 10, revengeBonus: 8, switchMargin: 8 },
    // What makes a hero exposed. The same reading for human and AI plants; opening ≥ threshold = go in now
    opening: { threshold: 2, reloading: 2, lowAmmo: 1, lowAmmoFrac: 0.2, abilitySpent: 0.6, lowHp: 1.2, lowHpFrac: 0.5,
               isolated: 1, isolationRadius: 16, busyRadius: 10, busyPer: 0.35, busyCap: 6, airborne: 0.5 },
    hordeRadius: 25,             // ordinary zombies this close to a hero set the "horde side" agents screen behind
    hordeMin: 3,
    groupPush: 2,                // this many agents near one hero push together even without an opening
    commitTime: 4,               // a push lasts at least this long once started (no backing off)
    flankOffsets: [1.3, -1.3, 2.4, -2.4, 0.6, -0.6],   // radians off the horde side when committing (spread the angles)
    screenSpread: 0.35,          // stalking agents fan out this much around the horde side
    stalkFireMult: 1.8,          // stalking pokes: fire interval × this
    fieldRange: 30,              // farther than this from the target: follow the hero flow field instead of steering
    strafeTime: [0.6, 1.4],      // seconds between strafe-direction flips at the goal
    tacticalReloadFrac: 0.5,     // reload out of sight when below this fraction of the clip
    // Pack escorts: each pack of a wave may bring agents that spawn escortDelay s after the pack's burst and guard it.
    // chance = per pack (+ chancePerWave each wave); at most WAVES[i].agentCap per wave (more with more plants).
    // A pack that rolls an escort brings minPerPack agents, then keeps adding one more while a moreChance roll passes.
    escort: { delay: 3, chance: 0.25, chancePerWave: 0.03, minPerPack: 1, moreChance: 0.45, maxPerPack: 8,
              capMult: 1.5, capPerHero: 0.35,
              followDist: 4,       // guards trail the pack's center by this much (behind it, toward its spawn)
              engageRange: 22,     // a plant this close to the pack or the guard breaks guard and starts the hunt
              // Lively escorts: each guard roams its own drifting orbit around the pack (scouting ahead, sweeping
              // flanks, dropping back) instead of standing on one spot; re-picks radius/side every roamTime s.
              roamRadius: [3, 10], roamTime: [1.5, 4], spin: [0.25, 0.7], scoutChance: 0.3, scoutDist: 9 },
    damageMult: 0.35,            // global nerf on every agent's weapon damage
  },
  // Super Brainz (zombie agent): Garden Warfare 2 kit, every number under the plants' (adapted, not GW2 constants)
  SUPER_BRAINZ: {
    // Heroic Fists: 3-hit combo (jab, jab, heavy uppercut); each swing lunges, the combo resets after comboWindow
    fists: { damage: [8, 8, 15], time: [0.3, 0.3, 0.48], hitAt: 0.42, recover: [0.06, 0.06, 0.32], reach: 2.5, arc: 0.45,
             lunge: [4, 4, 7], comboWindow: 0.75, knock: [1.5, 1.5, 7], statueDamage: 8 },
    // Heroic Beam (his zoom attack): sustained hand beam that turns slowly (plants can strafe out), heat-limited
    beam: { range: 28, windup: 0.3, tick: 0.1, damage: 2.4, maxTime: 2.2, cooldown: 3.5, turnRate: 1.6, width: 0.32, moveMult: 0.4 },
    // Super Ultra Ball: hands-together charge, then a thrown orb with splash (cover checked)
    ball: { charge: 1.0, speed: 30, life: 1.4, damage: 28, minDamage: 7, radius: 3.4, knock: 7, cooldown: 9, lead: 0.7, moveMult: 0.35,
      statueMult: 0.5 },   // a direct hit on the garden deals damage × statueMult
    // Heroic Kick: crouch, then a flying dash kick that stops on the first plant it connects with
    kick: { windup: 0.2, time: 0.42, speed: 30, damage: 22, knock: 12, hitRadius: 1.2, cooldown: 7 },
    // Turbo Twister: spin with arms out, damaging plants around, taking reduced damage, moving faster
    twister: { time: 3, cooldown: 13, radius: 3, tick: 0.25, damage: 4, damageTaken: 0.45, speedMult: 1.35, knock: 4, spin: 26 },
    jump: { speed: 9.5, gravity: 26, sidestep: 7, cooldown: 2.5 },
    // Brain: ability choice distances / triggers (on top of thinkAgent's hunt / stalk / commit picture)
    ai: { decide: 0.12, beamRange: [7, 24], ballRange: [9, 26], kickRange: [6, 15], twisterHp: 0.55, twisterCrowd: 2,
          crowdRadius: 4.5, dodgeChance: 0.35, ballInCommit: 0.3, firstUse: [1.5, 4] },
    model: { scale: 1.0 },
  },
  // Engineer (zombie agent "mechanic"): GW2-style kit, deliberately weaker than the plant heroes. Adapted tuning.
  ENGINEER: {
    // Concrete Launcher: arcing shells (flight time = distance / speedH, clamped), direct + 3D splash (cover checked)
    launcher: { speedH: 21, gravity: 24, maxRange: 25, minTime: 0.3, maxTime: 1.3, direct: 7, splash: 6, radius: 2.6,
                knock: 3, statueDamage: 4, wallDamage: 15, aimCone: 0.35, trail: 0.035 },
    // Q Sonic Grenade: lobbed, bounces, then a pulse that jams plant abilities and slows (rooted modes may still exit)
    sonic: { cooldown: 15, windup: 0.55, release: 0.22, range: [5, 22], speedH: 15, gravity: 22, fuse: 0.6, radius: 7,
             damage: 5, jam: 4, slowMult: 0.7, minCluster: 2, openingMin: 1.5, lowHpFrac: 0.5, firstUse: [3, 8] },
    // E Jackhammer: ride at the mark (no shooting), ramming plants out of the way
    jackhammer: { cooldown: 13, duration: 3.6, speedMult: 2.3, hitRadius: 1.3, damage: 10, knock: 11, lift: 5, hitGap: 0.8,
                  farRange: 26, gapClose: 5, firstUse: [0, 4] },
    // F Turret: one per Engineer, deployed beside it when a fight starts; expires (or follows its dead owner shortly)
    turret: { cooldown: 26, range: 28, fireRate: 0.22, damage: 2.5, shotSpeed: 60, spread: 0.03, life: 22, orphanLife: 3,
              deployTime: 0.7, buildTime: 0.7, turnRate: 6, offset: 1.9, maxDist: 30, firstUse: [4, 9] },
  },
  // Imp (section "Imp"): GW2-style kit with damage scaled below the plant heroes. Adaptations, not GW2 constants.
  IMP: {
    // Shot damage below is × AGENTS.damageMult. Imp Blasters: alternating twin pistols. falloff = [full-damage range, min-damage range, min multiplier]
    blaster: { fireRate: 0.085, damage: 3, falloff: [12, 30, 0.5], clip: 30, reloadTime: 1.5, spread: 0.035,
               moveSpread: 0.02, airSpread: 0.03, shotSpeed: 85, lead: 0.7, range: 34, burst: [8, 16], burstRest: [0.25, 0.6] },
    move: { jumpSpeed: 7.5, doubleJumpSpeed: 6.5, gravity: 22, doubleChance: 0.6, dodgeChance: 0.45,
            hopCooldown: [1.2, 2.8], strafeTime: [0.5, 1.2], strafeSpeed: 0.85 },
    // Lobbed, one bounce, then a vortex: plants inside float `lift` m up for floatTime s, moving at `slow` speed
    gravityGrenade: { cooldown: 14, firstDelay: 4, range: [7, 26], throwSpeed: 16, gravity: 22, fuse: 1.4,
                      radius: 5, duration: 3.5, lift: 2.4, floatTime: 1.2, slow: 0.25 },
    // Spin barrage of firework stars (direct hit + small pop) while orbiting the target at speed
    impkata: { cooldown: 11, firstDelay: 3, triggerRange: 10, duration: 1.8, stars: 22, starSpeed: 24, range: 16,
               starDamage: 4, splashDamage: 2, starRadius: 1.4, aimBias: 0.4, spinRate: 22, orbitRadius: 5, speedMult: 1.4 },
    // Z-Mech: charges over chargeTime s, dropped onto the Imp; own hp, heavier weapon, stomp, dash, eject
    mech: { chargeTime: 35, callRange: 30, dropTime: 1.3, dropHeight: 45, landRadius: 4.5, landDamage: 15, gravity: 26,
            body: { name: 'Z-Mech', hp: 450, speed: 4.4, radius: 0.95, height: 1.5, knockbackResist: 0.8, damage: 10, attackCooldown: 0.8,
                    agent: { range: [8, 18], commitSpeed: 1 } },
            gun: { fireRate: 0.075, damage: 3.5, falloff: [14, 34, 0.5], spread: 0.045, moveSpread: 0.01, airSpread: 0.02,
                   shotSpeed: 95, lead: 0.8, range: 36, spinUp: 0.55, burst: [18, 30], burstRest: [0.6, 1.1] },
            stomp: { cooldown: 7, range: 6, windup: 0.6, hop: 6, radius: 6.5, damage: 18, knock: 12, lift: 6 },
            dash: { cooldown: 5.5, speed: 18, time: 0.35, gapRange: 24 },
            eject: { hpFrac: 0.15, fuse: 2.2, radius: 6.5, damage: 30, launch: 11 } },
  },
  // Foot Soldier kit, after Garden Warfare 2's (Z-6000, Q Stink Cloud, E Rocket Jump, F ZPG). Damage below is before
  // AGENTS.damageMult; timings/ranges are adaptations for this game, not original constants.
  SOLDIER: {
    rifle: { damage: 7, farDamage: 4.5, falloff: [20, 38], fireRate: 0.115, clip: 30, reloadTime: 1.9, speed: 75, lead: 0.85,
             spread: 0.016, bloomPerShot: 0.005, bloomMax: 0.045, bloomDecay: 0.08, movingSpread: 0.012,
             burst: [6, 11], commitBurst: [10, 18], pause: [0.25, 0.5], stalkMult: 1.35, reaction: 0.35, maxRange: 40 },
    stink: { cooldown: 15, range: [6, 24], radius: 4.5, duration: 6, dps: 8, tick: 0.5, fuse: 1.6, gravity: 22,
             throwTime: 0.3, stillSpeed: 2 },
    zpg: { cooldown: 13, windup: 0.6, airWindup: 0.25, trackFrac: 0.6, speed: 32, radius: 4, damage: 60, edgeDamage: 16,
           knock: 9, range: [7, 40], life: 2.5 },
    jump: { cooldown: 11, windup: 0.22, vy: 15, gravity: 24, airSpeed: 8, highGround: 2.5, reach: 18,
            escapeHp: 0.4, escapeRange: 7, blindTime: 3 },
    decideRate: 4,   // ability decisions per second
  },
  // Captain Deadbeard — long-range zombie sniper (Garden Warfare 2 kit, adapted). Damage numbers here are
  // before AGENTS.damageMult, so the effective values stay below the plant heroes'.
  PIRATE: {
    // Scallywag Shooter: scoped hitscan blunderbuss. A red scope glint + laser telegraph every shot (aimTime
    // [stalking, committed]); breaking line of sight drops the shot. Closer than closeRange the ball spreads out.
    sniper: { damage: 30, closeDamage: 22, closeRange: 12, aimTime: [0.85, 0.6], spreadMoving: 0.02, glint: 0.9 },
    // Barrel Blast: hide in a powder keg (takes reduced damage), waddle at the plant, hop out and leave the keg
    // to blow after a short fuse. Used when a plant gets close, or when hurt and pressed.
    barrel: { cooldown: 16, trigger: 9, hurtTrigger: 15, hurtFrac: 0.55, duration: 3.2, speed: 3.6, popDist: 2.6,
              damageTaken: 0.35, fuse: 1.1, radius: 5, damage: 70, minDamage: 18, hop: 7 },
    // Cannon Rodeo: ride a cannon in place and lob explosive balls on a ballistic arc (landing marked on the ground)
    cannon: { cooldown: 20, range: [12, 34], deploy: 0.6, shots: 4, interval: 1.05, pack: 0.45, flightTime: [0.8, 1.6],
              radius: 4, damage: 45, minDamage: 10, gravity: 18 },
    // Parrot Pal: send the parrot after a hidden or distant plant; Deadbeard stays rooted while it flies
    parrot: { cooldown: 24, minRange: 18, duration: 9, hp: 40, hitRadius: 0.55, speed: 14, orbit: 5, height: 5.5, fireRate: 0.3,
              damage: 5, spread: 0.06, recallDamage: 35 },
    perch: { samples: 10, heightWeight: 1.4, losBonus: 12, travelWeight: 0.12 },   // sniper vantage scoring
  },
  // The shared zombie brain: perception, aggro, steering, attack slots, safety nets
  AI: {
    thinkRate: [5, 10],          // decisions per second (random per zombie, so updates are staggered)
    loseSightTime: 4,            // seconds without sight before a chase is dropped
    chaseTimeout: 10,            // seconds chasing without landing a hit → give up, go for the statue
    retargetCooldown: 1.5,       // min seconds between target switches
    reaggroCooldown: 4,          // ignore the hero this long after giving up a chase
    packAlertRadius: 10, packAlertDelay: [0.2, 0.8],   // packmates join a spotted chase after a reaction delay
    directChaseRange: 10,
    lineCheck: 0.25,             // s between "is the straight line to my hero walkable?" checks        // steer straight at a visible hero inside this, else use the hero flow field
    playerFieldInterval: 0.4,    // hero flow field rebuild period while someone needs it
    speedJitter: 0.1,            // ±10% speed per zombie
    separation: 1.0,             // extra spacing (m) packmates try to keep
    separationWeight: 1.2,
    avoidLook: 2.2,              // obstacle feeler length (m)
    knockback: 9,                // explosion push at the center (m/s), scaled by 1 - knockbackResist
    blastFalloff: 0.4,           // plant explosions (explodeAt) deal this much less at the rim than at the centre
    armorBreakStun: 2,           // s an armoured boss reels when its shell breaks
    heroRise: 1.6,               // hero feet this far above the terrain = on a prop (no ground path)
    slots: { statueOffset: 0.75, statueSpacing: 1.5, statueClaim: 9, queueDist: 3.5,
             heroRadius: 1.6, heroCount: 6, heroClaim: 5, heroHold: 3.2 },
    stuck: { window: 1.2, minProgress: 0.6, nudgeTime: 0.9, teleportStrikes: 4 },
    distractionRadius: 14,       // default pull radius of a distraction (Chili Bean Bomb, etc.)
    // Several heroes: a zombie targets the best-scoring one = distance − recentDamageBonus if that hero hurt it
    // within recentDamageTime; it switches heroes (retarget cooldown permitting) only when another scores heroSwitchMargin better
    recentDamageTime: 3, recentDamageBonus: 8, heroSwitchMargin: 6,
    // Zombie routing (section "Zombie routing"): every zombie plans its own A* route to the statue on the nav grid.
    // Step cost = length × (1 + personal noise + crowd traffic + jams + cactus walls), so each one prefers its own
    // corridor, packs fan out over different gaps, and blocked or jammed ways are avoided. Searches share a
    // per-frame budget and resume across frames (one active search at a time); zombies waiting on a route
    // walk the statue flow field meanwhile.
    path: {
      budget: 7000,              // A* node expansions per frame, shared by all zombies…
      budgetMs: 1.2,             // …and never more than this many ms per frame
      chunk: 150,                // nodes expanded between deadline checks (small = the ms cap holds tighter)
      maxNodes: 60000,           // a single search gives up past this (falls back to the flow field)
      heuristic: 1.6,            // weighted A*: >1 = faster, slightly less optimal routes (noise keeps them varied)
      noiseScale: 30,            // m: feature size of the personal route-preference noise
      noiseAmp: [0.5, 2.6],      // per zombie: extra cost (× length) on its disliked ground, so it commits to a corridor
      traffic: { cell: 8, weight: 0.35, decay: 30 },   // each planned route makes its 8 m cells pricier for later planners
      jam: { add: 6, radius: 2, decay: 8 },           // where a zombie got stuck costs more for a while (everyone avoids it)
      wall: 25,                  // cost multiplier through a cactus wall (they still bash through when it is the only way)
      goalDist: 7,               // route done this many walking metres from the statue (attack slots take over)
      lookahead: 7,              // cells: steer at the farthest of the next few cells still in straight walkable line
      lookEvery: [0.2, 0.35],    // s between lookahead refreshes (line checks are not free)
      offRoute: 9,               // m from the route (after a chase, knockback, a shove) → plan a new one from here
      progressTime: 5,           // s without headway along the route → jam the spot + re-plan (3 in a row → hop free)
      lane: [0, 3.2],            // m: personal sideways offset from the route line (wide corridors fill up)
      rethink: [14, 28],         // s between spontaneous re-plans (with fresh traffic) while far from the statue
      rethinkMinDist: 45,        // walking metres from the statue: closer than this a zombie stays committed
    },
    // Making the horde feel alive while advancing (not while chasing or attacking)
    life: {
      wander: 0.28,              // rad: slow personal heading drift
      wanderFreq: [0.05, 0.16],  // Hz
      surge: 0.16,               // ± fraction of speed: zombies drift faster / slower over time
      surgeFreq: [0.04, 0.12],   // Hz
      pauseChance: 0.05,         // per second (advancing, far from heroes + statue): stop, look around, carry on
      pause: [0.6, 1.8],         // s
      pauseMinDist: 50,          // walking metres from the statue
    },
  },
  // Solo Ops Corn: a roaming soldier; behavior evidence and adaptation limits: docs/kernel-corn-ai.md.
  TEAMMATE_AI: {
    difficulty: 1,               // multiplier: >1 = faster reactions, tighter aim, faster turning; <1 = sloppier
    thinkRate: 10,               // decisions per second
    engageRange: 48,             // primary fire range; he paths closer before engaging beyond this
    awarenessRange: 75,          // acquires visible enemies locally, without a statue-centered leash
    hearingRange: 16,            // nearby enemies can be investigated around cover, but never shot through it
    targetMemory: 4,             // seconds searching the last known position after losing sight
    targeting: { bossRange: 65, swarmRadius: 7, swarmCount: 4, swarmHold: 1.5 },
    retargetCooldown: 1.2,       // same priority: finish current target; bosses / swarms override immediately
    combatMemory: 1.2,          // s without a target before reacting / topping up again
    targetAimWeight: 16,        // same priority: prefer targets near the current aim (score per radian)
    targetSwitchMargin: 6,      // same priority: a replacement must score this much better to interrupt a living target
    aimTransferAngle: 0.6,      // rad: carry settled accuracy into nearby targets, tapering to zero at this angle
    aimResponse: 18,            // exponential aim smoothing; turnSpeed still limits large turns
    reactionTime: 0.3,           // s to react at fight start; readiness carries between kills
    aimError: [0.1, 0.012],      // rad of aim wobble: fresh target → fully tracked…
    aimSettleTime: 1.6,          // …over this many seconds of tracking
    turnSpeed: 5,                // rad/s the aim can swing
    fireCone: 0.12,              // pulls the trigger only with the aim this close (rad) to where it wants it
    leadSkill: 0.85,             // fraction of the true lead (target velocity × kernel flight time) it aims ahead
    zoomRange: 16,               // aims down the sights (tighter spread, slower walk) at targets farther than this
    repathInterval: 0.5, waypointReach: 1.2, maxPathNodes: 8000,   // A* on the nav grid
    stuckJumpTime: 0.35,         // pushing into something this long without moving → jump
    shuck: { minCluster: 3, clusterRadius: 3.5, range: [7, 40] },  // bosses, armor, or a tight cluster
    butter: { minPack: 4, safeDist: 6 }, // visible groups or bosses anywhere in ability range
    hop: { attackRange: [2, 9], minPack: 2, landingDistance: 12, prepareTime: 0.18, headings: 16, turnBias: 6 },
    revive: { time: 5, range: 2.6, hpFraction: 0.5 }, // hold X this long; automatic respawn is shared in CONFIG.squad
    patrol: { radius: [14, 95], duration: [8, 13], arrival: 2.5 },
    vantage: { ranges: [10, 16, 24, 34], headings: 16, refresh: 0.8, rangeWeight: 0.5 },
    // Advance toward a fight, sidestep while firing, and make space from melee without abandoning the fight.
    combat: { preferRange: [8, 16], strafeSwitch: [1, 2.6], switchChance: 0.6,
      strafeWeight: 0.55, advanceWeight: 1.2, backoffWeight: 1.2, dodgeRadius: 5, dodgeWeight: 1.5 },
  },
  ZOMBIE_SCALE_PER_HERO: 0.4,   // each active hero beyond the first adds this fraction to every non-boss zombie count
  // Difficulty presets (squad menu, locked for the match). Multipliers over the base tuning:
  //   zombieHp - damage a zombie needs to die · zombieDamage - hits on plants · statueDamage - hits on the garden
  //   count - non-boss zombies per pack (bosses stay single)
  DIFFICULTY: {
    casual: { name: 'Casual', zombieHp: 0.7, zombieDamage: 0.6, statueDamage: 0.6, count: 0.75 },
    normal: { name: 'Normal', zombieHp: 1,   zombieDamage: 1,   statueDamage: 1,   count: 1 },
    hard:   { name: 'Hard',   zombieHp: 1.3, zombieDamage: 1.3, statueDamage: 1.25, count: 1.2 },
    crazy:  { name: 'Crazy',  zombieHp: 1.7, zombieDamage: 1.7, statueDamage: 1.5, count: 1.45 },
  },
  // Human jump timing: accept a slightly early landing press or a slightly late ledge press.
  movement: { jumpBuffer: 0.14, coyoteTime: 0.12 },
  // Player settings (menu / Esc pause screen), saved in localStorage. Quality: shadows, pixel ratio cap, particle cap
  settings: {
    storageKey: 'gardenDefense.settings',
    defaults: { sensitivity: 1, volume: 0.4, music: 0.6, motion: 1, fov: 70, quality: 'high', difficulty: 'normal' },
    sensitivity: [0.3, 3], fov: [55, 95],
    QUALITY: {
      low:  { name: 'Low',  shadows: false, shadowMap: 1024, pixelRatio: 0.75, particles: 150 },
      med:  { name: 'Med',  shadows: true,  shadowMap: 1024, pixelRatio: 1,    particles: 300 },
      high: { name: 'High', shadows: true,  shadowMap: 2048, pixelRatio: 2,    particles: 450 },
    },
  },
  debugPackSize: 4,             // zombies spawned per debug key press (Shift + 1–8)
  // -------------------------------------------------------------------
  // THE MAP — grey-box layout. x = east, z = south (north is -z). Statue at the origin.
  // Sunken Statue Court (tier 0) → open mid ring (tier 3) walled by cliffs (tier 14), with four
  // approaches cut through the walls: the north road, the east flank, the west wall gates and the
  // raised southern quarry (tier 8). Heights are absolute metres. Terrain = bowl + plateaus + ramps,
  // sampled into a heightfield. Corridors are ≥ 8 m wide; ramps are smooth (slope ≤ 0.45).
  // -------------------------------------------------------------------
  MAP: {
    size: 440,                   // world is size × size metres, centered on the statue
    cell: 2,                     // nav grid cell size (flow fields)
    tiers: { court: 0, mid: 3, high: 8, wall: 14 },
    bowl: { floorRadius: 14, rimRadius: 26 },   // flat court floor, then a smooth slope up to the mid tier
    maxSlope: 0.7,               // rise per metre zombies can walk (ramps yes, cliffs no)
    climbCost: 5,                // Climbers' nav layer: a cliff step costs this many flat steps
    navClearance: 1.0,           // obstacles are inflated by this for the nav grid
    stepUp: 0.45,                // the hero walks up ledges this tall without jumping
    rampEdge: 1,                 // m: blend width of a ramp's sides (a cliff, like the plateau edges)
    ledgeDrop: 1.2,              // m: a nav cell next to a drop deeper than this is a ledge (cliff top, ramp side)…
    ledgeCost: 0.8,              // …that routes (zombies and AI plants) avoid: extra cost × step length
    // Raised terrain. rect {x,z,w,d} (center + size) or circle {x,z,r}; edge = blend width (≈1 cliff, 4+ slope)
    plateaus: [
      // Outer cliff walls (tier 14): only Climbers get over these
      { name: 'NW Block',          x: -130,  z: -160, w: 180, d: 120, h: 14, edge: 1 },
      { name: 'NE Block',          x: 62.5,  z: -160, w: 45,  d: 120, h: 14, edge: 1 },
      { name: 'East Cliffs',       x: 152.5, z: 0,    w: 135, d: 440, h: 14, edge: 1 },
      { name: 'SW Block',          x: -150,  z: 140,  w: 140, d: 160, h: 14, edge: 1 },
      // West Wall, split by two choke gaps: Garden Gate (z 18..32) and Sluice Pass (z -63..-49)
      { name: 'West Wall (north)', x: -74,   z: -81,  w: 12,  d: 38,  h: 14, edge: 1 },
      { name: 'West Wall (mid)',   x: -74,   z: -15.5, w: 12, d: 67,  h: 14, edge: 1 },
      { name: 'West Wall (south)', x: -74,   z: 46,   w: 12,  d: 28,  h: 14, edge: 1 },
      // Raised tiers (tier 8): the quarry spawn shelf (cliff front at z = 60) and the windmill ridge
      { name: 'Quarry Top',        x: 2.5,   z: 140,  w: 165, d: 160, h: 8,  edge: 1 },
      { name: 'Windmill Ridge',    x: -27.5, z: -137, w: 25,  d: 66,  h: 8,  edge: 1 },
      // Mounds (slopes all round)
      { name: 'Well Mound',        x: 12,    z: -60,  r: 4,   h: 5.5, edge: 6 },
      { name: 'Bandstand',         x: 12,    z: 36,   r: 4,   h: 4.6, edge: 4 },
    ],
    // Straight ramps: from [x, z, h] (high end, exactly on the plateau's edge at its height) to [x, z, h] (low end,
    // at ground height), width in metres. A high end inside the plateau leaves a lip at the edge (tests/terrain.cjs).
    ramps: [
      { name: 'Ridge Ramp N',  from: [-26, -170, 8],  to: [-26, -192, 3], width: 10 },
      { name: 'Ridge Ramp S',  from: [-26, -104, 8],  to: [-26, -82, 3],  width: 10 },
      { name: 'Quarry Ramp W', from: [-30, 60, 8],    to: [-30, 38, 3],   width: 10 },
      { name: 'Quarry Ramp E', from: [55, 60, 8],     to: [55, 38, 3],    width: 10 },
      { name: 'Rampart Ramp',  from: [-68, -12, 14],  to: [-43, -12, 3],  width: 8 },
    ],
    // Solid props, standing on the terrain at their center. box {w,d} or cyl {r}; h above ground.
    //   hedge/building block line of sight (break aggro, kite loops); cover is low (stops globs, not sight);
    //   any top can be stood on if you get up there (platforms are meant to be jumped onto).
    obstacles: [
      // Statue Court: a little cover and the fountain loop
      { name: 'Fountain',      kind: 'cover',    x: -8,  z: 7,     r: 2.6, h: 1.1 },
      { name: 'North Planter', kind: 'cover',    x: 5,   z: -9,    w: 5,   d: 1.4, h: 1.0 },
      { name: 'East Planter',  kind: 'cover',    x: 9,   z: 5,     w: 1.4, d: 5,   h: 1.0 },
      // Mid ring: the shed loop, the hedge wall, hiding hedges, the jump-only tower
      { name: 'Tool Shed',     kind: 'building', x: 26,  z: 17,    w: 10,  d: 7,   h: 4.2 },
      { name: 'Hedge Wall',    kind: 'hedge',    x: 36,  z: -38,   w: 2.5, d: 30,  h: 3.2 },
      { name: 'Rose Hedge',    kind: 'hedge',    x: -36, z: 12,    w: 2.5, d: 16,  h: 3.2 },
      { name: 'Arc Hedge',     kind: 'hedge',    x: -6,  z: -40,   w: 18,  d: 2.5, h: 3.2 },
      { name: 'Water Tower',   kind: 'platform', x: -28, z: -26,   w: 4,   d: 4,   h: 2.6 },
      { name: 'Tower Crate',   kind: 'platform', x: -25, z: -23.2, w: 2,   d: 2,   h: 1.25 },
      // Short flank: the greenhouse hides the spawn and splits it into a north and a south route
      { name: 'Greenhouse',    kind: 'building', x: 52,  z: -5,    w: 6,   d: 22,  h: 5 },
      // Long road: low wall on the mound in the lane, a few orchard blocks to dodge between
      { name: 'Mound Wall',    kind: 'cover',    x: 12,  z: -64.5, w: 4,   d: 0.8, h: 1.0 },
      { name: 'Orchard Crates', kind: 'cover',   x: 14,  z: -130,  w: 3,   d: 3,   h: 1.2 },
      { name: 'Hay Stack',     kind: 'cover',    x: -2,  z: -165,  w: 4,   d: 2.5, h: 1.6 },
      // Windmill Ridge: landmark + low cover looking down the road
      { name: 'Windmill',      kind: 'building', x: -35, z: -140,  r: 2.5, h: 11 },
      { name: 'Ridge Cover A', kind: 'cover',    x: -16.5, z: -150, w: 0.8, d: 6, h: 1.1 },
      { name: 'Ridge Cover B', kind: 'cover',    x: -16.5, z: -125, w: 0.8, d: 6, h: 1.1 },
      // Garden Gate: posts squeeze the gap (≈9 m clear), a low wall inside faces it
      { name: 'Gate Post N',   kind: 'building', x: -74, z: 19.5,  r: 0.9, h: 5 },
      { name: 'Gate Post S',   kind: 'building', x: -74, z: 30.5,  r: 0.9, h: 5 },
      { name: 'Gate Cover',    kind: 'cover',    x: -56, z: 18,    w: 1,   d: 5,   h: 1.1 },
      // Rampart (west wall top): parapet facing the west field
      { name: 'Parapet',       kind: 'cover',    x: -79, z: -12,   w: 0.8, d: 8,   h: 1.0 },
      // Bandstand rails (open toward the quarry cliffs)
      { name: 'Bandstand Rail N', kind: 'cover', x: 12,  z: 32.6,  w: 5,   d: 0.6, h: 1.0 },
      { name: 'Bandstand Rail W', kind: 'cover', x: 8.4, z: 36,    w: 0.6, d: 3,   h: 1.0 },
    ],
    // Named spots (theming anchors). Shown in the debug map (M).
    landmarks: [
      { name: 'Statue Court',   x: 0,   z: 0,    note: 'sunken, open, a little cover' },
      { name: 'Windmill Ridge', x: -22, z: -137, note: 'vantage: sees Orchard Road, far from statue (ramps N + S)' },
      { name: 'Rampart',        x: -76, z: -12,  note: 'vantage: west wall top over both gates (inside ramp)' },
      { name: 'Bandstand',      x: 12,  z: 36,   note: 'vantage: near statue, exposed to the quarry (slopes)' },
      { name: 'Water Tower',    x: -28, z: -26,  note: 'vantage: jump-only (crate → tower)' },
      { name: 'Well Mound',     x: 12,  z: -60,  note: 'vantage: right in the road (slopes)' },
      { name: 'Tool Shed',      x: 26,  z: 17,   note: 'kite loop' },
      { name: 'Fountain',       x: -8,  z: 7,    note: 'kite loop' },
      { name: 'Hedge Wall',     x: 36,  z: -38,  note: 'kite loop' },
    ],
  },
  // Spawn areas — each one a different tactical problem. A zombie appears on a random open cell inside its
  // area (`r` metres around x/z, at least `minStatue` walking metres from the statue), then plans its own A*
  // route to the statue (section "Zombie routing"): no fixed lanes, every zombie picks and re-picks its way.
  SPAWN_POINTS: {
    longRoad: { x: -4, z: -192, r: 34, minStatue: 150, label: 'Orchard Road', note: 'long and open: road or ridge', color: '#ffd23a' },
    flank:    { x: 72, z: -6,   r: 24, minStatue: 62,  label: 'Greenhouse Gap', note: 'short flank around the greenhouse', color: '#ff5a3a' },
    choke:    { x: -140, z: -20, r: 52, minStatue: 95, label: 'West Fields', note: 'wide field funnelling into two wall gates', color: '#5ad0ff' },
    climb:    { x: 2, z: 158,   r: 50, minStatue: 105, label: 'Quarry Top', note: 'cliff shelf: two ramps down beside the quarry', color: '#c07aff' },
  },
  randomPackSpawns: true,      // every pack picks a random spawn area (no fixed order); false = wave data
  packCluster: 0.45,           // fraction of a pack that spawns around a shared anchor; the rest anywhere in the area
  packAnchorRadius: 14,        // m: the clustered part's scatter around the anchor
  spawnBurst: 1.5,              // seconds over which one pack's zombies appear (staggered clump)
  packDelayTighten: 0.01,       // each wave shortens the hidden pack timers by this fraction…
  packDelayMin: 0.9,            // …down to this multiplier (wave data already ramps the pacing)
  waveCountdown: 5,           // seconds of countdown before each wave (banner, beacons, ground arrows, HUD arrow)
  // Between-wave boons: after each cleared wave the squad takes 1 of `offer` random boons (← → + Enter). Each is a
  // squad-wide multiplier for the rest of the match (state.boons); one boon can be taken `max` times. The countdown
  // waits up to pickTime for the choice and drops back to waveCountdown once one is taken. Spectators and automated
  // runs take the highlighted card after autoDelay s; a timeout takes it too.
  boons: {
    offer: 3, pickTime: 12, autoDelay: 2.5, max: 3,
    list: [
      { key: 'damage',   icon: '🌵', name: 'Thorned Shots',  text: '+12% damage to zombies',        stat: 'damage',   mult: 1.12 },
      { key: 'health',   icon: '🌱', name: 'Deep Roots',     text: '+15% max health',               stat: 'health',   mult: 1.15 },
      { key: 'cooldown', icon: '☀️', name: 'Photosynthesis', text: 'Abilities recharge 18% faster', stat: 'cooldown', mult: 1.18 },
      { key: 'speed',    icon: '🍃', name: 'Fleet Roots',    text: '+8% move speed',                stat: 'speed',    mult: 1.08 },
      { key: 'reload',   icon: '🫛', name: 'Quick Pods',     text: 'Reload 25% faster',             stat: 'reload',   mult: 1.25 },
      { key: 'respawn',  icon: '🌻', name: 'Fast Sprouting', text: 'Respawn 30% sooner',            stat: 'respawn',  mult: 0.7 },
    ],
  },
  // Wave mutators: every match rolls `waves` of the waves from..to (zero-based) to carry one random mutator, never the
  // same one twice in a row. Multipliers on that wave: hp (hits a zombie takes), count (non-boss zombies), speed
  // (zombie walking speed), damage (zombie damage to plants). Shown on the countdown banner.
  MUTATORS: {
    waves: 3, from: 1, to: 8,
    list: [
      { key: 'frenzy', name: 'Frenzy',        text: 'zombies move 15% faster',                   speed: 1.15 },
      { key: 'thick',  name: 'Thick Skulls',  text: 'zombies take 25% more hits, 15% fewer come', hp: 1.25, count: 0.85 },
      { key: 'swarm',  name: 'Swarm',         text: '30% more zombies, each one frailer',         count: 1.3, hp: 0.8 },
      { key: 'heavy',  name: 'Heavy Hitters', text: 'zombies hit 20% harder, 10% fewer come',     damage: 1.2, count: 0.9 },
    ],
  },
  incomingPreviewCount: 3,      // how many zombie types the "Incoming" preview lists
  skullTime: 20,                // the ghost skull marks where a pack spawned for this many seconds
  maxParticles: 450,
  render: {
    minShadowCaster: 0.03,     // m: baked rig parts smaller than this skip the shadow pass (under a shadow texel)
    zombieBatch: 400,          // instanced bodies per zombie type (overflow: capsules draw individually, horde skips)
    hordeRows: 64,             // initial rows of each horde type's bone texture (doubles when the horde outgrows it)
    corpseTime: 2.4,           // s a dead horde zombie lies on the ground before sinking away
    // Horde level of detail: zombies farther than `distance` m (at the default FOV; zooming in pushes it out) draw a
    // second, coarser sculpt (segment counts × detail) in its own batch. hysteresis (m) stops flicker at the line.
    hordeLod: { distance: 30, hysteresis: 3, detail: 0.4 },
  },
  plantShotLife: 6,       // s; plant bullets fly until they hit something or leave the map (this is only a safety net)
  // World art (section "World art"): purely visual dressing over the grey-box collision. Colours are sRGB hex.
  art: {
    colors: { grassA: 0x4a7f2b, grassB: 0x6f9c40, grassDark: 0x355f22, meadow: 0x5b8f35, dirt: 0x9b7650, rock: 0x8c8274,
      rockDark: 0x675d52, quarry: 0xb9a07a, dead: 0x76704f, curb: 0xc9c0ad, courtRing: 0x9a8f7c, grime: 0x4a4038 },
    groundBoost: 1.12,         // compensates the detail texture's darkening
    detailTile: 6,             // m per repeat of the ground speckle texture
    pathWidth: 2.6,            // m: half-width of the worn dirt paths
    // Worn paths from the court to each spawn area (polylines of [x, z]); they follow the likely zombie routes
    paths: [
      [[4, -14], [8, -50], [6, -90], [2, -130], [6, -160], [-4, -192]],                 // Orchard Road
      [[14, 2], [36, 4], [46, 14], [60, 12], [72, -4]],                                 // Greenhouse Gap
      [[-14, 5], [-30, 26], [-56, 25], [-74, 25], [-110, 22]],                          // Garden Gate
      [[-12, -8], [-22, -34], [-48, -52], [-74, -56], [-110, -52]],                     // Sluice Pass
      [[-6, 13], [-24, 34], [-30, 64], [-24, 110]],                                     // Quarry Ramp W
      [[9, 11], [40, 34], [55, 64], [46, 110]],                                         // Quarry Ramp E
    ],
    courtRings: [[5.4, 6.0], [12.6, 13.2]],   // darker stone rings in the paving (inner / outer radius, m)
    sky: { radius: 600, top: 0x3f8fd8, horizon: 0xc4e6f2, bottom: 0x9cc8a0, clouds: 9 },
    decor: { chunk: 60, treeStep: 8, treeFill: 0.75, rocks: 180, boulders: 260, gravesPerArea: 14, tufts: 6000, tuftRange: 110, flowerChance: 0.08 },
    flowerColors: [0xff5a6a, 0xffd23a, 0xffffff, 0xb07aff, 0xff9a3a],
    rockShade: ['0.15, 0.13, 0.11', '0.33, 0.29, 0.24'],   // linear RGB: dark / light strata on cliff faces
    windmillSpin: 0.5,         // rad/s
    statueBarY: 7.2,           // m: the garden's floating health bar (above the gnome's hat)
    statueGrime: 0.55,         // how far the gnome's paint fades toward grime at 0 hp
  },
  // Situational awareness HUD (section "Situational awareness"): radar, hit arcs, garden alert, straggler pips
  // One-time onboarding tips (section "Situational awareness"): seen keys persist in localStorage
  tips: { storageKey: 'gardenDefense.tipsSeen', time: 8, gap: 2.5, abilitiesAt: 25, squadAt: 50 },
  feedback: { popupCap: 48, allyPopupRange: 45, clearBannerDelay: 1.7 },
  // Adaptive procedural score (section "Music"): one 16-step sequencer, layers fade in/out with the match state.
  // calm = countdown, combat = wave running, boss = a boss alive or the extraction finale. Notes are MIDI.
  music: {
    bpm: 112, lookahead: 0.2, fade: 1.4, reverb: 0.22,
    heatRange: 45, heatFull: 5,                 // zombies within heatRange m of you; at heatFull the full drum kit plays
    chords: {                                   // 4 chords per loop; [root, ...chord tones]
      major: [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]],   // C · Am · F · G
      minor: [[45, 57, 60, 64], [41, 57, 60, 65], [38, 57, 62, 65], [40, 56, 59, 64]],   // Am · F · Dm · E
    },
    barsPerChord: { calm: 2, combat: 1, boss: 1 },
    layers: {                                   // layer gains per mode (0 = silent)
      calm:   { pad: 0.55, pluck: 0.5,  bass: 0,    drums: 0,    brass: 0 },
      combat: { pad: 0,    pluck: 0.5,  bass: 0.55, drums: 0.5,  brass: 0 },
      boss:   { pad: 0.3,  pluck: 0.4,  bass: 0.6,  drums: 0.6,  brass: 0.32 },
      off:    { pad: 0,    pluck: 0,    bass: 0,    drums: 0,    brass: 0 },
    },
  },
  hudAware: { radarRange: 90, radarHz: 15, hitTime: 1.1, hitGuessRange: 40, gardenAlertTime: 2.5, gardenArrowDist: 22, gardenRadius: 7,
    stragglers: 6 },
  // Pacing: zombies far from the garden AND from every plant walk faster (no dead time while they cross the map);
  // the last few zombies of a wave hurry the same way. Never bosses or agents.
  hurry: { mult: 1.75, statueDist: 45, heroDist: 40, stragglers: 6, gardenSafe: 25 },   // gardenSafe: stragglers never rush the last metres
  fxLights: 2,            // pooled effect point lights (Super Brainz balls); fixed so shaders never recompile

  // Engagement: short goals, readable surprises, class expression and saved recognition. No power grind.
  engagement: {
    storageKey: 'garden-defense-mastery-v1', saveInterval: 4,
    levelXp: 400, levelGrowth: 125, maxLevel: 10, maxXp: 100000000,
    titles: ['Sprout', 'Defender', 'Specialist', 'Garden Hero', 'Master'], titleEvery: 2,
    xp: { kill: 35, agent: 65, boss: 220, assist: 20, heal: 0.35, revive: 90, wave: 60, victory: 300 },
    assistWindow: 10, assistFraction: 0.12,
    chain: { window: 5, milestones: [3, 5, 8], names: ['TRIPLE VANQUISH', 'ON A ROLL', 'GARDEN LEGEND'], xp: [30, 55, 90] },
    feed: { life: 3.5, max: 3 },
    mvp: { kills: 100, damage: 0.1, assists: 20, healing: 0.15, revives: 60 },
    // Multipliers are lateral primary-weapon choices. Abilities and health keep their class identity.
    loadouts: {
      corn: { name: 'Heavy Kernels', description: 'Harder hits, slower fire and a smaller clip.',
        mult: { damage: 1.45, minDamage: 1.45, fireRate: 1.45, clip: 0.7, reloadTime: 1.15 } },
      peashooter: { name: 'Rapid Peas', description: 'More peas and a larger clip; each pea hits less hard.',
        mult: { damage: 0.7, minDamage: 0.7, splashDamage: 0.7, fireRate: 0.72, clip: 1.4, spread: 1.5 } },
      sunflower: { name: 'Focus Pulse', description: 'Accurate, heavier pulses with slower fire and a smaller clip.',
        mult: { damage: 1.35, minDamage: 1.35, fireRate: 1.4, clip: 0.75, spread: 0.5, aimSpread: 0.5 } },
      cactus: { name: 'Repeater Spikes', description: 'Faster follow-up shots and more ammo; less damage and precision.',
        mult: { damage: 0.62, minDamage: 0.62, fireRate: 0.65, clip: 1.6, criticalMult: 0.9, spread: 1.6, aimSpread: 1.6 } },
      citron: { name: 'Focus Beam', description: 'A hotter beam that hits harder but overheats much sooner.',
        mult: { damage: 1.35, minDamage: 1.35, heatPerTick: 1.5 } },
      rose: { name: 'Thorn Flurry', description: 'Faster thistles and a bigger clip; each hits softer and homes less.',
        mult: { damage: 0.72, fireRate: 0.7, clip: 1.5, turnRate: 0.7 } },
      chomper: { name: 'Hungry Jaws', description: 'Quicker, lighter bites, and swallowed zombies go down faster.',
        mult: { damage: 0.72, fireRate: 0.7, chew: 0.65, heldChew: 0.65 } },
    },
    // Zero-based waves. Never replace boss packs or introduce a type before its normal debut.
    specialWaves: [2, 5, 7],
    themes: [
      { key: 'rush', name: 'Sprint Convention', minWave: 2, type: 'sprinter', fraction: 0.65, delay: 0.85, hint: 'Keep moving · splash attacks stop the rush' },
      { key: 'armor', name: 'Bucket Brigade', minWave: 2, type: 'plated', fraction: 0.3, delay: 1.15, hint: 'Flank the armor · aim for exposed cores' },
      { key: 'ranged', name: 'Spit Take', minWave: 5, type: 'spitter', fraction: 0.4, delay: 1, hint: 'Break line of sight · close the distance' },
    ],
    pacing: { lowAlive: 2, quietTime: 3, nextPack: 2.5, hurtGrace: 5, gardenSafe: 0.4 },
  },

  // Waves as data. Each wave: { lanes?, packs: [{ spawn?, delay, zombies: { type: count } }], modifiers: [] }
  //   lanes     — optional: spawns this wave may use; packs without `spawn` take them in turn
  //   packs     — spawn in order; `delay` = hidden seconds after the previous pack (shrunk by packDelayTighten)
  //   special waves — CONFIG.engagement themes remix shambler counts without mutating these base packs
  // Lanes rotate between waves so no single spot covers everything.
  // Boss slot machine: on these waves the pack marked `bossSlot: true` gets a rolled boss encounter.
  // The reel spins during the countdown and lands `spin` s in. weight = [first slot wave, second slot wave].
  //   zombies - added to the pack (scaled like the pack; bosses stay single)
  //   agents  - this many random unlocked tactical agents join the pack ([min, max])
  BOSS_SLOT: {
    waves: [4, 9], spin: 4, ticks: 0.07,
    options: [
      { key: 'gargantuar', label: 'Gargantuar',       weight: [3, 2], zombies: { miniBoss: 1 } },
      { key: 'mecha',      label: 'Mecha Gargantuar', weight: [1, 3], zombies: { finalBoss: 1 } },
      { key: 'agents',     label: 'Agent Squad',      weight: [2, 2], agents: [3, 4] },
      { key: 'mixed',      label: 'Mixed Pack',       weight: [2, 2], zombies: { plated: 2, bomber: 1, howler: 1, banner: 1 }, agents: [1, 2] },
    ],
  },
  // Extraction finale after the last wave: a landing zone opens out in the map; the squad runs there and holds it
  // under a final horde. The zone charges while a living plant stands inside (faster with more plants).
  FINALE: {
    distance: [70, 115],     // m from the statue (a random reachable nav cell)
    radius: 9,               // m: the landing zone
    hold: 120,               // s of one plant inside to fill the charge...
    perExtraPlant: 0.35,     // ...each extra plant inside adds this much speed
    timeLimit: 240,          // s: the rescue leaves without you (defeat)
    interval: 4,             // s between horde groups
    group: [3, 6],           // zombies per group
    maxAlive: 50,            // no new groups above this many living zombies
    agentChance: 0.12,       // per group: one tactical agent comes along
    mix: ['shambler', 'shambler', 'shambler', 'sprinter', 'sprinter', 'plated', 'spitter', 'bomber', 'climber', 'howler', 'banner'],
    aggroRange: 120,         // the finale horde hunts plants (no sight needed) instead of the statue
  },
  WAVES: [
    // Pacing: packs every ~6 s in waves 1–2, ~7–8 s in 3–4, ~10–13 s after; one longer lull (~22–28 s) mid-wave before a heavy pack.
    // 1 — tutorial: shamblers, Orchard Road both routes (4 packs)
    { agentCap: 1, packs: [
      { spawn: 'longRoad', zombies: { shambler: 5 } },
      { spawn: 'longRoad', delay: 6, zombies: { shambler: 5 } },
      { spawn: 'flank', delay: 7, zombies: { shambler: 4 } },
      { spawn: 'longRoad', delay: 7, zombies: { shambler: 7 } },
    ] },
    // 2 — sprinters appear (5)
    { agentCap: 1, packs: [
      { spawn: 'flank', zombies: { shambler: 5 } },
      { spawn: 'longRoad', delay: 5, zombies: { shambler: 5, sprinter: 2 } },
      { spawn: 'flank', delay: 5, zombies: { sprinter: 4 } },
      { spawn: 'longRoad', delay: 6, zombies: { shambler: 6 } },
      { spawn: 'flank', delay: 6, zombies: { shambler: 5, sprinter: 3 } },
    ] },
    // 3 — West Gates + plated (7)
    { agentCap: 1, packs: [
      { spawn: 'choke', zombies: { shambler: 6 } },
      { spawn: 'choke', delay: 7, zombies: { shambler: 5, plated: 1 } },
      { spawn: 'flank', delay: 7, zombies: { sprinter: 4 } },
      { spawn: 'longRoad', delay: 8, zombies: { shambler: 6, plated: 1 } },
      { spawn: 'choke', delay: 7, zombies: { shambler: 6, sprinter: 2 } },
      { spawn: 'flank', delay: 8, zombies: { shambler: 4, plated: 1 } },
      { spawn: 'choke', delay: 8, zombies: { shambler: 7, plated: 2 } },
    ] },
    // 4 — Quarry Top, spitters + climbers (8)
    { agentCap: 2, packs: [
      { spawn: 'climb', zombies: { shambler: 6 } },
      { spawn: 'climb', delay: 7, zombies: { shambler: 4, spitter: 2 } },
      { spawn: 'longRoad', delay: 7, zombies: { shambler: 5, sprinter: 2 } },
      { spawn: 'choke', delay: 7, zombies: { shambler: 5, plated: 1 } },
      { spawn: 'climb', delay: 8, zombies: { shambler: 4, climber: 2 } },
      { spawn: 'flank', delay: 6, zombies: { sprinter: 4, spitter: 1 } },
      { spawn: 'longRoad', delay: 7, zombies: { shambler: 6, spitter: 2 } },
      { spawn: 'climb', delay: 8, zombies: { shambler: 6, climber: 2, plated: 1 } },
    ] },
    // 5 — the boss slot (BOSS_SLOT) rides with the third pack so later enemies can catch up (10)
    { agentCap: 2, packs: [
      { spawn: 'flank', zombies: { shambler: 5, sprinter: 2 } },
      { spawn: 'longRoad', delay: 9, zombies: { shambler: 6 } },
      { spawn: 'longRoad', delay: 9, bossSlot: true, zombies: { shambler: 6 } },
      { spawn: 'climb', delay: 9, zombies: { shambler: 4, spitter: 2 } },
      { spawn: 'choke', delay: 14, zombies: { shambler: 5, plated: 1 } },
      { spawn: 'flank', delay: 11, zombies: { sprinter: 4 } },
      { spawn: 'choke', delay: 9, zombies: { shambler: 6, plated: 1 } },
      { spawn: 'climb', delay: 9, zombies: { climber: 3, shambler: 3 } },
      { spawn: 'longRoad', delay: 9, zombies: { shambler: 6, spitter: 2 } },
      { spawn: 'flank', delay: 9, zombies: { shambler: 5, sprinter: 3, plated: 1 } },
    ] },
    // 6 — howlers, lanes rotate (12)
    { agentCap: 2, lanes: ['choke', 'climb', 'flank', 'longRoad'], packs: [
      { zombies: { shambler: 6 } },
      { delay: 11, zombies: { shambler: 5, plated: 1 } },
      { delay: 11, zombies: { sprinter: 4, howler: 1 } },
      { delay: 11, zombies: { shambler: 5, spitter: 2 } },
      { delay: 12, zombies: { shambler: 6, climber: 2 } },
      { delay: 11, zombies: { shambler: 4, plated: 2 } },
      { delay: 18, zombies: { shambler: 8, howler: 1, sprinter: 2 } },
      { delay: 11, zombies: { spitter: 3, shambler: 3 } },
      { delay: 11, zombies: { sprinter: 5 } },
      { delay: 11, zombies: { shambler: 6, plated: 1 } },
      { delay: 12, zombies: { shambler: 5, climber: 2, howler: 1 } },
      { delay: 13, zombies: { shambler: 7, plated: 2, spitter: 2 } },
    ] },
    // 7 — bombers, banners (13)
    { agentCap: 3, packs: [
      { spawn: 'longRoad', zombies: { shambler: 6 } },
      { spawn: 'flank', delay: 13, zombies: { shambler: 4, bomber: 1 } },
      { spawn: 'choke', delay: 13, zombies: { shambler: 6, banner: 1 } },
      { spawn: 'climb', delay: 13, zombies: { shambler: 4, spitter: 2 } },
      { spawn: 'longRoad', delay: 13, zombies: { shambler: 6 } },
      { spawn: 'flank', delay: 12, zombies: { sprinter: 5 } },
      { spawn: 'choke', delay: 20, zombies: { shambler: 7, plated: 2, banner: 1 } },
      { spawn: 'climb', delay: 13, zombies: { climber: 3, shambler: 3 } },
      { spawn: 'longRoad', delay: 12, zombies: { shambler: 5, bomber: 2 } },
      { spawn: 'flank', delay: 12, zombies: { shambler: 4, howler: 1, sprinter: 2 } },
      { spawn: 'choke', delay: 13, zombies: { shambler: 6 } },
      { spawn: 'climb', delay: 12, zombies: { shambler: 5, spitter: 2 } },
      { spawn: 'longRoad', delay: 14, zombies: { shambler: 8, plated: 2, bomber: 1, banner: 1 } },
    ] },
    // 8 — full roster, all lanes in rotation (15)
    { agentCap: 3, lanes: ['longRoad', 'choke', 'flank', 'climb'], packs: [
      { zombies: { shambler: 6, sprinter: 2 } },
      { delay: 12, zombies: { shambler: 5, plated: 1 } },
      { delay: 12, zombies: { sprinter: 4, bomber: 1 } },
      { delay: 13, zombies: { shambler: 4, climber: 2 } },
      { delay: 12, zombies: { shambler: 6, banner: 1 } },
      { delay: 12, zombies: { spitter: 3, plated: 1 } },
      { delay: 13, zombies: { shambler: 5 } },
      { delay: 12, zombies: { shambler: 5, howler: 1 } },
      { delay: 22, zombies: { shambler: 8, plated: 2, banner: 1 } },
      { delay: 12, zombies: { sprinter: 5, bomber: 1 } },
      { delay: 12, zombies: { shambler: 5, spitter: 2 } },
      { delay: 12, zombies: { climber: 3, shambler: 3 } },
      { delay: 12, zombies: { shambler: 6, plated: 1 } },
      { delay: 12, zombies: { shambler: 6, howler: 1 } },
      { delay: 14, zombies: { shambler: 8, plated: 2, spitter: 2, banner: 1 } },
    ] },
    // 9 — heavy pressure (17)
    { agentCap: 3, packs: [
      { spawn: 'longRoad', zombies: { shambler: 7 } },
      { spawn: 'flank', delay: 12, zombies: { sprinter: 5 } },
      { spawn: 'climb', delay: 12, zombies: { shambler: 5, spitter: 2 } },
      { spawn: 'choke', delay: 12, zombies: { shambler: 5, plated: 2 } },
      { spawn: 'longRoad', delay: 12, zombies: { shambler: 5, bomber: 2 } },
      { spawn: 'flank', delay: 11, zombies: { shambler: 4, banner: 1, sprinter: 2 } },
      { spawn: 'climb', delay: 12, zombies: { climber: 3, shambler: 2 } },
      { spawn: 'choke', delay: 12, zombies: { shambler: 6, howler: 1 } },
      { spawn: 'longRoad', delay: 22, zombies: { shambler: 9, plated: 3, banner: 1 } },
      { spawn: 'flank', delay: 12, zombies: { sprinter: 5, bomber: 1 } },
      { spawn: 'climb', delay: 11, zombies: { shambler: 5, spitter: 2 } },
      { spawn: 'choke', delay: 11, zombies: { shambler: 5, plated: 1 } },
      { spawn: 'longRoad', delay: 12, zombies: { shambler: 6 } },
      { spawn: 'flank', delay: 11, zombies: { shambler: 5, howler: 1 } },
      { spawn: 'climb', delay: 12, zombies: { shambler: 4, climber: 3 } },
      { spawn: 'choke', delay: 11, zombies: { spitter: 3, bomber: 2 } },
      { spawn: 'longRoad', delay: 14, zombies: { shambler: 9, plated: 3, sprinter: 3, banner: 1 } },
    ] },
    // 10 — the second boss slot leads pack nine, a court follows after a breather (20); extraction (FINALE) after
    { agentCap: 4, packs: [
      { spawn: 'longRoad', zombies: { shambler: 7 } },
      { spawn: 'flank', delay: 12, zombies: { sprinter: 5 } },
      { spawn: 'choke', delay: 11, zombies: { shambler: 5, plated: 2 } },
      { spawn: 'climb', delay: 11, zombies: { shambler: 5, spitter: 2 } },
      { spawn: 'longRoad', delay: 11, zombies: { shambler: 5, bomber: 2 } },
      { spawn: 'flank', delay: 11, zombies: { shambler: 4, banner: 1, howler: 1 } },
      { spawn: 'choke', delay: 11, zombies: { shambler: 6 } },
      { spawn: 'climb', delay: 11, zombies: { climber: 3, shambler: 3 } },
      { spawn: 'longRoad', delay: 12, bossSlot: true, zombies: { shambler: 8, plated: 2 } },
      { spawn: 'flank', delay: 11, zombies: { sprinter: 5, bomber: 1 } },
      { spawn: 'choke', delay: 11, zombies: { shambler: 5, spitter: 2 } },
      { spawn: 'longRoad', delay: 28, zombies: { shambler: 7, plated: 2, banner: 1 } },
      { spawn: 'climb', delay: 15, zombies: { shambler: 5, spitter: 2 } },
      { spawn: 'flank', delay: 12, zombies: { sprinter: 4, howler: 1 } },
      { spawn: 'choke', delay: 12, zombies: { shambler: 5, plated: 2, banner: 1 } },
      { spawn: 'longRoad', delay: 12, zombies: { shambler: 3, bomber: 1 } },
      { spawn: 'climb', delay: 12, zombies: { climber: 3, shambler: 3 } },
      { spawn: 'flank', delay: 12, zombies: { shambler: 6, sprinter: 2 } },
      { spawn: 'choke', delay: 12, zombies: { spitter: 3, plated: 2 } },
      { spawn: 'longRoad', delay: 14, zombies: { shambler: 10, plated: 3, bomber: 2, banner: 1 } },
    ] },
  ],
};
