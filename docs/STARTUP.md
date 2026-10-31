# Local server startup guide

This guide walks you through running **PokeVerse-3D** on your own machine: installing
dependencies, starting the two processes, creating an account, becoming a GM, opening
the admin panel, and fixing common problems.

The game has two parts that must both be running:

| Process        | Port   | Started by          | What it does                                   |
| -------------- | ------ | ------------------- | ---------------------------------------------- |
| **Game server**| `5190` | `node server.mjs`   | Accounts, saves, multiplayer, the admin API.   |
| **Game client**| `5300` | `vite`              | Serves the browser game and the admin panel UI.|

## 1. Install Node.js

Install [Node.js](https://nodejs.org/) **18 or newer** (20 or 22 recommended). Verify:

```bash
node -v
npm -v
```

## 2. Install dependencies

From the project folder:

```bash
npm install
```

> If you copied this project from another computer (for example a Windows ZIP/RAR),
> delete any bundled `node_modules/` first and run `npm install` again — native
> dependencies are platform-specific and must be reinstalled for your OS.

## 3. Start the server and the client

Open **two terminals** in the project folder.

**Terminal 1 — game server:**

```bash
npm run server
```

You should see a banner and `HTTP + WebSocket na porta 5190`.

**Terminal 2 — game client:**

```bash
npm run dev
```

Vite prints `Local: http://localhost:5300/`.

### Windows shortcut

Double-click **`Ligar jogo.bat`**. It installs dependencies if needed, opens both
processes in their own windows, waits a few seconds, and launches your browser at
`http://localhost:5300/`.

## 4. Open the game

Go to **http://localhost:5300/**. The UI defaults to **English**; you can switch to
Português or Español with the **PT · EN · ES** bar on the login screen, by adding
`?idioma=en|es|pt` to the URL, or from account settings once you are logged in.

## 5. Create an account

On the login screen choose **Create account**, pick a username, email, and password.
The server stores it (passwords are hashed with `scrypt` and a per-user salt) in
`server/data/contas.json`, which is created automatically and is **not** committed
to git.

> Keep the recovery code the server returns on sign-up — it is how you reset the
> password for that account.

## 6. Become a GM (to use the admin panel)

The admin panel is restricted to accounts with the GM flag. Because live account data
is intentionally **not** shipped with the project, there is no pre-made GM account; you
grant GM to your own account once. Two options:

**Option A — promote via another GM.** If an account is already a GM, it can promote
others from the admin panel (**Players → Role → GM**).

**Option B — bootstrap the first GM.** Stop the server (Ctrl+C), then run:

```bash
node tools/make_gm.mjs your_username
```

Start the server again and log in. Run it with `--remove` to take the flag away. The
server must be stopped first: it keeps accounts in memory and rewrites the file when it
exits, which would undo the change.

To do it by hand instead, with the server **stopped**, edit `server/data/contas.json`
and add `"gm": true` to your account object:

```json
{
  "your_username": {
    "senha": "…",
    "email": "…",
    "gm": true,
    "save": { … }
  }
}
```

Reload the game and log in; you now have GM powers (the F8 dev panel and the admin
panel).

## 7. Open the admin panel

With both processes running and logged in as a GM, open:

**http://localhost:5300/admin**

See [`ADMIN.md`](ADMIN.md) for everything the panel can do. Changes made in the panel
are pushed to any open game tab live (some require a page refresh).

## Multiplayer / playing from another device

The Vite client listens on all interfaces, so another device on your LAN can open
`http://<your-computer-ip>:5300/`. The client talks to the game server at
`ws://<page-host>:5190` by default. To point the client at a server on a different
host, append `?servidor=ws://host:5190` to the URL.

## Troubleshooting

| Symptom                                           | Fix                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm install` errors about optional/native deps   | Delete `node_modules/` and `package-lock.json` resolution issues, then reinstall.   |
| Game loads but “no connection to server”          | Make sure `node server.mjs` is running and port **5190** is free.                   |
| Port already in use                               | Stop the other process, or change the port (client: `vite.config.js`; server: the `listen(5190…)` call in `server.mjs`). |
| UI still shows Portuguese after choosing English  | Expected for text that is not yet translated — the engine falls back to the source. See [Languages](../README.md#languages). |
| Admin panel says “GM only”                        | Your account is not a GM yet — see step 6.                                           |
| `npm audit` reports Vite advisories               | Dev-server only; run `npm audit fix` or bump Vite if you plan to expose it.          |

## What NOT to commit

`server/data/` holds live accounts, saves, admin logs, and backups. It is gitignored
on purpose. Never add it to version control or share it — it contains password hashes
and email addresses.
