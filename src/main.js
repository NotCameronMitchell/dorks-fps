import * as THREE from 'three';
import { HEROES, ROLE } from './heroes.js';
import { MAPS } from './maps.js';
import { makeCharacter, animateCharacter } from './models.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const coarse = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
const camera = new THREE.PerspectiveCamera(coarse ? 72 : 80, 1, 0.08, 220);
const scene = new THREE.Scene();
scene.add(camera);

const audio = new Audio();
const hud = new Hud(audio);
const input = new Input(canvas, {
  touchZone: $('touchzone'), stick: $('stick'), knob: $('knob'), fire: $('bfire'), jump: $('bjump'), abs: [$('b0'), $('b1'), $('b2')], ult: $('bult'),
});
if (input.touch) document.body.classList.add('touch');

// ---- menu preview scene ------------------------------------------------------
const menuScene = new THREE.Scene();
menuScene.background = new THREE.Color(0x0b0d1a);
menuScene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 4); menuScene.add(key);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.25, 32), new THREE.MeshLambertMaterial({ color: 0x1c2147 }));
pedestal.position.y = -0.125; menuScene.add(pedestal);
const menuCam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
let preview = null, previewHero = null, lineup = [];

function showPreview(hero) {
  if (preview) menuScene.remove(preview);
  for (const m of lineup) menuScene.remove(m);
  lineup = [];
  previewHero = hero;
  if (!hero) {
    // title screen: the whole roster in a row
    HEROES.forEach((h, i) => { const m = makeCharacter(h.look); m.position.set((i - 4) * 1.15, 0, -Math.abs(i - 4) * 0.25); m.rotation.y = Math.PI + (i - 4) * -0.08; menuScene.add(m); lineup.push(m); });
    pedestal.visible = false; preview = null;
    return;
  }
  pedestal.visible = true;
  preview = makeCharacter(hero.look);
  menuScene.add(preview);
}

// ---- menu flow ---------------------------------------------------------------
let selected = HEROES[0], selectedMap = MAPS[0], game = null, paused = false, state = 'title';

function show(id) {
  for (const p of ['title', 'heroes', 'maps']) $(p).classList.toggle('hidden', p !== id);
  $('menu').classList.remove('hidden');
  state = id;
  showPreview(id === 'heroes' ? selected : id === 'title' ? null : previewHero);
  layout();
}

function renderInfo(h) {
  const k = (icon, name, tag, desc) => `<div class="k"><i>${icon}</i><b>${name}<small>${tag}</small></b><p>${desc}</p></div>`;
  $('info').innerHTML = `<h3>${h.name.toUpperCase()}</h3><p class="tag">${h.tagline}</p>
    <div class="stats">${ROLE[h.role].icon} ${ROLE[h.role].name} · ${h.hp} HP</div>
    ${k(h.weapon.icon, h.weapon.name, 'weapon', h.weapon.melee ? 'Melee attack.' : 'Ranged attack.')}
    ${k(h.passive.icon, h.passive.name, 'passive', h.passive.desc)}
    ${h.abilities.map((a) => k(a.icon, a.name, a.cd + 's', a.desc)).join('')}
    ${k(h.ult.icon, h.ult.name, 'ultimate', h.ult.desc)}`;
  $('info').scrollTop = 0;
}

function selectHero(h) {
  selected = h;
  document.querySelectorAll('.hbtn').forEach((b) => b.classList.toggle('sel', b.dataset.id === h.id));
  renderInfo(h); showPreview(h);
}

for (const h of HEROES) {
  const b = document.createElement('button');
  b.className = 'hbtn ' + h.role; b.dataset.id = h.id;
  b.innerHTML = `<b>${h.name.toUpperCase()}</b><span>${ROLE[h.role].icon} ${ROLE[h.role].name}</span>`;
  b.onclick = () => { audio.unlock(); audio.play('cast', 0.5); selectHero(h); };
  $('grid').appendChild(b);
}
const mapBg = { local: 'linear-gradient(160deg,#f6b67a,#9a4f3c 70%)', thrift: 'linear-gradient(160deg,#d8cfa8,#5aa6c8 60%,#d96c8a)', server: 'linear-gradient(160deg,#080814,#3b1466 55%,#25e6ff)' };
for (const m of MAPS) {
  const b = document.createElement('button');
  b.className = 'map'; b.style.background = mapBg[m.id];
  b.innerHTML = `<b>${m.name}</b><span>${m.blurb}</span>`;
  b.onclick = () => { selectedMap = m; startMatch(); };
  $('maplist').appendChild(b);
}

function goFullscreen() {
  const el = document.documentElement;
  if (input.touch && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
}

$('play').onclick = () => { audio.unlock(); goFullscreen(); selectHero(selected); show('heroes'); };
$('next').onclick = () => show('maps');
$('back').onclick = () => show('heroes');

function startMatch() {
  audio.unlock();
  if (game) game.dispose();
  $('menu').classList.add('hidden');
  input.reset();
  game = new Game({ scene, camera, mapDef: selectedMap, playerHero: selected, hud, audio, input });
  window.__game = game;
  state = 'game'; paused = false; input.enabled = true;
  layout();
}

function endMatch() {
  if (game) { game.dispose(); game = null; }
  input.enabled = false; hud.hide(); $('pausemenu').classList.add('hidden');
  document.exitPointerLock?.();
}

function setPaused(p) {
  paused = p; input.enabled = !p;
  $('pausemenu').classList.toggle('hidden', !p);
  $('autofire').textContent = 'AUTO-FIRE: ' + (input.autoFire ? 'ON' : 'OFF');
  $('mute').textContent = 'SOUND: ' + (audio.muted ? 'OFF' : 'ON');
  if (p) { document.exitPointerLock?.(); input.reset(); }
}
$('pause').onclick = () => setPaused(true);
$('resume').onclick = () => setPaused(false);
$('autofire').onclick = () => { input.autoFire = !input.autoFire; setPaused(true); };
$('mute').onclick = () => { audio.muted = !audio.muted; setPaused(true); };
$('quit').onclick = () => { endMatch(); show('heroes'); };
$('again').onclick = () => { startMatch(); };
$('tomenu').onclick = () => { endMatch(); show('heroes'); };
addEventListener('keydown', (e) => { if (e.code === 'Escape' && state === 'game' && game && !game.over) setPaused(!paused); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'game' && game && !game.over) setPaused(true); });

// ---- layout + loop -----------------------------------------------------------
function layout() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  menuCam.aspect = w / h;
  if (state === 'heroes') { menuCam.position.set(0, 1.25, 6.4); menuCam.lookAt(0, 0.98, 0); menuCam.setViewOffset(w, h, -w * 0.02, 0, w, h); }
  else { menuCam.clearViewOffset(); menuCam.position.set(0, 1.5, 9.5); menuCam.lookAt(0, 1.0, 0); }
  menuCam.updateProjectionMatrix();
}
addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 200));

const STILL = location.search.includes('still'); // debug: hold the preview model still
let last = performance.now(), mt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'game' && game) {
    if (!paused) game.update(dt);
    renderer.render(scene, camera);
  } else {
    mt += dt;
    if (preview) {
      preview.rotation.y = Math.PI + (STILL ? 0.3 : Math.sin(mt * 0.7) * 0.9);
      const w = previewHero.weapon, cyc = mt % 3;
      animateCharacter(preview, { speed: 0, attackT: cyc < 0.25 ? 1 - cyc * 4 : 0, castT: previewHero.id === 'sarah' && cyc > 1.6 && cyc < 2.6 ? 2.6 - cyc : 0, castKind: Math.floor(mt / 3) % 4, pitch: 0, ranged: !w.melee, twoHand: w.twoHand, big: 1 }, dt, mt);
    }
    lineup.forEach((m, i) => animateCharacter(m, { speed: 0, attackT: 0, castT: 0, castKind: 0, pitch: 0, ranged: !HEROES[i].weapon.melee, twoHand: HEROES[i].weapon.twoHand, big: 1 }, dt, mt));
    renderer.render(menuScene, menuCam);
  }
}
show('title');
requestAnimationFrame(frame);
