#!/usr/bin/env python3
"""sfx.py — efectos reales, alineados a su pico, con techo dinámico bajo la voz.

Lee un JSON de eventos y una carpeta de muestras. No trae las muestras: ver
pipeline/docs/ACTIVOS-EXTERNOS.md.

  sfx.py --events sfx-events.json --library DIR --voice voice.wav --out sfx.wav

El evento: {"k","t","db","align":"pico"|"inicio","largo","pan","why","hero"}.
Hero (el golpe del número, el sello, el cierre) va a un bus con techo 3 dB bajo
la voz. El resto, 6 dB bajo la voz y −6 dB extra, pico limitado a −3 dBFS.
"""
import argparse, json, subprocess, sys
from pathlib import Path

import numpy as np


def db(x):
    return 10 ** (x / 20)


def cargar(lib, k, sr, cache):
    if k in cache:
        return cache[k]
    hits = list(Path(lib).glob(k + ".*"))
    if not hits:
        raise SystemExit(f"no está la muestra {k} en {lib}")
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(hits[0]), "-ac", "2", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True)
    x = np.frombuffer(r.stdout, np.float32).reshape(-1, 2).astype(float)
    hop = max(1, sr // 100)
    e = np.array([np.sqrt(np.mean(x[j:j + hop] ** 2)) for j in range(0, max(1, len(x) - hop), hop)])
    cache[k] = (x / (np.abs(x).max() + 1e-12), (int(np.argmax(e)) * hop / sr) if len(e) else 0.0, hits[0].name)
    return cache[k]


def colocar(bus, x, t, pico_db, sr, n, alinear, pico_muestra, largo, pan):
    if largo:
        ncut = round(largo * sr)
        x = x[:ncut].copy()
        f = min(len(x), round(0.08 * sr))
        if f:
            x[-f:] *= np.linspace(1, 0, f)[:, None]
    t0 = t - (pico_muestra if alinear == "pico" else 0)
    a = round(t0 * sr)
    if a < 0:
        x = x[-a:]
        a = 0
    nuse = min(len(x), n - a)
    if nuse <= 0:
        return
    g = db(pico_db)
    lg = np.cos((pan + 1) * np.pi / 4) * 1.414
    rg = np.sin((pan + 1) * np.pi / 4) * 1.414
    bus[a:a + nuse, 0] += x[:nuse, 0] * g * lg
    bus[a:a + nuse, 1] += x[:nuse, 1] * g * rg


def techo(bus, voz, sr, under, floor_db):
    """Baja el bus para quedar `under` dB bajo la voz mientras habla, y bajo floor_db en el silencio."""
    n = len(bus)
    w, hop = round(0.3 * sr), round(0.05 * sr)

    def rmsdb(x):
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

    idx = np.arange(0, max(1, n - w), hop)
    mono = bus.mean(1)
    gl = []
    for i in idx:
        vr = rmsdb(voz[i:i + w])
        sr_ = rmsdb(mono[i:i + w])
        lim = min(floor_db, vr - under) if vr > -34 else floor_db
        gl.append(min(0.0, lim - sr_))
    gl = np.array(gl if len(gl) else [0.0])
    for _ in range(3):
        gl = np.minimum(gl, np.minimum(np.r_[gl[1:], 0], np.r_[0, gl[:-1]]))
    gain = 10 ** (np.interp(np.arange(n), np.clip(idx[:len(gl)] + w // 2, 0, n - 1), gl) / 20)
    return bus * gain[:, None]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--events", required=True)
    ap.add_argument("--library", required=True)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sr", type=int, default=48000)
    args = ap.parse_args(argv)
    import soundfile as sf
    ev = json.loads(Path(args.events).read_text())
    dur = ev["DUR"]
    n = round(dur * args.sr)
    cama = np.zeros((n, 2))
    hero = np.zeros((n, 2))
    cache, hechos = {}, []
    for e in ev["events"]:
        x, pico, fn = cargar(args.library, e["k"], args.sr, cache)
        bus = hero if e.get("hero") else cama
        colocar(bus, x, e["t"], e["db"], args.sr, n, e.get("align", "pico"), pico, e.get("largo"), e.get("pan", 0.0))
        hechos.append({"t": round(e["t"], 3), "sample": fn, "db": e["db"], "hero": bool(e.get("hero"))})
    v, vsr = sf.read(args.voice, dtype="float32")
    if vsr != args.sr:
        raise SystemExit(f"la voz está a {vsr} Hz, se espera {args.sr}")
    if v.ndim > 1:
        v = v.mean(1)
    v = np.pad(v, (0, max(0, n - len(v))))[:n]
    sfx = techo(cama, v, args.sr, 6.0, -22.0) * db(-6)
    if np.abs(hero).max() > 0:
        sfx = sfx + techo(hero, v, args.sr, 3.0, -16.0)
    pk = np.abs(sfx).max()
    if pk > db(-3):
        sfx *= db(-3) / pk
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.out, sfx.astype(np.float32), args.sr, subtype="PCM_16")
    print(f"sfx {n / args.sr:.3f}s · {len(hechos)} eventos · pico {20 * np.log10(np.abs(sfx).max() + 1e-12):.1f} dBFS")


if __name__ == "__main__":
    main()
