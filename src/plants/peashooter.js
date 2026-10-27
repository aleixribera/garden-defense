// Peashooter — artillery: model, Chili Bean Bomb model and animation.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { randRange, yawForward, animFwd, animRight } from './shared.js';
import { makeMuzzleFlash } from './corn.js';

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


function makeChiliBean() {
  const root = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color: CONFIG.PEASHOOTER.fx.bombColor,
    roughness: 0.3, clearcoat: 0.65, clearcoatRoughness: 0.2 });
  const beanGeo = peaSphere.clone(), p = beanGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); p.setX(i, p.getX(i) * (0.8 + y * 0.18) + y * y * 0.23);
  }
  beanGeo.computeVertexNormals(); peaMesh(root, beanGeo, mat, [0, 0, 0], [0.27, 0.39, 0.25]);
  peaMesh(root, new THREE.TorusGeometry(0.13, 0.025, 6, 20, Math.PI), PEA_MAT.vein, [0.01, 0.32, 0]);
  peaMesh(root, peaTube([[0.05, 0.34, 0], [0.1, 0.53, 0], [0.23, 0.57, 0]], 0.024, 12), PEA_MAT.edge);
  const spark = peaMesh(root, peaSphere, new THREE.MeshBasicMaterial({ color: 0xffd564 }), [0.23, 0.57, 0], [0.05, 0.05, 0.05]);
  for (const side of [-1, 1]) {
    peaMesh(root, peaSphere, PEA_MAT.eye, [side * 0.082, 0.1, 0.23], [0.048, 0.074, 0.025]);
    peaMesh(root, peaSphere, PEA_MAT.glint, [side * 0.082 - 0.012, 0.124, 0.253], [0.012, 0.017, 0.007]);
  }
  const mouth = peaMesh(root, new THREE.TorusGeometry(0.055, 0.012, 6, 12, Math.PI), PEA_MAT.dark, [0, -0.06, 0.246]); mouth.rotation.z = Math.PI;
  return { root, mat, spark };
}

function animatePeashooter(h, dt) {
  const C = h.corn, A = h.anim, M = CONFIG.PEASHOOTER.model, p = h.pea;
  A.t += dt;
  C.root.rotation.x += ((h.downed ? 1.45 : 0) - C.root.rotation.x) * Math.min(1, dt * 8);
  C.turret.visible = C.brace.visible = !!p?.gatling && !h.downed;
  C.crown.forEach(leaf => { leaf.visible = !p?.gatling; });
  if (h.downed) { C.arms[0].flash.visible = false; return; }
  const hv = Math.hypot(h.vel.x, h.vel.z), s = h.onGround ? Math.min(1.5, hv / h.stats.speed) : 0;
  A.phase += dt * M.strideRate * s;
  const fwd = yawForward(h.yaw, animFwd), right = animRight.set(-fwd.z, 0, fwd.x), damp = 1 - Math.exp(-dt * 10);
  A.leanF += (h.vel.dot(fwd) / h.stats.speed - A.leanF) * damp;
  A.leanS += (h.vel.dot(right) / h.stats.speed - A.leanS) * damp;
  A.air += ((h.onGround ? 0 : 1) - A.air) * damp; A.squash *= Math.exp(-dt * 12);
  const breath = Math.sin(A.t * M.breathe), rooted = p?.gatling ? 1 : 0;
  C.hips.position.y = (Math.abs(Math.sin(A.phase)) * M.bob * s + breath * 0.013) * (1 - rooted);
  C.hips.rotation.z = Math.sin(A.phase) * 0.055 * s;
  C.torso.rotation.x = A.leanF * M.lean + (p?.hyper > 0 ? M.hyperLean : 0);
  C.torso.rotation.z = A.leanS * M.lean;
  const stretch = THREE.MathUtils.clamp(h.vel.y * 0.009, -0.06, 0.09) * A.air - A.squash;
  C.root.scale.set(1 - stretch * 0.4, 1 + stretch, 1 - stretch * 0.4);
  const a = C.arms[0]; a.recoil *= Math.exp(-dt * M.recoilRecovery); a.flashT -= dt;
  C.head.position.y = M.headY + breath * 0.012 - a.recoil * 0.025 - rooted * 0.08;
  C.head.position.z = -a.recoil * M.recoil;
  const reload = h.reloading ? Math.sin(Math.PI * (1 - h.reloadT / h.weapon.reloadTime)) : 0;
  C.head.rotation.x = -h.aimElev - C.torso.rotation.x - a.recoil * 0.045 + reload * 0.32;
  C.head.rotation.z = -C.hips.rotation.z * 0.8 + reload * 0.1;
  C.snout.scale.set(1 + a.recoil * 0.06 + reload * 0.04, 1 + a.recoil * 0.05, 1 - a.recoil * 0.1);
  C.rotor.rotation.z += (rooted ? M.gatlingSpin * (h.input.fire ? 1 : 0.15) : 0) * dt;
  C.turret.scale.setScalar(p?.deploy > 0 ? 0.8 + 0.2 * (1 - p.deploy / h.abilities.huskHop.deployTime) : 1);
  a.flash.visible = a.flashT > 0;
  a.muzzle.position.z = a.flash.position.z = rooted ? 1.42 : 1.22;
  for (const l of C.legs) {
    const b = l.pivot.userData.base;
    l.pivot.rotation.x = b.x - Math.max(0, Math.sin(A.phase + l.phase)) * 0.38 * s - A.air * 0.3 + rooted * 0.12;
    l.pivot.rotation.z = b.z + Math.sin(A.phase + l.phase) * 0.12 * s;
  }
  for (const [i, leaf] of [...C.collar, ...C.crown].entries()) {
    const b = leaf.userData.base;
    leaf.rotation.x = b.x + Math.sin(A.t * 3 + i * 1.3) * 0.045 + hv * 0.006 + a.recoil * 0.04;
  }
  C.pods.forEach((pod, i) => { pod.rotation.z = (i ? 1 : -1) * (0.64 + Math.sin(A.phase + i * Math.PI) * s * 0.1); });
  A.blink -= dt; if (A.blink < 0) A.blink = randRange(M.blinkInterval);
  C.eyes.forEach(eye => { eye.scale.y = A.blink < 0.13 ? Math.max(0.05, Math.abs(A.blink - 0.065) / 0.065) : 1; });
}

export { PEA_MAT, peaSphere, peaMesh, peaTube, buildPeashooter, makeChiliBean, animatePeashooter };
