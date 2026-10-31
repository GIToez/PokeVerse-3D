# GM admin panel

PokeVerse-3D ships with a full in-browser editor for game masters. With the server and
client running and logged in as a GM (see [`STARTUP.md`](STARTUP.md) step 6), open:

- **Main panel:** http://localhost:5300/admin
- **3D scenery editor:** http://localhost:5300/admin/cenario

All edits are validated server-side against a whitelist of editable collections, written
with an atomic swap, and backed up first (the last 30 versions of each file are kept
under `server/data/backups/`). Most changes reach any open game tab immediately; a few
ask for a page refresh (F5).

## Map editor

- **Spawn zones** — rectangular areas (with radius) where wild Pokémon appear.
- **Areas** — create, rename, move, and resize named areas over a minimap.
- **Layers** — place NPCs, doors, trainer spots, grass, water, and cave spawns.
- **Habitats per area**, with each area's level range.

## 3D scenery editor (`/admin/cenario`)

Move, duplicate, delete, and place scenery pieces — including ground and water — across
all maps, choosing from the prefab library, then re-export the map's `.glb` back to the
server (uploaded to `/admin/mapa-glb`, GM only, GLB header validated).

## Players

Search players; view and edit their bag, team, and individual Pokémon; change role
(GM / staff / mod); ban, mute, or kick — every action is written to `admin_log.jsonl`.

## Data editors

Edit the JSON files the game reads (served from `public/data/`). The editable
collections (defined in `admin/esquemas.mjs`) include:

- **Game config** — shiny rate, level caps, Poké Balls and their catch rates
- **Items**, **shops**, **trainers**, **NPCs** and dialogue, **doors**, **gyms** and badges
- **Bags**, **EXP curves**, **starter Pokémon**, **mounts**, **moves**
- **Trainer skins** — which appear in character creation and which have editable colors
- **NPC colors**, **dialogue**, **translations**, **music**, and **raid** configuration

## Dedicated editors

Separate screens for **missions**, **species**, **evolutions**, and **per-level
movesets (learnsets)**.

## Previews

3D previews of trainer/NPC skins, items, trainers, and bags.

## History / undo

Every saved file has a history view; you can restore any backup (restoring also makes a
backup first, so you can undo the undo).

## Translations editor

Under **Translations**, GMs edit `public/data/traducoes.json` — a list of
`{ pt, en, es }` rows. These override the static dictionaries in `public/data/locale/`
and are the quickest way to fix or add a translation without touching files. See the
[Languages](../README.md#languages) section and [`GLOSSARY.md`](GLOSSARY.md).
