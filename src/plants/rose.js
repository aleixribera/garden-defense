// Rose — sorceress: model, Goatify goat, Magic Thistle and animation, render poses.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { randRange, yawForward } from './shared.js';

// =====================================================================
// Rose — floating Dark Ages sorceress. A full rose bloom for a head (face set into a petal hood, a closed
// spiral bud on the back), a slim stem bodice, a hovering gown of petals and sepals, and a thorny wand with a
// glowing orb. Every surface is a sculpted closed shell painted by vertex colour; no image assets.
// =====================================================================
const ROSE_TUNING = CONFIG.ROSE;   // model / animation tuning lives in CONFIG.ROSE

const roseSmooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Shared materials for the spawned extras (goats, thistle shots, wand FX). Rose's body materials are per rig.
const ROSE_MAT = {
  goat: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.82 }),
  goatEye: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
  thistle: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.45, sheen: 0.6, sheenColor: 0xff9ce6 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xff7cf4, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  flash: new THREE.MeshBasicMaterial({ color: 0xff5ce0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  hover: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  mote: new THREE.MeshBasicMaterial({ color: 0xffb8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
};
const roseMoteGeo = new THREE.OctahedronGeometry(1, 0);

// Per-rig materials: Arcane Enigma fades them to a glowing translucent ghost without touching other Roses.
// They are transparent from the start (opacity 1, depth write on) so the fade never recompiles a shader.
function roseMaterials() {
  const body = o => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, transparent: true, ...o });
  return {
    petal: body({ roughness: 0.52, sheen: 0.9, sheenRoughness: 0.32, sheenColor: new THREE.Color(0xff86c0),
      clearcoat: 0.08, clearcoatRoughness: 0.5 }),
    leaf: body({ roughness: 0.42, sheen: 0.35, sheenColor: new THREE.Color(0x9fd77a), clearcoat: 0.35, clearcoatRoughness: 0.32 }),
    skin: body({ emissive: new THREE.Color(0x40142e), roughness: 0.42, sheen: 0.3, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffd4ec), clearcoat: 0.18, clearcoatRoughness: 0.35 }),
    gloss: body({ roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    core: new THREE.MeshBasicMaterial({ color: ROSE_TUNING.model.orbCore, transparent: true }),
    shell: new THREE.MeshPhysicalMaterial({ color: ROSE_TUNING.model.orb, emissive: ROSE_TUNING.model.orb, emissiveIntensity: 0.6,
      roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.42, depthWrite: false }),
  };
}

// ---- Geometry helpers ----
// Solid vertex colour and no uv, so primitives can merge with the painted shells.
function roseColorize(geo, color) {
  geo.deleteAttribute('uv');
  const n = geo.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
function roseMesh(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
// Collects transformed copies of geometries and merges them into one mesh per material.
function roseBatch() {
  const parts = [], o = new THREE.Object3D();
  return {
    add(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], order = 'XYZ') {
      o.position.set(...pos); o.rotation.set(...rot, order); o.scale.set(...(typeof scale === 'number' ? [scale, scale, scale] : scale));
      o.updateMatrix(); parts.push(geo.clone().applyMatrix4(o.matrix)); return this;
    },
    addMatrix(geo, matrix) { parts.push(geo.clone().applyMatrix4(matrix)); return this; },
    build(parent, mat) {
      const list = parts.some(g => !g.index) ? parts.map(g => g.index ? g.toNonIndexed() : g) : parts;   // polyhedra are non-indexed
      const merged = mergeGeometries(list, false); parts.forEach(g => g.dispose());
      return roseMesh(parent, merged, mat);
    },
  };
}
// Tube along points with a radius profile r(t); TubeGeometry rings are rescaled about the curve.
function roseTube(points, radius, color, segs = 20, sides = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, sides, false), p = geo.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3(), r = typeof radius === 'function' ? radius : () => radius;
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r(i / segs)).add(c); p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return typeof color === 'function' ? roseColorizeFn(geo, color) : roseColorize(geo, color);
}
function roseColorizeFn(geo, fn) {
  geo.deleteAttribute('uv');
  const p = geo.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), c, i); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
// Arc-length spine in the YZ plane; angle(t) bends it from +Y toward +Z (the concave front).
function roseSpine(len, angle, n = 48) {
  const pts = [{ y: 0, z: 0, a: angle(0) }];
  let y = 0, z = 0;
  for (let i = 1; i <= n; i++) {
    const a = angle((i - 0.5) / n);
    y += Math.cos(a) * len / n; z += Math.sin(a) * len / n; pts.push({ y, z, a: angle(i / n) });
  }
  return t => {
    const f = Math.min(1, Math.max(0, t)) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i, A = pts[i], B = pts[i + 1];
    return { y: A.y + (B.y - A.y) * k, z: A.z + (B.z - A.z) * k, a: A.a + (B.a - A.a) * k };
  };
}
// A thin closed shell around a mid-surface surf(t, u) (t 0..1 along, u -1..1 across). The lens cross-section
// gives soft rounded edges; thickness follows the surface normal, so curled and rolled-back parts keep volume.
function roseShell(rows, cols, surf, thick, paint) {
  const ring = cols * 2, pos = [], col = [], idx = [];
  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), DT = new THREE.Vector3(),
        DU = new THREE.Vector3(), N = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j < ring; j++) {
      const a = j / ring * Math.PI * 2, u = Math.cos(a), s = Math.sin(a);
      surf(Math.min(1, t + 0.004), u, A); surf(Math.max(0, t - 0.004), u, B); DT.subVectors(A, B);
      surf(t, Math.min(1, u + 0.01), A); surf(t, Math.max(-1, u - 0.01), B); DU.subVectors(A, B);
      N.crossVectors(DU, DT); if (N.lengthSq() < 1e-12) N.set(0, 0, 1); N.normalize();
      surf(t, u, P); P.addScaledVector(N, thick(t, u) * s);
      pos.push(P.x, P.y, P.z);
      paint(t, u, s, c); col.push(c.r, c.g, c.b);
      if (i < rows) {
        const k = i * ring + j, k2 = i * ring + (j + 1) % ring;
        idx.push(k, k + ring, k2, k2, k + ring, k2 + ring);
      }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals(); return geo;
}
// Rose petal: narrow claw, broad rounded top, cupped base and rolled-back upper edges. Grows along +Y, cups
// toward +Z. wrap > 0 bends it across its width around an axis wrap metres in front (spiral bud petals).
function rosePetalGeo({ len, wid, bend = 0.5, back = 0.6, cup = 0.05, wrap = 0, roll = 0.04, th = 0.011,
                        seed = 0, deep = 0, rows = 16, cols = 9, rimLight = 1, skirt = false, tone = 1 }) {
  const M = ROSE_TUNING.model;
  const spine = roseSpine(len, t => bend * t - back * Math.pow(Math.max(0, (t - 0.5) / 0.5), 2));
  // Bloom petals pinch to a claw; gown petals start broad at the waist and round off at the hem
  const outline = skirt
    ? t => (0.6 + 0.4 * roseSmooth(0, 0.6, t)) * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, (t - 0.68) / 0.32), 2.2)), 0.5)
      * (0.15 + 0.85 * roseSmooth(0, 0.04, t))
    : t => {
      const s = Math.pow(t, 0.78);
      return Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 2.3)), 1 / 2.3) * (0.4 + 0.6 * roseSmooth(0, 0.4, t));
    };
  const surf = (t, u, P) => {
    const sp = spine(t), w = wid * 0.5 * outline(t);
    let x = u * w, off = 0;
    if (wrap > 0) { const q = u * w / wrap; x = wrap * Math.sin(q); off = wrap * (1 - Math.cos(q)); }
    off += cup * u * u * (1 - roseSmooth(0.45, 1, t)) - roll * u * u * roseSmooth(0.3, 1, t);
    off += 0.004 * Math.sin(u * 5 + t * 8 + seed * 2.3) * t;
    P.set(x, sp.y - Math.sin(sp.a) * off, sp.z + Math.cos(sp.a) * off);
  };
  const base = new THREE.Color(M.petalBase), mid = new THREE.Color(M.petalMid), rim = new THREE.Color(M.petalRim),
        backC = new THREE.Color(M.petalBack), deepC = new THREE.Color(M.petalDeep);
  const paint = (t, u, s, c) => {
    c.lerpColors(deepC, base, roseSmooth(0, 0.25, t)).lerp(mid, roseSmooth(0.15, 0.7, t));
    c.lerp(rim, roseSmooth(0.72, 1, t) * (0.55 + 0.45 * Math.abs(u)) * rimLight);
    const vein = Math.pow(Math.abs(Math.cos(u * Math.PI * 4.5 + Math.sin(t * 3 + seed) * 0.6)), 24) * (1 - t) * 0.22;
    c.multiplyScalar(1 - vein - 0.12 * Math.pow(Math.abs(u), 6));
    if (s < 0) c.lerp(backC, 0.25 * -s).multiplyScalar(0.9);
    if (deep) c.lerp(deepC, deep * (1 - t * 0.6));
    if (skirt) {   // gown tiers: tone 0 starts deep crimson, 2 starts pink; every tier ends in a light rolled rim
      c.lerpColors(tone ? base : deepC, base, tone === 2 ? 0.6 : 0).lerp(mid, roseSmooth(0.05, 0.65, t) * (0.8 + 0.1 * tone));
      c.lerp(rim, roseSmooth(0.72, 1, t) * (0.55 + 0.3 * Math.abs(u))).multiplyScalar((s < 0 ? 0.82 : 1) * (1 - 0.18 * Math.pow(Math.abs(u), 8)));
    }
  };
  return roseShell(rows, cols, surf, (t, u) => th * (0.5 + 0.5 * (1 - t)) * Math.min(1, outline(t) * 3), paint);
}
// Rose leaf: pointed oval with serrated margin, V-fold along the midrib and lighter pinnate veins.
function roseLeafGeo({ len, wid, bend = 0.3, back = 0, fold = 0.22, th = 0.01, serr = 1, rows = 18, cols = 8, seed = 0, tint = 0 }) {
  const M = ROSE_TUNING.model;
  const spine = roseSpine(len, t => bend * t - back * t * t);
  const outline = t => {
    const tooth = serr * 0.08 * (1 - Math.abs((t * 9 + seed) % 1 - 0.3) * 1.4) * roseSmooth(0.1, 0.4, t);
    return Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85) * (1 + tooth) * (0.25 + 0.75 * roseSmooth(0, 0.3, t));
  };
  const surf = (t, u, P) => {
    const sp = spine(t), w = wid * 0.5 * outline(t), off = fold * Math.abs(u) * w + 0.004 * Math.sin(t * 11 + u * 3 + seed);
    P.set(u * w, sp.y - Math.sin(sp.a) * off, sp.z + Math.cos(sp.a) * off);
  };
  const dark = new THREE.Color(M.leafDark), midC = new THREE.Color(M.leafMid), light = new THREE.Color(M.leafLight);
  const paint = (t, u, s, c) => {
    c.lerpColors(dark, midC, roseSmooth(0, 0.5, t) * 0.8 + 0.2).lerp(light, 0.25 * roseSmooth(0.3, 1, t) * (1 - Math.abs(u)));
    const rib = Math.pow(1 - Math.abs(u), 22), vein = Math.pow(Math.max(0, Math.cos((t - Math.abs(u) * 0.3) * Math.PI * 14)), 30) * (1 - Math.abs(u));
    c.lerp(light, Math.min(1, rib * 0.7 + vein * 0.35));
    c.multiplyScalar((1 - 0.25 * Math.pow(Math.abs(u), 5)) * (s < 0 ? 0.78 : 1));
    if (tint) c.lerp(new THREE.Color(M.petalBase), tint * roseSmooth(0.6, 1, t));
  };
  return roseShell(rows, cols, surf, (t, u) => th * (1 - 0.6 * t) * Math.min(1, outline(t) * 3), paint);
}

// =====================================================================
// buildRose
// =====================================================================
function buildRose() {
  const M = ROSE_TUNING.model, mat = roseMaterials();
  const root = new THREE.Group(), hips = new THREE.Group(); root.add(hips);
  const torso = new THREE.Group(); torso.position.y = M.waistY; hips.add(torso);
  const tmp = new THREE.Object3D(), mtx = new THREE.Matrix4();

  // ---- Gown: three scalloped petal tiers (crimson at the waist, pink, light rolled rims) over a closed petticoat.
  // The long bottom tier is static; the peplum and middle tier hang on trailing pivots. She hovers: the hem ends
  // ~0.25 m up, with a soft glow and falling sparkles underneath.
  const gown = roseBatch();
  const core = new THREE.LatheGeometry([[0, -0.72], [0.07, -0.69], [0.13, -0.58], [0.16, -0.4], [0.13, -0.2],
    [0.09, -0.06], [0.075, 0.02], [0.07, 0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  roseColorizeFn(core, (x, y, z, c) => c.set(M.petalBase).lerp(new THREE.Color(M.petalDeep), roseSmooth(-0.5, 0.0, y)));
  core.computeVertexNormals();
  gown.add(core, [0, M.waistY, 0]);
  const skirt = [];
  const panel = (n, offset, radius, drop, flare, layer, geo, animate) => {
    for (let i = 0; i < n; i++) {
      const az = (i + offset) / n * Math.PI * 2;
      tmp.position.set(Math.sin(az) * radius, M.waistY - drop, Math.cos(az) * radius);
      tmp.rotation.set(Math.PI - flare, az, 0, 'YXZ'); tmp.updateMatrix();   // hang down, cupped toward the body
      if (!animate) { gown.addMatrix(geo, tmp.matrix); continue; }
      const pivot = new THREE.Group(); pivot.position.copy(tmp.position); pivot.rotation.set(0, az, 0, 'YXZ'); hips.add(pivot);
      roseMesh(pivot, geo, mat.petal, [0, 0, 0], [Math.PI - flare, 0, 0]);
      skirt.push({ pivot, az, layer, radius, y: M.waistY - drop, x: 0, v: 0, s: 0, sv: 0, seed: i * 1.7 + layer });
    }
  };
  const tier = (len, wid, wrap, bend, back, tone, seed) => rosePetalGeo({ len, wid, wrap, bend, back, cup: 0, th: 0.014,
    rows: 22, cols: 12, seed, skirt: true, tone, roll: 0.09 });
  panel(8, 0, 0.08, 0, 0.2, 0, tier(0.86, 0.44, 0.32, -0.7, 0.7, 2, 1), false);
  gown.build(hips, mat.petal);
  const sepals = roseBatch(), sepalGeo = roseLeafGeo({ len: 0.66, wid: 0.2, bend: -0.5, back: 0.5, fold: 0.14, th: 0.01, serr: 0.4, rows: 20, cols: 7, seed: 6, tint: 0.25 });
  for (let i = 0; i < 5; i++) {
    const az = (i + 0.25) / 5 * Math.PI * 2;
    sepals.add(sepalGeo, [Math.sin(az) * 0.088, M.waistY - 0.02, Math.cos(az) * 0.088], [Math.PI - 0.2, az, 0], 1, 'YXZ');
  }
  sepals.build(hips, mat.leaf);
  panel(7, 0.5, 0.092, 0, 0.24, 1, tier(0.6, 0.4, 0.28, -0.55, 0.65, 1, 2), true);
  panel(7, 0, 0.1, -0.01, 0.4, 2, tier(0.34, 0.36, 0.22, -0.5, 0.7, 0, 3), true);
  // Hover glow: an additive radial disc near the ground plus sparkles drifting down from the hem
  const glowGeo = new THREE.CircleGeometry(0.62, 40); glowGeo.rotateX(-Math.PI / 2);
  roseColorizeFn(glowGeo, (x, y, z, c) => c.set(ROSE_TUNING.model.orb).multiplyScalar(0.28 * Math.pow(Math.max(0, 1 - Math.hypot(x, z) / 0.62), 2.5)));
  const hoverGlow = new THREE.Mesh(glowGeo, ROSE_MAT.hover); hoverGlow.position.y = 0.04; hoverGlow.renderOrder = 1; root.add(hoverGlow);
  const hemMotes = new THREE.InstancedMesh(roseMoteGeo, ROSE_MAT.mote, 26); hemMotes.castShadow = false; hemMotes.frustumCulled = false; root.add(hemMotes);

  // ---- Bodice: slim stem torso wrapped in crossing leaves ----
  const bodice = new THREE.LatheGeometry([[0.0, -0.05], [0.08, -0.03], [0.083, 0.05], [0.105, 0.17], [0.112, 0.25],
    [0.1, 0.31], [0.065, 0.35], [0.04, 0.38]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
  roseColorizeFn(bodice, (x, y, z, c) => c.set(M.leafMid).lerp(new THREE.Color(M.stem), roseSmooth(0, 0.35, y)));
  bodice.computeVertexNormals();
  const body = roseBatch().add(bodice);
  const wrapLeaf = roseLeafGeo({ len: 0.4, wid: 0.21, bend: -0.25, fold: 0.06, th: 0.008, serr: 0.15, seed: 3 });
  for (const [az, tilt, roll] of [[0.5, -0.2, 0.55], [-0.5, -0.2, -0.55], [Math.PI - 0.5, -0.15, 0.5], [Math.PI + 0.5, -0.15, -0.5]]) {
    body.add(wrapLeaf, [Math.sin(az) * 0.078, -0.04, Math.cos(az) * 0.078], [tilt, az, roll], 1, 'YXZ');
  }
  // Neck: a slender stem with small curved thorns, rising into the calyx under the bloom
  const neckPts = [[0, 0.3, 0], [0, 0.5, 0.01], [0, 0.7, 0.025], [0, 0.88, 0.035]];
  body.add(roseTube(neckPts, t => 0.042 - t * 0.008, (x, y, z, c) => c.set(M.stem).multiplyScalar(0.85 + 0.15 * Math.sin(y * 40)), 16, 10));
  const thornGeo = roseColorizeFn(new THREE.ConeGeometry(0.014, 0.05, 6), (x, y, z, c) => c.set(M.thorn).lerp(new THREE.Color(M.stem), roseSmooth(0.01, -0.025, y)));
  for (const [y, az] of [[0.5, 2.2], [0.6, -2.4], [0.7, 0.1]]) body.add(thornGeo, [Math.sin(az) * 0.036, y, Math.cos(az) * 0.036 + 0.015], [Math.cos(az) * 1.2, 0, -Math.sin(az) * 1.2]);
  // Leaf collar at the shoulders
  const collarLeaf = roseLeafGeo({ len: 0.21, wid: 0.2, bend: -1.1, fold: 0.12, th: 0.008, serr: 0.15, seed: 4 });
  for (let i = 0; i < 5; i++) { const az = i / 5 * Math.PI * 2 + Math.PI / 5; body.add(collarLeaf, [Math.sin(az) * 0.05, 0.335, Math.cos(az) * 0.05], [1.2, az, 0], 1, 'YXZ'); }
  const waistLeaf = roseLeafGeo({ len: 0.24, wid: 0.13, bend: -0.6, back: 0.4, fold: 0.15, th: 0.008, serr: 0.3, seed: 5 });
  for (let i = 0; i < 5; i++) { const az = i / 5 * Math.PI * 2 + 0.3; body.add(waistLeaf, [Math.sin(az) * 0.085, 0.04, Math.cos(az) * 0.085], [Math.PI - 0.62, az, 0], 1, 'YXZ'); }
  body.build(torso, mat.leaf);

  // ---- Arms: slender vine arms with puffed petal sleeves, flared leaf cuffs and fanned leafy hands ----
  const arms3 = [];
  const fingerGeo = roseLeafGeo({ len: 0.085, wid: 0.032, bend: 0.7, fold: 0.2, th: 0.007, serr: 0, rows: 8, cols: 5 });
  const cuffGeo = roseLeafGeo({ len: 0.17, wid: 0.095, bend: -0.7, back: 0.3, fold: 0.15, th: 0.006, serr: 0.3, rows: 12, cols: 6 });
  const puffGeo = rosePetalGeo({ len: 0.15, wid: 0.16, wrap: 0.05, bend: -0.6, back: 0.6, cup: 0, roll: 0.05, th: 0.008, rows: 12, cols: 8, skirt: true, tone: 0 });
  for (const side of [-1, 1]) {   // -1 = her right (wand), +1 = her left
    const shoulder = new THREE.Group(); shoulder.position.set(side * M.shoulderX, M.shoulderY - M.waistY, 0); torso.add(shoulder);
    roseBatch().add(roseTube([[0, 0.015, 0], [side * 0.012, -M.upperArm * 0.45, 0.004], [0, -M.upperArm, 0]],
      t => 0.027 - t * 0.01 + 0.004 * Math.sin(t * Math.PI), (x, y, z, c) => c.set(M.stem).multiplyScalar(0.9 + 0.1 * Math.sin(y * 50)), 14, 10))
      .add(roseColorize(new THREE.SphereGeometry(0.029, 12, 10), M.stem), [0, 0.012, 0]).build(shoulder, mat.leaf);
    const puff = roseBatch();   // puffed sleeve: three cupped crimson petals around the shoulder joint
    for (let k = 0; k < 3; k++) {
      const az = k / 3 * Math.PI * 2 + (side > 0 ? 0.6 : -0.6) + Math.PI / 2 * side;
      puff.add(puffGeo, [Math.sin(az) * 0.012, 0.045, Math.cos(az) * 0.012], [Math.PI - 0.45, az, 0], 1, 'YXZ');
    }
    puff.build(shoulder, mat.petal);
    const elbow = new THREE.Group(); elbow.position.y = -M.upperArm; shoulder.add(elbow);
    const fore = roseBatch().add(roseTube([[0, 0, 0], [0, -M.foreArm * 0.5, 0.006], [0, -M.foreArm, 0]],
      t => 0.02 - t * 0.006 + 0.003 * Math.sin(t * Math.PI), M.stem, 12, 10)).add(roseColorize(new THREE.SphereGeometry(0.021, 10, 8), M.stem));
    for (let k = 0; k < 4; k++) fore.add(cuffGeo, [0, -M.foreArm * 0.45, 0], [Math.PI - 0.32, k / 4 * Math.PI * 2 + 0.4, 0], 1, 'YXZ');   // bell sleeve
    fore.build(elbow, mat.leaf);
    const hand = new THREE.Group(); hand.position.y = -M.foreArm; elbow.add(hand);
    const palm = roseBatch().add(roseColorize(new THREE.SphereGeometry(0.028, 14, 10), M.leafMid), [0, -0.022, 0], [0, 0, 0], [1, 1.25, 0.7]);
    for (let k = 0; k < 4; k++) palm.add(fingerGeo, [(k - 1.5) * 0.012, -0.045, 0.004], [Math.PI + 0.05, 0, (k - 1.5) * 0.24], 1 - Math.abs(k - 1.5) * 0.08);
    palm.add(fingerGeo, [-side * 0.024, -0.016, 0.008], [Math.PI - 0.7, 0, side * 1.0], 0.75);   // thumb
    palm.build(hand, mat.leaf);
    arms3.push({ shoulder, elbow, hand, side });
  }

  // ---- Wand: twisted dark thorny wood, a petal cradle and a big glowing orb (emissive core, glow, glassy shell) ----
  const wand = new THREE.Group(); arms3[0].hand.add(wand);
  const L = M.wandLength, twig = roseBatch();
  for (let s = 0; s < 3; s++) {   // three strands twisted together, flaring apart under the cradle
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, a = t * Math.PI * 3.2 + s * Math.PI * 2 / 3, r = 0.011 + 0.018 * roseSmooth(0.78, 1, t);
      pts.push([Math.cos(a) * r, -0.12 + t * (L + 0.12), Math.sin(a) * r]);
    }
    twig.add(roseTube(pts, t => 0.0125 - t * 0.004, (x, y, z, c) => c.set(M.wood).multiplyScalar(0.75 + 0.45 * Math.sin(y * 60 + s * 2) ** 2), 48, 7));
  }
  twig.add(roseColorize(new THREE.SphereGeometry(0.024, 12, 10), M.wood), [0, -0.125, 0]);   // pommel knot
  const wThorn = roseColorizeFn(new THREE.ConeGeometry(0.01, 0.05, 6), (x, y, z, c) => c.set(M.wood).lerp(new THREE.Color(M.thorn), roseSmooth(-0.02, 0.025, y)));
  for (const [a, y] of [[0.4, 0.06], [2.6, 0.17], [4.5, 0.29], [1.4, 0.38]]) {
    wThorn.computeBoundingSphere();
    twig.add(wThorn, [Math.cos(a) * 0.022, y, Math.sin(a) * 0.022], [Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15]);
  }
  const cradle = twig, cradleGeo = rosePetalGeo({ len: 0.15, wid: 0.13, bend: 1.0, back: 0.7, cup: 0.03, roll: 0.03, th: 0.008, rows: 12, cols: 8 });
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; cradle.add(cradleGeo, [Math.sin(a) * 0.02, L - 0.03, Math.cos(a) * 0.02], [-0.75, a, 0], 1, 'YXZ'); }
  cradle.build(wand, mat.petal);
  const orb = new THREE.Group(); orb.position.y = L + 0.09; wand.add(orb);
  const orbCore = roseMesh(orb, new THREE.IcosahedronGeometry(0.055, 3), mat.core); orbCore.castShadow = false;
  const orbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), ROSE_MAT.glow); orb.add(orbGlow);
  const orbShell = roseMesh(orb, new THREE.SphereGeometry(0.13, 32, 22), mat.shell); orbShell.castShadow = false;
  const motes = new THREE.InstancedMesh(roseMoteGeo, ROSE_MAT.mote, 8); motes.castShadow = false; motes.frustumCulled = false; orb.add(motes);
  const muzzle = new THREE.Object3D(); orb.add(muzzle);
  const flash = new THREE.Group();   // magenta magic burst: a forward spike, a small star and a ring, +Y along the shot
  const spike = new THREE.ConeGeometry(0.06, 0.5, 4); spike.translate(0, 0.25, 0);
  flash.add(new THREE.Mesh(spike, ROSE_MAT.flash), new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), ROSE_MAT.flash));
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(spike, ROSE_MAT.flash); m.scale.setScalar(0.5); m.rotation.set(Math.PI / 2, k * Math.PI / 2, 0, 'YXZ'); flash.add(m); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 4, 20), ROSE_MAT.flash); ring.rotation.x = Math.PI / 2; flash.add(ring);
  flash.visible = false; orb.add(flash);
  wand.position.set(0, -0.035, 0.005); wand.rotation.set(2.0, 0, 0);

  // ---- Head: a face set into the open bloom ----
  const head = new THREE.Group(); head.position.set(0, M.headY - M.waistY, 0.04); head.scale.setScalar(M.headScale); torso.add(head);
  const face = { c: new THREE.Vector3(0, -0.025, 0.035), rx: 0.205, ry: 0.245, rz: 0.235 };
  // Face surface point along a direction: heart-shaped (narrow chin), soft cheeks, a hint of a nose
  const faceAt = (dx, dy, dz, out = new THREE.Vector3()) => {
    const d = new THREE.Vector3(dx, dy, dz).normalize();
    const jaw = d.y < 0 ? 1 - 0.32 * Math.pow(-d.y, 1.3) : 1 - 0.05 * d.y * d.y;
    const cheek = 0.03 * Math.exp(-((Math.abs(d.x) - 0.48) ** 2 + (d.y + 0.25) ** 2) * 14) * Math.max(0, d.z);
    const chin = 0.016 * Math.exp(-(d.x * d.x * 40 + (d.y + 0.8) ** 2 * 30)) * Math.max(0, d.z);
    const bridge = 0.006 * Math.exp(-d.x * d.x * 260) * roseSmooth(0.15, -0.05, d.y) * roseSmooth(-0.25, -0.05, d.y) * Math.max(0, d.z);
    const nose = 0.013 * Math.exp(-(d.x * d.x * 110 + (d.y + 0.14) ** 2 * 50)) * Math.max(0, d.z);
    const socket = -0.012 * Math.exp(-((Math.abs(d.x) - 0.42) ** 2 * 30 + (d.y - 0.1) ** 2 * 40)) * Math.max(0, d.z);
    out.set(d.x * face.rx * jaw, d.y * face.ry, d.z * face.rz * (d.y < 0 ? 1 - 0.15 * d.y * d.y : 1)).add(face.c);
    return out.addScaledVector(d, cheek + chin + bridge + nose + socket);
  };
  const faceGeo = new THREE.SphereGeometry(1, 72, 54), fp = faceGeo.attributes.position, v = new THREE.Vector3();
  const skinC = new THREE.Color(M.skin), shadeC = new THREE.Color(M.skinShade), blushC = new THREE.Color(M.blush), eyeC = new THREE.Color(M.shadow);
  for (let i = 0; i < fp.count; i++) { faceAt(fp.getX(i), fp.getY(i), fp.getZ(i), v); fp.setXYZ(i, v.x, v.y, v.z); }
  faceGeo.computeVertexNormals();
  roseColorizeFn(faceGeo, (x, y, z, c) => {
    const d = v.set(x, y, z).sub(face.c).normalize();
    c.lerpColors(shadeC, skinC, roseSmooth(-0.4, 0.55, d.z));
    c.lerp(blushC, 0.9 * Math.exp(-((Math.abs(d.x) - 0.5) ** 2 * 1.3 + (d.y + 0.24) ** 2) * 14));
    const ex = Math.abs(d.x) - 0.45, ey = d.y - 0.2;   // eyeshadow sweeps up and out above each eye, fading toward the nose
    c.lerp(eyeC, 0.75 * Math.exp(-(ex * ex * (ex < 0 ? 70 : 22) + ey * ey * 80 - ex * ey * 40)) * roseSmooth(0.02, 0.16, d.y));
  });
  const skin = roseBatch().add(faceGeo);
  // Arched brows (her left one cocked a little higher), a smirk and a soft lower lip
  for (const side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 8; i++) { const s = i / 8; pts.push(faceAt(side * (0.16 + 0.46 * s), (side > 0 ? 0.5 + 0.16 * Math.sin(Math.PI * Math.pow(s, 0.65)) : 0.4 + 0.1 * Math.sin(Math.PI * Math.pow(s, 0.8)) + 0.04 * s), 0.85).toArray()); }
    skin.add(roseTube(pts, t => 0.0035 + 0.0065 * Math.sin(Math.PI * Math.pow(t, 0.55)), M.brow, 16, 6));
  }
  const mouth = []; for (let i = 0; i <= 10; i++) { const s = i / 10 * 2 - 1; mouth.push(faceAt(s * 0.15 + 0.015, -0.47 + 0.012 * s * s + 0.13 * Math.max(0, s) ** 2.4, 0.88).toArray()); }
  skin.add(roseTube(mouth, t => 0.0062 * (0.3 + 0.7 * Math.sin(Math.PI * Math.pow(t, 0.8))), 0x5a0a2c, 20, 6));
  const lipGeo = roseColorizeFn(new THREE.SphereGeometry(1, 20, 12), (x, y, z, c) => c.set(M.lip).lerp(skinC, roseSmooth(0.3, 1, Math.abs(x)) * 0.7));
  skin.add(lipGeo, faceAt(0.03, -0.515, 0.86).toArray(), [0.4, 0, 0.18], [0.03, 0.0095, 0.009]);   // soft lower lip, pulled toward the smirk
  skin.add(roseColorize(new THREE.SphereGeometry(1, 10, 8), 0x8a2a5a), faceAt(0.185, -0.35, 0.86).toArray(), [0, 0, 0], [0.006, 0.006, 0.003]);   // smirk dimple
  // Eyes: big almond whites between an animated upper lid and a lower lid; dark violet irises with glints
  const eyes = [], lids = [];
  const whiteGeo = roseColorizeFn(new THREE.SphereGeometry(1, 28, 20), (x, y, z, c) => c.set(0xfdf6ff).lerp(new THREE.Color(0xc4a8dc), roseSmooth(0.0, 0.9, y) * 0.65 + roseSmooth(0.3, -1, z) * 0.3));
  const irisGeo = roseColorizeFn(new THREE.SphereGeometry(1, 28, 16), (x, y, z, c) => {
    const r = Math.hypot(x, y);
    c.set(M.iris).lerp(new THREE.Color(M.irisRim), roseSmooth(0.5, 0.85, r) * 0.55 * roseSmooth(0.2, -0.6, y)).lerp(new THREE.Color(0x080110), roseSmooth(0.86, 1, r) * 0.8);
    if (r < 0.46) c.set(0x050108);
  });
  const glintGeo = new THREE.SphereGeometry(1, 10, 8); glintGeo.deleteAttribute('uv');
  const eyeBatch = roseBatch(), irisBatch = eyeBatch, glintBatch = roseBatch();
  const lidGeo = (lower) => roseColorizeFn(new THREE.SphereGeometry(lower ? 1.045 : 1.13, 36, 14, 0, Math.PI * 2, lower ? Math.PI / 2 : 0, Math.PI / 2),
    (x, y, z, c) => lower ? c.set(M.skin).lerp(eyeC, roseSmooth(-0.12, -0.01, y) * 0.3)
      : c.set(M.skin).lerp(eyeC, roseSmooth(0.85, 0.15, y)).lerp(new THREE.Color(0x1e0426), roseSmooth(0.16, 0.0, y)));
  for (const side of [-1, 1]) {
    const d = new THREE.Vector3(side * 0.44, 0.1, 0.9).normalize(), at = faceAt(d.x, d.y, d.z).addScaledVector(d, -0.028);
    const frame = new THREE.Group(); frame.position.copy(at); frame.rotation.set(-0.1, side * 0.44, side * 0.2, 'YXZ'); frame.scale.set(0.098, 0.084, 0.056);
    head.add(frame); frame.updateMatrix();
    const local = (p, r, s) => { tmp.position.set(...p); tmp.rotation.set(...r); tmp.scale.set(...s); tmp.updateMatrix(); return mtx.multiplyMatrices(frame.matrix, tmp.matrix); };
    eyeBatch.addMatrix(whiteGeo, local([0, 0, 0], [0, 0, 0], [1, 1, 1]));
    irisBatch.addMatrix(irisGeo, local([side * -0.07, -0.05, 0.82], [0, 0, 0], [0.56, 0.7, 0.17]));
    glintBatch.addMatrix(glintGeo, local([side * -0.07 - 0.2, 0.16, 0.99], [0, 0, 0], [0.15, 0.19, 0.05]));
    glintBatch.addMatrix(glintGeo, local([side * -0.07 + 0.14, -0.3, 0.97], [0, 0, 0], [0.07, 0.09, 0.04]));
    skin.addMatrix(lidGeo(true), local([0, 0, 0], [0.62, 0, 0], [1, 1, 1]));
    // Upper lid: eyeshadow fading to an eyeliner lash line, with long lashes flicking out at the outer corner
    const lid = roseBatch().add(lidGeo(false));
    for (let k = 0; k < 4; k++) {
      const a = (0.1 + k * 0.15) * Math.PI / 2, ox = side * Math.cos(a) * 1.13, oz = Math.sin(a) * 1.13, len = 0.85 - k * 0.15, out = side * (1.1 - k * 0.22);
      lid.add(roseTube([[ox, 0, oz], [ox + out * 0.35 * len, 0.2 * len, oz + 0.35 * len], [ox + out * 0.55 * len, 0.75 * len, oz + 0.3 * len]],
        t => 0.075 * (1 - t) + 0.012, 0x1a0420, 8, 5));
    }
    lids.push(lid.build(frame, mat.skin)); eyes.push(frame);
  }
  skin.build(head, mat.skin);
  eyeBatch.build(head, mat.gloss); glintBatch.build(head, mat.glint);

  // Petal hood: three rings rooted around the face rim, each curling forward to frame it
  const hood = roseBatch();
  const rings = [
    { n: 8, r: 0.215, z: -0.03, len: 0.16, wid: 0.3, tilt: 1.3, bend: 1.05, back: 0.25, spread: 2.45, deep: 0.05 },
    { n: 7, r: 0.19, z: -0.02, len: 0.26, wid: 0.36, tilt: 0.75, bend: 0.8, back: 0.5, spread: 2.6, deep: 0.12 },
    { n: 8, r: 0.205, z: -0.1, len: 0.32, wid: 0.42, tilt: 0.45, bend: 1.0, back: 0.55, spread: 2.8, deep: 0.04 },
    { n: 7, r: 0.21, z: -0.19, len: 0.33, wid: 0.46, tilt: 0.18, bend: 1.0, back: 0.7, spread: 2.95, deep: 0 },
  ];
  rings.forEach((ring, li) => {
    for (let i = 0; i < ring.n; i++) {
      const f = i / (ring.n - 1) * 2 - 1, phi = f * ring.spread + (li % 2 ? 0.1 : 0);
      const low = Math.max(0, Math.abs(phi) - 1.7);   // petals around the jaw are smaller and tucked
      const geo = rosePetalGeo({ len: ring.len * (1 - low * 0.35), wid: ring.wid * (1 - low * 0.25), bend: ring.bend, back: ring.back,
        cup: 0.045, roll: 0.02, th: 0.012, seed: i + li * 7, deep: ring.deep, rows: 20, cols: 12 });
      const lift = (i % 2) * 0.012;   // alternate petals sit proud and twist slightly, so edges shingle instead of crossing
      hood.add(geo, [Math.sin(phi) * (ring.r + lift), Math.cos(phi) * (ring.r + lift), ring.z + lift], [ring.tilt + low * 0.25, 0.14, -phi], 1, 'ZXY');
      geo.dispose();
    }
  });
  // Spiral bud on the back of the head: golden-angle petals, tightly closed in the middle, opening outward
  const budAxis = new THREE.Object3D(); budAxis.position.set(0, 0.04, -0.14); budAxis.rotation.x = -(Math.PI / 2 - 0.6); budAxis.updateMatrix();
  const spin = new THREE.Object3D(), pet = new THREE.Object3D(), N = 20;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), R = 0.018 + 0.2 * Math.pow(k, 1.25);
    const geo = rosePetalGeo({ len: 0.11 + 0.22 * k, wid: R * (2.6 + 0.4 * k), wrap: R * 1.02, bend: 0.5 * (1 - k) - 0.05, back: 0.1 + 0.75 * k,
      cup: 0.0, roll: 0.02 + 0.03 * k, th: 0.009, seed: i * 3.1, deep: 0.6 * (1 - k) ** 1.5, rows: 16, cols: 11 });
    spin.rotation.set(0, i * 2.39996, 0); spin.updateMatrix();
    pet.position.set(0, 0.09 * (1 - k) - 0.05 * k, -R * 0.95); pet.rotation.set(-(0.02 + 0.82 * Math.pow(k, 1.6)), 0, 0); pet.updateMatrix();
    hood.addMatrix(geo, mtx.multiplyMatrices(budAxis.matrix, spin.matrix).multiply(pet.matrix));
    geo.dispose();
  }
  // Inner fill so no gap ever shows between the face and the petals
  hood.add(roseColorize(new THREE.SphereGeometry(0.24, 28, 20), M.petalDeep), [0, 0.0, -0.06]);
  // Calyx: green sepals cupping the bloom from below
  const calyx = hood, sepal = roseLeafGeo({ len: 0.26, wid: 0.08, bend: -0.9, fold: 0.25, th: 0.006, serr: 0.3, rows: 12, cols: 5 });
  for (let i = 0; i < 5; i++) { const az = i / 5 * Math.PI * 2 + Math.PI / 5; calyx.add(sepal, [Math.sin(az) * 0.04, -0.27, Math.cos(az) * 0.04 - 0.06], [1.5, az, 0], 1, 'YXZ'); }
  hood.build(head, mat.petal);


  const arm = { muzzle, flash, recoil: 0, spinSpeed: 0, flashT: 0, side: -1 };
  const fade = Object.values(mat).filter(m => m !== mat.shell && m !== mat.core)
    .map(m => ({ m, color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : null }));
  return { root, hips, torso, head, eyes, lids, skirt, shoulders: arms3.map(a => a.shoulder), elbows: arms3.map(a => a.elbow),
    hands: arms3.map(a => a.hand), wand, orb, orbCore, orbGlow, orbShell, motes, hoverGlow, hemMotes, arms: [arm], mats: mat, fade };
}

// =====================================================================
// animateRose
// =====================================================================
// Arm pose = [shoulder x, y, z, elbow x, hand x] (radians); index 0 = right (wand) arm, 1 = left arm
const ROSE_POSES = {
  rest: [[-0.45, 0.1, -0.42, -1.15, 0.35], [1.2, -0.72, 0.94, -1.97, 0.3]],
  aim: [[-1.35, 0.25, -0.12, -0.25, 0.5], [-0.2, 0, 0.5, -0.9, 0.3]],
  down: [[0.15, 0, -0.25, -0.2, 0], [0.15, 0, 0.25, -0.2, 0]],
};
function roseArmPose(C, pose, w = 1) {
  for (let i = 0; i < 2; i++) {
    const p = pose[i], s = C.shoulders[i], e = C.elbows[i], h = C.hands[i];
    s.rotation.x += (p[0] - s.rotation.x) * w; s.rotation.y += (p[1] - s.rotation.y) * w; s.rotation.z += (p[2] - s.rotation.z) * w;
    e.rotation.x += (p[3] - e.rotation.x) * w; h.rotation.x += (p[4] - h.rotation.x) * w;
  }
}
function animateRose(h, dt) {
  const C = h.corn, A = h.anim, M = ROSE_TUNING.model, K = ROSE_TUNING.anim;
  const r = h.rose ||= { enigma: 0, castT: 9, cast: '' };
  A.t += dt;
  const a = C.arms[0]; a.recoil *= Math.exp(-dt * K.recoilRecovery); a.flashT -= dt;
  C.root.scale.set(1, 1, 1);
  // Arcane Enigma blend (eases in and out)
  A.ghost = (A.ghost || 0) + ((r.enigma > 0 && !h.downed ? 1 : 0) - (A.ghost || 0)) * Math.min(1, dt / K.enigmaFade * 3);
  const g = A.ghost;
  roseFade(C, g);
  if (h.downed) {
    a.flash.visible = false; C.hoverGlow.visible = C.hemMotes.visible = false;
    C.hips.position.y += (-0.18 - C.hips.position.y) * Math.min(1, dt * 6);
    C.head.rotation.x += (0.5 - C.head.rotation.x) * Math.min(1, dt * 5);
    roseArmPose(C, ROSE_POSES.down, Math.min(1, dt * 5));
    C.orbCore.scale.setScalar(0.6);
    return;
  }
  // Velocity in model space (+Z forward, +X her left)
  const fwd = yawForward(h.yaw), vf = h.vel.x * fwd.x + h.vel.z * fwd.z, vs = h.vel.x * -fwd.z + h.vel.z * fwd.x;
  const lx = -vs, lz = vf, speed = Math.hypot(lx, lz) / h.stats.speed, damp = 1 - Math.exp(-dt * 6);
  A.leanF += (lz / h.stats.speed - A.leanF) * damp; A.leanS += (lx / h.stats.speed - A.leanS) * damp;
  A.air += ((h.onGround ? 0 : 1) - A.air) * (1 - Math.exp(-dt * 8));
  const yawRate = dt > 0 ? Math.atan2(Math.sin(h.yaw - (A.lastYaw ?? h.yaw)), Math.cos(h.yaw - (A.lastYaw ?? h.yaw))) / dt : 0;
  A.lastYaw = h.yaw; A.turn = (A.turn || 0) + (THREE.MathUtils.clamp(yawRate, -4, 4) - (A.turn || 0)) * damp;
  // Hover: slow bob, enigma lift, forward lean when gliding fast
  const breath = Math.sin(A.t * K.breathe);
  C.hips.position.y = K.hover + Math.sin(A.t * K.bobRate) * K.bob + g * K.enigmaLift + A.air * 0.05;
  C.hips.rotation.x = A.leanF * K.lean;
  C.hips.rotation.z = -A.leanS * K.lean * 0.6; C.hips.rotation.y = 0;   // the enigma cast spins it below
  C.torso.scale.set(1 + breath * 0.012, 1 + breath * 0.008, 1 + breath * 0.012);
  // Skirt: each panel is a lagged spring that trails the motion and flutters when airborne
  for (const p of C.skirt) {
    const dx = Math.sin(p.az), dz = Math.cos(p.az);
    const radial = -(lx * dx + lz * dz) * K.skirtTrail, tang = -(lx * dz - lz * dx) * K.skirtTrail;
    const flutter = A.air * (K.airFlare + 0.12 * Math.sin(A.t * 14 + p.seed)) + Math.sin(A.t * 1.3 + p.seed) * 0.03;
    const target = THREE.MathUtils.clamp(radial, -0.25, 0.9) + flutter + g * 0.25;
    p.v += ((target - p.x) * K.skirtK - p.v * K.skirtD) * dt; p.x += p.v * dt;
    p.sv += ((tang - p.s) * K.skirtK - p.sv * K.skirtD) * dt; p.s += p.sv * dt;
    p.pivot.rotation.x = -p.x; p.pivot.rotation.z = p.s;
    roseOrbit(C, p, g, A.t);
  }
  // Head: tilt into turns, idle sass tilt, aim elevation follow
  const idleTilt = Math.sin(A.t * Math.PI * 2 / K.tiltEvery) * 0.08;
  C.head.rotation.z = -A.turn * K.headTurn + idleTilt + A.leanS * 0.1;
  C.head.rotation.x = -h.aimElev * 0.4 - C.hips.rotation.x * 0.6 + breath * 0.01;
  C.head.rotation.y = A.turn * 0.05;
  // Arms: rest ↔ aim (holding fire or just fired), then cast gestures on top
  A.aimHold = h.input.fire || h.zoom > 0.2 ? K.aimHold : Math.max(0, (A.aimHold || 0) - dt);
  A.aimW = (A.aimW || 0) + ((A.aimHold > 0 ? 1 : 0) - (A.aimW || 0)) * Math.min(1, dt * 10);
  roseArmPose(C, ROSE_POSES.rest, 1);
  const aimPose = ROSE_POSES.aim.map((p, i) => i ? p : [p[0] - h.aimElev, p[1], p[2], p[3], p[4]]);
  roseArmPose(C, aimPose, A.aimW);
  C.shoulders[0].rotation.x += Math.sin(A.t * 1.6) * 0.03; C.shoulders[1].rotation.z += Math.sin(A.t * 1.6 + 1) * 0.04;
  roseCast(C, r, A, dt);
  // Wand flick + orb flare on every shot
  C.hands[0].rotation.x += -a.recoil * K.wandFlick;
  const pulse = 1 + Math.sin(A.t * 4) * 0.08 + a.recoil * 0.5 + g * 0.2;
  C.orbCore.scale.setScalar(pulse); C.orbShell.scale.setScalar(1 + a.recoil * 0.25 + Math.sin(A.t * 4 + 1) * 0.04);
  C.mats.shell.emissiveIntensity = 0.6 + a.recoil * 1.2 + g;
  a.flash.visible = a.flashT > 0;
  // Motes orbit the orb; the aura swirls around her in the ethereal form
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), m4 = new THREE.Matrix4(), p3 = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    const ang = A.t * (2.0 + i * 0.25) + i * 0.8, rad = 0.17 + 0.03 * Math.sin(A.t * 3 + i);
    p3.set(Math.cos(ang) * rad, Math.sin(A.t * 2 + i * 2) * 0.05, Math.sin(ang) * rad);
    s.setScalar(0.012 + 0.008 * Math.sin(A.t * 7 + i * 2) ** 2 + a.recoil * 0.008);
    C.motes.setMatrixAt(i, m4.compose(p3, q, s));
  }
  C.motes.instanceMatrix.needsUpdate = true;
  roseHover(C, A, g);
  {   // Arcane Enigma aura: sparkles swirling around her (instances 12..25 of the hem sparkle mesh)
    for (let i = 0; i < 14; i++) {
      const ang = A.t * (0.6 + (i % 3) * 0.2) + i * 0.45, rad = 0.55 + 0.15 * Math.sin(i * 2.1), y = 0.4 + (i / 14) * 2.0 + Math.sin(A.t + i) * 0.1;
      p3.set(Math.cos(ang) * rad, y + C.hips.position.y, Math.sin(ang) * rad);
      s.setScalar((0.018 + 0.012 * Math.sin(A.t * 5 + i) ** 2) * g);
      C.hemMotes.setMatrixAt(12 + i, m4.compose(p3, q, s));
    }
  }
  // Blinks (lids close), half-lidded rest look
  A.blink -= dt; if (A.blink < 0) A.blink = randRange(K.blinkInterval);
  const close = A.blink < 0.14 ? 1 - Math.abs(A.blink - 0.07) / 0.07 : 0;
  C.lids.forEach((l, i) => { l.rotation.x = (i ? -0.45 : -0.34) + close * 2.0; });
}
// Hover FX: ground glow breathes with the bob; sparkles fall from the hem ring and fade
function roseHover(C, A, g) {
  const lift = C.hips.position.y, q = new THREE.Quaternion(), s = new THREE.Vector3(), m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  C.hoverGlow.visible = C.hemMotes.visible = true;
  C.hoverGlow.scale.setScalar(1 - lift * 0.6 + Math.sin(A.t * 3) * 0.03);
  for (let i = 0; i < 12; i++) {
    const life = (A.t * 0.45 + i / 12) % 1, ang = i * 2.39996 + A.t * 0.3, rad = 0.36 + 0.06 * Math.sin(i * 3.1) - life * 0.08;
    p.set(Math.sin(ang) * rad, 0.3 + lift - life * 0.28, Math.cos(ang) * rad);
    s.setScalar((0.016 + 0.008 * Math.sin(i * 5.3) ** 2) * Math.sin(life * Math.PI) * (1 + g));
    C.hemMotes.setMatrixAt(i, m4.compose(p, q, s));
  }
  C.hemMotes.instanceMatrix.needsUpdate = true;
}
// Cast gestures (castT = seconds since cast start)
function roseCast(C, r, A, dt) {
  const K = ROSE_TUNING.anim, u = r.castT / K.castTime;
  if (!r.cast || u >= 1) return;
  const w = Math.sin(Math.PI * Math.min(1, u * 1.4)) ** 0.5;   // ease in fast, settle out
  const sh = C.shoulders, el = C.elbows, hd = C.hands;
  if (r.cast === 'goat') {   // point forward and twirl a small circle
    const tw = u * Math.PI * 4;
    sh[0].rotation.x += (-1.45 + Math.sin(tw) * 0.15 - sh[0].rotation.x) * w;
    sh[0].rotation.z += (-0.12 + Math.cos(tw) * 0.15 - sh[0].rotation.z) * w;
    el[0].rotation.x += (-0.15 - el[0].rotation.x) * w; hd[0].rotation.x += (0.6 - hd[0].rotation.x) * w;
  } else if (r.cast === 'snare') {   // raise overhead, sweep down to the ground
    const down = roseSmooth(0.35, 0.8, u);
    sh[0].rotation.x += (THREE.MathUtils.lerp(-2.9, -0.7, down) - sh[0].rotation.x) * w;
    sh[0].rotation.z += (-0.25 - sh[0].rotation.z) * w;
    el[0].rotation.x += (THREE.MathUtils.lerp(-0.3, -0.1, down) - el[0].rotation.x) * w;
    sh[1].rotation.x += (THREE.MathUtils.lerp(-2.4, -0.5, down) - sh[1].rotation.x) * w;
    sh[1].rotation.z += (0.4 - sh[1].rotation.z) * w;
  } else if (r.cast === 'enigma') {   // arms spread, spin
    sh[0].rotation.z += (-1.35 - sh[0].rotation.z) * w; sh[1].rotation.z += (1.35 - sh[1].rotation.z) * w;
    sh[0].rotation.x += (-0.3 - sh[0].rotation.x) * w; sh[1].rotation.x += (-0.3 - sh[1].rotation.x) * w;
    el[0].rotation.x += (-0.2 - el[0].rotation.x) * w; el[1].rotation.x += (-0.2 - el[1].rotation.x) * w;
    C.hips.rotation.y = roseSmooth(0, 1, u) * Math.PI * 2;
  }
}
// Arcane Enigma: the outer gown petals leave the skirt and drift around her in a slow tilted orbit
function roseOrbit(C, p, g, t) {
  const rest = Math.sin(p.az) * p.radius, restZ = Math.cos(p.az) * p.radius;
  if (p.layer !== 1) return;
  const o = roseSmooth(0, 1, g), ang = p.az + t * 0.55, rad = 0.62 + 0.08 * Math.sin(t * 0.9 + p.seed);
  p.pivot.position.set(rest + (Math.sin(ang) * rad - rest) * o, p.y + o * (0.35 + 0.3 * Math.sin(ang * 2 + p.seed) + 0.2 * Math.sin(t * 1.3 + p.seed)),
    restZ + (Math.cos(ang) * rad - restZ) * o);
  p.pivot.rotation.y = p.az + o * (ang - p.az + Math.PI / 2);
  p.pivot.rotation.z += o * (0.6 + 0.3 * Math.sin(t + p.seed));
  p.pivot.scale.setScalar(1 - 0.45 * o);
}
// Ghost fade for Arcane Enigma: translucent violet glow (per-rig materials only)
const roseGhostColor = new THREE.Color(ROSE_TUNING.anim.enigmaGlow);
function roseFade(C, g) {
  if (C.lastGhost === g) return; C.lastGhost = g;
  const K = ROSE_TUNING.anim;
  for (const f of C.fade) {
    f.m.opacity = 1 - (1 - K.enigmaOpacity) * g;
    f.m.color.copy(f.color).lerp(roseGhostColor, g * 0.35);
    if (f.emissive) f.m.emissive.copy(f.emissive).lerp(roseGhostColor, g * 0.55);
  }
}

// =====================================================================
// Goatify goat — cute cartoon goat; feet at y = 0, facing +Z. One vertex-coloured material + glossy eyes, 11 meshes.
// =====================================================================
const GOAT_TUNING = CONFIG.ROSE.goat;
// Soft lumpy blob (indexed sphere, so normals stay smooth), shaded darker underneath
function goatBlob(x, y, z, rx, ry = rx, rz = rx, bump = 0.05) {
  const G = GOAT_TUNING, g = new THREE.SphereGeometry(1, 22, 16), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), k = 1 + bump * Math.sin(vx * 9 + vz * 5) * Math.sin(vy * 8 + vx * 4);
    p.setXYZ(i, vx * k * rx + x, vy * k * ry + y, vz * k * rz + z);
  }
  g.computeVertexNormals();
  const wool = new THREE.Color(G.wool), shade = new THREE.Color(G.woolShade);
  return roseColorizeFn(g, (px, py, pz, c) => c.lerpColors(shade, wool, roseSmooth(y - ry * 1.1, y + ry * 0.3, py)));
}
function goatMesh(parent, geo, mat = ROSE_MAT.goat, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
const goatGeo = batch => batch.build(new THREE.Group(), ROSE_MAT.goat).geometry;   // merged geometry of a part batch
function buildGoat() {
  const G = GOAT_TUNING, root = new THREE.Group(), body = new THREE.Group(); body.position.y = G.bodyY; root.add(body);
  // Barrel body with fluffy tufts along the back and a chest ruff
  const bb = roseBatch().add(goatBlob(0, 0, 0, 0.2, 0.19, 0.3, 0.03));
  for (const [x, y, z, r] of [[0, 0.13, 0.12, 0.13], [0, 0.15, -0.06, 0.13], [0.08, 0.1, -0.17, 0.11], [-0.08, 0.1, -0.17, 0.11],
    [0.1, 0.09, 0.05, 0.12], [-0.1, 0.09, 0.05, 0.12], [0, 0.03, 0.25, 0.14], [0, -0.07, 0.22, 0.11]]) bb.add(goatBlob(x, y, z, r, r * 0.9, r, 0.08));
  goatMesh(body, goatGeo(bb));
  // Legs: slim shins with knobby knees and dark hooves, pivoting at the hip
  const legs = [], legGeo = new THREE.LatheGeometry([[0, -0.46], [0.04, -0.46], [0.045, -0.41], [0.033, -0.39], [0.026, -0.32],
    [0.034, -0.25], [0.027, -0.18], [0.036, -0.06], [0.045, 0.02], [0, 0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
  roseColorizeFn(legGeo, (px, py, pz, c) => c.set(py < -0.385 ? G.hoof : G.skin).multiplyScalar(py < -0.385 ? 1 : 0.92 + 0.08 * roseSmooth(-0.38, 0, py)));
  legGeo.computeVertexNormals();
  for (const [x, z] of [[0.1, 0.19], [-0.1, 0.19], [0.1, -0.19], [-0.1, -0.19]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, -0.09, z); body.add(pivot); goatMesh(pivot, legGeo); legs.push(pivot);
  }
  // Head: big round skull, long soft muzzle, nostrils, a forelock tuft and horns curling back
  const head = new THREE.Group(); head.position.set(0, 0.22, 0.3); body.add(head);
  const hb = roseBatch();
  hb.add(roseColorizeFn(new THREE.SphereGeometry(0.15, 28, 20), (x, y, z, c) => c.set(G.skin).lerp(new THREE.Color(G.woolShade), roseSmooth(0, -0.15, y) * 0.35)), [0, 0.05, 0], [0, 0, 0], [1, 1.02, 1.08]);
  hb.add(roseColorizeFn(new THREE.SphereGeometry(0.1, 24, 16), (x, y, z, c) => c.set(G.muzzle).lerp(new THREE.Color(G.skin), roseSmooth(0.0, -0.1, z) * 0.8)),
    [0, -0.035, 0.12], [0.45, 0, 0], [0.9, 0.85, 1.4]);
  for (const side of [-1, 1]) hb.add(roseColorize(new THREE.SphereGeometry(0.016, 10, 8), G.nose), [side * 0.03, -0.035, 0.25], [0, 0, 0], [1, 0.65, 0.6]);
  hb.add(goatBlob(0, 0.18, 0.06, 0.05, 0.04, 0.05, 0.12)).add(goatBlob(0.035, 0.17, 0.02, 0.04, 0.035, 0.04, 0.12)).add(goatBlob(-0.035, 0.17, 0.02, 0.04, 0.035, 0.04, 0.12));
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, a = t * Math.PI * 1.35; pts.push([side * (0.06 + t * 0.07), 0.16 + Math.sin(a) * 0.11, -0.02 - (1 - Math.cos(a)) * 0.075]); }
    hb.add(roseTube(pts, t => 0.032 * (1 - t * 0.78), (x, y, z, c) => c.set(G.horn).multiplyScalar(0.82 + 0.18 * Math.sin((y * 0.7 - z) * 150)), 30, 9));
  }
  goatMesh(head, goatGeo(hb));
  // Eyes: big goofy mismatched whites with sideways goat pupils looking different ways
  const eb = roseBatch();
  for (const [side, r, look] of [[-1, 0.068, 0.25], [1, 0.06, -0.1]]) {
    eb.add(roseColorize(new THREE.SphereGeometry(r, 22, 16), 0xffffff), [side * 0.085, 0.1, 0.085], [0, 0, 0], [1, 1.08, 0.85]);
    eb.add(roseColorize(new THREE.SphereGeometry(1, 14, 10), G.pupil), [side * 0.085 + look * r * 0.5, 0.098, 0.085 + r * 0.82], [0, look, side * 0.15], [r * 0.48, r * 0.22, r * 0.18]);
  }
  goatMesh(head, goatGeo(eb), ROSE_MAT.goatEye);
  // Jaw with a beard tuft (chews), floppy ears (flick), tail tuft (wags)
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.08); head.add(jaw);
  const jb = roseBatch().add(roseColorize(new THREE.SphereGeometry(0.06, 16, 10), G.muzzle), [0, -0.005, 0.07], [0.3, 0, 0], [0.85, 0.5, 1.2]);
  jb.add(roseColorizeFn(new THREE.ConeGeometry(0.035, 0.14, 12), (x, y, z, c) => c.set(G.wool).lerp(new THREE.Color(G.woolShade), roseSmooth(0.06, -0.07, y) * 0.4)), [0, -0.08, 0.05], [Math.PI - 0.3, 0, 0]);
  goatMesh(jaw, goatGeo(jb));
  const ears = [], earGeo = roseColorizeFn(new THREE.SphereGeometry(1, 16, 10), (x, y, z, c) => c.set(G.skin).lerp(new THREE.Color(G.muzzle), roseSmooth(0, 1, y) * 0.6 * roseSmooth(-0.2, 1, z)));
  earGeo.translate(0, 1, 0); earGeo.scale(0.038, 0.09, 0.016);
  for (const side of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(side * 0.13, 0.1, -0.03); ear.rotation.set(0.25, 0, side * -1.3); head.add(ear);
    goatMesh(ear, earGeo); ears.push(ear);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.3); tail.rotation.x = -0.7; body.add(tail);
  goatMesh(tail, goatGeo(roseBatch().add(goatBlob(0, 0.04, 0, 0.04, 0.05, 0.04, 0.1)).add(goatBlob(0, 0.085, -0.01, 0.03, 0.035, 0.03, 0.1))));
  return { root, body, head, jaw, ears, legs, tail, phase: 0, move: 0, flick: 2, flickT: 0 };
}
// Idle: chew, ear flicks, a little head sway. Moving: bouncy trot with diagonal leg pairs.
function animateGoat(goat, t, moving, dt) {
  const G = GOAT_TUNING;
  goat.move += ((moving ? 1 : 0) - goat.move) * Math.min(1, dt * 8);
  const m = goat.move;
  goat.phase += dt * G.trotRate * m;
  const s = Math.sin(goat.phase), c = Math.cos(goat.phase);
  goat.body.position.y = G.bodyY + Math.abs(s) * G.bounce * m + Math.sin(t * 2) * 0.004;
  goat.body.rotation.x = c * 0.06 * m;
  goat.legs.forEach((leg, i) => { leg.rotation.x = (i === 0 || i === 3 ? s : -s) * G.stride * m; });
  goat.head.rotation.x = Math.sin(t * 0.8) * 0.06 + s * 0.1 * m - 0.05;
  goat.head.rotation.y = Math.sin(t * 0.5) * 0.15 * (1 - m);
  goat.jaw.rotation.x = (0.1 + Math.sin(t * G.chewRate) * 0.09) * (1 - m * 0.7);
  goat.jaw.rotation.z = Math.sin(t * G.chewRate * 0.5) * 0.08 * (1 - m);
  goat.flick -= dt;
  if (goat.flick < 0) { goat.flick = randRange(G.earFlick); goat.flickT = 0.25; }
  goat.flickT = Math.max(0, goat.flickT - dt);
  const f = Math.sin(goat.flickT / 0.25 * Math.PI) * 0.5;
  goat.ears.forEach((ear, i) => { ear.rotation.z = (i ? 1 : -1) * (-1.3 + f * (i ? 1 : 0.3) + s * 0.2 * m); });
  goat.tail.rotation.z = Math.sin(t * 9) * 0.35;
}

// Magic Thistles projectile (~0.35 m): purple bud with spiky bracts, a pink tuft at the front and a glow, along +Z
function buildThistle() {
  const g = new THREE.Group(), b = roseBatch();
  const bud = roseColorizeFn(new THREE.SphereGeometry(1, 20, 14), (x, y, z, c) => c.set(0x5a1a7a).lerp(new THREE.Color(0x2c4a1e), roseSmooth(0.2, -0.9, z)));
  b.add(bud, [0, 0, 0], [0, 0, 0], [0.055, 0.055, 0.09]);
  const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const spikeAt = (geo, pos, d, push) => {   // cone (+Y) placed at pos, pointing along d, base pushed out by push
    o.quaternion.setFromUnitVectors(up, dir.copy(d).normalize()); o.position.set(...pos).addScaledVector(dir, push); o.scale.setScalar(1);
    o.updateMatrix(); b.addMatrix(geo, o.matrix);
  };
  const bract = roseColorizeFn(new THREE.ConeGeometry(0.011, 0.06, 5), (x, y, z, c) => c.set(0x6a2a8a).lerp(new THREE.Color(0xd8a8ff), roseSmooth(0, 0.03, y)));
  for (let i = 0; i < 16; i++) {   // bracts point backward and outward around the bud like a thistle head
    const a = i * 2.39996, zz = -0.065 + (i / 16) * 0.11, r = 0.052 * Math.sqrt(Math.max(0, 1 - (zz / 0.09) ** 2));
    spikeAt(bract, [Math.cos(a) * r, Math.sin(a) * r, zz], new THREE.Vector3(Math.cos(a), Math.sin(a), -0.9), 0.02);
  }
  const tuft = roseColorizeFn(new THREE.ConeGeometry(0.008, 0.16, 4), (x, y, z, c) => c.set(0xff4cc0).lerp(new THREE.Color(0xffd6f6), roseSmooth(-0.04, 0.08, y)));
  for (let i = 0; i < 24; i++) {   // the pink tuft fans forward
    const a = i * 2.39996, spread = 0.12 + 0.5 * ((i * 7) % 11) / 11;
    spikeAt(tuft, [Math.cos(a) * 0.018, Math.sin(a) * 0.018, 0.06], new THREE.Vector3(Math.cos(a) * spread, Math.sin(a) * spread, 1), 0.08);
  }
  b.build(g, ROSE_MAT.thistle);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), ROSE_MAT.glow); glow.scale.set(0.04, 0.04, 0.13); glow.position.z = -0.07;
  g.add(glow);
  return g;
}

// Lab only: fresh class state, Rose visible, extras (goats / thistles) from earlier poses removed
const roseLabReset = h => {
  h.rose = { enigma: 0, castT: 9, cast: '' }; h.corn.root.visible = true;
  for (const o of [...h.mesh.children]) if (o !== h.corn.root) h.mesh.remove(o);
};
const ROSE_LAB = {   // render poses for tests/plant-models.cjs
  type: 'rose', build: buildRose, animate: animateRose, stats: { hp: 100 },
  poses: {
    face: { frames: 30, look: 2.0, distance: 1.7, setup: roseLabReset },
    idle: { look: 1.4, distance: 4.8, frames: 60, setup(h) {
      roseLabReset(h);
      let meshes = 0, tris = 0;
      h.corn.root.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
      console.log(`rose meshes ${meshes} triangles ${Math.round(tris)}`);
    } },
    glide: { look: 1.4, distance: 4.8, frames: 50, setup: roseLabReset, step(h) { h.vel.set(0, 0, -10); } },
    fire: { look: 1.4, distance: 4.8, frames: 38, setup(h) { roseLabReset(h); h.input.fire = true; }, step(h, f) { if (f % 12 === 0) { h.corn.arms[0].recoil = 1; h.corn.arms[0].flashT = 0.05; } } },
    castGoat: { look: 1.4, distance: 4.8, frames: 20, setup(h) { h.rose = { enigma: 0, castT: 0, cast: 'goat' }; }, step(h) { h.rose.castT += 1 / 60; } },
    castSnare: { look: 1.4, distance: 4.8, frames: 14, setup(h) { h.rose = { enigma: 0, castT: 0, cast: 'snare' }; }, step(h) { h.rose.castT += 1 / 60; } },
    enigma: { look: 1.4, distance: 4.8, frames: 40, setup(h) { h.rose = { enigma: 5, castT: 9, cast: '' }; } },
    jump: { look: 1.4, distance: 4.8, frames: 20, setup(h) { roseLabReset(h); h.onGround = false; h.vel.y = 4; } },
    goat: { look: 1.2, distance: 5.2, frames: 40, setup(h) {
      roseLabReset(h); h.rose.castT = 0.35; h.rose.cast = 'goat';
      const g = buildGoat(); g.root.position.set(1.4, -h.centerY, 0.2); h.mesh.add(g.root); h.labGoat = g;
      const g2 = buildGoat(); g2.root.position.set(-1.3, -h.centerY, -0.3); g2.root.rotation.y = 1.2; h.mesh.add(g2.root); h.labGoat2 = g2;
      const th = buildThistle(); th.position.set(0.9, 1.0 - h.centerY, 0.9); th.scale.setScalar(2); h.mesh.add(th); h.labThistle = th;
      let n = 0, tris = 0; g.root.traverse(o => { if (o.isMesh) { n++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
      let tn = 0; th.traverse(o => { if (o.isMesh) tn++; });
      console.log(`goat meshes ${n} triangles ${Math.round(tris)}; thistle meshes ${tn}`);
    }, step(h, f) { h.rose.castT = 0.35; animateGoat(h.labGoat, f / 60, false, 1 / 60); animateGoat(h.labGoat2, f / 60, true, 1 / 60); } },
    goatClose: { look: 0.6, distance: 2.4, frames: 30, setup(h) {
      roseLabReset(h); h.corn.root.visible = false;
      const g = buildGoat(); g.root.position.set(0, -h.centerY, 0); g.root.rotation.y = Math.PI; h.mesh.add(g.root); h.labGoat3 = g;
      const th = buildThistle(); th.position.set(-0.5, 1.0 - h.centerY, 0); th.rotation.y = Math.PI / 2; th.scale.setScalar(2.5); h.mesh.add(th);
    }, step(h, f) { animateGoat(h.labGoat3, f / 60, false, 1 / 60); } },
    downed: { look: 1.4, distance: 4.8, frames: 60, setup(h) { roseLabReset(h); h.downed = true; } },
  },
};

export { buildRose, animateRose, buildGoat, animateGoat, buildThistle, ROSE_LAB };
