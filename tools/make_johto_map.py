#!/usr/bin/env python3
"""Build public/data/2000001.json from the Johto blueprint PNG.

tools/johto_blueprint.png is the GSC Johto overworld the user sent, sampled
to 470x270: one pixel is one GSC walking step and the art comes in aligned
2x2 metatiles. At M = 2 m per pixel trees sit on Kanto's 2 m grid and
every land pixel is covered by four 1 m floor tiles or one 2 m rock tile
(no holes).

Layers, from the blueprint palette:
  pale mint path / pink road  -> floor_1 / floor_y (sand next to water)
  bright green grass          -> mixed ground_plane / floor_grass2 tiles
  light lime tall grass       -> grass tiles + gimgrass + encounter tiles
  dark green trees            -> grass tiles + one tree per pixel
  tan mountain                -> rock_ground_s (2 m) + boulders
  purple water                -> agua cells (sea plane in `ambiente`)
  black                       -> void
"""
from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / 'tools/johto_blueprint.png'
OUT = ROOT / 'public/data/2000001.json'

M = 2.0                 # metres per blueprint pixel (one GSC step)
NB_PX, NB_PY = 356, 222  # pixel edge that becomes world (0, 0), at New Bark

# Blueprint pixel centre (east, south) and pad size in metres for each area.
TOWN_PX = {
    2101: (355, 222, 38, 30, 'New Bark Town'),
    2102: (268, 224, 42, 32, 'Cherrygrove City'),
    2103: (203, 145, 48, 42, 'Violet City'),
    2104: (172, 259, 42, 34, 'Azalea Town'),
    2105: (145, 196, 56, 48, 'Goldenrod City'),
    2106: (165, 88, 50, 42, 'Ecruteak City'),
    2107: (92, 136, 48, 40, 'Olivine City'),
    2108: (14, 205, 40, 34, 'Cianwood City'),
    2109: (262, 98, 36, 30, 'Mahogany Town'),
    2110: (350, 92, 44, 36, 'Blackthorn City'),
    2111: (149, 132, 30, 24, 'National Park'),
    2112: (176, 152, 20, 16, 'Ruins of Alph'),
    2113: (260, 15, 88, 60, 'Lake of Rage'),
    2114: (455, 134, 32, 26, 'Mt. Silver'),
    2115: (7, 176, 14, 14, 'Johto Safari Zone'),
    2116: (66, 130, 20, 14, 'Battle Frontier'),
    2117: (148, 262, 22, 18, 'Ilex Forest'),
    2118: (196, 252, 16, 14, 'Union Cave'),
    2119: (318, 188, 16, 14, 'Dark Cave'),
    2120: (228, 96, 18, 16, 'Mt. Mortar'),
    2121: (322, 94, 16, 14, 'Ice Path'),
    2122: (52, 198, 60, 44, 'Whirl Islands'),
    2123: (395, 217, 22, 14, 'Tohjo Falls'),
    2124: (7, 184, 12, 8, 'Safari Zone Gate'),
    2125: (74, 140, 12, 8, 'Frontier Access'),
    2126: (150, 178, 16, 10, 'Pokéathlon Dome'),
    2127: (5, 192, 10, 8, 'Cliff Cave'),
    2128: (12, 190, 8, 8, 'Cliff Edge Gate'),
    2129: (182, 84, 14, 10, 'Bellchime Trail'),
    2130: (4, 170, 8, 8, 'Embedded Tower'),
}

# Route boxes on the blueprint: (x0, y0, x1, y1) in pixels.
ROUTE_PX = {
    2226: (438, 136, 470, 212),
    2227: (366, 210, 470, 236),
    2228: (438, 118, 470, 136),
    2229: (279, 210, 366, 236),
    2230: (256, 140, 286, 210),
    2231: (215, 136, 256, 170),
    2232: (182, 156, 210, 248),
    2233: (182, 248, 214, 270),
    2234: (134, 208, 164, 270),
    2235: (134, 138, 164, 184),
    2236: (162, 120, 192, 152),
    2237: (150, 98, 184, 122),
    2238: (118, 72, 152, 106),
    2239: (84, 72, 120, 126),
    2240: (50, 144, 120, 172),
    2241: (14, 170, 80, 230),
    2242: (182, 80, 252, 110),
    2243: (244, 28, 276, 90),
    2244: (272, 82, 332, 110),
    2245: (326, 100, 358, 182),
    2246: (300, 176, 338, 212),
    2247: (0, 160, 16, 196),
    2248: (0, 196, 6, 230),
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
        'plaza': True,
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
        'plaza': True,
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
        'plaza': True,
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

# Same tile family Kanto paints its grass with (weights ~ Kanto's own mix).
GRASS_MIX = (['floor_grass2'] * 4
             + ['ground_plane005', 'ground_plane006', 'ground_plane007', 'ground_plane008',
                'ground_plane009', 'ground_plane010', 'ground_plane011', 'ground_plane012'] * 2
             + ['ground_plane001', 'ground_plane002', 'ground_plane003', 'ground_plane004'])
PATH_MIX = ['floor_1', 'floor_1', 'floor_y']
SAND = 'sink_sand_ground_001'
TREES = ['tree', 'tree', 'tree', 'sm_c_001_tree_05_reordered', 'sm_c_001_tree_05_reordered']
GRASS_DECO = ['sm_c_001_comgrass_01_1', 'sm_c_001_comgrass_01_2', 'sm_c_001_flower_04']

# GSC links these through indoor gates that the overworld doesn't have, so the
# tree wall would seal Goldenrod's column: open a 4 m path (pixel rects x0, y0, x1, y1).
CARVE = [
    (162, 134, 168, 136),   # Route 35 -> National Park gate -> Route 36/37
    (152, 252, 156, 264),   # Route 34 -> Ilex Forest ...
    (152, 262, 160, 264),   # ... -> Azalea Town
    # Route 27 is Surf-only in GSC; a sandbar keeps Route 26 (Kanto link) walkable from New Bark.
    (366, 226, 460, 228),
]

VOID, WATER, ROCK, PATH, TALL, GRASS, FOREST, MOUNT, OTHER = range(9)
CLASS_NAMES = ['void', 'water', 'searock', 'path', 'tall', 'grass', 'forest', 'mount', 'other']

# Half-size (metres) that covers every town building prefab (largest is 9.2 x 8.5 m).
BLD_HALF = 5.0


def world(px, py):
    """Continuous blueprint pixel coords -> world (x, z); +x is WEST."""
    return (-(px - NB_PX) * M, (py - NB_PY) * M)


def to_px(x, z):
    return (NB_PX - x / M, NB_PY + z / M)


def classify_image(arr):
    r, g, b = (arr[..., i].astype(int) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    cls = np.full(r.shape, OTHER, np.int8)
    cls[(g > 80) & (g < 125) & (r < 75) & (b < 50) & (g > r + 25)] = FOREST
    cls[(r > 150) & (g > 120) & (g < 175) & (b < 110) & (r > b + 70)] = MOUNT
    cls[(r > 130) & (r < 160) & (g > 100) & (g < 125) & (b < 60)] = MOUNT
    cls[(g > 150) & (r < 140) & (b < 80)] = GRASS
    cls[(g > 200) & (r > 130) & (b < 140) & (g > r + 40)] = TALL
    cls[(r > 185) & (g > 215) & (b > 185) & (np.abs(r - b) < 25)] = PATH
    cls[(r > 230) & (g > 200) & (b > 200)] = PATH
    cls[(r > 225) & (g > 220) & (b > 170) & (b < 200)] = PATH
    cls[(b > 70) & (b > r + 20) & (b > g + 25)] = WATER
    cls[mx < 24] = VOID
    return cls


def resolve_other(arr, cls):
    """Ledges, trunks, roofs, signs: give each to the layer around it."""
    h, w = cls.shape
    out = cls.copy()
    r, g = arr[..., 0].astype(int), arr[..., 1].astype(int)
    for y, x in zip(*np.nonzero(cls == OTHER)):
        win = cls[max(0, y - 2):y + 3, max(0, x - 2):x + 3]
        cnt = Counter(int(v) for v in win.ravel() if v not in (OTHER, VOID))
        if cnt[WATER] >= 10:
            out[y, x] = ROCK
            continue
        dark = r[y, x] < 90 and g[y, x] < 75
        if dark and cnt:
            land = {k: v for k, v in cnt.items() if k != WATER}
            out[y, x] = max(land, key=land.get) if land else ROCK
        else:
            out[y, x] = PATH       # roofs, gates, signs: walkable clearing
    return out


def hsh(i, j, salt=0):
    v = (i * 73856093) ^ (j * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) & 0x7fffffff


def main():
    doors = json.loads((ROOT / 'public/data/doors.json').read_text())
    scenes = json.loads((ROOT / 'public/data/scenes.json').read_text())
    johto = next(c for c in scenes['cenas'] if c['id'] == 2000001)
    nomes = {a['id']: a['nome'] for a in johto['areas']}
    areas = [a['id'] for a in johto['areas']]

    im = Image.open(BP).convert('RGB')
    arr = np.asarray(im)
    h, w = arr.shape[:2]
    cls = resolve_other(arr, classify_image(arr))
    for x0, y0, x1, y1 in CARVE:
        cls[y0:y1, x0:x1] = PATH

    town_world = {}
    for tid, (px, py, sx, sz, name) in TOWN_PX.items():
        wx, wz = world(px + 0.5, py + 0.5)
        town_world[tid] = {'x': wx, 'z': wz, 'sx': sx, 'sz': sz, 'name': name}

    def pad_of(px, py):
        """Town (with buildings) whose pad holds this pixel centre."""
        wx, wz = world(px + 0.5, py + 0.5)
        for tid in LAYOUTS:
            t = town_world[tid]
            if abs(wx - t['x']) <= t['sx'] / 2 and abs(wz - t['z']) <= t['sz'] / 2:
                return tid
        return None

    # Town pads: clear trees and tall grass, keep the blueprint's water and void.
    pad = np.zeros((h, w), np.int32)
    for py in range(h):
        for px in range(w):
            tid = pad_of(px, py)
            if tid:
                pad[py, px] = tid
                if cls[py, px] in (FOREST, TALL):
                    cls[py, px] = GRASS
    # Building footprints must stand on floor.
    for tid, L in LAYOUTS.items():
        t = town_world[tid]
        for n, dx, dz in L.get('blds', []):
            bx, bz = t['x'] + dx, t['z'] + dz
            p0x, p0y = to_px(bx + BLD_HALF, bz - BLD_HALF)
            p1x, p1y = to_px(bx - BLD_HALF, bz + BLD_HALF + 3)
            for py in range(int(math.floor(p0y)), int(math.ceil(p1y))):
                for px in range(int(math.floor(p0x)), int(math.ceil(p1x))):
                    if 0 <= px < w and 0 <= py < h and cls[py, px] in (VOID, WATER, ROCK, FOREST, MOUNT, TALL):
                        cls[py, px] = PATH

    water_like = (cls == WATER) | (cls == ROCK)
    near_water = np.zeros_like(water_like)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            near_water |= np.roll(np.roll(water_like, dy, 0), dx, 1)

    objetos = []
    seen = set()

    def add(n, x, z, a=0, y=0):
        k = (n, round(x * 2), round(z * 2))
        if k in seen:
            return
        seen.add(k)
        o = {'n': n, 'x': round(float(x), 2), 'y': round(float(y), 2), 'z': round(float(z), 2)}
        if a:
            o['a'] = round(a, 3)
        objetos.append(o)

    agua_cells = []
    grama_cells = []
    layer_count = Counter()

    def cell_origin(px, py):
        x0 = -(px + 1 - NB_PX) * M
        z0 = (py - NB_PY) * M
        return x0, z0

    boulder = np.zeros((h, w), bool)
    for py in range(h):
        for px in range(w):
            c = int(cls[py, px])
            if c == VOID:
                continue
            layer_count[CLASS_NAMES[c]] += 1
            x0, z0 = cell_origin(px, py)
            cx, cz = x0 + 1, z0 + 1
            cells = [(x0 + 0.5 + i, z0 + 0.5 + j) for j in range(2) for i in range(2)]
            in_pad = pad[py, px]
            if c in (WATER, ROCK):
                agua_cells.extend(cells)
                if c == ROCK:
                    add('sea_rock', cx, cz)
                continue
            if c == MOUNT:
                # rock_grass_4x4 is not floor to the game (EH_PISO); rock_ground_s is.
                add('rock_ground_s', cx, cz)
                win = cls[max(0, py - 1):py + 2, max(0, px - 1):px + 2]
                if not in_pad and (win == MOUNT).all() and hsh(px, py, 7) % 5 == 0:
                    add('sm_d_044_rock_01', cx, cz, a=(hsh(px, py, 8) % 4) * 1.571)
                    boulder[py, px] = True
                continue
            if c == PATH:
                sandy = near_water[py, px] and not in_pad
                for (x, z) in cells:
                    gi, gj = int(math.floor(x)), int(math.floor(z))
                    add(SAND if sandy else PATH_MIX[hsh(gi, gj) % len(PATH_MIX)], x, z)
                continue
            for (x, z) in cells:
                gi, gj = int(math.floor(x)), int(math.floor(z))
                add(GRASS_MIX[hsh(gi, gj, 1) % len(GRASS_MIX)], x, z)
            if c == FOREST:
                tree = TREES[hsh(px, py, 2) % len(TREES)]
                # tree_05's box reaches 1.16 m south; keep its blocked cells inside this pixel
                add(tree, cx, cz - 0.1 if tree != 'tree' else cz)
            elif c == TALL:
                for (x, z) in cells:
                    add('sm_001_gimgrass_03', x, z)
                    grama_cells.append((x, z))
            elif c == GRASS and not in_pad and hsh(px, py, 3) % 9 == 0:
                add(GRASS_DECO[hsh(px, py, 4) % len(GRASS_DECO)], cx + 0.5, cz + 0.5)

    for tid, L in LAYOUTS.items():
        t = town_world[tid]
        for n, dx, dz in L.get('blds', []):
            add(n, t['x'] + dx, t['z'] + dz)
        for n, dx, dz in L.get('extra', []):
            add(n, t['x'] + dx, t['z'] + dz)

    # Area boxes: towns/landmarks first (the game takes the first box that holds a point).
    caixas = []
    route_rect = {}
    for rid, (x0, y0, x1, y1) in ROUTE_PX.items():
        route_rect[rid] = [x0, y0, x1, y1]
    # Grow route boxes so every land pixel sits in some box.
    def in_any_box(px, py):
        wx, wz = world(px + 0.5, py + 0.5)
        for t in town_world.values():
            if abs(wx - t['x']) <= t['sx'] / 2 and abs(wz - t['z']) <= t['sz'] / 2:
                return True
        for (x0, y0, x1, y1) in route_rect.values():
            if x0 <= px < x1 and y0 <= py < y1:
                return True
        return False

    grown = 0
    for py in range(h):
        for px in range(w):
            if cls[py, px] == VOID or in_any_box(px, py):
                continue
            best, bid = 1e18, None
            for rid, (x0, y0, x1, y1) in route_rect.items():
                dx = max(x0 - px, 0, px - (x1 - 1))
                dy = max(y0 - py, 0, py - (y1 - 1))
                d = dx * dx + dy * dy
                if d < best:
                    best, bid = d, rid
            r = route_rect[bid]
            r[0], r[1] = min(r[0], px), min(r[1], py)
            r[2], r[3] = max(r[2], px + 1), max(r[3], py + 1)
            grown += 1

    for aid in areas:
        if aid in town_world:
            t = town_world[aid]
            caixas.append({
                'a': aid, 'x': round(t['x'], 1), 'y': 0, 'z': round(t['z'], 1),
                'sx': float(t['sx']), 'sy': 8, 'sz': float(t['sz']),
            })
        elif aid in route_rect:
            x0, y0, x1, y1 = route_rect[aid]
            ax0, az0 = world(x0, y0)
            ax1, az1 = world(x1, y1)
            caixas.append({
                'a': aid, 'x': round((ax0 + ax1) / 2, 1), 'y': 0, 'z': round((az0 + az1) / 2, 1),
                'sx': round(abs(ax0 - ax1), 1), 'sy': 8, 'sz': round(abs(az1 - az0), 1),
            })
        else:
            caixas.append({'a': aid, 'x': 0, 'y': 0, 'z': 0, 'sx': 24, 'sy': 8, 'sz': 24})

    def area_at(x, z, fallback=2241):
        for c in caixas:
            if abs(x - c['x']) <= c['sx'] / 2 and abs(z - c['z']) <= c['sz'] / 2:
                return c['a']
        return fallback

    agua = [{'tipo': 33, 'x': x, 'y': 0, 'z': z, 'a': area_at(x, z)} for (x, z) in agua_cells]
    grama = []
    for (x, z) in grama_cells:
        a = area_at(x, z, 2229)
        grama.append({'cfg': a * 100 + 1, 'tipo': 41, 'x': x, 'y': 0, 'z': z, 'a': a})

    # Open floor (no tree, boulder or building on it) for placing door points.
    walk_px = np.isin(cls, (PATH, GRASS, TALL)) & ~boulder
    for tid, L in LAYOUTS.items():
        t = town_world[tid]
        for _n, dx, dz in L.get('blds', []):
            p0x, p0y = to_px(t['x'] + dx + BLD_HALF, t['z'] + dz - BLD_HALF)
            p1x, p1y = to_px(t['x'] + dx - BLD_HALF, t['z'] + dz + BLD_HALF - 1)
            walk_px[max(0, int(p0y)):int(math.ceil(p1y)), max(0, int(p0x)):int(math.ceil(p1x))] = False
    # Only big connected regions: a door point in a 3-pixel clearing between trees is a trap.
    moves = np.isin(cls, (PATH, GRASS, TALL, MOUNT)) & ~boulder
    comp = np.full((h, w), -1, np.int32)
    sizes = []
    for sy, sx in zip(*np.nonzero(moves)):
        if comp[sy, sx] >= 0:
            continue
        cid, stack, n = len(sizes), [(sy, sx)], 0
        comp[sy, sx] = cid
        while stack:
            y, x = stack.pop()
            n += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and moves[ny, nx] and comp[ny, nx] < 0:
                    comp[ny, nx] = cid
                    stack.append((ny, nx))
        sizes.append(n)
    sizes = np.array(sizes + [0])
    walk_px &= sizes[comp] >= 150

    def snap_floor(x, z):
        px, py = to_px(x, z)
        ipx, ipy = int(math.floor(px)), int(math.floor(py))
        if 0 <= ipx < w and 0 <= ipy < h and walk_px[ipy, ipx]:
            return x, z
        for rad in range(1, 60):
            best = None
            for yy in range(ipy - rad, ipy + rad + 1):
                for xx in range(ipx - rad, ipx + rad + 1):
                    if max(abs(xx - ipx), abs(yy - ipy)) != rad:
                        continue
                    if 0 <= xx < w and 0 <= yy < h and walk_px[yy, xx]:
                        d = (xx - px) ** 2 + (yy - py) ** 2
                        if best is None or d < best[0]:
                            best = (d, xx, yy)
            if best:
                return world(best[1] + 0.5, best[2] + 0.5)
        return x, z

    by_area = defaultdict(list)
    for cid, p in doors.items():
        if p.get('c') != 2000001:
            continue
        by_area[p['a']].append({'cfg': int(cid), 't': p['t']})

    used = set()
    npcs = []

    def put(cfg, modelo, x, z, a, snap=False):
        if not cfg or cfg in used:
            return
        if snap:
            x, z = snap_floor(x, z)
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
                put(p['cfg'], 171, t['x'], t['z'] + t['sz'] / 2 - 4, tid, snap=True)

    # Connection Center: Route 26 (toward Kanto) and Route 28 by Mt. Silver.
    r26x, r26z = snap_floor(*world(453.5, 200.5))
    put(6222603, 162, r26x, r26z, 2226)
    put(7222699, 171, r26x, r26z - 2, 2226)
    ms = town_world[2114]
    put(6222801, 162, ms['x'] + 8, ms['z'] + 6, 2228, snap=True)
    put(7222801, 171, ms['x'] + 10, ms['z'] + 6, 2228, snap=True)
    put(7210199, 171, town_world[2101]['x'], town_world[2101]['z'] + 8, 2101)

    for box in caixas:
        leftover = [p for p in by_area[box['a']] if p['cfg'] not in used]
        for i, pt in enumerate(leftover):
            ang = (i / max(1, len(leftover))) * math.tau
            put(pt['cfg'], 162 if pt['t'] == 6 else 171,
                box['x'] + math.cos(ang) * 6, box['z'] + math.sin(ang) * 6, box['a'], snap=True)

    bbox = {
        'x0': min(c['x'] - c['sx'] / 2 for c in caixas),
        'x1': max(c['x'] + c['sx'] / 2 for c in caixas),
        'z0': min(c['z'] - c['sz'] / 2 for c in caixas),
        'z1': max(c['z'] + c['sz'] / 2 for c in caixas),
    }
    sea_x = round((bbox['x0'] + bbox['x1']) / 2, 1)
    sea_z = round((bbox['z0'] + bbox['z1']) / 2, 1)
    out = {
        'mapa': 2000001, 'nome': 'johto', 'areas': areas, 'nomes': nomes,
        'caixas': caixas, 'objetos': objetos,
        'ambiente': [{'n': 'shui_floor', 'x': sea_x, 'y': -0.268, 'z': sea_z, 'a': 0, 'w': 0, 'h': 0}],
        'areaEnv': [],
        'grama': grama, 'agua': agua, 'portas': [], 'treinadores': [],
        'historias': [], 'npcs': npcs, 'nav': [],
        'prefabs': sorted({o['n'] for o in objetos} | {'shui_floor'}),
        'bbox': bbox,
    }
    OUT.write_text(json.dumps(out, separators=(',', ':')))
    names = Counter(o['n'] for o in objetos)
    print('Johto', len(objetos), 'objects', len(agua), 'water cells', len(grama), 'grass cells',
          'from', BP.name, im.size, 'M =', M)
    print('pixels by layer', dict(layer_count))
    print('top prefabs', names.most_common(12))
    print('route boxes grown for', grown, 'pixels')
    print('bbox', bbox, 'size', round(OUT.stat().st_size / 1e6, 2), 'MB')
    for i in sorted(LAYOUTS):
        t = town_world[i]
        print(i, t['name'], 'px', TOWN_PX[i][:2], 'x', round(t['x']), 'z', round(t['z']))


if __name__ == '__main__':
    main()
