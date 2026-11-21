"""Generate a friend's character with MakeHuman (MPFB) and export a game-ready GLB.
Usage: python3 gen.py <id> [out_dir]"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mh import *
from chars import CHARS, repaint

ExportService = svc('services.exportservice', 'ExportService')
ObjectService = svc('services.objectservice', 'ObjectService')

cid = sys.argv[1]
out_dir = sys.argv[2] if len(sys.argv) > 2 else '/home/user/dorks-fps/public/models'
C = CHARS[cid]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')

# 1. body shape
h = HumanService.create_human()
for k, v in C['macro'].items():
    HumanObjectProperties.set_value(k, v, entity_reference=h)
TargetService.reapply_macro_details(h)
for name, w in C.get('targets', {}).items():
    path = TargetService.target_full_path(name)
    if not path:
        print('!! missing target', name); continue
    TargetService.load_target(h, path, weight=w, name=name)

# 2. skin, skeleton, then everything that is fitted to the body
skin = AssetService.find_asset_absolute_path(C['skin'] + '.mhmat', asset_subdir='skins')
HumanService.set_character_skin(skin, h, skin_type='GAMEENGINE')
HumanService.add_builtin_rig(h, 'game_engine')
parts = [('eyes', 'low-poly', 'Eyes'), ('eyebrows', C.get('brows', 'eyebrow001'), 'Eyebrows'), ('eyelashes', 'eyelashes01', 'Eyelashes'), ('teeth', 'teeth_base', 'Teeth')]
if C.get('hair'): parts.append(('hair', C['hair'], 'Hair'))
for c in C['clothes']: parts.append(('clothes', c, 'Clothes'))
kinds = {}
for sub, name, kind in parts:
    path = AssetService.find_asset_absolute_path(name + '.mhclo', asset_subdir=sub)
    if path is None:
        print('!! missing asset', sub, name); continue
    before = set(bpy.data.objects)
    HumanService.add_mhclo_asset(path, h, asset_type=kind, material_type='GAMEENGINE')
    for o in set(bpy.data.objects) - before: kinds[o.name] = (kind, name)

# 2b. cut garments down (trousers -> shorts, tee -> tank top) and stop them hiding the body below the cut
import bmesh, mathutils
H = max((h.matrix_world @ v.co).z for v in h.data.vertices if True)
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
H = (rig.matrix_world @ rig.data.bones['head'].tail_local).z + 0.09
shoulder = abs((rig.matrix_world @ rig.data.bones['upperarm_l'].head_local).x)
for oname, (kind, aname) in kinds.items():
    for key, rule in C.get('cut', {}).items():
        if key not in aname: continue
        o = bpy.data.objects[oname]
        bm = bmesh.new(); bm.from_mesh(o.data)
        inv = o.matrix_world.inverted()
        def slice_off(co, no):  # clean planar cut; removes the side the normal points away from
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=inv @ mathutils.Vector(co), plane_no=mathutils.Vector(no), clear_inner=True)
        n0 = len(bm.verts)
        if rule[0] == 'sleeves':
            slice_off((shoulder + 0.03, 0, 0), (-1, 0, 0)); slice_off((-shoulder - 0.03, 0, 0), (1, 0, 0))
        else:
            slice_off((0, 0, rule[1] * H), (0, 0, 1))
        kill = range(n0 - len(bm.verts))
        bm.to_mesh(o.data); bm.free()
        for m in list(h.modifiers):
            if m.type == 'MASK' and aname.lower() in (m.name + ' ' + m.vertex_group).lower(): h.modifiers.remove(m)
        print('  cut', oname, rule, 'removed', len(kill), 'verts')
for oname, (kind, aname) in kinds.items():  # lengthen short tops so they overlap the waistband
    for key, amt in C.get('drop', {}).items():
        if key not in aname: continue
        o = bpy.data.objects[oname]
        for v in o.data.vertices:
            z = (o.matrix_world @ v.co).z
            if z < 0.66 * H: v.co.z -= amt * H * min(1.0, (0.66 * H - z) / (0.05 * H))
print('  body modifiers:', [(m.type, m.name) for m in h.modifiers])

# 3. export copy: bake shape + masks, drop helper geometry
root = ExportService.create_character_copy(h, name_suffix='_x')
xb = ObjectService.find_object_of_type_amongst_nearest_relatives(root, 'Basemesh')
ExportService.bake_modifiers_remove_helpers(xb, bake_masks=True, bake_subdiv=False, remove_helpers=True, also_proxy=True)
if TargetService.has_any_shapekey(xb): TargetService.bake_targets(xb)
objs = [root] + list(ObjectService.get_list_of_children(root))
meshes = [o for o in objs if o.type == 'MESH']

# 4. recolour / repaint textures, then shrink them
for o in meshes:
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                k = kinds.get(o.name[:-2], ('', ''))[0]
                repaint(cid, C, o.name, n.image, o == xb, k == 'Hair')

# 5. reduce triangles
budget = C.get('tris', {})
for o in meshes:
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    kind = 'body' if o == xb else ('hair' if kinds.get(o.name[:-2], ('', ''))[0] == 'Hair' else 'other')
    if 'teeth' in o.name: kind = 'teeth'
    if 'shoe' in o.name: kind = 'shoes'
    target = budget.get(kind, {'body': 7000, 'hair': 2500, 'other': 3000, 'teeth': 500, 'shoes': 1600}[kind])
    if tris > target * 1.15:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris
        while o.modifiers[0].name != 'dec': bpy.ops.object.modifier_move_up(modifier='dec')
        bpy.ops.object.modifier_apply(modifier='dec')
    print(f'  {o.name:40s} {kind:6s} tris {tris} -> {sum(len(p.vertices) - 2 for p in o.data.polygons)}')

# 6. export
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = root
os.makedirs(out_dir, exist_ok=True)
path = os.path.join(out_dir, cid + '.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='WEBP', export_image_quality=82,
                          export_animations=False, export_morph=False, export_skins=True, export_yup=True)
print('WROTE', path, round(os.path.getsize(path) / 1e6, 2), 'MB')
