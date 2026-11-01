# Hosting on a VPS (e.g. OVH), alongside other servers

The game needs one Node.js process (the game server) and a web server that serves the project folder as static files.
There's no build step: the client is plain ES modules with an import map, and the admin panel writes data files that the
web server must serve live. Use nginx in front, with HTTPS.

On an HTTPS site the client automatically talks to the game server at `https://<your domain>/servidor` (HTTP and
WebSocket), so the game server never needs a public port.

## How it fits next to an OpenTibia server

They don't collide. A typical OpenTibia setup (TFS, Canary or OTServBR) uses:

| Service | Port | Public? |
|---|---|---|
| OT login / game | 7171 / 7172 | yes |
| MySQL / MariaDB | 3306 | no (local only) |
| OT website (MyAAC, Znote…) | 80 / 443 via nginx or Apache | yes |
| **PokeVerse game server** | **5190** | **no** (local only, behind nginx) |
| **PokeVerse website** | **80 / 443 via the same nginx** | yes |

Give each its own subdomain (for example `play.example.com` for the OT website and `pokeverse.example.com` for this game)
and add one more nginx `server` block. If the OT website runs on Apache instead, either move both sites behind nginx or
translate the config below into an Apache virtual host (`mod_proxy_wstunnel` for the WebSocket).

**Sizing:** the game server uses a few hundred MB of RAM. The project is about 1.1 GB on disk, plus backups under
`server/data/backups/`. Each new player downloads roughly 90 MB to get into the world the first time (the Kanto map alone
is 33 MB), plus more models as they appear; the browser caches it after that. Bandwidth matters more than CPU: 20 new
players joining at once is close to 2 GB. A VPS that already runs an OT server comfortably usually has room;
4 GB of RAM or more is a sensible floor for both together.

## 1. Install

```bash
# Debian/Ubuntu
sudo apt install -y nginx certbot python3-certbot-nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

sudo useradd --system --create-home --home-dir /srv/pokeverse pokeverse
sudo -u pokeverse git clone https://github.com/GIToez/PokeVerse-3D.git /srv/pokeverse/app
cd /srv/pokeverse/app && sudo -u pokeverse npm install --omit=dev
```

## 2. Run the game server as a service

`/etc/systemd/system/pokeverse.service`:

```ini
[Unit]
Description=PokeVerse game server
After=network.target

[Service]
User=pokeverse
WorkingDirectory=/srv/pokeverse/app
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pokeverse
curl http://127.0.0.1:5190/saude     # → {"ok":true,...}
```

`HOST=127.0.0.1` keeps port 5190 off the internet. The server saves accounts on stop, so `systemctl restart` is safe.

## 3. nginx

`/etc/nginx/sites-available/pokeverse` (then `ln -s` it into `sites-enabled`):

```nginx
server {
    listen 80;
    server_name pokeverse.example.com;
    root /srv/pokeverse/app;
    index index.html;

    # Never serve live data, server code, tools, or repo internals.
    location ~ ^/(server|tools|docs|upcoming|node_modules|\.git)(/|$) { return 404; }
    location ~ ^/(server[^/]*\.mjs|package(-lock)?\.json|vite\.config\.js|.*\.(md|bat))$ { return 404; }

    # Game server (HTTP API + WebSocket), reached by the client at /servidor.
    location ^~ /servidor {
        rewrite ^/servidor/?(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:5190;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 1h;
        client_max_body_size 150m;
    }

    # Admin pages (the dev server rewrites these; nginx has to do it here).
    location = /admin          { try_files /admin/index.html =404; }
    location = /admin/         { try_files /admin/index.html =404; }
    location = /admin/scenery  { try_files /admin/scenery.html =404; }
    location = /admin/cenario  { try_files /admin/scenery.html =404; }

    location = / { try_files /index.html =404; }

    # Static files: public/ first (like the dev server), then the project root (scenery/, sound/, ui/, *.mjs…).
    location ~ \.(glb|png|webp|jpg|ogg|mp3|wav|ktx2)$ {
        try_files /public$uri $uri =404;
        expires 7d;
    }
    location ~ \.mjs$ {
        default_type application/javascript;
        try_files /public$uri $uri =404;
    }
    location / {
        try_files /public$uri $uri =404;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d pokeverse.example.com     # adds HTTPS and the 443 block
```

HTTPS is required, not optional: the client only uses the `/servidor` path when the page is served over HTTPS. Over
plain HTTP it tries to reach port 5190 directly, which is closed.

`X-Forwarded-For` is set (not appended) to the real client address. The game server trusts that header only from
127.0.0.1, so per-IP login and sign-up limits work, and clients can't spoof them.

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw allow 7171,7172/tcp     # OpenTibia, if it's on this machine
sudo ufw enable
```

Keep 5190 (game server) and 3306 (MySQL) closed.

## 5. First admin

Create an account in the game, then:

```bash
sudo systemctl stop pokeverse
sudo -u pokeverse node /srv/pokeverse/app/tools/make_gm.mjs your_username
sudo systemctl start pokeverse
```

The admin panel is then at `https://pokeverse.example.com/admin`.

## Before opening it to the public

- **Back up `server/data/`** (accounts and saves). It's gitignored, so `git pull` won't touch it, but nothing else backs it up off the machine.
- Work through `docs/SECURITY.md`: restrict CORS, retire the legacy password format, and consider a player cap (the server has none).
- Battles: logged-in players can't fight trainers, gyms or the Elite Four on this server (see `docs/AUDIT.md`).
- **Pokémon IP.** The game uses Pokémon names, models and music owned by Nintendo / Game Freak / The Pokémon Company.
  Hosting providers, OVH included, act on copyright complaints, and that can affect everything else on the same server,
  including the OT server. Keep that in mind before making it public.

## Updating

```bash
cd /srv/pokeverse/app && sudo -u pokeverse git pull && sudo -u pokeverse npm install --omit=dev
sudo systemctl restart pokeverse
```

Admin-panel edits are written into `public/data/` and `public/scenery/` in this checkout. Commit or back them up before
pulling, or a pull that touches the same files will conflict.
