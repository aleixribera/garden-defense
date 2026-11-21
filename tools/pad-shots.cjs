// Screenshots of the controller flow (menu focus, settings, play HUD, pause, boon pick, help, match over) at a given
// viewport: node tools/pad-shots.cjs <outDir> [width] [height]. Pads are stubbed like tests/gamepad.cjs.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { gameServer } = require('../tests/lib/game-server.cjs');
const out = process.argv[2] || 'shots', W = +process.argv[3] || 1920, H = +process.argv[4] || 1080;
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__padTest = { offerBoons, get padPlaying() { return padPlaying; } };';
const server = gameServer(source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\nloop();\n</script>'));
const STUB = () => {
  const NAMES = ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'share', 'options', 'l3', 'r3', 'up', 'down', 'left', 'right', 'ps', 'touchpad'];
  const pads = [null, null, null, null];
  window.__setPad = (index, held = {}, axes = [0, 0, 0, 0]) => {
    pads[index] = { index, id: 'Wireless Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: performance.now(), axes: [...axes],
      buttons: NAMES.map(n => ({ pressed: !!held[n], touched: !!held[n], value: held[n] ? 1 : 0 })) };
  };
  Object.defineProperty(navigator, 'getGamepads', { value: () => pads.slice(), configurable: true });
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.addInitScript(STUB);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.gardenBoot?.ready && window.__padTest, null, { timeout: 180000 });
    const frames = (n = 3) => page.evaluate(n => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);
    const tap = async b => { await page.evaluate(b => __setPad(0, { [b]: true }), b); await frames(1); await page.evaluate(() => __setPad(0, {})); await frames(2); };
    const shot = async name => { await frames(2); await page.screenshot({ path: path.join(out, `${W}x${H}-${name}.png`) }); console.log('shot', name); };
    await page.evaluate(() => __setPad(0, {})); await frames(2);
    await tap('down');
    await page.evaluate(() => document.getElementById('pick-1').focus()); await shot('menu');
    await page.evaluate(() => document.getElementById('settingsToggle').focus()); await tap('cross');
    await page.evaluate(() => document.getElementById('setVol').focus()); await shot('settings');
    await tap('circle');
    await page.evaluate(() => { document.getElementById('pick-0').value = 'corn'; document.getElementById('pick-0').dispatchEvent(new Event('change')); });
    await page.evaluate(() => document.getElementById('matchButton').focus()); await tap('cross');
    await page.waitForFunction(() => __padTest.padPlaying);
    await page.evaluate(() => { __game.state.waveTimer = 0.1; }); await frames(30);
    await page.evaluate(() => __setPad(0, { r2: true }, [0, -0.8, 0.3, 0])); await frames(8); await shot('play');
    await page.evaluate(() => __setPad(0, {})); await frames(2);
    await tap('triangle'); await shot('targeting'); await tap('circle');
    await page.evaluate(() => __padTest.offerBoons()); await shot('boons');
    await tap('up');
    await tap('touchpad'); await shot('help'); await tap('touchpad');
    await tap('options'); await shot('pause');
    await tap('circle');
    await page.evaluate(() => __game.endGame(true)); await tap('down'); await shot('over');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
