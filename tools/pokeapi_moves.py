#!/usr/bin/env python3
"""Refresh the move catalog and level-up learnsets from PokéAPI.

Downloads the CSVs (cached under $POKEAPI_CACHE, default /tmp/pokeapi) and
rewrites:

  public/data/moves.json      every official move, plus the old unmatched ones
  public/data/learnset.json   level-up sets and PP

Existing 3D moves keep their presentation (effect id, sound, animation, range,
cooldown, Portuguese name, projectile phases, contact). Official stats are
replaced: English name, type, power, category, accuracy, PP, description,
priority.

Learnsets prefer Scarlet/Violet, then Teal Mask, then Indigo Disk. A species
with none of those falls back to Legends Z-A, then Sword/Shield, then whichever
version group still has level-up rows. A species whose new list is empty keeps
the learnset it already had.

Run from the repo root:

  python3 tools/pokeapi_moves.py
"""
from __future__ import annotations

import csv
import json
import os
import sys
import tempfile
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOVES_PATH = ROOT / 'public' / 'data' / 'moves.json'
LEARN_PATH = ROOT / 'public' / 'data' / 'learnset.json'
CACHE = Path(os.environ.get('POKEAPI_CACHE', Path(tempfile.gettempdir()) / 'pokeapi'))
BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
FILES = (
    'moves.csv',
    'move_names.csv',
    'move_effect_prose.csv',
    'type_names.csv',
    'pokemon.csv',
    'pokemon_moves.csv',
)
# Latest Scarlet/Violet list wins when a DLC group actually has rows.
SV_GROUPS = (27, 26, 25)          # indigo disk, teal mask, scarlet-violet
FALLBACK_GROUPS = (30, 20)        # legends-za, then sword-shield
LEVEL_UP = '1'
LANG = '9'
# Old ids that are not the hyphen-stripped PokéAPI identifier.
ALIASES = {
    'vice-grip': 'visegrip',
}
# These stay in the catalog even though no current identifier matches them.
# The two official Z-moves are added beside this one; they are not this row.
KEEP_UNMATCHED = ('infernooverdrive',)


def download() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        dest = CACHE / name
        if dest.exists() and dest.stat().st_size > 0 and '--refresh' not in sys.argv:
            continue
        url = BASE + name
        print(f'downloading {name}')
        urllib.request.urlretrieve(url, dest)


def read_csv(name: str):
    with (CACHE / name).open(newline='', encoding='utf-8') as f:
        yield from csv.DictReader(f)


def slug_of(identifier: str) -> str:
    if identifier in ALIASES:
        return ALIASES[identifier]
    return identifier.replace('-', '')


def recarga_of(power: int, cat: str) -> float:
    if cat == 'status':
        return 3
    if power <= 40:
        return 1.6
    if power <= 60:
        return 1.8
    if power <= 75:
        return 2.2
    if power <= 90:
        return 2.8
    if power <= 100:
        return 3.5
    if power <= 120:
        return 4.5
    return 5.0


def present_new(official: dict) -> dict:
    cat = official['cat']
    move = {
        'id': official['id'],
        'nome': official['nome'],
        'tipo': official['tipo'],
        'poder': official['poder'],
        'cat': cat,
        'alcance': 1.3 if cat == 'fisico' else 6,
        'recarga': recarga_of(official['poder'], cat),
        'efeito': official['efeito'],
        'som': 'Blow' if cat == 'fisico' else 'gust',
        'anim': 'Attack' if cat == 'fisico' else 'Cast',
        'atraso': 0.12 if cat == 'fisico' else (0.2 if cat == 'status' else 0.3),
    }
    if cat == 'fisico':
        move['somAcerto'] = 'damage1'
        move['contato'] = True
    if official['precisao'] is not None:
        move['precisao'] = official['precisao']
    if cat != 'status':
        move['acerto'] = True
    if official['prioridade']:
        move['prioridade'] = official['prioridade']
    if official['descricao']:
        move['descricao'] = official['descricao']
    move['pp'] = official['pp'] if official['pp'] is not None else 20
    return move


def refresh_old(old: dict, official: dict) -> dict:
    """Official stats only. Range, cooldown, effect, and the other 3D fields stay."""
    out = dict(old)
    out['nome'] = official['nome']
    out['tipo'] = official['tipo']
    out['poder'] = official['poder']
    out['cat'] = official['cat']
    if official['descricao']:
        out['descricao'] = official['descricao']
    if official['pp'] is not None:
        out['pp'] = official['pp']
    elif out.get('pp') is None:
        out['pp'] = 20
    if official['precisao'] is not None:
        out['precisao'] = official['precisao']
    if official['prioridade']:
        out['prioridade'] = official['prioridade']
    elif 'prioridade' in out:
        del out['prioridade']
    return out


def load_official():
    types = {}
    for row in read_csv('type_names.csv'):
        if row['local_language_id'] == LANG:
            types[row['type_id']] = row['name']
    names = {}
    for row in read_csv('move_names.csv'):
        if row['local_language_id'] == LANG:
            names[row['move_id']] = row['name']
    effects = {}
    for row in read_csv('move_effect_prose.csv'):
        if row['local_language_id'] == LANG:
            effects[row['move_effect_id']] = row['short_effect']
    cat_of = {'1': 'status', '2': 'fisico', '3': 'especial'}
    official = []
    by_slug = {}
    for row in read_csv('moves.csv'):
        ident = row['identifier']
        sid = slug_of(ident)
        power = int(row['power']) if row['power'] else 0
        pp = int(row['pp']) if row['pp'] else None
        acc = int(row['accuracy']) if row['accuracy'] else None
        pri = int(row['priority'] or 0)
        chance = row['effect_chance']
        desc = effects.get(row['effect_id'], '') or ''
        if '$effect_chance' in desc and chance:
            desc = desc.replace('$effect_chance', chance)
        entry = {
            'pokeapi_id': int(row['id']),
            'id': sid,
            'nome': names.get(row['id']) or ident.replace('-', ' ').title(),
            'tipo': types.get(row['type_id'], 'Normal'),
            'poder': power,
            'cat': cat_of.get(row['damage_class_id'], 'status'),
            'pp': pp,
            'precisao': acc,
            'prioridade': pri,
            'descricao': desc,
            'efeito': f'{int(row["id"]):05d}',
        }
        official.append(entry)
        by_slug[sid] = entry
    official.sort(key=lambda e: e['pokeapi_id'])
    return official, by_slug


def build_moves(old: dict, official, by_slug) -> dict:
    out = {}
    used = set()
    for entry in official:
        sid = entry['id']
        if sid in old:
            out[sid] = refresh_old(old[sid], entry)
            used.add(sid)
        elif sid not in out:
            out[sid] = present_new(entry)
    for sid in old:
        if sid not in used and sid not in out:
            out[sid] = old[sid]
    # Stable: PokéAPI order, then any old move that never matched, in its old order.
    ordered = {}
    for entry in official:
        ordered[entry['id']] = out[entry['id']]
    for sid in old:
        if sid not in ordered:
            ordered[sid] = out[sid]
    for sid in KEEP_UNMATCHED:
        if sid in old and sid not in ordered:
            ordered[sid] = old[sid]
    return ordered


def default_pokemon() -> dict[int, str]:
    """National dex → the default form's pokemon id (as a string, for the CSV)."""
    chosen: dict[int, tuple[int, str]] = {}
    for row in read_csv('pokemon.csv'):
        if row['is_default'] != '1':
            continue
        species = int(row['species_id'])
        pid = int(row['id'])
        prev = chosen.get(species)
        if prev is None or pid < prev[0]:
            chosen[species] = (pid, row['id'])
    return {species: pid for species, (_n, pid) in chosen.items()}


def levelup_rows():
    """pokemon id → version group → [(level, order, move_id), ...]."""
    bag = defaultdict(lambda: defaultdict(list))
    for row in read_csv('pokemon_moves.csv'):
        if row['pokemon_move_method_id'] != LEVEL_UP:
            continue
        level = int(row['level'] or 0)
        order = int(row['order'] or 0)
        bag[row['pokemon_id']][int(row['version_group_id'])].append(
            (level, order, int(row['move_id']))
        )
    return bag


def choose_rows(by_group: dict) -> list | None:
    for g in SV_GROUPS:
        if by_group.get(g):
            return by_group[g]
    for g in FALLBACK_GROUPS:
        if by_group.get(g):
            return by_group[g]
    if not by_group:
        return None
    return by_group[max(by_group)]


def build_learnset(old_learn: dict, move_by_pokeapi: dict[int, str], moves: dict) -> dict:
    defaults = default_pokemon()
    rows = levelup_rows()
    learnset = {}
    kept = 0
    fresh = 0
    species_ids = set(defaults) | {int(k) for k in old_learn}
    for species in sorted(species_ids):
        pid = defaults.get(species)
        picked = choose_rows(rows.get(pid, {})) if pid else None
        entry = []
        if picked:
            seen = set()
            for level, _order, mid in sorted(picked):
                sid = move_by_pokeapi.get(mid)
                if not sid or sid in seen or sid not in moves:
                    continue
                seen.add(sid)
                entry.append([sid, level or 1])  # PokéAPI level 0 is "on evolution"; the game starts at 1
        if entry:
            learnset[str(species)] = entry
            fresh += 1
        elif str(species) in old_learn and old_learn[str(species)]:
            learnset[str(species)] = old_learn[str(species)]
            kept += 1
    pp = {}
    for sid, move in moves.items():
        pp[sid] = int(move['pp']) if move.get('pp') else 20
    print(f'learnset: {fresh} from PokéAPI, {kept} kept because the new list was empty')
    return {
        'gerado': '2026-11-03',
        'pp': pp,
        'learnset': learnset,
    }


def main() -> None:
    download()
    old = json.loads(MOVES_PATH.read_text(encoding='utf-8'))
    old_doc = json.loads(LEARN_PATH.read_text(encoding='utf-8'))
    official, by_slug = load_official()
    moves = build_moves(old, official, by_slug)
    move_by_pokeapi = {e['pokeapi_id']: e['id'] for e in official}
    learn = build_learnset(old_doc.get('learnset') or {}, move_by_pokeapi, moves)
    matched = sum(1 for sid in old if sid in by_slug)
    print(f'moves: {len(old)} old, {matched} matched, {len(moves)} now')
    missing = [sid for sid in KEEP_UNMATCHED if sid not in moves]
    if missing:
        raise SystemExit(f'missing kept moves: {missing}')
    MOVES_PATH.write_text(
        json.dumps(moves, ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8',
    )
    LEARN_PATH.write_text(
        json.dumps(learn, ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8',
    )
    print(f'wrote {MOVES_PATH.relative_to(ROOT)} and {LEARN_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
