// Sunflower — medic: model, Heal Flower model and animation.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { yawForward, animFwd, animRight } from './shared.js';
import { makeMuzzleFlash } from './corn.js';

// =====================================================================
// Sunflower — sculpted, closed petal volumes and veined leaves; no image assets.
// The front and back both matter in a third-person game: the back has a layered
// calyx, spiral seed florets, overlapping sepals and a ribbed, bending stem.
// =====================================================================
function sunflowerTube(points, radius, material, segments = 28, sides = 7) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, sides, false), material);
}
function sunflowerBatch(parent, meshes, material) {
  if (!meshes.length) return null;
  const geometries = meshes.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
  const merged = mergeGeometries(geometries, false);
  geometries.forEach(g => g.dispose()); meshes.forEach(m => m.geometry.dispose());
  const mesh = new THREE.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
function sunflowerPetal(length, width, seed = 0, back = false) {
  const M = CONFIG.SUNFLOWER.model, rows = M.petalSegments, sides = M.petalSides;
  const positions = [], colors = [], indices = [];
  const root = new THREE.Color(M.petalRoot), gold = new THREE.Color(M.petalGold), tip = new THREE.Color(M.petalTip), c = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const t = (1 - Math.cos(i / rows * Math.PI)) / 2, shape = Math.pow(Math.sin(Math.PI * t), 0.44);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2, u = Math.cos(a), front = Math.sin(a);
      const w = width * 0.5 * shape * (0.8 + 0.2 * t);
      // Five subtle longitudinal channels are sculpted into the face, not painted on.
      const groove = Math.pow(Math.cos(u * Math.PI * 2.5 + seed * 0.3), 8) * 0.011 * shape * Math.max(0, front);
      const z = Math.sin(t * Math.PI) * 0.075 - t * t * (back ? 0.08 : 0.055)
        + front * shape * 0.047 - groove + Math.sin(t * 8 + seed) * u * shape * 0.01;
      positions.push(u * w + Math.sin(t * Math.PI) * Math.sin(seed * 3) * 0.018, t * length, z);
      if (t < 0.36) c.lerpColors(root, gold, t / 0.36); else c.lerpColors(gold, tip, (t - 0.36) / 0.64);
      c.multiplyScalar((back ? 0.86 : 1) * (0.89 + 0.11 * front) * (1 - groove * 5));
      colors.push(c.r, c.g, c.b);
      if (i < rows && j < sides) { const k = i * (sides + 1) + j; indices.push(k, k + sides + 2, k + 1, k, k + sides + 1, k + sides + 2); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals(); return geo;
}
function sunflowerLeaf(length, width, curl, material, withVeins = true) {
  const M = CONFIG.SUNFLOWER.model, rows = M.leafSegments, sides = M.leafSides;
  const positions = [], colors = [], indices = [], dark = new THREE.Color(M.leafDark), light = new THREE.Color(M.leafTip), c = new THREE.Color();
  const surface = (t, u) => {
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.7) * (1 - 0.2 * t);
    return [u * width * 0.5 * envelope, t * length,
      curl * t * t - curl * 0.75 * Math.pow(t, 6) + u * u * 0.11 * envelope + Math.sin(t * 22 + Math.abs(u) * 8) * 0.008 * Math.abs(u)];
  };
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= sides; j++) {
    const t = i / rows, a = j / sides * Math.PI * 2, u = Math.cos(a), p = surface(t, u);
    p[2] += Math.sin(a) * 0.012 * Math.sin(Math.PI * t); positions.push(...p);
    c.lerpColors(dark, light, 0.2 + t * 0.65 + Math.max(0, Math.sin(a)) * 0.15);
    c.multiplyScalar(1 - Math.abs(u) * 0.12); colors.push(c.r, c.g, c.b);
    if (i < rows && j < sides) { const k = i * (sides + 1) + j; indices.push(k, k + sides + 2, k + 1, k, k + sides + 1, k + sides + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setIndex(indices); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const g = new THREE.Group(), blade = new THREE.Mesh(geo, material); blade.castShadow = blade.receiveShadow = true; g.add(blade);
  if (withVeins) {
    const veinMat = new THREE.MeshStandardMaterial({ color: M.leafTip, roughness: 0.62 });
    const veins = [], spine = [];
    for (let j = 0; j <= 12; j++) { const p = surface(j / 12, 0); p[2] += 0.017; spine.push(p); }
    veins.push(sunflowerTube(spine, 0.007, veinMat, 24, 5));
    for (let i = 2; i < 8; i++) for (const side of [-1, 1]) {
      const t = i / 10, branch = [surface(t, 0), surface(t + 0.06, side * 0.43), surface(t + 0.12, side * 0.88)];
      branch.forEach(p => p[2] += 0.014); veins.push(sunflowerTube(branch, 0.003, veinMat, 9, 4));
    }
    // Both surfaces are visible as a leaf curls; carry the veins onto its underside.
    const underside = veins.map(v => { const m = v.clone(); m.geometry = v.geometry.clone(); m.position.z = -0.034; return m; });
    sunflowerBatch(g, [...veins, ...underside], veinMat);
  }
  return g;
}
function buildSunflower() {
  const M = CONFIG.SUNFLOWER.model;
  // Per-rig materials keep expression/ability glow independent for duplicate Sunflowers.
  const petalMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.48,
    clearcoat: 0.16, clearcoatRoughness: 0.45, sheen: 0.18, sheenColor: new THREE.Color(0xffe884), side: THREE.DoubleSide });
  const leafMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.52,
    clearcoat: 0.22, clearcoatRoughness: 0.6, sheen: 0.2, sheenColor: new THREE.Color(M.leafTip), side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: M.stem, roughness: 0.5 });
  const veinMat = new THREE.MeshStandardMaterial({ color: 0x98b849, roughness: 0.58 });
  const root = new THREE.Group(), hips = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
  root.name = 'Sunflower'; root.add(hips); hips.add(torso); head.position.set(0, M.headY, 0); torso.add(head);
  const sphere = (parent, pos, scale, material, detail = 24) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.round(detail * 0.75)), material);
    m.position.set(...pos); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  // The stem has a deliberately organic S profile, longitudinal ribs and growth nodes.
  const stemPath = [[0, 0.12, 0], [-0.04, 0.5, 0.01], [0.025, 0.95, -0.04], [0.04, 1.4, -0.04], [0, M.headY, -0.09]];
  torso.add(sunflowerTube(stemPath, M.stemRadius, stemMat, 40, 14));
  const ribs = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    ribs.push(sunflowerTube(stemPath.map(([x, y, z]) => [x + Math.cos(a) * M.stemRadius * 0.94, y, z + Math.sin(a) * M.stemRadius * 0.94]), 0.009, veinMat, 32, 5));
  }
  sunflowerBatch(torso, ribs, veinMat);
  for (const y of [0.24, 0.73, 1.26, 1.72]) sphere(torso, [0, y, -0.018], [0.088, 0.034, 0.081], stemMat, 14);
  sphere(torso, [0, 0.22, 0], [0.16, 0.27, 0.14], stemMat);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const yaw = [0.62, -0.62, 2.35, -2.35][i], pivot = new THREE.Group();
    pivot.position.set(Math.sin(yaw) * 0.07, 0.19, Math.cos(yaw) * 0.07); pivot.rotation.set(1.52, yaw, 0, 'YXZ');
    pivot.userData.base = pivot.rotation.clone(); hips.add(pivot);
    pivot.add(sunflowerLeaf(i < 2 ? 0.98 : 0.78, i < 2 ? 0.69 : 0.52, 0.32, leafMat));
    legs.push({ pivot, phase: i % 2 * Math.PI });
  }
  // Two dangling stems ending in the small star-shaped leaf hands in the reference.
  const hands = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.06, 1.46, -0.015); torso.add(pivot);
    pivot.add(sunflowerTube([[0, 0, 0], [side * 0.2, -0.09, 0.02], [side * 0.37, -0.23, 0.055], [side * 0.4, -0.39, 0.11]], 0.024, stemMat, 24, 7));
    const palm = new THREE.Group(); palm.position.set(side * 0.4, -0.39, 0.11); pivot.add(palm);
    sphere(palm, [0, 0, 0], [0.09, 0.09, 0.06], stemMat);
    for (let j = 0; j < 6; j++) {
      const finger = sunflowerLeaf(0.22, 0.09, -0.1, leafMat, false);
      finger.rotation.z = j / 6 * Math.PI * 2; palm.add(finger);
    }
    hands.push({ pivot, palm, side });
  }
  const petals = [];
  for (let layer = 0; layer < 2; layer++) {
    const back = layer === 0, n = back ? M.backPetals : M.petalCount;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + (back ? 0.13 : 0), pivot = new THREE.Group();
      pivot.position.set(Math.sin(a) * M.petalBase, Math.cos(a) * M.petalBase * 0.87, back ? -0.14 : -0.025);
      pivot.rotation.set((back ? -0.12 : 0.035) + Math.sin(i * 2.3) * 0.045, 0, -a);
      const length = M.petalLength * (1 + Math.sin(i * 3.7 + layer) * 0.075) * (back ? 0.93 : 1);
      const petal = new THREE.Mesh(sunflowerPetal(length, M.petalWidth * (back ? 0.92 : 1), i, back), petalMat);
      petal.castShadow = petal.receiveShadow = true; pivot.add(petal); head.add(pivot);
      petals.push({ pivot, base: pivot.rotation.clone(), phase: a, back });
    }
  }
  // Back-of-head calyx: concentric green discs and golden-angle seed scales.
  sphere(head, [0, 0, -0.14], [0.57, 0.5, 0.17], stemMat, 40);
  const seedMat = new THREE.MeshStandardMaterial({ color: 0x7e9431, roughness: 0.7 }), seeds = [];
  for (let i = 0; i < 145; i++) {
    const a = i * 2.399963, r = Math.sqrt((i + 0.5) / 145) * 0.44;
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), seedMat);
    s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.86, -0.306 + r * r * 0.22);
    s.scale.set(0.026, 0.037, 0.014); s.rotation.z = a; seeds.push(s);
  }
  sunflowerBatch(head, seeds, seedMat);
  const sepals = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, leaf = sunflowerLeaf(0.47, 0.19, -0.13, leafMat, false);
    leaf.position.set(Math.sin(a) * 0.26, Math.cos(a) * 0.23, -0.27); leaf.rotation.set(0.08, Math.PI, a);
    head.add(leaf); sepals.push(leaf);
  }
  // A rounded, cheek-heavy face. Vertex colour places warmth in the cheeks and chin.
  const faceGeo = new THREE.SphereGeometry(1, M.faceSegments, M.faceRings), fp = faceGeo.attributes.position, faceColors = [];
  const faceBase = new THREE.Color(M.face), cheek = new THREE.Color(0xec7b25), fc = new THREE.Color();
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i), width = M.faceWidth * (1 - Math.max(0, y) * 0.13);
    fp.setXYZ(i, x * width, y * M.faceHeight, z * M.faceDepth * (1 + Math.max(0, -y) * 0.16));
    const blush = Math.exp(-((Math.abs(x) - 0.7) ** 2 * 26 + (y + 0.1) ** 2 * 17)) * Math.max(0, z);
    fc.copy(faceBase).lerp(cheek, blush * 0.6 + Math.max(0, -y) * 0.12).multiplyScalar(0.95 + y * 0.05);
    faceColors.push(fc.r, fc.g, fc.b);
  }
  faceGeo.setAttribute('color', new THREE.Float32BufferAttribute(faceColors, 3)); faceGeo.computeVertexNormals();
  const faceMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.48,
    clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.16, sheenColor: new THREE.Color(0xffc66f) });
  const face = new THREE.Mesh(faceGeo, faceMat); face.position.z = 0.035; face.castShadow = face.receiveShadow = true; head.add(face);
  const frontZ = (x, y) => {
    const ny = y / M.faceHeight, width = M.faceWidth * (1 - Math.max(0, ny) * 0.13);
    return 0.035 + M.faceDepth * Math.sqrt(Math.max(0.06, 1 - (x / width) ** 2 - ny ** 2)) * (1 + Math.max(0, -ny) * 0.16);
  };
  const eyeSocket = new THREE.MeshStandardMaterial({ color: 0xb66b1d, roughness: 0.42 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x241006, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25 });
  const amber = new THREE.MeshStandardMaterial({ color: 0x85421a, roughness: 0.22 });
  const highlight = new THREE.MeshBasicMaterial({ color: 0xfff4d9, toneMapped: false });
  const eyes = [], pupils = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(), x = side * 0.255, y = 0.105; eye.position.set(x, y, frontZ(x, y)); head.add(eye);
    sphere(eye, [0, 0, -0.006], [0.108, 0.153, 0.025], eyeSocket);
    sphere(eye, [0, -0.005, 0.012], [0.087, 0.131, 0.034], amber);
    const pupil = new THREE.Group(); eye.add(pupil);
    sphere(pupil, [0, 0.007, 0.034], [0.067, 0.112, 0.028], eyeMat, 32);
    sphere(pupil, [-0.022, 0.058, 0.061], [0.019, 0.035, 0.006], highlight, 14);
    sphere(pupil, [0.025, -0.048, 0.057], [0.008, 0.012, 0.004], highlight, 10);
    eyes.push(eye); pupils.push(pupil);
  }
  // Smile follows the curved face exactly; soft lower lip catches a warm rim light.
  const smileMat = new THREE.MeshStandardMaterial({ color: 0x7f461c, roughness: 0.65 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xf5a744, roughness: 0.55 });
  const smile = [], lip = [];
  for (let i = 0; i <= 32; i++) {
    const x = (i / 32 * 2 - 1) * 0.475, y = -0.225 + Math.pow(x / 0.475, 2) * 0.115;
    smile.push([x, y, frontZ(x, y) + 0.006]); lip.push([x, y - 0.023, frontZ(x, y - 0.023) + 0.005]);
  }
  head.add(sunflowerTube(smile, 0.008, smileMat, 48, 7), sunflowerTube(lip, 0.009, lipMat, 48, 7));
  for (const side of [-1, 1]) {
    const x = side * 0.475;
    head.add(sunflowerTube([[x - side * 0.025, -0.08, frontZ(x, -0.08)], [x, -0.11, frontZ(x, -0.11) + 0.008], [x + side * 0.012, -0.145, frontZ(x, -0.145)]], 0.009, smileMat, 10, 6));
  }
  const freckleMat = new THREE.MeshStandardMaterial({ color: 0xc28624, roughness: 0.85 }), freckles = [];
  for (let i = 0; i < M.freckles; i++) {
    const a = i * 2.399963, r = Math.sqrt((i + 0.5) / M.freckles), x = Math.cos(a) * r * 0.16, y = 0.045 + Math.sin(a) * r * 0.16;
    const freckle = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), freckleMat);
    const size = 0.0035 + (Math.sin(i * 7.3) + 1) * 0.0015;
    freckle.position.set(x, y, frontZ(x, y) + 0.002); freckle.scale.set(size, size * 0.8, 0.0018); freckles.push(freckle);
  }
  sunflowerBatch(head, freckles, freckleMat);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.15, 0.4); head.add(muzzle);
  const flash = makeMuzzleFlash(); flash.rotation.x = Math.PI / 2; muzzle.add(flash);
  const arms = [{ muzzle, flash, recoil: 0, flashT: 0, spinSpeed: 0, side: 0 }];
  const roots = new THREE.Group(); root.add(roots); roots.visible = false;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    roots.add(sunflowerTube([[0, 0.16, 0], [Math.sin(a) * 0.38, 0.18, Math.cos(a) * 0.38], [Math.sin(a) * 0.68, 0.035, Math.cos(a) * 0.68]], 0.027, stemMat, 18, 6));
  }
  return { root, hips, torso, head, face, eyes, pupils, legs, hands, petals, sepals, arms, roots, petalMat, faceMat };
}

function buildHealFlower() {
  const root = new THREE.Group(), leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const green = new THREE.MeshStandardMaterial({ color: CONFIG.SUNFLOWER.model.stem, roughness: 0.6 });
  const potMat = new THREE.MeshStandardMaterial({ color: 0xa85f35, roughness: 0.76 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.16, 0.3, 20), potMat); pot.position.y = 0.15; root.add(pot);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 8, 24), potMat); lip.rotation.x = Math.PI / 2; lip.position.y = 0.3; root.add(lip);
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.015, 20), new THREE.MeshStandardMaterial({ color: 0x40311e })); dirt.position.y = 0.3; root.add(dirt);
  root.add(sunflowerTube([[0, 0.3, 0], [0.03, 0.48, 0], [0, 0.78, 0]], 0.035, green, 14, 7));
  for (const side of [-1, 1]) { const leaf = sunflowerLeaf(0.42, 0.22, 0.15, leafMat, false); leaf.position.y = 0.4; leaf.rotation.set(0.8, side * 1.1, side * 0.7); root.add(leaf); }
  const head = new THREE.Group(); head.position.y = 0.82; root.add(head);
  const petals = [], material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2, petal = new THREE.Mesh(sunflowerPetal(0.23, 0.13, i), material);
    petal.position.set(Math.sin(a) * 0.16, Math.cos(a) * 0.16, -0.025); petal.rotation.z = -a; petals.push(petal);
  }
  sunflowerBatch(head, petals, material);
  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf7b232, roughness: 0.55 })); face.scale.set(0.205, 0.18, 0.09); head.add(face);
  const black = new THREE.MeshStandardMaterial({ color: 0x2c1a0a, roughness: 0.18 });
  for (const side of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), black); eye.position.set(side * 0.07, 0.035, 0.087); eye.scale.set(0.022, 0.04, 0.012); head.add(eye); }
  head.add(sunflowerTube([[-0.09, -0.035, 0.084], [0, -0.07, 0.095], [0.09, -0.035, 0.084]], 0.005, black, 12, 5));
  root.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return { root, head };
}

function animateSunflower(h, dt) {
  const C = h.corn, A = h.anim, M = CONFIG.SUNFLOWER.model, s = h.sun;
  A.t += dt;
  const ease = 1 - Math.exp(-dt * 11), speed = Math.hypot(h.vel.x, h.vel.z), stride = h.onGround ? Math.min(1, speed / h.stats.speed) : 0;
  A.phase += dt * M.strideRate * stride;
  C.root.rotation.x += ((h.downed ? 1.45 : 0) - C.root.rotation.x) * ease;
  if (h.downed) { C.arms[0].flash.visible = false; return; }
  const forward = yawForward(h.yaw, animFwd), right = animRight.set(-forward.z, 0, forward.x);
  A.leanF += (h.vel.dot(forward) / h.stats.speed - A.leanF) * ease;
  A.leanS += (h.vel.dot(right) / h.stats.speed - A.leanS) * ease;
  A.air += ((h.onGround ? 0 : 1) - A.air) * ease; A.squash *= Math.exp(-dt * 12);
  const rooted = s?.sunbeam ? 1 : 0, breathe = Math.sin(A.t * M.breathe);
  C.hips.position.y = Math.abs(Math.sin(A.phase)) * M.bob * stride + breathe * 0.012 - A.squash * 0.25 - rooted * 0.11;
  C.hips.rotation.z = Math.sin(A.phase) * M.sway * stride;
  C.torso.rotation.x = A.leanF * 0.12 + Math.sin(A.t * 1.8) * 0.012 * (1 - stride);
  C.torso.rotation.z = A.leanS * 0.1;
  const stretch = THREE.MathUtils.clamp(h.vel.y * 0.009, -0.06, 0.07) * A.air - A.squash * 0.6;
  C.root.scale.set(1 - stretch * 0.4, 1 + stretch, 1 - stretch * 0.4);
  const arm = C.arms[0]; arm.recoil *= Math.exp(-dt * M.recoilRecovery); arm.flashT -= dt;
  arm.flash.visible = arm.flashT > 0; arm.flash.scale.setScalar(0.45);
  const reload = h.reloading ? Math.sin(Math.PI * (1 - h.reloadT / h.weapon.reloadTime)) : 0;
  C.head.rotation.x = -h.aimElev * 0.68 - arm.recoil * M.recoil + breathe * 0.012 + reload * 0.18;
  C.head.rotation.z = -C.hips.rotation.z * 0.7 + Math.sin(A.t * 1.4) * 0.012 * (1 - stride) + reload * 0.09;
  C.head.position.y = M.headY + breathe * 0.008;
  C.head.position.z = -arm.recoil * M.recoil;
  for (const l of C.legs) {
    const b = l.pivot.userData.base, step = Math.sin(A.phase + l.phase);
    l.pivot.rotation.x = b.x - Math.max(0, step) * 0.38 * stride - A.air * 0.3 - rooted * 0.08;
    l.pivot.position.y = 0.19 + Math.max(0, step) * 0.09 * stride;
  }
  for (const hand of C.hands) {
    hand.pivot.rotation.z = Math.sin(A.phase + hand.side) * stride * 0.22 - A.leanS * 0.15;
    hand.pivot.rotation.x = Math.sin(A.phase + hand.side * Math.PI / 2) * stride * 0.25 - A.air * 0.35;
    hand.palm.rotation.z = Math.sin(A.t * 2.8 + hand.side) * 0.13;
  }
  for (const petal of C.petals) {
    const wave = Math.sin(A.t * 3.1 + petal.phase * 2) * M.petalFlutter;
    petal.pivot.rotation.x = petal.base.x + wave + arm.recoil * 0.045 + reload * 0.08 + rooted * (0.09 + (s?.beamFlash || 0) * 0.05);
    petal.pivot.rotation.z = petal.base.z + Math.sin(A.phase + petal.phase) * stride * 0.016;
  }
  C.petalMat.emissive.setHex(CONFIG.SUNFLOWER.fx.pulseColor); C.petalMat.emissiveIntensity = (s?.beamFlash || 0) * 0.1 + reload * 0.025;
  A.blink -= dt;
  if (A.blink < -0.15) A.blink = THREE.MathUtils.lerp(...M.blinkInterval, Math.random());
  const lid = A.blink < 0.12 ? Math.max(0.08, Math.abs(A.blink - 0.01) / 0.11) : 1;
  C.eyes.forEach((e, i) => { e.scale.y = Math.min(1, lid); C.pupils[i].position.x = A.leanS * 0.008; });
  C.roots.visible = !!s?.sunbeam;
  C.roots.scale.setScalar(s?.sunbeam ? Math.min(1, (1 - s.deploy / h.abilities.huskHop.deployTime) * 1.2) : 0.01);
}

export { sunflowerTube, sunflowerBatch, sunflowerPetal, sunflowerLeaf, buildSunflower, buildHealFlower, animateSunflower };
