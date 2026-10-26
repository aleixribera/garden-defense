// Stable automated defaults, visible random player selection, no-repeat companions, and picker / spawn lifecycle.
// Playwright and its Chromium browser are test-only dependencies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const defaults = ['corn', 'peashooter', 'sunflower', 'cactus'];
const picks = ['corn', 'random', 'random', 'random'];
// The live roster (every CONFIG.PLANTS entry): a default squad is Corn plus three different plants from it
const configSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'config.js'), 'utf8');
const roster = [...configSource.matchAll(/^    (\w+): \{ name: '[^']+', weaponName:/gm)].map(m => m[1]);
const assertSquad = (types, message) => {
  assert.equal(types.length, 4, message); assert.equal(new Set(types).size, 4, message);
  assert.ok(types.includes('corn') && types.every(type => roster.includes(type)), message);
};
const resolverSource = source.match(/function resolveSquadSelection\([^]*?\n\}/)[0];
const makeResolver = roster => vm.runInNewContext(`${resolverSource}; resolveSquadSelection;`,
  { CONFIG: { PLANTS: Object.fromEntries(roster.map(type => [type, {}])) } });
const resolve = makeResolver(defaults), permutations = new Set();
for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) {
  const draws = [(a + 0.5) / 3, (b + 0.5) / 2];
  const order = Array.from(resolve(picks, () => draws.shift()));
  assert.equal(order[0], 'corn');
  assert.deepEqual([...order].sort(), [...defaults].sort());
  permutations.add(order.join(','));
}
assert.equal(permutations.size, 6, 'every companion order must be equally reachable, with Corn fixed');
assert.deepEqual(picks, ['corn', 'random', 'random', 'random'], 'resolving must leave picker choices unchanged');
assert.deepEqual(Array.from(resolve(['peashooter', 'random', 'sunflower', 'random'], () => 0)).sort(), [...defaults].sort(),
  'random slots exclude the player and explicit choices in later slots');
assert.deepEqual(Array.from(makeResolver(['corn', 'cactus'])(picks, () => 0)), ['corn', 'cactus'],
  'a smaller roster leaves slots empty rather than duplicating plants');
const larger = [...defaults, 'future-a', 'future-b'], expanded = makeResolver(larger), seen = new Set();
for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 3; c++) for (let d = 0; d < 2; d++) {
  const draws = [(a + 0.5) / 5, (b + 0.5) / 4, (c + 0.5) / 3, (d + 0.5) / 2];
  const order = Array.from(expanded(picks, () => draws.shift()));
  assert.equal(order.length, 4); assert.equal(order[0], 'corn'); assert.equal(new Set(order).size, 4);
  order.slice(1).forEach(type => seen.add(type));
}
assert.deepEqual([...seen].sort(), larger.filter(type => type !== 'corn').sort(), 'new plant entries enter the pool automatically');
console.log('PASS: Corn fixed; all six companion orders; explicit picks excluded; larger and smaller rosters supported');

const expose = 'window.__defaultSquadTest = { endGame, respawnHero };';
const html = source.replace(/loop\(\);\s*<\/script>\s*<\/body>/, expose + '</script></body>');
assert.ok(html.includes(expose), 'test hook must replace only the animation loop');
const server = gameServer(html);
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
      const g = __game, picks = [...document.querySelectorAll('#squadSlots select[id^="pick-"]')].map(el => el.value);
      return { types: g.heroes.map(h => h.type), picks, human: g.player.type, ai: g.heroes.filter(h => h.isAI).length };
    });
    assertSquad(initial.types, 'boot squad: Corn + three different roster plants');
    assert.deepEqual(initial.picks, picks, 'all companion slots default to Random');
    assert.equal(initial.human, 'corn'); assert.equal(initial.ai, 3);
    await page.click('#matchButton');
    assertSquad(await page.evaluate(() => __game.heroes.map(h => h.type)), 'match squad: Corn + three different roster plants');
    assert.equal(await page.evaluate(() => __game.player.type), 'corn');
    console.log('PASS: picker and match default to Corn plus three different random AI plants');

    const lifecycle = await page.evaluate(() => {
      const g = __game, t = __defaultSquadTest, original = [...g.heroes], order = original.map(h => h.type).join(',');
      const controlled = g.player; g.damageHero(controlled, 10000); t.respawnHero(controlled);
      const respawnKept = g.player === controlled && original.every((h, i) => h === g.heroes[i]);
      g.switchSquadMember(1);
      const switchKept = original.every((h, i) => h === g.heroes[i]) && g.heroes.map(h => h.type).join(',') === order;
      t.endGame(false);
      const next = [...document.querySelectorAll('#squadSlots select[id^="pick-"]')].map(el => el.value);
      return { respawnKept, switchKept, next, order };
    });
    assert.equal(lifecycle.respawnKept, true); assert.equal(lifecycle.switchKept, true);
    assert.deepEqual(lifecycle.next, picks, 'Random stays selected for the next match');
    await page.click('#matchButton');
    assertSquad(await page.evaluate(() => __game.heroes.map(h => h.type)), 'match squad: Corn + three different roster plants');
    assert.equal(await page.evaluate(() => __game.player.type), lifecycle.next[0]);
    console.log('PASS: respawn / handoff preserve identity; the next default match uses a fresh shuffle');

    await page.evaluate(() => __defaultSquadTest.endGame(false));
    await page.selectOption('#pick-0', 'peashooter');
    await page.selectOption('#pick-1', 'random'); await page.selectOption('#pick-2', 'sunflower'); await page.selectOption('#pick-3', 'random');
    assert.ok(await page.locator('#loadout-1').isDisabled(), 'Random has no class-specific loadout');
    await page.click('#matchButton');
    const mixed = await page.evaluate(() => __game.heroes.map(h => h.type));
    assert.equal(mixed[0], 'peashooter'); assert.equal(mixed[2], 'sunflower'); assert.equal(new Set(mixed).size, 4);
    console.log('PASS: random companions exclude a manually chosen player and a later explicit companion');

    await page.evaluate(() => __defaultSquadTest.endGame(false));
    await page.selectOption('#pick-0', 'corn');
    for (let i = 1; i <= 3; i++) await page.selectOption(`#pick-${i}`, '');
    await page.click('#matchButton');
    await page.evaluate(() => __defaultSquadTest.endGame(false));
    assert.deepEqual(await page.locator('#squadSlots select[id^="pick-"]').evaluateAll(els => els.map(el => el.value)), ['corn', '', '', '']);
    console.log('PASS: manual squad choices remain selected across matches');

    const menu = await browser.newPage();
    menu.on('pageerror', e => errors.push(e.message));
    await menu.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await menu.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load' });
    assert.equal(await menu.evaluate(() => !!window.__game), false, 'human menu keeps world construction behind the gate');
    const menuPicks = await menu.locator('#squadSlots select[id^="pick-"]').evaluateAll(els => els.map(el => el.value));
    assert.ok(roster.includes(menuPicks[0]), 'the player sees a concrete plant from the current roster');
    assert.deepEqual(menuPicks.slice(1), picks.slice(1));
    assert.ok(await menu.locator('#loadout-0').isEnabled(), 'the selected plant has its loadout ready');
    const chosen = roster.find(type => type !== menuPicks[0]);
    await menu.selectOption('#pick-0', chosen);
    await menu.click('#matchButton');
    await menu.waitForFunction(() => window.__defaultSquadTest && !document.body.classList.contains('loading'), null, { timeout: 90000 });
    const booted = await menu.evaluate(() => ({ types: __game.heroes.map(h => h.type), human: __game.player.type }));
    assert.equal(booted.human, chosen);
    assert.equal(new Set(booted.types).size, 4); assert.ok(booted.types.every(type => roster.includes(type)));
    console.log('PASS: human menu shows a random player plant, accepts a different choice, and boots that squad behind the loading screen');
    assert.deepEqual(errors, [], 'no runtime exceptions during lineup lifecycle');
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
