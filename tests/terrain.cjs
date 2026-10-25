// Terrain + nav checks (sections "THE MAP", "Nav grid + flow fields", "Zombie routing"): every ramp is a smooth walk
// from its plateau edge to the ground (no lip), every raised area a ramp serves is on the statue's nav network,
// nav steps work both ways, ledges (cliff tops, ramp sides) are marked and routes keep off them, a hero can walk
// A* paths all over the map without jumping, and zombies are never shoved off a ledge (knockback still throws them).
const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const expose = 'window.__terrainTest = { updateHero, updateZombies, constrainZombie, MAP };';
const html = source.replace(/\nloop\(\);\s*<\/script>/, '\n' + expose + '\n</script>');
assert.ok(html.includes(expose), 'test hooks must replace the animation loop');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`, { timeout: 60000 });
    await page.waitForFunction(() => window.__terrainTest, null, { timeout: 180000 });
    const out = await page.evaluate(() => {
      const g = __game, T = __terrainTest, M = T.MAP, H = g.heightAt, NAV = g.NAV, { N, cx, pass, open, ledge, DIRS } = NAV;
      const F = g.STATUE_FIELD, out = { checks: [] };
      const check = (ok, label) => { if (!ok) throw new Error(label); out.checks.push(label); };
      let seed = 7;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const cell = (x, z) => NAV.cellOf(x, z);

      // 1. Ramps: smooth from 4 m inside the plateau to 4 m past the foot, both ends on the statue's network
      out.ramps = M.ramps.map(r => {
        const [x0, z0] = r.from, [x1, z1] = r.to, len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
        let worst = 0, prev = null;
        for (let s = -4; s <= len + 4; s += 0.25) {
          const h = H(x0 + ux * s, z0 + uz * s);
          if (prev !== null) worst = Math.max(worst, Math.abs(h - prev) / 0.25);
          prev = h;
        }
        const top = F[cell(x0 - ux * 3, z0 - uz * 3)], foot = F[cell(x1 + ux * 3, z1 + uz * 3)];
        check(worst <= M.maxSlope, `${r.name}: no lip, steepest ${worst.toFixed(2)} ≤ ${M.maxSlope}`);
        check(isFinite(top) && isFinite(foot), `${r.name}: top and foot on the statue's nav network`);
        // across the middle: the center is no ledge, the sides are
        const mx = x0 + ux * len / 2, mz = z0 + uz * len / 2, sx = -uz, sz = ux, w = r.width / 2 - 0.5;
        check(!ledge[cell(mx, mz)] && ledge[cell(mx + sx * w, mz + sz * w)] && ledge[cell(mx - sx * w, mz - sz * w)],
          `${r.name}: sides are ledges, the middle is not`);
        return { name: r.name, worst: +worst.toFixed(2), top: Math.round(top), foot: Math.round(foot) };
      });

      // 2. Nav steps are symmetric (a route down is a route back up)
      let asym = 0;
      const REV = [1, 0, 3, 2, 7, 6, 5, 4];
      for (let k = 0; k < N * N; k++) if (open[k]) for (let b = 0; b < 8; b++) {
        const n = k + DIRS[b][1] * N + DIRS[b][0];
        if ((pass[k] >> b & 1) !== (pass[n] >> REV[b] & 1)) asym++;
      }
      check(asym === 0, `nav steps are symmetric (${asym} one-way)`);

      // 3. A hero walks A* paths across the map (incl. down from the Rampart, Windmill Ridge and Quarry Top) without
      //    jumping, and the waypoints keep off ledges on the ramps
      g.configureSquad(['corn']);
      const h = g.player, dt = 1 / 60, fails = [], goals = [];
      while (goals.length < 10) {
        const k = Math.floor(rnd() * N * N);
        if (open[k] && isFinite(F[k]) && !ledge[k]) goals.push([cx(k % N), cx(Math.floor(k / N))]);
      }
      const starts = [[16, 16], [-30, 80], [55, 90], [-26, -140], [-76, -12], [0, -190], [-140, -20]];
      const walk = (sx, sz, gx, gz) => {
        h.mesh.position.set(sx, g.groundAt(sx, sz) + h.centerY, sz); h.vel.set(0, 0, 0); h.onGround = true;
        const pts = g.findPath(h.mesh.position, { x: gx, z: gz });
        if (!pts) return 'no path';
        let t = 0, last = h.mesh.position.clone(), still = 0;
        while (t < 90) {
          while (pts.length > 1 && Math.hypot(h.mesh.position.x - pts[0].x, h.mesh.position.z - pts[0].z) < 1.2) pts.shift();
          const dx = pts[0].x - h.mesh.position.x, dz = pts[0].z - h.mesh.position.z, d = Math.hypot(dx, dz);
          if (pts.length === 1 && d < 1.2) return 'ok';
          h.input.move.set(dx / d, 0, dz / d); h.input.yaw = Math.atan2(-dx, -dz); h.input.fire = h.input.jump = false;
          g.state.time += dt; T.updateHero(h, dt); t += dt;
          if (Math.round(t * 60) % 60 === 0) {
            still = h.mesh.position.distanceTo(last) < 0.5 ? still + 1 : 0;
            last.copy(h.mesh.position);
            if (still >= 3) return `stuck at ${h.mesh.position.x.toFixed(1)},${h.mesh.position.z.toFixed(1)}`;
          }
        }
        return 'timeout';
      };
      let walks = 0;
      for (const [sx, sz] of starts) for (const [gx, gz] of goals) {
        walks++;
        const r = walk(sx, sz, gx, gz);
        if (r !== 'ok') fails.push(`${sx},${sz} → ${gx},${gz}: ${r}`);
      }
      out.heroFails = fails;
      check(fails.length === 0, `a hero walks ${walks} A* paths without jumping (${fails.length} failed)`);
      for (const r of M.ramps) {
        const [x0, z0] = r.from, [x1, z1] = r.to, len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
        const foot = { x: x1 + ux * 6, z: z1 + uz * 6 }, top = { x: x0 - ux * 6, z: z0 - uz * 6 };
        check(walk(foot.x, foot.z, top.x, top.z) === 'ok' && walk(top.x, top.z, foot.x, foot.z) === 'ok', `${r.name}: walked up and down`);
        const path = g.findPath(new g.camera.position.constructor(foot.x, 0, foot.z), top);
        check(path && path.every(p => !ledge[cell(p.x, p.z)]), `${r.name}: A* waypoints keep off its sides`);
      }

      // 4. Zombies: a shove toward a ramp side or over a cliff top is refused; knockback still throws them off
      g.state.phase = 'active'; g.state.statueHp = 1e9; for (const hh of g.heroes) hh.active = false;
      const shove = (x, z, dx, dz, kb) => {
        const zb = g.spawnZombie('shambler', 'climb'), p = zb.mesh.position;
        p.set(x, H(x, z) + 1, z);
        let lowest = H(x, z);
        for (let i = 0; i < 20; i++) {
          zb.prevX = p.x; zb.prevZ = p.z;
          p.x += dx; p.z += dz;
          if (kb) zb.kb.set(dx * 30, 0, dz * 30); else zb.kb.set(0, 0, 0);
          T.constrainZombie(zb, 1 / 30);
          lowest = Math.min(lowest, H(p.x, p.z));
        }
        zb.dead = true;
        return H(x, z) - lowest;
      };
      const qw = M.ramps.find(r => r.name === 'Quarry Ramp W');
      check(shove(qw.from[0] + 3.5, 50, 0.25, 0, false) < 0.3, 'crowd shove toward the ramp side: stays on the ramp');
      check(shove(10, 62, 0, -0.25, false) < 0.3, 'crowd shove over the Quarry Top cliff: stays on top');
      check(shove(10, 62, 0, -0.25, true) > 3, 'knockback over the Quarry Top cliff: falls off');
      g.zombies.forEach(z => z.dead = true); T.updateZombies(1 / 30);

      // 5. A horde from every area marches in: no zombie drops off a ledge on its own
      for (const a of Object.keys(g.CONFIG.SPAWN_POINTS)) for (let i = 0; i < 20; i++) g.spawnZombie(i % 4 ? 'shambler' : 'sprinter', a);
      const zs = g.zombies.slice(), prevY = new Map(zs.map(z => [z, z.mesh.position.y])), prevP = new Map(zs.map(z => [z, z.mesh.position.clone()])), drops = [];
      for (let f = 0; f < 30 * 60; f++) {
        g.state.time += 1 / 30; T.updateZombies(1 / 30);
        for (const z of zs) {
          if (z.dead) continue;
          const y = z.mesh.position.y;
          if (prevY.get(z) - y > 1 && !z.def.canClimb) drops.push(`${z.type} at ${z.mesh.position.x.toFixed(1)},${z.mesh.position.z.toFixed(1)} −${(prevY.get(z) - y).toFixed(1)} m lift ${(z.lift || 0).toFixed(2)} kb ${z.kb.length().toFixed(2)} from ${prevP.get(z).x.toFixed(1)},${prevP.get(z).z.toFixed(1)} mode ${z.mode}`);
          prevY.set(z, y); prevP.get(z).copy(z.mesh.position);
        }
      }
      out.drops = drops;
      // …and the ones from Quarry Top, held back from its cliff, still find the ramps down
      const high = zs.filter(z => !z.dead && z.mesh.position.z > 62 && H(z.mesh.position.x, z.mesh.position.z) > 7.5);
      out.stillOnQuarryTop = high.length;
      check(high.length <= 2, `Quarry Top zombies walk down the ramps (${high.length} of 20 still up after 60 s)`);
      // Mounds are walkable slopes, not ledges
      for (const p of M.plateaus.filter(p => p.r !== undefined))
        check(!ledge[cell(p.x + p.r + p.edge / 2, p.z)] && !ledge[cell(p.x, p.z - p.r - p.edge / 2)], `${p.name}: its slopes are no ledge`);
      check(drops.length === 0, `marching horde: no zombie walks off a ledge (${drops.length}: ${drops.join("; ")})`);
      return out;
    });
    for (const c of out.checks) console.log('✓', c);
    console.log(JSON.stringify({ ramps: out.ramps }, null, 0));
    if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
    console.log('terrain: all checks passed');
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally { if (browser) await browser.close(); server.close(); }
})();
