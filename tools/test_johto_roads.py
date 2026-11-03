#!/usr/bin/env python3
"""Johto dirt, paving, and bridges are flat path tiles. Cliff lips stay ledges."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from fix_johto_roads import lip_at, rock_tiles, tile_of
from make_johto_hgss import hsh, load_grid

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'public' / 'data' / '2000001.json'


def main():
    raw = MAP.read_text()
    data = json.loads(raw)
    grid = load_grid()
    rocks = rock_tiles(raw, grid.shape)
    names = Counter(o['n'] for o in data['objetos'])
    assert names['floor_w'] == 0, names['floor_w']
    assert 300 < names['floor_1'] < 500, names['floor_1']
    path = sum(names['tiles_n_%d' % i] for i in range(1, 5))
    assert path > 7000, path
    assert names['floor_1'] + path == 8640, (names['floor_1'], path)
    for o in data['objetos']:
        n = o['n']
        if n not in ('floor_1', 'floor_w') and not n.startswith('tiles_n_'):
            continue
        tx, ty = tile_of(o['x'], o['z'])
        lip = lip_at(grid, rocks, tx, ty)
        if n == 'floor_1':
            assert lip, (o['x'], o['z'], tx, ty)
        else:
            assert not lip, (n, o['x'], o['z'])
            assert n == 'tiles_n_%d' % (hsh(tx, ty) % 4 + 1), (n, tx, ty)
    listed = set(data['prefabs'])
    assert 'floor_w' not in listed
    assert 'floor_1' in listed
    for i in range(1, 5):
        assert 'tiles_n_%d' % i in listed
    print('paths', path, 'lips', names['floor_1'], 'variants',
          [names['tiles_n_%d' % i] for i in range(1, 5)])
    print('ok')


if __name__ == '__main__':
    main()
    sys.exit(0)
