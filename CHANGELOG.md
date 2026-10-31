# Changelog — Pokemon 3D Base (Oct 26–27)

## Game
- Wild Pokémon appear again on the local server, with battling and catching working.
- The game was renamed to "Pokemon 3D Base".
- Recreated the missing modules: battle-pass rules and drag team/box.
- Model textures load without producing hundreds of console errors.
- Paginated character-creation screen (arrows, a "1 / 3" counter, and dragging). There are now 14 male and 15 female looks.
- 21 new outfits with editable colors (skin, hair, clothing, eyes).
- Live raids: the GM announces, players join the queue, travel to the arena, fight the boss, earn the reward, and return.
- Live events with multipliers, a global announcement, and maintenance mode (can be scheduled, with warnings 10, 5, and 1 minute ahead).
- GM chat commands (`/online`, `/tp`, `/puxar` [pull], and moderation), sharing the same functions as the admin panel.
- Dialogue, translations, and per-area music now come from editable files.

## Server and security
- Passwords are stored with scrypt and a per-user salt. Accounts with an old password can still log in.
- Login sessions expire after 30 days.
- Per-IP attempt limits for creating an account, logging in, and recovering a password.
- The server generates and verifies catches and the starter Pokémon (IVs, nature, shiny, and a valid species).
- Blocked cheats made from the player's own client: fake money, fake Pokémon, overwriting the save, re-claiming a mission reward, and forging the Pokédex.
- New limits on chat (240 characters), title (40), and healing (once every 2 s). Real-time messages also gained size and rate limits.
- Ban and mute players, temporarily or permanently.
- Automatic backup of every file saved from the panel.
- Fixed: accented characters were corrupted when saving large files.
- Each account plays in one tab at a time: the old tab shows "You logged in from another place" and its character disappears from the map (previously every tab became another avatar).
- Fixed: catching Pokémon while logged in returned "no connection to the server".
- Fixed: the IVs of server-created Pokémon (starter and catches) were read as zero by the game. Already-saved Pokémon were converted.
- Fixed: missions got stuck while logged in. The steps for going to a place, defeating a wild Pokémon or trainer, healing, leveling up, and earning a badge never reached the server; only "talk" advanced.
- Missions skip steps that are already complete (e.g. starter already chosen, level already reached). Anyone stuck on "Go to the lab" is unblocked on entering the lab.

## Dev mode (F8, GM only)
- "⚙ Admin Panel" button below Call boss / Mount / Follow: opens `/admin` in a new tab.
- The diagnostics window can be dragged. Its position is saved in the browser; double-click returns it to place.

## Admin panel (`/admin`)
- **Map editor:**
  - Spawn zones.
  - Areas: create, rename, move, and resize, with the minimap underneath.
  - Layers: NPCs, doors, trainer spots, grass, water, and cave spawns.
- **Habitats per area**, with each area's level.
- **3D scenery editor:** move, duplicate, delete, and place pieces across the 73 maps, including ground and water.
- **Players:** search, edit bag, team, and Pokémon, change role, ban, mute, or kick, with an action log.
- **Data files:**
  - Game settings (shiny rate, max level, Poké Balls and their rates).
  - Items, shops, trainers, NPCs and their lines, doors, gyms, and badges.
  - Bags, EXP curves, starter Pokémon, mounts, and moves.
  - Trainer skins: which appear in character creation and which have editable colors.
  - NPC colors, dialogue, translations, music, and raid configuration.
- **Dedicated screens** for Missions, Species, Evolutions, and per-level moves.
- **Previews** of 3D skin, item, trainer/NPC, and bag.
- **History / Undo** for any saved file.
- Changes reach an open game tab immediately. Some require F5.
