// Real-browser regression scenarios for the Sunflower rig, weapons, medic AI and lifecycle.
// Run with Playwright installed. Optional SUNFLOWER_SCREENSHOTS saves model portraits.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const moduleSource = source.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: moduleSource, encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr);
const expose = `window.__sunTest = { THREE, renderer, sun, rimLight, updateHero, updateSunflower, updateSunflowerWorld,
  updateSunflowerHud, animateSunflower, driveSunflower, sunflowerMuzzle, resetSunflower, respawnHero, takeControl,
  toggleHealBeam, toggleSunbeam, stopSunbeam, plantHealFlower, fireSunPulse, updateDowned, clearSunflowerWorld,
  setStarted(value) { matchStarted = value; },
  step(dt, draw = false) { state.time += dt; for (const h of heroes) if (h.isAI) h.plant.drive(h, dt);
    for (const h of heroes) updateHero(h, dt); updateZombies(dt); updateProjectiles(dt); updateSunflowerWorld(dt);
    updateEffects(dt); updateParticles(dt); for (const h of heroes) h.plant.animate(h, dt);
    updateCamera(dt); updateHud(dt); updateSunflowerHud(); updatePopups(dt); if (draw) renderer.render(scene, camera); },
  get pulses() { return sunPulses; }, get flowers() { return healFlowers; }, get drops() { return sunDrops; } };`;
const html = source.replace(/loop\(\);\s*<\/script>\s*<\/body>/, expose + '</script></body>')
  .replace('new THREE.WebGLRenderer({', 'new THREE.WebGLRenderer({ preserveDrawingBuffer: true,');
assert.ok(html.includes(expose), 'The test must replace the frame loop');
const server = gameServer(html);
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, ignoreHTTPSErrors: true });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser:', error.message); });
    await page.addInitScript(() => {
      let seed = 913;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
      addEventListener('error', event => { window.__sunError = event.message; });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__sunTest || window.__sunError, null, { timeout: 60000 });
    assert.deepEqual(errors, []);
    const report = await page.evaluate(() => {
      const g = __game, t = __sunTest, V = t.THREE.Vector3, results = {};
      if (!g.configureSquad(['sunflower', 'corn', 'peashooter', 'sunflower'])) throw Error('Roster integration failed');
      const h = g.heroes[0], ally = g.heroes[1], medic = g.heroes[3];
      results.roster = h.stats.hp === 110 && h.weapon.clip === 50 && h.weapon.reloadTime === 2;
      results.independentRigs = h.corn !== medic.corn && h.sun !== medic.sun && h.corn.petalMat !== medic.corn.petalMat;
      results.sculpt = h.corn.petals.length === 39 && h.corn.legs.length === 4 && h.corn.eyes.length === 2;
      const setup = () => {
        t.clearSunflowerWorld();
        for (const z of g.zombies) g.scene.remove(z.mesh); g.zombies.splice(0);
        g.heroes.forEach((a, i) => {
          t.respawnHero(a); a.mesh.position.set(12 + i * 3, g.heightAt(12 + i * 3, 8) + a.centerY, 8);
          a.yaw = 0; a.mesh.rotation.y = 0; a.lastHurt = g.state.time; a.input.aimPoint.set(8, 2, -20);
          for (const key in a.cd) a.cd[key] = 0;
          a.aimPoint.copy(a.input.aimPoint);
        });
        t.animateSunflower(h, 0); t.animateSunflower(medic, 0);
      };
      const zombie = (x, z, type = 'shambler') => {
        const enemy = g.spawnZombie(type);
        enemy.mesh.position.set(x, g.heightAt(x, z) + enemy.def.radius + enemy.def.height / 2, z);
        return enemy;
      };
      setup(); ally.mesh.position.set(12, h.mesh.position.y, 2); ally.hp = 40;
      h.input.aimPoint.copy(ally.mesh.position); h.aimPoint.copy(h.input.aimPoint);
      t.toggleHealBeam(h);
      const ownHp = h.hp;
      for (let i = 0; i < 60; i++) t.updateSunflower(h, 1 / 60);
      results.healingRate = Math.abs(ally.hp - (40 + h.abilities.shuckShot.rate)) < 0.001 && h.hp === ownHp && h.sun.healTarget === ally;
      t.fireSunPulse(h); results.shootWhileHealing = h.ammo === 49 && t.pulses.length === 1 && h.sun.healTarget === ally;
      ally.mesh.position.z = -50; t.updateSunflower(h, 1 / 60);
      results.breakRange = !h.sun.healTarget && !h.sun.healFx.visible;
      setup();
      h.mesh.position.set(32, g.heightAt(32, -35) + h.centerY, -35);
      ally.mesh.position.set(40, g.heightAt(40, -35) + ally.centerY, -35); ally.hp = 40;
      h.sun.healTarget = ally; h.sun.healTime = 10; t.updateSunflower(h, 1 / 60);
      results.healBlockedByWall = !h.sun.healTarget && ally.hp === 40;
      setup();
      h.weapon.spread = h.weapon.aimSpread = 0;
      const victim = zombie(12, -6), before = victim.hp;
      h.aimPoint.copy(victim.mesh.position); h.input.aimPoint.copy(h.aimPoint); t.fireSunPulse(h);
      for (let i = 0; i < 20; i++) t.updateSunflowerWorld(1 / 60);
      results.pulseDamage = victim.hp < before && t.pulses.length === 0;
      setup();
      const beamVictim = zombie(12, -10, 'miniBoss'); h.input.aimPoint.copy(beamVictim.mesh.position); h.aimPoint.copy(h.input.aimPoint);
      h.input.hop = true; h.input.move.set(1, 0, 0); const x = h.mesh.position.x;
      t.updateHero(h, 1 / 60); h.input.hop = false;
      results.rooted = h.sun.sunbeam && h.mesh.position.x === x && h.vel.x === 0;
      const beamHp = beamVictim.hp; h.input.fire = true;
      for (let i = 0; i < 10; i++) t.updateHero(h, 1 / 60);
      results.deployDelay = h.sun.beamAmmo === 100 && beamVictim.hp === beamHp;
      for (let i = 0; i < 65; i++) t.updateHero(h, 1 / 60);
      results.sunbeamDamage = beamVictim.hp < beamHp && h.sun.beamAmmo < 100 && h.ammo === h.weapon.clip;
      t.setStarted(true); t.updateSunflowerHud(); results.beamHud = document.getElementById('weaponLabel').textContent === 'Sunbeam'; t.setStarted(false);
      h.input.jump = true; t.updateHero(h, 1 / 60); h.input.jump = false;
      results.cancelCooldown = !h.sun.sunbeam && h.cd.huskHop > 29 && !h.sun.beamFx.visible;
      setup(); h.mesh.position.set(32, g.heightAt(32, -35) + h.centerY, -35);
      const shielded = zombie(40, -35), shieldHp = shielded.hp;
      h.input.aimPoint.copy(shielded.mesh.position); h.aimPoint.copy(h.input.aimPoint);
      t.toggleSunbeam(h); t.updateSunflower(h, 1); h.input.fire = true; t.updateSunflower(h, 0.1);
      results.beamBlockedByWall = h.sun.beamFx.visible && h.sun.beamAmmo < 100 && shielded.hp === shieldHp;
      setup(); h.hp = 40; t.plantHealFlower(h);
      results.flowerDeploy = t.flowers.length === 1 && h.cd.butterBarrage === h.abilities.butterBarrage.cooldown;
      for (let i = 0; i < 250; i++) t.updateSunflowerWorld(1 / 60);
      results.sundropsHeal = h.hp > 40 && t.flowers.length === 1;
      for (let i = 0; i < 1900; i++) t.updateSunflowerWorld(1 / 60);
      results.flowerExpires = t.flowers.length === 0;
      setup(); ally.hp = 30; ally.mesh.position.copy(medic.mesh.position).add(new V(0, 0, -5));
      t.driveSunflower(medic, 1 / 60);
      results.medicTriage = medic.sun.healTarget === ally;
      const allyHp = ally.hp; for (let i = 0; i < 60; i++) t.updateSunflower(medic, 1 / 60);
      results.medicHeals = ally.hp > allyHp;
      // Medic behavior must survive pressure and support every class, including another Sunflower.
      medic.hp = 1; const pressure = zombie(medic.mesh.position.x, medic.mesh.position.z - 2);
      ally.hp = ally.stats.hp - 1; medic.sun.thinkT = 0; t.driveSunflower(medic, 1 / 60);
      results.healsUnderPressureToFull = medic.sun.support === ally && medic.sun.healTarget === ally;
      pressure.dead = true;
      const patient = g.heroes[2]; patient.hp = 2; patient.mesh.position.copy(medic.mesh.position).add(new V(0, 0, -3));
      medic.sun.thinkT = 0; t.driveSunflower(medic, 1 / 60);
      results.patientCommitment = medic.sun.support === ally;
      ally.hp = ally.stats.hp; medic.sun.thinkT = 0; t.driveSunflower(medic, 1 / 60);
      results.nextPatient = medic.sun.support === patient && medic.sun.healTarget === patient;
      setup();
      h.hp = 80; h.mesh.position.copy(medic.mesh.position).add(new V(0, 0, -3));
      t.driveSunflower(medic, 1 / 60); results.healsOtherSunflowers = medic.sun.healTarget === h;
      h.hp = 110; medic.sun.thinkT = 0; t.driveSunflower(medic, 1 / 60);
      results.staysNearHealthyTeammate = medic.sun.support === h && ['escort', 'support'].includes(medic.brain.state);
      // An ally far from the garden remains an escort goal; there is no garden leash.
      setup(); ally.mesh.position.set(70, g.heightAt(70, 5) + ally.centerY, 5); ally.hp = 50;
      t.driveSunflower(medic, 1 / 60);
      // Follow the ally's escort spot, leaving room beside / behind their camera.
      results.followsBeyondGarden = medic.sun.support === ally && medic.brain.state === 'support'
        && Math.hypot(medic.brain.goal.x, medic.brain.goal.z) > 60
        && medic.brain.goal.distanceTo(ally.mesh.position) < medic.abilities.shuckShot.range;
      setup(); g.damageHero(ally, 10000); h.mesh.position.copy(ally.mesh.position).add(new V(1, 0, 0)); h.input.interact = true;
      for (let i = 0; i < 185 && ally.downed; i++) t.updateDowned(ally, 1 / 60);
      results.fasterRevive = !ally.dead && ally.hp === Math.round(ally.stats.hp * g.CONFIG.TEAMMATE_AI.revive.hpFraction);
      setup(); t.toggleSunbeam(h); t.updateSunflower(h, 1); h.input.fire = true; t.updateSunflower(h, 0.1);
      h.sun.healTarget = ally; h.sun.healTime = 10; t.updateSunflower(h, 0.1); g.damageHero(h, 10000);
      results.deathCleanup = !h.sun.sunbeam && !h.sun.healTarget && !h.sun.beamFx?.visible && !h.sun.healFx?.visible;
      t.respawnHero(h); results.respawn = h.hp === 110 && !h.dead && !h.sun.sunbeam && h.ammo === 50;
      setup();
      // The same character carries Sunbeam's charge and tether through both control owners.
      t.toggleSunbeam(h); h.sun.beamAmmo = 61; h.hp = 79;
      g.state.over = false;
      t.takeControl(ally); t.takeControl(h);
      results.persistentState = h.sun.beamAmmo === 61 && h.hp === 79 && h.sun.sunbeam && g.player === h;
      t.stopSunbeam(h);
      g.configureSquad(['corn', 'sunflower', 'sunflower', 'sunflower']);
      g.player.hp = 40; g.player.lastHurt = g.state.time;
      for (let i = 0; i < 180; i++) t.step(1 / 60);
      results.multipleMedicsLive = g.player.hp > 40 && g.heroes.filter(a => a.sun?.healTarget === g.player).length > 0;
      g.configureSquad(['sunflower', 'corn']);
      return results;
    });
    for (const [name, pass] of Object.entries(report)) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); assert.equal(pass, true, name); }
    if (process.env.SUNFLOWER_SCREENSHOTS) {
      const dir = path.resolve(process.env.SUNFLOWER_SCREENSHOTS); fs.mkdirSync(dir, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => {
        const g = __game, t = __sunTest, h = g.player, ally = g.heroes[1];
        h.mesh.position.set(12, g.heightAt(12, 10) + h.centerY, 10);
        ally.mesh.position.set(10, g.heightAt(10, 0) + ally.centerY, 0); ally.hp = 60;
        const z = g.spawnZombie('plated'); z.mesh.position.set(13, g.heightAt(13, -17) + z.def.radius + z.def.height / 2, -17);
        h.input.aimPoint.copy(ally.mesh.position); h.aimPoint.copy(h.input.aimPoint); t.toggleHealBeam(h); t.plantHealFlower(h);
        h.input.aimPoint.copy(z.mesh.position); h.aimPoint.copy(h.input.aimPoint); t.toggleSunbeam(h);
        h.input.fire = true; t.updateSunflower(h, 1); t.setStarted(true);
        g.state.yaw = 0; g.state.pitch = 0.12;
        document.body.classList.remove('preMatch'); document.getElementById('overlay').style.display = 'none';
        document.getElementById('banner').style.display = 'none'; document.getElementById('laneArrow').style.display = 'none';
        for (let i = 0; i < 15; i++) t.step(1 / 60);
        t.step(1 / 60, true);
        if (!g.camera.matrixWorld.elements.every(Number.isFinite) || !g.camera.projectionMatrix.elements.every(Number.isFinite)) throw Error('Gameplay camera became non-finite');
        const box = new t.THREE.Box3().setFromObject(h.corn.head);
        const right = new t.THREE.Vector3(box.max.x, box.getCenter(new t.THREE.Vector3()).y, box.max.z).project(g.camera);
        if (right.x >= 0) throw Error('Sunflower crown blocks the center reticle');
      });
      await page.screenshot({ path: path.join(dir, 'sunflower-gameplay.png') });
      await page.setViewportSize({ width: 1100, height: 1100 });
      await page.evaluate(() => {
        const g = __game, t = __sunTest, T = t.THREE, h = g.player;
        t.respawnHero(h); h.mesh.position.set(0, h.centerY, 0); h.input.aimPoint.set(0, 2.1, -20); h.aimElev = 0;
        t.animateSunflower(h, 0); h.corn.head.rotation.set(0, 0, 0); h.corn.hips.position.y = 0;
        for (const child of g.scene.children) if (child !== h.mesh && !child.isLight) child.visible = false;
        g.scene.background = new T.Color(0x102c30); g.scene.fog = null;
        const stage = new T.Mesh(new T.CylinderGeometry(1.8, 1.87, 0.12, 80), new T.MeshStandardMaterial({ color: 0x244448, roughness: 0.8 }));
        stage.position.y = -0.08; stage.receiveShadow = true; g.scene.add(stage);
        t.sun.visible = true; t.sun.position.set(-3, 6, -5); t.sun.target.position.set(0, 1.8, 0); t.sun.target.visible = true;
        t.rimLight.position.set(3, 4, 3); t.rimLight.intensity = 1.8;
        g.camera.position.set(-0.3, 1.95, -5.1); g.camera.fov = 43; g.camera.lookAt(0, 1.6, 0); g.camera.updateProjectionMatrix();
        t.renderer.setSize(1100, 1100); t.renderer.setPixelRatio(1); t.renderer.render(g.scene, g.camera);
        document.querySelectorAll('body > :not(canvas):not(script)').forEach(e => e.style.display = 'none');
      });
      await page.screenshot({ path: path.join(dir, 'sunflower-front.png') });
      await page.evaluate(() => { const g = __game; g.camera.position.set(3.4, 2.5, 4.6); g.camera.lookAt(0, 1.6, 0); __sunTest.renderer.render(g.scene, g.camera); });
      await page.screenshot({ path: path.join(dir, 'sunflower-back.png') });
    }
    assert.deepEqual(errors, []); console.log('PASS no runtime errors');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
