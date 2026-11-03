#!/usr/bin/env python3
"""master_mix.py — una sola pista: voz + sfx + música, limitador de true peak.

Medido en goldmine v3.3. HyperFrames recorta toda la mezcla al pasar a AAC para
quedar bajo −1 dBTP. Limitar sólo los picos (techo −1.8 dBTP, look-ahead 5 ms,
release 80 ms) conserva el margen de la voz y deja el render en −14 LUFS.

  master_mix.py --voice V --sfx S --music M --out mix.wav [--dur S] [--ceiling -1.8]
"""
import argparse, json, sys
from pathlib import Path

import numpy as np

from qmd_lib import MEZCLA, limitador


def leer(path, n, sr):
    import soundfile as sf
    x, file_sr = sf.read(path, dtype="float64")
    if file_sr != sr:
        raise SystemExit(f"{path} está a {file_sr} Hz, se espera {sr}")
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    return np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--sfx", required=True)
    ap.add_argument("--music", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report")
    ap.add_argument("--sr", type=int, default=48000)
    ap.add_argument("--dur", type=float)
    ap.add_argument("--ceiling", type=float, default=MEZCLA["limiter_ceiling_dbtp"])
    args = ap.parse_args(argv)
    import soundfile as sf
    info = sf.info(args.voice)
    dur = args.dur or info.duration
    n = round(dur * args.sr)
    mix = leer(args.voice, n, args.sr) + leer(args.sfx, n, args.sr) + leer(args.music, n, args.sr)
    y, g = limitador(mix, args.ceiling, args.sr)
    for _ in range(3):
        pk = np.abs(y).max()
        ceil = 10 ** (args.ceiling / 20)
        if pk <= ceil:
            break
        y *= ceil / pk
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.out, y.astype(np.float32), args.sr, subtype="FLOAT")
    rep = {
        "ceiling_dBTP": args.ceiling,
        "max_gain_reduction_dB": round(float(-20 * np.log10(max(g.min(), 1e-9))), 2),
        "out_sample_peak_dBFS": round(float(20 * np.log10(np.abs(y).max() + 1e-12)), 2),
        "dur_s": dur,
    }
    try:
        import pyloudnorm as pyln
        m = pyln.Meter(args.sr)
        rep["out_LUFS"] = round(float(m.integrated_loudness(y)), 2)
    except Exception as e:
        rep["out_LUFS"] = None
        rep["lufs_nota"] = str(e)
    dest = Path(args.report) if args.report else Path(args.out).with_suffix(".json")
    dest.write_text(json.dumps(rep, indent=1))
    print(json.dumps(rep))


if __name__ == "__main__":
    main()
