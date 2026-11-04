#!/usr/bin/env python3
"""Import Pixelmon models the game does not already have.

Pixelmon's species JSON names every mesh. A form listed in `megas`, or named
mega / megax / megay, is a Mega and never receives the regular `_00` slot.
`base` (or Spring, or Unown A, when there is no base) is the regular model.
Each other form, letter, season, regional form, and costume keeps its own file.
Shiny is the palette of the same mesh, written beside it for the runtime swap.
"""

import argparse
import json
import os
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelmon_bmd_to_glb import build_glb, convert

ROOT = Path(__file__).resolve().parents[1]
JAR = Path(os.environ.get('PIXELMON_JAR', '/tmp/pixelmon/Pixelmon.jar'))
MON = ROOT / 'public' / 'scenery' / 'mon'
SHINY = MON / 'shiny'
LOG = ROOT / 'tools' / 'pixelmon_import_log.jsonl'
# The commit the roster import started from: its 290 models are the originals.
BEFORE_IMPORT = '8608617e5fac301ce454a53b9ed2e1158b8ec1f1'

MEGA_NAMES = {'mega', 'megax', 'megay'}
GMAX_NAMES = {'gmax', 'gigantamax', 'eternamax'}
REGIONAL = {
    'alolan': (61, 'Alolan'),
    'alola': (61, 'Alolan'),
    'galarian': (62, 'Galarian'),
    'galar': (62, 'Galarian'),
    'hisuian': (63, 'Hisuian'),
    'hisui': (63, 'Hisuian'),
    'paldean': (64, 'Paldean'),
}
# When a species has no form named base, this is the look the Pokédex shows.
PREFERRED_REGULAR = (
    'base', 'normal', 'ordinary', 'standard', 'plant', 'spring', 'midday',
    'altered', 'land', 'aria', 'baile', 'solo', 'disguised', 'amped',
    'fullbelly', 'ice', 'zero', 'curly', 'a', 'red', 'ordinary',
)
SKIP_PREDICATE = {
    'pixelmon:flying', 'pixelmon:swim', 'pixelmon:mounted', 'pixelmon:bike',
    'pixelmon:ride', 'pixelmon:hover',
}
# Pixelmon animation type -> clip name in the GLB, beyond idle and walk.
EXTRA_CLIPS = {
    'fly': 'Fly', 'swim': 'Swim', 'idleswim': 'SwimIdle',
    'special': 'Special', 'special2': 'Special2', 'special3': 'Special3',
}
POSE_SUFFIX = {'flying', 'bike', 'fly', 'mount', 'ground', 'swim'}


def norm(name):
    return str(name or '').strip().lower().replace('-', '').replace('_', '').replace(' ', '')


def is_mega(name, mega_names):
    n = norm(name)
    return n in MEGA_NAMES or n in mega_names or n.startswith('mega')


def nota_for(name):
    raw = str(name or '').strip()
    n = norm(raw)
    if n in ('mega',):
        return 'Mega'
    if n == 'megax':
        return 'Mega X'
    if n == 'megay':
        return 'Mega Y'
    if n in GMAX_NAMES:
        return 'Gigantamax'
    if n in REGIONAL:
        return REGIONAL[n][1]
    if n == 'exclamation':
        return '!'
    if n == 'question':
        return '?'
    if len(raw) == 1 and raw.isalpha():
        return raw.upper()
    pretty = raw.replace('_', ' ').replace('-', ' ').strip()
    return pretty[:1].upper() + pretty[1:] if pretty else 'Form'


def jar_index(z):
    return {n.lower(): n for n in z.namelist()}


def resolve(ref, index):
    if not ref or not isinstance(ref, str):
        return None
    rel = ref.split(':', 1)[-1].lstrip('/')
    if not rel.startswith('pokemon/'):
        rel = 'pokemon/' + rel
    return index.get(('assets/pixelmon/textures/' + rel).lower())


PART_TOKENS = {
    'hood', 'eyes', 'eye', 'feelers', 'mask', 'orb', 'spectre', 'specter',
    'transparent', 'transparency', 'fur', 'pupils',
}


def is_mesh_part(path):
    """Extra pieces Pixelmon stacks on the body (hood, eyes, feelers)."""
    stem = str(path or '').rsplit('/', 1)[-1].rsplit('.', 1)[0].lower()
    bits = stem.replace('-', '_').split('_')
    if any(bit in PART_TOKENS for bit in bits):
        return True
    return any(stem.endswith(token) and stem != token for token in PART_TOKENS)


def pick_model(palette):
    chosen = []
    for group in palette.get('models') or []:
        if not isinstance(group, dict):
            continue
        pred = (group.get('model_predicate') or {}).get('type') or 'pixelmon:always'
        models = group.get('models') or []
        # Some species list their models by render style: {"smooth": [...]}.
        if isinstance(models, dict):
            models = [m for style in models.values() if isinstance(style, list) for m in style]
        for model in models:
            if isinstance(model, dict) and str(model.get('model') or '').lower().endswith('.bmd'):
                chosen.append((pred, model))
    if not chosen:
        return None
    always = [model for pred, model in chosen if pred in ('pixelmon:always', 'pixelmon:ground')]
    if not always:
        always = [model for pred, model in chosen if pred not in SKIP_PREDICATE] or [chosen[0][1]]
    bodies = [model for model in always if not is_mesh_part(model.get('model'))]
    pool = bodies or always
    for model in pool:
        if '/none/' in str(model.get('model') or '').lower():
            return model
    return pool[0]


def anim_ref(model, kind):
    for anim in model.get('animations') or []:
        if isinstance(anim, dict) and anim.get('type') == kind and anim.get('animation'):
            return anim['animation']
    return None


def shiny_palette_name(name):
    n = str(name or '')
    return n == 'shiny' or n.endswith('_shiny')


def gender_models(form):
    """One entry per gender whose mesh differs. ALL wins when present.

    A palette named shiny, or ending in _shiny, is the shiny texture of the
    matching form. It is never its own model. Species with no `none` palette
    (Alcremie and the like) use the first real palette as the body.
    """
    found = []
    seen = set()
    for gp in form.get('genderProperties') or []:
        if not isinstance(gp, dict):
            continue
        gender = str(gp.get('gender') or 'ALL').upper()
        palettes = [p for p in (gp.get('palettes') or []) if isinstance(p, dict)]
        body = next((p for p in palettes if p.get('name') == 'none'), None)
        if body is None:
            body = next((p for p in palettes if not shiny_palette_name(p.get('name'))), None)
        if body is None:
            continue
        model = pick_model(body)
        if not model:
            continue
        key = str(model.get('model') or '')
        if key in seen and gender != 'ALL':
            continue
        seen.add(key)
        by_name = {p.get('name'): p for p in palettes}
        shiny_pal = by_name.get('shiny') if body.get('name') == 'none' else by_name.get(str(body.get('name')) + '_shiny')
        shiny_model = pick_model(shiny_pal) if shiny_pal else None
        extras = []
        for pal in palettes:
            if pal is body or shiny_palette_name(pal.get('name')):
                continue
            alt = pick_model(pal)
            if not alt:
                continue
            if alt.get('texture') == model.get('texture') and alt.get('model') == model.get('model'):
                continue
            sib = by_name.get(str(pal.get('name')) + '_shiny')
            sm = pick_model(sib) if sib else None
            extras.append((pal.get('name'), alt, sm.get('texture') if sm else None))
        found.append({
            'gender': gender,
            'model': model,
            'shiny': shiny_model.get('texture') if shiny_model else None,
            'costumes': extras,
        })
    found.sort(key=lambda e: {'ALL': 0, 'MALE': 1, 'FEMALE': 2}.get(e['gender'], 9))
    if not found:
        return []
    primary = found[0]['model'].get('model')
    out = [found[0]]
    for extra in found[1:]:
        if extra['model'].get('model') != primary:
            out.append(extra)
    return out


def regular_form(forms, mega_names):
    by_name = {norm(f.get('name')): f for f in forms}
    for name in PREFERRED_REGULAR:
        form = by_name.get(norm(name))
        if form and not is_mega(form.get('name'), mega_names) and norm(form.get('name')) not in GMAX_NAMES:
            return form
    for form in forms:
        if not is_mega(form.get('name'), mega_names) and norm(form.get('name')) not in GMAX_NAMES:
            return form
    return None


def claim(preferred, assigned, on_disk, banned=()):
    """Reserve a suffix. None means this form's own slot is already shipped."""
    n = preferred
    while n <= 99:
        if n in banned or n in assigned:
            n += 1
            continue
        assigned.add(n)
        # A file already in this slot is the form this same ordering would have
        # written. Leave it. Bumping past it is how a second run minted a duplicate
        # Unown C and a second autumn Deerling.
        if n in on_disk:
            return None
        return n
    return None


def plan_species(raw, existing):
    dex = int(raw.get('dex'))
    if dex < 0 or dex > 1025:
        return []
    forms = [f for f in (raw.get('forms') or []) if isinstance(f, dict)]
    mega_names = set()
    for form in forms:
        for mega in form.get('megas') or []:
            if isinstance(mega, str):
                mega_names.add(norm(mega))
    regular = regular_form(forms, mega_names)
    on_disk = set(existing)
    assigned = set()
    jobs = []

    def add(form, entry, suffix, nota, kind):
        model = entry['model']
        idle = anim_ref(model, 'idle') or anim_ref(model, 'walk')
        walk = anim_ref(model, 'walk') or idle
        # A model with no motions still ships; default_clips gives it Idle and Run.
        if not model.get('model') or not model.get('texture'):
            return
        glb = f'pm{dex:04d}_{suffix:02d}'
        label = nota
        if entry.get('mark_gender'):
            word = 'Female' if entry['gender'] == 'FEMALE' else 'Male'
            label = (label + ' ' + word.lower()).strip() if label else word
        jobs.append({
            'dex': dex,
            'name': raw.get('name') or f'No. {dex}',
            'form': form.get('name'),
            'kind': kind,
            'glb': glb,
            'nota': label,
            'scale': float(model.get('scale') or 1),
            'model': model.get('model'),
            'texture': model.get('texture'),
            'shiny': entry.get('shiny'),
            'idle': idle,
            'walk': walk,
            'extra': {kind: ref for kind in EXTRA_CLIPS if (ref := anim_ref(model, kind))},
        })

    ordered = []
    if regular:
        ordered.append((regular, 'regular'))
    for form in forms:
        if regular and norm(form.get('name')) == norm(regular.get('name')):
            continue
        kind = 'form'
        if is_mega(form.get('name'), mega_names):
            kind = 'mega'
        elif norm(form.get('name')) in GMAX_NAMES:
            kind = 'gmax'
        elif norm(form.get('name')) in REGIONAL:
            kind = 'regional'
        ordered.append((form, kind))

    for form, kind in ordered:
        genders = gender_models(form)
        if not genders:
            continue
        primary = genders[0]
        if kind == 'regular':
            suffix = claim(0, assigned, on_disk)
            if suffix is not None:
                nota = None if norm(form.get('name')) == 'base' else nota_for(form.get('name'))
                add(form, primary, suffix, nota, 'regular')
        elif kind == 'mega':
            n = norm(form.get('name'))
            preferred = 52 if n == 'megay' else 51
            suffix = claim(preferred, assigned, on_disk, banned=(0,))
            if suffix is not None:
                add(form, primary, suffix, nota_for(form.get('name')), 'mega')
        elif kind == 'gmax':
            suffix = claim(81, assigned, on_disk, banned=(0,))
            if suffix is not None:
                add(form, primary, suffix, 'Gigantamax', 'gmax')
        elif kind == 'regional':
            preferred = REGIONAL[norm(form.get('name'))][0]
            suffix = claim(preferred, assigned, on_disk, banned=(0,))
            if suffix is not None:
                add(form, primary, suffix, nota_for(form.get('name')), 'regional')
        else:
            suffix = claim(11, assigned, on_disk, banned=(0, 51, 52, 61, 62, 63, 64, 81))
            if suffix is not None:
                add(form, primary, suffix, nota_for(form.get('name')), 'form')
        for extra in genders[1:]:
            suffix = claim(41, assigned, on_disk, banned=(0, 51, 52, 61, 62, 63, 64, 81))
            if suffix is None:
                continue
            label = None if norm(form.get('name')) == 'base' else nota_for(form.get('name'))
            extra = dict(extra, mark_gender=True)
            add(form, extra, suffix, label, 'form' if kind == 'regular' else kind)
        for pname, alt, shiny_tex in primary['costumes']:
            suffix = claim(31, assigned, on_disk, banned=(0, 51, 52, 61, 62, 63, 64, 81))
            if suffix is None:
                continue
            costume = {
                'gender': primary['gender'],
                'model': alt,
                'shiny': shiny_tex or primary.get('shiny'),
            }
            add(form, costume, suffix, nota_for(pname), 'costume')
    for job in jobs:
        if job['kind'] == 'mega' and job['glb'].endswith('_00'):
            raise SystemExit(f"refusing to name a Mega as the regular model: {job}")
    return jobs


def tracked_suffixes(dex, tracked):
    found = set()
    prefix = f'pm{dex:04d}'
    for stem in tracked:
        if not stem.startswith(prefix):
            continue
        if '_' not in stem:
            found.add(0)
            continue
        try:
            found.add(int(stem.rsplit('_', 1)[1]))
        except ValueError:
            pass
    return found


def canonical_jobs(z, index, before=None):
    """Every form we mean to ship, named as if only the original models existed.

    Planning against files this import already wrote makes a second run skip
    them, and then the cast never hears about them. `before` is a commit whose
    models count as the originals; once the import is committed, pass the
    commit it started from (BEFORE_IMPORT).
    """
    import subprocess
    cmd = ['git', 'ls-tree', '-r', '--name-only', before, 'public/scenery/mon'] if before \
        else ['git', 'ls-files', 'public/scenery/mon']
    tracked = {
        Path(p).stem
        for p in subprocess.check_output(cmd, text=True, cwd=ROOT).split()
        if p.endswith('.glb')
    }
    jobs = []
    for name in sorted(n for n in z.namelist() if n.startswith('data/pixelmon/species/') and n.endswith('.json')):
        raw = json.loads(z.read(name))
        try:
            dex = int(raw.get('dex'))
        except (TypeError, ValueError):
            continue
        jobs.extend(plan_species(raw, tracked_suffixes(dex, tracked)))
    resolved = []
    for job in jobs:
        model = resolve(job['model'], index)
        texture = resolve(job['texture'], index)
        idle = resolve(job['idle'], index)
        walk = resolve(job['walk'], index)
        shiny = resolve(job['shiny'], index) if job.get('shiny') else None
        if not (model and texture and (idle and walk or not job['idle'])):
            continue
        job = dict(job)
        job['model_path'] = model
        job['texture_path'] = texture
        job['idle_path'] = idle
        job['walk_path'] = walk
        job['shiny_path'] = shiny
        job['extra_paths'] = {
            kind: path for kind, ref in (job.get('extra') or {}).items()
            if (path := resolve(ref, index))
        }
        resolved.append(job)
    return resolved


def existing_suffixes(dex):
    found = set()
    for path in MON.glob(f'pm{dex:04d}*.glb'):
        stem = path.stem
        if '_' in stem:
            try:
                found.add(int(stem.rsplit('_', 1)[1]))
            except ValueError:
                pass
        else:
            found.add(0)
    return found


def build_plan(z):
    index = jar_index(z)
    jobs = []
    for name in sorted(n for n in z.namelist() if n.startswith('data/pixelmon/species/') and n.endswith('.json')):
        raw = json.loads(z.read(name))
        try:
            dex = int(raw.get('dex'))
        except (TypeError, ValueError):
            continue
        jobs.extend(plan_species(raw, existing_suffixes(dex)))
    # Resolve jar paths once.
    resolved = []
    missing = 0
    for job in jobs:
        model = resolve(job['model'], index)
        texture = resolve(job['texture'], index)
        idle = resolve(job['idle'], index)
        walk = resolve(job['walk'], index)
        shiny = resolve(job['shiny'], index) if job.get('shiny') else None
        if not (model and texture and (idle and walk or not job['idle'])):
            missing += 1
            continue
        job = dict(job)
        job['model_path'] = model
        job['texture_path'] = texture
        job['idle_path'] = idle
        job['walk_path'] = walk
        job['shiny_path'] = shiny
        resolved.append(job)
    return resolved, missing


_ZIP = None
_INDEX = None


def _worker(job):
    global _ZIP
    if _ZIP is None:
        _ZIP = zipfile.ZipFile(JAR)
    try:
        tmp = Path(f'/tmp/px-{os.getpid()}')
        tmp.mkdir(exist_ok=True)
        def dump(key, arc):
            dest = tmp / (key + Path(arc).suffix)
            dest.write_bytes(_ZIP.read(arc))
            return dest
        model = dump('model', job['model_path'])
        texture = dump('texture', job['texture_path'])
        glb_name = job['glb']
        clips = []
        if job['idle_path']:
            clips = [(dump('idle', job['idle_path']), 'Idle'), (dump('walk', job['walk_path']), 'Run')]
        try:
            built = convert(
                model, texture, clips,
                f'{glb_name}_Body1.tga', glb_name, job['scale'],
            )
        except SystemExit as e:
            # A version-1 animation can sit on a version-2 mesh. Keep the mesh
            # and let it rest in the bind pose instead of dropping the species.
            if 'idle.bmd' not in str(e) and 'walk.bmd' not in str(e):
                raise
            built = convert(model, texture, [], f'{glb_name}_Body1.tga', glb_name, job['scale'])
        dest = MON / f'{glb_name}.glb'
        if not job.get('measure'):
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(build_glb(built))
        shiny_file = None
        if job.get('shiny_path'):
            raw = _ZIP.read(job['shiny_path'])
            if raw[:8] == b'\x89PNG\r\n\x1a\n':
                shiny_file = SHINY / f'{glb_name}_Body1.tga_1.png'
                if not shiny_file.exists():
                    shiny_file.parent.mkdir(parents=True, exist_ok=True)
                    shiny_file.write_bytes(raw)
        row = {
            'n': job['dex'], 'nome': job['name'], 'glb': glb_name,
            'altura': round(float(built['height']), 2), 'kind': job['kind'], 'form': job['form'],
        }
        if job.get('nota'):
            row['nota'] = job['nota']
        if shiny_file:
            row['shiny'] = shiny_file.name
        return row
    except BaseException as e:
        return {'error': f"{job['glb']} {job['form']}: {e}"}


def english_names():
    pdx = json.loads((ROOT / 'public' / 'pokedex.json').read_text())
    names = {}
    for species in pdx['species']:
        names.setdefault(int(species['n']), species['name'])
    return names


def update_cast(rows):
    cast_path = ROOT / 'public' / 'data' / 'cast.json'
    cast = json.loads(cast_path.read_text())
    have = {e['glb'] for e in cast}
    names = english_names()
    added = 0
    for row in sorted(rows, key=lambda r: (int(r['n']), r['glb'])):
        if row['glb'] in have:
            continue
        entry = {
            'n': row['n'],
            'nome': names.get(row['n'], row['nome']),
            'glb': row['glb'],
            'altura': row['altura'],
        }
        if row.get('nota'):
            entry['nota'] = row['nota']
        cast.append(entry)
        have.add(row['glb'])
        added += 1
    cast_path.write_text(json.dumps(cast, separators=(',', ':'), ensure_ascii=False))
    return added


def rebuild(names, workers):
    """Convert these models again in place. Shinies and cast rows stay as they are."""
    z = zipfile.ZipFile(JAR)
    jobs = [j for j in canonical_jobs(z, jar_index(z), BEFORE_IMPORT) if j['glb'] in names]
    z.close()
    unknown = sorted(set(names) - {j['glb'] for j in jobs})
    print(f'rebuilding {len(jobs)}; not in the import plan: {len(unknown)} {unknown[:10]}', flush=True)
    from concurrent.futures import ProcessPoolExecutor, as_completed
    errors = []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_worker, dict(job, measure=False)) for job in jobs]
        for i, fut in enumerate(as_completed(futures), 1):
            result = fut.result()
            if result.get('error'):
                errors.append(result['error'])
                print('ERR', result['error'])
            if i % 100 == 0 or i == len(jobs):
                print(f'  {i}/{len(jobs)}', flush=True)
    print(f'rebuilt {len(jobs) - len(errors)}; errors {len(errors)}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--only', nargs='+', metavar='GLB',
                        help='convert just these models (names like pm0213_00)')
    parser.add_argument('--rebuild', nargs='+', metavar='GLB',
                        help='convert these models again (names like pm0202_00, or @file.json with a list)')
    args = parser.parse_args()
    if args.rebuild:
        names = set()
        for item in args.rebuild:
            names |= set(json.loads(Path(item[1:]).read_text())) if item.startswith('@') else {item}
        rebuild(names, args.workers)
        return
    z = zipfile.ZipFile(JAR)
    jobs, unresolved = build_plan(z)
    z.close()
    if args.only:
        jobs = [j for j in jobs if j['glb'] in set(args.only)]
    by_kind = {}
    for job in jobs:
        by_kind[job['kind']] = by_kind.get(job['kind'], 0) + 1
    megas_as_regular = [j for j in jobs if j['kind'] == 'mega' and j['glb'].endswith('_00')]
    print(f'jobs {len(jobs)} unresolved {unresolved} by kind {by_kind}')
    print(f'megas named _00: {len(megas_as_regular)}')
    scizor = [j for j in jobs if j['dex'] == 212]
    for job in scizor:
        print(' scizor', job['kind'], job['form'], job['glb'], job.get('nota'))
    unown = [j for j in jobs if j['dex'] == 201]
    print(' unown', [(j['form'], j['glb'], j.get('nota')) for j in unown])
    deer = [j for j in jobs if j['dex'] in (585, 586)]
    print(' deer', [(j['dex'], j['form'], j['glb'], j.get('nota'), j['kind']) for j in deer])
    if megas_as_regular:
        raise SystemExit('refusing to run: a Mega was assigned the regular _00 slot')
    if args.plan:
        return
    logged = {}
    if LOG.exists():
        for line in LOG.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get('glb') and 'altura' in row:
                logged[row['glb']] = row
    todo = []
    for job in jobs:
        path = MON / f"{job['glb']}.glb"
        if job['glb'] in logged and path.exists():
            continue
        job = dict(job)
        job['measure'] = path.exists()
        todo.append(job)
    fresh = sum(1 for j in todo if not j['measure'])
    print(f'converting {fresh}, measuring {len(todo) - fresh} already on disk')
    from concurrent.futures import ProcessPoolExecutor, as_completed
    rows = []
    errors = []
    LOG.parent.mkdir(parents=True, exist_ok=True)
    if todo:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(_worker, job) for job in todo]
            for i, fut in enumerate(as_completed(futures), 1):
                result = fut.result()
                if result.get('error'):
                    errors.append(result['error'])
                    print('ERR', result['error'])
                else:
                    rows.append(result)
                    logged[result['glb']] = result
                    with LOG.open('a') as fh:
                        fh.write(json.dumps(result) + '\n')
                if i % 50 == 0 or i == len(todo):
                    print(f'  {i}/{len(todo)}', flush=True)
    # Files written by an earlier run are not in `jobs` (that plan skips anything
    # already on disk) and most of them never reached the log. Measure those so
    # the cast still gets a height and a form label.
    z2 = zipfile.ZipFile(JAR)
    gap = []
    for job in canonical_jobs(z2, jar_index(z2)):
        if args.only and job['glb'] not in args.only:
            continue
        if not (MON / f"{job['glb']}.glb").exists():
            continue
        if job['glb'] in logged:
            continue
        gap.append(dict(job, measure=True))
    z2.close()
    print(f'measuring {len(gap)} models already on disk', flush=True)
    if gap:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(_worker, job) for job in gap]
            for i, fut in enumerate(as_completed(futures), 1):
                result = fut.result()
                if result.get('error'):
                    errors.append(result['error'])
                    print('ERR', result['error'])
                else:
                    rows.append(result)
                    logged[result['glb']] = result
                    with LOG.open('a') as fh:
                        fh.write(json.dumps(result) + '\n')
                if i % 100 == 0 or i == len(gap):
                    print(f'  measured {i}/{len(gap)}', flush=True)
    # Replay the log so a resumed run still fills cast for files converted earlier.
    if LOG.exists():
        seen = {r['glb'] for r in rows}
        for line in LOG.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get('glb') and row['glb'] not in seen and (MON / f"{row['glb']}.glb").exists():
                rows.append(row)
                seen.add(row['glb'])
    added = update_cast(rows)
    print(f'cast rows added {added}; errors {len(errors)}')
    if errors:
        (ROOT / 'tools' / 'pixelmon_import_errors.txt').write_text('\n'.join(errors))


if __name__ == '__main__':
    main()
