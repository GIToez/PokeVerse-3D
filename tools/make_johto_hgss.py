#!/usr/bin/env python3
"""Build public/data/2000001.json (Johto) from the HGSS overworld stitch.

tools/johto_hgss_tiles.txt is tools/hgss_world.png classified one character
per 16 px tile (see tools/hgss_tiles.py). One HGSS tile is one metre, the
size Kanto's prefabs are cut for: 1 m floor tiles, 2x2-tile trees, 4-tile
houses, a 5-tile Pokémon Center. Every layer is laid prefab by prefab:

  grass / trees / tall grass  -> floor_grass2 tiles, one tree
                                 per 2x2 tree block, gimgrass + encounter cells
  dirt, paving, bridges       -> flat tiles_n path tiles over a grass or sand tile
  cliff lips beside a rock    -> floor_1 (the cliff decal; most mountain lines are roads)
  sand, snow                  -> sink_sand_ground_001 tiles
  mountains and cliffs        -> 2x2 rock-face blocks stacked up to 4 m,
                                 higher the further from the mountain's edge.
                                 The piece matches the neighbours: corner, edge,
                                 concave notch, or a flat cap in the middle.
  water                       -> agua cells over the sea plane, sea_rock rocks
  buildings                   -> one Kanto prefab per HGSS building
                                 (tools/johto_hgss_towns.py)

World axes: stored x is WEST (the game flips x), +z is south.
"""
from __future__ import annotations

import heapq
import json
import math
from collections import Counter, defaultdict, deque
from pathlib import Path

import numpy as np

from johto_east import (CHECKS, DOOR_CHECKS, DOOR_ONLY, EAST_BUILDINGS, EAST_LANDMARKS, EAST_POINTS,
                        EAST_PROPS, EAST_ROUTES, PEAKS, WIDTH, draw_east)
from johto_hgss_towns import GYMS, SIZES, STATUE, TOWNS
from johto_rock_prefab import CAP_LIFT, ROCK_CAP, rock_choice

# Local bounds of the turned gatehouses (tools/make_der_house_gates.py).
SIZES = {**SIZES,
         'sm_c_der_house4': (-8.377, -3.706, 3.600, 3.594),
         'sm_c_der_house5': (-3.706, -3.600, 3.594, 8.377)}

ROOT = Path(__file__).resolve().parents[1]
TILES = ROOT / 'tools/johto_hgss_tiles.txt'
OUT = ROOT / 'public/data/2000001.json'

OX, OY = 330, 190        # tile edge that becomes world (0, 0)

TREE_CLS = set('FASP')
FLOOR_CLS = set('GTFASPDCNOKBXL')

# Routes and landmarks: (x0, y0, x1, y1) in tiles. Towns come from TOWNS.
# The game takes the first box that holds a point, so landmarks go before routes;
# route boxes are then grown until every land tile sits in one.
LANDMARKS = {
    2111: ('National Park', (286, 150, 322, 190)),
    2112: ('Ruins of Alph', (370, 222, 386, 240)),
    2113: ('Lake of Rage', (420, 16, 503, 76)),
    2114: ('Mt. Silver', EAST_LANDMARKS[2114]),
    2115: ('Johto Safari Zone', (0, 296, 12, 330)),
    2116: ('Battle Frontier', (166, 194, 186, 214)),
    2117: ('Ilex Forest', (286, 336, 322, 378)),
    2118: ('Union Cave', (372, 334, 392, 348)),
    2119: ('Dark Cave', (516, 224, 536, 240)),
    2120: ('Mt. Mortar', (396, 120, 420, 136)),
    2121: ('Ice Path', (560, 104, 580, 120)),
    2122: ('Whirl Islands', (120, 256, 180, 296)),
    2123: ('Tohjo Falls', EAST_LANDMARKS[2123]),
    2124: ('Safari Zone Gate', (0, 286, 10, 296)),
    2125: ('Frontier Access', (186, 204, 196, 214)),
    2126: ('Pokéathlon Dome', (300, 190, 316, 198)),
    2127: ('Cliff Cave', (0, 262, 10, 274)),
    2128: ('Cliff Edge Gate', (10, 262, 20, 274)),
    2129: ('Bellchime Trail', (340, 88, 362, 104)),
    2130: ('Embedded Tower', (0, 330, 12, 340)),
}
ROUTES = {
    **EAST_ROUTES,
    2229: (512, 290, 600, 330),
    2230: (474, 212, 516, 294),
    2231: (445, 194, 516, 212),
    2232: (386, 224, 420, 334),
    2233: (362, 334, 400, 370),
    2234: (286, 300, 330, 336),
    2235: (286, 190, 330, 252),
    2236: (322, 166, 395, 194),
    2237: (322, 146, 346, 166),
    2238: (236, 112, 296, 152),
    2239: (186, 112, 236, 176),
    2240: (150, 205, 200, 245),
    2241: (90, 245, 200, 305),
    2242: (362, 112, 448, 146),
    2243: (445, 76, 492, 113),
    2244: (482, 112, 588, 150),
    2245: (572, 146, 620, 272),
    2246: (500, 230, 572, 290),
    2247: (0, 246, 50, 300),
    2248: (0, 160, 30, 220),
}

# New Bark's east path, through the trees to Route 27's boardwalk (tools/johto_east.py).
EAST_CARVE = (632, 306, 641, 310)
MOUNT_MIN = 13

# ground_plane* are alpha-masked edge decals and floor_y / floor_z cover 3/4 of their
# square (the sea plane shows through); these are the tiles that fill theirs.
GRASS_MIX = ['floor_grass2']
# tiles_n is the flat path. floor_1 is the cliff decal, only for a lip (L) against a rock.
PATH = ['tiles_n_1', 'tiles_n_2', 'tiles_n_3', 'tiles_n_4']
FLOOR_OF = {'D': PATH, 'C': PATH, 'K': PATH, 'L': ['floor_1'],
            'N': ['sink_sand_ground_001'], 'O': ['sink_sand_ground_001']}
# floor_1 is alpha-masked at the edges: an opaque tile underneath closes the seams.
BASE_OF = {'D': 'floor_grass2', 'C': 'floor_grass2', 'K': 'sink_sand_ground_001', 'L': 'floor_grass2'}
TREE_OF = {'F': ['tree', 'tree', 'sm_c_001_tree_05_reordered'], 'S': ['tree'],
           'A': ['sm_c_001_tree_05_reordered'], 'P': ['sm_c_001_tree_05_reordered']}
ROCK_H = 1.02                       # one rock-face layer; the cap sits CAP_LIFT above the base
GRASS_DECO = ['sm_c_001_comgrass_01_1', 'sm_c_001_comgrass_01_2', 'sm_c_001_flower_04']


def world(tx, ty):
    """Continuous tile coords (east, south) -> stored world (x west, z south)."""
    return (-(float(tx) - OX), float(ty) - OY)


def to_tile(x, z):
    return (OX - x, OY + z)


def hsh(i, j, salt=0):
    v = (i * 73856093) ^ (j * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) & 0x7fffffff


def load_grid():
    rows = TILES.read_text().split()
    g = np.array([list(r) for r in rows])
    # The stitch draws Route 45/46's far cliffs as thin outlines over the void; drop them.
    land = np.pad((g != '.').astype(np.int32), 3)
    near = sum(np.roll(np.roll(land, dy, 0), dx, 1) for dy in range(-3, 4) for dx in range(-3, 4))[3:-3, 3:-3]
    g[(near < 16) | ((near < 23) & np.isin(g, ['M', 'D']))] = '.'
    comp, sizes = label(g != '.')
    g[(comp >= 0) & (sizes[comp] < 60)] = '.'
    cx0, cy0, cx1, cy1 = EAST_CARVE
    g[cy0:cy1, cx0:cx1] = 'D'
    # Ledges and cliff lips are thin mountain lines across grass: flat ground. Only
    # mountain tiles with at least MOUNT_MIN mountain tiles in their 5x5 become rock.
    mount = np.pad((g == 'M').astype(np.int32), 2)
    dense = sum(np.roll(np.roll(mount, dy, 0), dx, 1) for dy in range(-2, 3) for dx in range(-2, 3))[2:-2, 2:-2]
    g[(g == 'M') & (dense < MOUNT_MIN)] = 'G'
    # The east areas are drawn, not classified: their cliffs are meant as drawn.
    return draw_east(np.pad(g, ((0, 0), (0, WIDTH - g.shape[1])), constant_values='.'))


def label(mask):
    """4-connected components of a boolean grid: (component id per tile or -1, sizes)."""
    h, w = mask.shape
    comp = np.full((h, w), -1, np.int32)
    sizes = []
    for sy, sx in zip(*np.nonzero(mask)):
        if comp[sy, sx] >= 0:
            continue
        cid, stack, n = len(sizes), [(sy, sx)], 0
        comp[sy, sx] = cid
        while stack:
            y, x = stack.pop()
            n += 1
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and comp[ny, nx] < 0:
                    comp[ny, nx] = cid
                    stack.append((ny, nx))
        sizes.append(n)
    return comp, np.array(sizes + [0])


def solids(g, occupied, carved):
    """Rock blocks and trees for the current grid.

    Mountains: a 2x2 block wherever two of its four tiles are mountain, stacked
    one 1 m layer per block of distance from the mountain's edge (up to 4).
    Trees: one per 2x2 block of tree tiles, phase found locally (greedy, raster order).
    Nothing goes on a building's footprint or apron or on a carved link.
    Returns (rocks [(bx, by, layers)], rock tiles, trees [(tx, ty, prefab)], tree tiles).
    """
    h, w = g.shape
    bh, bw = h // 2, w // 2
    mb = (g == 'M')[:bh * 2, :bw * 2].reshape(bh, 2, bw, 2).sum(axis=(1, 3)) >= 2
    depth = np.zeros((bh, bw), np.int32)
    q = deque()
    for (by, bx), v in np.ndenumerate(mb):
        if v and any(not (0 <= by + dy < bh and 0 <= bx + dx < bw) or not mb[by + dy, bx + dx]
                     for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            depth[by, bx] = 1
            q.append((by, bx))
    while q:
        by, bx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = by + dy, bx + dx
            if 0 <= ny < bh and 0 <= nx < bw and mb[ny, nx] and depth[ny, nx] == 0:
                depth[ny, nx] = depth[by, bx] + 1
                q.append((ny, nx))
    rocks, rock_tile = [], np.zeros((h, w), bool)
    for (by, bx), v in np.ndenumerate(mb):
        blk = (slice(by * 2, by * 2 + 2), slice(bx * 2, bx * 2 + 2))
        if v and not occupied[blk].any() and not carved[blk].any():
            rock_tile[blk] = True
            rocks.append((int(bx), int(by), int(depth[by, bx])))

    trees, tree_tile = [], np.zeros((h, w), bool)
    is_tree = np.isin(g, list(TREE_CLS)) & ~occupied & ~rock_tile
    for ty in range(h - 1):
        for tx in range(w - 1):
            if not is_tree[ty, tx] or tree_tile[ty, tx]:
                continue
            blk = (slice(ty, ty + 2), slice(tx, tx + 2))
            if is_tree[blk].sum() >= 3 and not tree_tile[blk].any() and not carved[blk].any():
                tree_tile[blk] = True
                kind = Counter(c for c in g[blk].ravel() if c in TREE_CLS).most_common(1)[0][0]
                opts = TREE_OF[kind]
                trees.append((tx, ty, opts[hsh(tx, ty, 2) % len(opts)]))
    return rocks, rock_tile, trees, tree_tile


def door_only(comp):
    """Regions reached only through a door (Route 28 and Mt. Silver), which no path joins."""
    x0, y0, x1, y1 = DOOR_ONLY
    return set(np.unique(comp[y0:y1, x0:x1])) - {-1}


def link_regions(g, bld_mask, solid, min_size=200):
    """Carve 2 m paths so every walkable region of min_size tiles is reachable from New Bark.

    HGSS joins much of Johto through gatehouses, caves (Union Cave, Ilex Forest,
    Ice Path) and Surf, none of which this overworld stitch draws. Starting from
    New Bark, repeatedly take the cheapest path to the nearest unlinked region,
    preferring open ground over trees and rock and both over water (bridged with
    planks), and never through a building or the void. Tree and mountain tiles,
    and `solid` tiles (covered by a tree or rock block), count as blocked here.
    """
    h, w = g.shape
    carved = np.zeros((h, w), bool)
    step_cost = {c: 1 for c in 'GTDCNOKBX'}
    step_cost.update({c: 5 for c in 'FASPM'})
    step_cost.update({'W': 10, 'R': 10})
    while True:
        walk = np.isin(g, list('GTDCNOKBX')) & ~bld_mask & ~(solid & ~carved)
        comp, sizes = label(walk)
        home = comp[312, 624]
        targets = {i for i, s in enumerate(sizes[:-1]) if s >= min_size and i != home} - door_only(comp)
        if not targets:
            return carved
        dist = np.full((h, w), np.inf)
        prev = {}
        heap = []
        for y, x in zip(*np.nonzero(comp == home)):
            dist[y, x] = 0
            heap.append((0.0, int(y), int(x)))
        heapq.heapify(heap)
        hit = None
        while heap:
            d, y, x = heapq.heappop(heap)
            if d > dist[y, x]:
                continue
            if comp[y, x] in targets:
                hit = (y, x)
                break
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if not (0 <= ny < h and 0 <= nx < w) or bld_mask[ny, nx]:
                    continue
                c = step_cost.get(g[ny, nx])
                if c is None:
                    continue
                if solid[ny, nx] and not carved[ny, nx]:
                    c = max(c, 5)
                nd = d + c
                if nd < dist[ny, nx]:
                    dist[ny, nx] = nd
                    prev[(ny, nx)] = (y, x)
                    heapq.heappush(heap, (nd, ny, nx))
        if hit is None:
            return carved
        path = [hit]
        while path[-1] in prev:
            path.append(prev[path[-1]])
        for (y, x), (py, px) in zip(path, path[1:] + [path[-1]]):
            side = (y, x + 1) if py != y else (y + 1, x)
            for ty, tx in ((y, x), side):
                if not (0 <= ty < h and 0 <= tx < w) or bld_mask[ty, tx] or g[ty, tx] == '.':
                    continue
                if g[ty, tx] in 'FASPMWR':
                    g[ty, tx] = 'K' if g[ty, tx] in 'WR' else 'D'
                    carved[ty, tx] = True
                elif solid[ty, tx]:
                    carved[ty, tx] = True
        print('linked region of', sizes[comp[hit]], 'tiles at tile', (hit[1], hit[0]),
              'path', len(path), 'tiles')


def main():
    doors = json.loads((ROOT / 'public/data/doors.json').read_text())
    scenes = json.loads((ROOT / 'public/data/scenes.json').read_text())
    johto = next(c for c in scenes['cenas'] if c['id'] == 2000001)
    nomes = {a['id']: a['nome'] for a in johto['areas']}
    areas = [a['id'] for a in johto['areas']]

    g = load_grid()
    h, w = g.shape

    # Buildings: centred between their x edges, front face on the front edge.
    # face 'w' (Der House 4) opens on its west side instead: ex0 is that edge's
    # tile and ex1 is the row the opening is centred on.
    blds = []
    sites = [(tid, T['buildings']) for tid, T in TOWNS.items()] + list(EAST_BUILDINGS.items())
    for tid, buildings in sites:
        for spec in buildings:
            n, ex0, ex1, front, door = spec[:5]
            face = spec[5] if len(spec) > 5 else 's'
            x0, z0, x1, z1 = SIZES[n]
            if face == 'w':
                ox = x0 - (ex0 - OX)
                oz = (ex1 - OY) - (z0 + z1) / 2
                bx, fz = ox - (x0 + x1) / 2, oz + (z0 + z1) / 2
            else:
                bx, fz = world((ex0 + ex1) / 2, front)
                ox, oz = bx + (x0 + x1) / 2, fz - z1 - 0.05
            rect = (ox - x1, oz + z0, ox - x0, oz + z1)
            # HGSS draws some blocks overlapping in 2.5D; keep the first of any pair that collides.
            if any(r[0] < rect[2] - 0.5 and rect[0] < r[2] - 0.5 and r[1] < rect[3] - 0.5 and rect[1] < r[3] - 0.5
                   for r in (b['rect'] for b in blds)):
                print('skipped overlapping building', n, 'at', (ex0, front))
                continue
            blds.append({'tid': tid, 'n': n, 'door': door, 'face': face, 'x': ox, 'z': oz,
                         'dx': bx, 'fz': fz, 'rect': rect, 'x0': x0, 'z0': z0, 'z1': z1})

    # Footprints and a 2 m apron outside each door must be open floor.
    occupied = np.zeros((h, w), bool)
    for b in blds:
        rx0, rz0, rx1, rz1 = b['rect']
        if b['face'] == 'w':
            rx1 += 2
        else:
            rz1 += 2
        tx0, ty0 = to_tile(rx1, rz0)
        tx1, ty1 = to_tile(rx0, rz1)
        for ty in range(int(math.floor(ty0)), int(math.ceil(ty1))):
            for tx in range(int(math.floor(tx0)), int(math.ceil(tx1))):
                if 0 <= tx < w and 0 <= ty < h:
                    occupied[ty, tx] = True
                    if g[ty, tx] not in 'DCKBGX':
                        g[ty, tx] = 'C'

    bld_mask = np.zeros((h, w), bool)
    for b in blds:
        rx0, rz0, rx1, rz1 = b['rect']
        tx0, ty0 = to_tile(rx1, rz0)
        tx1, ty1 = to_tile(rx0, rz1)
        bld_mask[max(0, int(ty0)):int(math.ceil(ty1)), max(0, int(tx0)):int(math.ceil(tx1))] = True

    town_box = {tid: T['box'] for tid, T in TOWNS.items()}

    def in_town(tx, ty):
        return any(x0 <= tx < x1 and y0 <= ty < y1 for (x0, y0, x1, y1) in town_box.values())

    objetos = []
    seen = set()

    def add(n, x, z, a=0, y=0):
        k = (n, round(x * 2), round(z * 2), round(y, 1))
        if k in seen:
            return
        seen.add(k)
        o = {'n': n, 'x': round(float(x), 2), 'y': round(float(y), 2), 'z': round(float(z), 2)}
        if a:
            o['a'] = round(a, 3)
        objetos.append(o)

    # Link every region, then check against the real tree and rock blocks (which can
    # cover a walkable tile beside them) and link again until nothing is cut off.
    carved = np.zeros((h, w), bool)
    solid = np.zeros((h, w), bool)
    for _ in range(8):
        carved |= link_regions(g, bld_mask, solid)
        rocks, rock_tile, trees, tree_tile = solids(g, occupied, carved)
        walk = (np.isin(g, list(FLOOR_CLS)) | (g == 'M')) & ~tree_tile & ~rock_tile & ~bld_mask
        comp, sizes_arr = label(walk)
        home = comp[312, 624]
        skip = door_only(comp)
        if not any(s >= 200 and i != home and i not in skip for i, s in enumerate(sizes_arr[:-1])):
            break
        solid = tree_tile | rock_tile

    depth_of = {(bx, by): d for bx, by, d in rocks}
    # Which layers actually get a block. A peak skips the layers every neighbour
    # already covers, so the neighbour test below has to use this set, not depth.
    layers_at = {}
    placed = []
    for bx, by, depth in rocks:
        peak = next((m for (x0, y0, x1, y1), m in PEAKS.items()
                     if x0 <= bx * 2 < x1 and y0 <= by * 2 < y1), None)
        if peak is None:
            ks = range(min(4, depth))
        else:
            top = min(peak, depth)
            low = min(min(min(peak, depth_of.get((bx + dx, by + dy), 0))
                          for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))), top - 1)
            ks = range(low, top)
        have = layers_at.setdefault((bx, by), set())
        for k in ks:
            have.add(k)
            placed.append((bx, by, k))
    for bx, by, k in placed:
        def on(dx, dy, k=k):
            return k in layers_at.get((bx + dx, by + dy), ())
        # Tile +x is world east and tile +y is south, which is the neighbour
        # order rock_choice expects.
        name, cap = rock_choice(on(0, -1), on(1, 0), on(0, 1), on(-1, 0),
                                on(1, -1), on(1, 1), on(-1, 1), on(-1, -1))
        x, z = world(bx * 2 + 1, by * 2 + 1)
        add(name, x, z, y=k * ROCK_H)
        if cap and (k + 1) not in layers_at.get((bx, by), ()):
            add(ROCK_CAP, x, z, y=k * ROCK_H + CAP_LIFT)
    # A mountain tile the rock blocks missed. One that touches a rock is the lip
    # of that cliff. The rest was a thin ledge drawn where the path should be.
    pad = np.pad(rock_tile, 1)
    touch = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    loose = (g == 'M') & ~rock_tile
    g[loose & touch] = 'L'
    g[loose & ~touch] = 'D'
    for tx, ty, n in trees:
        x, z = world(tx + 1, ty + 1)
        add(n, x, z - 0.1 if n != 'tree' else z)

    agua_cells, grama_cells = [], []
    layer = Counter()
    for (ty, tx), c in np.ndenumerate(g):
        if c == '.' or rock_tile[ty, tx]:
            continue
        layer[c] += 1
        x, z = world(tx + 0.5, ty + 0.5)
        if c in 'WR':
            agua_cells.append((x, z))
            if c == 'R':
                add('sea_rock', x, z)
            continue
        if c in FLOOR_OF:
            opts = FLOOR_OF[c]
            if c in BASE_OF:
                add(BASE_OF[c], x, z)
            add(opts[hsh(tx, ty) % len(opts)], x, z)
            continue
        if c in 'SO':
            add('sink_sand_ground_001', x, z)
        else:
            add(GRASS_MIX[hsh(tx, ty, 1) % len(GRASS_MIX)], x, z)
        if c == 'T' and not occupied[ty, tx]:
            add('sm_001_gimgrass_03', x, z)
            grama_cells.append((x, z))
        elif c == 'G' and not occupied[ty, tx] and not in_town(tx, ty) and hsh(tx, ty, 3) % 23 == 0:
            add(GRASS_DECO[hsh(tx, ty, 4) % len(GRASS_DECO)], x, z)

    for b in blds:
        add(b['n'], b['x'], b['z'])
        if b['n'] in GYMS:
            rx0, _, rx1, _ = b['rect']
            for sx in (rx0 - 0.7, rx1 + 0.7):
                add(STATUE, sx, b['fz'] + 0.8)
    for T in TOWNS.values():
        for n, tx, ty in T.get('props', []):
            add(n, *world(tx, ty))
    for n, tx, ty in EAST_PROPS:
        add(n, *world(tx, ty))

    # Area boxes in tiles: towns, landmarks, then routes grown over every land tile.
    route_rect = {rid: list(r) for rid, r in ROUTES.items()}
    fixed = [r for r in town_box.values()] + [r for _, r in LANDMARKS.values()]
    covered = np.zeros((h, w), bool)
    for (x0, y0, x1, y1) in fixed + [tuple(r) for r in route_rect.values()]:
        covered[y0:y1, x0:x1] = True
    grown = 0
    for ty, tx in zip(*np.nonzero((g != '.') & ~covered)):
        best, bid = 1e18, None
        east = tx >= EAST_CARVE[2]
        for rid, (x0, y0, x1, y1) in route_rect.items():
            if (rid in EAST_ROUTES) != east:
                continue
            dx = max(x0 - tx, 0, tx - (x1 - 1))
            dy = max(y0 - ty, 0, ty - (y1 - 1))
            if dx * dx + dy * dy < best:
                best, bid = dx * dx + dy * dy, rid
        r = route_rect[bid]
        tx, ty = int(tx), int(ty)
        r[0], r[1], r[2], r[3] = min(r[0], tx), min(r[1], ty), max(r[2], tx + 1), max(r[3], ty + 1)
        grown += 1

    def box_of(rect, aid):
        x0, y0, x1, y1 = rect
        ax0, az0 = world(x0, y0)
        ax1, az1 = world(x1, y1)
        return {'a': aid, 'x': round((ax0 + ax1) / 2, 1), 'y': 0, 'z': round((az0 + az1) / 2, 1),
                'sx': round(abs(ax0 - ax1), 1), 'sy': 8, 'sz': round(abs(az1 - az0), 1)}

    caixas = []
    for aid in areas:
        if aid in town_box:
            caixas.append(box_of(town_box[aid], aid))
        elif aid in LANDMARKS:
            caixas.append(box_of(LANDMARKS[aid][1], aid))
    for aid in sorted(areas, key=lambda a: list(EAST_ROUTES).index(a) if a in EAST_ROUTES else len(EAST_ROUTES)):
        if aid in route_rect:
            caixas.append(box_of(route_rect[aid], aid))
    box_by_id = {c['a']: c for c in caixas}

    def area_at(x, z, fallback=2229):
        for c in caixas:
            if abs(x - c['x']) <= c['sx'] / 2 and abs(z - c['z']) <= c['sz'] / 2:
                return c['a']
        return fallback

    agua = [{'tipo': 33, 'x': x, 'y': 0, 'z': z, 'a': area_at(x, z)} for (x, z) in agua_cells]
    grama = []
    for (x, z) in grama_cells:
        a = area_at(x, z)
        grama.append({'cfg': a * 100 + 1, 'tipo': 41, 'x': x, 'y': 0, 'z': z, 'a': a})

    # Open floor (no tree, rock or building) in big connected regions, for door points.
    walk = np.isin(g, list(FLOOR_CLS)) & ~tree_tile & ~rock_tile & ~bld_mask
    comp, sizes_arr = label(walk)
    open_floor = walk & (sizes_arr[comp] >= 300)

    def snap_floor(x, z):
        ftx, fty = to_tile(x, z)
        itx, ity = int(math.floor(ftx)), int(math.floor(fty))
        if 0 <= itx < w and 0 <= ity < h and open_floor[ity, itx]:
            return world(itx + 0.5, ity + 0.5)
        for rad in range(1, 80):
            best = None
            for yy in range(ity - rad, ity + rad + 1):
                for xx in range(itx - rad, itx + rad + 1):
                    if max(abs(xx - itx), abs(yy - ity)) != rad:
                        continue
                    if 0 <= xx < w and 0 <= yy < h and open_floor[yy, xx]:
                        d = (xx + 0.5 - ftx) ** 2 + (yy + 0.5 - fty) ** 2
                        if best is None or d < best[0]:
                            best = (d, xx, yy)
            if best:
                return world(best[1] + 0.5, best[2] + 0.5)
        return x, z

    by_area = defaultdict(list)
    for cid, p in doors.items():
        if p.get('c') == 2000001:
            by_area[p['a']].append({'cfg': int(cid), 't': p['t']})
    known = {int(k) for k in doors}

    used = set()
    npcs = []

    def put(cfg, modelo, x, z, a, snap=False):
        if not cfg or cfg in used:
            return
        if snap:
            x, z = snap_floor(x, z)
        used.add(cfg)
        npcs.append({'cfg': cfg, 'modelo': modelo, 'face': 0,
                     'x': round(x, 2), 'y': 0, 'z': round(z, 2), 'a': a})

    # Door just inside the opening, arrival on the step outside.
    for b in blds:
        if not b['door']:
            continue
        if b['face'] == 'w':
            midz = (b['z0'] + b['z1']) / 2
            put(b['door'], 162, b['x'] - (b['x0'] + 1.3), b['z'] + midz, b['tid'])
            if b['door'] + 1000000 in known:
                put(b['door'] + 1000000, 171, b['x'] - (b['x0'] - 1.6), b['z'] + midz, b['tid'])
        else:
            put(b['door'], 162, b['dx'], b['fz'] - 0.6, b['tid'])
            if b['door'] + 1000000 in known:
                put(b['door'] + 1000000, 171, b['dx'], b['fz'] + 1.2, b['tid'])

    put(7210199, 171, *world(624.5, 312.5), 2101, snap=True)          # New Bark spawn
    for tid in TOWNS:
        for p in by_area[tid]:
            if p['t'] == 7 and str(p['cfg']).endswith('99'):
                c = box_by_id[tid]
                put(p['cfg'], 171, c['x'], c['z'], tid, snap=True)

    for cfg, modelo, tx, ty in EAST_POINTS:
        put(cfg, modelo, *world(tx, ty), doors[str(cfg)]['a'])

    for box in caixas:
        leftover = [p for p in by_area[box['a']] if p['cfg'] not in used]
        for i, pt in enumerate(leftover):
            ang = (i / max(1, len(leftover))) * math.tau
            put(pt['cfg'], 162 if pt['t'] == 6 else 171,
                box['x'] + math.cos(ang) * 6, box['z'] + math.sin(ang) * 6, box['a'], snap=True)

    xs = [o['x'] for o in objetos]
    zs = [o['z'] for o in objetos]
    bbox = {'x0': min(xs) - 1, 'x1': max(xs) + 1, 'z0': min(zs) - 1, 'z1': max(zs) + 1}
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
          len(npcs), 'door points', len(blds), 'buildings')
    print('tiles by layer', dict(layer))
    print('top prefabs', names.most_common(14))
    print('route boxes grown for', grown, 'tiles; bbox', bbox, round(OUT.stat().st_size / 1e6, 2), 'MB')
    home = comp[312, 624]
    for tid, T in TOWNS.items():
        x0, y0, x1, y1 = T['box']
        linked = bool((comp[y0:y1, x0:x1] == home).any())
        print(tid, T['name'], 'buildings', sum(1 for b in blds if b['tid'] == tid),
              'of', len(T['buildings']), 'walkable from New Bark' if linked else 'NOT LINKED')
    for name, (tx, ty) in CHECKS.items():
        print(name, 'walkable from New Bark' if comp[ty, tx] == home else 'NOT LINKED')
    gate = comp[151, 760]
    for name, (tx, ty) in DOOR_CHECKS.items():
        print(name, 'walkable from the Connection Center west door' if comp[ty, tx] == gate >= 0 else 'NOT LINKED',
              '(and not by land)' if comp[ty, tx] != home else 'LEAKS TO NEW BARK BY LAND')


if __name__ == '__main__':
    main()
