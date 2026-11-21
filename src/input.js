// Unified input: twin-thumb touch controls on phones, WASD + mouse on desktop.
export class Input {
  constructor(canvas, ui) {
    this.move = { x: 0, y: 0 }; this.fire = false; this.jump = false; this.autoFire = true;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.look = { x: 0, y: 0 }; this.pressed = {}; this.enabled = false;
    this.sens = this.touch ? 0.0052 : 0.0022;
    this.keys = {};
    // --- desktop
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys[e.code] = true;
      const map = { KeyE: 'ab0', ShiftLeft: 'ab1', KeyF: 'ab2', KeyQ: 'ult', Digit1: 'ab0', Digit2: 'ab1', Digit3: 'ab2', Digit4: 'ult' };
      if (map[e.code]) this.pressed[map[e.code]] = true;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      this.syncKeys();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; this.syncKeys(); });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.touch) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      else if (e.button === 0) this.fire = true;
    });
    addEventListener('mouseup', (e) => { if (!this.touch && e.button === 0) this.fire = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && this.enabled) { this.look.x += e.movementX * this.sens; this.look.y += e.movementY * this.sens; }
    });
    // --- touch
    this.stickId = null; this.lookId = null; this.lookLast = null;
    const stick = ui.stick, knob = ui.knob, R = 52;
    const zone = ui.touchZone;
    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.pointerType === 'mouse') return;
      e.preventDefault();
      if (e.clientX < innerWidth * 0.42 && this.stickId === null) {
        this.stickId = e.pointerId; this.stickO = { x: e.clientX, y: e.clientY };
        stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
      } else if (this.lookId === null) { this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY }; }
    });
    const mv = (e) => {
      if (e.pointerId === this.stickId) {
        let dx = e.clientX - this.stickO.x, dy = e.clientY - this.stickO.y; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.move.x = dx / R; this.move.y = -dy / R;
      } else if (e.pointerId === this.lookId) {
        this.look.x += (e.clientX - this.lookLast.x) * this.sens; this.look.y += (e.clientY - this.lookLast.y) * this.sens;
        this.lookLast = { x: e.clientX, y: e.clientY };
      }
    };
    const up = (e) => {
      if (e.pointerId === this.stickId) { this.stickId = null; this.move.x = this.move.y = 0; stick.classList.remove('on'); }
      if (e.pointerId === this.lookId) { this.lookId = null; if (this.fireHeldBy === e.pointerId) { this.fire = false; this.fireHeldBy = null; } }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    // buttons: fire doubles as a look pad so you can track while shooting
    const btn = (el, down, upFn) => {
      el.addEventListener('pointerdown', (e) => { if (!this.enabled) return; e.preventDefault(); e.stopPropagation(); el.classList.add('down'); down(e); });
      const rel = (e) => { el.classList.remove('down'); upFn && upFn(e); };
      el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel);
    };
    ui.fire.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return; e.preventDefault(); e.stopPropagation();
      this.fire = true; ui.fire.classList.add('down');
      if (this.lookId === null) { this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY }; this.fireHeldBy = e.pointerId; }
      else this.fireBtnId = e.pointerId;
    });
    const fireUp = (e) => { if (e.pointerId === this.fireBtnId || e.pointerId === this.fireHeldBy) { this.fire = false; this.fireBtnId = null; ui.fire.classList.remove('down'); } };
    addEventListener('pointerup', fireUp); addEventListener('pointercancel', fireUp);
    btn(ui.jump, () => { this.jump = true; }, () => { this.jump = false; });
    ui.abs.forEach((el, i) => btn(el, () => { this.pressed['ab' + i] = true; }));
    btn(ui.ult, () => { this.pressed.ult = true; });
    addEventListener('contextmenu', (e) => e.preventDefault());
  }
  syncKeys() {
    if (this.touch && this.stickId !== null) return;
    const k = this.keys;
    this.move.x = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0); this.move.y = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    this.jump = !!k.Space;
  }
  consume(name) { const v = !!this.pressed[name]; this.pressed[name] = false; return v; }
  consumeLook() { const l = { x: this.look.x, y: this.look.y }; this.look.x = this.look.y = 0; return l; }
  reset() { this.move.x = this.move.y = 0; this.fire = false; this.jump = false; this.pressed = {}; this.look.x = this.look.y = 0; this.keys = {}; }
}
