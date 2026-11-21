// Tiny synthesised sound effects: no audio files to download.
const DEF = {
  shot: [320, 90, 0.08, 'square', 0.25], slop: [900, 400, 0.07, 'sawtooth', 0.12], throw: [260, 520, 0.1, 'triangle', 0.2],
  swing: [200, 120, 0.1, 'triangle', 0.15], thwack: [150, 50, 0.12, 'square', 0.3], boom: [120, 30, 0.35, 'sawtooth', 0.4],
  cast: [500, 800, 0.12, 'sine', 0.2], ult: [300, 1200, 0.5, 'sawtooth', 0.3], dash: [600, 200, 0.15, 'sine', 0.2],
  zap: [1400, 300, 0.15, 'square', 0.15], meow: [700, 1000, 0.18, 'sine', 0.25], jingle: [1200, 1600, 0.2, 'triangle', 0.2],
  hit: [1000, 1000, 0.03, 'square', 0.12], kill: [500, 1000, 0.2, 'triangle', 0.3], dead: [300, 60, 0.6, 'sawtooth', 0.3],
  cap: [600, 900, 0.4, 'triangle', 0.3], win: [500, 1500, 0.9, 'triangle', 0.35], lose: [400, 100, 0.9, 'triangle', 0.35],
};
export class Audio {
  constructor() { this.ctx = null; this.muted = false; }
  unlock() {
    if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) this.ctx = new C(); }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  play(name, vol = 1) {
    const d = DEF[name]; if (!d || !this.ctx || this.muted || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = d[3]; o.frequency.setValueAtTime(d[0], t); o.frequency.exponentialRampToValueAtTime(Math.max(20, d[1]), t + d[2]);
    g.gain.setValueAtTime(d[4] * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d[2]);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + d[2] + 0.02);
  }
}
