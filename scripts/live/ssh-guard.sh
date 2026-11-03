#!/usr/bin/env bash
# Fetch origin/main on the OVH box and refuse if a reset would drop a newer live edit.
# The guard script is piped from this checkout, so it works before that file is deployed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${OVH_SSH_KEY:?OVH_SSH_KEY is required}"
HOST="${OVH_HOST:-40.160.145.24}"
USER_NAME="${OVH_USER:-pokeverse}"
PORT="${OVH_PORT:-22}"
APP="${PV_APP_DIR:-/opt/pokeverse-3d}"
[[ -n "$HOST" ]] || HOST=40.160.145.24
[[ -n "$USER_NAME" ]] || USER_NAME=pokeverse
[[ -n "$PORT" ]] || PORT=22
[[ "$HOST" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad OVH_HOST" >&2; exit 1; }
[[ "$USER_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad OVH_USER" >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "bad OVH_PORT" >&2; exit 1; }
[[ "$APP" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo "bad PV_APP_DIR" >&2; exit 1; }

key="$(mktemp)"
trap 'rm -f "$key"' EXIT
printf '%s\n' "$OVH_SSH_KEY" > "$key"
chmod 600 "$key"

ssh -i "$key" -p "$PORT" \
  -o StrictHostKeyChecking=accept-new \
  -o IdentitiesOnly=yes \
  "${USER_NAME}@${HOST}" \
  "cd $(printf '%q' "$APP") && git fetch --prune origin main </dev/null && git checkout -q main </dev/null && PV_APP_DIR=$(printf '%q' "$APP") bash -s -- --guard" \
  < "$ROOT/scripts/live/guard-live.sh"
