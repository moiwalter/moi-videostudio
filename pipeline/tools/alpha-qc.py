#!/usr/bin/env python3
"""alpha-qc — el gate que impide que un overlay se vea bien sobre negro y mal sobre Walter.

EL PROBLEMA QUE ATRAPA
  Un `box-shadow: 0 30px 80px rgba(0,0,0,.62)` o un `text-shadow: 0 6px 34px rgba(0,0,0,.72)`
  se hornea en el ProRes 4444 como **negro con alpha parcial**. Sobre fondo negro (QuickTime)
  es INVISIBLE. Sobre el talking-head de Walter es una mancha oscura con borde alrededor de
  cada card y cada texto. Igual una card semitransparente: sobre negro se ve sólida, sobre
  su cara se ve a través.

TRES MODOS
  --css  <index.html>    lint ANTES de renderizar (barato, atrapa el 95%) — GATE DURO
  --premult <clip.mov>   ¿está premultiplicado? la prueba objetiva de CapCut — GATE DURO
  <clip.mov>             medición de píxeles reales + contact sheet (indicadores, no gate)

MÉTRICAS
  veil%        px del cuadro que son negro-casi-puro con alpha parcial
  seethrough%  px del cuadro en la banda 0.15<a<0.85 (cards translúcidas)
  premult p99  p99 de max(R,G,B)/A en alpha parcial: ~1.0 premultiplicado, >>1 straight

USO
  python3 tools/alpha-qc.py --css scenes/S02-titulo/index.html
  python3 tools/alpha-qc.py --premult scenes/S02-titulo/renders/S02-titulo_ALPHA.mov
  python3 tools/alpha-qc.py scenes/S02-titulo/renders/S02-titulo_ALPHA.mov
"""
import re, sys, subprocess, pathlib

VEIL_PASS, VEIL_WARN = 1.5, 3.0        # % del cuadro
SEE_PASS,  SEE_WARN  = 8.0, 14.0
MAX_DARK_RADIUS = 8                     # px — un shadow negro más grande es una mancha
SMUDGE_ALPHA = 0.25                     # oscuro + radio grande + ESTA opacidad = falla dura
VEIL_ALPHA = 0.12                       # oscuro + radio muy grande + esto = solo warning
PREMULT_MAX = 1.30                      # p99(RGB/A) arriba de esto === straight === roto en CapCut

# ---------------------------------------------------------------- helpers
def dims(path):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                            "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                           capture_output=True, text=True).stdout.strip()
    return (int(x) for x in probe.split(","))

def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                 "-of", "csv=p=0", path], capture_output=True, text=True).stdout)

def rgba_frames(path, fractions=(0.18, 0.35, 0.5, 0.68, 0.85)):
    """devuelve los planos RGBA en [0,1] en cada fracción del clip"""
    import numpy as np
    W, H = dims(path)
    dur = duration(path)
    for fr in fractions:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(dur * fr), "-i", path,
                              "-frames:v", "1", "-pix_fmt", "rgba64le", "-f", "rawvideo", "-"],
                             capture_output=True).stdout
        a = np.frombuffer(raw, dtype="<u2")
        if a.size != W * H * 4:
            continue
        f = a.reshape(H, W, 4).astype(np.float64) / 65535.0
        yield f[..., 0], f[..., 1], f[..., 2], f[..., 3]

# ---------------------------------------------------------------- CSS lint
def split_layers(val):
    """parte una lista de shadows por comas de TOP LEVEL (no las de rgba(...))"""
    out, depth, cur = [], 0, ""
    for ch in val:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out

def lint_css(path):
    src = pathlib.Path(path).read_text()
    bad, lumpy, veils = [], [], []

    # 1) CSS:  box-shadow: … ;      2) GSAP:  boxShadow:'…'
    #    Las de GSAP PISAN el CSS — si solo se lintea el CSS, el bug vuelve al reproducir
    #    la animación. (Wallbit 3: el "glow" del título vivía solo en el JS.)
    #    OJO con el set de terminadores: una declaración dentro de un style="…" inline termina
    #    en la comilla, no en `;`. Cortando solo en `;}` un match se comía la declaración
    #    SIGUIENTE y medía el blur equivocado — o sea, una mancha real reportada como limpia.
    decls = [(m.group(1), m.group(2), m.start())
             for m in re.finditer(r"""(box-shadow|text-shadow)\s*:\s*([^;}"'\n]+)""", src)]
    decls += [(("box-shadow" if m.group(1) == "boxShadow" else "text-shadow") + " [JS]",
               m.group(2), m.start())
              for m in re.finditer(r"(boxShadow|textShadow)\s*:\s*'([^']*)'", src)]

    for prop, val, pos in decls:
        for layer in split_layers(val):
            if "inset" in layer:
                continue                      # los inset son rims, no manchas
            col = re.search(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?", layer)
            if not col:
                continue
            r, g, b = (int(x) for x in col.groups()[:3])
            alpha = float(col.group(4)) if col.group(4) else 1.0
            nums = [int(n) for n in re.findall(r"(-?\d+)px", layer)]
            blur = nums[2] if len(nums) >= 3 else (nums[1] if len(nums) == 2 else 0)
            line = src[:pos].count("\n") + 1
            if max(r, g, b) > 90:
                # glow de color: legítimo, PERO un text-shadow muy borroso sobre una
                # tipografía display sale grumoso (una copia difusa por glifo), no un halo.
                if "text-shadow" in prop and blur > 20:
                    lumpy.append((line, blur, layer.strip()[:70]))
                continue
            # No es la oscuridad, es la OPACIDAD. Una sombra de elevación tipo Carbon es
            # rgba(22,22,22,.09) a 10-14px y no se ve sobre el footage. Las manchas que
            # originaron este gate eran .62-.72 a 34-80px. Gatear por los dos, o el gate
            # salta con cada card legítima y alguien lo apaga con ALPHA_QC=off.
            if blur > MAX_DARK_RADIUS and alpha >= SMUDGE_ALPHA:
                bad.append((line, prop, blur, alpha, layer.strip()[:70]))
            elif blur > 24 and alpha >= VEIL_ALPHA:
                veils.append((line, prop, blur, alpha, layer.strip()[:70]))

    # fondos oscuros muy translúcidos (cards que se ven a través)
    trans = []
    for m in re.finditer(r"background\s*:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\.\d+|0?\.\d+|\d)\s*\)", src):
        r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), float(m.group(4))
        if max(r, g, b) < 110 and 0.05 < a < 0.85:
            trans.append((src[:m.start()].count("\n") + 1, f"rgba({r},{g},{b},{a})"))

    print(f"\n  CSS LINT · {path}")
    if bad:
        print(f"  ✗ {len(bad)} sombra(s) oscura(s) de radio > {MAX_DARK_RADIUS}px a opacidad ≥{SMUDGE_ALPHA} "
              f"— cada una es una mancha sobre el footage:")
        for line, prop, blur, alpha, txt in bad[:12]:
            print(f"      L{line:<4} {prop}  blur={blur}px  alpha={alpha}   {txt}")
    else:
        print(f"  ✓ sin sombras oscuras de radio > {MAX_DARK_RADIUS}px a opacidad ≥{SMUDGE_ALPHA}")
    if veils:
        print(f"  ! {len(veils)} sombra(s) oscura(s) anchas y suaves (>24px, alpha ≥{VEIL_ALPHA}) — no es "
              f"falla dura, pero míralas sobre el footage, nunca sobre negro:")
        for line, prop, blur, alpha, txt in veils[:8]:
            print(f"      L{line:<4} {prop}  blur={blur}px  alpha={alpha}   {txt}")
    if lumpy:
        print(f"  ! {len(lumpy)} text-shadow de color muy borroso — sobre tipografía display "
              f"sale GRUMOSO (una copia difusa por glifo), no un glow:")
        for line, blur, txt in lumpy[:8]:
            print(f"      L{line:<4} blur={blur}px   {txt}")
        print("      → un glow de verdad es un radial-gradient DETRÁS del texto "
              "(color con alpha→0), no un text-shadow.")
    if trans:
        print(f"  ! {len(trans)} fondo(s) oscuro(s) translúcido(s) — se ve a Walter a través:")
        for line, txt in trans[:8]:
            print(f"      L{line:<4} {txt}")
    return 1 if bad else 0

# ---------------------------------------------------------------- premultiply
def check_premult(path):
    """La prueba objetiva de CapCut. En alpha premultiplicado el color ya viene multiplicado
    por el alpha, así que RGB nunca puede superar a A. En straight, un dorado al 20% de alpha
    da RGB≈0.97 / A=0.20 → 4.8. Se mide en 0.08<A<0.75 para que los píxeles opacos (ratio
    siempre ≈1) no tapen el resultado."""
    import numpy as np
    ratios = []
    for R, G, B, A in rgba_frames(path):
        band = (A > 0.08) & (A < 0.75)
        if band.sum() < 500:                      # este frame no tiene píxeles suaves suficientes
            continue
        mx = np.maximum(np.maximum(R, G), B)[band]
        ratios.append(np.percentile(mx / A[band], 99))
    print(f"\n  PREMULTIPLY CHECK · {pathlib.Path(path).name}")
    if not ratios:
        print("  ! ningún frame tuvo píxeles de alpha parcial (0.08<A<0.75) suficientes para medir.")
        print("    Un clip 100% opaco no puede reproducir el bug — no hay nada que gatear. PASA por vacío.")
        return 0
    p99 = max(ratios)
    print(f"    p99( max(R,G,B) / A ) = {p99:.2f}    (≈1.0 premultiplicado · >>1 straight)")
    if p99 > PREMULT_MAX:
        print(f"  ✗ alpha STRAIGHT — esto VA a reventar a blanco en CapCut.")
        print(f"    Arreglo (transcode, no re-render):  tools/premultiply.sh {path}")
        return 1
    print("  ✓ premultiplicado — seguro para componer en CapCut")
    return 0

# ---------------------------------------------------------------- pixel check
def measure(path):
    import numpy as np
    worst_v = worst_s = 0.0
    for R, G, B, A in rgba_frames(path):
        partial = (A > 0.03) & (A < 0.92)
        luma = 0.2126 * R + 0.7152 * G + 0.0722 * B
        # una SOMBRA es negro casi puro (luma/A ≈ 0). El navy de marca #022C43 da ≈0.14,
        # así que 0.07 separa "mancha horneada" de "card oscura legítima".
        veil = partial & (luma / np.maximum(A, 1e-6) < 0.07)
        see = (A > 0.15) & (A < 0.85)
        worst_v = max(worst_v, 100 * veil.mean())
        worst_s = max(worst_s, 100 * see.mean())
    return worst_v, worst_s

def sheet(path, plate):
    """composite sobre negro | blanco | el footage real, lado a lado"""
    out = str(pathlib.Path(path).with_name("_qc_sheet.png"))
    W, H = dims(path)
    t = duration(path) * 0.5
    bgs = [f"color=c=black:s={W}x{H}", f"color=c=white:s={W}x{H}"]
    args = ["ffmpeg", "-y", "-v", "error"]
    for b in bgs:
        args += ["-f", "lavfi", "-i", b]
    if plate and pathlib.Path(plate).exists():
        args += ["-i", str(plate)]
    args += ["-ss", str(t), "-i", path]
    n = 3 if (plate and pathlib.Path(plate).exists()) else 2
    ov = "".join(f"[{i}:v][{n}:v]overlay=0:0:shortest=1,scale=420:-1[o{i}];" for i in range(n))
    ov += "".join(f"[o{i}]" for i in range(n)) + f"hstack=inputs={n}"
    args += ["-filter_complex", ov, "-frames:v", "1", out]
    subprocess.run(args, capture_output=True)
    return out

def main():
    if "--css" in sys.argv:
        sys.exit(lint_css(sys.argv[sys.argv.index("--css") + 1]))
    if "--premult" in sys.argv:
        sys.exit(check_premult(sys.argv[sys.argv.index("--premult") + 1]))
    clip = pathlib.Path(sys.argv[1]).resolve()
    plate = None
    for p in clip.parents:                     # busca <proyecto>/local/qc-plate.png hacia arriba
        cand = p / "local" / "qc-plate.png"
        if cand.exists():
            plate = cand; break
    v, s = measure(str(clip))
    img = sheet(str(clip), plate)
    print(f"\n  ALPHA QC · {clip.name}")
    print(f"    veil (negro casi puro a alpha parcial) : {v:5.2f}% del cuadro")
    print(f"    banda translúcida (0.15<a<0.85)        : {s:5.2f}% del cuadro")
    print(f"    contact sheet → {img}")
    print(f"      ↑ negro | blanco{' | tu footage real' if plate else ''}."
          f"  **Se juzga en el panel de la derecha**, no en el negro.")
    if not plate:
        print("      (sin qc-plate.png en <proyecto>/local/ — se comparó solo contra blanco)")
    print("\n    Nota: estos dos números son INDICADORES para comparar antes/después de la misma")
    print("    escena, no umbrales calibrados. Los gates duros son `--css` y `--premult`.")
    sys.exit(0)

if __name__ == "__main__":
    main()
