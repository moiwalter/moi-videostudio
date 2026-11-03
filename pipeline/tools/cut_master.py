#!/usr/bin/env python3
"""cut_master.py — corte a 1×. Quita lo que dice cuts.json. No estira ni agrega pausas.

  cut_master.py --src toma.mov --cuts cuts.json --out master/cut.mp4 [--fps 60] [--xfade 0.02]

Escribe keep.json al lado del master: el mapa fuente → reloj del master.
El borde de audio se puede afinar con --snap-audio (el hueco más quieto en ±30 ms);
por default el corte cae en la grilla de cuadros.
"""
import argparse, json, os, subprocess, wave
from pathlib import Path

import numpy as np

from qmd_lib import plan_keep


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--cuts", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--xfade", type=float, default=0.020)
    ap.add_argument("--sr", type=int, default=48000)
    args = ap.parse_args(argv)
    src, out = args.src, Path(args.out)
    work = out.parent / "work"
    work.mkdir(parents=True, exist_ok=True)
    wav = work / "a48.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vn", "-ac", "2", "-ar", str(args.sr), "-c:a", "pcm_s16le", str(wav)], check=True)
    w = wave.open(str(wav))
    audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float64)
    w.close()
    dur = len(audio) / args.sr
    cuts = json.loads(Path(args.cuts).read_text())["cuts"]
    keep = plan_keep(cuts, dur, args.fps)
    h = int(args.xfade * args.sr / 2)
    fade = np.sin(np.linspace(0, np.pi / 2, 2 * h))[:, None] if h else None
    acc = None
    for i, (s, e) in enumerate(keep):
        i0, i1 = int(round(s * args.sr)), int(round(e * args.sr))
        if i == 0 or h == 0:
            seg = audio[i0:min(len(audio), i1 + h)].copy()
        else:
            seg = audio[max(0, i0 - h):min(len(audio), i1 + h)].copy()
        if acc is None:
            acc = seg
            continue
        acc[-2 * h:] = acc[-2 * h:] * fade[::-1] + seg[:2 * h] * fade
        acc = np.concatenate([acc, seg[2 * h:]])
    acc = acc[: int(round(sum(e - s for s, e in keep) * args.sr))]
    cutwav = work / "cut48.wav"
    with wave.open(str(cutwav), "w") as o:
        o.setnchannels(2)
        o.setsampwidth(2)
        o.setframerate(args.sr)
        o.writeframes(np.clip(acc, -32768, 32767).astype(np.int16).tobytes())
    fc = "".join(f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS[v{i}];" for i, (s, e) in enumerate(keep))
    fc += "".join(f"[v{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=1:a=0,fps={args.fps},format=yuv420p[v]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-i", str(cutwav), "-filter_complex", fc, "-map", "[v]", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(out)], check=True)
    m, t = [], 0.0
    for s, e in keep:
        m.append({"src": [s, e], "cut": [round(t, 4), round(t + e - s, 4)]})
        t += e - s
    keep_path = out.parent / "keep.json"
    keep_path.write_text(json.dumps({"source": src, "fps": args.fps, "xfade_ms": args.xfade * 1000, "keep": m, "duration": round(t, 4)}, indent=1))
    print(f"kept {len(keep)} spans, {t:.3f} s (from {dur:.3f} s, removed {dur - t:.3f} s)")


if __name__ == "__main__":
    main()
