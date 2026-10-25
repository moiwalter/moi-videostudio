#!/bin/bash
# Pipeline de portadas. Usa el primer python con Pillow (el del sistema no lo trae).
for py in "$HOME/.portada/venv/bin/python" "$HOME/.ascii-art/venv_bg/bin/python" python3; do
  "$py" -c 'import PIL' 2>/dev/null && exec "$py" "$(dirname "$0")/portada.py" "$@"
done
echo "✗ ningún python con Pillow: python3 -m venv ~/.portada/venv && ~/.portada/venv/bin/pip install pillow" >&2; exit 1
