// One boot, simulated time: real weapon damage/reloads/heat, long-range beams, cover, bosses and melee throughput.
// --baseline measures HEAD's implementation for the balance audit, without applying the new regression bounds.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'), baseline = process.argv.includes('--baseline');
const source = baseline ? execFileSync('git', ['show', 'HEAD:index.html'], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 })
  : fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__balance = { THREE, resetGame, respawnHero, newInput, updateHero, updateProjectiles, updateSunflowerWorld,
  updateNewPlantWorld, updateCactusWorld, damageZombie, fireOrangeBeam, drawCitronBeam, rayZombie, resolveBite, devour,
  healHero, updateSunflower, solidAt, raycastWorld, getAimPoint, updateZombies, updateEnemyProjectiles, updateEffects, updateParticles,
  updateRockets, updateBarrages, updateBeanBombs, updateGardenAlert, aiRootedWatchdog, aiUnstick, heroJuice,
  clear(){for(const z of zombies){z.parts.dispose?.();scene.remove(z.mesh);}zombies=[];state.spawnQueue=[];
    clearNewPlantWorld();for(const list of [projectiles,sunPulses,cactusShots]){for(const p of list)scene.remove(p.mesh);list.length=0;}}
};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose));
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      let seed = 127;
      Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__balance, null, { timeout: 90000 });
    const result = await page.evaluate(isBaseline => {
      const g = window.__game, T = window.__balance, V = T.THREE.Vector3, dt = 1 / 60, report = { primary: {}, bosses: {} };
      // Elevated fixtures avoid map terrain/props, keeping real muzzle transforms and collision capsules.
      const setup = type => {
        T.clear(); g.configureSquad([type]); const h = g.heroes[0]; T.respawnHero(h);
        g.state.phase = 'active'; g.state.over = false; h.isAI = true;
        h.mesh.position.set(60, 80, 60); h.stats.gravity = 0; h.vel.set(0, 0, 0);
        h.yaw = 0; h.mesh.rotation.y = 0; h.input = T.newInput(); h.input.yaw = 0;
        h.weapon.spread = h.weapon.aimSpread = h.weapon.bloomPerShot = h.weapon.bloomMax = 0;
        h.plant.animate(h, 0); h.mesh.updateMatrixWorld(true);
        return h;
      };
      const target = (h, distance, hp = 20000, type = 'shambler') => {
        const z = g.spawnZombie(type); z.def = { ...z.def, hp }; z.hp = hp;
        z.mesh.position.copy(h.mesh.position).add(new V(0, 0, -distance)); z.mesh.rotation.y = 0;
        z.ai.armor = 0; return z;
      };
      const step = h => {
        g.state.time += dt; T.updateHero(h, dt); h.plant.animate(h, dt); h.mesh.updateMatrixWorld(true);
        T.updateProjectiles(dt); T.updateSunflowerWorld(dt); T.updateNewPlantWorld(dt); T.updateCactusWorld(dt);
      };
      for (const type of ['corn', 'peashooter', 'sunflower', 'cactus', 'citron', 'rose', 'chomper']) {
        const h = setup(type), z = target(h, type === 'chomper' ? 2.8 : 20);
        h.input.fire = true;
        for (let i = 0; i < 720; i++) { h.input.aimPoint.copy(z.mesh.position); step(h); }
        report.primary[type] = { damage: 20000 - z.hp, dps: +( (20000 - z.hp) / 12).toFixed(1), hp: h.stats.hp };
        // Current bosses use body reduction, not the unused legacy shell gate. Every primary can hurt them.
        const boss = target(h, 10, 20000, 'finalBoss');
        T.damageZombie(boss, h.weapon.damage, boss.mesh.position.clone(), false, false, h);
        report.bosses[type] = boss.hp < 20000;
      }
      if (isBaseline) return report;
      let h = setup('citron'), z = target(h, 180), farther = target(h, 200);
      h.aimPoint.copy(z.mesh.position); h.input.fire = true;
      T.fireOrangeBeam(h); T.drawCitronBeam(h, dt);
      report.citronFar = { damage: 20000 - z.hp, behindDamage: 20000 - farther.hp,
        rendered: h.cit.beam.core.scale.z, falseImpact: h.cit.beam.impact.visible, heat: h.cit.heat };
      // The human camera/reticle must also converge beyond the old 150 m aim plane (shoulder parallax).
      g.camera.position.set(64, 81, 65); g.camera.lookAt(z.mesh.position); g.camera.updateMatrixWorld(true);
      h.aimPoint.copy(T.getAimPoint()); const farHp = z.hp; T.fireOrangeBeam(h);
      report.citronHumanAim = farHp - z.hp;
      // Diagonal from one map corner to the other: far beyond the visible beam and ordinary engagement ranges.
      h = setup('citron'); h.mesh.position.set(-210, 80, -210); z = target(h, 1); z.mesh.position.set(210, 80, 210);
      h.plant.animate(h, 0); h.mesh.updateMatrixWorld(true); h.aimPoint.copy(z.mesh.position);
      T.fireOrangeBeam(h); report.citronDiagonal = 20000 - z.hp;
      // Point a beam into real ground: the ray must report the world before the capsule behind it.
      T.clear(); z = g.spawnZombie('shambler'); z.mesh.position.set(60, -20, 60);
      const start = new V(60, 30, 60), dir = new V(0, -1, 0), trace = T.rayZombie(start, dir, Infinity, 0.16);
      report.cover = !trace.victim && trace.distance < 50 && Number.isFinite(trace.distance);
      report.emptyRay = Number.isFinite(T.rayZombie(new V(60, 80, 60), new V(0, 1, 0), Infinity).distance);
      // Real map obstacle between the muzzle and a distant target must block the damage tick too.
      h = setup('citron'); h.aimPoint.set(60, -20, 60); z = target(h, 1); z.mesh.position.set(60, -20, 60);
      T.fireOrangeBeam(h); report.coverDamage = 20000 - z.hp;
      // Chomper clears a basic zombie in one frontal bite; chewing doesn't stall the next meal for several seconds.
      h = setup('chomper'); z = target(h, 2.8, 50); T.resolveBite(h);
      report.chompFront = { dead: z.dead, chewing: h.chomp.chew };
      z = target(h, 2.8, 150); h.hp = 80; T.devour(h, z);
      report.chompMeal = { chew: h.chomp.chew, healed: h.hp - 80, speed: h.weapon.chewSpeed };
      h = setup('sunflower'); const before = h.hp; h.hp -= 50;
      T.healHero(h, h.abilities.shuckShot.rate, h); report.healPerSecond = h.hp - (before - 50);
      // Rose's untracked thistle still travels beyond the previous ~67 m lifetime cutoff.
      h = setup('rose'); z = target(h, 110); h.input.fire = true;
      for (let i = 0; i < 150; i++) { h.input.aimPoint.copy(z.mesh.position); step(h); }
      report.roseFar = 20000 - z.hp;
      // Solo AI brawl per class: movement, targeting, abilities, incoming damage and healing all run normally.
      report.bots = {};
      for (const type of Object.keys(report.primary)) {
        let seed = 127;
        Math.random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
        T.clear(); g.configureSquad([type]); T.resetGame();
        h = g.heroes[0]; h.isAI = true; h.mesh.position.set(10, g.heightAt(10, 8) + h.centerY, 8);
        g.state.phase = 'active'; g.state.waveTimer = 999; g.state.spawnQueue = [];
        for (let i = 0; i < 12; i++) {
          const z = g.spawnZombie(i % 5 === 0 ? 'plated' : i % 3 === 0 ? 'sprinter' : 'shambler');
          const x = -8 + i * 2.5, zz = -12 - i % 3 * 3;
          z.mesh.position.set(x, g.heightAt(x, zz) + z.def.radius + z.def.height / 2, zz);
        }
        for (let i = 0; i < 1440; i++) {
          g.state.time += dt; T.updateGardenAlert(dt); h.plant.drive(h, dt); T.aiRootedWatchdog(h, dt); T.aiUnstick(h, dt); T.updateHero(h, dt);
          T.updateZombies(dt); T.updateProjectiles(dt); T.updateEnemyProjectiles(dt);
          T.updateRockets(dt); T.updateBarrages(dt); T.updateBeanBombs(dt);
          T.updateSunflowerWorld(dt); T.updateNewPlantWorld(dt); T.updateCactusWorld(dt);
          T.updateEffects(dt); T.updateParticles(dt); h.plant.animate(h, dt); T.heroJuice(h, dt); h.mesh.updateMatrixWorld(true);
        }
        const stats = g.state.stats.match[0];
        report.bots[type] = { kills: stats.kills, damage: Math.round(stats.damage), hp: Math.round(h.hp), dead: h.dead };
      }
      return report;
    }, baseline);
    console.log(JSON.stringify(result, null, 2));
    assert.deepEqual(errors, [], 'no browser errors');
    if (!baseline) {
      for (const [type, r] of Object.entries(result.primary)) assert.ok(r.dps >= 45 && r.dps <= 115, `${type} has useful sustained primary damage without dominating`);
      assert.ok(Object.values(result.bosses).every(Boolean), 'every plant primary can damage the current boss roster');
      assert.ok(result.citronFar.damage > 0 && result.citronDiagonal > 0 && result.citronHumanAim > 0, 'Citron hits beyond visible length, including human camera aim and the full map diagonal');
      assert.equal(result.citronFar.behindDamage, 0, 'Citron stops at the first enemy');
      assert.ok(result.citronFar.rendered <= 58 && !result.citronFar.falseImpact, 'short visual beam has no fake impact at its cutoff');
      assert.ok(result.cover && result.emptyRay && result.coverDamage === 0, 'unlimited traces respect cover and terminate on empty sky');
      assert.ok(result.chompFront.dead && result.chompFront.chewing === 0, 'one frontal bite clears a basic zombie');
      assert.ok(result.chompMeal.chew <= 1.8 && result.chompMeal.healed >= 25, 'swallow has short downtime and meaningful sustain');
      assert.ok(result.healPerSecond >= 14 && result.roseFar > 0, 'support kits retain useful healing and distant fire');
      for (const [type, bot] of Object.entries(result.bots)) assert.ok(bot.damage >= 500 && bot.kills >= 6 && !bot.dead, `${type} AI survives and contributes in a solo mixed-horde fight`);
    }
    console.log(`PASS ${baseline ? 'baseline audit' : 'roster balance and range regressions'}`);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
