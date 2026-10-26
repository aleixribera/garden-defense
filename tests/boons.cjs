// Between-wave boons (CONFIG.boons) and per-match wave mutators (CONFIG.MUTATORS): one boot, simulated steps.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__boonTest = { updateWaves, removeDeadZombies, takeBoon, rollMutators, scaledCount, respawnDelay, respawnHero, resetGame, DIFF };';
const server = gameServer(source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\n</script>'));
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`);
    await page.waitForFunction(() => window.__boonTest, null, { timeout: 120000 });
    const checks = await page.evaluate(() => {
      const g = __game, T = __boonTest, C = g.CONFIG, B = C.boons, M = C.MUTATORS, checks = [];
      const check = (ok, text) => { if (!ok) throw Error(text); checks.push(text); };
      const key = code => dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));

      // Mutator plan: the configured number of waves, in range, never the same mutator twice in a row
      for (let n = 0; n < 50; n++) {
        const plan = T.rollMutators(), waves = Object.keys(plan).map(Number).sort((a, b) => a - b);
        check(waves.length === M.waves && waves.every(w => w >= M.from && w <= M.to), 'mutators roll the configured waves');
        check(waves.every((w, i) => i === 0 || plan[w].key !== plan[waves[i - 1]].key), 'no mutator twice in a row');
      }
      const base = T.scaledCount('shambler', 20);
      g.state.mutator = { count: 2 };
      check(T.scaledCount('shambler', 20) === Math.round(base * 2), 'a count mutator scales the horde');
      g.state.mutator = null;

      // A cleared wave opens the picker and holds the countdown for it
      const clearWave = () => {
        g.state.phase = 'active'; g.state.spawnQueue.length = 0;
        for (const z of g.zombies) g.damageZombie(z, 1e7, z.mesh.position, false, true, null);
        T.removeDeadZombies(); T.updateWaves(0);
      };
      clearWave();
      const offer = g.state.boonOffer;
      check(offer && offer.options.length === B.offer && new Set(offer.options.map(o => o.key)).size === B.offer, 'a cleared wave offers distinct boons');
      check(g.state.waveTimer >= B.pickTime, 'the countdown waits for the pick');
      check(document.getElementById('boonPick').classList.contains('open') && document.querySelectorAll('#boonCards .card').length === B.offer, 'the picker shows');
      key('ArrowRight');
      check(offer.sel === 1 && document.querySelectorAll('#boonCards .card')[1].classList.contains('sel'), 'arrow keys move the selection');
      const pick = offer.options[1], before = g.state.boons[pick.stat];
      key('Enter');
      check(!g.state.boonOffer && Math.abs(g.state.boons[pick.stat] - before * pick.mult) < 1e-9, 'Enter takes the highlighted boon');
      check(g.state.waveTimer <= C.waveCountdown && g.state.boons.taken[pick.key] === 1, 'taking it shortens the countdown and counts it');

      // Automated runs pick on their own; a timed-out countdown takes the highlighted card
      clearWave();
      T.updateWaves(B.autoDelay + 0.01);
      check(!g.state.boonOffer, 'automated runs pick after autoDelay');

      // Effects (a fresh match: no boons yet, no mutator on wave 1)
      T.resetGame(); g.state.mutator = null;
      const z = g.spawnZombie('shambler'); z.def = { ...z.def, hp: 1e6 }; z.hp = 1e6;
      g.state.boons.damage = 2;
      let hp = z.hp; g.damageZombie(z, 100, z.mesh.position, false, false, g.player);
      const boosted = hp - z.hp; hp = z.hp; g.damageZombie(z, 100, z.mesh.position, false, false, null);
      check(Math.abs(boosted - 2 * (hp - z.hp)) <= 1, `damage boon doubles plant damage (${boosted} vs ${hp - z.hp})`);
      g.state.boons.respawn = 0.7;
      check(Math.abs(T.respawnDelay() - C.squad.respawnDelay * 0.7) < 1e-9, 'respawn boon shortens the respawn');
      const h = g.player, baseHp = h.stats.hp, health = B.list.find(o => o.stat === 'health');
      h.hp = baseHp - 30;
      g.state.boonOffer = { options: [health], sel: 0, t: 5 }; T.takeBoon();
      check(h.stats.hp === Math.round(baseHp * health.mult) && h.hp === h.stats.hp - 30, 'health boon raises max health and heals the gain');
      T.respawnHero(h);
      check(h.hp === Math.round(baseHp * health.mult), 'health boon survives a respawn');
      T.resetGame();
      check(h.stats.hp === baseHp && Object.keys(g.state.boons.taken).length === 0, 'a new match starts without boons');
      return checks;
    });
    for (const c of checks) console.log('PASS', c);
    assert.deepEqual(errors, [], 'no runtime errors');
    console.log('boons: all checks passed');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
