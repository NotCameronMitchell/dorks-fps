import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const STEP = 0.55;

// slab test of a ray against an AABB; returns entry distance (or -1) and writes the hit axis to _n
const _n = { x: 0, y: 0, z: 0 };
export function rayBox(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz, max) {
  let tmin = 0, tmax = max, axis = -1, sign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn[i] || o[i] > mx[i]) return -1;
    } else {
      let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i], s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  _n.x = axis === 0 ? sign : 0; _n.y = axis === 1 ? sign : 0; _n.z = axis === 2 ? sign : 0;
  return tmin;
}

export class World {
  constructor(scene, def) {
    this.def = def;
    this.size = def.size;
    this.solids = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    const lit = [], glow = [];
    const col = new THREE.Color();
    const add = (b) => {
      const g = new THREE.BoxGeometry(b.w, b.h, b.d);
      g.translate(b.x, b.y + b.h / 2, b.z);
      col.set(b.c);
      const n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      (b.glow ? glow : lit).push(g);
      if (!b.ghost) this.solids.push({
        minx: b.x - b.w / 2, maxx: b.x + b.w / 2, miny: b.y, maxy: b.y + b.h, minz: b.z - b.d / 2, maxz: b.z + b.d / 2,
      });
    };
    const S = def.size;
    add({ x: 0, y: -1, z: 0, w: S * 2 + 4, h: 1, d: S * 2 + 4, c: def.ground, ghost: true });
    for (const b of def.boxes) add(b);
    if (lit.length) this.group.add(new THREE.Mesh(mergeGeometries(lit), new THREE.MeshLambertMaterial({ vertexColors: true })));
    if (glow.length) this.group.add(new THREE.Mesh(mergeGeometries(glow), new THREE.MeshBasicMaterial({ vertexColors: true })));

    // control point marker
    const p = def.point;
    this.pointRing = new THREE.Mesh(
      new THREE.RingGeometry(p.r - 0.25, p.r, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.pointRing.rotation.x = -Math.PI / 2;
    this.pointRing.position.set(p.x, (p.y || 0) + 0.06, p.z);
    this.pointDisc = new THREE.Mesh(
      new THREE.CircleGeometry(p.r - 0.25, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
    this.pointDisc.rotation.x = -Math.PI / 2;
    this.pointDisc.position.set(p.x, (p.y || 0) + 0.05, p.z);
    this.group.add(this.pointRing, this.pointDisc);

    this.buildGrid();
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  // ---- collision -------------------------------------------------------
  // moves an upright box (radius r, height h); returns true when standing on something
  move(pos, vel, r, h, dt) {
    const solids = this.solids;
    const lim = this.size - r - 0.05;
    const overlap = (s) => pos.x + r > s.minx && pos.x - r < s.maxx && pos.z + r > s.minz && pos.z - r < s.maxz &&
      pos.y + h > s.miny && pos.y + 0.001 < s.maxy;
    const blockedAt = (y) => {
      for (const s of solids) {
        if (pos.x + r > s.minx && pos.x - r < s.maxx && pos.z + r > s.minz && pos.z - r < s.maxz && y + h > s.miny && y + 0.001 < s.maxy) return true;
      }
      return false;
    };
    // horizontal axes
    for (let a = 0; a < 2; a++) {
      const k = a === 0 ? 'x' : 'z';
      const dv = vel[k] * dt;
      if (dv === 0) continue;
      pos[k] += dv;
      for (const s of solids) {
        if (!overlap(s)) continue;
        const rise = s.maxy - pos.y;
        if (rise <= STEP && vel.y <= 0.5 && !blockedAt(s.maxy)) { pos.y = s.maxy; continue; }
        if (k === 'x') pos.x = dv > 0 ? s.minx - r : s.maxx + r; else pos.z = dv > 0 ? s.minz - r : s.maxz + r;
        vel[k] = 0;
      }
      if (pos[k] > lim) { pos[k] = lim; vel[k] = 0; } else if (pos[k] < -lim) { pos[k] = -lim; vel[k] = 0; }
    }
    // vertical
    let ground = false;
    pos.y += vel.y * dt;
    for (const s of solids) {
      if (!overlap(s)) continue;
      if (vel.y <= 0) { pos.y = s.maxy; vel.y = 0; ground = true; }
      else { pos.y = s.miny - h; vel.y = 0; }
    }
    if (pos.y <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; ground = true; }
    return ground;
  }

  // returns distance to first solid (or max). this.hitN holds the surface normal of the last hit.
  raycast(o, d, max) {
    let best = max, hit = false;
    const hn = this.hitN || (this.hitN = { x: 0, y: 1, z: 0 });
    for (const s of this.solids) {
      const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s.minx, s.miny, s.minz, s.maxx, s.maxy, s.maxz, best);
      if (t >= 0 && t < best) { best = t; hit = true; hn.x = _n.x; hn.y = _n.y; hn.z = _n.z; }
    }
    if (d.y < 0) {
      const t = -o.y / d.y;
      if (t >= 0 && t < best) { best = t; hit = true; hn.x = 0; hn.y = 1; hn.z = 0; }
    }
    this.lastHit = hit;
    return best;
  }

  los(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    const d = { x: dx / len, y: dy / len, z: dz / len };
    this.raycast(a, d, len - 0.05);
    return !this.lastHit;
  }

  // ---- navigation grid (1m cells, ground level) ------------------------
  buildGrid() {
    const S = this.size, N = S * 2;
    this.N = N;
    this.blocked = new Uint8Array(N * N);
    const pad = 0.45;
    for (const s of this.solids) {
      if (s.maxy <= 0.6 || s.miny >= 1.9) continue;
      const x0 = Math.max(0, Math.floor(s.minx - pad + S)), x1 = Math.min(N - 1, Math.floor(s.maxx + pad + S));
      const z0 = Math.max(0, Math.floor(s.minz - pad + S)), z1 = Math.min(N - 1, Math.floor(s.maxz + pad + S));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        // cell centre must be inside the padded footprint
        const cx = x - S + 0.5, cz = z - S + 0.5;
        if (cx > s.minx - pad && cx < s.maxx + pad && cz > s.minz - pad && cz < s.maxz + pad) this.blocked[z * N + x] = 1;
      }
    }
    for (let i = 0; i < N; i++) { this.blocked[i] = this.blocked[(N - 1) * N + i] = this.blocked[i * N] = this.blocked[i * N + N - 1] = 1; }
    this._g = new Float32Array(N * N); this._from = new Int32Array(N * N); this._seen = new Uint32Array(N * N); this._stamp = 0;
  }

  cellOf(x, z) {
    const S = this.size, N = this.N;
    const cx = Math.max(0, Math.min(N - 1, Math.floor(x + S))), cz = Math.max(0, Math.min(N - 1, Math.floor(z + S)));
    return cz * N + cx;
  }

  nearestFree(cell) {
    const N = this.N;
    if (!this.blocked[cell]) return cell;
    const cx = cell % N, cz = (cell / N) | 0;
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = cx + dx, z = cz + dz;
      if (x < 0 || z < 0 || x >= N || z >= N) continue;
      if (!this.blocked[z * N + x]) return z * N + x;
    }
    return cell;
  }

  // A*; returns array of {x,z} waypoints (world coords) or null
  findPath(ax, az, bx, bz) {
    const N = this.N, S = this.size, blocked = this.blocked;
    const start = this.nearestFree(this.cellOf(ax, az)), goal = this.nearestFree(this.cellOf(bx, bz));
    if (start === goal) return [{ x: bx, z: bz }];
    const stamp = ++this._stamp, g = this._g, from = this._from, seen = this._seen;
    const gx = goal % N, gz = (goal / N) | 0;
    const open = [start], f = new Map();
    g[start] = 0; seen[start] = stamp; from[start] = -1; f.set(start, 0);
    let iter = 0;
    while (open.length && iter++ < 6000) {
      let bi = 0, bf = Infinity;
      for (let i = 0; i < open.length; i++) { const v = f.get(open[i]); if (v < bf) { bf = v; bi = i; } }
      const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      const cx = cur % N, cz = (cur / N) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= N || z >= N) continue;
        const n = z * N + x;
        if (blocked[n]) continue;
        if (dx && dz && (blocked[cz * N + x] || blocked[z * N + cx])) continue;
        const ng = g[cur] + (dx && dz ? 1.414 : 1);
        if (seen[n] === stamp && ng >= g[n]) continue;
        const isNew = seen[n] !== stamp;
        seen[n] = stamp; g[n] = ng; from[n] = cur;
        f.set(n, ng + Math.hypot(gx - x, gz - z));
        if (isNew || !open.includes(n)) open.push(n);
      }
    }
    if (seen[goal] !== stamp) return null;
    const path = [];
    for (let c = goal; c !== -1 && c !== start; c = from[c]) path.push({ x: (c % N) - S + 0.5, z: ((c / N) | 0) - S + 0.5 });
    path.reverse();
    return path;
  }
}
