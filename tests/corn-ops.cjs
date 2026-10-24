// Browser regression scenarios for Corn's companion decisions. No game dependencies are mocked.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const expose = `window.__cornTest = { THREE, resetBrain, pickTarget, thinkTeammate, driveTeammate,
  updateHero, animateCorn, respawnHero, shotClear, walkable, PLAYER_CENTER_Y, renderer };`;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/loop\(\);\s*<\/script>\s*<\/body>/, expose + '</script></body>');
assert.ok(html.includes(expose), 'test hook must replace the animation loop');
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
    page.on('requestfailed', req => console.error('Request failed:', req.url(), req.failure()?.errorText));
    await page.addInitScript(() => {
      window.addEventListener('error', e => { window.__cornLoadingError = e.message; });
      let seed = 4567;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__cornTest || window.__cornLoadingError, null, { timeout: 60000 });
    assert.deepEqual(errors, [], 'game module must finish loading');
    const report = await page.evaluate(() => {
      const g = window.__game, t = window.__cornTest, V = t.THREE.Vector3;
      if (g.configureSquad) g.configureSquad(['corn', 'corn']);
      const h = g.mate, TM = g.CONFIG.TEAMMATE_AI, results = {};
      const setup = (x = 8, z = 8) => {
        for (const enemy of g.zombies) g.scene.remove(enemy.mesh);
        g.zombies.splice(0);
        t.respawnHero(h); t.resetBrain(h);
        h.mesh.position.set(x, g.heightAt(x, z) + t.PLAYER_CENTER_Y, z);
        h.yaw = 0; h.mesh.rotation.y = 0; h.onGround = true;
        h.brain.aimYaw = 0; h.brain.thinkT = 0;
        h.brain.lastPos.copy(h.mesh.position);
        for (const key of Object.keys(h.cd)) h.cd[key] = 10000;
        t.animateCorn(h, 0);
      };
      const zombie = (x, z, type = 'shambler') => {
        const enemy = g.spawnZombie(type);
        enemy.mesh.position.set(x, g.heightAt(x, z) + enemy.def.radius + enemy.def.height / 2, z);
        return enemy;
      };
      const drive = (frames, move = false) => {
        for (let i = 0; i < frames; i++) {
          t.driveTeammate(h, 1 / 60);
          if (move) { t.updateHero(h, 1 / 60); t.animateCorn(h, 1 / 60); }
        }
      };
      setup();
      const ordinary = zombie(8, -6), boss = zombie(8, -14, 'miniBoss');
      t.pickTarget(h);
      results.bossFirst = h.brain.target === boss;
      boss.dead = true; t.pickTarget(h); boss.dead = false;
      h.brain.retargetT = 100; t.pickTarget(h);
      results.bossInterrupts = h.brain.target === boss;
      const swarm = [[7, 6], [9, 6], [7, 10], [9, 10]].map(p => zombie(...p));
      t.pickTarget(h);
      results.swarmFirst = swarm.includes(h.brain.target) && h.brain.overwhelmed;
      swarm.forEach(enemy => { enemy.dead = true; });
      for (let i = 0; i < 20; i++) t.thinkTeammate(h, 0.1);
      results.bossResumes = h.brain.target === boss && !h.brain.overwhelmed;
      h.hp = 1; t.thinkTeammate(h, 0.1);
      results.lowHealthFights = ['engage', 'reposition'].includes(h.brain.state) && h.brain.target === boss;
      results.bossGoal = h.brain.goalKind;

      setup();
      const first = zombie(8, -6), next = zombie(8.3, -6.3);
      drive(100); first.dead = true; h.brain.thinkT = 0.09;
      t.driveTeammate(h, 1 / 60);
      results.smoothHandoff = h.brain.target === next && h.brain.reactT <= 0 && h.input.fire;
      next.buried = true; t.driveTeammate(h, 1 / 60);
      results.noBuriedFire = !h.input.fire && h.brain.target !== next;

      setup();
      const remembered = zombie(8, -6);
      t.pickTarget(h);
      const seen = h.brain.lastSeen.clone();
      let hidden = false;
      for (let x = -50; x <= 50 && !hidden; x += 4) for (let z = -50; z <= 50 && !hidden; z += 4) {
        remembered.mesh.position.set(x, g.heightAt(x, z) + remembered.def.radius + remembered.def.height / 2, z);
        const eye = h.mesh.position.clone().setY(h.mesh.position.y - 0.55);
        hidden = Math.hypot(x - 8, z - 8) > TM.hearingRange && !t.shotClear(eye, remembered.mesh.position);
      }
      if (!hidden) throw Error('No occluded memory test position found');
      t.thinkTeammate(h, 0.1); drive(5);
      results.searchesLastSeen = h.brain.target === remembered && h.brain.state === 'reposition' &&
        h.brain.lastSeen.distanceTo(seen) < 1e-8 && !h.input.fire && !h.input.shuck && !h.input.butter;
      for (let i = 0; i < Math.ceil(TM.targetMemory * TM.thinkRate) + 2; i++) t.thinkTeammate(h, 1 / TM.thinkRate);
      results.memoryExpires = h.brain.target === null;

      // Find a reachable clear arena beyond the old 65 m statue leash.
      let arena;
      for (let x = -140; x < 140 && !arena; x += 10) for (let z = -140; z < 140 && !arena; z += 10) {
        if (Math.hypot(x, z) < 90) continue;
        const p = new V(x, g.heightAt(x, z) + t.PLAYER_CENTER_Y, z);
        const q = new V(x, g.heightAt(x, z - 20) + 2, z - 20);
        if (Number.isFinite(g.STATUE_FIELD[g.NAV.cellOf(x, z)]) && t.walkable(p, q) &&
            t.shotClear(p.clone().setY(p.y - 0.55), q)) arena = [x, z];
      }
      if (!arena) throw Error('No outer arena found');
      setup(...arena);
      const outerBoss = zombie(arena[0], arena[1] - 20, 'miniBoss');
      t.thinkTeammate(h, 0.1);
      results.outerPursuit = h.brain.target === outerBoss && h.brain.goalKind !== 'leash' && h.brain.state === 'engage';
      h.cd.shuckShot = 0;
      let shuck = false;
      for (let i = 0; i < 100; i++) { drive(1); shuck ||= h.input.shuck; }
      results.shuckBoss = shuck;
      h.cd.shuckShot = 10000; h.cd.butterBarrage = 0;
      let butter = false;
      for (let i = 0; i < 20; i++) { drive(1); butter ||= !!h.input.butter; }
      results.outerButter = butter;

      setup();
      zombie(8, 2, 'miniBoss'); h.cd.huskHop = 0;
      let hop = false, forward = false;
      for (let i = 0; i < 100 && !hop; i++) {
        drive(1); hop ||= h.input.hop;
        if (h.brain.pendingHop) forward ||= h.brain.pendingHop.dir.z < 0;
      }
      results.offensiveHop = hop && forward;
      setup();
      for (const key of Object.keys(h.cd)) h.cd[key] = 0;
      let idleAbility = false;
      for (let i = 0; i < 120; i++) { drive(1); idleAbility ||= h.input.shuck || h.input.hop || !!h.input.butter; }
      results.noIdleAbilities = !idleAbility;
      results.patrolMoves = h.input.move.lengthSq() > 0 && h.brain.goalKind === 'patrol';
      // Exercise the real movement / collision pipeline while pursuing and firing.
      setup(); zombie(8, -26, 'miniBoss');
      drive(180, true);
      results.finiteSimulation = [...h.mesh.position, ...h.vel].every(Number.isFinite);
      results.aliveAfterMovement = !h.dead;
      t.renderer.render(g.scene, g.camera);
      return results;
    });
    console.log(JSON.stringify(report, null, 2));
    assert.deepEqual(errors, [], 'browser runtime errors');
    for (const [name, value] of Object.entries(report)) {
      if (typeof value === 'boolean') assert.equal(value, true, name);
    }
    console.log('Kernel Corn Ops scenarios passed; no browser errors.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
