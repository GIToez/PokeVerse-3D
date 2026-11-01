# Gameplay systems audit

Every player-facing system in the live client (the root `*.mjs` files loaded by `index.html`), with how complete it is
and where it lives. Code that exists only in `upcoming/` is listed separately in [`../AUDIT.md`](../AUDIT.md#unreleased-code-in-upcoming).

**Where the main game code lives:** the live main loop is the inline `<script type="module">` in `index.html` (from line 173).
`idx_mod_0.mjs` is an older copy of that same script that nothing loads (about 40 lines behind). Line references below
point into `idx_mod_0.mjs`; the same code sits roughly 175–215 lines further down in `index.html`. Edit `index.html`, not
`idx_mod_0.mjs`.

Status meanings: **Working** means playable end to end on the bundled local server. **Partial** means it works with caveats.
**Stub** means a menu entry or banner exists, but the feature behind it does not.

## Status at a glance

| System | Status | Notes |
|---|---|---|
| Open-world exploration | Working | One continuous Kanto map plus 71 interior/dungeon scenes |
| Real-time wild combat | Working | Partner fights in real time; moves on keys 1–4 |
| Capture | Working | Knock out, then throw a ball (F) within 9 m during the 8 s faint window |
| Trainer and gym battles (turn-based) | Working | Server-run when logged in (`server_battle.mjs`). Offline still uses the client engine. |
| Elite Four | Working | Account-only; server tracks the no-heal run (`data/elite.json`) |
| Player vs player | Partial | `/batalhar <name>` on the same map within 14 m; both must be logged in |
| Team, box, follower | Working | Party of 6, box overflow, drag to reorder |
| IVs, natures, PP, learnsets | Working | EVs are always 0 |
| Status conditions (burn, sleep…) | Not implemented | Combat is HP, damage and PP only |
| Level cap from badges | Working | Caps 20/26/32/38/46/52/58/62/70, then 100 after the Elite Four |
| Evolution | Working | Level, item, trade, friendship, time of day. Rain, beauty and location triggers are disabled |
| Bag and items | Working | Balls, healing, PP restores, evolution items; hotkeys 5–9 |
| Poké Mart (Coins) | Working | 87 shop catalogs; opened through shop NPCs |
| Premium shop | Stub | "Coming soon" banner |
| Pokédex and knowledge levels | Working | Shiny rate 1/4096; knowledge levels 0–5 unlock more info |
| Missions | Working | 20 chapters, 56 missions |
| NPC dialogue | Working | 377 NPC definitions, 12 scripted story dialogues |
| Chat | Working | Local, Global, Trade and Help tabs, whispers, slash commands |
| Friends and DMs | Partial | Need an account; the Social menu is still marked "coming soon" |
| Trading | Working | `/trocar <name>` within 12 m, up to 3 Pokémon, both sides confirm |
| Raids | Working | Staff-run Mew raid (Lv 70) for up to 10 players |
| Live events | Working | EXP, shiny and spawn-density multipliers, maintenance mode |
| Multiplayer presence | Working | Positions, outfits, partners and mounts sync at about 10 Hz |
| PvP | Partial | `/batalhar <name>` (same map, 14 m). The Battle menu banner is still "coming soon" |
| Mounts and surfing | Partial | 20 mounts in data; only Arcanine and Lapras are free for normal accounts |
| Fishing | Not implemented | Water spawns stand in for it |
| Safari Zone game mode | Not implemented | The map exists; the Safari ball/step mode does not |
| Crafting | Not present | |
| Day/night lighting, weather | Not present | Device clock is used only for time-of-day evolutions; rain VFX only in a boss cinematic |
| Character creation and dye | Working | 78 outfits (29 selectable at creation), RGB-mask dyeing |
| Music and sound | Working | Area music, battle themes, separate volume channels |
| Mobile | Working | Virtual joystick and camera buttons; key remapping is disabled |
| Creator tools | Working | `?diretor=1` (tournament staging), `?captura=1` (scripted wilds), screen recorder |

## Battles on the bundled server

`index.html` (`iniciarTurno`) sends trainer, gym and Elite Four challenges to the server whenever the
player is logged in. `server_battle.mjs` runs the turn engine (damage, PP, XP, badges, payouts, E4 run).
`/batalhar <name>` challenges another logged-in player on the same map (14 m). Protocol version is 19
on both sides. Wild Pokémon are still spawned per client (`soloWilds: true`).

## Combat and stats

- **Damage** (`idx_mod_0.mjs:4621–4627`): standard formula. `base = floor(((2·lv/5+2) · power · A/D)/50 + 2)`, times STAB 1.5,
  type effectiveness (official 18-type chart in `public/pokedex.json`) and a random 0.85–1.0 factor. Minimum 1 damage unless immune.
- **HP** is the standard formula times 3, to give real-time fights room (`individual.mjs`, `rules.mjs`).
- **IVs** 0–31 for each stat, **25 natures** (±10%), **EVs always 0** (`individual.mjs:1–4`).
- **Moves:** 194 defined (`public/data/moves.json`, `moves_all.mjs`). 17 have dedicated particle effects; the rest use the
  Pokémon's Attack/Buff/Cast animation. Projectiles travel at 14 m/s.
- **Learnsets:** the last 4 moves at or below the Pokémon's level; up to 12 forgotten moves are remembered with their PP.

## Capture

- Formula (`idx_mod_0.mjs:4715–4725`, `rules.mjs:41–46`): `a = (3·HPmax − 2·HP) · catchRate · ballBonus / (3·HPmax)`. 255 or
  more catches outright; otherwise up to 4 shakes using the Gen III check.
- Ball multipliers (`game_config.json`): Poké 1×, Great 1.5×, Ultra 2×, Master 255×, Safari 1.5×. Level, Net, Nest and
  Repeat balls currently behave like 1×.
- At most 4 balls in the air at once. Trainer Pokémon, raid bosses and bosses can't be caught.
- New saves start with 10 Poké, 5 Great, 2 Ultra and 1 Master Ball (`idx_mod_0.mjs:4734`).

## Progression

- **Badges and level cap:** each of the 8 Kanto badges raises the obedience cap. Pokémon above the cap sometimes ignore orders,
  and extra XP is banked (`game_config.json:3–13`).
- **XP:** Gen 5+ formula, ×3 from bosses, multiplied by any live event (`evolution.mjs:39–44`). Six EXP curves cover all 1025 species.
- **Friendship:** starts at the species base (default 70). +1 per minute following, +2 per level, −1 per faint; friendship
  evolutions trigger at 160.
- **Gym rematch cooldown:** after a loss, wait until midnight or pay a Coin fee.
- **Elite Four:** no healing between fights.
- **Starters:** Bulbasaur, Charmander, Squirtle, Chikorita, Cyndaquil, Totodile (`starters.json`).

## Economy

- Currency is Coins (displayed as ₽). The default balance is 50,000 (`menus.mjs:159`).
- The item catalog has 1,250 entries (`menu_data.json`); only balls, medicine, PP restores and evolution items do anything in play.
- The premium currency (crystals) always shows 0.

## Mounts

20 mounts in `mounts.json`, including Lugia, Ho-Oh and Rayquaza (flying, amphibious), Gyarados and Lapras (water), and
Arcanine, Charizard and Dragonite (land). Only Arcanine and Lapras are free; the rest need staff/GM rights or offline mode.
The Giratina and Arceus entries point to models that don't exist. There is no mount shop.

## Controls

WASD or click to move, right-drag to rotate the camera, scroll to zoom, Tab to target, Z to interact, F to throw a ball,
1–4 for moves, 5–9 for hotkeys, M to mount, Enter to chat. Menus: P (Pokémon), I (Bag), J (Missions), K (Map),
X (Pokédex), U (Trainer), O (Settings). There is no run key. On phones, a virtual joystick appears automatically (or with `?mobile=1`).

## URL flags

`?mapa=<scene>`, `?jogar=1`, `?rede=0` (offline), `?captura=1`, `?diretor=1`, `?raid=`, `?adm=1` (free flight), `?mobile=1`,
`?idioma=en|pt|es`.

## Main files

| System | File |
|---|---|
| Main game loop, combat, capture, battles, world | inline module in `index.html` (stale copy: `idx_mod_0.mjs`) |
| Type rules, simplified formulas | `rules.mjs` |
| IVs, natures, stats | `individual.mjs` |
| Moves | `moves.mjs`, `moves_all.mjs` |
| Evolution, XP, friendship | `evolution.mjs` |
| Menus, HUD | `menus.mjs`, `hud.mjs`, `ui/hud_layout.json` |
| Raids | `raid.mjs`, `raid_ui.mjs` |
| Trading, chat, missions | `trade.mjs`, `chat.mjs`, `missions.mjs` |
| Networking | `network.mjs`, `world.mjs` |
| Character, dyes | `character.mjs`, `paint.mjs` |
| Accounts, progress pass | `account.mjs`, `pass_rules.mjs` |
| Tuning | `public/data/game_config.json` |
