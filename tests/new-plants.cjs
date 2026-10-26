// Citron, Rose and Chomper against the real game: every primary and ability does what its kit promises, the shared
// hooks (cloak, Peel Shield soak, zombie status effects, swallow without corpse) hold, and the AI uses the full kit.
// Playwright + Chromium are test-only dependencies.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { gameServer } = require('./lib/game-server.cjs');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// simStep mirrors the playing branch of loop() (minus rendering), so the test can run whole fights deterministically
const expose = `window.__np={THREE,resetGame,respawnHero,newInput,updateHero,updateZombies,updateProjectiles,updateEnemyProjectiles,
  updateNewPlantWorld,heroJuice,damageHero,damageZombie,spawnZombie,goatify,devour,empBlast,peelShieldAt,plantStatus,
  get thistles(){return thistles},get goats(){return activeGoats},get snares(){return timeSnares},get spikeweeds(){return spikeweeds},
  get empeaches(){return empeaches},get goops(){return goops},
  simStep(dt){state.time+=dt;for(const h of heroes)if(h.isAI&&h.active)h.plant.drive(h,dt);for(const h of heroes)updateHero(h,dt);
    updateZombies(dt);updateProjectiles(dt);updateEnemyProjectiles(dt);updateNewPlantWorld(dt);updateEffects(dt);updateParticles(dt);
    for(const h of heroes)if(h.active){h.plant.animate(h,dt);heroJuice(h,dt);}},
  clear(){for(const z of zombies){z.parts.dispose?.();scene.remove(z.mesh);}zombies=[];state.spawnQueue=[];state.over=false;clearNewPlantWorld();
    for(const p of projectiles)scene.remove(p.mesh);projectiles=[];for(const p of enemyProjectiles)scene.remove(p.mesh);enemyProjectiles=[];}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose), 'test hooks must replace the animation loop');
const server = gameServer(html);
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR:', e.stack || e.message); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.log('console:', m.text()); } });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__np, null, { timeout: 90000 });
    const report = await page.evaluate(() => {
      const g = window.__game, T = window.__np, V = T.THREE.Vector3, dt = 1 / 60, out = {};
      const run = (n, fn) => { for (let i = 0; i < n; i++) { fn?.(i); T.simStep(dt); } };
      g.configureSquad(['citron', 'rose', 'chomper']);
      g.state.phase = 'active'; g.state.waveTimer = 999;
      const [cit, rose, chomp] = g.heroes;
      const place = (h, x, z, yaw = 0) => { T.respawnHero(h); h.mesh.position.set(x, g.heightAt(x, z) + h.centerY, z); h.yaw = yaw; h.input = T.newInput(); h.input.yaw = yaw; for (const k in h.cd) h.cd[k] = 0; };
      const zombie = (x, z, type = 'shambler', yaw = 0) => { const t = g.spawnZombie(type); t.mesh.position.set(x, g.heightAt(x, z) + t.def.radius + t.def.height / 2, z); t.mesh.rotation.y = yaw; t.thinkTimer = 99; return t; };
      const human = h => { for (const o of g.heroes) o.isAI = o !== h; };
      const reset = () => { T.clear(); for (const h of g.heroes) place(h, 60 + h.squadIndex * 3, 60); };
      out.roster = g.heroes.map(h => ({ type: h.type, hp: h.hp, name: h.name, model: !!h.corn.root, muzzle: !!h.corn.arms[0].muzzle }));

      // ---- Citron: beam ticks damage on heat with no ammo use; overheats; ball rams; Spin Dash; Peel Shield; EMPeach ----
      reset(); human(cit); place(cit, 10, 10);
      let z = zombie(10, -2); cit.input.aimPoint.copy(z.mesh.position); cit.input.fire = true;
      run(40, () => { cit.input.aimPoint.copy(z.mesh.position); });
      out.citBeam = { damage: z.def.hp - Math.max(0, z.hp), dead: z.dead, heat: cit.cit.heat, ammo: cit.ammo };
      run(200, () => { cit.input.aimPoint.set(10, 1.5, -40); });
      out.citOverheat = { overheated: cit.cit.overheated > 0 || cit.cit.heat < 1, heat: cit.cit.heat };
      reset(); place(cit, 10, 10); cit.input.fire = false;
      cit.plant.actions.huskHop(cit);
      const pack = [zombie(10, 4), zombie(10.8, 3.5), zombie(9.2, 3.5)];
      cit.input.fire = true; run(50); cit.input.fire = false;   // charge, then release
      const charged = cit.cit.dashCharge;
      run(40);
      out.citDash = { ball: cit.cit.ball, charged, hurt: pack.filter(p => p.hp < p.def.hp).length };
      cit.plant.actions.huskHop(cit); out.citDash.unrolled = !cit.cit.ball && cit.cd.huskHop > 0;
      reset(); place(cit, 10, 10); cit.plant.actions.butterBarrage(cit);
      const hp0 = cit.hp; z = zombie(10, 8.4); T.damageHero(cit, 30, z);
      const behind = zombie(10, 12); T.damageHero(cit, 20, behind);
      out.citShield = { shield: cit.cit.shield, frontBlocked: hp0 - cit.hp, absorb: cit.cit.absorb, blockAt: !!T.peelShieldAt(cit.mesh.position.clone().add(new V(0, 0.3, -1.2))) };
      reset(); place(cit, 10, 10);
      const ring = [zombie(10, -6), zombie(12, -7), zombie(8, -7), g.spawnAgent ? null : null].filter(Boolean);
      cit.input.aimPoint.copy(ring[0].mesh.position); cit.plant.actions.shuckShot(cit);
      run(90);
      out.citEmp = { cd: cit.cd.shuckShot > 0, stunned: ring.filter(r => r.stun > 0 || r.dead).length, peaches: T.empeaches.length };

      // ---- Rose: homing thistles, Goatify, Time Snare, Arcane Enigma ----
      reset(); human(rose); place(rose, 10, 10);
      z = zombie(14, -8); const ammo0 = rose.ammo;
      rose.input.fire = true;
      run(60, () => { rose.input.aimPoint.copy(z.mesh.position).add(new V(0.9, 0, 0)); });   // reticle slightly off: thistles still home
      out.roseThistle = { damage: z.def.hp - Math.max(0, z.hp), ammoUsed: ammo0 - rose.ammo, lock: !!rose.rose.lock || z.dead };
      reset(); place(rose, 10, 10);
      const goatPack = [zombie(10, -4), zombie(11, -4.5)], boss = zombie(16, -4, 'miniBoss');
      rose.input.aimPoint.copy(goatPack[0].mesh.position); rose.plant.actions.shuckShot(rose);
      run(40, () => { rose.input.aimPoint.copy(goatPack[0].mesh.position); });
      out.roseGoat = { goats: T.goats.length, hidden: goatPack.every(p => !p.mesh.visible), bossImmune: !(boss.pfx?.goatT > 0) };
      const goatPos = goatPack[0].mesh.position.clone(); run(60);
      out.roseGoat.wanders = goatPos.distanceTo(goatPack[0].mesh.position) > 0.5;
      T.damageZombie(goatPack[0], 9999, goatPack[0].mesh.position.clone(), false, false, rose); run(2);
      out.roseGoat.deathNoCorpse = !!goatPack[0].noCorpse;
      reset(); place(rose, 10, 10);
      const slowZ = zombie(10, -2); slowZ.thinkTimer = 0;
      rose.input.aimPoint.set(10, g.heightAt(10, -2), -2); rose.plant.actions.huskHop(rose);
      run(70);
      out.roseSnare = { snares: T.snares.length, slowed: slowZ.pfx?.slowT > 0, speed: slowZ.pfx?.speed };
      reset(); place(rose, 10, 10); rose.plant.actions.butterBarrage(rose);
      const r0 = rose.hp; T.damageHero(rose, 50, null);
      const near = zombie(11, 10); run(70);
      out.roseEnigma = { cloak: rose.cloak, immune: rose.hp === r0, pulsed: near.hp < near.def.hp, untargeted: near.heroTgt !== rose };
      run(400); out.roseEnigma.ended = !rose.cloak && rose.cd.butterBarrage > 0;

      // ---- Chomper: bite, swallow from behind (no corpse) + chew, Goop, Burrow ambush, Spikeweed hold ----
      reset(); human(chomp); place(chomp, 10, 3, Math.PI);   // Chomper between the garden and a zombie walking at it: a front bite
      z = zombie(10, 5.1, 'plated', Math.PI);
      chomp.input.fire = true; run(30); chomp.input.fire = false; run(5);
      out.chompBite = { damage: z.def.hp - z.hp, swallowed: z.dead && z.noCorpse };
      reset(); place(chomp, 10, 10, 0);
      z = zombie(10, 7.9, 'shambler', Math.PI);   // facing -Z = away from Chomper: from behind
      chomp.input.fire = true; run(12); chomp.input.fire = false;
      out.chompSwallow = { dead: z.dead, noCorpse: !!z.noCorpse, chewing: chomp.chomp.chew > 0 };
      const z2 = zombie(10, 7.9, 'shambler', 0); chomp.input.fire = true; run(20); chomp.input.fire = false;
      out.chompSwallow.noBiteWhileChewing = z2.hp === z2.def.hp;
      reset(); place(chomp, 10, 10);
      const gz = zombie(10, -2); gz.stun = 2; chomp.input.aimPoint.copy(gz.mesh.position); chomp.aimPoint.copy(gz.mesh.position); chomp.plant.actions.shuckShot(chomp);
      const goop0 = T.goops.length, goopStart = T.goops[0]?.mesh.position.clone(); run(40, () => { chomp.input.aimPoint.copy(gz.mesh.position); });
      out.chompGoop = { gooped: gz.pfx?.goopT > 0, slow: gz.pfx?.speed, spat: goop0, start: goopStart?.toArray(), cd: chomp.cd.shuckShot };
      reset(); place(chomp, 10, 10); chomp.plant.actions.huskHop(chomp);
      const zb = zombie(10, -4); zb.thinkTimer = 0; T.damageHero(chomp, 40, zb);
      out.chompBurrow = { cloak: chomp.cloak, immune: chomp.hp === chomp.stats.hp };
      const b0 = chomp.mesh.position.clone(); run(30, () => chomp.input.move.set(0, 0, -1));
      out.chompBurrow.speed = b0.distanceTo(chomp.mesh.position) / 0.5;
      chomp.mesh.position.set(zb.mesh.position.x + 1, chomp.mesh.position.y, zb.mesh.position.z);   // tunnel up under it
      chomp.input.move.set(0, 0, 0); chomp.plant.actions.huskHop(chomp); run(2);
      out.chompBurrow.ate = zb.dead && zb.noCorpse; out.chompBurrow.up = !chomp.chomp.burrowed && !chomp.cloak;
      reset(); place(chomp, 10, 10, 0); chomp.plant.actions.butterBarrage(chomp);
      const sw = T.spikeweeds[0], victim = zombie(sw.pos.x, sw.pos.z + 3); victim.thinkTimer = 0;
      run(120, () => { if (!victim.pfx?.holdT) victim.mesh.position.lerp(new V(sw.pos.x, victim.mesh.position.y, sw.pos.z), 0.1); });
      out.chompSpike = { charges: chomp.chomp.charges, held: victim.pfx?.holdT > 0, hurt: victim.hp < victim.def.hp };

      // ---- AI: each plant fights with its kit in a 12 s brawl ----
      reset(); for (const h of g.heroes) h.isAI = true;
      g.heroes.forEach((h, i) => place(h, i * 3 - 3, 8));
      const used = new Map(g.heroes.map(h => [h, new Set()]));
      for (let i = 0; i < 14; i++) zombie(-12 + i * 2, -14 - (i % 3) * 2, i % 5 === 0 ? 'plated' : 'shambler', 0);
      zombie(0, -30, 'miniBoss');
      for (let f = 0; f < 720; f++) {
        if (f % 120 === 0 && g.zombies.length < 10) for (let i = 0; i < 6; i++) zombie(-10 + i * 4, -26, 'shambler', 0);
        T.simStep(dt);
        for (const h of g.heroes) for (const k of ['shuckShot', 'huskHop', 'butterBarrage']) if (h.cd[k] > 0) used.get(h).add(k);
        for (const h of g.heroes) { if (h.cit?.ball) used.get(h).add('ball'); if (h.chomp?.burrowed) used.get(h).add('burrow'); if (h.rose?.enigma > 0) used.get(h).add('enigma'); }
      }
      const st = g.state.stats.match;
      out.ai = g.heroes.map((h, i) => ({ type: h.type, kills: st[i].kills, damage: Math.round(st[i].damage), used: [...used.get(h)], hp: Math.round(h.hp), dead: h.dead }));
      return out;
    });
    console.log(JSON.stringify(report, null, 1));
    const R = report;
    const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, name); };
    check('roster builds', R.roster.length === 3 && R.roster.every(h => h.model && h.muzzle));
    check('citron beam damages on heat, no ammo', R.citBeam.damage > 0 && R.citBeam.heat > 0 && R.citBeam.ammo === 1);
    check('citron overheats', R.citOverheat.overheated);
    check('citron spin dash hurts the pack', R.citDash.charged > 0.5 && R.citDash.hurt >= 2 && R.citDash.unrolled);
    check('peel shield soaks the front only', R.citShield.shield && R.citShield.frontBlocked === 20 && R.citShield.blockAt);
    check('empeach stuns', R.citEmp.cd && R.citEmp.stunned >= 3);
    check('rose thistles home', R.roseThistle.damage > 0 && R.roseThistle.ammoUsed > 0);
    check('goatify', R.roseGoat.goats >= 2 && R.roseGoat.hidden && R.roseGoat.bossImmune && R.roseGoat.wanders && R.roseGoat.deathNoCorpse);
    check('time snare slows', R.roseSnare.snares === 1 && R.roseSnare.slowed && R.roseSnare.speed < 0.5);
    check('arcane enigma', R.roseEnigma.cloak && R.roseEnigma.immune && R.roseEnigma.pulsed && R.roseEnigma.untargeted && R.roseEnigma.ended);
    check('chomp bite (front: no swallow)', R.chompBite.damage > 0 && !R.chompBite.swallowed);
    check('chomp swallow from behind', R.chompSwallow.dead && R.chompSwallow.noCorpse && R.chompSwallow.chewing && R.chompSwallow.noBiteWhileChewing);
    check('goop', R.chompGoop.gooped && R.chompGoop.slow < 1);
    check('burrow ambush', R.chompBurrow.cloak && R.chompBurrow.immune && R.chompBurrow.ate && R.chompBurrow.up);
    check('spikeweed holds', R.chompSpike.charges === 2 && R.chompSpike.held && R.chompSpike.hurt);
    for (const a of R.ai) check(`AI ${a.type} fights (${a.kills} kills, ${a.used.join(' ')})`, a.damage > 200 && a.used.length >= 1);
    check('no browser errors', errors.length === 0);
  } finally {
    await browser.close(); server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
