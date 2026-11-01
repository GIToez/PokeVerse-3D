#!/usr/bin/env bash
# Update the live checkout on the VPS and restart the game server.
# Safe for accounts: server/data/ is gitignored and is not deleted.
# Live admin edits in public/data/ or public/scenery/ that are not committed
# will be overwritten by the reset to origin/main — back those up first.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

echo "==> fetching origin/main in $APP_DIR"
git fetch --prune origin main
git checkout -q main
git reset --hard origin/main

echo "==> installing production npm packages"
npm install --omit=dev

if systemctl is-enabled pokeverse >/dev/null 2>&1 || systemctl cat pokeverse >/dev/null 2>&1; then
  echo "==> restarting pokeverse"
  if sudo -n systemctl restart pokeverse 2>/dev/null; then
    :
  elif systemctl --user restart pokeverse 2>/dev/null; then
    :
  else
    echo "Could not restart pokeverse (need passwordless sudo for systemctl, or a user service)." >&2
    exit 1
  fi
  sleep 1
  curl -fsS http://127.0.0.1:5190/saude
  echo
else
  echo "pokeverse.service is not installed yet; skipped restart."
  echo "Follow docs/HOSTING.md to create the service the first time."
fi

echo "==> deploy done $(git rev-parse --short HEAD)"
