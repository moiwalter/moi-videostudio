#!/usr/bin/env bash
# alpha.sh — exporta los subtítulos SOLOS, sobre transparencia, para CapCut.
#
#   bash alpha.sh <proyecto>
#
# El final.mp4 del skill trae el video QUEMADO: sirve para juzgar, no para montar.
# Esto renderiza la misma composición con el a-roll apagado → ProRes 4444 con alpha.
#
# ⛔ CapCut compone el 4444 asumiendo alpha ASOCIADO (premultiplicado) y HyperFrames
#    renderiza STRAIGHT. Sin premultiplicar, cada píxel de alpha parcial se SUMA en
#    vez de mezclarse y revienta a blanco: los bordes del texto salen con nube.
#    Por eso pasa por premultiply.sh de video-edit — y por eso se juzga sobre el
#    footage real, nunca sobre negro (el negro esconde el bug por definición).
set -euo pipefail
PROJ="$(cd "$1" && pwd)"
VE="$HOME/Movies/VideoStudio/pipeline/tools"
export HYPERFRAMES_ROOT="$HOME/.hyperframes"
CLI="$HYPERFRAMES_ROOT/packages/cli/dist/cli.js"
PY="${PY:-/Library/Frameworks/Python.framework/Versions/3.13/bin/python3}"

[ -f "$PROJ/index.html" ] || { echo "✗ no hay index.html — corré caption.sh primero"; exit 1; }

python3 - "$PROJ" <<'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
s = (p / "index.html").read_text()
# fondo transparente en vez de negro
s = re.sub(r"(html,\s*body\s*\{[^}]*?)background:\s*#000;?", r"\1background: transparent;", s, count=1)
# el a-roll se apaga con opacity, NO con display:none: el productor inyecta los
# frames por getElementById y un elemento sin caja lo deja sin dónde escribir.
s = s.replace("#a-roll { position: absolute;", "#a-roll { opacity: 0; position: absolute;", 1)
# fuera el audio: un overlay con pista de sonido se duplica en CapCut
s = re.sub(r"<audio\b[^>]*></audio>", "", s)
s = re.sub(r"<audio\b[^>]*/?>", "", s)
(p / "index_alpha.html").write_text(s)
print("  index_alpha.html · fondo transparente · a-roll apagado · sin audio")
PY

OUT="$(basename "$PROJ")_ALPHA.mov"
( cd "$PROJ" && node "$CLI" render -c index_alpha.html --format mov -f 30 -o "$OUT" 2>&1 | tail -3 )
ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt,width,height -of csv=p=0 "$PROJ/$OUT"

if [ -f "$VE/premultiply.sh" ]; then
  bash "$VE/premultiply.sh" "$PROJ/$OUT"
  rm -f "$PROJ/${OUT%.mov}.straight.mov"
else
  echo "⚠ premultiply.sh no encontrado — el .mov queda STRAIGHT y CapCut le va a poner nube blanca"
fi

# QC sobre el footage real, no sobre negro
[ -f "$PROJ/local/qc-plate.png" ] || { mkdir -p "$PROJ/local"; ffmpeg -y -loglevel error -ss 3 -i "$PROJ/source.mp4" -frames:v 1 "$PROJ/local/qc-plate.png"; }
[ -f "$VE/alpha-qc.py" ] && "$PY" "$VE/alpha-qc.py" "$PROJ/$OUT" 2>/dev/null | tail -6 || true
echo "OVERLAY → $PROJ/$OUT"
