#!/usr/bin/env bash
# Copy live admin edits from the OVH checkout onto main.
# Used by Save live edits, and by Deploy before git reset. No restart.
# A newer git commit of the same file is left as it is. A newer server file
# (or a file that exists only on the server) is committed.
# GITHUB_TOKEN pushes do not start another deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
# shellcheck source=guard-live.sh
source "$ROOT/scripts/live/guard-live.sh"

archive="${LIVE_ARCHIVE:-}"
key=""
names=""
cleanup() {
  [[ -n "$key" ]] && rm -f "$key"
  if [[ -z "${LIVE_ARCHIVE:-}" && -n "$archive" ]]; then
    rm -f "$archive"
  fi
  [[ -n "$names" ]] && rm -f "$names"
}
trap cleanup EXIT

if [[ -z "$archive" ]]; then
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
  archive="$(mktemp)"
  printf '%s\n' "$OVH_SSH_KEY" > "$key"
  chmod 600 "$key"

  echo "Downloading live edits from ${USER_NAME}@${HOST}:${APP}"
  ssh -i "$key" -p "$PORT" \
    -o StrictHostKeyChecking=accept-new \
    -o IdentitiesOnly=yes \
    -o ServerAliveInterval=30 \
    "${USER_NAME}@${HOST}" \
    "PV_APP_DIR=$(printf '%q' "$APP") bash -s" \
    < "$ROOT/scripts/live/pack-live.sh" > "$archive"
fi

if [[ ! -s "$archive" ]]; then
  echo "The live archive is empty." >&2
  exit 1
fi

bytes="$(stat -c%s "$archive")"
if (( bytes > 400 * 1024 * 1024 )); then
  echo "Archive is ${bytes} bytes. Refusing to unpack it." >&2
  exit 1
fi

names="$(mktemp)"
tar -tzf "$archive" > "$names"
# Files and directories only. A symlink could point at accounts or a model library.
while read -r mode _; do
  case "$mode" in
    -*|d*) ;;
    *) echo "archive contains a non-file member ($mode). Refusing to unpack." >&2; exit 1 ;;
  esac
done < <(tar -tvzf "$archive")

allowed() {
  case "$1" in
    public/data|public/data/|public/data/*/|scenery/|public/scenery/) return 0 ;;
    public/scenery/*/*|scenery/*/*) return 1 ;;
    public/scenery/*.glb|public/scenery/*.json|scenery/*.glb|scenery/*.json) return 0 ;;
    public/data/*)
      case "$1" in
        *.json|*.txt) return 0 ;;
      esac
      ;;
  esac
  return 1
}

while IFS= read -r n; do
  n="${n#./}"
  case "$n" in
    ""|/*|../*|*/../*|*/..|..) echo "bad path in archive: $n" >&2; exit 1 ;;
  esac
  if ! allowed "$n"; then
    echo "archive path is outside the live-edit set: $n" >&2
    exit 1
  fi
done < "$names"

tar -xzf "$archive"

while IFS= read -r n; do
  n="${n#./}"
  [[ -f "$n" && ! -L "$n" ]] || continue
  if server_wins "$n"; then
    echo "live: $n"
    git add -- "$n"
  elif git cat-file -e "HEAD:$n" 2>/dev/null; then
    # Older server bytes were extracted on top of a newer commit. Put the commit back.
    git checkout -q HEAD -- "$n"
  fi
done < "$names"

while IFS= read -r staged; do
  [[ -n "$staged" ]] || continue
  if ! allowed "$staged"; then
    echo "refusing to commit $staged" >&2
    exit 1
  fi
done < <(git diff --cached --name-only)

if git diff --cached --quiet; then
  echo "No live edits to save."
  exit 0
fi

echo "Saving:"
git diff --cached --stat

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "Save live edits from the server"

if [[ -n "${LIVE_ARCHIVE:-}" ]]; then
  echo "LIVE_ARCHIVE set: committed locally, not pushing."
  exit 0
fi

if ! git push origin HEAD:main; then
  git fetch origin main
  git rebase origin/main
  git push origin HEAD:main
fi
echo "Live edits are on main."
