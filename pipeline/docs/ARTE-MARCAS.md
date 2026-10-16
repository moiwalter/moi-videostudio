# Arte de marcas discretas — ASCII, dithering, halftone

> **Qué es:** un catálogo de recursos que ya construimos y funcionan. No es un estilo obligatorio.
> **Origen:** cvander "programar como profesión" (28–30 sep 2026).
> **Dónde vive el código que funciona:** `proyectos/cvander/2026-09-cvander-programar-profesion/edicion/master/` — `tools/build.py`, `tools/derivados.sh`, `tools/diploma.py`, `assets/fx/`, `assets/hook/`.
> El método de segmentación que lo acompaña: [SEGMENTAR-POR-IDEAS.md](SEGMENTAR-POR-IDEAS.md).

## Antes de usarlo en otra marca

En ese video cada técnica **significaba** algo: ASCII = el oficio · dithering = los recuerdos · halftone = las personas. Funcionó porque el tema era nostalgia de programar.

En otra marca hay que asignarle su propio significado o no usarlo. Sin significado es un filtro. Para Moi en particular, verificar contra la marca vigente (seria, minimal) antes de traerlo.

## Qué tenemos

| Recurso | Qué se ve | Dónde está | Cómo se rehace |
|---|---|---|---|
| **Persona en dithering, 2 tonos** | El video de quien habla en tinta/papel, píxel duro | `assets/fx/chris-dither.mp4` | Línea 3 de `tools/derivados.sh`: ffmpeg a 360×640 + `paletteuse=dither=bayer:bayer_scale=1` con `pal2.png`; se escala en pantalla con píxel duro |
| **Persona en 4 tonos, fondo apagado** | La persona iluminada y su fondo oscuro, usando la máscara del recorte | `assets/fx/chris-dither-ansiedad.mp4` | Receta ffmpeg completa en `CONTEXT.md` ("Receta del dithering de ansiedad"), paleta `pal4.png` |
| **El color vuelve desde la cara** | Máscara radial que crece desde el rostro y devuelve el video a color | `build.py` (variable CSS `--r`) | Reutilizable tal cual sobre cualquier capa en dithering |
| **Imagen fija en dithering** | Un documento (diploma) en Bayer 4×4, con el título aparte para soltarlo en columnas | `assets/fx/diploma.png`, `diploma-titulo.png` | `tools/diploma.py` (playwright + Pillow) |
| **Umbral de dither (transición)** | A → B píxel a píxel, como un GIF cargando | `build.py`, T2 | Ver `MAPA-v2.md` |
| **Imagen que se vuelve ASCII y cae** | Un cuadro pasa a grilla de glifos (fino → bloque) y las columnas caen | `assets/hook/ascii-placa.json` (180×48, dos juegos de glifos) + `build.py`, T1 | El JSON existe; **el script que lo generó no se guardó** |
| **Foto en halftone** | Retrato en trama de puntos | `assets/fx/dhh-halftone.png` | El PNG existe; **el generador no se guardó** |
| **Personas en halftone** | Figuras hechas en CSS, ubicadas en anillos, que se encienden una a una | `build.py`, bloque S23–S26 | Generadas por código, sin assets |
| **Monitor CRT** | Un monitor al que se entra (su pantalla pasa a ser el cuadro) y que se apaga a línea → punto → cursor | `build.py`, T3 y T4 | Sin assets externos |
| **Grano + viñeta** | Capa constante arriba de todo | `assets/hook/grain.png` | — |

## Lo que falta para que sea reutilizable de verdad

- Dos generadores no se guardaron (ASCII de una imagen a JSON, halftone de una foto). Para ASCII de imágenes fijas existe el skill `ascii-art` del vault (`~/second-brain/.claude/skills/ascii-art/`), que entrega PNG, no la grilla animable.
- Todo vive dentro de un `build.py` de un solo video. Usarlo en otro proyecto hoy es copiar el bloque, no llamar una función.
- Los videos en dithering se recortan por tiempo: si el corte cambia, hay que regenerarlos.
