# Character generation (low-poly)

The models in `public/models/*.glb` come from Quaternius' "Ultimate Animated Character Pack" (CC0, https://quaternius.com).
`build.py` picks one pack character per friend, recolours its skin, hair and clothes, and exports a small GLB.
The per-friend choices and colours are the `CHARS` table at the top of `build.py`.

```
pip install bpy
python3 tools/lowpoly/build.py all /path/to/pack/glTF
```
