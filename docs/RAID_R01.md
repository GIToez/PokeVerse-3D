# Articuno raid (r01, "Seafoam Blizzard") — status and plan

## Done (2026-11-05)
- **Art**: `public/scenery/raid/r01/` — `r01_arena.glb`, `r01_pecas.glb`, `r01_articuno_anim.glb`, `marcas/*.png` (6). All match the
  hashes in `public/data/raid_r01.json` (`arte.v`). The Articuno model is `public/scenery/mon/pm0144_00.glb` (sha256 matches).
- **Server fight**: `server_raid_r01.mjs` (driven by `raid_r01.json` → `regra`, `pilares`, `braseiros`, `spawns`), hooked into
  `server_raid.mjs` only when `data/raid.json` → `arena` is `9700001`. Test: `node tools/test_raid_r01.mjs` (16 checks, fake clock).
- Zapdos (r03) art and the Mewtwo (r05) arena are still gated on PokeFable (`public/downloads/pokefable_links_raids.txt`).
  The r05 sounds are in `sound/skill/`; the r03 sounds were already in `sound/raid/r03/`.

## Protocol (server → arena players)
`{ t: 'r01', ev, agora, ... }` — `agora` keeps the client's clock in step.

| ev | fields | |
|---|---|---|
| entrada | | fight starts (boss entrance) |
| chefe | x, z, giro | boss facing its target |
| golpe | id, inicio, alvo / alvos, direcao, origem, centros, pouso | icebeam · icywind · hail · blizzard · glacialdive |
| golpe_fim | id | |
| raio | sub: pilar (id, estado) / acerto (jogador) / fim (motivo) | Ice Beam outcome |
| pilar | id, estado | inteiro → rachado → toco |
| braseiro | id, estado (aceso / apagado), motivo (nevasca / mergulho / f) | |
| dano | jogador, golpe | frost on that player (HP comes as `pdano`) |
| congelado | jogadores, ate | Glacial Dive landing |
| nevasca | seguros | who was in a brazier's heat |
| mergulho | sub: desce (pouso) / impacto (braseiro, vapor) | |
| vulneravel | ate | stunned by steam: hits ×1.5 |
| repouso / decolagem | tipo, ate | lands after Blizzard |
| fase | fase | 2 at 70 % HP, 3 at 35 % |
| f | jogador, sub (inicio / fim / cancelado), braseiro, desde, ate, motivo | holding F at a brazier |
| troca / espectador | jogador, uid | switching Pokémon / no Pokémon left |
| morte / fim | | |
| retrato | retrato {fase, estado, pilares, braseiros, vulneravelAte, congelados, chefe, olhar, ate, canais, golpe} | late joiner |

Errors: `{ t: 'r01_erro', erro, op, faltam }`. Client → server: `{ t: 'r01', op: 'f_inicio', braseiro }`, `{ op: 'f_fim' }`,
`{ op: 'trocar', uid }`. Player hits on the boss stay the normal `ataque` → `shp`; the boss's hits are `pdano`.
In this arena the player's **Pokémon** moves (positions are `pos` px / pz), the trainer stays at the spawn.

## Client integration (done 2026-11-05)
- Modules copied from `upcoming/` to the root (`raid_r01*`, `raid_loading`, and `raid_r03*` / `raid_r05*` that `raid_r01_game` imports).
  Asset paths renamed to this repo's folders (`scenery/`, `particles/`, `sound/`).
- Scene `9700001` has a `scenes.json` entry and a placeholder map (`scenery/9700001.glb`, an invisible 50 × 50 m floor), so the normal
  boot runs; `ligarR01()` in `index.html` then builds the arena art on top (boot with the raid stamp, or `ativarArenaRaid`).
- In the arena the keys / joystick / click steer the **Pokémon** (`RaidR01.moverPokemon`), with collision from the arena navmesh and
  pillars (`deslocarR01`); the trainer stays at the spawn. No leash or following. Camera follows the Pokémon, pulled toward the centre.
- F at an unlit brazier relights it (raid_r01_game listens; the ball throw is skipped). Frozen = no moves. The world's Articuno body is
  hidden (`vincularChefe`); the arena's animated Articuno is what you see.
- `/raid damage F` (raid.json `chefeDano`) also scales the arena's frost damage.
- Switch raids in the panel: Data files → Raid → arena `9700001` + boss 144 / `pm0144_00` (Articuno) or `4120009` + 151 / `pm0151_00` (Mew).
