# PokeVerse-3D

A 3D Pokémon game that runs in the browser, built with [Three.js](https://threejs.org/).
It recreates the **Kanto** region as a continuous 3D world with real-time wild battles
and catching, turn-based trainer and gym battles, mounts, badges, story missions, live
GM-run raids and events, trading, and a full in-browser **GM admin panel** for editing
the map and game data.

> **What's actually in here:** see **[`docs/AUDIT.md`](docs/AUDIT.md)** for the complete
> inventory (248 Pokémon with 3D models, every location, every system and its status) and
> the known gaps. Most importantly, trainer/gym battles don't work for logged-in players
> on the bundled server.

The game has a small **Node.js server** (HTTP + WebSocket) that handles accounts,
saves, multiplayer, and the admin editors, and a **Vite** dev client that serves the
browser game.

> The source code and in-game text were originally written in Portuguese. English is
> now the default language. See [Languages](#languages) and
> [`docs/GLOSSARY.md`](docs/GLOSSARY.md) for the Portuguese → English mapping of folders,
> modules, and data files.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (tested on 20/22)
- npm (bundled with Node.js)

## Quick start (local server)

```bash
# 1. Install dependencies
npm install

# 2. Start the game server (HTTP + WebSocket on port 5190)
npm run server        # = node server.mjs

# 3. In a second terminal, start the game client (Vite on port 5300)
npm run dev
```

Then open **http://localhost:5300/** in your browser.

On Windows you can double-click **`Ligar jogo.bat`**, which installs dependencies if
needed, starts both the server and the client, and opens the browser for you.

For a detailed walkthrough (creating an account, becoming a GM, opening the admin
panel, and troubleshooting), see **[`docs/STARTUP.md`](docs/STARTUP.md)**. To host it on
a VPS (nginx, HTTPS, systemd, next to other game servers), see
**[`docs/HOSTING.md`](docs/HOSTING.md)**.

## Scripts

| Command           | What it does                                             |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Start the Vite client with hot reload on port **5300**. |
| `npm run server`  | Start the game server (HTTP + WebSocket) on port **5190**. |
| `npm run build`   | Build the client for production into `dist/`.            |
| `npm run preview` | Serve the production build locally.                      |

## Controls

- **WASD** / **Arrow keys** — move
- **Mouse** — rotate the camera
- **Click the ground** — walk to that spot
- **Tab** — switch target
- **1**, **2** — use moves
- **M** — mount / dismount
- **B** — call the boss
- **F8** (GM only) — developer / diagnostics panel, with a shortcut to the admin panel

## Admin panel

While the server and client are running, a GM account can open the editor at
**http://localhost:5300/admin**. It includes a map editor, a 3D scenery editor, player
administration, and data editors for items, trainers, NPCs, gyms, missions, species,
evolutions, movesets, and more. See **[`docs/ADMIN.md`](docs/ADMIN.md)** for the full
list and how to grant yourself GM.

## Languages

The game ships with Portuguese (the source language), English, and Spanish. **English
is the default.** Players can switch languages from the PT · EN · ES bar on the login
screen, with `?idioma=en|es|pt` in the URL, or from their account settings.

The translation engine lives in [`i18n.mjs`](i18n.mjs). English is the source language:
text that has been rewritten in English is shown as-is in English and translated to
Portuguese by the `*_pt.json` dictionaries. Text not yet rewritten is still Portuguese in
the code and is translated to English by the `*_en.json` dictionaries. After editing any
`*_en.json`, run `node tools/locale_invert.mjs` to regenerate the `*_pt.json` files. To
move a JSON file's display text to English, run
`node tools/locale_english_source.mjs <file.json>`. The dictionaries are:

- `ui_<lang>.json` — UI, menus, HUD, and system messages
- `conteudo_<lang>.json` — missions, gyms, and other content text
- `nomes_<lang>.json` — names (areas, items, moves, titles, outfits, NPCs)
- `dex_<lang>.json` — Pokédex entries

See [`docs/GLOSSARY.md`](docs/GLOSSARY.md) for the naming conventions used across the
Portuguese codebase.

## Original reference copy

The game exactly as it was imported, before any renaming or translation, is kept under the git tag
`original-import`. Use it to track down anything the English migration broke:

```bash
git fetch --tags
git diff original-import -- path/to/file          # what changed in one file since the import
git show original-import:missoes.mjs              # read a file as it was originally (now missions.mjs)
git grep "some text" original-import              # search the original code
git worktree add ../PokeVerse-3D-original original-import   # a full, separate folder of the original
```

Many files were renamed during the migration (for example `menus.mjs` and the `scenery/` folder had Portuguese
names), so use the original path with `git show`; `git log --follow -- <new path>` shows the old name.
The worktree folder shares this repository, and `git worktree remove ../PokeVerse-3D-original` deletes it.

## Project layout

```
server.mjs            Game server entry point (HTTP + WebSocket, port 5190)
server_*.mjs          Server modules: moderation, events, raids, resources
index.html            Game client entry point, including the main game code (inline module)
idx_mod_0.mjs         Older unused copy of index.html's inline module — don't edit
*.mjs                 Client game modules (battle, world, HUD, menus, networking, …)
admin/                In-browser GM admin panel (map/scenery/data editors)
public/               Static assets served by Vite
  data/               Game data as JSON (species, moves, map, missions, items, …)
  data/locale/        Translation dictionaries (PT/EN/ES)
  scenery/            Map and model .glb files served to the client
scenery/              Source map .glb files (e.g. kanto.glb)
sound/                Audio (music, skill sounds, UI)
particles/            Particle meshes and textures
ui/                   UI art, icons, minimap
vendor/three/         Bundled Three.js build and examples
tools/                Helper scripts
docs/                 English documentation (startup, admin, glossary, audit)
```

> **Note:** live player data (accounts, saves, admin logs, backups) is stored under
> `server/data/` and is **gitignored** — it is never committed. The server recreates
> that directory automatically on first run.

## Security notes

This project is intended to run **locally**. If you ever expose the server publicly,
review [`docs/SECURITY.md`](docs/SECURITY.md) first: the server sends permissive CORS
headers, keeps a legacy unsalted-password fallback for old accounts, and relies on you
not committing the live `server/data/` directory.
