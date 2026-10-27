// Citron — tank: model (peel shader + per-instance armour), EMPeach and animation, render poses.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';
import { randRange, yawForward, spawnParticle } from './shared.js';
import { makeMuzzleFlash } from './corn.js';

// =====================================================================
// Citron — cyborg orange bounty hunter from the future (tank / mobility). Procedural only.
// A dimpled citrus peel (shader oil glands) under a hard-surface kit drawn with one per-instance "armour" material:
// paint colour, metalness, roughness and a glow channel live in vertex attributes, so every limb is one draw and
// glows (seams, heat coils, visor, emitters) are driven per hero through five uniform channels.
// Model space: feet at y = 0, facing +Z; model +X is the plant's LEFT (the Orange Beam cannon is on −X).
// Ball form: eight orange-segment armour gores hinge on the two shoulder hubs (the X axis) and close over the peel.
// =====================================================================
const CITRON_TUNING = CONFIG.CITRON;   // model / animation tuning lives in CONFIG.CITRON
// Finishes for the armour material: [colour, metalness, roughness, glow, glow channel]
// Channels: 0 armour seams, 1 cannon heat, 2 visor, 3 cannon emitter, 4 Peel Shield emitter.
const CIT_FIN = (() => {
  const M = CITRON_TUNING.model;
  return {
    gun: [M.gunmetal, 0.75, 0.32], dark: [M.darkMetal, 0.7, 0.42], paint: [M.paint, 0.18, 0.3], chrome: [M.chrome, 1, 0.14],
    rubber: [M.rubber, 0, 0.82], glass: [M.glass, 0.55, 0.04, 0.1, 2], mouth: [0x2a0c05, 0, 0.75], lip: [0xc4500c, 0, 0.5],
    seam: [M.seamGlow, 0, 0.5, 1, 0], heat: [M.heatGlow, 0, 0.45, 1, 1], visor: [M.visorGlow, 0, 0.3, 1, 2],
    visorCore: [0xe4ffff, 0, 0.3, 1, 2], emitter: [M.emitterGlow, 0, 0.3, 1, 3], emitterCore: [0xffe6b8, 0, 0.3, 1.3, 3], shield: [M.shieldGlow, 0, 0.3, 1, 4],
    stem: [0x55762a, 0, 0.5], navel: [0x6b5a24, 0, 0.7], sepal: [0x4d7a26, 0, 0.45],
  };
})();
const CITRON_MAT = {
  peel: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, clearcoat: 0.8,
    clearcoatRoughness: 0.2, sheen: 0.25, sheenColor: 0xffc27a, envMapIntensity: 0.55 }),
  plant: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, clearcoat: 0.3, envMapIntensity: 0.5 }),
  leaf: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.34, clearcoat: 0.7,
    clearcoatRoughness: 0.2, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: CITRON_TUNING.model.gunmetal, metalness: 0.8, roughness: 0.32 }),
  peach: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.72, sheen: 1,
    sheenColor: 0xffe2c6, sheenRoughness: 0.4, envMapIntensity: 0.4 }),
};
// Citrus oil glands: two octaves of cellular pits bend the base and clear-coat normals (the waxy highlight breaks up
// like real peel), darken the pits a touch and fade out where a cell gets smaller than a pixel.
CITRON_MAT.peel.onBeforeCompile = shader => {
  const M = CITRON_TUNING.model;
  shader.uniforms.citPoreFreq = { value: new THREE.Vector2(...M.poreFreq) };
  shader.uniforms.citPoreDepth = { value: new THREE.Vector2(...M.poreDepth) };
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCitPeel;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCitPeel = position;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vCitPeel;
    uniform vec2 citPoreFreq, citPoreDepth;
    vec3 citHash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    float citCells(vec3 p) {
      vec3 i = floor(p), f = fract(p); float d = 8.0;
      for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z)), r = o + 0.15 + 0.7 * citHash(i + o) - f;
        d = min(d, dot(r, r));
      }
      return d;
    }
    vec3 citBump(vec3 n, vec3 surface, float height) {
      vec3 sx = dFdx(surface), sy = dFdy(surface), rx = cross(sy, n), ry = cross(n, sx);
      float det = dot(sx, rx);
      return normalize(abs(det) * n - sign(det) * (dFdx(height) * rx + dFdy(height) * ry));
    }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      float citFw = length(fwidth(vCitPeel));
      float citFadeA = 1.0 - smoothstep(0.22, 0.6, citFw * citPoreFreq.x), citFadeB = 1.0 - smoothstep(0.22, 0.6, citFw * citPoreFreq.y);
      float citA = smoothstep(0.0, 0.34, citCells(vCitPeel * citPoreFreq.x)), citB = smoothstep(0.0, 0.3, citCells(vCitPeel * citPoreFreq.y + 17.0));
      float citPit = (1.0 - citA) * citFadeA * 0.7 + (1.0 - citB) * citFadeB * 0.3;
      float citH = citA * citPoreDepth.x * citFadeA + citB * citPoreDepth.y * citFadeB;
      diffuseColor.rgb *= 1.0 - citPit * 0.035;`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + citPit * 0.12, 0.12, 0.9);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = citBump(normal, -vViewPosition, citH);`)
    .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
      clearcoatNormal = citBump(clearcoatNormal, -vViewPosition, citH * 0.7);`);
};
CITRON_MAT.peel.customProgramCacheKey = () => 'citron-peel-v1';

// Per-hero armour material (glow channels are uniforms, so two Citrons never share heat or visor state)
function citArmorMaterial() {
  const glow = Array.from({ length: 5 }, () => new THREE.Vector4(1, 1, 1, 0)), mix = [0, 0, 0, 0, 0];
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.4, metalness: 0.5,
    clearcoat: 0.3, clearcoatRoughness: 0.22, envMapIntensity: 0.95 });
  const uniforms = { citGlow: { value: glow }, citGlowMix: { value: mix } };
  mat.userData.glow = glow; mat.userData.mix = mix;   // glow[c] = (white-hot target rgb, intensity); mix[c] = 0..1 toward target
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 citPbr;\nvarying vec4 vCitPbr;\nvarying vec3 vCitPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCitPbr = citPbr; vCitPos = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec4 vCitPbr; varying vec3 vCitPos;
      uniform vec4 citGlow[5]; uniform float citGlowMix[5];`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 citGlowCol = diffuseColor.rgb;
        diffuseColor.rgb *= 1.0 - min(vCitPbr.z, 1.0) * 0.85;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float citGrain = sin(vCitPos.x * 157.0 + sin(vCitPos.y * 91.0)) * sin(vCitPos.z * 133.0 + vCitPos.y * 47.0);
        roughnessFactor = clamp(vCitPbr.y + citGrain * 0.035, 0.04, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = vCitPbr.x;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        int citCh = int(vCitPbr.w + 0.5); vec4 citG = vec4(0.0); float citM = 0.0;
        for (int i = 0; i < 5; i++) if (i == citCh) { citG = citGlow[i]; citM = citGlowMix[i]; }
        totalEmissiveRadiance += mix(citGlowCol, citG.rgb, citM) * vCitPbr.z * citG.a;`);
  };
  mat.customProgramCacheKey = () => 'citron-armor-v1';
  return mat;
}
// Soft additive glow shell (fake bloom): bright where the shell faces the camera, gone at its silhouette
function citHaloMaterial(color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vCitRim;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCitRim = abs(dot(normalize(normalMatrix * normal), normalize(-mvPosition.xyz)));');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCitRim;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= pow(vCitRim, 3.0);');
  };
  mat.customProgramCacheKey = () => 'citron-halo-v1';
  return mat;
}

// ---- geometry helpers (all hard-surface parts end with position / normal / color / citPbr so siblings merge) ----
const citSph = (r, az, el) => [r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az)];   // az 0 = +Z, + toward +X
const citGorePt = (r, t, a) => [r * Math.cos(t), r * Math.sin(t) * Math.sin(a), r * Math.sin(t) * Math.cos(a)];      // pole axis X, a 0 = +Z
const citCyl = (r, a, z) => [r * Math.sin(a), r * Math.cos(a), z];                                                    // around Z, a 0 = +Y
const citCylY = (r, a, y) => [r * Math.sin(a), y, r * Math.cos(a)];                                                   // around Y, a 0 = +Z
function citPaint(geo, finish) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), pbr = new Float32Array(n * 4), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const f = typeof finish === 'function' ? finish(p.getX(i), p.getY(i), p.getZ(i), i) : finish;
    c.set(f[0]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    pbr[i * 4] = f[1]; pbr[i * 4 + 1] = f[2]; pbr[i * 4 + 2] = f[3] || 0; pbr[i * 4 + 3] = f[4] || 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('citPbr', new THREE.BufferAttribute(pbr, 4));
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'citPbr'].includes(k)) geo.deleteAttribute(k);
  return geo;
}
// A soft-bevelled slab swept over any surface: point(u, s, h) → [x, y, z] for u ∈ [0, 1] along the part, s ∈ [-1, 1]
// across it and h ∈ [-1, 1] through its thickness (h = 1 is the outer face). The section is a superellipse, so edges
// catch a rounded highlight; `ends` > 0 rounds both tips closed. finish may be (u, s, h) → finish.
function citSlab(point, { segs = 32, sides = 16, bevel = 0.3, ends = 0, finish = CIT_FIN.gun } = {}) {
  const pos = [], uvw = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, e = ends ? Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), ends)), 1 / ends) : 1;
    for (let k = 0; k <= sides; k++) {
      const a = -Math.PI / 2 + k / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const sx = Math.sign(c) * Math.pow(Math.abs(c), bevel), sy = Math.sign(s) * Math.pow(Math.abs(s), bevel);
      pos.push(...point(u, sx * e, sy * Math.sqrt(e))); uvw.push(u, sx, sy);
    }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < sides; k++) {
    const a = i * (sides + 1) + k, b = a + sides + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // wind outward: at mid-length the outer face normal must point away from the inner face
  const v = i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const m = (segs >> 1) * (sides + 1), o = m + (sides >> 1);
  const n = v(o + sides + 1).sub(v(o)).cross(v(o + 1).sub(v(o)));
  if (n.dot(v(o).sub(v(m))) < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return citPaint(geo, typeof finish === 'function' ? (x, y, z, i) => finish(uvw[i * 3], uvw[i * 3 + 1], uvw[i * 3 + 2]) : finish);
}
// Lathe from [radius, height] rows (bottom to top); repeat a row for a hard edge. finish may be (row) → finish.
function citLathe(profile, segs, finish, axis = 'y') {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs), rows = profile.length;
  citPaint(geo, typeof finish === 'function' ? (x, y, z, i) => finish(i % rows) : finish);
  if (axis === 'z') geo.rotateX(Math.PI / 2); else if (axis === 'x') geo.rotateZ(-Math.PI / 2); else if (axis === '-x') geo.rotateZ(Math.PI / 2);
  return geo;
}
function citTube(points, radius, finish, segs = 24, sides = 8) {
  return citPaint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segs, radius, sides, false), finish);
}
// Average normals of coincident vertices (sphere seams / poles) so displaced spheres shade without a seam line
function citWeld(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, sums = new Map(), key = i => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), s = sums.get(k) || [0, 0, 0]; s[0] += n.getX(i); s[1] += n.getY(i); s[2] += n.getZ(i); sums.set(k, s); }
  for (let i = 0; i < p.count; i++) { const s = sums.get(key(i)), l = Math.hypot(...s) || 1; n.setXYZ(i, s[0] / l, s[1] / l, s[2] / l); }
  return geo;
}
function citAdd(parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
// Glossy citrus leaf along +Y: elliptic blade folded up along the midrib, tip drooping, short winged petiole
function citLeafGeo(length, width, fold = 0.32, droop = 0.35) {
  const geo = new THREE.PlaneGeometry(1, 1, 8, 22), p = geo.attributes.position, col = [];
  const dark = new THREE.Color(0x1d5418), light = new THREE.Color(0x4f9a2c), rib = new THREE.Color(0xa6d264), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, t = p.getY(i) + 0.5;
    const blade = t < 0.14 ? 0.12 + t * 0.9 : Math.pow(Math.sin(Math.PI * Math.pow((t - 0.14) / 0.86, 0.8)), 0.8);
    const w = width * 0.5 * Math.max(0.04, blade);
    p.setXYZ(i, u * w, t * length - droop * length * t * t * 0.25, Math.abs(u) * w * fold - droop * length * t * t);
    const vein = Math.pow(Math.max(0, Math.cos((t - Math.abs(u) * 0.3) * Math.PI * 9)), 16) * (1 - Math.abs(u));
    c.lerpColors(dark, light, 0.25 + 0.45 * Math.sin(t * Math.PI * 0.9) * (1 - Math.abs(u) * 0.5));
    c.lerp(rib, Math.pow(1 - Math.abs(u), 18) * 0.7 + vein * 0.12); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.deleteAttribute('uv'); geo.computeVertexNormals();
  return geo;
}

// ---- EMPeach: hand-sized peach grenade (shared geometry; the blinking light material is per grenade) ----
const CIT_PEACH = (() => {
  const body = new THREE.SphereGeometry(0.16, 40, 30), p = body.attributes.position, col = [];
  const base = new THREE.Color(0xffb662), blush = new THREE.Color(0xe2463a), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.16, y = p.getY(i) / 0.16, z = p.getZ(i) / 0.16, bottom = Math.acos(Math.max(-1, Math.min(1, -y)));
    const k = 1 - 0.07 * Math.exp(-x * x / 0.012) * Math.max(0, z + 0.2) + 0.07 * Math.exp(-bottom * bottom / 0.04) - 0.08 * Math.exp(-Math.pow(Math.acos(Math.min(1, y)), 2) / 0.03);
    p.setXYZ(i, x * 0.16 * k, y * 0.16 * k * 1.04, z * 0.16 * k);
    c.lerpColors(base, blush, THREE.MathUtils.smoothstep(z * 0.8 + y * 0.35 + Math.sin(x * 9 + y * 7) * 0.08, -0.35, 0.65));
    col.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); body.computeVertexNormals(); citWeld(body);
  const band = new THREE.TorusGeometry(0.163, 0.02, 10, 48); band.rotateX(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(0.045, 0.055, 0.04, 20); cap.translate(0, 0.17, 0);
  const prongs = [band, cap];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.5;
    const tine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.163, 0], [0.15, 0.1], [0.075, 0.2], [0.03, 0.235]]
      .map(([r, y]) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))), 12, 0.009, 6, false);
    prongs.push(tine);
  }
  prongs.forEach(g => { g.deleteAttribute('uv'); });
  const light = new THREE.SphereGeometry(0.028, 16, 12); light.translate(0, 0.205, 0);
  const leaf = citLeafGeo(0.12, 0.06, 0.4, 0.3); leaf.rotateZ(-1.0); leaf.translate(0.03, 0.18, 0);
  return { body, metal: mergeGeometries(prongs), light, leaf };
})();
function buildEmpeach() {
  const root = new THREE.Group();
  citAdd(root, CIT_PEACH.body, CITRON_MAT.peach);
  citAdd(root, CIT_PEACH.metal, CITRON_MAT.metal);
  citAdd(root, CIT_PEACH.leaf, CITRON_MAT.leaf);
  const light = citAdd(root, CIT_PEACH.light, new THREE.MeshStandardMaterial({ color: 0x062a30, emissive: CITRON_TUNING.model.visorGlow,
    emissiveIntensity: 2.4, roughness: 0.2 }));
  return { root, light };
}

// ---- Peel Shield: curved hex-cell energy wall (per-hero materials: animate drives unfold, ripple, colour, fade) ----
function citShield(M) {
  const S = M.shield, group = new THREE.Group(); group.position.y = S.y; group.visible = false;
  const pos = [], col = [], cen = [], rad = [], idx = [];
  const proj = (x, y) => [x, y, S.distance - S.curve + Math.sqrt(S.curve * S.curve - x * x - y * y)];
  const shape = (x, y) => Math.pow(Math.abs(x / S.halfW), 3) + Math.pow(Math.abs(y / S.halfH), 3);
  const R = S.cell, dx = R * Math.sqrt(3), dy = R * 1.5, maxR = Math.hypot(S.halfW, S.halfH);
  for (let row = -14; row <= 14; row++) for (let q = -14; q <= 14; q++) {
    const cx = q * dx + (row & 1) * dx / 2, cy = row * dy, v = shape(cx, cy);
    if (v > 0.92) continue;
    const rim = 1 + 1.4 * THREE.MathUtils.smoothstep(v, 0.5, 0.92), base = pos.length / 3, c = proj(cx, cy), r = Math.hypot(cx, cy) / maxR;
    const ring = [[0, 0, 0.06], ...Array.from({ length: 6 }, (_, k) => [0.7, k, 0.2]), ...Array.from({ length: 6 }, (_, k) => [0.93, k, 1])];
    for (const [s, k, b] of ring) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      pos.push(...proj(cx + Math.cos(a) * R * s, cy + Math.sin(a) * R * s));
      col.push(b * rim, b * rim, b * rim); cen.push(...c); rad.push(r);
    }
    for (let k = 0; k < 6; k++) {
      const i0 = base + 1 + k, i1 = base + 1 + (k + 1) % 6, o0 = i0 + 6, o1 = i1 + 6;
      idx.push(base, i0, i1, i0, o0, o1, i0, o1, i1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('citCell', new THREE.Float32BufferAttribute(cen, 3)); geo.setAttribute('citCellR', new THREE.Float32BufferAttribute(rad, 1));
  geo.setIndex(idx);
  const u = { citUnfold: { value: 0 }, citRipple: { value: 9 }, citHit: { value: 0 }, citTime: { value: 0 } };
  const mat = new THREE.MeshBasicMaterial({ color: M.shieldGlow, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mat.userData.u = u;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 citCell; attribute float citCellR; uniform float citUnfold, citRipple, citHit; varying float vCitGlow, vCitR;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float citK = clamp((citUnfold * 1.4 - citCellR) / 0.4, 0.0, 1.0); citK = citK * citK * (3.0 - 2.0 * citK);
        float citWave = exp(-pow((citCellR - citRipple) * 7.0, 2.0)) * citHit;
        transformed = citCell + (transformed - citCell) * citK * (1.0 + citWave * 0.15);
        transformed.z += citWave * 0.06; vCitGlow = citWave; vCitR = citCellR;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float citTime, citHit; varying float vCitGlow, vCitR;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= (0.82 + 0.18 * sin(citTime * 5.0 - vCitR * 14.0)) * (1.0 + vCitGlow * 3.5 + citHit * 0.6);`);
  };
  mat.customProgramCacheKey = () => 'citron-shield-v1';
  const cells = new THREE.Mesh(geo, mat); cells.renderOrder = 2; group.add(cells);
  const outline = [];
  for (let i = 0; i < 96; i++) {
    const t = i / 96 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    outline.push(new THREE.Vector3(...proj(S.halfW * 0.985 * Math.sign(c) * Math.pow(Math.abs(c), 2 / 3), S.halfH * 0.985 * Math.sign(s) * Math.pow(Math.abs(s), 2 / 3))));
  }
  const rimMat = new THREE.MeshBasicMaterial({ color: M.shieldGlow, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 160, 0.024, 6, true), rimMat);
  rim.renderOrder = 2; group.add(rim);
  return { group, cells, rim, mat, rimMat };
}

// ---- legs: thigh, shin and boot are siblings posed in model space by two-bone IK (knees forward) ----
function citLeg(side, armor) {
  const M = CITRON_TUNING.model, F = CIT_FIN, thigh = new THREE.Group(), shin = new THREE.Group(), boot = new THREE.Group();
  // thigh (bone along -Y): hip drum, heavy tapered core, wrap-around orange plate, twin hydraulic pistons
  const hipDrum = citLathe([[0.15, -0.075], [0.155, -0.05], [0.155, 0.05], [0.15, 0.075], [0.1, 0.085], [0, 0.088]], 28, F.dark, 'x');
  citAdd(thigh, hipDrum, armor);
  citAdd(thigh, citLathe([[0.09, -0.335], [0.13, -0.31], [0.148, -0.24], [0.15, -0.12], [0.136, -0.05], [0.09, -0.005]], 28, F.gun), armor);
  citAdd(thigh, citSlab((u, s, h) => citCylY(0.158 + h * 0.018, side * 0.55 + s * 1.65, -0.04 - u * 0.24), { segs: 14, sides: 16, ends: 3, finish: F.paint }), armor);
  for (const x of [-0.07, 0.07]) {
    citAdd(thigh, citPaint(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 12), F.chrome), armor, [x, -0.18, -0.14]);
    citAdd(thigh, citPaint(new THREE.CylinderGeometry(0.042, 0.042, 0.11, 14), F.dark), armor, [x, -0.07, -0.14]);
  }
  // shin: knee drum under an orange cap, flared armoured shell with a front greave
  citAdd(shin, citLathe([[0.125, -0.065], [0.13, -0.04], [0.13, 0.04], [0.125, 0.065], [0.08, 0.075], [0, 0.077]], 24, F.dark, 'x'), armor);
  citAdd(shin, citSlab((u, s, h) => citSph(0.145 + h * 0.022, s * 1.0, (2 * u - 1) * 0.85), { segs: 14, sides: 14, ends: 3, finish: F.paint }), armor);
  citAdd(shin, citLathe([[0.1, -0.33], [0.165, -0.305], [0.17, -0.25], [0.138, -0.14], [0.115, -0.05], [0.085, -0.01]], 28, F.gun), armor);
  citAdd(shin, citSlab((u, s, h) => citCylY(0.13 + u * 0.04 + 0.016 + h * 0.013, s * 1.3, -0.09 - u * 0.18), { segs: 14, sides: 14, ends: 3, finish: F.paint }), armor);
  // boot (ankle at the origin, sole at -ankleY): big stompy shell, orange toe cap and heel, treaded rubber sole
  citAdd(boot, citPaint(new THREE.SphereGeometry(0.11, 18, 12), F.dark), armor);
  const cuff = citPaint(new THREE.TorusGeometry(0.125, 0.04, 10, 28), F.gun); cuff.rotateX(Math.PI / 2);
  citAdd(boot, cuff, armor, [0, -0.035, 0]);
  citAdd(boot, citPaint(new RoundedBoxGeometry(0.4, 0.17, 0.56, 4, 0.075), F.gun), armor, [0, -0.1, 0.08]);
  citAdd(boot, citPaint(new RoundedBoxGeometry(0.415, 0.13, 0.21, 4, 0.06), F.paint), armor, [0, -0.11, 0.285]);
  citAdd(boot, citPaint(new RoundedBoxGeometry(0.34, 0.11, 0.13, 3, 0.045), F.paint), armor, [0, -0.118, -0.15]);
  citAdd(boot, citPaint(new RoundedBoxGeometry(0.43, 0.05, 0.62, 2, 0.022), F.rubber), armor, [0, -0.16, 0.085]);
  for (const z of [-0.14, 0.0, 0.14, 0.28]) citAdd(boot, citPaint(new RoundedBoxGeometry(0.41, 0.026, 0.055, 1, 0.01), F.rubber), armor, [0, -0.184, z]);
  return { thigh, shin, boot, side, knee: new THREE.Vector3(), ankle: new THREE.Vector3() };
}

function buildCitron() {
  const M = CITRON_TUNING.model, F = CIT_FIN, armor = citArmorMaterial();
  const root = new THREE.Group(), body = new THREE.Group(), spin = new THREE.Group(), legRig = new THREE.Group();
  body.position.y = M.bodyY; root.add(body, legRig); body.add(spin);

  // ---- peel: lumpy, slightly oblate orange with mottled ripeness and a sunken stem end ----
  const peelGeo = new THREE.SphereGeometry(1, 120, 90), pp = peelGeo.attributes.position, pc = [];
  const deep = new THREE.Color(M.peelDeep), mid = new THREE.Color(M.peel), light = new THREE.Color(M.peelLight), stemC = new THREE.Color(M.peelStem), c = new THREE.Color();
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), top = Math.acos(Math.min(1, y));
    const lump = 0.006 * Math.sin(x * 5.3 + z * 3.1) * Math.sin(y * 4.7 + x * 2.3) + 0.003 * Math.sin(x * 11 + y * 9 - z * 7);
    const r = M.peelR * (1 + lump) - 0.04 * Math.exp(-top * top / 0.02);
    pp.setXYZ(i, x * r, y * r * M.peelSquash, z * r);
    const mott = 0.5 + 0.5 * Math.sin(x * 6.1 + z * 4.3 + Math.sin(y * 5.2)) * Math.sin(y * 5.7 - x * 3.1 + z * 2.2);
    const fleck = Math.sin(x * 47 + Math.sin(z * 31)) * Math.sin(y * 43 + z * 17);
    c.copy(deep).lerp(mid, 0.4 + 0.45 * mott).lerp(light, Math.max(0, fleck) * 0.12 + Math.max(0, y) * 0.12);
    c.lerp(stemC, Math.exp(-top * top / 0.05) * 0.5).multiplyScalar(1 - 0.3 * Math.max(0, -y - 0.3));
    pc.push(c.r, c.g, c.b);
  }
  peelGeo.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3)); peelGeo.computeVertexNormals(); citWeld(peelGeo);
  citAdd(spin, peelGeo, CITRON_MAT.peel);

  // ---- stem end: puckered navel, short stem with a calyx, two glossy leaves ----
  const crown = new THREE.Group(); crown.position.y = M.peelR * M.peelSquash - 0.042; spin.add(crown);
  const navel = citLathe([[0.085, -0.012], [0.06, 0.004], [0.034, 0.012], [0.0, 0.01]], 30, F.navel);
  const np = navel.attributes.position;
  for (let i = 0; i < np.count; i++) { const a = Math.atan2(np.getZ(i), np.getX(i)), k = 1 + 0.12 * Math.cos(a * 7); np.setXYZ(i, np.getX(i) * k, np.getY(i), np.getZ(i) * k); }
  navel.computeVertexNormals();
  citAdd(crown, navel, CITRON_MAT.plant);
  citAdd(crown, citTube([[0, 0, 0], [0.008, 0.05, 0.004], [0.03, 0.105, -0.01], [0.062, 0.14, -0.03]], 0.022, F.stem, 16, 10), CITRON_MAT.plant);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, g = citPaint(new THREE.SphereGeometry(1, 12, 8), F.sepal);
    g.scale(0.022, 0.009, 0.05); g.translate(0, 0, 0.036); g.rotateX(-0.35); g.rotateY(a);
    citAdd(crown, g, CITRON_MAT.plant, [0, 0.012, 0]);
  }
  const leaves = [];
  for (const [len, wid, yaw, tilt, roll] of [[0.46, 0.2, 2.5, 1.12, 0.25], [0.33, 0.15, -0.75, 0.95, -0.3]]) {
    const pivot = new THREE.Group(); pivot.position.set(0.058, 0.135, -0.028); pivot.rotation.set(tilt, yaw, roll, 'YXZ');
    pivot.userData.base = pivot.rotation.clone(); crown.add(pivot); leaves.push(pivot);
    citAdd(pivot, citLeafGeo(len, wid), CITRON_MAT.leaf);
  }

  // ---- face: gunmetal brow rim + dark visor glass + lower rim, angry cyan eye lenses, scanner bar, ear pods ----
  const face = new THREE.Group(); spin.add(face);
  const dip = az => Math.pow(Math.max(0, 1 - Math.abs(az) / 1.2), 2);
  // glass bulges proud of the peel (thicker in the middle) so it catches a curved reflection
  citAdd(face, citSlab((u, s, h) => citSph(0.775 + h * (0.012 + 0.012 * (1 - s * s)), (2 * u - 1) * 1.1, 0.245 + s * 0.122),
    { segs: 52, sides: 16, ends: 4, finish: F.glass }), armor);
  // heavy brow plate: a hard V over the eyes (attitude), thick at the lower edge, thinning toward the crown
  citAdd(face, citSlab((u, s, h) => {
    const az = (2 * u - 1) * 1.2, d = dip(az), lo = 0.385 - 0.125 * d, hi = 0.53 - 0.03 * d, k = (s + 1) / 2;
    return citSph(0.803 + h * (0.036 - k * 0.016) - k * 0.014 + (1 - k) * 0.012, az, lo + k * (hi - lo));
  }, { segs: 60, sides: 16, ends: 4, finish: F.gun }), armor);
  citAdd(face, citSlab((u, s, h) => {
    const az = (2 * u - 1) * 1.02, hi = 0.53 - 0.03 * dip(az);
    return citSph(0.83 + h * 0.006, az, hi - 0.05 + s * 0.017);
  }, { segs: 48, sides: 10, ends: 4, finish: F.paint }), armor);
  citAdd(face, citSlab((u, s, h) => citSph(0.782 + h * 0.014, (2 * u - 1) * 1.08, 0.11 + s * 0.024), { segs: 48, sides: 10, ends: 4, finish: F.gun }), armor);
  // side frames: wrap the visor ends back into the ear modules
  for (const side of [-1, 1]) citAdd(face, citSlab((u, s, h) => citSph(0.79 + h * 0.022, side * (1.07 + s * 0.06), 0.08 + u * 0.36),
    { segs: 16, sides: 12, ends: 3, finish: F.gun }), armor);
  // stern mouth: flat set line with turned-down corners and a pressed upper lip
  const mouthAt = (u, s) => { const az = (2 * u - 1) * 0.21, t = Math.abs(az) / 0.21; return [az, -0.19 - 0.05 * Math.pow(t, 3) + s * 0.019 * (1 - 0.4 * t)]; };
  citAdd(face, citSlab((u, s, h) => { const [az, el] = mouthAt(u, s); return citSph(0.757 + h * 0.014, az, el); },
    { segs: 24, sides: 10, ends: 3, finish: F.mouth }), armor);
  citAdd(face, citSlab((u, s, h) => { const [az, el] = mouthAt(0.04 + u * 0.92, 0); return citSph(0.758 + h * 0.012, az, el + 0.03 + s * 0.011); },
    { segs: 24, sides: 8, ends: 3, finish: F.lip }), armor);
  const haloGeos = [], elc = 0.245, eyes = new THREE.Group();   // both lenses in one pivot: blinks squash about their centre line
  eyes.position.set(0, ...citSph(0.8, 0.31, elc).slice(1)); face.add(eyes);
  for (const side of [-1, 1]) {
    const azc = side * 0.31, cp = eyes.position, eye = eyes;
    const lens = (r0, dr, k0, k1, u0, u1) => (u, s, h) => {
      const x = u0 + u * (u1 - u0), az = side * (0.12 + 0.38 * x), top = 0.272 + 0.058 * x, bot = 0.183 + 0.014 * x;
      const p = citSph(r0 + h * dr, az, bot + (k0 + (s + 1) / 2 * (k1 - k0)) * (top - bot));
      return [p[0] - cp.x, p[1] - cp.y, p[2] - cp.z];
    };
    citAdd(eye, citSlab(lens(0.8025, 0.0045, 0, 1, 0, 1), { segs: 20, sides: 10, ends: 5, finish: F.visor }), armor);
    citAdd(eye, citSlab(lens(0.8075, 0.002, 0.3, 0.68, 0.12, 0.85), { segs: 16, sides: 8, ends: 5, finish: F.visorCore }), armor);
    const hg = new THREE.SphereGeometry(1, 16, 12); hg.scale(0.21, 0.1, 0.05); hg.rotateY(azc); hg.translate(...citSph(0.812, azc, elc)); haloGeos.push(hg);
  }
  const eyeHaloMat = citHaloMaterial(M.visorGlow), eyeHalo = new THREE.Mesh(mergeGeometries(haloGeos), eyeHaloMat);
  eyeHalo.renderOrder = 1; face.add(eyeHalo);
  const scan = new THREE.Group(); face.add(scan); scan.visible = false;
  citAdd(scan, citSlab((u, s, h) => citSph(0.8015 + h * 0.0025, s * 0.014, 0.135 + u * 0.22), { segs: 12, sides: 8, ends: 3, finish: F.visorCore }), armor);
  let antenna = null;
  for (const side of [-1, 1]) {
    const n = new THREE.Vector3(...citSph(1, side * 1.13, 0.25)), ear = new THREE.Group();
    ear.position.copy(n).multiplyScalar(0.765); ear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); face.add(ear);
    citAdd(ear, citLathe([[0.118, -0.03], [0.118, 0.035], [0.1, 0.058], [0.1, 0.058], [0.08, 0.06], [0, 0.062]], 32,
      row => row < 3 ? F.gun : F.dark, 'z'), armor);
    const ring = citPaint(new THREE.TorusGeometry(0.084, 0.013, 8, 32), F.paint); citAdd(ear, ring, armor, [0, 0, 0.062]);
    citAdd(ear, citLathe([[0.045, 0.05], [0.042, 0.068], [0.02, 0.074], [0, 0.075]], 20, F.visor, 'z'), armor);
    if (side > 0) {
      antenna = new THREE.Group(); antenna.position.set(0.07, 0.02, 0.04); ear.add(antenna);
      citAdd(antenna, citLathe([[0.03, -0.02], [0.03, 0.04], [0.016, 0.06]], 14, F.dark, 'z'), armor);
      // the rod rises along world-ish up: express it in ear space
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ear.quaternion.clone().invert()), back = new THREE.Vector3(0, 0, -1).applyQuaternion(ear.quaternion.clone().invert());
      const pt = (a, b) => up.clone().multiplyScalar(a).addScaledVector(back, b).toArray();
      citAdd(antenna, citTube([[0, 0, 0.04], pt(0.18, 0.02), pt(0.36, 0.1), pt(0.48, 0.2)], 0.016, F.chrome, 16, 8), armor);
      citAdd(antenna, citPaint(new THREE.SphereGeometry(0.036, 14, 10), F.visor), armor, pt(0.49, 0.206));
    }
    // bake the static ear parts into the face (one draw with the visor); only the antenna stays a pivot
    ear.updateMatrix();
    for (const part of [...ear.children]) {
      part.updateMatrix(); part.matrix.premultiply(ear.matrix);
      if (part === antenna) part.matrix.decompose(part.position, part.quaternion, part.scale);
      else { part.geometry.applyMatrix4(part.matrix); part.position.set(0, 0, 0); part.rotation.set(0, 0, 0); part.scale.set(1, 1, 1); }
      face.add(part);
    }
    face.remove(ear);
  }

  // ---- shoulder hubs: the axle caps the armour gores hinge on ----
  const hubRows = [[0.396, 0.58], [0.394, 0.79], [0.382, 0.83], [0.352, 0.851], [0.3, 0.858], [0.3, 0.858], [0.282, 0.851], [0.215, 0.851],
    [0.215, 0.851], [0.206, 0.842], [0.178, 0.842], [0.178, 0.842], [0.165, 0.856], [0.14, 0.884], [0.1, 0.902], [0.045, 0.912], [0, 0.914]];
  const hubFin = row => row <= 4 ? F.gun : row <= 7 ? F.paint : row <= 10 ? F.seam : F.gun;
  citAdd(spin, citLathe(hubRows, 48, hubFin, 'x'), armor);
  citAdd(spin, citLathe(hubRows, 48, hubFin, '-x'), armor);

  // ---- armour gores: orange-segment plates from hub to hub, gunmetal with a raised orange inlay + seam light ----
  const gores = [], N = M.gores, halfW = Math.PI / N - M.goreGap / 2, th = M.hubAngle, span = Math.PI - 2 * th;
  for (let i = 0; i < N; i++) {
    const pivot = new THREE.Group(); spin.add(pivot);
    const closed = Math.PI + (i - (N - 1) / 2) * Math.PI * 2 / N, stow = M.stowAngle + (i - (N - 1) / 2) * M.stowStep;
    gores.push({ pivot, closed, stow, stowScale: 1 + 0.022 * i / (N - 1), delay: Math.abs(closed - stow) / Math.PI * 0.3 - 0.04 });
    const mid = (M.goreIn + M.goreOut) / 2, half = (M.goreOut - M.goreIn) / 2;
    citAdd(pivot, citSlab((u, s, h) => citGorePt(mid + h * half, th + u * span, s * halfW), { segs: 40, sides: 16, bevel: 0.28, finish: F.gun }), armor);
    citAdd(pivot, citSlab((u, s, h) => citGorePt(M.goreOut + 0.001 + h * 0.006, th + 0.07 + u * (span - 0.14), s * halfW * 0.52),
      { segs: 36, sides: 10, ends: 3, finish: F.paint }), armor);
    citAdd(pivot, citSlab((u, s, h) => citGorePt(0.838 + h * 0.01, th - 0.02 + u * (span + 0.04), halfW + M.goreGap / 2 + s * (M.goreGap / 2 + 0.014)),
      { segs: 36, sides: 8, finish: F.seam }), armor);
  }

  // ---- Orange Beam cannon (right arm, model −X): shoulder ball + pad, upper arm, heavy cannon with coils ----
  const armR = new THREE.Group(); armR.position.set(-M.shoulderX, -0.1, 0.04); body.add(armR);
  // shoulder actuator: a geared drum on the hub face that the arm strut hangs from
  const actuator = side => citLathe([[0.168, -0.02], [0.17, 0.055], [0.158, 0.075], [0.158, 0.075], [0.12, 0.08], [0.12, 0.08], [0.105, 0.098],
    [0.06, 0.106], [0, 0.108]], 36, row => row <= 2 ? F.gun : row <= 4 ? F.dark : F.paint, side > 0 ? 'x' : '-x');
  citAdd(armR, actuator(-1), armor);
  const elbowAt = new THREE.Vector3(-0.12, -M.cannonDrop, -0.05), upperQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), elbowAt.clone().normalize());
  const upperR = citLathe([[0.06, -0.33], [0.082, -0.3], [0.088, -0.12], [0.08, -0.03], [0.05, 0]], 20, F.gun);
  upperR.applyQuaternion(upperQ); citAdd(armR, upperR, armor);
  const elbowR = new THREE.Group(); elbowR.position.copy(elbowAt); armR.add(elbowR);
  const cannon = new THREE.Group(); cannon.position.set(-0.06, 0, 0); elbowR.add(cannon);
  citAdd(cannon, citLathe([[0, -0.37], [0.1, -0.365], [0.16, -0.34], [0.196, -0.3], [0.212, -0.25], [0.214, 0.22], [0.2, 0.27], [0.2, 0.27],
    [0.15, 0.29], [0.135, 0.31], [0.135, 0.66], [0.15, 0.68], [0.15, 0.68], [0.19, 0.7], [0.206, 0.73], [0.206, 0.86], [0.19, 0.9],
    [0.162, 0.915], [0.142, 0.905], [0.142, 0.905], [0.13, 0.86], [0.112, 0.838], [0.112, 0.838], [0.1, 0.848], [0.086, 0.848], [0.086, 0.848], [0.072, 0.846], [0.07, 0.846], [0.05, 0.874], [0, 0.882]], 44,
    row => row <= 6 ? F.gun : row <= 11 ? F.dark : row <= 18 ? F.gun : row <= 21 ? F.dark : row <= 23 ? F.emitter : row <= 26 ? F.dark : F.emitterCore, 'z'), armor);
  citAdd(cannon, citSlab((u, s, h) => citCyl(0.225 + h * 0.016, s * 1.15, 0.0 + u * 0.24), { segs: 14, sides: 14, ends: 3, finish: F.paint }), armor);
  citAdd(cannon, citSlab((u, s, h) => citCyl(0.214 + h * 0.008, s * 0.62, -0.27 + u * 0.24),
    { segs: 30, sides: 8, finish: (u, s, h) => Math.sin(u * Math.PI * 9) > 0.15 && h > 0 ? F.heat : F.dark }), armor);
  const vents = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Vector3(...citCyl(0.225, side * 0.34, -0.03)), vent = new THREE.Group(); vent.position.copy(hinge); cannon.add(vent); vents.push(vent);
    citAdd(vent, citSlab((u, s, h) => { const p = citCyl(0.232 + h * 0.012, side * 0.34 + s * 0.3, -0.27 + u * 0.235); return [p[0] - hinge.x, p[1] - hinge.y, p[2] - hinge.z]; },
      { segs: 12, sides: 12, ends: 3, finish: (u, s, h) => h < -0.4 && Math.abs(s) < 0.8 ? F.heat : F.paint }), armor);   // glowing underside shows when open
  }
  for (const z of [0.34, 0.42, 0.5, 0.58]) citAdd(cannon, citPaint(new THREE.TorusGeometry(0.15, 0.028, 10, 36), F.heat), armor, [0, 0, z]);
  for (const z of [0.3, 0.38, 0.46, 0.54, 0.62]) citAdd(cannon, citPaint(new THREE.CylinderGeometry(0.198, 0.198, 0.012, 36), F.dark), armor, [0, 0, z], [Math.PI / 2, 0, 0]);
  for (const y of [-0.075, 0.075]) {
    citAdd(cannon, citPaint(new THREE.CapsuleGeometry(0.03, 0.3, 6, 12), F.heat), armor, [-0.212, y, -0.03], [Math.PI / 2, 0, 0]);
  }
  citAdd(cannon, citSlab((u, s, h) => citCyl(0.2 + h * 0.012, -Math.PI / 2 + s * 0.55, -0.24 + u * 0.42), { segs: 12, sides: 10, ends: 3, finish: F.dark }), armor);
  for (const x of [-0.1, -0.05, 0, 0.05, 0.1]) citAdd(cannon, citPaint(new RoundedBoxGeometry(0.014, 0.07, 0.36, 1, 0.005), F.dark), armor, [x, -0.225, -0.05]);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    citAdd(cannon, citPaint(new RoundedBoxGeometry(0.05, 0.035, 0.14, 2, 0.012), F.gun), armor, [Math.sin(a) * 0.185, Math.cos(a) * 0.185, 0.93], [0, 0, -a]);
  }
  const emitHalo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), citHaloMaterial(M.emitterGlow)); emitHalo.position.z = 0.9; emitHalo.renderOrder = 1; cannon.add(emitHalo);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 0.95; cannon.add(muzzle);
  const flash = makeMuzzleFlash(); flash.position.copy(muzzle.position); flash.rotation.x = Math.PI / 2; cannon.add(flash);
  flash.children.forEach(m => m.material.color.set(0xffc27a));

  // ---- left arm: armoured gauntlet that throws the EMPeach and projects the Peel Shield ----
  const armL = new THREE.Group(); armL.position.set(M.shoulderX, -0.1, 0.04); body.add(armL);
  citAdd(armL, actuator(1), armor);
  citAdd(armL, citLathe([[0.055, -0.3], [0.075, -0.27], [0.08, -0.1], [0.072, -0.03], [0.045, 0]], 20, F.gun), armor, [0.02, 0, 0]);
  const elbowL = new THREE.Group(); elbowL.position.set(0.02, -0.29, 0); armL.add(elbowL);
  citAdd(elbowL, citPaint(new THREE.SphereGeometry(0.095, 18, 12), F.dark), armor);
  citAdd(elbowL, citLathe([[0.115, -0.33], [0.142, -0.305], [0.14, -0.21], [0.112, -0.07], [0.085, -0.02]], 24, F.gun), armor);
  citAdd(elbowL, citSlab((u, s, h) => citCylY(0.142 + u * 0.016 + h * 0.015, s * 1.4, -0.05 - u * 0.25), { segs: 14, sides: 14, ends: 3, finish: F.paint }), armor);
  citAdd(elbowL, citPaint(new THREE.CylinderGeometry(0.068, 0.078, 0.03, 6), F.gun), armor, [0, -0.19, 0.168], [Math.PI / 2, 0, 0]);
  citAdd(elbowL, citPaint(new THREE.CylinderGeometry(0.05, 0.05, 0.036, 6), F.shield), armor, [0, -0.19, 0.173], [Math.PI / 2, 0, 0]);
  const wrist = citPaint(new THREE.TorusGeometry(0.118, 0.026, 8, 24), F.dark); wrist.rotateX(Math.PI / 2); citAdd(elbowL, wrist, armor, [0, -0.335, 0]);
  const hand = new THREE.Group(); hand.position.set(0, -0.35, 0); elbowL.add(hand);
  citAdd(hand, citPaint(new RoundedBoxGeometry(0.23, 0.17, 0.125, 3, 0.045), F.gun), armor, [0, -0.075, 0]);
  citAdd(hand, citPaint(new RoundedBoxGeometry(0.24, 0.06, 0.08, 3, 0.025), F.paint), armor, [0, -0.145, 0.035]);
  const fingers = new THREE.Group(); fingers.position.set(0, -0.16, 0); hand.add(fingers);
  for (const x of [-0.072, 0, 0.072]) {
    citAdd(fingers, citPaint(new THREE.SphereGeometry(0.036, 12, 8), F.dark), armor, [x, 0, 0]);
    citAdd(fingers, citPaint(new THREE.CapsuleGeometry(0.032, 0.065, 4, 10), F.gun), armor, [x, -0.055, 0]);
    citAdd(fingers, citPaint(new THREE.CapsuleGeometry(0.029, 0.055, 4, 10), F.gun), armor, [x, -0.12, -0.035], [0.9, 0, 0]);
  }
  const thumb = new THREE.Group(); thumb.position.set(-0.115, -0.065, -0.04); hand.add(thumb);
  citAdd(thumb, citPaint(new THREE.SphereGeometry(0.037, 12, 8), F.dark), armor);
  citAdd(thumb, citPaint(new THREE.CapsuleGeometry(0.033, 0.08, 4, 10), F.gun), armor, [-0.012, -0.055, 0], [0, 0, -0.25]);
  const heldPeach = buildEmpeach(); heldPeach.root.position.set(0, -0.2, -0.13); heldPeach.root.scale.setScalar(0.85); hand.add(heldPeach.root);
  heldPeach.root.visible = false;

  // ---- back pack: conforming armour plate with a caged power core and twin finned exhaust vents ----
  const pack = new THREE.Group(); body.add(pack);
  citAdd(pack, citSlab((u, s, h) => citSph(0.775 + h * 0.04, Math.PI + (2 * u - 1) * 0.5, -0.22 + s * 0.31), { segs: 30, sides: 14, ends: 4, finish: F.gun }), armor);
  citAdd(pack, citSlab((u, s, h) => citSph(0.815 + h * 0.008, Math.PI + (2 * u - 1) * 0.43, -0.22 + s * 0.26),
    { segs: 30, sides: 10, ends: 4, finish: (u, s, h) => Math.abs(2 * u - 1) < 0.3 ? F.dark : F.paint }), armor);
  const coreAt = new THREE.Vector3(...citSph(0.89, Math.PI, -0.22));
  citAdd(pack, citPaint(new THREE.CapsuleGeometry(0.08, 0.22, 6, 16), [M.seamGlow, 0, 0.4, 2.2, 0]), armor, coreAt.toArray());
  for (const [y, flip] of [[0.17, 1], [-0.17, -1]]) {
    const cap = citLathe([[0.115, -0.03], [0.115, 0.01], [0.1, 0.03], [0.06, 0.036], [0, 0.037]], 24, F.gun);
    if (flip < 0) cap.rotateX(Math.PI);
    citAdd(pack, cap, armor, [coreAt.x, coreAt.y + y, coreAt.z]);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    citAdd(pack, citPaint(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 8), F.chrome), armor, [coreAt.x + Math.sin(a) * 0.1, coreAt.y, coreAt.z + Math.cos(a) * 0.1]);
  }
  for (const side of [-1, 1]) {
    const v = new THREE.Vector3(...citSph(0.845, Math.PI + side * 0.3, -0.23));
    citAdd(pack, citPaint(new RoundedBoxGeometry(0.15, 0.34, 0.13, 3, 0.04), F.gun), armor, v.toArray(), [0, side * 0.3, 0]);
    for (let k = 0; k < 4; k++) citAdd(pack, citPaint(new RoundedBoxGeometry(0.115, 0.02, 0.02, 1, 0.006), k % 2 ? F.dark : F.heat), armor,
      [v.x - Math.sin(side * 0.3) * 0.067, v.y + 0.1 - k * 0.06, v.z - Math.cos(side * 0.3) * 0.067], [0, side * 0.3, 0]);
    citAdd(pack, citLathe([[0.03, -0.09], [0.052, -0.07], [0.05, 0], [0.036, 0.01]], 18, F.dark), armor, [v.x, v.y - 0.21, v.z]);
    citAdd(pack, citPaint(new THREE.CircleGeometry(0.03, 14), F.heat), armor, [v.x, v.y - 0.292, v.z], [Math.PI / 2, 0, 0]);
  }

  // ---- legs + shield ----
  const legs = [citLeg(1, armor), citLeg(-1, armor)];
  for (const l of legs) legRig.add(l.thigh, l.shin, l.boot);
  const shield = citShield(M); root.add(shield.group);

  const arm = { muzzle, flash, recoil: 0, spinSpeed: 0, flashT: 0, side: 0 };
  return { root, body, spin, legRig, legs, crown, leaves, face, eyes, eyeHalo, scan, antenna, gores, armR, elbowR, cannon, vents,
    emitHalo, armL, elbowL, hand, fingers, thumb, heldPeach, shield: shield.group, shieldParts: shield, pack, armor, arms: [arm] };
}

// ---- animation ----
const _citA = new THREE.Vector3(), _citB = new THREE.Vector3(), _citC = new THREE.Vector3(), _citD = new THREE.Vector3();
const _citQ = new THREE.Quaternion(), _citQ0 = new THREE.Quaternion(), _citMat = new THREE.Matrix4(), _citX = new THREE.Vector3(1, 0, 0);
const citSmooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const citSettle = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) + 0.12 * Math.sin(Math.PI * x) * x; };
const citBack = x => { x = Math.min(1, Math.max(0, x)); const k = 1.6; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
// orient obj at `from` so its local -Y runs to `to`, local +Z toward +Z (knees / toes forward)
function citAim(obj, from, to) {
  const y = _citC.subVectors(from, to).normalize(), z = _citD.set(0, 0, 1).addScaledVector(y, -y.z).normalize();
  _citMat.makeBasis(_citB.crossVectors(y, z), y, z); obj.quaternion.setFromRotationMatrix(_citMat); obj.position.copy(from);
}
// two-bone IK: the knee bends forward; an unreachable ankle is clamped to full extension (leg.ankle = reached point)
function citLegIK(leg, hip, target, L1, L2) {
  const d = _citA.subVectors(target, hip), len = Math.min(L1 + L2 - 1e-4, Math.max(0.02, d.length()));
  d.normalize();
  const cosA = Math.min(1, Math.max(-1, (L1 * L1 + len * len - L2 * L2) / (2 * L1 * len))), sinA = Math.sqrt(1 - cosA * cosA);
  const pole = _citB.set(0, 0, 1).addScaledVector(d, -d.z).normalize();
  leg.knee.copy(hip).addScaledVector(d, L1 * cosA).addScaledVector(pole, L1 * sinA);
  leg.ankle.copy(hip).addScaledVector(d, len);
  citAim(leg.thigh, hip, leg.knee); citAim(leg.shin, leg.knee, leg.ankle);
}
// piecewise smooth keyframes: keys = [[u, value], ...]
function citKeys(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) {
    const [u0, a] = keys[i - 1], [u1, b] = keys[i]; return a + (b - a) * citSmooth((u - u0) / (u1 - u0));
  }
  return keys[keys.length - 1][1];
}

function animateCitron(h, dt) {
  const C = h.corn, A = h.anim, M = CITRON_TUNING.model, T = CITRON_TUNING.anim;
  const cs = h.cit ||= { ball: false, shield: false, shieldHp: 1, shieldHit: 0, heat: 0, overheated: 0, dashCharge: 0, dashing: 0, empT: 9 };
  const S = A.citron ||= { morph: 0, roll: new THREE.Quaternion(), spin: 0, by: M.bodyY, byV: 0, jig: 0, jigV: 0, steps: 0,
    shield: 0, down: 0, hitAge: 9, lastHit: 0, scanT: 2, sx: -0.2, sz: 0.2, el: -1.1, wr: 0, fi: 1.2, vent: 0 };
  A.t += dt;
  const arm = C.arms[0], G = C.armor.userData.glow, GM = C.armor.userData.mix;
  arm.recoil *= Math.exp(-dt * T.recoilRecovery); arm.flashT -= dt; arm.flash.visible = !h.dead && !h.downed && arm.flashT > 0;

  // ---- ball morph (0 = walking, 1 = sealed ball) ----
  const wantBall = cs.ball && !h.downed ? 1 : 0;
  S.morph += Math.sign(wantBall - S.morph) * Math.min(Math.abs(wantBall - S.morph), dt / T.morphTime);
  const m = S.morph, mE = citSmooth(m), walkW = 1 - mE;

  // ---- locomotion in model space (+Z forward, +X = the plant's left) ----
  const fwd = yawForward(h.yaw), vf = h.vel.x * fwd.x + h.vel.z * fwd.z, vr = h.vel.x * -fwd.z + h.vel.z * fwd.x;
  const mvx = -vr, mvz = vf, speed = Math.hypot(mvx, mvz);
  const grounded = h.onGround && !h.downed, s = grounded ? Math.min(1.3, speed / h.stats.speed) : 0;
  const damp = 1 - Math.exp(-dt * 9);
  A.leanF += (vf / h.stats.speed - A.leanF) * damp; A.leanS += (vr / h.stats.speed - A.leanS) * damp;
  A.air += ((h.onGround ? 0 : 1) - A.air) * damp;
  const prevPhase = A.phase;
  A.phase += dt * speed / T.cycle * Math.PI * 2 * walkW * (grounded ? 1 : 0.3);
  if (Math.floor(A.phase / Math.PI) !== Math.floor(prevPhase / Math.PI) && s > 0.15) S.jigV += T.footfall * Math.min(1, s);   // footfall
  const breath = Math.sin(A.t * 1.7), idle = Math.max(0, 1 - s * 2) * walkW;

  // body height: crouched run + double-frequency bob on a servo spring (slight overshoot), sinks into the ball
  const bobPhase = A.phase - 0.35;
  let targetY = M.bodyY - T.crouch * Math.min(1, s) - T.bob * Math.min(1, s) * (0.5 + 0.5 * Math.cos(bobPhase * 2)) + breath * 0.011 - A.air * 0.04;
  if (h.downed) targetY = M.bodyY - 0.34;
  if (dt > 0) { S.byV += ((targetY - S.by) * T.bodyK - S.byV * T.bodyD) * dt; S.by += S.byV * dt; } else S.by = targetY;
  S.jigV += (-S.jig * T.jiggleK - S.jigV * T.jiggleD) * dt; S.jig += S.jigV * dt;
  C.body.position.set(Math.sin(A.phase) * 0.025 * Math.min(1, s) * walkW, THREE.MathUtils.lerp(S.by, M.ballR, citSmooth(m / 0.6)), 0);
  // keep the peel above the ground plane whatever the juice layer's topple (downed) leaves the root at
  const groundN = _citB.set(0, 1, 0).applyQuaternion(_citQ.copy(C.root.quaternion).invert()), sink = M.peelR * 1.02 - C.body.position.dot(groundN);
  if (sink > 0) C.body.position.addScaledVector(groundN, sink);
  const throwU = cs.empT / T.throwTime, throwing = throwU < 1 && !h.downed ? 1 : 0;
  const twist = throwing ? citKeys([[0, 0], [0.3, 0.32], [0.5, -0.22], [0.8, -0.08], [1, 0]], throwU) : 0;
  C.body.rotation.set((A.leanF * T.lean + (h.downed ? 0.25 : 0)) * walkW, (Math.sin(A.phase) * 0.06 * Math.min(1, s) + twist) * walkW,
    (-A.leanS * 0.1 + Math.sin(A.phase) * 0.035 * Math.min(1, s)) * walkW);

  // ---- rolling ball: spin about the axis perpendicular to the model-space velocity; dash charge spins in place ----
  S.spin = cs.ball ? (cs.dashCharge > 0 ? cs.dashCharge * cs.dashCharge * T.dashSpin : 0) : 0;
  if (m > 0.02 && cs.ball) {
    if (speed > 0.01) { _citA.set(mvz, 0, -mvx).normalize(); S.roll.premultiply(_citQ.setFromAxisAngle(_citA, speed * dt / (M.ballR * M.scale) * mE)); }
    if (S.spin) S.roll.premultiply(_citQ.setFromAxisAngle(_citX, S.spin * dt));
  } else S.roll.slerp(_citQ0, dt > 0 ? 1 - Math.exp(-dt * 12) : 1);
  C.spin.quaternion.copy(S.roll);
  const jig = S.jig * 0.035 * walkW;
  C.spin.scale.set(1 + jig * 0.6, 1 - jig, 1 + jig * 0.6);

  // root scale: morph squash, dash charge crouch, launched dash stretch (feet / ball bottom stay at y = 0)
  const morphPop = Math.sin(m * Math.PI) * 0.06, charge = cs.ball ? cs.dashCharge : 0, dashing = cs.ball && cs.dashing > 0 ? 1 : 0;
  const stretch = THREE.MathUtils.clamp(h.vel.y * 0.008, -0.05, 0.08) * A.air * walkW;
  const K = M.scale;
  C.root.scale.set(K * (1 + morphPop + charge * 0.07 - dashing * 0.07 - stretch * 0.4), K * (1 - morphPop - charge * 0.1 - dashing * 0.06 + stretch),
    K * (1 + morphPop + charge * 0.07 + dashing * 0.16 - stretch * 0.4));

  // ---- gores: back plates close first, the front ones last over the visor, each with a little overshoot ----
  for (const g of C.gores) {
    const p = citSettle((m - Math.max(0, g.delay)) / 0.72);
    g.pivot.rotation.x = -THREE.MathUtils.lerp(g.stow, g.closed, p);
    g.pivot.scale.setScalar(THREE.MathUtils.lerp(g.stowScale, 1, Math.min(1, p)));
  }
  C.crown.scale.setScalar(Math.max(0.001, 1 - citSmooth(m / 0.45)));
  if (C.antenna) C.antenna.scale.setScalar(Math.max(0.001, 1 - citSmooth(m / 0.4)));

  // ---- legs: planted IK stride along the travel direction, retract into the ball ----
  S.down += ((h.downed ? 1 : 0) - S.down) * Math.min(1, dt * 5);   // downed: the legs fold away as the juice topples the body
  const legK = Math.max(0.001, (1 - citSmooth((m - 0.04) / 0.56)) * (1 - S.down * 0.75)), dirX = speed > 0.05 ? mvx / speed : 0, dirZ = speed > 0.05 ? mvz / speed : 1;
  C.legRig.visible = legK > 0.002;
  for (const [i, leg] of C.legs.entries()) {
    const lp = A.phase + i * Math.PI, stride = -T.stride * Math.cos(lp) * Math.min(1, s), lift = Math.pow(Math.max(0, Math.sin(lp)), 1.3) * T.lift * Math.min(1, s);
    const hipV = new THREE.Vector3(leg.side * M.hipX, -M.hipDrop, 0).add(C.body.position);
    const tuck = A.air * 0.12;
    const foot = h.downed ? C.body.position.clone().addScaledVector(groundN, -0.42).add(_citD.set(leg.side * 0.3, 0, 0))   // slumped: legs fold up under the peel
      : new THREE.Vector3(leg.side * M.footX + dirX * stride, M.ankleY + lift + tuck, M.footZ + dirZ * stride);
    foot.lerp(hipV, 1 - legK);
    citLegIK(leg, hipV, foot, M.thigh * legK, M.shin * legK);
    leg.thigh.scale.setScalar(legK); leg.shin.scale.setScalar(legK); leg.boot.scale.setScalar(legK);
    leg.boot.position.copy(leg.ankle);
    if (h.downed) { leg.boot.rotation.set(Math.atan2(groundN.z, groundN.y), 0, -leg.side * 0.4); continue; }
    leg.boot.rotation.set(-Math.sin(lp) * 0.35 * Math.min(1, s) * (Math.sin(lp) > 0 ? 1 : 0.25) - A.air * 0.25, -leg.side * 0.06, 0);
  }

  // ---- cannon arm: aims with the camera, kicks on every beam tick, sways with the gait ----
  const armK = Math.max(0.001, 1 - citSmooth(m / 0.5));
  C.armR.scale.setScalar(armK); C.armL.scale.setScalar(armK); C.armR.visible = C.armL.visible = armK > 0.002;
  C.pack.scale.setScalar(Math.max(0.001, 1 - citSmooth(m / 0.4))); C.pack.visible = m < 0.4;
  C.armR.rotation.set(Math.sin(A.phase) * 0.1 * Math.min(1, s) + (h.downed ? 0.5 : 0), 0, -0.05 + Math.sin(A.t * 31) * 0.002 * idle);
  C.elbowR.rotation.x = h.downed ? 0.55 : -h.aimElev - arm.recoil * T.recoilKick + breath * 0.012 - C.body.rotation.x - C.armR.rotation.x;
  C.cannon.position.set(-0.06 + (h.input.fire ? Math.sin(A.t * 90) * 0.003 : 0), 0, -arm.recoil * 0.06);
  C.face.rotation.set(h.downed ? 0.25 : -h.aimElev * 0.35 * walkW, Math.sin(A.t * 0.55) * 0.07 * idle, 0);

  // ---- left arm: rest / Peel Shield / EMPeach throw ----
  S.shield += ((cs.shield && !h.downed && m < 0.5 ? 1 : 0) - S.shield) * Math.min(1, dt / T.shieldTime * 2.2);
  if (dt === 0) S.shield = cs.shield && !h.downed ? 1 : 0;
  const sh = citSmooth(S.shield);
  let sx = -0.18 - Math.sin(A.phase) * 0.22 * Math.min(1, s) + breath * 0.02, sz = 0.22, el = -1.1 - 0.15 * Math.min(1, s), wr = 0.1, fi = 1.25;
  sx += (-1.42 - sx) * sh; sz += (-0.32 - sz) * sh; el += (-0.18 - el) * sh; wr += (1.45 - wr) * sh; fi += (0.08 - fi) * sh;
  if (throwing) {
    sx = citKeys([[0, sx], [0.3, 1.15], [0.5, -2.05], [0.75, -1.0], [1, sx]], throwU);
    sz = citKeys([[0, sz], [0.3, 0.42], [0.5, 0.05], [1, sz]], throwU);
    el = citKeys([[0, el], [0.3, -1.85], [0.5, -0.2], [0.75, -0.65], [1, el]], throwU);
    wr = citKeys([[0, wr], [0.3, 0.5], [0.5, -0.35], [1, wr]], throwU);
    fi = citKeys([[0, fi], [0.42, 1.0], [0.5, 0.15], [0.8, 0.6], [1, fi]], throwU);
  }
  if (h.downed) { sx = 0.15; sz = 0.4; el = -0.35; wr = 0.2; fi = 0.5; }
  C.armL.rotation.set(sx, 0, sz); C.elbowL.rotation.x = el; C.hand.rotation.x = wr; C.fingers.rotation.x = fi; C.thumb.rotation.z = -0.2 + fi * 0.35;
  C.heldPeach.root.visible = !!throwing && throwU < 0.46;
  if (C.heldPeach.root.visible) C.heldPeach.light.material.emissiveIntensity = 1.5 + Math.sin(A.t * 30) * 1.2;

  // ---- Peel Shield ----
  const SP = C.shieldParts, su = SP.mat.userData.u;
  C.shield.visible = S.shield > 0.01;
  if (cs.shieldHit > S.lastHit + 1e-3) S.hitAge = 0;
  S.lastHit = cs.shieldHit; S.hitAge += dt;
  su.citUnfold.value = sh; su.citTime.value = A.t; su.citRipple.value = S.hitAge * 4.5; su.citHit.value = Math.min(1, cs.shieldHit / 0.2) + (S.hitAge < 0.4 ? 0.6 : 0);
  const hp = THREE.MathUtils.clamp(cs.shieldHp, 0, 1), pulse = 0.88 + 0.12 * Math.sin(A.t * 6);
  SP.mat.color.setHex(M.shieldGlow).lerp(_citColor.setHex(0xff2a10), Math.pow(1 - hp, 1.4));
  SP.rimMat.color.copy(SP.mat.color);
  SP.mat.opacity = (0.3 + 0.25 * hp) * pulse * sh; SP.rimMat.opacity = Math.min(1, sh * 1.2) * (0.55 + 0.45 * hp) * (1 + su.citHit.value * 0.5);
  C.shield.scale.set(0.35 + 0.65 * citBack(S.shield), 0.2 + 0.8 * citBack(S.shield * 1.1), 1);

  // ---- glow channels ----
  const flick = n => 0.75 + 0.25 * Math.sin(A.t * 53 + n) * Math.sin(A.t * 37 + n * 2);
  const seam = 1.5 * walkW + mE * (1.4 + 0.35 * Math.sin(A.t * 3)) + charge * 3.5 * flick(1) + dashing * 4.5;
  G[0].set(1, 0.95, 0.8, seam); GM[0] = Math.min(0.6, charge * 0.5 + dashing * 0.6);
  const heat = THREE.MathUtils.clamp(cs.heat, 0, 1), over = cs.overheated > 0 ? 1 : 0;
  G[1].set(1, 0.97, 0.88, (0.65 + heat * 2.4 + arm.recoil * 0.9 + (h.input.fire ? 0.35 : 0)) * (over ? 0.55 + 0.45 * flick(3) : 1));
  GM[1] = Math.min(0.9, heat * heat * 0.9);
  A.blink -= dt; if (A.blink < 0) A.blink = randRange(T.blinkInterval);
  const blink = A.blink < 0.12 ? Math.abs(A.blink - 0.06) / 0.06 : 1;
  const visor = h.downed ? 0.35 + 0.35 * Math.max(0, Math.sin(A.t * 23) * Math.sin(A.t * 7)) : 1.7 * (0.4 + 0.6 * blink) * (0.94 + 0.06 * Math.sin(A.t * 40));
  G[2].set(1, 1, 1, visor); GM[2] = 0;
  C.eyes.scale.y = Math.max(0.08, blink);
  C.eyeHalo.material.opacity = 0.5 * visor / 1.7 * walkW;
  const firing = h.input.fire && !h.downed ? 1 : 0;
  G[3].set(1, 0.95, 0.85, 1.1 + firing * (3.2 + 0.6 * flick(5)) + arm.recoil * 2); GM[3] = firing * 0.5;
  C.emitHalo.material.opacity = (0.15 + firing * 0.75 + arm.recoil * 0.4) * armK;
  G[4].set(1, 0.95, 0.8, 0.4 + sh * 3.2 + su.citHit.value * 2); GM[4] = sh * 0.3;

  // ---- idle visor scan sweep ----
  S.scanT -= dt;
  if (S.scanT < 0) S.scanT = randRange(T.scanInterval);
  const scanU = 1 - S.scanT / T.scanTime;
  C.scan.visible = S.scanT < T.scanTime && !h.downed && m < 0.3;
  C.scan.rotation.y = (scanU * 2 - 1) * 1.0;

  // ---- vents pop open while overheated; steam puffs from the vents ----
  S.vent += ((over ? 1 : 0) - S.vent) * Math.min(1, dt * (over ? 14 : 5));
  C.vents.forEach((v, i) => { v.rotation.x = citBack(S.vent) * T.ventOpen * (1 + i * 0.08); });
  if (dt > 0 && over && Math.random() < dt * 14 && armK > 0.5) {
    const v = C.vents[Math.random() < 0.5 ? 0 : 1].getWorldPosition(new THREE.Vector3());
    spawnParticle('puff', 0xe9e4dc, v, new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6),
      { life: 0.8, gravity: -1.5, grow: 2.2, size: 0.5, drag: 1.5 });
  }
  // dash charge throws sparks off the ground behind the spinning ball
  if (dt > 0 && charge > 0.25 && Math.random() < dt * 40 * charge) {
    const p = C.root.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.05, -0.75));
    const back = C.root.localToWorld(new THREE.Vector3(0, 0, -1)).sub(C.root.localToWorld(new THREE.Vector3())).normalize();
    spawnParticle('spark', 0xffa040, p, back.multiplyScalar(4 + Math.random() * 4).add(new THREE.Vector3(0, 2 + Math.random() * 2, 0)),
      { life: 0.35, gravity: 14, size: 0.6, additive: true });
  }

  // ---- crown leaves sway with motion ----
  C.leaves.forEach((leaf, i) => {
    const b = leaf.userData.base;
    leaf.rotation.x = b.x + Math.sin(A.t * 2.4 + i * 1.7) * 0.05 + A.leanF * 0.12 - S.jig * 0.06 + arm.recoil * 0.03;
    leaf.rotation.z = b.z + Math.sin(A.phase + i) * 0.06 * Math.min(1, s);
  });
}
const _citColor = new THREE.Color();

// ---- lab poses ----
const citState = extra => Object.assign({ ball: false, shield: false, shieldHp: 1, shieldHit: 0, heat: 0, overheated: 0, dashCharge: 0, dashing: 0, empT: 9 }, extra);
const CITRON_LAB = {   // render poses for tests/plant-models.cjs
  type: 'citron', build: buildCitron, animate: animateCitron, stats: { speed: 8, hp: 200 },
  poses: {
    idle: { frames: 90, setup(h) {
      h.cit = citState();
      let meshes = 0, tris = 0, draws = 0;
      h.corn.root.traverse(o => { if (!o.isMesh) return; meshes++; draws += Array.isArray(o.material) ? o.material.length : 1;
        const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); });
      console.log(`citron: ${meshes} meshes, ${draws} draws, ${Math.round(tris)} triangles`);
    } },
    run: { frames: 47, setup(h) { h.cit = citState(); }, step(h) { h.vel.set(0, 0, -h.stats.speed); } },
    fire: { frames: 40, setup(h) { h.cit = citState({ heat: 0.45 }); h.input.fire = true; },
      step(h, f) { if (f % 9 === 0) { const a = h.corn.arms[0]; a.recoil = 1; a.flashT = 0.05; } } },
    heat: { frames: 30, setup(h) { h.cit = citState({ heat: 1, overheated: 2 }); } },
    shield: { frames: 40, setup(h) { h.cit = citState({ shield: true, shieldHp: 0.8 }); },
      step(h, f) { if (f === 30) h.cit.shieldHit = 0.3; else h.cit.shieldHit = Math.max(0, h.cit.shieldHit - 1 / 60); } },
    ballMorph: { frames: 10, setup(h) { h.cit = citState({ ball: true }); } },
    ball: { frames: 60, setup(h) { h.cit = citState({ ball: true }); }, step(h) { h.vel.set(0, 0, -12); } },
    dash: { frames: 50, setup(h) { h.cit = citState({ ball: true }); }, step(h, f) { h.cit.dashCharge = Math.min(1, f / 40); } },
    throw: { frames: 12, setup(h) { h.cit = citState({ empT: 0 }); }, step(h) { h.cit.empT += 1 / 60; } },
    downed: { frames: 90, setup(h) { h.cit = citState(); h.downed = true; } },
  },
};

export { buildEmpeach, citShield, buildCitron, animateCitron, CITRON_LAB };
