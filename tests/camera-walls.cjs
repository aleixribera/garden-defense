// Camera vs walls / cover: the over-the-shoulder camera never ends up inside a prop or behind it, the view from the
// plant to the camera stays clear, it pulls in at once and eases back out. Real updateCamera, automatic loop stopped.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__camTest = { updateCamera, solidAt };';
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
    page.on('pageerror', e => { errors.push(e.message); console.error('pageerror:', e.message); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`);
    await page.waitForFunction(() => window.__camTest, null, { timeout: 120000 });
    const checks = await page.evaluate(() => {
      const g = __game, T = __camTest, THREE = g.THREE, checks = [], dt = 1 / 60;
      const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text); };
      const cam = g.camera.position;
      // Place the plant, aim, and let the camera settle (pivot follow + any easing)
      const place = (type, x, z, yaw, pitch = 0.15, frames = 120) => {
        g.configureSquad([type]); g.state.time = 10;
        const h = g.player; h.mesh.position.set(x, g.groundAt(x, z) + h.centerY, z);
        h.vel.set(0, 0, 0); h.onGround = true; h.zoom = 0; h.sprint = 0;
        g.state.yaw = yaw; g.state.pitch = pitch; g.state.shake = 0; g.state.cam.pivot = null;
        for (let i = 0; i < frames; i++) T.updateCamera(dt);
        return h;
      };
      // Is the straight line from a to b free of solids (sampled every 5 cm)?
      const clear = (a, b, pad = 0.05) => {
        const n = Math.ceil(a.distanceTo(b) / 0.05), p = new THREE.Vector3();
        for (let i = 1; i < n; i++) if (T.solidAt(p.lerpVectors(a, b, i / n), pad)) return false;
        return true;
      };
      const head = h => h.mesh.position.clone().add(new THREE.Vector3(0, g.CONFIG.camera.height, 0));
      // The plant's head is on screen (or the plant is hidden because the lens sits inside it)
      const inFrame = h => {
        if (!h.corn.root.visible) return true;
        const q = head(h).project(g.camera);
        return q.z < 1 && Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95;
      };
      // The camera must be outside props, see the plant (nothing between the lens and the plant's head) and frame it
      const ok = (h, label) => {
        check(!T.solidAt(cam, 0.12), `${label}: camera is outside every prop`);
        check(clear(head(h), cam), `${label}: nothing between the plant and the camera`);
        check(inFrame(h), `${label}: the plant stays in frame`);
      };

      // Hedge Wall (x 34.75..37.25, z -53..-23, 3.2 m tall). Yaw 0 looks -z, so the shoulder (+x) points into it.
      let h = place('corn', 34.0, -38, 0);
      ok(h, 'hedge on the right shoulder');
      // Facing away from the hedge: the camera would sit inside it
      h = place('corn', 33.9, -38, Math.PI / 2);
      ok(h, 'hedge behind the plant');
      check(cam.x > 34.3, `hedge behind: camera backs up to the hedge's padding, not onto the plant (x ${cam.x.toFixed(2)})`);
      // Every direction and a few pitches while hugging the hedge, the Tool Shed corner and a thin low cover
      const spots = [['corn', 34.1, -38, 'hedge'], ['peashooter', 20.6, 12.9, 'shed corner'], ['sunflower', -15.7, -150, 'ridge cover'],
                     ['citron', -8, 10.3, 'fountain'], ['cactus', 33.9, -24, 'hedge end']];
      for (const [type, x, z, label] of spots) {
        let bad = 0;
        for (let a = 0; a < 16; a++) for (const pitch of [-0.4, 0.15, 0.8]) {
          h = place(type, x, z, a / 16 * Math.PI * 2, pitch, 40);
          if (T.solidAt(cam, 0.12) || !clear(head(h), cam) || !inFrame(h)) bad++;
        }
        check(bad === 0, `${label} (${type}): camera clear and plant framed in all 48 directions (${bad} bad)`);
      }

      // Pull in at once, ease back out: back the plant away from the hedge while facing away from it
      h = place('corn', 33.9, -38, Math.PI / 2);
      const near = cam.distanceTo(head(h));
      h.mesh.position.x = 28; g.state.cam.pivot.copy(head(h)); T.updateCamera(dt);   // a step away (no pivot snap)
      const first = cam.distanceTo(head(h));
      for (let i = 0; i < 90; i++) T.updateCamera(dt);
      const settled = cam.distanceTo(head(h));
      check(first < settled - 0.5 && first >= near - 0.05, `camera eases back out after leaving a wall (${first.toFixed(2)} → ${settled.toFixed(2)})`);
      h.mesh.position.x = 33.9; g.state.cam.pivot.copy(head(h)); T.updateCamera(dt);
      ok(h, 'walking back to the wall pulls the camera in the same frame');
      return checks;
    });
    checks.forEach(s => console.log('PASS: ' + s));
    assert.deepEqual(errors, [], 'no browser errors');
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
