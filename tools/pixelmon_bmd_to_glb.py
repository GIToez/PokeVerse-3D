#!/usr/bin/env python3
"""Turn one Pixelmon .bmd (version 2, xz) into a skinned GLB this game can load.

Pixelmon 9 stores the mesh and each animation as a separate .bmd next to texture.png.
The overworld expects public/scenery/mon/pm<dex>_<form>.glb, an embedded texture whose
name is pm<dex>_<form>_Body1.tga, and the shiny swap at
public/scenery/mon/shiny/<that name>_1.png. Idle and Run are the clip names the field uses.
"""

import argparse
import json
import lzma
import math
import struct
from pathlib import Path

import numpy as np

# Minecraft draws these models in 1/16 block units, then multiplies by the species scale.
PIXEL_SCALE = 1.0 / 16.0
TICKS_PER_SECOND = 25.0


def read_bmd(path, with_mesh=True):
    data = Path(path).read_bytes()
    if not data or data[0] != 2:
        raise SystemExit(f'{path} is not a Pixelmon BMD version 2 file')
    # Some Pixelmon meshes are xz streams with the footer cut off. A strict
    # decompress raises, but the bytes before the cut are a complete model.
    dec = lzma.LZMADecompressor(format=lzma.FORMAT_XZ)
    try:
        raw = dec.decompress(data[1:])
    except lzma.LZMAError:
        raw = b''
    if not raw:
        raw = lzma.decompress(data[1:])
    o = 0

    def u8():
        nonlocal o
        v = raw[o]
        o += 1
        return v

    def i8():
        v = u8()
        return v - 256 if v >= 128 else v

    def i16():
        nonlocal o
        v = struct.unpack_from('>h', raw, o)[0]
        o += 2
        return v

    def f32():
        nonlocal o
        v = struct.unpack_from('>f', raw, o)[0]
        o += 4
        return v

    def cstr():
        nonlocal o
        chars = []
        while True:
            ch = struct.unpack_from('>H', raw, o)[0]
            o += 2
            if ch == 0:
                break
            chars.append(chr(ch))
        return ''.join(chars)

    bones = []
    for _ in range(i16()):
        bones.append({'id': i16(), 'parent': i16(), 'name': cstr()})
    frames = []
    for s in range(i16()):
        frame = {}
        for _ in range(i16()):
            bid = i16()
            frame[bid] = tuple(f32() for _ in range(6))
        if s:
            for b in bones:
                frame.setdefault(b['id'], frames[-1][b['id']])
        else:
            missing = [b['id'] for b in bones if b['id'] not in frame]
            if missing:
                raise SystemExit(f'{path} is missing bind bones {missing}')
        frames.append(frame)
    # Animation files use the same container, including an empty or unused triangle block.
    tris = []
    for _ in range(i16()):
        cstr()
    for _ in range(i16()):
        i8()
        verts = []
        for _corner in range(3):
            i16()
            p = (f32(), f32(), f32())
            n = (f32(), f32(), f32())
            uv = (f32(), f32())
            w = [(i16(), f32()) for _link in range(u8())]
            if with_mesh:
                verts.append((p, n, uv, w))
        if with_mesh:
            tris.append(verts)
    if o != len(raw):
        raise SystemExit(f'{path} decoded {o} of {len(raw)} bytes')
    return bones, frames, tris


def euler_matrix(rx, ry, rz):
    """Same XYZ matrix Pixelmon's animation quaternion matches (not the transposed copy)."""
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    return np.array([
        [cz * cy, cz * sy * sx - sz * cx, sz * sx + cz * sy * cx],
        [sz * cy, cz * cx + sz * sy * sx, sz * sy * cx - cz * sx],
        [-sy, cy * sx, cy * cx],
    ], dtype=np.float64)


def quat_from_euler(rx, ry, rz):
    """Pixelmon createRotationQuaternion(roty, rotz, rotx). Returns xyzw."""
    pitch, yaw, roll = ry, rz, rx
    sp, cp = math.sin(pitch * 0.5), math.cos(pitch * 0.5)
    sy, cy = math.sin(yaw * 0.5), math.cos(yaw * 0.5)
    sr, cr = math.sin(roll * 0.5), math.cos(roll * 0.5)
    cpcy = cp * cy
    spsy = sp * sy
    return np.array([
        sr * cpcy - cr * spsy,
        cr * sp * cy + sr * cp * sy,
        cr * cp * sy - sr * sp * cy,
        cr * cpcy + sr * spsy,
    ], dtype=np.float64)


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ], dtype=np.float64)


def quat_normalize(q):
    n = np.linalg.norm(q)
    return q / n if n else np.array([0, 0, 0, 1], dtype=np.float64)


def local_matrix(pose):
    x, y, z, rx, ry, rz = pose
    m = np.eye(4)
    m[:3, :3] = euler_matrix(rx, ry, rz)
    m[:3, 3] = (x, y, z)
    return m


def world_matrices(bones, pose, bind):
    by_id = {b['id']: b for b in bones}
    world = {}

    def rec(bid):
        if bid in world:
            return world[bid]
        src = pose if bid in pose else bind
        local = local_matrix(src[bid])
        parent = by_id[bid]['parent']
        world[bid] = local if parent < 0 else rec(parent) @ local
        return world[bid]

    for b in bones:
        rec(b['id'])
    return world


def top_weights(weights):
    chosen = sorted(weights, key=lambda item: -item[1])[:4]
    if not chosen:
        return [(0, 1.0)]
    total = sum(w for _, w in chosen)
    if total <= 1e-8:
        return [(chosen[0][0], 1.0)]
    return [(bid, w / total) for bid, w in chosen]


def convert(model_path, texture_path, animations, texture_name, node_name, model_scale):
    bones, bind_frames, tris = read_bmd(model_path, True)
    bind = bind_frames[0]
    bones = sorted(bones, key=lambda b: b['id'])
    if [b['id'] for b in bones] != list(range(len(bones))):
        raise SystemExit('bone ids are not a dense 0..n range; the joint map would be wrong')

    scale = model_scale * PIXEL_SCALE
    # Z-up (feet toward +Z) to Y-up, facing +Z, which is the direction the field walks.
    rotation = np.array([
        [1, 0, 0],
        [0, 0, 1],
        [0, -1, 0],
    ], dtype=np.float64)
    q_rotation = quat_normalize(np.array([-math.sqrt(0.5), 0, 0, math.sqrt(0.5)]))

    bind_world = world_matrices(bones, bind, bind)
    positions = []
    normals = []
    uvs = []
    joints = []
    weights = []
    for tri in tris:
        for p, n, uv, w in tri:
            positions.append(rotation @ (np.array(p) * scale))
            normal = rotation @ np.array(n)
            length = np.linalg.norm(normal)
            normals.append(normal / length if length else np.array([0, 1, 0], dtype=np.float64))
            # Pixelmon UVs are OpenGL (v = 0 at the bottom). glTF is the other way.
            uvs.append((uv[0], 1.0 - uv[1]))
            chosen = top_weights(w)
            joints.append([chosen[i][0] if i < len(chosen) else 0 for i in range(4)])
            weights.append([chosen[i][1] if i < len(chosen) else 0.0 for i in range(4)])

    # Pose the skeleton in the same space as the vertices, then drop it onto y = 0
    # using the first frame of Idle (the pose the game measures).
    # Animation files often omit a bone the mesh has (Scizor's Hat). Their bone
    # ids then shift, so a channel has to be matched by name, not by id.
    # Blender exports often leave more than one top-level bone (blender_implicit,
    # a loose Hat, the real root). Every one of them has to hang off the model
    # and get the Y-up turn, or three.js loses the bones under it.
    root_ids = [b['id'] for b in bones if b['parent'] < 0]
    root_id = root_ids[0]
    anim_data = []
    by_name = {b['name']: b['id'] for b in bones}
    for path, clip_name in animations:
        anim_bones, frames, _ = read_bmd(path, False)
        anim_id = {b['name']: b['id'] for b in anim_bones}
        missing = [b['name'] for b in bones if b['name'] not in anim_id]
        unknown = [b['name'] for b in anim_bones if b['name'] not in by_name]
        if unknown:
            # Extra channels belong to a different skeleton. Drop them instead of
            # shifting every later bone, which is what bent Scizor's limbs.
            odd = [n for n in unknown if n != 'Hat' and not str(n).startswith('root')]
            if odd:
                print(f'{clip_name}: ignoring animation bones the mesh does not have: {odd}')
        remapped = []
        for frame in frames:
            pose = {}
            for bone in anim_bones:
                mesh_id = by_name.get(bone['name'])
                if mesh_id is None:
                    continue
                if bone['id'] in frame:
                    pose[mesh_id] = frame[bone['id']]
            remapped.append(pose)
        known = {by_name[b['name']] for b in anim_bones if b['name'] in by_name}
        odd_missing = [n for n in missing if n != 'Hat' and not str(n).startswith('root')]
        if odd_missing:
            print(f'{clip_name}: no keys for {odd_missing}; those bones stay in the bind pose')
        anim_data.append((clip_name, remapped, known))

    idle_frames = next((frames for name, frames, _ in anim_data if name == 'Idle'), None)
    pose0 = idle_frames[0] if idle_frames else bind
    posed = world_matrices(bones, pose0, bind)
    ibm_bind = {bid: np.linalg.inv(mat) for bid, mat in bind_world.items()}
    skinned = []
    for tri in tris:
        for p, _n, _uv, w in tri:
            acc = np.zeros(3)
            for bid, weight in top_weights(w):
                acc += weight * ((posed[bid] @ ibm_bind[bid] @ np.array([*p, 1.0]))[:3])
            skinned.append(rotation @ (acc * scale))
    ground = float(np.min(np.array(skinned)[:, 1])) if skinned else 0.0
    positions = [p + np.array([0, -ground, 0]) for p in positions]

    def bake_pose(pose):
        baked = {}
        for b in bones:
            src = pose[b['id']] if b['id'] in pose else bind[b['id']]
            x, y, z, rx, ry, rz = src
            translation = np.array([x, y, z]) * scale
            quat = quat_normalize(quat_from_euler(rx, ry, rz))
            if b['parent'] < 0:
                translation = rotation @ translation
                translation = translation + np.array([0, -ground, 0])
                quat = quat_normalize(quat_mul(q_rotation, quat))
            baked[b['id']] = (translation, quat)
        return baked

    def baked_world(baked):
        by_id = {b['id']: b for b in bones}
        world = {}

        def trs(translation, quat):
            x, y, z, w = quat
            rot = np.array([
                [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
            ])
            m = np.eye(4)
            m[:3, :3] = rot
            m[:3, 3] = translation
            return m

        def rec(bid):
            if bid in world:
                return world[bid]
            parent = by_id[bid]['parent']
            local = trs(*baked[bid])
            world[bid] = local if parent < 0 else rec(parent) @ local
            return world[bid]

        for b in bones:
            rec(b['id'])
        return world

    bind_baked = bake_pose(bind)
    ibm = {bid: np.linalg.inv(mat) for bid, mat in baked_world(bind_baked).items()}

    clips = []
    for clip_name, frames, known in anim_data:
        times = np.arange(len(frames), dtype=np.float32) / np.float32(TICKS_PER_SECOND)
        tracks = {}
        prev = {}
        for frame in frames:
            baked = bake_pose(frame)
            for b in bones:
                if b['id'] not in known:
                    continue
                translation, quat = baked[b['id']]
                if b['id'] in prev and np.dot(prev[b['id']], quat) < 0:
                    quat = -quat
                prev[b['id']] = quat
                tracks.setdefault(b['id'], {'t': [], 'r': []})
                tracks[b['id']]['t'].append(translation.astype(np.float32))
                tracks[b['id']]['r'].append(quat.astype(np.float32))
        clips.append((clip_name, times, tracks))

    height = float(np.max(np.array(skinned)[:, 1]) - ground) if skinned else 0.0
    return {
        'node_name': node_name,
        'texture_name': texture_name,
        'texture': Path(texture_path).read_bytes(),
        'bones': bones,
        'root_id': root_id,
        'root_ids': root_ids,
        'bind': bind_baked,
        'ibm': ibm,
        'positions': np.array(positions, dtype=np.float32),
        'normals': np.array(normals, dtype=np.float32),
        'uvs': np.array(uvs, dtype=np.float32),
        'joints': np.array(joints, dtype=np.uint16),
        'weights': np.array(weights, dtype=np.float32),
        'clips': clips,
        'height': height,
    }


def pad(buf, n, fill):
    extra = (-len(buf)) % n
    return buf + bytes([fill]) * extra


def build_glb(model):
    blobs = []
    views = []

    def push(array, target):
        raw = np.ascontiguousarray(array).tobytes()
        offset = sum(len(b) for b in blobs)
        # 4-byte align each view
        pad_n = (-offset) % 4
        if pad_n:
            blobs.append(b'\x00' * pad_n)
            offset += pad_n
        blobs.append(raw)
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw), 'target': target} if target else
                     {'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw)})
        return len(views) - 1

    pos_view = push(model['positions'], 34962)
    nrm_view = push(model['normals'], 34962)
    uv_view = push(model['uvs'], 34962)
    joint_view = push(model['joints'], 34962)
    weight_view = push(model['weights'], 34962)
    ibm = np.stack([model['ibm'][b['id']].flatten(order='F') for b in model['bones']]).astype(np.float32)
    ibm_view = push(ibm, None)
    image = model['texture']
    image_offset = sum(len(b) for b in blobs)
    pad_n = (-image_offset) % 4
    if pad_n:
        blobs.append(b'\x00' * pad_n)
        image_offset += pad_n
    blobs.append(image)
    image_view = len(views)
    views.append({'buffer': 0, 'byteOffset': image_offset, 'byteLength': len(image)})

    accessors = [
        {'bufferView': pos_view, 'componentType': 5126, 'count': len(model['positions']), 'type': 'VEC3',
         'min': model['positions'].min(0).tolist(), 'max': model['positions'].max(0).tolist()},
        {'bufferView': nrm_view, 'componentType': 5126, 'count': len(model['normals']), 'type': 'VEC3'},
        {'bufferView': uv_view, 'componentType': 5126, 'count': len(model['uvs']), 'type': 'VEC2'},
        {'bufferView': joint_view, 'componentType': 5123, 'count': len(model['joints']), 'type': 'VEC4'},
        {'bufferView': weight_view, 'componentType': 5126, 'count': len(model['weights']), 'type': 'VEC4'},
        {'bufferView': ibm_view, 'componentType': 5126, 'count': len(model['bones']), 'type': 'MAT4'},
    ]

    # nodes: 0 wrapper mesh+armature, 1 mesh, 2+ bones in id order
    bone_node = {b['id']: 2 + i for i, b in enumerate(model['bones'])}
    nodes = [
        {'name': model['node_name'], 'children': [1] + [bone_node[r] for r in model['root_ids']]},
        {'name': model['node_name'] + '_mesh', 'mesh': 0, 'skin': 0},
    ]
    for b in model['bones']:
        translation, quat = model['bind'][b['id']]
        node = {
            'name': b['name'],
            'translation': translation.astype(float).tolist(),
            'rotation': quat.astype(float).tolist(),
        }
        kids = [bone_node[c['id']] for c in model['bones'] if c['parent'] == b['id']]
        if kids:
            node['children'] = kids
        nodes.append(node)

    animations = []
    for clip_name, times, tracks in model['clips']:
        time_view = push(times.astype(np.float32), None)
        time_acc = len(accessors)
        accessors.append({'bufferView': time_view, 'componentType': 5126, 'count': int(times.shape[0]), 'type': 'SCALAR',
                          'min': [float(times[0])], 'max': [float(times[-1])]})
        samplers = []
        channels = []
        for bone in model['bones']:
            if bone['id'] not in tracks:
                continue
            t_view = push(np.stack(tracks[bone['id']]['t']).astype(np.float32), None)
            r_view = push(np.stack(tracks[bone['id']]['r']).astype(np.float32), None)
            t_acc = len(accessors)
            accessors.append({'bufferView': t_view, 'componentType': 5126, 'count': int(times.shape[0]), 'type': 'VEC3'})
            r_acc = len(accessors)
            accessors.append({'bufferView': r_view, 'componentType': 5126, 'count': int(times.shape[0]), 'type': 'VEC4'})
            channels.append({'sampler': len(samplers), 'target': {'node': bone_node[bone['id']], 'path': 'translation'}})
            samplers.append({'input': time_acc, 'output': t_acc, 'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers), 'target': {'node': bone_node[bone['id']], 'path': 'rotation'}})
            samplers.append({'input': time_acc, 'output': r_acc, 'interpolation': 'LINEAR'})
        animations.append({'name': clip_name, 'samplers': samplers, 'channels': channels})

    bin_blob = b''.join(blobs)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'pixelmon_bmd_to_glb.py'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': nodes,
        'skins': [{
            'joints': [bone_node[b['id']] for b in model['bones']],
            'inverseBindMatrices': 5,
            **({'skeleton': bone_node[model['root_id']]} if len(model['root_ids']) == 1 else {}),
        }],
        'meshes': [{
            'name': model['node_name'],
            'primitives': [{
                'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2, 'JOINTS_0': 3, 'WEIGHTS_0': 4},
                'mode': 4,
            }],
        }],
        'materials': [{
            'name': model['texture_name'],
            'doubleSided': True,
            'pbrMetallicRoughness': {
                'baseColorTexture': {'index': 0},
                'metallicFactor': 0,
                'roughnessFactor': 1,
            },
        }],
        'textures': [{'name': model['texture_name'], 'sampler': 0, 'source': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9729, 'wrapS': 10497, 'wrapT': 10497}],
        'images': [{'name': model['texture_name'], 'mimeType': 'image/png', 'bufferView': image_view}],
        'animations': animations,
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': len(bin_blob)}],
    }
    # primitive needs the material; set after so the index is obvious
    gltf['meshes'][0]['primitives'][0]['material'] = 0

    text = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    text = pad(text, 4, 0x20)
    blob = pad(bin_blob, 4, 0)
    out = bytearray()
    out += b'glTF'
    out += struct.pack('<II', 2, 12 + 8 + len(text) + 8 + len(blob))
    out += struct.pack('<I4s', len(text), b'JSON')
    out += text
    out += struct.pack('<I4s', len(blob), b'BIN\x00')
    out += blob
    return bytes(out)


def retime_glb(path, speeds):
    """Play listed clips faster or slower. Poses stay the same.

    The field asks for Idle and Run by those names and plays them at 1×.
    The monsters that already ship use about 1.6s of idle and a 0.8s walk
    cycle. A Pixelmon clip spread over four seconds looks like a stiff idle
    at that rate, so `speeds` is how many times faster each clip should run.
    """
    doc, blob = read_glb(path)
    done = set()
    for anim in doc.get('animations') or []:
        speed = speeds.get(anim['name'])
        if not speed or speed == 1:
            continue
        for samp in anim['samplers']:
            idx = samp['input']
            if idx in done:
                continue
            done.add(idx)
            acc = doc['accessors'][idx]
            view = doc['bufferViews'][acc['bufferView']]
            off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
            count = acc['count']
            times = np.frombuffer(blob[off:off + 4 * count], dtype=np.float32).copy()
            times /= np.float32(speed)
            blob[off:off + 4 * count] = times.tobytes()
            acc['min'] = [float(times[0])]
            acc['max'] = [float(times[-1])]
    write_glb(path, doc, blob)
    return {name: round(doc['accessors'][anim['samplers'][0]['input']]['max'][0], 3)
            for anim in doc['animations']
            for name in [anim['name']]}


def read_glb(path):
    data = Path(path).read_bytes()
    json_len = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    bin_at = 20 + json_len
    bin_len = struct.unpack_from('<I', data, bin_at)[0]
    return doc, bytearray(data[bin_at + 8:bin_at + 8 + bin_len])


def write_glb(path, doc, blob):
    blob = pad(bytes(blob), 4, 0)
    doc['buffers'][0]['byteLength'] = len(blob)
    text = pad(json.dumps(doc, separators=(',', ':')).encode('utf-8'), 4, 0x20)
    out = bytearray()
    out += b'glTF'
    out += struct.pack('<II', 2, 12 + 8 + len(text) + 8 + len(blob))
    out += struct.pack('<I4s', len(text), b'JSON')
    out += text
    out += struct.pack('<I4s', len(blob), b'BIN\x00')
    out += blob
    Path(path).write_bytes(out)


GLTF_TYPES = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
GLTF_WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def accessor_slice(doc, idx):
    acc = doc['accessors'][idx]
    view = doc['bufferViews'][acc['bufferView']]
    if view.get('byteStride'):
        raise SystemExit('interleaved buffers are not supported')
    dtype = np.dtype(GLTF_TYPES[acc['componentType']])
    width = GLTF_WIDTH[acc['type']]
    off = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    return off, dtype, width, acc['count']


def read_accessor(doc, blob, idx):
    off, dtype, width, count = accessor_slice(doc, idx)
    arr = np.frombuffer(bytes(blob[off:off + dtype.itemsize * width * count]), dtype=dtype)
    return arr.reshape(count, width)


def append_accessor(doc, blob, arr, kind, bounds=False):
    while len(blob) % 4:
        blob.append(0)
    data = np.ascontiguousarray(arr, dtype=np.float32)
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': data.nbytes})
    blob.extend(data.tobytes())
    acc = {'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': len(data), 'type': kind}
    if bounds:
        acc['min'] = data.min(axis=0).tolist()
        acc['max'] = data.max(axis=0).tolist()
    doc['accessors'].append(acc)
    return len(doc['accessors']) - 1


def axis_angle_quat(axis, angle):
    s = math.sin(angle / 2)
    return np.array([axis[0] * s, axis[1] * s, axis[2] * s, math.cos(angle / 2)])


def flap_axes(doc, blob, bones):
    """Hinge axis for each wing bone, in that bone's own frame.

    A wing flaps about a line in its own plane, square to the line from the
    joint out to the middle of the wing. The plane is the flattest direction
    of the vertices the bone carries; its normal is turned away from the body
    so a left and a right wing mirror each other and beat together.
    """
    skin = doc['skins'][0]
    prim = doc['meshes'][0]['primitives'][0]
    pos = read_accessor(doc, blob, prim['attributes']['POSITION']).astype(np.float64)
    joints = read_accessor(doc, blob, prim['attributes']['JOINTS_0'])
    weights = read_accessor(doc, blob, prim['attributes']['WEIGHTS_0']).astype(np.float64)
    ibm = read_accessor(doc, blob, skin['inverseBindMatrices']).astype(np.float64)
    names = [doc['nodes'][n].get('name') for n in skin['joints']]
    lead = joints[np.arange(len(joints)), np.argmax(weights, axis=1)]
    middle = pos.mean(axis=0)
    axes = {}
    for bone in bones:
        j = names.index(bone)
        world = np.linalg.inv(ibm[j].reshape(4, 4).T)
        rot = world[:3, :3]
        rot = rot / np.linalg.norm(rot, axis=0)
        carried = pos[lead == j]
        if len(carried) < 3:
            raise SystemExit(f'{bone} carries no vertices; nothing to flap')
        centre = carried.mean(axis=0)
        reach = centre - world[:3, 3]
        _, vecs = np.linalg.eigh(np.cov((carried - centre).T))
        normal = vecs[:, 0]
        if np.dot(normal, centre - middle) < 0:
            normal = -normal
        hinge = np.cross(reach, normal)
        hinge /= np.linalg.norm(hinge)
        axes[bone] = rot.T @ hinge
    return axes


def source_axis(doc, blob, node, least_degrees=2.0):
    """Main axis a bone already swings about in the first clip that moves it."""
    for anim in doc.get('animations') or []:
        for ch in anim['channels']:
            if ch['target']['node'] != node or ch['target']['path'] != 'rotation':
                continue
            q = read_accessor(doc, blob, anim['samplers'][ch['sampler']]['output']).astype(np.float64)
            q[np.sum(q * q[0], axis=1) < 0] *= -1
            mean = quat_normalize(q.mean(axis=0))
            inverse = np.array([-mean[0], -mean[1], -mean[2], mean[3]])
            spins = []
            for key in q:
                rel = quat_mul(inverse, quat_normalize(key))
                if rel[3] < 0:
                    rel = -rel
                size = np.linalg.norm(rel[:3])
                angle = 2 * math.atan2(size, rel[3])
                spins.append(rel[:3] / size * angle if size > 1e-9 else np.zeros(3))
            spins = np.array(spins)
            if np.degrees(2 * np.linalg.norm(spins, axis=1).max()) < least_degrees:
                continue
            _, _, vt = np.linalg.svd(spins - spins.mean(axis=0))
            return vt[0]
    return None


def flutter_glb(path, wings, beats):
    """Replace the wing motion in every listed clip with an even flutter.

    `wings` maps bone name to (swing in degrees either side, lag in radians).
    `beats` maps clip name to wing beats per second; it is rounded so each
    clip holds whole beats and still loops cleanly. The rest of the body is
    left exactly as the source animated it.
    """
    doc, blob = read_glb(path)
    axes = flap_axes(doc, blob, list(wings))
    node_of = {n.get('name'): i for i, n in enumerate(doc['nodes'])}
    # Where the source already flutters a wing, keep the direction it chose.
    for bone in wings:
        own = source_axis(doc, blob, node_of[bone])
        if own is not None:
            axes[bone] = own if np.dot(own, axes[bone]) >= 0 else -own
    report = {}
    for anim in doc.get('animations') or []:
        rate = beats.get(anim['name'])
        if not rate:
            continue
        times = read_accessor(doc, blob, anim['samplers'][0]['input'])[:, 0].astype(np.float64)
        length = float(times[-1])
        cycles = max(1, round(rate * length))
        freq = cycles / length
        # Linear keys need about ten samples a beat or a fast flap turns into a
        # lumpy zig-zag, so the wings get their own timeline.
        key_times = np.linspace(0.0, length, cycles * 10 + 1)
        time_acc = append_accessor(doc, blob, key_times.astype(np.float32).reshape(-1, 1), 'SCALAR', bounds=True)
        by_node = {ch['target']['node']: ch for ch in anim['channels'] if ch['target']['path'] == 'rotation'}
        for bone, (swing, lag) in wings.items():
            node = node_of[bone]
            ch = by_node.get(node)
            if ch:
                samp = anim['samplers'][ch['sampler']]
                src = read_accessor(doc, blob, samp['output']).astype(np.float64)
                if samp.get('interpolation', 'LINEAR') == 'CUBICSPLINE':
                    src = src[1::3]
                src[np.sum(src * src[0], axis=1) < 0] *= -1
                base = quat_normalize(src.mean(axis=0))
            else:
                base = quat_normalize(np.array(doc['nodes'][node].get('rotation', [0, 0, 0, 1]), dtype=np.float64))
                samp = {}
                anim['samplers'].append(samp)
                anim['channels'].append({'sampler': len(anim['samplers']) - 1,
                                         'target': {'node': node, 'path': 'rotation'}})
            angles = np.radians(swing) * np.sin(2 * math.pi * freq * key_times - lag)
            out = np.array([quat_mul(base, axis_angle_quat(axes[bone], a)) for a in angles], dtype=np.float32)
            samp['input'] = time_acc
            samp['output'] = append_accessor(doc, blob, out, 'VEC4')
            samp['interpolation'] = 'LINEAR'
        report[anim['name']] = round(freq, 2)
    write_glb(path, doc, blob)
    return report


def main():
    parser = argparse.ArgumentParser(description='Convert one Pixelmon BMD into a field GLB')
    parser.add_argument('--model', required=True)
    parser.add_argument('--texture', required=True)
    parser.add_argument('--shiny')
    parser.add_argument('--idle', required=True)
    parser.add_argument('--walk', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--shiny-out')
    parser.add_argument('--texture-name', required=True)
    parser.add_argument('--node-name', required=True)
    parser.add_argument('--scale', type=float, default=1.9)
    args = parser.parse_args()
    model = convert(
        args.model, args.texture,
        [(args.idle, 'Idle'), (args.walk, 'Run')],
        args.texture_name, args.node_name, args.scale,
    )
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(build_glb(model))
    if args.shiny and args.shiny_out:
        dest = Path(args.shiny_out)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(Path(args.shiny).read_bytes())
    print(f'wrote {out} ({out.stat().st_size} bytes), idle height {model["height"]:.3f} m')


if __name__ == '__main__':
    main()
