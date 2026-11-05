# What's left in `upcoming/` (checked 2026-11-05)

`upcoming/` has 153 files. **43** are already live unchanged, and about **35** more are live with our edits (English names, fixes).
What remains is below. The rule stays the same: the `upcoming/` version comes first, then we fill gaps.

## 1. Features not started yet (new modules)

| Feature | Files | Notes |
|---|---|---|
| **New raids**: Seafoam Blizzard (Articuno), Power Plant Overload (Zapdos), Psychic Echoes | `raid_r01_game`, `raid_r03_game`, `raid_r05_game`, `raid_loading` (+ small `raid_r0x_*` stubs) | Waiting on the 28 raid files in `public/downloads/pokefable_needed.txt` |
| **Decorating a land plot / guild base** | `decorate_3d`, `decorate_rules`, `decorate_ui`, `placement`, `placement_ui`, `plot_objects` | Furniture placement; only Leader / Vice / Officer can arrange a guild base |
| **Item drops** | `drop` | Drops from wild Pokémon and trainers with daily / weekly caps. TM pieces need this (today they only come from the season pass) |
| **Safari Zone (new version)** | `safari`, `safari_game` | The live game uses my `safari_rules.mjs` |
| **Travel window** | `travel_ui`, `regions_nav` | The live game has Fly in the map (`map_travel.mjs`) |
| **In-game staff tools** | `staff_ui` | Free path, follower controls, etc. for GMs |
| **Controls screen** | `controls_ui` | Key remapping screen (the key list `keys.mjs` is live) |
| **Mission guide (new version)** | `guide` | The live game has `mission_guide.mjs` |
| **Street lamps and lit windows** | `game_lights` | Goes with the bigger `lights.mjs` below |
| **Founder-pack notice** | `pack_notice` | Waits for payments |
| **Shared Pokémon Center rooms** | `shared_room` | |
| **Engine and loading** | `ktx2_scene` (+ `ktx-parse`, `zstddec`), `scenery_patches`, `live_table`, `buildings` | Compressed textures, map seam fixes, live data tables from the server |
| **Client-side spawning** | `spawns` | **Skip**: the server spawns wild Pokémon now (shared world) |
| **three.js add-ons** | `GLTFLoader.js`, `SkeletonUtils.js`, `BufferGeometryUtils.js`, `three.core.js`, … | Their copies of the 3D library; check against `vendor/three` before swapping |

## 2. Live modules where `upcoming/` is much bigger (newer versions)

These hold most of the battle depth and the newer screens. Each needs a careful merge, because the live copies carry our fixes.

| Module | Upcoming / live lines | What it likely adds |
|---|---|---|
| `menus.mjs` | 13,548 / 6,213 | The rest of the v2 windows' wiring |
| `moves_all.mjs` | 10,173 / 199 | The full move list with effects |
| `hud.mjs` | 3,300 / 1,769 | More v2 HUD pieces |
| `director.mjs` | 1,699 / 359 | Cutscenes / scene direction |
| `screens.mjs`, `screens_character.mjs` | 1,597 / 333, 910 / 447 | Title, login, character creation screens |
| `popup.mjs` | 1,445 / 965 | v2 popup engine |
| `status.mjs` | 1,436 / 198 | Status conditions in battle |
| `missions.mjs` | 772 / 482 | Missions |
| `drag_team.mjs` | 632 / 205 | Dragging Pokémon between party and Box |
| `ev.mjs` | 468 / 95 | EV training |
| `capture.mjs` | 453 / 199 | Catching |
| `chat.mjs` | 438 / 175 | Chat |
| `lights.mjs` | 407 / 176 | Lighting |
| `sound.mjs`, `recorder.mjs` | 336 / 154, 330 / 252 | Sound, replays |
| `moves.mjs`, `raid.mjs`, `trade.mjs`, `fire.mjs`, `paint.mjs`, `individual.mjs`, `navigation.mjs`, `knowledge.mjs`, `character.mjs` | | Smaller upgrades |

## 3. Already done this round

Shared world (server spawns), season pass and claim-all, mail (+ admin tab), achievements, account stats, rankings
(+ admin tab, weekly titles, region picker), wardrobe (+ shop catalog, effects in the world), TM counter / teach / tutor,
held items, Transform.

## Still waiting on files

- 28 raid files (r01, r03, r05)
- 4 effect meshes (`particulas/malha/FX_Cake.json`, `Object002.json`, `pCube2.json`, `pCylinder1.json`)
