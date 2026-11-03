#!/usr/bin/env bash
# proxy.sh — draft RÁPIDO 1080 de UNA escena, solo para self-QC silencioso de frames.
# Para iterar de verdad usa el preview vivo (preview.sh) — ese no necesita render.
#
#   tools/proxy.sh mi-video S04        # match parcial OK
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(node "$HERE/project.mjs" root)"
# La versión vive en tools/HF_VERSION (una sola fuente). Override: HF_VER=x.y.z
HF_VER="${HF_VER:-$(cat "$HERE/HF_VERSION" 2>/dev/null || echo 0.8.214)}"
HF="npx --yes hyperframes@$HF_VER"

[ $# -ge 2 ] || { echo "uso: tools/proxy.sh <slug> <escena>"; exit 1; }
PROJECT_DIR="$(node "$HERE/project.mjs" resolve "$1")"
slug="$(basename "$PROJECT_DIR")"
scene="$(node "$HERE/project.mjs" scene "$PROJECT_DIR" "$2")"; dir="$PROJECT_DIR/scenes/$scene"
HF_VER="$(node "$HERE/project.mjs" version "$PROJECT_DIR")"
HF="npx --yes hyperframes@$HF_VER"
fps="${3:-30}"

# Moi = vertical: draft portrait por default (HF_RES=landscape para casos raros)
( cd "$dir" && $HF render --resolution "${HF_RES:-portrait}" --quality draft -f "$fps" -o renders/_proxy.mp4 )
echo "proxy: $dir/renders/_proxy.mp4"
# auto-open APAGADO por default (abre el player). Opt-in: PROXY_OPEN=1.
[ "${PROXY_OPEN:-0}" = "1" ] && open "$dir/renders/_proxy.mp4" 2>/dev/null || true
