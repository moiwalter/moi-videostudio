"""pagina-cortes.py — arma revision/cortes/index.html: cada corte propuesto se escucha (antes / después) y Walter marca cortar o dejar.
Junta las propuestas de limpiar-habla.py (limpieza-<clip>.json) con los cortes por CONTENIDO (retakes y frases que el detector no ve)."""
import json, os, re, sys
E = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); T = E + '/transcripts'; R = os.path.dirname(E) + '/revision/cortes'
CLIPS = [('q1', 'Christian · pregunta 1'), ('r1', 'Ricardo · respuesta 1'), ('q2', 'Christian · pregunta 2'), ('r2', 'Ricardo · respuesta 2'), ('op', 'Christian · su opinión')]
# cortes por contenido: (clip, frase a sacar tal cual está en el texto, por qué)
CONT = [
 ('q1', 'uno de estos frontier models', 'repite "modelos de frontera" en inglés'),
 ('r1', 'Hey Chris ¿cómo estás? Oye las preguntas me encantan La primera', 'saludo: entra directo a la respuesta'),
 ('r1', 'siempre la mejor digamos que', 'retake: "siempre la mejor… siempre el mejor consejo"'),
 ('r1', 'a pesar de eso', 'retake: "a pesar de eso, a pesar de que…"'),
 ('r1', 'mucho mucho que hacer', 'palabra repetida: "mucho mucho" (se saca el primero)', 1),
 ('q2', 'Ok', 'arranque en frío'),
 ('q2', 'transformando leyes bueno no', 'retake: se corrige a "transformando la aplicación de derecho"'),
 ('r2', 'Chris tu segunda pregunta', 'entrada: va directo a "sí y no"'),
 ('r2', 'el último año', 'retake: "el último año, los últimos dos años"'),
 ('r2', 'Entonces la verdad es que', 'muletilla de arranque (ya dijo "la verdad es que" antes)'),
 ('r2', 'muy muy poco', 'palabra repetida: "muy muy poco" (se saca el primer "muy")', 1),
 ('op', 'Ok', 'arranque en frío'),
 ('op', 'no podía', 'retake: "no podía, no tenía tiempo"'),
]
n = lambda s: re.sub(r'[^\wáéíóúñ.]', '', s.lower())
data = []
for k, nombre in CLIPS:
    W = json.load(open(f'{T}/{k}-words.json')); L = json.load(open(f'{E}/limpieza-{k}.json'))
    cortes = [dict(id=f'{k}-{i+1}', niv=c['nivel'], tipo=c['tipo'], s=c['cut'][0], e=c['cut'][1], donde=c['donde'], nota=f"hueco {c['hueco']:.2f} s · voz {c['voz']:.2f} s") for i, c in enumerate(L['cortes'])]
    j = 0
    for kk, frase, por, *nn in CONT:
        if kk != k: continue
        f = [n(x) for x in frase.split()]; hit = None
        for i in range(len(W) - len(f) + 1):
            if [n(w['t']) for w in W[i:i + len(f)]] == f: hit = i; break
        if hit is None: sys.exit(f'no encontré «{frase}» en {k}')
        if nn: f = f[:nn[0]]; frase = ' '.join(frase.split()[:nn[0]])
        fin = W[hit + len(f)]['s'] if hit + len(f) < len(W) else W[hit + len(f) - 1]['e']
        ini = W[hit]['s'] if hit else 0.0
        j += 1; cortes.append(dict(id=f'{k}-C{j}', niv='C', tipo='frase', s=round(ini, 2), e=round(fin, 2), donde=f'«{frase}»', nota=por))
    cortes.sort(key=lambda c: c['s'])
    data.append(dict(k=k, nombre=nombre, dur=round(W[-1]['e'], 1), cortes=cortes, texto=' '.join(w['t'] for w in W)))
json.dump(data, open(R + '/cortes.json', 'w'), ensure_ascii=False, indent=1)
html = open(E + '/tools/pagina-cortes.html').read().replace('/*DATA*/', json.dumps(data, ensure_ascii=False))
open(R + '/index.html', 'w').write(html)
for d in data:
    t = sum(c['e'] - c['s'] for c in d['cortes']); print(d['k'], d['dur'], 's ·', len(d['cortes']), 'cortes ·', round(t, 1), 's')
