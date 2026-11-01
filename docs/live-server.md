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

## Permission denied as pokeverse

`pokeverse` is key-only. There is no password that works. If Windows asks for `pokeverse@40.160.145.24's password:` and then says `Permission denied (publickey,password)`, stop — log in as **ubuntu** first.

In PowerShell:

```powershell
ssh ubuntu@40.160.145.24
```

Use the OVH **ubuntu** password (or the key you used when you first set up this VPS). After you are on the box:

```bash
sudo mkdir -p /home/pokeverse/.ssh
sudo chmod 700 /home/pokeverse/.ssh
# paste ONE public-key line (starts with ssh-ed25519 or ssh-rsa):
sudo tee -a /home/pokeverse/.ssh/authorized_keys
# Ctrl+D when done
sudo chown -R pokeverse:pokeverse /home/pokeverse/.ssh
sudo chmod 600 /home/pokeverse/.ssh/authorized_keys
exit
```

On the PC, if you do not already have a key:

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\pokeverse_ovh -N '""'
Get-Content $env:USERPROFILE\.ssh\pokeverse_ovh.pub
```

Copy that `.pub` line into `authorized_keys` above. Then:

```powershell
ssh -i $env:USERPROFILE\.ssh\pokeverse_ovh pokeverse@40.160.145.24
```

The **private** file (`pokeverse_ovh`, no `.pub`) is what goes in GitHub secret `OVH_SSH_KEY`. Do not put the `.pub` file there. Do not paste the private key into chat.
