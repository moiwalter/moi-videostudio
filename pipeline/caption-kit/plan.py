#!/usr/bin/env python3
"""plan.py — genera el cinematic.json de un corte a partir de su transcripción.

POR QUE EXISTE: el look DOAC no es una plantilla, es un conjunto de reglas
MEDIBLES. Hasta ahora las aplicaba a mano por clip y cada video volvía a pedir
la misma tanda de correcciones. Acá viven como datos (styles/<id>.json) y se
aplican solas.

Las reglas salieron de medir tres shorts de @TheDiaryOfACEOClips (12-ago-2026),
no de recordarlos:

  · 2,3 palabras por línea  ·  1-3 filas en pantalla a la vez
  · bloque alineado a la IZQUIERDA (sus bordes izquierdos coinciden entre líneas
    mucho mejor que sus centros: 227/226 contra centros de 353/531)
  · huecos de tinta 5-18 px, VARIABLES: más apretado entre líneas del mismo
    cuerpo, más aire cuando cambia el tamaño
  · jerarquía tipográfica DENTRO de la frase, no un cuerpo único con color
  · la palabra caliente puede cambiar de FAMILIA, no sólo de cuerpo
  · el color se elige contra EL FONDO DE ESE BEAT, no es fijo

    python3 plan.py <proyecto> --style doac [--em "palabra,palabra"]

Las ventanas donde NO va subtítulo (gráfico/takeover) NO se filtran acá: el
transcript se autoriza VERBATIM y las páginas sobrantes las borra caption.sh.
Filtrar palabras acá rompía el portón de completitud y desfasaba la voz.

Sin --em las palabras calientes se eligen solas por energía del audio
(envelope.json de prepare.sh) — que es donde él realmente puso el énfasis.
"""
import json, re, sys, subprocess, unicodedata
from pathlib import Path

KIT = Path(__file__).resolve().parent
proj = Path(sys.argv[1]).resolve()
def arg(name, default=None):
    return sys.argv[sys.argv.index("--" + name) + 1] if "--" + name in sys.argv else default

S = json.loads((KIT / "styles" / f"{arg('style','doac')}.json").read_text())
words = [w for w in json.loads((proj / "transcript.json").read_text())["words"] if "start" in w]
if not words:
    sys.exit("✗ transcript.json sin word timings — corré prepare.sh primero")


norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode())

# ── 1. palabras calientes ───────────────────────────────────────────────────
# Con --em manda él. Sin --em se eligen por ENERGIA del audio: la palabra que
# grita es la que él marcó al hablar, y eso le gana a cualquier heurística de
# diccionario. Se descartan las funcionales — "para", "donde" nunca son el golpe.
STOP = {"no","que","de","la","el","los","las","un","una","y","o","a","en","con","por","para","su","es","lo","al","si","ni","mas","muy","ya","tu","te","me","se","del","sin","como","donde","cuando","pero","porque"}
em = {norm(x) for x in (arg("em") or "").split(",") if x.strip()}
# El auto-enfasis por energia NO es el default: probado sobre dos tramos eligio
# "importa/llevar" y "cualquier/digas/mismo/todos" — palabras fuertes de volumen
# y vacias de significado. Acierta donde el subio la voz, no cual es la idea.
# Queda como borrador explicito (--auto-em); sin --em el video sale con jerarquia
# base/mid/close, que ya lee bien, y sin ninguna palabra caliente.
if not em and "--auto-em" in sys.argv:
    try:
        env = json.loads((proj / "envelope.json").read_text())
        rms = env.get("rms") or env.get("values") or []
        hz = 1 / env["hop"] if env.get("hop") else (len(rms) / words[-1]["end"] if rms else 0)
        def energy(w):
            a, b = int(w["start"] * hz), max(int(w["end"] * hz), int(w["start"] * hz) + 1)
            seg = rms[a:b]
            return max(seg) if seg else 0
        cand = [w for w in words if norm(w["text"]) not in STOP and len(norm(w["text"])) >= 5]
        cand.sort(key=energy, reverse=True)
        n = max(1, round(len(words) / S["grouping"]["emEvery"]))
        em = {norm(w["text"]) for w in cand[:n]}
    except Exception:
        em = set()

# ── 2. palabras → líneas ────────────────────────────────────────────────────
# --sin NO filtra palabras acá (eso rompía el portón verbatim y desfasaba la
# voz). Sólo marca BORDES donde la línea tiene que cortar, para que ninguna
# página quede a caballo entre "se ve" y "no se ve". Sin esto, la página que
# cruzaba el borde había que borrarla entera y se perdía diálogo dicho fuera
# del gráfico: "y sobre todo en las startups" se cortaba al medio (17-ago).
BORDES = sorted({t for r in (arg("sin") or "").split(",") if r.count("-") == 1
                 for t in (float(r.split("-")[0]), float(r.split("-")[1]))})
lado = lambda t: sum(1 for x in BORDES if t >= x)

G = S["grouping"]
lines, cur = [], None
for i, w in enumerate(words):
    gap = w["start"] - words[i - 1]["end"] if i else 0
    hot = norm(w["text"]) in em
    cruce = bool(i) and lado(words[i - 1]["end"]) != lado(w["start"])
    # una palabra caliente SIEMPRE va sola en su línea: es lo que le deja cambiar
    # de cuerpo y de familia sin arrastrar a las vecinas
    # La PUNTUACION corta linea, no solo la pausa. Sin esto salio
    # "solo mandas tu / curriculum y ya. Y" — una linea con el final de una frase
    # Y el arranque de la siguiente adentro. El silencio no siempre marca el punto:
    # el habla corrida encadena oraciones con 0,1 s de aire.
    prev = words[i - 1] if i else None
    punct = bool(prev) and (bool(re.search(r"[.!?]$", prev["text"]))
                            or (bool(re.search(r"[,;:]$", prev["text"])) and cur and len(cur["w"]) >= 2))
    if cur is None or hot or cur["hot"] or punct or cruce or gap > G["pauseBreak"] \
       or len(cur["w"]) >= G["maxWords"] or len(" ".join(x["text"] for x in cur["w"] + [w])) > G["maxChars"]:
        cur = {"w": [], "hot": hot}
        lines.append(cur)
    cur["w"].append(w)
    cur["hot"] = cur["hot"] or hot

# ── 2b. dos reglas de composición que el agrupamiento por conteo no sabe ─────
# (1) Una línea no termina en palabra funcional. "trabajes para ser" corta la
#     frase en el peor lugar: la preposición pertenece a lo que viene, y el ojo
#     la lee como final. Se empuja a la línea siguiente.
# (2) Una línea de UNA palabra sólo se justifica si esa palabra es el golpe.
#     "más" sola no es un beat, es un huérfano.
def joinable(a, b):
    """a y b son palabras consecutivas: ¿se pueden poner en la misma línea?
    NO si entre ellas hay una pausa o un signo — ahí termina una idea, y unirlas
    hace que una página cruce el punto ('ahí, / necesitas tener' es un error de
    lectura, no de tipografía)."""
    if lado(a["end"]) != lado(b["start"]):
        return False          # un borde de --sin no se cruza ni fusionando líneas
    return b["start"] - a["end"] <= G.get("clauseGap", 0.45) and not re.search(r"[.,;:!?]$", a["text"])

for _ in range(4):
    moved = False
    for i, ln in enumerate(lines[:-1]):
        nxt = lines[i + 1]
        if len(ln["w"]) > 1 and not ln["hot"] and not nxt["hot"] \
           and joinable(ln["w"][-1], nxt["w"][0]) \
           and norm(ln["w"][-1]["text"]) in STOP \
           and len(nxt["w"]) < G["maxWords"] \
           and len(" ".join(x["text"] for x in [ln["w"][-1]] + nxt["w"])) <= G["maxChars"]:
            nxt["w"].insert(0, ln["w"].pop()); moved = True
    for i, ln in enumerate(lines):
        if len(ln["w"]) == 1 and not ln["hot"]:
            for j in (i + 1, i - 1):                       # intenta fundir adelante, si no atrás
                if 0 <= j < len(lines) and not lines[j]["hot"] \
                   and (joinable(ln["w"][-1], lines[j]["w"][0]) if j > i
                        else joinable(lines[j]["w"][-1], ln["w"][0])) \
                   and len(lines[j]["w"]) + 1 <= G["maxWords"] \
                   and len(" ".join(x["text"] for x in ln["w"] + lines[j]["w"])) <= G["maxChars"]:
                    if j > i: lines[j]["w"].insert(0, ln["w"][0])
                    else:     lines[j]["w"].append(ln["w"][0])
                    lines.pop(i); moved = True
                    break
            if moved: break
    if not moved:
        break

# ── 3. líneas → páginas ─────────────────────────────────────────────────────
# Techo duro de filas: medido, DOAC muestra 1-3 a la vez. Acumular la frase
# entera es lo que la hace leer como párrafo en vez de golpes.
pages, pg = [], None
for i, ln in enumerate(lines):
    brk = pg is None or len(pg) >= G["maxRows"]
    if not brk and i:
        prev = lines[i - 1]["w"][-1]
        # El punto da vuelta la página, siempre. Una página que arranca con el
        # final de una frase y sigue con el principio de la siguiente pone dos
        # ideas en el mismo golpe de lectura.
        brk = (bool(re.search(r"[.!?]$", prev["text"])) or ln["w"][0]["start"] - prev["end"] > G["pageBreak"]
               or lado(prev["end"]) != lado(ln["w"][0]["start"]))
    if brk:
        pg = []
        pages.append(pg)
    pg.append(ln)

# ── 3b. ninguna línea entra justo antes de que la página se dé vuelta ───────
# Una línea que aparece y 0,35 s después se va con toda la página no se lee: no
# es un beat, es un parpadeo. Si la última línea de una página nace demasiado
# cerca del flip, pertenece a la página SIGUIENTE.
MIN_SHOW = G.get("minShow", 0.5)
for _ in range(6):
    moved = False
    for pi in range(len(pages) - 1):
        pg, nxt = pages[pi], pages[pi + 1]
        if len(pg) < 2 or len(nxt) >= G["maxRows"]:
            continue
        # Una línea que CIERRA una idea no se mueve aunque viva poco: el lector
        # viene leyendo esa página desde antes, y empujarla adelante mete el
        # punto en medio de la página siguiente.
        if re.search(r"[.,;:!?]$", pg[-1]["w"][-1]["text"]):
            continue
        page_end = nxt[0]["w"][0]["start"]
        if page_end - pg[-1]["w"][0]["start"] < MIN_SHOW:
            nxt.insert(0, pg.pop()); moved = True; break
    if not moved:
        break
pages = [p for p in pages if p]

# ── 4. jerarquía y tono por línea ───────────────────────────────────────────
T, tones = S["tiers"], S["tones"]
def tier_of(ln, li, page, last_page):
    if ln["hot"]:
        return "close" if (last_page and ln is page[-1]) else "hit"
    if last_page and ln is page[-1]:
        return "close"
    return "mid" if (li > 0 and not any(x["hot"] for x in page)) else "base"

# ── 5. color del golpe: contra EL FONDO DE ESE BEAT ─────────────────────────
# Un naranja fijo canta sobre el librero oscuro y se apaga sobre la camiseta
# blanca. Se mide la luma real donde va a caer el texto, en ese segundo.
src = next((p for p in [proj / "source.mp4"] + list(proj.glob("*.mp4")) if p.exists()), None)
plane = S["layout"]["plane"]
py = float(re.search(r"top:\s*([\d.]+)%", plane).group(1)) / 100
ph = float(re.search(r"height:\s*([\d.]+)%", plane).group(1)) / 100
def luma_at(t):
    if not src:
        return 0
    try:
        out = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", f"{max(0,t):.2f}", "-i", str(src), "-frames:v", "1",
             "-vf", f"crop=iw:ih*{ph:.3f}:0:ih*{py:.3f},scale=1:1,format=gray", "-f", "rawvideo", "-"],
            capture_output=True, timeout=25)
        return out.stdout[0] if out.stdout else 0
    except Exception:
        return 0

# ── 6. emitir ───────────────────────────────────────────────────────────────
def css(tier, hot_color=None):
    d = T[tier]
    parts = [f"font-size: calc({d['size']}*var(--h))", f"font-weight:{d['weight']}",
             f"letter-spacing:{d['tracking']}", f"color:{hot_color or S['color']['fg']}"]
    if d.get("family"):
        parts.insert(0, f"font-family:{d['family']}")
    if d.get("upper"):
        parts.append("text-transform:uppercase")
    return "; ".join(parts) + f"; text-shadow: {S['shadow']};"

blocks, ti = [], 0
for pi, page in enumerate(pages):
    last = pi == len(pages) - 1
    out_lines = []
    for li, ln in enumerate(page):
        tier = tier_of(ln, li, page, last)
        color = None
        if tier in ("hit", "close") and ln["hot"]:
            L = luma_at(ln["w"][0]["start"] + 0.15)
            color = S["color"]["hitBright"] if L > S["color"]["lumaSplit"] else S["color"]["hitDark"]
        entry = {"words": [w["text"] for w in ln["w"]], "css": css(tier, color)}
        if T[tier].get("upper"):
            entry["text"] = " ".join(w["text"] for w in ln["w"]).upper().rstrip(".,")
        entry["tone"] = "impact" if tier in ("hit", "close") else tones[ti % len(tones)]
        ti += 1
        out_lines.append(entry)
    blocks.append({"plane": "narr", "flip": True, "lines": out_lines})

doc = {"dna": S["dna"], "caption_layer": "fg", "width": 1080, "height": 1920, "fps": 30,
       "planes": {"narr": plane}, "tones": {"default": "soft", "hero": "present"},
       "_generado": f"plan.py --style {S['id']} · reglas medidas en {S['note'][:80]}…",
       "blocks": blocks}
(proj / "cinematic.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")

wpl = sum(len(l["w"]) for l in lines) / len(lines)
print(f"  {len(words)} palabras → {len(lines)} líneas ({wpl:.1f}/línea) → {len(pages)} páginas de ≤{G['maxRows']}")
print(f"  calientes: {', '.join(sorted(em)) or '(ninguna — pasá --em para marcarlas)'}")
for b in blocks:
    print("   · " + "  /  ".join(" ".join(l["words"]) for l in b["lines"]))
