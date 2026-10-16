#!/usr/bin/env python3
"""tighten.py — reescribe el interlineado de un plan.json de embedded-captions.

POR QUE EXISTE: el compilador apila con
    top += alto_de_caja + max(12, frac*H*0.38)
y la caja YA trae line-height 1.12. Medido sobre el corte: para un cuerpo de 73 px
la caja aporta ~41 px de aire propio ANTES de sumar el hueco. Resultado: 43-66 px
de tinta a tinta. Medido sobre DOAC: 5-18 px. Por eso el hueco tiene que poder ser
NEGATIVO — no alcanza con bajarlo a cero.

Y tiene que ser VARIABLE. En DOAC los huecos van 5, 11, 12, 18 px en el mismo tipo
de bloque: mas apretado entre lineas del mismo cuerpo, un poco mas de aire cuando
la siguiente linea cambia de tamano. Un hueco unico se lee mecanico aunque sea el
correcto en promedio.

El bloque se re-ancla por ABAJO: al apretarse encoge, y colgado del tope se
despegaria del borde inferior, que es donde vive un lower-third.

    python3 tighten.py <proyecto> [k_mismo] [k_salto]
"""
import json, re, sys, collections

proj = sys.argv[1]
K_SAME = float(sys.argv[2]) if len(sys.argv) > 2 else -0.34   # lineas de cuerpo parecido
K_JUMP = float(sys.argv[3]) if len(sys.argv) > 3 else -0.24   # cuando cambia el cuerpo
OLD = 0.38
plan_path = f"{proj}/plan.json"
plan = json.load(open(plan_path))
H = plan.get("height") or 1920

frac_of = lambda c: float(m.group(1)) if (m := re.search(r"font-size:\s*calc\(\s*([\d.]+)\s*\*\s*var\(--h\)", c or "")) else 0.05
top_of  = lambda c: float(m.group(1)) if (m := re.search(r"top:\s*(-?[\d.]+)px", c or "")) else None

# una PAGINA = lineas del mismo plano que comparten ventana de salida
pages = collections.defaultdict(list)
for g in plan.get("groups", []):
    if top_of(g.get("css", "")) is not None:
        pages[(g.get("plane"), round(float(g.get("out", 0)), 2))].append(g)

changed = 0
for gs in pages.values():
    gs.sort(key=lambda g: top_of(g["css"]))
    if len(gs) < 2:
        continue
    tops  = [top_of(g["css"]) for g in gs]
    fracs = [frac_of(g["css"]) for g in gs]
    new_tops = [tops[0]]
    for i in range(1, len(gs)):
        ratio = max(fracs[i], fracs[i - 1]) / max(1e-6, min(fracs[i], fracs[i - 1]))
        k = K_JUMP if ratio >= 1.25 else K_SAME        # el salto de cuerpo se gana su aire
        old_gap = max(12, round(fracs[i - 1] * H * OLD))
        new_gap = round(fracs[i - 1] * H * k)
        real_h = tops[i] - tops[i - 1] - old_gap
        new_tops.append(new_tops[-1] + real_h + new_gap)
    shrink = (tops[-1] - tops[0]) - (new_tops[-1] - new_tops[0])
    new_tops = [t + shrink for t in new_tops]          # re-ancla por abajo
    for g, nt in zip(gs, new_tops):
        if abs(nt - top_of(g["css"])) >= 1:
            g["css"] = re.sub(r"top:\s*-?[\d.]+px", f"top:{round(nt)}px", g["css"], count=1)
            changed += 1

json.dump(plan, open(plan_path, "w"), ensure_ascii=False, indent=1)
print(f"  interlineado: mismo={K_SAME} salto={K_JUMP} · {changed} lineas re-apiladas en {len(pages)} paginas")
