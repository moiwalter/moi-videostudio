#!/usr/bin/env python3
"""Compatibilidad: la forma vieja `alinear.py <wav> <out.json> <texto.txt>` llama a la herramienta única del pipeline.
El alineador vive en pipeline/tools/alinear.py (2-nov-2026); antes esta copia traía adentro el guion de Adobe y, sin el
tercer argumento, lo alineaba en silencio. Ahora el texto es obligatorio."""
import runpy, sys
from pathlib import Path
if len(sys.argv) != 4: sys.exit('Uso: alinear.py <wav> <out.json> <texto.txt>  (o directo: pipeline/tools/alinear.py --help)')
TOOL = Path('/Users/TERABYTE10/Movies/VideoStudio/pipeline/tools/alinear.py')
sys.argv = [str(TOOL), '--audio', sys.argv[1], '--out', sys.argv[2], '--texto', sys.argv[3]]
runpy.run_path(str(TOOL), run_name='__main__')
