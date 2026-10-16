#!/bin/bash
# mover-al-disco.sh — libera espacio de VideoStudio mandando lo terminado al Extreme Pro.
#
# Se corre desde Terminal.app (Warp/claude no tienen acceso al disco externo).
# Fases, cada una deja un reporte en $LOG que Claude lee antes de la siguiente:
#
#   plan       arma las listas y muestra cuánto se mueve. No toca nada.
#   copiar     copia al disco + verifica md5 archivo por archivo. NUNCA borra.
#   enlazar X  reemplaza en el Mac cada archivo verificado de X por un symlink al disco.
#              X = cliente/video (piloto) o "todo".
#   archivar   borra del Mac los respaldos de archivo/ cuyo .tar verificó OK.
#
# Qué se mueve:
#   proyectos/: SÓLO VIDEOS (mp4 mov m4v mkv webm avi mxf) de todo proyecto que no esté en KEEP.
#     Regla de Walter (10-oct-2026): el disco guarda un solo tipo de archivo — videos.
#     Se reemplazan por symlinks EN SU MISMA RUTA → CapCut/HyperFrames no ven cambio.
#     Todo lo demás (png, audio, json, links de CapCut) se queda en el Mac.
#     Se excluyen node_modules, .git y archivos con hardlinks (moverlos no libera nada).
#   archivo/: cada subcarpeta de archivo/<X>/ se empaqueta en un .tar dentro de
#     _respaldos/ en el disco, con un LEEME (exFAT no guarda symlinks y son 244k archivos
#     chicos). Los .json de la raíz quedan en el Mac.

set -u
SRC="${VS_SRC:-$HOME/Movies/VideoStudio}"
DEST="${VS_DEST:-/Volumes/Extreme Pro/VideoStudio}"
LOG="${VS_LOG:-/tmp/videostudio-mover}"
KEEP=("cvander/2026-10-cvander-preguntale-humano-intro")  # 16-oct: Adobe, UFM y ep01 ya entregados → al disco

mkdir -p "$LOG"
die() { echo "⛔ $*" | tee -a "$LOG/errores.txt"; exit 1; }
need_disk() { [ -d "$(dirname "$DEST")" ] || die "El Extreme Pro no está montado."; }
is_kept() { local k; for k in "${KEEP[@]}"; do [ "$1" = "$k" ] && return 0; done; return 1; }

# --- listas (NUL-separadas, rutas relativas a $SRC) ---
build_lists() {
  : > "$LOG/archivos.lst0"
  cd "$SRC" || die "No existe $SRC"
  for p in proyectos/*/*/; do
    p="${p%/}"; rel="${p#proyectos/}"
    [ -d "$p" ] || continue
    [ -L "$p" ] && continue
    is_kept "$rel" && continue
    find "$p" -type f -links 1 ! -path "*/node_modules/*" ! -path "*/.git/*" \
      \( -iname "*.mp4" -o -iname "*.mov" -o -iname "*.m4v" -o -iname "*.mkv" \
         -o -iname "*.webm" -o -iname "*.avi" -o -iname "*.mxf" \) -print0 >> "$LOG/archivos.lst0"
  done
  : > "$LOG/tars.lst0"
  for d in archivo/*/*/; do
    d="${d%/}"; [ -d "$d" ] || continue; [ -L "$d" ] && continue
    printf '%s\0' "$d" >> "$LOG/tars.lst0"
  done
}

cmd_plan() {
  build_lists
  cd "$SRC"
  {
    echo "PLAN — $(date)"
    echo "Se quedan en el Mac: ${KEEP[*]}"
    tr '\0' '\n' < "$LOG/archivos.lst0" | awk -F/ '{print $2"/"$3}' | sort | uniq -c | sed 's/^/  proyecto: /'
    xargs -0 stat -f %z < "$LOG/archivos.lst0" | awk '{n++; s+=$1} END{printf "PROYECTOS: %d archivos, %.2f GB\n", n, s/1073741824}'
    while IFS= read -r -d '' d; do echo "  tar: $d ($(du -sh "$d" | cut -f1))"; done < "$LOG/tars.lst0"
    xargs -0 du -sk < "$LOG/tars.lst0" | awk '{s+=$1} END{printf "ARCHIVO: %.2f GB\n", s/1048576}'
    df -h "/Volumes/Extreme Pro" | tail -1 | awk '{print "Libre en el disco: "$4}'
  } > "$LOG/plan.txt" 2>&1
  cat "$LOG/plan.txt"
}

cmd_copiar() {
  need_disk; build_lists; cd "$SRC"
  mkdir -p "$DEST/_respaldos" || die "No puedo crear $DEST"
  cat > "$DEST/_respaldos/LEEME.txt" <<'TXT'
QUÉ ES ESTO
Respaldos de la reorganización de VideoStudio (20 y 23-sep-2026). Son copias de los
borradores de CapCut y del pipeline ANTES de mover/relinkear medios, por si algo salía mal.
No son videos ni proyectos: nadie los abre en el día a día.
Cada .tar es una carpeta empaquetada tal cual (con sus symlinks). Para restaurar una:
  tar -xf "<archivo>.tar" -C ~/Movies/VideoStudio/archivo/<carpeta-madre>/
Los índices (manifest.json, relinks.json, RESULT.json) siguen en el Mac en
~/Movies/VideoStudio/archivo/. Si en unos meses nada los necesitó, se pueden borrar.
TXT
  cat > "$DEST/LEEME.txt" <<'TXT'
VideoStudio en disco — SÓLO VIDEOS.
Misma estructura que ~/Movies/VideoStudio/proyectos. En el Mac, cada video movido quedó
como symlink en su misma ruta apuntando acá: con el disco conectado todo abre igual;
sin el disco, CapCut muestra "medio faltante" y vuelve al reconectar.
Se mueve todo proyecto terminado; en el Mac quedan el actual y el anterior.
Script: ~/Movies/VideoStudio/pipeline/mover-al-disco.sh
TXT
  : > "$LOG/ok.lst0"; : > "$LOG/fallos.txt"; : > "$LOG/tars-ok.lst0"
  local n=0 ok=0 bad=0
  # 1) archivos de proyectos
  while IFS= read -r -d '' f; do
    n=$((n+1))
    dst="$DEST/$f"
    if [ ! -f "$dst" ] || [ "$(stat -f %z "$f")" != "$(stat -f %z "$dst")" ]; then
      ditto --norsrc --noextattr --noqtn "$f" "$dst" 2>>"$LOG/fallos.txt"
    fi
    a=$(md5 -q "$f"); b=$(md5 -q "$dst" 2>/dev/null)
    if [ -n "$a" ] && [ "$a" = "$b" ]; then
      printf '%s %s %s\0' "$(stat -f %m "$f")" "$(stat -f %z "$f")" "$f" >> "$LOG/ok.lst0"; ok=$((ok+1))
    else
      echo "MD5 DISTINTO: $f" >> "$LOG/fallos.txt"; bad=$((bad+1))
    fi
    [ $((n % 100)) -eq 0 ] && echo "  ... $n archivos ($ok ok, $bad fallos)"
  done < "$LOG/archivos.lst0"
  # 2) respaldos de archivo/ → .tar con verificación de contenido y de conteo
  while IFS= read -r -d '' d; do
    echo "  empaquetando $d"
    parent="$(dirname "$d")"; base="$(basename "$d")"
    tarf="$DEST/_respaldos/$d.tar"; mkdir -p "$(dirname "$tarf")"
    ( cd "$parent" && find "$base" -print0 ) > "$LOG/entries.lst0"
    ( cd "$parent" && tar -cf "$tarf" -n --null -T "$LOG/entries.lst0" ) 2>>"$LOG/fallos.txt"
    want=$(tr -cd '\0' < "$LOG/entries.lst0" | wc -c | tr -d ' ')
    got=$(tar -tf "$tarf" 2>/dev/null | wc -l | tr -d ' ')
    a=$( cd "$parent" && while IFS= read -r -d '' e; do [ -f "$e" ] && [ ! -L "$e" ] && printf '%s\0' "$e"; done < "$LOG/entries.lst0" | xargs -0 cat | md5 -q )
    b=$(tar -xOf "$tarf" | md5 -q)
    if [ "$want" = "$got" ] && [ "$a" = "$b" ]; then
      printf '%s\0' "$d" >> "$LOG/tars-ok.lst0"; echo "  ✅ $d ($got entradas)"
    else
      echo "TAR MAL: $d (entradas $want vs $got, md5 $a vs $b)" >> "$LOG/fallos.txt"
    fi
  done < "$LOG/tars.lst0"
  {
    echo "COPIA — $(date)"
    echo "Archivos: $n · verificados OK: $ok · fallos: $bad"
    echo "Tars OK: $(tr -cd '\0' < "$LOG/tars-ok.lst0" | wc -c | tr -d ' ') de $(tr -cd '\0' < "$LOG/tars.lst0" | wc -c | tr -d ' ')"
    echo "--- fallos ---"; cat "$LOG/fallos.txt"
  } > "$LOG/reporte-copia.txt"
  cat "$LOG/reporte-copia.txt"
}

cmd_enlazar() {
  need_disk; cd "$SRC"
  local target="${1:-}"; [ -n "$target" ] || die "Uso: enlazar cliente/video | todo"
  [ -s "$LOG/ok.lst0" ] || die "No hay lista verificada. Corre 'copiar' primero."
  local n=0 skip=0
  while IFS= read -r -d '' rec; do
    m0="${rec%% *}"; rest="${rec#* }"; z0="${rest%% *}"; f="${rest#* }"
    if [ "$target" != "todo" ]; then case "$f" in "proyectos/$target/"*) ;; *) continue ;; esac; fi
    dst="$DEST/$f"
    [ -L "$f" ] && continue
    # re-chequeo en el momento: el original no cambió desde el md5, y la copia sigue ahí entera
    if [ ! -f "$dst" ] || [ "$(stat -f %m "$f")" != "$m0" ] || [ "$(stat -f %z "$f")" != "$z0" ] \
       || [ "$(stat -f %z "$dst")" != "$z0" ]; then
      echo "SALTADO (cambió o falta en disco): $f" >> "$LOG/enlazar.txt"; skip=$((skip+1)); continue
    fi
    ln -s "$dst" "$f.__lnk" && mv -f "$f.__lnk" "$f" && n=$((n+1))
  done < "$LOG/ok.lst0"
  echo "ENLAZAR $target — $(date): $n symlinks, $skip saltados" | tee -a "$LOG/enlazar.txt"
  df -h / | tail -1 | awk '{print "Libre en el Mac: "$4}' | tee -a "$LOG/enlazar.txt"
}

cmd_archivar() {
  need_disk; cd "$SRC"
  [ -s "$LOG/tars-ok.lst0" ] || die "No hay tars verificados."
  while IFS= read -r -d '' d; do
    case "$d" in archivo/*/*) ;; *) echo "ruta rara, no borro: $d"; continue ;; esac
    case "$d" in *..*) echo "ruta rara, no borro: $d"; continue ;; esac
    tarf="$DEST/_respaldos/$d.tar"; [ -f "$tarf" ] || { echo "falta $tarf, no borro $d"; continue; }
    now=$(find "$d" | wc -l | tr -d ' '); got=$(tar -tf "$tarf" 2>/dev/null | wc -l | tr -d ' ')
    [ "$now" = "$got" ] || { echo "cambió desde la copia ($now vs $got), no borro $d"; continue; }
    rm -rf "$d" && echo "Respaldo empaquetado en: $tarf (verificado md5 $(date +%F)). Restaurar: tar -xf \"$tarf\" -C \"$SRC/$(dirname "$d")\"" > "$d.EN-DISCO.txt"
    echo "  archivado: $d"
  done < "$LOG/tars-ok.lst0"
  df -h / | tail -1 | awk '{print "Libre en el Mac: "$4}'
}

cmd_restaurar() {
  # deshace 'enlazar': cada symlink de X que apunte al disco vuelve a ser el archivo real.
  # Copia a un temporal, compara md5 contra el disco y recién ahí reemplaza el symlink.
  need_disk; cd "$SRC"
  local target="${1:-}"; [ -n "$target" ] || die "Uso: restaurar cliente/video | todo"
  local base="proyectos/$target"; [ "$target" = "todo" ] && base="proyectos"
  [ -d "$base" ] || die "No existe $base"
  local n=0 bad=0
  while IFS= read -r -d '' f; do
    dst=$(readlink "$f"); case "$dst" in "$DEST"/*) ;; *) continue ;; esac
    if [ ! -f "$dst" ]; then echo "FALTA EN DISCO: $f"; bad=$((bad+1)); continue; fi
    rm -f "$f.__rest"
    ditto --norsrc --noextattr --noqtn "$dst" "$f.__rest" 2>/dev/null
    if [ -f "$f.__rest" ] && [ "$(md5 -q "$f.__rest")" = "$(md5 -q "$dst")" ]; then
      mv -f "$f.__rest" "$f" && n=$((n+1))
    else
      rm -f "$f.__rest"; echo "NO RESTAURADO (md5): $f"; bad=$((bad+1))
    fi
  done < <(find "$base" -type l -print0)
  echo "RESTAURAR $target — $(date): $n restaurados, $bad problemas" | tee -a "$LOG/restaurar.txt"
  df -h / | tail -1 | awk '{print "Libre en el Mac: "$4}'
}

cmd_empaquetar() {
  # Empaqueta los respaldos de archivo/ que faltan. A diferencia de 'copiar', arma y verifica
  # el .tar en el disco INTERNO y recién después copia un solo archivo al Extreme Pro.
  # (10-oct-2026: verificar con tar -xOf leyendo desde el exFAT se colgó 9 h.)
  need_disk; cd "$SRC"
  [ -s "$LOG/tars.lst0" ] || die "No hay lista de respaldos. Corre 'plan' primero."
  touch "$LOG/tars-ok.lst0"
  local tmp="$SRC/_tar-temporal"; mkdir -p "$tmp"
  while IFS= read -r -d '' d; do
    tr '\0' '\n' < "$LOG/tars-ok.lst0" | grep -qxF "$d" && continue
    [ -d "$d" ] || { echo "  ya no existe: $d"; continue; }
    echo "  empaquetando $d ($(du -sh "$d" | cut -f1))"
    parent="$(dirname "$d")"; base="$(basename "$d")"
    local_tar="$tmp/$(echo "$d" | tr '/' '_').tar"; tarf="$DEST/_respaldos/$d.tar"
    ( cd "$parent" && find "$base" -print0 ) > "$LOG/entries.lst0"
    rm -f "$local_tar"
    ( cd "$parent" && tar -cf "$local_tar" -n --null -T "$LOG/entries.lst0" ) 2>>"$LOG/fallos.txt"
    want=$(tr -cd '\0' < "$LOG/entries.lst0" | wc -c | tr -d ' ')
    got=$(tar -tf "$local_tar" 2>/dev/null | wc -l | tr -d ' ')
    a=$( cd "$parent" && while IFS= read -r -d '' e; do [ -f "$e" ] && [ ! -L "$e" ] && printf '%s\0' "$e"; done < "$LOG/entries.lst0" | xargs -0 cat | md5 -q )
    b=$(tar -xOf "$local_tar" | md5 -q)
    if [ "$want" != "$got" ] || [ "$a" != "$b" ]; then
      echo "TAR MAL: $d (entradas $want vs $got, md5 $a vs $b)" | tee -a "$LOG/fallos.txt"; rm -f "$local_tar"; continue
    fi
    echo "    tar verificado en el Mac ($got entradas). Copiando al disco…"
    mkdir -p "$(dirname "$tarf")"
    ditto --norsrc --noextattr --noqtn "$local_tar" "$tarf" 2>/dev/null
    if [ "$(md5 -q "$local_tar")" = "$(md5 -q "$tarf" 2>/dev/null)" ]; then
      printf '%s\0' "$d" >> "$LOG/tars-ok.lst0"; echo "  ✅ $d"
    else
      echo "COPIA DE TAR MAL: $d" | tee -a "$LOG/fallos.txt"
    fi
    rm -f "$local_tar"
  done < "$LOG/tars.lst0"
  rmdir "$tmp" 2>/dev/null
  echo "EMPAQUETAR — $(date): tars OK $(tr -cd '\0' < "$LOG/tars-ok.lst0" | wc -c | tr -d ' ') de $(tr -cd '\0' < "$LOG/tars.lst0" | wc -c | tr -d ' ')"
}

case "${1:-}" in
  plan) cmd_plan ;;
  copiar) cmd_copiar ;;
  enlazar) cmd_enlazar "${2:-}" ;;
  empaquetar) cmd_empaquetar ;;
  archivar) cmd_archivar ;;
  restaurar) cmd_restaurar "${2:-}" ;;
  *) echo "Uso: $0 plan | copiar | enlazar <cliente/video|todo> | empaquetar | archivar | restaurar <cliente/video|todo>" ;;
esac
