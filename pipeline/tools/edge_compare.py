#!/usr/bin/env python3
"""edge_compare.py — un still del borde, dos recortes lado a lado, sobre papel y sobre verde.

  edge_compare.py --frame N --a etiqueta=webm --b etiqueta=webm --out still.jpg
                  [--pha pha.npy] [--paper 246,246,242] [--green 8,59,41]
"""
import argparse, subprocess, sys
from pathlib import Path

import numpy as np


def rgba(path, i, w, h):
    b = subprocess.run(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", path, "-vf", f"select=eq(n\\,{i})", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], capture_output=True).stdout
    if len(b) != w * h * 4:
        sys.exit(f"{path} cuadro {i}: esperaba {w}x{h} rgba, llegaron {len(b)} bytes")
    return np.frombuffer(b, np.uint8).reshape(h, w, 4).astype(np.float32)


def parse_pair(s):
    k, v = s.split("=", 1)
    return k, v


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--frame", type=int, required=True)
    ap.add_argument("--a", required=True, help="etiqueta=webm")
    ap.add_argument("--b", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--pha", help="npy de alfa para encuadrar la cabeza; si falta, usa el alfa de --a")
    ap.add_argument("--paper", default="246,246,242")
    ap.add_argument("--green", default="8,59,41")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    args = ap.parse_args(argv)
    from PIL import Image, ImageDraw, ImageFont
    W, H, i = args.width, args.height, args.frame
    A = dict([parse_pair(args.a), parse_pair(args.b)])
    frames = {k: rgba(v, i, W, H) for k, v in A.items()}
    if args.pha:
        P = np.load(args.pha, mmap_mode="r")[i]
    else:
        P = frames[parse_pair(args.a)[0]][..., 3]
    ys, xs = np.where(P > 128)
    if not len(ys):
        sys.exit("el alfa de ese cuadro está vacío")
    top = ys.min()
    cx = int(np.median(xs[ys < top + 60]))
    x0, y0 = max(0, cx - 300), max(0, top - 80)
    x1, y1 = min(W, x0 + 600), y0 + 560
    bgs = {"paper": np.array([float(x) for x in args.paper.split(",")]), "green": np.array([float(x) for x in args.green.split(",")])}
    tiles = []
    for bg in bgs.values():
        row = []
        for f in frames.values():
            al = f[..., 3:4] / 255
            c = f[..., :3] * al + bg * (1 - al)
            row.append(Image.fromarray(c[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)))
        tiles.append(row)
    tw, th = tiles[0][0].size
    S = Image.new("RGB", (tw * 2 + 30, th * 2 + 110), (246, 246, 242))
    d = ImageDraw.Draw(S)
    try:
        fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except Exception:
        fnt = None
    labels = " · ".join(frames)
    d.text((10, 8), f"borde · cuadro {i} ({i / 30:.2f} s) · {labels}", fill=(19, 33, 27), font=fnt)
    for r, row in enumerate(tiles):
        for c, im in enumerate(row):
            S.paste(im, (c * (tw + 30), 50 + r * (th + 30)))
    S.save(args.out, quality=92)
    print(args.out, S.size)


if __name__ == "__main__":
    main()
