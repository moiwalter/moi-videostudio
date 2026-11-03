#!/usr/bin/env python3
"""palabras-onda.py — la alineación forzada da bien DÓNDE empieza cada palabra, pero marca el final antes de tiempo
(Walter 29-oct: «hay que matchear las ondas para saber cuánto dura cada palabra»). Esto corrige inicio y fin con la onda:
  fin    → se estira mientras haya voz (energía sobre el umbral), sin pasar el inicio de la palabra siguiente
  inicio → se adelanta mientras haya voz antes (consonantes suaves), sin pisar el fin de la anterior
Uso: python3 palabras-onda.py <audio|video> <words.json> <salida.json> [--offset s]
  --offset: si el json está en otro reloj que el audio (opinion-words.json = 12D243C6 desde 47,0 → --offset 47)."""
import json, subprocess, sys
import numpy as np
audio, wj, out = sys.argv[1:4]
off = float(sys.argv[sys.argv.index('--offset') + 1]) if '--offset' in sys.argv else 0.0
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', audio, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32); HOP = .01; n = int(16000 * HOP)
db = np.array([20 * np.log10(np.sqrt((x[i:i + n] ** 2).mean()) + 1e-9) for i in range(0, len(x) - n, n)])
piso, habla = float(np.percentile(db, 8)), float(np.percentile(db, 80))
umbral = piso + .30 * (habla - piso)
W = json.load(open(wj)); R = []
for i, w in enumerate(W):
    s, e = w['s'] + off, w['e'] + off
    nxt = W[i + 1]['s'] + off if i + 1 < len(W) else e + 1.0
    prv = R[-1]['e'] if R else max(0, s - .5)
    k = int(e / HOP)
    while k * HOP < nxt - .02 and k < len(db) and db[k] > umbral: k += 1        # la cola de la palabra
    e2 = max(e, k * HOP)
    pegado = e2 - e > .30            # más de 0,3 s de voz pegada al final = casi siempre un «eeh» arrastrado
    if pegado: e2 = e + .30
    k = int(s / HOP)
    while k * HOP > prv + .02 and k > 0 and db[k - 1] > umbral: k -= 1          # el arranque
    s2 = min(s, k * HOP)
    R.append({**w, 's': round(s2 - off, 3), 'e': round(e2 - off, 3), 's0': w['s'], 'e0': w['e'], **({'eh_pegado': True} if pegado else {})})
json.dump(R, open(out, 'w'), ensure_ascii=False, indent=0)
d = [r['e'] - r['e0'] for r in R]
print(f"{sum(1 for r in R if r.get('eh_pegado'))} con voz arrastrada al final · " f"{len(R)} palabras · piso {piso:.0f} dB · habla {habla:.0f} dB · umbral {umbral:.0f} dB · el final se corrió en promedio +{np.mean(d)*1000:.0f} ms (máx +{max(d)*1000:.0f} ms)")
