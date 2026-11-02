"""Johto towns, one building at a time, on the blueprint's own building spots.

Each GSC town in tools/johto_blueprint.png draws every building as a roof
over a one-row wall with a dark door pixel. Each entry below is one Kanto
prefab chosen for that building (Center, Mart, Gym, the town's own house
style) and stood on that spot, front edge on the blueprint's wall row, so
the town reads like the Johto map and nothing is a pasted Kanto town.

BUILDINGS: (prefab or None, centre x px, front edge y px, door cfg or None).
    x is the building's centre column (continuous blueprint pixels, east);
    front is the pixel edge just south of the wall row. None as prefab is a
    doorway with no building of its own (Slowpoke Well).
PROPS: (prefab, x px, y px) or (prefab, x px, y px, yaw), continuous pixels.
Signs are not listed: the generator stands one on every sign pixel.
"""

YELLOW = ['sm_t_007_house_01_1_yellow', 'sm_t_007_house_01_2_1yellow', 'sm_t_007_house_01_1_1yellow_w',
          'sm_t_009_house_01_1_1yellow', 'sm_t_009_house_01_2', 'sm_t_007_house_01_3']
POST = 'sm_c_001_post_01'
LAMP = 'sm_c_001_streetlight_01'
HARBOR_LAMP = 'sm_t_007_streetlight_01'
FLOWERS = ['sm_c_001_flower_02', 'sm_c_001_flower_03', 'sm_c_001_comflower_01_1', 'sm_c_001_comflower_01_3']
STATUE = 'sm_c_001_statue_01'
GYMS = {'sm_c_001_gym_01', 'sm_c_001_gym_02'}


def flowers(*pts):
    return [(FLOWERS[i % len(FLOWERS)], x, y) for i, (x, y) in enumerate(pts)]


# Goldenrod's yellow-roofed homes: (centre x, front y) of every wall row the
# blueprint draws that isn't one of the city's named buildings.
GOLDENROD_HOMES = [
    (140, 182), (144, 184), (166, 184), (156.5, 194), (155, 188), (146, 188), (163, 190), (159.5, 196), (166, 198),
    (156, 200), (164, 200), (139, 202), (162, 202), (166, 204), (136, 206), (160.5, 206),
    (166.5, 206), (135, 210), (142, 210), (160, 210), (166.5, 210), (146, 212), (165.5, 212),
    (140, 214), (154, 214), (161.5, 214),
]
GOLDENROD_HOME_DOORS = [6210505, 6210506, 6210507, 6210508]

TOWNS = {
    2101: {   # New Bark Town: lab, player's house, Elm's house, neighbour
        'buildings': [
            ('sm_c_yjs_house', 357, 220, 6210101),
            ('sm_t_001_house_01', 364, 222, 6210102),
            ('sm_t_007_house_01', 354, 228, 6210103),
            ('sm_t_007_house_01_2', 362, 230, 6210104),
        ],
        'props': [
            (POST, 366.2, 222.6), (POST, 355.8, 228.6), (POST, 363.8, 230.6),
            *flowers((350.5, 224.5), (359.5, 226.5), (366.5, 228.5), (352.5, 231.5)),
        ],
    },
    2102: {   # Cherrygrove City: pink roofs; Mart and Center on the north row
        'buildings': [
            ('sm_c_001_shop_01', 274, 220, 6210205),
            ('sm_c_001_pokecen_01', 280, 220, 6210204),
            ('sm_r_210_loghouse_01_pink', 268, 224, 6210201),   # Guide Gent
            ('sm_c_001_house_01_red', 276, 226, 6210202),
            ('sm_r_210_loghouse_01_pink', 282, 228, 6210203),
        ],
        'props': flowers((264.5, 222.5), (271.5, 228.5), (278.5, 229.5), (285.5, 224.5), (270.5, 216.5)),
    },
    2103: {   # Violet City: purple roofs, Sprout Tower past the pond
        'buildings': [
            ('sm_r_209_losttower_01', 224, 133, 6210305),           # Sprout Tower
            ('sm_c_001_gym_02', 204, 142, 6210304),
            ('sm_t_003_trainersschool_01', 189, 144, 6210301),      # Earl's Pokémon Academy
            ('sm_c_001_house_02_purple', 210.5, 144, 6210302),
            ('sm_c_001_pokecen_01', 219, 144, 6210307),
            ('sm_c_001_shop_01', 204.5, 156, 6210306),
            ('sm_c_001_house_02_purple', 224, 156, 6210303),
        ],
        'props': flowers((207.5, 146.5), (213.5, 146.5), (221.5, 147.5), (199.5, 157.5), (226.5, 158.5)),
    },
    2104: {   # Azalea Town
        'buildings': [
            ('sm_c_001_pokecen_01', 170, 258, 6210405),
            ('sm_c_001_shop_01', 182, 258, 6210404),
            ('sm_t_009_house_01', 176, 262, 6210401),               # Kurt's house
            ('sm_c_001_gym_02', 171, 268, 6210403),
            ('sm_t_009_house_01_1', 182, 266, 6210402),             # charcoal kiln
            (None, 160, 263, 6210406),                              # Slowpoke Well
            ('sm_t_003_globaltradecenter_01', 154, 258, 6210407),   # Ilex Forest gate
        ],
        'props': [],
    },
    2105: {   # Goldenrod City: yellow roofs either side of the pink avenue
        'buildings': [
            ('sm_t_003_pokecompany_01_1', 133.5, 196, 6210512),     # Radio Tower
            ('sm_d_011_batower_01_1', 161, 182, 6210504),           # Magnet Train station
            ('sm_t_008_breedingcenter_01', 140, 186, 6210502),      # flower shop
            ('sm_t_006_bicycleshop_01', 164, 186, 6210501),
            ('sm_c_001_gym_02', 141, 194, 6210511),
            ('sm_c_bzd_house', 146.5, 202, 6210503),                # Game Corner
            ('sm_c_der_house2', 156.5, 208, 6210509),               # Department Store
            ('sm_c_001_pokecen_01', 143, 208, 6210510),
            *[(YELLOW[i % len(YELLOW)], x, y, GOLDENROD_HOME_DOORS[i] if i < len(GOLDENROD_HOME_DOORS) else None)
              for i, (x, y) in enumerate(GOLDENROD_HOMES)],
        ],
        'props': [(LAMP, x, y) for y in (185, 193, 201, 209) for x in (147.8, 152.2)],
    },
    2106: {   # Ecruteak City: dark Johto-style roofs among the orange ones
        'buildings': [
            ('sm_r_209_losttower_01', 156, 80, 6210607),            # Burned Tower
            ('sm_t_004_house_01_p', 168, 76, None),
            ('sm_c_bzd_house', 167, 84, 6210601),                   # Dance Theater
            ('sm_t_004_house_01_p', 156, 90, 6210602),
            ('sm_t_004_house_01_p', 164, 90, 6210603),
            ('sm_t_005_house_01_1', 156, 94, None),
            ('sm_t_004_house_01_p', 174, 94, None),
            ('sm_c_001_shop_01', 180, 94, 6210605),
            ('sm_c_001_gym_02', 156.5, 100, 6210606),
            ('sm_t_005_house_01_1 2', 164, 100, None),
            ('sm_c_001_pokecen_01', 174, 100, 6210604),
            ('sm_t_011_house_02_1_1', 180, 100, None),
        ],
        'props': [],
    },
    2107: {   # Olivine City: light-blue roofs, lighthouse on the east pier
        'buildings': [
            ('sm_c_001_gym_02', 91, 130, 6210708),
            ('sm_c_001_house_02_blue', 105.5, 130, 6210701),
            ('sm_c_001_house_02_blue', 109.5, 130, 6210702),
            ('sm_c_001_house_02_blue', 94, 134, 6210703),
            ('sm_c_001_pokecen_01', 100, 136, 6210706),
            ('sm_t_003_globaltradecenter_01', 88, 140, 6210704),    # Olivine Café
            ('sm_c_001_shop_01', 95, 140, 6210707),
            ('sm_d_011_batower_01_1', 110, 147, 6210709),           # Glitter Lighthouse
            (None, 99.5, 149, 6210705),                             # S.S. Aqua pier
        ],
        'props': [(HARBOR_LAMP, x, 141.6) for x in (74, 80, 86, 102)],
    },
    2108: {   # Cianwood City: lavender roofs along the cliff shore
        'buildings': [
            ('sm_c_001_gym_01', 8.5, 216, 6210807),
            ('sm_c_001_pokecen_01', 23.5, 216, 6210805),
            ('sm_c_001_shop_01', 15.5, 210, 6210806),               # pharmacy
            ('sm_c_001_house_02_purple', 9.5, 204, 6210801),
            ('sm_c_001_house_02_purple', 17.5, 214, 6210802),
            ('sm_c_001_house_02_purple', 15.5, 220, 6210803),
        ],
        'props': flowers((12.5, 206.5), (20.5, 211.5), (11.5, 219.5)),
    },
    2109: {   # Mahogany Town
        'buildings': [
            ('sm_t_003_globaltradecenter_01', 260.5, 98, 6210904),  # souvenir shop
            ('sm_t_001_house_01_red', 267, 98, 6210901),
            ('sm_c_001_gym_02', 256.5, 104, 6210903),
            ('sm_c_001_pokecen_01', 266.5, 104, 6210902),
        ],
        'props': [],
    },
    2110: {   # Blackthorn City: gym on the lake, Center and Mart side by side
        'buildings': [
            ('sm_c_001_gym_02', 349.5, 84, 6211008),
            ('sm_t_011_house_02', 344, 94, 6211001),
            ('sm_t_011_house_02_1', 359.5, 96, 6211002),
            ('sm_c_001_pokecen_01', 348, 102, 6211005),
            ('sm_c_001_shop_01', 354, 102, 6211004),
            ('sm_t_011_house_02_1_m', 341, 104, 6211003),
        ],
        'props': [],
    },
    2114: {   # Mt. Silver
        'buildings': [('sm_c_001_pokecen_01', 458.5, 132, 6211402)],
        'props': [],
    },
}

# Footprints (x0, z0, x1, z1 in metres around the prefab origin) from scenery/kanto.glb.
SIZES = {
    'sm_c_001_pokecen_01': (-2.63, -1.95, 2.63, 1.95),
    'sm_c_001_shop_01': (-2.0, -1.33, 2.0, 1.33),
    'sm_c_001_gym_01': (-3.43, -2.18, 3.43, 2.18),
    'sm_c_001_gym_02': (-3.43, -2.51, 3.43, 2.18),
    'sm_t_001_house_01': (-2.75, -1.87, 2.75, 1.87),
    'sm_t_001_house_01_red': (-2.75, -1.87, 2.75, 1.87),
    'sm_c_yjs_house': (-3.83, -2.46, 3.83, 2.76),
    'sm_t_007_house_01': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_007_house_01_2': (-1.46, -1.47, 1.46, 1.47),
    'sm_t_007_house_01_1_yellow': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_007_house_01_2_1yellow': (-1.46, -1.47, 1.46, 1.47),
    'sm_t_007_house_01_1_1yellow_w': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_007_house_01_3': (-1.94, -1.47, 1.94, 1.47),
    'sm_t_009_house_01': (-2.0, -1.38, 2.0, 1.38),
    'sm_t_009_house_01_1': (-2.0, -1.38, 2.0, 1.38),
    'sm_t_009_house_01_1_1yellow': (-2.0, -1.38, 2.0, 1.38),
    'sm_t_009_house_01_2': (-2.0, -1.38, 2.0, 1.38),
    'sm_r_210_loghouse_01_pink': (-2.75, -2.06, 2.75, 2.06),
    'sm_c_001_house_01_red': (-2.04, -1.35, 2.04, 1.35),
    'sm_c_001_house_02_purple': (-2.04, -1.35, 2.04, 1.35),
    'sm_c_001_house_02_blue': (-2.04, -1.35, 2.04, 1.35),
    'sm_t_004_house_01_p': (-2.25, -1.42, 2.25, 1.42),
    'sm_t_005_house_01_1': (-2.18, -1.35, 2.18, 1.35),
    'sm_t_005_house_01_1 2': (-2.18, -1.35, 2.18, 1.35),
    'sm_t_011_house_02': (-3.7, -1.38, 3.69, 1.35),
    'sm_t_011_house_02_1': (-3.7, -1.38, 3.69, 1.35),
    'sm_t_011_house_02_1_1': (-3.7, -1.38, 3.69, 1.35),
    'sm_t_011_house_02_1_m': (-3.7, -1.38, 3.69, 1.35),
    'sm_r_209_losttower_01': (-3.75, -4.42, 3.75, 4.1),
    'sm_d_011_batower_01_1': (-3.5, -3.01, 3.5, 3.01),
    'sm_t_003_pokecompany_01_1': (-4.62, -3.15, 4.62, 3.56),
    'sm_t_003_globaltradecenter_01': (-4.44, -3.19, 4.44, 3.19),
    'sm_t_003_trainersschool_01': (-4.57, -1.96, 4.57, 1.96),
    'sm_t_006_bicycleshop_01': (-2.53, -1.74, 2.53, 1.74),
    'sm_t_008_breedingcenter_01': (-2.68, -1.82, 2.68, 1.82),
    'sm_c_bzd_house': (-3.77, -2.57, 3.83, 2.64),
    'sm_c_der_house2': (-3.6, -3.59, 8.38, 3.71),
}
