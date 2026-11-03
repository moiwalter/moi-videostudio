#!/usr/bin/env python3
"""edge_compare_v33.py — borde v3.2 contra v3.3, sobre el color de escena y sobre verde.

Recortes de pelo y de hombro, al 200 %.

  edge_compare_v33.py --out still.jpg --old webm --new webm --frames 400,430
                      [--wrap wrap.npy] [--green 8,59,41]
"""
import argparse, os, subprocess, sys

import numpy as np


def webm(path, i, w, h):
    b = subprocess.run(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", path, "-vf", f"select=eq(n\\,{i}),scale={w}:{h}:flags=area",
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(h, w, 4).astype(np.float32)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--old", required=True)
    ap.add_argument("--new", required=True)
    ap.add_argument("--frames", required=True, help="lista de cuadros, separados por coma")
    ap.add_argument("--wrap", help="npy (N,3) del color de escena; si falta, papel")
    ap.add_argument("--green", default="8,59,41")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    args = ap.parse_args(argv)
    from PIL import Image, ImageDraw, ImageFont
    W, H = args.width, args.height
    green = np.array([float(x) for x in args.green.split(",")])
    WR = np.load(args.wrap) if args.wrap else None
    font = ImageFont.load_default()
    rows = []
    for i in [int(x) for x in args.frames.split(",") if x != ""]:
        A = {"old": webm(args.old, i, W, H), "new": webm(args.new, i, W, H)}
        a = A["old"][..., 3] > 128
        ys, xs = np.where(a)
        if not len(ys):
            sys.exit(f"cuadro {i} sin alfa")
        top = int(ys.min())
        cx = int(np.median(xs[ys < top + 60]))
        sh = top + 380
        row_x = np.where(a[min(sh, H - 1)])[0]
        sx = int(row_x.min()) if len(row_x) else 100
        crops = [(max(0, cx - 120), max(0, top - 40)), (max(0, sx - 60), max(0, sh - 120))]
        scene = WR[i] if WR is not None else np.array([246, 246, 242.0])
        tiles = []
        for x0, y0 in crops:
            for bn, bg in (("scene", scene), ("green", green)):
                for k, f in A.items():
                    al = f[..., 3:4] / 255
                    c = (f[..., :3] * al + bg * (1 - al))[y0:y0 + 240, x0:x0 + 240].clip(0, 255).astype(np.uint8)
                    im = Image.fromarray(c).resize((480, 480), Image.NEAREST)
                    d = ImageDraw.Draw(im)
                    d.rectangle((0, 0, 280, 28), fill=(255, 255, 255))
                    d.text((6, 3), f"{k} · {i / 30:.2f}s · {bn}", fill=(10, 40, 30), font=font)
                    tiles.append(im)
        row = Image.new("RGB", (480 * len(tiles), 480), "white")
        for k, t in enumerate(tiles):
            row.paste(t, (k * 480, 0))
        rows.append(row)
    o = Image.new("RGB", (rows[0].width, 480 * len(rows)), "white")
    for k, r in enumerate(rows):
        o.paste(r, (0, k * 480))
    o.save(args.out, quality=90)
    print(args.out, o.size)


if __name__ == "__main__":
    main()
