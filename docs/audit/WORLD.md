# Kanto World / Locations Audit (READ-ONLY)

**Repo:** `/workspace` · **Region:** Kanto (Gen 1) · **Data keys:** Portuguese · **Report:** English

## File references

| Role | Path |
|---|---|
| Scene index | `public/data/scenes.json` |
| Outdoor world map | `public/data/kanto.json` (+ `scenery/kanto.glb`, `scenery/kanto_chao.json`) |
| Light outdoor slice | `public/data/pallet_route1.json` (+ `public/scenery/pallet_route1.glb`) |
| Doors / warps catalog | `public/data/doors.json` |
| Interior scene id list | `public/data/interior_maps.txt` |
| World-map UI click points | `public/data/kanto_map_points.json` + `ui/figma/backgrounds/mapa-kanto.png` |
| Place-name EN | `public/data/locale/names_en.json` |
| NPC models / dialogue lines | `public/data/npcs_glb.json` |
| Scripted dialogues | `public/data/dialogues.json` |
| Missions | `public/data/missions.json` |
| Gyms | `public/data/gyms.json` |
| Spawn habitats (species by area) | `public/data/habitats.json` |
| Spawn zones (unused/empty) | `public/data/zonas_spawn.json` → `{"v":1,"zonas":[]}` |
| Scene loader (client) | `idx_mod_0.mjs` |
| World/network wild logic | `world.mjs` / `server/world.mjs` |
| Per-scene map JSON | `public/data/<sceneId>.json` |
| 3D + ground | `scenery/<id>.glb`, `scenery/<id>_chao.json` (also mirrored under `public/scenery/` for some assets) |

## Totals

| Metric | Count |
|---|---:|
| Top-level scenes in `scenes.json` | 72 |
| Outdoor areas inside scene `1000001` / `kanto` | 39 |
| Interior/dungeon/special scenes | 71 |
| Interior scenes with GLB (`interior_maps.txt` / scenery) | 71 / 71 listed |
| Cave-type scenes | 6 |
| Gym definitions (`gyms.json`) | 8 |
| `doors.json` entries | 6692 |
| Door warps (t=6) | 2484 |
| Arrival points (t=7) | 4208 |
| Outdoor ledge markers in `kanto.portas` (tipo 72/73/74) | 848 |
| NPCs placed on outdoor `kanto` map | 1305 |
| Trainers placed on outdoor `kanto` map | 1984 |
| NPC catalog `npcs_glb.json` | 377 |
| Dialogue keys `dialogues.json` | 12 |
| Mission chapters | 20 |
| Mission quests (total) | 56 |
| Habitat areas with species | 53 |
| World-map clickable areas | 39 |

## 2. Map dimensions & stitching

- **Outdoor model:** one continuous 3D map `kanto.glb` (~31.6 MB), not tiled scene-to-scene for towns/routes.
- **Bounding box (from area caixas):** X [-394.6 … 327.6] m, Z [-286.3 … 250.5] m ≈ **722 × 537 m**.
- **39 outdoor areas** are AABBs inside that one mesh (`kanto.json` `caixas` / `areas` / `nomes`). Walking between Pallet → Viridian → Pewter etc. does **not** reload.
- **Interiors / dungeons** are **separate scenes**: page reload with `?mapa=<sceneId>&chegada=<arrivalCfg>` (`idx_mod_0.mjs`). Boot loads `scenery/<NOME>.glb`, `scenery/<NOME>_chao.json`, `data/<NOME>.json`.
- **Default boot map:** `NOME = kanto` (or last scene in `localStorage.ultimaCena`). Dev light slice: `?mapa=pallet_route1` (Pallet + Route 1 only).
- **Warps:** `doors.json` — `t=6` door NPC cfg → `n` arrival cfg (`t=7`). Outdoor ledge hops are `kanto.portas` tipo 72/73/74 (not scene changes).
- **`interior_maps.txt`:** whitelist of exported interior scene IDs; doors to non-exported scenes are suppressed (no yellow ring).

### Fast travel / flying
- **No classic HM Fly city teleporter.** World Map popup (`menus.mjs` `popupMa`) shows art `mapa-kanto.png` with click labels from `kanto_map_points.json` — **informational / area select UI**, not a free teleport network like Gen 1 Fly.
- **Mounts:** `mounts.json` / `M` key. Some mounts have `voa` (IsFly) for free flight over terrain (staff/admin-gated for most; Arcanine + Lapras free). Surf via aquatic mounts on water.
- **Respawn / “stuck”:** teleport to last Pokémon Center / Oak Lab via door system (`irParaCena`), not city Fly list.
- **Admin:** `?adm=1` free flight for filming.

### Minimap / world map
- **HUD minimap:** baked top-down photo `ui/minimapa_kanto.jpg` + ruler `ui/minimapa_kanto.json` (outdoor); interiors render a local orthographic snapshot. Toggle `?minimapa=0` / `?minimapa=vivo`.
- **World map menu:** Figma background + fractional click points for all 39 outdoor areas (incl. Seafoam marker `1299`, Safari, Competition Center).

## 1. Complete location list

### 1A. Outdoor areas (scene `1000001` / map `kanto`)

| English | PT name | Area ID | Type | Category | 3D | NPCs (non-door) | Doors/warps out | Warp destinations (sample) | Spawn spp. | Dims (sx×sz) |
|---|---|---:|---|---|---|---:|---:|---|---:|---|
| Pallet Town | Cidade Pallet | 1101 | outdoor | town/city | kanto.glb (shared outdoor) | 18 | 3 | Player's House Piso 1 (4110008); Pallet Town — Gary Oak's House (4110009); Professor Oak's Lab (4110002) | 0 | 41×25m |
| Viridian City | Cidade Viridian | 1102 | outdoor | town/city | kanto.glb (shared outdoor) | 26 | 5 | Viridian Pokémon Center (4110001); Viridian City Mart (4110007); Trainer School (4110004); Viridian-Casa da Velha (4110009); Viridian Gym (4120008) | 3: Poliwag, Goldeen, Magikarp | 46×41m |
| Pewter City | Cidade Pewter | 1103 | outdoor | town/city | kanto.glb (shared outdoor) | 31 | 7 | Pewter Pokémon Center (4110001); Pewter — Ata's House (4110012); Pewter City Mart (4110007); Pewter — Brock's House (4110008); Pewter Science Museum Piso 1 (4110017); Pewter Gym (4120017) | 0 | 54×49m |
| Cidade Cerulean | Cidade Cerulean | 1104 | outdoor | town/city | kanto.glb (shared outdoor) | 33 | 11 | Cerulean Pokémon Center (4110001); Cerulean-Tio de medalhas (4110013); Cerulean — Professor's House (4110009); Cerulean-Casa Roubada (4110013); Cerulean-Casa da Jenny (4110009); Miracle Cycle (4110003); Cerulean — Room pequeno comum (4110010); Cerulean City Mart (4110007); Cerulean Gym (4120002) | 0 | 60×38m |
| Vermilion City | Cidade Vermilion | 1105 | outdoor | town/city | kanto.glb (shared outdoor) | 51 | 8 | Vermilion Pokémon Center (4110001); Clube dos Entusiastas (4110016); Vermilion Gym (4120016); Vermilion — Room 1 (4110010); Vermilion City Mart (4110007); Vermilion — Room 3 (4110011); S.S. Anne Piso 1 (4120020) | 1: Shellder | 53×60m |
| Cidade Lavender | Cidade Lavender | 1106 | outdoor | town/city | kanto.glb (shared outdoor) | 19 | 7 | Lavender Pokémon Center (4110001); Lavender-Casa dos Espíritos (4110015); Pokémon Tower Floor 1 (2100001); Lavender Town Mart (4110007); Lavender- Casa do Velho (4110012); Lavender — Avaliador's House (4110010) | 0 | 42×32m |
| Celadon City | Cidade Celadon | 1107 | outdoor | town/city | kanto.glb (shared outdoor) | 45 | 12 | Celadon Pokémon Center (4110001); Celadon Building Piso 1 (2100010); Department Store Piso 1 (4110014); Game Corner (4110018); Celadon — Room 1 (4110011); Celadon — Room 2 (4110016); Celadon — Room 3 (4110016); Celadon Gym (4120019) | 0 | 59×65m |
| Saffron City | Cidade Saffron | 1108 | outdoor | town/city | kanto.glb (shared outdoor) | 32 | 16 | Saffron Pokémon Center (4110001); Saffron — Tio Lutador's House (4110010); Silph Co. Piso 1 (2100009); Saffron-Casa da moça Piso 1 (4110008); Saffron Gym (4120006); lutador Gym (4120014); Route 7 (1000001); Route 6 (1000001); Route 8 (1000001); Route 5 (1000001); Loja de da Saffron City (4110007); Saffron-Clube de treinadores (4110016) | 0 | 49×49m |
| Fuchsia City | Cidade Fuchsia | 1109 | outdoor | town/city | kanto.glb (shared outdoor) | 28 | 13 | Fuchsia Pokémon Center (4110001); Fuchsia — Room 1 (4110010); Fuchsia — Room 2 Casa do Bill (4110009); Fuchsia Gym (4120015); Fuchsia City Mart (4110007); Fuchsia-Sala de descanso do Diretor (4110016); Fuchsia — diretor's House (4110010); Fuchsia — Pescador's House (4110013); Route 15 (1000001); Safari Zone (1000001) | 0 | 67×45m |
| Cinnabar Island | Ilha Cinnabar | 1110 | outdoor | town/city | kanto.glb (shared outdoor) | 15 | 5 | Cinnabar Pokémon Center (4110001); Cidade Cinnabar Mart (4110007); Cinnabar Lab (4110019); Cinnabar Gym (4120007); Cinnabar-Edifício Abandonado (4110013) | 0 | 37×45m |
| Route 1 | Rota 1 | 1201 | outdoor | route | kanto.glb (shared outdoor) | 10 | 0 | — | 2: Pidgey, Rattata | 45×62m |
| Route 2 | Rota 2 | 1202 | outdoor | route | kanto.glb (shared outdoor) | 13 | 14 | Viridian Forest (1000001); Route 2 (1000001); Rota 2-Instituto de Florestas (4110009); Diglett's Cave (2100008) | 8: Caterpie, Metapod, Weedle, Kakuna, Pidgey, Rattata, Nidoran, Nidoran | 39×82m |
| Route 3 | Rota 3 | 1203 | outdoor | route | kanto.glb (shared outdoor) | 20 | 0 | — | 9: Spearow, Ekans, Jigglypuff, Pidgey, Nidoran, Nidoran, Mankey, Sandshrew (+1) | 100×29m |
| Route 4 | Rota 4 | 1204 | outdoor | route | kanto.glb (shared outdoor) | 26 | 4 | Route 4 Pokémon Center (4110001); Mt. Moon Floor 1 (2100007); Cerulean Cave Floor 1 (2100006) | 9: Raticate, Fearow, Nidoran, Nidoran, Rattata, Spearow, Ekans, Sandshrew (+1) | 136×38m |
| Route 5 | Rota 5 | 1205 | outdoor | route | kanto.glb (shared outdoor) | 17 | 4 | Rota 5 - Casa central da Rota 5 (4110009); Route 6 (1000001); Saffron City (1000001) | 14: Ivysaur, Pidgeot, Sandshrew, Sandslash, Vulpix, Pidgey, Oddish, Bellsprout (+6) | 52×58m |
| Route 6 | Rota 6 | 1206 | outdoor | route | kanto.glb (shared outdoor) | 17 | 3 | Saffron City (1000001); Route 5 (1000001) | 15: Arbok, Meowth, Weepinbell, Victreebel, Drowzee, Hypno, Pidgey, Oddish (+7) | 41×36m |
| Route 7 | Rota 7 | 1207 | outdoor | route | kanto.glb (shared outdoor) | 5 | 3 | Route 8 (1000001); Saffron City (1000001) | 13: Ninetales, Persian, Arcanine, Pidgey, Rattata, Vulpix, Growlithe, Oddish (+5) | 24×49m |
| Route 8 | Rota 8 | 1208 | outdoor | route | kanto.glb (shared outdoor) | 26 | 3 | Saffron City (1000001); Route 7 (1000001) | 14: Koffing, Porygon, Pidgey, Ekans, Sandshrew, Vulpix, Growlithe, Meowth (+6) | 76×42m |
| Route 9 | Rota 9 | 1209 | outdoor | route | kanto.glb (shared outdoor) | 25 | 0 | — | 11: Nidorina, Nidorino, Mr. Mime, Rattata, Raticate, Spearow, Fearow, Ekans (+3) | 80×37m |
| Route 10 | Rota 10 | 1210 | outdoor | route | kanto.glb (shared outdoor) | 26 | 4 | Route 10 Pokémon Center (4110001); Rock Tunnel piso 1 (2100012); Abandoned Power Plant (2100002) | 15: Poliwag, Goldeen, Pinsir, Magikarp, Spearow, Ekans, Sandshrew, Nidoran (+7) | 40×116m |
| Route 11 | Rota 11 | 1211 | outdoor | route | kanto.glb (shared outdoor) | 20 | 3 | Route 12 (1000001); Diglett's Cave (2100008) | 9: Growlithe, Pidgey, Rattata, Spearow, Ekans, Sandshrew, Drowzee, Fearow (+1) | 71×39m |
| Route 12 | Rota 12 | 1212 | outdoor | route | kanto.glb (shared outdoor) | 19 | 7 | Route 11 (1000001); Route 12 (1000001); Rota 12-Casa (4110012) | 12: Farfetch’d, Krabby, Kingler, Seaking, Pidgey, Pidgeotto, Oddish, Bellsprout (+4) | 47×116m |
| Route 13 | Rota 13 | 1213 | outdoor | route | kanto.glb (shared outdoor) | 19 | 0 | — | 13: Paras, Parasect, Venonat, Venomoth, Pidgey, Pidgeotto, Oddish, Bellsprout (+5) | 97×21m |
| Route 14 | Rota 14 | 1214 | outdoor | route | kanto.glb (shared outdoor) | 24 | 0 | — | 12: Venonat, Scyther, Pidgey, Pidgeotto, Oddish, Bellsprout, Gloom, Weepinbell (+4) | 22×79m |
| Route 15 | Rota 15 | 1215 | outdoor | route | kanto.glb (shared outdoor) | 18 | 2 | Fuchsia City (1000001) | 11: Pidgey, Pidgeotto, Oddish, Bellsprout, Gloom, Weepinbell, Venonat, Venomoth (+3) | 63×42m |
| Route 16 | Rota 16 | 1216 | outdoor | route | kanto.glb (shared outdoor) | 16 | 9 | Route 16 (1000001); Rota 16-Casa (4110009) | 11: Exeggcute, Exeggutor, Magmar, Eevee, Rattata, Raticate, Spearow, Fearow (+3) | 48×30m |
| Route 17 | Rota 17 | 1217 | outdoor | route | kanto.glb (shared outdoor) | 29 | 0 | — | 7: Rattata, Raticate, Spearow, Fearow, Doduo, Ponyta, Oddish | 39×165m |
| Route 18 | Rota 18 | 1218 | outdoor | route | kanto.glb (shared outdoor) | 9 | 4 | Route 18 (1000001) | 7: Rattata, Raticate, Spearow, Fearow, Doduo, Lickitung, Tauros | 63×26m |
| Route 19 | Rota 19 | 1219 | outdoor | route | kanto.glb (shared outdoor) | 16 | 0 | — | 7: Seaking, Tentacool, Tentacruel, Goldeen, Staryu, Horsea, Magikarp | 57×72m |
| Route 20 | Rota 20 | 1220 | outdoor | route | kanto.glb (shared outdoor) | 13 | 0 | — | 8: Staryu, Tentacool, Tentacruel, Horsea, Shellder, Magikarp, Goldeen, Seaking | 65×58m; 78×47m |
| Route 21 | Rota 21 | 1221 | outdoor | route | kanto.glb (shared outdoor) | 16 | 0 | — | 10: Starmie, Rattata, Raticate, Pidgey, Pidgeotto, Tangela, Tentacool, Magikarp (+2) | 46×110m |
| Route 22 | Rota 22 | 1222 | outdoor | route | kanto.glb (shared outdoor) | 6 | 1 | Connection Center (4120018) | 12: Mankey, Primeape, Ponyta, Rapidash, Rattata, Spearow, Nidoran, Nidoran (+4) | 61×44m |
| Route 23 | Rota 23 | 1223 | outdoor | route | kanto.glb (shared outdoor) | 24 | 7 | Connection Center (4120018); Victory Road Floor 1 (2100004); Victory Road Floor 2 (2100004); Indigo League Pokémon Center (4110006) | 18: Spearow, Fearow, Ekans, Arbok, Sandshrew, Sandslash, Nidorina, Nidorino (+10) | 48×232m |
| Route 24 | Rota 24 | 1224 | outdoor | route | kanto.glb (shared outdoor) | 14 | 0 | — | 17: Pidgeotto, Oddish, Gloom, Vileplume, Venonat, Bellsprout, Lickitung, Tangela (+9) | 37×62m |
| Route 25 | Rota 25 | 1225 | outdoor | route | kanto.glb (shared outdoor) | 22 | 1 | Bill's Cottage (4110020) | 10: Pidgey, Pidgeotto, Oddish, Bellsprout, Abra, Caterpie, Weedle, Metapod (+2) | 76×50m |
| Viridian Forest | Floresta Verde | 1191 | outdoor | forest | kanto.glb (shared outdoor) | 14 | 8 | Route 2 (1000001) | 9: Bulbasaur, Caterpie, Metapod, Butterfree, Weedle, Kakuna, Beedrill, Pikachu (+1) | 66×108m |
| Safari Zone | campo de safári | 1192 | outdoor | special | kanto.glb (shared outdoor) | 16 | 7 | Fuchsia City (1000001); Safari Zone House 4 (4110011); Safari Zone House 5 (4110009); Safari Zone House 3 (4110011); Safari Zone House 1 (4110011); Safari Zone House 2 (4110011) | 56: Pidgeot, Sandslash, Nidoqueen, Nidoking, Clefable, Ninetales, Vileplume, Parasect (+48) | 195×149m |
| Competition Center | Centro de Competição | 1193 | outdoor | special | kanto.glb (shared outdoor) | 42 | 7 | Pallet Town (1000001) | 0 | 129×141m |
| Seafoam Islands | ilhas seaform | 1299 | outdoor | special/cave entrance | kanto.glb (shared outdoor) | 5 | 2 | Seafoam Islands Floor 1 (2100003) | 16: Squirtle, Psyduck, Golduck, Slowpoke, Slowbro, Seel, Dewgong, Horsea (+8) | 42×59m |

**Outdoor subtotal:** 39 areas · NPCs (non-door sum)=825 · door warps out=180 · areas with habitats=30

### 1B. Interior / dungeon / special scenes

| English | PT name | Scene ID | Area IDs | Type | Category | 3D GLB | Ground | NPCs (non-door) | Doors out | Gym | Spawn spp. | Sub-areas |
|---|---|---:|---|---|---|---|---|---:|---:|---|---:|---|
| Habitat | Habitat | 1000002 | 100002 | cave | special/other | 1000002.glb | yes | 0 | 0 | — | 0 | 100002:Habitat (cave) |
| Pokémon Tower | Torre de Pokémon | 2100001 | 1301,1302,1303,1304,1305,1306,1307 | interior | dungeon/special | 2100001.glb | yes | 37 | 13 | — | 3: Gastly, Cubone, Haunter | 1301:Pokémon Tower Floor 1 (interior); 1302:Pokémon Tower Floor 2 (interior); 1303:Pokémon Tower Floor 3 (interior); 1304:Pokémon Tower Floor 4 (interior); 1305:Pokémon Tower Floor 5 (interior); 1306:Pokémon Tower Floor 6 (interior); 1307:Pokémon Tower Floor 7 (interior) |
| Abandoned Power Plant | Usina Elétrica Abandonada | 2100002 | 1332 | interior | dungeon/special | 2100002.glb | yes | 28 | 2 | — | 6: Magnemite, Voltorb, Pikachu, Magneton, Electabuzz, Electrode | 1332:Abandoned Power Plant (interior) |
| Seafoam Islands | Ilhas Seaform | 2100003 | 1310,1311,1312,1313,1314 | interior | dungeon/special | 2100003.glb | yes | 76 | 26 | — | 14: Zubat, Psyduck, Slowpoke, Seel, Golbat, Golduck, Slowbro, Dewgong (+6) | 1310:Seafoam Islands Floor 1 (interior); 1311:Seafoam Islands Floor 2 (interior); 1312:Seafoam Islands Floor 3 (interior); 1313:Seafoam Islands Floor 4 (interior); 1314:Seafoam Islands Floor 5 (interior) |
| Victory Road | Caminho dos Campeões | 2100004 | 1315,1316,1317 | interior | dungeon/special | 2100004.glb | yes | 53 | 12 | — | 13: Geodude, Zubat, Machop, Golbat, Graveler, Machoke, Onix, Marowak (+5) | 1315:Victory Road Floor 1 (interior); 1316:Victory Road Floor 2 (interior); 1317:Victory Road Floor 3 (interior) |
| Team Rocket Hideout | Esconderijo da Equipe Rocket | 2100005 | 1308,1309 | interior | building/interior | 2100005.glb | yes | 22 | 3 | — | 0 | 1308:Team Rocket Hideout Floor 1 (interior); 1309:Team Rocket Hideout Floor 2 (interior) |
| Cerulean Cave | Caverna Celeste | 2100006 | 1318,1319,1320 | interior | dungeon/special | 2100006.glb | yes | 26 | 15 | — | 13: Golbat, Machoke, Kadabra, Magneton, Parasect, Dodrio, Raichu, Arbok (+5) | 1318:Cerulean Cave Floor 1 (interior); 1319:Cerulean Cave Floor 2 (interior); 1320:Cerulean Cave Floor 3 (interior) |
| Mt. Moon | Monte Lua | 2100007 | 1322,1323,1324 | interior | dungeon/special | 2100007.glb | yes | 62 | 16 | — | 4: Zubat, Geodude, Paras, Clefairy | 1322:Mt. Moon Floor 1 (interior); 1323:Mt. Moon Floor 1 (interior); 1324:Mt. Moon Floor 1 (interior) |
| Diglett's Cave | Caverna Diglett | 2100008 | 1321 | interior | dungeon/special | 2100008.glb | yes | 5 | 2 | — | 2: Diglett, Dugtrio | 1321:Diglett's Cave (interior) |
| Silph Co. | Companhia Silph | 2100009 | 1325,1326,1327 | interior | dungeon/special | 2100009.glb | yes | 29 | 6 | — | 0 | 1325:Silph Co. Piso 1 (interior); 1326:Silph Co. Piso 2 (interior); 1327:Silph Co. Piso 3 (interior) |
| Celadon Building | Edifício de Celadon | 2100010 | 1328,1329,1330 | interior | building/interior | 2100010.glb | yes | 19 | 10 | — | 0 | 1328:Celadon Building Piso 1 (interior); 1329:Celadon Building Piso 2 (interior); 1330:Celadon Building Piso 3 (interior) |
| Safari Zone (Kanto) | Campo de Safári (Kanto) | 2100011 | 3101,3104,3111,3112,3113,3114,100001 | interior | building/interior | 2100011.glb | yes | 0 | 0 | — | 0 | 3101:Safari Zone (Kanto) (outdoor); 3104:Safari Zone 1 (outdoor); 3111:Safari Zone 1 (outdoor); 3112:Safari Zone 2 (outdoor); 3113:Safari Zone 3 (outdoor); 3114:Safari Zone 1 (outdoor); 100001:área 100001 (special) |
| Rock Tunnel | Túnel de pedra | 2100012 | 1333,1334 | interior | dungeon/special | 2100012.glb | yes | 31 | 10 | — | 4: Zubat, Geodude, Machop, Onix | 1333:Rock Tunnel piso 1 (interior); 1334:Rock Tunnel piso 2 (interior) |
| Pokémon House | Casa de Pokémon | 2100013 | 1335 | interior | house/facility | 2100013.glb | yes | 15 | 2 | — | 0 | 1335:Pokémon House (interior) |
| One Island | Ilha Um | 2500001 | 2249,2250,2251,2252,2253,2254,2255,2265,2266,2267,2268,2270,2271,2272,2273,2275,2276,2277,2278,2279,2280,2281,2282,2284,2285,2287 | mixed | special/other | 2500001.glb | yes | 52 | 34 | — | 0 | 2249:One Island (outdoor); 2250:Ilha Dois (outdoor); 2251:Ilha Três (outdoor); 2252:Ilha Quatro (outdoor); 2253:Ilha Cinco (outdoor); 2254:Ilha Seis (outdoor); 2255:Ilha Sete (outdoor); 2265:Cabo da Ponta (outdoor); 2266:Porto (outdoor); 2267:Ponte Suspensa (outdoor); 2268:Floresta dos Berries (outdoor); 2270:Lugar Vazio (outdoor); 2271:Torre Memorial (outdoor); 2272:Labirinto das Águas (outdoor); 2273:Resort Luxuoso (outdoor); 2275:Caminho das águas (outdoor); 2276:Vale das Ruínas (outdoor); 2277:Caverna de ponto Piso 1 (interior); 2278:Caverna de ponto Piso -1 (interior); 2279:Caverna de ponto Sala Secreta (interior); 2280:Caminho Verde (outdoor); 2281:Bosque Marcado (outdoor); 2282:Ilha Solitária (outdoor); 2284:Entrada do cânion (outdoor); 2285:Sevault Canyon (outdoor); 2287:Rocha do umbigo (outdoor) |
| Mt. Ember-Caverna do Meio da Montanha | Monte das Brasas-Caverna do Meio da Montanha | 2520001 | 2263 | interior | dungeon/special | 2520001.glb | yes | 0 | 2 | — | 0 | 2263:Mt. Ember-Caverna do Meio da Montanha (interior) |
| Mt. Ember-Caverna Direita | Monte das Brasas-Caverna Direita | 2520002 | 2260,2261,2262 | interior | dungeon/special | 2520002.glb | yes | 0 | 7 | — | 0 | 2260:Mt. Ember-Caverna Direita Piso -1 (interior); 2261:Mt. Ember-Caverna Direita Piso -2 (interior); 2262:Mt. Ember-Sala Secreta da Caverna Direita (interior) |
| Fonte Termal do Mt. Ember | Fonte Termal do monte das Brasas | 2520003 | 2258 | interior | dungeon/special | 2520003.glb | yes | 0 | 1 | — | 0 | 2258:Fonte Termal do Mt. Ember (interior) |
| Icefall Cave | Caverna Glacial | 2520004 | 2269 | outdoor | dungeon/special | 2520004.glb | yes | 0 | 3 | — | 0 | 2269:Icefall Cave (outdoor) |
| Alteration Cave | Caverna da Alteração | 2520005 | 2283 | interior | dungeon/special | 2520005.glb | yes | 0 | 1 | — | 0 | 2283:Alteration Cave (interior) |
| Tanoby Ruins | Ruínas de Tanoby | 2520006 | 2286 | interior | special/other | 2520006.glb | yes | 0 | 1 | — | 0 | 2286:Tanoby Ruins (interior) |
| Lost Cave | Caverna perdida | 2520007 | 2274 | interior | dungeon/special | 2520007.glb | yes | 0 | 11 | — | 0 | 2274:Lost Cave (interior) |
| One Island Pokémon Center | Ilha um-Centro de Pokémon | 2540001 | 2289 | interior | pokémon center | 2540001.glb | yes | 4 | 1 | — | 0 | 2289:One Island Pokémon Center (interior) |
| Team Rocket Warehouse | Arzamento de Equipe Rocket | 2540002 | 2288 | interior | building/interior | 2540002.glb | yes | 0 | 1 | — | 0 | 2288:Team Rocket Warehouse (interior) |
| Viridian Pokémon Center | Viridian-Centro de Pokémon | 4110001 | 1401,1402,1403,1404,1405,1406,1407,1408,1409,1410,1411,2290,2291,2292,2293,2294,2295 | interior | pokémon center | 4110001.glb | yes | 8 | 1 | — | 0 | 1401:Viridian Pokémon Center (interior); 1402:Pewter Pokémon Center (interior); 1403:Cerulean Pokémon Center (interior); 1404:Vermilion Pokémon Center (interior); 1405:Lavender Pokémon Center (interior); 1406:Celadon Pokémon Center (interior); 1407:Saffron Pokémon Center (interior); 1408:Fuchsia Pokémon Center (interior); 1409:Cinnabar Pokémon Center (interior); 1410:Route 4 Pokémon Center (interior); 1411:Route 10 Pokémon Center (interior); 2290:Ilha dois Pokémon Center (interior); 2291:Ilha três Pokémon Center (interior); 2292:Ilha Quatro Pokémon Center (interior); 2293:Ilha Cinco Pokémon Center (interior); 2294:Ilha seis Pokémon Center (interior); 2295:Ilha sete Pokémon Center (interior) |
| Professor Oak's Lab | Laboratório do Professor Oak | 4110002 | 1801 | interior | lab | 4110002.glb | yes | 6 | 1 | — | 0 | 1801:Professor Oak's Lab (interior) |
| Miracle Cycle | Bicicleta milagrosa | 4110003 | 1802 | interior | mart/shop | 4110003.glb | yes | 3 | 1 | — | 0 | 1802:Miracle Cycle (interior) |
| Trainer School | Escola de Treinadores | 4110004 | 1803 | interior | house/facility | 4110004.glb | yes | 5 | 1 | — | 0 | 1803:Trainer School (interior) |
| Indigo League Pokémon Center | Liga Índigo-Centro de Pokémon | 4110006 | 1412 | interior | pokémon center | 4110006.glb | yes | 9 | 3 | — | 0 | 1412:Indigo League Pokémon Center (interior) |
| Viridian City Mart | Loja da Cidade Viridian | 4110007 | 1501,1502,1503,1504,1505,1507,1508,1509,2296,2297,2298,2299 | interior | mart/shop | 4110007.glb | yes | 3 | 1 | — | 0 | 1501:Viridian City Mart (interior); 1502:Pewter City Mart (interior); 1503:Cerulean City Mart (interior); 1504:Vermilion City Mart (interior); 1505:Lavender Town Mart (interior); 1507:Loja de da Saffron City (interior); 1508:Fuchsia City Mart (interior); 1509:Cidade Cinnabar Mart (interior); 2296:Ilha três-Loja de Amizade (interior); 2297:Ilha Quatro-Loja de Amizade (interior); 2298:Ilha seis-Loja de Amizade (interior); 2299:Ilha sete-Loja de Amizade (interior) |
| Player's House | A casa do personagem principal | 4110008 | 1804,1805,1823,1827,18231,18271 | interior | house/facility | 4110008.glb | yes | 3 | 3 | — | 0 | 1804:Player's House Piso 1 (interior); 1805:Player's House Piso 2 (interior); 1823:Pewter — Brock's House (interior); 1827:Saffron-Casa da moça Piso 1 (interior); 18231:Pewter — Brock's House (interior); 18271:Saffron-Casa da moça Piso 2 (interior) |
| Pallet Town — Gary Oak's House | Cidade Pallet-Casa do Gary Oak | 4110009 | 1806,1807,1813,1814,1816,1824,1828,1831,1850 | interior | house/facility | 4110009.glb | yes | 0 | 0 | — | 0 | 1806:Pallet Town — Gary Oak's House (interior); 1807:Rota 2-Instituto de Florestas (interior); 1813:Rota 5 - Casa central da Rota 5 (interior); 1814:Rota 16-Casa (interior); 1816:Viridian-Casa da Velha (interior); 1824:Cerulean — Professor's House (interior); 1828:Fuchsia — Room 2 Casa do Bill (interior); 1831:Cerulean-Casa da Jenny (interior); 1850:Safari Zone House 5 (interior) |
| Lavender — Avaliador's House | Lavanda-Casa do Avaliador | 4110010 | 1811,1815,1817,1818,1821,1822,1830 | interior | house/facility | 4110010.glb | yes | 0 | 0 | — | 0 | 1811:Lavender — Avaliador's House (interior); 1815:Fuchsia — diretor's House (interior); 1817:Cerulean — Room pequeno comum (interior); 1818:Vermilion — Room 1 (interior); 1821:Fuchsia — Room 1 (interior); 1822:Saffron — Tio Lutador's House (interior); 1830:Vermilion — Room 1 (interior) |
| Vermilion — Room 3 | Vermilion-Quarto 3 | 4110011 | 1810,1812,1846,1847,1848,1849 | interior | house/facility | 4110011.glb | yes | 0 | 0 | — | 0 | 1810:Vermilion — Room 3 (interior); 1812:Celadon — Room 1 (interior); 1846:Safari Zone House 1 (interior); 1847:Safari Zone House 2 (interior); 1848:Safari Zone House 3 (interior); 1849:Safari Zone House 4 (interior) |
| Pewter — Ata's House | Pewter-Casa do Ata | 4110012 | 1808,1825,1834 | interior | house/facility | 4110012.glb | yes | 0 | 0 | — | 0 | 1808:Pewter — Ata's House (interior); 1825:Lavender- Casa do Velho (interior); 1834:Rota 12-Casa (interior) |
| Cerulean-Tio de medalhas | Celeste-Tio de medalhas | 4110013 | 1809,1832,1833,1838 | interior | building/interior | 4110013.glb | yes | 0 | 0 | — | 0 | 1809:Cerulean-Tio de medalhas (interior); 1832:Cinnabar-Edifício Abandonado (interior); 1833:Fuchsia — Pescador's House (interior); 1838:Cerulean-Casa Roubada (interior) |
| Department Store | Loja de departamentos | 4110014 | 1506,1588 | interior | mart/shop | 4110014.glb | yes | 7 | 4 | — | 0 | 1506:Department Store Piso 1 (interior); 1588:Department Store Piso 2 (interior) |
| Lavender-Casa dos Espíritos | Lavanda-Casa dos Espíritos | 4110015 | 1839 | interior | house/facility | 4110015.glb | yes | 1 | 1 | — | 0 | 1839:Lavender-Casa dos Espíritos (interior) |
| Celadon — Room 3 | Celadon-Quarto 3 | 4110016 | 1819,1820,1826,1829,1840 | interior | house/facility | 4110016.glb | yes | 0 | 0 | — | 0 | 1819:Celadon — Room 3 (interior); 1820:Saffron-Clube de treinadores (interior); 1826:Celadon — Room 2 (interior); 1829:Fuchsia-Sala de descanso do Diretor (interior); 1840:Clube dos Entusiastas (interior) |
| Pewter Science Museum | Pewter-Museu de Ciências | 4110017 | 1841,1842,1851 | interior | house/facility | 4110017.glb | yes | 14 | 4 | — | 0 | 1841:Pewter Science Museum Piso 1 (interior); 1842:Pewter Science Museum Piso 2 (interior); 1851:Pewter Science Museum Piso 1 (interior) |
| Game Corner | Salão de Videogames | 4110018 | 1843 | interior | house/facility | 4110018.glb | yes | 6 | 2 | — | 0 | 1843:Game Corner (interior) |
| Cinnabar Lab | Laboratório Cinnabar | 4110019 | 1844 | interior | lab | 4110019.glb | yes | 7 | 7 | — | 0 | 1844:Cinnabar Lab (interior) |
| Bill's Cottage | Cabana do Cabo | 4110020 | 1845 | interior | house/facility | 4110020.glb | yes | 6 | 1 | — | 0 | 1845:Bill's Cottage (interior) |
| Pewter Gym | Ginásio-Pewter | 4120001 | 1601 | interior | gym/league | 4120001.glb | yes | 7 | 1 | — | 0 | 1601:Pewter Gym (interior) |
| Cerulean Gym | Ginásio - Celeste | 4120002 | 1602 | interior | gym/league | 4120002.glb | yes | 6 | 1 | Misty / medalha Azul | 0 | 1602:Cerulean Gym (interior) |
| Vermilion Gym | Ginásio-Vermilion 1 | 4120003 | 1603,1604,1605 | interior | gym/league | 4120003.glb | yes | 18 | 1 | — | 0 | 1603:Vermilion Gym (interior); 1604:Vermilion Gym (interior); 1605:Vermilion Gym (interior) |
| Celadon Gym | Celadon-Ginásio | 4120004 | 1606 | interior | gym/league | 4120004.glb | yes | 12 | 1 | — | 0 | 1606:Celadon Gym (interior) |
| Fuchsia Gym | Fuchsia-Ginásio 1 | 4120005 | 1607,1608,1609,1610,1611 | interior | gym/league | 4120005.glb | yes | 61 | 1 | — | 0 | 1607:Fuchsia Gym (interior); 1608:Fuchsia Gym (interior); 1609:Fuchsia Gym (interior); 1610:Fuchsia Gym (interior); 1611:Fuchsia Gym (interior) |
| Saffron Gym | Saffron-Ginásio | 4120006 | 1612 | interior | gym/league | 4120006.glb | yes | 9 | 31 | Sabrina / medalha Dourada | 0 | 1612:Saffron Gym (interior) |
| Cinnabar Gym | Cinnabar-Ginásio | 4120007 | 1613 | interior | gym/league | 4120007.glb | yes | 9 | 1 | Blaine / medalha Vermelho Escuro | 0 | 1613:Cinnabar Gym (interior) |
| Viridian Gym | Viridian-Ginásio | 4120008 | 1614 | interior | gym/league | 4120008.glb | yes | 12 | 13 | Giovanni / medalha Verde | 0 | 1614:Viridian Gym (interior) |
| Lorelei's Room | Quarto da Lorelei | 4120009 | 1701,1707 | interior | gym/league | 4120009.glb | yes | 1 | 2 | — | 0 | 1701:Lorelei's Room (interior); 1707:Lorelei's Room (interior) |
| Bruno's Room | Quarto do Bruno | 4120010 | 1702,1708 | interior | gym/league | 4120010.glb | yes | 1 | 2 | — | 0 | 1702:Bruno's Room (interior); 1708:Bruno's Room (interior) |
| Agatha's Room | Quarto da Agatha | 4120011 | 1703,1709 | interior | gym/league | 4120011.glb | yes | 1 | 2 | — | 0 | 1703:Agatha's Room (interior); 1709:Agatha's Room (interior) |
| Lance's Room | Quarto do Lance | 4120012 | 1704,1710 | interior | gym/league | 4120012.glb | yes | 1 | 2 | — | 0 | 1704:Lance's Room (interior); 1710:Lance's Room (interior) |
| Campeão's Room | Quarto do Campeão | 4120013 | 1705,1711 | interior | gym/league | 4120013.glb | yes | 1 | 2 | — | 0 | 1705:Campeão's Room (interior); 1711:Campeão's Room (interior) |
| lutador Gym | Ginásio lutador | 4120014 | 1331 | interior | gym/league | 4120014.glb | yes | 8 | 1 | — | 0 | 1331:lutador Gym (interior) |
| Fuchsia Gym | Fuchsia-Ginásio | 4120015 | 1618 | interior | gym/league | 4120015.glb | yes | 10 | 1 | Koga / medalha Rosa | 0 | 1618:Fuchsia Gym (interior) |
| Vermilion Gym | Ginásio-Vermilion | 4120016 | 1616 | interior | gym/league | 4120016.glb | yes | 10 | 1 | Lt. Surge / medalha Laranja | 0 | 1616:Vermilion Gym (interior) |
| Pewter Gym | Ginásio-Pewter | 4120017 | 1615 | interior | gym/league | 4120017.glb | yes | 7 | 1 | Brock / medalha Cinza | 0 | 1615:Pewter Gym (interior) |
| Connection Center | centro de conexões | 4120018 | 1706 | interior | building/interior | 4120018.glb | yes | 5 | 4 | — | 0 | 1706:Connection Center (interior) |
| Celadon Gym | Celadon-Ginásio | 4120019 | 1617 | interior | gym/league | 4120019.glb | yes | 9 | 1 | Erika / medalha Arco-Íris | 0 | 1617:Celadon Gym (interior) |
| S.S. Anne | Santa Anne | 4120020 | 1336,1337,1338,1339,1340,1341,1342 | interior | dungeon/special | 4120020.glb | yes | 84 | 51 | — | 0 | 1336:S.S. Anne (interior); 1337:S.S. Anne Piso 1 (interior); 1338:S.S. Anne Piso -1 (interior); 1339:S.S. Anne Piso 2 (interior); 1340:S.S. Anne Captain's Cabin (interior); 1341:S.S. Anne Deck Corridor (interior); 1342:S.S. Anne Kitchen (interior) |
| Trial Path | Caminho de Provas | 4220010 | 3201,3202,3203,3204,3205,3206,3207,3208,3209,3210,3211,3212,3213,3214,3215,3216,3217,3218 | cave | special/other | 4220010.glb | yes | 0 | 0 | — | 0 | 3201:Trial Path (cave); 3202:Trial Path (cave); 3203:Trial Path (cave); 3204:Trial Path (cave); 3205:Trial Path (cave); 3206:Trial Path (cave); 3207:Trial Path (cave); 3208:Trial Path (cave); 3209:Trial Path (cave); 3210:Trial Path (cave); 3211:Trial Path (cave); 3212:Trial Path (cave); 3213:Trial Path (cave); 3214:Trial Path (cave); 3215:Trial Path (cave); 3216:Trial Path (cave); 3217:Trial Path (cave); 3218:Trial Path (cave) |
| Nature Park | parque natural | 4220013 | 3121,3132 | cave/interior | special/other | 4220013.glb | yes | 0 | 0 | — | 0 | 3121:Nature Park (outdoor); 3132:Pomar (cave) |
| Treasure Land | Terra dos Tesouros | 4400007 | 47002 | interior | special/other | 4400007.glb | yes | 0 | 0 | — | 0 | 47002:Treasure Land (interior) |
| Gigantamax Battle Field | Campo de Batalha Gigantamax | 4400008 | 47001,47003,47004,47005,47006,47007,47008,47009,47010,47011,47012,47013,47014,47015,47016,47017,47018,47019,47020,47021,47022,47023,47024,47025,47026,47027,47028,47029,47030,47031,47032,47033,47034 | interior | special/other | 4400008.glb | yes | 0 | 0 | — | 0 | 47001:Gigantamax Battle Field (interior); 47003:área 47003 (interior); 47004:área 47004 (interior); 47005:área 47005 (interior); 47006:área 47006 (interior); 47007:área 47007 (interior); 47008:área 47008 (interior); 47009:área 47009 (interior); 47010:área 47010 (interior); 47011:área 47011 (interior); 47012:área 47012 (interior); 47013:área 47013 (interior); 47014:área 47014 (interior); 47015:área 47015 (interior); 47016:área 47016 (interior); 47017:área 47017 (interior); 47018:área 47018 (interior); 47019:área 47019 (interior); 47020:área 47020 (interior); 47021:área 47021 (interior); 47022:área 47022 (interior); 47023:área 47023 (interior); 47024:área 47024 (interior); 47025:área 47025 (interior); 47026:área 47026 (interior); 47027:área 47027 (interior); 47028:área 47028 (interior); 47029:área 47029 (interior); 47030:área 47030 (interior); 47031:área 47031 (interior); 47032:área 47032 (interior); 47033:área 47033 (interior); 47034:área 47034 (interior) |
| Divine Beasts Territory | Território das Bestas Divinas | 4400014 | 47101 | interior | special/other | 4400014.glb | yes | 26 | 0 | — | 0 | 47101:Divine Beasts Territory (interior) |
| Community Battle Field | Campo de Batalha da Comunidade | 4440001 | 42001 | cave | special/other | 4440001.glb | yes | 0 | 0 | — | 0 | 42001:Community Battle Field (cave) |
| Expedition Path Dificuldade fácil-1 | Caminho da Expedição Dificuldade fácil-1 | 4440037 | 47201,47202,47203,47204,47205,47206,47207,47208,47209,47210,47211,47212,47213,47214,47215,47216,47217,47218,47219,47220,47221,47222,47223,47224,47225,47226,47227 | cave | special/other | 4440037.glb | yes | 0 | 0 | — | 0 | 47201:Expedition Path Dificuldade fácil-1 (cave); 47202:Expedition Path Dificuldade fácil-2 (cave); 47203:Expedition Path Dificuldade fácil-3 (cave); 47204:Expedition Path Dificuldade fácil-4 (cave); 47205:Expedition Path Dificuldade fácil-5 (cave); 47206:Expedition Path Dificuldade fácil-6 (cave); 47207:Expedition Path Dificuldade fácil-7 (cave); 47208:Expedition Path Dificuldade fácil-8 (cave); 47209:Expedition Path Dificuldade fácil-9 (cave); 47210:Caminho de Expedição Dificuldade Dificuldade -1 (cave); 47211:Caminho de Expedição Dificuldade Dificuldade -2 (cave); 47212:Caminho de Expedição Dificuldade Dificuldade -3 (cave); 47213:Caminho de Expedição Dificuldade Dificuldade -4 (cave); 47214:Caminho de Expedição Dificuldade Dificuldade -5 (cave); 47215:Caminho de Expedição Dificuldade Dificuldade -6 (cave); 47216:Caminho de Expedição Dificuldade Dificuldade -7 (cave); 47217:Caminho de Expedição Dificuldade Dificuldade -8 (cave); 47218:Caminho de Expedição Dificuldade Dificuldade -9 (cave); 47219:Caminho de Expedição Dificuldade Mestre -1 (cave); 47220:Caminho de Expedição Dificuldade Mestre -2 (cave); 47221:Caminho de Expedição Dificuldade Mestre -3 (cave); 47222:Caminho de Expedição Dificuldade Mestre -4 (cave); 47223:Caminho de Expedição Dificuldade Mestre -5 (cave); 47224:Caminho de Expedição Dificuldade Mestre -6 (cave); 47225:Caminho de Expedição Dificuldade Mestre -7 (cave); 47226:Caminho de Expedição Dificuldade Mestre -8 (cave); 47227:Caminho de Expedição Dificuldade Mestre -9 (cave) |
| House | Casa | 4700001 | 3131 | cave | house/facility | 4700001.glb | yes | 0 | 0 | — | 0 | 3131:House (cave) |

**Interior/special subtotal:** 71 scenes · with GLB=71 · total non-door NPCs≈835 · door warps out=329

### Outdoor door destinations by town/route (unique)

| Area | Doors | Unique destinations |
|---|---:|---|
| Pallet Town (1101) | 3 | Player's House Piso 1 (4110008); Pallet Town — Gary Oak's House (4110009); Professor Oak's Lab (4110002) |
| Viridian City (1102) | 5 | Viridian Pokémon Center (4110001); Viridian City Mart (4110007); Trainer School (4110004); Viridian-Casa da Velha (4110009); Viridian Gym (4120008) |
| Pewter City (1103) | 7 | Pewter Pokémon Center (4110001); Pewter — Ata's House (4110012); Pewter City Mart (4110007); Pewter — Brock's House (4110008); Pewter Science Museum Piso 1 (4110017); Pewter Gym (4120017) |
| Cidade Cerulean (1104) | 11 | Cerulean Pokémon Center (4110001); Cerulean-Tio de medalhas (4110013); Cerulean — Professor's House (4110009); Cerulean-Casa Roubada (4110013); Cerulean-Casa da Jenny (4110009); Miracle Cycle (4110003); Cerulean — Room pequeno comum (4110010); Cerulean City Mart (4110007); Cerulean Gym (4120002) |
| Vermilion City (1105) | 8 | Vermilion Pokémon Center (4110001); Clube dos Entusiastas (4110016); Vermilion Gym (4120016); Vermilion — Room 1 (4110010); Vermilion City Mart (4110007); Vermilion — Room 3 (4110011); S.S. Anne Piso 1 (4120020) |
| Cidade Lavender (1106) | 7 | Lavender Pokémon Center (4110001); Lavender-Casa dos Espíritos (4110015); Pokémon Tower Floor 1 (2100001); Lavender Town Mart (4110007); Lavender- Casa do Velho (4110012); Lavender — Avaliador's House (4110010) |
| Celadon City (1107) | 12 | Celadon Pokémon Center (4110001); Celadon Building Piso 1 (2100010); Department Store Piso 1 (4110014); Game Corner (4110018); Celadon — Room 1 (4110011); Celadon — Room 2 (4110016); Celadon — Room 3 (4110016); Celadon Gym (4120019) |
| Saffron City (1108) | 16 | Saffron Pokémon Center (4110001); Saffron — Tio Lutador's House (4110010); Silph Co. Piso 1 (2100009); Saffron-Casa da moça Piso 1 (4110008); Saffron Gym (4120006); lutador Gym (4120014); Route 7 (1000001); Route 6 (1000001); Route 8 (1000001); Route 5 (1000001); Loja de da Saffron City (4110007); Saffron-Clube de treinadores (4110016) |
| Fuchsia City (1109) | 13 | Fuchsia Pokémon Center (4110001); Fuchsia — Room 1 (4110010); Fuchsia — Room 2 Casa do Bill (4110009); Fuchsia Gym (4120015); Fuchsia City Mart (4110007); Fuchsia-Sala de descanso do Diretor (4110016); Fuchsia — diretor's House (4110010); Fuchsia — Pescador's House (4110013); Route 15 (1000001); Safari Zone (1000001) |
| Cinnabar Island (1110) | 5 | Cinnabar Pokémon Center (4110001); Cidade Cinnabar Mart (4110007); Cinnabar Lab (4110019); Cinnabar Gym (4120007); Cinnabar-Edifício Abandonado (4110013) |
| Route 2 (1202) | 14 | Viridian Forest (1000001); Route 2 (1000001); Rota 2-Instituto de Florestas (4110009); Diglett's Cave (2100008) |
| Route 4 (1204) | 4 | Route 4 Pokémon Center (4110001); Mt. Moon Floor 1 (2100007); Cerulean Cave Floor 1 (2100006) |
| Route 5 (1205) | 4 | Rota 5 - Casa central da Rota 5 (4110009); Route 6 (1000001); Saffron City (1000001) |
| Route 6 (1206) | 3 | Saffron City (1000001); Route 5 (1000001) |
| Route 7 (1207) | 3 | Route 8 (1000001); Saffron City (1000001) |
| Route 8 (1208) | 3 | Saffron City (1000001); Route 7 (1000001) |
| Route 10 (1210) | 4 | Route 10 Pokémon Center (4110001); Rock Tunnel piso 1 (2100012); Abandoned Power Plant (2100002) |
| Route 11 (1211) | 3 | Route 12 (1000001); Diglett's Cave (2100008) |
| Route 12 (1212) | 7 | Route 11 (1000001); Route 12 (1000001); Rota 12-Casa (4110012) |
| Route 15 (1215) | 2 | Fuchsia City (1000001) |
| Route 16 (1216) | 9 | Route 16 (1000001); Rota 16-Casa (4110009) |
| Route 18 (1218) | 4 | Route 18 (1000001) |
| Route 22 (1222) | 1 | Connection Center (4120018) |
| Route 23 (1223) | 7 | Connection Center (4120018); Victory Road Floor 1 (2100004); Victory Road Floor 2 (2100004); Indigo League Pokémon Center (4110006) |
| Route 25 (1225) | 1 | Bill's Cottage (4110020) |
| Viridian Forest (1191) | 8 | Route 2 (1000001) |
| Safari Zone (1192) | 7 | Fuchsia City (1000001); Safari Zone House 4 (4110011); Safari Zone House 5 (4110009); Safari Zone House 3 (4110011); Safari Zone House 1 (4110011); Safari Zone House 2 (4110011) |
| Competition Center (1193) | 7 | Pallet Town (1000001) |
| Seafoam Islands (1299) | 2 | Seafoam Islands Floor 1 (2100003) |


## 3. Classic Kanto locations — present / missing / placeholder

| Classic location | Status | Notes |
|---|---|---|
| Pallet Town | ✅ PRESENT | PRESENT outdoor 1101 + interiors |
| Viridian City | ✅ PRESENT | PRESENT |
| Pewter City | ✅ PRESENT | PRESENT |
| Cerulean City | ✅ PRESENT | PRESENT |
| Vermilion City | ✅ PRESENT | PRESENT |
| Lavender Town | ✅ PRESENT | PRESENT |
| Celadon City | ✅ PRESENT | PRESENT |
| Saffron City | ✅ PRESENT | PRESENT |
| Fuchsia City | ✅ PRESENT | PRESENT |
| Cinnabar Island | ✅ PRESENT | PRESENT outdoor 1110 + lab/gym |
| Indigo Plateau | ⚠️ PARTIAL | PARTIAL — Elite Four/Champion rooms + League PC exist as interiors (4120009–4120013, 4110006); no dedicated outdoor “Indigo Plateau” area in kanto.areas |
| Route 1–25 | ✅ PRESENT | PRESENT as outdoor areas 1201–1225 |
| Sea routes 19–21 | ✅ PRESENT | PRESENT outdoor; water travel via mounts (Lapras etc.), not HM Surf item |
| Cycling Road (16–18) | ✅ PRESENT | PRESENT as outdoor routes (mission “A Ciclovia”); no separate bicycle-required gate scene called out |
| Viridian Forest | ✅ PRESENT | PRESENT outdoor area 1191 (not a separate cave scene) |
| Mt. Moon | ✅ PRESENT | PRESENT scene 2100007 (3 floors) + GLB |
| Diglett's Cave | ✅ PRESENT | PRESENT 2100008 |
| Rock Tunnel | ✅ PRESENT | PRESENT 2100012 |
| Pokémon Tower | ✅ PRESENT | PRESENT 2100001 (7 floors) |
| Power Plant | ✅ PRESENT | PRESENT 2100002 |
| Seafoam Islands | ✅ PRESENT | PRESENT outdoor marker 1299 + dungeon scene 2100003 (5 floors) |
| Pokemon Mansion | ✅ PRESENT | PRESENT as scene 2100013 “Casa de Pokémon” (single area) — likely simplified vs multi-floor Gen 1 mansion |
| Safari Zone | ✅ PRESENT | PRESENT outdoor 1192 + interior scene 2100011 |
| Silph Co. | ✅ PRESENT | PRESENT 2100009 |
| Team Rocket Hideout | ✅ PRESENT | PRESENT 2100005 |
| Game Corner | ✅ PRESENT | PRESENT 4110018 |
| Celadon Dept. Store | ✅ PRESENT | PRESENT 4110014 |
| S.S. Anne | ✅ PRESENT | PRESENT 4120020 (7 areas) |
| Victory Road | ✅ PRESENT | PRESENT 2100004 (3 floors) |
| Cerulean Cave | ✅ PRESENT | PRESENT 2100006 |
| Fighting Dojo | ✅ PRESENT | PRESENT 4120014 |
| Bill's House | ✅ PRESENT | PRESENT 4110020 |
| Underground Path (5/6 & 7/8) | ❌ MISSING | MISSING as named scene — Route 5–8 exist outdoors; no Underground Path dungeon in scenes.json |
| Pokemon Fan Club | ✅ PRESENT | LIKELY PRESENT via Vermilion warp “Clube dos Entusiastas” → shared interior scene |
| Cerulean Bike Shop | ✅ PRESENT | PRESENT 4110003 Miracle Cycle |
| Fuchsia Safari Gate / Warden | ✅ PRESENT | PRESENT via Safari scenes |
| Sevii Islands (One Island etc.) | ➕ EXTRA | EXTRA present (not classic Kanto): 2500001, 252*, 254* |

### Placeholder / incomplete signals

- `zonas_spawn.json` is **empty** (`zonas: []`). Live grass/water encounters use `habitats.json` instead.
- Several mission badge steps still say **"ginásios em breve"** (“gyms coming soon”) in objective text even though `gyms.json` defines all 8 leaders/scenes.
- Multiple **duplicate gym scene IDs** in `scenes.json` (e.g. Pewter `4120001` & `4120017`; Celadon `4120004` & `4120019`; Fuchsia `4120005` & `4120015`; Vermilion `4120003` & `4120016`) — `gyms.json` points at the `cenaComPorta` variants (4120017, 4120002, 4120016, 4120019, 4120015, 4120006, 4120007, 4120008).
- **Pokémon Centers / Marts** often share one GLB scene id with **city remapping** via arrival cfg digits (`idx_mod_0.mjs` remaps 14xx/15xx city codes) — `4110001` appears as Pewter PC in its JSON but warps from many cities reuse it.
- Outdoor **Seafoam** (`1299`) is a surface marker on the big map; the full cave is separate scene `2100003`.
- **Indigo Plateau** overworld plaza is not an outdoor `kanto` area; League is interior-only rooms.
- **Underground Path** tunnels from the originals are not exported as scenes.

### Outdoor areas with NO habitat species

- Pallet Town (`1101`)
- Pewter City (`1103`)
- Cerulean City (`1104`)
- Lavender Town (`1106`)
- Celadon City (`1107`)
- Saffron City (`1108`)
- Fuchsia City (`1109`)
- Cinnabar Island (`1110`)
- Competition Center (`1193`)

## 4. NPCs, dialogues, missions, gyms

### NPC totals

| Source | Count |
|---|---:|
| `npcs_glb.json` catalog entries | 377 |
| Catalog entries with ≥1 `falas` line | 359 |
| Total `falas` strings in catalog | 442 |
| Outdoor placed NPCs in `kanto.json` (incl. door/arrival markers) | 1305 |
| Outdoor trainers in `kanto.json` | 1984 |
| `dialogues.json` scripted keys | 12 |

NPC catalog `tipo` breakdown: tipo 1=150, tipo 2=33, tipo 4=63, tipo 8=37, tipo undef=94

#### `dialogues.json` keys

- **oakNome:** Professor Samuel
- **portao:** Espera! Sem um Pokémon, a grama alta da Rota 1 é perigosa. / Fale com o Professor Oak no laboratório antes de sair de Pallet.
- **portaoBalao:** Fale com o Professor Oak antes de sair!
- **portaoChat:** Assistente do professor: fale com o Professor Oak antes de sair de Pallet.
- **oakJaEscolheu:** Você já escolheu {nome}. Cuide bem dele!
- **oakEntrega:** {nome} é seu! Cuide bem dele. / Na Rota 1 tem Pokémon selvagem: derrube um e jogue a bola (F) pra capturar.
- **escolhaTitulo:** Escolhe o Pokémon que desejas.
- **escolhaSub:** O Início da Jornada · o escolhido vira o seu parceiro (Lv 5) e entra no time
- **jaVenceu:** Você já me venceu!
- **introLiga:** Liga Índigo — a final do campeonato
- **introRed:** Red: — Ainda não acabou.
- **introMega:** Mega Charizard X!

### Gyms (`gyms.json`)

| # | English gym name | Leader | City | Type | Scene | Badge | Team | Reward $ |
|---:|---|---|---|---|---:|---|---|---:|
| 1 | Boulder Gym (Pewter) | Brock | Pewter | Pedra | 4120017 | Boulder Badge (medalha Cinza) | #74 Lv14, #95 Lv16 | 1300 |
| 2 | Cascade Gym (Cerulean) | Misty | Cerulean | Água | 4120002 | Cascade Badge (medalha Azul) | #120 Lv22, #121 Lv24 | 1800 |
| 3 | Thunder Gym (Vermilion) | Lt. Surge | Vermilion | Elétrico | 4120016 | Thunder Badge (medalha Laranja) | #100 Lv28, #25 Lv28, #26 Lv30 | 2300 |
| 4 | Rainbow Gym (Celadon) | Erika | Celadon | Planta | 4120019 | Rainbow Badge (medalha Arco-Íris) | #114 Lv34, #71 Lv35, #45 Lv36 | 2800 |
| 5 | Soul Gym (Fuchsia) | Koga | Fuchsia | Venenoso | 4120015 | Soul Badge (medalha Rosa) | #109 Lv42, #109 Lv42, #89 Lv43, #110 Lv44 | 3300 |
| 6 | Marsh Gym (Saffron) | Sabrina | Saffron | Psíquico | 4120006 | Marsh Badge (medalha Dourada) | #64 Lv48, #122 Lv48, #49 Lv49, #65 Lv50 | 3800 |
| 7 | Volcano Gym (Cinnabar) | Blaine | Cinnabar | Fogo | 4120007 | Volcano Badge (medalha Vermelho Escuro) | #58 Lv54, #77 Lv54, #78 Lv55, #59 Lv56 | 4300 |
| 8 | Earth Gym (Viridian) | Giovanni | Viridian | Terra | 4120008 | Earth Badge (medalha Verde) | #111 Lv58, #51 Lv58, #31 Lv59, #34 Lv59, #112 Lv60 | 4800 |

### Missions / quests (`missions.json`)

Version 1, generated 2026-09-14.

| Ch. | Chapter (EN) | Quest ID | Title (EN/PT) | Objectives | Rewards |
|---:|---|---:|---|---|---|
| 1 | Cidade Pallet | 101 | O Início da Jornada | Fale com a sua mãe → Vá ao laboratório do Professor Oak → Escolha um dos três iniciais na mesa → Fale com o Professor Oak | $500; 100 EXP; items: #1001×5, #2001×3 |
| 1 | Cidade Pallet | 102 | Primeiros Passos | Vá para Rota 1 → Derrote 3 Pokémon selvagens em Rota 1 → Volte e fale com o assistente do professor | $300; 150 EXP; items: #2001×2 |
| 1 | Cidade Pallet | 103 | Aula de Captura | Capture 1 Pokémon (derrube e aperte F) → Mostre a captura ao Professor Oak | $600; 200 EXP; items: #1001×5 |
| 1 | Cidade Pallet | 104 | O Pacote do Professor | Vá para Cidade Viridian → Pegue o pacote com o vendedor de Viridian → Entregue o pacote ao Professor Oak | $1000; 250 EXP; items: #1002×2, #2001×2 |
| 2 | Viridian City | 201 | Trainer School / Escola de Treinadores | Fale com Sadie, em Viridian → Chegue ao Lv 8 com um Pokémon → Volte e fale com Sadie | $500; 200 EXP; items: #2001×3 |
| 2 | Viridian City | 202 | O Rival | Vá para Rota 22 → Fale com Gary na Rota 22 → Derrote 4 Pokémon selvagens em Rota 22 → Fale com Gary de novo | $800; 250 EXP; items: #1001×3 |
| 2 | Viridian City | 203 | Aula de Batalha | Vença 2 treinadores em Rota 1 | $700; 300 EXP; items: #2006×2 |
| 2 | Viridian City | 204 | Rumo ao Norte | Vá para Rota 2 → Capture 2 Pokémon na Rota 2 → Vença 1 treinador em Rota 2 | $800; 300 EXP; items: #1001×5 |
| 3 | Floresta Verde e Pewter | 301 | Viridian Forest / Floresta Verde | Vá para Floresta Verde → Derrote 5 Pokémon selvagens em Floresta Verde → Vença os alunos Kenji e Aoki | $900; 350 EXP; items: #2001×3 |
| 3 | Floresta Verde e Pewter | 302 | O Mentor | Vença o Mentor Kageron → Fale com o Mentor Kageron | $1000; 400 EXP; items: #2002×2 |
| 3 | Floresta Verde e Pewter | 303 | A Caminho de Pewter | Vá para Cidade Pewter → Fale com Xiko, em Pewter → Cure o time com a Enfermeira Joy | $500; 200 EXP; items:  |
| 3 | Floresta Verde e Pewter | 304 | Museu Invadido | Fale com Colin → Expulse os recrutas da Team Rocket → Volte a falar com Colin | $1500; 500 EXP; items: #1001×5 |
| 3 | Floresta Verde e Pewter | 305 | Badge: da Rocha / Insígnia da Rocha | Conquiste a 1ª insígnia → Fale com Elisa | $2000; 600 EXP; items: #2002×3 |
| 4 | Monte da Lua | 401 | Route 3 / Rota 3 | Vá para Rota 3 → Vença 2 treinadores em Rota 3 → Capture 1 Pokémon na Rota 3 | $1000; 400 EXP; items: #2001×3 |
| 4 | Monte da Lua | 402 | O Centro da Rota 4 | Vá para Rota 4 → Cure o time com a Enfermeira Joy → Vença 3 treinadores em Rota 4 | $1200; 450 EXP; items: #2006×2 |
| 4 | Monte da Lua | 403 | Os Fósseis | Fale com Hiromi, na Rota 4 → Derrote 6 Pokémon selvagens em Rota 4 → Volte a falar com Hiromi | $1500; 500 EXP; items: #1002×3 |
| 5 | Cerulean City | 501 | Cerulean City / Cidade Celeste | Vá para Cidade Celeste → Fale com Floria → Cure o time com a Enfermeira Joy | $800; 300 EXP; items:  |
| 5 | Cerulean City | 502 | A Ponte Pepita | Vá para Rota 24 → Vença 3 treinadores em Rota 24 | $1500; 600 EXP; items: #2002×2 |
| 5 | Cerulean City | 503 | A Casa do Bill | Fale com Gary em Celeste → Vença 2 treinadores em Rota 25 → Fale com Carol, na Rota 25 | $1800; 700 EXP; items: #1001×5 |
| 5 | Cerulean City | 504 | A Casa Roubada | Fale com Everett → Derrote 5 Pokémon selvagens em Rota 5 → Fale com Tyrone | $1500; 600 EXP; items: #2006×3 |
| 5 | Cerulean City | 505 | Badge: da Cascata / Insígnia da Cascata | Conquiste a 2ª insígnia → Fale com Floria | $2500; 800 EXP; items: #2002×3 |
| 6 | Rumo ao Porto | 601 | Rotas 5 e 6 | Vá para Rota 5 → Fale com Yongar, na Rota 5 → Vença 2 treinadores em Rota 6 → Vá para Cidade Vermilion | $1200; 500 EXP; items: #2001×3 |
| 6 | Rumo ao Porto | 602 | O Charmander Abandonado | Fale com o Charmander abandonado → Capture um Pokémon pra mostrar que sabe cuidar → Volte ao Charmander | $1500; 600 EXP; items: #1002×3 |
| 6 | Rumo ao Porto | 603 | Vermilion City / Cidade Vermilion | Fale com Cord → Cure o time com a Enfermeira Joy → Vença 2 treinadores em Rota 11 | $1500; 650 EXP; items: #2002×2 |
| 6 | Rumo ao Porto | 604 | Badge: do Trovão / Insígnia do Trovão | Conquiste a 3ª insígnia → Fale com Shada | $3000; 900 EXP; items: #2003×2 |
| 7 | Túnel de Pedra e Lavanda | 701 | Rotas 9 e 10 | Vá para Rota 9 → Vença 3 treinadores em Rota 9 → Vá para Rota 10 → Cure o time com a Enfermeira Joy | $1800; 700 EXP; items: #2001×3 |
| 7 | Túnel de Pedra e Lavanda | 702 | A Torre Pokémon | Vá para Cidade Lavanda → Fale com Sejong → Derrote 6 Pokémon selvagens em Rota 8 → Fale com Amy | $2000; 800 EXP; items: #2002×3 |
| 8 | Celadon City | 801 | Route 8 / Rota 8 | Vá para Rota 8 → Vença as gêmeas Rina e Karna | $1500; 700 EXP; items: #2006×2 |
| 8 | Celadon City | 802 | Celadon City / Cidade Celadon | Vá para Cidade Celadon → Fale com Keith → Cure o time com a Enfermeira Joy | $1000; 400 EXP; items:  |
| 8 | Celadon City | 803 | O Esconderijo da Rocket | Fale com Gavin → Derrote 8 Pokémon selvagens em Rota 7 → Fale com Cornelius | $2500; 900 EXP; items: #1002×3 |
| 8 | Celadon City | 804 | Badge: do Arco-íris / Insígnia do Arco-íris | Conquiste a 4ª insígnia → Fale com Emily | $3500; 1000 EXP; items: #2003×2 |
| 9 | The South | 901 | O Snorlax da Rota 12 | Vá para Rota 12 → Veja o Snorlax na Rota 12 → Vença 3 treinadores em Rota 13 → Vá para Rota 15 | $2000; 900 EXP; items: #2002×3 |
| 9 | The South | 902 | Fuchsia City / Cidade Fuchsia | Vá para Cidade Fuchsia → Fale com Remy → Cure o time com a Enfermeira Joy | $1000; 400 EXP; items:  |
| 9 | The South | 903 | Zona do Safári | Vá para campo de safári → Capture 3 Pokémon no Safári → Fale com Anand | $3000; 1000 EXP; items: #1002×5 |
| 9 | The South | 904 | Badge: da Alma / Insígnia da Alma | Conquiste a 5ª insígnia → Fale com Nanyun | $4000; 1100 EXP; items: #2003×3 |
| 10 | Saffron City | 1001 | Route 7 / Rota 7 | Vá para Rota 7 → Vença o campista Fuko | $1200; 600 EXP; items: #2001×3 |
| 10 | Saffron City | 1002 | Silph Co. | Vá para Cidade Saffron → Fale com Sergei → Derrote 8 Pokémon selvagens em Rota 6 → Fale com Nadai | $3500; 1200 EXP; items: #1002×3, #2002×3 |
| 10 | Saffron City | 1003 | O Dojo | Chegue ao Lv 40 com um Pokémon → Fale com Sean | $2000; 900 EXP; items: #2003×2 |
| 10 | Saffron City | 1004 | Badge: do Pântano / Insígnia do Pântano | Conquiste a 6ª insígnia → Fale com Lang | $4500; 1300 EXP; items: #2003×3 |
| 11 | Cycling Road and the Sea | 1101 | A Ciclovia | Vá para Rota 16 → Veja o Snorlax da Rota 16 → Derrote 6 Pokémon selvagens em Rota 17 → Fale com Janine, na Rota 17 | $2500; 1000 EXP; items: #2002×3 |
| 11 | Cycling Road and the Sea | 1102 | Rotas 19 e 20 | Vá para Rota 19 → Derrote 5 Pokémon selvagens em Rota 19 → Vá para Rota 20 → Fale com Kim, na Rota 20 | $3000; 1100 EXP; items: #1002×3 |
| 12 | Cinnabar Island | 1201 | A Ilha do Vulcão | Vá para Ilha Cinnabar → Fale com Ehrman → Cure o time com a Enfermeira Joy | $1500; 600 EXP; items:  |
| 12 | Cinnabar Island | 1202 | A Mansão Pokémon | Derrote 8 Pokémon selvagens em Rota 21 → Volte a falar com Ehrman | $3500; 1300 EXP; items: #2003×3 |
| 12 | Cinnabar Island | 1203 | Badge: do Vulcão / Insígnia do Vulcão | Conquiste a 7ª insígnia → Fale com Ehrman | $5000; 1500 EXP; items: #2003×3 |
| 13 | Back to Viridian | 1301 | O Ginásio Reaberto | Vá para Cidade Viridian → Fale com Kurozawa → Derrote 6 Pokémon selvagens em Rota 22 | $2500; 1100 EXP; items: #2002×3 |
| 13 | Back to Viridian | 1302 | Badge: da Terra / Insígnia da Terra | Conquiste a 8ª insígnia → Fale com Blue Oak | $6000; 2000 EXP; items: #2003×5 |
| 14 | Victory Road | 1401 | Route 23 / Rota 23 | Vá para Rota 23 → Fale com Chan → Vença 3 treinadores em qualquer lugar | $3000; 1400 EXP; items: #2003×3 |
| 14 | Victory Road | 1402 | A Última Prova | Derrote 10 Pokémon selvagens → Chegue ao Lv 55 com um Pokémon → Fale com Conrad, na Rota 23 | $4000; 1800 EXP; items: #2003×3 |
| 15 | Indigo League | 1501 | O Centro da Liga | Vá para Liga ÍndigoCentro de Pokémon → Cure o time com a Enfermeira Joy → Chegue ao Lv 60 com um Pokémon | $3000; 1500 EXP; items: #2003×5 |
| 15 | Indigo League | 1502 | Elite dos Quatro | Vença a Elite dos Quatro | $8000; 3000 EXP; items: #2003×5 |
| 15 | Indigo League | 1503 | O Campeão | Encontre Gary | $10000; 4000 EXP; items: #2003×5 |
| 16 | Seafoam Islands | 1601 | As Ilhas | Vá para ilhas seaform → Derrote 8 Pokémon selvagens em ilhas seaform → Fale com Sōsuke | $4000; 2000 EXP; items: #2003×3 |
| 17 | Kanto Legends | 1701 | Caçador de Lendas | Capture 5 Pokémon → Chegue ao Lv 70 com um Pokémon | $5000; 2500 EXP; items: #1002×5 |
| 18 | Competition Center | 1801 | O Mestre de Menta | Vá para Centro de Competição → Fale com o Mestre de Menta → Vença 5 treinadores em qualquer lugar | $6000; 3000 EXP; items: #2003×5 |
| 19 | Back to Pallet | 1901 | House / Casa | Vá para Cidade Pallet → Fale com Daisy Oak → Fale com o Professor Oak | $5000; 2500 EXP; items: #2003×5 |
| 20 | Champion of Kanto | 2001 | O Título | Conquiste a 8ª insígnia → Chegue ao Lv 80 com um Pokémon → Fale com Gary | $20000; 5000 EXP; items: #2003×10 |

**Mission totals:** 20 chapters, 56 quests.

## Scene loading (`idx_mod_0.mjs` / `world.mjs`)

1. Resolve `NOME` from `?mapa=` → `localStorage.ultimaCena` → default `kanto`.
2. After account/passe gate, parallel fetch: `./scenery/${NOME}.glb`, `./scenery/${NOME}_chao.json`, `./data/${NOME}.json`, plus `scenes.json` index.
3. `INTERIOR` if scene ≠ 1000001 and all areas have `tipo !== 1`.
4. Door NPCs from map `npcs[]` whose `cfg` is in `doors.json` with `t=6`; crossing reloads via `irParaCena` → `?mapa=&chegada=` with `sessionStorage[porta.ok]`.
5. `world.mjs` handles shared wild Pokémon / capture networking once the scene is up — not scene discovery.

## Appendix — all `scenes.json` scene IDs

| Scene ID | PT name | EN | Areas | objeto flag |
|---:|---|---|---:|---|
| 1000001 | Cidade Pallet | Pallet Town | 39 | true |
| 1000002 | Habitat | Habitat | 1 | true |
| 2100001 | Torre de Pokémon | Pokémon Tower | 7 | true |
| 2100002 | Usina Elétrica Abandonada | Abandoned Power Plant | 1 | true |
| 2100003 | Ilhas Seaform | Seafoam Islands | 5 | true |
| 2100004 | Caminho dos Campeões | Victory Road | 3 | true |
| 2100005 | Esconderijo da Equipe Rocket | Team Rocket Hideout | 2 | true |
| 2100006 | Caverna Celeste | Cerulean Cave | 3 | true |
| 2100007 | Monte Lua | Mt. Moon | 3 | true |
| 2100008 | Caverna Diglett | Diglett's Cave | 1 | true |
| 2100009 | Companhia Silph | Silph Co. | 3 | true |
| 2100010 | Edifício de Celadon | Celadon Building | 3 | true |
| 2100011 | Campo de Safári (Kanto) | Safari Zone (Kanto) | 7 | false |
| 2100012 | Túnel de pedra | Rock Tunnel | 2 | true |
| 2100013 | Casa de Pokémon | Pokémon House | 1 | true |
| 2500001 | Ilha Um | One Island | 26 | true |
| 2520001 | Monte das Brasas-Caverna do Meio da Montanha | Monte das Brasas-Caverna do Meio da Montanha | 1 | true |
| 2520002 | Monte das Brasas-Caverna Direita | Monte das Brasas-Caverna Direita | 3 | true |
| 2520003 | Fonte Termal do monte das Brasas | Fonte Termal do monte das Brasas | 1 | true |
| 2520004 | Caverna Glacial | Icefall Cave | 1 | true |
| 2520005 | Caverna da Alteração | Alteration Cave | 1 | true |
| 2520006 | Ruínas de Tanoby | Tanoby Ruins | 1 | true |
| 2520007 | Caverna perdida | Lost Cave | 1 | true |
| 2540001 | Ilha um-Centro de Pokémon | Ilha um-Centro de Pokémon | 1 | true |
| 2540002 | Arzamento de Equipe Rocket | Team Rocket Warehouse | 1 | true |
| 4110001 | Viridian-Centro de Pokémon | Viridian-Centro de Pokémon | 17 | true |
| 4110002 | Laboratório do Professor Oak | Laboratório do Professor Oak | 1 | true |
| 4110003 | Bicicleta milagrosa | Miracle Cycle | 1 | true |
| 4110004 | Escola de Treinadores | Trainer School | 1 | true |
| 4110006 | Liga Índigo-Centro de Pokémon | Liga Índigo-Centro de Pokémon | 1 | true |
| 4110007 | Loja da Cidade Viridian | Loja da Cidade Viridian | 12 | true |
| 4110008 | A casa do personagem principal | A casa do personagem principal | 6 | true |
| 4110009 | Cidade Pallet-Casa do Gary Oak | Cidade Pallet-Casa do Gary Oak | 9 | false |
| 4110010 | Lavanda-Casa do Avaliador | Lavanda-Casa do Avaliador | 7 | false |
| 4110011 | Vermilion-Quarto 3 | Vermilion-Quarto 3 | 6 | false |
| 4110012 | Pewter-Casa do Ata | Pewter-Casa do Ata | 3 | false |
| 4110013 | Celeste-Tio de medalhas | Celeste-Tio de medalhas | 4 | false |
| 4110014 | Loja de departamentos | Department Store | 2 | true |
| 4110015 | Lavanda-Casa dos Espíritos | Lavanda-Casa dos Espíritos | 1 | true |
| 4110016 | Celadon-Quarto 3 | Celadon-Quarto 3 | 5 | false |
| 4110017 | Pewter-Museu de Ciências | Pewter-Museu de Ciências | 3 | true |
| 4110018 | Salão de Videogames | Salão de Videogames | 1 | true |
| 4110019 | Laboratório Cinnabar | Laboratório Cinnabar | 1 | true |
| 4110020 | Cabana do Cabo | Cabana do Cabo | 1 | true |
| 4120001 | Ginásio-Pewter | Ginásio-Pewter | 1 | true |
| 4120002 | Ginásio - Celeste | Ginásio - Celeste | 1 | true |
| 4120003 | Ginásio-Vermilion 1 | Ginásio-Vermilion 1 | 3 | true |
| 4120004 | Celadon-Ginásio | Celadon-Ginásio | 1 | true |
| 4120005 | Fuchsia-Ginásio 1 | Fuchsia-Ginásio 1 | 5 | true |
| 4120006 | Saffron-Ginásio | Saffron-Ginásio | 1 | true |
| 4120007 | Cinnabar-Ginásio | Cinnabar-Ginásio | 1 | true |
| 4120008 | Viridian-Ginásio | Viridian-Ginásio | 1 | true |
| 4120009 | Quarto da Lorelei | Quarto da Lorelei | 2 | true |
| 4120010 | Quarto do Bruno | Quarto do Bruno | 2 | true |
| 4120011 | Quarto da Agatha | Quarto da Agatha | 2 | true |
| 4120012 | Quarto do Lance | Quarto do Lance | 2 | true |
| 4120013 | Quarto do Campeão | Quarto do Campeão | 2 | true |
| 4120014 | Ginásio lutador | Ginásio lutador | 1 | true |
| 4120015 | Fuchsia-Ginásio | Fuchsia-Ginásio | 1 | true |
| 4120016 | Ginásio-Vermilion | Ginásio-Vermilion | 1 | true |
| 4120017 | Ginásio-Pewter | Ginásio-Pewter | 1 | true |
| 4120018 | centro de conexões | centro de conexões | 1 | true |
| 4120019 | Celadon-Ginásio | Celadon-Ginásio | 1 | true |
| 4120020 | Santa Anne | Santa Anne | 7 | true |
| 4220010 | Caminho de Provas | Caminho de Provas | 18 | false |
| 4220013 | parque natural | parque natural | 2 | true |
| 4400007 | Terra dos Tesouros | Terra dos Tesouros | 1 | false |
| 4400008 | Campo de Batalha Gigantamax | Campo de Batalha Gigantamax | 33 | false |
| 4400014 | Território das Bestas Divinas | Território das Bestas Divinas | 1 | true |
| 4440001 | Campo de Batalha da Comunidade | Campo de Batalha da Comunidade | 1 | false |
| 4440037 | Caminho da Expedição Dificuldade fácil-1 | Caminho da Expedição Dificuldade fácil-1 | 27 | false |
| 4700001 | Casa | House | 1 | true |


## Critical connectivity / placeholder notes (warps)

| Location | Scene | Access finding |
|---|---:|---|
| Safari Zone (full multi-zone dungeon) | 2100011 | **No inbound warps** in `doors.json` resolve to this scene. Outdoor Safari area `1192` warps only to “Safari House” areas remapped into shared house scenes `4110011` / `4110009`. The 7-area Safari GLB appears **orphaned** from the live door graph. |
| Pokémon Mansion | 2100013 | Reachable indirectly: Cinnabar → shared interior `4110013` area `1832` (“Cinnabar Abandoned Building”) → mansion. Single-floor vs Gen 1 multi-floor. |
| Team Rocket Hideout | 2100005 | Entered from Game Corner `4110018` (door cfg `6184302`), not from outdoor Celadon directly. |
| Shared Pokémon Centers / Marts | 4110001 / 4110007 | One GLB hosts many city-named areas (`1402` Pewter PC, `1409` Cinnabar PC, etc.); `idx_mod_0.mjs` remaps city digits on arrival. |
| Duplicate gym GLBs | 4120001 vs 4120017 etc. | Only the `gyms.json` `cena` IDs are the wired leaders. |
| Sevii / postgame islands | 2500001, 252*, 254* | Present as extra content beyond classic Kanto mainland. |
| Non-Kanto `doors.json` rows | (e.g. c=2000001) | Catalog still contains other-region door rows; ~1919 warps resolve to scenes/areas **not** in this `scenes.json` Kanto export. |

### Dungeon habitat coverage (`habitats.json`)

Present for: Pokémon Tower floors 2–6, Seafoam 1–5, Victory Road 1–3, Cerulean Cave 1–3, Diglett's Cave, Mt. Moon floors, Power Plant, Rock Tunnel 1–2.

**No habitat rows** for: Silph Co., Rocket Hideout, Safari dungeon `2100011`, S.S. Anne, Pokémon Mansion, gyms, most city interiors, outdoor towns except Viridian (water) + Vermilion (Shellder) + routes/forest/safari surface/seafoam surface.

Outdoor routes without their own list still show **generic** Rattata/Pidgey on the World Map UI (`habitats.generico`).

---

*Audit method: read-only Node parsers over `public/data/*`, `scenery/*` presence checks, and greps of `idx_mod_0.mjs` / `menus.mjs` / `world.mjs`. Did **not** open `server/data`. No files modified.*
