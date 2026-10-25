// One menu boot, simulated time: all-AI ownership, spectator input/camera, kill HUD, finale and normal rematch.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const expose = `window.__spectatorTest = { updateCamera, updateHud, updateHero, updateWaves, updateFinale,
  readPlayerInput, clearHumanInput, keys, pressed, respawnHero, resetGame, endGarlicDrone, toggleGarlicDrone, damageHero };`;
const html = source.replace(/loop\(\);\s*<\/script>\s*<\/body>/, expose + '</script></body>');
assert.ok(html.includes(expose));
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await page.evaluate(() => !!window.__game), false, 'watch mode keeps the instant menu gate');
    const roster = ['corn', 'peashooter', 'sunflower', 'cactus'];
    for (let i = 0; i < roster.length; i++) await page.selectOption(`#pick-${i}`, roster[i]);
    await page.click('#watchButton');
    await page.waitForFunction(() => window.__spectatorTest && !document.body.classList.contains('loading'), null, { timeout: 90000 });
    assert.ok(await page.evaluate(() => __game.spectator.active && __game.heroes.every(h => h.isAI)));
    await page.click('#matchButton');
    await page.waitForFunction(() => document.pointerLockElement === __game.renderer.domElement);
    await page.evaluate(() => { __spectatorTest.updateCamera(0); __spectatorTest.updateHud(0); __game.renderer.render(__game.scene, __game.camera); });
    await page.screenshot({ path: path.resolve(__dirname, '..', 'docs', 'spectator.png') });
    assert.ok(await page.locator('#spectatorHud').isVisible());
    assert.ok(await page.locator('#abilities').isVisible(), "plant view shows the watched plant's HUD");
    assert.ok(await page.locator('#crosshair .t').isVisible());
    assert.ok(await page.locator('#ammo').isVisible());
    console.log('PASS: discreet menu button boots the selected all-AI squad in plant view with the player HUD');

    const plantView = await page.evaluate(() => {
      const g = __game, t = __spectatorTest, h = g.player, p = h.mesh.position;
      g.state.shake = 0; h.aimPoint.set(p.x + 25, p.y + 1, p.z - 18);
      for (let i = 0; i < 4; i++) t.updateCamera(0);   // dt 0 snaps onto the aim; repeats settle the shoulder pivot
      g.camera.updateMatrixWorld();
      const v = h.aimPoint.clone().project(g.camera);
      const hurt = g.state.hurt; t.damageHero(h, 5);
      const felt = g.state.hurt > hurt, mid = g.state.hurt; t.damageHero(g.heroes[1], 5);
      return { view: g.spectator.view, x: v.x, y: v.y, felt, othersQuiet: g.state.hurt === mid };
    });
    assert.equal(plantView.view, 'plant');
    assert.ok(Math.abs(plantView.x) < 0.05 && Math.abs(plantView.y) < 0.05, `reticle on the AI aim point: ${JSON.stringify(plantView)}`);
    assert.ok(plantView.felt && plantView.othersQuiet, 'hurt feedback follows the watched plant only');
    console.log("PASS: plant view puts the reticle on the watched AI's aim point and shows its hurt feedback");

    await page.evaluate(() => {
      const h = __game.player; h.input.fire = true; h.cd.shuckShot = 9;
      window.watchedInput = h.input;
    });
    await page.keyboard.press('Digit2');
    assert.ok(await page.evaluate(() => __game.player.type === 'peashooter' && __game.heroes.every(h => h.isAI) &&
      __game.heroes[0].input === watchedInput && __game.heroes[0].cd.shuckShot === 9));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => __game.player.type), 'sunflower');
    await page.keyboard.press('BracketLeft');
    assert.equal(await page.evaluate(() => __game.player.type), 'peashooter');
    await page.keyboard.press('KeyF');
    assert.equal(await page.evaluate(() => __game.spectator.view), 'orbit');
    assert.ok(await page.evaluate(() => document.body.classList.contains('detachedView')));
    assert.equal(await page.locator('#crosshair .t').isVisible(), false, 'orbit camera hides the plant HUD');
    await page.keyboard.press('KeyF');
    const free = await page.evaluate(() => {
      const g = __game, t = __spectatorTest, h = g.player, before = h.mesh.position.clone();
      const input = h.input, fire = input.fire, move = input.move.clone(), yaw = h.yaw;
      const start = g.camera.position.clone();
      t.keys.KeyW = t.keys.KeyE = t.keys.ShiftLeft = true;
      t.readPlayerInput(h); t.updateCamera(0.5); t.clearHumanInput();
      const traveled = start.distanceTo(g.camera.position);
      t.keys.KeyW = true; const paused = g.camera.position.clone(); t.updateCamera(0); t.clearHumanInput();
      const shortcutBlocked = !dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', ctrlKey: true, repeat: true, cancelable: true }));
      t.clearHumanInput();
      return { free: g.spectator.view === 'free', traveled, paused: paused.equals(g.camera.position), shortcutBlocked,
        untouched: h.mesh.position.equals(before) && h.input === input && input.fire === fire && input.move.equals(move) && h.yaw === yaw };
    });
    assert.ok(free.free && free.traveled > 20 && free.paused && free.untouched && free.shortcutBlocked);
    await page.keyboard.press('KeyR');
    assert.equal(await page.evaluate(() => __game.spectator.view), 'plant');
    await page.mouse.wheel(0, 100000);
    assert.equal(await page.evaluate(() => __game.spectator.distance), 12, 'wheel only zooms the orbit camera');
    await page.keyboard.press('KeyF');
    await page.mouse.wheel(0, 100000);
    assert.equal(await page.evaluate(() => __game.spectator.distance), 36);
    await page.mouse.wheel(0, -100000);
    assert.equal(await page.evaluate(() => __game.spectator.distance), 4);
    await page.keyboard.press('KeyR');
    console.log('PASS: plant hotkeys preserve AI state; F cycles orbit / free, free flight, reset, zoom limits and paused camera work');

    await page.keyboard.press('Escape');
    await page.evaluate(() => document.exitPointerLock());   // DevTools key presses do not trigger Chromium's native Esc unlock.
    await page.waitForFunction(() => !document.pointerLockElement);
    await page.locator('#spectatorSettings').waitFor({ state: 'visible' });
    await page.selectOption('#spectatorSelect', '3');
    assert.equal(await page.evaluate(() => __game.player.type), 'cactus');
    await page.click('#spectatorCameraButton');
    assert.equal(await page.evaluate(() => __game.spectator.view), 'orbit');
    await page.click('#matchButton');
    await page.waitForFunction(() => !!document.pointerLockElement);
    const drone = await page.evaluate(() => {
      const g = __game, t = __spectatorTest, h = g.player;
      h.onGround = true; h.cd.huskHop = 0; t.toggleGarlicDrone(h);
      const existed = !!h.cactus.drone, yaw = g.state.yaw, pitch = g.state.pitch;
      if (h.cactus.drone) t.endGarlicDrone(h.cactus.drone);
      return existed && yaw === g.state.yaw && pitch === g.state.pitch && h.isAI;
    });
    assert.ok(drone, 'ending a watched AI drone cannot take over the spectator camera');

    const combat = await page.evaluate(() => {
      const g = __game, t = __spectatorTest, target = g.heroes[0];
      g.spectateHero(target);
      const z = g.spawnZombie('shambler');
      g.damageZombie(z, 1e6, z.mesh.position, false, true, target);
      g.damageZombie(z, 1e6, z.mesh.position, false, true, target); t.updateHud(0);
      const own = document.getElementById('killCount').textContent, squad = document.getElementById('squadKillCount').textContent;
      g.beginCountdown(1); t.updateHud(0);
      const persisted = document.getElementById('killCount').textContent === own;
      g.spectateHero(g.heroes[1]); t.updateHud(0);
      const other = document.getElementById('killCount').textContent;
      const inputs = g.heroes.map(h => h.input);
      for (const h of g.heroes) h.plant.drive(h, 1 / 60);
      const autonomous = g.heroes.every((h, i) => h.isAI && h.input === inputs[i]);
      return { own, squad, persisted, other, autonomous, xp: g.heroes.every(h => g.state.stats.match[h.squadIndex].xp === 0) };
    });
    assert.equal(combat.own, '1'); assert.equal(combat.squad, '1'); assert.equal(combat.other, '0');
    assert.ok(combat.persisted && combat.autonomous && combat.xp);
    console.log('PASS: every plant stays autonomous; kills count once, persist across waves and follow the watched plant without earning mastery');

    const finale = await page.evaluate(() => {
      const g = __game, t = __spectatorTest, F = g.CONFIG.FINALE, victories = g.mastery.victories;
      for (let i = 0; i < g.CONFIG.WAVES.length; i++) {
        g.beginCountdown(i); g.state.waveTimer = 0; t.updateWaves(0.01);
        g.state.spawnQueue = []; g.zombies.forEach(z => { z.dead = true; z.hp = 0; });
        // updateWaves counts the live zombie array; force its normal cleanup-free empty condition for this fixture.
        g.zombies.length = 0; t.updateWaves(0.01);
      }
      const opened = g.state.phase === 'extract';
      const f = g.state.finale;
      for (const h of g.heroes) { t.respawnHero(h); h.mesh.position.copy(f.pos); }
      f.next = 1e6;
      for (let i = 0; i < 60; i++) t.updateFinale(1);
      return { opened, won: g.state.over && document.getElementById('overlayTitle').textContent === 'VICTORY',
        noMastery: victories === g.mastery.victories, hold: F.hold, time: F.timeLimit };
    });
    assert.ok(finale.opened && finale.won && finale.noMastery);
    assert.equal(finale.hold, 120); assert.equal(finale.time, 240);
    assert.ok(await page.locator('#watchButton').isVisible());
    await page.click('#matchButton');
    const normal = await page.evaluate(() => {
      __spectatorTest.updateHud(0);
      return !__game.spectator.active && __game.heroes.filter(h => !h.isAI).length === 1 &&
        document.getElementById('killCount').textContent === '0' && !document.body.classList.contains('spectating');
    });
    assert.ok(normal);
    console.log('PASS: all ten waves reach extraction, the all-AI squad can extract, and normal rematch restores player control');
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
