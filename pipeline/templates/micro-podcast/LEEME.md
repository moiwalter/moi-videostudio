# Kit del micro-podcast «Pregúntale a un humano»

Copias de las herramientas de ep01 (16-oct-2026). Se copian al episodio nuevo y se cambia lo de arriba de cada una:

| Archivo | Va a | Qué cambiar |
|---|---|---|
| `alinear.py` | `edicion/tools/` | nada: `python3.13 alinear.py <wav> <out.json> <texto.txt>` (torchaudio ES, L033) |
| `pagina-cortes.py` | `edicion/tools/` | nada: página para escuchar propuestas de limpieza (L036/L045) |
| `unir-palabras.py` | `edicion/master/tools/` | la tabla `TR` (tramos y offsets del corte de Walter) y `D1`/`D2` (duración de cada respuesta) |
| `make-captions.py` | `edicion/master/tools/` | la lista `G` de grupos de subtítulo (`*palabra` = caja de énfasis) |

Fuera de esta carpeta, en `pipeline/`:
- `docs/templates/transiciones-corte.js` — cutT / tkIn / tkOut (zoom con desenfoque en cada corte)
- `tools/nivelar-voces.py` — iguala a cada persona y deja −14 LUFS
- `tools/capcut-borrador.py` — borrador de CapCut con el master entero

Master de referencia: `proyectos/cvander/2026-10-cvander-preguntale-humano-ep01/edicion/master/index.html`.
Paso a paso: `second-brain/02-projects/cvander/workflow/micro_podcast.md`.

## Catálogo visual (para VER las escenas y las transiciones)
`catalogo-ep01/index.html` — 21 escenas (cuadro + formato + cómo se hizo + palabra ancla + cómo entra + línea del código)
y 22 transiciones en bucle (1,6 s alrededor de cada `cutT` / `tkIn` / `tkOut`), con el código abajo.
Para un episodio nuevo: `python3 hacer-catalogo.py <proyecto> <video-final.mp4> <salida/> [--desfase "seg:corrimiento,…"]`
(`--desfase` sólo si el final se recortó en CapCut; ep01: `"129:-0.1,131.8:-1.14"`).
