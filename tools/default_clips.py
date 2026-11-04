"""Give imported Pixelmon models the battle clips the game asks for.

Pixelmon only ships idle and walk motions, so every converted model was
missing Appear, Attack, Cast, Buff, Wound and Dead. When a clip is missing
the game simply skips it: the Pokémon stands still while it attacks and keeps
standing after it faints.

These defaults move the whole body, so they work on any skeleton. They hold
the first Idle pose and move it as one piece: lunge, recoil, rear up, hop,
grow in, fall onto a side. Clips the model already has are never replaced, and only
models written by pixelmon_bmd_to_glb.py are touched.

    python3 tools/default_clips.py                 # every cast model
    python3 tools/default_clips.py pm0212_00 ...   # just these
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelmon_bmd_to_glb import (  # noqa: E402
    append_accessor, quat_mul, quat_normalize, read_accessor, read_glb, write_glb,
)

ROOT = Path(__file__).resolve().parent.parent
MON = ROOT / 'public' / 'scenery' / 'mon'
FPS = 30

# Keys: (time s, forward, up, pitch°, roll°, yaw°, scale). Forward and up are
# fractions of the model's size; pitch tips the top forward about the feet,
# roll tips it onto its side. Between keys the motion eases in and out.
CLIPS = {
    'Appear': [
        (0.00, 0, 0.00, 0, 0, 0, 0.55),
        (0.22, 0, 0.06, 0, 0, 0, 1.06),
        (0.40, 0, 0.00, 0, 0, 0, 0.98),
        (0.60, 0, 0.00, 0, 0, 0, 1.00),
    ],
    'Attack': [
        (0.00, 0.00, 0.00, 0, 0, 0, 1),
        (0.18, -0.08, 0.00, -9, 0, 0, 1),
        (0.30, 0.24, -0.02, 14, 0, 0, 1),
        (0.42, 0.22, -0.02, 11, 0, 0, 1),
        (0.70, 0.00, 0.00, 0, 0, 0, 1),
    ],
    'Cast': [
        (0.00, 0.00, 0.00, 0, 0, 0, 1),
        (0.25, -0.04, 0.05, -11, 0, 0, 1),
        (0.65, -0.04, 0.05, -11, 0, 0, 1),
        (0.78, 0.08, 0.00, 7, 0, 0, 1),
        (1.00, 0.00, 0.00, 0, 0, 0, 1),
    ],
    'Buff': [
        (0.00, 0, 0.00, 0, 0, 0, 1.00),
        (0.15, 0, 0.12, 0, 0, 0, 1.00),
        (0.30, 0, 0.00, 0, 0, 0, 1.00),
        (0.45, 0, 0.12, 0, 0, 0, 1.00),
        (0.60, 0, 0.00, 0, 0, 0, 1.00),
        (0.85, 0, 0.02, -7, 0, 0, 1.10),
        (1.20, 0, 0.00, 0, 0, 0, 1.00),
    ],
    'Wound': [
        (0.00, 0.00, 0, 0, 0, 0, 1),
        (0.07, -0.11, 0, -13, 0, 0, 1),
        (0.20, -0.06, 0, -6, 0, 0, 1),
        (0.32, -0.01, 0, 2, 0, 0, 1),
        (0.45, 0.00, 0, 0, 0, 0, 1),
    ],
    'Dead': [
        (0.00, 0, 0.00, 0, 0, 0, 1),
        (0.25, 0, 0.00, -6, -7, 0, 1),
        (0.45, 0, 0.00, 0, 0, 0, 1),
        (1.00, 0, -0.02, 4, 84, 0, 1),
        (1.10, 0, -0.02, 4, 78, 0, 1),
        (1.25, 0, -0.02, 4, 81, 0, 1),
    ],
}
# A charge-up shiver while Cast holds still: (start, end, degrees, Hz).
SHIVER = {'Cast': (0.25, 0.65, 3.0, 14.0)}


def ease(a, b, f):
    f = f * f * (3 - 2 * f)
    return a + (b - a) * f


def sample(keys, t):
    for (t0, *a), (t1, *b) in zip(keys, keys[1:]):
        if t <= t1:
            f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return [ease(x, y, f) for x, y in zip(a, b)]
    return list(keys[-1][1:])


def rot(axis, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    if axis == 'x':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def mat_to_quat(m):
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]
    return quat_normalize(np.array(q))


def first_idle_pose(doc, blob):
    """Translation and rotation of every bone in the first Idle frame."""
    pose = {}
    idle = next((a for a in doc.get('animations') or [] if a['name'] == 'Idle'), None)
    if not idle:
        return pose
    for ch in idle['channels']:
        samp = idle['samplers'][ch['sampler']]
        out = read_accessor(doc, blob, samp['output']).astype(np.float64)
        first = out[1] if samp.get('interpolation') == 'CUBICSPLINE' else out[0]
        pose.setdefault(ch['target']['node'], {})[ch['target']['path']] = first
    return pose


def add_default_clips(path):
    doc, blob = read_glb(path)
    if doc.get('asset', {}).get('generator') != 'pixelmon_bmd_to_glb.py':
        return []
    have = {a['name'] for a in doc.get('animations') or []}
    wanted = [name for name in CLIPS if name not in have]
    if not wanted:
        return []
    joints = doc['skins'][0]['joints']
    wrapper = doc['scenes'][doc.get('scene', 0)]['nodes'][0]
    roots = [n for n in doc['nodes'][wrapper].get('children', []) if n in joints]
    prim = doc['meshes'][0]['primitives'][0]
    pos = read_accessor(doc, blob, prim['attributes']['POSITION']).astype(np.float64)
    height = float(np.ptp(pos[:, 1])) or 1.0
    width = float(np.ptp(pos[:, 0])) or height
    size = (height + float(np.ptp(pos[:, 2]))) / 2 or height
    # The body tips over the edge it lands on, not about its middle.
    roll_pivot = np.array([float(pos[:, 0].min()) * 0.7, 0.0, 0.0])

    idle = first_idle_pose(doc, blob)
    base = {}
    for n in joints:
        node = doc['nodes'][n]
        got = idle.get(n, {})
        base[n] = {
            'translation': np.array(got.get('translation', node.get('translation', [0, 0, 0])), dtype=np.float64),
            'rotation': quat_normalize(np.array(got.get('rotation', node.get('rotation', [0, 0, 0, 1])), dtype=np.float64)),
        }

    # three.js puts a bone a clip does not animate back in its node pose. Make
    # that pose the first Idle frame, so the new clips only need tracks on the
    # top-level bones and everything below holds the Idle stance. The skin's
    # bind matrices are untouched, so the mesh itself does not change.
    for n in joints:
        for path_name in ('translation', 'rotation'):
            if path_name in idle.get(n, {}):
                doc['nodes'][n][path_name] = base[n][path_name].astype(float).tolist()

    for name in wanted:
        keys = CLIPS[name]
        length = keys[-1][0]
        times = np.linspace(0.0, length, int(round(length * FPS)) + 1)
        tracks = {n: {'translation': [], 'rotation': [], 'scale': []} for n in roots}
        for t in times:
            fwd, up, pitch, roll, yaw, scale = sample(keys, t)
            if name in SHIVER:
                a, b, deg, hz = SHIVER[name]
                if a <= t <= b:
                    yaw += deg * math.sin(2 * math.pi * hz * (t - a)) * math.sin(math.pi * (t - a) / (b - a))
            turn = rot('y', yaw) @ rot('x', pitch)
            tip = rot('z', roll)
            for n in roots:
                t0 = base[n]['translation']
                p = roll_pivot + tip @ (t0 - roll_pivot)
                p = turn @ (scale * p)
                p = p + np.array([0.0, up * height, fwd * size])
                q = quat_mul(mat_to_quat(turn @ tip), base[n]['rotation'])
                tracks[n]['translation'].append(p)
                tracks[n]['rotation'].append(q)
                tracks[n]['scale'].append([scale] * 3)
        time_acc = append_accessor(doc, blob, times.reshape(-1, 1), 'SCALAR', bounds=True)
        samplers, channels = [], []
        uses_scale = any(k[6] != 1 for k in keys)
        for n in roots:
            for path_name, kind in (('translation', 'VEC3'), ('rotation', 'VEC4'), ('scale', 'VEC3')):
                if path_name == 'scale' and not uses_scale:
                    continue
                out = append_accessor(doc, blob, np.array(tracks[n][path_name]), kind)
                channels.append({'sampler': len(samplers), 'target': {'node': n, 'path': path_name}})
                samplers.append({'input': time_acc, 'output': out, 'interpolation': 'LINEAR'})
        doc['animations'].append({'name': name, 'samplers': samplers, 'channels': channels})
    write_glb(path, doc, blob)
    return wanted


def main():
    names = sys.argv[1:]
    if not names:
        cast = json.loads((ROOT / 'public' / 'data' / 'cast.json').read_text())
        names = sorted({c['glb'] for c in cast})
    added = skipped = 0
    for name in names:
        path = MON / f'{name}.glb'
        if not path.exists():
            continue
        if add_default_clips(path):
            added += 1
        else:
            skipped += 1
    print(f'added clips to {added} models; {skipped} already had them or are not Pixelmon conversions')


if __name__ == '__main__':
    main()
