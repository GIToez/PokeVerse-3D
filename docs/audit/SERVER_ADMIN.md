# Server and admin tools audit

The bundled server is `server.mjs` (Node HTTP + WebSocket, port 5190). The client dev server is Vite on port 5300.
`server/server.mjs` is only a health-check stub. Live player data in `server/data/` was not opened for this audit.

## What the server is responsible for

**Server-authoritative (players can't fake these):** passwords, sessions, bans, mutes and GM roles. Each new Pokémon's IVs,
nature, shiny roll and ID. Money, items, balls and badges when changed by mission rewards, GMs or raids. "Caught" Pokédex
entries. Mission completion and reward payout. Raid boss HP, damage and prizes. All admin writes, which are schema-validated
and backed up first.

**Client-trusted (a modified client could cheat these):** position, animation, outfit, title, chat text. Wild spawns and wild
battles, because each client spawns its own wild Pokémon. Captures: the client picks the species, and the server only checks
the species exists. Mission triggers ("I talked to X", "I entered area Y"). "Seen" Pokédex entries and knowledge levels.
Healing (works anywhere, with a 2 s cooldown). Trades are relayed without a server-side inventory swap.

**Not implemented locally:** turn-based battles. Every `bat_*` message is rejected (see [SYSTEMS.md](SYSTEMS.md#battles-on-the-bundled-server)).

## Accounts

| Topic | Detail |
|---|---|
| Registration | Username `^[a-z0-9_]{3,20}$`; password stored as scrypt `salt:hash`; a recovery code is issued |
| Login | Also accepts a legacy unsalted SHA-256 format (should be retired, see `docs/SECURITY.md`) |
| Sessions | Bearer token, valid 30 days; logging in elsewhere kicks the older session |
| Password reset | Username + recovery code; a GM can issue a new code |
| Roles | `gm` (full admin), `cargo` = `staff` or `mod` (chat badges; staff can run raids) |
| First GM | Must be set by hand in `server/data/contas.json` (see `docs/STARTUP.md`) |

## Limits and protections

| Item | Value |
|---|---|
| Account creation | 5 per minute per IP |
| Login | 10 per minute per IP |
| Password recovery | 5 per minute per IP |
| Client log uploads | 60 per minute per IP |
| WebSocket | 64 KB per message, 120 messages per second per connection |
| Request body | 1 MB (30 MB for `/admin/*`; 150 MB for map model uploads) |
| Max players | No limit is enforced |
| CORS | Open to any origin (`*`) — restrict before going public |
| Backups | Every data write copies the old file to `server/data/backups/` first (30 JSON / 8 model copies kept); restorable from the panel |

## HTTP routes

| Purpose | Routes |
|---|---|
| Health | `GET /saude`, `GET /alfa`, `POST /chaves/validar` |
| Client diagnostics | `POST /conta/boot`, `POST /conta/log`, `GET /conta/logs` (GM) |
| Accounts | `POST /conta/criar`, `/conta/entrar`, `/conta/recuperar`, `/conta/estado`, `/conta/sair`, `/conta/nome`, `/conta/idioma`, `/conta/senha`, `/conta/personagem/apagar`, `/conta/apagar`; `GET`/`PUT /save` |
| Admin: identity | `GET /admin/eu` |
| Admin: map data | `/admin/modelos`, `/admin/mapas`, `/admin/zonas`, `/admin/habitats`, `/admin/mapas-glb`, `/admin/mapa-objetos`, `/admin/mapa-areas`, `/admin/mapa-camadas`, `/admin/mapa-glb` |
| Admin: players | `/admin/jogadores`, `/admin/jogador`, `/admin/jogador/bolsa`, `/time`, `/pokemon`, `/cargo`, `/moderar`, `/codigo` |
| Admin: data files | `GET`/`POST /admin/dados/<schema>`, `/admin/backups`, `/admin/backups/restaurar` |
| Admin: events | `/admin/eventos`, `/admin/eventos/aviso` |
| Admin: asset lists | `/admin/recursos/faixas`, `/mascaras`, `/modelos`, `/materiais` |

Route names are Portuguese and were intentionally not renamed: the admin panel, server and saved client code all depend on them.

## WebSocket messages

| Direction | Purpose | Types |
|---|---|---|
| Client → server | Presence | `entrar`, `ping`, `pos`, `parceiro`, `personagem`, `titulo`, `chat`, `save` |
| | Missions | `missao_falar` … `missao_insignia`, `missao_passo` |
| | Pokémon and items | `posse_inicial`, `posse_capturar`, `posse_soltar`, `bolsa_missao`, `bolsa_*`, `vida_curar` |
| | Battles, trades | `bat_*` (always rejected), `troca_*` (relayed) |
| | Moderation, raids | `mod*`, `raid_staff`, `raid_entrar`, `raid_sair`, `ataque` |
| Server → client | Join/leave | `bemvindo`, `entrou`, `saiu`, `saia` |
| | Sync | `pos`, `parceiro`, `personagem`, `titulo`, `chat`, `pong` |
| | System | `sistema`, `invasao`, `evento`, `volta`, `save`, `bolsa`, `vida`, `missao`, `posse`, `posse_erro`, `mod`, `mod_erro` |
| | Raids | `raid`, `raid_ir`, `raid_voltar`, `raid_fim`, `shp`, `spos`, `sestado`, `sumiu`, `pdano` |

## Moderation

Available from both the Players panel and GM chat commands:

| Action | Chat command |
|---|---|
| Ban (hours, or forever) | `/banir` |
| Unban | `/perdoar` |
| Mute | `/mudo` |
| Kick | `/kick` |
| Teleport self / pull player / go to player | `/tp`, `/puxar`, `/ir` |
| List online / inspect player | `/online`, `/ver` |
| Global announcement | `/aviso` |

Bans and mutes max out at one year (525,600 minutes); anything longer is permanent. Reasons are limited to 120 characters.

## Events and maintenance

`public/data/eventos.json` holds the active event: name, EXP multiplier (0.1–10), shiny multiplier (1–100), spawn density
(0.25–3), time window, and maintenance mode. Changes are pushed to all players immediately. Maintenance kicks non-GMs,
blocks logins, and warns players at 10, 5 and 1 minute.

## Raids

Configured in `public/data/raid.json`. Phases: announced → 15 s countdown → 30 s travel → 5 min fight → 8 s wrap-up. Staff
control it with `/raid anunciar|comecar|cancelar|hp|dano|shiny|premio|status`. Up to 50 slots (default 10). Players are
teleported to the arena (Lorelei's room, scene 4120009) and back afterward.

## Admin panel (`/admin`)

Requires a GM account. Open game tabs are notified of changes through a browser channel; some changes apply live, others
need a page reload (F5).

| Module | Edits | Applies |
|---|---|---|
| Map view (`admin.mjs`) | Spawn zones, area boxes and names | Usually after reload |
| Layers (`layers.mjs`) | NPCs, trainers, grass/water/cave tiles, doors | After reload |
| Habitats (in `admin.mjs`) | Species and level ranges per area | Notified |
| Scenery editor (`/admin/scenery`) | Place, move, duplicate and delete 3D props; upload map models | After hard reload |
| Players (`players.mjs`) | Search accounts; edit bag, team and IVs; give Pokémon; set roles; ban/mute/kick/teleport; recovery codes | **Live** |
| Events (`events.mjs`) | Live event multipliers, announcements, maintenance | **Live** |
| Data files (`data.mjs`) | Every schema below, plus history and restore | Live or after reload, per schema |
| Content (`content*.mjs`) | Dedicated editors for missions, species, evolutions, learnsets | Missions hot-reload on the server; the game needs F5 |
| Previews (`preview_*.mjs`) | 3D and audio previews of items, bags, badges, outfits, dyes, trainers, music, raids | Read-only |

**You can, from the panel:** place scenery, paint terrain, add NPCs and trainers, add spawns, add species, moves and items,
edit missions, and give items or Pokémon to players. **You can't:** create a new region from scratch (that needs a new map
model and scene files; see `docs/ADMIN.md`).

## Editable data schemas

| Schema | File (`public/data/`) | Purpose |
|---|---|---|
| `config_jogo`, `bolas` | `config_jogo.json` | Shiny rate, level caps, heal rules, ball multipliers, area levels |
| `itens`, `lojas`, `insignias` | `menus_dados.json` | Items, shop inventories, badges |
| `treinadores` | `treinadores.json` | Trainer teams and dialogue (60 trainers) |
| `npcs` | `npcs_glb.json` | NPC identity, dialogue, roles |
| `portas` | `portas.json` | Doors and arrival points |
| `ginasios` | `ginasios.json` | Gym leaders and rewards |
| `mochilas` | `mochilas.json` | Bag cosmetics |
| `skins_treinador` | `skins_treinador.json` | Character outfits |
| `receitas_cor` | `receitas_cor.json` | Dyeable clothing recipes |
| `exp_curvas`, `exp_especies` | `exp.json` | EXP curves and per-species EXP |
| `iniciais` | `iniciais.json` | Starters |
| `montarias` | `montarias.json` | Mounts |
| `golpes` | `golpes.json` | Moves |
| `learnset` | `learnset.json` | Level-up moves |
| `missoes` | `missoes.json` | Story missions |
| `evolucoes`, `evolucoes_itens` | `evolucoes.json` | Evolution rules and items |
| `especies`, `alturas`, `sexos`, `tamanhos` | matching files | Model scale, height, gender ratio, size |
| `descricoes_pt`, `dex_extra` | `locale/dex_pt.json`, `dex_extra.json` | Pokédex text and extra fields |
| `elenco` | `elenco.json` | 3D model roster |
| `npc_tintas` | `npc_tintas.json` | NPC material colors |
| `dialogos` | `dialogos.json` | Scripted dialogue (live) |
| `traducoes` | `traducoes.json` | Translation overrides (live) |
| `musicas` | `musicas.json` | Area and battle music (live) |
| `raid` | `raid.json` | Raid defaults |

Also edited outside the schemas: `zonas_spawn.json`, `habitats.json`, each scene's `<id>.json`, `cenas.json`, map `.glb` files,
`eventos.json`, and `server/data/contas.json` (through the Players panel).

## Other pages and tools

| Path | What it is |
|---|---|
| `public/game.html` | Early prototype sandbox, not the real game |
| `public/map-editor.html` | Prototype map viewer, not the GM map editor |
| `public/pokemon-viewer.html` | Standalone model viewer |
| `tools/receitas_cor.mjs` | Regenerates dye recipes (overwrites panel edits) |
| `tools/locale_invert.mjs` | Builds the Portuguese dictionaries from the English ones |
| `tools/locale_english_source.mjs` | Rewrites a JSON file's display text from Portuguese to English |
| `tools/audit_pokemon.mjs` | Regenerates `docs/audit/POKEMON.md` |
