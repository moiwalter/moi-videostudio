#!/usr/bin/env bash
# assemble-ref.sh — comp de REFERENCIA opcional de un talking-head Moi (preview, no entregable).
# El entregable real son las CAPAS del kit (ver TALKING_HEAD.md + KIT_README.md del video);
# esto es solo para previsualizar la colocación. GENÉRICO: todo valor por-video vive en
# <slug>/kit.config.sh — el próximo video reusa este script sin tocarlo.
#
#   tools/assemble-ref.sh mi-video        # match parcial de slug OK
#
# Sin música, sin scrim (reglas Moi). Solo footage + overlays alpha (+ captions si hay).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(node "$HERE/project.mjs" root)"
FONTS="$ROOT/biblioteca/design_system/fonts"
FF="${FF:-ffmpeg}"

[ $# -ge 1 ] || { echo "uso: tools/assemble-ref.sh <slug>   (lee <slug>/kit.config.sh)"; exit 1; }
PROJ="$(node "$HERE/project.mjs" resolve "$1")"; SLUG="$(basename "$PROJ")"
cd "$PROJ"
[ -f kit.config.sh ] || { echo "✗ no hay kit.config.sh en $SLUG — copia templates/kit.config.sh y llénalo"; exit 1; }
# shellcheck disable=SC1091
source kit.config.sh
[ -n "${SRC:-}" ] && [ -n "${END:-}" ] || { echo "✗ kit.config.sh necesita SRC y END"; exit 1; }
[ "${#OVERLAYS[@]}" -ge 1 ] || { echo "✗ kit.config.sh necesita al menos un overlay en OVERLAYS"; exit 1; }

mkdir -p renders
args=(-i "$SRC")
filters="[0:v]setsar=1,trim=0:${END},setpts=PTS-STARTPTS[v0];"
cur="v0"; idx=1
for spec in "${OVERLAYS[@]}"; do
  path="${spec%%|*}"; start="${spec##*|}"
  [ -f "$path" ] || { echo "✗ overlay no existe: $path"; exit 1; }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$path")
  endt=$(echo "$start + $dur" | bc)
  args+=(-i "$path")
  filters+="[${idx}:v]setpts=PTS-STARTPTS+${start}/TB[ov${idx}];"
  filters+="[${cur}][ov${idx}]overlay=0:0:eof_action=pass:enable='between(t,${start},${endt})'[v${idx}];"
  cur="v${idx}"; idx=$((idx+1))
done
if [ -n "${CAP:-}" ]; then
  filters+="[${cur}]subtitles=${CAP}:fontsdir=${FONTS}[vcap];"
  cur="vcap"
fi
afade_st=$(echo "$END - 0.3" | bc)
filters+="[0:a]atrim=0:${END},asetpts=N/SR/TB,afade=t=out:st=${afade_st}:d=0.3[a]"

echo "ref comp: footage + ${#OVERLAYS[@]} overlays$([ -n "${CAP:-}" ] && echo ' + captions')  (sin música, sin scrim)"
$FF -y -loglevel error -stats "${args[@]}" \
  -filter_complex "$filters" \
  -map "[$cur]" -map "[a]" -r 30 -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 256k \
  -movflags +faststart "renders/${SLUG}_ref_1080p30.mp4"

echo "✓ comp de referencia → renders/${SLUG}_ref_1080p30.mp4"
echo "  (preview — el entregable real son las capas del kit; ver KIT_README.md)"
