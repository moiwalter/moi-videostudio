#!/usr/bin/env bash
# final.sh — render FINAL de UNA escena full-frame lockeada (opaca: hook, cutaway, insert).
# Renderiza NATIVO 1080×1920 (SS=1 por defecto). El 4K es opt-in con SS=2. Backgroundable.
#
#   tools/final.sh mi-video S00              # foreground
#   tools/final.sh mi-video S00 &            # background
#
# Output: scenes/<escena>/renders/<escena>_1080x1920.mp4
# Log:    tail -f /tmp/final_<slug>__<escena>.log
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(node "$HERE/project.mjs" root)"
# La versión vive en tools/HF_VERSION (una sola fuente). Override: HF_VER=x.y.z
HF_VER="${HF_VER:-$(cat "$HERE/HF_VERSION" 2>/dev/null || echo 0.8.214)}"
HF="npx --yes hyperframes@$HF_VER"

[ $# -ge 2 ] || { echo "uso: tools/final.sh <slug> <escena>"; exit 1; }
PROJECT_DIR="$(node "$HERE/project.mjs" resolve "$1")"
slug="$(basename "$PROJECT_DIR")"
scene="$(node "$HERE/project.mjs" scene "$PROJECT_DIR" "$2")"; dir="$PROJECT_DIR/scenes/$scene"
HF_VER="$(node "$HERE/project.mjs" version "$PROJECT_DIR")"
HF="npx --yes hyperframes@$HF_VER"
node "$HERE/preflight.mjs" "$PROJECT_DIR" --lane KIT --scene "$scene"
fps="${3:-30}"          # Moi = 30fps
log="/tmp/final_${slug}__${scene}.log"

[ -f "$dir/index.html" ] || { echo "✗ $scene no tiene index.html (escena footage — va en CapCut, no aquí)"; exit 1; }

# Default = vertical 9:16. Overrides para casos raros:
#   HF_RES4K=landscape-4k HF_DOWNSCALE=1920:1080 tools/final.sh <slug> <escena>

# ── RESOLUCIÓN: NATIVO por default · SS=2 = supersampling opt-in
#
# El 4K venía heredado de stacksync-gtm, donde la cámara hace push-in sobre UI de producto y
# supersamplear PAGA de verdad. Moi tiene regla dura de CERO camera movement: renderizar
# 2160×3840 para entregar 1080×1920 son 4× los píxeles por frame a cambio de un poco de
# antialias en hairlines y texto chico — casi invisible después de que TikTok re-comprime.
#
# Si una escena tiene líneas de 1px o texto muy chico y se ve dura:
#   SS=2 tools/final.sh <slug> <escena>
# Comparalas en el navegador antes de decidir. Es la única forma honesta de saber si se nota.
SS="${SS:-1}"
OUT="renders/${scene}_1080x1920.mp4"

{
  echo ">>> [$slug/$scene] lint"
  ( cd "$dir" && $HF lint )
  if [ "$SS" = "2" ]; then
    echo ">>> [$slug/$scene] RENDER 2× ${fps}fps (supersampling opt-in) → downscale lanczos"
    ( cd "$dir" && $HF render --resolution "${HF_RES4K:-portrait-4k}" --video-bitrate 60M --quality high -f "$fps" -o "renders/_ss2.mp4" )
    ffmpeg -y -loglevel error -i "$dir/renders/_ss2.mp4" \
      -vf "scale=${HF_DOWNSCALE:-1080:1920}:flags=lanczos" -c:v libx264 -b:v 40M -pix_fmt yuv420p -an "$dir/$OUT"
    rm -f "$dir/renders/_ss2.mp4"
  else
    echo ">>> [$slug/$scene] RENDER nativo 1080×1920 ${fps}fps (4× menos píxeles que el 4K heredado)"
    ( cd "$dir" && $HF render --video-bitrate 40M --quality high -f "$fps" -o "$OUT" )
  fi
  echo ">>> LISTO $scene"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height,nb_frames -of csv=p=0 "$dir/$OUT"
} 2>&1 | tee "$log"

echo "FINAL: $dir/$OUT  (log: $log)"
echo "  → si va al kit, copia/linkea a $ROOT/$slug/clips/ con nombre ESTABLE"

node "$HERE/scene-state.mjs" "$PROJECT_DIR" "$scene" --record-output "$dir/$OUT"
