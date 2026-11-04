#!/usr/bin/env bash
# Update the live 3D checkout. Run as pokeverse@40.160.145.24 (PV_SSH_USER).
# Does not restart Open Tibia. Does not delete server/data/.
set -euo pipefail

DEPLOY_USER="${PV_SSH_USER:-pokeverse}"
APP_DIR="${PV_APP_DIR:-/opt/pokeverse-3d}"
SERVICE=pokeverse-3d

if [[ "$(id -un)" != "$DEPLOY_USER" ]]; then
  echo "Deploy as ${DEPLOY_USER} (got $(id -un))." >&2
  exit 1
fi

cd "$APP_DIR"
echo "==> fetching origin/main in $APP_DIR"
git fetch --prune origin main
git checkout -q main
# A newer panel edit (quests, NPCs, maps, the rest of public/data, map meshes)
# must be on origin/main before this reset. Actions → Save live edits does that,
# and the deploy workflow runs it first. A newer git commit of the same file may
# replace an older copy on disk.
if [[ -f "$APP_DIR/scripts/live/guard-live.sh" ]]; then
  bash "$APP_DIR/scripts/live/guard-live.sh" --guard
fi
git reset --hard origin/main

echo "==> npm install --omit=dev"
npm install --omit=dev

echo "==> restart ${SERVICE}"
sudo -n systemctl restart "$SERVICE"
sleep 1
curl -fsS http://127.0.0.1:5190/health
echo

# Caddy site config. Needs the sudo rules from scripts/live/grant-service-ctl.sh (run once as ubuntu).
# A config Caddy rejects is put back to the last one it accepted, so a bad commit cannot take the site down.
CADDY_SNIPPET=/etc/caddy/play.pokeverse.quest.caddy
CADDY_SRC="$APP_DIR/scripts/live/play.pokeverse.quest.caddy"
CADDY_GOOD="$APP_DIR/server/data/caddy-last-good.caddy"
CADDY_BIN="$(command -v caddy || echo /usr/bin/caddy)"
if [[ -f "$CADDY_SRC" && -f "$CADDY_SNIPPET" ]]; then
  if cmp -s "$CADDY_SRC" "$CADDY_SNIPPET"; then
    echo "==> Caddy site config unchanged"
    [[ -f "$CADDY_GOOD" ]] || cp "$CADDY_SNIPPET" "$CADDY_GOOD" || true
  elif sudo -n /usr/bin/install -m 644 "$CADDY_SRC" "$CADDY_SNIPPET" 2>/dev/null; then
    if sudo -n "$CADDY_BIN" validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
      if sudo -n /usr/bin/systemctl reload caddy; then
        cp "$CADDY_SRC" "$CADDY_GOOD" || true
        echo "==> Caddy site config updated and reloaded"
      else
        echo "Caddy reload failed; the new site config takes effect on the next reload." >&2
      fi
    else
      echo "Caddy rejected the new site config; keeping the previous one." >&2
      if [[ -f "$CADDY_GOOD" ]]; then sudo -n /usr/bin/install -m 644 "$CADDY_GOOD" "$CADDY_SNIPPET" || true; fi
    fi
  else
    echo "Caddy config not refreshed: run scripts/live/grant-service-ctl.sh once as ubuntu." >&2
  fi
fi

echo "==> deploy done $(git rev-parse --short HEAD)"
