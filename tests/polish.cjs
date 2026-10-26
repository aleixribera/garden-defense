// Look / feel / play polish (v1.23): allies hide when they block the camera, wave call-outs, damage numbers
// (yours bold, allies' small, pooled + capped), cooldown-ready flash, adaptive music modes, Music setting.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8')
  .replace(/\nloop\(\);\s*<\/script>/, '\nwindow.__polishTest = { updateCamera };\nloop();\n</script>');
const server = gameServer(html);

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.stack); });
    await page.goto(base + '?autoplay', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__game?.matchStarted && __game.state?.time > 0.3, null, { timeout: 90000 });
    await page.evaluate(() => __game.configureSquad(['cactus', 'corn', 'sunflower', 'peashooter']));
    const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => ++k >= n ? r() : setTimeout(f, 20); f(); }), n);

    // --- An ally between the camera and your plant hides, and comes back once it steps aside
    let r = await page.evaluate(() => {
      const g = __game, a = g.heroes.find(h => h !== g.player), out = [];
      for (let i = 0; i < 5; i++) {
        const c = g.camera.position, p = g.player.mesh.position;
        a.mesh.position.set((c.x + p.x) / 2, (c.y + p.y) / 2, (c.z + p.z) / 2);
        __polishTest.updateCamera(0);
        out.push(a.corn.root.visible);
      }
      const p = g.player.mesh.position;
      const c = g.camera.position, away = p.clone().sub(c).setY(0).normalize();   // ahead of your plant, off both lines
      a.mesh.position.set(p.x + away.x * 12 - away.z * 6, p.y, p.z + away.z * 12 + away.x * 6);
      __polishTest.updateCamera(g.CONFIG.camera.allyBlock.hold + 0.01);
      return { blocked: out.slice(1), back: a.corn.root.visible, playerShown: g.player.corn.root.visible, hidden: a.camHidden };
    });
    assert.ok(r.blocked.every(v => v === false), `blocking ally hidden: ${r.blocked}`);
    assert.ok(r.back && r.playerShown, `ally back after stepping aside, your plant always shown: ${JSON.stringify(r)}`);
    console.log('PASS: an ally blocking the camera hides, reappears after stepping aside');

    // --- Music: calm in the countdown, combat once the wave runs (audio allowed without a gesture here)
    r = await page.evaluate(async () => {
      const g = __game; document.hasFocus = () => true;   // headless pages report no focus, which pauses audio
      g.SFX.init(); g.SFX.setActive(true);
      await new Promise(r => setTimeout(r, 900));
      return { state: g.SFX.ctx?.state, mode: g.SFX.musicMode, phase: g.state.phase };
    });
    const audio = r.state === 'running';
    if (audio) {
      assert.equal(r.phase, 'countdown');
      await page.waitForFunction(() => __game.SFX.musicMode === 'calm', null, { timeout: 20000 });
    }

    // --- Wave start call-out
    await page.evaluate(() => { __game.state.waveTimer = 0.01; });
    await page.waitForFunction(() => __game.state.phase === 'active', null, { timeout: 20000 });
    r = await page.evaluate(() => {
      const g = __game;
      const el = document.getElementById('callout');
      return { cls: el.className, text: el.textContent, phase: g.state.phase };
    });
    assert.equal(r.phase, 'active'); assert.equal(r.cls, 'show'); assert.match(r.text, /Here they come/i);
    console.log(`PASS: wave start call-out "${r.text}"`);
    if (audio) {
      await page.waitForFunction(() => __game.SFX.musicMode === 'combat', null, { timeout: 20000 });
      console.log('PASS: music goes calm (countdown) → combat (wave)');
    } else console.log('SKIP: music modes (no running AudioContext in this browser)');

    // --- Damage numbers: yours are bold, allies' small; the pool caps live numbers
    r = await page.evaluate(async () => {
      const g = __game, z = g.spawnZombie('shambler', 'longRoad'), ally = g.heroes.find(h => h !== g.player);
      const p = g.camera.position.clone().add(g.camera.getWorldDirection(new g.THREE.Vector3()).multiplyScalar(12));
      z.mesh.position.copy(p); z.hp = 1e6; z.buried = false;
      const frame = () => new Promise(r => setTimeout(r, 80));
      // hit, then find the shown number by its value (pooled nodes are reused in any DOM order)
      const hit = async (owner, amount) => {
        const before = z.hp; g.damageZombie(z, amount, p.clone(), false, false, owner); await frame();
        const text = String(Math.round(before - Math.max(z.hp, before - 1e5)));
        return [...document.querySelectorAll('#popups .pop')].find(e => e.textContent === text && e.style.display !== 'none')?.className;
      };
      const mine = await hit(g.player, 17), theirs = await hit(ally, 23);
      for (let i = 0; i < 120; i++) g.damageZombie(z, 5, p.clone(), false, false, g.player);
      const nodes = document.querySelectorAll('#popups .pop').length;
      z.hp = 1; g.damageZombie(z, 31, p.clone(), false, false, g.player); await frame();
      const kill = [...document.querySelectorAll('#popups .pop')].find(e => e.classList.contains('kill') && e.style.display !== 'none')?.className;
      return { mine, theirs, nodes, kill };
    });
    assert.equal(r.mine, 'pop'); assert.equal(r.theirs, 'pop minor'); assert.equal(r.kill, 'pop kill');
    assert.ok(r.nodes <= 60, `popup nodes stay pooled: ${r.nodes}`);
    console.log(`PASS: damage numbers (yours "${r.mine}", ally "${r.theirs}", kill "${r.kill}"), ${r.nodes} pooled nodes after 122 hits`);

    // --- Ability slot pops when it comes off cooldown
    r = await page.evaluate(async () => {
      const g = __game, key = Object.keys(g.player.abilities)[0], el = document.getElementById(`ab-${key}`);
      // Cactus cooldowns come from its charge pool; exercise a real recharge instead of overriding the HUD timer.
      if (g.player.cactus) { g.player.cactus.charges[key] = 0; g.player.cactus.recharge[key] = 0.3; }
      g.player.cd[key] = 0.3; el.classList.remove('flash');
      const t0 = g.state.time;
      while (g.state.time - t0 < 0.5) await new Promise(r => setTimeout(r, 30));
      return { after: el.classList.contains('ready') && el.classList.contains('flash') };
    });
    assert.ok(r.after, 'ready slot flashes');
    console.log('PASS: ability slot flashes when it comes off cooldown');

    // --- Wave cleared: green call-out, the next banner waits for it
    r = await page.evaluate(async () => {
      const g = __game;
      g.state.spawnQueue.length = 0;
      for (const z of g.zombies) if (!z.dead) g.damageZombie(z, 1e7, z.mesh.position.clone(), false, true, g.player);
      await new Promise(r => setTimeout(r, 250));
      const el = document.getElementById('callout'), banner = getComputedStyle(document.getElementById('banner')).display;
      while (g.state.time < g.state.bannerAt + 0.15) await new Promise(r => setTimeout(r, 30));   // game time (slow under load)
      return { text: el.textContent, phase: g.state.phase, bannerEarly: banner, bannerLate: getComputedStyle(document.getElementById('banner')).display };
    });
    assert.equal(r.phase, 'countdown'); assert.match(r.text, /Wave 1 cleared/i);
    assert.equal(r.bannerEarly, 'none'); assert.equal(r.bannerLate, 'block');
    console.log('PASS: wave cleared call-out, then the countdown banner');

    // --- Music setting: slider + persisted
    r = await page.evaluate(() => {
      const g = __game; g.changeSetting('music', 0.25);
      return { slider: +document.getElementById('setMusic').value, saved: JSON.parse(localStorage.getItem(g.CONFIG.settings.storageKey)).music };
    });
    assert.equal(r.slider, 0.25); assert.equal(r.saved, 0.25);
    console.log('PASS: Music volume setting (slider + saved)');

    await frames(5);
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
