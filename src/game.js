import * as THREE from 'three';
import { World, rayBox } from './world.js';
import { makeCharacter, animateCharacter, makeCat, makeProjectile, makeCodeSprite, makeViewArm, GEO, mat } from './models.js';
import { HEROES } from './heroes.js';
import { botThink } from './bots.js';

const V = THREE.Vector3;
const GRAV = 20, JUMP = 7.2, RESPAWN = 6, WIN_TIME = 80, CAP_TIME = 3.5;
const TEAM_COL = [0x4ea8ff, 0xff5a5a];
const CAT_NAMES = ['Bruno', 'Murphy', 'Wanda'];

function dirFrom(yaw, pitch, out) {
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

function nameSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.font = 'bold 40px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.75)'; x.strokeText(text, 128, 34); x.fillStyle = color; x.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(1.5, 0.375, 1);
  return s;
}

function pickTeams(playerHero) {
  const pool = HEROES.filter((h) => h !== playerHero).sort(() => Math.random() - 0.5);
  const take = (role) => { const i = pool.findIndex((h) => h.role === role); return pool.splice(i, 1)[0]; };
  const mine = [playerHero];
  for (const r of ['tank', 'support', 'dps']) if (r !== playerHero.role) mine.push(take(r));
  const theirs = [take('tank'), take('dps'), take('support')];
  return [mine, theirs];
}

export class Game {
  constructor({ scene, camera, mapDef, playerHero, hud, audio, input }) {
    this.scene = scene; this.camera = camera; this.hud = hud; this.audio = audio; this.input = input;
    this.def = mapDef;
    this.root = new THREE.Group(); scene.add(this.root);
    scene.background = new THREE.Color(mapDef.sky);
    scene.fog = new THREE.Fog(...mapDef.fog);
    const L = mapDef.light;
    this.hemi = new THREE.HemisphereLight(...L.hemi); this.sun = new THREE.DirectionalLight(L.sun[0], L.sun[1]); this.sun.position.set(...L.sun[2]);
    this.root.add(this.hemi, this.sun);
    this.world = new World(this.root, mapDef);
    this.time = 0; this.over = false; this.countdown = 4;
    this.chars = []; this.projs = []; this.zones = []; this.cats = []; this.fx = [];
    this.point = { owner: -1, cap: 0, capTeam: -1, score: [0, 0], on: [0, 0] };
    this.packs = mapDef.packs.map((p) => {
      const m = new THREE.Group();
      const a = new THREE.Mesh(GEO.BOX, mat(0x4dff88, true)); a.scale.set(0.7, 0.22, 0.22);
      const b = new THREE.Mesh(GEO.BOX, mat(0x4dff88, true)); b.scale.set(0.22, 0.7, 0.22);
      m.add(a, b); m.position.set(p.x, 0.8, p.z); this.root.add(m);
      return { x: p.x, z: p.z, cd: 0, mesh: m };
    });
    const teams = pickTeams(playerHero);
    teams.forEach((list, team) => list.forEach((hero, i) => this.addChar(hero, team, i, team === 0 && i === 0)));
    this.player = this.chars[0];
    this.buildViewmodel();
    hud.setup(this);
  }

  dispose() {
    this.scene.remove(this.root);
    this.camera.remove(this.view);
    this.scene.fog = null;
  }

  // ---- characters --------------------------------------------------------
  addChar(hero, team, slot, isPlayer) {
    const model = makeCharacter(hero.look);
    const scale = hero.look.scale || 1;
    const c = {
      hero, team, slot, isPlayer, name: hero.name, model,
      pos: new V(), vel: new V(), yaw: 0, pitch: 0,
      hp: hero.hp, maxHp: hero.hp, over: 0, overT: 0, alive: true, respawn: 0,
      st: {}, cd: [0, 0, 0], ult: 0, fireCd: 0, attackT: 0, castT: 0, castKind: 0,
      onGround: true, radius: hero.radius, baseHeight: 1.86 * scale, height: 1.86 * scale,
      intent: { wx: 0, wz: 0, fire: false, jump: false, ab: [false, false, false], ult: false },
      stats: { kills: 0, deaths: 0, dmg: 0, heal: 0 }, knockT: 0, ai: { thinkT: Math.random() * 0.3, strafe: 1, strafeT: 0, stuckT: 0, lastX: 0, lastZ: 0, err: 0 },
    };
    const tag = new THREE.Group();
    const col = team === 0 ? '#8fd0ff' : '#ff8a8a';
    tag.add(nameSprite(hero.name, col));
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, opacity: 0.6, transparent: true, depthWrite: false })); back.scale.set(1.24, 0.14, 1); back.position.y = -0.28;
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: TEAM_COL[team], depthWrite: false })); bar.scale.set(1.2, 0.1, 1); bar.position.y = -0.28;
    tag.add(back, bar); c.tag = tag; c.bar = bar;
    tag.position.y = (c.baseHeight + 0.5) / scale;
    tag.scale.setScalar(1 / scale);
    model.add(tag);
    this.root.add(model);
    this.chars.push(c);
    this.spawn(c);
    return c;
  }

  spawn(c) {
    const s = this.def.spawns[c.team][c.slot];
    c.pos.set(s.x, 0, s.z); c.vel.set(0, 0, 0);
    c.yaw = c.team === 0 ? 0 : Math.PI; c.pitch = 0;
    c.hp = c.maxHp; c.over = 0; c.alive = true; c.st = {}; c.dashS = null; c.landCb = null; c.fireCd = 0.3;
    if (this.time > 1) this.status(c, 'invuln', 1.5, 1);
  }

  buildViewmodel() {
    const L = this.player.hero.look, w = this.player.hero.weapon;
    const v = new THREE.Group();
    const add = (kind, x) => {
      const arm = makeViewArm(L, kind);
      arm.rotation.x = Math.PI / 2; arm.position.set(x, -0.25, -0.16);
      arm.scale.setScalar(1.25);
      v.add(arm); return arm;
    };
    this.vmR = add(L.weapon, L.weapon === 'laptop' ? 0 : 0.24);
    if (L.weapon === 'laptop') this.vmR.position.set(0, -0.33, -0.12);
    this.vmL = L.offhand ? add(L.offhand, -0.24) : null;
    this.vmMelee = !!w.melee;
    v.scale.setScalar(0.8);
    this.view = v;
    this.camera.add(v);
  }

  eye(c, out = new V()) { return out.set(c.pos.x, c.pos.y + c.height * 0.9, c.pos.z); }
  center(c, out = new V()) { return out.set(c.pos.x, c.pos.y + c.height * 0.5, c.pos.z); }
  dist(a, b) { return a.pos.distanceTo(b.pos); }

  // aim direction, with gentle bullet magnetism for touch players
  aim(c, yawOff = 0) {
    const d = dirFrom(c.yaw + yawOff, c.pitch, new V());
    if (c.isPlayer && this.input.touch && !yawOff) {
      const t = this.pick(c, { range: 60, cos: 0.975 });
      if (t) { const to = this.center(t).sub(this.eye(c)).normalize(); d.lerp(to, 0.6).normalize(); }
    }
    return d;
  }

  moveDir(c) {
    const it = c.intent, l = Math.hypot(it.wx, it.wz);
    if (l > 0.2) return { x: it.wx / l, z: it.wz / l };
    return { x: -Math.sin(c.yaw), z: -Math.cos(c.yaw) };
  }

  behind(c, t) {
    const dx = c.pos.x - t.pos.x, dz = c.pos.z - t.pos.z, l = Math.hypot(dx, dz) || 1;
    return (-Math.sin(t.yaw) * dx - Math.cos(t.yaw) * dz) / l < -0.3;
  }

  allies(c, r, self) { return this.chars.filter((a) => a.alive && a.team === c.team && (self || a !== c) && a.pos.distanceTo(c.pos) <= r); }
  alliesOf(c, r, self) { return this.allies(c, r, self); }
  enemies(c, r) { return this.chars.filter((a) => a.alive && a.team !== c.team && a.pos.distanceTo(c.pos) <= r + a.radius); }
  enemiesAt(team, pos, r) { return this.chars.filter((a) => a.alive && a.team !== team && Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) <= r + a.radius && Math.abs(a.pos.y - pos.y) < 3); }
  alliesAt(team, pos, r) { return this.chars.filter((a) => a.alive && a.team === team && Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) <= r && Math.abs(a.pos.y - pos.y) < 3); }

  pick(c, o) {
    const eye = this.eye(c), dir = dirFrom(c.yaw, c.pitch, new V());
    let best = null, bs = -Infinity;
    for (const t of this.chars) {
      if (!t.alive || t === c) continue;
      if (o.ally ? t.team !== c.team : t.team === c.team) continue;
      if (!o.ally && t.st.stealth) continue;
      if (o.hurt && t.hp >= t.maxHp) continue;
      const to = this.center(t).sub(eye), d = to.length();
      if (d > o.range) continue;
      to.divideScalar(d);
      const dot = to.dot(dir);
      const botAlly = o.ally && !c.isPlayer;
      if (!botAlly && dot < o.cos) continue;
      if (!this.world.los(eye, this.center(t))) continue;
      const score = botAlly ? -t.hp / t.maxHp : dot;
      if (score > bs) { bs = score; best = t; }
    }
    return best;
  }

  groundPoint(c, range) {
    const eye = this.eye(c), dir = dirFrom(c.yaw, c.pitch, new V());
    const t = this.world.raycast(eye, dir, range);
    const p = eye.addScaledVector(dir, Math.max(0, t - 0.2));
    const down = this.world.raycast(p, { x: 0, y: -1, z: 0 }, 40);
    p.y = Math.max(0, p.y - down);
    return p;
  }

  // ---- combat primitives ---------------------------------------------------
  status(c, name, dur, v, src) {
    if (!c.alive) return;
    if (c.st.invuln && (name === 'stun' || name === 'slow' || name === 'burn')) return;
    c.st[name] = { t: dur, v, src };
  }

  damage(t, amt, src, o = {}) {
    if (!t.alive || this.over || t.st.invuln || amt <= 0) return 0;
    if (src && src !== t && src.team === t.team) return 0;
    if (src) {
      amt *= (src.st.dmg?.v || 1) * (src.hero.outMul ? src.hero.outMul(this, src, t) : 1);
    }
    const dr = Math.min(0.8, (t.st.dr?.v || 0) + (t.st.dr2?.v || 0) + (t.hero.dr ? t.hero.dr(t) : 0));
    amt *= 1 - dr;
    let left = amt;
    if (t.over > 0) { const a = Math.min(t.over, left); t.over -= a; left -= a; }
    t.hp -= left;
    t.lastHurt = this.time;
    if (src && src !== t) {
      src.stats.dmg += amt; src.ult = Math.min(src.hero.ult.cost, src.ult + amt);
      if (!o.dot && src.hero.onHit) src.hero.onHit(this, src, t, amt);
      if (src.st.lifesteal) this.heal(src, amt * src.st.lifesteal.v, src, true);
      if (src === this.player) this.hud.hit(o.dot);
    }
    if (t === this.player) this.hud.hurt(src, amt);
    if (t.hp <= 0) this.kill(t, src);
    return amt;
  }

  heal(t, amt, src, quiet) {
    if (!t.alive || this.over) return 0;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amt);
    const done = t.hp - before;
    if (src && done > 0) {
      src.stats.heal += done; src.ult = Math.min(src.hero.ult.cost, src.ult + done * (t === src ? 0.5 : 1.2));
      if (!quiet && src.hero.onHeal) src.hero.onHeal(this, src, t);
    }
    return done;
  }

  kill(t, src) {
    t.alive = false; t.hp = 0; t.respawn = RESPAWN; t.st = {}; t.dashS = null; t.over = 0; t.landCb = null;
    t.model.visible = false; t.stats.deaths++;
    this.puff(this.center(t), 1.6, TEAM_COL[t.team]);
    if (src && src !== t) { src.stats.kills++; if (src.hero.onKill && src.alive) src.hero.onKill(this, src, t); }
    if (t.hero.onDeath) t.hero.onDeath(this, t);
    this.hud.killfeed(src, t, this.player);
    this.sfx(t === this.player ? 'dead' : 'kill');
  }

  knock(t, from, force, up = 4) {
    if (!t.alive || t.st.invuln) return;
    let dx = t.pos.x - from.x, dz = t.pos.z - from.z; const l = Math.hypot(dx, dz);
    if (l < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; } else { dx /= l; dz /= l; }
    t.vel.x += dx * force; t.vel.z += dz * force; t.vel.y = Math.max(t.vel.y, up); t.knockT = 0.5; t.dashS = null;
  }

  hitscan(c, o) {
    const eye = this.eye(c), dir = this.aim(c);
    dir.x += (Math.random() - 0.5) * o.spread * 2; dir.y += (Math.random() - 0.5) * o.spread * 2; dir.z += (Math.random() - 0.5) * o.spread * 2; dir.normalize();
    let bt = this.world.raycast(eye, dir, o.range), best = null;
    for (const t of this.chars) {
      if (!t.alive || t.team === c.team) continue;
      const h = rayBox(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, t.pos.x - t.radius, t.pos.y, t.pos.z - t.radius, t.pos.x + t.radius, t.pos.y + t.height, t.pos.z + t.radius, bt);
      if (h >= 0 && h < bt) { bt = h; best = t; }
    }
    const end = eye.clone().addScaledVector(dir, bt);
    this.tracer(this.muzzle(c, dir), end, o.color || 0xffffff);
    if (best) {
      let f = 1;
      if (o.falloff) f = bt <= o.falloff[0] ? 1 : bt >= o.falloff[1] ? 0.5 : 1 - 0.5 * (bt - o.falloff[0]) / (o.falloff[1] - o.falloff[0]);
      this.damage(best, o.dmg * f, c);
    } else if (this.world.lastHit) this.puff(end, 0.25, 0xdddddd, 0.15);
    this.sfx('shot', c);
  }

  muzzle(c, dir) {
    const e = this.eye(c);
    e.y -= 0.18; e.addScaledVector(dir, 0.5);
    e.x += Math.cos(c.yaw) * 0.22; e.z -= Math.sin(c.yaw) * 0.22;
    return e;
  }

  shoot(c, o) {
    const dir = o.dir ? new V(o.dir.x, o.dir.y, o.dir.z).normalize() : this.aim(c, o.yawOff || 0);
    const pos = o.from ? o.from.clone() : this.eye(c).addScaledVector(dir, 0.35);
    if (!o.from) pos.y -= 0.08;
    const mesh = makeProjectile(o.kind);
    mesh.position.copy(pos); this.root.add(mesh);
    this.projs.push({ o, owner: c, team: c.team, pos, vel: dir.multiplyScalar(o.speed), t: o.life || 3, fuse: o.fuse ?? null, bounce: o.bounce || 0, mesh });
    if (!o.from) this.sfx(o.kind === 'code' ? 'slop' : 'throw', c);
  }

  melee(c, o) {
    const eye = this.eye(c), dir = dirFrom(c.yaw, c.pitch, new V());
    let n = 0;
    for (const t of this.chars) {
      if (!t.alive || t.team === c.team) continue;
      const to = this.center(t).sub(eye), d = to.length();
      if (d > o.range + t.radius) continue;
      to.y *= 0.4; to.normalize();
      const flat = new V(dir.x, dir.y * 0.4, dir.z).normalize();
      if (to.dot(flat) < o.arc) continue;
      if (!this.world.los(eye, this.center(t))) continue;
      this.damage(t, o.dmg, c);
      if (o.knock) this.knock(t, c.pos, o.knock, 5);
      if (o.onHit) o.onHit(t);
      n++;
    }
    this.sfx(n ? 'thwack' : 'swing', c);
    return n;
  }

  explode(pos, r, dmg, src, o = {}) {
    this.puff(pos, r, o.color || 0xffb347, 0.35);
    this.sfx('boom');
    for (const t of this.chars) {
      if (!t.alive || t.team === src.team) continue;
      const d = this.center(t).distanceTo(pos);
      if (d > r + t.radius) continue;
      this.damage(t, dmg * (1 - 0.5 * Math.min(1, d / r)), src);
      if (o.knock) this.knock(t, pos, o.knock, o.up ?? 4);
    }
  }

  dash(c, speed, dur, o = {}) {
    const d = dirFrom(c.yaw, 0, new V());
    c.dashS = { vx: d.x * speed, vz: d.z * speed, t: dur, o, hit: new Set() };
    if (o.up) c.vel.y = o.up;
    this.sfx('dash', c);
  }

  leap(c, fwd, up, cb) {
    const d = dirFrom(c.yaw, 0, new V());
    c.vel.set(d.x * fwd, up, d.z * fwd); c.knockT = 0.9; c.landCb = cb; c.leapT = 0.15; c.onGround = false;
    this.sfx('dash', c);
  }

  blink(c, dist) {
    const d = dirFrom(c.yaw, 0, new V());
    const from = new V(c.pos.x, c.pos.y + 0.9, c.pos.z);
    const t = this.world.raycast(from, d, dist + 0.6);
    this.ring(c.pos, 1.2, 0xffe066);
    c.pos.addScaledVector(d, Math.max(0, Math.min(dist, t - 0.6)));
    this.ring(c.pos, 1.2, 0xffe066);
    this.sfx('zap', c);
  }

  cat(c, idx, big, dur) {
    const model = makeCat(idx, big);
    const a = Math.random() * 6.28;
    const pos = new V(c.pos.x + Math.cos(a) * 0.8, c.pos.y + 0.2, c.pos.z + Math.sin(a) * 0.8);
    model.position.copy(pos); this.root.add(model);
    this.cats.push({ owner: c, team: c.team, pos, vel: new V(), t: dur, big, model, bite: 0.3, name: CAT_NAMES[idx] });
    this.puff(pos, 0.8, 0xffffff, 0.25); this.sfx('meow', c);
  }

  zone(o) {
    const g = new THREE.Group();
    const col = o.color || 0xffffff;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(o.r, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(o.r - 0.15, o.r, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = ring.rotation.x = -Math.PI / 2; g.add(disc, ring);
    if (o.fire) for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(GEO.BOX, mat(i % 2 ? 0xffd166 : 0xff6b1a, true)); f.scale.set(0.35, 0.9, 0.35);
      f.position.set(Math.cos(i * 1.26) * 0.4, 0.45, Math.sin(i * 1.26) * 0.4); g.add(f);
    }
    if (o.prop) { const p = makeProjectile(o.prop); p.position.y = 0.1; g.add(p); disc.visible = false; ring.material.opacity = o.owner.team === this.player.team ? 0.5 : 0.12; }
    this.root.add(g);
    const z = { ...o, t: o.dur, mesh: g, pos: o.pos || o.follow.pos };
    g.position.copy(z.pos); g.position.y += 0.07;
    this.zones.push(z);
    return z;
  }

  // ---- fx ------------------------------------------------------------------
  puff(pos, r, color, life = 0.3) {
    const m = new THREE.Mesh(GEO.SPH, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.copy(pos); this.root.add(m);
    this.fx.push({ m, t: life, life, f: (k) => { const s = r * 2 * (0.3 + 0.7 * k); m.scale.set(s, s, s); m.material.opacity = 0.7 * (1 - k); } });
  }

  ring(pos, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, pos.y + 0.12, pos.z); this.root.add(m);
    this.fx.push({ m, t: 0.45, life: 0.45, own: true, f: (k) => { const s = r * (0.15 + 0.85 * k); m.scale.set(s, s, s); m.material.opacity = 0.9 * (1 - k); } });
  }

  tracer(a, b, color) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(GEO.BOX, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.scale.set(0.03, 0.03, len); this.root.add(m);
    this.fx.push({ m, t: 0.07, life: 0.07, f: (k) => { m.material.opacity = 0.8 * (1 - k); } });
  }

  beam(a, target, color) {
    const b = target.pos ? this.center(target) : target;
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(GEO.BOX, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.scale.set(0.08, 0.08, len); this.root.add(m);
    this.fx.push({ m, t: 0.3, life: 0.3, f: (k) => { m.material.opacity = 0.9 * (1 - k); } });
  }

  sfx(name, c) {
    let vol = 1;
    if (c && c !== this.player) { const d = c.pos.distanceTo(this.player.pos); vol = Math.max(0, 1 - d / 40) * 0.6; }
    if (vol > 0.02) this.audio.play(name, vol);
  }

  // ---- per-frame -----------------------------------------------------------
  update(dt) {
    this.time += dt;
    if (this.countdown > 0) { this.countdown -= dt; }
    const frozen = this.countdown > 0 || this.over;
    this.readPlayer(dt, frozen);
    for (const c of this.chars) {
      if (!c.isPlayer && c.alive && !frozen) botThink(this, c, dt);
      this.updateChar(c, dt, frozen);
    }
    if (!frozen) {
      for (const p of this.projs) this.updateProj(p, dt);
      this.projs = this.projs.filter((p) => !p.dead);
      this.updateZones(dt); this.updateCats(dt); this.updatePoint(dt); this.updatePacks(dt);
    }
    for (const f of this.fx) { f.t -= dt; f.f(1 - Math.max(0, f.t) / f.life); if (f.t <= 0) { this.root.remove(f.m); f.m.material.dispose(); if (f.own) f.m.geometry.dispose(); } }
    this.fx = this.fx.filter((f) => f.t > 0);
    this.updateCamera(dt);
    this.hud.update(this);
  }

  readPlayer(dt, frozen) {
    const c = this.player, inp = this.input, it = c.intent;
    const look = inp.consumeLook();
    c.yaw -= look.x; c.pitch = Math.max(-1.45, Math.min(1.45, c.pitch - look.y));
    if (frozen || !c.alive) { it.wx = it.wz = 0; it.fire = it.jump = it.ult = false; it.ab = [false, false, false]; return; }
    const f = inp.move.y, r = inp.move.x; // forward / right
    it.wx = -Math.sin(c.yaw) * f + Math.cos(c.yaw) * r;
    it.wz = -Math.cos(c.yaw) * f - Math.sin(c.yaw) * r;
    it.jump = inp.jump;
    it.fire = inp.fire;
    if (!it.fire && inp.touch && inp.autoFire) {
      const w = c.hero.weapon;
      const t = this.pick(c, { range: w.melee ? w.range + 0.4 : w.range, cos: w.melee ? 0.75 : 0.985 });
      if (t) it.fire = true;
    }
    for (let i = 0; i < 3; i++) it.ab[i] = inp.consume('ab' + i);
    it.ult = inp.consume('ult');
  }

  updateChar(c, dt, frozen) {
    if (!c.alive) {
      c.respawn -= dt;
      if (c.respawn <= 0 && !this.over) { this.spawn(c); }
      return;
    }
    const hero = c.hero, st = c.st;
    // statuses
    for (const k in st) {
      const s = st[k];
      if (k === 'burn') this.damage(c, s.v * dt, s.src, { dot: true });
      else if (k === 'hot') this.heal(c, s.v * dt, s.src, true);
      if (!c.alive) return;
      s.t -= dt; if (s.t <= 0) delete st[k];
    }
    if (hero.tick && !frozen) hero.tick(this, c, dt);
    c.ult = Math.min(hero.ult.cost, c.ult + (frozen ? 0 : 7 * dt));
    for (let i = 0; i < 3; i++) c.cd[i] = Math.max(0, c.cd[i] - dt);
    c.fireCd -= dt; c.attackT = Math.max(0, c.attackT - dt * 5); c.castT = Math.max(0, c.castT - dt); c.knockT = Math.max(0, c.knockT - dt);
    const big = hero.big ? hero.big(c) : 1;
    c.height = c.baseHeight * big;

    const stunned = !!st.stun || frozen;
    const it = c.intent;
    // actions
    if (!stunned) {
      for (let i = 0; i < 3; i++) if (it.ab[i]) this.useAbility(c, i);
      if (it.ult) this.useUlt(c);
      if (it.fire && c.fireCd <= 0) {
        const w = hero.weapon;
        c.fireCd = 1 / (w.rate * (hero.rateMul ? hero.rateMul(c) : 1) * (st.rate?.v || 1));
        c.attackT = 1;
        w.fire(this, c);
      }
    }
    // movement
    const speed = stunned ? 0 : hero.speed * (st.speed?.v || 1) * (st.slow?.v || 1);
    let wx = it.wx, wz = it.wz; const l = Math.hypot(wx, wz);
    if (l > 1) { wx /= l; wz /= l; }
    if (c.dashS) {
      const d = c.dashS;
      c.vel.x = d.vx; c.vel.z = d.vz; d.t -= dt;
      for (const t of this.chars) {
        if (!t.alive || t.team === c.team || d.hit.has(t)) continue;
        if (Math.hypot(t.pos.x - c.pos.x, t.pos.z - c.pos.z) < c.radius + t.radius + 0.7 && Math.abs(t.pos.y - c.pos.y) < 2) {
          d.hit.add(t);
          if (d.o.dmg) this.damage(t, d.o.dmg, c);
          if (d.o.knock) this.knock(t, c.pos, d.o.knock, 5);
          if (!d.o.pierce) d.t = 0;
        }
      }
      if (d.t <= 0) { c.dashS = null; c.vel.x *= 0.3; c.vel.z *= 0.3; }
    } else {
      const k = Math.min(1, (c.knockT > 0 ? 1.5 : c.onGround ? 14 : 4) * dt);
      c.vel.x += (wx * speed - c.vel.x) * k; c.vel.z += (wz * speed - c.vel.z) * k;
    }
    if (it.jump && c.onGround && !stunned) { c.vel.y = JUMP; c.onGround = false; }
    c.vel.y -= GRAV * dt;
    c.onGround = this.world.move(c.pos, c.vel, c.radius, c.height, dt);
    if (c.landCb) { c.leapT -= dt; if (c.onGround && c.leapT <= 0) { const cb = c.landCb; c.landCb = null; cb(); } }

    // model
    const m = c.model;
    m.visible = c !== this.player && !(st.stealth && c.team !== this.player.team);
    m.position.copy(c.pos); m.rotation.y = c.yaw;
    const w = hero.weapon;
    animateCharacter(m, { speed: Math.hypot(c.vel.x, c.vel.z), attackT: c.attackT, castT: c.castT, castKind: c.castKind, pitch: c.pitch, ranged: !w.melee, twoHand: w.twoHand, big }, dt, this.time);
    const frac = Math.max(0.001, c.hp / c.maxHp);
    c.bar.scale.x = 1.2 * frac;
    c.bar.material.color.set(st.invuln ? 0xffffff : c.over > 0 ? 0x9ad1ff : TEAM_COL[c.team]);
  }

  useAbility(c, i) {
    const ab = c.hero.abilities[i];
    if (c.cd[i] > 0) return false;
    if (ab.use(this, c) === false) return false;
    c.cd[i] = ab.cd;
    if (ab.cast != null) { c.castT = 0.7; c.castKind = ab.cast; }
    this.sfx('cast', c);
    return true;
  }

  useUlt(c) {
    const u = c.hero.ult;
    if (c.ult < u.cost) return false;
    c.ult = 0;
    u.use(this, c);
    if (u.cast != null) { c.castT = u.castDur || 1; c.castKind = u.cast; }
    this.hud.ultCall(c, this.player);
    this.sfx('ult');
    return true;
  }

  updateProj(p, dt) {
    const o = p.o;
    p.t -= dt;
    if (p.fuse != null) { p.fuse -= dt; if (p.fuse <= 0) return this.endProj(p); }
    if (p.t <= 0) return this.endProj(p);
    p.vel.y -= (o.gravity || 0) * dt;
    const len = p.vel.length() * dt;
    if (len < 1e-5) return;
    const dir = p.vel.clone().normalize();
    const tW = this.world.raycast(p.pos, dir, len), hitW = this.world.lastHit;
    const n = hitW ? { ...this.world.hitN } : null;
    let best = null, bt = tW;
    for (const t of this.chars) {
      if (!t.alive || t === p.owner) continue;
      const ally = t.team === p.team;
      if (ally && (!o.heal || t.hp >= t.maxHp)) continue;
      const r = o.r || 0.2;
      const h = rayBox(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, t.pos.x - t.radius - r, t.pos.y - r, t.pos.z - t.radius - r, t.pos.x + t.radius + r, t.pos.y + t.height + r, t.pos.z + t.radius + r, bt);
      if (h >= 0 && h <= bt) { bt = h; best = t; }
    }
    if (best) {
      p.pos.addScaledVector(dir, bt);
      if (best.team === p.team) { this.heal(best, o.heal, p.owner); this.puff(p.pos, 0.6, 0x8cffb0, 0.25); if (p.owner === this.player) this.hud.hit(true); }
      else {
        this.damage(best, o.dmg, p.owner);
        if (o.knock) this.knock(best, { x: p.pos.x - dir.x, z: p.pos.z - dir.z }, o.knock, 5);
        if (o.onHit) o.onHit(best);
      }
      return this.endProj(p);
    }
    if (hitW) {
      p.pos.addScaledVector(dir, Math.max(0, tW - 0.03));
      if (p.bounce > 0) {
        p.bounce--;
        const d = p.vel.x * n.x + p.vel.y * n.y + p.vel.z * n.z;
        p.vel.x -= 2 * d * n.x; p.vel.y -= 2 * d * n.y; p.vel.z -= 2 * d * n.z;
        p.vel.multiplyScalar(0.55);
        p.mesh.position.copy(p.pos);
        return;
      }
      return this.endProj(p);
    }
    p.pos.addScaledVector(dir, len);
    p.mesh.position.copy(p.pos);
    if (o.spin) { p.mesh.rotation.x += o.spin * dt; p.mesh.rotation.z += o.spin * 0.6 * dt; }
    else if (o.kind === 'knife') p.mesh.lookAt(p.pos.x + dir.x, p.pos.y + dir.y, p.pos.z + dir.z);
  }

  endProj(p) {
    const o = p.o;
    if (o.splash) this.explode(p.pos, o.splash, o.splashDmg, p.owner, { color: o.color });
    else if (o.kind === 'code') this.puff(p.pos, 0.35, 0x39ff88, 0.15);
    if (o.onEnd) o.onEnd(p.pos);
    this.root.remove(p.mesh); p.dead = true;
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t -= dt;
      if (z.follow) { if (!z.follow.alive) z.t = 0; z.mesh.position.copy(z.follow.pos); z.mesh.position.y += 0.07; }
      if (z.t > 0) z.tick(z, dt);
      if (z.rain && Math.random() < dt * 30) {
        const s = makeCodeSprite(1.1); const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * z.r;
        s.position.set(z.pos.x + Math.cos(a) * r, z.pos.y + 9, z.pos.z + Math.sin(a) * r); this.root.add(s);
        const y0 = s.position.y;
        this.fx.push({ m: { material: { dispose() {} } }, t: 0.5, life: 0.5, f: (k) => { s.position.y = y0 - 9 * k; if (k >= 1) this.root.remove(s); } });
      }
      if (z.t <= 0) { this.root.remove(z.mesh); z.mesh.traverse((m) => { if (m.geometry && m.geometry.type !== 'BoxGeometry' && m.geometry !== GEO.CYL && m.geometry !== GEO.SPH) m.geometry.dispose(); }); }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  updateCats(dt) {
    for (const cat of this.cats) {
      cat.t -= dt; cat.bite -= dt;
      let best = null, bd = 60;
      for (const t of this.chars) {
        if (!t.alive || t.team === cat.team || t.st.stealth) continue;
        const d = t.pos.distanceTo(cat.pos); if (d < bd) { bd = d; best = t; }
      }
      const sp = cat.big ? 9.5 : 8.5;
      if (best) {
        const dx = best.pos.x - cat.pos.x, dz = best.pos.z - cat.pos.z, l = Math.hypot(dx, dz) || 1;
        const reach = best.radius + (cat.big ? 1.3 : 0.9);
        const want = l > reach * 0.8 ? sp : 0;
        const px = cat.pos.x, pz = cat.pos.z;
        cat.vel.x = dx / l * want; cat.vel.z = dz / l * want;
        cat.vel.y -= GRAV * dt;
        const g = this.world.move(cat.pos, cat.vel, 0.25, 0.5, dt);
        if (g && want && Math.hypot(cat.pos.x - px, cat.pos.z - pz) < want * dt * 0.4) cat.vel.y = 7.5; // hop over things
        cat.model.rotation.y = Math.atan2(-dx, -dz);
        if (l < reach && Math.abs(best.pos.y - cat.pos.y) < 2 && cat.bite <= 0) {
          cat.bite = 0.5; this.damage(best, cat.big ? 30 : 15, cat.owner); this.puff(this.center(best), 0.4, 0xffffff, 0.12);
        }
      } else { cat.vel.set(0, cat.vel.y - GRAV * dt, 0); this.world.move(cat.pos, cat.vel, 0.25, 0.5, dt); }
      cat.model.position.copy(cat.pos);
      cat.model.position.y += Math.abs(Math.sin(this.time * 14)) * 0.08;
      if (cat.t <= 0) { this.root.remove(cat.model); this.puff(cat.pos, 0.7, 0xffffff, 0.25); }
    }
    this.cats = this.cats.filter((c) => c.t > 0);
  }

  updatePoint(dt) {
    const P = this.point, d = this.def.point, py = d.y || 0;
    P.on = [0, 0];
    for (const c of this.chars) {
      if (c.alive && Math.hypot(c.pos.x - d.x, c.pos.z - d.z) <= d.r && Math.abs(c.pos.y - py) < 2.5) P.on[c.team]++;
    }
    const alone = P.on[0] && !P.on[1] ? 0 : P.on[1] && !P.on[0] ? 1 : -1;
    if (alone >= 0 && alone !== P.owner) {
      if (P.capTeam !== alone) { P.cap -= dt * 1.5; if (P.cap <= 0) { P.cap = 0; P.capTeam = alone; } }
      else {
        P.cap += dt / CAP_TIME * (1 + 0.25 * (P.on[alone] - 1));
        if (P.cap >= 1) {
          P.owner = alone; P.cap = 0; P.capTeam = -1;
          this.hud.banner(alone === this.player.team ? 'POINT CAPTURED' : 'POINT LOST', alone === this.player.team);
          this.sfx('cap');
        }
      }
    } else if (!P.on[0] && !P.on[1] || alone === P.owner) P.cap = Math.max(0, P.cap - dt * 0.5);
    if (P.owner >= 0) {
      const enemyOn = P.on[1 - P.owner] > 0;
      P.overtime = P.score[P.owner] >= 99 && enemyOn;
      if (!P.overtime) P.score[P.owner] = Math.min(100, P.score[P.owner] + dt * 100 / WIN_TIME);
      if (P.score[P.owner] >= 100) this.end(P.owner);
    }
    const col = P.owner < 0 ? 0xffffff : TEAM_COL[P.owner === this.player.team ? 0 : 1];
    this.world.pointRing.material.color.set(col); this.world.pointDisc.material.color.set(col);
    this.world.pointDisc.material.opacity = 0.14 + 0.06 * Math.sin(this.time * 3);
  }

  updatePacks(dt) {
    for (const p of this.packs) {
      if (p.cd > 0) { p.cd -= dt; p.mesh.visible = p.cd <= 0; continue; }
      p.mesh.rotation.y += dt * 2;
      for (const c of this.chars) {
        if (!c.alive || c.hp >= c.maxHp) continue;
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 1.3 && c.pos.y < 1.5) {
          this.heal(c, 75); p.cd = 12; p.mesh.visible = false;
          if (c === this.player) this.sfx('jingle');
          break;
        }
      }
    }
  }

  end(team) {
    if (this.over) return;
    this.over = true; this.winner = team;
    this.sfx(team === this.player.team ? 'win' : 'lose');
    this.hud.showEnd(this, team === this.player.team);
  }

  updateCamera(dt) {
    const c = this.player, cam = this.camera;
    cam.rotation.order = 'YXZ';
    if (c.alive) {
      this.eye(c, cam.position);
      cam.rotation.set(c.pitch, c.yaw, 0);
      this.deadCam = 0;
    } else {
      this.deadCam = Math.min(1, (this.deadCam || 0) + dt * 0.8);
      cam.position.set(c.pos.x, c.pos.y + 1.6 + this.deadCam * 6, c.pos.z + this.deadCam * 4);
      cam.rotation.set(-0.3 - this.deadCam * 0.7, 0, 0);
    }
    // first-person weapon
    const v = this.view; v.visible = c.alive;
    const sp = Math.hypot(c.vel.x, c.vel.z), bob = Math.sin(this.time * 10) * 0.012 * Math.min(1, sp / 5);
    v.position.set(0, bob, 0);
    const a = c.attackT;
    if (this.vmMelee) {
      this.vmR.rotation.x = Math.PI / 2 + 0.5 + (a > 0 ? (a - 0.5) * 2.2 : 0);
      this.vmR.rotation.z = a > 0 ? -0.5 * a : 0;
      if (this.vmL) this.vmL.rotation.x = Math.PI / 2 + 0.5 + (a > 0 ? (0.5 - a) * 1.6 : 0);
    } else {
      this.vmR.rotation.x = Math.PI / 2 + a * 0.25; this.vmR.position.z = (this.vmR.userData.z ?? (this.vmR.userData.z = this.vmR.position.z)) + a * 0.06;
    }
  }
}
