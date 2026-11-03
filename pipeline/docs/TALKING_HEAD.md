# RECETA — Talking-head Moi (editor kit para CapCut)

> **Úsala cuando:** Walter habla solo a cámara (TikTok vertical) y hay que vestir el video: overlays, hook frío, cutaways, prueba visual.
> Reglas universales: [START_HERE.md](../../START_HERE.md) + [SCENE_PLAYBOOK.md](SCENE_PLAYBOOK.md).
> Origen: receta `TALKING_HEAD.md` de stacksync-gtm (edición Nacho GTM), adaptada a la línea Moi y a la entrega en CapCut.

---

## Alcance de esta receta

Esta receta describe KIT y la línea Moi. Para MASTER de un cliente como cvander, seguir START_HERE.md, `brand.mjs brief <marca>` y REVIEW.md. No trasladar automáticamente las reglas Moi de captions sin cajas, cobertura continua o zoom obligatorio al formato cvander. Una capa alpha interna de MASTER no es un export ProRes para CapCut.

## El trato — se entrega un EDITOR KIT, no un final horneado

El ancla es **Walter + sus palabras**; los gráficos SIRVEN a las palabras, nunca las reemplazan. Walter edita en CapCut, así que se entregan **capas separadas**:

- **Overlays:** alpha `.mov` **ProRes 4444** por escena (`scenes/<SNN>/renders/`). Nombre estable `SNN_<nombre>_ALPHA.mov`.
- **Clips full-frame** (opacos, 1080×1920): cold-open hook (<2.5s, legible en mute), inserts de prueba, cutaway conceptual (`clips/` ← copiados desde los renders).
- **Transcripción word-timed** (whisper) — la fuente de todo el sync.
- **Captions `.srt`** — opcional (Walter suele subtitular en CapCut; generarlo solo si lo pide).
- **Audio limpiado `.wav`** — opcional, solo si el audio viene sucio.
- **KIT_README.md** con timings exactos de colocación + orden de apilado sugerido.

## Qué necesitas para empezar

- El footage (iPhone 4K, a veces HDR) **o** un corte ya editado/gradeado.
- El transcript o el audio para transcribir.

---

## El flujo (etapas deterministas — córrelo igual siempre)

> ⛔ **No leas esta lista para decidir en qué paso estás. Preguntá:** `node tools/flujo.mjs <slug>`.
> El script corre estas etapas como precondiciones, se corta en la primera que bloquea y te da UNA
> acción. La etapa 1 (*"re-transcribe CADA corte nuevo"*) estuvo escrita acá en prosa desde julio y
> se saltó en 4 de 8 proyectos activos — por eso ahora es un chequeo, no un párrafo.


1. **Ingest** — si es HDR (HLG/bt2020), tonemap HLG→Rec.709 con `ffmpeg-full` (`zscale` + `tonemap=hable`, npl 100; el ffmpeg core no trae `zimg`). Si Walter entrega un corte gradeado, **úsalo tal cual, no re-gradees**. **Re-transcribe CADA corte nuevo** (`hyperframes transcribe <corte> -m large-v3 -l es --to srt` — ⚠️ el default `small.en` es INGLÉS, para español van esos flags; **sin verificar contra whisper todavía**, respaldo `whisper --model medium --word_timestamps True`) — cualquier re-trim corre los timings; el JSON word-level manda en todo el sync.
2. **Spec** — mapa de beats contra el transcript: `escena · beat (palabras/timestamps) · idea visual · arquetipo (SCENE_LIBRARY) · tipo`. Marca los money-beats (los 2–4 más fuertes). Espina típica: hook → contexto → dato/prueba → objeción (Thought Narration) → concepto → payoff. **[CHECKPOINT: Walter aprueba el mapa antes de construir nada.]**
3. **Overlays alpha** — línea Moi (cards cream/navy, gold para números, Cormorant display, logos reales en chip), **logos de marca entrando en la palabra exacta**. **Respeta la silueta** (nunca tapar cara/cuerpo; zonas seguras: tercio superior, laterales, banda inferior). Cada overlay = elemento animado, **jamás texto suelto**.
4. **Clips full-frame** — el hook frío <2.5s legible en mute, inserts de prueba, cutaway conceptual del gran concepto.
5. **(Opcional) captions** — solo si Walter lo pide: `.srt` desde whisper, cues de ~3–4 palabras. Blanco sutil, sin keywords de colores. Legibilidad por **text-shadow, NUNCA scrim**.
6. **(Opcional) audio** — si viene sucio: denoise `afftdn` → de-ess → EQ suave → `loudnorm` -16 LUFS → `.wav`.
7. **Entrega el kit** — llena `KIT_README.md` con la **tabla estándar**: `clip · colocar en (timestamp) · duración · frase que lo dispara` + apilado sugerido + notas (zonas, branding, datos verificados). Ese formato es EL entregable (validado Wallbit 2, 2026-07-10 — "el resultado casi no necesitó edición"). Comp de referencia opcional: `tools/assemble-ref.sh <slug>` (lee `kit.config.sh`).
8. **Si Walter regraba** (guion v2): leer el srt nuevo COMPLETO, mapear qué beats siguen iguales (las escenas aprobadas se conservan — solo cambian sus timestamps de colocación) y re-planificar únicamente los beats nuevos como escenas nuevas. Actualizar SCENES.md + KIT_README, nunca reconstruir lo aprobado.

## Reglas duras (ya litigadas — no reabrir)

- ⚠️ **CAMERA MOVEMENT: la regla se DIO VUELTA el 13-ago-2026.** Decía *"nada de camera movement,
  el zoom lee como tracking raro"*. Era cierta **mientras el corte era intocable**: el kit se
  entregaba como capas para CapCut y el zoom habría tenido que hacerlo Walter a mano, escena por
  escena. Desde que el footage entra a la composición como pista de video (`master/`), la cámara
  es nuestra y **el zoom por escena es obligatorio**, no opcional — nació de un corte donde él
  mismo dijo *"estoy más aburrido, tenemos que tener más dinamismo"*.
  Las cuatro reglas que la reemplazan viven en `<video>/master/ESCENAS.md`; la que más importa:
  **una escena "sin zoom" es una escala FIJA distinta a la de su vecina, no 1.00.** Lo único que
  se ve muerto es 1.00 después de 1.00. Y el ease de cámara **jamás** lleva overshoot: una cámara
  que rebota sí lee como error de tracking — eso de la regla vieja seguía siendo verdad.
- **Overlays durante todo el video** — nunca un talking head pelado.
- **Solo voz. Sin música, sin SFX** — salvo que Walter lo pida.
- **Sin cierre de marca/CTA** salvo pedido.
- **Sin scrim/velo oscuro** (prohibición Moi) — legibilidad por text-shadow.
- **Sin escenas de solo texto** — eso es un subtítulo, no un overlay.
- Un scroller en mute debe entender el video solo con imagen + caption.
- **ProRes 4444 siempre** para alpha; combinar/concatenar = re-encode `prores_ks`, jamás `-c copy`.

## Nota de tooling

Esta categoría usa `ffmpeg-full` (tonemap, composite, audio) + HyperFrames (versión en `tools/HF_VERSION`, hoy `0.8.214`) (renders alpha reales) + whisper (transcribe). **El comp de referencia es una HERRAMIENTA COMPARTIDA** (`tools/assemble-ref.sh` + `kit.config.sh` por video) — nunca copies un script de ensamblado al folder del video.
