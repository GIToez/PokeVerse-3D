#!/usr/bin/env bash
# Put play.pokeverse.quest in front of pokeverse-3d. Run as ubuntu (needs sudo).
# Uses Apache if port 80 is already Apache (account.pokeverse.quest). nginx only if 80 is free.
# Does not restart Open Tibia. DNS must already point play.pokeverse.quest at 40.160.145.24.
# This file must exist on origin/main before anyone is told to run it.
set -euo pipefail

DOMAIN="${PV_PLAY_DOMAIN:-play.pokeverse.quest}"
APP_DIR="${PV_APP_DIR:-/opt/pokeverse-3d}"
NGINX_SRC="${APP_DIR}/scripts/live/play.pokeverse.quest.nginx"
APACHE_SRC="${APP_DIR}/scripts/live/play.pokeverse.quest.apache.conf"

if [[ "$(id -un)" == "pokeverse" ]]; then
  echo "Run this as ubuntu (needs apt + sudo), not as pokeverse." >&2
  exit 1
fi

if [[ ! -f "$NGINX_SRC" || ! -f "$APACHE_SRC" ]]; then
  echo "Missing site files under $APP_DIR/scripts/live — reset this checkout to origin/main first." >&2
  exit 1
fi

if ! curl -fsS http://127.0.0.1:5190/saude >/dev/null && ! curl -fsS http://127.0.0.1:5190/health >/dev/null; then
  echo "pokeverse-3d is not answering on 127.0.0.1:5190." >&2
  exit 1
fi

WHO80="$(sudo ss -lptn 'sport = :80' 2>/dev/null | awk 'NR>1{print; exit}')" || true
if systemctl is-active --quiet apache2 || systemctl is-active --quiet httpd || echo "$WHO80" | grep -qiE 'apache|httpd'; then
  FRONT=apache
elif systemctl is-active --quiet nginx || echo "$WHO80" | grep -qi nginx; then
  FRONT=nginx
elif [[ -n "$WHO80" ]]; then
  echo "Port 80 is already in use (not Apache or nginx):" >&2
  echo "$WHO80" >&2
  exit 1
else
  FRONT=nginx
fi

echo "Front door: $FRONT  (port 80: ${WHO80:-free})"

export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y

wait_dns() {
  echo "Waiting for DNS $DOMAIN → this box…"
  for _ in $(seq 1 30); do
    RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)"
    if [[ "$RESOLVED" == "40.160.145.24" || "$RESOLVED" == "$(curl -4 -fsS --max-time 3 ifconfig.me || true)" ]]; then
      echo "DNS $DOMAIN → $RESOLVED"
      return 0
    fi
    sleep 2
  done
  echo "DNS $DOMAIN is not 40.160.145.24 yet. Add the Spaceship A record, then re-run." >&2
  getent ahostsv4 "$DOMAIN" || true
  exit 1
}

certbot_run() {
  local plugin="$1"
  local opts=("$plugin" -d "$DOMAIN" --non-interactive --agree-tos --redirect)
  if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
    opts+=(-m "$CERTBOT_EMAIL")
  else
    opts+=(--register-unsafely-without-email)
  fi
  sudo certbot "${opts[@]}"
}

if [[ "$FRONT" == apache ]]; then
  sudo apt-get install -y apache2 certbot python3-certbot-apache
  sudo systemctl disable --now nginx >/dev/null 2>&1 || true
  sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers
  sudo cp "$APACHE_SRC" /etc/apache2/sites-available/play.pokeverse.quest.conf
  sudo a2ensite play.pokeverse.quest
  sudo apache2ctl configtest
  sudo systemctl reload apache2
  wait_dns
  certbot_run --apache
else
  sudo apt-get install -y nginx certbot python3-certbot-nginx
  sudo cp "$NGINX_SRC" /etc/nginx/sites-available/play.pokeverse.quest
  sudo ln -sfn /etc/nginx/sites-available/play.pokeverse.quest /etc/nginx/sites-enabled/play.pokeverse.quest
  sudo nginx -t
  sudo systemctl enable --now nginx
  sudo systemctl reload nginx
  wait_dns
  certbot_run --nginx
fi

curl -fsS "https://${DOMAIN}/servidor/health" || curl -fsS "https://${DOMAIN}/servidor/saude" || true
echo
echo "https://${DOMAIN}  (admin: https://${DOMAIN}/admin)"
echo "OT and account.pokeverse.quest were not restarted."
