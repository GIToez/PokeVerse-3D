#!/usr/bin/env bash
# Let pokeverse start, stop, restart, and check pokeverse-3d without a password,
# and let deploys install the Caddy site config, validate it, and reload Caddy.
# Run once as ubuntu (safe to run again). Does not restart the game and does not touch Open Tibia.
set -euo pipefail

DEPLOY_USER="${PV_SSH_USER:-pokeverse}"
APP_DIR="${PV_APP_DIR:-/opt/pokeverse-3d}"
SERVICE=pokeverse-3d
DROP=/etc/sudoers.d/pokeverse-3d-deploy
CADDY_DROP=/etc/sudoers.d/pokeverse-3d-caddy
CADDY_SNIPPET=/etc/caddy/play.pokeverse.quest.caddy
CADDY_SRC="${APP_DIR}/scripts/live/play.pokeverse.quest.caddy"
CADDY_GOOD="${APP_DIR}/server/data/caddy-last-good.caddy"
CADDY_BIN="$(command -v caddy || echo /usr/bin/caddy)"

if [[ "$(id -un)" == "$DEPLOY_USER" ]]; then
  echo "Run this as ubuntu, not as ${DEPLOY_USER}." >&2
  exit 1
fi

install_drop() {
  local dest="$1" body="$2" tmp
  tmp="$(mktemp)"
  printf '%s\n' "$body" >"$tmp"
  sudo visudo -cf "$tmp"
  sudo cp "$tmp" "$dest"
  sudo chmod 440 "$dest"
  rm -f "$tmp"
}

install_drop "$DROP" "${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl start ${SERVICE}, /bin/systemctl stop ${SERVICE}, /bin/systemctl restart ${SERVICE}, /bin/systemctl status ${SERVICE}, /bin/systemctl is-active ${SERVICE}, /usr/bin/systemctl start ${SERVICE}, /usr/bin/systemctl stop ${SERVICE}, /usr/bin/systemctl restart ${SERVICE}, /usr/bin/systemctl status ${SERVICE}, /usr/bin/systemctl is-active ${SERVICE}"
echo "${DEPLOY_USER} can start, stop, restart, and check ${SERVICE}."

# Only these exact commands: install the repo's site file (or the last one Caddy accepted), validate, reload.
install_drop "$CADDY_DROP" "${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/install -m 644 ${CADDY_SRC} ${CADDY_SNIPPET}, /usr/bin/install -m 644 ${CADDY_GOOD} ${CADDY_SNIPPET}, ${CADDY_BIN} validate --config /etc/caddy/Caddyfile, /usr/bin/systemctl reload caddy, /bin/systemctl reload caddy"
echo "${DEPLOY_USER} can install ${CADDY_SNIPPET}, validate the Caddyfile, and reload Caddy."
