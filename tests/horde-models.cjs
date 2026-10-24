// Horde model checks against the real game: every basic zombie type builds its skinned model, plays each clip
// (idle, walk, wind-up, strike, flinch, stun, special, death) without errors, and renders. Writes contact sheets
// docs/horde-<clip>.png (one tile per type). Playwright + Chromium are test-only dependencies.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__hmTest={THREE,renderer,scene,camera,resetGame,spawnZombie,updateZombieBatches,removeDeadZombies,HORDE,HORDE_MODELS,
  get zombies(){return zombies},get corpses(){return hordeCorpses},
  clear(){for(const z of zombies){z.parts.dispose?.();scene.remove(z.mesh);}zombies=[];hordeCorpses=[];state.spawnQueue=[];state.over=false;}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose), 'test hooks must replace the animation loop');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
const only = process.argv[2];   // optional: a single clip name
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR:', e.stack || e.message); });
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__hmTest, null, { timeout: 90000 });
    const clips = ['idle', 'walk', 'windup', 'strike', 'hit', 'stun', 'special', 'death', 'turn'];
    for (const clip of clips) {
      if (only && clip !== only) continue;
      const png = await page.evaluate(clip => {
        const T = window.__hmTest, g = window.__game, dt = 1 / 60;
        T.clear();
        const types = Object.keys(T.HORDE_MODELS);
        const list = types.map((type, i) => {
          const z = T.spawnZombie(type);
          z.mesh.position.set(-175 + i * 50, 60, 40);
          z.mesh.rotation.set(0, 0.55, 0);
          z.thinkTimer = 99; z.ha = null;
          return z;
        });
        const step = (z, t, frame) => {
          const def = z.def, m = T.HORDE_MODELS[z.type];
          if (clip === 'walk') z.mesh.position.addScaledVector(new T.THREE.Vector3(Math.sin(0.55), 0, Math.cos(0.55)), def.speed * dt);
          if (clip === 'turn') z.mesh.rotation.y += dt * 3;
          if (clip === 'windup' || clip === 'strike') {
            z.mode = 'attack';
            const wu = m.windup || 0.3;
            z.attackTimer = clip === "windup" ? Math.max(0.02, wu - t) : 0.55 - t;
            if (clip === 'strike' && z.attackTimer <= 0 && !z.struck) { z.struck = true; z.ai.swing = 0.18; }
          }
          if (clip === 'hit' && frame === 30) z.flash = 0.08;
          if (clip === 'stun') z.stun = 1;
          if (clip === 'special') {
            if (z.type === 'sprinter') { z.ai.lungeT = 0.15; }
            if (z.type === 'howler') { z.ai.windup = 0; z.ai.screamCd = def.scream.cooldown - Math.max(0, t - 0.6) * 0.3; }
            if (z.type === 'spitter') { z.mode = 'attack'; z.attackTimer = 0.05; }
            if (z.type === 'climber') { z.climbing = true; z.mesh.position.y += def.climbSpeed * dt; }
            if (z.type === 'banner') { z.mode = 'special'; z.mesh.position.addScaledVector(new T.THREE.Vector3(Math.sin(0.55), 0, Math.cos(0.55)), def.speed * 1.2 * dt); }
            if (z.type === 'plated' && frame === 1) { z.parts.plates.forEach(p => p.visible = false); z.parts.core.visible = true; }
            if (z.type === 'shambler' || z.type === 'bomber') z.mesh.position.addScaledVector(new T.THREE.Vector3(Math.sin(0.55), 0, Math.cos(0.55)), def.speed * 1.6 * dt);
          }
        };
        const frames = clip === 'strike' ? 0 : 70;
        const H = {};
        for (const z of list) H[z.type] = z.mesh.position.clone();
        let n = 0;
        for (let k = 0; k < 60; k++) T.updateZombieBatches(dt);   // finish the spawn rise first
        if (clip === 'strike') {   // run until each strike lands, then 0.07 s more
          for (; n < 120; n++) { const t = n * dt; for (const z of list) step(z, t, n); T.updateZombieBatches(dt); if (n > (0.55 / dt) + 4) break; }
        } else if (clip === 'death') {
          for (; n < 30; n++) { T.updateZombieBatches(dt); }
          list.forEach((z, i) => { z.ha.seed = i % 2 ? 0.2 : 0.8; z.hp = 0; z.dead = true; });
          T.removeDeadZombies();
          for (let k = 0; k < 66; k++) T.updateZombieBatches(dt);
        } else for (; n < frames; n++) { const t = n * dt; for (const z of list) step(z, t, n); T.updateZombieBatches(dt); }
        const r = T.renderer, W = 1600, Ht = 900, cols = 4, tw = W / cols, th = Ht / 2;
        r.setSize(W, Ht, false); r.setPixelRatio(1);
        r.setScissorTest(true);
        const cam = T.camera;
        types.forEach((type, i) => {
          const def = g.CONFIG.ZOMBIE_TYPES[type], halfH = def.radius + def.height / 2;
          const z = list[i], p = (clip === 'death' ? H[type] : z.mesh.position).clone();
          const x = (i % cols) * tw, y = (1 - Math.floor(i / cols)) * th;
          r.setViewport(x, y, tw, th); r.setScissor(x, y, tw, th);
          const dist = halfH * 2 * 1.75 + 1.2, a = 0.55 + 0.45;
          cam.aspect = tw / th; cam.fov = 40; cam.updateProjectionMatrix();
          const ty = clip === 'death' ? p.y - halfH + 0.4 : p.y + halfH * 0.05;
          cam.position.set(p.x + Math.sin(a) * dist, ty + (clip === 'death' ? 2.6 : halfH * 0.35), p.z + Math.cos(a) * dist);
          cam.lookAt(p.x, ty, p.z);
          T.renderer.render(T.scene, cam);
        });
        r.setScissorTest(false);
        return r.domElement.toDataURL('image/png');
      }, clip);
      fs.writeFileSync(path.join(root, 'docs', `horde-${clip}.png`), Buffer.from(png.split(',')[1], 'base64'));
      console.log('rendered', clip);
    }
    // Every type gets a kit, poses without NaNs, and corpses clear on reset
    const res = await page.evaluate(() => {
      const T = window.__hmTest;
      T.clear();
      const zs = Object.keys(T.HORDE_MODELS).map(t => T.spawnZombie(t));
      for (let i = 0; i < 20; i++) T.updateZombieBatches(1 / 60);
      const finite = Object.values(T.HORDE).every(k => k.data.subarray(0, k.n * 192).every(Number.isFinite));
      zs.forEach(z => { z.hp = 0; z.dead = true; });
      T.removeDeadZombies();
      const corpses = T.corpses.length;
      T.resetGame();
      return { finite, corpses, after: T.corpses.length, kits: Object.keys(T.HORDE).length };
    });
    assert.deepEqual(res, { finite: true, corpses: 8, after: 0, kits: 8 });
    assert.deepEqual(errors, []);
    console.log('horde-models: all checks passed');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
