"""Move the arms, legs, head, jaw, tail and wings in the default battle clips.

default_clips.py gives every imported model Appear, Attack, Cast, Buff,
Wound and Dead by moving the whole body as one piece. This adds the limbs on
top, using the parts rig_roles.py finds: a punch with the lead arm, a pounce
with the front legs, a bite, a wing beat, a tail flick, a limp fall.

Every move is written as "swing this part toward up / down / forward /
back / outward", measured from the joint to the middle of the mesh the part
carries. A goal the part already points along does nothing, so the same
recipe lifts a hanging arm forward and a spread wing upward, and raises a
dog's head as well as tipping back a biped's.

Only clips with tracks on the top-level bones alone (the defaults) get limbs,
and each file is only done once (asset.extras.limbClips).

    python3 tools/limb_clips.py                 # every imported model
    python3 tools/limb_clips.py pm0025_11 ...   # just these
"""
import math
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from default_clips import ease, mat_to_quat  # noqa: E402
from pixelmon_bmd_to_glb import (  # noqa: E402
    append_accessor, quat_mul, quat_normalize, read_accessor, read_glb, write_glb,
)
from rig_roles import MON, analyse, rest_pose  # noqa: E402

VERSION = 1
GOALS = {
    'up': np.array([0.0, 1.0, 0.0]), 'down': np.array([0.0, -1.0, 0.0]),
    'forward': np.array([0.0, 0.0, 1.0]), 'back': np.array([0.0, 0.0, -1.0]),
}
# How much of a move each bone down a chain takes.
FALLOFF = {
    'head': [1.0], 'jaw': [1.0], 'neck': [0.7, 0.4],
    'lead': [1.0, 0.45, 0.25], 'off': [1.0, 0.45, 0.25],
    'front': [1.0, 0.4], 'hind': [1.0, 0.4], 'leg': [0.8, 0.3],
    'wing': [1.0, 0.5, 0.3], 'ear': [1.0, 0.5], 'feeler': [0.6, 0.5, 0.4, 0.3],
    'tail': [0.45, 0.4, 0.35, 0.3, 0.25, 0.2], 'fin': [1.0, 0.5],
}
UP_BACK = ('up', 'back')
FWD_DOWN = ('forward', 'down')

# clip: group: [(time s, {goal: degrees})]. Between keys the motion eases.
# Wings never swing below their rest pose: on beetles the "wings" are the
# shell, and tipping it down pushes the body out through it.
# 'lift' means up and back (looks up whichever way the head points); 'dip'
# is forward and down. Times line up with default_clips.CLIPS.
RECIPES = {
    'Attack': {
        'head': [(0, {}), (0.18, {'lift': 10}), (0.30, {'dip': 18}), (0.42, {'dip': 14}), (0.70, {})],
        'neck': [(0, {}), (0.18, {'lift': 8}), (0.30, {'dip': 12}), (0.42, {'dip': 10}), (0.70, {})],
        'jaw': [(0, {}), (0.18, {}), (0.27, {'down': 30}), (0.42, {'down': 24}), (0.62, {})],
        'lead': [(0, {}), (0.18, {'back': 45, 'out': 20}), (0.30, {'forward': 80, 'up': 25}),
                 (0.42, {'forward': 70, 'up': 20}), (0.70, {})],
        'off': [(0, {}), (0.18, {'forward': 15}), (0.30, {'back': 30}), (0.42, {'back': 25}), (0.70, {})],
        'front': [(0, {}), (0.18, {'back': 12}), (0.30, {'forward': 38, 'up': 15}), (0.42, {'forward': 32}), (0.70, {})],
        'hind': [(0, {}), (0.18, {'forward': 10}), (0.30, {'back': 28}), (0.42, {'back': 22}), (0.70, {})],
        'tail': [(0, {}), (0.18, {'up': 30}), (0.30, {'down': 18}), (0.42, {'down': 12}), (0.70, {})],
        'wing': [(0, {}), (0.18, {'up': 40, 'out': 20}), (0.30, {}), (0.70, {})],
        'ear': [(0, {}), (0.18, {'back': 20}), (0.30, {'back': 32}), (0.50, {'back': 12}), (0.70, {})],
        'feeler': [(0, {}), (0.18, {'up': 20, 'back': 15}), (0.30, {'forward': 40}), (0.42, {'forward': 30}), (0.70, {})],
        'fin': [(0, {}), (0.18, {'out': 25}), (0.30, {'back': 25}), (0.70, {})],
    },
    'Cast': {
        'head': [(0, {}), (0.25, {'lift': 12}), (0.65, {'lift': 12}), (0.78, {'dip': 14}), (1.0, {})],
        'neck': [(0, {}), (0.25, {'lift': 8}), (0.65, {'lift': 8}), (0.78, {'dip': 10}), (1.0, {})],
        'jaw': [(0, {}), (0.68, {}), (0.78, {'down': 28}), (0.95, {})],
        'lead': [(0, {}), (0.25, {'forward': 55, 'out': 35, 'up': 45}), (0.65, {'forward': 55, 'out': 35, 'up': 45}),
                 (0.78, {'forward': 80, 'up': 15}), (1.0, {})],
        'off': [(0, {}), (0.25, {'forward': 55, 'out': 35, 'up': 45}), (0.65, {'forward': 55, 'out': 35, 'up': 45}),
                (0.78, {'forward': 80, 'up': 15}), (1.0, {})],
        'front': [(0, {}), (0.25, {'forward': 12}), (0.65, {'forward': 12}), (0.78, {}), (1.0, {})],
        'tail': [(0, {}), (0.25, {'up': 32}), (0.65, {'up': 32}), (0.78, {}), (1.0, {})],
        'wing': [(0, {}), (0.25, {'up': 45, 'out': 35}), (0.65, {'up': 45, 'out': 35}), (0.78, {}), (1.0, {})],
        'ear': [(0, {}), (0.25, {'up': 22}), (0.65, {'up': 22}), (0.78, {'back': 15}), (1.0, {})],
        'feeler': [(0, {}), (0.25, {'up': 30, 'forward': 20}), (0.65, {'up': 30, 'forward': 20}), (0.78, {'forward': 45}), (1.0, {})],
        'fin': [(0, {}), (0.25, {'out': 30}), (0.65, {'out': 30}), (1.0, {})],
    },
    'Buff': {
        'head': [(0, {}), (0.60, {}), (0.85, {'lift': 16}), (1.2, {})],
        'lead': [(0, {}), (0.15, {'out': 40, 'up': 40}), (0.30, {'out': 10}), (0.45, {'out': 40, 'up': 40}),
                 (0.60, {}), (0.85, {'out': 55, 'up': 70}), (1.2, {})],
        'off': [(0, {}), (0.15, {'out': 40, 'up': 40}), (0.30, {'out': 10}), (0.45, {'out': 40, 'up': 40}),
                (0.60, {}), (0.85, {'out': 55, 'up': 70}), (1.2, {})],
        'tail': [(0, {}), (0.15, {'up': 25}), (0.30, {}), (0.45, {'up': 25}), (0.60, {}), (0.85, {'up': 38}), (1.2, {})],
        'wing': [(0, {}), (0.15, {'up': 40, 'out': 40}), (0.30, {}), (0.45, {'up': 40, 'out': 40}), (0.60, {}),
                 (0.85, {'up': 50, 'out': 50}), (1.2, {})],
        'ear': [(0, {}), (0.60, {}), (0.85, {'up': 22}), (1.2, {})],
        'feeler': [(0, {}), (0.60, {}), (0.85, {'out': 28, 'up': 20}), (1.2, {})],
        'fin': [(0, {}), (0.60, {}), (0.85, {'out': 28}), (1.2, {})],
    },
    'Wound': {
        'head': [(0, {}), (0.07, {'lift': 14}), (0.20, {'lift': 6}), (0.45, {})],
        'neck': [(0, {}), (0.07, {'lift': 6}), (0.20, {'lift': 2}), (0.45, {})],
        'jaw': [(0, {}), (0.07, {'down': 16}), (0.22, {}), (0.45, {})],
        'lead': [(0, {}), (0.07, {'forward': 30, 'out': 28}), (0.20, {'forward': 10, 'out': 8}), (0.45, {})],
        'off': [(0, {}), (0.07, {'forward': 30, 'out': 28}), (0.20, {'forward': 10, 'out': 8}), (0.45, {})],
        'front': [(0, {}), (0.07, {'forward': 14}), (0.20, {'forward': 5}), (0.45, {})],
        'tail': [(0, {}), (0.07, {'down': 12}), (0.20, {'down': 4}), (0.45, {})],
        'wing': [(0, {}), (0.07, {'up': 32, 'out': 15}), (0.20, {'up': 8}), (0.45, {})],
        'ear': [(0, {}), (0.07, {'back': 32}), (0.20, {'back': 14}), (0.45, {})],
        'feeler': [(0, {}), (0.07, {'back': 25}), (0.20, {'back': 8}), (0.45, {})],
    },
    'Dead': {
        'head': [(0, {}), (0.25, {'lift': 10}), (0.45, {}), (1.0, {'dip': 35}), (1.25, {'dip': 33})],
        'neck': [(0, {}), (0.45, {}), (1.0, {'dip': 18}), (1.25, {'dip': 17})],
        'jaw': [(0, {}), (0.45, {}), (1.0, {'down': 22}), (1.25, {'down': 20})],
        'lead': [(0, {}), (0.25, {'out': 20, 'forward': 15}), (0.45, {}), (1.0, {'out': 35, 'forward': 10}),
                 (1.25, {'out': 33, 'forward': 10})],
        'off': [(0, {}), (0.25, {'out': 20, 'forward': 15}), (0.45, {}), (1.0, {'out': 35, 'forward': 10}),
                (1.25, {'out': 33, 'forward': 10})],
        'front': [(0, {}), (0.45, {}), (1.0, {'forward': 22}), (1.25, {'forward': 20})],
        'hind': [(0, {}), (0.45, {}), (1.0, {'back': 18}), (1.25, {'back': 17})],
        'leg': [(0, {}), (0.45, {}), (1.0, {'forward': 16}), (1.25, {'forward': 15})],
        'tail': [(0, {}), (0.45, {}), (1.0, {'down': 22}), (1.25, {'down': 20})],
        'wing': [(0, {}), (0.45, {}), (1.0, {'out': 30}), (1.25, {'out': 28})],
        'ear': [(0, {}), (0.45, {}), (1.0, {'down': 30, 'back': 20}), (1.25, {'down': 28, 'back': 18})],
        'feeler': [(0, {}), (0.45, {}), (1.0, {'down': 30}), (1.25, {'down': 28})],
        'fin': [(0, {}), (0.45, {}), (1.0, {'down': 20}), (1.25, {'down': 18})],
    },
    'Appear': {
        'head': [(0, {}), (0.22, {'lift': 15}), (0.40, {}), (0.60, {})],
        'lead': [(0, {}), (0.22, {'out': 40, 'up': 30}), (0.40, {}), (0.60, {})],
        'off': [(0, {}), (0.22, {'out': 40, 'up': 30}), (0.40, {}), (0.60, {})],
        'tail': [(0, {}), (0.22, {'up': 32}), (0.40, {'down': 6}), (0.60, {})],
        'wing': [(0, {}), (0.22, {'up': 48, 'out': 35}), (0.40, {}), (0.60, {})],
        'ear': [(0, {}), (0.22, {'up': 25}), (0.40, {}), (0.60, {})],
        'feeler': [(0, {}), (0.22, {'up': 25}), (0.40, {}), (0.60, {})],
        'fin': [(0, {}), (0.22, {'out': 30}), (0.40, {}), (0.60, {})],
    },
}


def sample(keys, t):
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return {g: ease(a.get(g, 0.0), b.get(g, 0.0), f) for g in set(a) | set(b)}
    return dict(keys[-1][1])


def groups(info):
    """Which chains each recipe group drives."""
    parts = info['parts']
    big = lambda e: e['mass'] >= 0.008  # noqa: E731
    out = {}
    free = [e for e in parts.get('arm', []) if not e['ground'] and big(e)]
    planted = [e for e in parts.get('arm', []) + parts.get('leg', []) if e['ground'] and big(e)]
    if free:
        lead_side = 'right' if any(e['side'] == 'right' for e in free) else free[0]['side']
        out['lead'] = [e for e in free if e['side'] == lead_side]
        out['off'] = [e for e in free if e['side'] != lead_side]
    if info['stance'] in ('quadruped', 'multi'):
        out['front'] = [e for e in planted if e['end'] == 'front']
        out['hind'] = [e for e in planted if e['end'] == 'back']
    else:
        out['leg'] = [e for e in planted]
    for role in ('head', 'neck', 'jaw', 'tail', 'wing', 'ear', 'feeler', 'fin'):
        chains = [e for e in parts.get(role, []) if big(e) or role in ('jaw', 'ear')]
        if role == 'head':
            chains = sorted(chains, key=lambda e: -e['mass'])[:1]
        if role == 'neck':
            chains = sorted(chains, key=lambda e: -e['mass'])[:1]
        out[role] = chains
    return {k: v for k, v in out.items() if v}


def axis_angle(axis, deg):
    a = math.radians(deg) / 2
    return np.array([*(axis * math.sin(a)), math.cos(a)])


def add_limbs(path):
    doc, blob = read_glb(path)
    extras = doc.get('asset', {}).get('extras', {})
    if doc.get('asset', {}).get('generator') != 'pixelmon_bmd_to_glb.py' or extras.get('limbClips'):
        return None
    info = analyse(path)
    world, parent, verts, lead = rest_pose(doc, blob)
    joints = doc['skins'][0]['joints']
    kids = {j: [c for c in doc['nodes'][j].get('children', []) if c in set(joints)] for j in joints}
    centre = verts.mean(axis=0)
    by_joint = {j: verts[lead == k] for k, j in enumerate(joints)}

    def carried(j):
        parts = [by_joint[j]]
        for c in kids[j]:
            parts.append(carried(c))
        return np.concatenate(parts)

    plan = groups(info)
    bones = {}
    for group, chains in plan.items():
        weights = FALLOFF[group]
        for chain in chains:
            nodes = chain['nodes']
            if group in ('tail', 'feeler'):
                weights = [FALLOFF[group][min(i, len(FALLOFF[group]) - 1)] for i in range(len(nodes))]
            outward = 1.0 if chain['side'] == 'left' else -1.0 if chain['side'] == 'right' else 0.0
            # A "head" that carries most of the mesh (Ledyba, Lotad) is really
            # the body; full head moves would tip the whole model over.
            scale = 0.5 if group in ('head', 'neck') and chain['mass'] > 0.35 else 1.0
            for n, w in zip(nodes, [w * scale for w in weights]):
                if n in bones:
                    continue
                sub = carried(n)
                if len(sub) == 0:
                    continue
                pivot = world[n][:3, 3]
                tip = sub.mean(axis=0) - pivot
                if np.linalg.norm(tip) < 1e-6:
                    continue
                rot = world[n][:3, :3]
                rot = rot / np.linalg.norm(rot, axis=0)
                bones[n] = {'group': group, 'weight': w, 'tip': tip / np.linalg.norm(tip),
                            'out': outward or (1.0 if pivot[0] >= centre[0] else -1.0),
                            'world_q': mat_to_quat(rot)}
    if not bones:
        return None

    def goal_vec(goal, out_sign):
        if goal == 'out':
            return np.array([out_sign, 0.0, 0.0])
        return GOALS[goal]

    done = []
    for anim in doc['animations']:
        name = anim['name']
        recipe = RECIPES.get(name)
        if not recipe:
            continue
        targeted = {ch['target']['node'] for ch in anim['channels']}
        if any(n in bones for n in targeted):
            continue
        timelines = {}
        added = 0
        for n, b in bones.items():
            keys = recipe.get(b['group'])
            if not keys:
                continue
            if b['group'] not in timelines:
                # Three linear steps per eased segment are close enough and
                # far smaller than sampling every frame.
                marks = [k[0] for k in keys]
                times = np.array([a + (z - a) * f for a, z in zip(marks, marks[1:]) for f in (0, 1 / 3, 2 / 3)] + [marks[-1]])
                timelines[b['group']] = (times, append_accessor(doc, blob, times.reshape(-1, 1), 'SCALAR', bounds=True))
            times, time_idx = timelines[b['group']]
            rest = quat_normalize(np.array(doc['nodes'][n].get('rotation', [0, 0, 0, 1]), dtype=np.float64))
            wq = b['world_q']
            wq_inv = np.array([-wq[0], -wq[1], -wq[2], wq[3]])
            out = []
            for t in times:
                total = np.array([0.0, 0.0, 0.0, 1.0])
                for goal, deg in sample(keys, t).items():
                    if abs(deg) < 1e-3:
                        continue
                    for g in (UP_BACK if goal == 'lift' else FWD_DOWN if goal == 'dip' else (goal,)):
                        target = goal_vec(g, b['out'])
                        axis = np.cross(b['tip'], target)
                        s = np.linalg.norm(axis)
                        if s < 1e-4:
                            continue
                        # A goal the part nearly points along fades out, and no
                        # swing goes past the goal itself.
                        room = math.degrees(math.acos(np.clip(np.dot(b['tip'], target), -1, 1)))
                        angle = min(deg * s * b['weight'], room)
                        total = quat_mul(axis_angle(axis / s, angle), total)
                local = quat_mul(quat_mul(wq_inv, total), wq)
                q = quat_normalize(quat_mul(rest, local))
                if out and np.dot(out[-1], q) < 0:
                    q = -q
                out.append(q)
            out = np.array(out)
            if np.degrees(2 * np.arccos(np.clip(np.abs(out[:, 3]), 0, 1))).max() < 0.5:
                continue
            anim['samplers'].append({'input': time_idx, 'output': append_accessor(doc, blob, out, 'VEC4'),
                                     'interpolation': 'LINEAR'})
            anim['channels'].append({'sampler': len(anim['samplers']) - 1, 'target': {'node': n, 'path': 'rotation'}})
            added += 1
        if added:
            done.append(name)
    doc['asset'].setdefault('extras', {})['limbClips'] = VERSION
    write_glb(path, doc, blob)
    return {'stance': info['stance'], 'groups': sorted(plan), 'clips': done}


def _one(name):
    try:
        return name, add_limbs(MON / f'{name}.glb')
    except Exception as err:  # one broken file should not stop the roster
        return name, {'error': str(err)}


def main():
    names = sys.argv[1:] or sorted(p.stem for p in MON.glob('*.glb'))
    results = {}
    with ProcessPoolExecutor() as pool:
        for name, result in pool.map(_one, names, chunksize=8):
            if result:
                results[name] = result
    errors = {k: v['error'] for k, v in results.items() if 'error' in v}
    ok = {k: v for k, v in results.items() if 'error' not in v}
    print(f'limbs added to {sum(1 for v in ok.values() if v["clips"])} models')
    print('groups', Counter(g for v in ok.values() for g in v['groups']).most_common())
    print('no limbs found', sum(1 for v in ok.values() if not v['clips']))
    for k, v in list(errors.items())[:20]:
        print('error', k, v)


if __name__ == '__main__':
    main()
