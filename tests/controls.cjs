// Deterministic movement / camera checks: real hero updates, with the automatic loop stopped.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__controlsTest = { updateHero, updateCamera, clearHumanInput, addCameraRecoil, keys, pressed };';
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\n</script>'));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`);
    await page.waitForFunction(() => window.__controlsTest, null, { timeout: 120000 });
    const checks = await page.evaluate(() => {
      const g = __game, T = __controlsTest, checks = [], dt = 1 / 60;
      const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text); };
      const prepare = type => {
        g.configureSquad([type]); g.state.time = 10;
        const h = g.player; h.mesh.position.set(12, g.heightAt(12, 12) + h.centerY, 12);
        h.vel.set(0, 0, 0); h.input.aimPoint.copy(h.mesh.position).z -= 20;
        return h;
      };
      const step = h => { g.state.time += dt; T.updateHero(h, dt); h.input.jump = false; };
      for (const type of ['corn', 'peashooter', 'sunflower', 'cactus']) {
        let h = prepare(type);
        h.mesh.position.y += 0.7; h.onGround = false; h.lastGroundT = g.state.time - 0.05;
        h.vel.y = -2; h.input.jump = true; step(h);
        check(h.vel.y > 0, `${type}: late ledge press jumps`);
        const vy = h.vel.y;
        h.input.jump = true; step(h);
        check(h.vel.y < vy, `${type}: coyote jump cannot double-jump`);

        h = prepare(type); h.mesh.position.y += 1; h.onGround = false;
        h.lastGroundT = g.state.time - 0.5; h.input.jump = true; step(h);
        check(h.vel.y < 0, `${type}: expired ledge grace cannot jump`);

        h = prepare(type); h.mesh.position.y += 0.06; h.onGround = false; h.vel.y = -3;
        h.input.jump = true; step(h);
        for (let i = 0; i < 5 && h.vel.y <= 0; i++) step(h);
        check(h.vel.y > 0, `${type}: early press survives landing`);

        h = prepare(type); h.mesh.position.y += 1; h.onGround = false;
        h.input.jump = true; step(h); g.state.time += 0.3;
        h.mesh.position.y = g.heightAt(12, 12) + h.centerY; h.onGround = true; h.vel.y = 0; step(h);
        check(h.vel.y === 0, `${type}: expired buffered press does not jump`);
      }
      const h = prepare('corn');
      h.jumpQueuedUntil = 11; h.lastGroundT = 10; T.keys.KeyW = true; T.pressed.jump = true;
      h.input.fire = true; window.dispatchEvent(new Event('blur'));
      check(!h.input.fire && !T.keys.KeyW && !T.pressed.jump && h.jumpQueuedUntil === -Infinity,
        'focus loss clears movement, firing and pending jumps');

      g.changeSetting('motion', 0); T.updateCamera(0);
      const pos = g.camera.position.clone(), quat = g.camera.quaternion.clone();
      h.vel.set(6, 0, -6); h.sprint = 1; g.state.cam.bob = 2; g.state.cam.bobAmp = 1;
      g.state.cam.roll = 0.2; g.state.cam.land = -0.4; g.state.cam.flinch = 0.8;
      g.state.shake = 1; g.state.fovKick = 10; T.updateCamera(0);
      check(g.camera.position.distanceTo(pos) < 1e-6 && g.camera.quaternion.angleTo(quat) < 1e-6,
        'zero camera motion removes bob, landing dip, roll and shake');
      check(g.camera.fov === g.CONFIG.camera.fov, 'zero camera motion removes movement FOV pulses');
      T.addCameraRecoil(0.03); T.updateCamera(0);
      check(g.camera.quaternion.angleTo(quat) > 0.001, 'weapon recoil still works with camera motion disabled');
      check(+document.getElementById('setMotion').value === 0 && JSON.parse(localStorage.getItem(g.CONFIG.settings.storageKey)).motion === 0,
        'camera motion setting updates and saves');
      return checks;
    });
    checks.forEach(s => console.log('PASS: ' + s));
    assert.deepEqual(errors, [], 'no browser errors');
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
