#!/usr/bin/env python3
"""Build public/data/2000001.json from the Johto blueprint PNG.

tools/johto_blueprint.png is the GSC-style Johto map the user sent
(downsampled). Every non-black pixel becomes land, water, path, or forest.
Town pins match the labeled HGSS Town Map (New Bark SE, Route 32 U,
Goldenrod on the west bay, Cianwood in the sea).
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / 'tools/johto_blueprint.png'
OUT = ROOT / 'public/data/2000001.json'

M = 1.25  # metres per blueprint pixel
NB_PX, NB_PY = 357.0, 225.0  # New Bark on the blueprint

# Blueprint pixel (east, south) for each Johto area.
TOWN_PX = {
    2101: (357, 225, 38, 30, 'New Bark Town'),
    2102: (276, 223, 42, 32, 'Cherrygrove City'),
    2103: (216, 143, 48, 42, 'Violet City'),
    2104: (174, 263, 42, 34, 'Azalea Town'),
    2105: (150, 197, 56, 48, 'Goldenrod City'),
    2106: (166, 92, 50, 42, 'Ecruteak City'),
    2107: (102, 115, 48, 40, 'Olivine City'),
    2108: (66, 213, 40, 34, 'Cianwood City'),
    2109: (273, 100, 36, 30, 'Mahogany Town'),
    2110: (346, 101, 44, 36, 'Blackthorn City'),
    2111: (148, 125, 52, 40, 'National Park'),
    2112: (200, 155, 36, 28, 'Ruins of Alph'),
    2113: (280, 28, 44, 40, 'Lake of Rage'),
    2114: (455, 155, 32, 26, 'Mt. Silver'),
    2115: (14, 207, 48, 36, 'Johto Safari Zone'),
    2116: (85, 75, 40, 32, 'Battle Frontier'),
    2117: (155, 235, 40, 36, 'Ilex Forest'),
    2118: (190, 250, 28, 24, 'Union Cave'),
    2119: (250, 130, 28, 24, 'Dark Cave'),
    2120: (240, 90, 32, 28, 'Mt. Mortar'),
    2121: (310, 95, 28, 24, 'Ice Path'),
    2122: (80, 175, 36, 28, 'Whirl Islands'),
    2123: (448, 223, 28, 24, 'Tohjo Falls'),
    2124: (30, 200, 24, 20, 'Safari Zone Gate'),
    2125: (90, 80, 24, 20, 'Frontier Access'),
    2126: (145, 150, 28, 24, 'Pokéathlon Dome'),
    2127: (50, 210, 24, 20, 'Cliff Cave'),
    2128: (55, 208, 22, 18, 'Cliff Edge Gate'),
    2129: (160, 75, 22, 18, 'Bellchime Trail'),
    2130: (45, 230, 22, 18, 'Embedded Tower'),
}

LAYOUTS = {
    2101: {
        'blds': [
            ('sm_c_yjs_house', -12, -8),
            ('sm_t_001_house_01_red', 10, -4),
            ('sm_c_001_house_02_blue', 10, 10),
            ('sm_t_001_house_01', -10, 10),
        ],
        'extra': [
            ('sm_d_040_windmill_01_01_h', -18, -14),
            ('sm_d_040_windmill_01_01_h', 16, -14),
            ('sm_d_040_windmill_01_01_h', 16, 14),
            ('sm_d_040_windmill_01_01_h', -18, 14),
            ('sm_c_001_signboard_01', 2, 2),
        ],
    },
    2102: {
        'blds': [
            ('sm_c_001_pokecen_01', 8, -8),
            ('sm_c_001_shop_01', 18, -8),
            ('sm_c_001_house_02_blue', -12, -8),
            ('sm_t_007_house_01', -12, 8),
            ('sm_t_001_house_01', 6, 10),
        ],
        'extra': [
            ('sm_c_001_guide_03', 0, 2),
            ('sm_c_001_streetlight_01', -4, 0),
            ('sm_c_001_streetlight_01', 12, 0),
            ('sm_c_001_signboard_01', 2, 6),
        ],
    },
    2103: {
        'blds': [
            ('sm_r_209_losttower_01', 0, -16),
            ('sm_c_001_gym_01', -16, -4),
            ('sm_c_001_pokecen_01', 14, -6),
            ('sm_c_001_shop_01', 14, 6),
            ('sm_t_003_trainersschool_01', -8, 12),
            ('sm_t_007_house_01', 6, 14),
            ('sm_t_009_house_01', -16, 12),
        ],
        'extra': [
            ('sm_c_001_streetlight_01', -4, 0),
            ('sm_c_001_streetlight_01', 8, 0),
            ('sm_c_001_signboard_01', 0, 4),
        ],
    },
    2104: {
        'blds': [
            ('sm_t_011_house_02', -16, -10),
            ('sm_t_011_house_02_1', -8, -6),
            ('sm_c_001_pokecen_01', 4, -8),
            ('sm_c_001_shop_01', 16, -8),
            ('sm_c_001_gym_02', -10, 10),
            ('sm_t_011_house_02_2', 12, 10),
        ],
        'extra': [('sm_c_001_signboard_01', 2, 2), ('tree', -18, 0), ('tree', 18, 4)],
    },
    2105: {
        'blds': [
            ('sm_t_003_pokecompany_01_1', -18, -4),
            ('sm_c_001_gym_02', 0, -18),
            ('sm_t_006_bicycleshop_01', 14, -8),
            ('sm_c_001_shop_01', -10, 8),
            ('sm_c_001_pokecen_01', -6, 16),
            ('sm_t_007_house_01_1_yellow', 12, 6),
            ('sm_t_007_house_01_2_1yellow', 20, 6),
            ('sm_t_007_house_01_1_1yellow_w', 12, 16),
            ('sm_t_009_house_01_1_1yellow', 20, 16),
            ('sm_t_007_house_01_3', -18, 16),
        ],
        'extra': [
            ('sm_c_001_streetlight_01', -8, 0), ('sm_c_001_streetlight_01', 8, 0),
            ('sm_c_001_streetlight_01', -8, 12), ('sm_c_001_streetlight_01', 8, 12),
            ('sm_c_001_signboard_01', 4, 2),
        ],
        'plaza': 'floor_1',
    },
    2106: {
        'blds': [
            ('sm_d_011_batower_01_1', 8, -16),
            ('sm_r_209_losttower_01', -16, -16),
            ('sm_c_001_gym_01', -14, 0),
            ('sm_c_001_pokecen_01', 10, 0),
            ('sm_c_001_shop_01', 10, 10),
            ('sm_t_009_house_01', -12, 12),
            ('sm_t_009_house_01_1', 0, 12),
        ],
        'extra': [
            ('sm_c_001_streetlight_01', -4, 4), ('sm_c_001_streetlight_01', 6, 4),
            ('sm_c_001_signboard_01', 0, 4),
        ],
        'plaza': 'floor_1',
    },
    2107: {
        'blds': [
            ('sm_d_011_batower_01_1', -18, 8),
            ('sm_c_001_gym_02', 4, -12),
            ('sm_c_001_pokecen_01', 4, 0),
            ('sm_c_001_shop_01', 16, 0),
            ('sm_c_001_house_02_blue', 16, -12),
            ('sm_c_001_house_02_blue', 16, 12),
            ('sm_t_007_house_01', -4, 12),
        ],
        'extra': [
            ('sm_c_001_streetlight_01', -6, 2), ('sm_c_001_streetlight_01', 10, 2),
            ('sm_c_001_signboard_01', 0, 6),
        ],
        'plaza': 'floor_1', 'sand': True,
    },
    2108: {
        'blds': [
            ('sm_c_001_gym_01', 10, -8),
            ('sm_c_001_pokecen_01', -8, -8),
            ('sm_c_001_shop_01', -8, 8),
            ('sm_c_001_house_02_purple', 10, 8),
            ('sm_t_005_house_01_1', 0, 10),
        ],
        'extra': [
            ('floor_cliff_obj', -16, 0), ('floor_cliff_obj', 16, -12),
            ('sm_c_001_signboard_01', 2, 0),
        ],
    },
    2109: {
        'blds': [
            ('sm_c_001_gym_02', 10, -8),
            ('sm_c_001_pokecen_01', -10, -8),
            ('sm_c_001_shop_01', 0, 8),
            ('sm_t_005_house_01_1', -10, 8),
        ],
        'extra': [('sm_c_001_signboard_01', 2, 0), ('tree', -16, 0), ('tree', 16, 10)],
    },
    2110: {
        'blds': [
            ('sm_c_001_gym_01', 12, -8),
            ('sm_c_001_pokecen_01', -12, -8),
            ('sm_c_001_shop_01', 0, -8),
            ('sm_t_011_house_02_1', -12, 10),
            ('sm_t_011_house_02', 12, 10),
        ],
        'extra': [('floor_cliff_obj', 0, -16), ('sm_c_001_signboard_01', 4, 2)],
    },
    2114: {
        'blds': [
            ('sm_c_001_pokecen_01', -8, 0),
            ('sm_t_011_house_02', 8, 0),
        ],
        'extra': [('floor_cliff_obj', 0, -10)],
    },
}

GRASS = ['ground_plane005', 'ground_plane006', 'ground_plane007',
         'ground_plane008', 'ground_plane009', 'ground_plane010',
         'ground_plane011', 'ground_plane012']
PATH = ['floor_1', 'floor_y', 'ground_plane007']
SAND = ['sink_sand_1_sink_h_1', 'sink_sand_1_sink_h_2', 'sink_sand_1_sink_h_3']


def world(px, py):
    return (-(px - NB_PX) * M, (py - NB_PY) * M)


def classify(r, g, b):
    if r < 14 and g < 14 and b < 14:
        return 'empty'
    if b > 170 and b > g + 25 and b > r + 25:
        return 'water'
    if r > 210 and g > 190 and b > 190:
        return 'town'
    if r > 170 and g > 120 and b < 110 and r > b + 40:
        return 'path'
    if r > 140 and g > 90 and b < 80 and g < 160:
        return 'dirt'
    if g > 140 and r < 130 and b < 80:
        return 'grass'
    if g > r + 15 and g > b + 10 and g > 70:
        return 'forest' if g < 130 else 'grass'
    if r > 80 and g > 70 and b < 90:
        return 'dirt'
    return 'grass'


def main():
    doors = json.loads((ROOT / 'public/data/doors.json').read_text())
    scenes = json.loads((ROOT / 'public/data/scenes.json').read_text())
    johto = next(c for c in scenes['cenas'] if c['id'] == 2000001)
    nomes = {a['id']: a['nome'] for a in johto['areas']}
    areas = [a['id'] for a in johto['areas']]

    town_world = {}
    for tid, (px, py, sx, sz, name) in TOWN_PX.items():
        wx, wz = world(px, py)
        town_world[tid] = {'x': wx, 'z': wz, 'sx': sx, 'sz': sz, 'name': name}

    im = Image.open(BP).convert('RGB')
    arr = np.asarray(im)
    h, w = arr.shape[:2]

    objetos = []
    seen = set()

    def add(n, x, z, a=0, y=0):
        k = (n, round(x * 2), round(z * 2))
        if k in seen:
            return
        seen.add(k)
        o = {'n': n, 'x': round(float(x), 1), 'y': round(float(y), 2), 'z': round(float(z), 1)}
        if a:
            o['a'] = round(a, 3)
        objetos.append(o)

    def inside_town(x, z):
        for tid, t in town_world.items():
            if tid not in LAYOUTS:
                continue
            if abs(x - t['x']) <= t['sx'] / 2 and abs(z - t['z']) <= t['sz'] / 2:
                return tid
        return None

    agua = []
    grama = []
    land_cells = []

    for py in range(h):
        row = arr[py]
        for px in range(w):
            r, g, b = (int(v) for v in row[px])
            kind = classify(r, g, b)
            if kind == 'empty':
                continue
            wx, wz = world(px + 0.5, py + 0.5)
            land_cells.append((wx, wz, kind, px, py))
            tid = inside_town(wx, wz)
            if kind == 'water':
                if tid:
                    continue
                agua.append({'tipo': 33, 'x': round(wx, 1), 'y': 0, 'z': round(wz, 1), 'a': 2241})
                if (px + py) % 11 == 0:
                    add('sea_rock', wx, wz)
                continue
            if tid:
                L = LAYOUTS[tid]
                tile = L.get('plaza', 'ground_plane007')
                if L.get('sand') and wz > town_world[tid]['z'] + 4:
                    tile = SAND[(px + py) % len(SAND)]
                add(tile, wx, wz)
                continue
            if kind == 'path' or kind == 'town':
                add(PATH[(px + py) % len(PATH)], wx, wz)
            elif kind == 'dirt':
                add('ground_plane003', wx, wz)
            elif kind == 'forest':
                add('rock_grass_4x4', wx, wz)
                if (px + py) % 2 == 0:
                    add('tree', wx, wz)
            else:
                add(GRASS[(px + 3 * py) % len(GRASS)], wx, wz)
                if (px + py) % 7 == 0:
                    add('tree', wx, wz)

    for i, (wx, wz, kind, px, py) in enumerate(land_cells):
        if kind not in ('grass', 'forest') or inside_town(wx, wz) or i % 8:
            continue
        grama.append({
            'cfg': 2229 * 100 + (i % 97), 'tipo': 41,
            'x': round(wx, 1), 'y': 0, 'z': round(wz, 1), 'a': 2229,
        })

    for tid, L in LAYOUTS.items():
        t = town_world[tid]
        for n, dx, dz in L.get('blds', []):
            add(n, t['x'] + dx, t['z'] + dz)
        for n, dx, dz in L.get('extra', []):
            add(n, t['x'] + dx, t['z'] + dz)
        zf = t['z'] - t['sz'] / 2
        x = t['x'] - t['sx'] / 2
        while x <= t['x'] + t['sx'] / 2:
            add('sm_001_fence_02_z 1', x, zf)
            x += 2

    add('floor_cliff_obj', town_world[2118]['x'], town_world[2118]['z'])
    add('floor_cliff_obj', town_world[2119]['x'], town_world[2119]['z'])
    add('floor_cliff_obj', town_world[2120]['x'], town_world[2120]['z'])
    add('floor_cliff_obj', town_world[2121]['x'], town_world[2121]['z'])
    add('floor_cliff_obj', town_world[2123]['x'], town_world[2123]['z'])
    for i in range(20):
        add('tree', town_world[2117]['x'] + (i % 5 - 2) * 5,
            town_world[2117]['z'] + (i // 5 - 1.5) * 5)

    # Area boxes: town pads + route bbox from land nearest to a seed pair.
    seeds = [(tid, t['x'], t['z']) for tid, t in town_world.items()]
    pairs = [
        (2229, 2101, 2102), (2230, 2102, 2103), (2231, 2103, 2102),
        (2232, 2103, 2104), (2233, 2104, 2117), (2234, 2105, 2104),
        (2235, 2105, 2111), (2236, 2111, 2103), (2237, 2103, 2106),
        (2238, 2106, 2107), (2239, 2107, 2106), (2240, 2107, 2108),
        (2241, 2108, 2122), (2242, 2106, 2109), (2243, 2109, 2113),
        (2244, 2109, 2110), (2245, 2110, 2101), (2246, 2101, 2110),
        (2247, 2108, 2115), (2248, 2115, 2108), (2227, 2101, 2123),
        (2226, 2123, 2114), (2228, 2114, 2123),
    ]
    for rid, a, b in pairs:
        A, B = town_world[a], town_world[b]
        seeds.append((rid, (A['x'] + B['x']) / 2, (A['z'] + B['z']) / 2))

    bins = defaultdict(list)
    for wx, wz, kind, px, py in land_cells:
        best, bid = 1e18, 2101
        for sid, sx, sz in seeds:
            d = (wx - sx) ** 2 + (wz - sz) ** 2
            if d < best:
                best, bid = d, sid
        bins[bid].append((wx, wz))

    caixas = []
    for aid in areas:
        t = town_world.get(aid)
        pts = bins.get(aid, [])
        if t and aid < 2200:
            caixas.append({
                'a': aid, 'x': round(t['x'], 1), 'y': 0, 'z': round(t['z'], 1),
                'sx': float(t['sx']), 'sy': 8, 'sz': float(t['sz']),
            })
        elif pts:
            xs = [p[0] for p in pts]
            zs = [p[1] for p in pts]
            caixas.append({
                'a': aid, 'x': round((min(xs) + max(xs)) / 2, 1), 'y': 0,
                'z': round((min(zs) + max(zs)) / 2, 1),
                'sx': round(max(16, max(xs) - min(xs) + 8), 1), 'sy': 8,
                'sz': round(max(16, max(zs) - min(zs) + 8), 1),
            })
        elif t:
            caixas.append({
                'a': aid, 'x': round(t['x'], 1), 'y': 0, 'z': round(t['z'], 1),
                'sx': 28, 'sy': 8, 'sz': 24,
            })
        else:
            caixas.append({'a': aid, 'x': 0, 'y': 0, 'z': 0, 'sx': 24, 'sy': 8, 'sz': 24})

    by_area = defaultdict(list)
    for cid, p in doors.items():
        if p.get('c') != 2000001:
            continue
        by_area[p['a']].append({'cfg': int(cid), 't': p['t']})

    used = set()
    npcs = []

    def put(cfg, modelo, x, z, a):
        if not cfg or cfg in used:
            return
        used.add(cfg)
        npcs.append({
            'cfg': cfg, 'modelo': modelo, 'face': 0,
            'x': round(x, 2), 'y': 0, 'z': round(z, 2), 'a': a,
        })

    for tid, L in LAYOUTS.items():
        t = town_world[tid]
        doors_t = sorted((p for p in by_area[tid] if p['t'] == 6), key=lambda p: p['cfg'])
        arrs = sorted((p for p in by_area[tid] if p['t'] == 7), key=lambda p: p['cfg'])
        blds = L.get('blds', [])
        n = min(len(blds), len(doors_t), len(arrs))
        for i in range(n):
            _n, dx, dz = blds[i]
            put(doors_t[i]['cfg'], 162, t['x'] + dx, t['z'] + dz + 5.2, tid)
            put(arrs[i]['cfg'], 171, t['x'] + dx, t['z'] + dz + 6.5, tid)
        for p in arrs:
            if str(p['cfg']).endswith('99'):
                put(p['cfg'], 171, t['x'], t['z'] + t['sz'] / 2 - 4, tid)

    put(6222603, 162, town_world[2123]['x'], town_world[2123]['z'] - 6, 2226)
    put(7222699, 171, town_world[2123]['x'], town_world[2123]['z'] - 8, 2226)
    put(6222801, 162, town_world[2114]['x'] + 8, town_world[2114]['z'], 2228)
    put(7222801, 171, town_world[2114]['x'] + 10, town_world[2114]['z'], 2228)
    put(7210199, 171, town_world[2101]['x'], town_world[2101]['z'] + 8, 2101)

    for box in caixas:
        leftover = [p for p in by_area[box['a']] if p['cfg'] not in used]
        for i, pt in enumerate(leftover):
            ang = (i / max(1, len(leftover))) * math.tau
            put(pt['cfg'], 162 if pt['t'] == 6 else 171,
                box['x'] + math.cos(ang) * 6, box['z'] + math.sin(ang) * 6, box['a'])

    for tile in agua:
        best, bid = 1e18, 2241
        for box in caixas:
            d = (tile['x'] - box['x']) ** 2 + (tile['z'] - box['z']) ** 2
            if d < best:
                best, bid = d, box['a']
        tile['a'] = bid

    out = {
        'mapa': 2000001, 'nome': 'johto', 'areas': areas, 'nomes': nomes,
        'caixas': caixas, 'objetos': objetos, 'ambiente': [], 'areaEnv': [],
        'grama': grama, 'agua': agua, 'portas': [], 'treinadores': [],
        'historias': [], 'npcs': npcs, 'nav': [],
        'prefabs': sorted({o['n'] for o in objetos}),
        'bbox': {
            'x0': min(c['x'] - c['sx'] / 2 for c in caixas),
            'x1': max(c['x'] + c['sx'] / 2 for c in caixas),
            'z0': min(c['z'] - c['sz'] / 2 for c in caixas),
            'z1': max(c['z'] + c['sz'] / 2 for c in caixas),
        },
    }
    OUT.write_text(json.dumps(out, separators=(',', ':')))
    print('Johto', len(objetos), 'pieces', len(agua), 'water', 'from', BP.name, im.size)
    print('bbox', out['bbox'])
    for i in (2101, 2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109, 2110):
        t = town_world[i]
        print(i, t['name'], 'x', round(t['x']), 'z', round(t['z']))


if __name__ == '__main__':
    main()
