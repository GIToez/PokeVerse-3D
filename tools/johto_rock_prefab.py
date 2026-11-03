"""Which rock prefab a Johto mountain block should use.

The blocks are already on the 2 m grid. Placement never rotates a mesh, so the
piece's suffix is its facing. These height maps were measured on scenery/kanto.glb
(north is -z, east is +x, the same axes the mesh has once it is in the world):

  rock_face_g_1_s           convex corner, high NW, cliff to the SE
  rock_face_g_2_s           convex corner, high NE, cliff to the SW
  rock_face_g_3_s           convex corner, high SE, cliff to the NW
  rock_face_g_4_s           convex corner, high SW, cliff to the NE
  rock_face_g_z_1_s_c_1_s   straight edge, high W, cliff to the E
  rock_face_g_z_2_s_b_s     straight edge, high N, cliff to the S
  rock_face_g_z_3_s_b_s     straight edge, high E, cliff to the W
  rock_face_g_z_4_s_b_s     straight edge, high S, cliff to the N
  rock_face_g_z_1_n_s       concave corner, notch in the SE
  rock_face_g_z_2_n_s       concave corner, notch in the SW
  rock_face_g_z_3_n_s       concave corner, notch in the NW
  rock_face_g_z_4_n_s       concave corner, notch in the NE

A block with rock on all four sides has no full flat cube in this set.
rock_ground_s is the flat cap Kanto uses on a plateau. The block under the
cap stays a solid straight piece so the cell still blocks movement.
"""

# Solid stand-in under a cap. Its own top is hidden by the cap.
ROCK_FILL = 'rock_face_g_z_2_s_b_s'
ROCK_CAP = 'rock_ground_s'
# Mesh is 1.02 m tall. The cap sits 2 cm above that so the two tops do not flicker.
CAP_LIFT = 1.04


def rock_choice(n, e, s, w, ne=False, se=False, sw=False, nw=False):
    """Neighbor flags in world directions. Returns (prefab name, wants_cap).

    wants_cap is true only for a fully enclosed block. The caller places
    ROCK_CAP one layer above the block, and only when nothing is stacked
    on that column already.
    """
    if n and e and s and w:
        missing = [d for d, on in (('ne', ne), ('se', se), ('sw', sw), ('nw', nw)) if not on]
        if len(missing) == 1:
            return {
                'se': 'rock_face_g_z_1_n_s',
                'sw': 'rock_face_g_z_2_n_s',
                'nw': 'rock_face_g_z_3_n_s',
                'ne': 'rock_face_g_z_4_n_s',
            }[missing[0]], False
        return ROCK_FILL, True
    if n and s and e and not w:
        return 'rock_face_g_z_3_s_b_s', False
    if n and s and w and not e:
        return 'rock_face_g_z_1_s_c_1_s', False
    if e and w and n and not s:
        return 'rock_face_g_z_2_s_b_s', False
    if e and w and s and not n:
        return 'rock_face_g_z_4_s_b_s', False
    # One block thick: the straight piece keeps the wall continuous on one face.
    if n and s:
        return 'rock_face_g_z_1_s_c_1_s', False
    if e and w:
        return 'rock_face_g_z_2_s_b_s', False
    if n and w:
        return 'rock_face_g_1_s', False
    if n and e:
        return 'rock_face_g_2_s', False
    if s and e:
        return 'rock_face_g_3_s', False
    if s and w:
        return 'rock_face_g_4_s', False
    if n:
        return 'rock_face_g_z_2_s_b_s', False
    if s:
        return 'rock_face_g_z_4_s_b_s', False
    if e:
        return 'rock_face_g_z_3_s_b_s', False
    if w:
        return 'rock_face_g_z_1_s_c_1_s', False
    if nw:
        return 'rock_face_g_1_s', False
    if ne:
        return 'rock_face_g_2_s', False
    if se:
        return 'rock_face_g_3_s', False
    if sw:
        return 'rock_face_g_4_s', False
    return 'rock_face_g_1_s', False
