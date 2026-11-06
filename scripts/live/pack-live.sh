#!/usr/bin/env bash
# Pack live admin edits from the game checkout to stdout (gzip tar).
# On the OVH box:  PV_APP_DIR=/opt/pokeverse-3d bash pack-live.sh
#   --list   print the paths instead of a tar (notes stay on stderr)
#
# The admin panel writes these, and deploy's git reset would otherwise drop them.
#   public/data/**/*.json and **/*.txt, one or two levels deep
#     quests, NPCs, trainers, doors, gyms, dialogues, habitats, spawn zones,
#     scenes, each map's JSON, items, shops, live events (eventos.json),
#     music, raid, species, locale/, and idioma/ (the species screen writes
#     public/data/idioma/dex_pt.json even though the game reads locale/dex_*.json)
#   top-level map meshes the 3D editor re-exports and the client loads:
#     public/scenery/<map>.glb|.json and scenery/<map>.glb|_chao.json
#
# Left on the server (not panel uploads, and model libraries are too large for git):
#   server/data/   accounts, saves, admin log, client log, backups
#   */mon */pc */prop */npc */fogo */agua
#   sound/ and ui/  the panel stores a file name inside JSON; it does not upload bytes
#   *.tmp
set -euo pipefail

# case globs match slashes, so scenery rules name the extra directory explicitly.
allow() {
  case "$1" in
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

if [[ "${1:-}" == "--self-test" ]]; then
  pass() { allow "$1" || { echo "should allow $1" >&2; exit 1; }; }
  fail() { if allow "$1"; then echo "should reject $1" >&2; exit 1; fi; }
  pass public/data/missions.json
  pass public/data/locale/dex_pt.json
  pass public/data/idioma/dex_pt.json
  pass public/data/a/b/c.json
  pass public/data/interior_maps.txt
  pass scenery/kanto.glb
  pass scenery/kanto_chao.json
  pass public/scenery/town.glb
  fail public/scenery/mon/pm0001.glb
  fail public/scenery/pc/Girl_012.glb
  fail scenery/npc/nurse.glb
  fail scenery/fogo/x.png
  fail server/data/contas.json
  fail public/data/skip.tmp
  fail sound/a.ogg
  fail ui/itens/x.png
  echo "pack-live: path self-test ok" >&2
  exit 0
fi

cd "${PV_APP_DIR:-/opt/pokeverse-3d}"

mode=pack
if [[ "${1:-}" == "--list" ]]; then
  mode=list
fi

raw="$(mktemp)"
list="$(mktemp)"
trap 'rm -f "$raw" "$list"' EXIT

find_live() {
  if [[ -d public/data ]]; then
    find public/data -type f \( -name '*.json' -o -name '*.txt' \) ! -name '*.tmp' -print
  fi
  local root
  for root in public/scenery scenery; do
    if [[ -d "$root" ]]; then
      find "$root" -maxdepth 1 -type f \( -name '*.glb' -o -name '*.json' \) -print
    fi
  done
}

reject() {
  echo "pack-live: $*" >&2
  exit 1
}

find_live | sort -u > "$raw"
: > "$list"
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  case "$f" in
    ""|/*|../*|*/../*|*/..|..|*\\*) reject "refusing path $f" ;;
    server/data|server/data/*) reject "refusing accounts path $f" ;;
  esac
  if ! allow "$f"; then
    reject "path is outside the live-edit set: $f"
  fi
  if [[ ! -f "$f" || -L "$f" ]]; then
    reject "not a regular file: $f"
  fi
  sz="$(stat -c%s "$f")"
  # GitHub rejects a file over 100MB. Stop before a deploy can reset past it.
  if (( sz > 90 * 1024 * 1024 )); then
    reject "$f is ${sz} bytes (over 90MB). It cannot be stored in git."
  fi
  printf '%s\n' "$f" >> "$list"
done < "$raw"

if [[ ! -s "$list" ]]; then
  reject "no live files found under $PWD"
fi
echo "pack-live: $(wc -l < "$list") files" >&2

if [[ "$mode" == "list" ]]; then
  cat "$list"
  exit 0
fi

# --hard-dereference: a map made with the admin New map tool used to hard-link its GLB to the source map; store it as a plain file
# (save-live-ci refuses non-file members)
tar --hard-dereference -czf - -T "$list"
