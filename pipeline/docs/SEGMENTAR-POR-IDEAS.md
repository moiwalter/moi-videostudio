# Segmentar por ideas — que la imagen cambie con lo que dice y cómo lo dice

> **Úsalo cuando:** un talking-head en carril MASTER (cualquier marca) tiene que dejar de ser "una persona hablando" y cambiar de cara con cada idea.
> **Origen:** cvander "programar como profesión" (28–30 sep 2026), aprobado por Christian: "Muy buenos cortes. Gran edición."
> **Implementación de referencia:** `proyectos/cvander/2026-09-cvander-programar-profesion/edicion/` — `master/BEATS.json`, `MAPA-v2.md`, `master/tools/`.
> El arte de ese video (ASCII, dithering, halftone) es un recurso aparte: [ARTE-MARCAS.md](ARTE-MARCAS.md).

Son un paso previo, cuatro pasos y un juego de reglas. El orden importa: sin el paso 1, los otros tres quedan corridos y el video "no interpreta lo que dice".

## 0. Limpiar el habla antes de fijar el corte

Los "eh", las pausas largas y los retakes **no aparecen en la transcripción**: whisper no escribe muletillas y la alineación forzada sólo conoce las palabras que se le dan. Quedan escondidos dentro de las pausas, que es justo donde este método pone las transiciones. Sin este paso se anima encima del titubeo.

```bash
python3 tools/limpiar-habla.py --audio <toma> --words <words-aligned.json> --out local/limpieza.json   # lista numerada: eh · pausa · retake
# Walter decide cada una → "decision": "cortar" | "dejar" en local/limpieza.json → se cortan SÓLO las aprobadas → volver a alinear
python3 tools/limpiar-habla.py --audio public/voice.m4a --words local/words-aligned.json --out local/limpieza.json --check
node tools/source-state.mjs <proyecto> --limpieza local/limpieza.json --decision "referencia a la decisión de Walter"
```

- ⛔ **Todos los cortes son propuestos** (Walter, 5-oct-2026). Ni la herramienta ni el agente cortan por su cuenta, tampoco los de nivel A; el nivel sólo ordena la lista. Lo mismo vale para una frase que sobra por contenido: se propone, no se quita.
- Va **antes** del mapa: mover el corte después obliga a correr todas las anclas.
- `source-state` deja la fuente en PENDIENTE hasta que exista ese recibo, y el recibo vence si el corte cambia.
- No detecta frases que sobran por contenido. Eso se decide leyendo el guion.
- **Escuchar el corte entero una vez.** Transcribir los empalmes no reemplaza el oído.

Origen: cvander UFM (5-oct-2026). La r4 salió con 12 cortes de nivel A sin hacer; Walter terminó la edición a mano en CapCut (lista en `revision/corte-walter-1005.json` de ese proyecto). De sus 12 recortes de pausa la herramienta marca 11 (7 como A, 4 como B); sus otros dos cortes fueron una frase entera y el "Eso." final, que son decisiones de contenido.

## 1. Tiempos reales de cada palabra

Whisper se adelanta hasta 3 s en tramos con pausas, y el desfase varía por tramo: no se nota oyendo por encima.

- Las palabras salen de **alineación forzada** del texto conocido contra el audio del corte (wav2vec2 VoxPopuli ES, torchaudio).
- Las **pausas** se miden en la envolvente de energía del audio, no en el transcript.
- En cada **unión del corte** se mira la energía del original ±1,5 s: si hay voz tocando el corte, hay una palabra mochada.
- **Un solo reloj:** todo tiempo de la composición es el segundo real del corte. Si el corte cambia en un punto, se corren todas las anclas posteriores de una vez.

En el pipeline (1-nov-2026): `tools/palabras-onda.py` corrige con la onda el fin de cada palabra que la alineación
marca antes de tiempo ([REGLAS V04](REGLAS.md#v04--cada-palabra-se-mide-en-la-onda-antes-de-cortar)), y
`tools/alinear.py` es el alineador, uno solo para todos los videos (2-nov-2026; antes había 8 copias, una por proyecto):
`--audio <voz> --texto <texto.txt> --out local/words-aligned.json`, o por bloques del corte con `--texto bloques.json --bloques local/cut.json`.
El texto es obligatorio (una copia vieja alineaba en silencio el guion de Adobe si faltaba). Los anglicismos van en
`tools/pron-es.json`, compartido; los de un solo video, en `--pron`.

Herramientas del proyecto de referencia (`master/tools/`, atadas a su corte; para un video nuevo, el alineador es `tools/alinear.py`):

| Archivo | Qué hace |
|---|---|
| `guion.py` | El texto por tramo del corte + `PRON` (cómo suenan los anglicismos para el alineador) |
| `alinear.py` | Texto + audio → `local/words-aligned.json` (inicio y fin de cada palabra) |
| `make-captions.py` | Grupos de subtítulo en un solo lugar; `*` marca la palabra con caja |
| `corrimiento.py T DELTA` | Mueve todas las anclas ≥ T cuando cambia el corte |

## 2. Un mapa de ideas, no de tiempos

El mapa es `BEATS.json`. Una escena = una idea. En la referencia: 32 escenas en 123 s.

Cada escena lleva cuatro campos que no se saltan (cinco si el video mezcla formatos):

- `words` — la frase exacta y sus segundos.
- `tratamiento` — qué se ve.
- `transicion_entrada` — cómo se llega.
- `estado` — construida / revisada / aprobada.
- `formato` — sólo si el pitch eligió una mezcla: de qué formato es la escena (`pitch.mjs --check` lo exige).

**La escena cambia en la pausa**, entre una idea y la siguiente. Nunca a mitad de frase.

## 3. Tres posturas según el tipo de idea

Son funciones compartidas (una sola implementación por video), no decisiones escena por escena.

| Postura | Qué se ve | Cuándo |
|---|---|---|
| **Presente** | La persona a pantalla completa | Opina, confiesa, remata. Nada flotando arriba |
| **Recuerdo** | La persona al ~58 % anclada abajo, fondo difuminado y oscurecido, el material arriba; los subtítulos suben | Nombra algo que se puede mostrar |
| **Takeover** | El material ocupa toda la pantalla | Cuenta una memoria o entra a un objeto |

Al achicar a la persona, fundir los bordes del recorte: donde el cuerpo toca el borde del cuadro original queda un rectángulo.

## 4. Acento en palabras puntuales

Cada animación se ancla al segundo real de **una palabra**, y la palabra va comentada al lado del número en el código.

Ejemplos de la referencia: la placa cae en "se acabó" · los agentes se multiplican en "montón de agentes" · las personas se encienden en "cree".

El **tono** también decide la imagen: zoom lento en una confesión, imagen degradada en "qué ansiedad", el color vuelve en "pero es lo que hay".

Límite conocido: la acentuación **no se detecta en el audio**. Las palabras se eligen por significado y por la dirección del video. Medir énfasis real (picos de volumen o tono) sería una pieza nueva.

## Reglas de transición

- Cada transición **significa algo** y se usa sólo para eso. El vocabulario es de cada marca y episodio; el de la referencia (T1–T7) está en su `MAPA-v2.md`.
- Arranca al terminar la frase, aterriza antes de la palabra siguiente, dura lo que la pausa (0,3–1,3 s). **La voz nunca espera.**
- Nunca dos iguales seguidas, salvo el "respiro" (sin efecto, misma idea).
- Sin rebotes ni pops de escala en la cámara.
- Las **rimas** cierran el video: un objeto del principio vuelve al final (en la referencia, el cursor).

## Cuánto dura una imagen

Una imagen dura lo que dura su idea: entra en la pausa anterior y sale en la pausa siguiente. Dentro de eso, cuatro reglas que salieron de las revisiones de Walter (cvander UFM 4-oct y Adobe 8-oct 2026):

- **No se adelanta.** Una pantalla quieta que espera a la palabra que la usa está mal (Google 7 s inmóvil esperando "Antes llegabas a Google"). Mientras no llega la palabra, la idea va a cámara o con algo propio de la frase; el material entra justo antes de que lo nombre.
- **Menos de ~2 s → ¿qué representa?** Una ventana de 1,7 s con una biblioteca genérica para "muy buenas ideas" "no se ganó su lugar". Si no representa, fuera, y la idea queda a cámara.
- **Más de ~3 s sin cambios → sospechosa.** Medir cuánto dura cada pantalla sin movimiento ni cambio.
- **Ilustra la FRASE, no el argumento.** Un recurso externo tiene que mostrar lo que dice en ese segundo, no la tesis del video (el clip de Nadella sobre "las empresas grandes van a reinventarse": "¿por qué está eso ahí?").
- **Si nombra un canal o un sitio, va la captura real.**

Antes de entregar, recorrer `BEATS.json` y para cada escena anotar: duración, si tiene pantalla quieta >3 s, y si el recurso ilustra lo que dice AHORA.

## Material real, no texto que repite el subtítulo

Si una escena "ilustra" tipeando la misma palabra que ya dice el subtítulo, no es una escena. Buscar el objeto real, y si viene de la vida de quien habla, gana siempre (en la referencia: su propio sitio de 2006 en Wayback para "webmasters").
