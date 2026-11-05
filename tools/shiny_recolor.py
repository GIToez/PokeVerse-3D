"""Shiny recolor: builds public/scenery/mon/shiny/<texture>_1.png for models that never got a shiny export.

Shinies are recolors, so each rule moves one hue band of the normal texture (read from inside the GLB) to the
shiny hue, keeping the shading: hue is offset, saturation and value are scaled. Pixels near the band edge blend
smoothly, and grays (low saturation: eyes, teeth, outlines) are untouched. A texture no rule changes is not
written: the game keeps the normal one for it.

    python tools/shiny_recolor.py pm0041_00 pm0043_00     # selected models
    python tools/shiny_recolor.py --all                   # every model in RULES
    python tools/shiny_recolor.py pm0041_00 --force       # overwrite an existing shiny
    python tools/shiny_recolor.py pm0041_00 --preview out.png   # normal|shiny side by side, nothing written

Rule: (hue_from, hue_to, hue_target, sat_mul, val_mul). Hues in degrees; hue_from > hue_to wraps through 0.
The band's center lands on hue_target; the rest keeps its offset from the center.
"""
import argparse, io, json, struct, sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MON = ROOT / 'public' / 'scenery' / 'mon'
SHINY = MON / 'shiny'

RULES = {
    # Zubat: blue body -> green; purple wing membrane -> salmon tan.
    'pm0041_00': [(180, 235, 92, 0.95, 0.92), (280, 350, 22, 1.05, 0.98)],
    # Oddish: green leaves -> yellowish lime; blue body stays.
    'pm0043_00': [(65, 150, 68, 1.0, 1.12)],
    # Gloom: red-brown petals -> amber, orange -> gold; blue body stays.
    'pm0044_00': [(350, 30, 32, 0.95, 1.08)],
}
FEATHER = 12.0      # degrees of soft edge outside each band
MIN_SAT = 0.12      # below this a pixel counts as gray and is left alone


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


def recolor(img, rules):
    a = np.asarray(img).astype(np.float64) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    h, s, v = rgb_to_hsv(rgb)
    out_h, out_s, out_v = h.copy(), s.copy(), v.copy()
    # Pure red blocks in Eye/Mouth sheets are unused UV placeholders: never recolored.
    total = (np.abs(rgb - [1.0, 0.0, 0.0]).max(-1) < 0.02).astype(np.float64)
    for lo, hi, target, sm, vm in rules:
        width = (hi - lo) % 360
        center = (lo + width / 2) % 360
        off = (h - center + 180) % 360 - 180           # signed distance to the band center
        dist = np.abs(off) - width / 2                   # <= 0 inside the band
        w = np.clip(1 - dist / FEATHER, 0, 1) * np.clip((s - MIN_SAT) / 0.08, 0, 1)
        w = np.where(dist <= 0, np.clip((s - MIN_SAT) / 0.08, 0, 1), w)
        w = w * (1 - total)                              # first rule wins on overlap
        nh = target + off
        ns = np.clip(s * sm, 0, 1)
        nv = np.clip(v * vm, 0, 1)
        dh = (nh - out_h + 180) % 360 - 180
        out_h = out_h + dh * w
        out_s = out_s + (ns - out_s) * w
        out_v = out_v + (nv - out_v) * w
        total = total + w
    if (total * (1 - (np.abs(rgb - [1.0, 0.0, 0.0]).max(-1) < 0.02))).max() < 1e-3:
        return None
    res = hsv_to_rgb(out_h, out_s, out_v)
    res = np.concatenate([res, alpha], -1)
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
            out = recolor(img, RULES[m])
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
