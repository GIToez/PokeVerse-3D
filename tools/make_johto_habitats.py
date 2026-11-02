#!/usr/bin/env python3
"""Fill Johto areas in public/data/habitats.json from the HeartGold/SoulSilver tables.

PokéAPI's location areas are the vanilla HGSS slots (walk and surf, morning/day/night,
radio off). HeartGold and SoulSilver are averaged per species, so a version exclusive
keeps half its rate and a species that is common in only one version is pulled toward
the middle. The two games' morning tables then still add up to about 100.
Surf weights are scaled by the surf rate over the walk rate, so a pond does not
spawn as many fish as the grass spawns Pokémon.
Bug-Catching Contest and swarm slots are left out; this game has neither.

Also writes the Johto level bands in index.html (NIVEL_AREA), used for route trainers.
Per-species levels stay on the habitat rows (lvMin/lvMax) and the spawner reads those.

    python3 tools/make_johto_habitats.py
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HABITATS = ROOT / 'public/data/habitats.json'
POKEDEX = ROOT / 'public/pokedex.json'
INDEX = ROOT / 'index.html'
MON = ROOT / 'public/scenery/mon'
CACHE = Path('/tmp/hgss_areas')
UA = 'Mozilla/5.0'

# Johto overworld area id -> the PokéAPI area whose table belongs on that ground.
AREAS = {
    2101: 'new-bark-town-area',
    2102: 'cherrygrove-city-area',
    2103: 'violet-city-area',
    2104: 'azalea-town-area',
    2106: 'ecruteak-city-area',
    2107: 'olivine-city-area',
    2108: 'cianwood-city-area',
    2109: 'mahogany-town-area',
    2110: 'blackthorn-city-area',
    2111: 'national-park-area',
    2112: 'ruins-of-alph-outside',
    2113: 'lake-of-rage-area',
    2114: 'mt-silver-outside',
    2117: 'ilex-forest-area',
    2118: 'union-cave-1f',
    2119: 'dark-cave-violet-city-entrance',
    2120: 'mt-mortar-1f',
    2121: 'ice-path-1f',
    # The overworld box is the sea around the islands (inside Route 41), not the cave.
    2122: 'johto-sea-route-41-area',
    2123: 'tohjo-falls-area',
    2124: 'safari-zone-gate-area',
    2226: 'kanto-route-26-area',
    2227: 'kanto-route-27-area',
    2228: 'kanto-route-28-area',
    2229: 'johto-route-29-area',
    2230: 'johto-route-30-area',
    2231: 'johto-route-31-area',
    2232: 'johto-route-32-area',
    2233: 'johto-route-33-area',
    2234: 'johto-route-34-area',
    2235: 'johto-route-35-area',
    2236: 'johto-route-36-area',
    2237: 'johto-route-37-area',
    2238: 'johto-route-38-area',
    2239: 'johto-route-39-area',
    2240: 'johto-sea-route-40-area',
    2241: 'johto-sea-route-41-area',
    2242: 'johto-route-42-area',
    2243: 'johto-route-43-area',
    2244: 'johto-route-44-area',
    2245: 'johto-route-45-area',
    2246: 'johto-route-46-area',
    2247: 'johto-route-47-area',
    2248: 'johto-route-48-area',
}

# PokéAPI has no encounter area for these. Rates are the vanilla HGSS radio-off
# tables (Bulbapedia / the slot list): Cliff Cave is the cave floor, Cliff Edge
# Gate is the pond. Times omitted means all three HGSS buckets.
MANUAL = {
    2127: [
        (0, ('manha', 'dia'), 42, 20, 22, 22),   # Golbat
        (0, ('noite',), 42, 24, 20, 22),
        (0, None, 74, 20, 19, 19),               # Geodude
        (0, None, 98, 10, 20, 20),               # Krabby
        (0, None, 99, 10, 22, 22),               # Kingler
        (0, None, 66, 10, 19, 19),               # Machop
        (0, None, 95, 10, 20, 20),               # Onix
        (0, ('manha', 'dia'), 194, 5, 18, 18),   # Wooper
        (0, ('manha', 'dia'), 195, 5, 20, 20),   # Quagsire
        (0, ('manha', 'dia'), 75, 4, 20, 20),    # Graveler
        (0, None, 67, 4, 22, 22),                # Machoke
        (0, None, 208, 2, 23, 23),               # Steelix
        (0, ('noite',), 41, 5, 18, 18),          # Zubat
        (0, ('noite',), 200, 5, 20, 20),         # Misdreavus
    ],
    2128: [
        (1, None, 194, 90, 20, 30),              # Wooper
        (1, None, 195, 10, 30, 40),              # Quagsire
    ],
}

TIMES = ('manha', 'dia', 'noite')
TIME_OF = {'time-morning': 'manha', 'time-day': 'dia', 'time-night': 'noite'}
SKIP_COND = {'radio-hoenn', 'radio-sinnoh', 'swarm-yes', 'bug-catching-contest-yes'}
FORM = ('Alola', 'Galar', 'Hisui', 'Paldea', 'Mega', 'Unova', 'Eternal')


def fetch(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (name + '.json')
    if path.exists() and path.stat().st_size > 100:
        return json.loads(path.read_text())
    url = 'https://pokeapi.co/api/v2/location-area/' + name + '/'
    try:
        raw = subprocess.check_output(['curl', '-fsSL', '-A', UA, url], timeout=60)
    except subprocess.CalledProcessError:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        raw = urllib.request.urlopen(req, timeout=60).read()
    path.write_bytes(raw)
    return json.loads(raw)


def names_by_dex():
    out = {}
    for s in json.loads(POKEDEX.read_text())['species']:
        if any(w in s['name'] for w in FORM):
            continue
        n = s['n']
        if n not in out:
            out[n] = s['name']
    return out


def display(dex, names):
    name = names.get(dex) or ('Nº ' + str(dex))
    return name.replace('Nidoran-F', 'Nidoran♀').replace('Nidoran-M', 'Nidoran♂')


def glb_for(dex):
    numbered = f'pm{dex:04d}_00.glb'
    plain = f'pm{dex:04d}.glb'
    if (MON / numbered).exists():
        return numbered
    if (MON / plain).exists():
        return plain
    return numbered


def rate(area, method):
    for m in area.get('encounter_method_rates') or []:
        if m['encounter_method']['name'] != method:
            continue
        for v in m['version_details']:
            if v['version']['name'] == 'heartgold':
                return v['rate']
    return 0


def details_of(mon, version):
    for v in mon['version_details']:
        if v['version']['name'] == version:
            return v['encounter_details']
    return []


def wanted(det):
    if det['method']['name'] not in ('walk', 'surf'):
        return False
    cond = {c['name'] for c in det['condition_values']}
    return not (cond & SKIP_COND)


def add_slot(bag, agua, dex, chance, lo, hi, times):
    if chance <= 0:
        return
    for hora in times:
        key = (agua, hora, dex)
        cur = bag.get(key)
        if cur is None:
            bag[key] = [chance, lo, hi]
        else:
            cur[0] += chance
            cur[1] = min(cur[1], lo)
            cur[2] = max(cur[2], hi)


def bag_for(area, version, scale, walk, surf):
    """One version's walk/surf slots. Untagged slots count in every time of day."""
    bag = {}
    for mon in area['pokemon_encounters']:
        dex = int(mon['pokemon']['url'].rstrip('/').split('/')[-1])
        for det in details_of(mon, version):
            if not wanted(det):
                continue
            agua = det['method']['name'] == 'surf'
            if agua and not surf:
                continue
            if not agua and not walk:
                continue
            chance = det['chance'] * (scale if agua else 1)
            cond = {c['name'] for c in det['condition_values']}
            times = [TIME_OF[c] for c in cond if c in TIME_OF] or list(TIMES)
            add_slot(bag, agua, dex, chance, det['min_level'], det['max_level'], times)
    return bag


def rows_for(area):
    """(agua, hora, dex) -> [chance, lvMin, lvMax].

    HeartGold and SoulSilver are averaged. A species in both games keeps the mean of
    its two rates (identical tables stay put). A version exclusive keeps half, which
    is the mean with the other game's zero, so the time-of-day totals stay near 100.
    """
    walk, surf = rate(area, 'walk'), rate(area, 'surf')
    scale = (surf / walk) if walk and surf else 1
    hg = bag_for(area, 'heartgold', scale, walk, surf)
    ss = bag_for(area, 'soulsilver', scale, walk, surf)
    bag = {}
    for key in set(hg) | set(ss):
        a, b = hg.get(key), ss.get(key)
        los, his = [], []
        chance = 0
        for cur in (a, b):
            if cur is None:
                continue
            chance += cur[0]
            los.append(cur[1])
            his.append(cur[2])
        chance /= 2
        if chance <= 0 or not los:
            continue
        bag[key] = [chance, min(los), max(his)]
    return bag, walk, surf


def manual_bag(slots):
    bag = {}
    for agua, horas, dex, chance, lo, hi in slots:
        add_slot(bag, bool(agua), dex, chance, lo, hi, list(horas) if horas else list(TIMES))
    return bag


def emit(bag, names):
    # Merge times that share chance and levels.
    grouped = {}
    for (agua, hora, dex), (chance, lo, hi) in bag.items():
        peso = max(1, min(1000, round(chance)))
        key = (agua, dex, peso, lo, hi)
        grouped.setdefault(key, []).append(hora)
    rows = []
    for (agua, dex, peso, lo, hi), horas in grouped.items():
        horas = [h for h in TIMES if h in horas]
        row = {
            'dex': dex, 'glb': glb_for(dex), 'nome': display(dex, names),
            'fonte': 'hgss', 'peso': peso, 'lvMin': lo, 'lvMax': hi,
        }
        if agua:
            row['agua'] = 1
        if len(horas) < 3:
            row['hora'] = horas
        rows.append(row)
    rows.sort(key=lambda r: (r.get('agua', 0), -r['peso'], r['dex']))
    return rows


def nivel_band(rows):
    land = [r for r in rows if not r.get('agua')] or rows
    if not land:
        return None
    return [min(r['lvMin'] for r in land), max(r['lvMax'] for r in land)]


def patch_levels(bands):
    lines = []
    for aid in sorted(bands):
        lo, hi = bands[aid]
        lines.append(f'  {aid}: [{lo}, {hi}],')
    block = '\n'.join(lines)
    text = INDEX.read_text()
    a = '  /* ——— Johto HGSS levels (tools/make_johto_habitats.py) ——— */'
    b = '  /* ——— end Johto HGSS levels ——— */'
    i, j = text.find(a), text.find(b)
    if i < 0 or j < 0:
        raise SystemExit('level markers missing in index.html')
    INDEX.write_text(text[:i + len(a)] + '\n' + block + '\n' + text[j:])


def main():
    names = names_by_dex()
    habitats = json.loads(HABITATS.read_text())
    bands = {}
    report = []
    for aid, slug in AREAS.items():
        bag, walk, surf = rows_for(fetch(slug))
        rows = emit(bag, names)
        if not rows:
            habitats['areas'].pop(str(aid), None)
            report.append(f'{aid} {slug}: no walk/surf')
            continue
        habitats['areas'][str(aid)] = rows
        band = nivel_band(rows)
        if band:
            bands[aid] = band
        morning = [r for r in rows if not r.get('agua') and (not r.get('hora') or 'manha' in r['hora'])]
        water = [r for r in rows if r.get('agua') and (not r.get('hora') or 'manha' in r['hora'])]
        report.append(f'{aid} {slug}: {len(rows)} rows, walk {walk} surf {surf}, '
                      f'lv {band}, land {sum(r["peso"] for r in morning)} '
                      f'water {sum(r["peso"] for r in water)}, '
                      f'morning {" ".join(r["nome"] + " " + str(r["peso"]) for r in morning[:8])}')
    for aid, slots in MANUAL.items():
        rows = emit(manual_bag(slots), names)
        habitats['areas'][str(aid)] = rows
        band = nivel_band(rows)
        if band:
            bands[aid] = band
        morning = [r for r in rows if not r.get('agua') and (not r.get('hora') or 'manha' in r['hora'])]
        report.append(f'{aid} manual: {len(rows)} rows, lv {band}, '
                      f'morning {" ".join(r["nome"] + " " + str(r["peso"]) for r in morning[:8])}')
    HABITATS.write_text(json.dumps(habitats, indent=1, ensure_ascii=False) + '\n')
    patch_levels(bands)
    print('\n'.join(report))
    print('areas', len(bands))


if __name__ == '__main__':
    main()
