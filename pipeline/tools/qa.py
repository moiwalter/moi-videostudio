#!/usr/bin/env python3
"""qa.py — gates del formato qmd-vertical, los de goldmine v3.3.

  qa.py --html index.html [--layout layout.json] [--frames frames.json]
        [--voice voice.wav] [--music music.wav] [--render salida.mp4]
        [--hf DIR]

Qué mira:
  - solape de cajas > 0.27 s (frames.json, el que escribe frames.cjs)
  - voz ≥ 12 dB sobre la música en 300–3500 Hz
  - el outro está, después de la última palabra, y no pasa de 4.31 s
  - nada quieto más de 1 s en la zona gráfica del render
  - loudness −14 LUFS ±1 y true peak ≤ −1 dBTP
  - sin mode-dark, sin brightness(0), sin filter que arranque en none
  - el grano queda debajo del recorte
  - hyperframes check, si se pasa --hf (versión en pipeline/tools/HF_VERSION)
"""
import argparse, json, os, re, subprocess, sys
from pathlib import Path

import numpy as np

from qmd_lib import MEZCLA, acumular_solapes, filtro_peligroso, quietud

HERE = Path(__file__).resolve().parent


def hf_version():
    p = HERE / "HF_VERSION"
    return p.read_text().strip() if p.exists() else "0.8.214"


def gate(fails, name, ok, msg=""):
    print(("  ✓ " if ok else "  ✗ ") + name + (f" — {msg}" if msg else ""), flush=True)
    if not ok:
        fails.append(name)


def revisar_html(html):
    errores = []
    if "mode-dark" in html:
        errores.append("mode-dark")
    if filtro_peligroso(html):
        errores.append("filtro con brillo 0 o filter:none")
    if "our claim" in html.lower():
        errores.append("our claim")
    grano = re.search(r"qmd-grano\{[^}]*z-index:\s*(\d+)", html) or re.search(r"#grain\{[^}]*z-index:\s*(\d+)", html)
    fg = re.search(r"qmd-fg\{[^}]*z-index:\s*(\d+)", html) or re.search(r"#fgwrap\{[^}]*z-index:\s*(\d+)", html)
    if grano and fg and int(grano.group(1)) >= int(fg.group(1)):
        errores.append(f"grano z {grano.group(1)} no está debajo del recorte z {fg.group(1)}")
    return errores


def revisar_outro(lay):
    o = lay.get("OUTRO")
    if not o:
        return "falta OUTRO en layout.json"
    if o["t0"] < o.get("lastWordEnd", o["t0"]) + 0.3 and "lastWordEnd" in o:
        return "el flood pisa la última palabra"
    if not (2.5 <= o.get("len", o["end"] - o["t0"]) <= 4.31):
        return f"el cierre dura {o.get('len')} s (adentro de 2.5–4.31)"
    return None


def revisar_zoom(lay, techo=1.19):
    zs = [c["z"] for c in lay.get("camplan", [])]
    if not zs:
        return None
    m = max(zs)
    return None if m <= techo + 1e-9 else f"zoom {m} pasa de {techo}"


def revisar_solapes(frames, dt=1 / 15, umbral=None):
    pares = [f.get("ov", []) for f in frames]
    # frames.cjs guarda [a, b, porcentaje]; nos quedamos con los ids
    limpio = [[(a, b) for a, b, *_ in f] for f in pares]
    return acumular_solapes(limpio, dt, umbral)


def margen_voz(voz, musica, sr, piso=-32.0):
    """dB de la voz sobre la música en 300–3500 Hz, ventanas de 300 ms con voz."""
    from scipy.signal import butter, sosfilt
    lo, hi = MEZCLA["banda_hz"]
    sos = np.vstack([butter(6, lo, "highpass", fs=sr, output="sos"), butter(4, hi, "lowpass", fs=sr, output="sos")])
    n = min(len(voz), len(musica))
    vb, mb = sosfilt(sos, voz[:n]), sosfilt(sos, musica[:n])
    w, hop = int(0.3 * sr), int(0.1 * sr)

    def rdb(x):
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)

    mg = [rdb(vb[i:i + w]) - rdb(mb[i:i + w]) for i in range(0, n - w, hop) if rdb(vb[i:i + w]) > piso]
    return mg


def ebu(path):
    s = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", s)[-1])
    TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", s)[-1])
    return I, TP


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--html")
    ap.add_argument("--layout")
    ap.add_argument("--frames")
    ap.add_argument("--voice")
    ap.add_argument("--music")
    ap.add_argument("--render")
    ap.add_argument("--hf", help="carpeta con la composición, para hyperframes check")
    args = ap.parse_args(argv)
    fails = []
    if args.html:
        html = Path(args.html).read_text()
        err = revisar_html(html)
        gate(fails, "html (sin dark, sin brillo 0, grano debajo)", not err, ", ".join(err))
    if args.layout:
        lay = json.loads(Path(args.layout).read_text())
        o = revisar_outro(lay)
        gate(fails, "outro", o is None, o or "")
        z = revisar_zoom(lay)
        gate(fails, "zoom ≤ 1.19", z is None, z or "")
    if args.frames:
        frames = json.loads(Path(args.frames).read_text())
        r = revisar_solapes(frames)
        gate(fails, "cajas no se solapan más de 0.27 s", not r["malos"], str(r["malos"])[:400])
    if args.voice and args.music:
        import soundfile as sf
        v, sr = sf.read(args.voice, dtype="float64")
        m, sr2 = sf.read(args.music, dtype="float64")
        if v.ndim > 1:
            v = v.mean(1)
        if m.ndim > 1:
            m = m.mean(1)
        if sr != sr2:
            gate(fails, "misma tasa de muestreo", False, f"{sr} vs {sr2}")
        else:
            mg = margen_voz(v, m, sr)
            ok = bool(mg) and min(mg) >= MEZCLA["margen_voz_db"]
            gate(fails, "voz ≥ 12 dB sobre la música en 300–3500 Hz", ok, f"min {min(mg):.1f} dB" if mg else "sin ventanas con voz")
    if args.voice and not args.music:
        I, TP = ebu(args.voice)
        gate(fails, "voz −14 LUFS ±1, TP ≤ −1", abs(I - MEZCLA["lufs"]) <= 1 and TP <= MEZCLA["true_peak_dbtp"], f"I {I} LUFS, TP {TP}")
    if args.render:
        I, TP = ebu(args.render)
        gate(fails, "render −14 LUFS ±1, TP ≤ −1", abs(I - MEZCLA["lufs"]) <= 1 and TP <= MEZCLA["true_peak_dbtp"], f"I {I} LUFS, TP {TP}")
        if args.layout:
            lay = json.loads(Path(args.layout).read_text())
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", args.render, "-vf", "fps=30,scale=135:240,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
            V = np.frombuffer(raw, np.uint8).reshape(-1, 240, 135).astype(np.float32)
            mv = [float(np.abs(V[i] - V[i - 1]).mean()) for i in range(1, len(V))]
            q = quietud(mv, 30)
            gate(fails, "nada quieto más de 1 s", q["ok"], f"{q['segundos']:.2f}s")
    if args.hf:
        r = subprocess.run(["npx", "-y", f"hyperframes@{hf_version()}", "check", "--json"], cwd=args.hf, capture_output=True, text=True)
        ok = '"ok": true' in r.stdout.replace(" ", "") or '"ok":true' in r.stdout.replace(" ", "")
        gate(fails, "hyperframes check", r.returncode == 0 and ok, (r.stdout or r.stderr)[-240:])
    if not any([args.html, args.layout, args.frames, args.voice, args.render, args.hf]):
        ap.print_help()
        return 2
    print("\nQA:", "PASS" if not fails else "FAIL " + ", ".join(fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
