// Player-experience pass (v1.22): debug keys gated behind ?debug, radar + hit arcs + garden alert, far-zombie hurry,
// number-key plant switching, help panel, one-time tips, abandon match, and the dressed world (gnome statue states,
// windmill). Renders docs/experience.png (HUD in a live wave) and docs/world-court.png.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

// Keep the scheduled loop alive, but freeze its work during captures so software rendering cannot starve screenshots.
const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8')
  .replace('const raw = clock.getDelta()', 'if (window.__captureFrame) return; const raw = clock.getDelta()');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
const SHOTS = path.resolve(__dirname, '..', 'docs');

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.stack); });
    const frame = () => page.waitForTimeout(80);

    // --- Debug keys: off in a normal match, on with ?debug
    for (const [query, want] of [['', false], ['?debug', true]]) {
      await page.goto(base + query, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
      assert.equal(await page.evaluate(() => __game.DEBUG), want, `DEBUG for "${query}"`);
    }
    console.log('PASS: debug keys only with ?debug / ?autoplay');

    await page.goto(base + '?autoplay', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__game?.matchStarted && __game.state?.time > 0.2, null, { timeout: 90000 });

    // --- Onboarding: the first countdown queues the start tip (remembered); H shows the controlled plant's kit
    await page.waitForFunction(() => __game.tipsSeen.has('start'), null, { timeout: 30000 });
    let r = await page.evaluate(() => {
      const g = __game; g.toggleHelp(true);
      const el = document.getElementById('helpPanel'), out = { shown: getComputedStyle(el).display, text: el.textContent, name: g.player.def.name,
        stored: JSON.parse(localStorage.getItem(g.CONFIG.tips.storageKey)) };
      g.toggleHelp(false); return out;
    });
    assert.equal(r.shown, 'block'); assert.ok(r.text.includes(r.name), 'help names the plant'); assert.ok(r.stored.includes('start'));
    console.log(`PASS: start tip shown + remembered, H help lists ${r.name}'s kit`);

    // --- Number keys / takeControlOf: jump straight to a squad member
    r = await page.evaluate(() => { const g = __game, h = g.heroes[2]; g.takeControlOf(h); return g.player === h; });
    assert.ok(r, 'takeControlOf hands control over');
    console.log('PASS: take control of squad member 3 directly');

    // --- Pacing: far horde zombies hurry; near a plant, near the garden, bosses and agents never do
    r = await page.evaluate(async () => {
      const g = __game, H = g.CONFIG.hurry, out = {};
      g.state.waveTimer = 999;
      for (const h of g.heroes) h.mesh.position.set(h.spawnAt[0], h.mesh.position.y, h.spawnAt[1]);
      const z = g.spawnZombie('shambler', 'longRoad');
      out.far = g.hurryMult(z, false);
      const p = z.mesh.position.clone();
      g.player.mesh.position.set(p.x + 10, g.heightAt(p.x + 10, p.z) + g.player.centerY, p.z);
      out.nearPlant = g.hurryMult(z, false);
      for (const h of g.heroes) h.mesh.position.set(80, h.mesh.position.y, 80);   // nobody near the garden's north side
      z.mesh.position.set(0, z.mesh.position.y, -30);
      out.nearGarden = g.hurryMult(z, false); out.straggler = g.hurryMult(z, true);
      z.mesh.position.set(0, z.mesh.position.y, -15);
      out.stragglerAtGarden = g.hurryMult(z, true);
      const boss = g.spawnZombie('miniBoss', 'longRoad'); out.boss = g.hurryMult(boss, false);
      const agent = g.spawnAgent('soldier', 'longRoad'); out.agent = g.hurryMult(agent, false);
      for (const q of g.zombies) q.dead = true;
      await new Promise(res => setTimeout(res, 80));
      return { ...out, mult: H.mult };
    });
    assert.equal(r.far, r.mult); assert.equal(r.nearPlant, 1); assert.equal(r.nearGarden, 1); assert.equal(r.straggler, r.mult);
    assert.equal(r.stragglerAtGarden, 1); assert.equal(r.boss, 1); assert.equal(r.agent, 1);
    console.log(`PASS: far zombies hurry ×${r.mult}; near plants / garden, bosses and agents walk normally`);

    // --- Awareness: hit arcs point at the source, the garden alert + statue flash fire on garden damage, radar draws
    r = await page.evaluate(async () => {
      const g = __game, P = g.player, T = g.THREE;
      g.state.yaw = 0; g.hitDirs.length = 0;
      g.damageHero(P, 1, P.mesh.position.clone().add(new T.Vector3(10, 0, 0)));
      const angle = g.hitDirs[0]?.angle;
      g.state.statueHp -= 40;
      await new Promise(res => setTimeout(res, 120));
      const c = document.getElementById('radar'), px = c.getContext('2d').getImageData(c.width / 2, c.height / 2 - 3, 1, 1).data;
      return { angle, alert: getComputedStyle(document.getElementById('gardenAlert')).display, flash: g.gardenStatue.flash,
        arc: document.querySelector('#hitDirs i').style.opacity, center: [...px] };
    });
    assert.ok(Math.abs(r.angle - Math.PI / 2) < 1e-6, `hit from +x → yaw π/2 (${r.angle})`);
    assert.ok(+r.arc > 0, 'hit arc visible'); assert.equal(r.alert, 'block'); assert.ok(r.flash > 0, 'statue flashes');
    assert.ok(r.center[3] > 0, 'radar draws the player marker');
    console.log('PASS: hit arc toward the source, garden-under-attack alert + statue flash, radar drawn');

    // --- Statue states: the hat tip breaks off under half health and resets at full health; ally bars hide up close
    r = await page.evaluate(async () => {
      const g = __game, wait = () => new Promise(res => setTimeout(res, 120)), out = {};
      g.state.statueHp = 400; g.state.statueSeen = 400; await wait(); out.low = g.gardenStatue.tip.visible;
      g.state.statueHp = 950; g.state.statueSeen = 950; await wait(); out.high = g.gardenStatue.tip.visible;
      const ally = g.heroes.find(h => h !== g.player);
      ally.mesh.position.copy(g.camera.position).add(new g.THREE.Vector3(0, -ally.centerY - 0.2, 0)); await wait();
      out.barNear = ally.bar.group.visible;
      const sails = g.artSpin[0].obj, a0 = sails.rotation.z; await wait(); out.spin = sails.rotation.z !== a0;
      return out;
    });
    assert.equal(r.low, false); assert.equal(r.high, true); assert.equal(r.barNear, false); assert.ok(r.spin, 'windmill turns');
    console.log('PASS: gnome loses its hat tip under 50% and gets it back, ally bar hides beside the camera, windmill turns');

    // --- Screenshots: a live wave with the awareness HUD, then the court
    await page.evaluate(async () => {
      const g = __game; g.state.statueHp = 1000; g.state.statueSeen = 1000; g.state.waveTimer = 0.01;
      await new Promise(res => setTimeout(res, 300));
      for (const s of g.state.spawnQueue) s.t = Math.min(s.t, 0.05);
    });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { const g = __game, P = g.player; P.mesh.position.set(-6, g.heightAt(-6, -24) + P.centerY, -24); g.state.yaw = 0.4; g.state.pitch = 0.18; });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__captureFrame = true; });
    await page.screenshot({ path: path.join(SHOTS, 'experience.png') });
    await page.evaluate(() => { window.__captureFrame = false; });
    await page.evaluate(() => { const g = __game, P = g.player; P.mesh.position.set(-3, P.centerY, 13); g.state.yaw = 0.15; g.state.pitch = 0.05; });
    await page.waitForTimeout(600);
    await page.evaluate(() => { window.__captureFrame = true; });
    await page.screenshot({ path: path.join(SHOTS, 'world-court.png') });
    await page.evaluate(() => { window.__captureFrame = false; });
    console.log('PASS: screenshots docs/experience.png, docs/world-court.png');

    // --- Abandon match from the pause menu: a defeat screen with stats
    r = await page.evaluate(async () => {
      document.getElementById('abandonButton').click();
      await new Promise(res => setTimeout(res, 100));
      return { over: __game.state.over, title: document.getElementById('overlayTitle').textContent, sub: document.getElementById('overlaySub').textContent };
    });
    assert.equal(r.over, true); assert.equal(r.title, 'DEFEAT'); assert.match(r.sub, /abandoned/);
    console.log('PASS: abandon match ends it on the stats screen');
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
