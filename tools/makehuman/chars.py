"""Per-friend settings for gen.py: body shape, skin, hair, clothes, cuts and texture repaints.

macro: MakeHuman sliders 0..1 (gender 1 = male). tint: asset-name substring -> RGB the texture is recoloured to.
cut: asset-name substring -> rule that removes part of a garment (trousers -> shorts, tee -> tank top).
skin_mul: RGB multiplier for skin tone. face: painted facial hair on the skin texture."""
import numpy as np

M = dict(gender=1.0, age=0.5, african=0.0, asian=0.0, caucasian=1.0, proportions=0.6)
F = dict(gender=0.0, age=0.45, african=0.0, asian=0.0, caucasian=1.0, proportions=0.6, cupsize=0.45, firmness=0.6)
SHORTS = ('below', 0.30)      # keep everything above 30% of body height (just above the knee)
SHORTS_HI = ('below', 0.37)   # mid-thigh

CHARS = {
    'mason': {
        'macro': {**M, 'muscle': 0.6, 'weight': 0.42, 'height': 0.85},
        'skin': 'young_caucasian_male', 'skin_mul': (0.93, 0.84, 0.76), 'hair': 'short04', 'hair_rgb': (0.20, 0.14, 0.10),
        'clothes': ['toigo_basic_tucked_t-shirt', 'cortu_cargo_pants', 'shoes05', 'toigo_maga_hat'],
        'tint': {'t-shirt': (0.80, 0.10, 0.08), 'cargo': (0.07, 0.07, 0.08), 'maga_hat': (0.95, 0.95, 0.95)}, 'flat': ['maga_hat'],
        'cut': {'cargo': SHORTS}, 'targets': {'head-oval': 0.4},
    },
    'cole': {
        'macro': {**M, 'muscle': 0.5, 'weight': 0.68, 'height': 0.5},
        'skin': 'young_caucasian_male', 'hair': 'short02', 'hair_rgb': (0.17, 0.12, 0.08),
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes05'],
        'tint': {'polo': (0.52, 0.64, 0.86), 'wool': (0.13, 0.16, 0.27)}, 'cut': {'wool': SHORTS}, 'targets': {'head-round': 0.4},
    },
    'james': {
        'macro': {**M, 'muscle': 1.0, 'weight': 0.66, 'height': 0.6},
        'skin': 'young_caucasian_male', 'skin_mul': (0.92, 0.82, 0.74), 'hair': 'afro01', 'hair_rgb': (0.08, 0.06, 0.05),
        'clothes': ['toigo_basic_tucked_t-shirt', 'cortu_cargo_pants', 'shoes05'],
        'tint': {'t-shirt': (0.06, 0.06, 0.07), 'cargo': (0.06, 0.06, 0.07)}, 'cut': {'cargo': SHORTS_HI, 't-shirt': ('sleeves', 0.0)},
        'face': {'stubble': 0.55, 'stache': 0.8, 'rgb': (0.08, 0.06, 0.05)},
    },
    'cam': {
        'macro': {**M, 'muscle': 0.35, 'weight': 0.95, 'height': 0.62},
        'skin': 'young_caucasian_male', 'skin_mul': (1.0, 0.97, 0.96), 'hair': 'bob01', 'hair_rgb': (0.17, 0.11, 0.07),
        'clothes': ['namuhekam_male_polo_shirt', 'toigo_wool_pants', 'shoes04'],
        'tint': {'polo': (0.06, 0.06, 0.07), 'wool': (0.93, 0.92, 0.89)}, 'cut': {'wool': SHORTS_HI}, 'targets': {'head-round': 0.6, 'head-fat-incr': 0.5},
    },
    'sarah': {
        'macro': {**F, 'muscle': 0.35, 'weight': 0.36, 'height': 0.3},
        'skin': 'young_caucasian_female', 'hair': 'long01', 'hair_rgb': (0.15, 0.09, 0.07),
        'clothes': ['toigo_fisherman_sweater', 'toigo_wool_pants', 'shoes05', 'spamrakuen_tbm_glasses_frames_01'],
        'tint': {'sweater': (0.16, 0.21, 0.36), 'wool': (0.07, 0.07, 0.08), 'glasses': (0.72, 0.62, 0.86)},
    },
    'billy': {
        'macro': {**M, 'muscle': 0.5, 'weight': 0.5, 'height': 0.8},
        'skin': 'young_caucasian_male', 'hair': 'short02', 'hair_rgb': (0.27, 0.18, 0.11),
        'clothes': ['namuhekam_male_polo_shirt', 'cortu_cargo_pants', 'shoes05'],
        'tint': {'polo': (0.34, 0.40, 0.36), 'cargo': (0.20, 0.31, 0.50)},
        'face': {'stache': 0.85, 'rgb': (0.24, 0.16, 0.10)},
    },
    'grant': {
        'macro': {**M, 'muscle': 0.6, 'weight': 0.66, 'height': 0.5},
        'skin': 'young_caucasian_male', 'hair': 'short01', 'hair_rgb': (0.30, 0.21, 0.15),
        'clothes': ['toigo_basic_tucked_t-shirt', 'cortu_cargo_pants', 'shoes02', 'toigo_maga_hat'],
        'tint': {'t-shirt': (0.47, 0.43, 0.39), 'cargo': (0.08, 0.08, 0.09), 'shoes02': (0.72, 0.73, 0.76), 'maga_hat': 'camo'}, 'flat': ['maga_hat'],
        'cut': {'cargo': SHORTS},
    },
    'henry': {
        'macro': {**M, 'muscle': 0.4, 'weight': 0.62, 'height': 0.5},
        'skin': 'young_caucasian_male', 'skin_mul': (1.0, 0.96, 0.95), 'hair': 'afro01', 'hair_rgb': (0.30, 0.19, 0.11),
        'clothes': ['toigo_basic_tucked_t-shirt', 'toigo_wool_pants', 'shoes05', 'toigo_round_glasses_leopard'],
        'tint': {'t-shirt': (0.06, 0.06, 0.07), 'wool': (0.07, 0.07, 0.08), 'glasses': (0.80, 0.66, 0.38)}, 'targets': {'head-round': 0.5},
    },
    'sam': {
        'macro': {**F, 'muscle': 0.6, 'weight': 0.38, 'height': 0.15},
        'skin': 'young_caucasian_female', 'skin_mul': (0.92, 0.82, 0.73), 'hair': 'braid01', 'hair_rgb': (0.10, 0.07, 0.05),
        'clothes': ['female_sportsuit01', 'shoes05', 'frankyaye_glasses_library_male'],
        'tint': {'sportsuit': (0.07, 0.07, 0.08), 'glasses': (0.03, 0.03, 0.03)}, 'cut': {'sportsuit': ('band', 0.30, 0.0)},
    },
}

MAX_TEX = 1024


def _get(img):
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def _put(img, a):
    img.pixels.foreach_set(np.clip(a, 0, 1).reshape(-1).astype(np.float32)); img.update()


def _camo(h, w):
    rng = np.random.default_rng(4)
    cols = np.array([[0.36, 0.36, 0.25], [0.21, 0.25, 0.15], [0.50, 0.47, 0.33], [0.13, 0.15, 0.10]])
    f = np.zeros((h, w))
    for _ in range(4):  # blobby noise from a few upsampled random grids
        g = rng.random((8, 8)); f += np.kron(g, np.ones((h // 8 + 1, w // 8 + 1)))[:h, :w]
        g = rng.random((16, 16)); f += 0.6 * np.kron(g, np.ones((h // 16 + 1, w // 16 + 1)))[:h, :w]
    q = np.digitize(f, np.quantile(f, [0.3, 0.55, 0.8]))
    return cols[q]


def _blob(h, w, cx, cy, rx, ry):
    """soft elliptical mask; coordinates are fractions measured from the top-left of the texture"""
    y, x = np.mgrid[0:h, 0:w]
    d = ((x / w - cx) / rx) ** 2 + ((1 - y / h - (1 - cy)) / ry) ** 2
    return np.clip(1.2 - d, 0, 1) ** 1.5


def repaint(cid, C, obj_name, img, is_skin, is_hair):
    w, h = img.size
    if max(w, h) > MAX_TEX:
        s = MAX_TEX / max(w, h); img.scale(max(1, int(w * s)), max(1, int(h * s))); w, h = img.size
    name = (obj_name + ' ' + img.name).lower()
    a = None
    if is_skin:
        a = _get(img)
        a[..., :3] *= np.array(C.get('skin_mul', (1, 1, 1)), dtype=np.float32)
        f = C.get('face')
        if f:  # the face sits sideways on the right of the skin texture: forehead to the left, chin to the right
            col = np.array(f['rgb'], dtype=np.float32)
            if f.get('stubble'):
                m = _blob(h, w, 0.925, 0.514, 0.05, 0.085) * f['stubble'] * 0.75
                m *= 1 - _blob(h, w, 0.905, 0.514, 0.012, 0.02)  # keep the lips clear
                a[..., :3] = a[..., :3] * (1 - m[..., None]) + col * m[..., None]
            if f.get('stache'):
                m = np.clip(_blob(h, w, 0.8915, 0.514, 0.0075, 0.03) * 1.6, 0, 1) * f['stache']
                a[..., :3] = a[..., :3] * (1 - m[..., None]) + col * m[..., None]
    elif is_hair and C.get('hair_rgb'):
        a = _get(img)
        lum = a[..., :3].mean(-1, keepdims=True)
        vis = a[..., 3] > 0.2
        ref = max(0.05, float(lum[vis].mean()) if vis.any() else 0.3)
        a[..., :3] = np.array(C['hair_rgb'], dtype=np.float32) * (0.35 + 0.65 * lum / ref)
    else:
        for key, rgb in C.get('tint', {}).items():
            if key not in name: continue
            a = _get(img)
            flat = any(k in name for k in C.get('flat', []))
            if isinstance(rgb, str):
                a[..., :3] = _camo(h, w)
            elif flat:
                a[..., :3] = np.array(rgb, dtype=np.float32)
            else:
                lum = a[..., :3].mean(-1, keepdims=True)
                vis = a[..., 3] > 0.2
                ref = max(0.05, float(lum[vis].mean()) if vis.any() else 0.5)
                a[..., :3] = np.array(rgb, dtype=np.float32) * (0.45 + 0.55 * lum / ref)
            break
    if a is not None: _put(img, a)
    img.pack()

FACE_TARGETS = {'mason': {'head-oval': 0.5, 'chin-prominent-incr': 0.3, 'l-cheek-bones-incr': 0.3, 'r-cheek-bones-incr': 0.3}, 'cole': {'head-round': 0.5, 'l-cheek-volume-incr': 0.4, 'r-cheek-volume-incr': 0.4}, 'james': {'head-square': 0.5, 'chin-width-incr': 0.5}, 'cam': {'head-round': 0.6, 'head-fat-incr': 0.6, 'l-cheek-volume-incr': 0.6, 'r-cheek-volume-incr': 0.6}, 'sarah': {'head-oval': 0.4}, 'billy': {'head-rectangular': 0.4}, 'grant': {'head-square': 0.3, 'l-cheek-volume-incr': 0.3, 'r-cheek-volume-incr': 0.3}, 'henry': {'head-round': 0.5, 'head-fat-incr': 0.3, 'l-cheek-volume-incr': 0.4, 'r-cheek-volume-incr': 0.4}, 'sam': {'head-oval': 0.3, 'chin-triangle': 0.3}}
for _k, _v in FACE_TARGETS.items(): CHARS[_k]['targets'] = _v

for _k in ('mason', 'james', 'grant', 'henry'): CHARS[_k]['drop'] = {'t-shirt': 0.045}
CHARS['cam']['hair'] = 'short03'
