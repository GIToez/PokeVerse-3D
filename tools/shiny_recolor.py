"""Shiny recolor: builds public/scenery/mon/shiny/<texture>_1.png for models that never got a shiny export.

Shinies are recolors, so each rule moves one hue band of the normal texture (read from inside the GLB) to the
shiny hue, keeping the shading: hue is offset, saturation and value are scaled. Pixels near the band edge blend
smoothly, and grays (low saturation: eyes, teeth, outlines) are untouched. A texture no rule changes is not
written: the game keeps the normal one for it.

    python tools/shiny_recolor.py pm0041_00 pm0043_00     # selected models
    python tools/shiny_recolor.py --all                   # every model in RULES
    python tools/shiny_recolor.py pm0041_00 --force       # overwrite an existing shiny
    python tools/shiny_recolor.py pm0041_00 --preview out.png   # normal|shiny side by side, nothing written

Rules (first matching rule wins on a pixel):
  H(lo, hi, to, s, v)  hue band lo..hi (degrees; lo > hi wraps through 0). The band's center lands on `to`, the
                       rest keeps its offset; saturation x s, value x v. A plain 5-tuple is the same as H.
  G(vlo, vhi, to, sat, v)  neutral pixels (gray/white/cream, saturation < smax) with value in vlo..vhi are tinted
                       to hue `to` with saturation `sat`; value x v. For shinies that recolor gray or white parts.
  Options on both: tex='regex' (only textures whose name matches), notex='regex', smin/smax (saturation
  window), vmin/vmax (value window).
"""
import argparse, io, json, re, struct, sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MON = ROOT / 'public' / 'scenery' / 'mon'
SHINY = MON / 'shiny'

FEATHER = 12.0      # degrees of soft edge outside each band
MIN_SAT = 0.12      # below this a pixel counts as gray and is left alone by H


def H(lo, hi, to, s=1.0, v=1.0, **o):
    return dict(kind='h', lo=lo, hi=hi, to=to, sm=s, vm=v, **o)


def G(vlo, vhi, to, sat, v=1.0, **o):
    return dict(kind='g', vlo=vlo, vhi=vhi, to=to, sat=sat, vm=v, **o)


ZUBAT = [H(180, 235, 92, 0.95, 0.92), H(280, 350, 22, 1.05, 0.98)]
RULES = {
    # --- first test batch (05/11) ---
    'pm0041_00': ZUBAT,                                                       # Zubat: blue -> green, wings -> salmon
    'pm0043_00': [H(65, 150, 68, 1.0, 1.12)],                                 # Oddish: leaves -> yellowish lime
    'pm0044_00': [H(350, 30, 32, 0.95, 1.08)],                                # Gloom: petals -> amber/gold
    # --- batch 2: well-known shinies ---
    'pm0011_00': [H(55, 110, 33, 1.15, 1.0)],                                 # Metapod: green -> orange-gold
    'pm0014_00': [H(30, 65, 80, 0.9, 0.95)],                                  # Kakuna: yellow -> green
    'pm0015_00': [H(35, 65, 82, 0.9, 0.95)],                                  # Beedrill: yellow -> green
    'pm0020_00': [H(15, 50, 14, 1.15, 0.95)],                                 # Raticate: tan -> red-brown
    'pm0023_00': [H(260, 350, 68, 1.4, 1.05)],                                # Ekans: purple -> yellow-green
    'pm0024_00': [H(215, 300, 52, 3.2, 1.02, smin=0.06)],                                 # Arbok: purple -> yellow
    'pm0027_00': [H(25, 65, 78, 0.85, 0.95)],                                 # Sandshrew: tan -> green
    'pm0028_00': [H(38, 65, 24, 1.1, 0.95), H(15, 38, 6, 1.0, 0.95)],         # Sandslash: yellow -> orange-red, spikes -> red-brown
    'pm0029_00': [H(190, 250, 290, 1.4, 1.0)],                                # Nidoran-F: lavender-blue -> pink-purple
    'pm0030_00': [H(165, 220, 335, 1.3, 1.0)],                                # Nidorina: light blue -> pink
    'pm0031_00': [H(180, 230, 150, 0.7, 0.95)],                               # Nidoqueen: blue -> gray-green
    'pm0032_00': [H(280, 330, 218, 1.2, 1.0)],                                # Nidoran-M: purple -> blue
    'pm0033_00': [H(280, 345, 218, 1.2, 1.0)],                                # Nidorino: purple -> blue
    'pm0034_00': [H(280, 345, 218, 1.2, 1.0)],                                # Nidoking: purple -> blue
    'pm0037_00': [H(0, 40, 44, 0.75, 1.1)],                                   # Vulpix: red-brown -> golden
    'pm0042_00': ZUBAT,                                                       # Golbat: as Zubat
    'pm0045_00': [H(330, 30, 28, 1.0, 1.05)],                                 # Vileplume: red flower -> orange
    'pm0048_00': [H(225, 270, 200, 1.0, 1.0)],                                # Venonat: purple -> blue
    'pm0049_00': [H(215, 280, 198, 1.4, 1.0)],                                # Venomoth: lavender -> light blue
    'pm0058_00': [H(5, 25, 42, 0.9, 1.08, smin=0.45)],                        # Growlithe: orange -> golden
    'pm0059_00': [H(5, 25, 42, 0.9, 1.08, smin=0.45)],                        # Arcanine: orange -> golden
    'pm0067_00': [H(205, 260, 125, 1.6, 1.0, smin=0.08)],                     # Machoke: gray-blue -> green
    'pm0068_00': [H(190, 235, 115, 1.4, 1.0, smin=0.08)],                     # Machamp: gray-blue -> green
    'pm0074_00': [G(0.2, 0.86, 40, 0.28, 1.05)],                 # Geodude: gray -> sandy yellow
    'pm0075_00': [G(0.2, 0.86, 38, 0.32, 1.0)],                  # Graveler: gray -> yellow-brown
    'pm0076_00': [G(0.2, 0.86, 15, 0.35, 0.95)],                 # Golem: gray shell -> red-brown
    'pm0077_00': [H(5, 45, 210, 1.0, 1.0, smin=0.55)],                        # Ponyta: flames -> blue
    'pm0088_00': [H(255, 315, 105, 1.2, 1.0, smin=0.06)],                     # Grimer: purple -> green
    'pm0089_00': [H(255, 315, 105, 1.4, 1.0, smin=0.05)],                     # Muk: purple -> green
    'pm0090_00': [H(225, 275, 25, 1.6, 1.25, vmin=0.5)],                                 # Shellder: purple shell -> orange
    'pm0091_00': [H(225, 275, 215, 1.4, 1.2)],                                # Cloyster: purple shell -> blue
    'pm0095_00': [G(0.15, 0.86, 68, 0.35, 1.0)],                 # Onix: gray -> yellow-green
    'pm0096_00': [H(25, 65, 345, 0.45, 1.05)],                                # Drowzee: yellow -> pink
    'pm0097_00': [H(25, 65, 345, 0.45, 1.05)],                                # Hypno: yellow -> pink
    'pm0098_00': [H(350, 30, 85, 0.8, 0.9, smin=0.4)],                        # Krabby: red-orange -> green
    'pm0099_00': [H(350, 30, 85, 0.8, 0.9, smin=0.4)],                        # Kingler: red-orange -> green
    'pm0100_00': [H(340, 20, 215, 1.0, 1.0)],                                 # Voltorb: red -> blue
    'pm0102_00': [H(320, 30, 50, 3.0, 1.0, smin=0.04)],    # Exeggcute: pink eggs -> yellow
    'pm0104_00': [H(15, 50, 62, 0.8, 1.0)],                                   # Cubone: brown -> olive green
    'pm0105_00': [H(15, 50, 62, 0.8, 1.0)],                                   # Marowak: brown -> olive green
    'pm0109_00': [H(225, 270, 205, 1.2, 1.0, smin=0.06)],                     # Koffing: purple -> blue
    'pm0110_00': [H(235, 300, 205, 1.2, 1.0, smin=0.06)],                     # Weezing: purple -> blue
    'pm0114_00': [H(180, 230, 120, 1.0, 0.95)],                               # Tangela: blue -> green
    'pm0116_00': [H(180, 230, 270, 1.0, 1.0)],                                # Horsea: blue -> purple
    'pm0117_00': [H(175, 230, 270, 1.0, 1.0)],                                # Seadra: blue -> purple
    'pm0118_00': [H(345, 35, 42, 1.0, 1.05)],                                 # Goldeen: orange -> gold
    'pm0119_00': [H(345, 35, 42, 1.0, 1.05)],                                 # Seaking: orange -> gold
    'pm0123_00': [H(70, 120, 68, 1.1, 1.05)],                                 # Scyther: green -> yellow-green
    'pm0126_00': [H(5, 28, 350, 0.9, 0.95, smin=0.6)],                        # Magmar: orange -> pink-red
    'pm0127_00': [G(0.15, 0.86, 255, 0.3, 1.0)],                  # Pinsir: brown-gray -> purple-blue
    'pm0129_00': [H(330, 40, 45, 0.95, 1.05, smin=0.3)],                   # Magikarp: red -> gold
    'pm0132_00': [H(255, 315, 205, 1.2, 1.0, smin=0.06)],                     # Ditto: purple -> blue
    'pm0133_00': [H(15, 50, 30, 0.15, 1.05)],                                 # Eevee: brown -> silver
    'pm0134_00': [H(165, 215, 280, 0.9, 1.0)],                                # Vaporeon: blue -> purple
    'pm0135_00': [H(35, 65, 75, 1.0, 1.0)],                                   # Jolteon: yellow -> lime
    'pm0140_00': [H(5, 45, 72, 0.8, 0.95)],                                   # Kabuto: brown -> olive green
    'pm0141_00': [H(5, 45, 72, 0.8, 0.95)],                                   # Kabutops: brown -> olive green
    'pm0144_00': [H(180, 215, 192, 0.5, 1.08)],                               # Articuno: blue -> pale blue
    'pm0145_00': [H(30, 65, 36, 1.1, 0.92)],                                  # Zapdos: yellow -> deeper gold
    'pm0146_00': [H(15, 55, 12, 0.85, 1.0)],                                  # Moltres: yellow-orange -> pink-orange
    'pm0147_00': [H(190, 235, 330, 1.2, 1.0, smin=0.06)],                     # Dratini: blue -> pink
    'pm0148_00': [H(190, 235, 330, 1.0, 1.0, smin=0.06)],                     # Dragonair: blue -> pink
    'pm0151_00': [H(300, 30, 195, 1.2, 1.0, smin=0.05)],                      # Mew: pink -> light blue
    'pm0249_00': [H(195, 245, 352, 1.0, 1.05)],                               # Lugia: blue underside -> red
    'pm0250_00': [H(340, 15, 42, 0.95, 1.0), H(15, 45, 52, 0.9, 1.05)],       # Ho-Oh: red/orange -> gold
    'pm0251_00': [H(55, 110, 330, 1.2, 1.0, smin=0.05)],                      # Celebi: green -> pink
    'pm0258_00': [H(180, 230, 268, 0.9, 1.0)],                                # Mudkip: blue -> lilac
    'pm0380_00': [H(325, 20, 45, 1.0, 1.05)],                                 # Latias: red -> gold
    'pm0381_00': [H(180, 230, 275, 1.0, 1.0)],                                # Latios: blue -> purple
    'pm0382_00': [H(195, 240, 300, 0.9, 1.0)],                                # Kyogre: blue -> magenta-purple
    'pm0383_00': [H(340, 25, 48, 0.4, 1.0)],                                  # Groudon: red -> yellow-gray
    'pm0384_00': [H(110, 175, 150, 0.1, 0.35)],                               # Rayquaza: green -> black
    'pm0483_00': [H(195, 240, 165, 1.0, 1.0)],                                # Dialga: blue -> teal-green
    'pm0484_00': [H(275, 330, 335, 1.0, 1.0, smin=0.06)],                     # Palkia: purple -> pink
    'pm0491_00': [H(340, 20, 205, 1.0, 1.0)],                                 # Darkrai: red collar -> blue
    'pm0495_00': [H(90, 135, 68, 1.0, 1.05)],                                 # Snivy: green -> yellow-green
}


def glb_images(path):
    b = path.read_bytes()
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bin0 = 20 + jl + 8
    seen = {}
    for im in j.get('images', []):
        name = im.get('name')
        if not name or name in seen:
            continue
        bv = j['bufferViews'][im['bufferView']]
        off = bin0 + bv.get('byteOffset', 0)
        seen[name] = Image.open(io.BytesIO(b[off:off + bv['byteLength']])).convert('RGBA')
    return seen


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r)
    gm = m & (mx == g) & ~rm
    bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h * 60.0, s, mx


def hsv_to_rgb(h, s, v):
    h = (h % 360) / 60.0
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[sel] = np.stack([a[sel], b[sel], c[sel]], -1)
    return out


def _ramp(x, lo, hi, soft):
    """1 inside lo..hi, fading to 0 over `soft` outside."""
    return np.clip(1 - np.maximum(lo - x, x - hi) / soft, 0, 1) if soft else ((x >= lo) & (x <= hi)).astype(float)


def recolor(img, rules, name=''):
    a = np.asarray(img).astype(np.float64) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    h, s, v = rgb_to_hsv(rgb)
    out = rgb.copy()
    # Pure red blocks in Eye/Mouth sheets are unused UV placeholders: never recolored.
    marker = (np.abs(rgb - [1.0, 0.0, 0.0]).max(-1) < 0.02).astype(np.float64)
    total = marker.copy()
    for r in rules:
        if not isinstance(r, dict):
            r = H(*r)
        if r.get('tex') and not re.search(r['tex'], name):
            continue
        if r.get('notex') and re.search(r['notex'], name):
            continue
        vwin = _ramp(v, r.get('vmin', 0.0), r.get('vmax', 1.0), 0.04)
        if r['kind'] == 'h':
            width = (r['hi'] - r['lo']) % 360
            center = (r['lo'] + width / 2) % 360
            off = (h - center + 180) % 360 - 180           # signed distance to the band center
            dist = np.abs(off) - width / 2                   # <= 0 inside the band
            smin = r.get('smin', MIN_SAT)
            w = np.clip(1 - np.maximum(dist, 0) / FEATHER, 0, 1) * np.clip((s - smin) / 0.06, 0, 1)
            w = w * _ramp(s, 0, r.get('smax', 1.0), 0.06) * vwin
            nh = r['to'] + off
            ns = np.clip(s * r['sm'], 0, 1)
        else:
            smax = r.get('smax', 0.18)
            w = np.clip((smax - s) / 0.06, 0, 1) * _ramp(v, r['vlo'], r['vhi'], 0.05) * vwin
            nh = np.full_like(h, float(r['to']))
            ns = np.clip(np.maximum(s, r['sat']), 0, 1)
        nv = np.clip(v * r['vm'], 0, 1)
        w = w * (1 - total)                                  # first rule wins on overlap
        # Blend in RGB: blending the hue itself would sweep through every color in between (a half-weight
        # purple -> yellow pixel came out green).
        out = out + (hsv_to_rgb(nh, ns, nv) - out) * w[..., None]
        total = total + w
    if (total - marker).max() < 1e-3:
        return None
    res = np.concatenate([out, alpha], -1)
    return Image.fromarray(np.clip(res * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('models', nargs='*')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--preview')
    args = ap.parse_args()
    models = list(RULES) if args.all else args.models
    if not models:
        ap.error('name models or pass --all')
    pairs = []
    for m in models:
        if m not in RULES:
            print(f'{m}: no rule in RULES, skipped', file=sys.stderr)
            continue
        for name, img in glb_images(MON / f'{m}.glb').items():
            if any(t in name.lower() for t in ('mask', 'msk', 'iris')):
                continue
            out = recolor(img, RULES[m], name)
            if out is None:
                print(f'{name}: no pixel in any band, kept normal')
                continue
            pairs.append((name, img, out))
            dest = SHINY / f'{name}_1.png'
            if args.preview:
                continue
            if dest.exists() and not args.force:
                print(f'{dest.name}: exists, skipped (--force to overwrite)')
                continue
            out.save(dest, optimize=True)
            print(f'wrote {dest.relative_to(ROOT)}')
    if args.preview and pairs:
        T = 384
        sheet = Image.new('RGB', (T * 2 + 8, len(pairs) * (T + 8)), (48, 48, 48))
        for i, (_, a, b) in enumerate(pairs):
            for j, im in enumerate((a, b)):
                bg = Image.new('RGBA', im.size, (48, 48, 48, 255))
                bg.alpha_composite(im)
                sheet.paste(bg.convert('RGB').resize((T, T)), (j * (T + 8), i * (T + 8)))
        sheet.save(args.preview)
        print('preview', args.preview)


if __name__ == '__main__':
    main()
