#!/usr/bin/env python3
"""Top-down preview of public/data/2000001.json next to the blueprint.

1 px = 1 m, east to the right (the scene mirrors x). Writes
/tmp/johto-ground-preview.png (or the path given as the first argument).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data/2000001.json'
BP = ROOT / 'tools/johto_blueprint.png'

COLORS = [
    ('floor_grass2', (110, 190, 60)), ('ground_plane', (95, 175, 55)),
    ('floor_1', (225, 240, 215)), ('floor_y', (210, 230, 200)), ('sink_sand', (235, 220, 150)),
    ('rock_grass_4x4', (170, 130, 70)), ('rock_ground_s', (160, 120, 65)),
]
PROPS = [
    ('tree', (30, 80, 20), 1), ('gimgrass', (60, 140, 30), 0), ('d_044_rock', (95, 70, 50), 0),
    ('sea_rock', (80, 70, 60), 0), ('comgrass', (140, 210, 80), 0), ('flower', (240, 120, 160), 0),
]


def main():
    out_path = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/johto-ground-preview.png')
    d = json.loads(DATA.read_text())
    b = d['bbox']
    # image x = -world x (east right); image y = world z (south down)
    ix0, ix1 = -b['x1'] - 4, -b['x0'] + 4
    iz0, iz1 = b['z0'] - 4, b['z1'] + 4
    W, H = int(ix1 - ix0) + 1, int(iz1 - iz0) + 1
    img = Image.new('RGB', (W, H), (0, 0, 0))
    px = img.load()

    def put(x, z, col, r=0):
        u, v = int(-x - ix0), int(z - iz0)
        for dv in range(-r, r + 1):
            for du in range(-r, r + 1):
                if 0 <= u + du < W and 0 <= v + dv < H:
                    px[u + du, v + dv] = col

    for t in d['agua']:
        put(t['x'] - 0.5, t['z'] - 0.5, (70, 90, 230))
    big = {'rock_grass_4x4': 2, 'rock_ground_s': 1}
    for o in d['objetos']:
        for key, col in COLORS:
            if o['n'].startswith(key):
                r = big.get(o['n'], 0)
                if r == 2:
                    for dz in range(-2, 2):
                        for dx in range(-2, 2):
                            put(o['x'] + dx + 0.5, o['z'] + dz + 0.5, col)
                elif r == 1:
                    for dz in (-1, 0):
                        for dx in (-1, 0):
                            put(o['x'] + dx + 0.5, o['z'] + dz + 0.5, col)
                else:
                    put(o['x'], o['z'], col)
                break
    for o in d['objetos']:
        n = o['n']
        for key, col, r in PROPS:
            if key in n or (key == 'tree' and 'tree_05' in n):
                put(o['x'], o['z'], col, r)
                break
        else:
            if n.startswith('sm_') and not any(k in n for k, _ in COLORS) and 'gimgrass' not in n:
                put(o['x'], o['z'], (230, 60, 60), 2)
    for n in d['npcs']:
        put(n['x'], n['z'], (255, 255, 0) if n['cfg'] != 7210199 else (255, 0, 255), 1)

    dr = ImageDraw.Draw(img)
    for c in d['caixas']:
        if c['a'] < 2200:
            u0, u1 = -c['x'] - c['sx'] / 2 - ix0, -c['x'] + c['sx'] / 2 - ix0
            v0, v1 = c['z'] - c['sz'] / 2 - iz0, c['z'] + c['sz'] / 2 - iz0
            dr.rectangle([u0, v0, u1, v1], outline=(255, 255, 255))
            dr.text((u0 + 2, v0 + 2), d['nomes'].get(str(c['a']), str(c['a']))[:14], fill=(255, 255, 255))

    bp = Image.open(BP).convert('RGB')
    bp = bp.resize((W, int(bp.height * W / bp.width)), Image.NEAREST)
    combo = Image.new('RGB', (W, H + bp.height + 6), (40, 40, 40))
    combo.paste(img, (0, 0))
    combo.paste(bp, (0, H + 6))
    combo.save(out_path)
    img.save(out_path.with_name(out_path.stem + '-only.png'))
    print('wrote', out_path, combo.size)


if __name__ == '__main__':
    main()
