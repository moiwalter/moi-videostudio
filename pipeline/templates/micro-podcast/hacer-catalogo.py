#!/usr/bin/env python3
"""hacer-catalogo.py — catálogo visual de un episodio: una tarjeta por escena + un clip por transición.
Uso: python3 hacer-catalogo.py <proyecto-episodio> <video-final.mp4> <salida/> [--desfase "129:-0.1,131.8:-1.14"]
Lee edicion/master/BEATS.json (escenas) e index.html (cutT / tkIn / tkOut y comentarios /* ── X ── */).
--desfase: si el video final se recortó en CapCut, a partir de qué segundo del master se corre y cuánto."""
import json, re, subprocess, sys, html, os
from pathlib import Path
P, V, O = Path(sys.argv[1]).expanduser(), Path(sys.argv[2]).expanduser(), Path(sys.argv[3]).expanduser()
DES = []
if "--desfase" in sys.argv:
    DES = sorted((float(a), float(b)) for a, b in (x.split(":") for x in sys.argv[sys.argv.index("--desfase") + 1].split(",")))
def ex(t):
    d = 0
    for a, b in DES:
        if t >= a: d = b
    return max(0, t + d)
M = P / "edicion/master"; B = json.load(open(M / "BEATS.json")); src = (M / "index.html").read_text()
lines = src.splitlines()
(O / "escenas").mkdir(parents=True, exist_ok=True); (O / "transiciones").mkdir(exist_ok=True)
def ff(*a): subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *a], check=True)

# transiciones: de las llamadas reales del timeline
T = []
m = re.search(r"\[\[([\d.,\[\]\s]+)\]\]\s*\.forEach\(function\(c\)\{ cutT", src)
for t, f in re.findall(r"\[([\d.]+),([\d.]+)\]", m.group(0) if m else ""):
    T.append((float(t), "cambio de persona" if float(f) > 1.2 else "corte dentro de la misma persona", f"cutT({t}, {f})"))
for i, l in enumerate(lines):
    for kind, sel, t in re.findall(r"(tkIn|tkOut)\('([^']+)',([\d.]+)\)", l):
        T.append((float(t), ("entra" if kind == "tkIn" else "sale") + f" el takeover {sel}", f"{kind}('{sel}', {t})  · línea {i+1}"))
T.sort()
def linea(t):
    best = None
    for i, l in enumerate(lines):
        if "/* ──" in l and re.search(r"\b(\d+),(\d+)\b", l) and i > 370:
            ts = [float(a + "." + b) for a, b in re.findall(r"(\d+),(\d+)", l)]
            if ts and abs(ts[0] - t) < 2.5 and best is None: best = i + 1
    return best

cards = []
for s in B["beats"]:
    a, b = float(s["start"]), float(s["end"]); mid = ex(a + min(1.6, (b - a) / 2))
    ff("-ss", f"{mid:.2f}", "-i", str(V), "-frames:v", "1", "-vf", "scale=360:-1", "-q:v", "4", str(O / f"escenas/{s['id']}.jpg"))
    cards.append((s, linea(a)))
clips = []
for k, (t, que, code) in enumerate(T):
    a = ex(t) - 0.7
    ff("-ss", f"{max(0,a):.2f}", "-t", "1.6", "-i", str(V), "-vf", "scale=360:-2,fps=30", "-c:v", "libx264", "-crf", "26",
       "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(O / f"transiciones/T{k+1:02d}.mp4"))
    clips.append((k + 1, t, que, code))

e = html.escape
H = ["""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo de escenas</title><style>
:root{--bg:#160021;--card:#24003a;--tx:#eee6e1;--mut:#c9b8d6;--ac:#a43ff1;--pk:#f6cae6}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.45 -apple-system,system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:24px 16px 80px}h1{font-size:28px;margin:0 0 4px}h2{margin:44px 0 6px;font-size:22px}
p.s{color:var(--mut);margin:0 0 18px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.c{background:var(--card);border-radius:14px;overflow:hidden;border:1px solid #3c0058}.c img,.c video{width:100%;display:block;aspect-ratio:9/16;object-fit:cover;background:#000}
.b{padding:12px 14px}.id{color:var(--pk);font-weight:700}.t{color:var(--mut);font-size:13px}.k{font-size:12px;color:var(--mut);margin-top:6px}
.tag{display:inline-block;background:var(--ac);color:#fff;border-radius:99px;padding:1px 9px;font-size:12px;margin:4px 0}
code,pre{font:12px ui-monospace,Menlo,monospace;color:var(--pk)}pre{background:#0e0016;padding:14px;border-radius:10px;overflow:auto}
</style></head><body><main>"""]
H.append(f"<h1>{e(P.name)}</h1><p class=s>{len(cards)} escenas · {len(clips)} transiciones · concepto: {e(B.get('concepto',{}).get('nombre',''))}. "
         "Las imágenes y clips salen del video final. El código vive en <code>edicion/master/index.html</code>.</p>")
H.append("<h2>Transiciones</h2><p class=s>Cada clip son 1,6 s alrededor del momento (en bucle). Cómo se hacen: "
         "<code>cutT(t, f)</code> = zoom con desenfoque sobre la toma justo en el corte (f=1 misma persona, f=1.6 cambio de persona); "
         "<code>tkIn</code>/<code>tkOut</code> = el gráfico a pantalla completa entra/sale con el mismo zoom con desenfoque. "
         "Plantilla: <code>pipeline/docs/templates/transiciones-corte.js</code>.</p><div class=g>")
for n, t, que, code in clips:
    H.append(f"<div class=c><video src='transiciones/T{n:02d}.mp4' autoplay muted loop playsinline></video><div class=b>"
             f"<span class=id>T{n:02d}</span> · {t:.2f} s<br>{e(que)}<div class=k><code>{e(code)}</code></div></div></div>")
H.append("</div><h2>Escenas</h2><p class=s>Del mapa (<code>BEATS.json</code>): postura/formato, cómo se hizo, la palabra que la dispara y cómo entra.</p><div class=g>")
for s, ln in cards:
    tk = "<span class=tag>takeover</span> " if str(s.get("takeover")) == "True" else ""
    H.append(f"<div class=c><img src='escenas/{s['id']}.jpg' loading=lazy><div class=b><span class=id>{s['id']}</span> · {float(s['start']):.2f}–{float(s['end']):.2f} s<br>"
             f"{tk}<b>{e(s.get('postura',''))}</b><div class=t>«{e(s.get('words','')[:90])}…»</div>"
             f"<div class=k>{e(s.get('tratamiento',''))}</div><div class=k>Ancla: {e(s.get('acento',''))}</div>"
             f"<div class=k>Entra: {e(s.get('transicion_entrada',''))}{' · código línea '+str(ln) if ln else ''}</div></div></div>")
tpl = (Path(__file__).parent.parent / "transiciones-corte.js")
H.append("</div><h2>El código de las transiciones</h2><pre>" + e(tpl.read_text() if tpl.exists() else "") + "</pre></main></body></html>")
(O / "index.html").write_text("\n".join(H))
print(f"✅ {O/'index.html'} · {len(cards)} escenas · {len(clips)} transiciones")
