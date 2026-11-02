"""Johto buildings, one prefab each, on the spots the HGSS stitch draws them.

Coordinates are HGSS tiles of tools/hgss_world.png (x east, y south, tile
edges, 1 tile = 1 m). Each building is
    (prefab, west edge x, east edge x, front edge y, door cfg or None)
and stands centred between the two x edges with its front (door side, +z)
on the front edge, so every Center, Mart, Gym and house sits where HGSS puts
it. Doors are listed in the order each town's door cfgs are handed out.
"""

CENTER = 'sm_c_001_pokecen_01'
MART = 'sm_c_001_shop_01'
GYM = 'sm_c_001_gym_01'
TOWER = 'sm_r_209_losttower_01'
BURNED = 'sm_d_011_batower_01_1'
BLUE = 'sm_c_001_house_02_blue'
PURPLE = 'sm_c_001_house_02_purple'
PINK = 'sm_r_210_loghouse_01_pink'
JAPAN = 'sm_t_004_house_01_p'
ORANGE = ['sm_t_005_house_01_1', 'sm_t_011_house_02_1_1', 'sm_t_005_house_01_1 2']
YELLOW = ['sm_t_007_house_01_1_yellow', 'sm_t_009_house_01_1_1yellow', 'sm_t_007_house_01_1_1yellow_w',
          'sm_t_009_house_01_2', 'sm_t_007_house_01_3']
STALL = 'sm_t_009_house_01_2'
STATUE = 'sm_c_001_statue_01'
GYMS = {GYM, 'sm_c_001_gym_02'}


def yellow(i):
    return YELLOW[i % len(YELLOW)]


# Goldenrod's yellow-roofed blocks: (west x, east x, front y).
GOLDENROD_HOMES = [
    (281, 285, 261.9), (285, 289, 260.9), (289, 293, 262.9), (311, 315, 258.9), (315, 319, 258.9),
    (313, 317, 261.9), (299, 303, 267.9), (303, 307, 267.9), (307, 311, 266.9), (307, 311, 273.9),
    (311, 315, 275.9), (314, 318, 277.9), (307, 311, 278.9), (310, 314, 280.9), (315, 319, 282.9),
    (313, 317, 285.9), (314, 318, 288.9), (315, 319, 292.9), (301, 305, 292.9), (301, 305, 297.9),
    (309, 313, 297.9), (313, 317, 297.9), (305, 309, 286.9), (278, 282, 280.9), (282, 286, 279.9),
    (277, 281, 284.9), (284, 288, 286.9), (274, 278, 289.9), (283, 287, 289.9), (276, 280, 291.9),
    (277, 281, 295.9), (281, 285, 296.9), (286, 290, 293.9), (285, 289, 297.9), (290, 294, 294.9),
]

TOWNS = {
    2101: {'name': 'New Bark Town', 'box': (600, 296, 641, 324), 'buildings': [
        ('sm_c_yjs_house', 620, 627, 310, 6210101),        # Elm's lab
        ('sm_t_001_house_01', 628, 633, 309, 6210102),     # player's house
        ('sm_t_007_house_01', 618, 622, 318, 6210103),     # Elm's house
        ('sm_t_007_house_01_2', 629, 633, 319, 6210104),
    ]},
    2102: {'name': 'Cherrygrove City', 'box': (484, 294, 512, 340), 'buildings': [
        (MART, 491, 495, 307.9, 6210205),
        (CENTER, 498, 503, 307.9, 6210204),
        (PINK, 486, 490, 313.9, 6210201),                   # Guide Gent
        ('sm_c_001_house_01_red', 494, 498, 315.9, 6210202),
        (PINK, 502, 506, 317.9, 6210203),
        ('sm_c_001_house_01_red', 499, 503, 331.9, None),
        (PINK, 503, 507, 332.9, None),
        ('sm_c_001_house_01_red', 492, 496, 335.9, None),
    ]},
    2103: {'name': 'Violet City', 'box': (395, 162, 445, 224), 'buildings': [
        (TOWER, 422, 428, 175, 6210301),                    # Sprout Tower
        (GYM, 413, 420, 202.6, 6210302),
        (CENTER, 433, 438, 215.9, 6210303),
        (MART, 405, 409, 202.9, 6210304),
        ('sm_t_001_house_01', 430, 435, 201.9, 6210305),   # Pokémon Academy
        (PURPLE, 401, 405, 187.9, 6210306),
        (PURPLE, 396, 400, 196.9, 6210307),
        (PURPLE, 421, 425, 220.9, 6210308),
        (PURPLE, 425, 429, 220.9, 6210309),
    ]},
    2104: {'name': 'Azalea Town', 'box': (320, 343, 362, 368), 'buildings': [
        (JAPAN, 342, 346, 356.9, 6210401),                  # Kurt's house
        (GYM, 340, 347, 364.75, 6210402),
        (CENTER, 346, 351, 356.9, 6210403),
        (MART, 356, 360, 354.9, 6210404),
        (JAPAN, 337, 341, 351.9, 6210405),
        (JAPAN, 355, 359, 363.9, 6210406),
    ]},
    2105: {'name': 'Goldenrod City', 'box': (252, 252, 320, 300), 'buildings': [
        (GYM, 300, 307, 260.9, 6210501),
        (CENTER, 288, 293, 286.9, 6210502),
        (TOWER, 276, 284, 272.6, 6210503),                  # Radio Tower
        ('sm_c_bzd_house', 299, 305, 286.9, 6210504),       # Department Store
        ('sm_t_011_house_02_1', 286, 293, 280, 6210509),    # Game Corner
        ('sm_t_009_house_01_1', 307, 311, 257.9, 6210510),  # Flower Shop
        ('sm_t_006_bicycleshop_01', 305, 309, 290.9, 6210511),
        ('sm_t_011_house_02', 284, 293, 272.9, 6210512),    # Magnet Train Station
        ('sm_t_003_globaltradecenter_01', 252, 261, 271, 6210513),  # Global Terminal
        ('sm_c_001_house_02_blue', 300, 307, 274.9, 6210514),        # Underground entrance
        *[(yellow(i), x0, x1, fy, d) for i, ((x0, x1, fy), d) in
          enumerate(zip(GOLDENROD_HOMES, [6210505, 6210506, 6210507, 6210508] + [None] * 40))],
    ]},
    2106: {'name': 'Ecruteak City', 'box': (296, 104, 362, 146), 'buildings': [
        (BURNED, 307, 313, 115, 6210601),                   # Burned Tower
        ('sm_t_011_house_02_1', 326, 333, 121, 6210602),    # Dance Theater
        (GYM, 311, 318, 142.5, 6210603),
        (CENTER, 332, 337, 142.9, 6210604),
        (MART, 342, 346, 134.8, 6210605),
        (JAPAN, 332.7, 338.3, 134.8, 6210606),
        (ORANGE[0], 311, 315, 127.9, 6210607),
        (ORANGE[1], 322, 326, 128.9, 6210608),
        (ORANGE[2], 312, 316, 134.8, 6210610),
        (ORANGE[0], 322, 326, 142.9, 6210611),
        (ORANGE[1], 343, 347, 142.9, None),
        (JAPAN, 321, 326, 121, None),
        (JAPAN, 349, 355, 97.75, None),                     # Bell Tower gate
    ], 'props': [(STATUE, 324.5, 134.2)]},
    2107: {'name': 'Olivine City', 'box': (196, 176, 236, 205), 'buildings': [
        (GYM, 204, 211, 186.5, 6210701),
        (CENTER, 208, 213, 200.9, 6210702),
        (MART, 216, 220, 193.9, 6210703),
        ('sm_c_bzd_house', 200, 207, 200.9, 6210704),       # Olivine Café
        (BLUE, 206, 210, 194, 6210705),
        (BLUE, 210, 214, 194, 6210706),
        (BLUE, 224, 228, 185.9, 6210707),
        (BLUE, 229, 233, 187.9, 6210708),
        (BLUE, 221, 225, 199.9, 6210709),
    ]},
    2108: {'name': 'Cianwood City', 'box': (4, 220, 44, 248), 'buildings': [
        (GYM, 20, 26, 228.9, 6210801),
        (CENTER, 15, 20, 235.9, 6210802),
        (STALL, 28, 33, 232, None),
        (STALL, 28, 33, 236, None),
        (STALL, 28, 33, 240, 6210805),
        (STALL, 14, 19, 240, 6210806),
    ]},
    2109: {'name': 'Mahogany Town', 'box': (448, 113, 482, 146), 'buildings': [
        ('sm_c_001_house_01_red', 465, 469, 134.9, 6210901),  # souvenir shop
        (GYM, 457, 464, 141.6, 6210902),
        (CENTER, 469, 474, 141.9, 6210903),
        ('sm_c_001_house_01_red', 474, 478, 134.9, 6210904),
    ]},
    2110: {'name': 'Blackthorn City', 'box': (588, 108, 628, 146), 'buildings': [
        (GYM, 602, 609, 119.9, 6211001),
        (CENTER, 609, 614, 138.9, 6211002),
        (MART, 603, 607, 138.9, 6211003),
        ('sm_t_001_house_01_red', 597, 602, 130.9, 6211004),
        ('sm_t_001_house_01_red', 619, 624, 132.9, 6211005),
        ('sm_t_001_house_01_red', 592, 597, 138.9, 6211006),
    ]},
}
SIZES = {  # (x0, z0, x1, z1) local footprint from public/scenery/kanto.glb
    'sm_c_001_gym_01': (-3.43, -2.18, 3.43, 2.18),
    'sm_c_001_house_01_red': (-2.04, -1.35, 2.04, 1.35),
    'sm_c_001_house_02_blue': (-2.04, -1.35, 2.04, 1.35),
    'sm_c_001_house_02_purple': (-2.04, -1.35, 2.04, 1.35),
    'sm_c_001_pokecen_01': (-2.63, -1.95, 2.63, 1.95),
    'sm_c_001_shop_01': (-2.0, -1.33, 2.0, 1.33),
    'sm_c_001_statue_01': (-0.46, -0.59, 0.46, 0.59),
    'sm_c_bzd_house': (-3.77, -2.57, 3.83, 2.64),
    'sm_c_yjs_house': (-3.83, -2.46, 3.83, 2.76),
    'sm_d_011_batower_01_1': (-3.5, -3.01, 3.5, 3.01),
    'sm_r_209_losttower_01': (-3.75, -4.42, 3.75, 4.1),
    'sm_r_210_loghouse_01_pink': (-2.75, -2.06, 2.75, 2.06),
    'sm_t_001_house_01': (-2.75, -1.87, 2.75, 1.87),
    'sm_t_001_house_01_red': (-2.75, -1.87, 2.75, 1.87),
    'sm_t_003_globaltradecenter_01': (-4.44, -3.19, 4.44, 3.19),
    'sm_t_004_house_01_p': (-2.25, -1.42, 2.25, 1.42),
    'sm_t_005_house_01_1': (-2.18, -1.35, 2.18, 1.35),
    'sm_t_005_house_01_1 2': (-2.18, -1.35, 2.18, 1.35),
    'sm_t_006_bicycleshop_01': (-2.53, -1.74, 2.53, 1.74),
    'sm_t_007_house_01': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_007_house_01_1_1yellow_w': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_007_house_01_1_yellow': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_007_house_01_2': (-1.46, -1.47, 1.46, 1.47),
    'sm_t_007_house_01_3': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_009_house_01_1': (-2.0, -1.38, 2.0, 1.38),
    'sm_t_009_house_01_1_1yellow': (-2.0, -1.38, 2.0, 1.38),
    'sm_t_009_house_01_2': (-2.0, -1.38, 2.0, 1.38),
    'sm_t_011_house_02': (-3.7, -1.38, 3.69, 1.35),
    'sm_t_011_house_02_1': (-3.69, -1.36, 3.69, 1.36),
    'sm_t_011_house_02_1_1': (-3.69, -1.36, 3.69, 1.36),
}
