# moi-videostudio

Un pipeline para editar **talking-heads**, es decir, videos verticales de una persona hablando a cámara, con material real encima: capturas, tweets, archivo y gráficos. El video se arma en código, con [HyperFrames](https://hyperframes.dev) (HTML + GSAP) o Remotion, y lo controla un agente de IA. Cada decisión queda escrita y cada paso se verifica con código, no a ojo.

Nació editando los videos de un cliente (Christian Van Der Henst) y los de una marca propia (Moi). Las reglas que salieron de esas revisiones quedaron en este repo para que sirvan a cualquier marca.

> **Qué NO trae este repo:** los proyectos (footage, cortes y entregas de clientes), los respaldos ni los videos. Eso vive en la máquina de quien edita (`proyectos/`, ignorado por git). Acá está la máquina, no el material.

---

## La idea en 5 minutos

### 1. Cinco capas, de la más general a la más específica

```
motor  →  formato  →  marca  →  cliente  →  episodio
```

| Capa | Dónde vive | Qué decide |
|---|---|---|
| **Motor** | `pipeline.json` del proyecto | HyperFrames o Remotion, con la versión fija |
| **Formato** | `pipeline/styles/<id>/` | El tratamiento: cómo se ven las escenas y cuánto duran |
| **Marca** | `biblioteca/marcas/<id>.json` | Paleta, fuentes, subtítulos y tono |
| **Cliente** | `biblioteca/clientes/<id>.json` | Reglas de **una persona** (ej.: «en pantalla se escribe AI, nunca IA») |
| **Episodio** | `pipeline.json` + `master/BRIEF.json` | Lo de este video en particular |

Gana la capa más específica. `node pipeline/tools/capas.mjs <proyecto>` muestra el resultado y **de qué archivo salió cada valor**.

### 2. Formatos con perillas medidas

Un formato (`pipeline/styles/<id>/style.json` + `STYLE.md`) declara principios y **perillas**: los valores que cambian lo que se ve, como la duración del hook, la mediana por escena, el tamaño de los subtítulos o la duración de un barrido.

- Cada perilla trae un `default` **medido en un video aprobado**, con la cita exacta del archivo y el valor (`medido`). No hay números inventados.
- Cada perilla trae también un `rango` (o `opciones`) con lo que ese formato admite.
- La marca, el cliente o el episodio pueden ajustar una perilla, pero nunca inventar una que el formato no declare.

Formatos incluidos:

| Formato | Para qué |
|---|---|
| `layered-talking-head` | La persona sube y baja de plano según la idea (presente / recuerdo / takeover) |
| `moderno-limpio` | Mucho recurso: persona recortada sobre placas, archivo, tweets reales |
| `vlog` | Recap de evento: una voz base y muchas tomas del mismo evento |
| `micro-podcast` | Pregunta y respuesta grabadas por separado, editadas como una conversación |
| `investigacion-cinematica` | Opinión contada como investigación: anomalía → evidencia → giro → caso abierto |
| `hilo-chat` | Un hilo de chat donde cada mensaje es un video |
| `paper-collage` | Recortes de papel, en Remotion |
| `moi-overlay` | Kit de capas alpha para montar en CapCut |

### 3. La composición LEE las perillas

`node pipeline/tools/perillas.mjs <proyecto> --escribir` deja `perillas.js` (`window.PERILLAS`) y `perillas.css` (variables CSS) junto a la composición. La composición los carga y marca su caja de subtítulos con `data-perilla="subtitulos"`. Si alguien cambia una perilla y no regenera los archivos, o los edita a mano, el proyecto queda **bloqueado**.

### 4. Un router dice cuál es el paso siguiente

```bash
node pipeline/tools/flujo.mjs <proyecto> --rapido --json
```

Revisa el proyecto contra todos los chequeos y responde OK, BLOQUEADO o NO VERIFICABLE, junto con la acción que sigue. Los chequeos son la fuente, la transcripción, el pitch, las reglas del cliente, las perillas, las aprobaciones por escena, la revisión nativa y la entrega. Nadie deduce el paso siguiente leyendo documentos: se le pregunta al router.

### 5. Reglas aprendidas, separadas de la bitácora

- `pipeline/docs/REGLAS.md` (V01–V34): lo ya aprendido, que vale para todo video. Cada regla dice de qué caso salió y si un código la verifica.
- `pipeline/docs/LECCIONES.md`: la bitácora. Cada corrección entra el mismo día y pasa a regla cuando se confirma o se repite en otro video.

---

## Cómo va un video

```
material → new-video.sh → corte + transcripción (alineada palabra a palabra)
        → PITCH: 2–3 caminos (formato o mezcla), la persona elige
        → mapa de escenas (una escena por idea, BEATS.json)
        → el hook, revisado en el preview nativo → escena por escena
        → revisión → render autorizado → entrega verificada
```

Tres principios atraviesan todo el proceso:

- **Nada se aprueba con un chequeo técnico.** Una aprobación es la decisión de una persona sobre lo que vio, registrada contra el contenido exacto. Si ese contenido cambia, la aprobación vence.
- **Lo entregado no se rehace.** Un proyecto con `ENTREGADO.json` queda cerrado y las herramientas sólo lo leen.
- **Todo corte se propone.** Los «eh», las pausas y los retakes se detectan en el audio (`limpiar-habla.py`), y quien edita decide.

---

## Requisitos

- **Node 22** y `cd pipeline && npm install` (trae `puppeteer-core`, que los chequeos usan para abrir la composición en Chrome).
- **ffmpeg**.
- **HyperFrames CLI:** se usa con `npx hyperframes@<versión>`, y la versión fija está en `pipeline/tools/HF_VERSION`. Remotion se usa en los proyectos que lo declaran.
- **Chrome for Testing** en `~/.cache/puppeteer/chrome/`, para medir lo que se pinta en pantalla. Sin Chrome, esos chequeos dicen NO VERIFICABLE en vez de pasar.
- **Python 3.13 con torch + torchaudio**, para `pipeline/tools/alinear.py` (alineación forzada wav2vec2 en español; los anglicismos están en `pron-es.json`).

---

## Primeros pasos

```bash
git clone git@github.com:moiwalter/moi-videostudio.git VideoStudio && cd VideoStudio
cd pipeline && npm install && cd ..

node --test pipeline/tools/*.test.mjs                        # la suite
pipeline/tools/new-video.sh 2026-11-mi-video --marca moi     # un proyecto nuevo en proyectos/moi/…
node pipeline/tools/flujo.mjs 2026-11-mi-video --rapido      # qué sigue
node pipeline/tools/capas.mjs 2026-11-mi-video               # qué formato, marca y perillas le tocan
```

Los comandos de cada etapa (preview, revisión, preflight, render, entrega) están en [`pipeline/docs/PIPELINE-OPERATIONS.md`](pipeline/docs/PIPELINE-OPERATIONS.md).

> Algunos tests usan proyectos reales de quien mantiene el repo: la calibración de perillas y la comparación byte a byte de exportaciones de referencia. En otra máquina, la calibración se salta sola. La comparación necesita esos archivos (y el disco externo donde viven), así que falla sin ellos. El resto corre sobre proyectos de juguete.

---

## Cómo adaptarlo a lo tuyo

**Tu marca.** Toma como base `biblioteca/marcas/cvander.json` (es la más completa: trae `estiloPorDefecto`, `subtitulos` y `encuadre` por formato) y guárdala como `biblioteca/marcas/<tu-marca>.json`. Cambia paleta, fuentes, subtítulos, `canvas` y `estiloPorDefecto`. En `prohibido` va **sólo la identidad** de la marca; lo que vale para todo video va en REGLAS. `node pipeline/tools/brand.mjs check <proyecto>` bloquea los colores que estén fuera de la paleta.

**Un cliente con reglas propias.** Crea `biblioteca/clientes/<id>.json` con `marca`, `persona` y `reglas[]` (id, regla, fuente y chequeo). Las reglas con `chequeo` de tipo `texto-prohibido` o `recurso-vetado` las verifica `cliente-check.mjs` solo (fila CLIENTE del router); las demás quedan como guía para el agente.

**Ajustar una perilla.** En la marca o el cliente: `"perillas": {"<formato>": {"barrido": 0.4}}`, o `"*"` para todos los formatos. En un episodio: `"perillas": {…}` en su `pipeline.json`. Después corre `perillas.mjs <proyecto> --escribir`.

**Un formato nuevo.** Crea `pipeline/styles/<id>/style.json` + `STYLE.md` y agrega una fila en [`EDITING_STYLES.md`](pipeline/docs/EDITING_STYLES.md). Los tests exigen que declare perillas: al menos `duracionHook` y `duracionEscena`, cada una con `que`, `default`, `rango`/`opciones` y `medido`. **Mídelas en un video tuyo aprobado.** Si todavía no tienes uno, el formato no está listo. Las descripciones (`que`) no nombran personas ni identidad de marca: el formato es para cualquiera.

**Una regla nueva.** Anota la corrección en `LECCIONES.md`, con la cita. Cuando se confirme o se repita, pásala a `REGLAS.md` con su `origen`. Si se puede revisar con código, escribe el chequeo **y su eval antes que el código**.

---

## Mapa del repo

```
START_HERE.md            la entrada para el agente que opera
AGENTS.md                instrucciones para agentes (intake, qué no tocar, cuándo no comitear)
biblioteca/marcas/       una marca = un JSON
biblioteca/clientes/     reglas de una persona
pipeline/styles/         los formatos y sus perillas
pipeline/tools/          las herramientas (+ sus *.test.mjs)
pipeline/docs/           REGLAS, LECCIONES, operaciones, métodos (segmentar por ideas, portadas, sonido…)
pipeline/templates/      plantillas por formato
proyectos/               (no versionado) <cliente>/<video>/{originales,edicion,recursos,revision,entregas}
```

**Cómo se trabaja acá:** los tests se escriben antes que el código, y después se rompe el código a propósito para confirmar que el test falla. Una regla escrita sólo en prosa se termina saltando; una que está en código se cumple.
