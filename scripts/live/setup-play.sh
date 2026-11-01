#!/usr/bin/env bash
# Put play.pokeverse.quest in front of pokeverse-3d. Run as ubuntu (needs sudo).
# Does not restart Open Tibia. DNS must already point play.pokeverse.quest at 40.160.145.24.
set -euo pipefail

DOMAIN="${PV_PLAY_DOMAIN:-play.pokeverse.quest}"
APP_DIR="${PV_APP_DIR:-/opt/pokeverse-3d}"
CONF_SRC="${APP_DIR}/scripts/live/play.pokeverse.quest.nginx"

if [[ "$(id -un)" == "pokeverse" ]]; then
  echo "Run this as ubuntu (needs apt + nginx/certbot sudo), not as pokeverse." >&2
  exit 1
fi

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Missing $CONF_SRC — pull main into $APP_DIR first." >&2
  exit 1
fi

if ! curl -fsS http://127.0.0.1:5190/saude >/dev/null && ! curl -fsS http://127.0.0.1:5190/health >/dev/null; then
  echo "pokeverse-3d is not answering on 127.0.0.1:5190." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx

WHO80="$(sudo ss -lptn 'sport = :80' | awk 'NR>1{print; exit}')" || true
if echo "$WHO80" | grep -qi apache; then
  echo "Port 80 is Apache (account.pokeverse.quest). Not installing a competing nginx listener." >&2
  echo "Add a play.pokeverse.quest vhost in Apache, or move both sites to nginx." >&2
  echo "Listener: $WHO80" >&2
  exit 1
fi

sudo cp "$CONF_SRC" /etc/nginx/sites-available/play.pokeverse.quest
sudo ln -sfn /etc/nginx/sites-available/play.pokeverse.quest /etc/nginx/sites-enabled/play.pokeverse.quest
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "Waiting for DNS $DOMAIN → this box…"
for i in $(seq 1 30); do
  RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)"
  if [[ "$RESOLVED" == "40.160.145.24" || "$RESOLVED" == "$(curl -4 -fsS --max-time 3 ifconfig.me || true)" ]]; then
    break
  fi
  sleep 2
done

CERTBOT_OPTS=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
  CERTBOT_OPTS+=(-m "$CERTBOT_EMAIL")
else
  CERTBOT_OPTS+=(--register-unsafely-without-email)
fi

sudo certbot "${CERTBOT_OPTS[@]}"
curl -fsS "https://${DOMAIN}/servidor/health" || curl -fsS "https://${DOMAIN}/servidor/saude" || true
echo
echo "https://${DOMAIN}  (admin: https://${DOMAIN}/admin)"
echo "OT and account.pokeverse.quest were not restarted."
