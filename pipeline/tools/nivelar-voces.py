#!/usr/bin/env python3
"""nivelar-voces.py — iguala el volumen de cada persona y deja el master a −14 LUFS.

Nació en Pregúntale a un humano ep. 01 (14-oct-2026): Christian grabó a −23 LUFS y Ricardo a −17
(dos teléfonos distintos). Un loudnorm global sube todo junto y la diferencia de 6 dB sigue ahí:
al cambiar de persona "salta" el volumen. Hay que igualar POR PERSONA y después normalizar.

Uso:
  nivelar-voces.py <master-raw.mp4> <salida.mp4> --tramos "0-24.1:chris,24.1-67.233:ric,67.233-83.1:chris,83.1-130.667:ric,130.667-:chris"
  opciones: --lufs -14 (objetivo) · --tp -1.5 (pico verdadero) · --medir (sólo mide, no escribe)

Qué hace:
  1. mide el LUFS integrado de cada persona sobre SUS tramos (promedio de energía ponderado por duración)
  2. ganancia por persona para que todas queden al nivel de la más fuerte
  3. loudnorm de dos pasadas, lineal (no comprime), al objetivo; el video se copia sin recodificar
  4. verifica: LUFS por tramo, total y pico. Avisa si dos personas quedan a más de 1,5 LU.
Los cortes de tramo = los cambios de persona en el reloj del master (los mismos que van a cutT con f=1.6).
"""
import argparse, json, math, re, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--tramos", required=True); ap.add_argument("--lufs", type=float, default=-14)
ap.add_argument("--tp", type=float, default=-1.5); ap.add_argument("--medir", action="store_true")
a = ap.parse_args()

def ff(args): return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True).stderr
def dur(f): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                        capture_output=True, text=True).stdout)
def lufs(f, s, e):
    r = re.findall(r"I:\s+(-?[\d.]+) LUFS", ff(["-ss", str(s), "-to", str(e), "-i", f, "-vn", "-af", "ebur128", "-f", "null", "-"]))
    return float(r[-1]) if r else None

D = dur(a.src)
T = []
for t in a.tramos.split(","):
    rng, who = t.strip().rsplit(":", 1); s, e = rng.split("-")
    T.append((float(s), float(e) if e else D, who.strip()))

def medir(f):
    por = {}
    for s, e, w in T:
        L = lufs(f, s, e)
        if L is None or L < -70: continue
        por.setdefault(w, []).append((e - s, L))
    return {w: 10 * math.log10(sum(d * 10 ** (L / 10) for d, L in v) / sum(d for d, _ in v)) for w, v in por.items()}

M = medir(a.src)
ref = max(M.values())
G = {w: 10 ** ((ref - L) / 20) for w, L in M.items()}
for w in M: print(f"{w:>10}: {M[w]:6.1f} LUFS → ganancia ×{G[w]:.3f} ({20*math.log10(G[w]):+.1f} dB)")
if a.medir: sys.exit()

lev = ",".join(f"volume=enable='between(t,{s},{e})':volume={G[w]:.4f}" for s, e, w in T)
base = f"loudnorm=I={a.lufs}:TP={a.tp}:LRA=11"
e = ff(["-i", a.src, "-vn", "-af", f"{lev},{base}:print_format=json", "-f", "null", "-"])
d = json.loads(e[e.rindex("{"):e.rindex("}") + 1])
ln = (f"{base}:measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}"
      f":measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true")
e = ff(["-y", "-i", a.src, "-c:v", "copy", "-af", f"{lev},{ln},aresample=48000", "-c:a", "aac", "-b:a", "256k",
        "-movflags", "+faststart", a.out])
if "rror" in e[-400:]: sys.exit(e[-400:])

print("\nverificación:")
for s, e_, w in T: print(f"  {s:7.2f}–{e_:7.2f} {w:>10}: {lufs(a.out, s, e_):6.1f} LUFS")
F = medir(a.out)
r = ff(["-i", a.out, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"])
I, P = re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1], re.findall(r"Peak:\s+(-?[\d.]+)", r)[-1]
print(f"  TOTAL {I} LUFS · pico {P} dBFS · " + " · ".join(f"{w} {v:.1f}" for w, v in F.items()))
if max(F.values()) - min(F.values()) > 1.5: print("  ⚠️ las personas siguen a más de 1,5 LU: revisar tramos")
