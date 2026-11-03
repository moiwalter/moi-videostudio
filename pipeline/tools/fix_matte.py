#!/usr/bin/env python3
"""fix_matte.py — saca las manchas que el mate pegó arriba de la cabeza.

En una ventana de tiempo (la toma contra un fondo brillante) estima la coronilla
con los cuadros limpios de alrededor y, en esa banda, deja alfa sólo dentro de
la cabeza. Fuera de la ventana copia el cuadro tal cual.

  fix_matte.py --src alpha-crudo.webm --footage full30.mp4 --preview af30.npy --out alpha.webm
               [--t0 12.3 --t1 17.25]
"""
import argparse, subprocess, sys
from pathlib import Path

import numpy as np


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--footage", help="toma RGB: si está, no se usa todavía para el pase de piel; el recorte de la cabeza sale de los cuadros limpios del preview")
    ap.add_argument("--preview", required=True, help="npy de alfa chico, un cuadro por frame (en v3, 270×480)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--t0", type=float, default=12.3)
    ap.add_argument("--t1", type=float, default=17.25)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    args = ap.parse_args(argv)
    try:
        from scipy import ndimage as nd
        from PIL import Image
    except ImportError:
        sys.exit("hacen falta scipy y pillow")
    M = np.load(args.preview)
    N = len(M)
    W, H = args.width, args.height
    T0, T1 = int(args.t0 * args.fps), int(args.t1 * args.fps)
    b = M > 0.5
    top = np.array([np.where(m.any(1))[0][0] if m.any() else M.shape[1] - 1 for m in b])
    cx = np.array([np.mean(np.where(m[min(t + 14, m.shape[0] - 1)])[0]) if m[min(t + 14, m.shape[0] - 1)].any() else m.shape[1] / 2 for m, t in zip(b, top)])
    area = b.sum((1, 2))
    medA = np.array([np.median(area[max(0, i - 30):i + 30]) for i in range(N)])
    medT = np.array([np.median(top[max(0, i - 45):i + 45]) for i in range(N)])
    good = (area < medA * 1.04) & (top > medT - 18) & (top > 100)
    gi = np.where(good)[0]
    if not len(gi):
        sys.exit("ningún cuadro limpio para estimar la cabeza")
    topE = nd.uniform_filter1d(np.interp(np.arange(N), gi, top[gi]), 5)
    cxE = nd.uniform_filter1d(np.interp(np.arange(N), gi, cx[gi]), 5)
    ph, pw = M.shape[1], M.shape[2]

    def allowed(i):
        yy, xx = np.mgrid[0:ph, 0:pw].astype(np.float32)
        t, c = topE[i], cxE[i]
        cy = t + 44
        ell = ((xx - c) / 35) ** 2 + ((yy - cy) / 47) ** 2 <= 1
        a = np.ones((ph, pw), np.float32)
        a[yy < cy] = ell[yy < cy]
        band = (yy >= cy) & (yy < t + 78) & (np.abs(xx - c) > 38)
        a[band] = 0
        a = nd.gaussian_filter(a, 1.5)
        return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255

    wide = np.array([b[j, int(min(topE[j] + 30, ph - 1))].sum() for j in range(N)])
    dirty = set(int(j) for j in np.where((top < topE - 6) | (wide > 74))[0] if T0 - 8 <= j <= T1 + 8)
    dirty |= set(j + d for j in list(dirty) for d in (-2, -1, 1, 2) if 0 <= j + d < N)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", args.src, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(args.fps), "-i", "-",
                            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "28", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
                            "-auto-alt-ref", "0", "-metadata:s:v:0", "alpha_mode=1", args.out], stdin=subprocess.PIPE)
    fs = W * H * 4
    i = fixed = 0
    while True:
        buf = dec.stdout.read(fs)
        if len(buf) < fs:
            break
        if i in dirty and i < N:
            f = np.frombuffer(buf, np.uint8).reshape(H, W, 4).copy()
            f[..., 3] = (f[..., 3].astype(np.float32) * allowed(i)).astype(np.uint8)
            buf = f.tobytes()
            fixed += 1
        enc.stdin.write(buf)
        i += 1
    enc.stdin.close()
    enc.wait()
    dec.wait()
    print(f"{i} frames, {fixed} cleaned ({args.t0:.2f}–{args.t1:.2f} s) → {args.out}")


if __name__ == "__main__":
    main()
