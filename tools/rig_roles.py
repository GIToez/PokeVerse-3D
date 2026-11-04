"""Find each imported model's body parts and how it stands.

Bone names in Pixelmon rigs are a mix of conventions (LArm, left upper arm,
arm2.l, Bone.004_R) and plenty of plain "Bone"s, so names alone are not
enough. A part is tagged from its name when the name says what it is;
otherwise from the shape of the mesh the bone carries in the first Idle
frame: a chain that reaches the ground is a leg, one that trails behind the
body is a tail, one that sticks out sideways above the hips is an arm.

The stance comes from the pose, not from the species: the number of limbs
that touch the ground in that same frame. Two is a biped, four a quadruped,
more is a many-legged bug, none is a flyer (if it has wings), a serpent (if
it lies long and low) or a floater.

    python3 tools/rig_roles.py                 # writes tools/rig_roles.json
    python3 tools/rig_roles.py pm0025_11 ...   # print these
"""
import json
import re
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pixelmon_bmd_to_glb import read_accessor, read_glb  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MON = ROOT / 'public' / 'scenery' / 'mon'
OUT = ROOT / 'tools' / 'rig_roles.json'
# Hand fixes from reviewing the tuned list, keyed by model ("pm0006_31") or
# by species ("pm0006"); "core" makes a bone part of the body so the
# battle clips leave it alone: {"pm0380": {"role": {"Neck1": "core"}}}
OVERRIDES = ROOT / 'tools' / 'rig_overrides.json'

LIMBS = ('arm', 'leg', 'wing', 'tail', 'fin', 'feeler')
# First match wins, so the specific words come before the ones they contain.
ROLE_WORDS = [
    ('skip', r'hat|hair|whisker|wisker|eye|pupil|brow|lid|tooth|teeth|tongue|tungue|ik|pole|target|ctrl|control|item'),
    ('jaw', r'jaw|mouth|chin|mandible|lowerbeak|beaklower|beak_?bottom'),
    ('neck', r'neck'),
    ('head', r'head|skull|face'),
    ('wing', r'wing'),
    ('tail', r'tail'),
    ('fin', r'fin(?!ger)|flipper'),
    ('leg', r'leg|thigh|knee|foot|feet|toe|shin|calf|ankle|paw|heel|hoof'),
    ('arm', r'arm|shoulder(?!s)|hand|finger|elbow|wrist|claw|pincer|fist|scythe|blade'),
    ('ear', r'(?<![a-z])ears?(?![a-z])|^[lr]ears?$|ear_|_ear|earl|earr'),
    ('feeler', r'feeler|tentacle|tendril|antenna|vine|whip'),
    ('core', r'spine|body|torso|chest|belly|waist|hips?|pelvis|^back$|root|origin|bottom|shoulders|upper|lower|stomach|abdomen|thorax|core|main|base|pm'),
]
ROLE_RE = [(role, re.compile(words)) for role, words in ROLE_WORDS]


def name_role(name):
    n = re.sub(r'([a-z])([A-Z])', r'\1_\2', str(name or '')).lower()
    if n == 'blender_implicit':
        return 'core'
    for role, rx in ROLE_RE:
        if rx.search(n):
            return role
    return None


def name_side(name):
    raw = str(name or '')
    n = raw.lower()
    if re.search(r'left|(^|[_.\s-])l([_.\s\d-]|$)', n) or re.match(r'^L[A-Z]', raw):
        return 'left'
    if re.search(r'right|(^|[_.\s-])r([_.\s\d-]|$)', n) or re.match(r'^R[A-Z]', raw):
        return 'right'
    return None


def quat_matrix(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def node_matrix(node):
    m = np.eye(4)
    if 'matrix' in node:
        return np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T
    m[:3, :3] = quat_matrix(node.get('rotation', [0, 0, 0, 1])) * np.array(node.get('scale', [1, 1, 1]))
    m[:3, 3] = node.get('translation', [0, 0, 0])
    return m


def rest_pose(doc, blob):
    """World matrix of every node and the skinned mesh, both in the node (first Idle) pose."""
    parent = {}
    for i, n in enumerate(doc['nodes']):
        for c in n.get('children', []):
            parent[c] = i
    world = {}

    def rec(i):
        if i not in world:
            local = node_matrix(doc['nodes'][i])
            world[i] = local if i not in parent else rec(parent[i]) @ local
        return world[i]

    for i in range(len(doc['nodes'])):
        rec(i)
    skin = doc['skins'][0]
    prim = doc['meshes'][0]['primitives'][0]
    pos = read_accessor(doc, blob, prim['attributes']['POSITION']).astype(np.float64)
    jnt = read_accessor(doc, blob, prim['attributes']['JOINTS_0']).astype(np.int64)
    wts = read_accessor(doc, blob, prim['attributes']['WEIGHTS_0']).astype(np.float64)
    ibm = read_accessor(doc, blob, skin['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
    joints = skin['joints']
    mats = np.array([world[j] @ ibm[k] for k, j in enumerate(joints)])
    homo = np.c_[pos, np.ones(len(pos))]
    skinned = np.zeros((len(pos), 3))
    for k in range(4):
        skinned += wts[:, k:k + 1] * np.einsum('nij,nj->ni', mats[jnt[:, k]], homo)[:, :3]
    lead = jnt[np.arange(len(jnt)), np.argmax(wts, axis=1)]
    return world, parent, skinned, lead


def analyse(path):
    doc, blob = read_glb(path)
    if doc.get('asset', {}).get('generator') != 'pixelmon_bmd_to_glb.py':
        return None
    world, parent, verts, lead = rest_pose(doc, blob)
    joints = doc['skins'][0]['joints']
    jset = set(joints)
    names = {j: doc['nodes'][j].get('name', '') for j in joints}
    kids = {j: [c for c in doc['nodes'][j].get('children', []) if c in jset] for j in joints}
    low, high = verts.min(axis=0), verts.max(axis=0)
    size = high - low
    height = float(size[1]) or 1.0
    centre = verts.mean(axis=0)
    by_joint = {j: verts[lead == k] for k, j in enumerate(joints)}

    sub_cache = {}

    def subtree(j):
        if j not in sub_cache:
            parts = [by_joint[j]] + [subtree(c) for c in kids[j]]
            sub_cache[j] = np.concatenate(parts) if parts else np.zeros((0, 3))
        return sub_cache[j]

    order = []
    stack = [j for j in joints if parent.get(j) not in jset]
    while stack:
        j = stack.pop()
        order.append(j)
        stack.extend(kids[j])

    fixes = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    stem = Path(path).stem
    fix = fixes.get(stem) or fixes.get(stem[:6], {})
    forced = fix.get('role', {})
    role = {}
    from_name = {}
    for j in order:
        own = forced.get(names[j]) or name_role(names[j])
        if names[j] in forced:
            role[j] = own
            from_name[j] = True
            continue
        up = role.get(parent.get(j))
        if up in LIMBS + ('jaw', 'ear', 'skip') and own in (None, 'core'):
            own = up
        elif up == 'head' and own in (None, 'core'):
            own = 'head'
        from_name[j] = own is not None
        role[j] = own

    total = len(verts)

    def pivot(j):
        return world[j][:3, 3]

    # Untagged chains hanging off the body: tag them by where their mesh sits.
    for j in order:
        if role[j] is not None or role.get(parent.get(j)) not in (None, 'core', 'neck'):
            continue
        sub = subtree(j)
        if len(sub) < max(12, 0.015 * total):
            continue
        p = pivot(j)
        mid = sub.mean(axis=0)
        reach = mid - p
        if sub[:, 1].min() - low[1] < 0.06 * height and p[1] - low[1] < 0.55 * height and len(sub) < 0.35 * total:
            guess = 'leg'
        elif mid[2] < centre[2] - 0.22 * size[2] and reach[2] < -0.1 * size[2] and len(sub) < 0.3 * total:
            guess = 'tail'
        elif abs(mid[0] - centre[0]) > 0.22 * size[0] and mid[1] - low[1] > 0.3 * height and len(sub) < 0.25 * total:
            guess = 'arm'
        else:
            continue
        stack = [j]
        while stack:
            k = stack.pop()
            if role[k] in (None, 'core'):
                role[k] = guess
                stack.extend(kids[k])

    for j in order:
        if role[j] is None:
            role[j] = 'core'

    # The head is the top of the body if nothing was named head.
    if not any(r == 'head' for r in role.values()):
        cands = [j for j in order if role[j] in ('core', 'neck') and len(by_joint[j]) >= 8]
        if cands:
            top = max(cands, key=lambda j: by_joint[j][:, 1].mean() + 0.3 * by_joint[j][:, 2].mean())
            if top != order[0] and by_joint[top][:, 1].mean() - low[1] > 0.55 * height:
                role[top] = 'head'

    def chain_roots(r):
        return [j for j in order if role[j] == r and role.get(parent.get(j)) != r and len(subtree(j)) >= 4]

    limbs = {}
    for r in LIMBS + ('head', 'jaw', 'neck', 'ear'):
        roots = chain_roots(r)
        entries = []
        for j in roots:
            sub = subtree(j)
            p = pivot(j)
            chain = [j]
            while True:
                nxt = [c for c in kids[chain[-1]] if role[c] == r]
                if not nxt:
                    break
                chain.append(max(nxt, key=lambda c: len(subtree(c))))
            mid = sub.mean(axis=0)
            side = name_side(names[j]) or (
                'left' if mid[0] - centre[0] > 0.06 * size[0] else
                'right' if mid[0] - centre[0] < -0.06 * size[0] else 'middle')
            n = names[j].lower()
            end = 'front' if re.search(r'front|fore', n) else 'back' if re.search(r'back|hind|rear', n) else (
                'front' if mid[2] > centre[2] + 0.08 * size[2] else
                'back' if mid[2] < centre[2] - 0.08 * size[2] else 'middle')
            sole = sub[sub[:, 1] <= sub[:, 1].min() + 0.03 * height]
            entries.append({
                'foot': sole[:, [0, 2]].mean(axis=0),
                'bones': [names[c] for c in chain],
                'nodes': chain,
                'side': side,
                'end': end,
                'low': float(sub[:, 1].min() - low[1]),
                'mass': round(len(sub) / total, 3),
                'named': from_name[j],
            })
        if entries:
            limbs[r] = entries

    # A foot counts as planted when it is about as low as the lowest foot, so a
    # hovering idle or one lifted foot does not turn a biped into a floater.
    # Front legs are often rigged as arms (Rattata's shoulders and forearms).
    all_legs = [e for e in limbs.get('leg', []) + limbs.get('arm', []) if e['mass'] >= 0.01]
    floor = min((e['low'] for e in all_legs), default=None)
    for r, entries in limbs.items():
        # A hand resting near the floor (a sitting Snorlax) is not a front leg.
        slack = 0.025 if r == 'arm' else 0.08
        for e in entries:
            low_point = e.pop('low')
            e['ground'] = bool(floor is not None and low_point <= floor + slack * height and floor < 0.2 * height)
    legs = [e for e in all_legs if e['ground']]
    # Toes, claws and feet are often split into separate chains under one leg,
    # so count the places the model touches the floor, not the chains.
    # On each side, feet closer together front to back than about a sixth of
    # the height are one foot (a shin and its toes); a wider gap is the next leg.
    def foot_side(e):
        dx = e['foot'][0] - centre[0]
        return 'left' if dx > 0.06 * size[0] else 'right' if dx < -0.06 * size[0] else 'middle'

    contacts = 0
    for side in ('left', 'right', 'middle'):
        zs = sorted(float(e['foot'][1]) for e in legs if foot_side(e) == side)
        if zs:
            contacts += 1 + sum(1 for a, b in zip(zs, zs[1:]) if b - a > 0.17 * height)
    for entries in limbs.values():
        for e in entries:
            e.pop('foot')
    wings = limbs.get('wing', [])
    long_low = size[2] > 1.6 * size[1] and size[2] > 1.3 * size[0]
    if contacts >= 5:
        stance = 'multi'
    elif contacts >= 3:
        stance = 'quadruped' if contacts == 4 or not any(not e['ground'] for e in limbs.get('arm', [])) else 'biped'
    elif contacts >= 1:
        stance = 'bird' if wings and not limbs.get('arm') else 'biped'
    elif wings:
        stance = 'flyer'
    elif long_low:
        stance = 'serpent'
    else:
        stance = 'floater'
    stance = fix.get('stance', stance)
    return {
        'stance': stance,
        'contacts': contacts,
        'height': round(height, 3),
        'size': [round(float(s), 3) for s in size],
        'bones': len(joints),
        'tagged': round(sum(1 for j in joints if from_name[j]) / len(joints), 2),
        'parts': limbs,
    }


def _one(name):
    try:
        return name, analyse(MON / f'{name}.glb')
    except Exception as err:  # one broken file should not stop the roster
        return name, {'error': str(err)}


def main():
    names = sys.argv[1:]
    todo = names or sorted(p.stem for p in MON.glob('*.glb'))
    found = {}
    with ProcessPoolExecutor() as pool:
        for name, result in pool.map(_one, todo, chunksize=8):
            if result:
                found[name] = result
    if names:
        for name, result in found.items():
            print(name, json.dumps(result, indent=1))
        return
    OUT.write_text(json.dumps(found, separators=(',', ':'), sort_keys=True))
    print(f'{len(found)} models')
    print('stance', Counter(r.get('stance', 'error') for r in found.values()).most_common())
    parts = Counter(p for r in found.values() for p in r.get('parts', {}))
    print('models with each part', parts.most_common())


if __name__ == '__main__':
    main()
