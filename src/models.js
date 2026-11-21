import * as THREE from 'three';

// Everything is built from boxes/cylinders in code: no asset downloads, tiny draw cost, easy to restyle per friend.
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const SPH = new THREE.SphereGeometry(0.5, 10, 8);
const mats = new Map();
export function mat(c, basic = false) {
  const k = c + (basic ? 'b' : '');
  if (!mats.has(k)) mats.set(k, basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }));
  return mats.get(k);
}
function part(geo, parent, w, h, d, c, x = 0, y = 0, z = 0, basic = false) {
  const m = new THREE.Mesh(geo, mat(c, basic));
  m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m;
}
const bx = (p, w, h, d, c, x, y, z, basic) => part(BOX, p, w, h, d, c, x, y, z, basic);
const cy = (p, w, h, d, c, x, y, z, basic) => part(CYL, p, w, h, d, c, x, y, z, basic);
const sp = (p, w, h, d, c, x, y, z, basic) => part(SPH, p, w, h, d, c, x, y, z, basic);
const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };

// ---- weapons: built pointing along -Y so they line up with an arm ---------
export function makeWeapon(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'pistol':
      bx(g, 0.08, 0.34, 0.1, 0x2b2b30, 0, -0.14, 0); bx(g, 0.08, 0.1, 0.2, 0x1a1a1d, 0, 0.0, 0.08); bx(g, 0.04, 0.04, 0.04, 0xda291c, 0, -0.3, -0.06);
      break;
    case 'club':
      cy(g, 0.045, 1.0, 0.045, 0xc9c9cf, 0, -0.5, 0); bx(g, 0.1, 0.12, 0.26, 0x9aa0a8, 0, -1.02, -0.1); cy(g, 0.06, 0.25, 0.06, 0x14213d, 0, -0.05, 0);
      break;
    case 'fists':
      bx(g, 0.24, 0.24, 0.26, 0xd62828, 0, -0.02, 0); bx(g, 0.26, 0.06, 0.28, 0xffffff, 0, 0.1, 0);
      break;
    case 'laptop':
      bx(g, 0.5, 0.34, 0.03, 0x3a3f4b, 0, -0.17, 0); bx(g, 0.5, 0.03, 0.32, 0x3a3f4b, 0, -0.34, -0.17); bx(g, 0.44, 0.01, 0.26, 0x39ff88, 0, -0.32, -0.17, true);
      break;
    case 'slingshot':
      bx(g, 0.05, 0.05, 0.3, 0x8a5a2b, 0, -0.05, -0.1); bx(g, 0.05, 0.05, 0.22, 0x8a5a2b, -0.09, -0.05, -0.33); bx(g, 0.05, 0.05, 0.22, 0x8a5a2b, 0.09, -0.05, -0.33);
      bx(g, 0.2, 0.03, 0.03, 0xd62828, 0, 0.02, -0.42);
      break;
    case 'sticks':
      cy(g, 0.03, 0.55, 0.03, 0xe0c08a, 0, -0.25, 0); sp(g, 0.06, 0.08, 0.06, 0xe0c08a, 0, -0.54, 0);
      break;
    case 'tambourine':
      cy(g, 0.36, 0.07, 0.36, 0xc98a3c, 0, -0.1, 0).rotation.x = Math.PI / 2; cy(g, 0.3, 0.075, 0.3, 0xf3ead2, 0, -0.1, 0).rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; bx(g, 0.06, 0.06, 0.09, 0xdcdcdc, Math.cos(a) * 0.18, -0.1 + Math.sin(a) * 0.18, 0); }
      break;
    case 'can': {
      const u = grp(g, 0, -0.05, -0.04); u.rotation.x = Math.PI / 2;
      cy(u, 0.11, 0.24, 0.11, 0x39d353, 0, 0, 0); cy(u, 0.112, 0.06, 0.112, 0x111111, 0, 0, 0); cy(u, 0.09, 0.02, 0.09, 0xcfcfcf, 0, -0.125, 0);
      break;
    }
    case 'launcher':
      cy(g, 0.2, 0.6, 0.2, 0x7b4fa3, 0, -0.25, 0); cy(g, 0.26, 0.12, 0.26, 0xf2c14e, 0, -0.56, 0); bx(g, 0.1, 0.1, 0.1, 0xe84a5f, 0.06, -0.66, 0); bx(g, 0.09, 0.09, 0.09, 0x2ec4b6, -0.07, -0.64, 0.03);
      break;
    case 'knife':
      bx(g, 0.05, 0.14, 0.06, 0x222222, 0, -0.02, 0); bx(g, 0.02, 0.36, 0.07, 0xdfe6ee, 0, -0.26, 0);
      break;
  }
  return g;
}

function hair(head, style, c) {
  switch (style) {
    case 'short': bx(head, 0.43, 0.12, 0.43, c, 0, 0.44, 0); bx(head, 0.43, 0.22, 0.1, c, 0, 0.3, 0.18); break;
    case 'buzz': bx(head, 0.41, 0.06, 0.41, c, 0, 0.42, 0); break;
    case 'messy': bx(head, 0.46, 0.16, 0.46, c, 0, 0.46, 0); bx(head, 0.2, 0.1, 0.2, c, 0.08, 0.57, -0.05); bx(head, 0.44, 0.24, 0.1, c, 0, 0.3, 0.19); break;
    case 'long': bx(head, 0.44, 0.12, 0.44, c, 0, 0.44, 0); bx(head, 0.46, 0.62, 0.12, c, 0, 0.1, 0.2); bx(head, 0.06, 0.45, 0.3, c, 0.22, 0.18, 0.05); bx(head, 0.06, 0.45, 0.3, c, -0.22, 0.18, 0.05); break;
    case 'pony': bx(head, 0.43, 0.12, 0.43, c, 0, 0.44, 0); bx(head, 0.43, 0.26, 0.1, c, 0, 0.3, 0.19); bx(head, 0.12, 0.42, 0.12, c, 0, 0.12, 0.3); break;
    case 'bob': bx(head, 0.45, 0.12, 0.45, c, 0, 0.44, 0); bx(head, 0.46, 0.4, 0.12, c, 0, 0.2, 0.2); bx(head, 0.06, 0.36, 0.34, c, 0.22, 0.22, 0.03); bx(head, 0.06, 0.36, 0.34, c, -0.22, 0.22, 0.03); break;
  }
}

// ---- character ------------------------------------------------------------
// look: { scale, bulk, skin, hair, hairStyle, shirt, sleeve, pants, shoes, weapon, offhand, extra(parts) }
export function makeCharacter(L) {
  const root = new THREE.Group();
  const body = grp(root);
  const bulk = L.bulk || 1, bw = 0.56 * bulk, lw = 0.22 * Math.min(1.3, bulk), aw = 0.17 * Math.min(1.5, bulk * 1.05);
  const legL = grp(body, -0.15 * bulk, 0.82, 0), legR = grp(body, 0.15 * bulk, 0.82, 0);
  for (const leg of [legL, legR]) { bx(leg, lw, 0.72, lw + 0.02, L.pants, 0, -0.36, 0); bx(leg, lw + 0.02, 0.12, lw + 0.12, L.shoes || 0x222222, 0, -0.76, -0.04); }
  const torso = grp(body, 0, 1.13, 0);
  bx(torso, bw, 0.66, 0.3 * Math.min(1.4, bulk), L.shirt, 0, 0, 0);
  const armL = grp(body, -(bw / 2 + aw / 2 + 0.01), 1.4, 0), armR = grp(body, bw / 2 + aw / 2 + 0.01, 1.4, 0);
  for (const arm of [armL, armR]) {
    bx(arm, aw + 0.02, 0.3, aw + 0.04, L.sleeve ?? L.shirt, 0, -0.1, 0); bx(arm, aw, 0.36, aw + 0.01, L.skin, 0, -0.42, 0);
  }
  const head = grp(body, 0, 1.47, 0);
  bx(head, 0.4, 0.4, 0.4, L.skin, 0, 0.22, 0);
  bx(head, 0.07, 0.08, 0.02, 0x1d1d1d, -0.1, 0.26, -0.205); bx(head, 0.07, 0.08, 0.02, 0x1d1d1d, 0.1, 0.26, -0.205);
  bx(head, 0.14, 0.03, 0.02, 0x8a3b3b, 0, 0.12, -0.205);
  hair(head, L.hairStyle, L.hair);
  const handR = grp(armR, 0, -0.62, 0), handL = grp(armL, 0, -0.62, 0);
  if (L.weapon) handR.add(makeWeapon(L.weapon));
  if (L.offhand) handL.add(makeWeapon(L.offhand));
  const parts = { root, body, torso, legL, legR, armL, armR, head, handL, handR };
  if (L.extra) L.extra(parts, { bx, cy, sp, grp });
  root.scale.setScalar(L.scale || 1);
  root.userData.parts = parts;
  root.userData.look = L;
  root.userData.phase = Math.random() * 6;
  return root;
}

// st: { speed, attackT (1..0), castT (seconds left), castKind, pitch, ranged, twoHand, big }
export function animateCharacter(root, st, dt, time) {
  const p = root.userData.parts, L = root.userData.look;
  const sp01 = Math.min(1, st.speed / 5);
  root.userData.phase += st.speed * dt * 2.1;
  const ph = root.userData.phase, sw = Math.sin(ph) * 0.75 * sp01;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.body.position.y = Math.abs(Math.sin(ph)) * 0.04 * sp01;
  p.body.rotation.set(0, 0, 0);
  p.head.rotation.x = -st.pitch * 0.6;
  const at = st.attackT > 0 ? st.attackT : 0;
  if (st.ranged) {
    p.armR.rotation.x = Math.PI / 2 + st.pitch + at * 0.5;
    p.armL.rotation.x = st.twoHand ? Math.PI / 2 + st.pitch : -sw;
    p.armL.rotation.z = st.twoHand ? -0.45 : 0; p.armR.rotation.z = st.twoHand ? 0.45 : 0;
  } else {
    // melee: wind up high, swing through
    p.armR.rotation.x = at > 0 ? 0.4 + at * 2.3 : 0.5 + sw * 0.5;
    p.armL.rotation.x = st.twoHand ? (at > 0 ? 0.3 + (1 - at) * 2.0 : 0.5 - sw * 0.5) : -sw;
    p.armL.rotation.z = p.armR.rotation.z = 0;
  }
  if (st.castT > 0) {
    // little dances / flourishes when casting
    const t = time * 10;
    switch (st.castKind) {
      case 0: p.body.rotation.y = st.castT * 12; p.armL.rotation.z = -1.2; p.armR.rotation.z = 1.2; break;       // twirl
      case 1: p.body.position.y = Math.abs(Math.sin(t)) * 0.35; p.armL.rotation.x = p.armR.rotation.x = 2.8; break; // hop, hands up
      case 2: p.body.rotation.z = Math.sin(t * 1.3) * 0.3; p.armL.rotation.x = 1.5 + Math.sin(t) * 0.8; p.armR.rotation.x = 1.5 - Math.sin(t) * 0.8; break; // wiggle
      default: p.body.rotation.y = Math.sin(t * 0.8) * 0.8; p.body.position.y = Math.abs(Math.sin(t)) * 0.25;
        p.armL.rotation.x = 2.6 + Math.sin(t) * 0.5; p.armR.rotation.x = 2.6 - Math.sin(t) * 0.5; // full routine
    }
  }
  const s = (L.scale || 1) * (st.big || 1);
  if (root.scale.x !== s) root.scale.setScalar(s);
}

// ---- summoned cats ----------------------------------------------------------
export function makeCat(color, big) {
  const g = new THREE.Group();
  bx(g, 0.26, 0.24, 0.6, color, 0, 0.3, 0); bx(g, 0.26, 0.24, 0.24, color, 0, 0.46, -0.36);
  bx(g, 0.07, 0.1, 0.05, color, -0.08, 0.62, -0.36); bx(g, 0.07, 0.1, 0.05, color, 0.08, 0.62, -0.36);
  bx(g, 0.05, 0.05, 0.02, 0xd8ff5a, -0.07, 0.5, -0.485, true); bx(g, 0.05, 0.05, 0.02, 0xd8ff5a, 0.07, 0.5, -0.485, true);
  bx(g, 0.06, 0.06, 0.4, color, 0, 0.5, 0.42).rotation.x = 0.7;
  for (const [x, z] of [[-0.09, -0.2], [0.09, -0.2], [-0.09, 0.2], [0.09, 0.2]]) bx(g, 0.07, 0.2, 0.07, color, x, 0.1, z);
  g.scale.setScalar(big ? 2.2 : 1.3);
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

export function makeProjectile(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'code': g.add(makeCodeSprite()); break;
    case 'ball': sp(g, 0.5, 0.5, 0.5, 0xffffff); bx(g, 0.2, 0.2, 0.52, 0x111111); bx(g, 0.52, 0.2, 0.2, 0x111111); break;
    case 'baseball': sp(g, 0.24, 0.24, 0.24, 0xffffff); bx(g, 0.25, 0.04, 0.25, 0xd62828); break;
    case 'pellet': sp(g, 0.2, 0.2, 0.2, 0xffd166, 0, 0, 0, true); break;
    case 'stick': cy(g, 0.05, 0.6, 0.05, 0xe0c08a).rotation.x = Math.PI / 2; break;
    case 'can': cy(g, 0.22, 0.42, 0.22, 0x39d353); cy(g, 0.225, 0.1, 0.225, 0x111111); break;
    case 'junk': {
      const cols = [0xe84a5f, 0x2ec4b6, 0xf2c14e, 0x7b4fa3, 0xff9f1c];
      bx(g, 0.34, 0.34, 0.34, cols[(Math.random() * cols.length) | 0]); bx(g, 0.2, 0.42, 0.2, cols[(Math.random() * cols.length) | 0]);
      break;
    }
    case 'cushion': cy(g, 0.7, 0.16, 0.7, 0xe85d75); break;
    case 'clothes': bx(g, 0.5, 0.3, 0.5, 0x5aa6c8); bx(g, 0.3, 0.2, 0.6, 0xd96c8a, 0.1, 0.15, 0); break;
    case 'burger': cy(g, 0.4, 0.1, 0.4, 0xd9a05b, 0, 0.1, 0); cy(g, 0.42, 0.08, 0.42, 0x6b3e26); cy(g, 0.4, 0.1, 0.4, 0xd9a05b, 0, -0.1, 0); bx(g, 0.44, 0.03, 0.44, 0xf7d354, 0, 0.05, 0); break;
    case 'tub': bx(g, 0.36, 0.22, 0.36, 0xe9f5f9); bx(g, 0.38, 0.05, 0.38, 0x3a86ff, 0, 0.13, 0); break;
    case 'knife': bx(g, 0.04, 0.1, 0.5, 0xdfe6ee); bx(g, 0.05, 0.12, 0.16, 0x222222, 0, 0, 0.3); break;
  }
  return g;
}

export const GEO = { BOX, CYL, SPH };
