// Plant hero models: Kernel Corn, Peashooter and Sunflower (procedural geometry and materials, no asset files).
// index.html imports this module behind the loading screen, after three.js (section "Plant models").
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

// =====================================================================
// Kernel Corn — the hero model, built entirely from procedural primitives.
// Model space: feet at y = 0, facing +Z. Leaves are bent/folded planes,
// cobs are a lathe core covered in instanced kernels.
// =====================================================================
const CORN_MAT = {
  kernel:   new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, envMapIntensity: 0.6 }),
  cobCore:  new THREE.MeshStandardMaterial({ color: 0xc7900f, roughness: 0.7, envMapIntensity: 0.4 }),
  skin:     new THREE.MeshStandardMaterial({ color: 0xf2bf2a, roughness: 0.45, envMapIntensity: 0.6 }),
  leaf:     new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
  stalk:    new THREE.MeshStandardMaterial({ color: 0x3b7a22, roughness: 0.55, envMapIntensity: 0.5 }),
  eyeWhite: new THREE.MeshStandardMaterial({ color: 0xfafaf0, roughness: 0.12, envMapIntensity: 0.9 }),
  pupil:    new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.05, envMapIntensity: 1.2 }),
  brow:     new THREE.MeshStandardMaterial({ color: 0xc98a12, roughness: 0.5 }),
  mouth:    new THREE.MeshStandardMaterial({ color: 0x3a1806, roughness: 0.8 }),
  teeth:    new THREE.MeshStandardMaterial({ color: 0xfff4d8, roughness: 0.25, envMapIntensity: 0.8 }),
};
const KERNEL_GEO = new THREE.SphereGeometry(1, 10, 8);

// A leaf blade: grows along +Y, curls toward +Z by `bend` radians over its length,
// edges folded up around the midrib (`fold`), optional `twist`. Vertex colors give a
// dark base → bright tip gradient with a lighter midrib.
function makeLeaf({ length = 1, width = 0.3, bend = 1, fold = 0.35, twist = 0, base = 0.25,
                    dark = 0x1c561a, light = 0x5fae3c }) {
  const geo = new THREE.PlaneGeometry(1, 1, 6, 18);
  const pos = geo.attributes.position;
  const colors = [];
  const cDark = new THREE.Color(dark), cLight = new THREE.Color(light), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);          // -0.5..0.5 across the blade
    const v = pos.getY(i) + 0.5;    // 0..1 along the blade
    // Outline: some width at the base, widest ~30% along, sharp tip
    const w = width * (base * (1 - v) + (1 - base) * Math.sin(Math.PI * Math.pow(v, 0.55)));
    const across = u * w;
    const tw = twist * v;
    const off = Math.abs(u) * 2 * w * fold + across * Math.sin(tw);   // offset along the spine normal
    const a = bend * v;
    const sy = bend ? Math.sin(a) / bend * length : v * length;
    const sz = bend ? (1 - Math.cos(a)) / bend * length : 0;
    pos.setXYZ(i, across * Math.cos(tw), sy - Math.sin(a) * off, sz + Math.cos(a) * off);
    c.lerpColors(cDark, cLight, 0.15 + 0.85 * Math.pow(v, 0.7));
    if (Math.abs(u) < 0.01) c.offsetHSL(0.01, -0.1, 0.1);            // midrib
    else c.offsetHSL(0, 0, -0.06 * Math.abs(u) * 2);                 // darker edges
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, CORN_MAT.leaf);
  mesh.castShadow = true;
  return mesh;
}

// Attach a leaf on a pivot at (x,y,z): yaw around Y, then tilt away from vertical toward the yaw direction.
// The pivot remembers its rest rotation in userData.base so animation can add on top of it.
function placeLeaf(parent, opts, x, y, z, yaw, tilt, roll = 0) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.rotation.set(tilt, yaw, roll, 'YXZ');
  pivot.userData.base = pivot.rotation.clone();
  pivot.add(makeLeaf(opts));
  parent.add(pivot);
  return pivot;
}

// A corn cob along +Y (base at 0): tapered lathe core + staggered rows of instanced kernels.
// `skip(angle, t)` can carve out kernels (used for the face). Angle 0 = +Z.
function makeCob({ length, radius, rows = 12, tipTaper = 0.45, skip = null }) {
  const group = new THREE.Group();
  const profile = t => radius * (1 - tipTaper * t * t) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 8)))
                              * Math.sqrt(Math.min(1, (t + 0.03) / 0.14));
  const pts = [];
  for (let i = 0; i <= 28; i++) { const t = i / 28; pts.push(new THREE.Vector2(profile(t) * 0.86, t * length)); }
  const core = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), CORN_MAT.cobCore);
  core.castShadow = true;
  group.add(core);

  const ringStep = (2 * Math.PI * radius) / rows * 0.95;
  const rings = Math.floor(length / ringStep);
  const list = [];
  for (let r = 0; r < rings; r++) {
    const t = (r + 0.5) / rings;
    const rad = profile(t);
    if (rad < radius * 0.22) continue;
    const n = Math.max(5, Math.round(rows * rad / radius));
    for (let k = 0; k < n; k++) {
      const a = ((k + (r % 2) * 0.5) / n) * Math.PI * 2;
      if (skip && skip(Math.atan2(Math.sin(a), Math.cos(a)), t)) continue;
      list.push({ a, y: t * length, rad, s: (2 * Math.PI * rad / n) * 0.62 });
    }
  }
  const im = new THREE.InstancedMesh(KERNEL_GEO, CORN_MAT.kernel, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
        sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  list.forEach((k, i) => {
    p.set(Math.sin(k.a) * k.rad, k.y, Math.cos(k.a) * k.rad);
    q.setFromEuler(e.set(0, k.a, 0));                // local +Z points outward
    sc.set(k.s, ringStep * 0.64, k.s * 0.6);
    im.setMatrixAt(i, m.compose(p, q, sc));
    col.setHSL(0.115 + (Math.random() - 0.5) * 0.02, 0.95, 0.43 + (Math.random() - 0.5) * 0.08);
    im.setColorAt(i, col);
  });
  im.castShadow = true;
  group.add(im);
  return group;
}

function makeMuzzleFlash() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 7), mat);
  cone.position.y = 0.22;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
  g.add(cone, core);
  g.visible = false;
  return g;
}

function buildKernelCorn() {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  const HIPS_Y = 0.52;
  hips.position.y = HIPS_Y;
  root.add(hips);

  // --- Leaf feet: four broad blades splayed on the ground, tips curling up ---
  const legs = [];
  const footLeaf = { length: 1.0, width: 0.4, bend: -1.25, fold: 0.35, base: 0.35, dark: 0x174a15, light: 0x4f9a33 };
  [[0.6, 0], [-0.6, Math.PI], [Math.PI - 0.75, Math.PI], [Math.PI + 0.75, 0]].forEach(([yaw, phase]) => {
    legs.push({ pivot: placeLeaf(hips, footLeaf, 0, 0.02, 0, yaw, 2.55), phase });
  });

  // --- Torso: stalk + chest/back leaves wrapping it ---
  const torso = new THREE.Group();
  hips.add(torso);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 16), CORN_MAT.stalk);
  stalk.position.y = 0.35;
  stalk.castShadow = true;
  torso.add(stalk);
  // stalk nodes (rings) for that plant-stem look
  for (const y of [0.05, 0.42]) {
    const node = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.025, 8, 18), CORN_MAT.stalk);
    node.rotation.x = Math.PI / 2;
    node.position.y = y;
    torso.add(node);
  }
  const chestLeaf = { length: 0.9, width: 0.66, bend: -0.55, fold: 0.32, base: 0.55, dark: 0x1d5c1a, light: 0x62b03f };
  placeLeaf(torso, chestLeaf, 0, 0.86, 0.1, 0, Math.PI - 0.1);
  placeLeaf(torso, { ...chestLeaf, width: 0.55, length: 0.8 }, 0, 0.84, -0.08, Math.PI, Math.PI - 0.12);
  placeLeaf(torso, { ...chestLeaf, width: 0.42, length: 0.7 }, 0.08, 0.82, 0, Math.PI / 2, Math.PI - 0.15);
  placeLeaf(torso, { ...chestLeaf, width: 0.42, length: 0.7 }, -0.08, 0.82, 0, -Math.PI / 2, Math.PI - 0.15);

  // --- Head: big cob with a carved-out face ---
  const head = new THREE.Group();
  head.position.set(0, 0.9, 0.02);
  torso.add(head);
  const HEAD_LEN = 1.2, HEAD_R = 0.31;
  const faceSkip = (a, t) => Math.abs(a) < 0.95 && t > 0.08 && t < 0.72;
  const headCob = makeCob({ length: HEAD_LEN, radius: HEAD_R, rows: 20, tipTaper: 0.5, skip: faceSkip });
  headCob.position.y = -0.05;
  head.add(headCob);
  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), CORN_MAT.skin);
  face.scale.set(0.28, 0.4, 0.2);
  face.position.set(0, 0.43, 0.13);
  face.castShadow = true;
  head.add(face);

  // Eyes (white + pupil + angry upper lid), grouped so they can blink
  const eyes = [];
  for (const side of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(0.1 * side, 0.53, 0.29);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 16), CORN_MAT.eyeWhite);
    white.scale.z = 0.75;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), CORN_MAT.pupil);
    pupil.position.set(-0.012 * side, -0.008, 0.055);
    // Upper lid: skin-colored hemisphere tilted forward, angled down toward the nose = scowl
    const lidPivot = new THREE.Group();
    lidPivot.rotation.z = 0.38 * side;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.084, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), CORN_MAT.skin);
    lid.rotation.x = 0.35;
    lid.scale.z = 0.8;
    lidPivot.add(lid);
    eye.add(white, pupil, lidPivot);
    head.add(eye);
    eyes.push(eye);
    // Brow: thick angled ridge
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 4, 8), CORN_MAT.brow);
    brow.rotation.z = Math.PI / 2 + 0.42 * side;
    brow.position.set(0.105 * side, 0.625, 0.315);
    head.add(brow);
  }
  // Clenched grimace: dark mouth, teeth row with a bite line, lower lip
  const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.17, 4, 10), CORN_MAT.mouth);
  mouth.rotation.z = Math.PI / 2;
  mouth.scale.z = 0.6;
  mouth.position.set(0, 0.33, 0.3);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.052, 0.03), CORN_MAT.teeth);
  teeth.position.set(0, 0.33, 0.322);
  const bite = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.006, 0.032), CORN_MAT.mouth);
  bite.position.set(0, 0.33, 0.324);
  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.16, 4, 8), CORN_MAT.skin);
  lip.rotation.z = Math.PI / 2;
  lip.position.set(0, 0.293, 0.322);
  head.add(mouth, teeth, bite, lip);

  // --- Collar: husk leaves flaring out around the neck; the side ones rise beside the face ---
  const collar = [];
  const collarDefs = [ // yaw, tilt, length, width, bend
    [1.05, 0.35, 0.78, 0.24, 2.1], [-1.05, 0.35, 0.78, 0.24, 2.1],
    [1.5, 0.75, 0.85, 0.26, 2.4],  [-1.5, 0.75, 0.85, 0.26, 2.4],
    [2.2, 0.6, 0.8, 0.26, 2.3],    [-2.2, 0.6, 0.8, 0.26, 2.3],
    [2.8, 0.45, 0.85, 0.28, 2.0],  [-2.8, 0.45, 0.85, 0.28, 2.0],
    [Math.PI, 0.3, 0.7, 0.26, 1.8],
    [0.7, 1.1, 0.55, 0.2, 2.2],    [-0.7, 1.1, 0.55, 0.2, 2.2],
  ];
  for (const [yaw, tilt, length, width, bend] of collarDefs) {
    collar.push(placeLeaf(head, { length, width, bend, fold: 0.4 }, Math.sin(yaw) * 0.17, 0.0, Math.cos(yaw) * 0.17, yaw, tilt));
  }

  // --- Arms: curved stalks ending in husk-cupped cob blasters pointing forward ---
  const arms = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.09 * side, 0.55, 0.02);
    torso.add(pivot);
    const end = new THREE.Vector3(0.66 * side, -0.3, 0.2);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.28 * side, 0.04, 0),
      new THREE.Vector3(0.55 * side, -0.12, 0.08), end,
    ]);
    const armMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.05, 8), CORN_MAT.stalk);
    armMesh.castShadow = true;
    pivot.add(armMesh);
    placeLeaf(pivot, { length: 0.5, width: 0.17, bend: 1.8, fold: 0.4 }, 0.3 * side, 0.03, 0, 1.6 * side, 0.5);
    placeLeaf(pivot, { length: 0.4, width: 0.14, bend: 2.0, fold: 0.4 }, 0.5 * side, -0.1, 0.05, 2.4 * side, 0.6);

    const hand = new THREE.Group();
    hand.position.copy(end);
    pivot.add(hand);
    const aim = new THREE.Group();          // rotates the cob's +Y axis to point forward (+Z)
    aim.rotation.x = Math.PI / 2;
    hand.add(aim);
    const spin = new THREE.Group();         // the cob barrel spins like a gatling when firing
    aim.add(spin);
    const handCob = makeCob({ length: 0.62, radius: 0.2, rows: 12, tipTaper: 0.3 });
    handCob.position.y = -0.22;
    spin.add(handCob);
    for (let i = 0; i < 7; i++) {           // husk cup around the back of the cob
      placeLeaf(aim, { length: 0.42, width: 0.2, bend: 1.3, fold: 0.45, dark: 0x1a5418, light: 0x58a838 },
        0, -0.2, 0, (i / 7) * Math.PI * 2, 0.95);
    }
    const muzzle = new THREE.Object3D();
    muzzle.position.y = 0.44;
    aim.add(muzzle);
    const flash = makeMuzzleFlash();
    flash.position.y = 0.46;
    aim.add(flash);
    arms.push({ side, pivot, hand, spin, muzzle, flash, handBase: end.clone(), recoil: 0, spinSpeed: 0, flashT: 0 });
  }

  root.traverse(o => { if (o.isMesh && o.material.blending !== THREE.AdditiveBlending) o.castShadow = true; });
  return { root, hips, HIPS_Y, torso, head, eyes, legs, collar, arms };
}

// =====================================================================
// Peashooter — sculpted, texture-free botanical surfaces. Model space faces +Z.
// Veins/leaf rims are baked into three meshes per leaf to keep a four-plant squad affordable.
// =====================================================================
const PEA_MAT = {
  skin: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38,
    clearcoat: 0.25, clearcoatRoughness: 0.32, sheen: 0.22, sheenColor: 0xdbe789, envMapIntensity: 0.5 }),
  leaf: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.44,
    clearcoat: 0.18, sheen: 0.35, sheenColor: 0x839f4b, side: THREE.DoubleSide, envMapIntensity: 0.45 }),
  vein: new THREE.MeshStandardMaterial({ color: CONFIG.PEASHOOTER.model.vein, roughness: 0.48 }),
  edge: new THREE.MeshStandardMaterial({ color: 0x72583b, roughness: 0.6 }),
  stem: new THREE.MeshPhysicalMaterial({ color: 0x64853b, roughness: 0.4, clearcoat: 0.24 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x142b16, roughness: 0.75 }),
  cavity: new THREE.MeshStandardMaterial({ color: 0x060f09, roughness: 0.95 }),
  eye: new THREE.MeshPhysicalMaterial({ color: 0x031b16, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
  iris: new THREE.MeshPhysicalMaterial({ color: 0x25857d, roughness: 0.22, metalness: 0.16, clearcoat: 0.8 }),
  pupil: new THREE.MeshPhysicalMaterial({ color: 0x010907, roughness: 0.06, clearcoat: 1 }),
  glint: new THREE.MeshBasicMaterial({ color: 0xf1fff2 }),
  helmet: new THREE.MeshStandardMaterial({ color: 0x546035, roughness: 0.48, metalness: 0.16 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb8b66c, roughness: 0.35, metalness: 0.45 }),
};
const peaSphere = new THREE.SphereGeometry(1, 32, 24);
// Micro relief in the physical skin shader: rind pores catch grazing light without image textures.
PEA_MAT.skin.onBeforeCompile = shader => {
  shader.uniforms.peaPoreDepth = { value: CONFIG.PEASHOOTER.model.skinPoreDepth };
  shader.uniforms.peaPoreFrequency = { value: CONFIG.PEASHOOTER.model.skinPoreFrequency };
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 peaLocalPosition;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\npeaLocalPosition = position;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 peaLocalPosition;
    uniform float peaPoreDepth;
    uniform float peaPoreFrequency;
    vec3 peaRindNormal(vec3 n, vec3 surface, float height) {
      vec3 sx = dFdx(surface), sy = dFdy(surface);
      vec3 rx = cross(sy, n), ry = cross(n, sx);
      float det = dot(sx, rx);
      return normalize(abs(det) * n - sign(det) * (dFdx(height) * rx + dFdy(height) * ry));
    }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 rind = peaLocalPosition * peaPoreFrequency;
      rind += sin(rind.yzx * 0.73 + sin(rind.zxy * 0.43)) * 0.65;
      float pore = sin(rind.x + sin(rind.z * 0.6)) * sin(rind.y) * sin(rind.z);
      normal = peaRindNormal(normal, -vViewPosition, pore * peaPoreDepth);
      roughnessFactor = clamp(roughnessFactor + pore * 0.035, 0.2, 0.85);`);
};
PEA_MAT.skin.customProgramCacheKey = () => 'peashooter-rind-v1';
function peaMesh(parent, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function peaTube(points, radius, segments = 24, sides = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, sides, false);
}
// Subtle irregular color and silhouette are generated from coordinates, so duplicate heroes stay identical.
function peaSkin(geometry, baseColor, strength = 0.055) {
  const p = geometry.attributes.position, colors = [], base = new THREE.Color(baseColor), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const grain = Math.sin(x * 79 + Math.sin(z * 41)) * Math.sin(y * 67 - z * 31);
    const mottling = Math.sin(x * 13 + z * 9) * Math.sin(y * 16 + x * 5);
    c.copy(base).offsetHSL(0.007 * mottling, 0, strength * (0.6 * mottling + 0.25 * grain) + y * 0.025);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return geometry;
}
// A broad pointed leaf with cupped lobes, a curved midrib, raised branching veins and a fine russet edge.
function peaLeaf(length, width, curl = 0.6, twist = 0) {
  const group = new THREE.Group(), rows = 24, cols = 12;
  const geom = new THREE.PlaneGeometry(1, 1, cols, rows), p = geom.attributes.position, colors = [];
  const M = CONFIG.PEASHOOTER.model, dark = new THREE.Color(M.leafDark), light = new THREE.Color(M.leafLight), c = new THREE.Color();
  const at = (t, u) => {
    const w = width * (0.065 * (1 - t) + Math.pow(Math.sin(Math.PI * t), 0.78));
    const cup = (u * u * 0.28 + Math.sin(t * Math.PI) * 0.04) * width;
    return [u * w * 0.5 * Math.cos(twist * t), length * t - Math.abs(u) * width * 0.08,
      curl * length * t * t + cup + u * w * 0.2 * Math.sin(twist * t)];
  };
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, t = p.getY(i) + 0.5;
    p.setXYZ(i, ...at(t, u));
    const rib = Math.pow(1 - Math.abs(u), 14), vein = Math.pow(Math.max(0, Math.cos((t - Math.abs(u) * 0.22) * Math.PI * 12)), 18);
    c.lerpColors(dark, light, 0.25 + Math.sin(t * Math.PI * 0.85) * 0.5 + rib * 0.16);
    c.offsetHSL(0, 0, vein * 0.018 - Math.abs(u) * 0.035); colors.push(c.r, c.g, c.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geom.computeVertexNormals();
  peaMesh(group, geom, PEA_MAT.leaf);
  const veins = [], edges = [];
  const lift = p => [p[0], p[1], p[2] + 0.008];
  veins.push(peaTube(Array.from({ length: 13 }, (_, i) => lift(at(i / 12, 0))), 0.009));
  for (const side of [-1, 1]) {
    edges.push(peaTube(Array.from({ length: 25 }, (_, i) => at(i / 24, side)), 0.0045));
    for (let j = 1; j <= 5; j++) {
      const t = j / 7;
      veins.push(peaTube([lift(at(t, 0)), lift(at(t + 0.04, side * 0.4)), lift(at(Math.min(0.97, t + 0.14), side * 0.88))], 0.0048, 8, 5));
    }
  }
  peaMesh(group, mergeGeometries(veins), PEA_MAT.vein); peaMesh(group, mergeGeometries(edges), PEA_MAT.edge);
  [...veins, ...edges].forEach(g => g.dispose()); return group;
}
function attachPeaLeaf(parent, length, width, curl, position, rotation, twist = 0) {
  const g = peaLeaf(length, width, curl, twist); g.position.set(...position); g.rotation.set(...rotation, 'YXZ');
  g.userData.base = g.rotation.clone(); parent.add(g); return g;
}
function buildPeashooter() {
  const M = CONFIG.PEASHOOTER.model, root = new THREE.Group(), hips = new THREE.Group(); root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  // A tapered stalk with longitudinal fluting; the two spiral tendrils sit proud of the stem.
  const stemGeo = new THREE.CylinderGeometry(0.09, 0.15, M.stemHeight, 24, 24), sp = stemGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) + M.stemHeight / 2, a = Math.atan2(sp.getZ(i), sp.getX(i));
    const ridge = 1 + Math.cos(a * 8) * 0.06;
    sp.setXYZ(i, sp.getX(i) * ridge + Math.sin(y * 2.5) * 0.045, sp.getY(i), sp.getZ(i) * ridge);
  }
  stemGeo.computeVertexNormals();
  peaMesh(torso, peaSkin(stemGeo, 0x749448), PEA_MAT.skin, [0, M.stemHeight / 2 + 0.12, 0]);
  for (let side = 0; side < 2; side++) {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, a = t * Math.PI * 4.5 + side * Math.PI;
      const r = 0.15 + Math.sin(t * Math.PI) * 0.12;
      pts.push([Math.cos(a) * r, 0.35 + t * 1.08, Math.sin(a) * r]);
    }
    peaMesh(torso, peaTube(pts, side ? 0.014 : 0.021, 80), PEA_MAT.stem);
  }
  const legs = [];
  for (const [i, yaw] of [0.75, 2.3, Math.PI + 0.85, -1.05].entries()) {
    const foot = attachPeaLeaf(hips, M.rootSpread, i % 2 ? 0.32 : 0.62, -0.35,
      [Math.sin(yaw) * 0.1, 0.22, Math.cos(yaw) * 0.1], [1.9, yaw, i % 2 ? 0.08 : -0.08], (i % 2 ? 1 : -1) * 0.2);
    legs.push({ pivot: foot, phase: i % 2 * Math.PI });
  }
  // The waist rosette and open pea pods make the silhouette legible even from the chase camera.
  const collar = [];
  for (let i = 0; i < 4; i++) collar.push(attachPeaLeaf(torso, 0.48, 0.23, 0.6,
    [0, 0.43, 0], [1.35, i * Math.PI / 2 + 0.5, 0], 0.2));
  const pods = [];
  for (const side of [-1, 1]) {
    const pod = new THREE.Group(); pod.position.set(side * 0.14, 1.43, 0); pod.rotation.z = side * 0.64; pod.rotation.x = Math.PI;
    torso.add(pod); pods.push(pod);
    attachPeaLeaf(pod, 0.97, 0.34, 0.14, [0, 0, 0], [0, 0, 0], side * 0.28);
    attachPeaLeaf(pod, 0.97, 0.21, 0.1, [side * 0.075, 0, 0.025], [0, side * 0.75, -side * 0.1]);
    for (let i = 0; i < 4; i++) peaMesh(pod, peaSphere, PEA_MAT.stem,
      [0, 0.2 + i * 0.175, -0.035], [0.092 - i * 0.009, 0.11 - i * 0.008, 0.088]);
    peaMesh(pod, peaTube([[0, 0.02, -0.02], [0.1 * side, 0.4, -0.07], [0, 0.94, 0.12]], 0.012), PEA_MAT.vein);
  }
  const head = new THREE.Group(); head.position.set(0, M.headY, 0); torso.add(head);
  const headGeo = new THREE.SphereGeometry(1, 64, 48), hp = headGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    const k = 1 + 0.012 * Math.sin(x * 9 + y * 6) * Math.cos(z * 8);
    hp.setXYZ(i, x * k, y * k, z * k);
  }
  headGeo.computeVertexNormals(); peaMesh(head, peaSkin(headGeo, M.skin), PEA_MAT.skin, [0, 0, 0], M.headScale);
  // The nose is a continuous outer/inner lathed wall with a deep throat, not a black disk over a solid sphere.
  const snout = new THREE.Group(); snout.position.set(0, -0.08, 0.39); head.add(snout);
  const profile = [[0.24, 0], [0.235, 0.14], [0.26, 0.36], [0.32, 0.56], [0.385, 0.65],
    [0.402, 0.70], [0.386, 0.75], [0.335, 0.765], [0.303, 0.72], [0.29, 0.64], [0.225, 0.43], [0.13, 0.19], [0, 0.12]];
  const hornGeo = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 64);
  peaSkin(hornGeo, M.skin, 0.035);
  const hc = hornGeo.attributes.color, hpos = hornGeo.attributes.position;
  for (let i = 0; i < hpos.count; i++) {
    const row = i % profile.length;
    if (row >= 9) {
      const shade = THREE.MathUtils.lerp(0.035, 0.55, Math.pow(Math.max(0, hpos.getY(i)) / 0.75, 2.4));
      hc.setXYZ(i, hc.getX(i) * shade, hc.getY(i) * shade, hc.getZ(i) * shade);
    }
  }
  const horn = peaMesh(snout, hornGeo, PEA_MAT.skin); horn.rotation.x = Math.PI / 2;
  const lip = peaMesh(snout, new THREE.TorusGeometry(0.364, 0.026, 12, 64), PEA_MAT.stem, [0, 0, 0.735]);
  lip.scale.set(1, 1.035, 1);
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(side * 0.295, 0.21, 0.405); eye.rotation.y = side * 0.29; head.add(eye); eyes.push(eye);
    peaMesh(eye, peaSphere, PEA_MAT.dark, [0, 0, 0], [0.183, 0.244, 0.077]);
    peaMesh(eye, peaSphere, PEA_MAT.eye, [0, 0, 0.035], [0.151, 0.203, 0.075]);
    peaMesh(eye, peaSphere, PEA_MAT.iris, [-side * 0.012, -0.018, 0.089], [0.105, 0.143, 0.025]);
    peaMesh(eye, peaSphere, PEA_MAT.pupil, [-side * 0.014, -0.013, 0.107], [0.069, 0.112, 0.021]);
    peaMesh(eye, peaSphere, PEA_MAT.glint, [-0.041, 0.069, 0.122], [0.016, 0.023, 0.008]);
    peaMesh(eye, peaSphere, PEA_MAT.glint, [0.039, -0.071, 0.12], [0.009, 0.013, 0.005]);
    const brow = peaMesh(head, peaSkin(peaTube([[side * 0.13, 0.37, 0.43], [side * 0.26, 0.465, 0.435],
      [side * 0.4, 0.43, 0.35]], 0.057, 24, 10), 0xc0cf52), PEA_MAT.skin);
    brow.rotation.z = side * -0.06;
  }
  const crown = [];
  crown.push(attachPeaLeaf(head, 0.68, 0.34, -0.65, [0, 0.54, -0.06], [-0.65, 0.3, -0.15], -0.6));
  crown.push(attachPeaLeaf(head, 0.51, 0.32, -0.8, [0.03, 0.54, -0.13], [-0.8, 2.5, 0.3], 0.8));
  crown.push(attachPeaLeaf(head, 0.42, 0.25, -0.5, [-0.04, 0.54, -0.03], [-0.7, -1, 0.25], 0.5));
  for (let i = 0; i < 5; i++) collar.push(attachPeaLeaf(torso, 0.36, 0.14, 0.65,
    [0, 1.51, 0], [1.3, i * Math.PI * 2 / 5, 0], 0.25));
  // Deployable helmet, live barrel cluster and ground brace are animated with the rooted Gatling state.
  const turret = new THREE.Group(); head.add(turret); turret.visible = false;
  peaMesh(turret, new THREE.SphereGeometry(0.615, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), PEA_MAT.helmet, [0, 0.24, -0.025], [1.04, 0.85, 0.97]);
  const brim = peaMesh(turret, new THREE.TorusGeometry(0.64, 0.032, 8, 48), PEA_MAT.helmet, [0, 0.24, -0.025], [1, 0.94, 1]); brim.rotation.x = Math.PI / 2;
  peaMesh(turret, peaSphere, PEA_MAT.brass, [0, 0.48, 0.53], [0.055, 0.071, 0.02]);
  const rotor = new THREE.Group(); rotor.position.set(0, -0.08, 1.08); turret.add(rotor);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const barrel = peaMesh(rotor, new THREE.CylinderGeometry(0.074, 0.082, 0.35, 12, 1, true), PEA_MAT.helmet,
      [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.08]); barrel.rotation.x = Math.PI / 2;
    peaMesh(rotor, new THREE.CircleGeometry(0.055, 12), PEA_MAT.cavity, [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.252]);
  }
  peaMesh(rotor, new THREE.TorusGeometry(0.262, 0.025, 8, 40), PEA_MAT.brass, [0, 0, 0.17]);
  const brace = new THREE.Group(); root.add(brace); brace.visible = false;
  for (let i = 0; i < 5; i++) attachPeaLeaf(brace, 0.85, 0.22, 0.4, [0, 0.12, 0], [1.55, i * Math.PI * 2 / 5, 0]);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.08, 1.22); head.add(muzzle);
  const flash = makeMuzzleFlash(); flash.position.copy(muzzle.position); flash.rotation.x = Math.PI / 2; head.add(flash);
  const arm = { muzzle, flash, recoil: 0, spinSpeed: 0, flashT: 0, side: 0 };
  return { root, hips, torso, head, snout, eyes, crown, pods, collar, legs, arms: [arm], turret, rotor, brace };
}

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

// Heroes. Each is an invisible-origin group at capsule center (so all hit tests work on the capsule),
// carrying a Kernel Corn model offset down to the feet and turned to face the hero's forward (-Z).
// Every hero — the human player or the AI teammate — is driven by the same `input` object each frame
// (see "Heroes" below); only who fills it in differs.

export { CORN_MAT, KERNEL_GEO, placeLeaf, makeCob, makeMuzzleFlash, buildKernelCorn, PEA_MAT, peaSphere, peaMesh, peaTube, buildPeashooter, sunflowerTube, sunflowerBatch, sunflowerPetal, sunflowerLeaf, buildSunflower };
