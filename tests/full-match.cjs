// Full-match autoplay smoke test: boots ?autoplay with the real game loop, checks settings (saved + applied) and
// difficulty multipliers, then fast-forwards all 10 waves through the real spawn / damage / wave-clear paths
// (countdowns skipped, queued spawns released at once, every zombie finished with owned heavy hits).
// Expects a between-waves summary after each wave, a VICTORY screen with per-plant stats, and a DEFEAT screen.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
const SQUAD = ['corn', 'peashooter', 'sunflower', 'cactus'];

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/?autoplay`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.stack); });
    const boot = async () => {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__game?.matchStarted && __game.state?.time > 0.2, null, { timeout: 90000 });
    };
    await boot();

    // --- Settings: applied live and restored from localStorage after a reload
    let s = await page.evaluate(() => {
      const g = __game;
      g.changeSetting('quality', 'low'); g.changeSetting('fov', 90); g.changeSetting('sensitivity', 1.5); g.changeSetting('volume', 0.4);
      return { shadow: g.sun.castShadow, cap: g.particleCap, ratio: g.renderer.getPixelRatio(), fov: g.CONFIG.camera.fov };
    });
    assert.deepEqual(s, { shadow: false, cap: 150, ratio: Math.min(1, 0.75), fov: 90 });
    await boot();
    s = await page.evaluate(() => ({ ...__game.SETTINGS, shadow: __game.sun.castShadow, ui: document.getElementById('setFov').value }));
    assert.equal(s.quality, 'low'); assert.equal(s.fov, 90); assert.equal(s.sensitivity, 1.5); assert.equal(s.volume, 0.4);
    assert.equal(s.shadow, false); assert.equal(s.ui, '90');
    await page.evaluate(() => { const g = __game; g.changeSetting('quality', 'high'); g.changeSetting('fov', 70); });
    assert.equal(await page.evaluate(() => __game.sun.castShadow), true);
    console.log('PASS: settings apply live (shadows, particle cap, pixel ratio, FOV) and persist across reloads');

    // --- Difficulty: locked per match, scales garden hits, plant hits and zombie toughness
    const d = await page.evaluate(async () => {
      const g = __game, frame = () => new Promise(r => setTimeout(r, 60));
      g.changeSetting('difficulty', 'crazy'); g.endGame(false); g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']);
      const D = g.CONFIG.DIFFICULTY.crazy, out = { key: g.state.difficulty };
      g.state.statueHp -= 100; await frame(); out.statue = g.CONFIG.statue.hp - g.state.statueHp;
      const h = g.player, before = h.hp; g.damageHero(h, 10); out.hero = before - h.hp;
      g.state.statueHp = g.CONFIG.statue.hp; g.state.statueSeen = g.state.statueHp;
      const z = g.spawnZombie('shambler'), hp = z.hp; g.damageZombie(z, 20, z.mesh.position.clone(), false, false, h);
      out.zombie = hp - z.hp; out.taken = g.state.stats.match[0].taken; out.dealt = g.state.stats.match[0].damage;
      out.want = { statue: 100 * D.statueDamage, hero: 10 * D.zombieDamage, zombie: Math.round(20 / D.zombieHp) };
      g.changeSetting('difficulty', 'normal'); g.endGame(false);
      return out;
    });
    assert.equal(d.key, 'crazy');
    assert.ok(Math.abs(d.statue - d.want.statue) < 1e-6, `garden damage ${d.statue} ≠ ${d.want.statue}`);
    assert.ok(Math.abs(d.hero - d.want.hero) < 1e-6, `hero damage ${d.hero} ≠ ${d.want.hero}`);
    assert.equal(d.zombie, d.want.zombie); assert.equal(d.taken, d.hero); assert.equal(d.dealt, d.zombie);
    console.log(`PASS: Crazy difficulty scales garden ×${d.statue / 100}, plant hits ×${d.hero / 10}, zombie hits → ${d.zombie}`);

    // --- Full match: every wave through the real spawn / kill / wave-clear flow
    await page.evaluate(sq => __game.configureSquad(sq), SQUAD);
    const summaries = [], started = Date.now();
    for (;;) {
      const tick = await page.evaluate(() => {
        const g = __game, st = g.state, owner = g.player;
        if (st.over) return { over: true };
        if (st.phase === 'countdown') {
          const text = document.getElementById('waveSummary').textContent;
          st.waveTimer = Math.min(st.waveTimer, 0.01);
          return { wave: st.waveIndex, text };
        }
        for (const s of st.spawnQueue) s.t = 0;
        for (const z of g.zombies) if (!z.dead) g.damageZombie(z, 1e7, z.mesh.position.clone(), false, true, owner);
        st.statueHp = Math.max(st.statueHp, 400); st.statueSeen = st.statueHp;   // keep the AI-only fight from losing
        return { wave: st.waveIndex, active: true };
      });
      if (tick.over) break;
      if (tick.text && !summaries.some(x => x.wave === tick.wave)) summaries.push(tick);
      assert.ok(Date.now() - started < 8 * 60 * 1000, `match did not finish (stuck on wave ${tick.wave + 1})`);
      await page.waitForTimeout(80);
    }
    const end = await page.evaluate(() => ({
      title: document.getElementById('overlayTitle').textContent, shown: getComputedStyle(document.getElementById('matchStats')).display,
      rows: document.querySelectorAll('#matchStats tr').length - 1, line: document.querySelector('#matchStats .line').textContent,
      stats: __game.state.stats.match, mvp: !!document.querySelector('#matchStats tr.mvp'), overlay: getComputedStyle(document.getElementById('overlay')).display,
    }));
    assert.equal(summaries.length, 9, `between-waves summaries seen: ${summaries.map(x => x.wave).join(',')}`);
    summaries.forEach((x, i) => assert.match(x.text, new RegExp(`Wave ${i + 1} cleared`)));
    assert.equal(end.title, 'VICTORY'); assert.equal(end.shown, 'block'); assert.equal(end.overlay, 'flex');
    assert.equal(end.rows, SQUAD.length); assert.ok(end.mvp, 'an MVP is marked');
    assert.match(end.line, /10 \/ 10 waves cleared/);
    assert.ok(end.stats[0].kills > 50, `the human plant was credited with ${end.stats[0].kills} kills`);
    console.log(`PASS: full match in ${((Date.now() - started) / 1000).toFixed(0)} s · 9 wave summaries · VICTORY with ${end.stats[0].kills} kills credited`);

    // --- Defeat: the garden falls → DEFEAT screen with stats
    const lost = await page.evaluate(async sq => {
      const g = __game; g.configureSquad(sq); g.state.statueHp = 0;
      await new Promise(r => setTimeout(r, 200));
      return { over: g.state.over, title: document.getElementById('overlayTitle').textContent,
        line: document.querySelector('#matchStats .line')?.textContent || '' };
    }, SQUAD);
    assert.equal(lost.over, true); assert.equal(lost.title, 'DEFEAT'); assert.match(lost.line, /0 \/ 10 waves cleared/);
    console.log('PASS: DEFEAT screen shows the match stats');
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
