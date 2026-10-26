// Run with Playwright installed. Optional GARDEN_TEST_HTML checks an isolated source file.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const source = fs.readFileSync(process.env.GARDEN_TEST_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = `window.__recoilTest = { resetGame, updateCamera, addCameraRecoil, takeControl,
  fireKernel, firePea, fireSunPulse, fireCactusSpike, toggleGarlicDrone, endGarlicDrone, renderer };`;
const server = gameServer(source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\n</script>'));

(async () => {
  const syntaxFile = path.join(os.tmpdir(), `garden-recoil-${process.pid}.mjs`);
  try {
    fs.writeFileSync(syntaxFile, source.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
    cp.execFileSync(process.execPath, ['--check', syntaxFile]);
  } finally { fs.rmSync(syntaxFile, { force: true }); }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.__recoilTest, null, { timeout: 60000 });
    const checks = await page.evaluate(() => {
      const g = window.__game, T = window.__recoilTest, checks = [];
      const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
      const near = (a, b, tolerance = 1e-7) => Math.abs(a - b) < tolerance;
      const step = dt => { g.state.shake = 0; T.updateCamera(dt); };
      const direction = () => g.camera.getWorldDirection(new g.THREE.Vector3());
      const prepare = () => {
        T.resetGame();
        const h = g.player;
        h.mesh.position.set(12, g.heightAt(12, 12) + h.centerY, 12);
        h.aimPoint.copy(h.mesh.position).z -= 30; h.input.aimPoint.copy(h.aimPoint);
        h.plant.animate(h, 0); h.mesh.updateMatrixWorld(true); step(0);
        return h;
      };
      const recover = (seconds = 2, rate = 60) => {
        for (let i = 0; i < seconds * rate; i++) step(1 / rate);
      };
      const fire = { corn: T.fireKernel, peashooter: T.firePea, sunflower: T.fireSunPulse, cactus: T.fireCactusSpike };
      for (const type of Object.keys(fire)) {
        check(g.configureSquad([type, type]), `${type}: configure squad`);
        for (const zoom of [0, 1]) {
          const h = prepare(); h.zoom = zoom; step(0);
          const originalPitch = g.state.pitch, originalDir = direction();
          fire[type](h); step(0);
          check(g.state.cam.recoilPitch > 0 && direction().y > originalDir.y, `${type}, zoom ${zoom}: shot kicks view up`);
          check(g.state.pitch === originalPitch, `${type}, zoom ${zoom}: saved aim stays unchanged`);
          recover();
          check(direction().distanceTo(originalDir) < 1e-7, `${type}, zoom ${zoom}: view returns to original aim`);
        }
        let h = prepare();
        // Use the weapon cadence for a sustained burst; repeated bursts cannot ratchet the aim upward.
        for (let burst = 0; burst < 3; burst++) {
          for (let shot = 0; shot < h.weapon.clip; shot++) {
            fire[type](h); step(h.weapon.fireRate);
            check(g.state.cam.recoilPitch <= g.CONFIG.camera.recoilMax, `${type}: bounded burst recoil ${burst}/${shot}`);
          }
          recover(); h.ammo = h.weapon.clip;
          check(near(g.state.pitch, 0.2) && g.state.cam.recoilPitch < 1e-7, `${type}: burst ${burst} returns without drift`);
        }
        prepare(); fire[type](g.heroes[1]);
        check(g.state.cam.recoilPitch === 0, `${type}: companion fire leaves human view alone`);
      }
      g.configureSquad(['peashooter', 'corn']); let h = prepare();
      T.firePea(h, true); check(g.state.cam.recoilPitch > 0, 'Pea Gatling also uses temporary recoil');
      recover(); check(g.state.cam.recoilPitch < 1e-7, 'Pea Gatling recovers');

      // Exercise the real mouse handler while recoil is still active.
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => T.renderer.domElement });
      prepare(); T.firePea(g.player);
      document.dispatchEvent(new MouseEvent('mousemove', { movementY: 40, movementX: 12 }));
      const movedPitch = 0.2 + 40 * g.CONFIG.camera.sensitivity;
      recover();
      check(near(g.state.pitch, movedPitch) && near(g.state.yaw, -12 * g.CONFIG.camera.sensitivity), 'Mouse adjustments survive recoil recovery');
      const adjustedDir = direction(); g.state.cam.recoilPitch = 0; step(0);
      check(direction().distanceTo(adjustedDir) < 1e-7, 'Recovered crosshair follows adjusted aim');
      delete document.pointerLockElement;

      const residuals = [30, 60, 144].map(rate => { prepare(); T.addCameraRecoil(0.04); recover(1, rate); return g.state.cam.recoilPitch; });
      check(residuals.every(v => near(v, residuals[0], 1e-12)), 'Recovery timing is independent of frame rate');
      for (const pitch of [-0.6, -0.599, 1.2]) {
        prepare(); g.state.pitch = pitch;
        for (let i = 0; i < 100; i++) T.addCameraRecoil(0.02);
        check(g.state.cam.recoilPitch <= Math.max(0, pitch + 0.6), `Pitch ${pitch}: no hidden recoil beyond look limit`);
        recover(); check(g.state.pitch === pitch && g.state.cam.recoilPitch < 1e-7, `Pitch ${pitch}: no boundary drift`);
      }
      prepare(); T.addCameraRecoil(0.04); T.takeControl(g.heroes[1]);
      check(g.state.cam.recoilPitch === 0, 'Switching plants clears previous view recoil');
      T.addCameraRecoil(0.04); T.resetGame(); check(g.state.cam.recoilPitch === 0, 'New match clears recoil');
      g.configureSquad(['cactus']); h = prepare(); T.fireCactusSpike(h); T.toggleGarlicDrone(h);
      const drone = h.cactus.drone; check(!!drone, 'Launch drone during recoil');
      recover(); T.endGarlicDrone(drone); step(0);
      check(near(g.state.pitch, 0.2) && g.state.cam.recoilPitch < 1e-7, 'Drone return preserves aim without leftover recoil');
      return checks;
    });
    assert.deepEqual(errors, []);
    console.log(`PASS: ${checks.length} recoil checks (all plants, scoped fire, bursts, mouse input, look limits, frame rates, switching and drone).`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
