#!/usr/bin/env python3
"""Build public/data/2000001.json from the HGSS Town Map silhouette.

Land, water, forest and paths are sampled from the Johto half of the
official HGSS world map. Towns are stamped Kanto city clips so streets
are real layouts, not a 1 m grass carpet.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAP_CANDIDATES = [
    ROOT / 'tools/hgss_world.png',
    Path('/tmp/hgss-map.png'),
]
OUT = ROOT / 'public/data/2000001.json'
MAP_URL = (
    'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/'
    '8d40d391-a693-4951-9c5e-98fdc7d2600a/'
    'da0qes8-4bcc33d6-5199-4309-a1fe-b3ea1b556cde.png'
    '?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi84ZDQwZDM5MS1hNjkzLTQ5NTEtOWM1ZS05OGZkYzdkMjYwMGEvZGEwcWVzOC00YmNjMzNkNi01MTk5LTQzMDktYTFmZS1iM2VhMWI1NTZjZGUucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.oVrr4QWyvfS-JWt5UD85gE-pqXntqflO_Apy7k-ZS8E'
)

# Johto is the left landmass. x>=CUT is Kanto (Pallet / Route 23).
CUT_X = 6400
PPM = 8.0          # map pixels per world metre
STEP = 24          # sample every 24 px → 3 m tiles
NB_PX, NB_PY = 5550.0, 5720.0  # New Bark on the map

# HGSS town / landmark pixel centers (image x east, y south).
TOWNS_PX = {
    2101: (5550, 5720, 'New Bark Town'),
    2102: (4976, 5248, 'Cherrygrove City'),
    2103: (5292, 2724, 'Violet City'),
    2104: (4648, 4532, 'Azalea Town'),
    2105: (4852, 3652, 'Goldenrod City'),
    2106: (4328, 2168, 'Ecruteak City'),
    2107: (3372, 2124, 'Olivine City'),
    2108: (400, 4300, 'Cianwood City'),
    2109: (5524, 1512, 'Mahogany Town'),
    2110: (6000, 2400, 'Blackthorn City'),
    2111: (3868, 2052, 'National Park'),
    2112: (5100, 3200, 'Ruins of Alph'),
    2113: (5600, 700, 'Lake of Rage'),
    2114: (6280, 3600, 'Mt. Silver'),
    2115: (280, 3716, 'Johto Safari Zone'),
    2116: (900, 2600, 'Battle Frontier'),
    2117: (4500, 4300, 'Ilex Forest'),
    2118: (4800, 4800, 'Union Cave'),
    2119: (5600, 2600, 'Dark Cave'),
    2120: (5000, 1800, 'Mt. Mortar'),
    2121: (5800, 2000, 'Ice Path'),
    2122: (1800, 4000, 'Whirl Islands'),
    2123: (6200, 5200, 'Tohjo Falls'),
    2124: (700, 4000, 'Safari Zone Gate'),
    2125: (2200, 1800, 'Frontier Access'),
    2126: (4000, 2800, 'Pokéathlon Dome'),
    2127: (600, 4100, 'Cliff Cave'),
    2128: (550, 4050, 'Cliff Edge Gate'),
    2129: (4200, 1900, 'Bellchime Trail'),
    2130: (350, 4500, 'Embedded Tower'),
}

CLIP_OF = {
    2101: (1101, None),
    2102: (1102, None),
    2103: (1103, None),
    2104: (1106, None),
    2105: (1107, None),
    2106: (1103, None),
    2107: (1105, None),
    2108: (1110, None),
    2109: (1101, None),
    2110: (1103, None),
    2111: (1191, (52, 44)),
    2112: (1106, None),
    2113: (1110, (40, 36)),
    2114: (1110, (40, 36)),
    2115: (1192, (56, 44)),
}

GRASS = ['ground_plane005', 'ground_plane006', 'ground_plane007',
         'ground_plane008', 'ground_plane009', 'ground_plane010',
         'ground_plane011', 'ground_plane012', 'floor_grass2']
PATH = ['floor_1', 'ground_plane007', 'ground_plane008', 'floor_y']
SAND = ['sink_sand_1_sink_h_1', 'sink_sand_1_sink_h_2', 'sink_sand_1_sink_h_3']
DIRT = ['ground_plane003', 'ground_plane004', 'ground_plane014']


def world(px: float, py: float) -> tuple[float, float]:
    return (-(px - NB_PX) / PPM, (py - NB_PY) / PPM)


def clip_area(kanto, area_id, crop=None):
    box = next(c for c in kanto['caixas'] if c['a'] == area_id)
    hw = (crop[0] if crop else box['sx']) / 2
    hh = (crop[1] if crop else box['sz']) / 2
    objs = []
    for o in kanto['objetos']:
        if abs(o['x'] - box['x']) <= hw and abs(o['z'] - box['z']) <= hh:
            objs.append({
                'n': o['n'],
                'dx': o['x'] - box['x'],
                'dz': o['z'] - box['z'],
                'y': o.get('y') or 0,
                'a': o.get('a') or 0,
            })
    return {
        'sx': crop[0] if crop else box['sx'],
        'sz': crop[1] if crop else box['sz'],
        'objs': objs,
    }


def classify(r, g, b, a) -> str:
    if a < 80 or (r > 245 and g > 245 and b > 245):
        return 'empty'
    if b > g + 18 and b > r + 18 and b > 90:
        return 'water'
    if r > 180 and g > 200 and b > 200:
        return 'ice'
    if r > 170 and g < 120 and b < 80 and r > g + 40:
        return 'burn'
    if r > 185 and g > 165 and b < 145 and r - b > 40:
        return 'sand'
    if g > r + 12 and g > b + 12 and g < 90:
        return 'forest'
    if g > r + 8 and g > b + 8:
        return 'grass'
    if abs(int(r) - int(g)) < 22 and abs(int(g) - int(b)) < 22 and 90 < r < 200:
        return 'path'
    if r > g > b and r < 190:
        return 'dirt'
    return 'grass'


def main():
    doors = json.loads((ROOT / 'public/data/doors.json').read_text())
    scenes = json.loads((ROOT / 'public/data/scenes.json').read_text())
    kanto = json.loads((ROOT / 'public/data/kanto.json').read_text())
    johto = next(c for c in scenes['cenas'] if c['id'] == 2000001)
    nomes = {a['id']: a['nome'] for a in johto['areas']}
    areas = [a['id'] for a in johto['areas']]

    map_png = next((p for p in MAP_CANDIDATES if p.exists()), None)
    if map_png is None:
        import urllib.request
        dest = Path('/tmp/hgss-map.png')
        print('downloading HGSS Town Map…')
        urllib.request.urlretrieve(MAP_URL, dest)
        map_png = dest
    im = Image.open(map_png).convert('RGBA')
    arr = np.asarray(im)
    h, w = arr.shape[:2]
    x1 = min(CUT_X, w)

    clips = {}
    town_world = {}
    for jid, spec in CLIP_OF.items():
        kid, crop = spec
        clips[jid] = clip_area(kanto, kid, crop)
        px, py, _ = TOWNS_PX[jid]
        wx, wz = world(px, py)
        town_world[jid] = {
            'x': wx, 'z': wz,
            'sx': clips[jid]['sx'], 'sz': clips[jid]['sz'],
            'name': TOWNS_PX[jid][2],
        }
    for jid, (px, py, name) in TOWNS_PX.items():
        if jid not in town_world:
            wx, wz = world(px, py)
            town_world[jid] = {'x': wx, 'z': wz, 'sx': 36, 'sz': 28, 'name': name}

    town_block = []
    for jid, T in town_world.items():
        if jid in CLIP_OF:
            town_block.append((T['x'], T['z'], T['sx'] / 2 - 2, T['sz'] / 2 - 2))

    def inside_town(x, z):
        for cx, cz, hx, hz in town_block:
            if abs(x - cx) <= hx and abs(z - cz) <= hz:
                return True
        return False

    objetos = []
    seen = set()

    def add(n, x, z, a=0, y=0):
        k = (n, round(x * 2), round(z * 2))
        if k in seen:
            return
        seen.add(k)
        o = {'n': n, 'x': round(x, 1), 'y': round(y, 2), 'z': round(z, 1)}
        if a:
            o['a'] = round(a, 3)
        objetos.append(o)

    for jid, clip in clips.items():
        T = town_world[jid]
        for o in clip['objs']:
            add(o['n'], T['x'] + o['dx'], T['z'] + o['dz'], o['a'], o['y'])

    agua = []
    grama = []
    land_cells = []  # (wx, wz, kind)

    # 4 m Kanto grass tiles cover the continent without 1 m holes.
    STEP4 = 32  # 4 m at 8 px/m
    STEP1 = 8   # 1 m paths
    STEP2 = 16  # 2 m water

    for py in range(0, h, STEP4):
        row = arr[py, :x1]
        for px in range(0, x1, STEP4):
            r, g, b, a = (int(v) for v in row[px])
            kind = classify(r, g, b, a)
            if kind in ('empty', 'water', 'path'):
                continue
            wx, wz = world(px + STEP4 / 2, py + STEP4 / 2)
            land_cells.append((wx, wz, kind))
            if inside_town(wx, wz):
                continue
            key = (px + py) * 13
            if kind == 'sand':
                add(SAND[key % len(SAND)], wx, wz)
            elif kind == 'ice':
                add('ground_plane011', wx, wz)
            elif kind == 'burn':
                add('ground_plane003', wx, wz)
            else:
                add('rock_grass_4x4', wx, wz)
            if kind == 'forest' and key % 3 == 0:
                add('tree', wx, wz)

    for py in range(0, h, STEP1):
        row = arr[py, :x1]
        for px in range(0, x1, STEP1):
            r, g, b, a = (int(v) for v in row[px])
            if classify(r, g, b, a) != 'path':
                continue
            wx, wz = world(px + STEP1 / 2, py + STEP1 / 2)
            land_cells.append((wx, wz, 'path'))
            if inside_town(wx, wz):
                continue
            add(PATH[(px + py) % len(PATH)], wx, wz)

    for py in range(0, h, STEP2):
        row = arr[py, :x1]
        for px in range(0, x1, STEP2):
            r, g, b, a = (int(v) for v in row[px])
            if classify(r, g, b, a) != 'water':
                continue
            wx, wz = world(px + STEP2 / 2, py + STEP2 / 2)
            land_cells.append((wx, wz, 'water'))
            agua.append({'tipo': 33, 'x': round(wx, 1), 'y': 0, 'z': round(wz, 1), 'a': 2241})
            if (px + py) % 80 == 0:
                add('sea_rock', wx, wz)

    for i, (wx, wz, kind) in enumerate(land_cells):
        if kind not in ('grass', 'forest'):
            continue
        if inside_town(wx, wz) or i % 5 != 0:
            continue
        grama.append({
            'cfg': 2229 * 100 + (i % 97), 'tipo': 41,
            'x': round(wx, 1), 'y': 0, 'z': round(wz, 1), 'a': 2229,
        })

    # Assign each land cell to nearest town/route seed for caixas.
    seeds = []
    for jid, T in town_world.items():
        seeds.append((jid, T['x'], T['z']))
    # route midpoints between neighbours (HGSS)
    pairs = [
        (2229, 2101, 2102), (2230, 2102, 2103), (2231, 2102, 2103),
        (2232, 2103, 2104), (2233, 2104, 2105), (2234, 2104, 2105),
        (2235, 2105, 2111), (2236, 2111, 2103), (2237, 2103, 2106),
        (2238, 2106, 2107), (2239, 2106, 2107), (2240, 2107, 2108),
        (2241, 2107, 2108), (2242, 2106, 2109), (2243, 2109, 2113),
        (2244, 2109, 2110), (2245, 2110, 2101), (2246, 2101, 2110),
        (2247, 2108, 2115), (2227, 2101, 2123), (2226, 2123, 2114),
        (2228, 2123, 2114),
    ]
    for rid, a, b in pairs:
        A, B = town_world[a], town_world[b]
        seeds.append((rid, (A['x'] + B['x']) / 2, (A['z'] + B['z']) / 2))

    bins = defaultdict(list)
    for wx, wz, kind in land_cells:
        if kind == 'empty':
            continue
        best, bid = 1e18, 2101
        for sid, sx, sz in seeds:
            d = (wx - sx) ** 2 + (wz - sz) ** 2
            if d < best:
                best, bid = d, sid
        bins[bid].append((wx, wz))

    caixas = []
    for aid in areas:
        T = town_world.get(aid)
        pts = bins.get(aid, [])
        if T and aid < 2200:
            caixas.append({
                'a': aid, 'x': round(T['x'], 1), 'y': 0, 'z': round(T['z'], 1),
                'sx': round(max(T['sx'], 24), 1), 'sy': 8,
                'sz': round(max(T['sz'], 20), 1),
            })
        elif pts:
            xs = [p[0] for p in pts]
            zs = [p[1] for p in pts]
            x0, x1 = min(xs), max(xs)
            z0, z1 = min(zs), max(zs)
            caixas.append({
                'a': aid, 'x': round((x0 + x1) / 2, 1), 'y': 0,
                'z': round((z0 + z1) / 2, 1),
                'sx': round(max(16, x1 - x0 + 8), 1), 'sy': 8,
                'sz': round(max(16, z1 - z0 + 8), 1),
            })
        elif T:
            caixas.append({
                'a': aid, 'x': round(T['x'], 1), 'y': 0, 'z': round(T['z'], 1),
                'sx': 32, 'sy': 8, 'sz': 28,
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

    BUILDING = ('house', 'pokecen', 'shop', 'gym', 'lab', 'school',
                'bicycl', 'pokecompany', 'guide_03', 'sm_c_yjs')

    for jid, clip in clips.items():
        T = town_world[jid]
        doors_t = sorted((p for p in by_area[jid] if p['t'] == 6), key=lambda p: p['cfg'])
        arrs = sorted((p for p in by_area[jid] if p['t'] == 7), key=lambda p: p['cfg'])
        blds = [o for o in clip['objs']
                if any(k in o['n'].lower() for k in BUILDING)
                and not any(k in o['n'].lower() for k in ('fence', 'grass', 'flower', 'tree', 'lamp', 'sign'))]
        blds.sort(key=lambda o: (o['dx'], o['dz']))
        n = min(len(blds), len(doors_t), len(arrs))
        for i in range(n):
            x = T['x'] + blds[i]['dx']
            z = T['z'] + blds[i]['dz']
            put(doors_t[i]['cfg'], 162, x, z + 5.2, jid)
            put(arrs[i]['cfg'], 171, x, z + 6.5, jid)
        for p in arrs:
            if str(p['cfg']).endswith('99'):
                put(p['cfg'], 171, T['x'], T['z'] + T['sz'] / 2 - 4, jid)

    # Connection Center: east stub toward Kanto (Route 26 / 28).
    r26 = town_world[2123]
    r28 = town_world[2114]
    put(6222603, 162, r26['x'], r26['z'] - 6, 2226)
    put(7222699, 171, r26['x'], r26['z'] - 8, 2226)
    put(6222801, 162, r28['x'] + 8, r28['z'], 2228)
    put(7222801, 171, r28['x'] + 10, r28['z'], 2228)
    put(7210199, 171, town_world[2101]['x'], town_world[2101]['z'] + 8, 2101)

    for box in caixas:
        leftover = [p for p in by_area[box['a']] if p['cfg'] not in used]
        for i, pt in enumerate(leftover):
            ang = (i / max(1, len(leftover))) * math.tau
            put(pt['cfg'], 162 if pt['t'] == 6 else 171,
                box['x'] + math.cos(ang) * 6, box['z'] + math.sin(ang) * 6, box['a'])

    # Fix agua area ids by nearest caixa
    for tile in agua:
        best, bid = 1e18, 2241
        for box in caixas:
            d = (tile['x'] - box['x']) ** 2 + (tile['z'] - box['z']) ** 2
            if d < best:
                best, bid = d, box['a']
        tile['a'] = bid

    out = {
        'mapa': 2000001,
        'nome': 'johto',
        'areas': areas,
        'nomes': nomes,
        'caixas': caixas,
        'objetos': objetos,
        'ambiente': [],
        'areaEnv': [],
        'grama': grama,
        'agua': agua,
        'portas': [],
        'treinadores': [],
        'historias': [],
        'npcs': npcs,
        'nav': [],
        'prefabs': sorted({o['n'] for o in objetos}),
        'bbox': {
            'x0': min(c['x'] - c['sx'] / 2 for c in caixas),
            'x1': max(c['x'] + c['sx'] / 2 for c in caixas),
            'z0': min(c['z'] - c['sz'] / 2 for c in caixas),
            'z1': max(c['z'] + c['sz'] / 2 for c in caixas),
        },
    }
    OUT.write_text(json.dumps(out, separators=(',', ':')))
    print('Johto', len(objetos), 'pieces', len(npcs), 'npcs',
          len(agua), 'water', len(grama), 'grass')
    print('bbox', out['bbox'])
    for jid in (2101, 2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109, 2110):
        T = town_world[jid]
        print(jid, T['name'], 'x', round(T['x']), 'z', round(T['z']),
              'clip', len(clips.get(jid, {}).get('objs', [])))


if __name__ == '__main__':
    main()
