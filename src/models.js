import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintFace } from './looks.js';
import { makeHuman } from './rig.js';

// Characters are modelled in code: smooth lofted bodies and limbs, a painted face + shirt texture per friend,
// and separate rigid segments (torso, head, upper/lower arms and legs) so they can bend at elbows and knees.
// Every segment of one character is a single merged mesh sharing one material => ~10 draw calls per hero.

const V3 = THREE.Vector3;
const PI = Math.PI;
const WHITE = [0.75, 0.0625];                 // a white pixel in the atlas: vertex colour shows through unchanged
const HEAD_RECT = [0, 0.5, 1, 1];             // atlas regions as [u0, v0, u1, v1]
const TORSO_RECT = [0, 0.125, 1, 0.5];
const SWATCH_RECT = [0, 0, 0.25, 0.125];
const _c = new THREE.Color();

const SPH = new THREE.SphereGeometry(1, 16, 12);
const SPH_LO = new THREE.SphereGeometry(1, 8, 6);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PLANE = new THREE.PlaneGeometry(1, 1);
const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const cylGeo = (top = 1, segs = 12) => cached(`cy${top}_${segs}`, () => new THREE.CylinderGeometry(top, 1, 1, segs));
const capGeo = (len) => cached(`cap${len}`, () => new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, len * PI));
const torusGeo = (tube, segs = 18) => cached(`to${tube}_${segs}`, () => new THREE.TorusGeometry(1, tube, 6, segs));

function xf(x = 0, y = 0, z = 0, ax = 0, ay = 0, az = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(ax, ay, az)), new V3(sx, sy, sz));
}

// Tube through a stack of elliptical rings (ascending y). Each ring: { y, rx, rz, c, x, z }
function loft(rings, segs = 12) {
  const n = rings.length, cols = segs + 1, pos = [], uv = [], col = [], idx = [];
  const y0 = rings[0].y, y1 = rings[n - 1].y;
  for (let i = 0; i < n; i++) {
    const r = rings[i]; _c.set(r.c ?? 0xffffff);
    const v = (r.y - y0) / (y1 - y0 || 1);
    for (let j = 0; j <= segs; j++) {
      const u = j / segs, a = u * PI * 2;
      pos.push((r.x || 0) - r.rx * Math.cos(a), r.y, (r.z || 0) + r.rz * Math.sin(a)); uv.push(u, v); col.push(_c.r, _c.g, _c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; idx.push(a, b, c, b, d, c); }
  for (const top of [false, true]) { // end caps
    const r = rings[top ? n - 1 : 0], base = (top ? n - 1 : 0) * cols, ci = pos.length / 3;
    _c.set(r.c ?? 0xffffff); pos.push(r.x || 0, r.y, r.z || 0); uv.push(0.75, top ? 1 : 0); col.push(_c.r, _c.g, _c.b);
    for (let j = 0; j < segs; j++) { if (top) idx.push(ci, base + j, base + j + 1); else idx.push(ci, base + j + 1, base + j); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const nm = g.attributes.normal; // weld the seam so shading is continuous
  for (let i = 0; i < n; i++) {
    const a = i * cols, b = a + segs, x = nm.getX(a) + nm.getX(b), y = nm.getY(a) + nm.getY(b), z = nm.getZ(a) + nm.getZ(b), l = Math.hypot(x, y, z) || 1;
    nm.setXYZ(a, x / l, y / l, z / l); nm.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// profile [[y, r], ...] + colour segments [{ to, c, m }] => rings with hard colour edges (sleeves, shorts, socks)
function bands(profile, segs, zMul = 1) {
  const ymin = profile[0][0], ymax = profile[profile.length - 1][0];
  const ys = new Set(profile.map((p) => p[0]));
  for (const s of segs) if (s.to > ymin && s.to < ymax) ys.add(s.to);
  const rAt = (y) => {
    for (let i = 1; i < profile.length; i++) if (y <= profile[i][0]) { const [ya, ra] = profile[i - 1], [yb, rb] = profile[i]; return ra + (rb - ra) * (y - ya) / (yb - ya); }
    return profile[profile.length - 1][1];
  };
  const rings = [], mk = (y, s) => { const r = rAt(y) * (s.m || 1); rings.push({ y, rx: r, rz: r * zMul, c: s.c }); };
  for (const y of [...ys].sort((a, b) => a - b)) {
    const below = segs.find((s) => y <= s.to) || segs[segs.length - 1], above = segs.find((s) => y < s.to) || segs[segs.length - 1];
    mk(y, below); if (above !== below) mk(y, above);
  }
  return rings;
}

// Part builder: collects coloured shapes and merges them into one mesh.
class PB {
  constructor() { this.geos = []; this.base = null; }
  add(geo, color, m, uvRect) {
    const g = geo.clone();
    if (m) g.applyMatrix4(m);
    if (this.base) g.applyMatrix4(this.base);
    const n = g.attributes.position.count;
    if (color != null) {
      _c.set(color); const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    const uv = g.attributes.uv;
    if (!uvRect) for (let i = 0; i < n; i++) uv.setXY(i, WHITE[0], WHITE[1]);
    else for (let i = 0; i < n; i++) uv.setXY(i, uvRect[0] + uv.getX(i) * (uvRect[2] - uvRect[0]), uvRect[1] + uv.getY(i) * (uvRect[3] - uvRect[1]));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    this.geos.push(g); return this;
  }
  sphere(c, rx, ry, rz, x, y, z, ax, ay, az) { return this.add(SPH, c, xf(x, y, z, ax, ay, az, rx, ry, rz)); }
  ball(c, r, x, y, z) { return this.add(SPH_LO, c, xf(x, y, z, 0, 0, 0, r, r, r)); }
  box(c, w, h, d, x, y, z, ax, ay, az) { return this.add(BOX, c, xf(x, y, z, ax, ay, az, w, h, d)); }
  cyl(c, r, h, x, y, z, ax, ay, az, top = 1, segs = 12) { return this.add(cylGeo(top, segs), c, xf(x, y, z, ax, ay, az, r, h, r)); }
  cap(c, len, rx, ry, rz, x, y, z, ax, ay, az) { return this.add(capGeo(len), c, xf(x, y, z, ax, ay, az, rx, ry, rz)); }
  torus(c, R, tube, x, y, z, ax, ay, az, segs = 18, sy = 1) { return this.add(torusGeo(+(tube / R).toFixed(3), segs), c, xf(x, y, z, ax, ay, az, R, R * sy, R)); }
  loft(rings, segs, m, uvRect) { return this.add(loft(rings, segs), null, m, uvRect); }
  mesh(material) { const g = mergeGeometries(this.geos); for (const x of this.geos) x.dispose(); return new THREE.Mesh(g, material); }
}

// ---- materials ---------------------------------------------------------------
let gradient = null;
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([120, 175, 225, 255]), 4, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
  }
  return gradient;
}
let plain = null;
export function plainMat() { return plain || (plain = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() })); }
const charMats = new Map();
function charMat(L) {
  if (!charMats.has(L)) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 1024, 1024);
    paintFace(x, L);
    x.save(); x.beginPath(); x.rect(0, 512, 1024, 384); x.clip(); L.paintTorso(x); x.restore();
    if (L.swatch) { x.save(); x.beginPath(); x.rect(0, 896, 256, 128); x.clip(); L.swatch(x); x.restore(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    charMats.set(L, new THREE.MeshToonMaterial({ map: tex, vertexColors: true, gradientMap: toonGradient() }));
  }
  return charMats.get(L);
}

// legacy flat materials for simple props / fx
const mats = new Map();
export function mat(c, basic = false) {
  const k = c + (basic ? 'b' : '');
  if (!mats.has(k)) mats.set(k, basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }));
  return mats.get(k);
}

// ---- weapons: origin = the hand, pointing along -Y (the forearm); -Z is "up" when the arm is level -------------
function weaponInto(p, kind) {
  switch (kind) {
    case 'pistol':
      p.box(0x2a2a30, 0.046, 0.21, 0.062, 0, -0.1, -0.035); p.box(0x1a1a1e, 0.03, 0.05, 0.03, 0, -0.22, -0.04); p.box(0x1e1e22, 0.042, 0.055, 0.1, 0, -0.015, 0.03, 0.2);
      p.box(0x3a3a42, 0.048, 0.08, 0.012, 0, -0.1, -0.069); p.ball(0xff3b30, 0.012, 0, -0.2, -0.072);
      break;
    case 'club':
      p.cyl(0x1b2a4a, 0.017, 0.24, 0, -0.04, 0); p.cyl(0xd4d7dd, 0.0095, 0.8, 0, -0.52, 0, 0, 0, 0, 0.8);
      p.sphere(0xb9bec6, 0.022, 0.05, 0.085, 0, -0.93, -0.055, 0.25); p.box(0x8d939c, 0.012, 0.085, 0.13, 0, -0.935, -0.06, 0.25);
      break;
    case 'fists':
      p.sphere(0xd62828, 0.08, 0.092, 0.082, 0, -0.005, 0); p.sphere(0xb81f1f, 0.032, 0.045, 0.036, 0.055, 0.0, -0.04); p.cyl(0xf4f4f4, 0.062, 0.05, 0, 0.085, 0);
      break;
    case 'laptop':
      p.box(0x3b4050, 0.42, 0.29, 0.018, 0, -0.12, -0.02); p.box(0x23262f, 0.36, 0.17, 0.004, 0, -0.1, -0.031);
      p.box(0x3b4050, 0.42, 0.018, 0.27, 0, -0.262, -0.155); p.add(PLANE, 0x39ff88, xf(0, -0.251, -0.155, -PI / 2, 0, 0, 0.38, 0.23, 1));
      p.box(0x25e6ff, 0.43, 0.022, 0.012, 0, -0.262, -0.295); p.box(0xff2bd6, 0.012, 0.29, 0.02, 0.214, -0.12, -0.02); p.box(0x25e6ff, 0.012, 0.29, 0.02, -0.214, -0.12, -0.02);
      break;
    case 'slingshot':
      p.cyl(0x8a5a2b, 0.015, 0.17, 0, 0, -0.05, PI / 2); p.cyl(0x8a5a2b, 0.012, 0.13, -0.04, 0, -0.18, PI / 2, 0, 0.35); p.cyl(0x8a5a2b, 0.012, 0.13, 0.04, 0, -0.18, PI / 2, 0, -0.35);
      p.box(0xd62828, 0.13, 0.008, 0.01, 0, 0.03, -0.235); p.box(0x5a3a22, 0.035, 0.012, 0.03, 0, 0.045, -0.235);
      break;
    case 'sticks':
      p.cyl(0xe2c48e, 0.009, 0.4, 0, -0.15, 0, 0, 0, 0, 0.7); p.ball(0xe2c48e, 0.015, 0, -0.35, 0);
      p.cyl(0xe2c48e, 0.009, 0.4, 0.04, -0.14, -0.02, 0.25, 0, 0.3, 0.7); p.ball(0xe2c48e, 0.015, 0.093, -0.325, -0.066);
      break;
    case 'tambourine':
      p.torus(0xb8793a, 0.125, 0.02, 0, -0.1, 0, 0, PI / 2, 0); p.cyl(0xf3ead2, 0.118, 0.008, 0, -0.1, 0, 0, 0, PI / 2);
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; p.cyl(0xdadde2, 0.024, 0.008, 0, -0.1 + Math.sin(a) * 0.125, Math.cos(a) * 0.125, 0, 0, PI / 2); }
      break;
    case 'can':
      p.cyl(0x39d353, 0.034, 0.125, 0, 0, -0.03, PI / 2); p.cyl(0x111111, 0.0345, 0.04, 0, 0, -0.03, PI / 2); p.cyl(0xcfd3d8, 0.029, 0.006, 0, 0, -0.095, PI / 2); p.cyl(0xcfd3d8, 0.029, 0.006, 0, 0, 0.035, PI / 2);
      break;
    case 'launcher':
      p.cyl(0x7b4fa3, 0.06, 0.44, 0, -0.16, -0.03); p.cyl(0xf2c14e, 0.078, 0.07, 0, -0.385, -0.03); p.cyl(0x2ec4b6, 0.066, 0.05, 0, 0.06, -0.03);
      p.box(0xe84a5f, 0.05, 0.05, 0.05, 0.015, -0.43, -0.03, 0.5, 0.4); p.ball(0x2ec4b6, 0.03, -0.03, -0.425, -0.05); p.box(0x4a2f66, 0.035, 0.05, 0.1, 0, -0.02, 0.03, 0.2);
      p.cyl(0xf2c14e, 0.064, 0.02, 0, -0.16, -0.03);
      break;
    case 'knife':
      p.cyl(0x1b1b1f, 0.015, 0.11, 0, -0.01, 0); p.box(0xbfc5cc, 0.055, 0.012, 0.022, 0, -0.07, 0); p.box(0xe6ebf0, 0.007, 0.19, 0.036, 0, -0.17, 0);
      p.add(cylGeo(0, 4), 0xe6ebf0, xf(0, -0.295, 0, PI, PI / 4, 0, 0.005, 0.06, 0.0255));
      break;
  }
}

// ---- hair / hats ---------------------------------------------------------------
const R = 0.2, HY = 0.2; // head radius and centre height above the neck pivot
const hcap = (p, c, len, tilt, s) => p.cap(c, len, R * s, R * 1.075 * s, R * s, 0, HY, 0, tilt, 0, 0);
function golden(n, maxTheta, fn) { for (let i = 0; i < n; i++) { const t = Math.acos(1 - (1 - Math.cos(maxTheta)) * (i + 0.5) / n), a = i * 2.39996; fn(Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a), i); } }
const HAIR = {
  under(p, c) { hcap(p, c, 0.6, 0.55, 1.035); },
  short(p, c) { hcap(p, c, 0.5, 0.5, 1.045); p.sphere(c, 0.15, 0.05, 0.1, 0, HY + 0.17, -0.07); },
  part(p, c) { hcap(p, c, 0.5, 0.52, 1.05); p.sphere(c, 0.13, 0.055, 0.1, 0.045, HY + 0.175, -0.09, 0, 0, -0.25); p.sphere(c, 0.07, 0.04, 0.09, -0.11, HY + 0.15, -0.08, 0, 0, 0.5); },
  tousled(p, c) {
    hcap(p, c, 0.5, 0.5, 1.05);
    for (const [x, y, z, s] of [[0, 0.2, -0.1, 0.09], [0.08, 0.2, -0.06, 0.08], [-0.08, 0.2, -0.07, 0.08], [0.03, 0.22, 0.02, 0.09], [-0.05, 0.21, 0.04, 0.085], [0.1, 0.17, 0.03, 0.07], [-0.11, 0.17, 0.0, 0.07], [0.04, 0.19, -0.14, 0.06]]) p.sphere(c, s, s * 0.6, s, x, HY + y, z);
  },
  curly(p, c) {
    hcap(p, c, 0.55, 0.5, 1.03);
    const tilt = 0.45, ct = Math.cos(tilt), st = Math.sin(tilt);
    golden(34, 1.75, (x, y, z, i) => { const yy = y * ct - z * st, zz = y * st + z * ct; if (zz < -0.55 && yy < 0.55) return; const r = 0.05 + (i % 3) * 0.008; p.ball(c, r, x * R * 1.08, HY + yy * R * 1.12, zz * R * 1.08); });
  },
  wolf(p, c) {
    hcap(p, c, 0.56, 0.5, 1.06);
    for (const [x, s] of [[-0.12, 0.3], [-0.06, 0.12], [0, -0.05], [0.07, -0.15], [0.13, -0.32]]) p.sphere(c, 0.045, 0.085, 0.03, x, HY + 0.105, -0.175 - Math.abs(x) * -0.25, 0.15, 0, s); // shaggy fringe
    for (let i = 0; i < 9; i++) { const a = -1.5 + i * 0.375; p.sphere(c, 0.04, 0.13, 0.04, Math.sin(a) * 0.175, HY - 0.15, Math.cos(a) * 0.16 + 0.01, -0.25 * Math.cos(a), 0, 0.25 * Math.sin(a)); } // long at the nape
    for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43; p.sphere(c, 0.05, 0.09, 0.045, Math.sin(a) * 0.2, HY - 0.03, Math.cos(a) * 0.19, 0, 0, 0); } // layers
    p.sphere(c, 0.03, 0.09, 0.05, 0.197, HY - 0.03, -0.045); p.sphere(c, 0.03, 0.09, 0.05, -0.197, HY - 0.03, -0.045);
    for (const [x, y, z] of [[0.04, 0.215, -0.02], [-0.06, 0.21, 0.03], [0.09, 0.19, 0.06], [-0.02, 0.2, 0.1]]) p.sphere(c, 0.09, 0.05, 0.09, x, HY + y, z);
  },
  long(p, c) {
    hcap(p, c, 0.5, 0.42, 1.07);
    p.loft([{ y: HY - 0.56, rx: 0.19, rz: 0.05, z: 0.1, c }, { y: HY - 0.4, rx: 0.25, rz: 0.085, z: 0.115, c }, { y: HY - 0.2, rx: 0.235, rz: 0.1, z: 0.11, c }, { y: HY - 0.02, rx: 0.215, rz: 0.11, z: 0.09, c }, { y: HY + 0.12, rx: 0.15, rz: 0.08, z: 0.08, c }], 12);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) p.sphere(c, 0.05 + (i % 2) * 0.012, 0.075, 0.06, s * (0.185 + Math.sin(i * 1.3) * 0.02), HY + 0.08 - i * 0.095, -0.05 + i * 0.006);
  },
  sam(p, c) {
    hcap(p, c, 0.6, 0.6, 1.035);
    for (let i = 0; i < 7; i++) p.sphere(c, 0.05 - i * 0.003, 0.07, 0.05, -0.16 + i * 0.006, HY - 0.06 - i * 0.075, 0.03 - i * 0.025); // hair over one shoulder
    p.sphere(c, 0.04, 0.1, 0.05, 0.185, HY - 0.05, 0.02);
  },
};
function hat(p, L) {
  const h = L.hat; if (!h) return;
  const sw = h.swatch ? SWATCH_RECT : undefined;
  if (h.type === 'cap') {
    p.add(capGeo(0.47), h.c, xf(0, HY + 0.01, 0, 0.2, 0, 0, R * 1.13, R * 1.2, R * 1.13), sw);
    p.add(SPH, h.brim, xf(0, HY + 0.085, -0.255, -0.12, 0, 0, 0.135, 0.012, 0.115), sw);
    p.ball(h.swatch ? 0x4a4a32 : h.c, 0.018, 0, HY + 0.245, 0.045);
  } else if (h.type === 'visor') {
    p.loft([{ y: -0.028, rx: R * 1.07, rz: R * 1.07, c: h.c }, { y: 0.028, rx: R * 1.06, rz: R * 1.06, c: h.c }], 16, xf(0, HY + 0.085, 0, 0.2, 0, 0));
    p.sphere(h.c, 0.135, 0.012, 0.115, 0, HY + 0.075, -0.255, -0.12);
  } else if (h.type === 'headband') {
    p.loft([{ y: -0.03, rx: R * 1.075, rz: R * 1.075, c: h.c }, { y: 0.03, rx: R * 1.065, rz: R * 1.065, c: h.c }], 16, xf(0, HY + 0.085, 0, 0.22, 0, 0));
  } else if (h.type === 'bandana') {
    p.cap(h.c, 0.47, R * 1.1, R * 1.16, R * 1.1, 0, HY + 0.005, 0, 0.3, 0, 0);
    p.ball(h.c, 0.035, 0, HY - 0.03, 0.215); p.sphere(h.c, 0.03, 0.07, 0.015, 0.03, HY - 0.1, 0.225, 0.2, 0, -0.3); p.sphere(h.c, 0.03, 0.07, 0.015, -0.03, HY - 0.1, 0.225, 0.2, 0, 0.3);
  }
}
function glasses(p, g) {
  const y = HY + 0.012, z = -0.197;
  if (g.type === 'shades') {
    for (const s of [-1, 1]) { p.sphere(0x0d0d10, 0.064, 0.044, 0.012, s * 0.086, y, z + 0.012, 0, s * -0.42, 0); p.box(g.c, 0.006, 0.012, 0.16, s * 0.165, y + 0.01, z + 0.1, 0, s * 0.14, 0); }
    p.box(0x0d0d10, 0.07, 0.012, 0.008, 0, y + 0.014, z - 0.006);
    return;
  }
  const sq = g.type === 'square';
  for (const s of [-1, 1]) {
    p.torus(g.c, sq ? 0.072 : 0.058, sq ? 0.008 : 0.0045, s * 0.088, y, z + 0.014, 0, s * -0.42, sq ? PI / 4 : 0, sq ? 4 : 18, 1);
    p.box(g.c, 0.006, 0.01, 0.17, s * 0.172, y + 0.01, z + 0.105, 0, s * 0.15, 0);
  }
  p.box(g.c, 0.06, sq ? 0.012 : 0.006, 0.008, 0, y + 0.012, z - 0.008);
}

// ---- body ----------------------------------------------------------------------
const ARM_UP = (a) => [[-0.27, a * 0.84], [-0.13, a * 0.98], [-0.03, a * 1.12], [0.03, a * 0.98], [0.065, a * 0.45]];
const ARM_LO = (a) => [[-0.25, a * 0.66], [-0.12, a * 0.9], [0, a * 0.88], [0.035, a * 0.5]];
const THIGH = (t) => [[-0.42, t * 0.8], [-0.2, t * 1.0], [-0.03, t * 1.12], [0.02, t * 0.8], [0.045, t * 0.3]];
const SHIN = (t) => [[-0.42, t * 0.52], [-0.3, t * 0.64], [-0.14, t * 0.9], [0, t * 0.8], [0.035, t * 0.4]];

const THICK = 1.32;
function forearmInto(p, L, kind) {
  const a = L.body.arm * THICK, long = L.sleeve === 'long';
  p.loft(bands(ARM_LO(a), long ? [{ to: -0.215, c: L.cuffC ?? L.sleeveC, m: 1.18 }, { to: Infinity, c: L.sleeveC, m: 1.12 }] : [{ to: Infinity, c: L.skin }]), 10);
  const hr = Math.min(0.068, Math.max(0.044, a * 0.82));
  if (kind === 'fists') { const g = Math.max(1, hr / 0.058); p.base = xf(0, -0.31, 0, 0, 0, 0, g, g, g); weaponInto(p, kind); p.base = null; return; }
  p.sphere(L.skin, hr, hr * 1.25, hr * 0.85, 0, -0.3, 0);
  if (kind) { p.base = xf(0, -0.31, 0); weaponInto(p, kind); p.base = null; }
}

function buildCharacter(L) {
  const M = charMat(L), o = L.body;
  // chunkier, more stylised proportions than the raw measurements
  const b = { sh: o.sh * 1.07, chest: [o.chest[0] * 1.1, o.chest[1] * 1.12], waist: [o.waist[0] * 1.1, o.waist[1] * 1.12], hip: [o.hip[0] * 1.1, o.hip[1] * 1.12], arm: o.arm * THICK, leg: o.leg * THICK };
  const a = b.arm, t = b.leg;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  const grp = (name, parent, x, y, z) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };

  // torso (textured) + pelvis + neck
  const torso = grp('torso', body, 0, 0.92, 0);
  const tuck = !!L.tucked;
  let p = new PB();
  p.loft([
    { y: -0.085, rx: b.hip[0] * (tuck ? 1.04 : 1.13), rz: b.hip[1] * (tuck ? 1.06 : 1.24) }, { y: 0, rx: b.hip[0] * (tuck ? 1.03 : 1.09), rz: b.hip[1] * (tuck ? 1.04 : 1.16) }, { y: 0.16, rx: b.waist[0], rz: b.waist[1] },
    { y: 0.36, rx: b.chest[0], rz: b.chest[1] }, { y: 0.455, rx: b.sh * 0.97, rz: b.chest[1] * 0.9 }, { y: 0.52, rx: b.sh * 0.6, rz: b.chest[1] * 0.62 }, { y: 0.56, rx: 0.065, rz: 0.065 },
  ], 20, null, TORSO_RECT);
  p.sphere(L.bottom, b.hip[0] * 0.99, 0.12, b.hip[1] * 0.99, 0, -0.06, 0);
  const nr = L.fem ? 0.047 : 0.058;
  p.loft([{ y: 0.5, rx: nr * 1.15, rz: nr * 1.1, c: L.skin }, { y: 0.66, rx: nr, rz: nr, c: L.skin }], 10);
  for (const e of L.extras || []) {
    if (e === 'medal') { const z = -(b.waist[1] + (b.chest[1] - b.waist[1]) * 0.45) - 0.012; p.cyl(0xe2b23a, 0.04, 0.014, 0, 0.245, z, PI / 2); p.cyl(0xf6d268, 0.028, 0.016, 0, 0.245, z, PI / 2); }
    if (e === 'shirtCollar') for (const s of [-1, 1]) p.sphere(0xfbfbfb, 0.05, 0.012, 0.036, s * 0.045, 0.535, -0.062, 0.6, 0, s * -0.35);
  }
  torso.add(p.mesh(M));

  // head
  const head = grp('head', torso, 0, 0.585, 0);
  p = new PB();
  const hg = SPH.clone(), hp = hg.attributes.position; // taper the jaw a little
  for (let i = 0; i < hp.count; i++) { const y = hp.getY(i); if (y < 0) { const s = 1 - 0.2 * Math.pow(-y, 1.6); hp.setX(i, hp.getX(i) * s); hp.setZ(i, hp.getZ(i) * s); } }
  p.add(hg, 0xffffff, xf(0, HY, 0, 0, 0, 0, R, R * 1.075, R), HEAD_RECT);
  p.sphere(L.skin, 0.026, 0.028, 0.036, 0, HY - 0.058, -R * 0.965); // nose
  for (const s of [-1, 1]) p.sphere(L.skin, 0.02, 0.042, 0.03, s * R * 0.985, HY - 0.012, 0.005); // ears
  HAIR[L.hairStyle](p, L.hair);
  hat(p, L);
  if (L.glasses) glasses(p, L.glasses);
  head.add(p.mesh(M));

  // arms
  const up = L.sleeve === 'none' ? [{ to: Infinity, c: L.skin }]
    : L.sleeve === 'long' ? [{ to: Infinity, c: L.sleeveC, m: 1.12 }]
      : [{ to: -0.125, c: L.skin }, ...(L.cuffC != null ? [{ to: -0.105, c: L.cuffC, m: 1.15 }] : []), { to: Infinity, c: L.sleeveC, m: 1.12 }];
  for (const s of [-1, 1]) {
    const sh = grp(s < 0 ? 'armL' : 'armR', torso, s * (b.sh + a * 0.15), 0.455, 0);
    p = new PB(); p.loft(bands(ARM_UP(a), up), 10); sh.add(p.mesh(M));
    const el = grp(s < 0 ? 'elbowL' : 'elbowR', sh, 0, -0.27, 0);
    p = new PB(); forearmInto(p, L, s > 0 ? L.weapon : L.offhand); el.add(p.mesh(M));
  }

  // legs
  const pants = L.legs === 'pants';
  const thigh = pants ? [{ to: Infinity, c: L.bottom, m: 1.14 }] : [{ to: L.shortHem ?? -0.24, c: L.skin }, { to: Infinity, c: L.bottom, m: L.shortHem ? 1.06 : 1.16 }];
  const sockTo = L.sockH === 'crew' ? -0.25 : L.sockH === 'short' ? -0.345 : -9;
  const shin = pants ? [{ to: L.pantHem ?? -0.405, c: L.sock ?? L.skin, m: 1.05 }, { to: Infinity, c: L.bottom, m: 1.3 }]
    : [{ to: sockTo, c: L.sock ?? L.skin, m: 1.14 }, { to: Infinity, c: L.skin }];
  const sw = Math.max(0.056, t * 0.82), ch = L.chunky ? 1.25 : 1;
  for (const s of [-1, 1]) {
    const hip = grp(s < 0 ? 'legL' : 'legR', body, s * b.hip[0] * 0.52, 0.92, 0);
    p = new PB(); p.loft(bands(THIGH(t), thigh), 10); hip.add(p.mesh(M));
    const kn = grp(s < 0 ? 'kneeL' : 'kneeR', hip, 0, -0.42, 0);
    p = new PB(); p.loft(bands(SHIN(t), shin), 10);
    if (L.sockSwatch) p.loft([{ y: -0.425, rx: t * 0.62, rz: t * 0.62 }, { y: (L.pantHem ?? -0.4) + 0.01, rx: t * 0.76, rz: t * 0.76 }], 10, null, [0, 0, 0.25, 0.0625]);
    p.sphere(L.shoe, sw * ch, 0.05 * ch, 0.128 * ch, 0, -0.452, -0.04); p.sphere(L.shoe, sw * 0.9 * ch, 0.04 * ch, 0.06, 0, -0.44, 0.03);
    p.sphere(L.sole, sw * 1.05 * ch, 0.022 * ch, 0.138 * ch, 0, -0.49 + (ch - 1) * 0.02, -0.04);
    if (L.chunky) p.sphere(0x8d9299, sw * 1.02, 0.02, 0.1, 0, -0.462, -0.06);
    kn.add(p.mesh(M));
  }
  return root;
}

const protos = new Map();
const PART_NAMES = ['body', 'torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'legL', 'legR', 'kneeL', 'kneeR'];
export function makeCharacter(L) {
  // preferred: the MakeHuman model for this friend, if its file was loaded
  const human = makeHuman(L.id, 1.84 * (L.scale || 1));
  if (human) {
    for (const [side, kind] of [['r', L.weapon], ['l', L.offhand]]) {
      if (!kind) continue;
      const p = new PB(); weaponInto(p, kind);
      human.rig.hold(side, p.mesh(plainMat()), (L.scale || 1) / human.scale);
    }
    if (L.wide) human.parts.body.scale.set(L.wide, 1, L.wide);
    human.root.userData = { parts: human.parts, rig: human.rig, look: L, phase: Math.random() * 6, jab: 1, lastAt: 0, base: 1 };
    return human.root;
  }
  if (!protos.has(L)) protos.set(L, buildCharacter(L));
  const root = protos.get(L).clone(true);
  const parts = {};
  for (const n of PART_NAMES) parts[n] = root.getObjectByName(n);
  root.scale.setScalar(L.scale || 1);
  root.userData = { parts, look: L, phase: Math.random() * 6, jab: 1, lastAt: 0, base: L.scale || 1 };
  return root;
}

// first-person forearm + weapon
export function makeViewArm(L, kind) {
  const p = new PB(); forearmInto(p, L, kind);
  return p.mesh(plainMat());
}

// st: { speed, attackT (1..0), castT (seconds left), castKind, pitch, big }
export function animateCharacter(root, st, dt, time) {
  const U = root.userData, p = U.parts, L = U.look, pose = L.pose;
  const sp01 = Math.min(1, st.speed / 5);
  U.phase += st.speed * dt * 1.9;
  const ph = U.phase, s = Math.sin(ph), breathe = Math.sin(time * 2 + U.phase * 0.01) * 0.012;
  // legs
  p.legL.rotation.x = s * 0.7 * sp01; p.legR.rotation.x = -s * 0.7 * sp01;
  p.kneeL.rotation.x = -(Math.max(0, Math.cos(ph)) * 1.0 + 0.05) * sp01; p.kneeR.rotation.x = -(Math.max(0, -Math.cos(ph)) * 1.0 + 0.05) * sp01;
  p.body.position.y = Math.abs(Math.cos(ph)) * 0.035 * sp01;
  p.body.rotation.set(0, 0, 0);
  p.torso.rotation.set(0.05 * sp01 + breathe, 0, 0);
  p.head.rotation.set(-st.pitch * 0.5, 0, 0);
  const at = st.attackT > 0 ? st.attackT : 0;
  if (at > 0.8 && U.lastAt <= 0.8) U.jab = -U.jab; // alternate hands on each new attack
  U.lastAt = at;
  const R = p.armR.rotation, Lr = p.armL.rotation, eR = p.elbowR.rotation, eL = p.elbowL.rotation;
  R.set(0, 0, 0); Lr.set(0, 0, 0);
  const swing = s * 0.55 * sp01, pt = st.pitch;
  switch (pose) {
    case 'pistol': R.x = PI / 2 + pt + at * 0.35; eR.x = 0.06; Lr.x = -swing; Lr.z = -0.08; eL.x = 0.25 + 0.3 * sp01; break;
    case 'two': R.x = 0.55 + pt + at * 0.2; R.z = -0.28; eR.x = PI / 2 - 0.55; Lr.x = 0.75 + pt; Lr.z = 0.5; eL.x = PI / 2 - 0.6; break;
    case 'sling': R.x = 1.15 + pt; R.z = 0.15; eR.x = 0.25; Lr.x = 0.8 + pt; Lr.z = 0.45; eL.x = 1.3 + at * 0.6; break;
    case 'throw': R.x = at > 0 ? 0.6 + at * 2.3 : 0.75; eR.x = at > 0 ? 0.4 + at * 1.0 : 1.3; R.z = 0.12; Lr.x = L.offhand ? 0.6 : -swing; Lr.z = -0.1; eL.x = L.offhand ? 1.2 + Math.sin(time * 9) * (at > 0 ? 0.3 : 0.04) : 0.25; break;
    case 'club': R.x = at > 0 ? 0.3 + at * 2.5 : 0.25 + swing * 0.3; R.z = -0.3; eR.x = at > 0 ? 0.2 + at * 0.6 : 0.45; Lr.x = R.x * 0.9; Lr.z = 0.55; eL.x = eR.x + 0.3; p.torso.rotation.y = at > 0 ? (at - 0.5) * 0.9 : 0; break;
    case 'fists': {
      const jr = U.jab > 0 ? at : 0, jl = U.jab < 0 ? at : 0;
      R.x = 0.95 + jr * 0.65; eR.x = 1.9 - jr * 1.8; R.z = -0.15; Lr.x = 0.95 + jl * 0.65; eL.x = 1.9 - jl * 1.8; Lr.z = 0.15;
      p.torso.rotation.y = (jr - jl) * 0.35; break;
    }
    case 'knives': {
      const jr = U.jab > 0 ? at : 0, jl = U.jab < 0 ? at : 0;
      R.x = 0.45 + jr * 1.5; eR.x = 0.9 - jr * 0.6; R.z = 0.1 - jr * 0.6; Lr.x = 0.45 + jl * 1.5; eL.x = 0.9 - jl * 0.6; Lr.z = -0.1 + jl * 0.6;
      p.torso.rotation.y = (jr - jl) * 0.4; break;
    }
    default: R.x = swing; Lr.x = -swing; eR.x = eL.x = 0.2;
  }
  if (st.castT > 0) { // little dances / flourishes when casting
    const t = time * 10;
    switch (st.castKind) {
      case 0: p.body.rotation.y = st.castT * 12; Lr.set(0, 0, -1.3); R.set(0, 0, 1.3); eL.x = eR.x = 0.2; break;                                   // twirl
      case 1: p.body.position.y = Math.abs(Math.sin(t)) * 0.3; Lr.set(2.8, 0, -0.2); R.set(2.8, 0, 0.2); eL.x = eR.x = 0.3;
        p.kneeL.rotation.x = p.kneeR.rotation.x = -0.5 * Math.abs(Math.cos(t)); break;                                                               // hop, hands up
      case 2: p.body.rotation.z = Math.sin(t * 1.3) * 0.25; Lr.set(1.5 + Math.sin(t) * 0.8, 0, 0); R.set(1.5 - Math.sin(t) * 0.8, 0, 0); eL.x = eR.x = 1.2; break; // wiggle
      default: p.body.rotation.y = Math.sin(t * 0.8) * 0.8; p.body.position.y = Math.abs(Math.sin(t)) * 0.22;
        Lr.set(2.6 + Math.sin(t) * 0.5, 0, -0.3); R.set(2.6 - Math.sin(t) * 0.5, 0, 0.3); eL.x = eR.x = 0.4 + Math.abs(Math.sin(t * 2)) * 0.6;
        p.legL.rotation.x = Math.sin(t) * 0.5; p.legR.rotation.x = -Math.sin(t) * 0.5;                                                               // full routine
    }
  }
  if (U.rig) U.rig.apply(p);
  const sc = U.base * (st.big || 1);
  if (root.scale.x !== sc) root.scale.setScalar(sc);
}

// ---- Mason's cats: Bruno (black, tongue out), Murphy (brown, fluffy), Wanda (calico kitten) ----
const catGeos = new Map();
export const CATS = [{ name: 'Bruno' }, { name: 'Murphy' }, { name: 'Wanda' }];
function buildCat(i) {
  const p = new PB();
  const fur = [0x1b1b1f, 0x8a5a36, 0xf6f1e6][i], dark = [0x0e0e11, 0x6b4226, 0xe88b3a][i], fluffy = i === 1, kit = i === 2;
  const hs = kit ? 1.22 : 1; // kittens are mostly head
  p.sphere(fur, 0.13, 0.12, 0.26, 0, 0.27, 0.02);
  p.sphere(fur, 0.11 * hs, 0.1 * hs, 0.11 * hs, 0, 0.42, -0.25); p.sphere(fur, 0.055 * hs, 0.04 * hs, 0.05 * hs, 0, 0.385, -0.335);
  for (const s of [-1, 1]) {
    p.add(cylGeo(0, 4), fur, xf(s * 0.065 * hs, 0.42 + 0.1 * hs, -0.24, 0, 0, s * -0.25, 0.04 * hs, 0.08 * hs, 0.03));
    p.add(cylGeo(0, 4), 0xf0a0a8, xf(s * 0.065 * hs, 0.42 + 0.095 * hs, -0.248, 0, 0, s * -0.25, 0.022 * hs, 0.05 * hs, 0.015));
    p.ball(0xd8ff5a, 0.022 * hs, s * 0.045 * hs, 0.44, -0.335 - (hs - 1) * 0.02); p.sphere(0x111111, 0.008 * hs, 0.018 * hs, 0.008, s * 0.045 * hs, 0.44, -0.354 - (hs - 1) * 0.02);
    for (const z of [-0.16, 0.2]) { p.cyl(fur, 0.035, 0.2, s * 0.075, 0.1, z); p.sphere(kit || i === 0 ? fur : dark, 0.04, 0.025, 0.05, s * 0.075, 0.02, z - 0.012); }
  }
  p.ball(0xf0a0a8, 0.013 * hs, 0, 0.4, -0.385 - (hs - 1) * 0.02);
  for (let k = 0; k < 6; k++) p.ball(k > 3 && fluffy ? dark : fur, (fluffy ? 0.055 : 0.03) - k * 0.002, 0, 0.3 + k * 0.06, 0.27 + Math.sin(k * 0.6) * 0.09 + k * 0.012); // tail
  if (i === 0) p.sphere(0xff7a90, 0.02, 0.008, 0.03, 0, 0.365, -0.385, 0.5); // Bruno's tongue, always out
  if (fluffy) { // Murphy: mane, cheeks and belly fluff
    for (let k = 0; k < 9; k++) { const a = k / 9 * PI * 2; p.ball(k % 2 ? dark : fur, 0.065, Math.cos(a) * 0.11, 0.33 + Math.sin(a) * 0.1, -0.14); }
    for (const s of [-1, 1]) { p.ball(fur, 0.05, s * 0.1, 0.38, -0.27); p.sphere(fur, 0.07, 0.07, 0.16, s * 0.1, 0.23, 0.05); }
    p.sphere(0xb98a5c, 0.09, 0.06, 0.18, 0, 0.17, 0.0);
  }
  if (kit) { // Wanda: calico patches
    p.sphere(0xe88b3a, 0.09, 0.05, 0.12, 0.05, 0.36, 0.1); p.sphere(0x26262b, 0.08, 0.05, 0.09, -0.06, 0.36, -0.04); p.sphere(0xe88b3a, 0.07, 0.05, 0.07, 0.06, 0.5, -0.24);
    p.sphere(0x26262b, 0.06, 0.05, 0.06, -0.07, 0.5, -0.22); p.ball(0x26262b, 0.031, 0, 0.6, 0.345);
  }
  return p.mesh(plainMat()).geometry;
}
export function makeCat(i, big) {
  if (!catGeos.has(i)) catGeos.set(i, buildCat(i));
  const g = new THREE.Group(), m = new THREE.Mesh(catGeos.get(i), plainMat());
  g.add(m);
  g.scale.setScalar((big ? 2.3 : 1.35) * (i === 2 ? 0.72 : i === 1 ? 1.1 : 1));
  return g;
}

// ---- projectiles -------------------------------------------------------------
const codeTex = [];
function codeTexture() {
  if (!codeTex.length) {
    const snippets = ['{ }', 'if(', '=> ', '0x', '</>', 'NaN', ';;', 'TODO', '[ ]', 'null', 'fn()', '&&'];
    for (const s of snippets) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const x = c.getContext('2d'); x.font = 'bold 44px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#39ff88'; x.shadowBlur = 10; x.fillStyle = '#b6ffd6'; x.fillText(s, 64, 34);
      codeTex.push(new THREE.CanvasTexture(c));
    }
  }
  return codeTex[(Math.random() * codeTex.length) | 0];
}
const codeMats = new Map();
export function makeCodeSprite(size = 0.9) {
  const t = codeTexture();
  if (!codeMats.has(t)) codeMats.set(t, new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  const s = new THREE.Sprite(codeMats.get(t)); s.scale.set(size, size / 2, 1); return s;
}

const projGeos = new Map();
function buildProjectile(kind) {
  const p = new PB();
  switch (kind) {
    case 'ball': p.ball(0xffffff, 0.25, 0, 0, 0); golden(10, PI, (x, y, z) => p.sphere(0x16161a, 0.085, 0.085, 0.03, x * 0.235, y * 0.235, z * 0.235, Math.asin(-y), Math.atan2(x, z), 0)); break;
    case 'baseball': p.ball(0xfafafa, 0.12, 0, 0, 0); p.torus(0xd62828, 0.118, 0.008, 0, 0, 0, 0.6, 0, 0); p.torus(0xd62828, 0.118, 0.008, 0, 0, 0, -0.6, 0, 0); break;
    case 'pellet': p.ball(0xffd166, 0.1, 0, 0, 0); break;
    case 'stick': p.cyl(0xe2c48e, 0.025, 0.6, 0, 0, 0, PI / 2, 0, 0, 0.7); p.ball(0xe2c48e, 0.04, 0, 0, -0.3); break;
    case 'can': p.cyl(0x39d353, 0.11, 0.4, 0, 0, 0); p.cyl(0x111111, 0.112, 0.12, 0, 0, 0); p.cyl(0xcfd3d8, 0.09, 0.42, 0, 0, 0); break;
    case 'junk': p.box(0xe84a5f, 0.3, 0.3, 0.3, 0, 0, 0, 0.4, 0.3); p.ball(0x2ec4b6, 0.14, 0.16, 0.1, 0); p.cyl(0xf2c14e, 0.08, 0.36, -0.1, 0, 0.1, 0.8); p.sphere(0x7b4fa3, 0.12, 0.05, 0.18, 0, -0.16, -0.05); break;
    case 'cushion': p.sphere(0xe85d75, 0.36, 0.09, 0.36, 0, 0, 0); p.sphere(0xc9415a, 0.1, 0.05, 0.14, 0.38, 0, 0); break;
    case 'clothes': p.sphere(0x5aa6c8, 0.28, 0.14, 0.3, 0, 0, 0); p.sphere(0xd96c8a, 0.2, 0.1, 0.3, 0.1, 0.12, 0.05, 0, 0.6); p.sphere(0xe0b040, 0.18, 0.08, 0.2, -0.14, 0.1, -0.1); break;
    case 'burger': p.cap(0xd9a05b, 0.5, 0.2, 0.13, 0.2, 0, 0.03, 0); p.cyl(0x6b3e26, 0.21, 0.05, 0, 0, 0); p.box(0xf7d354, 0.36, 0.015, 0.36, 0, 0.03, 0, 0, 0.5); p.cyl(0x6fbf4a, 0.215, 0.015, 0, -0.03, 0); p.cyl(0xd9a05b, 0.2, 0.05, 0, -0.065, 0); break;
    case 'tub': p.box(0xe9f5f9, 0.34, 0.2, 0.34, 0, 0, 0); p.box(0x3a86ff, 0.37, 0.05, 0.37, 0, 0.12, 0); p.sphere(0x9acd32, 0.12, 0.04, 0.12, 0, 0.15, 0); break;
    case 'knife': p.box(0xe6ebf0, 0.02, 0.07, 0.34, 0, 0, -0.08); p.cyl(0x1b1b1f, 0.025, 0.16, 0, 0, 0.17, PI / 2); break;
  }
  return p.mesh(plainMat()).geometry;
}
export function makeProjectile(kind) {
  const g = new THREE.Group();
  if (kind === 'code') { g.add(makeCodeSprite()); return g; }
  if (!projGeos.has(kind)) projGeos.set(kind, buildProjectile(kind));
  g.add(new THREE.Mesh(projGeos.get(kind), plainMat()));
  return g;
}

export const GEO = { BOX, SPH: new THREE.SphereGeometry(0.5, 10, 8), CYL: new THREE.CylinderGeometry(0.5, 0.5, 1, 10) };
