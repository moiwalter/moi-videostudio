#!/bin/bash
# indexar-disco.sh — inventario del Extreme Pro para el mapa CapCut ↔ disco y la caza de duplicados.
# Se corre desde Terminal.app (Claude no tiene permiso de leer el disco externo). SÓLO LEE, no borra nada.
#
#   1) tamanos.tsv   tamaño <TAB> ruta de cada archivo del disco
#   2) md5.tsv       md5 <TAB> tamaño <TAB> ruta, sólo de los archivos (>1 MB) que comparten tamaño
#                    con otro: los únicos candidatos posibles a duplicado.
# Reanudable: si lo cortas, al volver a correrlo no re-hashea lo que ya hizo.

set -u
DISK="${1:-/Volumes/Extreme Pro}"
OUT="$HOME/Movies/VideoStudio/_mover-estado-2026-10-10"
[ -d "$DISK" ] || { echo "⛔ No está montado: $DISK"; exit 1; }
mkdir -p "$OUT"

echo "1/2 Listando el disco…"
find "$DISK" -type f ! -name '._*' ! -name '.DS_Store' ! -path '*/.Spotlight-V100/*' ! -path '*/.fseventsd/*' \
  ! -path '*/.Trashes/*' -print0 | xargs -0 stat -f '%z%t%N' > "$OUT/disco-tamanos.tsv"
echo "   $(wc -l < "$OUT/disco-tamanos.tsv" | tr -d ' ') archivos"

# candidatos: tamaño repetido y > 1 MB
awk -F'\t' '$1>1048576 {n[$1]++; r[NR]=$0; s[NR]=$1} END {for (i in r) if (n[s[i]]>1) print r[i]}' \
  "$OUT/disco-tamanos.tsv" | sort -t$'\t' -k1,1n > "$OUT/candidatos.tsv"
total=$(wc -l < "$OUT/candidatos.tsv" | tr -d ' ')
gb=$(awk -F'\t' '{s+=$1} END {printf "%.1f", s/1e9}' "$OUT/candidatos.tsv")
echo "2/2 Calculando md5 de $total candidatos ($gb GB)…"

touch "$OUT/disco-md5.tsv"
i=0
while IFS=$'\t' read -r size path; do
  i=$((i+1))
  grep -qF -- "$(printf '\t%s\t%s' "$size" "$path")" "$OUT/disco-md5.tsv" && continue
  h=$(md5 -q "$path" 2>/dev/null) || h="ERROR"
  printf '%s\t%s\t%s\n' "$h" "$size" "$path" >> "$OUT/disco-md5.tsv"
  [ $((i % 25)) -eq 0 ] && echo "   … $i de $total"
done < "$OUT/candidatos.tsv"

echo "LISTO — $(date). Avísale a Claude."
