// Garden Ops economy test: boots ?autoplay, kills zombies (coins drop and get picked up / swept on wave clear),
// opens the between-wave shop, plants every pot type, checks pots damage zombies, repairs the statue, and
// renders a screenshot to docs/economy.png.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/?autoplay`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.stack); });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__game?.matchStarted && __game.state?.time > 0.2, null, { timeout: 90000 });
    const wait = ms => page.waitForTimeout(ms);

    // --- Coins: a kill drops coins worth the configured value; the wave-clear sweep collects the rest
    let r = await page.evaluate(() => {
      const g = __game, E = g.CONFIG.economy;
      g.state.waveTimer = 0;   // skip the first countdown
      return { start: g.state.coins, zombie: E.coinValue.zombie };
    });
    await wait(300);
    r = await page.evaluate(async () => {
      const g = __game, frame = () => new Promise(res => setTimeout(res, 50));
      g.state.spawnQueue.forEach(s => s.t = 0); await frame(); await frame();
      const n = g.zombies.length;
      // Park the squad far from the zombies so coins stay on the ground
      for (const z of g.zombies) g.damageZombie(z, 1e6, z.mesh.position, false, true, g.player);
      await frame(); await frame();
      const dropped = g.coins.length, value = g.coins.reduce((s, c) => s + c.value, 0);
      return { n, dropped, value, coins: g.state.coins };
    });
    assert.ok(r.n > 0 && r.coins >= r.n * 5, 'kills pay coins (swept on wave clear) ' + JSON.stringify(r));
    console.log(`PASS: ${r.n} kills paid ${Math.floor(r.coins)} coins`);
    await page.waitForFunction(() => __game.state.phase === 'countdown' && __game.state.waveIndex === 1, null, { timeout: 30000 });
    r = await page.evaluate(() => ({ coins: __game.state.coins, ground: __game.coins.length, timer: __game.state.waveTimer, open: __game.shopOffer !== undefined }));
    assert.equal(r.ground, 0, 'wave clear sweeps every coin');
    assert.ok(r.coins > 0, 'coins collected');
    assert.ok(r.timer > 20, 'shop time between waves');
    console.log(`PASS: wave clear swept coins into the wallet (${Math.floor(r.coins)}), shop open for ${Math.round(r.timer)} s`);

    // --- Shop: plant every pot type on the first spots, refuse when broke, repair the statue
    r = await page.evaluate(async () => {
      const g = __game, P = g.player, frame = () => new Promise(res => setTimeout(res, 50)), out = { planted: [] };
      const types = Object.keys(g.CONFIG.POTS.types);
      g.state.coins = 0;
      const s0 = g.potSpots[0];
      P.mesh.position.set(s0.pos.x, s0.pos.y + P.centerY, s0.pos.z); P.vel.set(0, 0, 0); await frame();
      out.offer = g.shopOffer()?.kind;
      g.shopBuy(); out.brokeRefused = !s0.pot;
      g.state.coins = 2000;
      for (let i = 0; i < types.length; i++) {
        const s = g.potSpots[i];
        P.mesh.position.set(s.pos.x, s.pos.y + P.centerY, s.pos.z); P.vel.set(0, 0, 0); await frame();
        while (types[g.state.shopChoice] !== types[i]) g.shopCycle();
        g.shopBuy(); out.planted.push(s.pot?.type);
      }
      out.spent = 2000 - g.state.coins;
      // Repair at the statue
      g.state.statueHp = g.state.statueSeen = 500;
      P.mesh.position.set(0, P.centerY, 4.5); P.vel.set(0, 0, 0); await frame();
      out.repairOffer = g.shopOffer()?.kind;
      g.shopBuy(); await frame();
      out.statue = g.state.statueHp;
      out.prompt = document.getElementById('shopPrompt').textContent;
      return out;
    });
    assert.equal(r.offer, 'pot'); assert.ok(r.brokeRefused, 'cannot buy without coins');
    assert.deepEqual(r.planted, ['peashooter', 'kernel', 'snapdragon', 'chomper']);
    assert.equal(r.repairOffer, 'repair'); assert.equal(r.statue, 500 + 150);
    console.log(`PASS: planted ${r.planted.join(', ')} (${r.spent} coins), repaired the statue to ${r.statue} · prompt "${r.prompt}"`);

    // --- Pots fight: zombies walking past the pots take damage from each type
    await page.evaluate(() => __game.shopReady());
    await page.waitForFunction(() => __game.state.phase === 'active', null, { timeout: 90000 });
    r = await page.evaluate(async () => {
      const g = __game, frame = () => new Promise(res => setTimeout(res, 50)), out = {};
      g.state.spawnQueue = []; g.zombies.forEach(z => g.damageZombie(z, 1e6, z.mesh.position, false, true, null)); await frame(); await frame();
      g.state.spawnQueue = [{ t: 999, type: 'shambler', spawn: Object.keys(g.CONFIG.SPAWN_POINTS)[0] }];   // keep the wave alive
      for (const [i, type] of ['peashooter', 'kernel', 'snapdragon', 'chomper'].entries()) {
        const s = g.potSpots[i], dir = s.pos.clone().setY(0).normalize();
        const z = g.spawnZombie('plated');
        const at = s.pos.clone().addScaledVector(dir, type === 'chomper' ? 2.5 : type === 'snapdragon' ? 5 : 15);
        z.mesh.position.set(at.x, g.heightAt(at.x, at.z) + z.def.height / 2, at.z);
        z.speed = 0; const hp0 = z.hp;
        for (let k = 0; k < 40 && !z.dead; k++) { z.mesh.position.set(at.x, z.mesh.position.y, at.z); await frame(); }
        out[type] = z.dead ? 'killed' : Math.round(hp0 - z.hp);
        if (!z.dead) g.damageZombie(z, 1e6, z.mesh.position, false, true, null);
        await frame();
      }
      return out;
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v === 'killed' || v > 0, `${k} pot deals damage`);
    console.log(`PASS: pots hurt zombies ${JSON.stringify(r)}`);

    // Screenshot from above the garden
    await page.evaluate(async () => {
      const g = __game; g.state.waveIndex = 1; g.state.phase = 'countdown'; g.state.waveTimer = 25;
      g.player.mesh.position.set(g.potSpots[5].pos.x, g.potSpots[5].pos.y + g.player.centerY, g.potSpots[5].pos.z);
      for (const z of g.zombies) g.dropCoins(z);
    });
    await wait(500);
    fs.mkdirSync(path.resolve(__dirname, '..', 'docs'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '..', 'docs', 'economy.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: no page errors · docs/economy.png');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
