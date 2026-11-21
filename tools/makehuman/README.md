# Character generation (MakeHuman / MPFB)

The models in `public/models/*.glb` are generated with [MPFB](https://static.makehumancommunity.org/mpfb.html), the MakeHuman add-on for Blender, run headless through Blender's Python module.

- `chars.py` holds each friend's settings: body sliders, face shape, skin tone, hair, clothes, recolours, garment cuts and painted facial hair.
- `gen.py <id>` builds one character and writes `public/models/<id>.glb` (body, hair, clothes, 53-bone game skeleton, WebP textures, about 15k triangles).
- `mh.py` enables the add-on.

Setup used:

1. `pip install bpy` (Blender as a Python module).
2. Clone `makehumancommunity/mpfb2` and link `src/mpfb` into Blender's user extensions folder as `mpfb` (see `mh.py`).
3. Unzip the MakeHuman asset packs into the add-on's data folder: `makehuman_system_assets_cc0`, `shirts01_cc0`, `pants01_cc0`, `hats01_cc0`, `glasses01_cc0`.

Licences: the generated characters and the asset packs above are CC0. The add-on's code is GPL and is not part of this repository.
