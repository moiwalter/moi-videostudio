#!/usr/bin/env python3
"""capcut-borrador.py — crea un borrador de CapCut con UN video entero en la línea de tiempo.

Para entregar un master de HyperFrames por CapCut (Walter exporta desde ahí). CapCut no tiene API:
se clona un borrador de un solo clip que ya abre y exporta bien, y se le cambia el video.
Probado 14-oct-2026 con «cvander preguntale humano ep01» (abrió y exportó a la primera).

Uso:
  capcut-borrador.py <video.mp4> --nombre "cvander xxx"            # simulacro, no escribe
  capcut-borrador.py <video.mp4> --nombre "cvander xxx" --aplicar  # crea el borrador
  opciones: --plantilla "<borrador de 1 clip>" (default: cvander preguntale humano ep01)
            --base <carpeta com.lveditor.draft> (para probar sobre una copia)

Reglas:
  - CapCut CERRADO (lee root_meta_info.json al abrir y lo reescribe al cerrar).
  - El video va por RUTA DIRECTA. CapCut está en sandbox y NO sigue symlinks: si el archivo
    ya está en el Extreme Pro, pasar la ruta /Volumes/... (capcut-al-disco.py lo hace después).
  - Para que CapCut tome una versión nueva sin rehacer el borrador: sobrescribir el MISMO archivo.
  - Respaldo de root_meta_info.json → root_meta_info.json.pre-<nombre> antes de escribir.
"""
import argparse, copy, json, os, shutil, subprocess, sys, time, uuid

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("--nombre", required=True)
ap.add_argument("--plantilla", default="cvander preguntale humano ep01")
ap.add_argument("--base", default=os.path.expanduser("~/Movies/CapCut/User Data/Projects/com.lveditor.draft"))
ap.add_argument("--aplicar", action="store_true")
a = ap.parse_args()

B, NAME = a.base, a.nombre
SRC, DST = os.path.join(B, a.plantilla), os.path.join(B, NAME)
VID = os.path.abspath(os.path.expanduser(a.video))
if os.path.islink(VID): sys.exit(f"⛔ {VID} es un symlink: CapCut no lo sigue. Pasa la ruta real ({os.path.realpath(VID)}).")
if not os.path.isfile(VID): sys.exit(f"⛔ no existe {VID}")
if not os.path.isdir(SRC): sys.exit(f"⛔ no existe la plantilla «{a.plantilla}» en {B}")
if os.path.exists(DST): sys.exit(f"⛔ ya existe un borrador «{NAME}»")
if a.aplicar and B.startswith(os.path.expanduser("~/Movies/CapCut")) and \
   subprocess.run(["pgrep", "-q", "CapCut"]).returncode == 0:
    sys.exit("⛔ CapCut está abierto: ciérralo primero.")

p = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height:format=duration", "-of", "json", VID], capture_output=True, text=True).stdout)
W, H = p["streams"][0]["width"], p["streams"][0]["height"]
DUR = int(round(float(p["format"]["duration"]) * 1e6))  # µs
print(f"plantilla «{a.plantilla}» → «{NAME}»\nvideo {VID}\n{W}×{H}, {DUR/1e6:.2f} s")
if not a.aplicar: print("SIMULACRO (no escribí nada). Repite con --aplicar."); sys.exit()

shutil.copytree(SRC, DST)
shutil.rmtree(os.path.join(DST, "loudness"), ignore_errors=True); os.makedirs(os.path.join(DST, "loudness"))
d = json.load(open(os.path.join(DST, "draft_info.json")))
seg = d["tracks"][0]["segments"][0]; refs = set(seg["extra_material_refs"]); vm = d["materials"]["videos"][0]
for k, v in d["materials"].items():                       # sólo los materiales que usa el único clip
    if isinstance(v, list) and k != "videos":
        d["materials"][k] = [x for x in v if not isinstance(x, dict) or x.get("id") in refs]
nid = str(uuid.uuid4()).upper()
vm.update(id=nid, path=VID, material_name=os.path.basename(VID), duration=DUR, width=W, height=H)
if "media_path" in vm: vm["media_path"] = ""
d["materials"]["videos"] = [vm]
seg.update(id=str(uuid.uuid4()).upper(), material_id=nid,
           source_timerange={"start": 0, "duration": DUR}, target_timerange={"start": 0, "duration": DUR})
d["tracks"] = [d["tracks"][0]]; d["tracks"][0]["segments"] = [seg]
d["duration"] = DUR; d["name"] = ""
txt = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
tls = [x for x in os.listdir(os.path.join(DST, "Timelines")) if os.path.isdir(os.path.join(DST, "Timelines", x))]
for f in ["draft_info.json", "draft_info.json.bak", "template-2.tmp"] + [f"Timelines/{t}/draft_info.json" for t in tls]:
    if os.path.exists(os.path.join(DST, f)): open(os.path.join(DST, f), "w").write(txt)

m = json.load(open(os.path.join(DST, "draft_meta_info.json")))
did = str(uuid.uuid4()).upper(); now = int(time.time()); us = int(time.time() * 1e6)
m.update(draft_fold_path=DST, draft_id=did, draft_name=NAME, tm_duration=DUR,
         tm_draft_create=us, tm_draft_modified=us, draft_root_path=B)
for grp in m.get("draft_materials", []):
    if grp.get("type") == 0 and any(x.get("file_Path") for x in grp["value"]):
        t = copy.deepcopy([x for x in grp["value"] if x.get("file_Path")][0])
        t.update(id=str(uuid.uuid4()), file_Path=VID, extra_info=os.path.basename(VID), duration=DUR, width=W, height=H,
                 create_time=now, import_time=now, import_time_ms=us, roughcut_time_range={"duration": DUR, "start": 0})
        grp["value"] = [t]
json.dump(m, open(os.path.join(DST, "draft_meta_info.json"), "w"), ensure_ascii=False)

RM = os.path.join(B, "root_meta_info.json"); r = json.load(open(RM))
shutil.copy(RM, f"{RM}.pre-{NAME.replace(' ', '-')}")
e = copy.deepcopy([x for x in r["all_draft_store"] if x["draft_name"] == a.plantilla][0])
OLD = e.get("draft_fold_path") or SRC                    # la ruta que CapCut tiene anotada de la plantilla
for k in list(e):
    if isinstance(e[k], str) and OLD in e[k]: e[k] = e[k].replace(OLD, DST)
e.update(draft_name=NAME, draft_id=did, draft_root_path=B, tm_duration=DUR, tm_draft_create=us, tm_draft_modified=us)
r["all_draft_store"].insert(0, e)
json.dump(r, open(RM, "w"), ensure_ascii=False)
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(min(5, DUR / 2e6)), "-i", VID,
                "-frames:v", "1", "-vf", "scale=540:-1", os.path.join(DST, "draft_cover.jpg")])
print(f"✅ borrador creado: {DST}\n   abre CapCut: debería salir arriba de la lista con el video en la línea de tiempo.")
