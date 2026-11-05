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

## Client integration (next)
1. Copy from `upcoming/`: `raid_r01_game`, `raid_r01_scene`, `raid_r01_attacks`, `raid_r01_boss`, `raid_r01`, `raid_loading`, and
   `raid_r03_game`, `raid_r05_game` (+ their `raid_r03*`, `raid_r05*`) because `raid_r01_game` imports them.
2. `raid.mjs`: the upcoming version knows `ARENAS` (9700001 / 9700003 / 9700005) — merge `ehArena` so travelling works for 9700001.
3. `index.html` boot: when `RaidR01.ehArena(NOME)`, skip the map GLB (there is no scenes.json entry), make an empty scene and call
   `RaidR01.ligar({ cena, camera, jogo, Rede, Chat, idioma, tocarUma, trocarPara, deslocar, preparando, mapa: NOME })`.
4. Main loop: `RaidR01.quadro(dt)`; movement → `RaidR01.controlaPokemon()` / `moverPokemon(dt, dir, alvo)`; camera `enquadrar`;
   F key `usaF`; `golpeBarrado`, `congelado`, `alturaChao`; boss body `vincularChefe(s)` from `montarChefeRaid`.
5. `network.mjs`: route `t: 'r01' | 'r01_erro'` (and r03 / r05) to `RaidR01.receber`.
6. Admin: `data/raid.json` → `arena: "9700001"`, `chefeNome: "Articuno"`, `chefeDex: 144`, `chefeGlb: "pm0144_00"`.
