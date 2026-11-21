# Character generation (anime avatars)

The models in `public/models/*.glb` are built from VRoid Studio's free sample avatars by `vgen.py`:
each friend gets one avatar's body and outfit, optionally another avatar's hairstyle, and recoloured hair, skin and clothes.
Settings per friend are in the `CHARS` table at the top of `vgen.py`.

```
pip install bpy numpy
git clone https://github.com/madjin/vrm-samples        # contains the sample avatars under vroid/
python3 tools/anime/vgen.py all /path/to/vrm-samples/vroid
```

Sources and licences:

- `Sakurada_Fumiriya`, `HairSample_Male`, `Sendagaya_Shino` (VRoid beta samples): CC0.
- `AvatarSample_A`, `AvatarSample_C` (VRoid samples by pixiv): free to use and modify under pixiv's conditions of use,
  not CC0. See https://vroid.pixiv.help/hc/en-us/articles/4402394424089. Used for Cam, Henry and Sam, and for Mason's and Grant's hair.
