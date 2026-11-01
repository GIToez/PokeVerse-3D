#!/usr/bin/env bash
# Wrapper kept so older docs still work. Live deploys use scripts/live/deploy.sh.
exec "$(cd "$(dirname "$0")/.." && pwd)/scripts/live/deploy.sh"
