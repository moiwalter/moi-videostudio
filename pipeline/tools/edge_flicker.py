#!/usr/bin/env python3
"""edge_flicker.py — hervor del borde de un recorte (la diferencia temporal de 2.º orden).

El movimiento constante se cancela; el jitter cuadro a cuadro no. No cruza un jump cut.

  edge_flicker.py --webm recorte.webm --keep keep.json --out flicker.json [--width 1080 --height 1920]
"""
import argparse, json, subprocess
from pathlib import Path

import numpy as np

from qmd_lib import hervir


def joins_de(keep_path, fps):
    if not keep_path:
        return set()
    keep = json.loads(Path(keep_path).read_text())["keep"]
    return {round(k["cut"][0] * fps) for k in keep[1:]}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--webm", required=True)
    ap.add_argument("--keep")
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--fps", type=int, default=30)
    args = ap.parse_args(argv)
    w, h = args.width, args.height
    joins = joins_de(args.keep, args.fps)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", args.webm,
                            "-vf", f"format=yuva420p,scale={w}:{h}:flags=area,format=yuva420p,alphaextract",
                            "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    def rd():
        b = dec.stdout.read(w * h)
        return np.frombuffer(b, np.uint8).reshape(h, w).astype(np.float32) / 255 if len(b) == w * h else None
    a0, a1 = rd(), rd()
    t, rows = 1, []
    while True:
        a2 = rd()
        if a2 is None:
            break
        if not any(j in (t, t + 1) for j in joins):
            r = hervir(a0, a1, a2)
            if r["pixeles"] > 500:
                rows.append({"frame": t, **r})
        a0, a1 = a1, a2
        t += 1
    dec.kill()
    if not rows:
        raise SystemExit("no hubo cuadros con borde medible")
    boil = np.array([r["boil_mean"] for r in rows])
    rep = {"frames": len(rows), "boil_mean": round(float(boil.mean()), 4), "boil_p95": round(float(np.percentile(boil, 95)), 4)}
    Path(args.out).write_text(json.dumps(rep, indent=1))
    print(json.dumps(rep))


if __name__ == "__main__":
    main()
