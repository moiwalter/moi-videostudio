#!/usr/bin/env bash
# burn.sh — el corte CON los subtítulos quemados. Para juzgar, no para montar.
#
#   bash burn.sh <proyecto>
#
# ⛔ NO usar render-and-composite.sh en proyectos sin matte: calcula la duración
#    contando `frames_fg` (línea 367) y sin esa carpeta sale 0 y aborta sin dejar
#    archivo. En modo fg global no hay nada que componer —index.html ya trae video
#    + subtítulos— así que el render directo ES el resultado.
set -euo pipefail
PROJ="$(cd "$1" && pwd)"
export HYPERFRAMES_ROOT="$HOME/.hyperframes"
CLI="$HYPERFRAMES_ROOT/packages/cli/dist/cli.js"
SK="$HOME/.claude/skills/embedded-captions/scripts"

# gate de sincronía del skill: ninguna palabra puede caer a más de 80 ms de su tiempo
node "$SK/check-timing.cjs" "$PROJ" --strict 2>&1 | tail -2 || { echo "✗ timing fuera de sync"; exit 1; }

( cd "$PROJ" && node "$CLI" render -c index.html --video-bitrate 20M -f 30 -o final.mp4 2>&1 | tail -3 )
ffprobe -v error -show_entries format=duration -show_entries stream=codec_type -of csv=p=0 "$PROJ/final.mp4" | tr '\n' ' '; echo
echo "QUEMADO → $PROJ/final.mp4"
