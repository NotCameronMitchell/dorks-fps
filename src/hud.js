const $ = (id) => document.getElementById(id);
const BUFF_ICONS = { speed: '💨', slow: '🧊', burn: '🔥', hot: '💚', dmg: '⚔️', dr: '🛡️', dr2: '🤝', invuln: '✨', stun: '💫', stealth: '👻', rate: '⚡', lifesteal: '🩸', teeoff: '⛳', wings: '🍗' };

export class Hud {
  constructor(audio) {
    this.audio = audio;
    this.el = {
      hud: $('hud'), s0: $('s0'), s1: $('s1'), pt: $('pt'), ptfill: $('ptfill'), status: $('status'), banner: $('banner'), feed: $('feed'),
      hitm: $('hitm'), vig: $('vignette'), respawn: $('respawn'), hname: $('hname'), hpfill: $('hpfill'), overfill: $('overfill'), hptext: $('hptext'), buffs: $('buffs'),
      abs: [$('b0'), $('b1'), $('b2')], ult: $('bult'), fire: $('bfire'), end: $('end'), endtitle: $('endtitle'), board: $('board'),
    };
    this.lastHit = 0;
  }

  setup(game) {
    const h = game.player.hero, e = this.el;
    e.hname.textContent = h.name.toUpperCase();
    h.abilities.forEach((a, i) => { e.abs[i].querySelector('.ic').textContent = a.icon; });
    e.ult.querySelector('.ic').textContent = h.ult.icon;
    e.fire.querySelector('.ic').textContent = h.weapon.icon;
    e.feed.innerHTML = ''; e.banner.style.opacity = 0; e.vig.style.opacity = 0;
    e.end.classList.add('hidden'); e.hud.classList.remove('hidden');
    this.cache = {};
  }

  set(key, el, prop, v) { if (this.cache[key] !== v) { this.cache[key] = v; el[prop] = v; } }

  update(g) {
    const e = this.el, c = g.player, P = g.point, me = c.team;
    this.set('s0', e.s0, 'textContent', Math.floor(P.score[me]) + '%');
    this.set('s1', e.s1, 'textContent', Math.floor(P.score[1 - me]) + '%');
    const ownerCol = P.owner < 0 ? '#fff' : P.owner === me ? 'var(--ally)' : 'var(--enemy)';
    this.set('ptb', e.pt.style, 'borderColor', ownerCol);
    this.set('ptf', e.ptfill.style, 'height', Math.round(P.cap * 100) + '%');
    this.set('ptc', e.ptfill.style, 'background', P.capTeam === me ? 'var(--ally)' : 'var(--enemy)');
    let status = '';
    if (g.countdown > 0) status = 'GET READY  ' + Math.ceil(g.countdown);
    else if (P.overtime) status = 'OVERTIME!';
    else if (P.on[0] && P.on[1]) status = 'CONTESTED';
    else if (P.owner < 0) status = 'CAPTURE THE POINT';
    else if (P.owner === me) status = 'DEFEND THE POINT';
    else status = 'RETAKE THE POINT';
    this.set('status', e.status, 'textContent', status);
    // vitals
    const total = c.maxHp + c.over;
    this.set('hp', e.hpfill.style, 'width', (100 * c.hp / total).toFixed(1) + '%');
    this.set('ovl', e.overfill.style, 'left', (100 * c.hp / total).toFixed(1) + '%');
    this.set('ovw', e.overfill.style, 'width', (100 * c.over / total).toFixed(1) + '%');
    this.set('hpt', e.hptext, 'textContent', Math.ceil(c.hp + c.over) + ' / ' + c.maxHp);
    let buffs = '';
    for (const k in c.st) if (BUFF_ICONS[k]) buffs += BUFF_ICONS[k];
    if (c.stacks) buffs += '🦈'.repeat(c.stacks);
    this.set('buffs', e.buffs, 'textContent', buffs);
    for (let i = 0; i < 3; i++) {
      const cd = c.cd[i], el = e.abs[i];
      this.set('cdc' + i, el, 'className', 'ab' + (cd > 0 ? ' cd' : ''));
      if (cd > 0) this.set('cdt' + i, el.children[1], 'textContent', Math.ceil(cd));
    }
    const up = Math.floor(100 * c.ult / c.hero.ult.cost);
    this.set('ultc', e.ult, 'className', 'ab ult' + (up >= 100 ? ' ready' : ''));
    this.set('ultt', e.ult.children[1], 'textContent', up + '%');
    if (!c.alive && !g.over) {
      e.respawn.classList.remove('hidden');
      this.set('resp', e.respawn, 'textContent', 'RESPAWN IN ' + Math.max(1, Math.ceil(c.respawn)));
    } else if (this.cache.resp !== '') { e.respawn.classList.add('hidden'); this.cache.resp = ''; }
    if (this.vigT > 0) { this.vigT -= 0.016; if (this.vigT <= 0) e.vig.style.opacity = 0; }
  }

  hit(soft) {
    const now = performance.now();
    if (soft && now - this.lastHit < 250) return;
    this.lastHit = now;
    const m = this.el.hitm; m.style.transition = 'none'; m.style.opacity = 1;
    requestAnimationFrame(() => { m.style.transition = 'opacity .2s'; m.style.opacity = 0; });
    if (!soft) this.audio.play('hit');
  }

  hurt() { this.el.vig.style.opacity = 0.9; this.vigT = 0.25; }

  killfeed(src, t, player) {
    const cls = (c) => (c.team === player.team ? 'a' : 'e');
    const d = document.createElement('div');
    d.innerHTML = (src && src !== t ? `<span class="${cls(src)}">${src.name}</span> ☠ ` : '☠ ') + `<span class="${cls(t)}">${t.name}</span>`;
    this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 4) this.el.feed.firstChild.remove();
    setTimeout(() => d.remove(), 5000);
    if (src === player && t !== player) this.banner('ELIMINATED ' + t.name.toUpperCase(), true, 1200);
  }

  banner(text, good, ms = 1800) {
    const b = this.el.banner;
    b.textContent = text; b.style.color = good ? 'var(--ally)' : 'var(--enemy)'; b.style.opacity = 1;
    clearTimeout(this.bt); this.bt = setTimeout(() => { b.style.opacity = 0; }, ms);
  }

  ultCall(c, player) {
    if (c === player) this.banner(c.hero.ult.name.toUpperCase() + '!', true, 1400);
    else this.banner(`${c.name}: ${c.hero.ult.name}!`, c.team === player.team, 1400);
  }

  showEnd(g, win) {
    const e = this.el;
    e.endtitle.textContent = win ? 'VICTORY' : 'DEFEAT';
    e.endtitle.style.color = win ? 'var(--ally)' : 'var(--enemy)';
    let rows = '<tr><th>Hero</th><th>Elims</th><th>Deaths</th><th>Damage</th><th>Healing</th></tr>';
    for (const c of g.chars) {
      rows += `<tr class="${c.team === g.player.team ? 'a' : 'e'}${c === g.player ? ' me' : ''}"><td>${c.name}${c === g.player ? ' (you)' : ''}</td><td>${c.stats.kills}</td><td>${c.stats.deaths}</td><td>${Math.round(c.stats.dmg)}</td><td>${Math.round(c.stats.heal)}</td></tr>`;
    }
    e.board.innerHTML = rows;
    setTimeout(() => e.end.classList.remove('hidden'), 900);
  }

  hide() { this.el.hud.classList.add('hidden'); this.el.end.classList.add('hidden'); }
}
