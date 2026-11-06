#!/usr/bin/env bash
# Live admin files vs git.
#   source this file for server_wins
#   bash guard-live.sh --guard     exit 1 if a reset would drop a newer live edit
#
# Same bytes: no change.
# Live file newer than the git commit (2s clock slack): the server wins.
# Git commit newer than the file on disk: git wins, and a reset may replace it.
set -euo pipefail

server_wins() {
  local f="$1" rev git_time srv_time
  if git cat-file -e "origin/main:$f" 2>/dev/null; then
    rev=origin/main
  elif git cat-file -e "HEAD:$f" 2>/dev/null; then
    rev=HEAD
  else
    return 0
  fi
  if git diff --quiet "$rev" -- "$f"; then
    return 1
  fi
  git_time="$(git log -1 --format=%ct "$rev" -- "$f")"
  srv_time="$(stat -c %Y -- "$f")"
  if (( srv_time + 2 >= git_time )); then
    return 0
  fi
  return 1
}

if [[ "${1:-}" != "--guard" ]]; then
  return 0 2>/dev/null || exit 0
fi

cd "${PV_APP_DIR:-/opt/pokeverse-3d}"
if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  echo "guard-live: origin/main is not fetched" >&2
  exit 1
fi

dirty="$(mktemp)"
trap 'rm -f "$dirty"' EXIT

# Files of a panel-made map (91xxxxx) that is no longer in scenes.json were deleted from the panel: the reset may drop them.
mapas_vivos=""
[[ -f public/data/scenes.json ]] && mapas_vivos="$(grep -oE '"id": ?91[0-9]{5}\b' public/data/scenes.json | grep -oE '91[0-9]{5}' | sort -u | tr '\n' ' ')"
mapa_apagado() {
  local id
  id="$(basename "$1" | grep -oE '^91[0-9]{5}' || true)"
  [[ -n "$id" && " $mapas_vivos " != *" $id "* ]] || return 1
  case "$1" in
    public/data/"$id".json|scenery/"$id".glb|scenery/"$id"_chao.json|public/scenery/"$id".glb|public/scenery/"$id"_chao.json) return 0 ;;
  esac
  return 1
}

scan() {
  local f
  while IFS= read -r f; do
    [[ -n "$f" && -f "$f" && ! -L "$f" ]] || continue
    if mapa_apagado "$f"; then continue; fi
    if server_wins "$f"; then
      printf '%s\n' "$f"
    fi
  done
}

{
  if [[ -d public/data ]]; then
    find public/data -type f \( -name '*.json' -o -name '*.txt' \) ! -name '*.tmp' -print
  fi
  for root in scenery public/scenery; do
    if [[ -d "$root" ]]; then
      find "$root" -maxdepth 1 -type f \( -name '*.glb' -o -name '*.json' \) -print
    fi
  done
} | sort -u | scan > "$dirty"

if [[ -s "$dirty" ]]; then
  echo "guard-live: newer live edits are not on origin/main yet:" >&2
  sed 's/^/  /' "$dirty" >&2
  echo "Run Actions → Save live edits, then deploy again. Refusing to reset." >&2
  exit 1
fi

echo "guard-live: no newer live edits outside origin/main"
