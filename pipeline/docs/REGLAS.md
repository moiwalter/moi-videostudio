# Reglas del pipeline — lo que ya se aprendió y vale para CUALQUIER video

> Creado el 1-nov-2026 (nació como LECCIONES.md; ese nombre quedó para la bitácora). Casi todo lo que el pipeline
> aprendió de edición salió de los videos de Christian (cvander: 45 proyectos, contra 10 de Moi). Esas reglas vivían en
> `second-brain/02-projects/cvander/lessons.md`, un archivo de cliente que un video de Moi, Nacho o Startupeable nunca
> leía.
>
> **Leer al arrancar cualquier video**, junto con `START_HERE.md`.

## Tres archivos, tres cosas distintas

| Archivo | Qué guarda | Cuándo cambia |
|---|---|---|
| **REGLAS.md** (este) | Lo ya aprendido: vale para todo video, de cualquier marca | Cuando una lección se confirma |
| [LECCIONES.md](LECCIONES.md) | La bitácora: lo que pasó en un video y todavía no es regla | Cada revisión de Walter |
| `biblioteca/marcas/<marca>.json` → `prohibido` | Lo que no es de ESA marca: colores, fuentes, recursos de otra identidad. Una regla que vale para cualquier marca no va ahí: va acá | Cuando cambia la identidad |
| `biblioteca/clientes/<cliente>.json` | Las reglas de UNA persona (Chris: «AI», inglés, guiño, Freddy), con su fuente y su chequeo | Cuando esa persona pide algo |

- **Id `Vnn`** = la regla. **`origen: cvander L0xx`** = la lección donde nació, con el caso completo. Ni los Vnn ni los
  L0xx se renumeran.
- **Chequeo:** ✅ lo revisa una herramienta y frena · ◐ lo revisa en parte · 🔧 hay herramienta, pero nada frena si no
  se usa · 👁 a ojo u oído · 🎯 candidato a chequeo (se puede medir; todavía nadie lo mide).
  Una regla que se puede revisar en código se vuelve chequeo: en prosa se salta.
- **Si la regla ya está escrita en otro doc del pipeline**, acá sólo va la línea y el link. El texto vive en UN lugar
  (`SEGMENTAR-POR-IDEAS.md`, `PORTADAS.md`, …).
- Los ejemplos son de Chris porque ahí se aprendió. La regla vale para quien hable en el video.

---

## 1. Corte y habla

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V01 | Todo corte se valida en la energía del audio, no en los tiempos de whisper (se adelanta 0,2–3 s y varía por tramo). | [SEGMENTAR §1](SEGMENTAR-POR-IDEAS.md#1-tiempos-reales-de-cada-palabra) | cvander L031, L033 | 👁 oído + energía |
| V02 | Los tiempos de palabra salen de alineación forzada (wav2vec2 VoxPopuli ES), y en cada unión se mira la energía del original ±1,5 s. | [SEGMENTAR §1](SEGMENTAR-POR-IDEAS.md#1-tiempos-reales-de-cada-palabra) · `templates/micro-podcast/alinear.py` | cvander L033 | ◐ `source-state` ata el transcript al corte; la alineación no se verifica |
| V03 | Los «eh», las pausas y los retakes no están en la transcripción: se buscan en el audio con `limpiar-habla.py`, **antes** del mapa. Todo corte se le propone a Walter; él decide cada uno. | [SEGMENTAR §0](SEGMENTAR-POR-IDEAS.md#0-limpiar-el-habla-antes-de-fijar-el-corte) | cvander L036 | ✅ `source-state` deja PENDIENTE sin limpieza · `limpiar-habla.py --check` |
| V04 | La alineación marca el FIN de cada palabra antes de tiempo: se corrige con la onda antes de cortar. | aquí ↓ | cvander L057 | 🔧 `palabras-onda.py` · 🎯 borde de tramo dentro de una palabra |
| V05 | Un corte por contenido (frase, retake) no se arma con el borde de la palabra alineada. | aquí ↓ | cvander L045 | 👁 se escucha cada empalme |
| V06 | Una frase que se repite se ubica por la frase anterior y la siguiente, no por la primera coincidencia. | aquí ↓ | cvander L029 | 👁 |
| V29 | Cada tramo se transcribe en SU idioma: un tramo en inglés jamás con `-l es`. | aquí ↓ | nota de TRANSCRIPT.md (cvander adobe, jobs) | 🎯 idioma del transcript contra el idioma de cada tramo |

### V04 · Cada palabra se mide en la onda antes de cortar
- **Regla:** después de alinear, correr `tools/palabras-onda.py <audio> <words.json> <salida.json> [--offset s]`.
  Estira el final de cada palabra mientras haya voz y adelanta el inicio. Recién con esas duraciones se corre
  `limpiar-habla.py` (V03) y se arma el corte. Más de 0,3 s de voz pegada al final = «eeh» arrastrado: se marca
  (`eh_pegado`) y, si se corta, el borde lleva un fundido de 80 ms en vez de 15 ms.
  **Antes de mostrar un corte:** ningún borde de tramo cae dentro de una palabra medida.
- **Por qué:** la alineación (torchaudio) marca el fin ~80 ms antes en promedio, y hasta 0,8 s. En el ep02 del
  micro-podcast (29-oct) 36 uniones caían sobre voz y quedaban 9 «eh» (uno de 2,6 s). Walter: «tienes que matchear
  los waves para saber cuánto dura cada palabra».
- **Origen:** cvander L057 · proyecto `cvander/2026-10-cvander-preguntale-humano-ep02`.

### V05 · Los cortes de frase no se proponen con el borde de la palabra alineada
- **Regla:** «inicio de la palabra → inicio de la siguiente» cae dentro de la coarticulación y el empalme suena mal
  cortado. Hasta que el borde se ajuste al valle de energía (V04) **y se haya escuchado cada empalme**, el agente sólo
  señala la frase; el corte lo hace Walter.
- **Por qué:** ep01 del micro-podcast (13-oct): 13 cortes propuestos sin oír ninguno. Walter: «está mal cortado».
- **Origen:** cvander L045.

### V06 · Las frases repetidas se ubican por su contexto
- **Regla:** cuando una frase aparece más de una vez, el recurso se ancla con la frase previa, la siguiente y los
  tiempos por palabra. Si Walter corrige la ubicación, la corrección reemplaza la anterior y el recurso desplazado
  vuelve con sus animaciones. Feedback sin timestamp = buscar todas las apariciones antes de elegir.
- **Por qué:** 0910 (13-sep): el blog se puso en 52,86 s; era en 34,10 s, la otra vez que se decía lo mismo.
- **Origen:** cvander L029.

### V29 · Cada tramo se transcribe en su idioma
- **Regla:** `-l` es el idioma del audio, no `es` por defecto. Si alguien habla en inglés (un tramo, una cita, un
  invitado), ese tramo se transcribe con `-l en`, o con large-v3, que es el único modelo multilingüe. Qué se hace
  después con ese inglés en pantalla lo decide el cliente (Chris: `biblioteca/clientes/cvander.json`, C01).
- **Por qué:** pedirle a whisper un idioma que no es el del audio no falla: **traduce y alucina**. Un corte en inglés
  con `-l es` devolvió 426 palabras en vez de 324 y 51 8-gramas repetidos. Los beats encima caen en la palabra
  equivocada y `validate-kit` da verde, porque valida contra el transcript y no contra el audio.
- **Origen:** la nota que llevan los `TRANSCRIPT.md` de cvander (adobe, jobs).

---

## 2. Audio y música

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V07 | Dos personas grabadas aparte: nivelar POR PERSONA antes de normalizar. | aquí ↓ | cvander L048 | ✅ `nivelar-voces.py` avisa >1,5 LU entre personas · `qc-sonido.mjs` |
| V08 | La música bajo la voz es UN arco continuo con un protagonista, no secciones que entran y salen. | aquí ↓ · [SOUND.md](SOUND.md) | cvander L053 | 👁 oído |

### V07 · Nivelar por persona antes de normalizar
- **Regla:** con dos o más fuentes de voz, medir el LUFS de cada persona sobre sus tramos e igualarlas; recién después
  normalizar (−14 LUFS, TP −1,5). Un loudnorm global no arregla la diferencia: el volumen salta al cambiar de persona.
  `python3 tools/nivelar-voces.py <raw> <out> --tramos "0-24.1:a,24.1-67.2:b,…"` (mide, iguala, normaliza en dos
  pasadas y verifica por tramo).
- **Por qué:** ep01 del micro-podcast (14-oct): una voz a −23 LUFS y la otra a −17 (6 dB de salto).
- **Origen:** cvander L048.

### V08 · Un arco musical continuo
- **Regla:** un instrumento protagonista reconocible suena de principio a fin, y la tensión crece por automatización
  (filtro que se abre, capas que se SUMAN, cuerdas que suben un semitono por bloque). Un solo silencio, en el giro.
  La música va ~8 LU bajo la voz antes de un ducking de 5 dB; a 12 LU se pierde.
- **Por qué:** cvander-jobs v1 (21-oct): piano solo → pulso → cuerdas por sección. Walter: «too segmented… you have
  to build that tension».
- **Plantilla:** `proyectos/cvander/2026-10-cvander-jobs/edicion/tools/score2.py` (atada a ese video: se copia y se adapta).
- **Origen:** cvander L053.

---

## 3. Recorte (alpha) y capas

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V09 | La composición define si un recurso sirve: se evalúa ya encuadrado, en vertical y con la persona delante. | aquí ↓ | cvander L023 | 👁 Studio (G14) |
| V10 | Una máscara defectuosa se audita en TODOS los tramos que comparten su origen. | aquí ↓ | cvander L027 | 👁 |
| V11 | Un recorte achicado se funde en los bordes donde el cuerpo tocaba el cuadro. | aquí ↓ | cvander L032 | 👁 Studio |
| V12 | El recorte se saca del CORTE mismo, y la sincronía se verifica por número de cuadro. | aquí ↓ | cvander L058 | 🎯 comparación por número de cuadro |
| V30 | Todo overlay con alpha para CapCut sale en ProRes 4444 premultiplicado; nunca HEVC con alpha. | aquí ↓ | marca moi (prohibido) · KEY-FILES regla 1 | 🔧 `alpha.sh` renderiza en ProRes 4444 · ✅ `alpha-qc.py --premult` |
| V34 | En un overlay con alpha, ninguna sombra de más de 8 px: se hornea en el alpha como una mancha. | aquí ↓ | marca nacho (prohibido) · SCENE_PLAYBOOK §3b regla 1 | 👁 |

### V09 · La composición define si un recurso sirve
- **Regla:** orden de capas: original → recurso (con feather) → el mismo sujeto recortado → subtítulos. Base y alpha
  comparten fuente, tiempo y pose. Una fuente correcta puede dar una mala escena: se juzga el recurso ya encuadrado.
- **Por qué:** 0910 (13-sep): una demo horizontal quedó ilegible en vertical, y las capas no coincidían.
- **Origen:** cvander L023.

### V10 · Auditar todos los usos de una máscara defectuosa
- **Regla:** si el alpha se trae cielo o edificios, inspeccionar el recorte y todos los tramos que salen del mismo
  origen. Si el defecto está horneado, reconstruir las capas; no esconderlo cortando el pelo. RVM resolvió la toma de
  0910 donde u2net falló, pero es una solución probada en esa toma, no una garantía.
- **Por qué:** la v2 de 0910 arregló una escena y dejó el mismo defecto en otras.
- **Origen:** cvander L027.

### V11 · Un recorte achicado se funde en los bordes
- **Regla:** si el sujeto recortado se muestra a menos de su escala completa, fundir los bordes del contenedor
  (máscara lateral y superior) donde la ropa o el pelo tocaban el borde de la toma original. Revisar en el Studio.
- **Por qué:** programar-profesion (29-sep): Chris se veía «chico» y como un rectángulo pegado.
- **Origen:** cvander L032.

### V12 · El recorte sale del corte, y se verifica por cuadro
- **Regla:** la máscara se corre sobre los cuadros del corte que se muestra, nunca sobre la toma original convertida
  aparte. Cada tramo ocupa los cuadros EXACTOS de su tiempo (`trim=end_frame`), o el redondeo se acumula. Cualquier
  cambio del corte regenera el recorte. Para verificar: comparar por número de cuadro (`select=eq(n,N)`), no con `-ss`
  (busca distinto en MP4 y WebM y da falsos desfases).
- **Por qué:** ep02 (31-oct): «lo de atrás desfasado» cuando Chris se movía. Tres causas: no se regeneró el recorte
  tras cambiar el corte, la toma del iPhone tenía tiempos irregulares y el redondeo por tramo sumaba cuadros.
- **Referencia:** `proyectos/cvander/2026-10-cvander-preguntale-humano-ep02/edicion/corte/alpha.py`.
- **Origen:** cvander L058.

### V30 · Alpha para CapCut: ProRes 4444 premultiplicado
- **Regla:** CapCut muestra fondo negro con HEVC con alpha, y asume alpha premultiplicado. Se renderiza con `alpha.sh`
  (ProRes 4444, `yuva444p12le`) y se verifica con `python3 tools/alpha-qc.py --premult <clip.mov>` (p99 ≈ 1,0). Nunca se
  juzga un alpha sobre negro: el negro esconde el defecto.
- **Origen:** estaba en el «prohibido» de la marca Moi (2-nov-2026 pasó acá: vale para cualquier marca).

### V34 · Sombras cortas en overlays con alpha
- **Regla:** sombras de hasta 8 px en lo que va con alpha. Una más larga queda horneada en el canal alpha y se ve como
  mancha sobre el footage.
- **Origen:** estaba en el «prohibido» de la marca Nacho; el detalle está en [SCENE_PLAYBOOK §3b](SCENE_PLAYBOOK.md).

---

## 4. Escenas y recursos

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V13 | Rostro, logo y demo cumplen funciones distintas. | aquí ↓ | cvander L024 | 👁 |
| V14 | El timing va por significado: entra con la mención, da tiempo de lectura y respeta las excepciones aprobadas. | aquí ↓ · [SEGMENTAR «Cuánto dura una imagen»](SEGMENTAR-POR-IDEAS.md#cuánto-dura-una-imagen) | cvander L025 | 👁 |
| V15 | Cuando el guion es flojo, el material REAL carga la retención; el hook va en un solo golpe. | aquí ↓ | cvander L030 | 👁 |
| V16 | Texto que repite el subtítulo no es una escena; el objeto real, y mejor si es de la vida de quien habla. | [SEGMENTAR «Material real»](SEGMENTAR-POR-IDEAS.md#material-real-no-texto-que-repite-el-subtítulo) | cvander L034 | 👁 |
| V17 | Ningún tramo de más de ~2 s en que la pantalla no cambie. | aquí ↓ | cvander L047 | 🎯 hoy `qc-master` sólo mide la cámara quieta al final |
| V18 | El texto del hook dice lo que la persona dice en sus primeros segundos, con sus palabras. | aquí ↓ | cvander L059 | 🎯 QR escaneado desde un cuadro exportado |
| V19 | Un invitado se presenta con autoridad verificable: logo oficial + cargo + un dato con fuente. | aquí ↓ | cvander L044 | ◐ `recursos/invitado/FUENTES.md`, a mano |
| V20 | Si ya existe una pieza aprobada, se usa ESA, no una aproximación. | aquí ↓ | cvander L043 | 👁 |
| V32 | Ninguna cifra sin fuente, y toda cifra con separador de miles y coherente con lo que se dice. | aquí ↓ | marcas moi y nacho (prohibido) | 👁 |
| V33 | Una captura real (prensa, tweet, sitio) o un logo ajeno conserva su identidad: nunca se repinta ni se tiñe a la paleta de la marca. | aquí ↓ | marcas startupeable y nacho (prohibido) | 👁 |

### V13 · Rostro, logo y demo cumplen funciones distintas
- **Regla:** el rostro va en el contexto del anuncio, el logo auténtico para un recap, la interfaz legible para
  demostrar. Cuando se pide una fuente exacta, va la exacta y actual. Material genérico no explica el producto.
- **Por qué:** 0910: cambiar el logo por la cara del fundador no explicaba nada.
- **Origen:** cvander L024.

### V14 · Timing por significado y excepciones explícitas
- **Regla:** el recurso entra con su mención y se queda lo que tarda en leerse. Un objeto que explica una idea se
  mantiene a través de la animación. Una corrección local NO se extiende a todo el video, y lo que Walter ya aprobó
  queda como excepción aunque contradiga la regla.
- **Por qué:** 0910: un recurso entraba antes de nombrarlo, pero Walter aclaró que el opening estaba bien así.
- **Origen:** cvander L025.

### V15 · El material real carga la retención
- **Regla:** si el video gana «por lo visual», cada escena explicativa lleva material REAL: demo oficial, terceros
  hablando del tema, noticias capturadas, logos de las marcas comparadas. El hook entra todo de una vez (texto + logo +
  demo + prueba social) desde el cuadro 0, no en secuencia. Gráficas: barras con contraste, logo de cada proveedor y
  datos de la fuente publicada. «X como Y» = la noticia de X y después la de Y.
  **Antes de recrear algo, buscar en proyectos anteriores de VideoStudio y en `biblioteca/documental/`.**
- **Por qué:** Jev (25-sep): hook secuencial, gráficas con etiquetas de texto y un chat inventado.
- **Origen:** cvander L030.

### V17 · Ningún tramo de más de ~2 s sin cambio
- **Regla:** antes de renderizar, barrer el master buscando huecos: tramos donde la voz pide imagen y en pantalla no
  pasa nada. Cada ~1,5–2 s algo entra, se mueve o cambia de estado, anclado a una palabra. Un dato que no se puede
  mostrar con cifras se muestra igual: la hoja que corre, las filas, la región que se enciende. Complementa la regla de
  «>3 s sospechosa» de SEGMENTAR: aquélla mide el plano, ésta el master entero.
- **Por qué:** ep01 (14-oct): «1:36 hasta 1:41 wtfffff?», 5 s de toma quieta antes de la gráfica.
- **Origen:** cvander L047.

### V18 · El hook dice lo que la persona dice
- **Regla:** el título del hook repite la tesis de los primeros ~3 s, con sus palabras; nada de metáforas que la
  persona no dice. Si en el cierre menciona una comunidad o un link, va su QR, **verificado escaneándolo desde un
  cuadro del video exportado**.
- **Por qué:** «optimismo» (31-oct): Chris no entendió un hook con una frase que él nunca dijo.
- **Origen:** cvander L059 (la parte del clip vetado es de la marca y se quedó allá).

### V19 · El invitado se presenta con autoridad verificable
- **Regla:** al entrar un invitado: logo de su empresa (descargado del sitio oficial, nunca generado) + nombre + cargo
  + UN dato que le dé peso, citado de su LinkedIn o sitio en `recursos/invitado/FUENTES.md`. La frase se escribe sobre
  el dato, sin inflarlo («profesionistas del derecho» no es «abogados»). Un dato que la persona no nombra se le
  confirma ANTES de ponerle logo.
- **Por qué:** micro-podcast ep01 (10-oct): Walter pidió el tag «so we can give him more authority».
- **Origen:** cvander L044.

### V20 · Si existe una pieza aprobada, se usa ESA
- **Regla:** «usa la intro / la caja / lo que hicimos» = portar la composición aprobada con su timeline, tiempos y
  sonido, quitando sólo lo que se pidió quitar. «Sólo la caja» = la caja CON su animación, no un recuadro parecido.
- **Por qué:** prototipo de formatos (10-oct): una caja estática «inspirada» en la intro. Walter: «grab the one that
  we did, that was very, very well prepared».
- **Origen:** cvander L043.

### V32 · Cifras con fuente y separador de miles
- **Regla:** si la persona no dice un número, ningún contador lo inventa. Los que aparecen llevan separador de miles y son
  coherentes con lo que se dice (ej.: no $250 cuando el punto es $2.500).
- **Origen:** estaba en el «prohibido» de las marcas Moi («números sin separador de miles o cifras incoherentes») y Nacho
  («cifras inventadas»).

### V33 · Lo ajeno conserva su identidad
- **Regla:** una captura de prensa, un tweet o un sitio vale porque conserva la identidad del medio: si se repinta, deja de
  ser evidencia. Un logo ajeno es una cita: se respeta su color.
- **Origen:** estaba en el «prohibido» de las marcas Startupeable (captura de prensa) y Nacho (teñir un logo ajeno).

---

## 5. Animación, texto y transiciones

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V21 | Toda unión del footage lleva transición; el cambio de persona, más fuerte (excepción: dentro del invitado, corte seco). | aquí ↓ | cvander L046 | 🔧 `templates/transiciones-corte.js` |
| V22 | Un reemplazo «a mano» va EN LA MISMA LÍNEA de lectura, no flotando encima. | aquí ↓ | cvander L042 | 👁 |
| V23 | Un style frame ya usa el subtítulo aprobado de la marca, y el subtítulo nunca pisa la cara. | aquí ↓ | cvander L038 | 👁 spec en la marca |

### V21 · Toda unión lleva transición
- **Regla:** ningún corte del footage queda duro. Cada unión (retake quitado, cambio de tramo) lleva un zoom con
  desenfoque corto; el cambio de persona, el mismo efecto más fuerte; los takeovers entran y salen con ese mismo
  lenguaje. Código: `templates/transiciones-corte.js` — `cutT(t, 1)` dentro de una persona, `cutT(t, 1.6)` al cambiar
  de persona, `tkIn` / `tkOut` en los takeovers. Una intro de serie dentro del episodio va sin sus SFX.
- **Por qué:** ep01 (14-oct): «tienes que tener una transición entre las escenas para que no se vea cortado».
- **Excepción:** dentro de la respuesta de un invitado (micro-podcast) va corte seco: en ep02 (31-oct) Walter quitó «los
  zoom-blur entre cortes de Victoriano». Es la perilla `transicionDentroInvitado` (default 0); el resto de las uniones sigue la regla.
- **Origen:** cvander L046; excepción, ep02 31-oct.

### V22 · El reemplazo va en la misma línea
- **Regla:** cuando una animación tacha una palabra y escribe otra, la nueva va en el mismo lugar y la misma línea base
  (tachar → desvanecer → escribir ahí), para que la frase se lea de corrido. Nada de escribirla arriba ni de marcas de
  corrector (∧). Las posiciones se miden en reposo, ANTES de crear los `fromTo` (`immediateRender` desplaza o escala el
  elemento y la medición sale corrida).
- **Por qué:** intro de «Pregúntale a un humano» (8/9-oct): «queda muy lejos… fuera de lugar de cómo se leen las cosas».
- **Origen:** cvander L042.

### V23 · El style frame usa el subtítulo aprobado
- **Regla:** hasta en un boceto de opciones, los subtítulos se copian del último master aprobado de esa marca (fuente,
  tamaño, caja, sombra), no «a ojo». Van en una franja libre (entre el recurso y la cabeza, o bajo el mentón), nunca
  sobre ojos o boca. La spec concreta vive en la marca (`biblioteca/marcas/<marca>.json` y sus lecciones).
- **Por qué:** cvander-adobe (8-oct): «no estás respetando el font de chris y estás poniéndolo encima de su cara».
- **Origen:** cvander L038.

---

## 6. Revisión

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V24 | Se revisa en el Studio nativo, escena por escena; nada de un MP4 por avance. | [REVIEW.md](REVIEW.md) · aquí ↓ | cvander L026, L052 | ✅ `preview-video.mjs` + `review-video.mjs` (G14, G17) |
| V25 | Si Walter no puede ver el preview, se revisa sobre un render (y por escena). | aquí ↓ | cvander L035 | ✅ `render-video.mjs` exige autorización (G18) |
| V26 | Un check verde no equivale a calidad visual. | aquí ↓ | cvander L028 | ◐ `verify-export.mjs` decodifica todo y deja la revisión visual pendiente a propósito (G21) |

### V24 · Studio nativo, por escenas
- **Regla:** todo avance que Walter juzga va al HyperFrames Studio del pipeline (`node tools/preview-video.mjs <slug>`),
  con el video partido en escenas (`<div class="escena clip" id="SNN">` + `BEATS.json`). Ni listas en el chat ni
  páginas HTML propias de revisión. Un estado vigente y un historial aparte. La exportación se hace cuando se pide, sin
  volver a confirmar. La aprobación de Walter y la del cliente final son dos cosas distintas.
- **Por qué:** 0910: las exportaciones intermedias gastaron tiempo, y las notas acumuladas mostraban versiones
  rechazadas como vigentes. cvander-jobs (21-oct): «¿por qué estoy viendo esto en HTML si tenemos un pipeline…?».
- **Origen:** cvander L026, L052.

### V25 · Si el preview no carga, render de revisión
- **Regla:** composición pesada o Studio lento o en blanco → apagar el preview, render de revisión (`-q standard`) a
  `revision/`, verificar el MP4 y partirlo por escena (BEATS.json). Matiza V24: «no exportar por avance» vale sólo si
  el preview funciona. Antes, chequear RAM y disco.
- **Por qué:** programar-profesion (30-sep): «si no lo puedo ver, lo tienes que renderizar».
- **Origen:** cvander L035.

### V26 · Un check verde no es calidad visual
- **Regla:** revisar la composición en movimiento y el MP4 final, incluido el instante exacto del defecto. Reportar lo
  comprobado y sus límites; no deducir un alpha limpio a partir del layout, el audio o un blackdetect. No escribir
  archivos del proyecto durante una prueba en Play: el hot reload la invalida.
- **Por qué:** 0910: Walter encontró errores que la primera QA no vio.
- **Origen:** cvander L028.

---

## 7. Entrega y cierre

| Id | Regla | Detalle | Origen | Chequeo |
|---|---|---|---|---|
| V27 | La entrega va por CapCut, y cada versión sobrescribe el MISMO archivo. | aquí ↓ | cvander L049 | 🔧 `capcut-borrador.py` |
| V28 | Cerrar un video = limpiar, sin borrar nada que use CapCut. | aquí ↓ | cvander L051 | ◐ `flujo --entregado` (G22); `cmp` y CapCut a mano |
| V31 | Combinar o concatenar video = re-encode (`prores_ks`); nunca `-c copy`. | aquí ↓ | marca moi (prohibido) | 👁 |

### V27 · CapCut con el mismo nombre de archivo
- **Regla:** Walter exporta desde CapCut. La primera entrega crea el borrador:
  `python3 tools/capcut-borrador.py <entregas/…mp4> --nombre "<marca> <slug>" --aplicar` (con CapCut cerrado).
  Cada versión nueva SOBRESCRIBE el mismo archivo de `entregas/`. Si el video ya está en el Extreme Pro, la ruta va
  directo a `/Volumes/…` (CapCut no sigue symlinks).
- **Por qué:** ep01 (14-oct): «ponlo con el mismo nombre para que CapCut lo tome».
- **Origen:** cvander L049.

### V28 · Cerrar un video
- **Regla:** al entregar: (1) verificar con `cmp` que la final de `entregas/` es idéntica al último render y borrar
  los renders de revisión y `renders/`; (2) borrar `node_modules` de los proyectos cerrados; (3) antes de borrar o mover
  un video, buscar si un borrador de CapCut lo usa (`grep -rho "proyectos/…" ~/Movies/CapCut/…/com.lveditor.draft
  --include=draft_info.json`): eso no se toca; (4) mandar el proyecto al Extreme Pro con `mover-al-disco.sh` (lo corre
  Walter en Terminal.app); (5) vaciar la carpeta de `~/Downloads` donde llegó el material, comparando byte a byte
  contra `originales/` antes de borrar. El cobro se anota el mismo día donde lo lleve esa marca.
- **Por qué:** 16-oct: «hay que liberar espacio». Se liberaron ~10 GB, y una entrega estaba sólo en `revision/`.
- **Origen:** cvander L051.

### V31 · Nunca concatenar con -c copy
- **Regla:** `-c copy` al concatenar rompe los timestamps. Se re-encodea (`prores_ks` para alpha).
- **Origen:** estaba en el «prohibido» de la marca Moi.

---

## 8. Portadas

Todo vive en [PORTADAS.md](PORTADAS.md) y en `tools/portada.sh` (L056). Ya absorbió L041, L050, L054 y L055.
Lo único general que faltaba se agregó allí el 1-nov (de L060): **medir la resolución del clip antes de `foto`**
(≤720 px de ancho, como los de WhatsApp, no sirve para portada) y **recortar retratos con BiRefNet-portrait (`rembg`)**
cuando `hyperframes remove-background` se trae el fondo.

---

## 9. Formatos

Los formatos que nacieron en un cliente y ya se pueden usar con cualquier marca están en
[EDITING_STYLES.md](EDITING_STYLES.md), cada uno con su contrato en `styles/<id>/STYLE.md`.
