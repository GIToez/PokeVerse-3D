#!/usr/bin/env python3
"""Swap Johto's mountain blocks off the one bottom-right corner piece.

public/data/2000001.json was built with every rock block as rock_face_g_1_s.
The blocks stay where they are. This rewrites each block's prefab from the
neighbours at the same height (see johto_rock_prefab.py) and lays a flat
rock_ground_s cap on enclosed tops. The rest of the file is left byte for
byte, so doors, NPCs, and buildings are untouched.

Run once, from a map that still uses rock_face_g_1_s for every block.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from johto_rock_prefab import CAP_LIFT, ROCK_CAP, rock_choice

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'public' / 'data' / '2000001.json'
ROCK = re.compile(
    r'\{"n":"rock_face_g_1_s","x":(-?\d+(?:\.\d+)?),"y":(-?\d+(?:\.\d+)?),"z":(-?\d+(?:\.\d+)?)\}'
)


def q(v):
    return round(float(v), 2)


def main():
    raw = MAP.read_text()
    if re.search(r'\{"n":"rock_face_g_(?!1_s")', raw):
        sys.exit('2000001.json already has mixed rock pieces; refusing to patch twice')
    matches = list(ROCK.finditer(raw))
    if len(matches) < 1000:
        sys.exit(f'expected the stamped corner field, found {len(matches)} rock_face_g_1_s')
    occ = {(q(m.group(1)), q(m.group(2)), q(m.group(3))) for m in matches}
    caps = []
    used = {'rock_face_g_1_s'}
    parts = []
    last = 0
    changed = 0
    for m in matches:
        x, y, z = q(m.group(1)), q(m.group(2)), q(m.group(3))
        def on(dx, dy, x=x, y=y, z=z):
            return (q(x + dx), y, q(z + dy)) in occ
        # Stored x is mirrored: world east is the smaller json x, world south is +z.
        name, cap = rock_choice(
            on(0, -2), on(-2, 0), on(0, 2), on(2, 0),
            on(-2, -2), on(-2, 2), on(2, 2), on(2, -2),
        )
        used.add(name)
        parts.append(raw[last:m.start()])
        parts.append('{"n":"%s","x":%s,"y":%s,"z":%s}' % (name, m.group(1), m.group(2), m.group(3)))
        last = m.end()
        if name != 'rock_face_g_1_s':
            changed += 1
        if cap and (x, q(y + 1.02), z) not in occ:
            caps.append({'n': ROCK_CAP, 'x': x, 'y': q(y + CAP_LIFT), 'z': z})
            used.add(ROCK_CAP)
    parts.append(raw[last:])
    text = ''.join(parts)
    end = text.find('],"ambiente":')
    if end < 0:
        sys.exit('could not find the end of the objetos array')
    if caps:
        blob = ',' + ','.join(json.dumps(c, separators=(',', ':')) for c in caps)
        text = text[:end] + blob + text[end:]
    pref = re.search(r'"prefabs":\[.*?\]', text)
    if not pref:
        sys.exit('no prefabs list')
    names = sorted(set(json.loads(pref.group(0)[len('"prefabs":'):])) | used)
    text = text[:pref.start()] + '"prefabs":' + json.dumps(names, separators=(',', ':')) + text[pref.end():]
    MAP.write_text(text)
    print(f'rewrote {changed} of {len(matches)} blocks, added {len(caps)} caps')


if __name__ == '__main__':
    main()
