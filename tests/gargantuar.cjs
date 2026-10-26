// Real browser regression scenarios plus reproducible studio views of the procedural boss.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),os=require('node:os'),cp=require('node:child_process');
const {chromium}=require('playwright');
const { gameServer } = require('./lib/game-server.cjs');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const expose=`window.__ggTest={THREE,renderer,scene,camera,resetGame,respawnHero,updateZombies,updateGargantuarWorld,
  updateParticles,updateEffects,updateHeroInfo,gargantuarBehavior,gargantuarSlam,gargantuarBegin,damageZombie,
  removeDeadZombies,launchGargantuarImp,gargantuarImps,resolvePacks,scaledCount,beginCountdown,startWave,
  toggleSunbeam,togglePeaGatling,OBSTACLES,feetY,constrainZombie,clearGargantuarWorld,gargantuarImpBlast,gargantuarCorpses,think};`;
const html=source.replace(/\nloop\(\);\s*<\/script>/,'\n'+expose+'\n</script>');
assert.ok(html.includes(expose));
const server = gameServer(html);
(async()=>{
  const syntax=path.join(os.tmpdir(),`garden-gargantuar-${process.pid}.mjs`);
  try{fs.writeFileSync(syntax,source.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);cp.execFileSync(process.execPath,['--check',syntax]);}finally{fs.rmSync(syntax,{force:true});}
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1100,height:1100},ignoreHTTPSErrors:true}),errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{timeout:60000});
    await page.waitForFunction(()=>window.__ggTest,null,{timeout:60000});
    const model=await page.evaluate(()=>{
      const T=window.__ggTest,g=window.__game,THREE=T.THREE;
      const z=g.spawnZombie('miniBoss');window.ggPreview=z;
      const studio=new THREE.Scene();studio.background=new THREE.Color(0x26313b);studio.environment=T.scene.environment;
      studio.add(z.mesh);z.mesh.position.set(0,z.def.radius+z.def.height/2,0);z.mesh.rotation.y=0;
      const key=new THREE.DirectionalLight(0xffebcd,3.5);key.position.set(-5,9,7);key.castShadow=true;
      key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:9,bottom:-7,near:0.1,far:35});key.shadow.bias=-0.0005;key.shadow.normalBias=0.03;studio.add(key);
      const fill=new THREE.DirectionalLight(0xc7deff,1.2);fill.position.set(7,5,3);studio.add(fill);
      const rim=new THREE.DirectionalLight(0xf2d29b,2.6);rim.position.set(2,8,-5);studio.add(rim);
      studio.add(new THREE.HemisphereLight(0xc7e3ef,0x433c33,1));
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x303b44,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;studio.add(floor);
      window.ggStudio=studio;
      z.parts.animate(z,1/60);studio.updateMatrixWorld(true);
      let meshes=0,triangles=0;z.parts.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
      return {meshes,triangles,bounds:new THREE.Box3().setFromObject(z.parts.root).getSize(new THREE.Vector3()).toArray(),hidden:!z.mesh.material.visible};
    });console.log('Model:',model);assert.ok(model.hidden&&model.meshes<190&&model.triangles>30000);
    for(const [name,angle,mode]of [['front',-0.45,'walk'],['side',1.3,'walk'],['back',3.3,'walk'],['slam',0.4,'slamWind']]){
      const data=await page.evaluate(({angle,mode})=>{
        const T=window.__ggTest,z=window.ggPreview,s=window.__game.gargantuarState(z),C=window.__game.CONFIG.GARGANTUAR;
        z.mesh.rotation.y=angle;s.mode=mode;s.t=mode==='slamWind'?0.04:0;
        z.parts.animate(z,1/60);z.parts.warning.visible=false;
        T.camera.position.set(-0.3,5.1,14.5);T.camera.lookAt(-0.3,3.5,0);T.camera.fov=40;T.camera.aspect=1;T.camera.updateProjectionMatrix();
        T.renderer.render(window.ggStudio,T.camera);return T.renderer.domElement.toDataURL('image/png');
      },{angle,mode});fs.writeFileSync(path.join(root,'docs',`gargantuar-${name}.png`),Buffer.from(data.split(',')[1],'base64'));
    }
    const checks=await page.evaluate(()=>{
      const T=window.__ggTest,g=window.__game,C=g.CONFIG.GARGANTUAR,dt=1/60,results=[];
      function check(ok,label){if(!ok)throw new Error(label);results.push(label);}
      const place=(h,x,z,y=0)=>{h.mesh.position.set(x,g.heightAt(x,z)+h.centerY+y,z);h.feet=g.heightAt(x,z)+y;h.hp=h.stats.hp;h.dead=h.downed=false;h.active=true;h.onGround=true;};
      const setup=(dist=3.5)=>{
        T.resetGame();g.configureSquad(['sunflower','peashooter']);const h=g.heroes[0],ally=g.heroes[1];
        place(h,10,10+dist);place(ally,60,60);
        const z=g.spawnZombie('miniBoss');z.mesh.position.set(10,g.heightAt(10,10)+z.def.radius+z.def.height/2,10);z.mesh.rotation.y=0;
        z.prevX=10;z.prevZ=10;z.heroTgt=h;z.seesHero=true;z.lastKnown.copy(h.mesh.position);z.thinkTimer=100;
        const s=g.gargantuarState(z);s.chargeCd=s.impCd=999;return{z,h,ally,s};
      };
      const step=(n)=>{for(let i=0;i<n;i++){g.state.time+=dt;T.updateZombies(dt);T.scene.updateMatrixWorld(true);T.updateGargantuarWorld(dt);T.updateParticles(dt);T.updateEffects(dt);}};
      let {z,h,ally,s}=setup();T.toggleSunbeam(h);check(h.sun.sunbeam,'Sunbeam set up');
      g.gargantuarStartSlam(z);step(30);check(h.hp===h.stats.hp,'windup does not damage early');step(32);
      check(h.hp===h.stats.hp-C.slam.damage,'slam hits once for 40');check(!h.sun.sunbeam&&h.vel.y>0,'slam interrupts Sunbeam and knocks back');
      ({z,h,ally,s}=setup());g.gargantuarStartSlam(z);place(h,20,14);step(70);check(h.hp===h.stats.hp,'sidestepping the locked slam avoids damage');
      ({z,h,ally,s}=setup());place(h,10,13.5,6);g.gargantuarStartSlam(z);step(70);check(h.hp===h.stats.hp,'ground slam cannot hit elevated plant');
      ({z,h,ally,s}=setup());place(ally,10,13.5);place(h,60,65);T.togglePeaGatling(ally);z.heroTgt=ally;g.gargantuarStartSlam(z);step(65);
      check(!ally.pea.gatling&&ally.hp===ally.stats.hp-C.slam.damage,'AI companion hit and Gatling uprooted');
      ({z,h,ally,s}=setup(20));s.chargeCd=0;T.updateHeroInfo();let modes=new Set();
      for(let i=0;i<360;i++){step(1);modes.add(s.mode);}
      check(modes.has('roar')&&modes.has('charge')&&modes.has('slamStrike'),'charge roars, runs and ends in pole smash');
      check(z.mesh.position.z>15,'charge traverses the ground');
      ({z,h,ally,s}=setup(25));s.impCd=0;s.chargeCd=999;let launched=false;
      for(let i=0;i<300;i++){step(1);launched ||= T.gargantuarImps.length>0;}
      check(launched,'ranged target triggers explosive Imp');check(h.hp===h.stats.hp-C.imp.damage,'explosive Imp hits once for 25');
      ({z,h,ally,s}=setup(3.5));const floor=g.heightAt(10,12),cover={x:10,z:12.8,w:8,d:1.2,base:floor,top:floor+8,kind:'building',blocksLOS:true};
      // Both positions are inside splash range, separated only by a thin full-height wall.
      s.target.set(10,floor+0.1,12);place(h,10,14.3);T.OBSTACLES.push(cover);
      try{const hp=h.hp;T.gargantuarSlam(z);T.gargantuarImpBlast(s.target.clone().setY(floor+1));check(h.hp===hp,'cover blocks in-range slam and Imp splash');}
      finally{T.OBSTACLES.pop();}
      T.gargantuarSlam(z);check(h.hp===h.stats.hp-C.slam.damage,'same in-range slam hits after cover removed');
      ({z,h,ally,s}=setup(3.5));place(h,10,13.5,6);z.heroTgt=null;z.retargetTimer=0;T.updateHeroInfo();T.think(z);
      check(!h.reachable&&z.heroTgt===h,'boss acquires elevated targets for ranged attacks');
      ({z,h,ally,s}=setup(20));s.target.copy(h.mesh.position);T.gargantuarBegin(z,'roar',C.charge.windup);
      place(h,30,30);const hp=h.hp;step(350);check(h.hp===hp&&z.mesh.position.x<15,'charge commits to old position and can be dodged');
      ({z,h,ally,s}=setup());place(h,60,60);place(ally,65,60);z.heroTgt=null;z.mesh.position.set(0,z.def.radius+z.def.height/2,6);z.mesh.rotation.y=Math.PI;
      const garden=g.state.statueHp;g.gargantuarStartSlam(z);step(65);check(g.state.statueHp===garden-C.slam.statueDamage,'pole smash damages the garden once');
      T.resetGame();const packs=T.resolvePacks(4);check(packs[2].bossSlot,'wave 5 retains boss roll in third pack');
      g.beginCountdown(4);g.state.bossRoll.opt=g.CONFIG.BOSS_SLOT.options.find(o=>o.key==='gargantuar');g.startWave(4);
      check(g.state.spawnQueue.filter(s=>s.type==='miniBoss').length===1,'Gargantuar roll queues one boss');
      check(T.scaledCount('miniBoss',1)===1,'boss count does not scale with squad');T.resetGame();
      const a=g.spawnZombie('miniBoss'),b=g.spawnZombie('miniBoss');check(a.parts.flashMats[0]!==b.parts.flashMats[0],'boss instances own hit flash materials');
      T.launchGargantuarImp(a,g.player.mesh.position);check(T.gargantuarImps.length===1,'projectile created');
      const warning=a.parts.warning;T.damageZombie(a,100000,a.mesh.position);T.removeDeadZombies();check(!warning.parent&&T.gargantuarCorpses.length===1,'death removes warning and starts collapse');
      for(let i=0;i<240;i++)T.updateGargantuarWorld(dt);check(T.gargantuarCorpses.length===0,'collapsed model expires and releases materials');
      T.launchGargantuarImp(b,g.player.mesh.position);T.damageZombie(b,100000,b.mesh.position);T.removeDeadZombies();
      T.resetGame();check(T.gargantuarImps.length===0&&T.gargantuarCorpses.length===0&&g.zombies.length===0,'reset clears bosses, corpses and airborne Imps');
      return results;
    });console.log(checks.join('\n'));assert.deepEqual(errors,[]);console.log('gargantuar: all checks passed');
  }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
