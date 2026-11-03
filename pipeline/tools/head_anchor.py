#!/usr/bin/env python3
"""head_anchor.py — dónde está la cabeza en cada tramo que se conservó, medida en el alfa final.

  head_anchor.py --webm recorte.webm --keep keep.json --out head.json [--fps-sample 10]

Escribe, por tramo, la fila del 10.º percentil de la coronilla y la mediana del centro.
El generador ancla la cámara de la placa ahí.
"""
import argparse, json, subprocess, tempfile
from pathlib import Path

import numpy as np

from qmd_lib import ancla_cabeza


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--webm", required=True)
    ap.add_argument("--keep", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps-sample", type=float, default=10)
    args = ap.parse_args(argv)
    d = Path(tempfile.mkdtemp())
    subprocess.run(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", args.webm,
                    "-vf", f"fps={args.fps_sample},alphaextract,scale=270:480", str(d / "%04d.png")], check=True)
    from PIL import Image
    rows = []
    for i, f in enumerate(sorted(d.glob("*.png"))):
        m = np.array(Image.open(f).convert("L")) > 128
        if not m.any():
            continue
        a = ancla_cabeza(m)
        rows.append(((i + 0.5) / args.fps_sample, a["top"] * 4, a["cx"] * 4))
    keep = json.loads(Path(args.keep).read_text())["keep"]
    out = []
    for k in keep:
        a, b = k["cut"]
        seg = [r for r in rows if a <= r[0] < b]
        if not seg:
            continue
        out.append({"a": a, "b": b, "top": float(np.percentile([r[1] for r in seg], 10)),
                    "cx": float(np.median([r[2] for r in seg])), "top_max": float(max(r[1] for r in seg))})
    Path(args.out).write_text(json.dumps(out, indent=1))
    for o in out:
        print(f'{o["a"]:6.2f}-{o["b"]:6.2f}  top {o["top"]:.0f}  cx {o["cx"]:.0f}')


if __name__ == "__main__":
    main()
