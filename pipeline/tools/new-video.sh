#!/usr/bin/env bash
# new-video.sh — scaffold de un talking-head. Crea lo MÍNIMO y te pone en el flujo.
#
# Qué YA NO hace (herencia de stacksync-gtm que se sacó el 8-ago-2026):
#   · no crea una escena placeholder "S01-overlay" — chocaba de id con la S01 que genera
#     map-beats, y el match parcial de preview/alpha agarraba la equivocada;
#   · no escribe SCENES.md ni la tabla del KIT_README para llenar a mano — las GENERAN
#     `map-beats.mjs` y `validate-kit.mjs --tabla`;
#   · no crea captions/ ni audio/ (la receta los marca opcionales) — se crean si se piden.
#
#   tools/new-video.sh 2026-08-mi-video                 # marca moi
#   tools/new-video.sh 2026-08-video-cliente --marca cvander
set -euo pipefail

# ⛔ El parseo era POSICIONAL: `[ "${2:-}" = "--marca" ]` sólo veía el argumento 2, así que
#    con dos flags el segundo se ignoraba en silencio. Al agregar --carril había que hacerlo
#    de verdad. Mismo defecto que ya estaba medido en qc-master (FLAGS_CON_VALOR) y map-beats.
SLUG=""; MARCA="moi"; CARRIL="kit"; ENGINE="hyperframes"; STYLE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --engine) ENGINE="${2:?missing engine}"; shift 2 ;;
    --style) STYLE="${2:?missing style}"; shift 2 ;;
    --marca)  MARCA="${2:-moi}"; shift 2 ;;
    --carril) CARRIL="${2:-kit}"; shift 2 ;;
    -*)       echo "✗ flag desconocido: $1" >&2; exit 1 ;;
    *)        [ -z "$SLUG" ] && SLUG="$1" || { echo "✗ dos slugs: '$SLUG' y '$1'" >&2; exit 1; }; shift ;;
  esac
done
[ -n "$SLUG" ] || { echo "uso: tools/new-video.sh <slug> [--marca <marca>] [--carril kit|master]"; exit 1; }
case "$CARRIL" in kit|master) ;; *) echo "✗ carril '$CARRIL' no existe — kit | master" >&2; exit 1 ;; esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(node "$HERE/project.mjs" root)"
DEST="$(node "$HERE/project.mjs" new-path "$SLUG" "$MARCA")"
case "$ENGINE" in hyperframes|remotion) ;; *) echo "Unknown engine: $ENGINE"; exit 1;; esac
if [ "$ENGINE" = remotion ]; then
 [ "$CARRIL" = master ] || { echo "Remotion scaffold currently supports MASTER; select --carril master"; exit 1; }
 exec node "$HERE/scaffold-remotion.mjs" "$SLUG" "$MARCA" "${STYLE:-paper-collage}"
fi
if [ -n "$STYLE" ]; then node "$HERE/style.mjs" "$STYLE" >/dev/null; fi

[ -d "$ROOT/biblioteca/design_system/fonts" ] || { echo "✗ design_system/fonts no encontrado en $ROOT" >&2; exit 1; }
# project.mjs permits only a fresh folder or a declared intake with an empty editor.
[ -f "$ROOT/biblioteca/marcas/$MARCA.json" ] || {
  echo "✗ no existe brands/$MARCA.json" >&2
  echo "  Marcas: $(ls "$ROOT/biblioteca/marcas"/*.json 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/.json//' | tr '\n' ' ')" >&2
  echo "  Para una marca nueva:  node tools/brand.mjs new $MARCA   (las preguntas: brands/INTAKE.md)" >&2
  exit 1
}

mkdir -p "$DEST/local" "$DEST/renders"
cp "$ROOT/biblioteca/marcas/$MARCA.json" "$DEST/brand.json"
node "$HERE/brand.mjs" tokens "$MARCA" > "$DEST/_brand-tokens.css"
# Read by the author at resume; build-master also receives brand.mjs brief directly.
node "$HERE/brand.mjs" brief "$MARCA" > "$DEST/PRODUCTION.md"
cat > "$DEST/CONTEXT.md" <<EOF
# $SLUG — estado vigente

Marca: $MARCA. Carril: $CARRIL. Leer PRODUCTION.md y el START_HERE.md del pipeline.
Último feedback: pendiente de registrar desde la conversación; no volver a preguntar lo ya definido.
Composición: pendiente de completar. Entrega vigente: ninguna.
Estado: proyecto creado; falta fuente/transcript y aplicar la dirección acordada.
Próximo paso: incorporar la fuente y seguir el mapa del episodio.
Excepciones editoriales: ninguna registrada; no copiar tiempos de episodios anteriores.
Historial: guardar aparte; mantener este resumen vigente.
EOF

# ⛔ Hasta el 30-ago-2026 TODO proyecto nacía KIT: scenes/ + clips/ + kit.config.sh, aunque
#    fuera un master. Los cuatro master del repo cargan un scenes/ VACÍO y un kit.config.sh
#    muerto, y validate-kit sobre cualquiera de ellos sale por «scenes/ está vacío».
if [ "$CARRIL" = "kit" ]; then
  mkdir -p "$DEST/scenes" "$DEST/clips"
  cp "$ROOT/pipeline/templates/kit.config.sh" "$DEST/kit.config.sh"
else
  mkdir -p "$DEST/master/renders" "$DEST/master/local"
  node "$HERE/review-video.mjs" "$DEST" --init
  node --input-type=module - "$DEST/master/BRIEF.json" "$MARCA" <<'NODE'
import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], JSON.stringify({
  marca: { slug: process.argv[3], existe: true, web: null },
  direccion: { tiene: null, angulo: null },
  reviewRequired: true
}, null, 2) + '\n');
NODE
  ln -s "$ROOT/biblioteca/design_system" "$DEST/master/design_system"
  # ⛔ Los tokens van DENTRO de master/, no con ../ (30-ago-2026). El server de qc-master sirve
  #    desde master/ como raíz, y el browser normaliza «../» fuera de la raíz: el pedido sale
  #    como /_brand-tokens.css, da 404, y la navegación NUNCA cierra → el gate moría con
  #    «Navigation timeout». Los master reales (tu-carrera, que-es-startup) ya usan _tokens.css
  #    adentro; el esqueleto no.
  node "$HERE/brand.mjs" tokens "$MARCA" > "$DEST/master/_tokens.css"
  # El esqueleto: el CONTRATO en el #frame, el wrapper de cámara con el footage adentro, y
  # el marcador del hook — que hook-textual.mjs necesita para no inyectar a medias.
  cat > "$DEST/master/index.html" <<HTML
<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="_tokens.css">
<style>
  html,body{margin:0;background:#000}
  /* ⛔ TAMAÑO EXPLÍCITO EN LOS CUATRO. Sin width/height el #frame colapsa a 0 y el
     overflow:hidden se come TODO: el DOM mide bien, la composición sale negra. */
  #frame{position:relative;width:1080px;height:1920px;overflow:hidden}
  #cam{position:absolute;inset:0;width:1080px;height:1920px;transform-origin:50% 36%}
  #aroll{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover;display:block}
  /* ⛔ LAS ESCENAS NACEN APAGADAS EN CSS, no con un tl.set en t=0 (lección de tu-carrera):
     un set en la posición 0 es ambiguo al seekear —GSAP puede leerlo como "todavía no
     empezó"— y el CUADRO 0 del render sale con todas las escenas encima. La que arranca
     encendida lo declara inline. */
  .escena{position:absolute;inset:0;width:1080px;height:1920px;pointer-events:none;opacity:0}
</style>
</head><body>

<!-- El encuadre (dónde está la cara, dónde va la banda de subtítulos) sale de la MARCA:
     brands/<marca>.json → qc. No se teclea por video: no cambia entre videos del mismo setup.
     Si este corte fuera la excepción, declarálo acá con data-qc-cara="A,B" y manda sobre la marca. -->
<div id="frame" data-composition-id="main" data-start="0" data-duration="0" data-width="1080" data-height="1920"
     >

  <!-- ⛔ El <video> va MUTED y SIN data-has-audio: los dos juntos se contradicen y el Studio
       silencia todo (hyperframes check: video_muted_with_declared_audio). El sonido entra
       por el <audio id="aroll-audio"> de abajo. Es el patrón de tu-carrera. -->
  <div id="cam"><video id="aroll" class="clip" src="local/cut.mp4" data-start="0" data-duration="0"
       data-track-index="0" muted playsinline></video></div>

  <!-- ⛔ EL AUDIO VA APARTE Y NECESITA id. El <video> del corte va MUTED (pista 0) y su
       sonido entra por este <audio>, en su propia pista. Sin el id sale MUDO EN EL RENDER
       aunque suene en el preview — lo caza \`check\` con media_missing_id, pero sólo si lo
       corrés. Es el mismo src: el elemento de audio lee la pista de sonido del mp4. -->
  <audio id="aroll-audio" class="clip" src="local/cut.mp4" data-start="0" data-duration="0"
         data-track-index="10" data-volume="1"></audio>

  <!-- ESCENAS:INICIO — los divs los sincroniza \`map-beats --emitir\` desde BEATS.json.
       El CONTENIDO de cada escena es tuyo: el emisor NO lo toca, sólo mantiene las
       ventanas (data-start / data-duration) iguales a las del mapa. -->
  <!-- ESCENAS:FIN -->

</div>

<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="design_system/motion.js"></script>
<script>
(function(){
  "use strict";
  var M = window.MOI;
  var tl = gsap.timeline({paused:true, defaults:{duration:0.5, ease:M.ease.settle}});

  /* ── EL CABLEADO — la verdad vive en el DOM, no en una tabla JS ────────────
     Cada escena se prende en su data-start y se apaga cuando arranca la siguiente. Es la
     forma que usan tu-carrera y tecnico (idénticas byte a byte) y la que se eligió como
     canónica: no hay una segunda lista de tiempos que pueda driftar del html.
     · :not([data-qc-capa]) deja afuera las CAPAS (el hook), que conviven a propósito y no
       deben cerrar la escena anterior — sin esto la última escena se cierra en t=0.
     · el takeover recibe 0.32 s de gracia para poder SALIR: si se apaga en el corte exacto,
       corta en vez de transicionar. */
  var SC = Array.prototype.slice.call(document.querySelectorAll('.escena:not([data-qc-capa])'));
  var FIN = parseFloat(document.getElementById('frame').dataset.duration);
  SC.forEach(function (s, i) {
    var st = parseFloat(s.dataset.start);
    var nxt = SC[i + 1] ? parseFloat(SC[i + 1].dataset.start) : FIN;
    var esTk = !!s.querySelector('.tk');
    /* nada de tl.set(opacity:0) en 0: nacen apagadas por CSS (ver el <style>) */
    tl.set(s, { opacity: 1 }, st);
    tl.set(s, { opacity: 0 }, Math.min(FIN, esTk ? nxt + 0.32 : nxt));
  });

  /* CAMARA */

  /* HOOK-TEXTUAL:JS */
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
})();
</script>
</body></html>
HTML
fi

node "$HERE/init-project.mjs" "$DEST" "$MARCA" "$(echo "$CARRIL" | tr '[:lower:]' '[:upper:]')" "$ENGINE" "${STYLE:-}"
node "$HERE/project.mjs" register "$DEST" "$MARCA" >/dev/null
if [ -n "$STYLE" ]; then node "$HERE/brand.mjs" brief "$MARCA" "$STYLE" > "$DEST/PRODUCTION.md"; fi
cat > "$DEST/TRANSCRIPT.md" <<EOF
# TRANSCRIPT — $SLUG

> Transcribí con el CLI (ya viene en HyperFrames, versión en tools/HF_VERSION).
> Son DOS pasos, no uno — \`--to\` sólo exporta desde un transcript que YA existe:
>   npx hyperframes@\$(cat tools/HF_VERSION) transcribe local/<corte>.mp4 -m large-v3 -l <idioma>
>   npx hyperframes@\$(cat tools/HF_VERSION) transcribe local/transcript.json --to srt -o corte.srt
> El paso 1 escribe \`local/transcript.json\` (word-timed). Verificado en 0.7.101 el 16-ago-2026.
>
> ⚠️ **-l ES EL IDIOMA DEL VIDEO, NO 'es' POR DEFECTO.** El default del CLI es small.en; de los
> modelos, sólo large-v3 es multilingüe. Pero pedirle un idioma que NO es el del audio no falla:
> **traduce y alucina.** Un corte en inglés corrido con \`-l es\` devolvió 426 palabras en vez de
> 324, **51 8-gramas repetidos** (uno ×3) y marcas de tiempo de relleno con gap máximo de 0,39 s
> en 102 s de habla. Un mapa de beats sobre eso pone cada overlay en la palabra equivocada **y
> validate-kit da verde**, porque valida contra el transcript, no contra el audio.
>
> ⚠️ **QC OBLIGATORIO ANTES DE MAPEAR BEATS** — son 3 números y se miran siempre:
>   1. 8-gramas repetidos ≈ 0   (>10 = whisper entró en loop)
>   2. la última palabra dice el final REAL del video (whisper suele comerse la frase de cierre)
>   3. la distribución de gaps se parece a cómo habla la persona
> Si la cola se pierde, se re-transcribe SÓLO la cola (\`ffmpeg -ss <t> -c copy\`) y se empalma
> con offset: la pasada corta acierta donde la larga se cansó.
>
> Cualquier re-trim corre TODOS los timings. El transcript manda en todo el sync.
EOF

echo
echo "✓ $DEST   (marca: $MARCA)"
echo
if [ "$CARRIL" = "master" ]; then
echo "  EL FLUJO (carril MASTER — el video sale entero de HyperFrames):"
echo "   1. dejá el corte en $SLUG/local/cut.mp4 y su .srt en $SLUG/"
echo "   2. medí el encuadre y completá data-qc-cara / data-qc-banda en master/index.html"
echo "   3. node tools/map-beats.mjs $SLUG --carril master     ← te PROPONE beats + cámara"
echo "   4. revisalo y después:"
echo "      node tools/map-beats.mjs $SLUG --carril master --aplicar"
echo "   5. decidí lo que la máquina NO puede: tratamiento, assets, takeover y el HOOK"
echo "      node tools/hook-textual.mjs $SLUG --texto \"…\"     ← obligatorio"
echo "   6. node tools/map-beats.mjs $SLUG --check              ← el contrato del mapa"
echo "   7. node tools/qc-master.mjs $SLUG                      ← el gate del carril"
echo
echo "  El paso siguiente te lo dice el flujo, no vos:  node tools/flujo.mjs $SLUG"
echo
exit 0
fi
echo "  EL FLUJO:"
echo "   1. dejá el .srt del corte en $SLUG/"
echo "   2. node tools/map-beats.mjs $SLUG              ← te PROPONE el mapa de beats"
echo "   3. revisalo (juntá, partí, borrá) y después:"
echo "      node tools/map-beats.mjs $SLUG --aplicar     ← crea escenas + symlinks + meta.json"
echo "   4. por escena: construir → tools/preview.sh $SLUG <SNN> → tools/approve.sh $SLUG <SNN>"
echo "   5. tools/lock-all.sh $SLUG                      ← renderiza SOLO lo aprobado"
echo "   6. node tools/validate-kit.mjs $SLUG --tabla    ← el contrato + la tabla del KIT_README"
echo
echo "  Escena suelta:   tools/new-scene.sh $SLUG S07-nombre [--tipo full]"
echo "  Marca del agente: node tools/brand.mjs brief $MARCA"
echo
