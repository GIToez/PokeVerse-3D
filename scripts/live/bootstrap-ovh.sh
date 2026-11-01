#!/usr/bin/env bash
# First-time install of PokeVerse-3D on the OVH box that already runs Open Tibia.
# Run as ubuntu@40.160.145.24. After this, all deploys are pokeverse@40.160.145.24.
set -euo pipefail

HOST_IP="${PV_HOST:-40.160.145.24}"
DEPLOY_USER="${PV_SSH_USER:-pokeverse}"
# pokeverse already exists for Discord/OT; its home is not /home/pokeverse.
APP_DIR="${PV_APP_DIR:-/opt/pokeverse-3d}"
REPO="${PV_REPO:-https://github.com/GIToez/PokeVerse-3D.git}"
SERVICE=pokeverse-3d

if [[ "$(id -un)" == "$DEPLOY_USER" ]]; then
  echo "Run this as ubuntu (first login), not as $DEPLOY_USER." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y git curl

if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  sudo useradd --create-home --shell /bin/bash "$DEPLOY_USER"
  echo "Created user $DEPLOY_USER"
fi

DEPLOY_SHELL="$(getent passwd "$DEPLOY_USER" | cut -d: -f7)"
if [[ "$DEPLOY_SHELL" == *nologin* || "$DEPLOY_SHELL" == *false* ]]; then
  sudo usermod -s /bin/bash "$DEPLOY_USER"
  echo "Set $DEPLOY_USER shell to /bin/bash so SSH deploy works"
fi

sudo mkdir -p "$APP_DIR"
sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO" "$APP_DIR"
else
  echo "Checkout already exists at $APP_DIR"
fi

sudo -u "$DEPLOY_USER" bash -lc "cd '$APP_DIR' && npm install --omit=dev"

sudo tee "/etc/systemd/system/${SERVICE}.service" >/dev/null <<EOF
[Unit]
Description=PokeVerse 3D game server
After=network.target

[Service]
User=${DEPLOY_USER}
WorkingDirectory=${APP_DIR}
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/sudoers.d/pokeverse-3d-deploy >/dev/null <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl restart ${SERVICE}, /bin/systemctl status ${SERVICE}, /bin/systemctl is-active ${SERVICE}
EOF
sudo chmod 440 /etc/sudoers.d/pokeverse-3d-deploy

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE"
sleep 1
curl -fsS http://127.0.0.1:5190/saude
echo
echo "Bootstrap done on ${HOST_IP}. Later deploys: ssh ${DEPLOY_USER}@${HOST_IP} 'bash ${APP_DIR}/scripts/live/deploy.sh'"
echo "OT is unchanged. This unit is ${SERVICE} only."
