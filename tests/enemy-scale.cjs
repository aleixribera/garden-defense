// Compare every enemy with the unchanged plant roster in a shared, metre-based studio.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__scaleTest={HORDE_MODELS,hordeKit,updateZombieLook,swapImpDef,IMP_MECH_DEF,boardZMech,
  updateZombieBatches,removeDeadZombies,feetY,mechaPulse,get shots(){return enemyProjectiles},
  get corpses(){return agentCorpses},get gargCorpses(){return gargantuarCorpses}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose));
const server = gameServer(html);
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.stack); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?autoplay`, { timeout: 90000 });
    await page.waitForFunction(() => window.__scaleTest, null, { timeout: 120000 });
    const result = await page.evaluate(() => {
      const g = __game, T = __scaleTest, THREE = g.THREE;
      g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']);
      const bounds = root => {
        root.updateWorldMatrix(true, true);
        const box = new THREE.Box3();
        root.traverseVisible(o => {
          if (!o.isMesh || !o.material.visible || o.material.opacity < 0.9 || o.material.colorWrite === false) return;
          o.geometry.computeBoundingBox();
          box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
        });
        return { height: box.max.y - box.min.y, min: box.min.y, max: box.max.y };
      };
      const plants = g.heroes.map(h => ({ type: h.type, ...bounds(h.corn.root) }));
      const specimens = {};
      const enemies = Object.keys(g.CONFIG.ZOMBIE_TYPES).map(type => {
        const z = g.spawnZombie(type);
        specimens[type] = z;
        z.mesh.position.set(0, z.def.radius + z.def.height / 2, 0); z.mesh.rotation.set(0, 0, 0);
        const measured = T.HORDE_MODELS[type] ? (() => {
          const geo = T.hordeKit(type).mesh.geometry; geo.computeBoundingBox();
          return { height: (geo.boundingBox.max.y - geo.boundingBox.min.y) * z.mesh.scale.y,
            min: z.mesh.position.y + geo.boundingBox.min.y * z.mesh.scale.y };
        })() : bounds(z.mesh);
        const scale = z.mesh.scale.y;
        T.updateZombieLook(z, 0);
        return { type, ...measured, capsule: z.def.radius * 2 + z.def.height, scale,
          afterLook: z.mesh.scale.y, ground: T.feetY(z), expected: g.CONFIG.enemySize[type] * g.player.centerY * 2 };
      });
      T.updateZombieBatches(1 / 60);
      const hordeMatrices = Object.values(specimens).filter(z => z.horde).map(z => {
        const m = new THREE.Matrix4(); z.horde.mesh.getMatrixAt(0, m);
        return { type: z.type, scale: new THREE.Vector3().setFromMatrixScale(m).y, expected: z.def.sizeMult };
      });
      const banner = specimens.banner, ring = banner.mesh.children.find(o => o.geometry?.type === 'CircleGeometry');
      const auraScale = ring.scale.x * banner.mesh.scale.x;
      const station = specimens.healStation, stationAura = station.parts.rig.aura.scale.x * station.def.sizeMult;
      const mecha = specimens.finalBoss, headY = T.feetY(mecha) + g.CONFIG.MECHA.headHeight * mecha.def.sizeMult;
      let hp = mecha.hp;
      g.damageZombie(mecha, 100, new THREE.Vector3(0, headY - 0.01, 0));
      const armorDamage = hp - mecha.hp; hp = mecha.hp;
      g.damageZombie(mecha, 100, new THREE.Vector3(0, headY + 0.01, 0));
      const headDamage = hp - mecha.hp;
      T.mechaPulse(mecha, g.player.mesh.position);
      const muzzleY = T.shots.at(-1).mesh.position.y;
      const imp = specimens.imp, originalFeet = T.feetY(imp);
      g.callZMech(imp);
      const fallingScale = imp.imp.call.rig.root.scale.y;
      T.boardZMech(imp);
      const boarded = { ...bounds(imp.imp.mech.rig.root), scale: imp.mesh.scale.y, feet: T.feetY(imp) };
      const mechRoot = imp.imp.mech.rig.root;
      g.ejectZMech(imp);
      const wreckScale = mechRoot.scale.y, ejectedScale = imp.mesh.scale.y;
      // Corpse reparenting must retain the live scale for both shared agent deaths and the boss's own death rig.
      const deadAgent = specimens.soldier, deadBoss = specimens.miniBoss;
      g.damageZombie(deadAgent, 1e7, deadAgent.mesh.position.clone(), false, true);
      g.damageZombie(deadBoss, 1e7, deadBoss.mesh.position.clone(), false, true);
      T.removeDeadZombies();
      const corpse = T.corpses.find(c => c.z === deadAgent), garg = T.gargCorpses.at(-1);
      return { plants, enemies, hordeMatrices, auraScale, stationAura,
        mecha: { armorDamage, headDamage, muzzleY, expectedMuzzleY: T.feetY(mecha) + 6.04 * mecha.def.sizeMult },
        mech: { fallingScale, boarded, wreckScale, ejectedScale, originalFeet,
        expected: T.IMP_MECH_DEF.sizeMult }, deaths: { agent: corpse.z.mesh.scale.y, boss: garg.mesh.scale.y } };
    });
    const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} ≠ ${b}`);
    const byType = Object.fromEntries(result.enemies.map(e => [e.type, e]));
    for (const e of result.enemies) {
      close(e.capsule, e.expected, `${e.type} plant-relative hitbox`);
      close(e.afterLook, e.scale, `${e.type} animation keeps scale`);
      close(e.ground, 0, `${e.type} ground placement`);
      assert.ok(Number.isFinite(e.height) && e.height > 1 && e.min > -0.25, `${e.type} visible body / feet`);
    }
    const corn = result.plants.find(p => p.type === 'corn').height;
    for (const type of ['shambler', 'soldier', 'pirate', 'mechanic', 'scientist'])
      assert.ok(byType[type].height > corn * 0.9 && byType[type].height < corn * 1.1, `${type} comparable to Corn`);
    assert.ok(byType.imp.height < corn * 0.7, 'Imp stays small');
    assert.ok(byType.allStar.height > corn * 1.2 && byType.superBrainz.height > corn * 1.3, 'bruisers taller than Corn');
    assert.ok(result.mech.boarded.height > byType.superBrainz.height && result.mech.boarded.height < byType.miniBoss.height,
      'Z-Mech fits between bruisers and bosses');
    assert.ok(byType.finalBoss.height > byType.miniBoss.height * 1.25, 'boss hierarchy');
    close(result.mech.fallingScale, result.mech.expected, 'falling mech');
    close(result.mech.boarded.scale, result.mech.expected, 'boarded mech');
    close(result.mech.boarded.feet, result.mech.originalFeet, 'boarding keeps feet');
    close(result.mech.wreckScale, result.mech.expected, 'ejected wreck');
    close(result.mech.ejectedScale, byType.imp.scale, 'ejected Imp');
    close(result.deaths.agent, byType.soldier.scale, 'agent corpse');
    close(result.deaths.boss, byType.miniBoss.scale, 'Gargantuar corpse');
    result.hordeMatrices.forEach(e => close(e.scale, e.expected, `${e.type} rendered instance scale`));
    close(result.auraScale, 1, 'banner range stays in world metres');
    close(result.stationAura, 7 * 0.92, 'station range stays in world metres');
    assert.equal(result.mecha.armorDamage, 35); assert.equal(result.mecha.headDamage, 100);
    close(result.mecha.muzzleY, result.mecha.expectedMuzzleY, 'scaled Mecha muzzle');
    console.table(result.enemies.map(e => ({ type: e.type, model: e.height.toFixed(2), capsule: e.capsule.toFixed(2) })));
    const png = await page.evaluate(() => {
      const g = __game, T = __scaleTest, THREE = g.THREE;
      // The reference sheet always shows the original four plants (default squads draw random companions)
      if (!['peashooter', 'sunflower', 'cactus'].every(t => g.heroes.some(h => h.type === t))) { g.state.over = true; g.configureSquad(['corn', 'peashooter', 'sunflower', 'cactus']); }
      const r = g.renderer, width = 1800, rowH = 400;
      r.setPixelRatio(1); r.setSize(width, rowH, false);
      const out = document.createElement('canvas'); out.width = width; out.height = rowH * 3;
      const ctx = out.getContext('2d');
      const rows = [
        ['corn', 'peashooter', 'sunflower', 'cactus', 'imp', 'soldier', 'pirate', 'mechanic', 'scientist', 'allStar', 'superBrainz'],
        ['corn', 'shambler', 'sprinter', 'plated', 'spitter', 'bomber', 'banner', 'climber', 'howler'],
        ['corn', 'imp', 'engineerTurret', 'healStation', 'zmech', 'miniBoss', 'finalBoss'],
      ];
      const names = { corn: 'Kernel Corn', peashooter: 'Peashooter', sunflower: 'Sunflower', cactus: 'Cactus', zmech: 'Z-Mech' };
      rows.forEach((types, row) => {
        const studio = new THREE.Scene(); studio.background = new THREE.Color(0x1b2734);
        studio.add(new THREE.HemisphereLight(0xd5e9ff, 0x726047, 2));
        const key = new THREE.DirectionalLight(0xffedcf, 3); key.position.set(-8, 15, 10); studio.add(key);
        const fill = new THREE.DirectionalLight(0xc0dcff, 1.6); fill.position.set(12, 10, -4); studio.add(fill);
        const floor = new THREE.GridHelper(50, 50, 0x637483, 0x334455); studio.add(floor);
        const cam = new THREE.OrthographicCamera(-22.5, 22.5, 5, -5, 0.1, 200);
        cam.position.set(0, 5.8, 55); cam.lookAt(0, 4.5, 0);
        const positions = [];
        types.forEach((type, i) => {
          const x = (i - (types.length - 1) / 2) * (42 / types.length); positions.push(x);
          const hero = g.heroes.find(h => h.type === type);
          if (hero) { studio.add(hero.mesh); hero.mesh.position.set(x, hero.centerY, 0); hero.mesh.rotation.set(0, 0, 0); }
          else if (type === 'zmech') {
            const rig = g.buildZMech(); rig.root.scale.setScalar(T.IMP_MECH_DEF.sizeMult);
            rig.root.position.set(x, 0, 0); studio.add(rig.root);
          } else {
            const z = g.spawnZombie(type); studio.add(z.mesh);
            z.mesh.position.set(x, z.def.radius + z.def.height / 2, 0); z.mesh.rotation.set(0, 0.18, 0);
            if (z.horde) {
              // Neutral bind pose uses the exact same sculpted geometry and instance transform as the live batch.
              const kit = T.hordeKit(type), mesh = new THREE.Mesh(kit.mesh.geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
              mesh.position.copy(z.mesh.position); mesh.rotation.copy(z.mesh.rotation); mesh.scale.copy(z.mesh.scale); studio.add(mesh);
            }
          }
        });
        const ref = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-22, g.player.centerY * 2, -1), new THREE.Vector3(22, g.player.centerY * 2, -1)]),
          new THREE.LineDashedMaterial({ color: 0x76cba0, dashSize: 0.25, gapSize: 0.2 }));
        ref.computeLineDistances(); studio.add(ref);
        r.render(studio, cam); ctx.drawImage(r.domElement, 0, row * rowH);
        ctx.fillStyle = '#eaf2f7'; ctx.font = 'bold 22px sans-serif';
        ctx.fillText(['PLANTS + TACTICAL ENEMIES', 'PLANTS + HORDE', 'PLANTS + DEPLOYABLES + BOSSES'][row], 24, row * rowH + 30);
        ctx.fillStyle = '#86d7ae'; ctx.font = '15px sans-serif'; ctx.fillText('Same scale in every row · green line = plant hitbox height (2.6 m)', 24, row * rowH + 55);
        ctx.fillStyle = '#eaf2f7'; ctx.font = '17px sans-serif'; ctx.textAlign = 'center';
        types.forEach((t, i) => ctx.fillText(names[t] || g.CONFIG.ZOMBIE_TYPES[t].name || t,
          width / 2 + positions[i] * width / 45, (row + 1) * rowH - 12));
        ctx.textAlign = 'left';
      });
      return out.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(root, 'docs', 'enemy-scale.png'), Buffer.from(png.split(',')[1], 'base64'));
    assert.deepEqual(errors, []);
    console.log('enemy-scale: all sizes, mech transitions and corpses passed; rendered docs/enemy-scale.png');
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
