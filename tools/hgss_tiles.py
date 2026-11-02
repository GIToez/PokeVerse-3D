#!/usr/bin/env python3
"""Classify every 16 px tile of the HGSS Johto stitch into a ground layer.

tools/hgss_world.png (not committed, 10560x6080 RGBA) is the HGSS overworld
the user sent: 660x380 tiles of 16 px, transparent outside the map. The 400
most frequent tile images (90% of the map) are labelled by hand below, in
frequency order; every other tile takes the label of the nearest labelled
tile. The result is written to tools/johto_hgss_tiles.txt, one character
per tile, which tools/make_johto_hgss.py builds the 3D map from.

Layers:
  .  void          W  water         R  sea rock       M  mountain / cliff
  G  grass         T  tall grass    F  green tree     S  snowy tree
  A  autumn tree   P  pink tree     D  dirt path      C  stone paving
  N  sand          O  snow ground   K  bridge / planks
  B  building      X  fence, sign or other prop on grass
"""
from __future__ import annotations

import collections
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'tools/hgss_world.png'
OUT = ROOT / 'tools/johto_hgss_tiles.txt'
H, W, TS = 380, 660, 16

# Labels of the 400 most frequent tile images, rank 0 first, 50 per row.
RANKED = """
W G F F F F F W M F  F N F D F O S D F T  M M M F F M R F F K  S S M M S F G G F F  G F F M F F G F G T
C M D M M A M M M M  K M W X T T M W M M  F D F F T G C W M N  C W N D S C M W M P  A W W W F F F M F M
F A A G F W A M G W  G D S P M M P P W M  M M G W F D W W F F  W F G W W M W B B G  D M O D M F W M M O
C M D C N F B C N O  W C M K S O W A A N  S A W G M G K W O W  G D F S S N A T C W  G W M W M B W M A A
N W W W O T W K W M  T F G O T G M D O B  B B B B B W W G B B  W D M B W C M G B G  G G M M D M M W G M
G C C B W W N M B F  T F B D W G D B W G  B D G M B B G M F N  M F F K W M B M W B  P A M G F K B M M M
G A A A D C A G G T  W B N O M N G B O F  M O O N F B B M K B  B K K K N M N G G C  M O P P F M M A A A
A W M O O M W B M M  A M M O F F B P G N  M F A A F G W F O F  F O D C B B B F B F  F O B B F G C F F C
""".split()


def features(t):
    a = t.astype(float)
    small = a.reshape(4, 4, 4, 4, 3).mean(axis=(1, 3)).ravel()
    return np.concatenate([small, np.sort(a.mean(2).ravel())[::16] * 0.5])


def main():
    Image.MAX_IMAGE_PIXELS = None
    rgba = np.asarray(Image.open(SRC).convert('RGBA'))
    tiles = rgba[:H * TS, :W * TS].reshape(H, TS, W, TS, 4).transpose(0, 2, 1, 3, 4)
    ids = np.full((H, W), -1, np.int32)
    table, count = {}, collections.Counter()
    for y in range(H):
        for x in range(W):
            t = tiles[y, x]
            if (t[..., 3] > 0).mean() < 0.5:
                continue
            i = table.setdefault(t[..., :3].tobytes(), len(table))
            ids[y, x] = i
            count[i] += 1
    image = {i: np.frombuffer(k, np.uint8).reshape(TS, TS, 3) for k, i in table.items()}
    ranked = [i for i, _ in count.most_common(len(RANKED))]
    label = dict(zip(ranked, RANKED))
    ref = np.array([features(image[i]) for i in ranked])
    for i in image:
        if i not in label:
            label[i] = RANKED[int(((ref - features(image[i])) ** 2).sum(1).argmin())]
    rows = [''.join(label[i] if i >= 0 else '.' for i in row) for row in ids]
    OUT.write_text('\n'.join(rows) + '\n')
    print('tiles', sum(count.values()), 'unique', len(table), '->', OUT.name)
    print(collections.Counter(''.join(rows)).most_common())


if __name__ == '__main__':
    main()
