#!/usr/bin/env python3
"""Build public/data/2000001.json as the HGSS Johto Town Map.

Axis matches Kanto: +Z south, −Z north, +X west, −X east.
Town Map (east right, north up) → x = −east, z = −north.

Land is the official shape: south coast New Bark–Cherrygrove, Route 32's
U, Goldenrod on the west bay, Olivine/Cianwood on the sea, Ecruteak north,
Lake of Rage, Blackthorn east. Towns use HGSS building layouts, not
stamped Kanto cities.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/2000001.json'

G = lambda east, north: {'x': -east, 'z': -north}

# HGSS Town Map centers (east, north metres). Distances like Kanto towns.
TOWN = {
    2101: {**G(210, -90), 'sx': 38, 'sz': 30, 'name': 'New Bark Town'},
    2102: {**G(90, -90), 'sx': 42, 'sz': 32, 'name': 'Cherrygrove City'},
    2103: {**G(30, 85), 'sx': 48, 'sz': 42, 'name': 'Violet City'},
    2104: {**G(-70, -80), 'sx': 42, 'sz': 34, 'name': 'Azalea Town'},
    2105: {**G(-160, 15), 'sx': 56, 'sz': 48, 'name': 'Goldenrod City'},
    2106: {**G(-30, 170), 'sx': 50, 'sz': 42, 'name': 'Ecruteak City'},
    2107: {**G(-210, 145), 'sx': 48, 'sz': 40, 'name': 'Olivine City'},
    2108: {**G(-260, 15), 'sx': 40, 'sz': 34, 'name': 'Cianwood City'},
    2109: {**G(50, 200), 'sx': 36, 'sz': 30, 'name': 'Mahogany Town'},
    2110: {**G(155, 160), 'sx': 44, 'sz': 36, 'name': 'Blackthorn City'},
    2111: {**G(-95, 95), 'sx': 52, 'sz': 40, 'name': 'National Park'},
    2112: {**G(10, 20), 'sx': 36, 'sz': 28, 'name': 'Ruins of Alph'},
    2113: {**G(50, 270), 'sx': 44, 'sz': 40, 'name': 'Lake of Rage'},
    2114: {**G(210, 80), 'sx': 32, 'sz': 26, 'name': 'Mt. Silver'},
    2115: {**G(-320, 30), 'sx': 48, 'sz': 36, 'name': 'Johto Safari Zone'},
    2116: {**G(-280, 170), 'sx': 40, 'sz': 32, 'name': 'Battle Frontier'},
    2117: {**G(-20, -80), 'sx': 40, 'sz': 36, 'name': 'Ilex Forest'},
    2118: {**G(-30, -50), 'sx': 28, 'sz': 24, 'name': 'Union Cave'},
    2119: {**G(90, 40), 'sx': 28, 'sz': 24, 'name': 'Dark Cave'},
    2120: {**G(10, 185), 'sx': 32, 'sz': 28, 'name': 'Mt. Mortar'},
    2121: {**G(100, 180), 'sx': 28, 'sz': 24, 'name': 'Ice Path'},
    2122: {**G(-235, 70), 'sx': 36, 'sz': 28, 'name': 'Whirl Islands'},
    2123: {**G(250, -90), 'sx': 28, 'sz': 24, 'name': 'Tohjo Falls'},
    2124: {**G(-290, 20), 'sx': 24, 'sz': 20, 'name': 'Safari Zone Gate'},
    2125: {**G(-255, 170), 'sx': 24, 'sz': 20, 'name': 'Frontier Access'},
    2126: {**G(-140, 55), 'sx': 28, 'sz': 24, 'name': 'Pokéathlon Dome'},
    2127: {**G(-275, 15), 'sx': 24, 'sz': 20, 'name': 'Cliff Cave'},
    2128: {**G(-265, 15), 'sx': 22, 'sz': 18, 'name': 'Cliff Edge Gate'},
    2129: {**G(-20, 190), 'sx': 22, 'sz': 18, 'name': 'Bellchime Trail'},
    2130: {**G(-280, -10), 'sx': 22, 'sz': 18, 'name': 'Embedded Tower'},
}

# HGSS building layouts (dx west, dz south).
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

STEP = 2  # metres
RW = 16   # half-width of a route corridor (~32 m, like the Town Map)


def q(v):
    return int(round(v / STEP) * STEP)


def add_rect(land, x, z, sx, sz, kind='grass'):
    x0, x1 = x - sx / 2, x + sx / 2
    z0, z1 = z - sz / 2, z + sz / 2
    xx = q(x0)
    while xx <= x1:
        zz = q(z0)
        while zz <= z1:
            land[(xx, zz)] = kind
            zz += STEP
        xx += STEP


def add_capsule(land, x0, z0, x1, z1, half=RW, kind='grass'):
    dx, dz = x1 - x0, z1 - z0
    length = math.hypot(dx, dz) or 1
    n = max(1, int(length / STEP))
    for i in range(n + 1):
        t = i / n
        add_rect(land, x0 + dx * t, z0 + dz * t, half * 2, half * 2, kind)


def T(i):
    return TOWN[i]


def main():
    doors = json.loads((ROOT / 'public/data/doors.json').read_text())
    scenes = json.loads((ROOT / 'public/data/scenes.json').read_text())
    johto = next(c for c in scenes['cenas'] if c['id'] == 2000001)
    nomes = {a['id']: a['nome'] for a in johto['areas']}
    areas = [a['id'] for a in johto['areas']]

    land = {}
    water = {}

    # Town pads
    for tid, t in TOWN.items():
        kind = 'plaza' if tid in LAYOUTS else 'grass'
        add_rect(land, t['x'], t['z'], t['sx'] + 8, t['sz'] + 8, kind)

    # HGSS corridors (fat, connected — the Town Map silhouette)
    C = [
        # 29 New Bark — Cherrygrove (south coast)
        (T(2101)['x'], T(2101)['z'], T(2102)['x'], T(2102)['z'], 14, 'path'),
        # 30 Cherrygrove north toward Violet
        (T(2102)['x'], T(2102)['z'], T(2102)['x'], T(2103)['z'] + 30, 14, 'grass'),
        # 31 into Violet
        (T(2102)['x'], T(2103)['z'] + 30, T(2103)['x'], T(2103)['z'], 14, 'grass'),
        # 32 U: Violet south, then west to Azalea (the Johto C)
        (T(2103)['x'] + 8, T(2103)['z'], T(2103)['x'] + 8, T(2104)['z'] + 10, 14, 'grass'),
        (T(2103)['x'] + 8, T(2104)['z'] + 10, T(2104)['x'], T(2104)['z'], 14, 'grass'),
        # 33/Ilex Azalea — Ilex — Goldenrod south
        (T(2104)['x'], T(2104)['z'], T(2117)['x'], T(2117)['z'], 16, 'forest'),
        (T(2117)['x'], T(2117)['z'], T(2105)['x'], T(2104)['z'], 14, 'forest'),
        (T(2105)['x'], T(2104)['z'], T(2105)['x'], T(2105)['z'], 14, 'path'),
        # 35/36 Goldenrod — National Park — Violet / Ecruteak
        (T(2105)['x'], T(2105)['z'], T(2111)['x'], T(2111)['z'], 16, 'grass'),
        (T(2111)['x'], T(2111)['z'], T(2103)['x'], T(2103)['z'], 14, 'grass'),
        (T(2111)['x'], T(2111)['z'], T(2106)['x'], T(2106)['z'], 14, 'grass'),
        # 37 Violet — Ecruteak
        (T(2103)['x'], T(2103)['z'], T(2106)['x'], T(2106)['z'], 14, 'grass'),
        # 38/39 Ecruteak — Olivine
        (T(2106)['x'], T(2106)['z'], T(2107)['x'], T(2106)['z'], 14, 'path'),
        (T(2107)['x'], T(2106)['z'], T(2107)['x'], T(2107)['z'], 14, 'path'),
        # 42 Ecruteak — Mahogany
        (T(2106)['x'], T(2106)['z'], T(2109)['x'], T(2106)['z'], 14, 'dirt'),
        (T(2109)['x'], T(2106)['z'], T(2109)['x'], T(2109)['z'], 14, 'dirt'),
        # 43 Mahogany — Lake of Rage
        (T(2109)['x'], T(2109)['z'], T(2113)['x'], T(2113)['z'], 14, 'grass'),
        # 44 Mahogany — Blackthorn
        (T(2109)['x'], T(2109)['z'], T(2110)['x'], T(2110)['z'], 14, 'dirt'),
        # 45 Blackthorn south toward Route 29
        (T(2110)['x'], T(2110)['z'], T(2110)['x'], T(2101)['z'] - 20, 12, 'dirt'),
        # 46 down to Route 29
        (T(2110)['x'], T(2101)['z'] - 20, (T(2101)['x'] + T(2102)['x']) / 2, T(2101)['z'], 12, 'grass'),
        ((T(2101)['x'] + T(2102)['x']) / 2, T(2101)['z'] - 20, (T(2101)['x'] + T(2102)['x']) / 2, T(2110)['z'] + 20, 12, 'grass'),
        # 27/26/28 New Bark east to Tohjo / Mt Silver
        (T(2101)['x'], T(2101)['z'], T(2123)['x'], T(2123)['z'], 12, 'path'),
        (T(2123)['x'], T(2123)['z'], T(2123)['x'], T(2114)['z'], 12, 'dirt'),
        (T(2123)['x'], T(2114)['z'], T(2114)['x'], T(2114)['z'], 12, 'dirt'),
        # 47/48 Cianwood — Safari
        (T(2108)['x'], T(2108)['z'], T(2115)['x'], T(2108)['z'], 12, 'sand'),
        (T(2115)['x'], T(2108)['z'], T(2115)['x'], T(2115)['z'], 14, 'grass'),
        # Ruins of Alph off Violet
        (T(2103)['x'], T(2103)['z'], T(2112)['x'], T(2112)['z'], 12, 'dirt'),
    ]
    for x0, z0, x1, z1, half, kind in C:
        add_capsule(land, x0, z0, x1, z1, half, kind)

    # Ilex Forest dense pad
    add_rect(land, T(2117)['x'], T(2117)['z'], 44, 40, 'forest')
    add_rect(land, T(2111)['x'], T(2111)['z'], 56, 44, 'grass')

    # West sea: Olivine south to Cianwood (Route 40/41) + Whirl Islands
    add_capsule(water, T(2107)['x'], T(2107)['z'] + 24, T(2107)['x'],
                (T(2107)['z'] + T(2108)['z']) / 2, 18, 'water')
    add_capsule(water, T(2107)['x'], (T(2107)['z'] + T(2108)['z']) / 2,
                T(2108)['x'], T(2108)['z'], 18, 'water')
    add_rect(water, T(2122)['x'], T(2122)['z'], 40, 32, 'water')
    # Goldenrod west bay
    add_rect(water, T(2105)['x'] + 40, T(2105)['z'], 28, 36, 'water')
    # South coast ocean
    add_rect(water, (T(2101)['x'] + T(2102)['x']) / 2, T(2101)['z'] + 28, 140, 16, 'water')
    # Lake of Rage
    add_rect(water, T(2113)['x'], T(2113)['z'], 24, 20, 'water')
    # Keep shore land around the lake
    add_rect(land, T(2113)['x'], T(2113)['z'], 44, 40, 'grass')
    for k in list(water):
        if k in land and land[k] == 'plaza':
            del water[k]

    # Don't paint water over town plazas
    for tid, t in TOWN.items():
        if tid not in LAYOUTS:
            continue
        add_rect(land, t['x'], t['z'], t['sx'], t['sz'], 'plaza')

    objetos = []
    seen = set()

    def add(n, x, z, a=0, y=0):
        key = (n, round(x * 2), round(z * 2))
        if key in seen:
            return
        seen.add(key)
        o = {'n': n, 'x': round(float(x), 1), 'y': round(float(y), 2), 'z': round(float(z), 1)}
        if a:
            o['a'] = round(a, 3)
        objetos.append(o)

    def inside_town(x, z):
        for tid, t in TOWN.items():
            if tid not in LAYOUTS:
                continue
            if abs(x - t['x']) <= t['sx'] / 2 and abs(z - t['z']) <= t['sz'] / 2:
                return tid
        return None

    # Ground
    for (x, z), kind in land.items():
        if (x, z) in water and kind != 'plaza':
            continue
        tid = inside_town(x, z)
        if tid:
            L = LAYOUTS[tid]
            tile = L.get('plaza', 'ground_plane007')
            if L.get('sand') and z > TOWN[tid]['z'] + 4:
                tile = SAND[(x + z) % len(SAND)]
            add(tile, x, z)
            continue
        if kind == 'path':
            add(PATH[(x + z) % len(PATH)], x, z)
        elif kind == 'forest':
            add('rock_grass_4x4', x, z)
        elif kind == 'sand':
            add(SAND[(x + z) % len(SAND)], x, z)
        elif kind == 'dirt':
            add('ground_plane003', x, z)
        else:
            add(GRASS[(x + 3 * z) % len(GRASS)], x, z)

    # Tree wall on land edges + Ilex fill (Town Map dark-green outline)
    neigh = ((STEP, 0), (-STEP, 0), (0, STEP), (0, -STEP))
    for (x, z), kind in land.items():
        if inside_town(x, z) or (x, z) in water:
            continue
        edge = any((x + dx, z + dz) not in land for dx, dz in neigh)
        if kind == 'forest' or edge:
            if (x + z) % 4 == 0:
                add('tree', x, z)

    agua = []
    for (x, z) in water:
        if inside_town(x, z):
            continue
        agua.append({'tipo': 33, 'x': x + 0.5, 'y': 0, 'z': z + 0.5, 'a': 2241})
        if (x + z) % 14 == 0:
            add('sea_rock', x, z)

    # Landmarks
    add('floor_cliff_obj', T(2118)['x'], T(2118)['z'])
    add('floor_cliff_obj', T(2119)['x'], T(2119)['z'])
    add('floor_cliff_obj', T(2120)['x'], T(2120)['z'])
    add('floor_cliff_obj', T(2121)['x'], T(2121)['z'])
    add('floor_cliff_obj', T(2123)['x'], T(2123)['z'])
    add('sm_t_003_pokecompany_01_1', T(2126)['x'], T(2126)['z'])
    for i in range(24):
        add('tree', T(2117)['x'] + (i % 6 - 2.5) * 5, T(2117)['z'] + (i // 6 - 1.5) * 5)

    # Town buildings + north fence
    for tid, L in LAYOUTS.items():
        t = TOWN[tid]
        for n, dx, dz in L.get('blds', []):
            add(n, t['x'] + dx, t['z'] + dz)
        for n, dx, dz in L.get('extra', []):
            add(n, t['x'] + dx, t['z'] + dz)
        zf = t['z'] - t['sz'] / 2
        x0 = t['x'] - t['sx'] / 2
        x = x0
        while x <= t['x'] + t['sx'] / 2:
            add('sm_001_fence_02_z 1', x, zf)
            x += 2

    # Route caixas along the same corridors
    def box_between(a, b, sx=32, sz=32):
        A, B = T(a), T(b)
        return {
            'x': (A['x'] + B['x']) / 2, 'z': (A['z'] + B['z']) / 2,
            'sx': max(sx, abs(B['x'] - A['x']) + 20),
            'sz': max(sz, abs(B['z'] - A['z']) + 20),
        }

    RTE = {
        2229: box_between(2101, 2102, 28, 28),
        2230: box_between(2102, 2103, 32, 32),
        2231: {'x': (T(2102)['x'] + T(2103)['x']) / 2, 'z': T(2103)['z'] + 24, 'sx': 40, 'sz': 28},
        2232: box_between(2103, 2104, 36, 36),
        2233: box_between(2104, 2117, 28, 28),
        2234: box_between(2105, 2104, 32, 32),
        2235: box_between(2105, 2111, 32, 32),
        2236: box_between(2111, 2103, 32, 28),
        2237: box_between(2103, 2106, 32, 32),
        2238: box_between(2106, 2107, 32, 28),
        2239: {'x': T(2107)['x'], 'z': (T(2106)['z'] + T(2107)['z']) / 2, 'sx': 28, 'sz': 36},
        2240: {'x': T(2107)['x'], 'z': (T(2107)['z'] + T(2108)['z']) / 2, 'sx': 28, 'sz': 40},
        2241: box_between(2107, 2108, 36, 36),
        2242: box_between(2106, 2109, 32, 28),
        2243: box_between(2109, 2113, 28, 32),
        2244: box_between(2109, 2110, 32, 28),
        2245: box_between(2110, 2101, 28, 36),
        2246: {'x': (T(2101)['x'] + T(2102)['x']) / 2, 'z': (T(2101)['z'] + T(2110)['z']) / 2, 'sx': 28, 'sz': 80},
        2247: box_between(2108, 2115, 32, 24),
        2248: box_between(2115, 2108, 28, 32),
        2227: box_between(2101, 2123, 28, 24),
        2226: box_between(2123, 2114, 28, 36),
        2228: box_between(2123, 2114, 36, 24),
    }
    LAY = {**{k: {'x': v['x'], 'z': v['z'], 'sx': v['sx'], 'sz': v['sz']} for k, v in TOWN.items()}, **RTE}

    caixas = []
    for aid in areas:
        L = LAY.get(aid, {'x': 0, 'z': 0, 'sx': 28, 'sz': 24})
        caixas.append({
            'a': aid, 'x': round(L['x'], 1), 'y': 0, 'z': round(L['z'], 1),
            'sx': round(L['sx'], 1), 'sy': 8, 'sz': round(L['sz'], 1),
        })

    grama = []
    for i, (x, z) in enumerate(land):
        if land[(x, z)] not in ('grass', 'forest'):
            continue
        if inside_town(x, z) or i % 6:
            continue
        grama.append({
            'cfg': 2229 * 100 + (i % 97), 'tipo': 41,
            'x': x + 0.5, 'y': 0, 'z': z + 0.5, 'a': 2229,
        })

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
        t = TOWN[tid]
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

    put(6222603, 162, T(2123)['x'], T(2123)['z'] - 6, 2226)
    put(7222699, 171, T(2123)['x'], T(2123)['z'] - 8, 2226)
    put(6222801, 162, T(2114)['x'] + 8, T(2114)['z'], 2228)
    put(7222801, 171, T(2114)['x'] + 10, T(2114)['z'], 2228)
    put(7210199, 171, T(2101)['x'], T(2101)['z'] + 8, 2101)

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
    print('Johto', len(objetos), 'pieces', len(npcs), 'npcs', len(agua), 'water')
    print('bbox', out['bbox'])
    for i in (2101, 2102, 2103, 2104, 2105, 2106, 2107, 2108, 2109, 2110):
        t = TOWN[i]
        print(i, t['name'], 'x', round(t['x']), 'z', round(t['z']))


if __name__ == '__main__':
    main()
