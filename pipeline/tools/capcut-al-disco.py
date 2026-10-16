#!/usr/bin/env python3
"""capcut-al-disco.py — apunta los proyectos de CapCut directo al Extreme Pro.

CapCut está en sandbox: NO sigue los symlinks que deja `mover-al-disco.sh enlazar`
(probado 10-oct-2026 con "Opciones": todo "File not accessible"). Pero sí abre
archivos del disco externo si la ruta apunta ahí. Este script reescribe, en cada
borrador, la ruta de cada video que ya tiene copia verificada (md5) en el disco:

  ~/Movies/VideoStudio/proyectos/X  →  /Volumes/Extreme Pro/VideoStudio/proyectos/X

Sólo toca rutas que estén en ok.lst0 (copiadas y verificadas por `copiar`).
Antes de escribir, respalda los archivos de texto del borrador en $RESPALDO.
CapCut tiene que estar CERRADO.

Uso:
  capcut-al-disco.py                      # simulacro: todos los borradores, no escribe
  capcut-al-disco.py --aplicar "Opciones" # un borrador
  capcut-al-disco.py --aplicar --todos
  capcut-al-disco.py --deshacer "Opciones"   # vuelve a la ruta del Mac
  capcut-al-disco.py --mapa=mapa.json [--aplicar --todos]   # mapa propio {vieja: nueva}
"""
import os, re, sys, json, shutil, subprocess, datetime

HOME = os.path.expanduser("~")
SRC = os.path.join(HOME, "Movies/VideoStudio")
DEST = "/Volumes/Extreme Pro/VideoStudio"
DRAFTS = os.path.join(HOME, "Movies/CapCut/User Data/Projects/com.lveditor.draft")
LOG = os.environ.get("VS_LOG", "/tmp/videostudio-mover")
OK = [os.path.join(LOG, "ok.lst0"), os.path.join(SRC, "_mover-estado-2026-10-10/ok.lst0")]
RESPALDO = os.path.join(SRC, "_mover-estado-2026-10-10/capcut-antes")
TEXT_EXT = (".json", ".bak", ".tmp", ".extra")


def verified():
    path = next((p for p in OK if os.path.exists(p)), None)
    if not path:
        sys.exit("⛔ No encuentro ok.lst0 (lista de videos verificados en el disco).")
    out = {}
    for rec in open(path, "rb").read().split(b"\0"):
        if rec:
            rel = rec.decode().split(" ", 2)[2]
            out[os.path.join(SRC, rel)] = os.path.join(DEST, rel)
    return out


QUOTED = re.compile(r'"((?:\\?/)(?:Users|Volumes)(?:\\?/)(?:[^"\\\n]|\\.)*)"')


def convert(raw, mapping):
    """raw = contenido entre comillas tal como está en el archivo. Devuelve el reemplazo o None."""
    try:
        real = json.loads('"' + raw + '"')
    except ValueError:
        return None
    new = mapping.get(real)
    if new is None:
        return None
    out = json.dumps(new, ensure_ascii="\\u" in raw)[1:-1]
    if "\\/" in raw:
        out = out.replace("/", "\\/")
    return out


def draft_files(d):
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(TEXT_EXT) or f in ("draft_settings",):
                yield os.path.join(root, f)


def plan_for(d, mapping):
    """{archivo: [(viejo, nuevo)]} — sólo strings completos entre comillas que sean una ruta verificada."""
    plan = {}
    for f in draft_files(d):
        try:
            s = open(f, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        if "Users" not in s and "Volumes" not in s:
            continue
        hits = []
        for m in QUOTED.finditer(s):
            new = convert(m.group(1), mapping)
            if new is not None:
                hits.append((m.group(1), new))
        if hits:
            plan[f] = hits
    return plan


def apply(f, mapping):
    s = open(f, encoding="utf-8").read()
    s = QUOTED.sub(lambda m: '"' + (convert(m.group(1), mapping) or m.group(1)) + '"', s)
    tmp = f + ".__rel"
    open(tmp, "w", encoding="utf-8").write(s)
    if f.endswith(".json"):
        try:
            json.loads(s)
        except ValueError:
            os.remove(tmp)
            raise SystemExit(f"⛔ quedaría JSON inválido, no toco: {f}")
    os.replace(tmp, f)


def main():
    args = sys.argv[1:]
    aplicar = "--aplicar" in args
    deshacer = "--deshacer" in args
    todos = "--todos" in args
    names = [a for a in args if not a.startswith("--")]
    if (aplicar or deshacer) and not (names or todos):
        sys.exit("⛔ Di qué borradores: nombres o --todos.")
    if aplicar or deshacer:
        if subprocess.run(["pgrep", "-x", "CapCut"], capture_output=True).returncode == 0:
            sys.exit("⛔ CapCut está abierto. Ciérralo (Cmd+Q) y vuelve a correr.")
        if not os.path.isdir(DEST):
            sys.exit("⛔ El Extreme Pro no está montado.")

    mapa = next((x.split("=", 1)[1] for x in args if x.startswith("--mapa=")), None)
    # --mapa=archivo.json: {ruta_vieja: ruta_nueva} — para medios que ya estaban perdidos y se encontraron en el disco
    mapping = json.load(open(mapa)) if mapa else verified()
    if deshacer:
        mapping = {v: k for k, v in mapping.items()}

    drafts = sorted(d for d in os.listdir(DRAFTS) if os.path.isdir(os.path.join(DRAFTS, d)))
    if names:
        missing = [n for n in names if n not in drafts]
        if missing:
            sys.exit(f"⛔ No existe el borrador: {missing}")
        drafts = names

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    total_d = total_r = 0
    for name in drafts:
        d = os.path.join(DRAFTS, name)
        plan = plan_for(d, mapping)
        if not plan:
            continue
        refs = sum(len(h) for h in plan.values())
        vids = {json.loads('"' + vo + '"') for hits in plan.values() for vo, _ in hits}
        total_d += 1
        total_r += refs
        print(f"{name}: {len(vids)} videos, {refs} rutas en {len(plan)} archivos")
        if aplicar or deshacer:
            bk = os.path.join(RESPALDO, stamp, name)
            for f in plan:
                dst = os.path.join(bk, os.path.relpath(f, d))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(f, dst)
            for f in plan:
                apply(f, mapping)
            left = plan_for(d, mapping)
            print("   ✅ aplicado" if not left else f"   ⚠️ quedaron rutas sin cambiar en {list(left)}")
    verbo = "deshecho" if deshacer else ("aplicado" if aplicar else "SIMULACRO (no escribí nada)")
    print(f"\n{verbo}: {total_d} borradores, {total_r} rutas.")
    if aplicar or deshacer:
        print(f"Respaldo: {os.path.join(RESPALDO, stamp)}")


if __name__ == "__main__":
    main()
