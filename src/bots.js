// Bot brains: pick a target, path toward a goal on the nav grid, aim with a bit of human error, press buttons on hints.
const ERR = 0.05;      // aim wobble in radians
const TURN = 7;        // rad/s

function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

function decide(g, c) {
  const ai = c.ai, w = c.hero.weapon, eye = g.eye(c);
  // nearest visible enemy
  let target = null, bd = 45;
  for (const t of g.chars) {
    if (!t.alive || t.team === c.team || t.st.stealth) continue;
    const d = t.pos.distanceTo(c.pos);
    if (d < bd && g.world.los(eye, g.center(t))) { bd = d; target = t; }
  }
  ai.target = target; ai.dist = bd;
  // supports look for someone to patch up
  ai.healT = null;
  if (c.hero.role === 'support') {
    let lf = 0.8;
    for (const a of g.chars) {
      if (!a.alive || a.team !== c.team || a === c) continue;
      const f = a.hp / a.maxHp;
      if (f < lf && a.pos.distanceTo(c.pos) < 30 && g.world.los(eye, g.center(a))) { lf = f; ai.healT = a; }
    }
  }
  // where to go
  const P = g.def.point;
  if (!ai.spot || Math.random() < 0.03) { const a = Math.random() * 6.28, r = Math.random() * P.r * 0.7; ai.spot = { x: P.x + Math.cos(a) * r, z: P.z + Math.sin(a) * r }; }
  let goal = ai.spot;
  if (target) {
    // fight around the objective; never chase people back into their spawn
    const nearPoint = Math.hypot(target.pos.x - P.x, target.pos.z - P.z) < 19;
    if (w.melee) { if (nearPoint || bd < 7) goal = target.pos; }
    else if (bd > w.range * 0.85 && nearPoint) goal = target.pos;
  } else if (ai.healT && ai.healT.pos.distanceTo(c.pos) > 9) goal = ai.healT.pos;
  ai.goal = goal;
  ai.path = g.world.findPath(c.pos.x, c.pos.z, goal.x, goal.z);
  ai.err = (Math.random() - 0.5) * 2 * ERR;
  ai.errP = (Math.random() - 0.5) * ERR;

  // ability hints
  const hpF = c.hp / c.maxHp;
  const want = (h) => {
    if (!h) return false;
    switch (h.k) {
      case 'dmg': return target && bd < h.r && ai.aimed;
      case 'melee': return target && bd < h.r;
      case 'gap': return (target && bd > h.min && bd < h.max && ai.aimed) || (h.flee && target && hpF < 0.3);
      case 'self': return hpF < h.hp && (!h.enemy || (target && bd < h.enemy));
      case 'flee': return hpF < h.hp && target && bd < (h.enemy || 16);
      case 'buff': return target && bd < h.r;
      case 'heal': {
        if (h.enemy && !(target && bd < h.enemy)) return false;
        for (const a of g.chars) if (a.alive && a.team === c.team && a.hp / a.maxHp < h.hp && a.pos.distanceTo(c.pos) < h.r) return true;
        return false;
      }
    }
    return false;
  };
  ai.press = [false, false, false]; ai.pressUlt = false;
  if (Math.random() < 0.6) {
    c.hero.abilities.forEach((ab, i) => {
      if (c.cd[i] <= 0 && want(ab.ai)) {
        ai.press[i] = true;
        if ((ab.ai.k === 'flee' || (ab.ai.flee && hpF < 0.3)) && target) c.yaw = Math.atan2(c.pos.x - target.pos.x, c.pos.z - target.pos.z) + Math.PI; // turn tail
      }
    });
    if (c.ult >= c.hero.ult.cost && want(c.hero.ult.ai)) ai.pressUlt = true;
  }
}

export function botThink(g, c, dt) {
  const ai = c.ai, it = c.intent, w = c.hero.weapon;
  it.fire = false; it.jump = false; it.ult = false; it.ab[0] = it.ab[1] = it.ab[2] = false;
  ai.thinkT -= dt;
  if (ai.thinkT <= 0) {
    ai.thinkT = 0.3 + Math.random() * 0.15;
    decide(g, c);
    for (let i = 0; i < 3; i++) it.ab[i] = ai.press[i];
    it.ult = ai.pressUlt;
  }
  const target = ai.target && ai.target.alive ? ai.target : null;

  // --- steering
  let mx = 0, mz = 0;
  const goal = ai.goal || c.pos;
  const dGoal = Math.hypot(goal.x - c.pos.x, goal.z - c.pos.z);
  const stopAt = target && goal === target.pos ? (w.melee ? w.range * 0.6 + target.radius : w.range * 0.7) : 0.8;
  if (dGoal > stopAt) {
    let wp = goal;
    if (ai.path && ai.path.length) {
      // drop waypoints we have already reached
      while (ai.path.length > 1 && Math.hypot(ai.path[0].x - c.pos.x, ai.path[0].z - c.pos.z) < 0.9) ai.path.shift();
      wp = ai.path[0];
    }
    const dx = wp.x - c.pos.x, dz = wp.z - c.pos.z, l = Math.hypot(dx, dz) || 1;
    mx = dx / l; mz = dz / l;
  }
  // ranged heroes strafe while fighting
  if (target && !w.melee && ai.dist < w.range) {
    ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = 0.6 + Math.random() * 1.2; ai.strafe = Math.random() < 0.5 ? -1 : 1; }
    const dx = target.pos.x - c.pos.x, dz = target.pos.z - c.pos.z, l = Math.hypot(dx, dz) || 1;
    mx += -dz / l * ai.strafe * 0.8; mz += dx / l * ai.strafe * 0.8;
  }
  // unstick: if we want to move but are not moving, hop and sidestep
  ai.stuckT += dt;
  if (ai.stuckT > 0.6) {
    const moved = Math.hypot(c.pos.x - ai.lastX, c.pos.z - ai.lastZ);
    if ((mx || mz) && moved < 0.35) { it.jump = true; ai.sideT = 0.45; ai.side = Math.random() < 0.5 ? -1 : 1; }
    ai.stuckT = 0; ai.lastX = c.pos.x; ai.lastZ = c.pos.z;
  }
  if (ai.sideT > 0) { ai.sideT -= dt; const ox = mx; mx = -mz * ai.side; mz = ox * ai.side; }
  it.wx = mx; it.wz = mz;

  // --- aiming
  const sling = w.name === 'Slingshot';
  const healAim = sling && ai.healT && ai.healT.alive && (!target || ai.healT.hp / ai.healT.maxHp < 0.55);
  let wantYaw = c.yaw, wantPitch = 0;
  const aimAt = healAim ? ai.healT : target;
  if (aimAt) {
    const tc = g.center(aimAt), eye = g.eye(c);
    let dx = tc.x - eye.x, dy = tc.y - eye.y, dz = tc.z - eye.z;
    const d = Math.hypot(dx, dz);
    if (w.pspeed) { const tt = d / w.pspeed; dx += aimAt.vel.x * tt; dz += aimAt.vel.z * tt; }
    wantYaw = Math.atan2(-dx, -dz) + ai.err;
    wantPitch = Math.atan2(dy, d) + ai.errP;
    if (w.lob) wantPitch += 0.5 * Math.asin(Math.min(1, w.lob * d / (w.pspeed * w.pspeed)));
  } else if (mx || mz) wantYaw = Math.atan2(-mx, -mz);
  const dy = angDiff(wantYaw, c.yaw), step = TURN * dt;
  c.yaw += Math.max(-step, Math.min(step, dy));
  c.pitch += Math.max(-step, Math.min(step, wantPitch - c.pitch));
  ai.aimed = !!target && Math.abs(dy) < (w.melee ? 0.5 : 0.16);

  // --- trigger
  if (healAim) { if (Math.abs(dy) < 0.16) it.fire = true; }
  else if (target && ai.aimed) {
    const reach = w.melee ? w.range + target.radius : w.range;
    if (ai.dist < reach) it.fire = true;
  }
}
