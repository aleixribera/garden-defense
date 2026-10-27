// Kernel Corn — the default hero: model (lathe cob, instanced kernels, folded leaves) and animation.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { yawForward, animFwd, animRight } from './shared.js';

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
// Kernel Corn procedural animation
// =====================================================================
function animateCorn(h, dt) {
  const P = h.stats, W = h.weapon;
  const A = h.anim, C = h.corn, v = h.vel;
  A.t += dt;
  // Downed: tip over and lie flat on the ground
  C.root.rotation.x += ((h.downed ? 1.45 : 0) - C.root.rotation.x) * Math.min(1, dt * 8);
  if (h.downed) { for (const a of C.arms) a.flash.visible = false; return; }
  const fwd = yawForward(h.yaw, animFwd), right = animRight.set(-fwd.z, 0, fwd.x);
  const hv = Math.hypot(v.x, v.z);
  const s = h.onGround ? Math.min(1, hv / P.speed) : 0;      // stride strength
  A.phase += dt * 12 * s;
  const damp = Math.min(1, dt * 10);
  A.leanF += ((v.x * fwd.x + v.z * fwd.z) / P.speed - A.leanF) * damp;
  A.leanS += ((v.x * right.x + v.z * right.z) / P.speed - A.leanS) * damp;
  A.air += ((h.onGround ? 0 : 1) - A.air) * Math.min(1, dt * 8);
  A.squash *= Math.exp(-dt * 12);

  // Body: bouncy waddle, lean into motion, squash on landing / stretch while rising
  C.hips.position.y = C.HIPS_Y + Math.abs(Math.sin(A.phase)) * 0.07 * s + Math.sin(A.t * 2.4) * 0.012 * (1 - s) - A.squash * 0.35;
  C.hips.rotation.z = Math.sin(A.phase) * 0.07 * s;
  C.torso.rotation.x = A.leanF * 0.16 - A.air * THREE.MathUtils.clamp(v.y * 0.012, -0.15, 0.15);
  C.torso.rotation.z = A.leanS * 0.12;
  const st = THREE.MathUtils.clamp(v.y * 0.01 * A.air, -0.08, 0.1) - A.squash;
  C.root.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5);

  // Leaf feet lift alternately while walking; tuck in the air
  for (const l of C.legs) {
    const b = l.pivot.userData.base;
    l.pivot.rotation.x = b.x - Math.max(0, Math.sin(A.phase + l.phase)) * 0.45 * s - A.air * 0.5;
  }

  // Head looks toward the aim, with a little counter-sway
  const breathe = Math.sin(A.t * 2.4 + 0.6);
  C.head.rotation.x = -h.aimElev * 0.35 + breathe * 0.015 - A.leanF * 0.06;
  C.head.rotation.z = -C.hips.rotation.z * 0.8;
  C.head.position.y = 0.9 + breathe * 0.006;

  // Collar leaves flutter; they flop down when jumping up and flare when falling
  C.collar.forEach((p, i) => {
    const b = p.userData.base;
    p.rotation.x = b.x + Math.sin(A.t * 3 + i * 1.7) * 0.05 + hv * 0.008 + A.air * THREE.MathUtils.clamp(v.y * 0.03, -0.4, 0.4);
  });

  // Arms track the aim; recoil kicks, barrels spin, flashes flicker; reload drops and spins the cobs
  const reloadK = h.reloading ? Math.sin(Math.PI * (1 - h.reloadT / W.reloadTime)) : 0;
  for (const a of C.arms) {
    a.recoil *= Math.exp(-dt * 16);
    a.spinSpeed *= Math.exp(-dt * 3);
    if (h.reloading) a.spinSpeed = 30;
    a.flashT -= dt;
    a.spin.rotation.y += a.spinSpeed * dt;
    a.pivot.rotation.x = -h.aimElev - a.recoil * 0.1 + reloadK * 0.8
      + Math.sin(A.phase + (a.side > 0 ? 0 : Math.PI)) * 0.06 * s - A.air * 0.15;
    a.pivot.rotation.z = reloadK * 0.3 * a.side;
    a.hand.position.z = a.handBase.z - a.recoil * 0.12;
    a.flash.visible = a.flashT > 0;
  }

  // Blink every few seconds
  A.blink -= dt;
  if (A.blink < 0) A.blink = 2.5 + Math.random() * 3;
  const lid = A.blink < 0.12 ? 0.12 : 1;
  for (const e of C.eyes) e.scale.y = lid;
}

export { CORN_MAT, KERNEL_GEO, placeLeaf, makeCob, makeMuzzleFlash, buildKernelCorn, animateCorn };
