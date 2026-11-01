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
git reset --hard origin/main

echo "==> npm install --omit=dev"
npm install --omit=dev

echo "==> restart ${SERVICE}"
sudo -n systemctl restart "$SERVICE"
sleep 1
curl -fsS http://127.0.0.1:5190/health
echo

CADDY_SNIPPET=/etc/caddy/play.pokeverse.quest.caddy
CADDY_SRC="$APP_DIR/scripts/live/play.pokeverse.quest.caddy"
if [[ -f "$CADDY_SRC" && -f "$CADDY_SNIPPET" ]] && sudo -n true 2>/dev/null; then
  echo "==> refresh Caddy site snippet"
  sudo -n cp "$CADDY_SRC" "$CADDY_SNIPPET"
  sudo -n systemctl reload caddy || echo "Caddy reload skipped (no permission or unit missing)"
fi

echo "==> deploy done $(git rev-parse --short HEAD)"
