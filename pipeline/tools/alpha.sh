#!/usr/bin/env bash
# alpha.sh — render FINAL de UNA escena overlay lockeada como clip TRANSPARENTE.
# ProRes 4444 (yuva444p12le) a resolución de composición (1080×1920) — lo único que
# CapCut compone bien. JAMÁS HEVC con alpha (fondo negro). Incluye QC sobre verde.
#
#   tools/alpha.sh mi-video S03
#
# Output: scenes/<escena>/renders/<escena>_ALPHA.mov  (+ _qc_green.png para self-QC)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(node "$HERE/project.mjs" root)"
# La versión vive en tools/HF_VERSION (una sola fuente). Override: HF_VER=x.y.z
HF_VER="${HF_VER:-$(cat "$HERE/HF_VERSION" 2>/dev/null || echo 0.8.29)}"
HF="npx --yes hyperframes@$HF_VER"

[ $# -ge 2 ] || { echo "uso: tools/alpha.sh <slug> <escena>"; exit 1; }
PROJECT_DIR="$(node "$HERE/project.mjs" resolve "$1")"
slug="$(basename "$PROJECT_DIR")"
scene="$(node "$HERE/project.mjs" scene "$PROJECT_DIR" "$2")"; dir="$PROJECT_DIR/scenes/$scene"
HF_VER="$(node "$HERE/project.mjs" version "$PROJECT_DIR")"
HF="npx --yes hyperframes@$HF_VER"
node "$HERE/preflight.mjs" "$PROJECT_DIR" --lane KIT --scene "$scene"
fps="${3:-30}"
log="/tmp/alpha_${slug}__${scene}.log"

[ -f "$dir/index.html" ] || { echo "✗ $scene no tiene index.html"; exit 1; }
out="renders/${scene}_ALPHA.mov"

PY="${PY:-/Library/Frameworks/Python.framework/Versions/3.13/bin/python3}"

# ── GATE: sombras negras horneadas (§3b Ley del Alpha). Fuera del pipeline para que
#    el exit corte de verdad. ALPHA_QC=off lo salta a propósito.
if [ "${ALPHA_QC:-on}" != "off" ]; then
  echo ">>> [$slug/$scene] ALPHA LINT — invisible sobre negro, mancha sobre el footage"
  if ! "$PY" "$HERE/alpha-qc.py" --css "$dir/index.html"; then
    echo "    ⛔ NO SE RENDERIZA. Eso es la causa del 'borde raro' en CapCut."
    echo "       Política (SCENE_PLAYBOOK §3b): sombra oscura radio ≤8px · separar con rim claro ·"
    echo "       card oscura ≥.92 de opacidad · texto por contorno tight · glow = color con alpha→0, NUNCA negro."
    echo "       Si de verdad la quieres así: ALPHA_QC=off tools/alpha.sh $1 $2"
    exit 1
  fi
fi

{
  echo ">>> [$slug/$scene] lint"
  ( cd "$dir" && $HF lint )
  echo ">>> [$slug/$scene] RENDER ALPHA ${fps}fps (ProRes 4444, res de composición)"
  ( cd "$dir" && $HF render -c index.html --format mov -f "$fps" --variables '{"alpha":true}' -o "$out" )
  echo ">>> verificación: pix_fmt (debe ser yuva444p12le) + frame sobre verde"
  ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt,width,height -of csv=p=0 "$dir/$out"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dir/$out")
  # ⛔ `bc -l` devuelve `.45` SIN cero adelante cuando el valor es < 1, y ffmpeg lo
  #    rechaza con "Invalid duration for option ss". Sólo se dispara en escenas de
  #    menos de 2 s (lo destapó S13, de 0.87 s, en nacho-brain-rot el 24-ago-2026).
  #    printf lo normaliza a 0.433. El render ya estaba bien: fallaba SOLO el QC.
  mid=$(printf '%.3f' "$(echo "$dur / 2" | bc -l)")
  ffmpeg -y -loglevel error -f lavfi -i "color=c=0x00b140:s=1080x1920:r=30" -ss "$mid" -i "$dir/$out" \
    -filter_complex "[0:v][1:v]overlay=0:0:shortest=1" -frames:v 1 "$dir/renders/_qc_green.png"
  echo ">>> PREMULTIPLY — CapCut compone asumiendo alpha asociado (medido 28-jul)"
  bash "$HERE/premultiply.sh" "$dir/$out"
  rm -f "${dir}/${out%.mov}.straight.mov"
  echo ">>> QC de composición: negro | blanco | TU FOOTAGE REAL"
  "$PY" "$HERE/alpha-qc.py" "$dir/$out"
  "$PY" "$HERE/alpha-qc.py" --premult "$dir/$out"
  echo ">>> LISTO $scene — LEE renders/_qc_sheet.png: se juzga sobre el footage, NO sobre negro"
} 2>&1 | tee "$log"

echo "ALPHA: $dir/$out  (log: $log)"
echo "  → mismo filename al re-lockear: CapCut relinkea solo"

node "$HERE/scene-state.mjs" "$PROJECT_DIR" "$scene" --record-output "$dir/$out"
