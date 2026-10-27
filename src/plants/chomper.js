// Chomper — ambusher: model, Goop ball, Spikeweed and animation, render poses.
// Procedural geometry only (no asset files). index.html imports this module behind the loading screen, after
// three.js (section "Plant models"). Model space: feet at y = 0, facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { randRange, spawnParticle } from './shared.js';

// =====================================================================
// Chomper — melee ambusher: a hungry purple flytrap with no eyes, the jaws do the acting.
// Each jaw is ONE closed surface (spotted outer dome → rolled lip → wet lining), so it never looks hollow at any
// opening angle; fangs are instanced and interlock outside the lips when shut. The S-curve neck is a tube rebuilt
// every frame between the leafy base and the head (lunges stretch it, a gulp bulge travels down it).
// Model space faces +Z, feet at y = 0. The burrow mound and the Spikeweed trap live here too.
// =====================================================================
const CHOMPER_TUNING = CONFIG.CHOMPER;   // model / animation tuning lives in CONFIG.CHOMPER

const CHOMPER_MAT = {
  // Waxy purple trap skin: lilac spots, wet lining and micro relief are resolved in the shader (see below)
  skin: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.38, clearcoat: 0.5,
    clearcoatRoughness: 0.26, sheen: 0.35, sheenColor: 0xe2b8ff, envMapIntensity: 0.6 }),
  leaf: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, clearcoat: 0.22,
    clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: 0xb6e070, envMapIntensity: 0.45 }),
  stem: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.4, clearcoat: 0.3,
    clearcoatRoughness: 0.35, envMapIntensity: 0.45 }),
  tooth: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 0.7 }),
  tongue: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, clearcoat: 0.9,
    clearcoatRoughness: 0.1, sheen: 0.5, sheenColor: 0xffb0c4, envMapIntensity: 0.6 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.96, envMapIntensity: 0.3 }),
  clod: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, envMapIntensity: 0.3 }),
  grass: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.65, envMapIntensity: 0.4 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 }),
  zombie: new THREE.MeshStandardMaterial({ color: 0x8fa77a, roughness: 0.75 }),
  splat: new THREE.MeshBasicMaterial({ color: 0xb45cf0, transparent: true, opacity: 0.85, depthWrite: false }),
};
// Shader detail on the jaw skin. `zone` (vertex attribute): 1 = outer dome, 0 = lip and lining.
//  outer: 3D cellular lilac spots of varied size + waxy micro relief; lining: glossy wet with soft folds.
CHOMPER_MAT.skin.onBeforeCompile = shader => {
  shader.uniforms.chompSpot = { value: new THREE.Color(CHOMPER_TUNING.model.spot) };
  shader.uniforms.chompSpotScale = { value: CHOMPER_TUNING.model.spotScale };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float zone;\nvarying vec3 vChompP;\nvarying float vChompZone;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvChompP = position;\nvChompZone = zone;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    uniform vec3 chompSpot;
    uniform float chompSpotScale;
    varying vec3 vChompP;
    varying float vChompZone;
    vec3 chompHash(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
      return fract(sin(p) * 43758.5453);
    }
    float chompSpots(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      float best = 9.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z)), h = chompHash(i + o);
        best = min(best, length(o + 0.15 + h * 0.7 - f) / (0.16 + 0.22 * h.z));
      }
      float w = fwidth(best) * 1.2 + 0.04;
      return 1.0 - smoothstep(1.0 - w, 1.0, best);
    }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      // flytrap venation: a pale midrib down the middle, darker veins sweeping from it toward the lips
      float chompLat = abs(vChompP.x), chompVv = vChompP.z * 3.4 - chompLat * chompLat * 5.0 + chompLat * 1.2;
      float chompVw = fwidth(chompVv) * 1.2 + 0.035;
      float chompVein = smoothstep(0.5 - chompVw, 0.5, abs(fract(chompVv) - 0.5)) * smoothstep(0.05, 0.14, chompLat) * smoothstep(0.3, 0.8, vChompZone);
      float chompRib = (1.0 - smoothstep(0.02, 0.05, chompLat)) * smoothstep(0.3, 0.8, vChompZone);
      diffuseColor.rgb *= (1.0 - 0.24 * chompVein) * (1.0 + 0.2 * chompRib);
      float chompSpotK = chompSpots(vChompP * chompSpotScale) * smoothstep(0.35, 0.9, vChompZone);
      diffuseColor.rgb = mix(diffuseColor.rgb, chompSpot * (0.85 + 0.3 * diffuseColor.rgb), chompSpotK * 0.9);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.16, roughnessFactor + chompSpotK * 0.1, smoothstep(0.0, 0.6, vChompZone));`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // bump from a height field (screen-space derivatives): fine waxy pores outside, soft wet folds inside
      vec3 chompQ = vChompP * mix(24.0, 52.0, vChompZone);
      chompQ += sin(chompQ.yzx * 0.71 + sin(chompQ.zxy * 0.37)) * 0.8;
      float chompH = sin(chompQ.x) * sin(chompQ.y) * sin(chompQ.z) * mix(0.0009, 0.0007, vChompZone);
      vec3 chompSx = dFdx(-vViewPosition), chompSy = dFdy(-vViewPosition);
      vec3 chompRx = cross(chompSy, normal), chompRy = cross(normal, chompSx);
      float chompDet = dot(chompSx, chompRx);
      normal = normalize(abs(chompDet) * normal - sign(chompDet) * (dFdx(chompH) * chompRx + dFdy(chompH) * chompRy));`);
};
CHOMPER_MAT.skin.customProgramCacheKey = () => 'chomper-skin-v1';

// ---- Geometry helpers ----
// Closed parametric surface: `rows` bands from pole v = 0 to pole v = 1, `sides` columns wrapped around u.
// at(u, v, o) fills o.p (position), o.c (colour) and o.z (zone). Winding is made outward from the signed volume.
function chompSurface(rows, sides, at) {
  const pos = [], col = [], zone = [], idx = [], o = { p: new THREE.Vector3(), c: new THREE.Color(), z: 0 };
  const push = () => { pos.push(o.p.x, o.p.y, o.p.z); col.push(o.c.r, o.c.g, o.c.b); zone.push(o.z); };
  at(0, 0, o); push();
  for (let i = 1; i < rows; i++) for (let j = 0; j < sides; j++) { at(j / sides, i / rows, o); push(); }
  at(0, 1, o); push();
  const ring = (i, j) => 1 + (i - 1) * sides + (j % sides), last = 1 + (rows - 1) * sides;
  for (let j = 0; j < sides; j++) {
    idx.push(0, ring(1, j + 1), ring(1, j), last, ring(rows - 1, j), ring(rows - 1, j + 1));
    for (let i = 1; i < rows - 1; i++) idx.push(ring(i, j), ring(i, j + 1), ring(i + 1, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j));
  }
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
      + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (vol < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('zone', new THREE.Float32BufferAttribute(zone, 1));
  g.computeVertexNormals(); return g;
}
function chompMesh(parent, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
// Orient an object so its +Y grows along `grow` and its +Z faces `face` (made orthogonal).
const _cbX = new THREE.Vector3(), _cbY = new THREE.Vector3(), _cbZ = new THREE.Vector3(), _cbM = new THREE.Matrix4();
function chompOrient(obj, grow, face) {
  _cbY.copy(grow).normalize(); _cbZ.copy(face).addScaledVector(_cbY, -_cbZ.copy(face).dot(_cbY)).normalize();
  _cbX.crossVectors(_cbY, _cbZ); obj.quaternion.setFromRotationMatrix(_cbM.makeBasis(_cbX, _cbY, _cbZ)); return obj;
}
const chompV = (x, y, z) => new THREE.Vector3(x, y, z);
const chompSmooth = THREE.MathUtils.smoothstep;
const chompBump = (u, a, b) => u <= a || u >= b ? 0 : Math.sin((u - a) / (b - a) * Math.PI);
const chompOut = u => 1 - Math.pow(1 - THREE.MathUtils.clamp(u, 0, 1), 3);
const chompBack = u => { u = THREE.MathUtils.clamp(u, 0, 1); const k = 2.2; return 1 + (k + 1) * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2); };

// A thick leaf volume (lens cross-section, never paper-thin): grows along +Y, face toward +Z, curls toward the face
// by `curl` rad, edges cup toward the face. Raised midrib, side veins and a lighter underside in vertex colour.
function chompLeafGeo({ length = 0.8, width = 0.32, thick = 0.05, curl = 0.5, cup = 0.25, twist = 0, base = 0.14,
  dark = CHOMPER_TUNING.model.leafDark, light = CHOMPER_TUNING.model.leafLight, rows = 26, sides = 18 }) {
  const dk = new THREE.Color(dark), lt = new THREE.Color(light);
  return chompSurface(rows, sides, (u, t, o) => {
    const a = u * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const w = width * (base * (1 - t) * (1 - t) + (1 - base) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85));
    const th = thick * (1 - Math.pow(t, 1.6)) * (0.45 + 0.55 * w / width);
    const pole = t === 0 || t === 1;
    const x = pole ? 0 : ca * w / 2;
    let n = pole ? 0 : sa * th / 2 + cup * w * ca * ca * 0.5;
    n += (pole ? 0 : 1) * Math.exp(-ca * ca / 0.05) * th * (sa > 0 ? -0.25 : 0.45);   // midrib groove / keel
    const tw = twist * t, xr = x * Math.cos(tw) - n * Math.sin(tw), nr = x * Math.sin(tw) + n * Math.cos(tw);
    const ang = curl * t, sy = curl ? Math.sin(ang) / curl * length : t * length, sz = curl ? (1 - Math.cos(ang)) / curl * length : 0;
    o.p.set(xr, sy - Math.sin(ang) * nr, sz + Math.cos(ang) * nr);
    const rib = Math.exp(-ca * ca / 0.012), vein = Math.pow(Math.max(0, Math.cos((t - Math.abs(ca) * 0.32) * Math.PI * 7)), 10) * (1 - Math.abs(ca));
    o.c.lerpColors(dk, lt, 0.12 + 0.8 * Math.pow(t, 0.75) - Math.abs(ca) * 0.1);
    if (sa > 0) o.c.offsetHSL(0, 0, rib * 0.1 + vein * 0.05);
    else o.c.offsetHSL(0.02, -0.18, 0.05 + rib * 0.05);
    o.z = 0;
  });
}

// Jaw rim outline in head space (lip-line plane), th = 0 at the front: squarish egg, broad at the front.
function chompRim(th) {
  const M = CHOMPER_TUNING.model, a = M.headLength / 2, b = M.headWidth / 2;
  const c = Math.cos(th), s = Math.sin(th), z = a * Math.sign(c) * Math.pow(Math.abs(c), 0.85);
  return [b * Math.sign(s) * Math.pow(Math.abs(s), 0.85) * (0.84 + 0.16 * z / a), z];
}
// One jaw lobe (s = +1 upper, -1 lower) in hinge space: outer dome → rolled lip → wet lining → throat.
function chompJawGeo(s) {
  const M = CHOMPER_TUNING.model, a = M.headLength / 2, rl = M.lip, hz = -a + M.hingeInset;
  const cz = s > 0 ? M.domeCenterZ : M.lowCenterZ, H = s > 0 ? M.domeUp : M.domeDown, Hin = H - M.shell, cheek = s > 0 ? M.cheek : M.cheekLow;
  const nOut = 44, nLip = 14, nIn = 28, rows = nOut + nLip + nIn;
  const skin = new THREE.Color(M.skin), top = new THREE.Color(s > 0 ? M.skinTop : M.skinBelly), lip = new THREE.Color(M.lipColor),
    mouth = new THREE.Color(M.mouth), throat = new THREE.Color(M.throat);
  return chompSurface(rows, M.jawSides, (u, v, o) => {
    const th = u * Math.PI * 2, k = v * rows, [rx, rz] = chompRim(th);
    let dx = rx, dz = rz - cz; const D = Math.hypot(dx, dz); dx /= D; dz /= D;
    const back = (1 - Math.cos(th)) / 2;   // 0 at the front → 1 at the hinge
    let r, y;
    if (k <= nOut) {
      const f = Math.PI / 2 * k / nOut, rim = chompSmooth(k / nOut, 0.8, 1);
      // cheeks swell past the lip; the upper lobe swells most at the front: a heavy overbite brow
      const swell = cheek * (s > 0 ? 0.55 + 0.9 * Math.pow(Math.max(0, Math.cos(th)), 1.5) : 1);
      r = D * Math.pow(Math.sin(f), M.bulb) * (1 + swell * Math.pow(Math.sin(2 * f), 2) * Math.pow(Math.sin(f), 1.4));
      y = rl + (H - rl) * Math.cos(f);
      if (s > 0) y += M.ridge * Math.exp(-Math.pow(dx * r / 0.1, 2)) * chompSmooth(r, 0.05, 0.45) * (1 - rim);   // midrib
      o.c.copy(skin).lerp(top, Math.pow(Math.cos(f), 1.4) * 0.75);
      o.c.multiplyScalar(1 - 0.16 * back * back - 0.1 * rim);
      const px = dx * r, pz = dz * r, mott = Math.sin(px * 6.1 + pz * 3.7 + 0.5) * Math.sin(pz * 5.3 - y * 4.1 * s + px * 2);
      o.c.offsetHSL(0.012 * mott, 0.03 * mott, 0.03 * mott);
      o.z = 1 - rim;
    } else if (k <= nOut + nLip) {
      const w = (k - nOut) / nLip, al = -Math.PI * w;
      r = D - rl + rl * Math.cos(al); y = rl + rl * Math.sin(al);
      o.c.copy(lip).lerp(mouth, chompSmooth(w, 0.45, 1)); o.z = 0;
    } else {
      const w = (k - nOut - nLip) / nIn, f = Math.PI / 2 * (1 - w);
      r = (D - 2 * rl) * Math.pow(Math.sin(f), M.bulb); y = rl + (Hin - rl) * Math.cos(f);
      o.c.copy(mouth).lerp(throat, THREE.MathUtils.clamp(0.08 + (1 - Math.sin(f)) * 0.55 + back * 0.6, 0, 1));
      const z = cz + dz * r, folds = Math.pow(0.5 + 0.5 * Math.sin(z * (s > 0 ? 30 : 18) + (s > 0 ? 0 : dx * 6)), 5);
      o.c.offsetHSL(0, 0, folds * 0.07 * (1 - back));
      o.z = 0;
    }
    o.p.set(dx * r, s * y, cz + dz * r - hz);
  });
}
// Fang along +Y (base at 0, tip at 1), hooked toward +X.
const CHOMP_TOOTH_GEO = (() => {
  const g = new THREE.CylinderGeometry(0, 1, 1, 14, 8, true); g.translate(0, 0.5, 0);
  const p = g.attributes.position, col = [], root = new THREE.Color(0xe9dcbc), tip = new THREE.Color(0xffffff), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), plump = 1 + 0.45 * Math.sin(Math.min(1, y * 1.4) * Math.PI) * (1 - y);   // convex flanks, sharp tip
    p.setXYZ(i, p.getX(i) * plump + 0.3 * y * y, y, p.getZ(i) * plump * 0.8);
    c.lerpColors(root, tip, Math.pow(y, 0.6)); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
})();
function chompTeeth(s) {
  const M = CHOMPER_TUNING.model, a = M.headLength / 2, cz = s > 0 ? M.domeCenterZ : M.lowCenterZ, hz = -a + M.hingeInset, n = M.teeth - (s > 0 ? 0 : 1);
  const im = new THREE.InstancedMesh(CHOMP_TOOTH_GEO, CHOMPER_MAT.tooth, n);
  const m = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), out = new THREE.Vector3(),
    c = new THREE.Color(), ivory = new THREE.Color(M.tooth), shade = new THREE.Color(M.toothShade);
  for (let i = 0; i < n; i++) {
    // upper fangs on whole slots, lower ones half a slot over: they interlock when the trap shuts
    const th = -0.74 * Math.PI + (i + (s > 0 ? 0.5 : 1)) * 1.48 * Math.PI / M.teeth, [rx, rz] = chompRim(th);
    out.set(rx, 0, rz - cz); const D = out.length(); out.normalize();
    const front = 0.5 + 0.5 * Math.cos(th), jitter = Math.sin(i * 12.9898 + s * 4.1) * 0.5 + 0.5;
    const len = (0.1 + 0.17 * Math.pow(front, 0.7) + 0.05 * jitter) * (s > 0 ? 1.08 : 0.9), rad = len * 0.33;
    const tilt = M.toothTilt + (jitter - 0.5) * 0.12;
    Y.set(0, -s * Math.cos(tilt), 0).addScaledVector(out, Math.sin(tilt)).normalize();
    X.copy(out).negate().addScaledVector(Y, out.dot(Y)).normalize();
    X.applyAxisAngle(Y, (jitter - 0.5) * 0.5); Z.crossVectors(X, Y);
    m.makeBasis(X, Y, Z).scale(new THREE.Vector3(rad, len, rad));
    m.setPosition(out.x * (D - M.lip * 0.3), s * M.lip * 0.35, cz + out.z * (D - M.lip * 0.3) - hz);
    im.setMatrixAt(i, m); im.setColorAt(i, c.copy(ivory).lerp(shade, jitter * 0.6));
  }
  im.castShadow = im.receiveShadow = true; return im;
}
function chompTongueGeo() {
  const M = CHOMPER_TUNING.model, g = new THREE.SphereGeometry(1, 36, 22), p = g.attributes.position, col = [];
  const base = new THREE.Color(M.tongue), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (z + 1) / 2;   // 0 = root, 1 = tip
    const w = 0.19 * (1 - 0.32 * t), th = 0.08 * (1 - 0.3 * t);
    let Y = y * th - (y > 0 ? 0.04 * y * Math.exp(-x * x / 0.04) : 0) + 0.11 * Math.pow(t, 3);
    p.setXYZ(i, x * w, Y, z * 0.36);
    c.copy(base).offsetHSL(0, 0, -0.12 * Math.abs(x) - (y < 0 ? 0.08 : 0) + 0.02 * Math.sin(x * 40) * Math.sin(z * 37) - (1 - t) * 0.08);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// Bulbous root crown the neck and leaves grow from (fluted, darker toward the soil).
function chompCrownGeo() {
  const M = CHOMPER_TUNING.model, dk = new THREE.Color(M.leafDark), st = new THREE.Color(M.stem);
  return chompSurface(20, 40, (u, v, o) => {
    const a = u * Math.PI * 2, f = v * Math.PI, flute = 1 + 0.06 * Math.cos(a * 7);
    const r = 0.34 * Math.pow(Math.sin(f), 0.85) * flute * (1 - 0.35 * Math.pow(Math.max(0, Math.cos(f)), 2));
    o.p.set(Math.cos(a) * r, 0.44 + 0.3 * Math.cos(f), Math.sin(a) * r - 0.08);
    o.c.copy(dk).lerp(st, 0.25 + 0.55 * (1 - v) + 0.1 * Math.cos(a * 7)); o.z = 0;
  });
}
// Neck tube: indexed ring buffer whose positions are rebuilt every frame by updateChompNeck.
function chompNeckGeo(rings, sides) {
  const M = CHOMPER_TUNING.model, pos = new Float32Array((rings + 1) * sides * 3), col = [], idx = [];
  const dk = new THREE.Color(M.leafDark), st = new THREE.Color(M.stem), lt = new THREE.Color(M.stemLight), c = new THREE.Color();
  for (let i = 0; i <= rings; i++) for (let j = 0; j < sides; j++) {
    const t = i / rings, ridge = Math.pow(0.5 + 0.5 * Math.cos(j / sides * Math.PI * 2 * 5), 3);
    const backSide = Math.max(0, Math.sin(j / sides * Math.PI * 2));   // the frame's +G side faces backward
    c.copy(dk).lerp(st, 0.35 + 0.65 * Math.min(1, t * 1.6)).lerp(lt, ridge * 0.35 + 0.15 * t + (1 - backSide) * 0.2);
    c.multiplyScalar(1 - 0.18 * backSide);
    col.push(c.r, c.g, c.b);
    if (i < rings) { const k = i * sides, a = k + j, b = k + (j + 1) % sides; idx.push(a, b, a + sides, b, b + sides, a + sides); }
  }
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
const _nA = new THREE.Vector3(), _nB = new THREE.Vector3(), _nC = new THREE.Vector3(), _nD = new THREE.Vector3(),
  _nP = new THREE.Vector3(), _nT = new THREE.Vector3(), _nN = new THREE.Vector3(), _nW = new THREE.Vector3(), _nG = new THREE.Vector3();
// Rebuild the neck: cubic Bezier from the crown (rising, leaning back) into the underside of the head (S-curve).
// bulgeT 0..1 (base → head) and bulge (m) swell a section of it: a swallowed zombie on its way down.
function updateChompNeck(C, bulgeT = -1, bulge = 0) {
  const M = CHOMPER_TUNING.model, R = M.neckRadius, g = C.neck.geometry, pos = g.attributes.position.array, rings = C.neckRings, sides = C.neckSides;
  // the neck plugs into the lower jaw (the lower lobe stays one piece with the stalk when the trap gapes)
  C.head.updateMatrix(); C.jawLow.updateMatrix();
  const p0 = C.neckP0, p3 = _nD.copy(C.neckAnchor).applyMatrix4(C.jawLow.matrix).applyMatrix4(C.head.matrix);
  const t3 = _nT.copy(C.neckDir).applyQuaternion(C.jawLow.quaternion).applyQuaternion(C.head.quaternion), d = p0.distanceTo(p3);
  const p1 = _nB.copy(p0).addScaledVector(C.neckT0, d * 0.55), p2 = _nC.copy(p3).addScaledVector(t3, -d * 0.5);
  const at = (t, out) => {
    const s = 1 - t;
    return out.set(0, 0, 0).addScaledVector(p0, s * s * s).addScaledVector(p1, 3 * s * s * t).addScaledVector(p2, 3 * s * t * t).addScaledVector(p3, t * t * t);
  };
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    at(t, _nP); at(Math.min(1, t + 0.01), _nW); at(Math.max(0, t - 0.01), _nA); _nW.sub(_nA).normalize();   // tangent
    _nN.set(1, 0, 0).addScaledVector(_nW, -_nW.x).normalize(); _nG.crossVectors(_nW, _nN);
    let r = t < 0.5 ? R[0] + (R[1] - R[0]) * chompSmooth(t, 0, 0.5) : R[1] + (R[2] - R[1]) * chompSmooth(t, 0.5, 0.88);
    r += (R[3] - R[2]) * chompSmooth(t, 0.86, 1);
    r *= 1 + 0.06 * Math.sin(t * Math.PI * 2.2 + 0.4) * Math.sin(t * Math.PI);   // muscular swell along the stalk
    if (bulge) r += bulge * Math.exp(-Math.pow((t - bulgeT) / 0.12, 2));
    for (let j = 0; j < sides; j++) {
      const a = j / sides * Math.PI * 2, rr = r * (1 + 0.05 * Math.cos(a * 5) * (0.5 + 0.5 * Math.sin(t * Math.PI))), k = (i * sides + j) * 3;
      pos[k] = _nP.x + (_nN.x * Math.cos(a) + _nG.x * Math.sin(a)) * rr;
      pos[k + 1] = _nP.y + (_nN.y * Math.cos(a) + _nG.y * Math.sin(a)) * rr;
      pos[k + 2] = _nP.z + (_nN.z * Math.cos(a) + _nG.z * Math.sin(a)) * rr;
    }
    // leaves riding on the neck follow its frame
    for (const L of C.neckLeaves) if (i === L.ring) {
      L.pivot.position.copy(_nP).addScaledVector(_nN, L.side * r * 0.75);
      chompOrient(L.pivot, _nA.copy(_nN).multiplyScalar(L.side * 0.85).addScaledVector(_nW, 0.55), _nW);
    }
  }
  g.attributes.position.needsUpdate = true; g.computeVertexNormals();
}
// Hinge web: a fleshy gum membrane on both sides of the mouth corner, joining the lobes at the back so the open
// trap reads as one head. A thin closed slab (outer purple skin, inner wet mouth) rebuilt each frame between the
// lips of the two jaws; it collapses into the lip line when the mouth shuts and stretches/bows inward as it opens.
const CHOMP_WEB = CONFIG.CHOMPER.web;
function chompWebGeo() {
  const M = CHOMPER_TUNING.model, W = CHOMP_WEB, a = M.headLength / 2, hz = -a + M.hingeInset, rl = M.lip;
  const nT = W.nT, nW = W.nW, per = (nT + 1) * (nW + 1), lips = [], col = [], zone = [], idx = [];
  const skin = new THREE.Color(M.skin).multiplyScalar(0.85), mouth = new THREE.Color(M.mouth), throat = new THREE.Color(M.throat), c = new THREE.Color();
  for (const side of [-1, 1]) for (const face of [1, -1]) for (let i = 0; i <= nT; i++) for (let j = 0; j <= nW; j++) {
    const w = j / nW, u = i / nT * (1 - W.reach * Math.sin(Math.PI * w));   // concave free edge at the mouth corner
    const th = side * (Math.PI - W.span * Math.PI * u), [rx, rz] = chompRim(th);
    // lip-bottom point of each jaw in its own hinge space, plus the outward direction
    const lip = (cz) => { const dx = rx, dz = rz - cz, D = Math.hypot(dx, dz); return [dx / D * (D - rl * 0.45), 0, cz + dz / D * (D - rl * 0.45) - hz, dx / D, dz / D]; };
    if (face > 0) lips.push(lip(M.domeCenterZ), lip(M.lowCenterZ));
    if (face > 0) c.copy(skin).offsetHSL(0, 0, -0.04 * w); else c.copy(mouth).lerp(throat, 0.25 + 0.5 * (1 - u));
    col.push(c.r, c.g, c.b); zone.push(face > 0 ? 0.9 : 0);
  }
  // two faces per side + stitched borders = a closed slab
  const grid = (b, i, j) => b + i * (nW + 1) + j;
  for (let sd = 0; sd < 2; sd++) {
    const o = sd * 2 * per, n = o + per;
    for (let i = 0; i < nT; i++) for (let j = 0; j < nW; j++) {
      idx.push(grid(o, i, j), grid(o, i + 1, j), grid(o, i, j + 1), grid(o, i + 1, j), grid(o, i + 1, j + 1), grid(o, i, j + 1));
      idx.push(grid(n, i, j), grid(n, i, j + 1), grid(n, i + 1, j), grid(n, i + 1, j), grid(n, i, j + 1), grid(n, i + 1, j + 1));
    }
    const edge = (a0, a1, b0, b1) => idx.push(a0, b0, a1, a1, b0, b1);
    for (let i = 0; i < nT; i++) { edge(grid(o, i, 0), grid(o, i + 1, 0), grid(n, i, 0), grid(n, i + 1, 0)); edge(grid(o, i + 1, nW), grid(o, i, nW), grid(n, i + 1, nW), grid(n, i, nW)); }
    for (let j = 0; j < nW; j++) { edge(grid(o, nT, j), grid(o, nT, j + 1), grid(n, nT, j), grid(n, nT, j + 1)); edge(grid(o, 0, j + 1), grid(o, 0, j), grid(n, 0, j + 1), grid(n, 0, j)); }
  }
  for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }   // outward winding
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(per * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('zone', new THREE.Float32BufferAttribute(zone, 1));
  g.userData.lips = lips; g.userData.per = per; return g;
}
const _wU = new THREE.Vector3(), _wL = new THREE.Vector3(), _wP = new THREE.Vector3();
function updateChompWeb(C) {
  const W = CHOMP_WEB, g = C.web.geometry, pos = g.attributes.position.array, lips = g.userData.lips, per = g.userData.per;
  C.jawUp.updateMatrix(); C.jawLow.updateMatrix();
  for (let sd = 0; sd < 2; sd++) for (let k = 0; k < per; k++) {
    const j = k % (W.nW + 1), w = j / W.nW, U = lips[(sd * per + k) * 2], L = lips[(sd * per + k) * 2 + 1];
    _wU.set(U[0], U[1], U[2]).applyMatrix4(C.jawUp.matrix); _wL.set(L[0], L[1], L[2]).applyMatrix4(C.jawLow.matrix);
    const gap = _wU.distanceTo(_wL), dx = (U[3] + L[3]) / 2, dz = (U[4] + L[4]) / 2;
    _wP.lerpVectors(_wU, _wL, w);
    const sag = -W.sag * gap * Math.sin(Math.PI * w), th = W.thick * Math.min(1, gap * 8);   // bows into the mouth
    for (const face of [1, -1]) {
      const q = ((sd * 2 + (face > 0 ? 0 : 1)) * per + k) * 3, off = sag + face * th;
      pos[q] = _wP.x + dx * off; pos[q + 1] = _wP.y; pos[q + 2] = _wP.z + dz * off;
    }
  }
  g.attributes.position.needsUpdate = true; g.computeVertexNormals();
}
// Lumpy dirt mound (burrowed Chomper): sits at y = 0, ~1.6 m across, clods, grass tufts and two leaf tips poking out.
function chompMound() {
  const M = CHOMPER_TUNING.model, mound = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), p = geo.attributes.position, col = [];
  const dk = new THREE.Color(M.dirt), lt = new THREE.Color(M.dirtLight), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ang = Math.atan2(z, x), e = y;
    // soft heaped soil: 3D lumps along the normal (no radial creases), a wide flared foot
    const lump = 0.07 * Math.sin(x * 5.3 + z * 2.1 + 1.3) * Math.sin(z * 4.7 - y * 3.9) + 0.04 * Math.sin(x * 11 - y * 9 + z * 7)
      + 0.025 * Math.sin(x * 23 + z * 19) * Math.sin(y * 21);
    const rr = Math.hypot(x, z), flare = Math.pow(1 - e, 5) * 0.24, k = 1 + lump * (0.6 + 0.4 * (1 - e));
    const R = 0.66 * rr * k + flare, H = 0.48 * Math.pow(e, 0.9) * (1 + lump * 1.2);
    p.setXYZ(i, Math.cos(ang) * R, Math.max(0, H), Math.sin(ang) * R);
    const grain = Math.sin(ang * 17 + e * 23) * Math.sin(ang * 7 - e * 11), crumbs = Math.pow(Math.max(0, Math.sin(ang * 41 + e * 37) * Math.sin(ang * 29 - e * 53)), 6);
    c.copy(dk).lerp(lt, 0.15 + 0.55 * Math.pow(e, 0.7) + 0.15 * grain + 0.3 * crumbs).offsetHSL(0.01 * grain, -0.05 * crumbs, 0);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  chompMesh(mound, geo, CHOMPER_MAT.dirt);
  // Clods scattered on the slopes and around the rim
  const clodGeo = new THREE.IcosahedronGeometry(1, 1), cp = clodGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) { const k = 1 + 0.18 * Math.sin(cp.getX(i) * 9 + cp.getY(i) * 7) * Math.sin(cp.getZ(i) * 8); cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k * 0.75, cp.getZ(i) * k); }
  clodGeo.computeVertexNormals();
  const clods = new THREE.InstancedMesh(clodGeo, CHOMPER_MAT.clod, 22), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 22; i++) {
    const ang = i * 2.399, rim = i % 3 !== 0, r = rim ? 0.78 + 0.16 * Math.sin(i * 5.3) : 0.25 + 0.3 * Math.abs(Math.sin(i * 3.1));
    const y = rim ? 0.03 : 0.5 * Math.pow(1 - r / 0.75, 0.8) * 0.9, s = 0.04 + 0.05 * Math.abs(Math.sin(i * 7.7));
    m.compose(chompV(Math.cos(ang) * r, y + s * 0.3, Math.sin(ang) * r), q.setFromEuler(e.set(i, i * 2.1, i * 0.7)), chompV(s, s, s));
    clods.setMatrixAt(i, m); clods.setColorAt(i, c.copy(dk).lerp(lt, 0.15 + 0.5 * Math.abs(Math.sin(i * 1.7))));
  }
  clods.castShadow = clods.receiveShadow = true; mound.add(clods);
  // Grass tufts: tapered blades fanned out of the soil
  const blades = [], bc = new THREE.Color(), g0 = new THREE.Color(0x3d7a24), g1 = new THREE.Color(0x9fd157);
  for (const [tx, tz, n] of [[0.42, 0.25, 6], [-0.35, 0.38, 5], [-0.12, -0.5, 6], [0.55, -0.32, 4]]) {
    const ty = 0.5 * Math.max(0, 1 - Math.hypot(tx, tz) / 0.75) * 0.95;
    for (let k = 0; k < n; k++) {
      const b = new THREE.ConeGeometry(0.016, 0.2 + 0.08 * Math.sin(k * 3 + tx * 9), 3, 3); b.translate(0, 0.1, 0);
      const bp = b.attributes.position, bcol = [];
      for (let i = 0; i < bp.count; i++) { const v = bp.getY(i) / 0.28; bp.setX(i, bp.getX(i) + v * v * 0.06); bc.lerpColors(g0, g1, v); bcol.push(bc.r, bc.g, bc.b); }
      b.setAttribute('color', new THREE.Float32BufferAttribute(bcol, 3));
      b.applyMatrix4(m.compose(chompV(tx, ty, tz), q.setFromEuler(e.set(0.35 * Math.cos(k * 2.3), k * 1.26 + tx * 5, 0.35 * Math.sin(k * 2.3))), chompV(1, 1, 1)));
      blades.push(b);
    }
  }
  const grass = mergeGeometries(blades); blades.forEach(b => b.dispose()); grass.computeVertexNormals();
  chompMesh(mound, grass, CHOMPER_MAT.grass);
  // Two of Chomper's leaf tips poke out of the top
  for (const [x, z, yaw] of [[0.12, 0.08, 0.5], [-0.14, -0.04, -2.4]]) {
    const leaf = chompMesh(mound, chompLeafGeo({ length: 0.42, width: 0.2, thick: 0.035, curl: -0.6, cup: 0.3 }), CHOMPER_MAT.leaf, [x, 0.36, z]);
    chompOrient(leaf, chompV(Math.sin(yaw) * 0.45, 1, Math.cos(yaw) * 0.45), chompV(-Math.sin(yaw), 0.3, -Math.cos(yaw)));
  }
  mound.visible = false;
  return mound;
}
// Goop muzzle splat: hidden by default, +Y along the shot (makeMuzzleFlash contract)
function chompSplat() {
  const g = new THREE.Group(), sphere = new THREE.SphereGeometry(1, 10, 8);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 9), CHOMPER_MAT.splat); cone.position.y = 0.17; g.add(cone);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, d = new THREE.Mesh(sphere, CHOMPER_MAT.splat);
    d.position.set(Math.cos(a) * 0.11, 0.08 + (i % 3) * 0.1, Math.sin(a) * 0.11); d.scale.setScalar(0.035 + (i % 2) * 0.02); g.add(d);
  }
  g.visible = false; return g;
}
// A swallowed zombie's sleeve and hand sticking out of the mouth corner (first second of chewing)
function chompSnack() {
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g); outer.userData.wiggle = g;
  const sleeve = new THREE.CylinderGeometry(0.07, 0.085, 0.36, 12, 4), sp = sleeve.attributes.position;
  for (let i = 0; i < sp.count; i++) if (sp.getY(i) > 0.17) sp.setY(i, sp.getY(i) + 0.03 * Math.sin(Math.atan2(sp.getZ(i), sp.getX(i)) * 5));
  sleeve.translate(0, 0.08, 0); sleeve.computeVertexNormals();
  chompMesh(g, sleeve, CHOMPER_MAT.sleeve);
  chompMesh(g, new THREE.SphereGeometry(1, 14, 10), CHOMPER_MAT.zombie, [0, 0.31, 0.0], [0.075, 0.07, 0.04]);
  chompMesh(g, new THREE.CylinderGeometry(0.04, 0.05, 0.08, 10), CHOMPER_MAT.zombie, [0, 0.25, 0]);
  for (let k = 0; k < 4; k++) {
    const f = chompMesh(g, new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), CHOMPER_MAT.zombie, [-0.05 + k * 0.033, 0.4, 0.012 * Math.sin(k)]);
    f.rotation.set(0.5 + k * 0.12, 0, (k - 1.5) * 0.12);
  }
  const thumb = chompMesh(g, new THREE.CapsuleGeometry(0.02, 0.06, 4, 8), CHOMPER_MAT.zombie, [0.075, 0.32, 0.02]); thumb.rotation.z = -0.9;
  outer.visible = false; return outer;
}

function buildChomper() {
  const M = CHOMPER_TUNING.model, root = new THREE.Group(), plant = new THREE.Group(); root.add(plant);
  // body pivots at the crown so leaning / bobbing rocks the whole upper plant over its feet
  const body = new THREE.Group(); body.position.y = 0.45; plant.add(body);
  const torso = new THREE.Group(); torso.position.y = -0.45; body.add(torso);
  chompMesh(torso, chompCrownGeo(), CHOMPER_MAT.stem);
  // Skirt: a calyx of cupped leaves hugging the crown, tips curling outward
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.3, out = chompV(Math.sin(a), 0, Math.cos(a));
    const leaf = chompMesh(torso, chompLeafGeo({ length: 0.5 + 0.08 * (i % 2), width: 0.36, thick: 0.045, curl: -1.2, cup: 0.4 }),
      CHOMPER_MAT.leaf, [out.x * 0.18, 0.4, out.z * 0.18 - 0.08]);
    chompOrient(leaf, out.clone().multiplyScalar(0.75).add(chompV(0, 0.66, 0)), out.clone().negate());
  }
  // Leaf feet: four sturdy, thick leaves splayed on the ground, toes curling up
  const legs = [];
  for (const [i, yaw] of [0.72, -0.72, Math.PI - 0.85, Math.PI + 0.85].entries()) {
    const hip = new THREE.Group(); hip.position.set(Math.sin(yaw) * 0.18, 0.3, Math.cos(yaw) * 0.18 - 0.08); plant.add(hip);
    const base = new THREE.Group(); hip.add(base);
    chompOrient(base, chompV(Math.sin(yaw), -0.62, Math.cos(yaw)), chompV(0, 1, 0));
    const lift = new THREE.Group(); base.add(lift);
    chompMesh(lift, chompLeafGeo({ length: i < 2 ? 0.86 : 0.76, width: 0.46, thick: 0.085, curl: 0.95, cup: 0.18, base: 0.22 }), CHOMPER_MAT.leaf);
    legs.push({ hip, lift, phase: i === 0 || i === 3 ? 0 : Math.PI, side: Math.sign(Math.sin(yaw)), front: i < 2 });
  }
  // Leaf arms from the neck base
  const fronds = [];
  for (const side of [-1, 1]) {
    const base = new THREE.Group(); base.position.set(side * 0.17, 0.7, -0.02); torso.add(base);
    chompOrient(base, chompV(side * 0.85, 0.3, 0.35), chompV(-side * 0.2, 0.35, 1));
    const pivot = new THREE.Group(); base.add(pivot);
    chompMesh(pivot, chompLeafGeo({ length: 1.08, width: 0.62, thick: 0.065, curl: -0.85, cup: 0.36, twist: side * 0.3 }), CHOMPER_MAT.leaf);
    // a smaller second blade fanned behind the arm makes a fuller, more expressive "hand"
    const back = chompMesh(pivot, chompLeafGeo({ length: 0.78, width: 0.4, thick: 0.05, curl: -0.9, cup: 0.3, twist: -side * 0.2 }), CHOMPER_MAT.leaf, [0, 0.02, -0.04]);
    back.rotation.set(-0.25, 0, side * 0.42);
    fronds.push({ pivot, side });
  }
  // Head: two hinged jaw lobes, throat, tongue and fangs
  const head = new THREE.Group(); head.position.set(...M.headRest); torso.add(head);
  const hz = -M.headLength / 2 + M.hingeInset;
  const jawUp = new THREE.Group(), jawLow = new THREE.Group(); jawUp.position.z = jawLow.position.z = hz; head.add(jawUp, jawLow);
  chompMesh(jawUp, chompJawGeo(1), CHOMPER_MAT.skin); jawUp.add(chompTeeth(1));
  chompMesh(jawLow, chompJawGeo(-1), CHOMPER_MAT.skin); jawLow.add(chompTeeth(-1));
  const web = chompMesh(head, chompWebGeo(), CHOMPER_MAT.skin); web.frustumCulled = false;
  const tongue = new THREE.Group(); tongue.position.set(0, -0.12, 0.26); jawLow.add(tongue);
  chompMesh(tongue, chompTongueGeo(), CHOMPER_MAT.tongue, [0, 0, 0.34]);
  // Calyx collar: small sepals cupping the head where the neck plugs in (dresses the back view)
  const collar = new THREE.Group(); collar.position.z = -hz; jawLow.add(collar);
  {
    const d = chompV(...M.neckAnchorDir).normalize(), e2 = chompV(0, d.z, -d.y), c = chompV(...M.neckAnchor).addScaledVector(d, -0.05);
    for (let i = 0; i < 5; i++) {
      const a = (i + 0.5) / 5 * Math.PI * 2, rad = chompV(Math.cos(a), 0, 0).addScaledVector(e2, Math.sin(a));
      const sep = chompMesh(collar, chompLeafGeo({ length: 0.34 + 0.06 * (i % 2), width: 0.3, thick: 0.04, curl: -1.2, cup: 0.42 }),
        CHOMPER_MAT.leaf, c.clone().addScaledVector(rad, 0.2).toArray());
      chompOrient(sep, d.clone().multiplyScalar(-0.8).addScaledVector(rad, 0.6), rad.clone().negate());
    }
  }
  const snack = chompSnack(); snack.position.set(0.22, -0.01, M.headLength / 2 - 0.22); snack.scale.setScalar(1.45);
  chompOrient(snack, chompV(0.45, -0.3, 0.85), chompV(0, 1, 0)); head.add(snack);
  // Neck tube (rebuilt every frame) and the two leaves that ride on it
  const neckRings = 30, neckSides = 18;
  const neck = chompMesh(torso, chompNeckGeo(neckRings, neckSides), CHOMPER_MAT.stem); neck.frustumCulled = false;
  const neckLeaves = [];
  for (const [ring, side, len] of [[11, 1, 0.42], [17, -1, 0.36]]) {
    const pivot = new THREE.Group(); torso.add(pivot);
    chompMesh(pivot, chompLeafGeo({ length: len, width: 0.22, thick: 0.035, curl: -0.9, cup: 0.3 }), CHOMPER_MAT.leaf);
    neckLeaves.push({ pivot, ring, side });
  }
  const mound = chompMound(); root.add(mound);
  // Goop spits from just in front of the closed mouth
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.02, M.headLength / 2 + 0.14); head.add(muzzle);
  const flash = chompSplat(); flash.position.copy(muzzle.position); flash.rotation.x = Math.PI / 2; head.add(flash);
  const arm = { muzzle, flash, recoil: 0, spinSpeed: 0, flashT: 0, side: 0 };
  const C = { root, plant, body, torso, head, jawUp, jawLow, web, tongue, collar, snack, neck, neckLeaves, neckRings, neckSides,
    neckP0: chompV(...M.neckBase), neckT0: chompV(...M.neckBaseDir).normalize(),
    neckAnchor: chompV(...M.neckAnchor).sub(jawLow.position), neckDir: chompV(...M.neckAnchorDir).normalize(),
    fronds, legs, mound, arms: [arm] };
  updateChompNeck(C); updateChompWeb(C);
  return C;
}

// ---- Animation ----
const _chFwd = new THREE.Vector3(), _chPos = new THREE.Vector3(), _chVel = new THREE.Vector3();
function chompDirt(h, n, speed, up, spread, life = 0.7) {
  const p = h.mesh.position, y = p.y - h.centerY + 0.12;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
    _chPos.set(p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r);
    _chVel.set(Math.cos(a) * speed * Math.random(), up * (0.5 + Math.random()), Math.sin(a) * speed * Math.random());
    if (i % 2) spawnParticle('chip', i % 4 === 1 ? 0x5a3b22 : 0x7a5634, _chPos, _chVel.clone(), { life: life * 0.8, size: 0.9 + Math.random() * 0.6, drag: 0.5 });
    else spawnParticle('puff', 0x8a6a48, _chPos, _chVel.clone().multiplyScalar(0.4), { life, gravity: -0.4, grow: 2, drag: 3 });
  }
}
function animateChomper(h, dt) {
  const C = h.corn, A = h.anim, M = CHOMPER_TUNING.model, N = CHOMPER_TUNING.anim;
  const c = h.chomp ||= { biteT: 9, chew: 0, gulpT: 9, burrowed: false, emergeT: 9, spitT: 9 };
  // "seconds since" timers are visual: gameplay resets them to 0, the animator advances them
  c.biteT += dt; c.gulpT += dt; c.spitT += dt; c.emergeT += dt;
  A.t += dt;
  const t = A.t, damp = 1 - Math.exp(-dt * 8);
  A.down = (A.down || 0) + ((h.downed ? 1 : 0) - (A.down || 0)) * (1 - Math.exp(-dt * 7));
  const a = C.arms[0]; a.recoil *= Math.exp(-dt * N.recoilRecovery); a.flashT -= dt;
  a.flash.visible = a.flashT > 0 && !h.downed;
  // Locomotion state
  const hv = Math.hypot(h.vel.x, h.vel.z), s = h.onGround && !h.downed ? Math.min(1.4, hv / h.stats.speed) : 0;
  const chewing = c.chew > 0;
  A.chewAge = chewing ? (A.chewAge || 0) + dt : 0;
  A.phase += dt * N.stride * s * (chewing ? 0.8 : 1);
  _chFwd.set(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
  A.leanF += ((h.vel.x * _chFwd.x + h.vel.z * _chFwd.z) / h.stats.speed - A.leanF) * damp;
  A.leanS += ((h.vel.x * -_chFwd.z + h.vel.z * _chFwd.x) / h.stats.speed - A.leanS) * damp;
  A.air += ((h.onGround ? 0 : 1) - A.air) * damp; A.squash *= Math.exp(-dt * 12);
  const ph = A.phase, breath = Math.sin(t * N.breathe);
  // Pose accumulators (head offsets in body space; pitch + = nose up)
  // idle: the trap breathes slightly apart so the wet mouth and tongue always show a sliver
  let openU = 0.1 + 0.05 * (0.5 + 0.5 * breath), openL = 0.04 + 0.02 * (0.5 + 0.5 * breath);
  let hx = 0, hy = breath * 0.022, hz = 0, pitch = N.restPitch + breath * 0.03, yaw = Math.sin(t * 0.43) * 0.07 * (1 - s), roll = Math.sin(t * 0.7) * 0.045;
  let puff = 0, squash = 0, smear = 0, tongueLift = Math.sin(t * 1.3) * 0.06, bulgeT = -1, bulge = 0;
  let bodyY = 0, bodyPitch = A.leanF * N.lean, bodyRoll = -A.leanS * N.lean * 0.6, frondFlare = 0;
  // Prowl: diagonal leaf-feet pairs, two heavy dips per stride, head jutting forward and panting
  bodyY += s * (N.bob * Math.abs(Math.cos(ph)) - 0.045);
  bodyRoll += Math.sin(ph) * 0.05 * s;
  hz += 0.12 * s; hy -= 0.03 * s; pitch -= 0.06 * s;
  openU += s * (0.1 + 0.06 * Math.sin(ph * 2)); openL += s * 0.04;
  yaw += Math.sin(ph) * 0.07 * s; roll -= Math.sin(ph) * 0.05 * s;
  // Idle lip-smack / jaw clack now and then
  A.smackIn = (A.smackIn ?? 2.5) - dt;
  if (A.smackIn < 0) { A.smackIn = randRange([2.8, 5.5]); A.smackT = 0; }
  A.smackT = (A.smackT ?? 9) + dt;
  const quiet = 1 - Math.min(1, s * 2);
  if (A.smackT < 0.6) {
    const u = A.smackT / 0.6;
    openU += quiet * (0.22 * chompBump(u, 0, 0.3) + 0.14 * chompBump(u, 0.38, 0.62) + 0.08 * chompBump(u, 0.7, 0.9));
    tongueLift += quiet * 0.25 * chompBump(u, 0, 0.5); pitch += quiet * 0.06 * chompBump(u, 0, 1);
  }
  // Bite: snap open wide (anticipation, rear back) → slam shut with a lunge (smear stretch) → squash → recover
  const bt = c.biteT;
  if (bt >= 0 && bt < N.biteTime) {
    let open, lunge;
    if (bt < 0.07) { open = chompOut(bt / 0.07); lunge = -0.1 * open; }
    else if (bt < 0.13) { const u = (bt - 0.07) / 0.06; open = 1 - u * u; lunge = -0.1 + (N.biteLunge + 0.1) * chompOut(u); smear = Math.sin(u * Math.PI) * 0.16; }
    else {
      const u = bt - 0.13; open = 0.06 * Math.max(0, Math.sin(u * 28)) * Math.exp(-u * 14);
      squash = 0.17 * Math.exp(-u * 13) * Math.cos(u * 34);
      lunge = N.biteLunge * (1 - chompSmooth(bt, 0.2, 0.4)) - 0.04 * chompBump(bt, 0.3, N.biteTime);
    }
    openU = THREE.MathUtils.lerp(openU, N.biteOpen, open); openL = THREE.MathUtils.lerp(openL, N.biteOpenLow, open);
    hz += lunge; hy -= Math.max(0, lunge) * 0.25; pitch += open * 0.18 - Math.max(0, lunge) * 0.3;
    bodyPitch += lunge * 0.3; frondFlare += Math.max(0, lunge) * 1.2 + open * 0.3; tongueLift += open * 0.22;
  }
  // Swallow: gape huge + lunge → snap shut → bulge rides down the stretched neck, head tipped back
  const gt = c.gulpT;
  if (gt >= 0 && gt < N.gulpTime) {
    let open = 0, lunge;
    if (gt < 0.25) { const u = gt / 0.25; open = chompOut(u * 1.4); lunge = N.gulpLunge * chompSmooth(u, 0, 1); pitch -= 0.25 * u; }
    else if (gt < 0.4) { const u = (gt - 0.25) / 0.15; open = 1 - u * u * u; lunge = N.gulpLunge * (1 - 0.6 * u); pitch -= 0.25 * (1 - u); squash = 0.12 * chompBump(u, 0.7, 1); }
    else {
      const u = (gt - 0.4) / (N.gulpTime - 0.4);
      lunge = N.gulpLunge * 0.4 * (1 - chompSmooth(u, 0, 0.6));
      bulgeT = 0.97 - u * 0.9; bulge = N.bulge * Math.pow(chompBump(u, -0.15, 1.05), 0.6);
      pitch += 0.5 * chompBump(u, -0.05, 1.1); hy += 0.16 * chompBump(u, 0, 1); puff += 0.1 * (1 - u);
      yaw += Math.sin(u * 22) * 0.06 * (1 - u);
    }
    openU = THREE.MathUtils.lerp(openU, N.gulpOpen, open); openL = THREE.MathUtils.lerp(openL, N.gulpOpenLow, open);
    hz += lunge; bodyPitch += lunge * 0.3; frondFlare += open * 0.8; tongueLift += open * 0.3;
  }
  // Chewing: puffed cheeks, ~3 Hz chomps, heavy head, the odd head shake
  if (chewing) {
    const cw = Math.sin(A.chewAge * Math.PI * 2 * N.chewRate), shake = A.chewAge % 1.4;
    openU = 0.03 + 0.13 * Math.max(0, cw); openL = 0.02 + 0.05 * Math.max(0, cw);
    puff += N.chewPuff + 0.035 * cw; hy -= 0.04 + 0.025 * Math.max(0, -cw); pitch += 0.05 * cw - 0.04;
    if (shake < 0.4) yaw += Math.sin(shake * 40) * 0.16 * chompBump(shake, 0, 0.4);
    bodyY -= 0.04;
  }
  C.snack.visible = chewing && A.chewAge < N.snackTime && !h.downed;
  if (C.snack.visible) C.snack.userData.wiggle.rotation.set(Math.sin(t * 11) * 0.1, 0, Math.sin(t * 17) * 0.14);
  // Goop spit: rear back with puffed cheeks, then thrust and spit
  const st = c.spitT;
  if (st >= 0 && st < N.spitTime) {
    const u = st / N.spitTime, rear = chompBump(u, 0, 0.5), thrust = chompBump(u, 0.38, 1);
    hz += -0.17 * rear + 0.24 * thrust; pitch += 0.28 * rear - 0.12 * thrust; puff += 0.16 * rear;
    openU += 0.34 * chompBump(u, 0.42, 0.78); openL += 0.12 * chompBump(u, 0.42, 0.78);
    bodyPitch += -0.07 * rear + 0.06 * thrust;
  }
  hz -= a.recoil * 0.08; pitch += a.recoil * 0.05;
  // Aim: pitch the head (the neck follows); a zoomed Chomper steadies and lowers its head
  pitch += h.aimElev * 0.85; hy -= h.zoom * 0.05;
  // Burrow: dive (head tucks, plant sinks out of sight) → only the mound; emerge mouth-first from below
  let sink = 0, mound = 0, burst = 0, stretch = 0;
  if (c.burrowed && !h.downed) {
    A.dive = Math.min(1, (A.dive || 0) + dt / N.diveTime);
    const d = A.dive; sink = Math.pow(d, 1.7) - 0.05 * chompBump(d, 0, 0.35);
    pitch -= 0.8 * Math.min(1, d * 2.5); openU *= 1 - d; hz -= 0.15 * d; stretch += 0.1 * chompBump(d, 0.1, 1);
    mound = chompBack(d * 1.3 - 0.15);
    if (dt > 0 && d >= 0.5 && !A.diveBurst) { A.diveBurst = true; chompDirt(h, 10, 3, 3, 0.6); }
    A.emergeBurst = false;
  } else if (c.emergeT >= 0 && c.emergeT < N.emergeTime && !h.downed) {
    A.dive = 0; A.diveBurst = false;
    const e = c.emergeT, u = Math.min(1, e / 0.22);
    sink = (1 - u) * (1 - u);
    const open = e < 0.22 ? chompOut(e / 0.08) : 1 - chompSmooth(e, 0.22, 0.3);
    openU = THREE.MathUtils.lerp(openU, N.biteOpen * 1.05, open); openL = THREE.MathUtils.lerp(openL, N.biteOpenLow, open);
    pitch += 0.4 * (1 - chompSmooth(e, 0.1, 0.35)); stretch += 0.16 * chompBump(e, 0, 0.26);
    squash += 0.16 * chompBump(e, 0.26, 0.45) - 0.05 * chompBump(e, 0.42, 0.6);
    frondFlare += 1.2 * chompBump(e, 0.05, 0.5);
    mound = 1 - chompSmooth(e, 0.04, 0.26); burst = chompSmooth(e, 0, 0.22) * 0.9;
    if (dt > 0 && !A.emergeBurst) { A.emergeBurst = true; chompDirt(h, 18, 5, 6, 0.7, 0.9); }
  } else {
    A.dive = Math.max(0, (A.dive || 0) - dt * 3); sink = A.dive * A.dive; mound = A.dive;
    A.diveBurst = false; if (c.emergeT >= N.emergeTime) A.emergeBurst = false;
  }
  C.plant.position.y = -sink * M.burrowDepth;
  C.plant.visible = sink < 0.995;
  C.mound.visible = mound > 0.01;
  if (C.mound.visible) {
    const rumble = Math.sin(t * 37) * Math.sin(t * 23) * (0.3 + s);
    C.mound.scale.set(mound * (1 + burst + 0.04 * rumble), mound * (1 - burst * 0.8 + 0.07 * Math.sin(t * 13)), mound * (1 + burst + 0.04 * rumble));
    C.mound.position.y = rumble * 0.012;
    C.mound.rotation.x = A.leanF * 0.2 + Math.sin(t * 19) * 0.03 * s;
    C.mound.rotation.z = -A.leanS * 0.2 + Math.sin(t * 29) * 0.03 * s;
    if (dt > 0 && c.burrowed && hv > 1 && A.dive >= 1) {
      A.dirtT = (A.dirtT || 0) - dt;
      if (A.dirtT <= 0) {
        A.dirtT = 0.06;
        const p = h.mesh.position, side = Math.random() < 0.5 ? -1 : 1;
        _chPos.set(p.x - _chFwd.x * 0.5 - _chFwd.z * side * 0.6, p.y - h.centerY + 0.15, p.z - _chFwd.z * 0.5 + _chFwd.x * side * 0.6);
        spawnParticle(Math.random() < 0.5 ? 'puff' : 'chip', Math.random() < 0.5 ? 0x7a5634 : 0x5a3b22, _chPos,
          new THREE.Vector3(-_chFwd.x * 2 - _chFwd.z * side * 1.5, 2 + Math.random() * 2, -_chFwd.z * 2 + _chFwd.x * side * 1.5),
          { life: 0.6, gravity: 9, grow: 1.2, size: 0.9, drag: 2 });
      }
    }
  }
  // Downed: slumped, jaws slack, tongue lolling, leaves drooping (the juice layer topples the root)
  const dw = A.down;
  if (dw > 0.001) {
    const k = dw, L = THREE.MathUtils.lerp;
    openU = L(openU, 0.42, k); openL = L(openL, 0.26, k); pitch = L(pitch, -0.55, k); hy = L(hy, -0.38, k); hz = L(hz, 0.05, k);
    yaw = L(yaw, 0.25, k); roll = L(roll, 0.35, k); tongueLift = L(tongueLift, -0.5, k); bodyY = L(bodyY, -0.08, k);
    puff *= 1 - k; squash *= 1 - k; smear *= 1 - k; frondFlare = L(frondFlare, -0.6, k);
  }
  // Head on a flexible neck: follow-through spring on the body's bob and lunge
  const lag = A.lag ||= { y: 0, vy: 0, z: 0, vz: 0 };
  if (dt > 0) {
    lag.vy += ((bodyY - lag.y) * N.lagK - lag.vy * N.lagD) * dt; lag.y += lag.vy * dt;
    lag.vz += ((A.leanF * 0.1 - lag.z) * N.lagK * 0.6 - lag.vz * N.lagD) * dt; lag.z += lag.vz * dt;
  }
  hy += (lag.y - bodyY) * 1.3; pitch -= lag.vy * 0.05; hz -= (lag.z - A.leanF * 0.1) * 1.5;
  // Apply
  C.body.position.y = 0.45 + bodyY; C.body.rotation.set(bodyPitch, 0, bodyRoll);
  C.head.position.set(M.headRest[0] + hx, M.headRest[1] + hy, M.headRest[2] + hz);
  C.head.rotation.set(-pitch, yaw, roll, 'YXZ');
  C.head.scale.set(1 + puff + squash * 0.6 - smear * 0.3, 1 + puff * 0.55 - squash, 1 - puff * 0.12 + smear - squash * 0.3);
  C.jawUp.rotation.x = -openU; C.jawLow.rotation.x = openL;
  updateChompWeb(C);
  C.tongue.rotation.x = -tongueLift;
  updateChompNeck(C, bulgeT, bulge);
  for (const f of C.fronds) {
    const sw = Math.sin(ph + (f.side > 0 ? 0 : Math.PI));
    f.pivot.rotation.x = breath * 0.05 + sw * 0.1 * s - A.air * 0.4 + frondFlare * 0.35 + Math.sin(t * 2.1 + f.side) * 0.03;
    f.pivot.rotation.z = f.side * (sw * 0.45 * s - A.leanF * 0.25 - frondFlare * 0.2);
  }
  for (const l of C.legs) {
    const sw = Math.sin(ph + l.phase), lift = Math.max(0, Math.cos(ph + l.phase));
    l.lift.rotation.x = lift * 0.45 * s + A.air * 0.35 - dw * 0.2;
    l.hip.rotation.y = -l.side * sw * 0.3 * s;
  }
  // Squash & stretch of the whole plant (jumps, landings, burrow / emerge)
  const air = THREE.MathUtils.clamp(h.vel.y * 0.009, -0.06, 0.09) * A.air - A.squash + stretch - squash * 0.25;
  C.root.scale.set(1 - air * 0.4, 1 + air, 1 - air * 0.4);
}

// ---- Goop ball projectile: a wobbly, glossy purple blob (2 meshes) ----
const CHOMP_GOOP_MAT = {
  goo: new THREE.MeshPhysicalMaterial({ color: 0x8a34c8, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
    sheen: 0.6, sheenColor: 0xe0a0ff, emissive: 0x3a0a5a, emissiveIntensity: 0.6 }),
  bubble: new THREE.MeshPhysicalMaterial({ color: 0xc58af0, roughness: 0.08, clearcoat: 1, emissive: 0x4a1470, emissiveIntensity: 0.5 }),
};
function buildGoopBall() {
  const root = new THREE.Group(), geo = new THREE.SphereGeometry(0.17, 28, 20), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.12 * Math.sin(x * 31 + 1) * Math.sin(y * 27) + 0.08 * Math.sin(z * 37 + y * 11) - (y < -0.1 ? 0 : 0);
    p.setXYZ(i, x * k, y * k + (y < 0 ? 0.25 * y * y / 0.17 : 0), z * k);
  }
  geo.computeVertexNormals();
  chompMesh(root, geo, CHOMP_GOOP_MAT.goo);
  const bubbles = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.SphereGeometry(0.03 + 0.012 * (i % 3), 10, 8), a = i * 2.4, e = Math.sin(i * 1.7) * 0.9;
    b.translate(Math.cos(a) * Math.cos(e) * 0.165, Math.sin(e) * 0.165, Math.sin(a) * Math.cos(e) * 0.165); bubbles.push(b);
  }
  chompMesh(root, mergeGeometries(bubbles), CHOMP_GOOP_MAT.bubble); bubbles.forEach(b => b.dispose());
  return root;
}
// Optional in-flight wobble (t = seconds alive)
function animateGoopBall(ball, t) {
  const w = Math.sin(t * 26) * 0.08;
  ball.scale.set(1 + w, 1 - w, 1 + w * 0.5); ball.rotation.y = t * 3;
}

// ---- Spikeweed trap: a low weed of sharp green → purple spikes around a dark core (3 meshes) ----
const SPIKEWEED_MAT = {
  spike: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  core: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7 }),
};
const SPIKEWEED_GEO = (() => {
  const g = new THREE.CylinderGeometry(0, 1, 1, 8, 8, true); g.translate(0, 0.5, 0);
  const p = g.attributes.position, col = [], base = new THREE.Color(0x3f7f22), mid = new THREE.Color(0x8bbf3a), tip = new THREE.Color(0x8a3fb8), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), bulge = 1 + 0.35 * Math.sin(Math.min(1, y * 1.6) * Math.PI) * (1 - y); p.setXYZ(i, p.getX(i) * bulge + 0.3 * y * y, y, p.getZ(i) * bulge * 0.8);
    if (y < 0.5) c.lerpColors(base, mid, y * 2); else c.lerpColors(mid, tip, Math.pow((y - 0.5) * 2, 0.8));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
})();
function buildSpikeweed() {
  const root = new THREE.Group(), data = [];
  // dark knobbly core + a flat leaf rosette (one mesh)
  const coreGeo = new THREE.SphereGeometry(1, 28, 16), cp = coreGeo.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), k = 1 + 0.12 * Math.sin(x * 9) * Math.sin(z * 8 + y * 5);
    cp.setXYZ(i, x * 0.27 * k, Math.max(-0.2, y) * 0.17 * k + 0.08, z * 0.27 * k);
    c.setHex(0x2a3d1a).lerp(new THREE.Color(0x4a2a5a), 0.5 + 0.5 * y); col.push(c.r, c.g, c.b);
  }
  coreGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); coreGeo.computeVertexNormals();
  const leaves = [coreGeo];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, leaf = chompLeafGeo({ length: 0.42, width: 0.2, thick: 0.03, curl: 0.3, cup: 0.2, dark: 0x234f17, light: 0x5d9a2c });
    leaf.deleteAttribute('zone');
    const o = new THREE.Object3D(); o.position.set(Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.1);
    chompOrient(o, chompV(Math.sin(a), -0.08, Math.cos(a)), chompV(0, 1, 0)); o.updateMatrix(); leaves.push(leaf.applyMatrix4(o.matrix));
  }
  coreGeo.deleteAttribute('uv');
  const coreMerged = mergeGeometries(leaves);
  coreMerged.computeVertexNormals();
  const core = chompMesh(root, coreMerged, SPIKEWEED_MAT.core);
  // spikes in three rings: low outer splay, mid, near-upright centre
  for (const [n, r, pitch, len, rad, off] of [[9, 0.2, 1.28, 0.42, 0.06, 0], [7, 0.14, 0.88, 0.36, 0.055, 0.5], [4, 0.06, 0.38, 0.32, 0.05, 0.25]]) {
    for (let i = 0; i < n; i++) {
      const yaw = (i + off) / n * Math.PI * 2, j = Math.sin(i * 7.3 + n) * 0.5 + 0.5;
      data.push({ yaw, r, pitch: pitch + (j - 0.5) * 0.18, len: len * (0.85 + 0.3 * j), rad: rad * (0.85 + 0.3 * j), seed: i * 1.7 + n });
    }
  }
  const spikes = new THREE.InstancedMesh(SPIKEWEED_GEO, SPIKEWEED_MAT.spike, data.length);
  spikes.castShadow = spikes.receiveShadow = true; spikes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(spikes);
  const sw = { root, core, spikes, data, clench: 0 };
  animateSpikeweed(sw, 0, false, 0);
  return sw;
}
const _swM = new THREE.Matrix4(), _swQ = new THREE.Quaternion(), _swE = new THREE.Euler(), _swP = new THREE.Vector3(), _swS = new THREE.Vector3();
function animateSpikeweed(sw, t, holding, dt) {
  sw.clench += ((holding ? 1 : 0) - sw.clench) * (1 - Math.exp(-dt * 14));
  const k = sw.clench, breath = Math.sin(t * 2.2);
  sw.data.forEach((d, i) => {
    const wiggle = k * (Math.sin(t * 24 + d.seed) * 0.12 + Math.sin(t * 37 + d.seed * 2) * 0.06);
    const pitch = d.pitch * (1 - 0.5 * k) + breath * 0.04 + wiggle;
    _swP.set(Math.sin(d.yaw) * d.r, 0.08, Math.cos(d.yaw) * d.r);
    _swQ.setFromEuler(_swE.set(pitch, d.yaw + wiggle * 0.5, 0, 'YXZ'));
    const l = d.len * (1 + 0.18 * k + breath * 0.02);
    sw.spikes.setMatrixAt(i, _swM.compose(_swP, _swQ, _swS.set(d.rad, l, d.rad)));
  });
  sw.spikes.instanceMatrix.needsUpdate = true;
  sw.core.scale.set(1 + breath * 0.02 + k * 0.05, 1 - k * 0.1, 1 + breath * 0.02 + k * 0.05);
}

// ---- Lab poses (render harness) ----
const chompLab = (extra, frames = 60) => ({
  frames, setup(h) { h.chomp = { biteT: 9, chew: 0, gulpT: 9, burrowed: false, emergeT: 9, spitT: 9, ...extra }; },
});
const CHOMPER_LAB = {   // render poses for tests/plant-models.cjs
  type: 'chomper', build: buildChomper, animate: animateChomper, stats: { hp: 175, speed: 9.5 },
  poses: {
    idle: { frames: 100, setup(h) {
      h.chomp = { biteT: 9, chew: 0, gulpT: 9, burrowed: false, emergeT: 9, spitT: 9 };
      let meshes = 0, tris = 0;
      h.corn.root.traverse(o => {
        if (!o.isMesh) return;
        meshes++;
        const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        tris += n * (o.isInstancedMesh ? o.count : 1);
      });
      console.log(`chomper: ${meshes} meshes, ${Math.round(tris)} triangles after bakeRig`);
    } },
    run: { frames: 46, setup(h) { h.chomp = undefined; h.vel.set(0, 0, -9.5); } },
    biteOpen: chompLab({ biteT: 0.065 - 1 }),
    biteShut: chompLab({ biteT: 0.16 - 1 }),
    gulp: chompLab({ gulpT: 0.55 - 1 }),
    chew: chompLab({ chew: 3 }, 30),
    spit: chompLab({ spitT: 0.1 - 1 }),
    burrowed: { frames: 40, setup(h) { h.chomp = { biteT: 9, chew: 0, gulpT: 9, burrowed: true, emergeT: 9, spitT: 9 }; h.vel.set(0, 0, -8); } },
    emerge: chompLab({ emergeT: 0 }, 9),
    downed: { frames: 90, setup(h) { h.chomp = undefined; h.downed = true; } },
    spikeweed: { frames: 60, setup(h) {
      h.chomp = undefined;
      if (h.labSpike) h.mesh.remove(h.labSpike.root);
      const s = buildSpikeweed(); s.root.position.set(1.6, -h.centerY, 0.5); h.mesh.add(s.root); h.labSpike = s;
    }, step(h, f) { animateSpikeweed(h.labSpike, f / 60, f > 30, 1 / 60); } },
  },
};

export { buildChomper, animateChomper, buildGoopBall, buildSpikeweed, animateSpikeweed, CHOMPER_LAB };
