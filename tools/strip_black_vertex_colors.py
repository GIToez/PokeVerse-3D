# PokeFable's plot / guild-base buildings (T_M_JY_*) carry COLOR_0 as a 0/1 mask (wind, sway) that their shader ignores; three.js
# multiplies the base color by it, so most of the building renders black (the Guild Hall's logs). Nov 7.
#   python3 tools/strip_black_vertex_colors.py --lib scenery/lib/t_m_jy_*.glb      drop COLOR_0 from every primitive of these prefabs
#   python3 tools/strip_black_vertex_colors.py --detach t_m_jy scenery/4700001.glb  a map's own lib:t_m_jy_* copies leave its Mapa node,
#                                                                                    so the scene loads the fixed ones from scenery/lib
import json, struct, sys
def ler(f):
    b = open(f, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + n]), b[20 + n:]
def gravar(f, j, resto):
    js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    out = bytearray(b'glTF' + struct.pack('<II', 2, 0)) + struct.pack('<I', len(js)) + b'JSON' + js + resto
    struct.pack_into('<I', out, 8, len(out)); open(f, 'wb').write(out)
args = sys.argv[1:]
if args[0] == '--lib':
    for f in args[1:]:
        j, r = ler(f); n = 0
        for m in j.get('meshes', []):
            for p in m['primitives']:
                if p['attributes'].pop('COLOR_0', None) is not None: n += 1
        if n: gravar(f, j, r); print(f, n)
elif args[0] == '--detach':
    pre = args[1].lower()
    for f in args[2:]:
        j, r = ler(f)
        mapa = next((i for i, x in enumerate(j['nodes']) if x.get('name') == 'Mapa'), None)
        if mapa is None: continue
        antes = list(j['nodes'][mapa].get('children', []))
        j['nodes'][mapa]['children'] = [c for c in antes if not (j['nodes'][c].get('name') or '').lower().replace('lib:', '').startswith(pre)]
        if len(antes) != len(j['nodes'][mapa]['children']): gravar(f, j, r); print(f, len(antes) - len(j['nodes'][mapa]['children']), 'detached')
