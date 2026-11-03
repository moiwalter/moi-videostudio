#!/usr/bin/env python3
"""refine_words.py — corre los tiempos de whisper contra el mapa de energía del corte.

Un inicio que cae en silencio se mueve al próximo onset; un final en silencio,
al último cuadro con voz. No estira la palabra por debajo de 60 ms.

  refine_words.py --wav cut.wav --words words.raw.json --out words.json [--piso -40] [--fixes fixes.json]

words.raw.json: {"words":[{"w","s","e","p"}]}. fixes.json, si existe: [{"w","s0","s","e"}].
Los arreglos a mano de goldmine no están adentro: eran de ese episodio.
"""
import argparse, json, wave
from pathlib import Path

import numpy as np

from qmd_lib import refinar_palabras


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", required=True)
    ap.add_argument("--words", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--piso", type=float, default=-40.0)
    ap.add_argument("--fixes")
    args = ap.parse_args(argv)
    w = wave.open(args.wav)
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    w.close()
    hop = max(1, sr // 100)
    n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)
    voz = db > args.piso

    def voiced(t):
        i = int(round(t * 100))
        return 0 <= i < n and bool(voz[i])

    raw = json.loads(Path(args.words).read_text())["words"]
    fixes = json.loads(Path(args.fixes).read_text()) if args.fixes else None
    out = refinar_palabras(raw, voiced, fixes=fixes)
    dest = Path(args.out)
    dest.write_text(json.dumps(out, indent=1))
    print(f"{len(out)} palabras → {dest}")


if __name__ == "__main__":
    main()
