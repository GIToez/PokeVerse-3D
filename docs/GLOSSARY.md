# Portuguese → English glossary

The codebase was written in Portuguese. The folders and module/file names have been
**renamed to English** (imports and asset paths were updated to match). The code *inside*
each file — variable names, function names, and comments — is still largely Portuguese,
so this glossary doubles as a vocabulary guide. In the module tables below, the "File"
column shows the **original Portuguese name**; see the paragraph under each table or the
mapping in the rename commit for the new English name. Data-file (`public/data/*.json`)
names were left unchanged because many are referenced by key across the code and the
admin schemas.

## Common words

| Portuguese   | English            | Portuguese    | English              |
| ------------ | ------------------ | ------------- | -------------------- |
| servidor     | server             | jogo / jogar  | game / to play       |
| jogador(es)  | player(s)          | conta         | account              |
| cenário      | scenery / scene    | cena(s)       | scene(s)             |
| mapa         | map                | área(s)       | area(s)              |
| mundo        | world              | navegação     | navigation           |
| golpe(s)     | move(s) (attacks)  | captura       | capture / catch      |
| espécie(s)   | species            | evolução      | evolution            |
| treinador    | trainer            | ginásio(s)    | gym(s)               |
| insígnia     | badge              | missão/missões| mission(s)           |
| mochila(s)   | bag(s) / backpack  | item(ns)      | item(s)              |
| loja(s)      | shop(s)            | montaria(s)   | mount(s)             |
| som          | sound / audio      | música(s)     | music                |
| partícula(s) | particle(s)        | fogo          | fire                 |
| lodo         | sludge / slime     | tinta         | paint / dye          |
| troca        | trade              | correio       | mail                 |
| chat         | chat               | diálogo(s)    | dialogue(s)          |
| tela(s)      | screen(s)          | menu(s)       | menu(s)              |
| personagem   | character          | sexo(s)       | sex / gender         |
| altura(s)    | height(s)          | tamanho(s)    | size(s)              |
| regra(s)     | rule(s)            | evento(s)     | event(s)             |
| recurso(s)   | resource(s)        | moderação     | moderation           |
| diretor      | director (orchestrator) | gravador | recorder             |
| prévia       | preview            | camada(s)     | layer(s)             |
| elenco       | cast (NPC roster)  | habitat(s)    | habitat(s)           |
| zona(s)      | zone(s)            | porta(s)      | door(s) / warps      |
| sela(s)      | saddle(s)          | passe         | pass (battle pass)   |
| arrastar     | to drag            | idioma        | language             |
| iniciais     | starters           | aparições     | spawns / appearances |

## Top-level client modules (`*.mjs`)

| File                   | Meaning                                             |
| ---------------------- | -------------------------------------------------- |
| `index.html`           | Game client entry point                             |
| `inicio.mjs`           | Startup / boot                                       |
| `rede.mjs`             | Network (WebSocket client)                           |
| `conta.mjs`            | Account (login / signup client)                     |
| `mundo.mjs`            | World (map, streaming, environment)                 |
| `navegacao.mjs`        | Navigation / pathfinding                             |
| `personagem.mjs`       | Character (the player avatar)                       |
| `telas.mjs`            | Screens (login, menus flow)                         |
| `telas_personagem.mjs` | Character-creation screens                           |
| `menus.mjs`            | In-game menus                                        |
| `hud.mjs`              | Heads-up display                                     |
| `popup.mjs`            | Popups / modal dialogs                              |
| `chat.mjs`             | Chat                                                 |
| `dialogos.mjs`         | NPC dialogue                                         |
| `missoes.mjs`          | Missions                                             |
| `regras.mjs`           | Game rules                                           |
| `passe_regras.mjs`     | Battle-pass rules                                   |
| `captura.mjs`          | Catching                                             |
| `individuo.mjs`        | Individual Pokémon (stats, IVs, instance)          |
| `especies` / `golpes.mjs` | Species / moves                                 |
| `golpes_todos.mjs`     | All moves (full list)                               |
| `evolucao.mjs`         | Evolution                                            |
| `troca.mjs`            | Trading                                              |
| `arrastar_time.mjs`    | Drag team / box (party management)                 |
| `raid.mjs`, `raid_ui.mjs` | Raids and raid UI                               |
| `evento.mjs`           | Live events                                          |
| `diretor.mjs`          | Director (scene/flow orchestration)                |
| `conhecimento.mjs`     | Knowledge (Pokédex / info)                          |
| `tinta.mjs`            | Paint / color customization                        |
| `som.mjs`              | Sound                                                |
| `particulas.mjs`       | Particles                                            |
| `fogo.mjs`, `lodo.mjs` | Fire / sludge effects                              |
| `efeito_shaders.mjs`   | Shader effects                                       |
| `gravador.mjs`         | Recorder                                             |
| `glb_sem_blob.mjs`     | GLB loader without blob URLs                        |
| `idx_mod_0.mjs`        | Pre-bundled copy of the inline `index.html` module |

## Server modules

| File                     | Meaning                              |
| ------------------------ | ------------------------------------ |
| `server.mjs` (was `servidor.mjs`)            | Server entry point (HTTP + WebSocket)|
| `server_moderation.mjs` (was `servidor_moderacao.mjs`) | Moderation (GM chat commands) |
| `server_events.mjs` (was `servidor_eventos.mjs`)       | Live events                  |
| `server_raid.mjs` (was `servidor_raid.mjs`)            | Live raids                   |
| `server_resources.mjs` (was `servidor_recursos.mjs`)   | Resources (lists for admin previews) |

## Admin panel modules (`admin/*.mjs`)

| File                      | Meaning                                  |
| ------------------------- | ---------------------------------------- |
| `admin.mjs`               | Map editor + habitats                    |
| `cenario.mjs` / `cenario.html` | 3D scenery editor                   |
| `camadas.mjs`             | Layers (NPCs, doors, grass, water, …)    |
| `jogadores.mjs`           | Players administration                   |
| `dados.mjs`               | Generic data editor                      |
| `conteudo*.mjs`           | Content editors: species, evolutions, learnset, missions |
| `esquemas*.mjs`           | Schemas / whitelist + validation         |
| `eventos.mjs`             | Events editor                            |
| `recursos.mjs`            | Resource lists                           |
| `foto_mapa.mjs`           | Map top-down photo (minimap bake)        |
| `previa_*.mjs`            | Previews: badge, item, bag, music, raid, skin, paint, trainer |

## Data files (`public/data/*.json`)

| File                 | Meaning                                   |
| -------------------- | ----------------------------------------- |
| `especies.json`      | Species overrides                         |
| `golpes.json`        | Moves (194), with English + PT names      |
| `learnset.json`      | Per-level movesets                        |
| `evolucoes.json`     | Evolution rules                           |
| `cenas.json`         | Scenes / areas list                       |
| `kanto.json`         | Main Kanto overworld (objects, NPCs, …)   |
| `pallet_rota1.json`  | Pallet Town + Route 1 data                |
| `config_jogo.json`   | Game config (shiny rate, level caps, …)   |
| `ginasios.json`      | Gyms                                       |
| `treinadores.json`   | NPC trainers                              |
| `npcs_glb.json`      | NPC roster / models                       |
| `npc_tintas.json`    | NPC colors                                |
| `elenco.json`        | Cast (named NPC roster)                   |
| `missoes.json`       | Missions (20 chapters)                    |
| `dialogos.json`      | Dialogue                                  |
| `iniciais.json`      | Starter Pokémon                           |
| `montarias.json`     | Mounts                                    |
| `selas.json`         | Saddles                                   |
| `mochilas.json`      | Bags                                      |
| `menus_dados.json`   | Items + shops                             |
| `musicas.json`       | Music tracks                              |
| `raid.json`          | Raid config                              |
| `habitats.json`      | Habitats (wild spawns per area)           |
| `zonas_spawn.json`   | Spawn zones                               |
| `portas.json`        | Doors / warps                             |
| `exp.json`           | EXP curves                                |
| `skins_treinador.json` | Trainer skins                           |
| `receitas_cor.json`  | Color recipes                             |
| `sexos.json`         | Gender options                            |
| `alturas.json` / `tamanhos.json` | Heights / sizes               |
| `mapa_kanto_pontos.json` | Kanto map points                      |
| `dex_extra.json`     | Extra Pokédex data                        |
| `traducoes.json`     | GM-editable translation overrides         |
| `idioma/`            | Translation dictionaries (PT/EN/ES)       |

## Asset folders

| Folder (English, renamed) | Was (Portuguese) | Meaning                         |
| ------------------------- | ---------------- | ------------------------------- |
| `scenery/`                | `cenario/`       | Source map `.glb` files (e.g. `kanto.glb`) |
| `public/scenery/`         | `public/cenario/`| Maps and models served to the client |
| `sound/`                  | `som/`           | Audio (music, skill sounds, UI) |
| `particles/`              | `particulas/`    | Particle meshes and textures    |
| `server/`                 | `servidor/`      | Server-side folder (live data under `server/data/`) |
| `upcoming/`               | `_novos/`        | Unreleased modules from a newer build (not loaded yet) |
| `ui/`                     | —                | UI art, icons, minimap          |
| `vendor/three/`           | —                | Bundled Three.js                |

The source code was renamed to English in these commits, so the file names in the
tables above are the current (English) names. The staging folder `_novos/` ("new") is now
`upcoming/`; its files were renamed with the same vocabulary (for example `pesca_jogo.mjs` is
`fishing_game.mjs`, `balsa_ui.mjs` is `ferry_ui.mjs`, `guilda.mjs` is `guild.mjs`).
