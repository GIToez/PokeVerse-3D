"""Add Pixelmon's own fly, swim and special motions to the imported models.

The import only converted idle and walk. About two hundred models also ship
a fly cycle, a swim cycle, a floating idle for water, or a special pose in
the jar. They become the clips Fly, Swim, SwimIdle and Special in the GLB.
The field does not ask for them yet: a mount plays Idle and Run even in the
air or on water, and the mount table's poses are the rider's, not the
Pokemon's.

Each model is converted again with Idle and Run plus its extra motions (so
the extra clips are grounded on the same Idle frame), and only the new
clips are copied into the existing file. Everything already in the file,
retimed clips and battle clips included, stays as it is. Clips a model
already has are never replaced.

    python3 tools/extra_clips.py                 # every imported model
    python3 tools/extra_clips.py pm0006_31 ...   # just these
"""
import os
import sys
import tempfile
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_pixelmon_roster import (  # noqa: E402
    BEFORE_IMPORT, EXTRA_CLIPS, JAR, MON, canonical_jobs, jar_index,
)
from pixelmon_bmd_to_glb import (  # noqa: E402
    append_accessor, build_glb, convert, read_accessor, read_glb, write_glb,
)

_ZIP = None


def transplant(dest, source, names):
    """Copy the named clips from one GLB into another, matching bones by name."""
    doc, blob = read_glb(dest)
    src, src_blob = read_glb(source)
    node_of = {n.get('name'): i for i, n in enumerate(doc['nodes'])}
    have = {a['name'] for a in doc.get('animations') or []}
    added = []
    for anim in src.get('animations') or []:
        if anim['name'] not in names or anim['name'] in have or not anim['samplers']:
            continue
        copied = {}

        def copy(idx, kind, bounds=False):
            if idx not in copied:
                copied[idx] = append_accessor(doc, blob, read_accessor(src, src_blob, idx), kind, bounds)
            return copied[idx]

        samplers, channels = [], []
        for ch in anim['channels']:
            node = node_of.get(src['nodes'][ch['target']['node']].get('name'))
            if node is None:
                continue
            samp = anim['samplers'][ch['sampler']]
            kind = src['accessors'][samp['output']]['type']
            channels.append({'sampler': len(samplers), 'target': {'node': node, 'path': ch['target']['path']}})
            samplers.append({
                'input': copy(samp['input'], 'SCALAR', bounds=True),
                'output': copy(samp['output'], kind),
                'interpolation': samp.get('interpolation', 'LINEAR'),
            })
        if channels:
            doc['animations'].append({'name': anim['name'], 'samplers': samplers, 'channels': channels})
            added.append(anim['name'])
    if added:
        write_glb(dest, doc, blob)
    return added


def _worker(job):
    global _ZIP
    if _ZIP is None:
        _ZIP = zipfile.ZipFile(JAR)
    dest = MON / f"{job['glb']}.glb"
    try:
        doc, _ = read_glb(dest)
        if doc.get('asset', {}).get('generator') != 'pixelmon_bmd_to_glb.py':
            return job['glb'], [], None
        have = {a['name'] for a in doc.get('animations') or []}
        wanted = {kind: path for kind, path in job['extra_paths'].items() if EXTRA_CLIPS[kind] not in have}
        if not wanted:
            return job['glb'], [], None
        with tempfile.TemporaryDirectory(prefix='px-extra-') as tmp:
            tmp = Path(tmp)

            def dump(key, arc):
                out = tmp / (key + Path(arc).suffix)
                out.write_bytes(_ZIP.read(arc))
                return out

            model = dump('model', job['model_path'])
            texture = dump('texture', job['texture_path'])
            base = [(dump('idle', job['idle_path']), 'Idle'), (dump('walk', job['walk_path']), 'Run')]
            usable, skipped = [], []
            for kind, arc in wanted.items():
                clip = (dump(kind, arc), EXTRA_CLIPS[kind])
                # A version-1 motion on a version-2 mesh does not convert; skip just that one.
                try:
                    convert(model, texture, base + [clip], 'x.tga', job['glb'], job['scale'])
                    usable.append(clip)
                except SystemExit as err:
                    skipped.append(f'{EXTRA_CLIPS[kind]}: {err}')
            if not usable:
                return job['glb'], [], '; '.join(skipped) or None
            built = convert(model, texture, base + usable, 'x.tga', job['glb'], job['scale'])
            temp_glb = tmp / 'extra.glb'
            temp_glb.write_bytes(build_glb(built))
            added = transplant(dest, temp_glb, {name for _, name in usable})
        return job['glb'], added, '; '.join(skipped) or None
    except Exception as err:  # one broken file should not stop the roster
        return job['glb'], [], f'error: {err}'


def main():
    names = set(sys.argv[1:])
    z = zipfile.ZipFile(JAR)
    jobs = [j for j in canonical_jobs(z, jar_index(z), BEFORE_IMPORT) if j['extra_paths']]
    z.close()
    if names:
        jobs = [j for j in jobs if j['glb'] in names]
    jobs = [j for j in jobs if (MON / f"{j['glb']}.glb").exists()]
    counts = {}
    notes = []
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        for glb, added, note in pool.map(_worker, jobs, chunksize=4):
            for name in added:
                counts[name] = counts.get(name, 0) + 1
            if note:
                notes.append(f'{glb}: {note}')
    print(f'{len(jobs)} models have extra motions in the jar')
    for name, count in sorted(counts.items()):
        print(f'  {name}: added to {count}')
    for note in notes:
        print('  skipped', note)


if __name__ == '__main__':
    main()
