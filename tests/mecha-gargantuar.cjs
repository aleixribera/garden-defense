// Real-renderer model previews and deterministic combat/lifecycle regression checks.
// NODE_PATH can point to the desktop's bundled node_modules; no game build step.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { gameServer } = require('./lib/game-server.cjs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const expose = `window.__mgTest={THREE,renderer,scene,camera,resetGame,respawnHero,updateZombies,updateMechaWorld,
  updateEnemyProjectiles,updateParticles,updateEffects,damageZombie,mechaBehavior,mechaSmash,mechaPulse,
  mechaState,mechaBegin,mechaThrowBomb,feetY,updateWaves,startWave,removeDeadZombies,OBSTACLES,mechaBlast,
  beginCountdown,get shots(){return enemyProjectiles},get bombs(){return mechaBombs},
  clear(){resetGame();state.spawnQueue=[];state.over=false;state.phase='active';}};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
assert.ok(html.includes(expose));
const server = gameServer(html);
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1200,height:1200}}), errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>window.__mgTest,null,{timeout:60000});
    for(const [name,yaw] of [['front',0],['three-quarter',-0.62],['back',2.6]]) {
      const image=await page.evaluate(yaw=>{
        const T=__mgTest,g=__game;T.clear();const z=g.spawnZombie('finalBoss');
        z.mesh.position.set(0,165,0);z.mesh.rotation.y=yaw;z.parts.animate(z,0);
        T.scene.background=new T.THREE.Color(0x141d27);T.scene.fog=null;
        const key=new T.THREE.DirectionalLight(0xffe0b0,2.2);key.position.set(-9,176,12);key.target.position.set(0,165,0);T.scene.add(key,key.target);
        const rim=new T.THREE.DirectionalLight(0x8abaff,3);rim.position.set(9,170,-8);rim.target.position.set(0,165,0);T.scene.add(rim,rim.target);
        T.camera.position.set(0,166.2,19.4);T.camera.lookAt(0,165.1,0);T.camera.fov=38;T.camera.updateProjectionMatrix();
        T.scene.updateMatrixWorld(true);T.renderer.render(T.scene,T.camera);
        const out=T.renderer.domElement.toDataURL('image/png');T.scene.remove(key,key.target,rim,rim.target);return out;
      },yaw);
      fs.writeFileSync(path.join(root,'docs',`mecha-${name}.png`),Buffer.from(image.split(',')[1],'base64'));
    }
    const result=await page.evaluate(()=>{
      const T=__mgTest,g=__game,C=g.CONFIG.MECHA,dt=1/60;T.clear();g.configureSquad(['corn']);
      const h=g.player;T.respawnHero(h);h.hp=100000;
      h.mesh.position.set(10,g.heightAt(10,10)+h.centerY,10);
      const z=g.spawnZombie('finalBoss');z.mesh.position.set(10,g.heightAt(10,30)+z.def.radius+z.def.height/2,30);z.mesh.rotation.y=Math.PI;
      const a=T.mechaState(z),top=z.mesh.position.clone().setY(T.feetY(z)+8),body=z.mesh.position.clone();
      a.cd.bomb=0; // Start at range so the bomb gets a natural decision before the boss closes in.
      const hp=z.hp;T.damageZombie(z,100,body,false,false,h);const armor=hp-z.hp;
      T.damageZombie(z,100,top,false,false,h);const head=hp-armor-z.hp;
      T.damageZombie(z,100,body,false,true,h);const heavy=hp-armor-head-z.hp;
      z.hp=z.def.hp;
      const advance=n=>{for(let i=0;i<n;i++){g.state.time+=dt;T.updateZombies(dt);T.updateEnemyProjectiles(dt);T.updateMechaWorld(dt);T.updateParticles(dt);T.updateEffects(dt);}};
      const seen=new Set();for(let i=0;i<60*45;i++){advance(1);seen.add(a.mode);}
      const hurt=h.hp<100000;
      // Force a burst with other choices disabled: exactly three shots, then recovery.
      T.clear();T.respawnHero(h);h.hp=100000;h.mesh.position.set(10,g.heightAt(10,10)+h.centerY,10);
      const q=g.spawnZombie('finalBoss');q.mesh.position.set(10,g.heightAt(10,30)+q.def.radius+q.def.height/2,30);q.mesh.rotation.y=Math.PI;
      const qa=T.mechaState(q);T.mechaBegin(q,'pulse',C.pulse.windup,h.mesh.position);qa.shots=0;
      const t={pos:h.mesh.position,dir:new T.THREE.Vector3(0,0,-1),dist:20,isHero:true,hero:h,isPoint:false};
      for(let i=0;i<110;i++)T.mechaBehavior(q,t,dt);
      const pulseCount=T.shots.length;
      // Bomb is still live just before four seconds and explodes at four seconds.
      T.mechaThrowBomb(q,h.mesh.position);const b=T.bombs[0];b.mesh.position.copy(h.mesh.position);b.vel.set(0,0,0);b.grounded=true;
      const before=h.hp;for(let i=0;i<239;i++)T.updateMechaWorld(dt);const beforeFuse=T.bombs.length;
      for(let i=0;i<2;i++)T.updateMechaWorld(dt);const afterFuse=T.bombs.length,bombDamage=before-h.hp;
      T.mechaThrowBomb(q,h.mesh.position);T.clear();const reset={bombs:T.bombs.length,shots:T.shots.length,zombies:g.zombies.length};
      // Force the Mecha reel outcome, then exercise the final wave's real pack schedule.
      T.beginCountdown(9);g.state.bossRoll.opt=g.CONFIG.BOSS_SLOT.options.find(o=>o.key==='mecha');
      T.startWave(9);const waveBoss=g.state.spawnQueue.find(s=>s.type==='finalBoss');
      return {armor,head,heavy,seen:[...seen],hurt,pulseCount,beforeFuse,afterFuse,bombDamage,reset,waveBoss:!!waveBoss};
    });
    console.log(JSON.stringify(result,null,2));
    assert.equal(result.armor,35);assert.equal(result.head,100);assert.equal(result.heavy,70);
    assert.ok(result.seen.includes('pulse')&&result.seen.includes('bomb')&&result.seen.includes('charge')&&result.seen.includes('smash'),'all attacks run through real AI');
    assert.ok(result.hurt);assert.equal(result.pulseCount,3);
    assert.equal(result.beforeFuse,1);assert.equal(result.afterFuse,0);assert.equal(result.bombDamage,30);
    assert.deepEqual(result.reset,{bombs:0,shots:0,zombies:0});assert.ok(result.waveBoss);
    const safety=await page.evaluate(()=>{
      const T=__mgTest,g=__game,V=T.THREE.Vector3,C=g.CONFIG.MECHA;T.clear();
      const h=g.player;T.respawnHero(h);h.hp=100000;
      const q=g.spawnZombie('finalBoss');q.mesh.position.set(10,g.heightAt(10,30)+q.def.radius+q.def.height/2,30);q.mesh.rotation.y=Math.PI;
      // Telegraph locks the charge destination: moving sideways after the cue genuinely dodges it.
      const aim=new V(10,g.heightAt(10,12)+h.centerY,12);h.mesh.position.copy(aim).add(new V(12,0,0));
      T.mechaBegin(q,'chargeWind',C.charge.windup,aim);
      const t={pos:h.mesh.position,dir:new V(0,0,-1),dist:25,isHero:true,hero:h,isPoint:false};
      for(let i=0;i<240;i++)T.mechaBehavior(q,t,1/60);
      const dodge=h.hp===100000;
      // A real building blocks both the swept pulse and the rocket rush.
      const wall=T.OBSTACLES.find(o=>o.w&&o.d&&o.top-o.base>4);
      q.mesh.position.set(wall.x,wall.base+q.def.radius+q.def.height/2,wall.z+wall.d/2+5);q.mesh.rotation.y=Math.PI;
      const target=new V(wall.x,wall.base+2,wall.z-wall.d/2-5);h.mesh.position.copy(target);
      T.mechaPulse(q,target);for(let i=0;i<60;i++)T.updateEnemyProjectiles(1/30);
      const cover=h.hp===100000&&T.shots.length===0;
      T.mechaBegin(q,'chargeWind',C.charge.windup,target);const start=q.mesh.position.z;
      for(let i=0;i<140;i++)T.mechaBehavior(q,{...t,pos:target},1/60);
      const blocked=q.mesh.position.z>wall.z+wall.d/2&&q.mesh.position.z<start;
      // High ground is outside the electrical ground smash, but the garden can be damaged.
      const blast=new V(10,g.heightAt(10,10)+0.3,10);h.mesh.position.copy(blast).add(new V(0,12,0));
      T.mechaBlast(blast,5.5,40,55,13);const highGround=h.hp===100000;
      const garden=g.state.statueHp;T.mechaBlast(new V(0,0.3,3),5.5,40,55,13);const gardenDamage=garden-g.state.statueHp;
      // Independent instances must not share animated joints or hit-flash materials; disposal is repeatable.
      const second=g.spawnZombie('finalBoss');const independent=q.parts.mechaRig.arms[0]!==second.parts.mechaRig.arms[0]&&q.parts.mechaRig.M.shell!==second.parts.mechaRig.M.shell;
      let disposed=0;q.parts.mechaRig.M.shell.addEventListener('dispose',()=>disposed++);
      T.damageZombie(q,100000,q.mesh.position,false,true,h);T.removeDeadZombies();
      const death=q.dead&&!q.mesh.parent&&disposed===1&&!second.dead;
      T.clear();return {dodge,cover,blocked,highGround,gardenDamage,independent,death};
    });
    console.log(safety);for(const k of ['dodge','cover','blocked','highGround','independent','death'])assert.ok(safety[k],k);
    assert.equal(safety.gardenDamage,55);
    assert.deepEqual(errors,[]);console.log('mecha-gargantuar: all checks passed');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
