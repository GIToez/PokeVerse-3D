"""Johto's east end, past the HGSS stitch: Route 27, Tohjo Falls, Route 26, the
Connection Center (Pokémon League Reception Gate), Route 28 and Mt. Silver.

The stitch in tools/hgss_world.png stops at New Bark's east edge (tile x 640),
so these areas are drawn here, on new columns east of it, in the same tile
classes as tools/johto_hgss_tiles.txt (see tools/hgss_tiles.py) and the same
HGSS tile coordinates (x east, y south, 1 tile = 1 m). Layout follows HGSS:

  New Bark -> Route 27 (surf east; boardwalk) -> Tohjo Falls (cave doors,
  ledge path along its south foot) -> Route 27 east (house, pond, grass)
  -> Route 26 north along the coast (two houses) -> Connection Center.
  The Connection Center's west door opens on Route 28, which runs west to
  the Mt. Silver Pokémon Center and cave; as in HGSS, Route 28 and Mt. Silver
  are only reached through the Connection Center.

Rock is laid in 2x2 blocks on even tile pairs, so every mountain rectangle
starts on an even tile and ends on an odd one.
"""
from __future__ import annotations

import numpy as np

WIDTH = 812

CENTER = 'sm_c_001_pokecen_01'
# Der House 2 and 3 are Kanto's halves of this gate. 4 and 5 are those meshes
# turned 180° (see tools/make_der_house_gates.py): 4 opens west, 5 opens south.
HOUSE4 = 'sm_c_der_house4'
HOUSE5 = 'sm_c_der_house5'
SIGN = 'sm_c_001_signboard_01'

# Same shape as TOWNS in johto_hgss_towns.py: (prefab, west x, east x, front y, door cfg).
EAST_BUILDINGS = {
    2227: [('sm_t_007_house_01', 720, 724, 299, 6222701)],              # friendship-check woman
    2226: [('sm_t_009_house_01_1', 770, 774, 205, 6222602),             # Day-of-Week siblings
           ('sm_c_001_house_01_red', 782, 786, 240, 6222601),           # healing house
           (HOUSE5, 779, 781, 168, 6222603)],                           # Connection Center, south door
    # House 4's 6th field is the facing: its opening is the west face, on the
    # Route 28 path (tile 774), centered on row 151. It sits north of House 5.
    2228: [('sm_c_001_house_02_blue', 740, 744, 147, 6222802),          # Celebrity's house
           (HOUSE4, 774, 151, 151, 6222801, 'w')],
    2114: [(CENTER, 684, 689, 157, 6211402)],
}

# (cfg, model, x, y): door points (162) and arrivals (171) not tied to a building front.
# Each Tohjo Falls pair is a cave passage: entering one side sends you to the other.
EAST_POINTS = [
    (7222699, 171, 780.5, 169.5),
    (3222771, 162, 699.6, 300.5), (7222771, 171, 697.5, 300.5),
    (3222772, 162, 716.4, 300.5), (7222772, 171, 718.5, 300.5),
    (6222702, 162, 699.6, 308.5), (7222702, 171, 697.5, 308.5),
    (6222703, 162, 716.4, 308.5), (7222703, 171, 718.5, 308.5),
    (3222773, 162, 699.6, 316.5), (7222773, 171, 697.5, 316.5),
    (3222774, 162, 716.4, 316.5), (7222774, 171, 718.5, 316.5),
    (6211401, 162, 670.5, 150.4), (7211401, 171, 670.5, 152.5),
    (7211499, 171, 676.5, 160.5),
]

EAST_PROPS = [(SIGN, 678.5, 305.4), (SIGN, 782.5, 318.4), (SIGN, 772.5, 148.4), (SIGN, 700.5, 152.4)]

EAST_LANDMARKS = {2114: (644, 94, 700, 176), 2123: (698, 284, 718, 330)}
# Route 28 comes first: its east end shares columns with the Route 26 box.
EAST_ROUTES = {2228: (698, 118, 776, 168), 2226: (756, 118, 812, 348), 2227: (641, 280, 770, 348)}

# Mountains that stack past the usual 4 rock layers: tile rect -> most layers (1.02 m each).
PEAKS = {(646, 94, 698, 150): 9, (756, 120, 812, 150): 6}

# Route 28 and Mt. Silver: reached through the Connection Center, not by land.
DOOR_ONLY = (641, 90, 776, 158)
CHECKS = {'Route 27': (690, 307), 'Tohjo Falls ledge': (706, 325), 'Route 27 east': (740, 304),
          'Route 26': (779, 230), 'Connection Center step': (780, 170)}
DOOR_CHECKS = {'Route 28': (760, 151), 'Mt. Silver': (670, 152)}


def _hsh(i, j, salt=0):
    i, j = int(i), int(j)
    v = (i * 73856093) ^ (j * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) & 0x7fffffff


def draw_east(g):
    """Paint the east areas onto g (rows x WIDTH), right of New Bark."""
    def rect(c, x0, y0, x1, y1):
        """Inclusive tile rectangle."""
        g[y0:y1 + 1, x0:x1 + 1] = c

    def ragged(c, x0, y0, x1, y1, side, depth, salt):
        """A border band along one side of a rectangle, 1..depth tiles thick."""
        if side in 'ns':
            for x in range(x0, x1 + 1):
                d = 1 + _hsh(x // 2, salt) % depth
                if side == 'n':
                    g[y0:y0 + d, x] = c
                else:
                    g[y1 - d + 1:y1 + 1, x] = c
        else:
            for y in range(y0, y1 + 1):
                d = 1 + _hsh(y // 2, salt) % depth
                if side == 'w':
                    g[y, x0:x0 + d] = c
                else:
                    g[y, x1 - d + 1:x1 + 1] = c

    # Sea: Route 27's open water from New Bark east, the bay south of Route 27 east and
    # Route 26's coast.
    rect('W', 641, 296, 677, 347)
    rect('W', 676, 328, 811, 347)
    rect('W', 794, 150, 811, 347)

    # Route 27, landfall east of the sea: forest to the north, beach to the south.
    rect('G', 676, 288, 699, 323)
    rect('F', 644, 284, 699, 295)
    ragged('F', 644, 296, 677, 301, 'n', 4, 1)
    rect('N', 676, 320, 699, 327)
    rect('T', 680, 312, 688, 318)
    rect('K', 641, 306, 677, 309)                     # boardwalk from New Bark's east path
    rect('D', 676, 307, 699, 308)
    rect('D', 690, 299, 691, 327)
    rect('D', 691, 300, 699, 301)
    rect('D', 691, 316, 699, 317)

    # Tohjo Falls: a cliff split by the waterfall; cave doors on both faces, and the
    # ledge path along its south foot (rows 324-327) bridges the falls' outflow.
    rect('M', 700, 284, 715, 323)
    rect('W', 706, 286, 707, 327)
    rect('D', 690, 324, 767, 327)
    rect('K', 706, 324, 707, 327)

    # Route 27 east: grass between forest and bay, the house, a pond with a plank
    # bridge, the route's tall grass, and the path on to Route 26.
    rect('G', 716, 288, 767, 323)
    rect('F', 716, 278, 767, 289)
    ragged('F', 716, 290, 767, 293, 'n', 3, 2)
    rect('W', 728, 298, 737, 311)
    rect('T', 740, 296, 757, 313)
    rect('D', 716, 300, 719, 301)
    rect('D', 716, 316, 719, 317)
    rect('D', 716, 304, 781, 305)
    rect('D', 716, 300, 717, 317)
    rect('K', 728, 304, 737, 305)
    rect('N', 716, 322, 767, 323)

    # Route 26: a long coastal strip north to the Connection Center, forest on the
    # west, beach and sea on the east, grass, two rock outcrops, a pond, two houses.
    rect('G', 768, 168, 791, 327)
    rect('G', 776, 158, 791, 167)
    rect('G', 786, 150, 791, 157)
    rect('F', 758, 150, 767, 289)
    ragged('F', 768, 168, 773, 289, 'w', 3, 3)
    rect('N', 792, 150, 793, 327)
    for (x0, y0, x1, y1) in ((769, 280, 777, 297), (783, 255, 791, 268), (769, 215, 776, 230),
                             (783, 180, 791, 195), (777, 168, 786, 175)):
        rect('T', x0, y0, x1, y1)
    rect('M', 784, 206, 791, 215)
    rect('M', 768, 244, 775, 253)
    rect('W', 784, 272, 791, 277)
    rect('D', 779, 160, 780, 327)
    rect('D', 774, 206, 779, 207)
    rect('D', 780, 241, 783, 242)

    # Cliffs behind the Connection Center (toward Victory Road), and the rock wall
    # that keeps Route 28 apart from Route 26.
    rect('M', 756, 120, 811, 149)
    rect('M', 700, 158, 775, 167)

    # Route 28: forest road from the Connection Center's west door to Mt. Silver.
    rect('G', 698, 136, 775, 157)
    rect('F', 698, 126, 755, 137)
    ragged('F', 698, 138, 755, 141, 'n', 3, 4)
    rect('F', 712, 138, 719, 143)
    rect('F', 750, 152, 757, 157)
    rect('T', 704, 145, 725, 155)
    rect('T', 745, 140, 765, 148)
    rect('D', 698, 150, 775, 151)
    rect('D', 741, 148, 742, 149)

    # Mt. Silver: the mountain mass, its foothill plain with the Pokémon Center, the
    # cave mouth on the south face, a pond, and forest closing the plain to the south.
    rect('M', 646, 94, 697, 149)
    for y in range(94, 150, 2):
        cut = 2 * (_hsh(y, 5) % 3)
        g[y:y + 2, 646:646 + cut] = '.'
    rect('G', 646, 150, 699, 171)
    rect('F', 646, 168, 699, 175)
    ragged('F', 646, 160, 651, 171, 'w', 3, 6)
    rect('W', 652, 156, 659, 163)
    rect('T', 662, 160, 676, 166)
    rect('D', 670, 150, 671, 159)
    rect('D', 671, 158, 699, 159)
    rect('D', 686, 157, 687, 158)

    # A few rocks in the open sea.
    sea = (g[:, 641:] == 'W')
    for y, x in zip(*np.nonzero(sea)):
        x += 641
        if (y >= 328 or x <= 677 or x >= 796) and _hsh(x, y, 7) % 53 == 0:
            g[y, x] = 'R'
    return g
