// Deterministic browser integration: actual game systems, with only the recurring animation loop stopped.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__engagementTest = { updateWaves, updateZombies, updateHud, updateCamera, respawnHero, mvpIndex, boardZMech };';
const html = source.replace(/loop\(\);\s*<\/script>\s*<\/body>/, expose + '</script></body>');
assert.ok(html.includes(expose));
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror', e => { if (!errors.includes(e.message)) errors.push(e.message); });
    const url = `http://127.0.0.1:${server.address().port}/?autoplay`;
    const boot = async () => { await page.goto(url); await page.waitForFunction(() => window.__engagementTest, null, { timeout: 90000 }); };
    await boot();
    assert.deepEqual(await page.evaluate(() => Object.values(__game.mastery.plants)), [0, 0, 0, 0], 'prewarming earns no mastery');

    let result = await page.evaluate(() => {
      const g = __game, t = __engagementTest;
      g.endGame(false); g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']);
      const variants = g.heroes.map(h => {
        const base = { ...h.weapon }; g.applyLoadout(h, true); const once = { ...h.weapon };
        g.applyLoadout(h, true); const repeat = JSON.stringify(h.weapon) === JSON.stringify(once);
        t.respawnHero(h);
        return { type: h.type, repeat, clip: h.ammo, expected: once.clip, changed: once.fireRate !== base.fireRate };
      });
      const h = g.player, original = h.weapon.damage; g.takeControlOf(g.heroes[1]); g.takeControlOf(h);
      return { variants, retained: h.weapon.damage === original };
    });
    assert.ok(result.variants.every(v => v.repeat && v.changed && v.clip === v.expected)); assert.ok(result.retained);
    console.log('PASS: every class sidegrade applies, never compounds, and survives respawn / control switching');

    result = await page.evaluate(() => {
      const g = __game, a = g.heroes[0], b = g.heroes[1], medic = g.heroes[2], E = g.CONFIG.engagement;
      g.startWave(0); g.state.spawnQueue = [{ t: 999, type: 'shambler', spawn: 'flank' }];
      const z = g.spawnZombie('shambler');
      g.damageZombie(z, z.hp * 0.3, z.mesh.position, false, false, a);
      g.damageZombie(z, 1e6, z.mesh.position, false, true, b);
      const assist = g.state.stats.match[0].assists, assistXp = g.state.stats.match[0].xp;
      const old = g.spawnZombie('shambler');
      g.damageZombie(old, old.hp * 0.3, old.mesh.position, false, false, a);
      g.state.time += E.assistWindow + 1; g.damageZombie(old, 1e6, old.mesh.position, false, true, b);
      const expired = g.state.stats.match[0].assists === assist;
      a.hp = a.stats.hp - 20;
      const heal = g.healHero(a, 1000, medic), zero = g.healHero(a, 1000, medic);
      const healXp = g.state.stats.match[2].xp;
      medic.hp -= 10; g.healHero(medic, 10, medic);
      const selfNoXp = g.state.stats.match[2].xp === healXp;
      g.recordStat(medic, 'revives', 1);
      const reviveXp = g.state.stats.match[2].xp - healXp;
      a.vanquishChain = null; const before = g.state.stats.match[0].xp;
      for (let i = 0; i < 3; i++) { const z = g.spawnZombie('shambler'); g.damageZombie(z, 1e6, z.mesh.position, false, true, a); }
      const chainXp = g.state.stats.match[0].xp - before;
      const feed = g.state.engagement.feed.map(n => n.text).join(' ');
      const after = g.state.stats.match[0].xp;
      g.damageZombie(z, 1e6, z.mesh.position, false, true, a);
      const duplicateSafe = after === g.state.stats.match[0].xp;
      g.state.time += E.chain.window + 1;
      const last = g.spawnZombie('shambler'); g.damageZombie(last, 1e6, last.mesh.position, false, true, a);
      g.saveMastery();
      return { assist, assistXp, expired, heal, zero, healXp, selfNoXp, reviveXp, chainXp, feed, duplicateSafe, reset: a.vanquishChain.count,
        expected: E.xp, chainBonus: E.chain.xp[0], saved: JSON.parse(localStorage.getItem(E.storageKey)).plants };
    });
    assert.equal(result.assist, 1); assert.equal(result.assistXp, result.expected.assist); assert.ok(result.expired);
    assert.equal(result.heal, 20); assert.equal(result.zero, 0); assert.equal(result.healXp, 20 * result.expected.heal);
    assert.ok(result.selfNoXp); assert.equal(result.reviveXp, result.expected.revive);
    assert.equal(result.chainXp, 3 * result.expected.kill + result.chainBonus);
    assert.match(result.feed, /TRIPLE VANQUISH/); assert.ok(result.duplicateSafe); assert.equal(result.reset, 1);
    await boot();
    assert.deepEqual(await page.evaluate(() => __game.mastery.plants), result.saved, 'XP survives reload');
    console.log('PASS: assists expire; actual healing / revives earn XP; chains expire; dead targets cannot pay twice; mastery survives reload');

    result = await page.evaluate(() => {
      const g = __game, E = g.CONFIG.engagement;
      const base = JSON.stringify(g.CONFIG.WAVES);
      const themes = [];
      for (const i of E.specialWaves) {
        g.beginCountdown(i);
        const sum = packs => packs.reduce((n, p) => n + Object.values(p.zombies).reduce((a, b) => a + b, 0), 0);
        themes.push({ name: g.state.engagement.theme.name, total: sum(g.state.packs), original: sum(g.CONFIG.WAVES[i].packs), min: g.state.engagement.theme.minWave, wave: i });
      }
      g.beginCountdown(4); const boss = !g.state.engagement.theme && !!g.state.bossRoll;
      return { themes, immutable: base === JSON.stringify(g.CONFIG.WAVES), boss };
    });
    assert.ok(result.themes.every(t => t.name && t.total === t.original && t.wave >= t.min));
    assert.ok(result.immutable && result.boss);
    console.log('PASS: special waves preserve enemy counts, introduction order, base data and boss slots');

    result = await page.evaluate(() => {
      const g = __game, E = g.CONFIG.engagement, O = E.objectives;
      g.beginCountdown(0); g.startWave(0);
      const coins = g.state.coins; g.clearWaveRewards(); const paid = g.state.coins - coins;
      const once = g.state.coins; g.clearWaveRewards(); g.finishBonus(true);
      const idempotent = once === g.state.coins;
      g.beginCountdown(0); g.startWave(0); g.state.statueHp -= O.protectLoss + 1; g.updateEngagement(0.1);
      const protectFail = g.state.engagement.objective.status;
      g.state.statueHp = g.CONFIG.statue.hp; g.updateEngagement(0.1); g.clearWaveRewards();
      const repairNoUndo = g.state.engagement.objective.status;
      g.beginCountdown(1); g.startWave(1); g.updateEngagement(10000); g.clearWaveRewards();
      const blitzFail = g.state.engagement.objective.status;
      g.beginCountdown(3); g.startWave(3);
      g.zombies.forEach(z => { z.dead = true; });
      const z = g.spawnZombie('shambler'); g.updateEngagement(0.1);
      const assigned = g.state.engagement.objective.target === z;
      g.damageZombie(z, 1e6, z.mesh.position, false, true, g.player);
      return { paid, expected: O.coins, idempotent, protectFail, repairNoUndo, blitzFail, assigned, bounty: g.state.engagement.objective.status };
    });
    assert.equal(result.paid, result.expected); assert.ok(result.idempotent);
    assert.equal(result.protectFail, 'missed'); assert.equal(result.repairNoUndo, 'missed'); assert.equal(result.blitzFail, 'missed');
    assert.ok(result.assigned); assert.equal(result.bounty, 'complete');
    console.log('PASS: bonus payouts happen once; damage / timeout failures stay optional; the real wanted kill completes its bounty');

    result = await page.evaluate(() => {
      const g = __game, O = g.CONFIG.engagement.objectives;
      g.state.statueHp = g.CONFIG.statue.hp; g.beginCountdown(2); g.startWave(2);
      g.zombies.forEach(z => { z.dead = true; });
      const o = g.state.engagement.objective, p = g.player, pos = o.pos;
      p.mesh.position.set(pos.x, pos.y + p.centerY, pos.z); p.feet = pos.y;
      const z = g.spawnZombie('shambler'); z.mesh.position.set(pos.x, pos.y + z.def.height / 2, pos.z);
      g.updateEngagement(2); const contested = o.contested && o.progress === 0;
      z.dead = true; g.updateEngagement(O.rallyHold + 0.1);
      const complete = o.status, reachable = Number.isFinite(g.STATUE_FIELD[g.NAV.cellOf(pos.x, pos.z)]);
      g.beginCountdown(2); g.startWave(2); const volunteer = g.heroes.find(h => h.isAI && h.type !== 'sunflower');
      g.bonusSteer(volunteer, 0.1); const helping = volunteer.input.move.length() > 0;
      g.state.gardenAlert = { t: 10 }; volunteer.input.move.set(0, 0, 0); g.bonusSteer(volunteer, 0.1);
      return { contested, complete, reachable, helping, homeFirst: volunteer.input.move.length() === 0, marker: !!g.bonusMarker.geometry };
    });
    assert.ok(result.contested && result.reachable && result.helping && result.homeFirst && result.marker); assert.equal(result.complete, 'complete');
    console.log('PASS: supply circles are reachable, contestable and capturable; the AI volunteers while respecting a garden emergency');

    result = await page.evaluate(() => {
      const g = __game, P = g.CONFIG.engagement.pacing;
      g.beginCountdown(1); g.startWave(1); g.zombies.forEach(z => { z.dead = true; });
      g.state.gardenAlert = null; g.state.statueHp = g.CONFIG.statue.hp;
      g.heroes.forEach(h => { h.lastHurt = -100; h.dead = false; });
      g.state.spawnQueue = [{ t: 30 }, { t: 36 }]; g.advanceQuietPack(P.quietTime + 0.1);
      const compressed = g.state.spawnQueue.map(s => s.t);
      g.state.spawnQueue = [{ t: 30 }]; g.player.lastHurt = g.state.time; g.advanceQuietPack(P.quietTime + 0.1);
      const grace = g.state.spawnQueue[0].t;
      g.player.lastHurt = -100; const z = g.spawnZombie('miniBoss'); g.advanceQuietPack(P.quietTime + 0.1);
      const boss = g.state.spawnQueue[0].t; z.dead = true;
      return { compressed, expected: P.nextPack, grace, boss };
    });
    assert.deepEqual(result.compressed, [result.expected, result.expected + 6]); assert.equal(result.grace, 30); assert.equal(result.boss, 30);
    console.log('PASS: empty stretches compress while preserving pack spacing, hurt grace and boss breathing room');

    result = await page.evaluate(() => {
      const g = __game, t = __engagementTest, h = g.player, imp = g.spawnAgent('imp');
      g.callZMech(imp); t.boardZMech(imp);
      const hp = imp.imp.mech.hp, before = g.state.stats.match[h.squadIndex].damage;
      g.damageZombie(imp, 1e6, imp.mesh.position, false, true, h);
      return { ejected: !imp.imp.mech, actual: g.state.stats.match[h.squadIndex].damage - before, hp,
        supportMvp: t.mvpIndex([{ kills: 0, healing: 1000, revives: 2 }, { kills: 2, damage: 50 }]) };
    });
    assert.ok(result.ejected); assert.equal(result.actual, result.hp); assert.equal(result.supportMvp, 0);
    console.log('PASS: Z-Mech ejection keeps damage credit bounded; strong support can earn MVP without kills');

    // Render the new HUD in the actual scene, and keep a reviewable image.
    await page.evaluate(() => {
      const g = __game, t = __engagementTest;
      g.endGame(false); g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']);
      g.beginCountdown(2); g.startWave(2); g.updateEngagement(0.01);
      t.updateCamera(0); t.updateHud(0); g.renderer.render(g.scene, g.camera);
      document.getElementById('overlay').style.display = 'none';
    });
    await page.screenshot({ path: path.resolve(__dirname, '..', 'docs', 'engagement.png') });
    assert.deepEqual(errors, [], 'no runtime exceptions');

    // Human boot still waits at the instant menu, and the actual picker applies a variant through a skipped slot.
    const menu = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    menu.on('pageerror', e => errors.push(e.message));
    await menu.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await menu.goto(url.replace('?autoplay', ''));
    assert.equal(await menu.evaluate(() => !!window.__game), false, 'world does not load before selection');
    await menu.selectOption('#pick-0', 'corn'); await menu.selectOption('#loadout-0', 'variant');
    await menu.selectOption('#pick-1', ''); await menu.selectOption('#pick-2', 'cactus'); await menu.selectOption('#loadout-2', 'variant'); await menu.selectOption('#pick-3', '');
    await menu.screenshot({ path: path.resolve(__dirname, '..', 'docs', 'engagement-menu.png') });
    await menu.click('#matchButton'); await menu.waitForFunction(() => window.__engagementTest, null, { timeout: 90000 });
    assert.deepEqual(await menu.evaluate(() => __game.heroes.map(h => h.loadout)), ['Heavy Kernels', 'Repeater Spikes']);
    await menu.evaluate(() => __game.endGame(false));
    assert.equal(await menu.inputValue('#loadout-0'), 'variant', 'manual loadout persists into rematch');
    console.log('PASS: instant menu gate preserved; real menu sidegrades apply correctly with an empty companion slot');

    const storage = await browser.newPage(); storage.on('pageerror', e => errors.push(e.message));
    await storage.addInitScript(() => {
      Storage.prototype.getItem = () => '{invalid';
      Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
    });
    await storage.goto(url); await storage.waitForFunction(() => window.__engagementTest, null, { timeout: 90000 });
    assert.ok(await storage.evaluate(() => {
      const g = __game, z = g.spawnZombie('shambler'); g.damageZombie(z, 1e6, z.mesh.position, false, true, g.player); g.saveMastery();
      return g.mastery.plants[g.player.type] > 0 && !g.state.over;
    }));
    assert.deepEqual(errors, [], 'all browser flows remain free of runtime exceptions');
    console.log('PASS: corrupted / disabled browser storage preserves playable session mastery');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
