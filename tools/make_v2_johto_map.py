"""Build the Johto region for the v2 world map (upcoming/map_ui.mjs).

Reads our baked Johto photo (ui/minimapa_johto.jpg + .json), the Johto scene
data (public/data/2000001.json) and the Johto markers, and writes:
  ui/amanda/mapa/johto/dados.js     region data in the same shape as Kanto's
  ui/amanda/mapa/johto/foto/i_j.webp 128 m tiles
  public/data/mapa_pontos.json      adds the `johto` block (area anchors)

The v2 map uses world coordinates, which are the scene data's x mirrored
(the game renders with flipX = -1), the same as the baked photo.
"""
import json
import math
import os
import re

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
P = lambda *a: os.path.join(ROOT, *a)

LADRILHO, PEDACO, ESC = 128, 32, 4

foto = Image.open(P('ui/minimapa_johto.jpg')).convert('RGBA')
# The baked photo's open sea is one flat colour; clear it so the map's own animated water shows, like Kanto's.
MAR = (121, 183, 224)
px = np.asarray(foto).copy()
perto = (np.abs(px[..., :3].astype(int) - MAR).sum(axis=2) <= 18)
px[perto, 3] = 0
foto = Image.fromarray(px, 'RGBA')
regua_foto = json.load(open(P('ui/minimapa_johto.json')))
cena = json.load(open(P('public/data/2000001.json')))
marcas = json.load(open(P('public/data/johto_map_markers.json')))['marcadores']

x0 = math.floor(regua_foto['x0'])
z0 = math.floor(regua_foto['z0'])
w_m = regua_foto['w'] / regua_foto['esc']
h_m = regua_foto['h'] / regua_foto['esc']
nx = math.ceil((regua_foto['x0'] + w_m - x0) / LADRILHO)
ny = math.ceil((regua_foto['z0'] + h_m - z0) / LADRILHO)

pasta = P('ui/amanda/mapa/johto/foto')
os.makedirs(pasta, exist_ok=True)
for j in range(ny):
    for i in range(nx):
        L = LADRILHO * ESC
        px = (x0 + i * LADRILHO - regua_foto['x0']) * ESC
        pz = (z0 + j * LADRILHO - regua_foto['z0']) * ESC
        t = Image.new('RGBA', (L, L), (0, 0, 0, 0))
        t.paste(foto.crop((round(px), round(pz), round(px) + L, round(pz) + L)), (0, 0))
        t.save(os.path.join(pasta, f'{i}_{j}.webp'), quality=86)


def tipo_de(nome):
    if re.match(r'^Route \d+', nome):
        return 'rota'
    if re.search(r'\b(Town|City)$', nome):
        return 'cidade'
    return 'lugar'


def curto(nome):
    return re.sub(r'\s+(Town|City)$', '', nome)


caixas = {}
for c in cena.get('caixas', []):
    if c.get('sx', 0) > 0 and c.get('sz', 0) > 0:
        caixas.setdefault(c['a'], []).append(c)

areas = []
for a, lista in sorted(caixas.items()):
    nome = cena.get('nomes', {}).get(str(a))
    if not nome:
        continue
    xs0 = min(-c['x'] - c['sx'] / 2 for c in lista)
    xs1 = max(-c['x'] + c['sx'] / 2 for c in lista)
    zs0 = min(c['z'] - c['sz'] / 2 for c in lista)
    zs1 = max(c['z'] + c['sz'] / 2 for c in lista)
    t = tipo_de(nome)
    n = {'pt': nome, 'en': nome, 'es': nome}
    c = {k: curto(nome) for k in ('pt', 'en', 'es')} if t == 'cidade' else n
    areas.append({
        'id': a, 'tipo': t, 'nome': n, 'curto': c,
        'rect': [round(xs0, 1), round(zs0, 1), round(xs1, 1), round(zs1, 1)],
        'ancora': [round((xs0 + xs1) / 2, 1), round((zs0 + zs1) / 2, 1)],
        'deitada': t == 'rota' and (xs1 - xs0) > (zs1 - zs0) * 1.6,
        'aParte': False,
    })

predios = [{'f': m['tipo'], 'x': round(-m['x'], 1), 'z': round(m['z'], 1), 'w': 9, 'h': 7}
           for m in marcas if m.get('tipo') in ('centro', 'loja', 'ginasio')]

dados = {
    'id': 'johto', 'pasta': 'johto/',
    'titulo': {'pt': 'JOHTO', 'en': 'JOHTO', 'es': 'JOHTO'},
    'balsas': [],
    'regua': {'x0': x0, 'z0': z0, 'w': nx * LADRILHO, 'h': ny * LADRILHO, 'ladrilho': LADRILHO,
              'pedaco': PEDACO, 'px': 24, 'nx': nx, 'ny': ny},
    'limites': [round(regua_foto['x0'], 1), round(regua_foto['z0'], 1),
                round(regua_foto['x0'] + w_m, 1), round(regua_foto['z0'] + h_m, 1)],
    'areas': areas, 'entradas': [], 'submapas': [], 'predios': predios, 'alta': [],
}
with open(P('ui/amanda/mapa/johto/dados.js'), 'w') as f:
    f.write('const DADOS = ' + json.dumps(dados, ensure_ascii=False) + ';\n')

pontos_p = P('public/data/mapa_pontos.json')
pontos = json.load(open(pontos_p))
pontos['johto'] = {
    'npcs': {},
    'areas': {str(a['id']): [a['ancora'][0], a['ancora'][1], a['id']] for a in areas},
    'cenas': {},
}
with open(pontos_p, 'w') as f:
    json.dump(pontos, f, ensure_ascii=False, separators=(',', ':'))

print(f'johto: {nx}x{ny} tiles, {len(areas)} areas, {len(predios)} buildings')
