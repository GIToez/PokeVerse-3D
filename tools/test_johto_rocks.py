#!/usr/bin/env python3
"""The Johto mountains keep their spots and use the piece that matches the neighbours."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from johto_rock_prefab import CAP_LIFT, ROCK_CAP, ROCK_FILL, rock_choice

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'public' / 'data' / '2000001.json'

ROCKS = {
    'rock_face_g_1_s', 'rock_face_g_2_s', 'rock_face_g_3_s', 'rock_face_g_4_s',
    'rock_face_g_z_1_s_c_1_s', 'rock_face_g_z_2_s_b_s', 'rock_face_g_z_3_s_b_s',
    'rock_face_g_z_4_s_b_s', 'rock_face_g_z_1_n_s', 'rock_face_g_z_2_n_s',
    'rock_face_g_z_3_n_s', 'rock_face_g_z_4_n_s', ROCK_FILL,
}


def q(v):
    return round(float(v), 2)


def check_choice():
    assert rock_choice(True, False, False, True)[0] == 'rock_face_g_1_s'   # SE corner, the old stamp
    assert rock_choice(True, True, False, False)[0] == 'rock_face_g_2_s'
    assert rock_choice(False, True, True, False)[0] == 'rock_face_g_3_s'
    assert rock_choice(False, False, True, True)[0] == 'rock_face_g_4_s'
    assert rock_choice(True, False, True, True)[0] == 'rock_face_g_z_1_s_c_1_s'  # cliff east
    assert rock_choice(True, True, False, True)[0] == 'rock_face_g_z_2_s_b_s'    # cliff south
    assert rock_choice(True, True, True, False)[0] == 'rock_face_g_z_3_s_b_s'    # cliff west
    assert rock_choice(False, True, True, True)[0] == 'rock_face_g_z_4_s_b_s'    # cliff north
    assert rock_choice(True, True, True, True, se=False, ne=True, sw=True, nw=True)[0] == 'rock_face_g_z_1_n_s'
    name, cap = rock_choice(True, True, True, True, True, True, True, True)
    assert name == ROCK_FILL and cap
    assert rock_choice(False, False, False, False) == ('rock_face_g_1_s', False)


def check_map():
    data = json.loads(MAP.read_text())
    blocks = [o for o in data['objetos'] if o['n'] in ROCKS or o['n'].startswith('rock_face_g')]
    caps = {(q(o['x']), q(o['y']), q(o['z'])) for o in data['objetos'] if o['n'] == ROCK_CAP}
    occ = {(q(o['x']), q(o['y']), q(o['z'])) for o in blocks}
    assert len(occ) == len(blocks), 'two rock blocks share a cell'
    counts = Counter()
    capped = 0
    for o in blocks:
        x, y, z = q(o['x']), q(o['y']), q(o['z'])
        def on(dx, dy, x=x, y=y, z=z):
            return (q(x + dx), y, q(z + dy)) in occ
        name, cap = rock_choice(
            on(0, -2), on(-2, 0), on(0, 2), on(2, 0),
            on(-2, -2), on(-2, 2), on(2, 2), on(2, -2),
        )
        assert o['n'] == name, f'{x,y,z} is {o["n"]}, neighbour mask wants {name}'
        if cap and (x, q(y + 1.02), z) not in occ:
            assert (x, q(y + CAP_LIFT), z) in caps, f'missing cap at {x, y, z}'
            capped += 1
        counts[name] += 1
    # The old stamp was the SE corner on all 3058 blocks. A real mountain uses the other pieces.
    assert counts['rock_face_g_1_s'] < len(blocks) / 5, counts
    assert counts['rock_face_g_z_2_s_b_s'] > 100
    assert counts['rock_face_g_z_4_s_b_s'] > 50
    # Only the top of a column is visible, so buried interiors stay a solid block.
    assert capped > 50
    print('blocks', len(blocks), 'caps on tops', capped)
    print(counts.most_common())


if __name__ == '__main__':
    check_choice()
    check_map()
    print('ok')
    sys.exit(0)
