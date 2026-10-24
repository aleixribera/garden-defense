// Animation juice checks: every agent flinches, topples on death and is disposed afterwards; heroes topple when
// downed, spring back up and pop in on respawn. Writes filmstrips to docs/anim-*.png for eyeballing.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__anTest={THREE,renderer,scene,camera,spawnAgent,updateZombies,damageZombie,damageHero,respawnHero,
  updateAgentCorpses,updateParticles,heroJuice,heroes,ZT,get zombies(){return zombies},get corpses(){return agentCorpses},
  clear(){for(const z of zombies){z.parts.dispose?.();scene.remove(z.mesh);}zombies=[];clearAgentCorpses();state.spawnQueue=[];state.over=false;}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose), 'test hooks must replace the animation loop');
const out = process.argv[2] || path.join(root, 'docs');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 300 } });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR:', e.stack || e.message); });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__anTest, null, { timeout: 60000 });
    const agents = await page.evaluate(() => Object.keys(window.__anTest.ZT).filter(k => window.__anTest.ZT[k].agent));
    console.log('agents:', agents.join(', '));
    // Filmstrip helper: render `frames` snapshots side by side into one canvas
    const strip = async (name, setup, step, frames, cam) => {
      const data = await page.evaluate(([setup, step, frames, cam]) => {
        const T = window.__anTest, S = new Function('T', 'ctx', setup), P = new Function('T', 'z', 'i', step);
        const R = T.renderer, W = 240, H = 300, c = document.createElement('canvas'); c.width = W * frames; c.height = H;
        const ctx = c.getContext('2d'); R.setSize(W, H, false);
        const ctxObj = {}; const z = S(T, ctxObj) || ctxObj;
        for (let i = 0; i < frames; i++) {
          P(T, z, i);
          const t = z.target || z.mesh?.position;
          T.camera.aspect = W / H; T.camera.fov = 45; T.camera.updateProjectionMatrix();
          T.camera.position.set(t.x + cam[0], t.y + cam[1], t.z + cam[2]); T.camera.lookAt(t.x, t.y + cam[3], t.z);
          const keep = z.obj ? z.obj() : null, hidden = [];
          if (keep) for (const o of T.scene.children) if (o !== keep && !o.isLight && o.visible) { o.visible = false; hidden.push(o); }
          T.scene.updateMatrixWorld(true); R.render(T.scene, T.camera);
          for (const o of hidden) o.visible = true;
          ctx.drawImage(R.domElement, i * W, 0, W, H);
        }
        return c.toDataURL('image/png');
      }, [setup, step, frames, cam]);
      fs.writeFileSync(path.join(out, `anim-${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    };
    for (const type of agents) {
      // spawn → hit from the front → killing blow from the left; step the corpse until it is disposed
      const res = await page.evaluate(([type]) => {
        const T = window.__anTest; T.clear();
        const z = T.spawnAgent(type); z.thinkTimer = 99;
        z.mesh.position.set(0, z.mesh.position.y, 0);
        for (let i = 0; i < 10; i++) T.updateZombies(1 / 60);
        const p = z.mesh.position, before = z.mesh.rotation.x;
        T.damageZombie(z, 5, p.clone().add(new T.THREE.Vector3(Math.sin(z.mesh.rotation.y), 0, Math.cos(z.mesh.rotation.y))));
        let peak = 0; for (let i = 0; i < 12; i++) { T.updateZombies(1 / 60); peak = Math.max(peak, Math.abs(z.juice.x) + Math.abs(z.juice.z)); }
        T.damageZombie(z, 1e6, p.clone().add(new T.THREE.Vector3(-1, 0, 0)));
        T.updateZombies(1 / 60);
        const corpse = T.corpses.length;
        for (let i = 0; i < 300; i++) T.updateAgentCorpses(1 / 60);
        return { peak, corpse, left: T.corpses.length, alive: T.zombies.length, joints: (z.limp||[]).map(l=>l.kind).join('') .length, kinds: [...new Set((z.limp||[]).map(l=>l.kind))].join('/') };
      }, [type]);
      console.log(type, JSON.stringify(res));
      assert.ok(res.peak > 0.02, `${type} flinches`);
      assert.equal(res.alive, 0, `${type} removed from the zombie list`);
      assert.equal(res.corpse, type === 'allStar' ? 0 : 1, `${type} leaves a corpse`);
      assert.equal(res.left, 0, `${type} corpse disposed`);
      if (type !== 'allStar') assert.ok(res.kinds.includes('head') && res.kinds.includes('arm'), `${type} has limp head + arm joints`);
      if (type !== 'allStar') await strip(`death-${type}`, `const z=T.spawnAgent('${type}');z.thinkTimer=99;z.mesh.position.set(0,60+z.mesh.position.y-z.mesh.position.y,0);
          for(let i=0;i<40;i++)T.updateZombies(1/60);const t=z.mesh.position.clone();T.damageZombie(z,1e6,t.clone().add(new T.THREE.Vector3(-1,0,0)));T.updateZombies(1/60);return {target:t,obj:()=>T.corpses[0]?.g};`,
        `for(let k=0;k<(i?9:1);k++)T.updateAgentCorpses(1/60);`, 6, [4.5, 2.5, 5.5, -0.8]);
    }
    // Hero gesture + downed filmstrips (the hero is isolated in the render; 'kind' per class from CONFIG.juice)
    const types = await page.evaluate(() => window.__anTest.heroes.map(h => h.type));
    for (const [i, type] of types.entries()) {
      for (const kind of ['throw', 'plant', 'cast', 'root']) {
        await strip(`gesture-${type}-${kind}`, `const h=T.heroes[${i}];h.mesh.position.set(0,80,0);h.yaw=0;h.mesh.rotation.y=0;h.vel.set(0,0,0);h.onGround=true;
          h.anim.gesture={kind:'${kind}',t:0,dur:0.5};return {target:h.mesh.position.clone(),obj:()=>h.mesh,h};`,
          `for(let k=0;k<(i?6:1);k++){z.h.plant.animate(z.h,1/60);T.heroJuice(z.h,1/60);}`, 5, [3.2, 0.6, -3.2, -0.2]);
      }
    }
    await strip('downed', `const h=T.heroes[0];T.respawnHero(h);for(let k=0;k<60;k++){h.plant.animate(h,1/60);T.heroJuice(h,1/60);}
      h.mesh.position.set(0,80,0);T.damageHero(h,1e6);return {target:h.mesh.position.clone(),obj:()=>h.mesh,h};`,
      `for(let k=0;k<(i?7:1);k++){z.h.plant.animate(z.h,1/60);T.heroJuice(z.h,1/60);}`, 6, [4, 0.8, 0, -0.6]);
    // Heroes: downed topple + bounce, respawn pop
    const heroRes = await page.evaluate(() => {
      const T = window.__anTest, h = T.heroes[0], a = [];
      T.damageHero(h, 1e6);
      for (let i = 0; i < 90; i++) { h.plant.animate(h, 1 / 60); T.heroJuice(h, 1 / 60); a.push(h.corn.root.rotation.x); }
      T.respawnHero(h);
      const s = [];
      for (let i = 0; i < 60; i++) { h.plant.animate(h, 1 / 60); T.heroJuice(h, 1 / 60); s.push(h.corn.root.scale.y); }
      return { maxFall: Math.max(...a), end: a[a.length - 1], minPop: Math.min(...s), maxPop: Math.max(...s), endPop: s[s.length - 1] };
    });
    console.log('hero', JSON.stringify(heroRes));
    assert.ok(Math.abs(heroRes.end - 1.45) < 0.02, 'downed hero lies flat');
    assert.ok(heroRes.minPop < 0.5 && heroRes.maxPop > 1.02 && Math.abs(heroRes.endPop - 1) < 0.05, 'respawn pops in with overshoot');
    assert.deepEqual(errors, []);
    console.log('animation checks passed');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
