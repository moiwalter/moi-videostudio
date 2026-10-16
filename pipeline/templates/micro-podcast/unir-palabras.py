#!/usr/bin/env python3
"""Une las palabras alineadas de los 3 archivos de Walter en el reloj único de local/cut.mp4.
Tramos (ver CONTEXT): A chris 0–24,1 · B r1 entero · C chris 24,9–40,75 · D r2 entero · E chris 40,75–83,3."""
import json
from pathlib import Path
R = Path(__file__).resolve().parent.parent; T = R.parent / 'transcripts/v2'
L = lambda k: json.load(open(T / f'{k}-words.json'))
c, r1, r2 = L('chris'), L('r1'), L('r2')
D1, D2 = 43.133333, 47.566667
TR = [('A', [w for w in c if w['s'] < 24.1], 0.0, 'chris'), ('B', r1, 24.1, 'ricardo'),
      ('C', [w for w in c if 24.9 <= w['s'] < 40.75], 24.1 + D1 - 24.9, 'chris'), ('D', r2, 24.1 + D1 + 15.85, 'ricardo'),
      ('E', [w for w in c if w['s'] >= 40.75], 24.1 + D1 + 15.85 + D2 - 40.75, 'chris')]
out = []
for tramo, ws, off, quien in TR:
    for w in ws: out.append({'t': w['t'], 's': round(w['s'] + off, 2), 'e': round(w['e'] + off, 2), 'tramo': tramo, 'quien': quien})
json.dump(out, open(R / 'local/words-aligned.json', 'w'), ensure_ascii=False)
for tramo, ws, off, q in TR: print(tramo, q, f'{ws[0]["s"]+off:7.2f} → {ws[-1]["e"]+off:7.2f}', f'(offset {off:+.3f})')
