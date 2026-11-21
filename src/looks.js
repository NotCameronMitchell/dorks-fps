// Per-friend appearance: body proportions, colours, hair/hat, face and the painted shirt texture.
// Each character gets one 1024x1024 texture atlas:
//   rows   0..511  head (wrapped around the head; face centre at x=768)
//   rows 512..895  torso (wrapped around the body; front centre x=768, back centre x=256)
//   rows 896..1023 left 256px = "swatch" for patterns (camo, argyle, screens); the rest stays white
export const FX = 768, BX = 256, T_TOP = 512, T_BOT = 896, Y_SHO = 567, Y_CHEST = 634, Y_WAIST = 756, Y_HIP = 853;

const css = (h) => '#' + h.toString(16).padStart(6, '0');
function shade(h, f) {
  const r = Math.min(255, ((h >> 16) & 255) * f) | 0, g = Math.min(255, ((h >> 8) & 255) * f) | 0, b = Math.min(255, (h & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

// ---- torso painting helpers (x = 2d context) --------------------------------
const fill = (x, c) => { x.fillStyle = css(c); x.fillRect(0, T_TOP, 1024, T_BOT - T_TOP); };
const band = (x, y0, y1, c) => { x.fillStyle = css(c); x.fillRect(0, y0, 1024, y1 - y0); };
// the texture is stretched ~1.5x vertically relative to horizontally, so text is drawn wide to compensate
function text(x, str, cx, cy, size, color, font = '900') {
  x.save(); x.translate(cx, cy); x.scale(1.5, 1); x.font = `${font} ${size}px system-ui, Arial, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color; x.fillText(str, 0, 0); x.restore();
}
function crewNeck(x, skin, trim, depth = 30) {
  x.fillStyle = css(skin); x.fillRect(0, T_TOP, 1024, 20);
  x.beginPath(); x.ellipse(FX, T_TOP + 18, 150, depth, 0, 0, Math.PI * 2); x.fill();
  if (trim != null) { x.strokeStyle = css(trim); x.lineWidth = 7; x.beginPath(); x.ellipse(FX, T_TOP + 18, 150, depth, 0, 0, Math.PI); x.stroke(); x.fillStyle = css(trim); x.fillRect(0, T_TOP + 18, FX - 150, 7); x.fillRect(FX + 150, T_TOP + 18, 1024 - FX - 150, 7); }
}
function collar(x, skin, col, placket, buttons) {
  // open polo / shirt collar with a V of skin and two collar flaps
  x.fillStyle = css(skin); x.fillRect(0, T_TOP, 1024, 16);
  x.beginPath(); x.moveTo(FX - 60, T_TOP); x.lineTo(FX, T_TOP + 78); x.lineTo(FX + 60, T_TOP); x.fill();
  x.fillStyle = css(col);
  x.beginPath(); x.moveTo(FX - 190, T_TOP + 10); x.lineTo(FX - 60, T_TOP + 4); x.lineTo(FX - 6, T_TOP + 80); x.lineTo(FX - 110, T_TOP + 58); x.fill();
  x.beginPath(); x.moveTo(FX + 190, T_TOP + 10); x.lineTo(FX + 60, T_TOP + 4); x.lineTo(FX + 6, T_TOP + 80); x.lineTo(FX + 110, T_TOP + 58); x.fill();
  x.fillRect(0, T_TOP + 8, FX - 190, 18); x.fillRect(FX + 190, T_TOP + 8, 1024, 18);
  if (placket != null) {
    x.fillStyle = css(placket); x.fillRect(FX - 5, T_TOP + 78, 10, placket === col ? 60 : T_BOT);
    x.fillStyle = css(buttons ?? 0xffffff);
    for (let i = 0; i < (placket === col ? 2 : 6); i++) { x.beginPath(); x.ellipse(FX, T_TOP + 100 + i * 50, 6, 4.5, 0, 0, 6.3); x.fill(); }
  }
}
function shadeFolds(x) {
  // soft shading under the chest and at the sides so shirts are not flat colour
  const g = x.createLinearGradient(0, T_TOP, 0, T_BOT);
  g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
  x.fillStyle = g; x.fillRect(0, T_TOP, 1024, T_BOT - T_TOP);
}

// ---- the roster -------------------------------------------------------------
export const LOOKS = {
  mason: {
    scale: 1.12, pose: 'pistol', weapon: 'pistol',
    body: { sh: 0.2, chest: [0.19, 0.12], waist: [0.16, 0.108], hip: [0.165, 0.112], arm: 0.046, leg: 0.07 },
    skin: 0xd9a273, hair: 0x3a2a1e, hairStyle: 'under', hat: { type: 'cap', c: 0xf7f7f7, brim: 0xf7f7f7 },
    top: 0xda291c, sleeve: 'short', sleeveC: 0xda291c, cuffC: 0xffffff, bottom: 0x16161a, legs: 'shorts', sock: 0x16161a, sockH: 'short', shoe: 0xf4f4f4, sole: 0xdddddd,
    face: { eye: 0x5a3d28, brow: 0x2e2118, browT: 9, mouth: 'grin' },
    extras: ['medal'],
    paintTorso(x) {
      fill(x, 0xda291c); shadeFolds(x); crewNeck(x, this.skin, 0xffffff);
      // medal ribbon
      x.lineWidth = 34; x.strokeStyle = '#ffffff'; x.beginPath(); x.moveTo(FX - 150, T_TOP + 10); x.lineTo(FX, Y_CHEST + 60); x.lineTo(FX + 150, T_TOP + 10); x.stroke();
      x.lineWidth = 20; x.strokeStyle = '#2748a8'; x.stroke();
      // name + number on the back
      text(x, 'MASON', BX, Y_SHO + 40, 44, '#ffffff'); text(x, '7', BX, Y_CHEST + 70, 150, '#ffffff');
      band(x, T_BOT - 10, T_BOT, 0xffffff);
    },
  },
  cole: {
    wide: 1.08, scale: 1.0, pose: 'club', weapon: 'club', tucked: true,
    body: { sh: 0.212, chest: [0.205, 0.138], waist: [0.2, 0.142], hip: [0.2, 0.135], arm: 0.054, leg: 0.082 },
    skin: 0xf0c4a2, hair: 0x33241a, hairStyle: 'part', hat: { type: 'visor', c: 0xce1126 },
    top: 0x8fa9d8, sleeve: 'short', sleeveC: 0x8fa9d8, bottom: 0x2b3350, legs: 'shorts', sock: 0xffffff, sockH: 'short', shoe: 0xf2efe8, sole: 0xe0dccf,
    face: { eye: 0x4a3626, brow: 0x33241a, browT: 9, mouth: 'grin', blush: true },
    swatch(x) { // polo dot pattern, reused on the sleeves
      x.fillStyle = '#8fa9d8'; x.fillRect(0, 896, 256, 128); x.fillStyle = '#5f7fc0';
      for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) { x.beginPath(); x.arc(8 + i * 16 + (j % 2) * 8, 904 + j * 16, 3.2, 0, 6.3); x.fill(); }
    },
    sleeveSwatch: true,
    paintTorso(x) {
      fill(x, 0x8fa9d8);
      x.fillStyle = '#5f7fc0';
      for (let j = 0; j < 22; j++) for (let i = 0; i < 48; i++) { x.beginPath(); x.ellipse(10 + i * 21.3 + (j % 2) * 10, 520 + j * 15, 4.5, 3, 0, 0, 6.3); x.fill(); }
      shadeFolds(x); collar(x, this.skin, 0x7f9bd0, 0x7f9bd0, 0xffffff);
      band(x, Y_HIP - 30, Y_HIP - 4, 0x1c1f2e); // belt
      x.fillStyle = '#b3202c'; x.fillRect(FX + 60, Y_HIP - 30, 70, 26); x.fillStyle = '#c9c9cf'; x.fillRect(FX - 22, Y_HIP - 32, 44, 30); x.fillStyle = '#1c1f2e'; x.fillRect(FX - 12, Y_HIP - 24, 24, 14);
      band(x, Y_HIP - 4, T_BOT, 0x2b3350);
    },
  },
  james: {
    wide: 1.22, scale: 1.06, pose: 'fists', weapon: 'fists', offhand: 'fists',
    body: { sh: 0.262, chest: [0.25, 0.155], waist: [0.195, 0.135], hip: [0.2, 0.135], arm: 0.072, leg: 0.096 },
    skin: 0xd7a078, hair: 0x1f1712, hairStyle: 'curly', hat: { type: 'headband', c: 0x15151a },
    top: 0x15151a, sleeve: 'none', bottom: 0x15151a, legs: 'shorts', sock: 0xffffff, sockH: 'short', shoe: 0xf2f2f2, sole: 0xd8d8d8,
    face: { eye: 0x4a3222, brow: 0x1f1712, browT: 11, mouth: 'grin', stache: 0x1f1712, stubble: 0x1f1712 },
    paintTorso(x) {
      fill(x, 0x15151a); shadeFolds(x);
      // sleeveless: bare shoulders at the sides, scooped neck
      const s = css(this.skin); x.fillStyle = s;
      x.fillRect(0, T_TOP, 1024, 14);
      for (const cx of [0, 512, 1024]) { x.beginPath(); x.ellipse(cx, T_TOP + 10, 118, 92, 0, 0, 6.3); x.fill(); }
      x.beginPath(); x.ellipse(FX, T_TOP + 10, 125, 46, 0, 0, 6.3); x.fill(); x.beginPath(); x.ellipse(BX, T_TOP + 10, 120, 26, 0, 0, 6.3); x.fill();
      // white swoosh-ish tick on the chest (generic)
      x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(FX + 40, Y_CHEST - 22); x.quadraticCurveTo(FX + 62, Y_CHEST - 2, FX + 105, Y_CHEST - 30); x.stroke();
      // race bib
      x.fillStyle = '#f4f4f4'; x.fillRect(FX - 105, Y_WAIST - 10, 210, 96);
      x.fillStyle = '#e8a33a'; x.fillRect(FX - 105, Y_WAIST - 10, 210, 16); x.fillStyle = '#3b6fb5'; x.fillRect(FX - 105, Y_WAIST + 72, 210, 14);
      text(x, '5964', FX, Y_WAIST + 40, 54, '#151515');
      x.fillStyle = '#888'; for (const [dx, dy] of [[-96, -2], [96, -2], [-96, 78], [96, 78]]) { x.beginPath(); x.arc(FX + dx, Y_WAIST + dy, 5, 0, 6.3); x.fill(); }
    },
  },
  cam: {
    wide: 1.25, scale: 1.05, pose: 'two', weapon: 'laptop',
    body: { sh: 0.238, chest: [0.25, 0.172], waist: [0.268, 0.2], hip: [0.25, 0.18], arm: 0.062, leg: 0.096 },
    skin: 0xf3cbb4, hair: 0x3a2619, hairStyle: 'wolf',
    top: 0x121216, sleeve: 'short', sleeveC: 0x121216, bottom: 0xf1efe9, legs: 'shorts', sockH: 'none', shoe: 0x17171b, sole: 0xf4f4f4,
    face: { eye: 0x5b7a8c, brow: 0x3a2619, browT: 8, mouth: 'smirk', blush: true },
    swatch(x) { // laptop screen: code
      x.fillStyle = '#06140c'; x.fillRect(0, 896, 256, 128); x.font = 'bold 13px monospace'; x.textBaseline = 'top';
      const lines = ['def ship(slop):', '  while True:', '    yield slop()', 'model.fit(vibes)', '# TODO: evals', 'git push -f prod'];
      lines.forEach((l, i) => { x.fillStyle = i % 2 ? '#39ff88' : '#25e6ff'; x.fillText(l, 8, 902 + i * 19); });
    },
    paintTorso(x) {
      fill(x, 0x121216); shadeFolds(x); collar(x, this.skin, 0x1c1c22, 0x1e1e25, 0x3a3a44);
      x.save(); x.translate(FX + 95, Y_CHEST - 8); x.scale(1.5, 1); x.font = 'italic 600 22px Georgia, serif'; x.fillStyle = '#e8e8e8'; x.textAlign = 'center'; x.fillText('Cam', 0, 0); x.restore();
      x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 3; x.strokeRect(-5, T_BOT - 4, 1040, 10);
    },
  },
  sarah: {
    scale: 0.9, pose: 'sling', weapon: 'slingshot', fem: true,
    body: { sh: 0.165, chest: [0.165, 0.115], waist: [0.138, 0.102], hip: [0.168, 0.118], arm: 0.039, leg: 0.062 },
    skin: 0xf4d2bd, hair: 0x33211a, hairStyle: 'long',
    glasses: { type: 'square', c: 0xb9a3d6 },
    top: 0x2f3b5c, sleeve: 'long', sleeveC: 0x2f3b5c, bottom: 0x17171b, legs: 'pants', shoe: 0xf4f4f4, sole: 0xdcdcdc,
    face: { eye: 0x7f9a8a, brow: 0x33211a, browT: 6, mouth: 'soft', lashes: true, lips: 0xc98078 },
    extras: ['shirtCollar'],
    paintTorso(x) {
      fill(x, 0x2f3b5c); shadeFolds(x);
      x.fillStyle = css(this.skin); x.fillRect(0, T_TOP, 1024, 12);
      // white shirt collar peeking out
      x.fillStyle = '#fbfbfb'; x.fillRect(0, T_TOP + 6, 1024, 22);
      x.beginPath(); x.moveTo(FX - 150, T_TOP + 8); x.lineTo(FX - 8, T_TOP + 8); x.lineTo(FX - 40, T_TOP + 64); x.lineTo(FX - 130, T_TOP + 44); x.fill();
      x.beginPath(); x.moveTo(FX + 150, T_TOP + 8); x.lineTo(FX + 8, T_TOP + 8); x.lineTo(FX + 40, T_TOP + 64); x.lineTo(FX + 130, T_TOP + 44); x.fill();
      // layered gold necklace
      x.strokeStyle = '#e2b95a'; x.lineWidth = 3; x.beginPath(); x.moveTo(FX - 26, T_TOP + 40); x.quadraticCurveTo(FX, T_TOP + 96, FX + 26, T_TOP + 40); x.stroke();
      x.beginPath(); x.moveTo(FX - 20, T_TOP + 40); x.quadraticCurveTo(FX, T_TOP + 132, FX + 20, T_TOP + 40); x.stroke();
      x.fillStyle = '#e2b95a'; x.beginPath(); x.ellipse(FX, T_TOP + 68, 8, 6, 0, 0, 6.3); x.fill(); x.beginPath(); x.ellipse(FX, T_TOP + 96, 10, 8, 0, 0, 6.3); x.fill();
      // gold lettering across the chest
      x.strokeStyle = '#d9c08a'; x.lineWidth = 3; x.strokeRect(FX - 190, Y_CHEST + 30, 380, 66);
      text(x, 'BLOSSOM', FX, Y_CHEST + 64, 46, '#d9c08a');
      band(x, T_BOT - 18, T_BOT, 0x29334f);
    },
  },
  billy: {
    scale: 1.1, pose: 'throw', weapon: 'sticks', offhand: 'tambourine',
    body: { sh: 0.205, chest: [0.195, 0.126], waist: [0.176, 0.12], hip: [0.178, 0.12], arm: 0.05, leg: 0.074 },
    skin: 0xf0c6a6, hair: 0x4a3120, hairStyle: 'tousled',
    top: 0x5d6a62, sleeve: 'short', sleeveC: 0x5d6a62, bottom: 0x3d5a85, legs: 'pants', shoe: 0xf2f2f2, sole: 0xd9d9d9,
    face: { eye: 0x5b7f9a, brow: 0x4a3120, browT: 8, mouth: 'smile', stache: 0x4a3120 },
    paintTorso(x) {
      fill(x, 0x5d6a62);
      x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 2; for (let i = 0; i < 1024; i += 9) { x.beginPath(); x.moveTo(i, T_TOP); x.lineTo(i, T_BOT); x.stroke(); } // knit rib
      shadeFolds(x); collar(x, this.skin, 0x525e57, 0x525e57, 0x2f3632);
      band(x, T_BOT - 12, T_BOT, 0x525e57);
    },
  },
  grant: {
    wide: 1.1, scale: 1.0, pose: 'throw', weapon: 'can',
    body: { sh: 0.222, chest: [0.212, 0.142], waist: [0.2, 0.142], hip: [0.2, 0.135], arm: 0.058, leg: 0.09 },
    skin: 0xf1c7a8, hair: 0x5a4030, hairStyle: 'under', hat: { type: 'cap', c: 0xffffff, brim: 0xffffff, swatch: true },
    top: 0x7b7067, sleeve: 'short', sleeveC: 0x7b7067, bottom: 0x1a1a1e, legs: 'shorts', sock: 0xf7f7f7, sockH: 'crew', shoe: 0xb9bcc2, sole: 0xe9e9e9, chunky: true,
    face: { eye: 0x556b7a, brow: 0x5a4030, browT: 8, mouth: 'grin' },
    swatch(x) { // camo
      x.fillStyle = '#6b6a4a'; x.fillRect(0, 896, 256, 128);
      const cols = ['#3f4a2f', '#8a8562', '#2c3122', '#5a5338'];
      let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < 46; i++) { x.fillStyle = cols[i % 4]; x.beginPath(); x.ellipse(rnd() * 256, 896 + rnd() * 128, 10 + rnd() * 22, 6 + rnd() * 12, rnd() * 3, 0, 6.3); x.fill(); }
    },
    paintTorso(x) {
      fill(x, 0x7b7067); shadeFolds(x); crewNeck(x, this.skin, 0x6d635b);
      // pale band-tee style print: a spiky orb on long legs
      x.strokeStyle = '#d6d0c4'; x.fillStyle = '#d6d0c4'; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.ellipse(FX + 30, Y_CHEST - 6, 64, 30, 0, 0, 6.3); x.fill();
      x.fillStyle = '#7b7067'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(FX - 14 + i * 12, Y_CHEST - 8 + (i % 2) * 8, 3.5, 2.5, 0, 0, 6.3); x.fill(); }
      for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(FX + 30 + i * 16, Y_CHEST + 16); x.quadraticCurveTo(FX + 30 + i * 34, Y_CHEST + 50, FX + 30 + i * 30, Y_CHEST + 96); x.stroke(); }
      x.lineWidth = 3; x.beginPath(); x.moveTo(FX - 34, Y_CHEST - 10); x.lineTo(FX - 150, Y_CHEST - 34); x.moveTo(FX - 34, Y_CHEST - 2); x.lineTo(FX - 140, Y_CHEST + 4); x.stroke();
    },
  },
  henry: {
    scale: 1.0, pose: 'two', weapon: 'launcher',
    body: { sh: 0.206, chest: [0.202, 0.138], waist: [0.204, 0.148], hip: [0.198, 0.138], arm: 0.054, leg: 0.08 },
    skin: 0xf5cdb8, hair: 0x5a3b26, hairStyle: 'curly',
    glasses: { type: 'round', c: 0xc9a86a },
    top: 0x141417, sleeve: 'short', sleeveC: 0x141417, bottom: 0x17171a, legs: 'pants', pantHem: -0.3, sockSwatch: true, shoe: 0xf6f6f6, sole: 0xe2e2e2,
    face: { eye: 0x6a8a6a, brow: 0x5a3b26, browT: 8, mouth: 'grin', blush: true },
    swatch(x) { // argyle socks
      x.fillStyle = '#f2c230'; x.fillRect(0, 896, 256, 128); x.fillStyle = '#151515';
      for (let j = -1; j < 3; j++) for (let i = 0; i < 5; i++) { const cx = i * 64 + (j % 2 ? 32 : 0), cy = 896 + j * 64 + 32; x.beginPath(); x.moveTo(cx, cy - 32); x.lineTo(cx + 32, cy); x.lineTo(cx, cy + 32); x.lineTo(cx - 32, cy); x.fill(); }
      x.strokeStyle = '#ffffff'; x.lineWidth = 2;
      for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 896); x.lineTo(i * 64 + 128, 1024); x.moveTo(i * 64 + 128, 896); x.lineTo(i * 64, 1024); x.stroke(); }
    },
    paintTorso(x) { fill(x, 0x141417); shadeFolds(x); crewNeck(x, this.skin, 0x202024); },
  },
  sam: {
    scale: 0.7, pose: 'knives', weapon: 'knife', offhand: 'knife', fem: true, tucked: true,
    body: { sh: 0.16, chest: [0.158, 0.11], waist: [0.128, 0.096], hip: [0.165, 0.118], arm: 0.038, leg: 0.064 },
    skin: 0xd9a57f, hair: 0x241711, hairStyle: 'sam', hat: { type: 'bandana', c: 0xf3eedf },
    glasses: { type: 'shades', c: 0x111111 },
    top: 0x151518, sleeve: 'none', bottom: 0x151518, legs: 'shorts', shortHem: -0.2, sock: 0xf7f7f7, sockH: 'crew', shoe: 0xd9d6cf, sole: 0xf2f2f2,
    face: { eye: 0x4a3222, brow: 0x241711, browT: 6, mouth: 'grin', lips: 0xb86a60, shades: true },
    paintTorso(x) {
      fill(x, this.skin);
      // sports top with white trim and straps
      band(x, 590, 700, 0x151518); band(x, 694, 702, 0xf4f4f4);
      x.fillStyle = '#151518';
      for (const cx of [FX - 80, FX + 80, BX - 80, BX + 80]) x.fillRect(cx - 22, T_TOP, 44, 90);
      x.strokeStyle = '#f4f4f4'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(FX - 102, T_TOP); x.lineTo(FX - 102, 590); x.quadraticCurveTo(FX, 640, FX + 102, 590); x.lineTo(FX + 102, T_TOP); x.stroke();
      x.fillStyle = css(this.skin); x.beginPath(); x.moveTo(FX - 99, 589); x.quadraticCurveTo(FX, 637, FX + 99, 589); x.lineTo(FX + 58, 560); x.lineTo(FX - 58, 560); x.fill(); x.fillRect(FX - 58, T_TOP, 116, 60);
      // necklace
      x.strokeStyle = '#e2b95a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(FX - 24, T_TOP + 26); x.quadraticCurveTo(FX, T_TOP + 62, FX + 24, T_TOP + 26); x.stroke();
      // bike shorts with white waistband
      band(x, 796, T_BOT, 0x151518); band(x, 790, 802, 0xf4f4f4);
      const g = x.createLinearGradient(0, 700, 0, 790); g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 700, 1024, 90);
    },
  },
};

// ---- faces ------------------------------------------------------------------
export function paintFace(x, L) {
  const F = L.face, cx = FX, ey = 262;
  x.fillStyle = css(L.skin); x.fillRect(0, 0, 1024, 512);
  x.save(); x.translate(cx, ey - 14); x.scale(1.3, 1.3); x.translate(-cx, -ey); // big, readable features
  if (F.stubble != null) {
    const g = x.createRadialGradient(cx, ey + 96, 30, cx, ey + 80, 150);
    g.addColorStop(0, shade(F.stubble, 1).replace('rgb', 'rgba').replace(')', ',.34)')); g.addColorStop(1, shade(F.stubble, 1).replace('rgb', 'rgba').replace(')', ',0)'));
    x.fillStyle = g; x.fillRect(cx - 200, ey + 20, 400, 230);
  }
  if (F.blush) for (const s of [-1, 1]) {
    const g = x.createRadialGradient(cx + s * 92, ey + 46, 2, cx + s * 92, ey + 46, 34);
    g.addColorStop(0, 'rgba(235,110,110,.42)'); g.addColorStop(1, 'rgba(235,110,110,0)'); x.fillStyle = g; x.fillRect(cx + s * 92 - 40, ey + 6, 80, 80);
  }
  for (const s of [-1, 1]) {
    const ex = cx + s * 58;
    if (!F.shades) {
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(ex, ey, 21, 23, 0, 0, 6.3); x.fill();
      x.fillStyle = css(F.eye); x.beginPath(); x.arc(ex - s * 1, ey + 3, 14.5, 0, 6.3); x.fill();
      x.fillStyle = '#16100c'; x.beginPath(); x.arc(ex - s * 1, ey + 3, 8, 0, 6.3); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex - 6, ey - 5, 4.5, 0, 6.3); x.fill();
      x.strokeStyle = '#2a1c14'; x.lineWidth = F.lashes ? 7 : 5; x.lineCap = 'round';
      x.beginPath(); x.ellipse(ex, ey, 22, 24, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
      if (F.lashes) { x.lineWidth = 5; x.beginPath(); x.moveTo(ex + s * 20, ey - 12); x.lineTo(ex + s * 31, ey - 22); x.stroke(); }
      // lower cheek line when grinning
      if (F.mouth === 'grin') { x.strokeStyle = shade(L.skin, 0.8); x.lineWidth = 3; x.beginPath(); x.ellipse(ex, ey + 6, 22, 22, 0, Math.PI * 0.2, Math.PI * 0.8); x.stroke(); }
    }
    x.strokeStyle = css(F.brow); x.lineWidth = F.browT; x.lineCap = 'round';
    x.beginPath(); x.moveTo(ex - s * 24, ey - 31); x.quadraticCurveTo(ex + s * 2, ey - 42, ex + s * 28, ey - 31); x.stroke();
  }
  // nose shadow (a 3d nose sits on top)
  x.strokeStyle = shade(L.skin, 0.82); x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx - 13, ey + 44); x.quadraticCurveTo(cx, ey + 52, cx + 13, ey + 44); x.stroke();
  const my = ey + 68;
  if (F.stache != null) {
    x.fillStyle = css(F.stache);
    x.beginPath(); x.moveTo(cx, my - 26); x.quadraticCurveTo(cx - 30, my - 30, cx - 44, my - 8); x.quadraticCurveTo(cx - 20, my - 16, cx, my - 12); x.quadraticCurveTo(cx + 20, my - 16, cx + 44, my - 8); x.quadraticCurveTo(cx + 30, my - 30, cx, my - 26); x.fill();
  }
  const lip = F.lips != null ? css(F.lips) : shade(L.skin, 0.62);
  if (F.mouth === 'grin') {
    x.beginPath(); x.moveTo(cx - 50, my - 10); x.quadraticCurveTo(cx, my + 2, cx + 50, my - 10); x.quadraticCurveTo(cx, my + 50, cx - 50, my - 10); x.closePath();
    x.fillStyle = '#6e2424'; x.fill();
    x.save(); x.clip(); x.fillStyle = '#ffffff'; x.fillRect(cx - 52, my - 12, 104, 18); x.fillStyle = '#d0706a'; x.beginPath(); x.ellipse(cx, my + 30, 20, 10, 0, 0, 6.3); x.fill(); x.restore();
    x.strokeStyle = lip; x.lineWidth = 3.5; x.stroke();
  } else {
    x.strokeStyle = lip; x.lineWidth = F.lips != null ? 7 : 6; x.lineCap = 'round'; x.beginPath();
    if (F.mouth === 'smile') { x.moveTo(cx - 30, my - 4); x.quadraticCurveTo(cx, my + 20, cx + 30, my - 4); }
    else if (F.mouth === 'smirk') { x.moveTo(cx - 24, my + 4); x.quadraticCurveTo(cx + 4, my + 12, cx + 30, my - 6); }
    else { x.moveTo(cx - 20, my + 1); x.quadraticCurveTo(cx, my + 10, cx + 20, my + 1); }
    x.stroke();
  }
  x.restore();
}
