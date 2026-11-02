#!/usr/bin/env python3
"""Write scenery/prop/library_extra.glb: library prefabs that kanto.glb lacks.

The game places library prefabs by translation only (no per-object rotation),
so a turned copy of a prefab has to be its own library piece. This file holds:

  lib:sm_c_der_house4   sm_c_der_house2 turned 180 degrees (entrance faces -x, west)
  lib:sm_c_der_house5   sm_c_der_house3 turned 180 degrees (entrance faces +z, south)

Der House 2 and 3 are Kanto's halves of the Pokémon League reception gate
(the Connection Center); 4 and 5 are the same gate's entrances on the Johto
side. Both reuse the one mesh (polySurface5) the originals share, so the
pieces come out under a "Mapa" node exactly like kanto.glb's library, and the
game and the 3D editor merge them into the same prefab table.

Reads public/scenery/kanto.glb (not committed); run from the repo root:
    python3 tools/make_der_house_gates.py
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public/scenery/kanto.glb'
OUTS = [ROOT / 'scenery/prop/library_extra.glb', ROOT / 'public/scenery/prop/library_extra.glb']

# new prefab -> (source prefab, extra turn about +Y in degrees)
TURNED = {'sm_c_der_house4': ('sm_c_der_house2', 180), 'sm_c_der_house5': ('sm_c_der_house3', 180)}


def read_glb(path):
    b = path.read_bytes()
    jlen = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + blen]


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]


def main():
    src, binary = read_glb(SRC)
    nodes = src['nodes']
    out = {'asset': {'version': '2.0', 'generator': 'tools/make_der_house_gates.py'},
           'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'Mapa', 'children': []}],
           'meshes': [], 'accessors': [], 'bufferViews': [], 'materials': [], 'textures': [],
           'images': [], 'samplers': [], 'buffers': []}
    if src.get('extensionsUsed'):
        out['extensionsUsed'] = src['extensionsUsed']
    blob = bytearray()
    remap = {k: {} for k in ('meshes', 'accessors', 'bufferViews', 'materials', 'textures', 'images', 'samplers')}

    def chunk(view):
        while len(blob) % 4:
            blob.append(0)
        bv = dict(src['bufferViews'][view])
        start = bv.get('byteOffset', 0)
        data = binary[start:start + bv['byteLength']]
        bv['byteOffset'] = len(blob)
        bv['buffer'] = 0
        blob.extend(data)
        return bv

    def take(kind, i, build):
        if i not in remap[kind]:
            remap[kind][i] = len(out[kind])
            out[kind].append(None)
            out[kind][remap[kind][i]] = build(i)
        return remap[kind][i]

    def bview(i):
        return chunk(i)

    def accessor(i):
        a = dict(src['accessors'][i])
        a['bufferView'] = take('bufferViews', a['bufferView'], bview)
        return a

    def image(i):
        im = dict(src['images'][i])
        im['bufferView'] = take('bufferViews', im['bufferView'], bview)
        return im

    def texture(i):
        t = dict(src['textures'][i])
        t['source'] = take('images', t['source'], image)
        if 'sampler' in t:
            t['sampler'] = take('samplers', t['sampler'], lambda s: dict(src['samplers'][s]))
        return t

    def material(i):
        m = json.loads(json.dumps(src['materials'][i]))
        for key in ('baseColorTexture', 'metallicRoughnessTexture'):
            tex = m.get('pbrMetallicRoughness', {}).get(key)
            if tex:
                tex['index'] = take('textures', tex['index'], texture)
        for key in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
            if key in m:
                m[key]['index'] = take('textures', m[key]['index'], texture)
        return m

    def mesh(i):
        me = json.loads(json.dumps(src['meshes'][i]))
        for p in me['primitives']:
            p['attributes'] = {k: take('accessors', v, accessor) for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = take('accessors', p['indices'], accessor)
            if 'material' in p:
                p['material'] = take('materials', p['material'], material)
        return me

    def copy_tree(i, turn=None):
        n = json.loads(json.dumps(nodes[i]))
        if turn is not None:
            rot = n.get('rotation', [0, 0, 0, 1])
            half = math.radians(turn) / 2
            n['rotation'] = [round(v, 7) for v in quat_mul([0, math.sin(half), 0, math.cos(half)], rot)]
            if 'translation' in n:
                x, y, z = n['translation']
                c, s = math.cos(math.radians(turn)), math.sin(math.radians(turn))
                n['translation'] = [c * x + s * z, y, -s * x + c * z]
        if 'mesh' in n:
            n['mesh'] = take('meshes', n['mesh'], mesh)
        kids = n.pop('children', [])
        idx = len(out['nodes'])
        out['nodes'].append(n)
        if kids:
            n['children'] = [copy_tree(c, turn) for c in kids]
        return idx

    for name, (source, turn) in TURNED.items():
        lib = next(i for i, n in enumerate(nodes) if n.get('name') == 'lib:' + source)
        root = {'name': 'lib:' + name, 'children': []}
        ridx = len(out['nodes'])
        out['nodes'].append(root)
        root['children'] = [copy_tree(c, turn) for c in nodes[lib].get('children', [])]
        out['nodes'][0]['children'].append(ridx)

    for kind in list(out):
        if isinstance(out[kind], list) and not out[kind] and kind not in ('buffers',):
            del out[kind]
    while len(blob) % 4:
        blob.append(0)
    out['buffers'] = [{'byteLength': len(blob)}]
    js = json.dumps(out, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    glb = b''.join([struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)),
                    struct.pack('<II', len(js), 0x4E4F534A), js,
                    struct.pack('<II', len(blob), 0x004E4942), bytes(blob)])
    for path in OUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(glb)
    print('wrote', ', '.join(str(p.relative_to(ROOT)) for p in OUTS), len(glb), 'bytes:', ', '.join(TURNED))


if __name__ == '__main__':
    main()
