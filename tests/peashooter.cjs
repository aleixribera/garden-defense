// Behavioral checks against the real game. Playwright and its Chromium browser are test-only dependencies.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = source.split('<script type="module">')[1].split('</script>')[0];
new (Object.getPrototypeOf(async function () {}).constructor)(script.replace(/^import .*$/gm, ''));
const expose = `window.__peaTest={THREE,renderer,sun,resetGame,respawnHero,makeHero,newInput,takeControl,animatePeashooter,updateHero,updateProjectiles,firePea,throwChiliBean,togglePeaGatling,useHyper,updateBeanBombs,drivePeashooter,peaTargetScore,peaBeanArcClear,updateHud,damageZombie,shotClear,stopPeaGatling,get beans(){return beanBombs},get shots(){return projectiles},clear(){for(const p of projectiles)scene.remove(p.mesh);projectiles=[];clearBeanBombs();for(const z of zombies)scene.remove(z.mesh);zombies=[];state.distractions=[];state.spawnQueue=[];state.over=false;}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR:', e.message); });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', r => console.log('REQUEST FAILED:', r.url()));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__peaTest, { timeout: 45000 });
    const result = await page.evaluate(() => {
      const g = window.__game, T = window.__peaTest, V = T.THREE.Vector3, dt = 1 / 60;
      g.configureSquad(['peashooter', 'corn', 'peashooter']);
      const h = g.player;
      const setup = () => {
        T.clear(); T.respawnHero(h); h.input = T.newInput();
        h.mesh.position.set(12, g.heightAt(12, 8) + h.centerY, 8); h.yaw = 0; h.mesh.rotation.y = 0;
        for (const k in h.cd) h.cd[k] = 0;
        h.aimPoint.set(12, 1, -10); h.input.aimPoint.copy(h.aimPoint); T.animatePeashooter(h, 0); h.mesh.updateMatrixWorld(true);
      };
      const zombie = (x, z, type = 'shambler') => {
        const t = g.spawnZombie(type); t.mesh.position.set(x, g.heightAt(x, z) + t.def.radius + t.def.height / 2, z); return t;
      };
      const advance = (n, fn) => { for(let i=0;i<n;i++) { g.state.time += dt; fn(dt); } };
      const report = {};
      setup();
      report.roster = { type: h.type, hp: h.hp, clip: h.ammo, slots: g.heroes.length, initialized: !!h.pea };
      let meshes = 0, triangles = 0;
      h.corn.root.traverse(o => { if(o.isMesh) { meshes++; triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; } });
      report.model = { meshes, triangles };
      const direct = zombie(12, -4), neighbor = zombie(13.6, -4), far = zombie(18, -4);
      h.aimPoint.copy(direct.mesh.position); T.firePea(h);
      advance(45, () => T.updateProjectiles(dt));
      report.splash = { direct: 50-direct.hp, neighbor:50-neighbor.hp, far:50-far.hp, remaining:T.shots.length };
      setup(); h.input.move.set(0,0,-1); h.input.yaw=0; T.useHyper(h);
      advance(60, () => { T.updateHero(h,dt); T.animatePeashooter(h,dt); });
      const speed = Math.hypot(h.vel.x,h.vel.z), hyperRemaining=h.pea.hyper;
      h.input.jump = true; T.updateHero(h,dt); h.input.jump=false;
      report.hyper = { speed, expected:h.stats.speed*h.abilities.butterBarrage.speedMult, jump:h.vel.y, remaining:hyperRemaining };
      setup(); const primaryAmmo=h.ammo; T.togglePeaGatling(h);
      const rootPos=h.mesh.position.clone(); h.input.move.set(1,0,0);h.input.fire=true;h.input.jump=true;
      advance(120, () => {T.updateHero(h,dt); T.animatePeashooter(h,dt); T.updateProjectiles(dt);});
      report.gatling = { moved: h.mesh.position.distanceTo(rootPos), rounds: h.pea.gatlingAmmo, primaryAmmo:h.ammo,
        originalAmmo:primaryAmmo, visible:h.corn.turret.visible, active:h.pea.gatling };
      T.togglePeaGatling(h); report.gatling.cancelCooldown=h.cd.huskHop;
      setup(); const pack=[zombie(12,-9),zombie(13,-9),zombie(11,-9)];
      T.throwChiliBean(h, new V(12,0,-9));
      advance(90,()=>T.updateBeanBombs(dt));
      report.beanFlight={count:T.beans.length, lure:g.state.distractions.length, position:T.beans[0]?.mesh.position.toArray(), velocity:T.beans[0]?.vel.toArray(), distance:T.beans.length?Math.hypot(T.beans[0].mesh.position.x-12,T.beans[0].mesh.position.z+9):null};
      advance(70,()=>T.updateBeanBombs(dt));
      report.bean={remaining:T.beans.length,kills:pack.filter(z=>z.dead).length,cooldown:h.cd.shuckShot};
      setup(); h.isAI=true;
      const isolated=zombie(14,-9), group=[zombie(28,7),zombie(29,7),zombie(29,8),zombie(28,8)];
      h.cd.huskHop=h.cd.butterBarrage=100;
      T.drivePeashooter(h,dt);
      report.aiGroup={target:h.brain.target?.id,isolated:isolated.id,groupIds:group.map(z=>z.id),throws:h.input.shuck,point:h.input.beanPoint?.toArray()};
      setup(); h.isAI=true; const boss=zombie(12,-15,'miniBoss'); h.cd.shuckShot=h.cd.butterBarrage=100;
      advance(100,()=>{T.drivePeashooter(h,dt);T.updateHero(h,dt);T.animatePeashooter(h,dt);T.updateProjectiles(dt);});
      report.aiBoss={active:h.pea.gatling,state:h.brain.state,ammo:h.pea.gatlingAmmo,target:h.brain.target?.id,boss:boss.id};
      h.cd.butterBarrage=0;zombie(h.mesh.position.x+2,h.mesh.position.z,'sprinter');
      advance(20,()=>{T.drivePeashooter(h,dt);T.updateHero(h,dt);});
      report.aiEscape={gatling:h.pea.gatling,hyper:h.pea.hyper};
      setup();h.isAI=true;h.hp=20;
      advance(120,()=>{T.drivePeashooter(h,dt);T.updateHero(h,dt);T.animatePeashooter(h,dt);});
      report.aiRetreat={state:h.brain.state,goal:h.brain.goal.toArray(),position:h.mesh.position.toArray()};
      setup();h.isAI=true;
      advance(600,()=>{T.drivePeashooter(h,dt);T.updateHero(h,dt);T.animatePeashooter(h,dt);});
      report.aiPatrol={state:h.brain.state,radius:Math.hypot(h.mesh.position.x,h.mesh.position.z),goal:h.brain.goal.toArray()};
      // Character state is retained across handoff and cleared correctly on death/respawn.
      setup();h.isAI=false;T.useHyper(h);h.ammo=7;T.takeControl(g.heroes[1]);T.takeControl(h);
      report.handoff={type:g.player.type,ammo:h.ammo,hyper:h.pea.hyper};
      g.damageHero(h,1000);report.death={dead:h.dead,hyper:h.pea.hyper,gatling:h.pea.gatling};
      T.respawnHero(h);report.respawn={hp:h.hp,ammo:h.ammo,hyper:h.pea.hyper};
      setup(); T.updateHud(0);
      report.hud={name:document.getElementById('playerLabel').textContent,weapon:document.getElementById('weaponLabel').textContent,
        abilities:[...document.querySelectorAll('#abilities .name')].map(e=>e.textContent)};
      return report;
    });
    console.log(JSON.stringify(result, null, 2));
    assert.deepEqual(errors, []);
    assert.equal(result.roster.initialized,true);
    assert.ok(result.splash.direct >= 30 && result.splash.direct <= 35.1);
    assert.ok(result.splash.neighbor > 0 && result.splash.neighbor <= 10); assert.equal(result.splash.far,0);
    assert.ok(result.hyper.speed > 17); assert.ok(result.hyper.jump > 16);
    assert.ok(result.gatling.moved < 0.001); assert.ok(result.gatling.rounds < 90);
    assert.equal(result.gatling.primaryAmmo,result.gatling.originalAmmo); assert.equal(result.gatling.cancelCooldown,30);
    // Assertions follow the studio capture so visual QA remains available while iterating on gameplay.
    assert.ok(result.aiGroup.groupIds.includes(result.aiGroup.target)); assert.equal(result.aiGroup.throws,true);
    assert.equal(result.aiBoss.active,true); assert.equal(result.aiEscape.gatling,false);
    assert.equal(result.handoff.ammo,7); assert.ok(result.handoff.hyper>0); assert.equal(result.death.hyper,0);
    assert.ok(result.aiEscape.hyper>0);assert.equal(result.aiRetreat.state,'retreat');
    assert.ok(result.aiRetreat.goal.every(Number.isFinite));assert.ok(result.aiPatrol.radius<45);
    assert.equal(result.respawn.hp,125);assert.equal(result.respawn.ammo,10);
    assert.deepEqual(result.hud.abilities,['Chili Bean Bomb','Pea Gatling','Hyper']);
    await page.evaluate(() => {
      const g=window.__game,T=window.__peaTest,THREE=T.THREE,h=g.player;T.clear();T.respawnHero(h);
      for(const c of g.scene.children) if(!c.isLight && c!==h.mesh) c.visible=false;
      g.scene.fog=null;g.scene.background=new THREE.Color(0x172721);
      h.mesh.position.set(0,h.centerY,0);h.mesh.rotation.y=0;h.yaw=0;h.aimElev=0;h.corn.root.rotation.y=0;
      h.input.move.set(0,0,0);T.animatePeashooter(h,0);h.mesh.updateMatrixWorld(true);
      const floor=new THREE.Mesh(new THREE.CircleGeometry(200,96),new THREE.MeshStandardMaterial({color:0x26352b,roughness:0.8}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;g.scene.add(floor);
      T.sun.position.set(-3,6,5);T.sun.target.position.set(0,1,0);
      g.camera.fov=32;g.camera.position.set(4.2,2.7,6.5);g.camera.lookAt(0,1.5,0);g.camera.updateProjectionMatrix();
      for(const el of document.querySelectorAll('body > div'))el.style.display='none';
      T.renderer.render(g.scene,g.camera);
    });
    if (process.env.PEASHOOTER_SCREENSHOTS) {
      const dir = path.resolve(process.env.PEASHOOTER_SCREENSHOTS);
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'peashooter-preview.png') });
    }
    await page.evaluate(()=>{
      const g=window.__game,T=window.__peaTest;T.togglePeaGatling(g.player);
      // The studio pose sits at the hidden statue's origin; skip world movement/collision here.
      g.player.pea.deploy=0;g.player.aimElev=0;T.animatePeashooter(g.player,1/60);
      T.renderer.render(g.scene,g.camera);
    });
    if (process.env.PEASHOOTER_SCREENSHOTS) await page.screenshot({ path: path.join(path.resolve(process.env.PEASHOOTER_SCREENSHOTS), 'peashooter-gatling.png') });
    assert.ok(result.beanFlight.distance < 3); assert.equal(result.bean.kills,3); assert.equal(result.bean.remaining,0);
    assert.deepEqual(errors, [], 'gameplay and rendering must have no browser or shader errors');
    console.log('PEASHOOTER GAMEPLAY AND RENDER CHECKS PASSED');
  } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
