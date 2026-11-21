// Hero roster. Each hero: weapon, passive, 3 abilities, ultimate, and a "look" for the procedural model.
// Abilities call into the Game API (g). `ai` hints tell bots when to press the button.

import { LOOKS } from './looks.js';

const mason = {
  id: 'mason', name: 'Mason', role: 'dps', tagline: 'Wife guy. Cat dad. Red Devil.',
  hp: 200, speed: 6.5, radius: 0.4,
  weapon: {
    name: 'Sidearm', icon: '🔫', rate: 4.5, range: 40, ranged: true,
    fire: (g, c) => g.hitscan(c, { dmg: 20, range: 60, spread: 0.012, falloff: [22, 45], color: 0xffd27a }),
  },
  passive: { name: 'Wife Guy', icon: '💍', desc: 'Eliminations heal 40 and give a burst of speed. He has to go tell his wife.' },
  onKill: (g, c) => { g.heal(c, 40, c); g.status(c, 'speed', 3, 1.3); },
  abilities: [
    {
      name: "Sic 'Em", icon: '🐈', cd: 9, desc: 'Send Bruno, Murphy or Wanda (they take turns) to hunt the nearest enemy for 8s.', ai: { k: 'dmg', r: 30 },
      use: (g, c) => { g.cat(c, c.catIdx = ((c.catIdx || 0) + 1) % 3, false, 8); },
    },
    {
      name: 'Top Bins', icon: '⚽', cd: 7, desc: 'Strike a football that hits for 65 and sends the target flying.', ai: { k: 'dmg', r: 25 },
      use: (g, c) => g.shoot(c, { kind: 'ball', speed: 34, gravity: 6, dmg: 65, r: 0.45, bounce: 2, knock: 13, life: 3, spin: 9 }),
    },
    {
      name: 'Flash', icon: '⚡', cd: 8, desc: 'Blink forward instantly. Summoner spell diff.', ai: { k: 'gap', min: 9, max: 22, flee: true },
      use: (g, c) => g.blink(c, 8),
    },
  ],
  ult: {
    name: 'Cat-astrophe', icon: '🐈‍⬛', cost: 1100, desc: 'Bruno, Murphy and Wanda all arrive at once, huge and furious, for 10s. Mason speeds up.', ai: { k: 'dmg', r: 22 },
    use: (g, c) => { for (let i = 0; i < 3; i++) g.cat(c, i, true, 10); g.status(c, 'speed', 10, 1.25); },
  },
};

const cole = {
  id: 'cole', name: 'Cole', role: 'dps', tagline: 'Hotty Toddy. Nine iron. Wings.',
  hp: 250, speed: 6.0, radius: 0.42,
  weapon: {
    name: 'Nine Iron', icon: '🏌️', rate: 1.5, range: 3, melee: true,
    fire: (g, c) => {
      const tee = c.st.teeoff, wings = c.st.wings;
      const n = g.melee(c, {
        dmg: tee ? 115 : 50, range: tee ? 3.6 : 3.0, arc: c.st.ultCole ? 0.2 : 0.5, knock: tee ? 16 : 0,
        onHit: (t) => { if (wings) g.status(t, 'burn', 3, 15, c); },
      });
      if (tee) { delete c.st.teeoff; g.sfx('boom'); }
      if (n) { c.stacks = Math.min(5, (c.stacks || 0) + 1); c.stackT = 4; }
    },
  },
  passive: { name: 'Hotty Toddy', icon: '🦈', desc: 'Each swing that lands adds 8% attack speed, stacking 5 times.' },
  rateMul: (c) => 1 + 0.08 * (c.stacks || 0),
  tick: (g, c, dt) => { if (c.stacks) { c.stackT -= dt; if (c.stackT <= 0) c.stacks = 0; } },
  abilities: [
    {
      name: 'Wing Night', icon: '🍗', cd: 10, desc: 'Wings from The Local: heal 50 and your swings set enemies on fire for 5s.', ai: { k: 'melee', r: 7 },
      use: (g, c) => { g.heal(c, 50, c); g.status(c, 'wings', 5, 1); },
    },
    {
      name: 'Tee Off', icon: '⛳', cd: 7, desc: 'Your next swing is a full drive: 115 damage and a massive knockback.', ai: { k: 'melee', r: 5 },
      use: (g, c) => { g.status(c, 'teeoff', 5, 1); c.fireCd = Math.min(c.fireCd, 0.15); },
    },
    {
      name: 'Rebel Rush', icon: '💨', cd: 8, desc: 'Charge forward, hitting the first enemy for 40 and knocking them back.', ai: { k: 'gap', min: 5, max: 14 },
      use: (g, c) => g.dash(c, 22, 0.38, { dmg: 40, knock: 9 }),
    },
  ],
  ult: {
    name: 'Are You Ready?!', icon: '📣', cost: 1200, desc: '8s of game-day energy: +50% damage, +25% speed, wide swings and lifesteal.', ai: { k: 'melee', r: 8 },
    use: (g, c) => { g.status(c, 'dmg', 8, 1.5); g.status(c, 'speed', 8, 1.25); g.status(c, 'lifesteal', 8, 0.3); g.status(c, 'ultCole', 8, 1); },
  },
};

const james = {
  id: 'james', name: 'James', role: 'tank', tagline: 'Gym bro with a new job and a lunchbox.',
  hp: 550, speed: 5.3, radius: 0.55,
  weapon: {
    name: 'Fists', icon: '👊', rate: 2.2, range: 2.6, melee: true, twoHand: true,
    fire: (g, c) => {
      const ult = c.st.ultJames;
      const n = g.melee(c, { dmg: 38, range: ult ? 3.4 : 2.6, arc: 0.45, knock: ult ? 9 : 0 });
      if (n) { c.over = Math.min(Math.max(c.over, 150), c.over + 12 * n); c.overT = 3; }
    },
  },
  passive: { name: 'The Pump', icon: '💪', desc: 'Landing punches builds temporary bonus health, up to 150.' },
  outMul: (g, c) => (c.st.ultJames ? 1.6 : 1),
  tick: (g, c, dt) => { if (c.over > 0 && !c.st.ultJames) { c.overT -= dt; if (c.overT <= 0) c.over = Math.max(0, c.over - 12 * dt); } },
  abilities: [
    {
      name: 'Uncrustable', icon: '🥪', cd: 10, desc: 'Scarf one down: heal 150 over 3 seconds.', ai: { k: 'self', hp: 0.6 },
      use: (g, c) => g.status(c, 'hot', 3, 50, c),
    },
    {
      name: 'Flex', icon: '🦾', cd: 9, desc: 'Flex for 3.5s, taking half damage.', ai: { k: 'self', hp: 0.75, enemy: 12 },
      use: (g, c) => g.status(c, 'dr', 3.5, 0.5),
    },
    {
      name: 'Leg Day', icon: '🦵', cd: 8, desc: 'Leap at the enemy and slam: 50 damage and a slow to everyone nearby.', ai: { k: 'gap', min: 5, max: 16 },
      use: (g, c) => {
        g.leap(c, 14, 8.5, () => {
          g.ring(c.pos, 5, 0xffb703);
          for (const t of g.enemies(c, 5)) { g.damage(t, 50, c); g.status(t, 'slow', 2, 0.6); }
          g.sfx('boom');
        });
      },
    },
  ],
  ult: {
    name: 'First Day Energy', icon: '💼', cost: 1300, desc: 'New job, who dis. Grow huge for 8s: +250 bonus health, +60% damage, punches launch people.', ai: { k: 'melee', r: 9 },
    use: (g, c) => { g.status(c, 'ultJames', 8, 1); c.over += 250; c.overT = 8; },
  },
  big: (c) => (c.st.ultJames ? 1.4 : 1),
};

const cam = {
  id: 'cam', name: 'Cam', role: 'dps', tagline: 'AI engineer. Ships slop at range.',
  hp: 200, speed: 5.7, radius: 0.4,
  weapon: {
    name: 'AI Slop', icon: '💻', rate: 3.6, range: 38, ranged: true, twoHand: true, pspeed: 46,
    fire: (g, c) => { if (c.st.stealth) delete c.st.stealth; g.shoot(c, { kind: 'code', speed: 46, dmg: 24, r: 0.3, life: 1.6 }); },
  },
  passive: { name: 'Fine-Tuned', icon: '🧠', desc: 'Every hit shaves 0.4s off his ability cooldowns.' },
  onHit: (g, c) => { for (let i = 0; i < 3; i++) c.cd[i] = Math.max(0, c.cd[i] - 0.4); },
  abilities: [
    {
      name: 'Overheat', icon: '🔥', cd: 8, desc: 'Quickhack the enemy in your sights: 80 burn damage over 4s. Preem.', ai: { k: 'dmg', r: 32 },
      use: (g, c) => {
        const t = g.pick(c, { range: 35, cos: 0.93 });
        if (!t) return false;
        g.status(t, 'burn', 4, 20, c); g.beam(g.eye(c), t, 0xfcee0a); g.sfx('zap');
      },
    },
    {
      name: 'Hallucinate', icon: '👻', cd: 12, desc: 'Confidently vanish for 3.5s and move faster. Attacking ends it.', ai: { k: 'flee', hp: 0.45 },
      use: (g, c) => { g.status(c, 'stealth', 3.5, 1); g.status(c, 'speed', 3.5, 1.35); },
    },
    {
      name: 'Heater', icon: '⚾', cd: 7, desc: 'A 100mph fastball: 60 damage and a short stun.', ai: { k: 'dmg', r: 28 },
      use: (g, c) => g.shoot(c, { kind: 'baseball', speed: 72, dmg: 60, r: 0.3, life: 1.2, onHit: (t) => g.status(t, 'stun', 0.8, 1) }),
    },
  ],
  ult: {
    name: 'Push to Prod', icon: '🚀', cost: 1200, desc: 'Deploy on a Friday. Code rains on the targeted area for 6s, 45 damage per second.', ai: { k: 'dmg', r: 26 },
    use: (g, c) => {
      const pos = g.groundPoint(c, 30);
      g.zone({ pos, r: 7, dur: 6, owner: c, color: 0x39ff88, rain: true, tick: (z, dt) => { for (const t of g.enemiesAt(c.team, pos, 7)) g.damage(t, 45 * dt, c, { dot: true }); } });
    },
  },
};

const sarah = {
  id: 'sarah', name: 'Sarah', role: 'support', tagline: 'Band nerd. Dances through every cast.',
  hp: 200, speed: 5.8, radius: 0.38,
  weapon: {
    name: 'Slingshot', icon: '🪃', rate: 1.9, range: 32, ranged: true, pspeed: 52,
    fire: (g, c) => g.shoot(c, { kind: 'pellet', speed: 52, gravity: 4, dmg: 32, heal: 45, r: 0.35, life: 2 }),
  },
  passive: { name: 'Section Leader', icon: '🎼', desc: 'Allies near Sarah slowly regenerate health. Her slingshot heals teammates it hits.' },
  tick: (g, c, dt) => { for (const a of g.allies(c, 9, true)) if (a.hp < a.maxHp) g.heal(a, (a === c ? 3 : 7) * dt, c, true); },
  abilities: [
    {
      name: 'Flute Solo', icon: '🪈', cd: 8, cast: 0, desc: 'A quick twirl that heals herself and nearby allies for 70.', ai: { k: 'heal', r: 9, hp: 0.7 },
      use: (g, c) => { g.ring(c.pos, 9, 0x8cffb0); for (const a of g.allies(c, 9, true)) g.heal(a, 70, c); },
    },
    {
      name: 'Forward March', icon: '🥁', cd: 11, cast: 1, desc: 'Hop to it: allies nearby move 30% faster for 4s.', ai: { k: 'buff', r: 18 },
      use: (g, c) => { g.ring(c.pos, 10, 0x9ad1ff); for (const a of g.allies(c, 10, true)) g.status(a, 'speed', 4, 1.3); },
    },
    {
      name: 'Cymbal Crash', icon: '💥', cd: 9, cast: 2, desc: 'CRASH. Enemies close by take 35, get knocked back and are briefly stunned.', ai: { k: 'melee', r: 4.5 },
      use: (g, c) => {
        g.ring(c.pos, 5, 0xffd166); g.sfx('boom');
        for (const t of g.enemies(c, 5)) { g.damage(t, 35, c); g.knock(t, c.pos, 11, 5); g.status(t, 'stun', 0.5, 1); }
      },
    },
  ],
  ult: {
    name: 'Halftime Show', icon: '🎺', cost: 1300, cast: 3, castDur: 8, desc: 'A full routine for 8s: allies around her heal 45/s and deal 20% more damage.', ai: { k: 'heal', r: 9, hp: 0.5, enemy: 14 },
    use: (g, c) => {
      g.zone({ follow: c, r: 9, dur: 8, owner: c, color: 0xf7b801, tick: (z, dt) => { for (const a of g.allies(c, 9, true)) { g.heal(a, 45 * dt, c); g.status(a, 'dmg', 0.3, 1.2); } } });
    },
  },
};

const billy = {
  id: 'billy', name: 'Billy', role: 'support', tagline: 'Just such a good dude. Great drummer.',
  hp: 225, speed: 5.7, radius: 0.4,
  weapon: {
    name: 'Drumsticks', icon: '🥢', rate: 4, range: 34, ranged: true, pspeed: 56,
    fire: (g, c) => g.shoot(c, { kind: 'stick', speed: 56, dmg: 18, r: 0.3, life: 1.4, spin: 20 }),
  },
  passive: { name: 'Good Dude', icon: '🤝', desc: 'Anyone Billy heals also takes 15% less damage for 3s.' },
  onHeal: (g, c, t) => g.status(t, 'dr2', 3, 0.15),
  abilities: [
    {
      name: 'Tambourine Toss', icon: '🪘', cd: 6, desc: 'Heal the ally in your sights for 80 (or yourself); it bounces to a second ally for 50.', ai: { k: 'heal', r: 25, hp: 0.7, aimAlly: true },
      use: (g, c) => {
        const t = g.pick(c, { ally: true, range: 25, cos: 0.85, hurt: true }) || c;
        g.heal(t, 80, c); if (t !== c) g.beam(g.eye(c), t, 0xffd166);
        let best = null, bd = 12;
        for (const a of g.alliesOf(t, 12, false)) { const d = g.dist(a, t); if (a.hp < a.maxHp && d < bd) { bd = d; best = a; } }
        if (best) { g.heal(best, 50, c); g.beam(g.center(t), best, 0xffd166); }
        g.sfx('jingle');
      },
    },
    {
      name: 'Drum Solo', icon: '🥁', cd: 12, desc: 'Allies nearby deal 25% more damage for 5s.', ai: { k: 'buff', r: 16 },
      use: (g, c) => { g.ring(c.pos, 10, 0xff7b00); for (const a of g.allies(c, 10, true)) g.status(a, 'dmg', 5, 1.25); },
    },
    {
      name: 'Rocket Boost', icon: '🚗', cd: 8, desc: 'Boost forward off the ground, bumping enemies for 30. Calculated.', ai: { k: 'flee', hp: 0.4 },
      use: (g, c) => g.dash(c, 19, 0.5, { dmg: 30, knock: 8, up: 4, trail: 0xff7b00 }),
    },
  ],
  ult: {
    name: 'What a Save!', icon: '🛟', cost: 1400, desc: 'Every living teammate is healed for 200 and cannot be damaged for 2.5s.', ai: { k: 'heal', r: 60, hp: 0.4 },
    use: (g, c) => { for (const a of g.allies(c, 999, true)) { g.heal(a, 200, c); g.status(a, 'invuln', 2.5, 1); g.ring(a.pos, 2.5, 0x9ad1ff); } },
  },
};

const grant = {
  id: 'grant', name: 'Grant', role: 'tank', tagline: 'Eagle Scout. Metalhead. Caffeinated.',
  hp: 500, speed: 5.3, radius: 0.5,
  weapon: {
    name: 'Energy Drinks', icon: '🥤', rate: 1.4, range: 15, ranged: true, pspeed: 21, lob: 16,
    fire: (g, c) => g.shoot(c, { kind: 'can', speed: 21, gravity: 16, dmg: 15, splash: 2.8, splashDmg: 38, r: 0.3, life: 3, spin: 12, color: 0x39d353 }),
  },
  passive: { name: 'Mosh Pit', icon: '🤘', desc: 'The lower his health, the harder he hits (up to +60%) and the less damage he takes (up to 25%).' },
  outMul: (g, c) => 1 + 0.6 * (1 - c.hp / c.maxHp),
  dr: (c) => 0.25 * (1 - c.hp / c.maxHp),
  abilities: [
    {
      name: 'Shotgun It', icon: '⚡', cd: 9, desc: 'Chug a can: heal 80, then throw 50% faster and move quicker for 4s.', ai: { k: 'self', hp: 0.7, enemy: 20 },
      use: (g, c) => { g.heal(c, 80, c); g.status(c, 'rate', 4, 1.5); g.status(c, 'speed', 4, 1.25); },
    },
    {
      name: 'Campfire', icon: '🏕️', cd: 12, desc: 'Be prepared. A campfire burns enemies (22/s) and warms allies (18/s) for 7s.', ai: { k: 'melee', r: 8 },
      use: (g, c) => {
        const pos = c.pos.clone();
        g.zone({ pos, r: 4.5, dur: 7, owner: c, color: 0xff6b1a, fire: true, tick: (z, dt) => {
          for (const t of g.enemiesAt(c.team, pos, 4.5)) g.damage(t, 22 * dt, c, { dot: true });
          for (const a of g.alliesAt(c.team, pos, 4.5)) g.heal(a, 18 * dt, c);
        } });
      },
    },
    {
      name: 'Wall of Death', icon: '🧱', cd: 8, desc: 'Charge through the pit: 45 damage and a knockback to anyone in the way.', ai: { k: 'gap', min: 4, max: 13 },
      use: (g, c) => g.dash(c, 20, 0.45, { dmg: 45, knock: 10, pierce: true }),
    },
  ],
  ult: {
    name: 'Breakdown', icon: '🎸', cost: 1300, desc: 'For 6s every beat hits enemies around him for 45 and slows them. He takes 40% less damage.', ai: { k: 'melee', r: 7 },
    use: (g, c) => {
      g.status(c, 'dr', 6, 0.4);
      let beat = 0;
      g.zone({ follow: c, r: 7, dur: 6, owner: c, color: 0xc1121f, tick: (z, dt) => {
        beat -= dt; if (beat > 0) return; beat = 1;
        g.ring(c.pos, 7, 0xc1121f); g.sfx('boom');
        for (const t of g.enemies(c, 7)) { g.damage(t, 45, c); g.status(t, 'slow', 1.2, 0.6); }
      } });
    },
  },
};

const junk = (g, c, ult) => g.shoot(c, {
  kind: 'junk', speed: 27, gravity: 14, dmg: 30, splash: ult ? 4 : 3, splashDmg: 65, r: 0.35, bounce: 2, fuse: 1.6, life: 4, spin: 10, color: 0xf2c14e,
});
const henry = {
  id: 'henry', name: 'Henry', role: 'dps', tagline: 'Thrift goblin. Fully jestermaxxed.',
  hp: 200, speed: 5.7, radius: 0.4,
  weapon: {
    name: 'Junk Launcher', icon: '🧨', rate: 1.5, range: 20, ranged: true, twoHand: true, pspeed: 27, lob: 14,
    fire: (g, c) => junk(g, c, !!c.st.ultHenry),
  },
  passive: { name: 'Last Laugh', icon: '🃏', desc: 'When Henry dies he drops a pile of live junk that explodes a moment later.' },
  onDeath: (g, c) => {
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.4;
      g.shoot(c, { kind: 'junk', speed: 4, gravity: 14, dmg: 0, splash: 3, splashDmg: 50, r: 0.3, bounce: 3, fuse: 1.1, life: 2, dir: { x: Math.cos(a), y: 1.2, z: Math.sin(a) }, from: g.center(c), color: 0xf2c14e });
    }
  },
  rateMul: (c) => (c.st.ultHenry ? 2.6 : 1),
  abilities: [
    {
      name: 'Whoopee Cushion', icon: '🎈', cd: 8, desc: 'Drop a trap. The first enemy to step on it takes 80 and gets launched.', ai: { k: 'melee', r: 9 },
      use: (g, c) => {
        const pos = c.pos.clone();
        g.zone({ pos, r: 2, dur: 25, owner: c, color: 0xe85d75, prop: 'cushion', tick: (z) => {
          const hit = g.enemiesAt(c.team, pos, 2);
          if (!hit.length) return;
          g.explode(pos, 3, 80, c, { knock: 6, up: 11, color: 0xe85d75 }); z.t = 0;
        } });
      },
    },
    {
      name: 'Jester Hop', icon: '🤸', cd: 6, desc: 'Blast yourself into the air. Enemies next to you take 40.', ai: { k: 'flee', hp: 0.5, enemy: 6 },
      use: (g, c) => {
        g.explode(c.pos, 4, 40, c, { knock: 8, color: 0xf2c14e });
        const d = g.moveDir(c); c.vel.x = d.x * 11; c.vel.z = d.z * 11; c.vel.y = 11; c.knockT = 0.6;
      },
    },
    {
      name: 'Bargain Bin', icon: '🧺', cd: 10, desc: 'Hurl a heap of thrift finds. Enemies in the pile are slowed by half for 5s.', ai: { k: 'dmg', r: 16 },
      use: (g, c) => g.shoot(c, {
        kind: 'clothes', speed: 22, gravity: 14, dmg: 20, r: 0.4, life: 3, spin: 6,
        onEnd: (pos) => {
          const p = pos.clone(); p.y = Math.max(0, p.y - 0.3);
          g.zone({ pos: p, r: 4.5, dur: 5, owner: c, color: 0x5aa6c8, tick: () => { for (const t of g.enemiesAt(c.team, p, 4.5)) g.status(t, 'slow', 0.4, 0.5); } });
        },
      }),
    },
  ],
  ult: {
    name: 'Jestermaxxing', icon: '🤡', cost: 1200, desc: 'Peak silliness for 7s: fires more than twice as fast with bigger explosions.', ai: { k: 'dmg', r: 18 },
    use: (g, c) => { g.status(c, 'ultHenry', 7, 1); g.status(c, 'speed', 7, 1.2); },
  },
};

const sam = {
  id: 'sam', name: 'Sam', role: 'dps', tagline: 'Very, very, very short. Eats crimes.',
  hp: 175, speed: 6.3, radius: 0.3,
  weapon: {
    name: 'Knives', icon: '🔪', rate: 3.2, range: 2.3, melee: true, twoHand: true,
    fire: (g, c) => g.melee(c, { dmg: c.st.ultSam ? 36 : 28, range: 2.3, arc: 0.4, onHit: (t) => { if (c.st.ultSam) g.status(t, 'burn', 2, 12, c); } }),
  },
  passive: { name: 'Ankle Biter', icon: '🦶', desc: 'Tiny hitbox. Attacks from behind deal 50% more damage.' },
  outMul: (g, c, t) => (t && g.behind(c, t) ? 1.5 : 1),
  abilities: [
    {
      name: 'Fridge Burger', icon: '🍔', cd: 6, desc: 'Throw a refrigerated McDouble: 50 damage and the cold slows them for 3s.', ai: { k: 'dmg', r: 24 },
      use: (g, c) => g.shoot(c, { kind: 'burger', speed: 36, gravity: 7, dmg: 50, r: 0.4, life: 2.5, spin: 8, onHit: (t) => g.status(t, 'slow', 3, 0.55) }),
    },
    {
      name: 'Leftovers', icon: '🥡', cd: 10, desc: 'Lob week-old leftovers that leave a toxic puddle: 22 damage per second for 6s.', ai: { k: 'dmg', r: 18 },
      use: (g, c) => g.shoot(c, {
        kind: 'tub', speed: 22, gravity: 14, dmg: 15, r: 0.35, life: 3, spin: 6,
        onEnd: (pos) => {
          const p = pos.clone(); p.y = Math.max(0, p.y - 0.3);
          g.zone({ pos: p, r: 4, dur: 6, owner: c, color: 0x9acd32, tick: (z, dt) => { for (const t of g.enemiesAt(c.team, p, 4)) g.damage(t, 22 * dt, c, { dot: true }); } });
        },
      }),
    },
    {
      name: 'Knife Fan', icon: '🗡️', cd: 7, desc: 'Throw five knives in a spread, 24 damage each.', ai: { k: 'dmg', r: 14 },
      use: (g, c) => { for (let i = -2; i <= 2; i++) g.shoot(c, { kind: 'knife', speed: 50, dmg: 24, r: 0.25, life: 1, yawOff: i * 0.09 }); },
    },
  ],
  ult: {
    name: 'Gas Station Sushi', icon: '🍣', cost: 1200, desc: 'A terrible decision. For 8s she is faster, hits harder, and a toxic cloud follows her (28/s).', ai: { k: 'melee', r: 9 },
    use: (g, c) => {
      g.status(c, 'ultSam', 8, 1); g.status(c, 'speed', 8, 1.35);
      g.zone({ follow: c, r: 4.5, dur: 8, owner: c, color: 0x9acd32, tick: (z, dt) => { for (const t of g.enemies(c, 4.5)) g.damage(t, 28 * dt, c, { dot: true }); } });
    },
  },
};

export const HEROES = [mason, cole, cam, henry, sam, james, grant, sarah, billy];
for (const h of HEROES) { h.look = LOOKS[h.id]; h.look.id = h.id; }
export const HERO = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const ROLE = { dps: { name: 'Damage', icon: '⚔️' }, tank: { name: 'Tank', icon: '🛡️' }, support: { name: 'Support', icon: '➕' } };
