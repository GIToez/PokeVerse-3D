#!/usr/bin/env bash
# Let pokeverse start, stop, restart, and check pokeverse-3d without a password.
# Run once as ubuntu. Does not restart the game and does not touch Open Tibia.
set -euo pipefail

DEPLOY_USER="${PV_SSH_USER:-pokeverse}"
SERVICE=pokeverse-3d
DROP=/etc/sudoers.d/pokeverse-3d-deploy

if [[ "$(id -un)" == "$DEPLOY_USER" ]]; then
  echo "Run this as ubuntu, not as ${DEPLOY_USER}." >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
cat >"$tmp" <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl start ${SERVICE}, /bin/systemctl stop ${SERVICE}, /bin/systemctl restart ${SERVICE}, /bin/systemctl status ${SERVICE}, /bin/systemctl is-active ${SERVICE}, /usr/bin/systemctl start ${SERVICE}, /usr/bin/systemctl stop ${SERVICE}, /usr/bin/systemctl restart ${SERVICE}, /usr/bin/systemctl status ${SERVICE}, /usr/bin/systemctl is-active ${SERVICE}
EOF
sudo visudo -cf "$tmp"
sudo cp "$tmp" "$DROP"
sudo chmod 440 "$DROP"
echo "pokeverse can start, stop, restart, and check ${SERVICE}."
