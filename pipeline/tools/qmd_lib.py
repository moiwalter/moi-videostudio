#!/usr/bin/env python3
"""Funciones puras del formato qmd-vertical, medidas en goldmine v3.3.

Sin pesos de red, soundfonts ni muestras. Esas piezas están en
pipeline/docs/ACTIVOS-EXTERNOS.md. Los CLIs (rvm_matte, make_alpha, music,
master_mix, sfx, qa, edge_flicker) importan de acá los números y la aritmética
que se puede probar sin el material.
"""
from __future__ import annotations

import numpy as np

# Recorte. make_alpha.py y rvm_matte.py usan estos defaults.
MATTE = {
    "levels": (0.035, 0.97),
    "choke_px": 1,
    "feather_sigma": 1.4,
    "alpha_gamma": 1.15,
    "light_wrap": 0.22,
    "guided_radius": 4,
    "guided_eps": 1e-3,
    "guided_blend": 0.6,
    "prescale": 1.2,
    "unsharp_amount": 0.40,
    "unsharp_sigma": 1.1,
    "downsample_ratio": 0.4,
    "temporal_radius": 3,
}

# Mezcla. music.py / master_mix.py / qa.py.
MEZCLA = {
    "lufs": -14.0,
    "true_peak_dbtp": -1.0,
    "limiter_ceiling_dbtp": -1.8,
    "duck_db": 5.0,
    "cama_lu_antes_del_duck": 9.5,
    "margen_voz_db": 12.0,
    "banda_hz": (300, 3500),
    "solape_s": 0.27,
    "quietud_s": 1.0,
}

# Partitura de referencia (goldmine v3.3). Un episodio nuevo pasa otros tiempos.
GOLD = {"hit": 1.08, "gold": 22.78, "mint": 9.82, "drop": 21.45, "dur": 27.3, "seed": 1108}


def reloj(hit, gold, compases=10):
    """El compás sale de los dos downbeats que tienen que caer en frases, no de un BPM elegido a ojo."""
    if gold <= hit:
        raise ValueError("gold tiene que ser posterior al golpe")
    bar = (gold - hit) / compases
    beat = bar / 4
    return {"bar": bar, "beat": beat, "e8": beat / 2, "e16": beat / 4, "bpm": 60 / beat}


def en_silencio(t, drop, gold):
    return drop - 1e-3 <= t < gold - 1e-3


def luz_wrap(rgb, escena, peso, amount=None):
    """Mezcla `amount` del color de escena en el borde. peso 1 → exactamente amount."""
    amount = MATTE["light_wrap"] if amount is None else amount
    rgb = np.asarray(rgb, np.float64)
    escena = np.asarray(escena, np.float64)
    peso = np.clip(np.asarray(peso, np.float64), 0, 1)
    lw = amount * np.clip(peso * 2, 0, 1)
    while lw.ndim < rgb.ndim:
        lw = lw[..., None]
    return rgb * (1 - lw) + escena * lw


def ancla_cabeza(mask):
    """Fila superior del alfa y centro de la cabeza, en píxeles de la máscara."""
    m = np.asarray(mask, bool)
    if not m.any():
        raise ValueError("máscara vacía")
    rows = np.where(m.any(1))[0]
    top = int(rows[0])
    band = m[min(top + 14, m.shape[0] - 1)]
    xs = np.where(band)[0]
    if not len(xs):
        xs = np.where(m[top])[0]
    return {"top": top, "cx": float(xs.min() + xs.max()) / 2}


def hervir(a0, a1, a2, lo=0.04, hi=0.96):
    """Diferencia temporal de 2.º orden en la banda del borde. El movimiento constante se cancela; el jitter no."""
    a0, a1, a2 = (np.asarray(a, np.float64) for a in (a0, a1, a2))
    band = (a1 > lo) & (a1 < hi)
    if int(band.sum()) < 1:
        return {"pixeles": 0, "boil_mean": 0.0, "jitter_share": 0.0}
    b = np.abs(a1 - 0.5 * (a0 + a2))[band]
    return {"pixeles": int(band.sum()), "boil_mean": float(b.mean()), "jitter_share": float((b > 0.10).mean())}


def plan_keep(cuts, duracion, fps=60):
    """Spans que se quedan, a 1×. Sólo se quita lo que está en cuts. Nada se estira."""
    fr = lambda t: round(round(t * fps) / fps, 6)
    keep, t = [], 0.0
    for c in sorted(cuts, key=lambda c: c["from"]):
        s, e = fr(c["from"]), fr(c["to"])
        if s > t:
            keep.append([t, s])
        t = e
    if t < duracion and not any(c.get("tail") for c in cuts):
        keep.append([t, fr(duracion)])
    keep = [k for k in keep if k[1] - k[0] > 1 / fps]
    for s, e in keep:
        if e < s:
            raise ValueError("span invertido")
    return keep


def refinar_palabras(words, voiced, min_dur=0.06, fixes=None):
    """Un inicio en silencio se corre al próximo onset; un final en silencio, al último cuadro con voz.

    `voiced(t)` dice si ese instante supera el piso (en v3.3, −40 dBFS). `fixes` es una lista
    opcional de overrides del episodio `[{w, s0, s, e}]`; goldmine no los trae por default.
    """
    out = []
    for wd in words:
        s, e = float(wd["s"]), float(wd["e"])
        if not voiced(s):
            t = s
            while t < e + 0.15 and not voiced(t):
                t = round(t + 0.01, 2)
            if voiced(t):
                s = t
        if not voiced(e - 0.01):
            t = e
            while t > s and not voiced(t):
                t = round(t - 0.01, 2)
            e = max(s + min_dur, t + 0.01)
        if out and s < out[-1]["e"]:
            s = out[-1]["e"]
        out.append({"w": wd["w"], "s": round(s, 2), "e": round(max(e, s + min_dur), 2), "p": wd.get("p", 1)})
    for fx in fixes or []:
        for o in out:
            if o["w"] == fx["w"] and abs(o["s"] - fx["s0"]) < 0.03:
                o["s"], o["e"] = fx["s"], fx["e"]
    return out


def ganancia_techo(voz_db, musica_db, margen=None, piso_voz=-34.0, piso_ganancia=-15.0):
    """dB a aplicar a la música en una ventana para que la voz le saque `margen` en la banda del habla."""
    margen = MEZCLA["margen_voz_db"] if margen is None else margen
    if voz_db <= piso_voz:
        return 0.0
    return max(piso_ganancia, min(0.0, (voz_db - margen) - musica_db))


def limitador(x, ceiling_db, sr, lookahead_s=0.005, release_s=0.08):
    """Limitador con look-ahead por el pico de muestra (master_mix.py). Devuelve audio y la ganancia."""
    x = np.asarray(x, np.float64)
    mono = np.abs(x).max(axis=1) if x.ndim > 1 else np.abs(x)
    ceil = 10 ** (ceiling_db / 20)
    need = np.minimum(1.0, ceil / np.maximum(mono, 1e-9))
    la = max(1, round(lookahead_s * sr))
    # mínimo en la ventana de look-ahead: la ganancia llega antes del pico
    ker = np.ones(2 * la + 1)
    g = np.array([need[max(0, i - la):min(len(need), i + la + 1)].min() for i in range(len(need))])
    rel = np.exp(-1 / (release_s * sr))
    s, out = 1.0, np.empty_like(g)
    for i, v in enumerate(g):
        s = v if v < s else rel * s + (1 - rel) * v
        out[i] = s
    y = x * (out[:, None] if x.ndim > 1 else out)
    return y, out


def acumular_solapes(pares_por_cuadro, dt, umbral=None):
    """Suma el tiempo de cada par. Falla el que supera el umbral (0.27 s en v3.3)."""
    umbral = MEZCLA["solape_s"] if umbral is None else umbral
    acc = {}
    for pares in pares_por_cuadro:
        for a, b in pares:
            k = tuple(sorted((a, b)))
            acc[k] = acc.get(k, 0.0) + dt
    malos = {k: v for k, v in acc.items() if v > umbral}
    return {"todos": acc, "malos": malos}


def quietud(deltas, fps, umbral=0.12, max_s=None):
    """Racha más larga por debajo de `umbral`. El gate falla si pasa de max_s (1 s en v3.3)."""
    max_s = MEZCLA["quietud_s"] if max_s is None else max_s
    run = best = 0
    for s in np.asarray(deltas) < umbral:
        run = run + 1 if s else 0
        best = max(best, run)
    seg = best / fps
    return {"segundos": seg, "ok": seg <= max_s + 1e-9}


def filtro_peligroso(js):
    """True si el timeline puede arrancar el brillo de la persona en 0.

    GSAP interpola un filter que empieza en "none" a través de brightness(0).
    """
    t = js.replace(" ", "")
    if "brightness(0)" in t or "brightness(0px)" in t:
        return True
    return 'filter:"none"' in t or "filter:'none'" in t


def _nota(ins, notes, p, t, length, vel, drop, gold, dur):
    if en_silencio(t, drop, gold) or t >= dur - 0.05:
        return
    end = min(t + length, dur)
    if t < drop <= end:
        end = drop - 0.005
    if end <= t:
        return
    notes.setdefault(ins, []).append((int(p), round(t, 4), round(end, 4), int(np.clip(round(vel), 1, 127))))


def partitura(hit=None, gold=None, mint=None, drop=None, dur=None, seed=None):
    """La partitura de goldmine v3.3 como notas (pitch, start, end, vel), sin pretty_midi ni FluidSynth.

    Un protagonista de principio a fin, capas que se suman en el takeover, un solo silencio
    entre `drop` y `gold`, y una cadencia que resuelve en el cierre.
    """
    hit = GOLD["hit"] if hit is None else hit
    gold = GOLD["gold"] if gold is None else gold
    mint = GOLD["mint"] if mint is None else mint
    drop = GOLD["drop"] if drop is None else drop
    dur = GOLD["dur"] if dur is None else dur
    seed = GOLD["seed"] if seed is None else seed
    clk = reloj(hit, gold)
    bar, beat, e8 = clk["bar"], clk["beat"], clk["e8"]
    rng = np.random.default_rng(seed)
    B_MINT = 4

    def at(k, bt=0.0):
        return hit + k * bar + bt * beat

    ch = {
        "Csus": (36, [55, 60, 62, 65, 67]),
        "C": (36, [55, 60, 62, 64, 67]),
        "Bbmaj9": (34, [53, 57, 60, 62, 65]),
        "Dm9": (38, [53, 57, 60, 64, 65]),
        "Gm9": (31, [53, 55, 58, 62, 65]),
        "F/A": (33, [53, 57, 60, 64, 65]),
        "Fadd9": (41, [53, 57, 60, 65, 67]),
    }
    prog = ["Bbmaj9", "Dm9", "Gm9", "Csus", "Bbmaj9", "F/A", "Dm9", "Gm9", "Bbmaj9", "Csus", "Fadd9"]
    end_ch = [(gold, "Fadd9"), (gold + 2 * beat, "Bbmaj9"), (gold + bar, "Csus"), (gold + bar + beat, "C"), (gold + bar + 2 * beat, "Fadd9")]
    fin = end_ch[-1][0]

    def chord_at(t):
        if t < hit:
            return "Csus"
        if t >= gold:
            return [c for t0, c in end_ch if t0 <= t + 1e-6][-1]
        k = min(int((t - hit) // bar), 10)
        if prog[k] == "Csus" and (t - at(k)) >= 2 * beat:
            return "C"
        return prog[k]

    def intensity(t):
        pts = [(0, 0.42), (hit - 0.01, 0.5), (hit, 0.78), (hit + 1.2, 0.6), (3.2, 0.55), (mint - 0.1, 0.62),
               (at(B_MINT), 0.74), (14, 0.7), (18, 0.8), (drop, 0.9), (gold, 1.0), (gold + bar, 0.9), (fin, 0.85), (dur, 0.7)]
        x, y = zip(*pts)
        return float(np.interp(t, x, y))

    notes = {}
    shape = [0, 2, 4, 2, 3, 1, 4, 2]
    k8, t = 0, hit - 2 * beat
    while t < fin - 1e-3:
        c = chord_at(t + 1e-4)
        v = ch[c][1]
        i = shape[k8 % 8]
        p = v[i] + (12 if (t >= at(B_MINT) and k8 % 8 in (2, 6)) else 0)
        vel = 38 + 46 * intensity(t) + (10 if k8 % 2 == 1 else 0) + int(rng.integers(-3, 4))
        _nota("piano", notes, p, t, e8 * 1.6, vel, drop, gold, dur)
        t += e8
        k8 += 1
    for k in range(11):
        b = ch[prog[k]][0]
        _nota("piano", notes, b + 12, at(k), bar * 0.45, 40 + 26 * intensity(at(k)), drop, gold, dur)
    for p, a, d in [(69, 0, 3), (72, 3, 3), (74, 6, 1), (72, 7, 5)]:
        _nota("piano", notes, p + 12, hit + a * e8, d * e8 * 1.05, 84, drop, gold, dur)
        _nota("piano", notes, p + 12, at(B_MINT) + a * e8, d * e8 * 1.05, 86, drop, gold, dur)
    for j, p in enumerate([41, 53, 60, 65, 69, 72, 77]):
        _nota("piano", notes, p, gold + j * 0.012, 2 * beat, 96 - j * 3, drop, gold, dur)
    for t0, c in end_ch[1:]:
        b = ch[c][0]
        _nota("piano", notes, b + 12, t0, 2 * beat * 0.9, 66, drop, gold, dur)
    _nota("piano", notes, 81, fin, dur - fin, 78, drop, gold, dur)
    for k in range(10):
        r = ch[prog[k]][0] + (12 if ch[prog[k]][0] < 33 else 0)
        if k < B_MINT:
            for bt, length, vel in [(0, 1.3, 92), (1.5, 0.45, 70), (2, 1.3, 84)]:
                _nota("bass", notes, r, at(k, bt), length * beat, vel, drop, gold, dur)
        else:
            for e in range(8):
                _nota("bass", notes, r, at(k, e / 2), e8 * 0.8, 96 if e % 2 == 0 else 74, drop, gold, dur)
    _nota("bass", notes, 29, gold, 2 * beat, 110, drop, gold, dur)
    return {
        "bpm": round(clk["bpm"], 2),
        "bar_s": round(bar, 4),
        "hit": hit,
        "gold": gold,
        "drop": [drop, gold],
        "fin": round(fin, 4),
        "dur": dur,
        "cadence": [[round(t0, 3), c] for t0, c in end_ch],
        "notes": notes,
    }


def notas_en(notes, t0, t1):
    return [n for ns in notes.values() for n in ns if t0 <= n[1] < t1]
