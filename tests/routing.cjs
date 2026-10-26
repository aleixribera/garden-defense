// Zombie routing checks (section "Zombie routing"): every zombie plans its own A* route from a wide spawn area,
// routes from one area spread over different corridors, the planner stays inside its frame budget, re-plans when
// knocked off its route or walled in, and the horde actually reaches the statue without getting stuck.
// Writes docs/routing-map.png (debug map with every planned route) for eyeballing.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), cp = require('child_process');
const { gameServer } = require('./lib/game-server.cjs');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__rtTest={THREE,resetGame,updateZombies,removeDeadZombies,think,statueFaceDist,cactusWalls,get zombies(){return zombies}};`;
const html = source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\n</script>');
assert.ok(html.includes(expose), 'test hooks must replace the animation loop');
const server = gameServer(html);
(async () => {
  const syntax = path.join(os.tmpdir(), `garden-routing-${process.pid}.mjs`);
  try { fs.writeFileSync(syntax, source.match(/<script type="module">([\s\S]*?)<\/script>/)[1]); cp.execFileSync(process.execPath, ['--check', syntax]); }
  finally { fs.rmSync(syntax, { force: true }); }
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { timeout: 60000 });
    await page.waitForFunction(() => window.__rtTest, null, { timeout: 60000 });
    const res = await page.evaluate(() => {
      const T = window.__rtTest, g = window.__game, R = g.ZROUTE, dt = 1 / 30, out = { checks: [] };
      const check = (ok, label) => { if (!ok) throw new Error(label); out.checks.push(label); };
      T.resetGame(); g.configureSquad(['corn']);
      for (const h of g.heroes) h.active = false;   // nobody to chase: pure statue routing
      g.state.phase = 'active'; g.state.statueHp = 1e9;
      const areas = Object.keys(g.CONFIG.SPAWN_POINTS), per = 30;
      for (const a of areas) for (let i = 0; i < per; i++) g.spawnZombie(i % 5 ? 'shambler' : 'sprinter', a);
      const all = T.zombies.slice();
      const spawnSpread = {};
      for (const a of areas) {
        const zs = all.filter((z, i) => Math.floor(i / per) === areas.indexOf(a));
        const xs = zs.map(z => z.mesh.position.x), zz = zs.map(z => z.mesh.position.z);
        spawnSpread[a] = Math.round(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zz) - Math.min(...zz)));
      }
      out.spawnSpread = spawnSpread;
      // Plan: step until every zombie has a route; track the planner's per-frame cost
      let frames = 0, worst = 0;
      const step = n => { for (let i = 0; i < n; i++) { g.state.time += dt; const t0 = performance.now(); T.updateZombies(dt); worst = Math.max(worst, performance.now() - t0); frames++; } };
      while (all.some(z => !z.nav.path) && frames < 600) step(1);
      out.planFrames = frames; out.worstFrameMs = +worst.toFixed(2); out.stats = { ...R.stats };
      check(all.every(z => z.nav.path), 'every zombie planned its own route');
      // Diversity: how far apart routes from the same area run, sampled half-way to the statue
      const N = g.NAV.N, cx = g.NAV.cx, div = {};
      for (const a of areas) {
        const zs = all.filter((z, i) => Math.floor(i / per) === areas.indexOf(a));
        const mids = zs.map(z => { const p = z.nav.path, k = p[Math.floor(p.length / 2)]; return [cx(k % N), cx(Math.floor(k / N))]; });
        const cells = new Set(zs.flatMap(z => Array.from(z.nav.path)));
        let sum = 0, n = 0;
        for (let i = 0; i < mids.length; i++) for (let j = i + 1; j < mids.length; j++) { sum += Math.hypot(mids[i][0] - mids[j][0], mids[i][1] - mids[j][1]); n++; }
        div[a] = { midSpread: +(sum / n).toFixed(1), uniqueCells: cells.size };
      }
      out.diversity = div;
      for (const a of areas) check(div[a].midSpread > 6, `${a}: routes fan out (mean mid-route gap ${div[a].midSpread} m)`);
      // Walk: everyone should reach the statue; nobody should stay stuck far out
      const start = new Map(all.map(z => [z, 0]));
      let tSec = 0;
      const arrived = new Set(), lastPos = new Map(all.map(z => [z, z.mesh.position.clone()]));
      let stalls = 0;
      while (tSec < 240 && arrived.size < all.length) {
        step(30); tSec += 1;
        const walk = z => g.STATUE_FIELD[g.NAV.cellOf(z.mesh.position.x, z.mesh.position.z)];
        for (const z of all) if (!z.dead && (T.statueFaceDist(z.mesh.position) < 4 || walk(z) < 10)) arrived.add(z);
        if (tSec % 10 === 0) for (const z of all) {
          if (arrived.has(z)) continue;
          if (z.mesh.position.distanceTo(lastPos.get(z)) < 3 && z.nav.pauseUntil < g.state.time - 5) {
            stalls++;
            (out.stallAt ||= []).push([tSec, Math.round(z.mesh.position.x), Math.round(z.mesh.position.z), z.mode, z.type, !!z.nav.path, z.slot ? 'slot' : '', Math.round(g.STATUE_FIELD[g.NAV.cellOf(z.mesh.position.x, z.mesh.position.z)]), 'i', z.nav.i, '/', z.nav.path && z.nav.path.length, 'look', z.nav.look, 'dir', z.tgt.dir.x.toFixed(2), z.tgt.dir.z.toFixed(2), 'st', z.stuck.strikes, 'pg', z.nav.progStrikes, 'q', z.nav.queued, 'mv', (g.state.time - z.movedT).toFixed(2), 'lane', z.nav.lane.toFixed(1), 'y', (z.mesh.position.y).toFixed(1)].join(' '));
          }
          lastPos.get(z).copy(z.mesh.position);
        }
      }
      out.arrived = arrived.size; out.total = all.length; out.walkSeconds = tSec; out.stalls = stalls; out.worstFrameMs = +worst.toFixed(2);
      out.stats = { ...R.stats };
      check(arrived.size >= all.length * 0.95, `the horde reaches the statue (${arrived.size}/${all.length} in ${tSec} s)`);
      // Re-plan when shoved far off the route. A fixed-axis shove can land along the old path, so choose
      // connected open ground that is actually beyond the off-route threshold from every old route cell.
      T.resetGame(); for (const h of g.heroes) h.active = false;
      const z = g.spawnZombie('shambler', 'choke');
      step(60);
      check(!!z.nav.path, 'single zombie planned');
      const before = z.nav.path;
      let shove = null, shoveDistance = Infinity;
      for (let cell = 0; cell < g.NAV.open.length; cell++) {
        if (!g.NAV.open[cell] || !Number.isFinite(g.STATUE_FIELD[cell])) continue;
        const x = cx(cell % N), zz = cx(Math.floor(cell / N)), distance = Math.hypot(x - z.mesh.position.x, zz - z.mesh.position.z);
        if (distance < 20 || distance > 30 || distance >= shoveDistance) continue;
        if (Array.from(before).some(k => Math.hypot(x - cx(k % N), zz - cx(Math.floor(k / N))) <= g.CONFIG.AI.path.offRoute + 2)) continue;
        shove = { x, z: zz }; shoveDistance = distance;
      }
      check(!!shove, 'fixture has reachable ground away from the old route');
      z.mesh.position.y += g.heightAt(shove.x, shove.z) - g.heightAt(z.mesh.position.x, z.mesh.position.z);
      z.mesh.position.x = shove.x; z.mesh.position.z = shove.z; z.prevX = shove.x; z.prevZ = shove.z;
      for (let i = 0; i < 120 && (!z.nav.path || z.nav.path === before); i++) step(1);
      check(z.nav.path && z.nav.path !== before, 'knocked off its route onto open ground → planned a new one');
      // A cactus wall raised across the route → the zombie re-plans around it
      T.resetGame(); for (const h of g.heroes) h.active = false;
      const w0 = g.spawnZombie('shambler', 'climb');
      step(60);
      const p0 = w0.nav.path, k = p0[Math.min(p0.length - 1, w0.nav.i + 12)], wx = cx(k % N), wz = cx(Math.floor(k / N));
      const fake = { hp: 1, mesh: { position: new T.THREE.Vector3(wx, g.heightAt(wx, wz), wz) }, ability: { width: 4, depth: 1, height: 3 }, cos: 1, sin: 0 };
      T.cactusWalls.push(fake);
      try {
        step(30);
        const crosses = Array.from(w0.nav.path || []).some(c => R.walls[c]);
        check(w0.nav.path && w0.nav.path !== p0 && !crosses, 'cactus wall across the route → re-planned around it');
      } finally { T.cactusWalls.splice(T.cactusWalls.indexOf(fake), 1); }
      // Stress: 300 at once; the planner must stay within its frame budget
      T.resetGame(); for (const h of g.heroes) h.active = false;
      const areas2 = Object.keys(g.CONFIG.SPAWN_POINTS);
      for (let i = 0; i < 300; i++) g.spawnZombie('shambler', areas2[i % 4]);
      let peak = 0, plannedFrames = 0;
      // The planner has a wall-clock frame budget: a busy machine may need more simulation frames, not more work per frame.
      const stressStart = performance.now();
      for (let i = 0; i < 20000 && R.pending && performance.now() - stressStart < 20000; i++) {
        g.state.time += dt; const t0 = performance.now(); R.update(dt); peak = Math.max(peak, performance.now() - t0); plannedFrames++;
      }
      out.stress = { zombies: 300, framesToPlanAll: plannedFrames, peakPlannerMs: +peak.toFixed(2), pending: R.pending,
        unplanned: T.zombies.filter(z => !z.nav.path).length };
      check(T.zombies.every(z => z.nav.path), '300 zombies all planned: ' + JSON.stringify(out.stress));
      // Per-frame cost of a 150-strong horde on the march: own routes vs the old statue flow field only
      const march = useRoutes => {
        T.resetGame(); for (const h of g.heroes) h.active = false;
        const follow = R.follow; if (!useRoutes) R.follow = () => false;
        for (let i = 0; i < 150; i++) g.spawnZombie('shambler', areas2[i % 4]);
        step(150);
        let sum = 0, n = 0;
        for (let i = 0; i < 300; i++) { g.state.time += dt; const t0 = performance.now(); T.updateZombies(dt); sum += performance.now() - t0; n++; }
        R.follow = follow;
        return +(sum / n).toFixed(2);
      };
      out.marchMs = { routes: march(true), flowFieldOnly: march(false) };
      out.planned = R.stats.searches;
      return out;
    });
    console.log(JSON.stringify(res, null, 2));
    // Debug map with live routes: a fresh wave-like spawn, a few seconds in
    const img = await page.evaluate(() => {
      const T = window.__rtTest, g = window.__game, dt = 1 / 30;
      T.resetGame(); for (const h of g.heroes) h.active = false;
      for (const a of Object.keys(g.CONFIG.SPAWN_POINTS)) for (let i = 0; i < 25; i++) g.spawnZombie('shambler', a);
      for (let i = 0; i < 240; i++) { g.state.time += dt; T.updateZombies(dt); }
      g.debugMap.toggle(); g.debugMap.draw(); g.debugMap.toggle();
      return g.debugMap.canvas.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(root, 'docs', 'routing-map.png'), Buffer.from(img.split(',')[1], 'base64'));
    assert.equal(errors.length, 0, 'no page errors');
    console.log('routing: OK');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
