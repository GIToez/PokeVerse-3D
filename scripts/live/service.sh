#!/usr/bin/env bash
# start, stop, restart, or status for the pokeverse-3d unit only.
# Does not touch Open Tibia. Run on the OVH box as pokeverse.
set -euo pipefail

ACTION="${1:-status}"
SERVICE="${PV_SERVICE:-pokeverse-3d}"
case "$ACTION" in
  start|stop|restart|status) ;;
  *)
    echo "Use: start, stop, restart, or status" >&2
    exit 2
    ;;
esac

ctl() {
  sudo -n systemctl "$@"
}

if [[ "$ACTION" == "status" ]]; then
  ctl status "$SERVICE" || true
  echo "active: $(ctl is-active "$SERVICE" || true)"
  if curl -fsS http://127.0.0.1:5190/health; then
    echo
  else
    echo "health check failed"
  fi
  exit 0
fi

if ! ctl "$ACTION" "$SERVICE"; then
  echo "sudoers does not allow systemctl ${ACTION} ${SERVICE}." >&2
  echo "As ubuntu, once: bash /opt/pokeverse-3d/scripts/live/grant-service-ctl.sh" >&2
  exit 1
fi

sleep 1
if [[ "$ACTION" == "stop" ]]; then
  state="$(ctl is-active "$SERVICE" || true)"
  if [[ "$state" != "inactive" && "$state" != "failed" ]]; then
    echo "pokeverse-3d is still ${state}" >&2
    exit 1
  fi
  echo "stopped"
  exit 0
fi

curl -fsS http://127.0.0.1:5190/health
echo
echo "${ACTION} done"
