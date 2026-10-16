#!/usr/bin/env python3
"""recut.py — aprieta el ritmo de un corte de talking-head sin tocar una sola palabra.

Detecta el aire muerto (silencios) y lo recorta a un padding fijo. Acepta además
remociones explícitas (una frase repetida, un arranque fallido) declaradas a mano.

    tools/recut.py <slug> --plan                 # propone el plan → local/recut.json
    tools/recut.py <slug> --aplicar              # renderiza local/cut.mp4 desde el plan

⛔ POR QUÉ EXISTE (13-ago-2026): hasta hoy el sistema entregaba capas para CapCut y el
   corte era intocable. Al pasar el master a HyperFrames el footage entra a la composición,
   así que el ritmo también es nuestro. Walter: "estoy prácticamente muy cansado en el video,
   tenemos que tener más dinamismo".

⛔ REGLA DURA — TODO CORTE SE ALINEA A FRAME. A 30 fps y 48 kHz, un frame son exactamente
   1600 muestras. Si los puntos de corte NO caen en frame entero, el segmento de video y el
   de audio quedan con largos distintos y el desfase se ACUMULA corte a corte: con 16 cortes
   son ~0,27 s de labios fuera de sincro al final, y no hay error que lo avise.

⛔ Después de aplicar, RE-TRANSCRIBIR. El .srt viejo miente sobre el corte nuevo, y el .srt
   es la fuente de todo el sync (START_HERE §1).
"""
import argparse, json, os, re, subprocess, sys

FPS = 30.0

def sh(cmd, **kw):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)

def snap(t, fps=FPS):
    """Alinea un tiempo al frame más cercano. Ver la regla dura del encabezado."""
    return round(t * fps) / fps

def find_project(slug):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for d in sorted(os.listdir(root)):
        full = os.path.join(root, d)
        if os.path.isdir(full) and slug in d and d not in ("tools", "templates", "design_system"):
            return full
    sys.exit(f"✗ ningún video matchea '{slug}' en {root}")

def probe_duration(path):
    r = sh(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{path}"')
    return float(r.stdout.strip())

def detect_silences(path, noise_db, min_len):
    r = sh(f'ffmpeg -hide_banner -nostats -i "{path}" -map 0:a:0 '
           f'-af "silencedetect=noise={noise_db}dB:d={min_len}" -f null - 2>&1')
    out = r.stdout + r.stderr
    starts = [float(m) for m in re.findall(r"silence_start: ([0-9.]+)", out)]
    ends = [float(m) for m in re.findall(r"silence_end: ([0-9.]+)", out)]
    return list(zip(starts, ends))

def merge(ranges):
    """Une rangos que se tocan o se pisan. Sin esto, una remoción explícita que cae
    encima de un silencio detectado produce segmentos negativos."""
    if not ranges:
        return []
    ranges = sorted(ranges, key=lambda r: r[0])
    out = [list(ranges[0])]
    for s, e in ranges[1:]:
        if s <= out[-1][1] + 1e-6:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [tuple(r) for r in out]

def build_plan(src, dur, silences, pad, removals):
    """Un silencio de 0,45 s con pad 0,14 no se borra entero: se deja el pad al principio
    (la respiración es parte del habla) y se quita el resto."""
    cuts = []
    for s, e in silences:
        keep_until = s + pad
        if e - keep_until > 0.04:                      # < 1,2 frames no vale el corte
            cuts.append((snap(keep_until), snap(e), "aire"))
    for r in removals:
        cuts.append((snap(r["start"]), snap(r["end"]), r.get("why", "remoción explícita")))

    whys = {}
    for s, e, w in cuts:
        whys[(s, e)] = w
    merged = merge([(s, e) for s, e, _ in cuts])

    segments, t = [], 0.0
    for s, e in merged:
        if s - t > 0.04:
            segments.append({"start": snap(t), "end": snap(s)})
        t = e
    if dur - t > 0.04:
        segments.append({"start": snap(t), "end": snap(dur)})

    return {
        "cuts": [{"start": s, "end": e, "why": whys.get((s, e), "aire"),
                  "removed": round(e - s, 3)} for s, e in merged],
        "segments": segments,
    }

def render(proj, plan):
    """⛔ CORTE EXACTO POR FRAME Y POR MUESTRA (18-ago-2026).

    La versión anterior usaba `select`/`aselect` con la MISMA expresión
    `between(t, s, e)` para video y para audio, confiando en que el mismo
    predicado sobre el mismo tiempo diera el mismo largo en las dos pistas.
    No lo da: `between` es inclusivo y los tiempos de frame (n/30) no son
    representables en binario, así que en cada frontera el video se queda con
    un frame de más o de menos mientras el audio corta en la muestra exacta.
    Con 40 segmentos eso acumuló **0,615 s** en `2026-08-uplabs-andres`
    (video 123.367 s contra audio 122.752 s) y el resultado es labios corridos
    que empeoran hacia el final. El encabezado de este archivo ya advertía el
    modo de falla; lo que faltaba era que el código lo hiciera imposible.

    Ahora los dos cortes salen del MISMO entero. A 30 fps y 48 kHz un frame son
    exactamente 1600 muestras, así que el segmento se define en frames y el
    audio se deriva multiplicando: mismo número de frames, mismo número de
    muestras, cero deriva posible. Y se verifica al final en vez de asumirse.
    """
    src = os.path.join(proj, plan["src"])
    out = os.path.join(proj, plan["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fps = plan.get("fps", FPS)
    sr = 48000
    spf = int(round(sr / fps))              # 1600 muestras por frame a 30/48k
    if sr % int(fps):
        sys.exit(f"✗ {sr} Hz no es múltiplo de {fps} fps: no hay frame exacto")

    partes, etiquetas = [], []
    for i, seg in enumerate(plan["segments"]):
        f0, f1 = int(round(seg["start"] * fps)), int(round(seg["end"] * fps))
        if f1 <= f0:
            continue
        partes.append(
            f"[0:v]trim=start_frame={f0}:end_frame={f1},setpts=PTS-STARTPTS[v{i}];"
            f"[0:a]atrim=start_sample={f0*spf}:end_sample={f1*spf},asetpts=PTS-STARTPTS[a{i}]")
        etiquetas.append(f"[v{i}][a{i}]")
    if not partes:
        sys.exit("✗ el plan no dejó ningún segmento")

    fc = ";".join(partes) + ";" + "".join(etiquetas) + \
         f"concat=n={len(etiquetas)}:v=1:a=1[v][a]"
    cmd = (f'ffmpeg -y -hide_banner -i "{src}" -filter_complex "{fc}" '
           f'-map "[v]" -map "[a]" '
           f'-c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -r {int(fps)} '
           f'-c:a aac -b:a 192k -ar {sr} -movflags +faststart "{out}"')
    print("→ renderizando el corte (frame y muestra exactos)…")
    r = sh(cmd)
    if r.returncode != 0:
        sys.exit(r.stderr[-3000:])

    # ── el invariante se COMPRUEBA, no se asume ──────────────────────────────
    # ⛔ Se cuentan MUESTRAS contra FRAMES, no duraciones de contenedor. El AAC
    #    agrega priming al principio (~2 frames de 1024 muestras) y la duración
    #    que reporta el contenedor sale corrida ~60 ms aunque el contenido esté
    #    perfecto. Comparar duraciones daba un falso positivo que bloqueaba un
    #    corte correcto; contar muestras reales contra frames×1600 mide lo que
    #    importa y deja el margen sólo para el códec.
    def sh1(c):
        return sh(c).stdout.strip().splitlines()[0]
    nfv = int(sh1(f'ffprobe -v error -select_streams v:0 -count_frames '
                  f'-show_entries stream=nb_read_frames -of csv=p=0 "{out}"'))
    # se lee por NOMBRE de campo: el orden del csv de ffprobe no es el que se pide
    kv = dict(l.split("=", 1) for l in sh(
        f'ffprobe -v error -select_streams a:0 -show_entries '
        f'stream=duration_ts,time_base -of default=nw=1 "{out}"'
    ).stdout.strip().splitlines() if "=" in l)
    num, den = kv["time_base"].split("/")
    muestras = int(kv["duration_ts"]) * sr * int(num) // int(den)
    esperadas = nfv * spf
    delta = abs(muestras - esperadas)
    PRIMING = 4096          # 4 frames AAC de holgura: priming + padding final
    if delta > PRIMING:
        sys.exit(f"\u2717 el corte sali\u00f3 desincronizado: {nfv} frames piden "
                 f"{esperadas} muestras y hay {muestras} "
                 f"(\u0394 {delta} = {delta/sr*1000:.0f} ms). NO uses este archivo.")
    print(f"  \u2713 sincro verificada: {nfv} frames \u00d7 {spf} = {esperadas} muestras, "
          f"hay {muestras} (\u0394 {delta} = {delta/sr*1000:.0f} ms de priming AAC)")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--aplicar", action="store_true")
    ap.add_argument("--src", default=None, help="video fuente (default: el .mp4 de la raíz)")
    ap.add_argument("--noise", type=float, default=-30, help="umbral de silencio en dB")
    ap.add_argument("--min-silence", type=float, default=0.28)
    ap.add_argument("--pad", type=float, default=0.14, help="cuánto silencio se DEJA")
    a = ap.parse_args()

    proj = find_project(a.slug)
    planfile = os.path.join(proj, "local", "recut.json")

    if a.plan:
        src = a.src
        if not src:
            cands = [f for f in os.listdir(proj)
                     if f.endswith(".mp4") and not f.startswith(".") and "cut" not in f.lower()]
            if len(cands) != 1:
                sys.exit(f"✗ ambiguo, pasá --src. Candidatos: {cands}")
            src = cands[0]
        full = os.path.join(proj, src)
        dur = probe_duration(full)
        sil = detect_silences(full, a.noise, a.min_silence)

        prev = {}
        if os.path.exists(planfile):
            prev = json.load(open(planfile))
        removals = prev.get("removals", [])

        built = build_plan(src, dur, sil, a.pad, removals)
        plan = {"src": src, "out": "local/cut.mp4", "fps": FPS,
                "source_duration": round(dur, 3), "pad": a.pad,
                "noise_db": a.noise, "min_silence": a.min_silence,
                "removals": removals, **built}
        kept = sum(s["end"] - s["start"] for s in plan["segments"])
        plan["cut_duration"] = round(kept, 3)
        os.makedirs(os.path.dirname(planfile), exist_ok=True)
        json.dump(plan, open(planfile, "w"), indent=2, ensure_ascii=False)

        print(f"  fuente   {dur:6.2f}s")
        print(f"  corte    {kept:6.2f}s   (−{dur-kept:.2f}s en {len(plan['cuts'])} cortes)")
        print(f"  plan  →  {planfile}\n")
        for c in plan["cuts"]:
            print(f"  {c['start']:7.2f} → {c['end']:7.2f}  −{c['removed']:.2f}s  {c['why']}")
        return

    if a.aplicar:
        if not os.path.exists(planfile):
            sys.exit("✗ no hay plan. Corré --plan primero.")
        plan = json.load(open(planfile))
        out = render(proj, plan)
        real = probe_duration(out)
        print(f"✓ {out}  ({real:.2f}s)")
        print("\n⛔ RE-TRANSCRIBIR AHORA — el .srt viejo miente sobre este corte:")
        print(f'   whisper "{out}" --model medium --language es --word_timestamps True '
              f'--output_format all --output_dir "{os.path.join(proj,"local")}"')
        return

    ap.print_help()

if __name__ == "__main__":
    main()
