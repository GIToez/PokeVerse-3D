"""List the species whose imported models get the tuned battle clips.

Starter lines, legendary and mythical Pokemon, every species in a line that
has a Mega Evolution, and everything Pixelmon lets fly, swim or be ridden.
Writes tools/tuned_species.json: dex number -> reasons.

    python3 tools/tune_list.py
"""
import json
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_pixelmon_roster import JAR  # noqa: E402

OUT = Path(__file__).resolve().parent / 'tuned_species.json'
STARTERS = {
    1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501,
    650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
}


def evolution_name(evo):
    to = evo.get('to')
    return str(to.get('key') if isinstance(to, dict) else to or '').lower()


def main():
    z = zipfile.ZipFile(JAR)
    species = {}
    for name in sorted(n for n in z.namelist() if n.startswith('data/pixelmon/species/') and n.endswith('.json')):
        raw = json.loads(z.read(name).decode('utf-8-sig'))
        species[int(raw['dex'])] = raw
    by_name = {raw['name'].lower(): dex for dex, raw in species.items()}
    links = defaultdict(set)
    for dex, raw in species.items():
        for form in raw.get('forms') or []:
            names = [str(p).lower() for p in form.get('preEvolutions') or []]
            names += [evolution_name(e) for e in form.get('evolutions') or [] if isinstance(e, dict)]
            for other in names:
                if other in by_name:
                    links[dex].add(by_name[other])
                    links[by_name[other]].add(dex)

    def line(dex):
        seen, todo = {dex}, [dex]
        while todo:
            for other in links[todo.pop()]:
                if other not in seen:
                    seen.add(other)
                    todo.append(other)
        return seen

    why = defaultdict(set)
    for dex, raw in species.items():
        forms = raw.get('forms') or []
        tags = {t for f in forms for t in f.get('tags') or []}
        moves = [f.get('movement') or {} for f in forms]
        for tag in ('legendary', 'mythical'):
            if tag in tags:
                why[dex].add(tag)
        if any(f.get('megas') for f in forms):
            for member in line(dex):
                why[member].add('mega line')
        if dex in STARTERS:
            for member in line(dex):
                why[member].add('starter line')
        for flag, reason in (('canFly', 'fly'), ('canSurf', 'swim'), ('rideable', 'ride')):
            if any(m.get(flag) for m in moves):
                why[dex].add(reason)
    OUT.write_text(json.dumps({str(k): sorted(v) for k, v in sorted(why.items())}, indent=0))
    print(len(why), 'species', Counter(r for v in why.values() for r in v).most_common())


if __name__ == '__main__':
    main()
