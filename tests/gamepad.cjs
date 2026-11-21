// Game controller: a scripted "standard" pad (navigator.getGamepads stubbed) drives the menus, starts a match with no
// pointer lock, moves / aims / fires / uses abilities, pauses and resumes, picks a boon, and a second mirrored pad
// (Steam's virtual Xbox pad) never doubles a press. Keyboard hints come back after a key press.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__padTest = { offerBoons, padState, get padPlaying() { return padPlaying; }, get inputMode() { return inputMode; }, pad };';
const server = gameServer(source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\nloop();\n</script>'));

// Fake pads: window.__setPad(index, { cross: true, ... }, [lx, ly, rx, ry]); null index slot = disconnected
const STUB = () => {
  const NAMES = ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'share', 'options', 'l3', 'r3', 'up', 'down', 'left', 'right', 'ps', 'touchpad'];
  const pads = [null, null, null, null];
  window.__setPad = (index, held = {}, axes = [0, 0, 0, 0], id = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)') => {
    pads[index] = { index, id, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [...axes],
      buttons: NAMES.map(n => ({ pressed: !!held[n], touched: !!held[n], value: held[n] ? 1 : 0 })) };
  };
  window.__unplug = index => { pads[index] = null; };
  Object.defineProperty(navigator, 'getGamepads', { value: () => pads.slice(), configurable: true });
};

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(STUB);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.gardenBoot?.ready && window.__padTest, null, { timeout: 180000 });
    const pass = text => console.log('PASS: ' + text);
    const frames = (n = 3) => page.evaluate(n => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);
    // One press: hold for a few frames, release for a few
    const tap = async (button, index = 0) => {
      await page.evaluate(([b, i]) => __setPad(i, { [b]: true }), [button, index]); await frames(1);
      await page.evaluate(i => __setPad(i, {}), index); await frames(2);
    };
    const focused = () => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

    // Connected but untouched: nothing changes. First press: pad mode, the menu's main button takes focus.
    await page.evaluate(() => __setPad(0, {})); await frames(3);
    assert.equal(await page.evaluate(() => __padTest.inputMode), 'kbm');
    await tap('down');
    assert.equal(await page.evaluate(() => document.body.classList.contains('padMode')), true);
    pass('a pad press switches the hints to pad glyphs');
    assert.match(await page.evaluate(() => document.getElementById('overlaySub').textContent), /R-stick aim/);
    assert.match(await page.evaluate(() => document.querySelector('#squadSlots .kit kbd').textContent), /^L1$/);
    pass('menu controls line and plant cards show pad glyphs');

    // Navigate: up from the main button reaches the squad picker; Cross changes a plant; left / right move between slots
    await page.evaluate(() => document.getElementById('matchButton').focus());
    for (let i = 0; i < 6 && !/^pick-/.test(await focused()); i++) await tap('up');
    let at = await focused();
    assert.match(at, /^pick-\d$/, `d-pad up reaches a squad slot (at ${at})`);
    await page.evaluate(() => document.getElementById('pick-0').focus());
    const before = await page.evaluate(() => document.getElementById('pick-0').value);
    await tap('cross');
    const after = await page.evaluate(() => document.getElementById('pick-0').value);
    assert.notEqual(after, before); pass(`Cross cycles your plant (${before} → ${after})`);
    await tap('right');
    assert.equal(await focused(), 'pick-1'); pass('d-pad right moves to the next squad slot');
    await tap('square'); await tap('cross');   // back one option, forward one: unchanged overall
    // Settings: open, step a slider with the d-pad, Circle closes them
    await page.evaluate(() => document.getElementById('settingsToggle').focus());
    await tap('cross');
    assert.equal(await page.evaluate(() => document.body.classList.contains('settingsOpen')), true);
    await page.evaluate(() => document.getElementById('setVol').focus());
    const vol = await page.evaluate(() => __game.SETTINGS.volume);
    await tap('left');
    const vol2 = await page.evaluate(() => __game.SETTINGS.volume);
    assert.ok(vol2 < vol, `d-pad left lowers the volume slider (${vol} → ${vol2})`); pass('d-pad left / right step a settings slider');
    await tap('right');
    await tap('circle');
    assert.equal(await page.evaluate(() => document.body.classList.contains('settingsOpen')), false); pass('Circle closes settings');

    // Start the match with Cross on the main button: no pointer lock needed
    await page.evaluate(() => { document.getElementById('pick-0').value = 'corn'; document.getElementById('pick-0').dispatchEvent(new Event('change')); });
    await page.evaluate(() => document.getElementById('matchButton').focus());
    await tap('cross');
    await page.waitForFunction(() => __padTest.padPlaying && __game.matchStarted, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('overlay')).display), 'none');
    const t0 = await page.evaluate(() => __game.state.time);
    await frames(6);
    assert.ok(await page.evaluate(() => __game.state.time) > t0, 'the match runs');
    pass('Cross on the main button starts the match without pointer lock');
    assert.equal(await page.evaluate(() => document.querySelector('#ab-shuckShot .key').textContent), 'L1');
    pass('ability badges show L1 / R1 / △');

    // Move: left stick up walks forward (camera-relative)
    const p0 = await page.evaluate(() => __game.player.mesh.position.clone());
    await page.evaluate(() => __setPad(0, {}, [0, -1, 0, 0])); await frames(20);
    await page.evaluate(() => __setPad(0, {}));
    const moved = await page.evaluate(p0 => __game.player.mesh.position.distanceTo(p0), p0);
    assert.ok(moved > 0.3, `left stick moves the plant (${moved.toFixed(2)} m)`); pass('left stick moves the plant');
    // Aim: right stick turns the camera
    const yaw0 = await page.evaluate(() => __game.state.yaw);
    await page.evaluate(() => __setPad(0, {}, [0, 0, 1, 0])); await frames(10);
    await page.evaluate(() => __setPad(0, {}));
    assert.ok(await page.evaluate(() => __game.state.yaw) < yaw0 - 0.05, 'right stick turns right'); pass('right stick aims');
    // Fire: R2 held fires (ammo drops)
    await frames(2);
    const ammo0 = await page.evaluate(() => __game.player.ammo);
    await page.evaluate(() => __setPad(0, { r2: true })); await frames(25);
    await page.evaluate(() => __setPad(0, {})); await frames(2);
    const ammo1 = await page.evaluate(() => __game.player.ammo);
    assert.ok(ammo1 < ammo0, `R2 fires (${ammo0} → ${ammo1})`); pass('R2 fires');
    // Abilities: L1 uses the first one
    await tap('l1'); await frames(2);
    assert.ok(await page.evaluate(() => __game.player.cd.shuckShot) > 0, 'L1 uses ability 1'); pass('L1 uses the first ability');

    // A mirrored second pad (Steam's virtual pad reports the same press, a frame later): one switch, not two
    await page.evaluate(() => __game.configureSquad(['corn', 'peashooter', 'sunflower']));
    await page.evaluate(() => { window.__switches = 0; const f = __game.switchSquadMember; });
    const ctl0 = await page.evaluate(() => __game.heroes.indexOf(__game.player));
    const nHeroes = await page.evaluate(() => __game.heroes.length);
    await page.evaluate(() => { __setPad(0, { right: true }); }); await frames(1);
    await page.evaluate(() => { __setPad(1, { right: true }, [0, 0, 0, 0], 'Xbox 360 Controller (XInput STANDARD GAMEPAD)'); }); await frames(2);
    await page.evaluate(() => { __setPad(0, {}); __setPad(1, {}, [0, 0, 0, 0], 'Xbox 360 Controller (XInput STANDARD GAMEPAD)'); }); await frames(2);
    const ctl1 = await page.evaluate(() => __game.heroes.indexOf(__game.player));
    assert.equal(ctl1, (ctl0 + 1) % nHeroes, `one d-pad press on a mirrored pair switches one plant (${ctl0} → ${ctl1})`);
    pass('a mirrored pad pair switches plants once');
    // The mirror lags: it rises on the poll the real pad lets go. Still one switch.
    const ctl2 = ctl1;
    await page.evaluate(() => __setPad(0, { right: true })); await frames(1);
    await page.evaluate(() => { __setPad(0, {}); __setPad(1, { right: true }, [0, 0, 0, 0], 'Xbox 360 Controller (XInput STANDARD GAMEPAD)'); }); await frames(1);
    await page.evaluate(() => __setPad(1, {}, [0, 0, 0, 0], 'Xbox 360 Controller (XInput STANDARD GAMEPAD)')); await frames(2);
    assert.equal(await page.evaluate(() => __game.heroes.indexOf(__game.player)), (ctl2 + 1) % nHeroes, 'a lagging mirror does not switch twice');
    assert.equal(await page.evaluate(() => __padTest.pad.index), 0);
    pass('a mirror that lags a poll behind does not fire twice');
    await page.waitForTimeout(250);   // the other pad may take over once the followed one has been idle a moment
    // The other pad alone takes over once it is used
    await tap('right', 1);
    assert.equal(await page.evaluate(() => __padTest.pad.index), 1);
    assert.equal(await page.evaluate(() => __game.heroes.indexOf(__game.player)), (ctl0 + 3) % nHeroes);
    pass('the last-used pad is followed (pad 2 after pad 1)');
    await page.evaluate(() => __unplug(1)); await tap('down', 0);
    assert.equal(await page.evaluate(() => __padTest.pad.index), 0); pass('unplugging falls back to the remaining pad');

    // Boon pick between waves: d-pad left / right choose, up takes
    await page.evaluate(() => __padTest.offerBoons()); await frames(2);
    assert.ok(await page.evaluate(() => __game.state.boonOffer));
    assert.match(await page.evaluate(() => document.querySelector('#boonPick .hint').textContent), /D-pad/);
    await tap('right');
    assert.equal(await page.evaluate(() => __game.state.boonOffer.sel), 1);
    await tap('up');
    assert.equal(await page.evaluate(() => __game.state.boonOffer), null); pass('d-pad chooses and takes a boon');

    // Pause with Options; the resume button is focused; Circle resumes
    await tap('options');
    assert.equal(await page.evaluate(() => __padTest.padPlaying), false);
    assert.equal(await page.evaluate(() => document.body.classList.contains('paused')), true);
    assert.equal(await focused(), 'matchButton');
    pass('Options pauses, RESUME has the focus');
    await tap('circle');
    assert.equal(await page.evaluate(() => __padTest.padPlaying), true); pass('Circle resumes');
    await tap('options'); await tap('options');
    assert.equal(await page.evaluate(() => __padTest.padPlaying), true); pass('Options toggles the pause');
    // The ✕ that resumes, still held, is not a jump / glide
    await tap('options');
    await page.evaluate(() => __setPad(0, { cross: true })); await frames(3);
    assert.equal(await page.evaluate(() => __padTest.padPlaying), true);
    assert.equal(await page.evaluate(() => __game.player.input.jumpHeld), false, 'the resuming ✕ is not held jump input');
    await page.evaluate(() => __setPad(0, {})); await frames(2);
    await page.evaluate(() => __setPad(0, { cross: true })); await frames(2);
    assert.equal(await page.evaluate(() => __game.player.input.jumpHeld), true, 'a fresh ✕ hold is jump input');
    await page.evaluate(() => __setPad(0, {})); await frames(2);
    pass('the button that resumes play is ignored until released');
    // The pad drops out mid-match: the game pauses; plugged back in, ✕ resumes
    await page.evaluate(() => __unplug(0)); await frames(2);
    assert.equal(await page.evaluate(() => __padTest.padPlaying), false);
    assert.equal(await page.evaluate(() => document.body.classList.contains('paused')), true);
    await page.evaluate(() => __setPad(0, {})); await frames(2); await tap('cross');
    assert.equal(await page.evaluate(() => __padTest.padPlaying), true); pass('a lost pad pauses the match, ✕ resumes');
    await tap('options'); await tap('cross');
    assert.equal(await page.evaluate(() => __padTest.padPlaying), true); pass('Cross on RESUME resumes');

    // A keyboard press brings the keyboard hints back
    await page.keyboard.press('KeyH');
    assert.equal(await page.evaluate(() => document.querySelector('#ab-shuckShot .key').textContent), 'Q');
    assert.equal(await page.evaluate(() => document.body.classList.contains('padMode')), false);
    pass('a key press switches the hints back to the keyboard');
    // Match over: the overlay takes the pad, DEFEND AGAIN gets the focus
    await page.evaluate(() => __game.endGame(false));
    await tap('down');
    assert.equal(await page.evaluate(() => __padTest.padPlaying), false);
    assert.ok(await page.evaluate(() => document.getElementById('overlay').contains(document.activeElement)));
    pass('match over: the pad navigates the result screen');
    await page.close();

    // The real boot gate (what the TV kiosk sees: not an automated browser): menu → loading → start, pad only
    const gate = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    gate.on('pageerror', e => errors.push(e.message));
    await gate.addInitScript(STUB);
    await gate.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await gate.goto(`http://127.0.0.1:${server.address().port}/`);
    await gate.waitForFunction(() => window.__setPad && document.getElementById('matchButton').textContent.includes('DEFEND'));
    const gFrames = (n = 3) => gate.evaluate(n => new Promise(r => { let i = 0; const f = () => ++i >= n ? r() : requestAnimationFrame(f); requestAnimationFrame(f); }), n);
    const gTap = async b => { await gate.evaluate(b => __setPad(0, { [b]: true }), b); await gFrames(1); await gate.evaluate(() => __setPad(0, {})); await gFrames(2); };
    await gate.evaluate(() => __setPad(0, {})); await gFrames(2);
    await gTap('down');
    assert.equal(await gate.evaluate(() => document.activeElement.id), 'matchButton', 'the pad focuses the main button before three.js loads');
    await gTap('cross');
    await gate.waitForFunction(() => window.gardenBoot.ready && window.__padTest, null, { timeout: 180000 });
    assert.equal(await gate.evaluate(() => document.getElementById('matchButton').textContent), 'PRESS ✕ TO START');
    await gTap('cross');
    await gate.waitForFunction(() => __padTest.padPlaying, null, { timeout: 10000 });
    pass('boot gate: menu, loading and start with the pad only');
    assert.deepEqual(errors, [], 'no browser errors');
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
