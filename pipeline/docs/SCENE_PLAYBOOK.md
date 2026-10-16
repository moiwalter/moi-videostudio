# SCENE_PLAYBOOK — cómo se hace cada escena (determinista + repetible)

> **La meta:** Walter entrega un transcript; el agente genera *cada* escena — una a la vez, mostrada en el navegador para aprobación, lockeada, y a la siguiente — hasta terminar el video. Léelo junto a [START_HERE.md](../../START_HERE.md) (las 5 reglas) y [TALKING_HEAD.md](TALKING_HEAD.md) (el flujo).
> Línea gráfica completa: `BRAND.md` (prosa) + `brands/moi.json` (computable) · arquetipos: `SCENE_LIBRARY.md`.

---

## 0. No negociables (ya se rompieron una vez — nunca más)

- **EL PREVIEW ES EL NAVEGADOR.** Juzgas en `tools/preview.sh <slug> <escena>` (un tab, la escena activa). **NUNCA abras un `.mov`/`.mp4`/`.png` renderizado para revisar.**
- **LANZA EL PREVIEW UNA VEZ POR ESCENA.** El tab se recarga solo con cada edición del `index.html`. Relanzar solo al cambiar de escena.
- **UNA ESCENA A LA VEZ → APROBAR → LOCK → SIGUIENTE.** Nunca en lote. Espera un "aprobado" explícito de Walter.
- **RENDER UNA VEZ, SOLO LOCKEADA.** `final.sh` / `alpha.sh` después de la aprobación. Nunca renderices para decidir.
- **MISMO NOMBRE AL RE-LOCKEAR.** Cambiaste una escena ya lockeada → re-render con el mismo output, así **CapCut la relinkea solo**. NUNCA renombres outputs ni muevas rutas que Walter ya usa.
- `proxy.sh` nunca abre el player (default). Es solo para self-QC silencioso de frames.

---

## 1. Transcript → mapa de escenas (el primer entregable — antes de construir nada)

> ⚠️ **El transcript es el del CORTE grabado, nunca el guion escrito.** Un guion leído mide ~1.8× menos que lo que Walter graba (Wallbit 3: 1:11 escrito → **2:09.8** grabado). Si el mapa se arma contra el papel, la mitad del video queda sin overlay. Si ya hay kit y el video se re-cortó: **re-transcribir y re-mapear beat↔clip antes de tocar nada**.

1. Lee el transcript **completo**.
2. Deriva el mapa como **tabla**: `escena · beat (palabras/timestamp) · idea visual · arquetipo · tipo`.
3. Marca los **money-beats** (los 2–4 más fuertes) y el **tipo** de cada escena (§5).
4. **Fiel a lo que Walter dijo** — recrea, no inventes (nombres, cifras, claims reales). Cifras con separador de miles; al corregir un punto, revisa la escena ENTERA (coherencia).
5. Cada beat sin metáfora obvia → **inventa una visual** — nunca texto suelto.
6. **Muestra la tabla; Walter aprueba/edita. Solo entonces** arranca la escena 1.

---

## 2. El loop por escena (idéntico para todas)

```
BUILD → SELF-QC → PREVIEW EN NAVEGADOR → APROBAR → LOCK → SIGUIENTE
```

1. **BUILD** `scenes/SNN-nombre/index.html` — contrato §3 + fondo §4 + lenguaje visual §6.
2. **SELF-QC (silencioso, solo el agente):** `tools/proxy.sh <slug> SNN` → extrae 1–3 frames clave (`ffmpeg -ss <t> -i renders/_proxy.mp4 -frames:v 1 /tmp/x.png`) → **léelos tú mismo** → **VETA** lo infantil / roto / vacío / texto-solo *antes* de que Walter lo vea. Overlays: QC sobre verde (lo hace `alpha.sh`, o el mismo frame del proxy).
3. **PREVIEW:** `tools/preview.sh <slug> SNN` (un tab) y **corre `open http://localhost:3011/` SIEMPRE** — en la sesión Wallbit 2 Walter tuvo que pedir "OPEN" 3 veces; el tab abierto es parte de entregar la escena. Edita `index.html` → hot-reload. Itera con el feedback.
4. **APROBAR:** espera el "aprobado" / "ok" explícito.
5. **LOCK:** `tools/final.sh <slug> SNN` (full-frame) o `tools/alpha.sh <slug> SNN` (overlay). Mismo filename al re-lockear.
6. **SIGUIENTE** escena.

---

## 3. Contrato HTML de escena (determinista — copia el esqueleto)

**Toda escena full-frame:**
- **Root** con los atributos de composición — si faltan, HyperFrames usa defaults y el render sale mal:
  `<div id="frame" data-composition-id="main" data-start="0" data-duration="<segundos>" data-width="1080" data-height="1920">`
- GSAP desde CDN; **un timeline pausado** registrado como `window.__timelines["main"]`.
- **Fuentes** — self-hosted vía `design_system/fonts/`. **Solo existen estos pesos:** Geist **400/500/600/700/900** · Geist Mono **400**. Referenciar otro peso = 404 + fallback feo.
  ⛔ **Cormorant Garamond e IBM Plex quedaron fuera de la marca el 12-ago-2026** (alineación con la web). Sus `.ttf` siguen en la carpeta **solo** para re-renderizar videos anteriores — en material nuevo son un fallo de marca. Ver `BRAND.md`.
- Symlink por escena: `ln -s ../../../design_system design_system` (lo crea `new-video.sh`; toda escena NUEVA necesita el suyo).
- **Sin `package.json`** — la escena canónica es `index.html + meta.json + design_system`; las tools corren `npx hyperframes@$(cat tools/HF_VERSION)` — la versión vive SÓLO ahí (hoy `0.8.29`).
- 1080×1920, `html,body{overflow:hidden}`. Nada de `Date.now()`/`Math.random()`/fetch (render determinista).
- Fondo = estándar Moi (§4), como primeros hijos del root.

**Plates alpha (overlays, lower-thirds):**
- Envuelve el contenido en un **`stage` full-frame que ES el root de composición** — `<div class="stage" data-composition-id="main" data-width="1080" data-height="1920" …><div id="ovl">…</div></div>`. Poner `data-composition-id` en el elemento chico rompe el layout (barra estirada full-height).
- Transparencia: gatea una clase `body.alpha{background:transparent}` con la variable — `alpha.sh` renderiza con `--variables '{"alpha":true}'` → **ProRes 4444 a resolución de composición** (1080×1920; alpha no combina con upscale `--resolution`).
- Legibilidad por **contorno tight** (≤6 px), jamás velo/scrim **ni halo negro grande** — un `text-shadow` de 14–34 px ES un scrim per-glyph y es la causa del "borde raro" en CapCut. **Ver §3b, la Ley del Alpha.**
- Marca de agua `MOI` abajo-izquierda (Plex Mono, letter-spaced) en overlays — **PREGUNTAR por video**: en Wallbit 2 (sponsored) Walter la quitó de todas las escenas.

---

## 3b. ⛔ Ley del ALPHA — LA CAUSA RAÍZ: CapCut espera alpha PREMULTIPLICADO

> **ESTA ES LA REGLA #1 DE TODO OVERLAY. Lo demás de esta sección es estética.**
> Diagnosticado y reproducido el 2026-07-28 contra los 12 clips del Wallbit #3.

**CapCut compone el ProRes 4444 asumiendo alpha PREMULTIPLICADO (asociado). El render sale STRAIGHT.**

```
correcto (straight):  out = RGB*A + BG*(1-A)
lo que hace CapCut:   out = RGB   + BG*(1-A)      ← suma en vez de mezclar
```

Consecuencia: **todo lo que tenga alpha parcial revienta a blanco.** Un `radial-gradient` de glow
sale como **elipse blanca de borde duro** (el color sigue siendo crema en toda la elipse, solo baja
el alpha → CapCut lo suma entero). El borde antialiaseado del texto sale como nube brillante.
Lo **opaco** (A=1) sale perfecto — por eso las cards parecían estar bien y el texto no.
Sobre fondo negro el mismo error da una **nube gris** donde debería no haber nada.

**El arreglo es un transcode, no un re-render** — si guardamos `RGB' = RGB*A`, la cuenta de CapCut
se vuelve la correcta:
```
tools/premultiply.sh clip.mov          # in-place, deja backup .straight.mov
```
Ya va **dentro de `alpha.sh`**: toda escena nueva sale premultiplicada sola.
Verificación: `alpha_diag2` → `RGB/A p99 ≈ 1.0` = premultiplicado · `>>1` = straight (roto en CapCut).

⚠️ Si algún día se exporta para otro NLE (Resolve, Premiere, AE) que sí espera *straight*, se usa
el `.straight.mov` del backup. La premultiplicación es **específica de CapCut**.

---

### Lo demás de §3b es ESTÉTICA (sigue valiendo, pero ya no es "el bug")

> Con el alpha bien compuesto, una sombra oscura grande deja de ser un artefacto y pasa a ser
> una decisión de diseño — mala sobre footage claro y busy, pero no un defecto técnico.

**Qué pasa.** Un `box-shadow: 0 30px 80px rgba(0,0,0,.62)` o un `text-shadow: 0 6px 34px rgba(0,0,0,.72)`
no es "una sombra": en un render con alpha se hornea como **negro puro con alpha parcial**, una nube de
80 px alrededor del elemento. Sobre fondo negro (QuickTime, el preview) es **matemáticamente invisible**.
Sobre el talking-head es una **mancha oscura con borde** alrededor de cada card y cada texto.
Lo mismo una card `background: rgba(2,44,67,.52)`: sobre negro se lee sólida, sobre su cara **se ve a través**.

**Las cuatro reglas (las verifica `tools/alpha-qc.py --css`, y `alpha.sh` no renderiza si fallan):**

| # | Regla | Antes ❌ | Después ✅ |
|---|---|---|---|
| 1 | **Sombra oscura: radio ≤ 8 px.** Una sombra chica se lee como contacto/borde; una grande es una mancha. | `0 18px 44px rgba(0,0,0,.55)` | `0 3px 8px rgba(0,0,0,.40)` |
| 2 | **Separación por RIM claro, no por sombra.** El aro es 1 px de área, la sombra son 80. | `0 30px 80px rgba(0,0,0,.62)` | `inset 0 0 0 3px rgba(237,232,218,.16)` + `0 0 0 1.5px rgba(237,232,218,.20)` |
| 3 | **Card oscura ⇒ opacidad ≥ .92.** Si es translúcida, se le ve la cara detrás. | `rgba(2,44,67,.52)` | `rgba(2,44,67,.94)` |
| 4 | **Legibilidad de texto por CONTORNO, no por halo.** El halo grande es un scrim per-glyph. | `text-shadow:0 3px 14px rgba(0,0,0,.7)` | `2px 0 0 …,-2px 0 0 …,0 2px 0 …,0 -2px 0 rgba(11,11,9,.5), 0 2px 6px rgba(11,11,9,.45)` |

**Y el glow, que es lo que se rompe más visible:** un glow es **luz aditiva**, no oscuridad.
Va en el **color del acento con alpha → 0** — `radial-gradient(circle, rgba(247,215,148,.55) 0%, rgba(247,215,148,0) 70%)`.
Nunca a `transparent` a secas (es `rgba(0,0,0,0)` → anillo oscuro en la caída) y **nunca negro**.
Un "glow" hecho de negro sobre negro parece un glow; sobre el footage es exactamente el "sección rara con borde".

**Bug #2 — LAS SOMBRAS DE GSAP PISAN EL CSS. Arreglar solo el CSS no arregla nada.**
En Wallbit 3 el "glow" del título no vivía en el CSS: lo seteaba la timeline.
```js
.to('#big',{textShadow:'0 6px 44px rgba(247,215,148,.45)'},2.0)   // el "glow": grumoso
.to('#big',{textShadow:'0 6px 34px rgba(0,0,0,.72)'},2.4)         // ...y RESTAURA el halo negro
```
Parcheé el CSS, re-rendericé, y a los 2.4 s el JS volvía a poner el halo de 34 px.
**Regla: ninguna sombra se anima desde GSAP.** Si un elemento tiene que "prender", se anima la
**opacidad de una capa de glow aparte**, nunca su `textShadow`/`boxShadow`.
`alpha-qc.py --css` ahora escanea **CSS y JS** (`boxShadow:'…'` / `textShadow:'…'`).

**Y el glow como tal: un `text-shadow` borroso NO es un glow.** Sobre Cormorant 150 px, un blur de
44 px genera **una copia difusa por glifo** → nube grumosa que sigue el contorno de las letras, con
borde visible. Un glow de verdad es un **`radial-gradient` DETRÁS del texto** (color con `alpha→0`),
animado por opacidad. El lint avisa con `text-shadow` de color y blur > 20 px.
⚠️ Y aun bien hecho: **un glow cálido casi no se lee sobre footage claro**. Sobre fondo brillante el
acento tiene que ser movimiento (punch de escala, barrido de brillo), no luz.

**Bug #3 — el rango (NO era la causa del síntoma de Walter, pero está ahí).**
El ProRes que saca el pipeline queda tagueado `color_range=tv` y su piso de negro es **Y=15.9**, no 0.
Si CapCut ignora el tag y lo lee como *full range*, todo lo que debería ser negro invisible sale a **~6% gris**
→ la sombra negra a alpha parcial se vuelve una **nube gris visible sobre fondo negro**. Es exactamente la
captura que mandó Walter. Variante de prueba (misma escena, rango expandido y tagueado `pc`):
```
ffmpeg -i SNN_ALPHA.mov -vf scale=in_range=tv:out_range=pc -color_range pc \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p12le -alpha_bits 16 -vendor apl0 SNN_RANGEFIX.mov
```
⚠️ ProRes full-range es **no estándar**; solo se adopta si el A/B en CapCut lo confirma. Arreglar el CSS
(bug #1) ya reduce muchísimo el síntoma porque deja casi nada de negro a alpha parcial que se pueda levantar.

**Cómo se comprueba (no se promete, se mide):**
```
tools/alpha-qc.py --css scenes/SNN/index.html     # gate duro, encuentra la causa
tools/alpha-qc.py scenes/SNN/renders/SNN_ALPHA.mov # contact sheet negro|blanco|TU FOOTAGE
```
El contact sheet se juzga **en el panel de la derecha** (el footage real, `<proyecto>/local/qc-plate.png`),
jamás sobre negro. El QC verde de `alpha.sh` no sirve para esto: el verde es medio-oscuro y esconde el veil.

---

## 3c. ⛔ Reglas de ANIMACIÓN (nuevas, 8-ago-2026 — de dónde salieron)

Al pasar a HyperFrames `0.7.101` apareció un `check` con reglas que la versión vieja no tenía.
Corrido sobre las **35 escenas ya publicadas: pasan 6, fallan 29.** Esos videos se publicaron y se
veían bien — esto no dice que estén rotos, dice que hay tres clases de defecto que el sistema **no
podía ver**. Estas reglas existen para que no haya diez más.

El gate es `npx hyperframes check` (G1 de `build-kit`, y subsume al lint).

### 1. NUNCA animes propiedades de layout o de métrica de texto — 10 escenas

Prohibido animar desde GSAP: **`letterSpacing`**, `width`, `height`, `top`/`left`/`right`/`bottom`,
`fontSize`, `lineHeight`, `margin*`, `padding*`, `borderWidth`.

**Por qué:** esas propiedades disparan layout del navegador y **se redondean a píxel entero**. Bajo
el motor de captura frame-por-frame, la cola de un ease-out avanza menos de un píxel por frame y el
movimiento **tartamudea** en vez de fluir. En preview a veces no se nota; en el render sí.

El caso real (`S07-sp500`), el efecto "el texto se abre al aparecer":
```js
tl.fromTo('#kicker',{opacity:0,y:24,letterSpacing:'.5em'}, …)   // ✗ tartamudea
```
Se anima **transform y opacidad**, nada más: `x`, `y`, `scale`, `scaleX`, `rotation`, `opacity`.
Si de verdad querés el "se abre", va un wrapper con `scaleX` — no `letterSpacing`.

### 2. NUNCA pongas un `transform` en CSS sobre un elemento al que GSAP le anima transform — 4 escenas

**Por qué:** GSAP escribe **el string completo** de `transform`. Si el CSS tenía
`translateX(-50%)` para centrar, GSAP lo **descarta** y el elemento salta de posición al arrancar
la animación. El estado inicial se declara con GSAP (`gsap.set()` o el `from` de un `fromTo`),
nunca en CSS.

```css
#axis{transform-origin:left center;transform:scaleX(0)}   /* ✗ */
```
```js
gsap.set('#axis',{scaleX:0});  tl.to('#axis',{scaleX:1, …})   /* ✓ */
```
*(En `S05b-giro` — el caso que lo destapó — el `#axis` no tenía `translateX`, así que ahí **no se
pierde nada**: la regla es preventiva. Pero la clase de bug es real y es invisible.)*

### 3. Dos tweens no tocan la misma propiedad del mismo target al mismo tiempo

Casi siempre sale de la **matemática de un loop**, no de un descuido: `t = 0.15 + i*.6 + r*1.35`
produce colisiones exactas para ciertos pares `(i, r)`. Si dos tweens pisan la misma propiedad, el
resultado depende del orden de creación — o sea que **no es determinista de leer**, aunque el render
sí lo sea. Revisá las cotas del loop, no agregues un `overwrite`.

### 4. ⛔ NUNCA le pongas `CSS` (ni `Element`, `Node`, `Document`) de nombre a una variable

Un `const CSS = ...` en el scope de nivel superior de la escena **NO va a `window`** — va al
*global lexical environment*, que se resuelve **ANTES** que las propiedades de `window`. O sea que
**sombrea `window.CSS` para todo script del mismo documento**, incluido el runtime de HyperFrames.

El caso real (`S01` de nacho-brain-rot, 22-ago-2026): la escena leía los tokens de marca con
```js
const CSS = getComputedStyle(document.documentElement);   // ✗
```
El element-picker del studio llama `CSS.escape()` una vez por frame → **2.282
`Uncaught TypeError: CSS.escape is not a function`** tapando el preview con un panel de errores.

**Lo peor es cómo se disfraza:** `hyperframes check` da *Runtime: 0 errors* y el render sale
perfecto —el picker no corre en el path de render—, así que **los tres gates pasan en verde y el
bug sólo existe donde Walter mira**. Y `grep "CSS.escape"` sobre la escena da 0 resultados: lo que
hay que buscar es quién **declara** `CSS`, no quién lo llama.

```js
const TOK = getComputedStyle(document.documentElement);   // ✓
const C = n => TOK.getPropertyValue(n).trim();
```

### 5. ⛔ Un rol que se llama IGUAL que su token rompe el token EN SILENCIO

`brands/<marca>.json` con `roles: { "rule": "rule" }` hacía que `brand.mjs tokens` emitiera:

```css
--rule: #525252;        /* de la paleta */
--rule: var(--rule);    /* del rol  ← auto-referencia cíclica */
```

Por spec CSS un ciclo deja el custom property en **guaranteed-invalid**, así que
**`background: var(--rule)` descarta la declaración entera y pinta TRANSPARENTE**.
Medido en Chrome: `--rule` computa a `''` y el fondo a `rgba(0,0,0,0)`.

**Lo grave es cómo se esconde:** no hay error de consola, no falla `hyperframes check`,
no falla `brand.mjs check` (el hex está en la paleta), no falla `alpha-qc`. **Los cuatro
gates dan verde y el elemento simplemente no está.** En `2026-08-nacho-brain-rot` dejó
invisibles piezas de tres escenas, y dos agentes distintos lo encontraron por separado
mirando frames y preguntándose dónde estaba lo que habían construido.

`brand.mjs` ahora **omite el alias cuando el rol se llama igual que el token** (la paleta ya
declara ese nombre). Si aparece algo que "no se renderiza" y el CSS parece correcto,
lo primero es `getComputedStyle` sobre el token, no releer la escena.

### 6. Los colores van por token, nunca hex literal

El gate `node tools/brand.mjs check <slug>` falla si una escena usa un color fuera de la paleta.
Los tokens salen de `node tools/brand.mjs tokens <marca>` y ya vienen inyectados si la escena nació
de `tools/new-scene.sh`. Incluyen los **triples rgb** (`--gold-rgb`) para las formas
`rgba(var(--gold-rgb),.75)` — que era el agujero: un `rgba(237,232,218,.97)` no aparece como hex y
se escapa de cualquier búsqueda-y-reemplazo.

Si un color es **fidelidad a una UI real** (terminal, Excel, un banco), no es color inventado: va a
`brands/<marca>.json` → `mimesis`, **con nombre**. Un hex suelto sin dueño sigue siendo una falla.

Y el emparejamiento importa: el oro va **sobre superficie oscura**. Sobre cream da **1.09:1** de
contraste y `check` lo marca como error — lo encontró en la plantilla misma.

---

## 4. El fondo estándar Moi (toda escena full-frame — NO blanco plano, NO Carbon)

Traducción Moi del estándar (grid sutil + glow + viñeta). Copia literal:

```css
body{margin:0;background:radial-gradient(130% 115% at 50% 35%, #F4F0E4 0%, #EDE8DA 55%, #DFD9C6 100%)}
#bg-grid{position:absolute;inset:-10%;pointer-events:none;
  background-image:linear-gradient(to right, rgba(11,11,9,.05) 1px, transparent 1px),
                   linear-gradient(to bottom, rgba(11,11,9,.05) 1px, transparent 1px);
  background-size:120px 120px;}
#bg-glow{position:absolute;width:1300px;height:1000px;left:-110px;top:120px;border-radius:50%;
  filter:blur(130px);pointer-events:none;
  background:radial-gradient(circle, rgba(247,215,148,.16) 0%, rgba(247,215,148,0) 70%);}
#bg-vignette{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 85% 70% at 50% 45%, transparent 55%, rgba(11,11,9,.08) 100%);}
```
HTML — primeros hijos del root:
`<div id="bg-grid" data-layout-ignore></div><div id="bg-glow" data-layout-ignore></div><div id="bg-vignette" data-layout-ignore></div>`

**Variante navy** (énfasis / momento oscuro): base `radial-gradient(130% 115% at 50% 35%, #22346A 0%, #192A56 60%, #101C3D 100%)`, grid `rgba(237,232,218,.05)`, mismo glow gold, viñeta `rgba(0,0,0,.22)`.

---

## 5. Tipos de escena

**El nombre que va en `meta.json` → `type` es exactamente el de la primera columna.** Antes el
full-frame se llamaba `motion` en unos archivos y `full` en otros — palabra heredada de
stacksync-gtm, donde "motion-graphics" era una categoría de video entera. Acá hay un solo nombre.

| `type` | ¿Se renderiza aquí? | Output | Qué es |
|---|---|---|---|
| **`full`** | Sí — `final.sh` (nativo 1080×1920; `SS=2` para supersamplear) | `SNN_1080x1920.mp4` | Escena que **TAPA** el talking head: hook frío, cutaway conceptual, insert de prueba. Es la única que puede tener **seam** con la siguiente. |
| **`alpha`** | Sí — `alpha.sh` (premultiplicado) | `SNN_<nombre>_ALPHA.mov` | Overlay transparente ProRes 4444 **sobre** el footage. Respeta la silueta. |
| **`footage`** | No | — | Walter a cámara. Sin `index.html` → se corta en CapCut. |

---

## 6. Lenguaje visual (qué significa "bien" aquí)

> **Reusa arquetipos — no reinventes.** Antes de construir, revisa `SCENE_LIBRARY.md` (22 arquetipos: VS-cards, stat-compare con count-up, logo-chip, UI-mockup, mapa, impostor…) y copia el patrón. Mantén los nombres de clase para que el look sea consistente.

- ⛔ **PALETA — ESTE PÁRRAFO ESTABA DESACTUALIZADO HASTA EL 13-ago-2026.** Decía gold `#F7D794` +
  navy `#192A56` + cards cream `#EDE8DA`: **esa identidad se retiró el 12-ago** al alinear la marca
  con la web, y `brand.mjs check` hoy **rechaza** los tres. Un playbook que manda usar justo lo que
  el gate prohíbe es peor que no tener playbook. **La paleta viva vive en `BRAND.md` +
  `brands/moi.json` y en ningún otro lado**: naranja `--brand #FD551D` = EL acento (números,
  palabras clave, tachones) · `--hot #FAD146` = el golpe que tiene que aterrizar más que el naranja ·
  cards **oscuras** `rgba(26,25,26,.97)` · texto claro `--fg #EEEEEE`. Y la regla de emparejamiento
  que sigue valiendo: **reserva el acento para el payoff** — el beat del problema va neutro.
- **Tipografía — UN SOLO SISTEMA por video, sin excepciones** (regla Walter 2026-07-10: coherencia
  total): **Geist Black 900** = display (preguntas/frases) · **Geist 600/700** = números grandes y
  palabras-stamp · **Geist Mono 400 UPPERCASE** = kickers/labels/tags. NUNCA cambiar la familia de
  un rol a mitad de video — si un texto no se lee, se agranda, no se cambia de fuente.
  ⛔ Cormorant Garamond e IBM Plex **salieron de la marca**: en material nuevo son un fallo.
- **LEGIBILIDAD EN CELULAR** (regla Walter 2026-07-10 — "no se lee"): kickers Mono **≥40px**, labels Mono **≥34px**. El texto se juzga pensando en un teléfono, no en el monitor.
- **Animación — LA MISMA GRAMÁTICA en todo el video**: entrada = pop `back.out(≈2)` con rotación leve · número aterriza = punch scale + glow gold · palabra clave = stamp (scale 2→1) + micro-shake · vida = float `sine.inOut` yoyo · salida = `opacity 0, y:-70~-90, power2.in`. No inventar una gramática nueva por escena.
- **MOSTRAR, no estampar slogans.** Explainers gráficos que *ilustran* lo que Walter dijo. Nada de slogans cinéticos AI-slop. Caption funcional sí; hype vacío no.
- **Motion EFUSIVO** (regla Walter 2026-07-09 — esto NO es enterprise-subtle): overshoot marcado (`back.out(1.9–2.2)`), **punch de scale cuando el número aterriza** (1→1.15→1 + pulso de glow), palabras clave en **stamp** (scale 2→1 + micro-shake de card), chips stagger con energía, números `countTo` ~0.8s con separador de miles, SVG draw-on rápido. Salida `out` (opacity→0, y:-16). Límites que siguen: **sin destellos/wipes entre escenas, sin velo** — transición = fade limpio.
- **Assets REALES, recreados fiel.** Logos reales (chip blanco con padding/radius), banderas, UI auténtica (mockup fiel de la plataforma). Logo blanco-solo → chip oscuro. Asset que no renderiza → fuera.
- **3D donde suma:** wrapper con `perspective:2200px` + `rotationY/X`; anima el *wrapper* (x/opacity) para conservar el tilt. Screenshots de webs: Playwright Chromium + `--virtual-time-budget=6000`.
- **Citas parecen citas** (comilla grande + atribución), no titulares.
- **Números reales** cuando Walter los dio — nunca cifras inventadas ni incoherentes.
- **VIDA CONTINUA en toda la escena** (estándar Wallbit 2): ninguna card se queda quieta >2s — floats `sine.inOut`, emisiones de elementos (monedas/billetes cayendo, chips brotando), pulsos de glow, wiggles de emoji. La escena respira de la entrada a la salida; los repeats de floats TERMINAN antes de la salida (no pelear tweens de `y`).
- **DATA-VIZ = MATEMÁTICA REAL** (regla Walter): toda curva/tabla/barra sale de un cálculo en Python mapeado exacto al SVG (puntos año a año, no paths a ojo); valores finales VISIBLES en pantalla; y busca el **dato derivado asesino** (ej. "pone Bs 96.000 más y termina Bs 90.798 menos"). Estética ledger: grillas, cabecera de columnas, regla vertical.
- **PANTALLA COMPLETA cuando el contenido lo merece** (regla Walter: "aprovecha todo el espacio"): tablas/charts grandes llenan el alto — nada de cards chicas flotando en vacío.
- **BRANDING DE SPONSOR** (Wallbit): tokens sacados del CSS real de su web (`curl` + grep de variables custom — Wallbit: `--wallbit: #0D99FF`, dark `#14161C`, green `#63DE77`); el glow de sus cards va en SU color, no gold; value-props del producto como badges en **esquinas opuestas** de la card (dos tags en la misma esquina se pisan); logos de marcas reales vía `https://cdn.simpleicons.org/<brand>` (verificar `<svg` en la respuesta; no todas existen — amazon no está).
- **DATOS DEL CTA confirmados antes de construir**: código de referido, fecha/hora del live, condiciones del sorteo — se le preguntan a Walter, jamás placeholder.

### Reglas nuevas — Wallbit 3 "5 Niveles" (26–27 jul 2026)

- **CONTADOR PERSISTENTE en videos-lista** (regla Walter, la que destrabó el concepto): si el video promete N cosas, las N ranuras están **en pantalla desde el segundo 1** (borrosas/bloqueadas) y se desbloquean una por una. Se estaciona **arriba al centro**, **no crece nunca**, y los ítems ya vistos quedan marcados. Es el motor de retención, no un adorno — la promesa abre el loop y cada avance lo re-arma. Y mientras están bloqueadas **se mueven** (*"no veo que mientras están blurreados se muevan, haz eso"*): un elemento congelado en pantalla es una escena muerta.
- **DIBUJA LA IDEA, NO EL SUSTANTIVO** (regla Walter): para cada beat, escribir primero la idea en una frase; si el visual es el objeto que nombra el texto (cuaderno, teclado, planilla), está mal. *"Imágenes, no texto, no representación estrictamente directa del texto. **Inventa** — si quieres cambia tu temperatura para inventar conceptos relacionados."* Su bar: **dinamismo + sofisticación**, mucha animación.
- **EL REVEAL ES UNA ANIMACIÓN PROPIA, no el teaser agrandado** (regla Walter): resolver un reveal haciendo zoom sobre la misma miniatura es *"bajo esfuerzo"*. Teaser y reveal son dos piezas distintas.
- **WALTER ESTÁ EN CUADRO — componer alrededor de él**: contenido por las **bandas laterales**, columna central libre, contador arriba-centro y título debajo. Nunca mandar el elemento clave a una esquina "para hacer espacio" sin que él lo pida.
- **FIRMA VISUAL RECONOCIBLE — se identifica sin leer**: las monedas llevan **$**, la planilla lleva **el verde de Excel**, el fallo va en **rojo saturado y notorio**, lo mental lleva **etiquetas con emoji**. Si hace falta el label para saber qué es, el visual no está terminado.
- **NUNCA INVENTAR LA UI DE UN TERCERO**: antes de animar la pantalla de un producto, **pedir captura o grabación**. Dibujar de memoria la página de Wallbit Agents metió tres errores en un video pagado (`wb_live_` en vez de `wlb_live_`, dos permisos en vez de tres, MCP URL ausente). Sin material real, no se dibuja la UI.
- **LOGOS: solo verificados**. `cdn.simpleicons.org` no siempre devuelve lo que crees — OpenAI está retirado y devuelve *OpenAI Gym*. Logo equivocado en un patrocinado > no poner logo. Marca verificada al frente, el resto en texto limpio.
- **CAPTURAS REALES, con los datos neutralizados**: el screenshot real se lee como prueba y el dibujo como ilustración — pero la UI real trae deuda, acreedores por nombre y patrimonio. Se recaptura con montos genéricos; **nunca blur** (grita "acá escondo algo"), nunca los datos reales.
- **EL SISTEMA PROPIO VA SOLO EN EL BEAT DE LA SOLUCIÓN**: meter su dashboard ilustrando el problema contradice el video entero. Para el problema, herramienta de terceros o algo abstracto.
- **MAPEAR CADA BEAT DEL GUION CONTRA SU CLIP antes de cerrar el kit**: en Wallbit 3 el beat de la **tesis** era el único sin overlay (~15s de pantalla congelada justo en el giro). Y al revés: **si el guion cambia, su clip se rehace** — *"que la escena también comunique lo que se dice"*.
- **FLUJO: una escena, un preview, lock y siguiente**. Walter cortó la sesión cuando había varios previews abiertos: *"muchos hyperframes renderizados y abiertos, no entiendo el flujo — voy a cerrar todos y vamos escena a escena."* Cuando dice *"lockéala"*, esa escena no se vuelve a tocar.
- **REGENERAR EL `KIT/` después de CUALQUIER retoque**: los clips del KIT son copias; si se edita una escena y no se refresca, él arrastra a CapCut la versión vieja.

---

## 7. Checklist de self-QC (lee tu propio frame antes de mostrar)

- [ ] Root con `data-composition-id` + `data-width/height` (si no → tamaño equivocado / blank).
- [ ] Sin fuentes 404 — solo los pesos que existen (§3).
- [ ] Ningún elemento clavado en 0,0 / solapado — posición **completa** en todo absolute.
- [ ] Ningún asset en blanco (logo blanco sobre claro; SVG con raster-pattern).
- [ ] Sin vacíos incómodos — el contenido llena; los gaps son intencionales.
- [ ] Overlay: alpha vivo (QC sobre verde), silueta respetada, marca MOI presente.
- [ ] Fondo estándar Moi presente (full-frame) / transparente real (alpha).
- [ ] Logos / UI reales y legibles. Cifras correctas, con separador de miles.
- [ ] Motion sutil-premium, no flashy. Sin texto-solo.
- [ ] **§3c-1** Cero animaciones de `letterSpacing` / `width` / `height` / `top-left` / `fontSize` / `margin` / `padding` — solo transform y opacidad.
- [ ] **§3c-2** Ningún elemento con `transform` en CSS que GSAP también anime — el estado inicial va con `gsap.set()`.
- [ ] **§3c-3** Ningún par de tweens sobre la misma propiedad del mismo target a la vez (mirá las cotas de los loops).
- [ ] **§3c-4** Colores por `var(--token)`. Oro **sobre oscuro**, nunca sobre cream (1.09:1).
- [ ] Al re-lockear: **mismo filename**.

> Las cuatro de §3c no se chequean a ojo: `npx hyperframes check` las encuentra, y es el G1 de
> `build-kit`. Correlo antes de mostrar una escena.

---

## 8. Log de errores (heredados de los dos sistemas — sé más estricto)

| Error | Regla |
|---|---|
| Revisar abriendo `.mp4`/`.png` en vez del navegador | **Solo preview en navegador** (§0) |
| Relanzar `preview.sh` tras cada edición → tabs duplicados | Lanzar **una vez**; hot-reload |
| Fuentes 404 (pesos inexistentes) | **Solo pesos existentes** (§3) |
| `data-composition-id` en el elemento chico → layout roto | **Stage wrapper** (§3) |
| HEVC con alpha → fondo negro en CapCut | **SIEMPRE ProRes 4444** |
| Concat `-c copy` → timestamps rotos | Re-encode `prores_ks` |
| Escenas de solo texto | Siempre animación con elementos |
| Scrim/velo oscuro global | Text-shadow para legibilidad |
| Destellos/wipes entre escenas | Fade limpio |
| Cifras mal / sin separador de miles | Verificar contra el transcript; revisar la escena entera |
| Renombrar/borrar clips que Walter ya usa en CapCut | Nombres y rutas estables, siempre |
| Cards apretadas con aire de sobra alrededor | **Aprovechar TODO el espacio** — si el contenido lo merece, la card llena la pantalla (regla Walter, Wallbit 2) |
| Curvas/gráficas dibujadas "a ojo" | **Data-viz = matemática real**: calcular los puntos en Python y mapearlos exactos al SVG; valores finales visibles (regla Walter, Wallbit 2) |
| Cambiar tipografía de un rol a mitad de video | Un solo sistema por video; si no se lee → se agranda |
| Sticker/stamp tapando el número clímax | El dato estrella nunca se tapa — stickers van a huecos vacíos |
| Escalar `<circle>` SVG con transforms → el punto se desplaza | Animar el radio: `attr:{r:N}` — cero transforms en circles |
| `svgOrigin` vs `transformOrigin` en SVG | Elementos SVG SIEMPRE `svgOrigin:'x y'` (coords del viewBox) |
| Puntos fantasma antes del draw-on (round linecap con dashoffset) | `visibility:hidden` en el SVG + `.set(visible)` justo al dibujar |
| Elementos brotando a la altura de otros (billetes entre chips) | Emisores emergen POR DEBAJO del borde del elemento padre |
| Etiqueta de valor pisando su propia curva | Anclarla en zona vacía + línea guía al punto (estilo anotación) |
| Fila de chips que desborda el ancho (flex wrap 4+2) | Calcular anchos: fijar el contenedor al ancho exacto de la grilla |
| Float `yoyo` que sigue vivo durante la salida | Los repeats se dimensionan para terminar ANTES del tween de salida |
| Tab del preview sin abrir (Walter pidiendo "OPEN") | `open http://localhost:3011/` es parte del paso PREVIEW, siempre |
| Varios previews/renders abiertos a la vez → él pierde el flujo | Una escena, un preview, lock, siguiente (Walter, 26-jul) |
| Reveal resuelto con zoom sobre el mismo teaser | Reveal = animación propia a pantalla completa (Walter: "bajo esfuerzo") |
| Visual que ilustra el sustantivo del texto (cuaderno = "anotar") | Dibuja la IDEA; si se deduce leyendo el guion, está mal |
| Elemento bloqueado/borroso quieto en pantalla | Aun bloqueado, se mueve — nada congelado |
| Contenido centrado tapando a Walter | Bandas laterales, columna central libre; contador arriba-centro |
| UI de un tercero dibujada de memoria | Pedir grabación/captura real — 3 errores salieron así en un pagado |
| Logo bajado sin verificar cuál es | Verificar la marca del SVG; OpenAI en simpleicons devuelve *OpenAI Gym* |
| Captura real con los datos reales de Walter (o con blur) | Recapturar con montos genéricos; blur nunca |
| Su propio dashboard usado para ilustrar el problema | El sistema propio va solo en el beat de la solución |
| Beat del guion sin overlay (peor: la tesis) | Mapear beat↔clip antes de cerrar el kit |
| Guion editado y clip viejo | Cambio de guion → se rehace su escena |
| `KIT/` sin regenerar tras retocar una escena | Refrescar el KIT o arrastra la versión vieja a CapCut |
| **Sombra negra de radio grande en un overlay alpha** | Invisible sobre negro, MANCHA con borde sobre el footage. Radio ≤8px, separar con rim claro, card oscura ≥.92, glow en color con alpha→0 (§3b) |
| **Juzgar un alpha sobre fondo negro (QuickTime / QC verde)** | El negro esconde el veil por definición. QC obligatorio sobre `local/qc-plate.png` = un frame real suyo |
| **Kit dimensionado contra el guion escrito** | El corte grabado dura **~1.8× el guion leído** (Wallbit 3: 1:11 → 2:09.8) → el kit cubría 55 % y quedaron 58 s sin animación. **El kit no se cierra hasta tener la transcripción del CORTE** |
| **Dato en pantalla construido sobre una cifra que él aún no dijo en cámara** | Él ensancha en vivo lo que no puede defender ("3 semanas" → "entre 3 semanas y un par de meses"). Verificar cifras contra el corte, no contra el guion |

---

**En una línea:** transcript → tabla aprobada → por escena: build → self-QC de un frame → preview en navegador → aprobado → lock (mismo filename) → siguiente. Línea Moi, assets reales, motion sutil, nunca abrir un render para decidir.
