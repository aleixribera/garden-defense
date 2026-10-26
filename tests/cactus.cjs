// Run with Playwright installed; optional CACTUS_SCREENSHOTS saves a model portrait.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const expose = `window.__cactusTest = { THREE, renderer, resetGame, respawnHero, updateHero, newInput,
  updateCactusWorld, animateCactus, fireCactusSpike, plantPotatoMine, plantTallnut, toggleGarlicDrone,
  callDroneCornStrike, endGarlicDrone, damageCactusWall, pushCactusWalls, cactusWallAt, solidAt,
  updateCamera, updateHud, updateCactusHud, driveCactus, updateZombies, updateEnemyProjectiles,
  cactusMines, cactusWalls, cactusDrones, cactusShots, cactusStrikes, cactusTrails, takeControl, cactusPlacement, MAP,
  nextMuzzle, traceCactusSpike, pirateProps, updatePirateWorld,
  get enemyProjectiles() { return enemyProjectiles; },
  clearEnemies() { zombies.forEach(z => scene.remove(z.mesh)); zombies = []; },
  scene };`;
const server = gameServer(req => {
  let source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (req.url.includes('deterministic')) source = source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\n</script>');
  else if (req.url.includes('live')) source = source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\nloop();\n</script>');
  return source;
});
(async () => {
  const syntaxFile = path.join(require('node:os').tmpdir(), `garden-cactus-check-${process.pid}.mjs`);
const { gameServer } = require('./lib/game-server.cjs');
  fs.writeFileSync(syntaxFile, fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
  cp.execFileSync(process.execPath, ['--check', syntaxFile]); fs.unlinkSync(syntaxFile);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 960 }, ignoreHTTPSErrors: true });
    const errors = []; page.on('pageerror', error => errors.push(error.stack));
    page.on('console', msg => { if (msg.type() === 'error') { errors.push(msg.text()); console.log('Browser:', msg.text()); } });
    await page.goto(`http://127.0.0.1:${server.address().port}/deterministic`);
    await page.waitForFunction(() => window.__cactusTest, null, { timeout: 60000 });
    const report = await page.evaluate(() => {
      const g = window.__game, T = window.__cactusTest, V = T.THREE.Vector3, checks = [];
      const check = (test, label, detail) => { if (!test) throw new Error(label + (detail ? ': ' + JSON.stringify(detail) : '')); checks.push(label); };
      check(g.configureSquad(['cactus', 'corn', 'peashooter', 'sunflower']), 'Mixed four-plant squad');
      const h = g.player, original = h;
      const setup = () => {
        T.resetGame(); T.clearEnemies(); h.input = T.newInput();
        h.mesh.position.set(12, g.heightAt(12, 12) + h.centerY, 12); h.yaw = 0; h.mesh.rotation.y = 0;
        h.aimPoint.set(12, 1.1, -30); h.input.aimPoint.copy(h.aimPoint); T.animateCactus(h, 0); h.mesh.updateMatrixWorld(true);
      };
      const step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { g.state.time += dt; T.updateHero(h, dt); T.updateCactusWorld(dt); T.animateCactus(h, dt); } };
      const zombie = (x, z, type = 'plated') => { const zed = g.spawnZombie(type); zed.mesh.position.set(x, g.heightAt(x, z) + zed.def.radius + zed.def.height / 2, z); zed.mesh.rotation.y = Math.PI; return zed; };
      setup();
      check(h.stats.hp === 125 && h.weapon.clip === 12 && h.weapon.damage === 32, 'Cactus class loadout');
      let vertices = 0, spines = 0; h.mesh.traverse(o => { if (o.geometry) vertices += o.geometry.attributes.position.count; if (o.isInstancedMesh) spines += o.count; });
      check(vertices > 20000 && spines > 350, 'Detailed procedural sculpt and instanced details');
      h.input.move.set(0, 0, -1); step(30); check(h.mesh.position.z < 10 && h.vel.z < -5, 'Accelerated movement');
      h.input.jump = true; step(); h.input.jump = false; check(!h.onGround && h.vel.y > 0, 'Jump and air movement');
      setup(); h.input.fire = true; step(); h.input.fire = false;
      check(h.ammo === 11 && T.cactusShots.length === 0 && T.cactusTrails.length === 1, 'Spike Shot consumes one round and creates smoke without a travelling bullet');
      h.input.reload = true; step(); h.input.reload = false; step(125); check(h.ammo === 12 && !h.reloading, 'Reload restores clip');
      setup(); const target = zombie(12, -8); h.zoom = 1; h.aimPoint.copy(target.mesh.position); T.fireCactusSpike(h);
      check(target.hp === target.def.hp - h.weapon.damage, 'Spike Shot deals body damage on the firing frame');
      const trail = T.cactusTrails[0], points = trail.mesh.geometry.attributes.position;
      check(points.count > 2 && new V().fromBufferAttribute(points, 0).distanceTo(trail.start) < 0.001 &&
        new V().fromBufferAttribute(points, points.count - 1).distanceTo(trail.end) < 0.001 &&
        trail.end.distanceTo(target.mesh.position) < 2, 'Entire smoke trail appears immediately from muzzle to impact');
      T.renderer.render(g.scene, g.camera); // Compile the smoke shader in the real renderer.
      const end = trail.end.clone(); T.updateCactusWorld(0.15);
      check(trail.mesh.material.uniforms.age.value === 0.15 && trail.end.equals(end), 'Smoke fades and drifts without advancing its endpoint');
      T.updateCactusWorld(g.CONFIG.cactus.smokeTrail.life);
      check(T.cactusTrails.length === 0 && !trail.mesh.parent && target.hp === target.def.hp - h.weapon.damage, 'Expired smoke is removed without applying damage again');
      setup(); const head = zombie(12, -8); h.zoom = 1; h.aimPoint.copy(head.mesh.position).y += head.def.height * 0.35; T.fireCactusSpike(h);
      check(head.hp === head.def.hp - h.weapon.damage * h.weapon.criticalMult, 'Precision headshot deals critical damage instantly');
      setup(); const far = zombie(12, -30), near = zombie(12, -8);
      const start = T.nextMuzzle(h).start, dir = near.mesh.position.clone().sub(start).normalize();
      T.traceCactusSpike(h, start, dir);
      check(near.hp === near.def.hp - h.weapon.damage && far.hp === far.def.hp, 'Ray hits the nearest enemy regardless of spawn order');
      setup(); T.plantTallnut(h); const wallPos = T.cactusWalls[0].mesh.position;
      const shielded = zombie(wallPos.x, wallPos.z - 3);
      const muzzle = wallPos.clone().add(new V(0, 0.8, 3)); T.traceCactusSpike(h, muzzle, new V(0, 0, -1));
      check(shielded.hp === shielded.def.hp && T.cactusTrails[0].end.z > shielded.mesh.position.z, 'Solid cover clips both instant damage and the smoke endpoint');
      setup(); const buried = zombie(12, -8), behind = zombie(12, -20); buried.buried = true;
      const origin = T.nextMuzzle(h).start; T.traceCactusSpike(h, origin, behind.mesh.position.clone().sub(origin).normalize());
      check(buried.hp === buried.def.hp && behind.hp === behind.def.hp - h.weapon.damage, 'Buried enemies cannot intercept a ray');
      setup(); const birdMesh = new T.THREE.Group(); birdMesh.position.set(12, 8, -8); T.scene.add(birdMesh);
      const bird = { kind: 'parrot', mesh: birdMesh, hp: 40, t: 5 }; T.pirateProps.push(bird);
      const birdStart = T.nextMuzzle(h).start, birdDir = birdMesh.position.clone().sub(birdStart).normalize();
      T.traceCactusSpike(h, birdStart, birdDir); check(bird.hp === 40 - h.weapon.damage, 'Instant Spike Shot can damage a remote parrot');
      T.traceCactusSpike(h, birdStart, birdDir); T.updatePirateWorld(0.01);
      check(!T.pirateProps.includes(bird) && !birdMesh.parent, 'Destroyed parrot is removed on the next world update');
      setup(); T.plantPotatoMine(h); const mine = T.cactusMines[0]; check(!!mine && h.cactus.charges.shuckShot === 2, 'Mine deployment spends a charge');
      const victim = zombie(mine.mesh.position.x, mine.mesh.position.z, 'shambler');
      step(40); check(!mine.armed && !victim.dead, 'Mine cannot trigger before arming');
      step(50); check(victim.dead && T.cactusMines.length === 0, 'Armed proximity mine detonates');
      check(h.cactus.charges.butterBarrage === 4, 'Deployables have independent charge pools');
      h.cactus.recharge.shuckShot = 0.01; step(); check(h.cactus.charges.shuckShot === 3, 'Mine charge replenishes');
      setup(); T.plantTallnut(h); const wall = T.cactusWalls[0]; check(!!wall && wall.hp === 200 && h.cactus.charges.butterBarrage === 3, 'Destructible Tallnut with own charges on a shallow slope');
      const p = wall.mesh.position.clone().add(new V(0, 0.6, 0)); check(T.solidAt(p), 'Tallnut stops projectiles');
      const pushed = p.clone(); T.pushCactusWalls(pushed, 0.6, wall.mesh.position.y, 2.6);
      check(pushed.distanceTo(p) > 0.8, 'Tallnut blocks body movement');
      T.damageCactusWall(wall, 200); T.updateCactusWorld(0.01); check(T.cactusWalls.length === 0 && !T.cactusWallAt(p), 'Destroyed Tallnut releases collision');
      setup(); T.toggleGarlicDrone(h); const drone = h.cactus.drone;
      check(!!drone && drone.hp === 5 && T.cactusDrones.length === 1, 'Launch five-HP Garlic Drone');
      const body = h.mesh.position.clone(), air = drone.mesh.position.clone();
      for (let i = 0; i < 30; i++) { h.input.move.set(0, 0, -1); h.input.jumpHeld = true; h.input.fire = true; h.input.aimPoint.set(12, 10, -40); step(); }
      check(h.mesh.position.distanceTo(body) < 0.01 && drone.mesh.position.distanceTo(air) > 4, 'Drone flies while Cactus stays rooted');
      check(h.ammo === 12 && drone.heat > 0 && T.cactusShots.some(shot => shot.drone), 'Drone primary fires independently without spending Spike Shot ammo');
      drone.heat = 0.999; drone.fireT = 0; h.input.fire = true; step();
      check(drone.overheated > 0, 'Sustained drone fire overheats');
      step(120); check(drone.overheated === 0 && drone.heat < 0.6, 'Drone cools and recovers');
      drone.strikeT = 0; h.input.aimPoint.set(12, g.heightAt(12, -8), -8); T.callDroneCornStrike(drone);
      check(T.cactusStrikes.length === 1 && drone.strikeT > 0, 'Drone calls delayed Corn Strike');
      T.callDroneCornStrike(drone); check(T.cactusStrikes.length === 1, 'Corn Strike cooldown prevents duplicates');
      const ammunition = h.ammo; T.endGarlicDrone(drone); check(!h.cactus.drone && h.ammo === ammunition && h.cd.huskHop > 0, 'Return preserves ammo and drone cooldown');
      h.cd.huskHop = 0; T.toggleGarlicDrone(h); const shotDown = h.cactus.drone;
      const glob = new T.THREE.Mesh(new T.THREE.SphereGeometry(0.1), new T.THREE.MeshBasicMaterial()); glob.position.copy(shotDown.mesh.position); T.scene.add(glob);
      T.enemyProjectiles.push({ mesh: glob, vel: new V(), life: 2, damage: 8 }); T.updateEnemyProjectiles(0.01); T.updateCactusWorld(0.01);
      check(!h.cactus.drone && T.cactusDrones.length === 0, 'Enemy fire can destroy the fragile drone and restore the body camera');
      h.cd.huskHop = 0; T.toggleGarlicDrone(h); g.damageHero(h, 999); check(h.dead && !h.cactus.drone && T.cactusDrones.length === 0, 'Owner death ends remote control');
      T.respawnHero(h); check(!h.dead && h.cactus.charges.shuckShot === 3, 'Respawn restores Cactus state');
      setup(); const distant = zombie(12, -30, 'shambler'); distant.hp = 10000;
      const guardStart = h.mesh.position.clone();
      for (let i = 0; i < 100; i++) { T.driveCactus(h, 1 / 60); step(); }
      check(h.brain.target === distant && h.input.zoom && h.ammo < 12, 'Companion acquires and snipes a distant visible threat',
        { target: h.brain.target === distant, zoom: h.input.zoom, ammo: h.ammo, state: h.brain.state,
          clear: h.brain.clearShot, muzzle: h.brain.muzzleClear, aim: h.brain.aimOk, pos: h.mesh.position.toArray() });
      check(h.mesh.position.distanceTo(guardStart) < 0.1, 'Sniper holds its defensive firing position');
      check(!h.cactus.drone && T.cactusWalls.length === 0 && h.cd.huskHop === 0, 'Visible in-range threat keeps Cactus on its rifle');
      setup(); const approaching = zombie(12, 7, 'shambler'); T.driveCactus(h, 1 / 60);
      const toward = approaching.mesh.position.clone().sub(h.mesh.position).setY(0).normalize();
      check(h.brain.state === 'retreat' && h.input.move.dot(toward) < 0, 'Approaching enemy makes Cactus back away');
      check(h.input.shuck && !h.input.hop && !h.input.butter, 'Close threat triggers a mine without offensive class abilities');
      step(); check(T.cactusMines.length === 1, 'Defensive mine intent reaches the shared ability simulation');
      setup(); h.mesh.position.set(42, g.heightAt(42, 0) + h.centerY, 0); T.driveCactus(h, 1 / 60);
      check(h.brain.goalKind === 'return home' && Math.hypot(h.brain.goal.x, h.brain.goal.z) <= g.CONFIG.cactus.ai.guardRadius, 'Displaced sniper returns to the garden instead of roaming outward');
      setup(); const covered = zombie(26, 24, 'shambler');
      for (let i = 0; i < 80; i++) T.driveCactus(h, 1 / 60);
      check(!h.input.fire, 'Sniper cannot fire through the Tool Shed');
      setup(); for (let i = 0; i < 900; i++) { T.driveCactus(h, 1 / 60); step(); }
      check(Math.hypot(h.mesh.position.x, h.mesh.position.z) < g.CONFIG.cactus.ai.guardRadius + 1, 'Idle guard patrol stays near the garden');
      check(T.cactusWalls.length + T.cactusMines.length > 0, 'Idle Cactus still fortifies the garden between fights');
      setup(); T.fireCactusSpike(h); T.plantPotatoMine(h); T.plantTallnut(h); T.toggleGarlicDrone(h); T.resetGame();
      check([T.cactusMines, T.cactusWalls, T.cactusDrones, T.cactusShots, T.cactusStrikes, T.cactusTrails].every(a => a.length === 0), 'Match reset removes every Cactus object including smoke');
      h.hp = 73; h.ammo = 5; h.cactus.charges.shuckShot = 1; T.takeControl(g.heroes[1]); T.takeControl(original);
      check(g.player === original && h.hp === 73 && h.ammo === 5 && h.cactus.charges.shuckShot === 1, 'Switching preserves Cactus identity and combat state');
      h.cd.huskHop = 0; T.toggleGarlicDrone(h); T.takeControl(g.heroes[1]);
      check(T.cactusDrones.length === 0 && !h.cactus.drone, 'Switching away during flight safely ends remote control'); T.takeControl(original);
      return { checks, vertices, instances: spines };
    });
    console.log(JSON.stringify(report, null, 2)); assert.deepEqual(errors, []);
    if (process.env.CACTUS_SCREENSHOTS) {
      const dir = path.resolve(process.env.CACTUS_SCREENSHOTS); fs.mkdirSync(dir, { recursive: true });
      await page.evaluate(() => {
        const g = window.__game, T = window.__cactusTest, h = g.player;
        T.resetGame(); T.clearEnemies();
        h.mesh.position.set(12, g.heightAt(12, 12) + h.centerY, 12); h.yaw = 0; h.mesh.rotation.y = 0;
        T.animateCactus(h, 0); h.mesh.updateMatrixWorld(true);
        const z = g.spawnZombie('plated'); z.mesh.position.set(12, g.heightAt(12, -20) + z.def.radius + z.def.height / 2, -20);
        h.zoom = 1; h.aimPoint.copy(z.mesh.position); T.fireCactusSpike(h);
        document.querySelectorAll('body > div').forEach(el => el.style.display = 'none');
        g.camera.position.set(16, 4.2, 18); g.camera.lookAt(12, 1.5, -2); g.camera.fov = 55; g.camera.updateProjectionMatrix();
        T.renderer.render(g.scene, g.camera);
      });
      await page.screenshot({ path: path.join(dir, 'cactus-smoke-instant.png') });
      await page.evaluate(() => { const T = window.__cactusTest, g = window.__game; T.updateCactusWorld(0.18); T.renderer.render(g.scene, g.camera); });
      await page.screenshot({ path: path.join(dir, 'cactus-smoke-fading.png') });
    }
    // Capture the actual lit game model in a clean, three-quarter review pose.
    await page.evaluate(() => {
      const g = window.__game, T = window.__cactusTest; T.resetGame(); T.clearEnemies();
      const h = g.player, THREE = T.THREE;
      document.querySelectorAll('body > div').forEach(el => el.style.display = 'none');
      const studio = new THREE.Scene(); studio.background = new THREE.Color(0x1b2723); studio.environment = g.scene.environment;
      const rig = h.corn.root.clone(true); rig.position.set(0, 0, 0); rig.rotation.set(0, -0.16, 0); studio.add(rig);
      studio.add(new THREE.HemisphereLight(0xe9f2df, 0x263719, 1.1));
      const key = new THREE.DirectionalLight(0xffedcc, 2.6); key.position.set(-3, 5, 5); studio.add(key);
      const rim = new THREE.DirectionalLight(0xb7dbdd, 1.3); rim.position.set(3, 4, -3); studio.add(rim);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0x26332b, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; studio.add(floor);
      g.camera.position.set(1.8, 2.15, 6.4); g.camera.lookAt(0, 1.68, 0); g.camera.fov = 36; g.camera.updateProjectionMatrix();
      T.renderer.render(studio, g.camera);
    });
    if (process.env.CACTUS_SCREENSHOTS) {
      const dir = path.resolve(process.env.CACTUS_SCREENSHOTS);
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'cactus-model.png') });
    }
    await page.goto(`http://127.0.0.1:${server.address().port}/live?autoplay`);
    await page.waitForFunction(() => window.__cactusTest, null, { timeout: 60000 });
    await page.evaluate(() => { const g = window.__game; g.state.over = true; g.configureSquad(['cactus', 'corn', 'sunflower', 'peashooter']); });
    await page.keyboard.press('f');
    await page.waitForFunction(() => window.__cactusTest.cactusWalls.length === 1);
    await page.waitForFunction(() => window.__game.player.cactus.deployT === 0);
    await page.keyboard.press('q');
    await page.waitForFunction(() => window.__cactusTest.cactusMines.length === 1);
    await page.waitForFunction(() => window.__game.player.cactus.deployT === 0);
    await page.keyboard.press('e');
    await page.waitForFunction(() => !!window.__game.player.cactus.drone);
    await page.keyboard.down('w'); await page.keyboard.down('Space');
    await page.waitForFunction(() => window.__game.player.cactus.drone.mesh.position.y > window.__game.player.mesh.position.y + 4);
    await page.keyboard.up('w'); await page.keyboard.up('Space');
    await page.evaluate(() => { const g = window.__game, T = window.__cactusTest; T.updateCamera(1 / 60); T.updateHud(0); T.updateCactusHud(); T.renderer.render(g.scene, g.camera); });
    if (process.env.CACTUS_SCREENSHOTS) await page.screenshot({ path: path.join(path.resolve(process.env.CACTUS_SCREENSHOTS), 'cactus-drone.png') });
    await page.keyboard.press('e'); await page.waitForFunction(() => !window.__game.player.cactus.drone);
    await page.keyboard.press('Tab'); await page.waitForFunction(() => window.__game.player.type !== 'cactus');
    assert.deepEqual(errors, []);
    console.log('Cactus checks passed, including live four-class loop and keyboard deployment / drone / handoff.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
