// Scientist agent checks against the real game: rig, Goo Blaster falloff, Warp, Sticky Explody Ball, Heal Station,
// plus close-up renders of the model (docs/scientist-*.png). Playwright is a test-only dependency.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__sciTest={THREE,renderer,scene,camera,resetGame,respawnHero,newInput,spawnAgent,updateZombies,updateScientistWorld,updateParticles,updateEffects,
  get pellets(){return gooPellets},get balls(){return stickyBalls},get zombies(){return zombies},
  clear(){clearScientistWorld();for(const z of zombies)scene.remove(z.mesh);zombies=[];state.spawnQueue=[];state.over=false;}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR:', e.message); });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__sciTest, { timeout: 45000 });
    const r = await page.evaluate(() => {
      const g = window.__game, T = window.__sciTest, dt = 1 / 60, out = {};
      g.configureSquad(['corn']);
      const h = g.player;
      const step = (n, each) => { for (let i = 0; i < n; i++) { g.state.time += dt; T.updateZombies(dt); T.updateScientistWorld(dt); each?.(); } };
      const place = (o, x, z) => { o.mesh.position.set(x, g.heightAt(x, z) + o.def.radius + o.def.height / 2, z); o.prevX = x; o.prevZ = z; };
      const setup = () => { T.clear(); T.respawnHero(h); h.input = T.newInput(); h.hp = 1e6; h.stats.hp = 1e6;
        h.mesh.position.set(10, g.heightAt(10, 10) + h.centerY, 10); h.vel.set(0, 0, 0); };
      // 1. Rig
      setup();
      const z = T.spawnAgent('scientist');
      out.rig = !!z.parts.rig && z.mesh.material.visible === false && z.parts.flashMats.length > 10;
      // 2. Goo Blaster: point blank hurts more than at range
      const shotAt = d => {
        setup(); const s = T.spawnAgent('scientist'); place(s, 10, 10 + d);
        s.ai.warpCd = s.ai.stickyCd = s.ai.stationCd = 99;
        const hp0 = h.hp; step(60); return hp0 - h.hp;
      };
      out.close = shotAt(4); out.far = shotAt(12);
      // 3. Warp behind a plant when committing from mid range
      setup(); const w = T.spawnAgent('scientist'); place(w, 10, 22);
      w.ai.stickyCd = w.ai.stationCd = 99; w.ai.warpCd = 0; h.yaw = 0;
      let warped = false; step(120, () => { if (w.ai.warp) warped = true; });
      out.warped = warped; out.warpDist = Math.hypot(w.mesh.position.x - 10, w.mesh.position.z - 10);
      // 4. Sticky Explody Ball sticks and explodes
      setup(); const b = T.spawnAgent('scientist'); place(b, 10, 24);
      b.ai.warpCd = b.ai.stationCd = 99; b.ai.stickyCd = 0;
      let thrown = 0, stuck = false; const hpB = h.hp;
      step(200, () => { thrown = Math.max(thrown, T.balls.length); if (T.balls.some(x => x.stuck === h)) stuck = true; });
      out.sticky = { thrown, stuck, dmg: hpB - h.hp, left: T.balls.length };
      // 5. Heal Station: hurt scientist deploys one and heals
      setup(); const c = T.spawnAgent('scientist'); place(c, 10, 30);
      c.ai.warpCd = c.ai.stickyCd = 99; c.ai.stationCd = 0; c.hp = 40;
      step(240);
      out.station = { exists: T.zombies.some(o => o.type === 'healStation'), hp: Math.round(c.hp) };
      // 6. Hit flash + death disposal don't throw
      g.damageZombie?.(c, 5, c.mesh.position.clone());
      step(5);
      return out;
    });
    console.log(JSON.stringify(r, null, 1));
    assert.ok(r.rig, 'scientist rig attached');
    assert.ok(r.close > 0 && r.close > r.far * 1.3, 'goo blaster falloff');
    assert.ok(r.warped && r.warpDist < 6, 'warp lands close to the plant');
    assert.ok(r.sticky.thrown && r.sticky.stuck && r.sticky.dmg > 0 && r.sticky.left === 0, 'sticky ball sticks and blows');
    assert.ok(r.station.exists && r.station.hp > 40, 'heal station heals');
    // Close-up renders
    const shots = [['front', 0], ['back', Math.PI * 0.8]];
    for (const [name, ang] of shots) {
      await page.evaluate(ang => {
        const g = window.__game, T = window.__sciTest;
        T.clear();
        const s = T.spawnAgent('scientist'); s.heroTgt = null;
        const x = 30, zz = 30; s.mesh.position.set(x, g.heightAt(x, zz) + s.def.radius + s.def.height / 2, zz); s.mesh.rotation.y = 0;
        s.ai.state = 'stalk'; s.parts.rig.aim = 1;
        g.player.mesh.position.set(x, g.heightAt(x, zz) + 1, zz + 8); s.heroTgt = g.player;
        for (let i = 0; i < 30; i++) { g.state.time += 1 / 60; s.parts.animate(s, 1 / 60); }
        const cam = T.camera, p = s.mesh.position;
        cam.position.set(p.x + Math.sin(ang) * 3.1 + 0.9, p.y + 0.5, p.z + Math.cos(ang) * 3.1);
        cam.lookAt(p.x, p.y + 0.15, p.z); cam.fov = 40; cam.aspect = 1; cam.updateProjectionMatrix();
        T.renderer.setSize(900, 900); T.renderer.domElement.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
        T.renderer.render(T.scene, cam);
      }, ang);
      await page.screenshot({ path: path.join(root, 'docs', `scientist-${name}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('scientist: all checks passed');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
