# kit.config.sh — inputs por-video para tools/assemble-ref.sh (el comp de referencia OPCIONAL).
# Aquí van SOLO los valores que cambian por video. La receta ffmpeg vive en la herramienta
# compartida. Rutas relativas al folder del video. Ver TALKING_HEAD.md.

SRC="local/footage.mp4"     # footage talking-head (gradeado → usar tal cual, no re-gradear)
END=51.6                    # largo del segmento hablado, en segundos

# Overlays alpha (ProRes 4444) en orden: "ruta|inicio_en_segundos"
# El inicio sale del transcript word-timed (la palabra que dispara el overlay).
OVERLAYS=(
  "scenes/S01-overlay/renders/S01-overlay_ALPHA.mov|3.2"
)

CAP=""                      # opcional: captions/captions.ass (vacío = sin captions)
