# PokeVerse-3D

A 3D Pokémon game that runs in the browser, built with [Three.js](https://threejs.org/).
It recreates the **Kanto** region as a continuous 3D world with a turn-based battle
system, wild encounters and catching, flying mounts, gyms and badges, live GM-run
raids and events, guilds, trading, and a full in-browser **GM admin panel** for editing
the map and game data.

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
npm run servidor      # = node servidor.mjs

# 3. In a second terminal, start the game client (Vite on port 5300)
npm run dev
```

Then open **http://localhost:5300/** in your browser.

On Windows you can double-click **`Ligar jogo.bat`**, which installs dependencies if
needed, starts both the server and the client, and opens the browser for you.

For a detailed walkthrough (creating an account, becoming a GM, opening the admin
panel, and troubleshooting), see **[`docs/STARTUP.md`](docs/STARTUP.md)**.

## Scripts

| Command           | What it does                                             |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Start the Vite client with hot reload on port **5300**. |
| `npm run servidor`| Start the game server (HTTP + WebSocket) on port **5190**. |
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

The translation engine lives in [`i18n.mjs`](i18n.mjs). It looks up each Portuguese
source string in a per-language dictionary under `public/data/idioma/` and returns the
translation, falling back to the original Portuguese when a key is missing. The
dictionaries are:

- `ui_<lang>.json` — UI, menus, HUD, and system messages
- `conteudo_<lang>.json` — missions, gyms, and other content text
- `nomes_<lang>.json` — names (areas, items, moves, titles, outfits, NPCs)
- `dex_<lang>.json` — Pokédex entries

See [`docs/GLOSSARY.md`](docs/GLOSSARY.md) for the naming conventions used across the
Portuguese codebase.

## Project layout

```
servidor.mjs          Game server entry point (HTTP + WebSocket, port 5190)
servidor_*.mjs        Server modules: moderation, events, raids, resources
index.html            Game client entry point
*.mjs                 Client game modules (battle, world, HUD, menus, networking, …)
admin/                In-browser GM admin panel (map/scenery/data editors)
public/               Static assets served by Vite
  data/               Game data as JSON (species, moves, map, missions, items, …)
  data/idioma/        Translation dictionaries (PT/EN/ES)
  cenario/            Map and model .glb files served to the client
cenario/              Source map .glb files (e.g. kanto.glb)
som/                  Audio (music, skill sounds, UI)
particulas/           Particle meshes and textures
ui/                   UI art, icons, minimap
vendor/three/         Bundled Three.js build and examples
tools/                Helper scripts
docs/                 English documentation (startup, admin, glossary)
```

> **Note:** live player data (accounts, saves, admin logs, backups) is stored under
> `servidor/dados/` and is **gitignored** — it is never committed. The server recreates
> that directory automatically on first run.

## Security notes

This project is intended to run **locally**. If you ever expose the server publicly,
review [`docs/SECURITY.md`](docs/SECURITY.md) first: the server sends permissive CORS
headers, keeps a legacy unsalted-password fallback for old accounts, and relies on you
not committing the live `servidor/dados/` directory.
