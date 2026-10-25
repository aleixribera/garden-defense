// Deterministic browser integration: actual game systems, with only the recurring animation loop stopped.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__engagementTest = { updateWaves, updateZombies, updateHud, updateCamera, respawnHero, mvpIndex, boardZMech, removeDeadZombies, resetGame };';
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
    assert.ok((await page.evaluate(() => Object.values(__game.mastery.plants))).every(xp => xp === 0), 'prewarming earns no mastery');

    const waves = await page.evaluate(() => {
      const g = __game, t = __engagementTest, transitions = [];
      g.state.statueHp -= 100;
      const hp = g.state.statueHp;
      for (let i = 0; i < g.CONFIG.WAVES.length; i++) {
        g.beginCountdown(i);
        const countdown = g.state.waveTimer;
        for (const code of ['KeyC', 'KeyZ', 'KeyJ', 'Enter']) {
          dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
          dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
        }
        const unchanged = g.state.statueHp === hp && g.state.waveTimer === countdown;
        t.updateWaves(countdown);
        const active = g.state.phase === 'active' && g.state.spawnQueue.length > 0;
        const z = g.spawnZombie('shambler');
        g.damageZombie(z, 1e6, z.mesh.position, false, true, g.player);
        t.removeDeadZombies();
        g.state.spawnQueue.length = 0;
        t.updateWaves(0);
        transitions.push({ countdown, unchanged, active, next: g.state.phase, hp: g.state.statueHp });
      }
      const removed = !('coins' in g.state) && !('shopChoice' in g.state) &&
        !g.CONFIG.economy && !g.CONFIG.POTS && !g.potSpots && !g.TIPS.shop &&
        !document.querySelector('#coinLine, #coinNum, #shopPrompt');
      t.resetGame();
      return { transitions, removed, hp, countdown: g.CONFIG.waveCountdown, resetHp: g.state.statueHp, maxHp: g.CONFIG.statue.hp };
    });
    assert.ok(waves.removed, 'currency, shop and potted plants are removed');
    assert.ok(waves.transitions.every(w => w.countdown === waves.countdown && w.unchanged && w.active && w.hp === waves.hp));
    assert.deepEqual(waves.transitions.map(w => w.next), [...Array(9).fill('countdown'), 'extract']);
    assert.equal(waves.resetHp, waves.maxHp);
    console.log('PASS: all ten waves use regular countdowns, garden damage persists, removed shop keys do nothing, extraction and rematch still work');

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
      const aiHealXp = g.state.stats.match[2].xp;
      g.recordStat(medic, 'revives', 1);
      const aiReviveXp = g.state.stats.match[2].xp;
      const aiKillXp = g.state.stats.match[1].xp;
      g.takeControlOf(medic); a.hp -= 20;
      g.healHero(a, 20, medic);
      const healXp = g.state.stats.match[2].xp;
      medic.hp -= 10; g.healHero(medic, 10, medic);
      const selfNoXp = g.state.stats.match[2].xp === healXp;
      g.recordStat(medic, 'revives', 1);
      const reviveXp = g.state.stats.match[2].xp - healXp;
      g.takeControlOf(a);
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
      return { assist, assistXp, expired, heal, zero, aiHealXp, aiReviveXp, aiKillXp, healXp, selfNoXp, reviveXp, chainXp, feed, duplicateSafe, reset: a.vanquishChain.count,
        expected: E.xp, chainBonus: E.chain.xp[0], saved: JSON.parse(localStorage.getItem(E.storageKey)).plants };
    });
    assert.equal(result.assist, 1); assert.equal(result.assistXp, result.expected.assist); assert.ok(result.expired);
    assert.equal(result.heal, 20); assert.equal(result.zero, 0); assert.equal(result.healXp, 20 * result.expected.heal);
    assert.equal(result.aiHealXp, 0); assert.equal(result.aiReviveXp, 0); assert.equal(result.aiKillXp, 0);
    assert.ok(result.selfNoXp); assert.equal(result.reviveXp, result.expected.revive);
    assert.equal(result.chainXp, 3 * result.expected.kill + result.chainBonus);
    assert.match(result.feed, /TRIPLE VANQUISH/); assert.ok(result.duplicateSafe); assert.equal(result.reset, 1);
    await boot();
    assert.deepEqual(await page.evaluate(() => __game.mastery.plants), result.saved, 'XP survives reload');
    console.log('PASS: only the controlled plant earns kill / assist / heal / revive XP; switching follows control; mastery survives reload');

    result = await page.evaluate(() => {
      const g = __game, E = g.CONFIG.engagement;
      g.endGame(false); g.configureSquad(['corn', 'corn', 'sunflower', 'cactus']); g.startWave(0);
      const human = g.player, ai = g.heroes[1], target = g.spawnZombie('shambler');
      g.damageZombie(target, target.hp * 0.3, target.mesh.position, false, false, ai);
      g.damageZombie(target, 1e6, target.mesh.position, false, true, human);
      const aiAssist = g.state.stats.match[1].assists, aiAssistXp = g.state.stats.match[1].xp;
      const before = g.mastery.plants.corn;
      for (let i = 0; i < 3; i++) { const z = g.spawnZombie('shambler'); g.damageZombie(z, 1e6, z.mesh.position, false, true, ai); }
      const aiNoMastery = g.mastery.plants.corn === before && g.state.stats.match[1].xp === 0;
      g.takeControlOf(ai);
      const z = g.spawnZombie('shambler'); g.damageZombie(z, 1e6, z.mesh.position, false, true, ai);
      const controlledXp = g.state.stats.match[1].xp;
      const xpBefore = g.state.stats.match.map(s => s.xp);
      g.endGame(true);
      const victoryPaid = g.state.stats.match.map((s, i) => s.xp - xpBefore[i]);
      g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']);
      return { aiAssist, aiAssistXp, aiNoMastery, controlledXp, victoryPaid, victory: E.xp.victory };
    });
    assert.equal(result.aiAssist, 1); assert.equal(result.aiAssistXp, 0); assert.ok(result.aiNoMastery);
    assert.ok(result.controlledXp > 0); assert.deepEqual(result.victoryPaid, [0, result.victory, 0, 0]);
    console.log('PASS: AI assists / chains cannot farm shared class mastery; victory XP follows the currently controlled slot');

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
      const g = __game, E = g.CONFIG.engagement;
      g.beginCountdown(0); g.startWave(0);
      const before = g.state.stats.match.map(s => s.xp);
      g.clearWaveRewards();
      const paid = g.state.stats.match.map((s, i) => s.xp - before[i]);
      const once = g.state.stats.match.map(s => s.xp); g.clearWaveRewards();
      const idempotent = once.every((xp, i) => xp === g.state.stats.match[i].xp);
      for (let i = 0; i < g.CONFIG.WAVES.length; i++) { g.beginCountdown(i); g.startWave(i); g.updateEngagement(0.1); }
      __engagementTest.updateHud(0);
      return { paid, expected: E.xp.wave, slot: g.player.squadIndex, idempotent,
        removed: !E.objectives && !('objective' in g.state.engagement) && !g.bonusMarker &&
          !document.querySelector('#bonusTarget') && !document.getElementById('opsHud').textContent.includes('Optional bonus') };
    });
    assert.ok(result.idempotent && result.removed);
    assert.deepEqual(result.paid, result.paid.map((_, i) => i === result.slot ? result.expected : 0));
    console.log('PASS: wave XP pays once to the controlled plant; all ten waves run without bonus missions or markers');

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
