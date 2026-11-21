"""Build a friend's anime character from the CC0 VRoid sample avatars and export a game-ready GLB.

Each character = one avatar's body and outfit, optionally another avatar's hairstyle, recoloured to suit the friend.
Usage: python3 vgen.py <id|all> [samples_dir] [out_dir]      (needs `pip install bpy numpy`)
"""
import os, shutil, sys, tempfile
import bpy
import numpy as np

SAMPLES = sys.argv[2] if len(sys.argv) > 2 else '/home/user/vrm/vrm-samples/vroid'
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models')
FILES = {
    'vest': 'beta/Sakurada_Fumiriya.vrm', 'hoodie': 'beta/HairSample_Male.vrm', 'tech': 'stable/AvatarSample_C.vrm',
    'shino': 'beta/Sendagaya_Shino.vrm', 'sampleA': 'stable/AvatarSample_A.vrm',
}
BLACK, WHITE = (0.15, 0.15, 0.18), (0.93, 0.93, 0.92)
# colours: (rgb, recolour_everything) - by default near-white areas (shirts, soles, trim) are left alone
CHARS = {
    'mason': dict(base='vest', hair='tech', hair_rgb=(0.22, 0.15, 0.10), skin=(0.95, 0.86, 0.78), tops=((0.80, 0.10, 0.08), False), bottoms=(BLACK, True), neck=(WHITE, True), shoes=(WHITE, True)),
    'cole': dict(base='vest', hair=None, hair_rgb=(0.27, 0.18, 0.11), tops=((0.45, 0.60, 0.88), False), bottoms=((0.13, 0.16, 0.27), True), neck=((0.80, 0.08, 0.14), True), shoes=(WHITE, True)),
    'billy': dict(base='vest', hair='hoodie', hair_rgb=(0.33, 0.22, 0.13), tops=((0.34, 0.42, 0.37), False), bottoms=((0.22, 0.33, 0.52), True), neck=((0.20, 0.24, 0.22), True), shoes=(WHITE, True)),
    'james': dict(base='hoodie', hair='vest', hair_rgb=(0.09, 0.07, 0.06), skin=(0.94, 0.84, 0.76), tops=(BLACK, True), bottoms=(BLACK, True), shoes=(WHITE, True)),
    'grant': dict(base='hoodie', hair='tech', hair_rgb=(0.34, 0.24, 0.16), tops=((0.47, 0.43, 0.39), True), bottoms=(BLACK, True), shoes=((0.72, 0.73, 0.76), True)),
    'cam': dict(base='tech', hair='hoodie', hair_rgb=(0.20, 0.13, 0.08), tops=(BLACK, True), bottoms=(WHITE, True), shoes=(BLACK, True)),
    'henry': dict(base='tech', hair='vest', hair_rgb=(0.38, 0.24, 0.13), tops=(BLACK, True), bottoms=(BLACK, True), shoes=(WHITE, True)),
    'sarah': dict(base='shino', hair=None, hair_rgb=(0.17, 0.10, 0.08), tops=((0.16, 0.21, 0.36), False), bottoms=(BLACK, True), neck=((0.85, 0.73, 0.45), True), shoes=(WHITE, True)),
    'sam': dict(base='sampleA', hair=None, hair_rgb=(0.11, 0.08, 0.06), skin=(0.93, 0.83, 0.74), tops=(BLACK, True), bottoms=(BLACK, True), shoes=(WHITE, True)),
}
HAIR_TRIS = 5000


def load(key):
    """import one avatar; returns (armature, {'Face'|'Body'|'Hair': object})"""
    tmp = os.path.join(tempfile.gettempdir(), key + '.glb')
    shutil.copy(os.path.join(SAMPLES, FILES[key]), tmp)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=tmp)
    new = set(bpy.data.objects) - before
    arm = next(o for o in new if o.type == 'ARMATURE')
    parts = {}
    for o in new:
        if o.type == 'MESH':
            for k in ('Face', 'Body', 'Hair'):
                if o.name.startswith(k): parts[k] = o
    return arm, parts, new


def head_pos(arm):
    return arm.matrix_world @ arm.data.bones['J_Bip_C_Head'].head_local


def pixels(img):
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def tint(img, rgb, everything, k=0.5):
    a = pixels(img)
    c = a[..., :3]
    lum = c.mean(-1, keepdims=True)
    vis = a[..., 3] > 0.2
    ref = max(0.08, float(np.median(lum[vis])) if vis.any() else 0.5)
    out = np.array(rgb, dtype=np.float32) * np.clip(k + (1 - k) * lum / ref, 0, 1.6)
    if not everything:  # keep near-white, unsaturated areas (shirt, trim) as they are
        sat = c.max(-1, keepdims=True) - c.min(-1, keepdims=True)
        keep = np.clip((lum - 0.62) / 0.2, 0, 1) * np.clip(1 - sat / 0.25, 0, 1)
        out = out * (1 - keep) + c * keep
    a[..., :3] = np.clip(out, 0, 1)
    img.pixels.foreach_set(a.reshape(-1)); img.update()


def build(cid):
    C = CHARS[cid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    arm, parts, _ = load(C['base'])
    if C.get('hair'):
        darm, dparts, dnew = load(C['hair'])
        hair = dparts['Hair']
        off = head_pos(arm) - head_pos(darm)
        # borrowed hair becomes rigid on the head: one vertex group, moved to the new head position
        hair.parent = None
        hair.matrix_world = darm.matrix_world.copy()
        for v in hair.data.vertices: v.co = v.co + hair.matrix_world.inverted().to_3x3() @ off
        hair.vertex_groups.clear()
        g = hair.vertex_groups.new(name='J_Bip_C_Head'); g.add(list(range(len(hair.data.vertices))), 1.0, 'REPLACE')
        for m in list(hair.modifiers): hair.modifiers.remove(m)
        hair.modifiers.new('Armature', 'ARMATURE').object = arm
        hair.parent = arm
        bpy.data.objects.remove(parts['Hair'], do_unlink=True)
        parts['Hair'] = hair
        for o in dnew:
            if o != hair and o.name in bpy.data.objects: bpy.data.objects.remove(o, do_unlink=True)
    # recolour (each image once)
    done = set()
    for o in parts.values():
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.node_tree: continue
            name = m.name
            for n in m.node_tree.nodes:
                if n.type != 'TEX_IMAGE' or not n.image or n.image.name in done: continue
                img = n.image; done.add(img.name)
                w, h = img.size
                lim = 1024 if 'Face_00' in name else 256 if ('Eye' in name or 'Brow' in name or 'Mouth' in name) else 512
                if max(w, h) > lim: img.scale(lim, lim)
                if '_HAIR' in name or 'FaceBrow' in name: tint(img, C['hair_rgb'], True, 0.45)
                elif '_SKIN' in name and C.get('skin'):
                    a = pixels(img); a[..., :3] *= np.array(C['skin'], dtype=np.float32); img.pixels.foreach_set(a.reshape(-1)); img.update()
                else:
                    for key, cfg in (('Tops', 'tops'), ('Bottoms', 'bottoms'), ('Shoes', 'shoes'), ('AccessoryNeck', 'neck')):
                        if key in name and C.get(cfg): tint(img, C[cfg][0], C[cfg][1])
                img.pack()
    # drop face blend shapes, thin out the hair
    for o in parts.values():
        if o.data.shape_keys:
            bpy.context.view_layer.objects.active = o; o.shape_key_clear()
    hair = parts['Hair']
    tris = sum(len(p.vertices) - 2 for p in hair.data.polygons)
    if tris > HAIR_TRIS * 1.2:
        bpy.context.view_layer.objects.active = hair
        mod = hair.modifiers.new('dec', 'DECIMATE'); mod.ratio = HAIR_TRIS / tris
        while hair.modifiers[0].name != 'dec': bpy.ops.object.modifier_move_up(modifier='dec')
        bpy.ops.object.modifier_apply(modifier='dec')
    total = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts.values())
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for o in parts.values(): o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, cid + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='WEBP', export_image_quality=85,
                              export_animations=False, export_morph=False, export_skins=True, export_yup=True)
    print(f'WROTE {cid}: {total} tris, {os.path.getsize(path) / 1e6:.2f} MB')


for cid in (CHARS if sys.argv[1] == 'all' else [sys.argv[1]]):
    build(cid)
