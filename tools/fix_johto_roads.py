#!/usr/bin/env python3
"""Turn Johto's cliff-textured paths into flat dirt tiles.

floor_1 and floor_w share the cliff decal, so dirt, paving, and bridges
were drawn as ledges. tiles_n is the flat path tile. A floor piece that
sits on a mountain cell touching a placed rock stays floor_1: that is the
real cliff lip. Coordinates are copied through unchanged.

Run once. A second run finds the path tiles already in place and stops.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from make_johto_hgss import OX, OY, hsh, load_grid

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'public' / 'data' / '2000001.json'
FLOOR = re.compile(
    r'\{"n":"(floor_1|floor_w)","x":(-?\d+(?:\.\d+)?),"y":(-?\d+(?:\.\d+)?),"z":(-?\d+(?:\.\d+)?)\}'
)


def rock_tiles(raw, shape):
    """Tiles covered by a placed rock block. Caps share the block's footprint."""
    tiles = __import__('numpy').zeros(shape, bool)
    for m in re.finditer(
        r'\{"n":"(rock_face_g_[^"]+|rock_ground_s)","x":(-?\d+(?:\.\d+)?),"y":(-?\d+(?:\.\d+)?),"z":(-?\d+(?:\.\d+)?)\}',
        raw,
    ):
        tx = OX - float(m.group(2))
        ty = OY + float(m.group(4))
        bx = int(round((tx - 1) / 2))
        by = int(round((ty - 1) / 2))
        for dy in (0, 1):
            for dx in (0, 1):
                y, x = by * 2 + dy, bx * 2 + dx
                if 0 <= y < shape[0] and 0 <= x < shape[1]:
                    tiles[y, x] = True
    return tiles


def lip_at(grid, rocks, tx, ty):
    if not (0 <= ty < grid.shape[0] and 0 <= tx < grid.shape[1]):
        return False
    if grid[ty, tx] != 'M':
        return False
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ny, nx = ty + dy, tx + dx
        if 0 <= ny < grid.shape[0] and 0 <= nx < grid.shape[1] and rocks[ny, nx]:
            return True
    return False


def tile_of(x, z):
    return int(round(OX - float(x) - 0.5)), int(round(OY + float(z) - 0.5))


def main():
    raw = MAP.read_text()
    if raw.count('"n":"tiles_n_') > 100:
        sys.exit('2000001.json already has dirt path tiles; refusing to patch twice')
    matches = list(FLOOR.finditer(raw))
    if len(matches) < 5000:
        sys.exit(f'expected the cliff-textured paths, found {len(matches)} floor pieces')
    grid = load_grid()
    rocks = rock_tiles(raw, grid.shape)
    if int(rocks.sum()) < 8000:
        sys.exit(f'rock footprint looks wrong ({int(rocks.sum())} tiles)')
    used = set()
    lips = 0
    parts = []
    last = 0
    for m in matches:
        tx, ty = tile_of(m.group(2), m.group(4))
        if lip_at(grid, rocks, tx, ty):
            name = 'floor_1'
            lips += 1
        else:
            name = 'tiles_n_%d' % (hsh(tx, ty) % 4 + 1)
        used.add(name)
        parts.append(raw[last:m.start()])
        parts.append('{"n":"%s","x":%s,"y":%s,"z":%s}' % (name, m.group(2), m.group(3), m.group(4)))
        last = m.end()
    parts.append(raw[last:])
    text = ''.join(parts)
    if lips < 300 or lips > 500:
        sys.exit(f'cliff-lip count {lips} is outside the expected band; map left unchanged')
    pref = re.search(r'"prefabs":\[.*?\]', text)
    if not pref:
        sys.exit('no prefabs list')
    names = set(json.loads(pref.group(0)[len('"prefabs":'):]))
    if '"n":"floor_w"' not in text:
        names.discard('floor_w')
    names |= used
    text = text[:pref.start()] + '"prefabs":' + json.dumps(sorted(names), separators=(',', ':')) + text[pref.end():]
    MAP.write_text(text)
    print(f'retiled {len(matches) - lips} paths, kept {lips} cliff lips')


if __name__ == '__main__':
    main()
