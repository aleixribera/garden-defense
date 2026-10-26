// Captain Deadbeard checks against the real game: model builds, kit modes run, damage lands, nothing throws.
// Writes close-up renders to docs/pirate-*.png. Playwright + Chromium are test-only dependencies.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { gameServer } = require('./lib/game-server.cjs');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__prTest={THREE,renderer,scene,camera,resetGame,respawnHero,spawnAgent,updateZombies,updatePirateWorld,
  updateEnemyProjectiles,updateParticles,updateEffects,pirateState,startPirateBarrel,startPirateCannon,startPirateParrot,
  get zombies(){return zombies},get props(){return pirateProps},
  clear(){for(const z of zombies){z.parts.dispose?.();scene.remove(z.mesh);}zombies=[];clearPirateWorld();state.spawnQueue=[];state.over=false;}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose), 'test hooks must replace the animation loop');
const server = gameServer(html);
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR:', e.stack || e.message); });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__prTest, null, { timeout: 45000 });
    // 1. Model close-ups
    const shots = {};
    for (const [name, yaw] of [['front', 0], ['side', 1.2], ['back', 3.0]]) {
      shots[name] = await page.evaluate(([yaw]) => {
        const T = window.__prTest, g = window.__game;
        T.clear();
        const z = T.spawnAgent('pirate');
        z.mesh.position.set(0, 60, 0); z.mesh.rotation.y = yaw;
        z.thinkTimer = 99;
        z.parts.animate(z, 1 / 60);
        T.scene.updateMatrixWorld(true);
        const cam = T.camera, p = z.mesh.position;
        cam.position.set(p.x, p.y + 0.35, p.z + 3.4); cam.lookAt(p.x, p.y + 0.15, p.z);
        cam.fov = 50; cam.updateProjectionMatrix();
        T.renderer.render(T.scene, cam);
        return T.renderer.domElement.toDataURL('image/png');
      }, [yaw]);
    }
    for (const [k, v] of Object.entries(shots)) fs.writeFileSync(path.join(root, 'docs', `pirate-${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
    // 2. Behavior: a plant stands 30 m away; simulate and record what the kit does
    const res = await page.evaluate(() => {
      const T = window.__prTest, g = window.__game, dt = 1 / 60;
      g.configureSquad(['corn']);
      T.clear();
      const h = g.player;
      T.respawnHero(h);
      const z = T.spawnAgent('pirate');
      z.pack = null;
      // Keep both actors on a known clear lane; spawn lanes can put a cliff between them.
      h.mesh.position.set(10, g.heightAt(10, 10) + h.centerY, 10);
      h.hp = 100000;
      z.mesh.position.set(10, g.heightAt(10, 30) + z.def.radius + z.def.height / 2, 30);
      z.mesh.rotation.y = Math.PI;
      const s = T.pirateState(z);
      s.cd.barrel = s.cd.cannon = s.cd.parrot = 99;
      const seen = { modes: new Set(), aim: false, hpStart: h.hp };
      const step = n => { for (let i = 0; i < n; i++) {
        g.state.time += dt; T.updateZombies(dt); T.scene.updateMatrixWorld(true);
        T.updatePirateWorld(dt); T.updateEnemyProjectiles(dt);
        T.updateParticles(dt); T.updateEffects(dt);
        const s = z.ai.pirate; if (s) { seen.modes.add(s.mode); if (s.aimT > 0) seen.aim = true; }
      } };
      step(60 * 6);
      // force each ability once
      s.cd.barrel = s.cd.cannon = s.cd.parrot = 99;
      T.startPirateCannon(z, s); step(60 * 6); seen.modes.add('cannonDone:' + s.mode);
      T.startPirateParrot(z, s, h); step(60 * 4); seen.parrotAlive = !!s.parrot; step(60 * 8);
      T.startPirateBarrel(z, s); step(60 * 5);
      return { modes: [...seen.modes], aim: seen.aim, alive: !z.dead, props: T.props.length, mode: s.mode, damaged: h.hp < seen.hpStart || h.lastHurt > 0 };
    });
    console.log(res);
    assert.ok(res.aim, 'Deadbeard lines up scoped shots');
    assert.ok(res.modes.includes('cannon') && res.modes.includes('parrot') && res.modes.includes('barrel'), 'all three ability modes ran');
    assert.equal(res.mode, 'gun', 'returns to the rifle after abilities');
    assert.ok(res.damaged, 'the plant took damage');
    const reset = await page.evaluate(() => {
      const T = window.__prTest, g = window.__game;
      T.clear();
      // Several agents expose parts.rig; Foot Soldier cleanup must only handle its own rig.
      const agents = Object.entries(g.CONFIG.ZOMBIE_TYPES)
        .filter(([, def]) => def.behavior === 'agent' || def.behavior === 'imp')
        .map(([type]) => T.spawnAgent(type));
      const lasers = agents.map(z => z.parts.laser || z.parts.rig?.userData?.laser).filter(Boolean);
      const pirate = agents.find(z => z.type === 'pirate');
      T.startPirateParrot(pirate, T.pirateState(pirate), g.player);
      T.resetGame();
      return { zombies: T.zombies.length, props: T.props.length, lasersRemoved: lasers.every(laser => !laser.parent) };
    });
    assert.deepEqual(reset, { zombies: 0, props: 0, lasersRemoved: true }, 'mixed agent rigs and active parrot reset cleanly');
    assert.deepEqual(errors, []);
    console.log('pirate: all checks passed');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
