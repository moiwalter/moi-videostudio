#!/usr/bin/env python3
"""make_alpha.py — el recorte del orador a partir del mate de RVM. Receta de goldmine v3.3.

Por cuadro: niveles → promedio temporal compensado por movimiento → filtro guiado en el
borde → choke → emplume sólo del borde → gamma → descontaminación y despill → light wrap
del 22 % → preescala Lanczos para que el navegador sólo reduzca.

  make_alpha.py --video full30.mp4 --pha pha.npy --fgr fgr.npy --keep keep.json --out alpha.webm
                [--wrap-color R,G,B | --wrap-npy wrap.npy] [--workdir DIR]

Los números viven en qmd_lib.MATTE. Hace falta opencv (cv2).
"""
import argparse, json, os, subprocess, sys, time
from pathlib import Path

import numpy as np

from qmd_lib import MATTE


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def guided(I, p, r, eps):
    import cv2
    bf = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI, mp = bf(I), bf(p)
    cov = bf(I * p) - mI * mp
    var = bf(I * I) - mI * mI
    A = cov / (var + eps)
    B = mp - A * mI
    return bf(A) * I + bf(B)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--pha", required=True)
    ap.add_argument("--fgr", required=True)
    ap.add_argument("--keep", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--wrap-npy")
    ap.add_argument("--wrap-color", default="246,246,242", help="R,G,B si no hay un npy de color de escena por cuadro")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--light-wrap", type=float, default=MATTE["light_wrap"])
    ap.add_argument("--frames", help="rebanada i0,i1, sin encode (prueba)")
    args = ap.parse_args(argv)
    try:
        import cv2
    except ImportError:
        sys.exit("falta opencv-python (cv2)")
    W, H = args.width, args.height
    SC = MATTE["prescale"]
    W2, H2 = round(W * SC), round(H * SC)
    D = Path(args.workdir)
    D.mkdir(parents=True, exist_ok=True)
    P = np.load(args.pha, mmap_mode="r")
    F = np.load(args.fgr, mmap_mode="r")
    N = len(P)
    keep = json.loads(Path(args.keep).read_text())
    joins = sorted({round(k["cut"][0] * args.fps) for k in keep["keep"][1:]})
    segid = np.searchsorted(np.array(joins), np.arange(N), side="right")
    lo, hi = MATTE["levels"]

    def lv(i):
        return np.clip((P[i].astype(np.float32) / 255 - lo) / (hi - lo), 0, 1)

    src_path = D / "src.npy"
    if not src_path.exists():
        S = np.lib.format.open_memmap(src_path, mode="w+", dtype=np.uint8, shape=(N, H, W, 3))
        dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", args.video, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        for i in range(N):
            S[i] = np.frombuffer(dec.stdout.read(W * H * 3), np.uint8).reshape(H, W, 3)
        dec.kill()
        S.flush()
        del S
    if args.wrap_npy:
        WR = np.load(args.wrap_npy)
    else:
        rgb = np.array([float(x) for x in args.wrap_color.split(",")], np.float32)
        WR = np.repeat(rgb[None], N, 0)
    only = args.frames
    idx = list(range(*map(int, only.split(",")))) if only else list(range(N))
    for f, dt, sh in (("a", np.uint8, (N, H, W)), ("rgb", np.uint8, (N, H, W, 3))):
        p = D / f"{f}.npy"
        if not p.exists():
            np.lib.format.open_memmap(p, mode="w+", dtype=dt, shape=sh).flush()
    S = np.load(src_path, mmap_mode="r")
    AO = np.load(D / "a.npy", mmap_mode="r+")
    RO = np.load(D / "rgb.npy", mmap_mode="r+")
    asig = float(os.environ.get("ASIG", "0.30"))
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))

    def gray(s):
        return cv2.cvtColor(cv2.resize(s, (W // 2, H // 2), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)

    t0 = time.time()
    for i in idx:
        src = S[i].astype(np.float32)
        g0 = gray(S[i])
        a0 = lv(i)
        num, den = a0.copy(), np.ones_like(a0)
        for d, base in ((-1, 1.0), (1, 1.0), (-2, 0.7), (2, 0.7), (-3, 0.4), (3, 0.4)):
            j = i + d
            if j < 0 or j >= N or segid[j] != segid[i]:
                continue
            fl = cv2.resize(dis.calc(g0, gray(S[j]), None), (W, H), interpolation=cv2.INTER_LINEAR) * 2
            mx, my = gx + fl[..., 0], gy + fl[..., 1]
            aj = cv2.remap(lv(j), mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            sj = cv2.remap(S[j].astype(np.float32), mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            wgt = base * np.exp(-((aj - a0) / asig) ** 2) * np.exp(-(np.abs(sj - src).mean(2) / 14.0) ** 2)
            num += wgt * aj
            den += wgt
        a = num / den
        edge = ((a > 0.003) & (a < 0.997)).astype(np.uint8)
        band = cv2.dilate(edge, np.ones((9, 9), np.uint8)).astype(bool)
        Y = cv2.cvtColor(S[i], cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
        gf = np.clip(guided(Y, a, MATTE["guided_radius"], MATTE["guided_eps"]), 0, 1)
        a = np.where(band, (1 - MATTE["guided_blend"]) * a + MATTE["guided_blend"] * gf, a)
        a = cv2.erode(a, np.ones((3, 3), np.uint8))
        a = np.where(band, cv2.GaussianBlur(a, (0, 0), MATTE["feather_sigma"]), a)
        a = np.clip(a, 0, 1) ** MATTE["alpha_gamma"]
        solid = cv2.erode((a >= 0.97).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
        ws = cv2.GaussianBlur(solid, (0, 0), 6)
        ext = cv2.GaussianBlur(src * solid[..., None], (0, 0), 6) / np.maximum(ws, 1e-4)[..., None]
        fg = F[i].astype(np.float32)
        k = ss(0.05, 0.25, ws)[..., None]
        col = k * ext + (1 - k) * fg
        t = ss(0.80, 0.985, a)[..., None]
        rgb = t * src + (1 - t) * col
        e = 1 - t[..., 0]
        gmax = np.maximum(rgb[..., 0], rgb[..., 2]) + 6
        rgb[..., 1] = np.where(rgb[..., 1] > gmax, rgb[..., 1] * (1 - e) + gmax * e, rgb[..., 1])
        inner = cv2.GaussianBlur((a < 0.5).astype(np.float32), (0, 0), 2.2) * (a >= 0.02)
        Lw = (args.light_wrap * np.clip(inner * 2, 0, 1))[..., None]
        rgb = rgb * (1 - Lw) + WR[i][None, None] * Lw
        AO[i] = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
        RO[i] = np.clip(rgb + 0.5, 0, 255).astype(np.uint8)
    AO.flush()
    RO.flush()
    print("frames", len(idx), f"{time.time() - t0:.0f}s", flush=True)
    if only:
        return
    AO = np.load(D / "a.npy", mmap_mode="r")
    RO = np.load(D / "rgb.npy", mmap_mode="r")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W2}x{H2}", "-r", str(args.fps), "-i", "-",
                            "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "14", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
                            "-g", "30", "-auto-alt-ref", "0", "-metadata:s:v:0", "alpha_mode=1", args.out], stdin=subprocess.PIPE)
    AMT, SIG = MATTE["unsharp_amount"], MATTE["unsharp_sigma"]
    for i in range(N):
        rgb2 = cv2.resize(RO[i].astype(np.float32), (W2, H2), interpolation=cv2.INTER_LANCZOS4)
        a2 = np.clip(cv2.resize(AO[i].astype(np.float32) / 255, (W2, H2), interpolation=cv2.INTER_LINEAR), 0, 1)
        solid = cv2.erode((a2 >= 0.995).astype(np.uint8), np.ones((21, 21), np.uint8))
        m = cv2.GaussianBlur(solid.astype(np.float32), (0, 0), 3.0)[..., None]
        rgb2 = rgb2 + AMT * m * (rgb2 - cv2.GaussianBlur(rgb2, (0, 0), SIG))
        o = np.empty((H2, W2, 4), np.uint8)
        o[..., :3] = np.clip(rgb2 + 0.5, 0, 255)
        o[..., 3] = np.clip(a2 * 255 + 0.5, 0, 255)
        enc.stdin.write(o.tobytes())
    enc.stdin.close()
    enc.wait()
    print("ok", args.out, N)


if __name__ == "__main__":
    main()
