// HUD v2 / Menu v2: what shows when (wave pips, situational body classes, wave tags, match-over layout). One boot.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const server = gameServer(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`);
    await page.waitForFunction(() => window.__game?.state?.phase && !document.body.classList.contains('loading'), null, { timeout: 120000 });
    // Let the loop run updateHud / drawEngagement a few times (game time advances only while the match runs)
    const frames = async () => {
      const t = await page.evaluate(() => __game.state.over ? null : __game.state.time);
      if (t === null) return page.waitForTimeout(400);
      await page.waitForFunction(t => __game.state.time > t + 0.15, t, { timeout: 30000 });
    };
    const read = () => page.evaluate(() => {
      const $ = id => document.getElementById(id), body = document.body.classList, vis = id => getComputedStyle($(id)).display !== 'none';
      const pips = [...$('wavePips').children];
      return { pips: pips.length, boss: pips.map((p, i) => p.classList.contains('boss') ? i : -1).filter(i => i >= 0),
        done: pips.filter(p => p.classList.contains('done')).length, now: pips.findIndex(p => p.classList.contains('now')),
        firstWave: body.contains('firstWave'), betweenWaves: body.contains('betweenWaves'), solo: body.contains('soloSquad'),
        tags: $('waveTags').textContent, mastery: vis('masteryHud'), legend: vis('radarLegend'), ops: vis('opsHud'),
        squadTotal: vis('squadKillTotal'), fps: vis('fps'), chips: document.querySelectorAll('#squadHud .squadMember .key').length,
        topB: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topB')),
        topBottom: $('top').getBoundingClientRect().bottom };
    });
    const W = await page.evaluate(() => ({ waves: __game.CONFIG.WAVES.length, boss: __game.CONFIG.BOSS_SLOT.waves, heroes: __game.heroes.length }));

    // First wave: pips (+ the extraction ring), boss marks, onboarding extras on, ops panel gone
    // (the boot sits in the wave 1 countdown; hold it there)
    await page.evaluate(() => { const s = __game.state; s.waveIndex = 0; s.phase = 'countdown'; s.waveTimer = 60; }); await frames();
    let r = await read();
    assert.equal(r.pips, W.waves + 1, 'one pip per wave plus the extraction');
    assert.deepEqual(r.boss, W.boss, 'boss-roll waves are marked');
    assert.equal(r.now, 0); assert.equal(r.done, 0);
    assert.ok(r.firstWave && r.legend, 'radar legend shows in the first wave');
    assert.ok(!r.ops, 'the old ops panel stays hidden');
    assert.equal(r.chips, W.heroes, 'one squad chip per plant, with its key number');
    assert.equal(r.solo, W.heroes < 2);
    assert.ok(Math.abs(r.topB - r.topBottom) <= 1, '--topB follows the top strip');
    assert.ok(!r.squadTotal, 'squad vanquish total only while spectating');
    console.log('PASS first wave');

    // Wave 4 with a theme + mutator: tags while it runs, no onboarding extras
    await page.evaluate(() => { const g = __game, s = g.state; s.waveIndex = 3; s.phase = 'active';
      const z = g.spawnZombie('shambler'); z.def = { ...z.def, hp: 1e7 }; z.hp = 1e7;   // keeps the wave from clearing
      s.mutator = g.CONFIG.MUTATORS.list[0]; s.engagement.theme = g.CONFIG.engagement.themes[0]; });
    await frames(); r = await read();
    assert.equal(r.done, 3); assert.equal(r.now, 3);
    assert.ok(!r.firstWave && !r.legend && !r.mastery, 'mid-match: no legend or mastery bar');
    assert.ok(r.tags.includes('⚠') && r.tags.length > 10, `theme + mutator tags show (${r.tags})`);
    console.log('PASS mid-wave tags');

    // Between waves: mastery shows, tags clear (the banner announces the next wave)
    await page.evaluate(() => { __game.state.phase = 'countdown'; __game.state.waveTimer = 20; }); await frames();
    r = await read();
    assert.ok(r.betweenWaves && r.mastery, 'mastery bar between waves');
    assert.equal(r.tags, '', 'no wave tags during the countdown');
    console.log('PASS between waves');

    // Allies' plain damage numbers stay hidden; heals still show
    const pops = await page.evaluate(() => {
      const g = __game, ally = g.heroes.find(h => h !== g.player);
      if (!ally) return null;
      const before = document.querySelectorAll('#popups .pop.minor').length;
      const z = g.spawnZombie('shambler'); z.def = { ...z.def, hp: 1e6 }; z.hp = 1e6;
      z.mesh.position.copy(g.camera.position).addScaledVector(g.camera.getWorldDirection(z.mesh.position.clone()), 8);
      g.damageZombie(z, 10, z.mesh.position, false, false, ally);
      return { before, after: [...document.querySelectorAll('#popups .pop.minor')].filter(e => e.style.display !== 'none').length };
    });
    if (pops) { assert.equal(pops.after, pops.before, 'no ally damage number'); console.log('PASS ally numbers hidden'); }

    // Match over: verdict above the stats, HUD hidden, settings folded
    await page.evaluate(() => __game.endGame(false)); await frames();
    const over = await page.evaluate(() => {
      const $ = id => document.getElementById(id), y = id => $(id).getBoundingClientRect().top;
      return { cls: document.body.classList.contains('matchOver'), hud: getComputedStyle($('hud')).visibility,
        order: y('overlayTitle') < y('overlaySub') && y('overlaySub') < y('matchStats') && y('matchStats') < y('squadPicker'),
        settings: getComputedStyle($('settingsPanel')).display };
    });
    assert.ok(over.cls && over.hud === 'hidden', 'HUD hides behind the match-over screen');
    assert.ok(over.order, 'title → verdict → stats → squad picker');
    assert.equal(over.settings, 'none', 'settings fold away until asked for');
    await page.click('#settingsToggle'); await frames();
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('settingsPanel')).display), 'none', '⚙ opens settings');
    console.log('PASS match over');

    assert.deepEqual(errors, [], 'no runtime errors');
    assert.deepEqual(await page.evaluate(() => [...(__game.loopErrors || [])]), [], 'no loop errors');
    console.log('hud: all checks passed');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
