"""Build each friend's low-poly character from Quaternius' "Ultimate Animated Character Pack" (CC0).

Picks one pack character per friend, recolours its materials (skin, hair, clothes) and exports a small GLB
without the pack's animations (the game poses the skeleton itself).
Usage: python3 build.py <id|all> <pack_dir_with_gltf_files> [out_dir]      (needs `pip install bpy`)
"""
import os, sys
import bpy

PACK = sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models')
DARK = '#26262e'
# friend -> (pack character, {material name: colour})
CHARS = {
    'mason': ('Casual_Male', {'Skin': '#d9a273', 'Shirt': '#da291c', 'Pants': DARK, 'Belt': '#111114', 'Hair': '#3a2a1e'}),
    'cole': ('Casual2_Male', {'Skin': '#f0c4a2', 'Shirt': '#8fa9d8', 'Pants': '#2b3350', 'Belt': '#b3202c', 'Hair': '#33241a'}),
    'james': ('Casual3_Male', {'Skin': '#d7a078', 'Shirt': DARK, 'Pants': DARK, 'Belt': '#111114', 'Hair': '#1f1712'}),
    'cam': ('Doctor_Male_Young', {'Skin': '#f3cbb4', 'Hair': '#3a2619', 'Main': DARK, 'Black': '#3a3a46', 'Brown': '#f1efe9'}),
    'billy': ('Cowboy_Hair', {'Skin': '#f0c6a6', 'Hair': '#4a3120', 'Jacket': '#5d6a62', 'Top': '#4c5750', 'Scarf': '#5d6a62', 'HatBrown': '#f2f2f2', 'Pants': '#3d5a85'}),
    'grant': ('Soldier_Male', {'Skin': '#f1c7a8', 'Main': '#7b7067', 'Black': DARK, 'DarkGreen': '#1e1e24', 'Helmet': '#5a6040'}),
    'henry': ('Ninja_Male_Hair', {'Skin': '#f5cdb8', 'Hair': '#5a3b26', 'Main': DARK, 'Details': '#f2c230', 'Grey': '#3a3a44'}),
    'sarah': ('Suit_Female', {'Skin': '#f4d2bd', 'Hair': '#33211a', 'Black': '#2f3b5c', 'Belt': '#17171b', 'Shirt': '#fbfbfb', 'Details': '#d9c08a'}),
    'sam': ('Casual_Female', {'Skin': '#d9a57f', 'Hair': '#241711', 'Shirt': DARK, 'Pants': DARK, 'Belt': '#f4f4f4'}),
}


def linear(hexcol):
    c = [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1.0]


def build(cid):
    src, cols = CHARS[cid]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(PACK, src + '.gltf'))
    seen = set()
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        for slot in o.material_slots:
            m = slot.material
            if not m or m.name in seen: continue
            seen.add(m.name)
            base = m.name.split('.')[0]
            bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is None: continue
            if base in cols: bsdf.inputs['Base Color'].default_value = linear(cols[base])
            bsdf.inputs['Metallic'].default_value = 0.0; bsdf.inputs['Roughness'].default_value = 1.0
    missing = set(cols) - {n.split('.')[0] for n in seen}
    if missing: print('!! no such material on', src, missing)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, cid + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=False, export_morph=False, export_skins=True, export_yup=True)
    print(f'WROTE {cid} from {src}: {os.path.getsize(path) / 1e3:.0f} KB, materials {sorted(seen)}')


for cid in (CHARS if sys.argv[1] == 'all' else [sys.argv[1]]):
    build(cid)
