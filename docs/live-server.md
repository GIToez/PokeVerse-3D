# Live VPS (OVH)

Same machine as the Open Tibia PokeVerse. The 3D game is a second service on that box.

| | Value |
|---|---|
| Host | `40.160.145.24` |
| First-time SSH | `ubuntu@40.160.145.24` (only to run `scripts/live/bootstrap-ovh.sh`) |
| Deploy SSH | `pokeverse@40.160.145.24` |
| App dir | `/home/pokeverse/PokeVerse-3D` |
| systemd unit | `pokeverse-3d` (not `pokeverse` — that name is reserved for OT) |
| Game port | `127.0.0.1:5190` |

`OVH_USER` is not a setting in this repo. Deploy uses `pokeverse` unless you override `PV_SSH_USER`.

## First time (once)

From your PC, as **ubuntu**:

```bash
scp scripts/live/bootstrap-ovh.sh ubuntu@40.160.145.24:
ssh ubuntu@40.160.145.24 'bash bootstrap-ovh.sh'
```

That creates `pokeverse` if needed, clones this repo, installs npm packages, installs `pokeverse-3d.service`, and lets `pokeverse` restart that unit with sudo. It does not touch the OT process.

Then nginx + HTTPS: see [HOSTING.md](HOSTING.md). Point a subdomain at `40.160.145.24` and proxy `/servidor` to `127.0.0.1:5190`.

## Later deploys

GitHub Actions (push to `main`, or Actions → **Deploy to OVH**) SSHs as `pokeverse` and runs `scripts/live/deploy.sh`.

From your PC:

```bash
ssh pokeverse@40.160.145.24 'bash ~/PokeVerse-3D/scripts/live/deploy.sh'
```

Secrets on this repo: `OVH_HOST` (`40.160.145.24`), `OVH_SSH_KEY` (key that logs in as **pokeverse**), optional `OVH_USER` (only if you are not using `pokeverse`).
