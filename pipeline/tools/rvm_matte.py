#!/usr/bin/env python3
"""rvm_matte.py — Robust Video Matting (ONNX, CPU) sobre el corte.

El estado recurrente se reinicia en cada join para que la memoria no manche el corte.
Escribe pha_<modelo>.npy (alfa uint8) y fgr_<modelo>.npy (RGB del frente).

Los pesos NO van en el repo. Default: ~/.cache/rvm/rvm_<modelo>_fp32.onnx
(ver pipeline/docs/ACTIVOS-EXTERNOS.md).

  rvm_matte.py --video full30.mp4 --keep keep.json --out work/rvm
               [--model resnet50|mobilenetv3] [--weights PATH] [--width 1080 --height 1920]
               [--downsample 0.4] [--start 0] [--frames N]
"""
import argparse, json, os, subprocess, sys, time
from pathlib import Path

import numpy as np

from qmd_lib import MATTE


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--keep", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="resnet50", choices=["resnet50", "mobilenetv3"])
    ap.add_argument("--weights")
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--downsample", type=float, default=MATTE["downsample_ratio"])
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--frames", type=int, default=10**9)
    ap.add_argument("--threads", type=int, default=8)
    args = ap.parse_args(argv)
    try:
        import onnxruntime as ort
    except ImportError:
        sys.exit("falta onnxruntime. Los pesos se bajan aparte: pipeline/docs/ACTIVOS-EXTERNOS.md")
    weights = args.weights or os.path.expanduser(f"~/.cache/rvm/rvm_{args.model}_fp32.onnx")
    if not os.path.exists(weights):
        sys.exit(f"no están los pesos: {weights}\nver pipeline/docs/ACTIVOS-EXTERNOS.md")
    w, h = args.width, args.height
    keep = json.loads(Path(args.keep).read_text())
    resets = {round(k["cut"][0] * args.fps) for k in keep["keep"][1:]}
    so = ort.SessionOptions()
    so.intra_op_num_threads = args.threads
    sess = ort.InferenceSession(weights, so, providers=["CPUExecutionProvider"])
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    # El largo se descubre al decodificar; se reserva de a poco reescribiendo el memmap al final de cada bloque.
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", args.video, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    z = lambda: np.zeros((1, 1, 1, 1), np.float32)
    rec = [z(), z(), z(), z()]
    dr = np.array([args.downsample], np.float32)
    pha_path, fgr_path = out / f"pha_{args.model}.npy", out / f"fgr_{args.model}.npy"
    frames = []
    i, t0, f0, nf = 0, time.time(), args.start, args.frames
    while True:
        buf = dec.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        if i >= f0 + nf:
            break
        if i in resets:
            rec = [z(), z(), z(), z()]
        src = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        if i >= f0 - 12:
            x = (src.astype(np.float32) / 255).transpose(2, 0, 1)[None]
            fg, a, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": dr})
            if i >= f0:
                frames.append((np.clip(a[0, 0] * 255 + 0.5, 0, 255).astype(np.uint8),
                               np.clip(fg[0].transpose(1, 2, 0) * 255 + 0.5, 0, 255).astype(np.uint8)))
                if len(frames) % 25 == 0:
                    print(i, f"{(time.time() - t0) / max(1, len(frames)):.2f}s/frame", flush=True)
        i += 1
    dec.kill()
    if not frames:
        sys.exit("el video no devolvió cuadros")
    n = len(frames)
    pha = np.lib.format.open_memmap(pha_path, mode="w+", dtype=np.uint8, shape=(n, h, w))
    fgr = np.lib.format.open_memmap(fgr_path, mode="w+", dtype=np.uint8, shape=(n, h, w, 3))
    for k, (pa, fg) in enumerate(frames):
        pha[k] = pa
        fgr[k] = fg
    pha.flush()
    fgr.flush()
    print("done", args.model, n, f"{time.time() - t0:.0f}s", pha_path)


if __name__ == "__main__":
    main()
