// Every menu screen, controller only, at TV (1920×1080) and phone (390×844) size: the main button has the focus first,
// every visible control is reachable with the d-pad from it and back (the focus graph comes from the game's own
// navigation, createMenuNav().next), the focused control is on screen, ◯ backs out, a failed boot reloads on ✕, and
// the pad plays the game inside an unfocused same-origin iframe (the Arcade's /play page).
// Screens: main menu, menu + settings, pause (with its settings), victory, defeat, spectator pause, boot failure.
// `node tests/gamepad-screens.cjs <dir>` also saves a screenshot of each screen there.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer, glArgs } = require('./lib/game-server.cjs');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__padTest = { menuNav, overlayEl, get padPlaying() { return padPlaying; } };';
const server = gameServer(source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\nloop();\n</script>'));
const shotDir = process.argv[2];

const STUB = () => {
  const NAMES = ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'share', 'options', 'l3', 'r3', 'up', 'down', 'left', 'right', 'ps', 'touchpad'];
  const pads = [null, null, null, null];
  window.__setPad = (index, held = {}, axes = [0, 0, 0, 0]) => {
    pads[index] = { index, id: 'Wireless Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: [...axes], buttons: NAMES.map(n => ({ pressed: !!held[n], touched: !!held[n], value: held[n] ? 1 : 0 })) };
  };
  Object.defineProperty(navigator, 'getGamepads', { value: () => pads.slice(), configurable: true });
};

// In the page: the d-pad focus graph of the open menu, from the focused control
const AUDIT = () => {
  const nav = __padTest.menuNav, list = nav.controls(__padTest.overlayEl), start = document.activeElement;
  const name = el => el.id || el.textContent.trim().slice(0, 24) || el.tagName;
  const walk = from => {
    const seen = new Set([from]), queue = [from];
    while (queue.length) {
      const el = queue.shift();
      for (const dir of ['up', 'down', 'left', 'right']) {
        const n = nav.next(list, el, dir);
        if (n && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    return seen;
  };
  const fromStart = walk(start);
  return {
    focused: name(start), inMenu: list.includes(start), count: list.length,
    unreachable: list.filter(el => !fromStart.has(el)).map(name),
    noWayBack: list.filter(el => !walk(el).has(start)).map(name),
  };
};

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: glArgs() });
    for (const [W, H] of [[1920, 1080], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(STUB);
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.waitForFunction(() => window.gardenBoot?.ready && window.__padTest, null, { timeout: 180000 });
      const frames = (n = 3) => page.evaluate(n => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);
      const tap = async button => {
        await page.evaluate(b => __setPad(0, { [b]: true }), button); await frames(1);
        await page.evaluate(() => __setPad(0, {})); await frames(2);
      };
      const focusOn = async id => { await page.evaluate(id => document.getElementById(id).focus(), id); await frames(1); };
      const tag = `${W}x${H}`;
      const check = async (screen, primary) => {
        const a = await page.evaluate(AUDIT);
        assert.equal(a.focused, primary, `${tag} ${screen}: ${primary} has the focus first (got ${a.focused})`);
        assert.deepEqual(a.unreachable, [], `${tag} ${screen}: every control reachable with the d-pad`);
        assert.deepEqual(a.noWayBack, [], `${tag} ${screen}: every control leads back to ${primary}`);
        // Walking to each control keeps it on screen (long menus scroll with the focus)
        const offscreen = await page.evaluate(() => {
          const out = [];
          for (const el of __padTest.menuNav.controls(__padTest.overlayEl)) {
            __padTest.menuNav.focus(el);
            const r = el.getBoundingClientRect();
            if (r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1) out.push(el.id || el.textContent.trim().slice(0, 24));
          }
          return out;
        });
        assert.deepEqual(offscreen, [], `${tag} ${screen}: a focused control is always on screen`);
        await page.evaluate(id => { const el = document.getElementById(id); el.focus(); el.scrollIntoView({ block: 'nearest' }); }, primary);
        await page.evaluate(() => __padTest.overlayEl.scrollTo(0, 0));
        if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `${tag}-${screen}.png`) }); }
        console.log(`PASS: ${tag} ${screen}: ${a.count} controls, all reachable from ${primary} and back`);
      };

      // Main menu: the first press shows the focus on the main button
      await page.evaluate(() => __setPad(0, {})); await frames(2);
      await tap('down');
      await check('menu', 'matchButton');
      await focusOn('settingsToggle'); await tap('cross');
      assert.ok(await page.evaluate(() => document.body.classList.contains('settingsOpen')));
      await focusOn('matchButton');
      await check('menu-settings', 'matchButton');
      await focusOn('setVol'); await tap('circle');
      assert.equal(await page.evaluate(() => document.body.classList.contains('settingsOpen')), false, '◯ closes settings');
      assert.ok(await page.evaluate(() => __padTest.overlayEl.contains(document.activeElement)), 'focus stays in the menu');

      // Play, then pause with Options: RESUME first
      await focusOn('matchButton'); await tap('cross');
      assert.equal(await page.evaluate(() => __padTest.padPlaying), true, `${tag}: ✕ starts the match`);
      await frames(5);
      await tap('options');
      await check('pause', 'matchButton');   // the pause menu shows the settings itself
      await tap('circle');   // closes nothing first: ◯ on pause resumes
      assert.equal(await page.evaluate(() => __padTest.padPlaying), true, `${tag}: ◯ resumes`);

      // Results: victory and defeat
      await page.evaluate(() => __game.endGame(true)); await frames(3);   // the result screen focuses its main button
      await check('victory', 'matchButton');
      // Watch the squad from the result screen, then pause: the spectator controls are reachable
      await focusOn('watchButton'); await tap('cross'); await frames(5);
      assert.equal(await page.evaluate(() => __padTest.padPlaying), true, `${tag}: ✕ on Watch squad starts spectating`);
      await tap('options');
      await check('spectator-pause', 'matchButton');
      // Abandon from the pause menu with the pad: defeat screen
      await focusOn('abandonButton'); await tap('cross'); await frames(3);
      assert.ok(await page.evaluate(() => __game.state.over), `${tag}: ✕ on Abandon ends the match`);
      await check('defeat', 'matchButton');
      await page.close();
    }

    // The Arcade: the game in a same-origin full-page iframe that never gets focus; the pad alone starts and plays it
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(STUB);
      await page.route(/\/arcade-test\.html$/, r => r.fulfill({ contentType: 'text/html', body:
        '<!doctype html><body style="margin:0"><input id="search"><iframe src="/" style="position:fixed;inset:0;width:100%;height:100%;border:0" allow="autoplay; fullscreen; gamepad; pointer-lock"></iframe></body>' }));
      await page.goto(`http://127.0.0.1:${server.address().port}/arcade-test.html`);
      await page.focus('#search');   // focus sits on the portal page, not in the game's frame
      const frame = () => page.frames().find(f => f !== page.mainFrame());
      await page.waitForFunction(() => document.querySelector('iframe').contentWindow.gardenBoot?.ready && document.querySelector('iframe').contentWindow.__padTest, null, { timeout: 180000 });
      const g = frame();
      const frames = (n = 3) => g.evaluate(n => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);
      const tap = async b => { await g.evaluate(b => __setPad(0, { [b]: true }), b); await frames(1); await g.evaluate(() => __setPad(0, {})); await frames(2); };
      await g.evaluate(() => __setPad(0, {})); await frames(2);
      await tap('down'); await tap('cross');
      assert.equal(await g.evaluate(() => __padTest.padPlaying), true, 'arcade iframe: ✕ starts the match');
      const t0 = await g.evaluate(() => __game.state.time); await frames(10);
      assert.ok(await g.evaluate(() => __game.state.time) > t0, 'arcade iframe: the match runs without focus in the frame');
      console.log('PASS: in an unfocused Arcade iframe the pad starts and plays a match');
      await page.close();
    }

    // A failed boot (a game file missing): the boot guard's RELOAD works from the pad, without the game module
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(STUB);
    await page.route(/src\/config\.js/, r => r.fulfill({ status: 404, body: '' }));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => document.getElementById('matchButton').textContent === 'RELOAD');
    await page.evaluate(() => { window.__before = true; __setPad(0, {}); });
    await page.waitForTimeout(100);
    await page.evaluate(() => __setPad(0, { cross: true }));
    await page.waitForFunction(() => !window.__before, null, { timeout: 10000 });   // the page reloaded
    console.log('PASS: boot failure: ✕ reloads');
    await page.close();

    assert.deepEqual(errors, [], 'no page errors');
    console.log('gamepad-screens: all checks passed');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
