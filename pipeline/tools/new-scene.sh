#!/usr/bin/env bash
# new-scene.sh — agrega UNA escena a un video, con su symlink ya resuelto.
#
# POR QUÉ: new-video.sh creaba una sola escena y después te decía "cada escena NUEVA necesita
# su link: ln -s ../../../design_system". Con 20 escenas por video eso eran 20 pasos manuales,
# y un symlink olvidado = fuentes 404 = escena fea que además pasa el lint.
#
#   tools/new-scene.sh mi-video S07-numero
#   tools/new-scene.sh mi-video S07-numero --tipo full     # escena que TAPA el talking head
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(node "$HERE/project.mjs" root)"
DS_REL="../../../design_system"

[ $# -ge 2 ] || { echo "uso: tools/new-scene.sh <slug> <SNN-nombre> [--tipo alpha|full]"; exit 1; }
PROJECT_DIR="$(node "$HERE/project.mjs" resolve "$1")"
slug="$(basename "$PROJECT_DIR")"; scene="$2"; TIPO="alpha"
[ "${3:-}" = "--tipo" ] && TIPO="${4:-alpha}"

dir="$PROJECT_DIR/scenes/$scene"
[ -e "$dir" ] && { echo "✗ $slug/scenes/$scene ya existe — no lo piso"; exit 1; }

mkdir -p "$dir/renders"
ln -s "$ROOT/biblioteca/design_system" "$dir/design_system"
[ -e "$dir/design_system/fonts" ] || { echo "✗ el symlink design_system NO resuelve — revisá el layout" >&2; exit 1; }

# assets: por-video por default (screenshots, logos puntuales de ESE video).
# La biblioteca COMPARTIDA de logos reusables es video-edit/assets → --compartido.
# (Antes esto no lo creaba nadie y cada escena pedía un `ln -s` a mano, el mismo
#  problema que ya tenía design_system: un link olvidado = imagen que no carga.)
COMPARTIDO=0; for a in "$@"; do [ "$a" = "--compartido" ] && COMPARTIDO=1; done
if [ $COMPARTIDO -eq 1 ]; then
  ln -s "$ROOT/biblioteca/recursos-compartidos" "$dir/assets"
  echo "  assets → biblioteca COMPARTIDA (video-edit/assets)"
else
  mkdir -p "$PROJECT_DIR/local/assets"
  ln -s "../../local/assets" "$dir/assets"
  echo "  assets → $slug/local/assets (de este video)"
fi
[ -e "$dir/assets" ] || { echo "✗ el symlink assets NO resuelve" >&2; exit 1; }

brand="moi"
[ -f "$PROJECT_DIR/brand.json" ] && brand=$(python3 -c "import json;print(json.load(open('$PROJECT_DIR/brand.json'))['name'])" 2>/dev/null || echo moi)

id="${scene%%-*}"; name="${scene#*-}"
cat > "$dir/meta.json" <<EOF
{
  "id": "$id",
  "name": "$name",
  "brand": "$brand",
  "type": "$TIPO",
  "timing": { "fps": 30, "durationFrames": 150 },
  "beat": { "label": "", "words": "frase VERBATIM del transcript", "start": null, "end": null, "money": false },
  "place": null,
  "zone": null,
  "seam": null,
  "approved": false
}
EOF

# index.html desde la plantilla, con los tokens de la marca YA inyectados.
# Antes esto no existía y cada escena arrancaba de un copiar-pegar de otra — que es
# exactamente cómo se propagó la marca soldada y las sombras negras horneadas.
if [ -f "$ROOT/pipeline/templates/scene.index.html" ]; then
  TOKENS_CSS="$(node "$HERE/brand.mjs" tokens "$brand")" \
  python3 - "$ROOT/pipeline/templates/scene.index.html" "$dir/index.html" "$scene" "$id" <<'PY'
import sys, os
tpl, out, scene, sid = sys.argv[1:5]
s = open(tpl).read()
s = s.replace("/* __BRAND_TOKENS__ */", os.environ["TOKENS_CSS"])
s = s.replace("__SCENE__", scene).replace("__LABEL__", "ETIQUETA DEL BEAT").replace("__DURATION__", "5.0")
open(out, "w").write(s)
PY
  echo "  index.html desde plantilla, tokens de '$brand' inyectados (data-duration 5.0 — ajustalo al beat)"
fi

echo "✓ $slug/scenes/$scene  (tipo: $TIPO · marca: $brand · symlink resuelve)"
echo "  preview:  tools/preview.sh $1 $id      aprobar:  tools/approve.sh $1 $id"
