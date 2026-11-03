# SOUND — la doctrina del oído

> El equivalente auditivo de `BRAND.md`. Qué se puede volver código y qué necesita tu oreja.
> Investigado el 12/13-sep-2026. **Cada número trae su fuente. Lo que no tiene fuente dice que no la tiene.**
>
> Estado: **doctrina escrita, y el módulo de qmd-vertical ya está.** `pipeline/tools/music.py`
> compone la partitura (pretty_midi; FluidSynth si hay soundfonts), `sfx.py` coloca muestras
> reales en su pico y `master_mix.py` entrega una sola pista. Los pesos, soundfonts y one-shots
> no están en el repo: [ACTIVOS-EXTERNOS.md](ACTIVOS-EXTERNOS.md). Lo medido en goldmine v3.3
> (aprobado 2026-11-01): cama 9.5 LU bajo la voz antes de un duck de 5 dB, 14.6 LU ya duckada,
> la voz 12.4 dB por encima en 300–3500 Hz, preview a −14.3 LUFS. El limitador de `master_mix.py`
> trabaja a −1.8 dBTP para que el recorte de AAC de HyperFrames no baje toda la mezcla de −14.

## Por qué existe

El pipeline es determinista y gateado de punta a punta hasta que llega al sonido, y ahí se cae a
CapCut a mano. El handoff de `tu-carrera` y `que-es-startup` termina literal en **«5. Tu música»**.

Las tres reglas de audio que ya se habían descubierto viven **en prosa**, y en este pipeline está
medido que *toda regla que quedó en prosa se saltó*:

| Regla | Dónde vive hoy | Qué pasa si se salta |
|---|---|---|
| `<audio>` sin `id` sale **mudo en el render** | `START_HERE.md` §master | video entregado sin sonido |
| Los FX arrancan en **`beat − pico`**, medido con `astats` | `START_HERE.md` §master | el golpe llega tarde y nadie sabe explicar por qué |
| *"mezcla a los volúmenes declarados y nada más: no hay masterizado"* | `cvander-telegram/README.md` | sale 9–13 LU bajo el feed |

---

## 0. LO PRIMERO — el volumen, que no es diseño sonoro y es lo que más duele

Medido el 12-sep-2026 sobre lo ya publicado (`ffmpeg ebur128`):

| archivo | integrado | short-term máx | rango | true-peak |
|---|---|---|---|---|
| `QUE-ES-STARTUP-v6-con-subs.mp4` | **−23,0 LUFS** | −20,6 | 3,5 LU | −6,8 dBFS |
| `carrera.mp4` | **−22,7** | −20,0 | 3,6 LU | −4,5 |
| `OpcionesVF.mp4` | **−27,1** | −25,0 | 3,3 LU | −12,1 |
| `andres-uplabs.mp4` | **−23,1** | −20,4 | 4,0 LU | −8,6 |

La referencia de streaming **publicada** es −14 LUFS con techo −1 dBTP ([Spotify](https://support.spotify.com/us/artists/article/loudness-normalization/)).
AES recomienda −16 a −20 y dice por qué importa en teléfono: *"algunos móviles no tienen ganancia
suficiente para que −23 o −24 LUFS se oiga a un nivel satisfactorio ni con el volumen al máximo"*
([AES TD1004.1.15-10](https://aes2.org/wp-content/uploads/2024/01/AESTD1004_1_15_10.pdf)).

⚠️ **Límite honesto del dato: ni TikTok ni Instagram publican su norma de loudness.** Todo número
que circula para esas dos plataformas es ingeniería inversa de terceros. Lo verificable es que
estás 9–13 LU debajo del objetivo común y con 4,5–12 dB de headroom sin usar.

📏 **La norma escrita para este formato exacto** — AES TD1004: *"short-form programming (60 seconds
or less)… Maximum Short-term Loudness no more than 5 LU higher than the Target Loudness."*
Tus valores actuales (short-term ~2,4 LU sobre el integrado) pasan holgado. Sobra margen.

---

## 1. LAS LEYES QUE SE VUELVEN CÓDIGO

### 1.1 El corte va UN CUADRO ANTES del transitorio

La simultaneidad percibida no es la simultaneidad física, y el sesgo va en una sola dirección:
**primero la imagen**. El punto de simultaneidad subjetiva está en **26 ms con la imagen adelante**,
con ventana de −76 ms (sonido primero) a +127 ms (imagen primero) — van Wassenhove et al. 2007,
vía [Vroomen & Keetels](https://www.ncbi.nlm.nih.gov/books/NBK92837/).

**EBU R37-2007**: en emisión, sonido antes de imagen ≤ **40 ms**, sonido después ≤ **60 ms**
([PDF](https://tech.ebu.ch/docs/r/r037.pdf)). La razón es ecológica: la luz llega antes que el
sonido, así que el oído espera el audio tarde y nunca temprano.

→ **A 30 fps un cuadro son 33,3 ms ≈ el PSS.** La imagen cambia **un cuadro antes** del transitorio
musical. Nunca más de un cuadro después.

### 1.2 El pre-roll se MIDE, no se estima

El instante a sincronizar es el **pico de la envolvente**, no el inicio del archivo. Sound on Sound
lo dice directo: *"Align the peak volume of your various clips… si su ataque incluye una subida
corta hasta el pico, quizá tengas que dispararlo un poco antes"*
([SOS](https://www.soundonsound.com/techniques/cubase-creating-risers-impacts)).

📐 **Medido el 12-sep-2026 sobre los 19 SFX de la librería base** (`media-use/audio/assets/sfx/`):

| nombre | archivo | onset | **pega** | fin evento | cola | colocación real |
|---|---|---|---|---|---|---|
| `riser` | 10,03 | 2,00 | **3,47** | 4,16 | 5,87 ⚠️ | `start = beat − 3,47` |
| `whoosh-cinematic` | 5,54 | 1,95 | **2,54** | 4,29 | 1,25 ⚠️ | `beat − 2,54` |
| `glitch-2` | 3,50 | 0,02 | **3,18** | 3,49 | 0,01 | `beat − 3,18` |
| `impact-bass-2` | 2,59 | 0,02 | **2,06** | 2,49 | 0,10 | `beat − 2,06` |
| `glitch-3` | 3,10 | 0,24 | **1,84** | 2,06 | 1,04 ⚠️ | `beat − 1,84` |
| `chime` | 2,50 | 0,41 | **0,42** | 2,39 | 0,11 | `beat − 0,42` |
| `typing` | 1,50 | 0,45 | **0,45** | 1,47 | 0,03 | `beat − 0,45` |
| `ping` | 1,32 | 0,32 | **0,32** | 0,87 | 0,45 | `beat − 0,32` |
| `notification` | 2,46 | 0,08 | **0,23** | 1,11 | 1,35 ⚠️ | `beat − 0,23` |
| `whoosh` / `whoosh-short` | 0,57 | 0,09 | **0,16** | 0,29 | 0,28 | `beat − 0,16` |
| `impact-bass-1` | 2,12 | 0,05 | **0,14** | 2,04 | 0,08 | `beat − 0,14` |
| `pop` | 0,72 | 0,11 | **0,12** | 0,18 | 0,54 | `beat − 0,12` |
| `sparkle` | 1,80 | 0,02 | **0,09** | 1,18 | 0,62 | `beat − 0,09` |
| `key-press` | 0,40 | 0,07 | **0,07** | 0,14 | 0,26 | `beat − 0,07` |
| `click` / `click-soft` | 0,37 | 0,04 | **0,05** | 0,16 | 0,21 | `beat − 0,05` |
| `error` | 1,62 | 0,60 | **0,65** | 0,90 | 0,72 | `beat − 0,65` |

⛔ **El manifiesto de la librería documenta MAL su propio archivo estrella.** Dice del `riser`:
*"Trigger at (climax_time − 10.03s) so it crests exactly on the reveal."* Falso: el archivo dura
10,03 s pero **el evento termina en 4,16 s** y crestea en **3,47 s**; los últimos 5,87 s son cola
muerta. Siguiendo la instrucción, el riser llega a su pico **6,5 segundos antes** del reveal.
Es la misma clase de defecto que ya costó un kit: **dimensionar contra el papel en vez de contra
lo medido.** *La duración del archivo no es el dato de colocación. El pico sí.*

### 1.3 El piso de 460 ms — no se corta más rápido que eso

Sincronizarse a una **luz que parpadea se vuelve imposible por debajo de ~460 ms de intervalo**,
unas cuatro veces el umbral auditivo (100–120 ms) — Repp 2003b, vía
[Repp 2006](http://users.df.uba.ar/anita/f1_labo/clase1/repp%20psycho%20bull%20rev%202006%20synchro%20tapping%20review.pdf).
460 ms = **130 eventos visuales por minuto**.

→ Cortar a corcheas a 120 BPM (250 ms) está **por debajo del piso en que el sistema visual puede
extraer ritmo**. El espectador percibe revoltijo, no pulso. Mismo trabajo: los golpes se atraen
mucho más a los tonos que a los destellos. **El ritmo lo lleva el audio; la imagen se le sube.**

Techo: ~1,8 s (el presente subjetivo). Eventos dentro de ~120 ms se agrupan como uno solo — ése
es el presupuesto de holgura.

### 1.4 La aritmética de compases

Un compás de 4/4 = **240/BPM segundos**. Las frases van de a 4, 8 y 16 compases.

| BPM | compás | 4 comp. | 8 comp. | 16 comp. |
|---|---|---|---|---|
| 90 | 2,67 s | 10,67 | 21,33 | 42,67 |
| 100 | 2,40 | 9,60 | 19,20 | 38,40 |
| 120 | 2,00 | 8,00 | 16,00 | 32,00 |
| 128 | 1,88 | 7,50 | 15,00 | 30,00 |
| 140 | 1,71 | 6,86 | 13,71 | 27,43 |

Un video de 60 s a **128 BPM son exactamente 32 compases** = cuatro frases de 8. Se corta en
bloques enteros de 4 u 8: sacar 8 compases es inaudible, sacar 5 no.

### 1.5 La voz manda, y cuánto

- **WCAG 2.1 SC 1.4.7 (AAA)**: el fondo va **≥ 20 dB por debajo** de la voz, *"con la excepción de
  sonidos ocasionales que duren uno o dos segundos"*
  ([W3C](https://www.w3.org/WAI/WCAG21/Understanding/low-or-no-background-audio.html)).
  Ojo con la excepción: los golpes cortos y fuertes están **explícitamente permitidos**.
- **EBU R128 Suppl. 4**: LDR ≤ 5 LU. **JBL**: mínimo 6 dB-A, apuntar a 10, y **arriba de 15 dB-A
  hay rendimientos decrecientes** ([JBL Tech Note 26](http://proaudioencyclopedia.com/speech-intelligibility-a-jbl-professional-technical-note-technical-notes-volume-1-no-26/)).
- ⚠️ **«La música va 18–20 dB bajo la voz» es folklore de foro** — no está en ninguna norma.
  Citá WCAG, que da 20 dB y sí es norma.

**El corte de frecuencia, con números**: el **75% de la inteligibilidad vive entre 1 y 4 kHz**
(2 kHz ≈ 30%, 4 kHz ≈ 25%, 1 kHz ≈ 20% — JBL). DPA lo dice operativo: **bajar la cama 5–10 dB en
la región de consonantes de 2–4 kHz**; ancho de banda mínimo usable 250 Hz – 6 kHz
([DPA](https://www.dpamicrophones.com/mic-university/background-knowledge/facts-about-speech-intelligibility/)).
Pasar la voz por un pasa-altos a 500 Hz cuesta sólo 5% de inteligibilidad; un pasa-bajos a 1 kHz
la tira por debajo del 40%. **La energía y la inteligibilidad no viven en el mismo lugar.**

### 1.6 El teléfono no tiene graves

El micro-parlante de un teléfono resuena cerca de **850–900 Hz** y por debajo cae a 12 dB/octava;
en la práctica se comporta como un pasa-altos con corte cerca de **500 Hz**
([Wolff WP03](https://owolff.com/wp-content/uploads/2024/07/micro-loudspeakers_pt1.pdf)).
En vertical, el iPhone suena por el parlante de abajo + el auricular: **es mono en la práctica**.

→ Un sub-drop de 50 Hz está ~4 octavas debajo de la resonancia: **no es bajito, es inexistente.**
Un impacto tiene que traer energía audible entre **200 Hz y 1,5 kHz** ("el toc") o no hace nada.
*(La atenuación exacta es derivada, no medida — marcada como inferencia.)*

### 1.7 La ley de densidad de Murch — la única cuantificada que existe

Murch, *Dense Clarity — Clear Density*: el punto de equilibrio está en **«no del todo tres capas»**
—su *Ley del Dos y Medio*— y **la ley aplica sólo a sonidos del mismo «color»**; en cualquier
tramo de cinco segundos, **cinco capas es el máximo tolerable**
([Transom](https://transom.org/2005/walter-murch/)).

→ **La voz ocupa una capa permanente.** Quedan ~4, y sólo si difieren en color: cama · un elemento
rítmico/UI · uno atmosférico · una familia de impactos. Tres whooshes apilados dejan de ser tres
eventos y se vuelven *"el ruido entre dos estaciones de radio"*.

⚠️ **No existe ningún límite publicado de SFX por minuto.** Quien lo cite está extrapolando.

---

## 2. LO QUE NECESITA TU OREJA (y no se gatea)

- **Si el video necesita música.** El efecto global de música de fondo vs. nada es **r = .03**
  (Kämpfe et al. 2011, meta-análisis de 97 estudios,
  [PDF](https://gwern.net/doc/psychology/music/distraction/2010-kampfe.pdf)); un experimento
  preregistrado de CHI 2026 sobre data-videos no halló efecto consistente en persuasión,
  engagement ni recuerdo. **La música no es upside gratis: se la tiene que ganar.**
- **Cuál beat lleva cada línea.** La máquina encuentra todos los downbeats; no te dice cuál
  debe cargar el giro.
- **Dónde cae el silencio.** Olsen 2002 da el techo (el contraste funciona si dura **≤ 3 s**)
  pero no el lugar.
- **Si el sync apretado lee como diseño o como Mickey Mousing.** Chion llama a eso *"el colmo
  del ridículo en la estética de la música de cine"* (*Audio-Vision*, pp. 121-22). La variable
  que decide —*¿hay otro contenido sonoro?*— es cualitativa.
- **El 74% de la Regla de los Seis de Murch**: Emoción 51% + Historia 23%. **Ritmo es el 10%.**
  Un pipeline que optimiza ritmo optimiza un décimo del problema.

---

## 3. LAS DOS COSAS QUE SÍ TIENEN EVIDENCIA FUERTE

### 3.1 Instrumental bajo la voz — es hallazgo, no convención

Salamé & Baddeley 1989: error de recuerdo **50,8% (con letra) / 41,4% (instrumental) / 36,6%
(silencio)**. El experimento 3 mata el mecanismo alternativo: ruido rosa modulado por la envolvente
*del habla misma* no se diferenció del silencio, mientras la música instrumental sí. **La
interferencia viene del contenido tipo-habla entrando al bucle fonológico, no del volumen que
fluctúa** ([PDF](https://gwern.net/doc/psychology/music/distraction/1989-salame.pdf)).

Tamaños de efecto modernos (Souza & Barbosa 2023): letra vs. silencio **d = −.32**; lo-fi
instrumental **d = −.16 con BF₁₀ = 0.33 — evidencia A FAVOR del nulo**
([DOI](https://doi.org/10.5334/joc.273)). Peor todavía si la letra está en tu idioma. Que te guste
la canción no te salva.

⛔ **Cama con voz cantada bajo un guion hablado: prohibido.** Va en el JSON de marca como
prohibición, igual que el dorado.

### 3.2 La cama tiene que quedarse quieta

Schweppe & Knigge 2020: una cama cuyo **tempo cambia** cuesta comprensión (52% → 49%, p = .003);
cambiar de modo mayor/menor no hace nada (BF₀₁ = 16.9)
([PMC7381464](https://pmc.ncbi.nlm.nih.gov/articles/PMC7381464/)). Y el nivel es el multiplicador,
no el BPM: sólo la música **rápida Y fuerte** bajó la comprensión; **rápida y baja fue
indistinguible del silencio** (Thompson et al. 2012).

⚠️ **El mapeo BPM ↔ velocidad del habla es FOLKLORE.** No existe estudio, editorial de librería ni
editor musical que lo prescriba. El famoso "150 wpm" sale de un **comentario sin cita** en un
tutorial de NCVS; la medición real sobre corpus da 196 wpm brutas / 236 netas de silencio
(Yuan et al. 2006, Switchboard, 2.438 conversaciones). El *">120 BPM sube el VTR"* de TikTok viene
**sin metodología declarada**.

📌 **Dato que sí aplica a vos: el español corre a 7,82 sílabas/s contra 6,19 del inglés**, con
menos información por sílaba (Pellegrino et al. 2011). Tu locución mete **más eventos por segundo**
contra la cama que un guion en inglés. La cama va más baja, no más alta.

---

## 4. EL CONFLICTO QUE HAY QUE RESOLVER ANTES DE CONSTRUIR

`recut.py` y el diseño sonoro se pelean por el mismo recurso: **el aire**.

Medido el 12-sep-2026 (`silencedetect=noise=-32dB:d=0.20`):

| | duración | huecos | silencio | hueco más largo |
|---|---|---|---|---|
| fuente cruda (`tecnico-vs-no-tecnico`) | 102,7 s | 34 | 10,6 s (**10,3%**) | 0,61 s |
| después de `recut.py` (`tu-carrera`) | 100,5 s | 10 | 2,4 s (**2,4%**) | **0,27 s** |

`recut.py` corre con `--pad 0.14`, o sea que **ningún hueco supera ~0,28 s por construcción**.
Consecuencias:

1. **El silencio como énfasis no está disponible** — y es la jugada mejor sostenida de todo este
   documento. Si se quiere, el recut tiene que dejar el hueco **a propósito**.
2. **Una cama estaría agachada el 97,6% del tiempo.** No es una cama que respira en los huecos:
   es una cama constante y muy baja. Es un diseño distinto y hay que decidirlo, no descubrirlo.
3. Los únicos lugares con aire por construcción son el **hook (0–3 s)** y el **cierre**.

**Esto es decisión de Walter, no default del sistema.**

---

## 5. EL VOCABULARIO — SFX por trabajo estructural, no por nombre

Chion: la **síncresis** es *"la soldadura espontánea e irresistible entre un fenómeno auditivo y
uno visual cuando ocurren al mismo tiempo"*, y un punto de sincronización es *"un momento saliente…
más bien como un acorde acentuado en música"*. Y el remate que ahorra discusiones de gusto:
**"para un plano de un martillo, cualquiera de cien sonidos sirve"**
([Audio-Vision](https://monoskop.org/images/6/6d/Chion_Michel_Audio-Vision.pdf)).

→ **El instante carga el peso. La elección de la muestra pesa mucho menos.** Por eso el módulo
gatea *colocación*, no *gusto de muestra*.

| Trabajo | Qué hace | Familia |
|---|---|---|
| **Atmósfera** | sostiene, no marca | cama, drone |
| **Anticipación** | promete que algo viene | riser |
| **Transición** | tapa la costura | whoosh |
| **Impacto** | confirma la llegada | hit, boom |
| **Puntuación** | marca un detalle chico | click, pop, ping, key-press |

Material Design da el vocabulario de forma (sin números, y eso también es un hallazgo: las cifras
tipo *"Material sounds under 8 ms"* que circulan son invención de terceros): *"un ataque más suave
es más ambiental… uno más filoso es más enérgico"*; *"un decay corto se siente chico y rápido…
uno largo, grande y lento"*. Y la asimetría que sí importa: **las salidas son más rápidas que las
entradas** — el sonido de salida tiene que ser más corto que el de entrada.

🔗 **El gancho con lo que ya existe**: `design_system/motion.js` ya tiene el vocabulario de
intención (`snap · settle · alive · pop · weight`) con duraciones de resorte en forma cerrada, y
`brands/<marca>.json` ya declara `energy` para el movimiento. **El sonido se deriva de ahí** — no
se coloca a mano. Para un resorte con overshoot, el ataque va en **el pico del overshoot, no en
el primer contacto**.

---

## 6. LO QUE HYPERFRAMES YA RESUELVE Y NO HAY QUE CONSTRUIR

Verificado contra el código de `hyperframes@0.8.29` el 12-sep-2026, no contra su documentación.
El pin del repo pasó a `0.8.214` (noviembre 2026). Esta sección no se reescribió contra el
código nuevo: un proyecto que no arranque en 0.8.214 se queda con su `engine.version`.

| Ya existe | Cómo |
|---|---|
| Cadena de 16 efectos por pista | `data-fx-chain` (EQ, compresor, limitador, gate, saturación, delay, reverb…) |
| Envolventes de automatización | `data-automation`, lanes `volume` o `fx.<id>.<param>`, 512 puntos |
| **Ducking espectral medido** | `data-fx-carve` + `scripts/carve.mjs` — 6 bandas de 250 Hz a 2,5 kHz, −7,4 dB c/u y −14,8 dB en 1,6 kHz a fuerza 0,8. **Es exactamente la jugada de DPA, ya implementada.** |
| Buses de submezcla | `<hf-audio-group>` |
| Match de loudness entre dos clips | `hyperframes normalize-audio` |
| Detección de onsets | `hyperframes beats` |

⚠️ **`hyperframes beats` NO da una grilla musical.** Probado acá el 12-sep sobre una pista real de
83 s: devolvió 246 beats y `bpm 181.3`, con desviación de intervalos de **0,154 s** (min 0,106 ·
max 0,875) → **son onsets crudos, no compases**. El BPM es lectura a doble tiempo y la confianza
**ni se escribe al archivo**. No hay downbeats, no hay compases, no hay secciones.

**Faltan, y hay que construirlos:** medición de LUFS de la mezcla final · objetivo de entrega ·
techo de true-peak · grilla de compases · identidad sonora por marca · vocabulario de SFX con roles ·
binding SFX↔motion · aritmética de pre-roll · conteo de capas de Murch · piso de 460 ms.

---

## 7. CÓMO SE SACA LA GRILLA DE COMPASES

**`beat_this`** (CPJKU, ISMIR 2024) es lo único que junta las tres: mantenido, da **downbeats**
de verdad, e instala limpio en Apple Silicon.

```bash
python3.13 -m venv ~/.beats/venv
~/.beats/venv/bin/pip install torch torchaudio beat-this
~/.beats/venv/bin/beat_this pista.mp3 -o grid.beats --gpu=-1
```

Precisión (GTZAN held-out): beat F1 **89,1** · downbeat F1 **78,3**. En 8-fold: Ballroom 97,5/95,3 ·
Harmonix 95,8/90,7. En pop/electrónica en 4/4 estable —o sea casi cualquier cama— la grilla sale
bien ~90–95% de las veces. **No confiar en rubato, clásico ni acústico en vivo.**

⛔ **madmom está muerto en PyPI** (sin release desde el 14-nov-2018, tope Python 3.9 / numpy <1.20).
Lo dice el propio equipo que lo escribió, en el README de `beat_this`.

🔑 **Pero la salida buena no es detectar: es ENCARGAR.** Si la cama se genera pidiendo un BPM, la
grilla de compases se conoce **por construcción** y no hay F1 que valga — mismo principio que
«la marca es un DATO, no una constante». La detección queda sólo para música ajena.

---

## 8. LAS TRAMPAS DEL RENDER EN NAVEGADOR

- **`<audio>` no puede alimentar un `OfflineAudioContext`.** `createMediaElementSource()` sólo
  existe en `AudioContext`. Es la causa número uno de que un render offline vuelva mudo.
- **`decodeAudioData` remuestrea en silencio** a la tasa del contexto. Un asset a 44,1 kHz decodificado
  en un contexto a 48 kHz pasa por el remuestreador de Chrome, que **no es el de ffmpeg**.
  → **Conformar todo a 48 kHz con ffmpeg antes de que toque el navegador.**
  *(El extractor audio-reactivo de HyperFrames corre a 44,1 kHz y el render a 48 kHz: no mezclar supuestos.)*
- **`setTimeout` deriva decenas de ms.** El reloj de audio corre en su propio hilo. Nada se dispara
  desde un timer: todo con tiempo absoluto, agendado antes de `startRendering()`.
- **`DynamicsCompressorNode` no es portable** — su curva y su lookahead son definidos por la
  implementación. **Compresión y limitación en ffmpeg**, donde los números se controlan y se re-miden.
- **La mezcla del navegador es un borrador: se mide el archivo.** Un grafo de Web Audio suma
  felizmente por encima de 0 dBFS y clipea al exportar sin avisar.

---

## 9. FOLKLORE — marcado para que no vuelva a entrar

Sin fuente, aunque se repita en todos lados: el mapeo BPM↔velocidad del habla · «whoosh ≈ 400-500 ms» ·
«riser = 1-2 compases» · specs de sub-drop · reglas de cola de impacto · cualquier límite de SFX
por minuto · «música 18-20 dB bajo la voz» como si fuera norma · «Material sounds under 8 ms» ·
las cifras de TikTok (>120 BPM, 63% en 3 s, 90% de recuerdo) · «TikTok fuerza mono» ·
«el 71% decide en 3 segundos».

El único dato de retención con revisión por pares: **55% de los videos se saltan, 24% antes del 20%
del video** (Zannettou et al., CHI '24, 347 usuarios, 9,2M recomendaciones).

---

## 10. DE DÓNDE SALE EL SONIDO — licencias (verificado 13-sep-2026)

Citado de los términos de cada proveedor, no de blogs. Lo no confirmado dice **UNVERIFIED**.

| Servicio | API | ¿Sirve para trabajo de CLIENTE? | Semilla | Veredicto |
|---|---|---|---|---|
| **Stable Audio 2.5** | ✅ REST síncrona | ✅ **cede el Output entero** | ✅ | **USAR** — el papel más limpio |
| **Lyria RealTime** (Gemini) | ✅ WebSocket | ✅ tier pago + indemnización Google | ✅ | **USAR** — el único con **BPM real (60–200)** |
| **ElevenLabs SFX** | ✅ `/v1/sound-generation` | ✅ royalty-free **incluida publicidad** | ❌ | **USAR** — pero congelando la salida |
| **ElevenLabs Music** | ✅ `/v1/music` | ⚠️ *"except film, TV, radio"* en **todo** tier self-serve | ⚠️ | CONDICIONAL — online sí, broadcast no |
| **Epidemic Sound Pro** | ✅ Partner API gratis | ✅ **sub-licenciable**, cubre URLs del cliente | — | **USAR** — el curado de respaldo |
| **Artlist Pro** | ❌ enterprise | ✅ *"your client is covered by your license"* | — | USAR — ⚠️ prohíbe descarga automatizada |
| **Suno** | ❌ **ninguna oficial** | ⚠️ Pro/Premier ceden derechos, pero **20/60 descargas al mes** desde 3-sep-2026 | ❌ | **EVITAR** — los wrappers violan ToS |
| **Udio** | ❌ | ❌ **descargas desactivadas desde oct-2025** | — | **EVITAR** — no se puede exportar |
| **Meta MusicGen** | self-host | ❌ **pesos CC-BY-NC 4.0** | ✅ | **EVITAR** — no comercial |
| **Beatoven.ai** | ✅ | ❌ **Beatoven es dueño del track** | ❌ | **EVITAR** para cliente |

### La trampa de la suscripción está AL REVÉS del folklore

Se dice que si se cae la suscripción te reclaman los videos viejos. **Falso** en los tres grandes:
lo publicado queda cubierto para siempre. Lo que muere es el derecho a hacer **contenido nuevo**.

Epidemic, verbatim: *"no need to take down or otherwise withdraw any Productions published in
accordance with this License, even after expiration… you **may not use the Licensed Work(s) to
create any new Productions**… even if you have downloaded such Licensed Work(s) during the
Subscription Period."*

⚠️ **La asimetría que sí muerde: qué cuenta como protegido.**

| | requiere | un montaje SIN publicar |
|---|---|---|
| Epidemic **Creator** | *completed, uploaded, and **published*** | ❌ expuesto |
| Epidemic **Pro/Business** | *completed* | ✅ cubierto |
| **Artlist** | *published in any media during your term* | ❌ expuesto |
| **Soundstripe** | *created and licensed* | ✅ cubierto |

→ **Artlist además borra tu biblioteca al vencer** (*"available for download… as long as you have
an active paid subscription"*). Guardar copias locales. En Soundstripe, exportar los PDF de
Proof of License **antes** de cancelar.

Único caso real de no-grandfathering: **Soundraw** con tracks **sin modificar** en contenido de
meditación/lo-fi — *"you can only keep your content published while your subscription is active."*

### Por qué el vocabulario se CURA y no se genera por video

El argumento decisivo es el determinismo: **el endpoint de SFX de ElevenLabs no tiene parámetro
`seed`**. Generar en tiempo de render significa que la misma composición produce un whoosh
distinto cada corrida — se pierde la reproducibilidad, que es el punto del pipeline. Y hasta
ElevenLabs Music avisa: *"exact reproducibility is not guaranteed and outputs may change across
system updates"* — o sea que una actualización del modelo te cambia el sonido de la marca sin avisar.

Los otros tres: **15 sonidos reusados en 58 videos SON la marca sonora** (prompt→salida es
uno-a-muchos, re-tirar garantiza deriva) · el render debe correr **offline**, sin API key ni
posibilidad de rate-limit · y cada archivo congelado lleva **un solo recibo** (fecha, plan,
versión de términos), lo que vuelve probable la procedencia si algún día llega un reclamo.

⚠️ **Una restricción sobre la librería curada: es INTERNA.** ElevenLabs prohíbe *"Music Libraries
& Repositories"* en todo tier self-serve — armar un repositorio de Output *"with the intent of
licensing it or otherwise making it available to third parties"*. Usar tus SFX en tus videos y en
los de tus clientes está bien; **entregarle al cliente el pack de SFX crudo, no.** Misma forma en
Soundraw (se entrega el video, nunca el track) y Artlist (*"the License is only yours"*).
