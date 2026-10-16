#!/usr/bin/env bash
# premultiply.sh — deja un ALPHA listo para CapCut.
#
# POR QUÉ (28-jul-2026, medido): CapCut compone el ProRes 4444 asumiendo alpha
# PREMULTIPLICADO (asociado), pero el render sale STRAIGHT (no asociado).
#   correcto : out = RGB*A + BG*(1-A)
#   CapCut   : out = RGB   + BG*(1-A)     <-- suma en vez de mezclar
# Resultado: TODO lo que tenga alpha parcial revienta a blanco — un glow radial
# sale como elipse blanca de borde duro, y el borde antialiaseado del texto como
# nube brillante. Lo opaco (A=1) sale bien, por eso las cards parecían correctas.
#
# Si guardamos RGB' = RGB*A, la cuenta de CapCut se vuelve la correcta.
#
#   tools/premultiply.sh archivo.mov [más.mov ...]     (in-place, con backup .straight)
set -euo pipefail
[ $# -ge 1 ] || { echo "uso: tools/premultiply.sh <clip.mov> [...]"; exit 1; }

for f in "$@"; do
  [ -f "$f" ] || { echo "✗ no existe: $f"; continue; }
  tmp="${f%.mov}.__pm.mov"
  ffmpeg -y -v error -i "$f" \
    -vf "format=gbrap12le,premultiply=inplace=1,format=yuva444p12le" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p12le -alpha_bits 16 -vendor apl0 \
    "$tmp"
  mv "$f" "${f%.mov}.straight.mov"
  mv "$tmp" "$f"
  echo "✓ premultiplicado: $(basename "$f")   (original en $(basename "${f%.mov}.straight.mov"))"
done
