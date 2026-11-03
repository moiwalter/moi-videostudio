#!/usr/bin/env python3
"""alinear.py — alineación FORZADA palabra a palabra del texto conocido contra el audio (REGLAS V04, SEGMENTAR §1).

POR QUÉ UNA SOLA (2-nov-2026): había 8 copias en 7 proyectos y la plantilla, cada una con su diccionario de anglicismos.
La de la plantilla, sin el tercer argumento, alineaba EN SILENCIO el guion de Adobe que traía adentro. Ésta exige el texto.

Modelo: wav2vec2 VoxPopuli ES (torchaudio, CTC). whisper sólo da el texto; los tiempos salen de acá.

USO
  python3 tools/alinear.py --audio voz.wav --texto texto.txt --out local/words-aligned.json
  python3 tools/alinear.py --audio cut.mp4 --texto bloques.json --bloques local/cut.json --out …   (por bloque del corte)
  --pron pron.json   anglicismos propios del video, encima de tools/pron-es.json (el compartido)

  texto.txt     el texto entero (se alinea en ventanas de 30 s)
  bloques.json  ["texto del bloque 1", "texto del bloque 2", …], uno por bloque de cut.json que no sea "hueco"

Salida: [{"t": palabra, "s": inicio, "e": fin, "tramo": n, "conf": 0–1}] en el reloj del audio que se le pasa.
Python: /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 (tiene torch + torchaudio).
"""
import argparse, json, subprocess, sys
from pathlib import Path

SR = 16000
AQUI = Path(__file__).resolve().parent


def cargar_pron(extra=None):
    pron = json.load(open(AQUI / 'pron-es.json'))['pron']
    if extra: pron = {**pron, **json.load(open(extra))}
    return pron


def norm(w, pron, L):
    w = pron.get(w.strip('¿?¡!.,;:'), pron.get(w, w)).lower()
    return ''.join(c for c in w if c in L) or 'a'


def alinear(em, words, pron, L, F):
    """em: log-probs [1, T, C]. Devuelve [(s, e, conf)] por palabra en cuadros del modelo."""
    toks, spans = [], []
    for w in words:
        ws = [L[c] for c in norm(w, pron, L)]; spans.append((len(toks), len(toks) + len(ws))); toks += ws + [L['|']]
    toks = toks[:-1]; spans[-1] = (spans[-1][0], len(toks))
    ali, sc = F.forced_align(em, F.torch.tensor([toks], dtype=F.torch.int32), blank=0)
    st = F.merge_tokens(ali[0], sc[0].exp())  # un span por token del texto, separadores '|' incluidos
    if len(st) != len(toks): raise RuntimeError(f'la alineación devolvió {len(st)} spans para {len(toks)} tokens')
    out = []
    for a, b in spans:
        seg = st[a:b]; dur = sum(s.end - s.start for s in seg)
        out.append((seg[0].start, seg[-1].end, sum(s.score * (s.end - s.start) for s in seg) / max(1, dur)))
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--audio', required=True); ap.add_argument('--texto', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--bloques'); ap.add_argument('--pron')
    a = ap.parse_args(argv)
    import torch, torchaudio
    from torchaudio.pipelines import VOXPOPULI_ASR_BASE_10K_ES as B
    F = torchaudio.functional; F.torch = torch
    pron = cargar_pron(a.pron)
    if a.bloques:
        textos = json.load(open(a.texto))
        bloques = [b for b in json.load(open(a.bloques))['bloques'] if b.get('fuente') != 'hueco']
        if not isinstance(textos, list) or len(textos) != len(bloques):
            sys.exit(f'✗ {len(bloques)} bloques en {a.bloques} y {len(textos) if isinstance(textos, list) else "?"} textos en {a.texto}')
        tramos = [(b['t0'], b['t1'], t) for b, t in zip(bloques, textos)]
    else:
        texto = open(a.texto).read().replace('\n', ' ').strip()
        if not texto: sys.exit(f'✗ {a.texto} está vacío')
        tramos = [(0, None, texto)]
    wav = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    audio = torch.frombuffer(bytearray(wav), dtype=torch.float32).clone()
    model = B.get_model().eval(); labels = B.get_labels(); L = {c: i for i, c in enumerate(labels)}
    out = []
    for k, (t0, t1, texto) in enumerate(tramos, 1):
        seg = audio[int(t0 * SR):(int(t1 * SR) if t1 is not None else None)]
        with torch.inference_mode():
            # Hasta 120 s, de una pasada: partir en ventanas corre las palabras de los bordes hasta 0,43 s (medido en
            # Cloudflare, bloque de 91,6 s). Más largo, ventanas de 30 s, como la plantilla del micro-podcast.
            paso = seg.shape[0] if seg.shape[0] <= 120 * SR else 30 * SR
            ems = [model(seg[None, i:i + paso])[0] for i in range(0, seg.shape[0], paso)]
        em = torch.log_softmax(torch.cat(ems, 1), -1); r = seg.shape[0] / em.shape[1] / SR
        words = texto.split()
        if not words: print(f'· tramo {k} sin texto: no se alinea', file=sys.stderr); continue
        for w, (s, e, c) in zip(words, alinear(em, words, pron, L, F)):
            out.append({'t': w, 's': round(t0 + s * r, 2), 'e': round(t0 + e * r, 2), 'tramo': k, 'conf': round(float(c), 2)})
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=0)
    dudosas = [w for w in out if w['conf'] < .5]
    print(f'✓ {len(out)} palabras → {a.out}' + (f' · {len(dudosas)} con confianza < 0,5 (revisar PRON): ' + ', '.join(f"{w['t']}@{w['s']}" for w in dudosas[:12]) if dudosas else ''))


if __name__ == '__main__':
    main()
