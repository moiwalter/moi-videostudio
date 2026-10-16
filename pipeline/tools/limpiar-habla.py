#!/usr/bin/env python3
"""limpiar-habla.py — encuentra en el AUDIO lo que la transcripción no muestra: "eh", pausas largas y retakes.

    python3 tools/limpiar-habla.py --audio <voz|video> --words <words-aligned.json> [--out limpieza.json]
            [--pausa-max 0.5] [--dejar 0.45] [--comparar corte-humano.json] [--check]

Después de cortar: correrlo de nuevo sobre el corte limpio con --out local/limpieza.json y registrar el recibo:
    node tools/source-state.mjs <proyecto> --limpieza local/limpieza.json --decision "qué se cortó y quién lo decidió"

Por qué existe (L036 de cvander, 5-oct-2026): whisper no escribe muletillas y la alineación forzada sólo conoce las palabras que se
le dan, así que un "eh" queda escondido dentro de una "pausa". El método de ritmo pone las transiciones en las pausas: sin este
paso se anima encima del titubeo. Va ANTES de fijar el corte y de armar el mapa (pipeline/docs/SEGMENTAR-POR-IDEAS.md, paso 0).

Qué marca, por cada hueco entre dos palabras:
  eh      hay voz sostenida dentro del hueco (energía sobre el piso de ruido)            → cortar
  pausa   el hueco supera --pausa-max                                                    → recortar hasta dejar --dejar segundos
  retake  la o las palabras de antes del hueco se repiten justo después ("es… es uno")   → cortar la primera vez
Nivel: A = el más notorio (retake · eh ≥ 0,30 s · pausa ≥ 1,0 s) · B = el resto. El nivel sólo ORDENA la lista.

⛔ TODOS los cortes son PROPUESTOS (Walter, 5-oct-2026). Esta herramienta nunca corta y el agente tampoco decide por su cuenta, ni siquiera
   los de nivel A: la lista completa va a Walter y cada corte lleva su decisión ("cortar" o "dejar") antes de tocar el corte.
Lo que NO detecta: frases enteras que sobran por contenido. Eso lo decide quien edita.

Salida: tabla legible + JSON con los cortes propuestos [inicio, fin] en segundos del audio dado. No corta nada: propone.
Calibrado contra el corte que Walter hizo a mano sobre la r4 del video de la UFM (ver --comparar)."""
import argparse, json, subprocess, sys
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--audio', required=True); ap.add_argument('--words', required=True); ap.add_argument('--out')
ap.add_argument('--pausa-max', type=float, default=.5); ap.add_argument('--dejar', type=float, default=.45)
ap.add_argument('--comparar', help='JSON con cortes hechos a mano: [[inicio, fin], …] en el mismo reloj')
ap.add_argument('--check', action='store_true', help='sale con 1 si el --out existente tiene propuestas sin decisión de Walter')
a = ap.parse_args()

W = json.load(open(a.words))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32); HOP = .02; n = int(16000 * HOP)
db = np.array([20 * np.log10(np.sqrt((x[i:i + n] ** 2).mean()) + 1e-9) for i in range(0, len(x) - n, n)])
piso = float(np.percentile(db, 8)); habla = float(np.percentile(db, 80))
umbral = piso + .38 * (habla - piso)          # una voz sostenida y suave ("eeh") queda entre el piso y el habla plena

def voz(t0, t1):
    """segundos del tramo más largo con voz continua dentro de [t0, t1], y dónde está"""
    seg = db[int(t0 / HOP):int(t1 / HOP)] > umbral
    best = (0, 0, 0); run = 0
    for i, v in enumerate(list(seg) + [False]):
        if v: run += 1
        else:
            if run > best[0]: best = (run, i - run, i)
            run = 0
    return best[0] * HOP, t0 + best[1] * HOP, t0 + best[2] * HOP

norm = lambda s: ''.join(c for c in s.lower() if c.isalnum())
out = []
for i in range(len(W) - 1):
    p, q = W[i], W[i + 1]; g = q['s'] - p['e']
    # retake: 1 a 3 palabras antes del hueco repetidas justo después, con al menos 0,25 s en el medio
    rt = 0
    for k in (3, 2, 1):
        # una sola palabra repetida sin pausa es énfasis ("muy, muy"), no retake: pide 0,45 s en el medio
        if i - k + 1 >= 0 and i + k < len(W) and g >= (.45 if k == 1 else .25) and [norm(w['t']) for w in W[i - k + 1:i + 1]] == [norm(w['t']) for w in W[i + 1:i + 1 + k]]: rt = k; break
    if rt:
        out.append({'decision': None, 'tipo': 'retake', 'nivel': 'A', 'cut': [round(W[i - rt + 1]['s'] - .04, 2), round(q['s'] - .04, 2)],
                    'donde': f"«{' '.join(w['t'] for w in W[i - rt + 1:i + 1])} ‖ {' '.join(w['t'] for w in W[i + 1:i + 1 + rt])}»", 'hueco': round(g, 2), 'voz': 0})
        continue
    if g < .3: continue
    v, v0, v1 = voz(p['e'] + .04, q['s'] - .04)
    eh = v >= .16; larga = g >= a.pausa_max
    if not (eh or larga): continue
    c0, c1 = p['e'] + a.dejar * .4, q['s'] - a.dejar * .6          # deja el aire repartido: un poco tras la palabra, más antes de la siguiente
    if eh: c0, c1 = min(c0, max(p['e'] + .05, v0 - .03)), max(c1, min(q['s'] - .06, v1 + .03))   # el "eh" entero se va
    if c1 - c0 < .15: continue
    out.append({'decision': None, 'tipo': 'eh' if eh else 'pausa', 'nivel': 'A' if (v >= .30 or g >= 1.0) else 'B', 'cut': [round(c0, 2), round(c1, 2)],
                'donde': f"«{p['t']} ‖ {q['t']}»", 'hueco': round(g, 2), 'voz': round(v, 2)})

mm = lambda t: f'{int(t // 60)}:{t % 60:05.2f}'
tot = sum(c['cut'][1] - c['cut'][0] for c in out); totA = sum(c['cut'][1] - c['cut'][0] for c in out if c['nivel'] == 'A')
print(f"piso {piso:.0f} dB · habla {habla:.0f} dB · umbral de voz {umbral:.0f} dB")
print(f"{len(out)} cortes propuestos = {tot:.1f} s  ·  nivel A: {sum(c['nivel'] == 'A' for c in out)} = {totA:.1f} s\n")
print('PROPUESTAS — ninguna se aplica sin la decisión de Walter\n  #  niv  tipo    corta            dura   hueco  voz   dónde')
for k, c in enumerate(out, 1): print(f" {k:2d}   {c['nivel']}   {c['tipo']:<7} {mm(c['cut'][0])}–{mm(c['cut'][1])}  {c['cut'][1] - c['cut'][0]:4.2f}   {c['hueco']:4.2f}  {c['voz']:4.2f}  {c['donde']}")
if a.out:
    import os
    if os.path.exists(a.out):       # no pisar lo que Walter ya decidió: una propuesta que sigue ahí conserva su decisión
        prev = {tuple(c['cut']): c.get('decision') for c in json.load(open(a.out)).get('cortes', [])}
        for c in out: c['decision'] = prev.get(tuple(c['cut']))
    json.dump({'audio': a.audio, 'params': {'pausa_max': a.pausa_max, 'dejar': a.dejar}, 'cortes': out}, open(a.out, 'w'), ensure_ascii=False, indent=1)
if a.comparar:
    H = [h for h in json.load(open(a.comparar)) if h[1] - h[0] > .05]
    ov = lambda u, v: max(0, min(u[1], v[1]) - max(u[0], v[0]))
    hit = [h for h in H if any(ov(h, c['cut']) > .1 for c in out)]
    hitA = [h for h in H if any(ov(h, c['cut']) > .1 for c in out if c['nivel'] == 'A')]
    extra = [c for c in out if not any(ov(h, c['cut']) > .1 for h in H)]
    print(f"\nContra el corte hecho a mano ({len(H)} cortes): la herramienta encuentra {len(hit)} ({len(hitA)} en nivel A).")
    for h in H:
        if h not in hit: print(f"   no encontrado: {mm(h[0])}–{mm(h[1])}")
    print(f"   propuestos que la persona NO cortó: {len(extra)} ({sum(c['nivel'] == 'A' for c in extra)} de nivel A)")
sin = [c for c in out if c.get('decision') not in ('cortar', 'dejar')]
if a.check and sin:
    print(f"\n{len(sin)} propuestas sin decisión de Walter (\"cortar\" o \"dejar\" en el campo decision de cada corte)."); sys.exit(1)
