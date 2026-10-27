// Cactus — sniper: model (fluted body, instanced thorns), Garlic Drone model and animation.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { yawForward } from './shared.js';
import { makeMuzzleFlash } from './corn.js';

function buildCactus() {
  const M = CONFIG.cactus.model, root = new THREE.Group(), body = new THREE.Group();
  const pbr = (color, roughness = 0.48, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.48, ...extra });
  const mat = {
    skin: pbr(0xffffff, 0.46, { vertexColors: true }), green: pbr(0x638d14), lid: pbr(0x729b20),
    rim: pbr(0x83a822, 0.4), mouth: pbr(0x251205, 0.88), socket: pbr(0x405818),
    white: pbr(0xe1dbb0, 0.28), iris: pbr(0xa96828, 0.32), pupil: pbr(0x120b09, 0.17),
    glint: pbr(0xfff6df, 0.13), thorn: pbr(0xffffff, 0.43), areole: pbr(0x78542d, 0.84),
    petal: pbr(0xffffff, 0.46, { vertexColors: true, side: THREE.DoubleSide }), stem: pbr(0x586c16),
  };
  // Procedural rind pores break up highlights at close range without image assets.
  mat.skin.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCactusRind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCactusRind = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCactusRind;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nfloat rindGrain = sin(vCactusRind.x * 223.0) * sin(vCactusRind.y * 197.0) * sin(vCactusRind.z * 211.0);\nroughnessFactor = clamp(roughnessFactor + rindGrain * 0.065, 0.32, 0.8);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + 0.018 * vec3(sin(vCactusRind.y * 317.0), sin(vCactusRind.z * 283.0), sin(vCactusRind.x * 307.0)));');
  };
  mat.skin.customProgramCacheKey = () => 'cactus-rind-v1';
  root.add(body);
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const ellipsoid = (parent, material, position, scale) => {
    const mesh = new THREE.Mesh(sphere, material); mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const areoles = [], thorns = [], flecks = [];
  // Analytic tube frames preserve uninterrupted ribs around each bent branch.
  function flutedTube(parent, curve, radiusAt, ribs, segments, radial, decorations = true, face = false) {
    const frames = curve.computeFrenetFrames(segments, false), points = [], colors = [], indices = [];
    const sample = (t, angle) => {
      const i = Math.min(segments, Math.round(t * segments)), c = curve.getPointAt(t);
      const outward = frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle));
      const flute = (Math.cos(angle * ribs) + 1) * 0.5;
      return { p: c.addScaledVector(outward, radiusAt(t) * (0.87 + 0.13 * flute)), n: outward, flute };
    };
    const dark = new THREE.Color(0x2b5611), light = new THREE.Color(0x8fad1e), c = new THREE.Color();
    for (let i = 0; i <= segments; i++) for (let j = 0; j <= radial; j++) {
      const t = i / segments, a = j / radial * Math.PI * 2, s = sample(t, a);
      points.push(s.p.x, s.p.y, s.p.z);
      const grain = Math.sin(j * 29.7 + i * 73.13) * Math.sin(i * 14.8 + j * 6.2) * 0.025;
      c.copy(dark).lerp(light, THREE.MathUtils.clamp(0.28 + 0.58 * s.flute + t * 0.1 + grain, 0, 1));
      colors.push(c.r, c.g, c.b);
      if (i < segments && j < radial) { const k = i * (radial + 1) + j; indices.push(k, k + 1, k + radial + 1, k + 1, k + radial + 2, k + radial + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat.skin); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    if (decorations) {
      for (let row = 1; row <= (face ? 11 : 6); row++) for (let rib = 0; rib < ribs; rib++) {
        const t = 0.07 + row / (face ? 13 : 8) * 0.84, a = (rib + (row % 2) * 0.07) / ribs * Math.PI * 2;
        const s = sample(t, a);
        if (face && s.p.z > 0.22 && s.p.y > 1.75) continue;
        const center = s.p.clone().addScaledVector(s.n, 0.005);
        areoles.push({ parent, p: center, n: s.n, scale: [0.023, 0.037, 0.012] });
        const large = (rib + row) % 3 === 0, len = large ? 0.12 + Math.sin(row * 5 + rib) * 0.035 : 0.052;
        thorns.push({ parent, p: center, n: s.n.clone().add(new THREE.Vector3(0, 0.2, 0)).normalize(), len, radius: large ? 0.025 : 0.011, color: large ? 0xc78068 : 0xb9be6d });
        for (let k = 0; k < 3; k++) {
          const angle = k / 3 * Math.PI * 2;
          thorns.push({ parent, p: center, n: s.n.clone().multiplyScalar(0.35).add(new THREE.Vector3(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0)).normalize(),
            len: 0.04, radius: 0.006, color: 0xcac58a });
        }
      }
    }
    return sample;
  }
  const H = M.height;
  const trunkCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, H, 0));
  const roundedCap = u => Math.sqrt(Math.max(0.0001, 1 - Math.pow(1 - THREE.MathUtils.clamp(u, 0, 1), 2)));
  const trunkRadius = t => M.radius * roundedCap(t / 0.13) * roundedCap((1 - t) / 0.18) * (1 + 0.045 * Math.sin(t * Math.PI));
  flutedTube(body, trunkCurve, trunkRadius, M.ribs, M.heightSegments, M.radialSegments, true, true);
  const feet = [];
  for (const side of [-1, 1]) {
    const foot = new THREE.Group(); foot.position.set(side * 0.18, 0.11, 0.035); root.add(foot);
    ellipsoid(foot, mat.green, [0, 0, 0.02], [0.19, 0.12, 0.23]); feet.push(foot);
  }
  const branches = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.34, side < 0 ? 1.12 : 1.3, 0); body.add(pivot);
    const high = side < 0 ? 0.88 : 1.16;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.32, -0.02, 0),
      new THREE.Vector3(side * 0.53, 0.12, 0), new THREE.Vector3(side * 0.55, high * 0.68, 0),
      new THREE.Vector3(side * 0.55, high, 0),
    ]);
    flutedTube(pivot, curve, t => 0.157 * roundedCap((1 - t) / 0.17) * (1 + Math.sin(t * Math.PI) * 0.04), 7, 48, 56);
    branches.push({ pivot, side });
  }
  // Recessed almond eyes, amber irises and deliberately heavy upper lids.
  const face = new THREE.Group(); face.position.set(0, 2.04, 0.03); body.add(face);
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(side * 0.185, 0.23, 0.365); eye.rotation.y = side * 0.12; face.add(eye);
    ellipsoid(eye, mat.socket, [0, 0, -0.014], [0.165, 0.107, 0.055]);
    const white = ellipsoid(eye, mat.white, [0, -0.005, 0.007], [0.142, 0.079, 0.041]);
    const iris = ellipsoid(eye, mat.iris, [-side * 0.012, -0.009, 0.043], [0.047, 0.048, 0.013]);
    const pupil = ellipsoid(eye, mat.pupil, [-side * 0.012, -0.009, 0.054], [0.023, 0.031, 0.009]);
    ellipsoid(eye, mat.glint, [-side * 0.012 - 0.008, 0.007, 0.063], [0.008, 0.01, 0.004]);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat.lid);
    lid.scale.set(0.157, 0.105, 0.06); lid.rotation.set(0.12, 0, -side * 0.08); lid.position.set(0, 0.013, 0.019); eye.add(lid);
    const lower = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.014, 8, 32, Math.PI), mat.rim);
    lower.rotation.z = Math.PI; lower.scale.y = 0.57; lower.position.set(0, -0.01, 0.035); eye.add(lower);
    eyes.push({ eye, iris, pupil, white, lid });
  }
  // Sculpted flared muzzle: a real open funnel, warm inner shading, dark throat.
  const muzzlePivot = new THREE.Group(); muzzlePivot.position.set(0, -0.035, 0.345); face.add(muzzlePivot);
  const profile = [[0.11, 0], [0.15, 0.04], [0.195, 0.12], [0.215, 0.22], [0.211, 0.29],
    [0.19, 0.33], [0.158, 0.315], [0.14, 0.25], [0.105, 0.12], [0.073, 0.035]];
  const mouthGeo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 64);
  const mouthColors = [], mp = mouthGeo.attributes.position, outer = new THREE.Color(0x789b16), inner = new THREE.Color(0x3c2606);
  for (let i = 0; i < mp.count; i++) {
    const row = i % profile.length, c = row >= 6 ? inner.clone().lerp(outer, Math.max(0, (mp.getY(i) - 0.05) / 0.32)) : outer.clone();
    mouthColors.push(c.r, c.g, c.b);
  }
  mouthGeo.setAttribute('color', new THREE.Float32BufferAttribute(mouthColors, 3));
  const snout = new THREE.Mesh(mouthGeo, mat.skin); snout.rotation.x = Math.PI / 2; muzzlePivot.add(snout);
  // Seat the dark throat ahead of the trunk skin, inside the narrow funnel.
  // This gives a deep opening from every angle without cutting visible seams.
  ellipsoid(muzzlePivot, mat.mouth, [0, 0, 0.125], [0.13, 0.13, 0.018]);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 0.34; muzzlePivot.add(muzzle);
  const flash = makeMuzzleFlash(); flash.rotation.x = Math.PI / 2; flash.position.z = 0.35; flash.scale.setScalar(0.65); muzzlePivot.add(flash);
  const arms = [{ side: 0, muzzle, flash, recoil: 0, flashT: 0, spinSpeed: 0 }];
  // Pale pore clusters along both cheeks are geometry, so they catch real light.
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? -1 : 1, u = (i * 0.61803398875) % 1, v = (i * 0.381966) % 1;
    flecks.push({ p: new THREE.Vector3(side * (0.2 + u * 0.12), 2.04 + v * 0.13, 0.408 - u * 0.055), s: 0.003 + (i % 3) * 0.0015 });
  }
  function petal(parent, length, width, bend, colorA, colorB) {
    const g = new THREE.PlaneGeometry(1, 1, 8, 14), p = g.attributes.position, cs = [];
    const a = new THREE.Color(colorA), b = new THREE.Color(colorB), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, t = p.getY(i) + 0.5, shape = Math.pow(Math.sin(t * Math.PI), 0.68);
      p.setXYZ(i, u * width * shape, t * length, bend * t * t + u * u * width * 0.48 * shape);
      c.copy(a).lerp(b, Math.min(1, t * 1.3) * (1 - Math.pow(Math.abs(u), 3) * 0.8)); cs.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat.petal); m.castShadow = true; parent.add(m); return m;
  }
  const crown = new THREE.Group(); crown.position.y = H - 0.05; body.add(crown);
  for (let i = 0; i < 25; i++) {
    const a = i / 25 * Math.PI * 2, p = new THREE.Group();
    p.position.set(Math.sin(a) * 0.28, -0.03 + Math.sin(i * 9) * 0.025, Math.cos(a) * 0.28);
    p.rotation.set(0.45 + (i % 4) * 0.16, a, Math.sin(i * 7) * 0.22, 'YXZ'); crown.add(p);
    petal(p, 0.23 + (i % 5) * 0.029, 0.048, 0.065, 0x542428, 0xb75c57);
  }
  const flowers = [];
  [[-0.22, 0.55, -0.06, -0.3], [0.04, 0.65, 0, 0.04], [-0.34, 0.39, 0.12, -0.57]].forEach(([x, height, z, tilt], fi) => {
    const flower = new THREE.Group(); flower.position.set(x * 0.5, 0.02, z * 0.5); crown.add(flower);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(x * 0.2, height * 0.5, z), new THREE.Vector3(x * 0.6, height, z)]);
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.014, 8), mat.stem); flower.add(stalk);
    const bud = new THREE.Group(); bud.position.copy(curve.getPoint(1)); bud.rotation.z = tilt; flower.add(bud);
    ellipsoid(bud, mat.green, [0, 0.015, 0], [0.048, 0.052, 0.048]);
    for (let layer = 0; layer < 2; layer++) for (let j = 0; j < 5; j++) {
      const p = new THREE.Group(), a = j / 5 * Math.PI * 2 + layer * 0.55;
      p.rotation.set(layer ? 0.18 : 0.48, a, 0, 'YXZ'); bud.add(p);
      petal(p, layer ? 0.19 : 0.22, layer ? 0.046 : 0.052, layer ? -0.05 : -0.1, 0x942e38, layer ? 0xffe2a4 : 0xeab598);
    }
    flowers.push({ pivot: flower, phase: fi * 2.3 });
  });
  // Batch by parent: each bend can animate while its own thorns remain attached.
  for (const parent of [body, ...branches.map(b => b.pivot)]) {
    const entries = areoles.filter(a => a.parent === parent), needles = thorns.filter(a => a.parent === parent);
    const aMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat.areole, entries.length);
    const tMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat.thorn, needles.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), scale = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    entries.forEach((a, i) => { q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.n); aMesh.setMatrixAt(i, m.compose(a.p, q, scale.set(...a.scale))); });
    needles.forEach((a, i) => {
      q.setFromUnitVectors(up, a.n); scale.set(a.radius, a.len, a.radius);
      tMesh.setMatrixAt(i, m.compose(a.p.clone().addScaledVector(a.n, a.len * 0.43), q, scale)); tMesh.setColorAt(i, new THREE.Color(a.color));
    });
    aMesh.castShadow = tMesh.castShadow = true; parent.add(aMesh, tMesh);
  }
  const freckles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat.rim, flecks.length), matrix = new THREE.Matrix4();
  flecks.forEach((f, i) => freckles.setMatrixAt(i, matrix.compose(f.p, new THREE.Quaternion(), new THREE.Vector3(f.s, f.s, f.s * 0.4)))); body.add(freckles);
  root.name = 'Cactus · fluted botanical sculpt';
  return { root, body, face, eyes, feet, branches, crown, flowers, muzzlePivot, arms };
}

function cactusEllipsoid(parent, material, pos, scale) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material); m.position.set(...pos); m.scale.set(...scale);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

function makeGarlicDrone() {
  const mesh = new THREE.Group(), ivory = new THREE.MeshStandardMaterial({ color: 0xe8dfc4, roughness: 0.52 });
  const purple = new THREE.MeshStandardMaterial({ color: 0xb59baf, roughness: 0.57 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4e8a2a, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x292c1a, roughness: 0.4 });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    cactusEllipsoid(mesh, i % 3 ? ivory : purple, [Math.sin(a) * 0.18, 0, Math.cos(a) * 0.18], [0.15, 0.26, 0.15]);
  }
  cactusEllipsoid(mesh, ivory, [0, 0.22, 0], [0.1, 0.22, 0.1]);
  for (const side of [-1, 1]) {
    cactusEllipsoid(mesh, dark, [side * 0.105, 0.03, 0.31], [0.043, 0.057, 0.018]);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 10), ivory); tip.rotation.x = Math.PI / 2; tip.position.set(side * 0.1, -0.18, 0.32); mesh.add(tip);
  }
  const rotor = new THREE.Group(); rotor.position.y = 0.4; mesh.add(rotor);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Group(); p.rotation.y = i / 4 * Math.PI * 2; rotor.add(p);
    const blade = cactusEllipsoid(p, leaf, [0, 0, 0.35], [0.085, 0.018, 0.4]); blade.rotation.z = 0.1;
  }
  return { mesh, rotor };
}

function animateCactus(h, dt) {
  const C = h.corn, A = h.anim, moving = Math.min(1, Math.hypot(h.vel.x, h.vel.z) / h.stats.speed);
  A.t += dt; A.phase += dt * 10 * moving; A.squash *= Math.exp(-dt * 11);
  const smooth = 1 - Math.exp(-dt * 9), f = yawForward(h.yaw);
  A.leanF += ((h.vel.x * f.x + h.vel.z * f.z) / h.stats.speed - A.leanF) * smooth;
  A.leanS += ((h.vel.x * -f.z + h.vel.z * f.x) / h.stats.speed - A.leanS) * smooth;
  C.root.rotation.x += ((h.downed ? 1.42 : 0) - C.root.rotation.x) * smooth;
  const recoil = C.arms[0]; recoil.recoil *= Math.exp(-dt * 13); recoil.flashT -= dt; recoil.flash.visible = !h.dead && recoil.flashT > 0;
  if (h.downed) return;
  const breath = Math.sin(A.t * 2.1), reload = h.reloading ? Math.sin(Math.PI * (1 - h.reloadT / h.weapon.reloadTime)) : 0;
  C.body.position.y = Math.abs(Math.sin(A.phase)) * 0.045 * moving + breath * 0.006 - A.squash * 0.2;
  C.body.rotation.set(A.leanF * 0.09 - h.aimElev * 0.075 + recoil.recoil * 0.025, Math.sin(A.phase) * 0.025 * moving,
    -Math.sin(A.phase) * 0.045 * moving - A.leanS * 0.065);
  C.root.scale.set(1 + A.squash * 0.25, 1 - A.squash * 0.4, 1 + A.squash * 0.25);
  C.face.rotation.x = -h.aimElev * 0.68 + reload * 0.18;
  C.muzzlePivot.position.z = 0.345 - recoil.recoil * 0.055;
  C.muzzlePivot.scale.setScalar(1 + recoil.recoil * 0.045 + reload * 0.04);
  C.branches.forEach(({ pivot, side }) => {
    pivot.rotation.z = side * (breath * 0.013 + reload * 0.12) + Math.sin(A.phase + side) * moving * 0.035;
    pivot.rotation.x = A.leanF * -0.065 + Math.sin(A.t * 2 + side) * 0.018;
  });
  C.feet.forEach((p, i) => { const step = Math.sin(A.phase + i * Math.PI); p.position.y = 0.11 + Math.max(0, step) * moving * 0.075; p.rotation.x = step * moving * 0.2; });
  C.flowers.forEach(({ pivot, phase }) => { pivot.rotation.z = Math.sin(A.t * 2.8 + phase) * 0.055 - A.leanS * 0.09; pivot.rotation.x = Math.sin(A.t * 2 + phase) * 0.035 + recoil.recoil * 0.08; });
  A.blink -= dt; if (A.blink < 0) A.blink = 3.5 + Math.random() * 3;
  C.eyes.forEach(({ eye, lid }) => { eye.scale.y = A.blink < 0.12 ? 0.15 : 1; lid.rotation.x = 0.12 - h.zoom * 0.16 + reload * 0.08; });
}

export { buildCactus, cactusEllipsoid, makeGarlicDrone, animateCactus };
