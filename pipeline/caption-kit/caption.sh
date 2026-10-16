#!/usr/bin/env bash
# caption.sh — de un corte a subtítulos, en un comando.
#
#   bash caption.sh <corte.mp4> <proyecto> [--style doac] [--em "palabra,palabra"]
#   bash caption.sh --re <proyecto> [--style doac]        # re-planificar sin rehacer el matte
#
# El matte (u2net, CPU) son minutos por cada 10 s de clip: se corre UNA vez por
# corte y después se re-planifica gratis. Por eso --re existe.
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SK="$HOME/.claude/skills/embedded-captions/scripts"
export HYPERFRAMES_ROOT="$HOME/.hyperframes"
CLI="$HYPERFRAMES_ROOT/packages/cli/dist/cli.js"

if [ "${1:-}" = "--re" ]; then PROJ="$(cd "$2" && pwd)"; shift 2; else
  CUT="$1"; PROJ="$2"; shift 2
  mkdir -p "$PROJ"; PROJ="$(cd "$PROJ" && pwd)"
  [ -f "$PROJ/source.mp4" ] || cp "$CUT" "$PROJ/source.mp4"
  # ⚠ keyframes espaciados hacen que el Studio tarde y el scrub salte. Se normaliza acá.
  if [ "$(ffprobe -v error -select_streams v -show_entries packet=flags -of csv=p=0 "$PROJ/source.mp4" | grep -c '^K' || true)" -lt 5 ]; then
    ffmpeg -y -v error -i "$PROJ/source.mp4" -c:v libx264 -r 30 -g 30 -keyint_min 30 \
           -movflags +faststart -c:a copy "$PROJ/_norm.mp4" && mv "$PROJ/_norm.mp4" "$PROJ/source.mp4"
    echo "  corte normalizado a keyframes cada 1 s"
  fi
  STYLE0="$( [ "${1:-}" = "--style" ] && echo "$2" || echo doac )"
  MATTE=$(python3 -c "import json;print(json.load(open('$KIT/styles/$STYLE0.json')).get('needsMatte',True))")
  if [ "$MATTE" = "True" ]; then
    echo "── matte + transcripción (una sola vez por corte)"
    bash "$SK/prepare.sh" "$PROJ" >/dev/null 2>&1 || { echo "✗ prepare falló — mirá $PROJ/_prepare_*.log"; exit 1; }
  else
    # ⚡ Sin matte. En modo fg global el render usa SOLO bg_plus_caps.mp4 y nunca
    #    toca frames_fg — el matte (5-20 min de u2net en CPU por clip) es costo puro.
    echo "── transcripción + envolvente (sin matte: este estilo no lo usa)"
    node "$SK/transcribe.cjs" "$PROJ" > "$PROJ/_prepare_transcribe.log" 2>&1 &  T=$!
    node "$SK/audio-envelope.cjs" "$PROJ" > "$PROJ/_prepare_envelope.log" 2>&1 & E=$!
    wait $T || { echo "✗ transcripción falló — mirá $PROJ/_prepare_transcribe.log"; exit 1; }
    wait $E || true
  fi
fi

STYLE="$( [ "${1:-}" = "--style" ] && echo "$2" || echo doac )"
echo "── plan"
python3 "$KIT/plan.py" "$PROJ" "$@"

echo "── compilar"
# ⛔ 17-ago: esto era `... | grep -E "..." || true`, y ese `|| true` se tragaba un
#    fallo DURO. make-cinematic murió con VERBATIM VIOLATION, nadie lo vio, y el
#    plan.json ANTERIOR quedó en pie: el Studio mostraba subtítulos que ya no
#    correspondían al plan, y cada re-planificación parecía no tener efecto.
#    Un compilador que falla tiene que gritar y ABORTAR — si no, se sigue
#    trabajando sobre un artefacto viejo sin un solo error a la vista.
MCLOG="$PROJ/_make-cinematic.log"
if ! ( cd "$PROJ" && node "$SK/make-cinematic.cjs" . > "$MCLOG" 2>&1 ); then
  echo "✗ make-cinematic FALLÓ — plan.json quedó como estaba (NO se re-planificó):"
  grep -aoE "VERBATIM VIOLATION[^\"]{0,200}|\[make-cinematic\] .*" "$MCLOG" | head -3 | sed 's/^/   /'
  echo "   log completo: $MCLOG"
  exit 1
fi
grep -E "block\(s\)|⚠" "$MCLOG" || true

# ⛔ El paso que no se puede saltar: apenas existe index_fg.html, render-and-composite
#    fuerza el modo HÍBRIDO (blend=screen) e IGNORA caption_layer — ahí el color se lava.
# ⚠️ sin ${!i} ni cadenas && acá: con `set -e` una comparación que falla mata el
#    subshell y SINARG salía VACÍO en silencio — el clamp no corría y parecía que
#    la ventana no se respetaba.
SINARG=""; _prev=""
for _a in "$@"; do
  if [ "$_prev" = "--sin" ]; then SINARG="$_a"; break; fi
  _prev="$_a"
done
python3 - "$PROJ" "${SINARG:-}" <<'PY'
import json, sys
p = sys.argv[1] + "/plan.json"; d = json.load(open(p))
for g in d.get("groups", []): g.pop("layer", None)
if (d.get("crown_group") or {}).get("layer"): d["crown_group"].pop("layer")
d["caption_layer"] = "fg"

# ── --sin: dónde NO va subtítulo porque la pantalla ya es gráfico o takeover ──
# ⛔ SE BORRA LA PÁGINA ENTERA, NO SE RECORTA.
# Primer intento (17-ago): filtrar las palabras en plan.py y recortar los bordes
# de las páginas. Dos portones del kit lo mataron, y los dos tenían razón:
#   · make-cinematic exige VERBATIM — toda palabra del transcript autorizada.
#   · check-timing --strict exige ≤80 ms entre la palabra y su página. Recortar
#     un borde desfasa: una página quedó 1,98 s TARDE respecto de la voz.
# Un subtítulo desincronizado es peor que un subtítulo ausente. Así que el
# transcript se autoriza entero y acá se borran las páginas que caen sobre la
# ventana, con sus tiempos intactos. Borrar no desfasa nada.
SIN = []
for r in (sys.argv[2] if len(sys.argv) > 2 else "").split(","):
    q = r.split("-")
    if len(q) == 2:
        try: SIN.append((float(q[0]), float(q[1])))
        except ValueError: pass
if SIN:
    # ⛔ Decide la VOZ, no la caja de la página.
    # Primera versión: borrar toda página que solapara la ventana. Se llevó
    # puesta "y sobre todo en las startups" —dicha ENTERA antes del gráfico—
    # sólo porque la página se estiraba 0,3 s adentro. Perder una línea de
    # diálogo por 0,3 s de cola es un mal negocio.
    #   · la voz empieza dentro de la ventana → se borra (ahí manda el gráfico)
    #   · la voz termina antes de la ventana  → se QUEDA, y la página se cierra
    #     en el borde: no se clipea ninguna palabra, así que check-timing pasa
    #   · la voz cruza el borde → se borra (partirla clipearía una palabra)
    def voz(g):
        ws = g.get("words") or []
        return (min(w["start"] for w in ws), max(w["end"] for w in ws)) if ws else (g.get("in", 0), g.get("out", 0))
    borrar, cerradas = [], 0
    for g in d.get("groups", []):
        for a, b in SIN:
            if min(g.get("out", 0), b) - max(g.get("in", 0), a) <= 0.05: continue
            v0, v1 = voz(g)
            if a <= v0 < b or (v0 < a < v1):
                borrar.append(id(g)); break
            if v1 <= a + 0.05 and g.get("out", 0) > a:
                g["out"] = round(a, 3); cerradas += 1
    antes = len(d.get("groups", []))
    d["groups"] = [g for g in d.get("groups", []) if id(g) not in borrar]
    print(f"  --sin: {antes - len(d['groups'])} de {antes} páginas borradas (la voz cae sobre el gráfico) · "
          f"{cerradas} cerradas en el borde · quedan {len(d['groups'])}")
json.dump(d, open(p, "w"), ensure_ascii=False, indent=1)
PY
rm -f "$PROJ/index_fg.html" "$PROJ/fg_caps.mp4"

LEAD=$(python3 -c "import json,sys;s=json.load(open('$KIT/styles/$STYLE.json'))['leading'];print(s['same'],s['jump'])")
python3 "$KIT/tighten.py" "$PROJ" $LEAD
( cd "$PROJ" && node "$SK/make-composition.cjs" . >/dev/null 2>&1 )

PORT="${PORT:-3020}"
node "$CLI" preview "$PROJ" --port "$PORT" --background --no-open >/dev/null 2>&1 || true
echo "── Studio: http://localhost:$PORT   ·   render: bash $SK/render-and-composite.sh $PROJ"
