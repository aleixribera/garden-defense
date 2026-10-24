// Default lineup fairness plus picker / spawn lifecycle, against the real game source.
// Playwright and its Chromium browser are test-only dependencies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const defaults = JSON.parse(source.match(/\bdefaults:\s*(\[[^\]]+\])/)[1].replace(/'/g, '"'));
assert.deepEqual([...defaults].sort(), ['cactus', 'corn', 'peashooter', 'sunflower']);
const shuffleSource = source.match(/function shuffledDefaultSquad\([^]*?\n\}/)[0];
const shuffle = vm.runInNewContext(`${shuffleSource}; shuffledDefaultSquad;`, { CONFIG: { squad: { defaults } } });
const permutations = new Set(), first = Object.fromEntries(defaults.map(type => [type, 0]));
for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 2; c++) {
  const draws = [(a + 0.5) / 4, (b + 0.5) / 3, (c + 0.5) / 2];
  const order = Array.from(shuffle(() => draws.shift()));
  assert.deepEqual([...order].sort(), [...defaults].sort());
  permutations.add(order.join(',')); first[order[0]]++;
}
assert.equal(permutations.size, 24, 'every permutation must be equally reachable');
assert.ok(Object.values(first).every(count => count === 6), 'each plant must start in 6 of 24 equally likely outcomes');
assert.deepEqual(defaults, ['corn', 'peashooter', 'sunflower', 'cactus'], 'shuffling must leave configuration unchanged');
console.log('PASS: all 24 permutations; exactly 25% starting chance per plant');

const expose = 'window.__defaultSquadTest = { endGame, respawnHero };';
const html = source.replace(/loop\(\);\s*<\/script>\s*<\/body>/, expose + '</script></body>');
assert.ok(html.includes(expose), 'test hook must replace only the animation loop');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__defaultSquadTest, null, { timeout: 60000 });
    assert.deepEqual(errors, [], 'all four default hero models must initialize');
    const initial = await page.evaluate(() => {
      const g = __game, picks = [...document.querySelectorAll('#squadSlots select')].map(el => el.value);
      return { types: g.heroes.map(h => h.type), picks, human: g.player.type, ai: g.heroes.filter(h => h.isAI).length };
    });
    assert.deepEqual([...initial.types].sort(), [...defaults].sort());
    assert.deepEqual(initial.picks, initial.types, 'picker and initial spawn must share one shuffle');
    assert.equal(initial.human, initial.picks[0]); assert.equal(initial.ai, 3);
    await page.click('#matchButton');
    assert.deepEqual(await page.evaluate(() => __game.heroes.map(h => h.type)), initial.picks);
    assert.equal(await page.evaluate(() => __game.player.type), initial.picks[0]);
    console.log('PASS: initial picker, preview and match use one of every plant in the same order');

    const lifecycle = await page.evaluate(() => {
      const g = __game, t = __defaultSquadTest, original = [...g.heroes], order = original.map(h => h.type).join(',');
      const controlled = g.player; g.damageHero(controlled, 10000); t.respawnHero(controlled);
      const respawnKept = g.player === controlled && original.every((h, i) => h === g.heroes[i]);
      g.switchSquadMember(1);
      const switchKept = original.every((h, i) => h === g.heroes[i]) && g.heroes.map(h => h.type).join(',') === order;
      const random = Math.random;
      Math.random = () => order === g.CONFIG.squad.defaults.join(',') ? 0 : 0.999;
      try { t.endGame(false); } finally { Math.random = random; }
      const next = [...document.querySelectorAll('#squadSlots select')].map(el => el.value);
      return { respawnKept, switchKept, next, order };
    });
    assert.equal(lifecycle.respawnKept, true); assert.equal(lifecycle.switchKept, true);
    assert.deepEqual([...lifecycle.next].sort(), [...defaults].sort());
    assert.notEqual(lifecycle.next.join(','), lifecycle.order, 'untouched defaults must be reshuffled for the next match');
    await page.click('#matchButton');
    assert.deepEqual(await page.evaluate(() => __game.heroes.map(h => h.type)), lifecycle.next);
    assert.equal(await page.evaluate(() => __game.player.type), lifecycle.next[0]);
    console.log('PASS: respawn / handoff preserve identity; the next default match uses a fresh shuffle');

    await page.evaluate(() => __defaultSquadTest.endGame(false));
    await page.selectOption('#pick-0', 'corn');
    for (let i = 1; i <= 3; i++) await page.selectOption(`#pick-${i}`, '');
    await page.click('#matchButton');
    await page.evaluate(() => __defaultSquadTest.endGame(false));
    assert.deepEqual(await page.locator('#squadSlots select').evaluateAll(els => els.map(el => el.value)), ['corn', '', '', '']);
    console.log('PASS: manual squad choices remain selected across matches');
    assert.deepEqual(errors, [], 'no runtime exceptions during lineup lifecycle');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
