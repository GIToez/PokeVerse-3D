"""Play every imported Pixelmon Idle and Run at the pace the field expects.

The field plays Idle and Run at 1x and never scales the walk to the ground
speed. The hand-made monsters use about a 2 s breath and a 0.8 s stride;
Pixelmon clips are often two or three times slower, so the walk reads as a
stiff idle (Scizor was the first one fixed this way).

Some clips hold several identical cycles, so the speed comes from the
length of one cycle, not from the length of the clip. Clips are only ever
sped up, and only once: the speed-up is recorded in the file's
asset.extras.retimed. Poses are unchanged.

    python3 tools/retime_roster.py                 # every Pixelmon model
    python3 tools/retime_roster.py pm0212_00 ...   # just these
    python3 tools/retime_roster.py --dry-run       # report only
"""
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelmon_bmd_to_glb import read_accessor, read_glb, write_glb  # noqa: E402

MON = Path(__file__).resolve().parent.parent / 'public' / 'scenery' / 'mon'
FPS = 30

# clip: (target seconds per cycle, only retime above this, fastest speed-up)
TARGET = {'Idle': (2.0, 2.4, 2.0), 'Run': (0.8, 0.9, 3.0)}


def clip_length(doc, anim):
    return max((doc['accessors'][s['input']]['max'][0] for s in anim['samplers']), default=0.0)


def pose_curve(doc, blob, anim, length):
    """Every rotation and translation channel sampled on one even timeline."""
    n = max(2, int(round(length * FPS)))
    t = np.arange(n) / n * length
    cols = []
    for ch in anim['channels']:
        path = ch['target']['path']
        if path not in ('rotation', 'translation'):
            continue
        samp = anim['samplers'][ch['sampler']]
        times = read_accessor(doc, blob, samp['input'])[:, 0].astype(np.float64)
        vals = read_accessor(doc, blob, samp['output']).astype(np.float64)
        if samp.get('interpolation') == 'CUBICSPLINE':
            vals = vals[1::3]
        if path == 'rotation':
            vals[np.sum(vals * vals[0], axis=1) < 0] *= -1
        else:
            vals = vals * 5
        cols.extend(np.interp(t, times, vals[:, k]) for k in range(vals.shape[1]))
    if not cols:
        return None
    curve = np.array(cols).T
    return curve - curve.mean(axis=0)


def cycle_length(doc, blob, anim, most=8, alike=0.8):
    """Seconds in one cycle: the clip length over the most whole repeats it holds."""
    length = clip_length(doc, anim)
    curve = pose_curve(doc, blob, anim, length) if length else None
    if curve is None:
        return length
    energy = float((curve * curve).sum())
    if energy < 1e-9:
        return length
    best = length
    for k in range(2, most + 1):
        shift = len(curve) / k
        if shift < 6:
            break
        moved = np.roll(curve, -int(round(shift)), axis=0)
        if float((curve * moved).sum()) / energy > alike:
            best = length / k
    return best


def plan(doc, blob):
    speeds = {}
    for anim in doc.get('animations') or []:
        if anim['name'] not in TARGET or not anim['samplers']:
            continue
        target, above, fastest = TARGET[anim['name']]
        cycle = cycle_length(doc, blob, anim)
        if cycle > above:
            speeds[anim['name']] = (min(fastest, cycle / target), cycle)
    return speeds


def retime(path, dry_run=False):
    doc, blob = read_glb(path)
    if doc.get('asset', {}).get('generator') != 'pixelmon_bmd_to_glb.py':
        return None
    extras = doc['asset'].setdefault('extras', {})
    if 'retimed' in extras:
        return None
    speeds = plan(doc, blob)
    if not speeds or dry_run:
        return {k: round(v[0], 2) for k, v in speeds.items()}
    owners = {}
    for anim in doc['animations']:
        for samp in anim['samplers']:
            owners.setdefault(samp['input'], set()).add(anim['name'])
    copied = {}
    for anim in doc['animations']:
        name = anim['name']
        if name not in speeds:
            continue
        speed = speeds[name][0]
        for samp in anim['samplers']:
            idx = samp['input']
            if owners[idx] != {name}:
                # A timeline shared with another clip gets its own copy first.
                if (idx, name) not in copied:
                    acc = dict(doc['accessors'][idx])
                    doc['accessors'].append(acc)
                    copied[(idx, name)] = len(doc['accessors']) - 1
                    owners[copied[(idx, name)]] = {name, 'copy'}
                samp['input'] = copied[(idx, name)]
        for idx in {s['input'] for s in anim['samplers']}:
            times = read_accessor(doc, blob, idx)[:, 0].astype(np.float32) / np.float32(speed)
            if 'copy' in owners[idx]:
                view = dict(doc['bufferViews'][doc['accessors'][idx]['bufferView']])
                while len(blob) % 4:
                    blob.append(0)
                view['byteOffset'], view['byteLength'] = len(blob), times.nbytes
                blob.extend(times.tobytes())
                doc['bufferViews'].append(view)
                doc['accessors'][idx] = {**doc['accessors'][idx], 'bufferView': len(doc['bufferViews']) - 1, 'byteOffset': 0}
                owners[idx] = {name}
            else:
                acc = doc['accessors'][idx]
                view = doc['bufferViews'][acc['bufferView']]
                off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
                blob[off:off + times.nbytes] = times.tobytes()
            doc['accessors'][idx]['min'] = [float(times.min())]
            doc['accessors'][idx]['max'] = [float(times.max())]
    extras['retimed'] = {k: round(v[0], 4) for k, v in speeds.items()}
    write_glb(path, doc, blob)
    return {k: round(v[0], 2) for k, v in speeds.items()}


def _one(args):
    name, dry_run = args
    try:
        return name, retime(MON / f'{name}.glb', dry_run)
    except Exception as err:  # one broken file should not stop the roster
        return name, f'error: {err}'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry_run = '--dry-run' in sys.argv
    names = args or sorted(p.stem for p in MON.glob('*.glb'))
    report = {}
    with ProcessPoolExecutor() as pool:
        for name, result in pool.map(_one, [(n, dry_run) for n in names], chunksize=16):
            if result:
                report[name] = result
    errors = {k: v for k, v in report.items() if isinstance(v, str)}
    done = {k: v for k, v in report.items() if not isinstance(v, str)}
    for clip in TARGET:
        sped = [v[clip] for v in done.values() if clip in v]
        if sped:
            print(f'{clip}: {len(sped)} models sped up, median {np.median(sped):.2f}x, max {max(sped):.2f}x')
    for name, err in errors.items():
        print(name, err)
    if '--json' in sys.argv:
        print(json.dumps(done))


if __name__ == '__main__':
    main()
