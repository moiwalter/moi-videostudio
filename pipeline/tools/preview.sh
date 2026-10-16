#!/usr/bin/env bash
# preview.sh — preview vivo con hot-reload de UNA escena (la que estás trabajando).
# Abre un solo server + tab. Editas el index.html → el tab se actualiza solo. Sin render.
# REGLA: preview solo la escena activa, no todas.
#
#   tools/preview.sh mi-video S05        # UNA escena (match parcial de slug + escena)
#   tools/preview.sh mi-video --all      # todas (raro — evita el spam de tabs)
#
# Parar todo:  npx hyperframes preview --kill-all
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(node "$HERE/project.mjs" root)"                       # video-edit/
# La versión vive en tools/HF_VERSION (una sola fuente). Override: HF_VER=x.y.z
HF_VER="${HF_VER:-$(cat "$HERE/HF_VERSION" 2>/dev/null || echo 0.8.29)}"
HF="npx --yes hyperframes@$HF_VER"

[ $# -ge 1 ] || { echo "uso: tools/preview.sh <slug> <escena>   (una escena; '<slug> --all' para todas)"; exit 1; }
PROJECT_DIR="$(node "$HERE/project.mjs" resolve "$1")"
slug="$(basename "$PROJECT_DIR")"
scenes="$PROJECT_DIR/scenes"
HF_VER="$(node "$HERE/project.mjs" version "$PROJECT_DIR")"
HF="npx --yes hyperframes@$HF_VER"
[ -d "$scenes" ] || { echo "✗ no hay scenes/ en $slug"; exit 1; }

SCENE="${2:-}"
if [ -z "$SCENE" ]; then
  echo "✗ nombra la escena activa, ej.  tools/preview.sh $1 S05"
  echo "  (preview UNA escena a la vez. '$1 --all' solo si de verdad necesitas todos los tabs.)"
  exit 1
fi
if [ "$SCENE" = "--all" ]; then SCENE=""; else SCENE="$(node "$HERE/project.mjs" scene "$PROJECT_DIR" "$SCENE")"; fi

if [ -z "${PREVIEW_PORT:-}" ]; then
  echo "Parando previews viejos…"
  $HF preview --kill-all >/dev/null 2>&1 || true
fi

PORT=${PREVIEW_PORT:-3011}; URLS=(); NAMES=()
for d in "$scenes"/*/; do
  s="$(basename "$d")"
  if [ -n "$SCENE" ] && [[ "$s" != "$SCENE" ]]; then continue; fi
  if [ ! -f "$d/index.html" ]; then echo "·  skip $s (sin index.html — escena footage)"; continue; fi
  echo "▶  $s  →  http://localhost:$PORT/"
  ( cd "$d" && $HF preview --port "$PORT" --no-open >"/tmp/hfprev_${slug}__${s}.log" 2>&1 & )
  URLS+=("http://localhost:$PORT/"); NAMES+=("$s"); PORT=$((PORT+1))
done

[ ${#URLS[@]} -gt 0 ] || { echo "✗ ninguna escena previewable (ninguna tiene index.html)"; exit 1; }
echo "Esperando a los servers…"; sleep 10
echo
echo "============= PREVIEWS VIVOS — $slug ============="
for i in "${!URLS[@]}"; do printf "  %-24s %s\n" "${NAMES[$i]}" "${URLS[$i]}"; done
echo "=================================================="
echo "Abriendo tabs…"
for u in "${URLS[@]}"; do open "$u" 2>/dev/null || true; done
echo
echo "Edita el index.html de la escena → su tab se recarga solo. Scrub para revisar."
echo "Parar todo:  $HF preview --kill-all"
