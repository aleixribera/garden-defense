// Boss slot machine + extraction finale (v1.21): boots ?autoplay, rolls the slot on waves 5 and 10 (every option
// at least once), checks the rolled encounter spawns with its pack, then plays the finale: AI plants head for the
// landing zone, the zone charges with a plant inside → VICTORY; a run out of time → DEFEAT.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const server = gameServer(html);

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.stack); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__game?.matchStarted && __game.state?.time > 0.2, null, { timeout: 90000 });
    await page.evaluate(() => __game.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']));

    // --- Slot: rolls only on the slot waves; every option comes up; the reel lands during the countdown
    const roll = await page.evaluate(async () => {
      const g = __game, B = g.CONFIG.BOSS_SLOT, seen = {};
      g.beginCountdown(2); const none = g.state.bossRoll;
      for (let i = 0; i < 200; i++) for (const w of B.waves) { g.beginCountdown(w); seen[g.state.bossRoll.opt.key] = true; }
      g.beginCountdown(4); g.state.waveTimer = 60;
      const t0 = g.state.time;   // game time (slow software-GL frames run the clock slower than real time)
      while (g.state.time - t0 < B.spin + 0.5) await new Promise(r => setTimeout(r, 100));
      return { none, seen: Object.keys(seen).sort(), landed: g.state.bossRoll.landed, text: document.getElementById('bossSlot').textContent };
    });
    assert.equal(roll.none, null);
    assert.deepEqual(roll.seen, ['agents', 'gargantuar', 'mecha', 'mixed']);
    assert.ok(roll.landed, 'the reel landed'); assert.match(roll.text, /Boss roll/);
    console.log(`PASS: boss slot rolls every option, lands on "${roll.text.replace('Boss roll', '')}"`);

    // --- Each option's encounter is queued with the slot pack
    for (const key of ['gargantuar', 'mecha', 'agents', 'mixed']) {
      const q = await page.evaluate(k => {
        const g = __game, opt = g.CONFIG.BOSS_SLOT.options.find(o => o.key === k);
        g.beginCountdown(9); g.state.bossRoll.opt = opt; g.state.spawnQueue = [];
        g.startWave(9);
        const types = g.state.spawnQueue.map(s => s.type), ZT = g.CONFIG.ZOMBIE_TYPES;
        const out = { boss: types.filter(t => ZT[t].boss), agents: types.filter(t => ZT[t].agent).length, plated: types.filter(t => t === 'plated').length };
        g.state.spawnQueue = []; for (const z of g.zombies) z.hp = 0;
        return out;
      }, key);
      if (key === 'gargantuar') assert.deepEqual(q.boss, ['miniBoss']);
      if (key === 'mecha') assert.deepEqual(q.boss, ['finalBoss']);
      if (key === 'agents' || key === 'mixed') { assert.equal(q.boss.length, 0); assert.ok(q.agents >= 2, `${key}: ${q.agents} agents`); }
      console.log(`PASS: ${key} → bosses [${q.boss}], ${q.agents} agents queued`);
    }

    // --- Finale: clearing the last wave opens the landing zone; AI plants head there; holding it wins
    const fin = await page.evaluate(async () => {
      const g = __game; g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']);
      g.beginCountdown(9); g.state.waveTimer = 0.01;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(200);
      g.state.spawnQueue = []; for (const z of g.zombies) g.damageZombie(z, 1e7, z.mesh.position.clone(), false, true, g.player);
      for (let i = 0; i < 50 && g.state.phase !== 'extract'; i++) await wait(100);
      const f = g.state.finale, d0 = g.heroes.filter(h => h.isAI).map(h => Math.hypot(h.mesh.position.x - f.pos.x, h.mesh.position.z - f.pos.z));
      const t0 = g.state.time; while (g.state.time - t0 < 6) await wait(100);
      const d1 = g.heroes.filter(h => h.isAI).map(h => Math.hypot(h.mesh.position.x - f.pos.x, h.mesh.position.z - f.pos.z));
      const spawned = g.zombies.length, zone = g.extractZone.beacon.visible, hud = document.getElementById('waveLine').textContent;
      g.player.mesh.position.set(f.pos.x, g.heightAt(f.pos.x, f.pos.z) + 1, f.pos.z);   // the human plant stands in the zone
      g.state.statueHp = 1e6; g.state.statueSeen = 1e6;
      f.charge = 0.97;
      for (let i = 0; i < 60 && !g.state.over; i++) { g.player.mesh.position.set(f.pos.x, g.heightAt(f.pos.x, f.pos.z) + 1, f.pos.z); await wait(100); }
      return { phase: g.state.phase, d0, d1, spawned, zone, hud, over: g.state.over, title: document.getElementById('overlayTitle').textContent,
        sub: document.getElementById('overlaySub').textContent, dist: Math.hypot(f.pos.x, f.pos.z) };
    });
    assert.equal(fin.phase, 'extract'); assert.ok(fin.zone, 'landing zone beacon shown'); assert.match(fin.hud, /EXTRACTION/);
    assert.ok(fin.dist > 50, `zone ${fin.dist.toFixed(0)} m from the statue`);
    assert.ok(fin.spawned > 0, 'finale horde spawned');
    const closer = fin.d1.filter((d, i) => d < fin.d0[i] - 3).length;
    assert.ok(closer >= 2, `AI plants closing on the zone: ${fin.d0.map(Math.round)} → ${fin.d1.map(Math.round)}`);
    assert.equal(fin.over, true); assert.equal(fin.title, 'VICTORY'); assert.match(fin.sub, /got out/);
    console.log(`PASS: finale zone ${fin.dist.toFixed(0)} m out, ${fin.spawned} horde, ${closer}/3 AI plants closing in, held → VICTORY`);

    // --- Out of time → DEFEAT
    const lost = await page.evaluate(async () => {
      const g = __game; g.configureSquad(['corn']); g.startFinale(); g.state.finale.t = 0.05;
      await new Promise(r => setTimeout(r, 400));
      return { title: document.getElementById('overlayTitle').textContent, sub: document.getElementById('overlaySub').textContent, zone: g.extractZone.beacon.visible };
    });
    assert.equal(lost.title, 'DEFEAT'); assert.match(lost.sub, /left without you/); assert.equal(lost.zone, false);
    console.log('PASS: running out of time → DEFEAT, zone hidden');
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
