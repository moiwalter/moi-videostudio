#!/usr/bin/env python3
"""music.py — la partitura del formato qmd-vertical.

Compone con pretty_midi (la misma grilla que goldmine v3.3: un protagonista de
principio a fin, capas que se suman, un solo silencio, cadencia en el cierre).
Renderiza con FluidSynth si se le pasan los soundfonts. Esos archivos no están
en el repo: pipeline/docs/ACTIVOS-EXTERNOS.md.

  music.py --out DIR                 escribe partitura.json (notas + reloj)
  music.py --out DIR --midi          además music.mid, si pretty_midi está instalado
  music.py --out DIR --render --piano-sf SF2 --gm-sf SF2 --drums DIR --voice WAV --fluidsynth BIN

Los defaults de tiempo son los de goldmine v3.3. Otro episodio los pasa por flag.
"""
import argparse, json, sys
from pathlib import Path

from qmd_lib import partitura


def main(argv=None):
    ap = argparse.ArgumentParser(description="Partitura qmd-vertical (goldmine v3.3 por default)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--hit", type=float, default=None)
    ap.add_argument("--gold", type=float, default=None)
    ap.add_argument("--mint", type=float, default=None)
    ap.add_argument("--drop", type=float, default=None)
    ap.add_argument("--dur", type=float, default=None)
    ap.add_argument("--midi", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--piano-sf")
    ap.add_argument("--gm-sf")
    ap.add_argument("--drums")
    ap.add_argument("--voice")
    ap.add_argument("--fluidsynth")
    args = ap.parse_args(argv)
    score = partitura(hit=args.hit, gold=args.gold, mint=args.mint, drop=args.drop, dur=args.dur)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "partitura.json").write_text(json.dumps({k: v for k, v in score.items() if k != "notes"} | {"voces": {k: len(v) for k, v in score["notes"].items()}}, indent=1))
    if args.midi or args.render:
        escribir_midi(score, out / "music.mid")
    if args.render:
        if not all([args.piano_sf, args.gm_sf, args.drums, args.fluidsynth]):
            sys.exit("render pide --piano-sf --gm-sf --drums --fluidsynth (ver ACTIVOS-EXTERNOS.md)")
        sys.exit("el render de audio (FluidSynth + buses + duck) usa los soundfonts locales; la partitura ya está en music.mid. "
                 "La mezcla medida (duck 5 dB, margen de voz, -14 LUFS) la cierra master_mix.py.")
    print(json.dumps({"bpm": score["bpm"], "bar_s": score["bar_s"], "voces": {k: len(v) for k, v in score["notes"].items()}}))


def escribir_midi(score, path):
    try:
        import pretty_midi as pm
    except ImportError:
        sys.exit("falta pretty_midi (pip install pretty_midi). La partitura.json ya se escribió.")
    mid = pm.PrettyMIDI(initial_tempo=score["bpm"])
    programas = {"piano": 0, "bass": 33, "pizz": 45, "strings": 49, "pad": 89}
    inst = {}
    for name in score["notes"]:
        if name not in inst:
            inst[name] = pm.Instrument(programas.get(name, 0), name=name, is_drum=name == "crash")
            mid.instruments.append(inst[name])
    for name, notes in score["notes"].items():
        for pitch, start, end, vel in notes:
            inst[name].notes.append(pm.Note(velocity=vel, pitch=pitch, start=start, end=end))
    mid.write(str(path))


if __name__ == "__main__":
    main()
