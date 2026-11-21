import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Loads the MakeHuman-generated characters (public/models/<id>.glb) and drives their skeletons.
// The game animates with simple joint angles (shoulder, elbow, hip, knee, torso, head) expressed in
// character space with the arms/legs hanging straight down; this file converts those into bone rotations,
// whatever the bones' own axes and rest pose are.

const Q = THREE.Quaternion, V3 = THREE.Vector3;
const DOWN = new V3(0, -1, 0);
const humans = new Map(); // hero id -> prototype group

const CHAINS = { // bone -> the bone that marks where it ends (for the "hang straight down" alignment)
  upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r',
  thigh_l: 'calf_l', calf_l: 'foot_l', thigh_r: 'calf_r', calf_r: 'foot_r',
};

function prepare(gltf) {
  const proto = new THREE.Group();
  const inner = new THREE.Group(); inner.name = 'body';
  gltf.scene.rotation.y = Math.PI; // exported facing +Z; the game faces -Z
  inner.add(gltf.scene); proto.add(inner);
  proto.updateMatrixWorld(true);
  // cheap unlit-ish materials instead of PBR
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material, cut = m.transparent || m.alphaTest > 0;
    o.material = new THREE.MeshLambertMaterial({ map: m.map, color: m.color, alphaTest: cut ? 0.45 : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide });
    o.frustumCulled = false;
  });
  const bones = {};
  gltf.scene.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const W = (n) => bones[n].getWorldQuaternion(new Q());
  const P = (n) => bones[n].getWorldPosition(new V3());
  const align = (n) => new Q().setFromUnitVectors(P(CHAINS[n]).sub(P(n)).normalize(), DOWN);
  // local = pre * anim * post
  const drv = {};
  const limb = (side) => {
    const u = 'upperarm_' + side, f = 'lowerarm_' + side, t = 'thigh_' + side, c = 'calf_' + side;
    const Au = align(u).multiply(W(u)), Af = align(f).multiply(W(f)), At = align(t).multiply(W(t)), Ac = align(c).multiply(W(c));
    drv[u] = { pre: bones[u].parent.getWorldQuaternion(new Q()).invert(), post: Au };
    drv[f] = { pre: Au.clone().invert(), post: Af };
    drv[t] = { pre: bones[t].parent.getWorldQuaternion(new Q()).invert(), post: At };
    drv[c] = { pre: At.clone().invert(), post: Ac };
    // where a held item sits: identity orientation when the arm hangs straight down
    const hand = 'hand_' + side, handAligned = align(f).multiply(W(hand));
    drv[hand] = { grip: handAligned.invert() };
  };
  limb('l'); limb('r');
  drv.spine_01 = { pre: bones.spine_01.parent.getWorldQuaternion(new Q()).invert(), post: W('spine_01') };
  drv.head = { pre: bones.head.parent.getWorldQuaternion(new Q()).invert(), post: W('head') };
  const box = new THREE.Box3().setFromObject(gltf.scene);
  proto.userData = { drv, height: box.max.y - box.min.y, footY: box.min.y };
  return proto;
}

export async function loadHumans(ids, base = 'models/') {
  const loader = new GLTFLoader();
  await Promise.all(ids.map(async (id) => {
    try { humans.set(id, prepare(await loader.loadAsync(`${base}${id}.glb`))); } catch (e) { /* no model file yet: the code-built fallback is used */ }
  }));
}
export const hasHuman = (id) => humans.has(id);

const _q = new Q(), _e = new THREE.Euler();
class Rig {
  constructor(root, drv) {
    this.bones = {}; this.drv = drv;
    root.traverse((o) => { if (o.isBone && (drv[o.name])) this.bones[o.name] = o; });
  }
  set(name, euler) {
    const d = this.drv[name], b = this.bones[name];
    _q.setFromEuler(euler);
    b.quaternion.copy(d.pre).multiply(_q).multiply(d.post);
  }
  // parts: { torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR } each with .rotation (Euler)
  apply(p) {
    this.set('spine_01', p.torso.rotation); this.set('head', p.head.rotation);
    this.set('upperarm_l', p.armL.rotation); this.set('lowerarm_l', p.elbowL.rotation);
    this.set('upperarm_r', p.armR.rotation); this.set('lowerarm_r', p.elbowR.rotation);
    this.set('thigh_l', p.legL.rotation); this.set('calf_l', p.kneeL.rotation);
    this.set('thigh_r', p.legR.rotation); this.set('calf_r', p.kneeR.rotation);
  }
  // attach a held object (built pointing along -Y from the hand, like the old forearm-mounted weapons)
  hold(side, obj, scale) {
    const hand = this.bones['hand_' + side], g = new THREE.Group();
    g.quaternion.copy(this.drv['hand_' + side].grip);
    obj.position.set(0, -0.085, 0);
    g.add(obj); g.scale.setScalar(scale); hand.add(g);
  }
}

// returns { root, parts, rig } or null when there is no model for this hero
export function makeHuman(id, targetHeight) {
  const proto = humans.get(id);
  if (!proto) return null;
  const root = cloneSkinned(proto);
  const body = root.getObjectByName('body');
  const s = targetHeight / proto.userData.height;
  body.scale.setScalar(s); body.position.y = -proto.userData.footY * s;
  const rig = new Rig(root, proto.userData.drv);
  const part = () => ({ rotation: new THREE.Euler() });
  const parts = { body: new THREE.Group(), torso: part(), head: part(), armL: part(), armR: part(), elbowL: part(), elbowR: part(), legL: part(), legR: part(), kneeL: part(), kneeR: part() };
  // "body" bob/dance moves go on a wrapper so the height fit above is kept
  root.remove(body); parts.body.add(body); root.add(parts.body);
  return { root, parts, rig, scale: s };
}
