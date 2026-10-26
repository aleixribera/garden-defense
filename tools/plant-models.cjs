// Plant model renders: builds a hero exactly as the game does (makeHero → buildModel → bakeRig), poses it with its
// own animator and writes one contact sheet per pose (front · three-quarter · side · back · over-the-shoulder).
//   node tools/plant-models.cjs <type> [--out dir] [--poses idle,run] [--lineup] [--lab file.js]
// With no type it renders Citron, Rose and Chomper: each pose listed in PLANT_TYPES[type].docPoses, plus
// docs/plant-roster.png (all seven plants and a zombie, for scale and style).
// --lab injects a work-in-progress model file into the page (before makeHero) so a sculpt can be iterated without
// touching index.html. The file defines `const LAB = { type, build, animate, poses }`, where poses maps a name to
// { setup(h, T) → mutate hero state, frames: n frames of animate at 60 Hz, step?(h, frame, T) }.
// Without --lab the type must exist in PLANT_TYPES; its poses come from PLANT_TYPES[type].labPoses (if any) or idle.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { gameServer } = require('../tests/lib/game-server.cjs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const docMode = !args[0] || args[0].startsWith('--');
const types = docMode ? ['citron', 'rose', 'chomper'] : [args[0]];
const out = path.resolve(flag('--out') || path.join(root, 'docs'));
const lab = flag('--lab');
const only = flag('--poses')?.split(',');
let source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (lab) {
  const code = fs.readFileSync(path.resolve(lab), 'utf8');
  const at = source.indexOf('\nfunction makeHero(');
  if (at < 0) throw Error('makeHero not found');
  const register = `
PLANT_TYPES[LAB.type] ||= { buildModel: LAB.build, animate: LAB.animate || (() => {}), drive() {},
  actions: { shuckShot() {}, huskHop() {}, butterBarrage() {} } };
CONFIG.PLANTS[LAB.type] ||= { name: LAB.type, stats: LAB.stats || {}, weapon: {}, abilities: {},
  abilityNames: { shuckShot: 'Q', huskHop: 'E', butterBarrage: 'F' }, abilityIcons: { shuckShot: '', huskHop: '', butterBarrage: '' },
  info: { role: 'Lab', blurb: '', primary: '', shuckShot: '', huskHop: '', butterBarrage: '' } };
`;
  source = source.slice(0, at) + '\n' + code + '\n' + register + source.slice(at);
}
const expose = `window.__plantLab={THREE,renderer,scene,camera,sun,rimLight,makeHero,heroJuice,spawnZombie,updateZombieBatches,
  PLANT_TYPES,LAB:typeof LAB!=='undefined'?LAB:null};`;
const html = source.replace(/loop\(\);\s*<\/script>/, expose + '</script>');
if (!html.includes(expose)) throw Error('test hooks must replace the animation loop');
const server = gameServer(html);

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--enable-unsafe-swiftshader'] });
  const W = 1500, H = 520;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let failed = false;
  page.on('pageerror', e => { failed = true; console.log('BROWSER ERROR:', e.stack || e.message); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`console.${m.type()}:`, m.text()); });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__plantLab, null, { timeout: 90000 });
    await page.evaluate(([W, H]) => {
      const L = window.__plantLab, g = window.__game, T = L.THREE;
      document.querySelectorAll('body > :not(canvas):not(script)').forEach(e => e.style.display = 'none');
      for (const child of g.scene.children) if (!child.isLight) child.visible = false;
      g.scene.background = new T.Color(0x14282c); g.scene.fog = null;
      const stage = new T.Mesh(new T.CylinderGeometry(2.2, 2.3, 0.12, 96), new T.MeshStandardMaterial({ color: 0x2c4a4c, roughness: 0.85 }));
      stage.position.y = -0.06; stage.receiveShadow = true; g.scene.add(stage); window.__labStage = stage;
      L.renderer.setPixelRatio(1); L.renderer.setSize(W, H);
    }, [W, H]);
    fs.mkdirSync(out, { recursive: true });
    for (const type of types) {
    const poses = await page.evaluate(([type, docMode]) => {
      const L = window.__plantLab, g = window.__game;
      if (window.__labHero) g.scene.remove(window.__labHero.mesh);
      const h = L.makeHero(type, false, [0, 0], 9);
      h.mesh.position.set(0, h.centerY, 0); h.bar.group.visible = false;
      window.__labHero = h;
      const plant = L.PLANT_TYPES[type];
      const poses = (L.LAB && L.LAB.type === type ? L.LAB.poses : plant.labPoses) || { idle: { frames: 60 } };
      return docMode ? plant.docPoses || ['idle'] : Object.keys(poses);
    }, [type, docMode]);
    for (const pose of poses) {
      if (only && !only.includes(pose)) continue;
      await page.evaluate(([type, pose, W, H]) => {
        const L = window.__plantLab, g = window.__game, T = L.THREE, h = window.__labHero, R = L.renderer;
        const plant = L.PLANT_TYPES[type];
        const P = ((L.LAB && L.LAB.type === type ? L.LAB.poses : plant.labPoses) || { idle: { frames: 60 } })[pose];
        // fresh hero state for every pose
        Object.assign(h, { dead: false, downed: false, onGround: true, reloading: false, zoom: 0, sprint: 0, aimElev: 0, yaw: 0 });
        h.vel.set(0, 0, 0); h.anim = { t: 0, phase: 0, leanF: 0, leanS: 0, squash: 0, air: 0, blink: 3 };
        h.input = { move: new T.Vector3(), yaw: 0, aimPoint: new T.Vector3(0, 1.4, -20), zoom: false, fire: false, sprint: false,
          jump: false, jumpHeld: false, interact: false, reload: false, shuck: false, hop: false, butter: null };
        h.aimPoint.set(0, 1.4, -20); h.mesh.position.set(0, h.centerY, 0); h.mesh.rotation.set(0, 0, 0);
        P.setup?.(h, T);
        const dt = 1 / 60;
        for (let f = 0; f < (P.frames ?? 60); f++) {
          g.state.time += dt;
          P.step?.(h, f, T);
          plant.animate(h, dt); L.heroJuice(h, dt);
        }
        h.mesh.position.set(0, h.centerY + (P.lift || 0), 0); h.mesh.rotation.y = 0;
        L.sun.visible = true; L.sun.position.set(-4, 9, -7); L.sun.target.position.set(0, 1.2, 0); L.sun.target.updateMatrixWorld();
        L.rimLight.position.set(5, 5, 6); L.rimLight.intensity = 1.6;
        const cam = L.camera, look = P.look || 1.3, d = P.distance || 6.8;
        const views = [[0, 0.12], [-0.75, 0.15], [-Math.PI / 2, 0.1], [Math.PI, 0.12]];
        const tile = W / 5;
        R.setScissorTest(true); R.setClearColor(0x14282c, 1);
        views.forEach(([a, p], i) => {
          // a = 0 looks at the face (the plant faces -Z), π looks at the back
          cam.position.set(Math.sin(a) * -d * Math.cos(p), look + Math.sin(p) * d, -Math.cos(a) * d * Math.cos(p));
          cam.fov = 40; cam.aspect = tile / H; cam.updateProjectionMatrix(); cam.lookAt(0, look, 0);
          R.setViewport(i * tile, 0, tile, H); R.setScissor(i * tile, 0, tile, H); R.render(g.scene, cam);
        });
        // over-the-shoulder gameplay view (CONFIG.camera hip distance + shoulder + lift)
        const C = g.CONFIG.camera, pivot = new T.Vector3(0, h.centerY + C.height, 0);
        const target = pivot.clone().add(new T.Vector3(C.shoulder, C.lift, 0)), pitch = 0.12;
        cam.position.copy(target).add(new T.Vector3(0, Math.sin(pitch) * C.distance, Math.cos(pitch) * C.distance));
        cam.fov = C.fov; cam.aspect = tile / H; cam.updateProjectionMatrix(); cam.lookAt(target);
        R.setViewport(4 * tile, 0, tile, H); R.setScissor(4 * tile, 0, tile, H); R.render(g.scene, cam);
        R.setScissorTest(false);
      }, [type, pose, W, H]);
      const file = path.join(out, `plant-${type}-${pose}.png`);
      await page.screenshot({ path: file });
      console.log('wrote', file);
    }
    }
    if (args.includes('--lineup') || docMode) {
      const type = types[types.length - 1];
      await page.evaluate(([type, W, H, docMode]) => {
        const L = window.__plantLab, g = window.__game, T = L.THREE, R = L.renderer;
        window.__labStage.visible = false;
        const others = (docMode ? ['corn', 'peashooter', 'sunflower', 'cactus', 'citron', 'rose'] : ['corn', 'peashooter', 'sunflower', 'cactus']).filter(t => t !== type);
        const list = [...others, type].map((t, i, a) => {
          const h = t === type ? window.__labHero : L.makeHero(t, false, [0, 0], 10 + i);
          h.mesh.position.set((i - (a.length - 1) / 2) * 1.7, h.centerY, 0); h.mesh.rotation.y = Math.PI;
          L.PLANT_TYPES[t].animate(h, 0); h.mesh.visible = true; h.bar.group.visible = false;
          return h;
        });
        const z = L.spawnZombie('shambler');
        z.mesh.position.set(list.length / 2 * 1.7 + 0.4, z.def.radius + z.def.height / 2, 0); z.mesh.rotation.y = 0; z.mesh.visible = true;
        for (const o of g.scene.children) if (o.isInstancedMesh || o.isSkinnedMesh) o.visible = true;   // horde bodies draw instanced
        L.updateZombieBatches(0);
        L.sun.position.set(-4, 9, 7); L.rimLight.position.set(5, 5, -6);
        const cam = L.camera; cam.aspect = W / H; cam.fov = 30; cam.updateProjectionMatrix();
        const span = list.length * 1.7 + 2;
        cam.position.set(0.6, 1.7, span * 1.45); cam.lookAt(0.6, 1.2, 0);
        R.setViewport(0, 0, W, H); R.render(g.scene, cam);
      }, [type, W, H, docMode]);
      const file = path.join(out, docMode ? 'plant-roster.png' : `plant-${type}-lineup.png`);
      await page.screenshot({ path: file });
      console.log('wrote', file);
    }
  } finally {
    await browser.close(); server.close();
  }
  if (failed) process.exit(1);
})();
