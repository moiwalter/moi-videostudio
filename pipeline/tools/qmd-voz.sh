#!/bin/bash
# Voz del master: highpass + denoise suave + limitador de picos + loudnorm LINEAL a −14 LUFS / −1 dBTP.
# No toca la duración. goldmine v3.3 (audio.sh).
#   qmd-voz.sh <cut.wav> <voice.wav>
set -euo pipefail
IN="${1:?falta el wav del corte}"
OUT="${2:?falta la salida}"
PRE="highpass=f=70,afftdn=nr=8:nf=-50:tn=1,alimiter=limit=0.29:attack=2:release=50:level=false:asc=1"
M=$(ffmpeg -hide_banner -nostdin -i "$IN" -af "$PRE,loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/{/,/}/p')
g(){ echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
mkdir -p "$(dirname "$OUT")"
ffmpeg -hide_banner -nostdin -y -loglevel error -i "$IN" -af "$PRE,loudnorm=I=-14:TP=-1:LRA=11:linear=true:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset),aresample=48000" -c:a pcm_s16le "$OUT"
ffmpeg -hide_banner -nostdin -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
