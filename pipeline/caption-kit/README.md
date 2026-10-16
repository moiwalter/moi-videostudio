# caption-kit — subtítulos que no hay que pulir cada vez

Un corte entra, subtítulos salen. El look vive en `styles/<id>.json` como **datos
medidos**, no como plantilla, y el planificador aplica las reglas solo.

```bash
bash caption.sh <corte.mp4> <proyecto> --style doac --em "peligrosa,opciones"
bash caption.sh --re <proyecto> --style doac        # replanificar sin rehacer el matte
```

⚡ **Los tres estilos corren SIN matte.** En modo `fg` global, `render-and-composite`
usa sólo `bg_plus_caps.mp4` —que ya trae video + subtítulos— y **nunca toca
`frames_fg`**. El matte son 5–20 min de u2net en CPU por clip y para estos
estilos es costo puro: el corte completo de *opciones* (60 s) planificó en ~2 min
en vez de ~20. Lo gobierna `needsMatte` en el style; ponelo en `true` sólo si
algún día se usa un estilo con la palabra incrustada DETRÁS del sujeto.

`--re` replanifica sin volver a transcribir. Ahí es donde se itera.

## Los tres estilos

| | DNA | el golpe | para |
|---|---|---|---|
| `doac` | documentary | **Anton** contra Inter | el default. Cambio de familia con masa |
| `documentary` | documentary | Inter 800, **sin cambio de familia** | piezas largas o de archivo — en registro formal la cara distinta lee como disfraz |
| `loud` | loud | **Bodoni** contra Anton | hype. El DNA pone Anton en todo el cuerpo, así que el contraste va al revés |

⚠️ **Bodoni se probó en `doac` y no sirve sobre este footage**: es didone, sus
finas se apagan sobre la camiseta blanca y la cara lee editorial, no peligro. En
`loud` sí funciona, porque ahí contrasta contra una condensada.

Lo único que decide un humano es **`--em`: qué palabras son el golpe.** Sin
`--em` se eligen por energía del audio, pero eso acierta el volumen, no el
significado — sirve de borrador, no de decisión. Todo lo demás lo pone el kit.

## De dónde salen las reglas

Medidas sobre tres shorts de **@TheDiaryOfACEOClips** (12-ago-2026), no
recordadas. Cada número del style tiene su medición al lado, en las claves `_*`.

| Regla | Medido en DOAC | Qué pasaba sin ella |
|---|---|---|
| 2,3 palabras/línea · 1-3 filas | sí | Con 3,3-5 y 4 filas acumuladas, leía como párrafo y no como golpes |
| Bloque a la **izquierda** | Bordes izq. 227/226 px contra centros 353/531 | Centrado, cada línea nace en otro punto y el ojo recalibra por renglón |
| Huecos 5-18 px, **variables** | 5 · 11 · 12 · 18 | Uno fijo se lee mecánico aunque el promedio esté bien |
| Jerarquía **dentro** de la frase | base → mid → golpe | Un cuerpo único con cambio de color no es DOAC |
| El golpe cambia de **familia** | `large WEALTH gaps.` — WEALTH es serif dentro de una frase en grotesca | Se pierde el recurso más característico |
| Color contra **ese** fondo | ámbar/coral/verde según el beat | Un naranja fijo canta sobre el librero y se apaga sobre la camiseta |
| Cada línea entra **distinto** | — | `keynote` define 3 tonos y los 3 son el mismo `burn`: todo entraba igual |

## Las cuatro trampas del motor, ya resueltas dentro

1. ⛔ **La capa `fg` se compone con `blend=screen`** → un contorno oscuro es
   invisible y todo color se lava. `caption.sh` despega la capa por grupo y pone
   `caption_layer:"fg"` en la raíz: apenas existe `index_fg.html`,
   `render-and-composite` fuerza el modo híbrido e **ignora** esa bandera.
2. ⛔ **El interlineado tiene que ser NEGATIVO.** La caja de cada línea ya trae
   `line-height 1.12` (~41 px de aire propio en cuerpo base). Con hueco cero
   quedaban 43-66 px de tinta a tinta contra los 5-18 de DOAC. Lo aplica `tighten.py`.
3. ⛔ **Las páginas sólo cortan solas con pausas ≥0,6 s.** Hablando corrido hay
   que poner `flip:true` por bloque — el planificador lo pone siempre.
4. ⛔ **`prepare.sh` pisa `transcript.json`** con su propia corrida de WhisperX.
   Por eso el plan se genera DESPUÉS de prepare, nunca antes.

## Reglas de composición que un agrupamiento por conteo no sabe

- Una línea **no termina en palabra funcional** ("trabajes *para ser*" corta la
  frase en el peor lugar: la preposición pertenece a lo que viene).
- Una línea de **una sola palabra** sólo se justifica si esa palabra es el golpe.
- **Dos umbrales distintos**: `pauseBreak` (0,26 s) decide dónde CORTAR línea;
  `clauseGap` (0,45 s) decide dónde está PROHIBIDO fusionar. Con uno solo, una
  pausa de 0,20 s —que no es fin de idea— dejaba huérfanos irreparables.
- Ninguna línea entra justo antes del flip (`minShow`)… **salvo que cierre una
  idea**: esa se queda aunque viva poco, porque el lector viene leyendo la página
  desde antes y empujarla adelante mete el punto en medio de la página siguiente.
  Por eso el compilador puede seguir avisando de una línea corta al final de un
  beat: es una decisión, no un descuido.

## Lo que el kit NO puede arreglar

DOAC graba sobre fondo **oscuro y quieto**, y sus invitados no gesticulan donde
va el texto. Acá hay pared clara, librero de colores, camiseta blanca y las manos
justo en la zona del subtítulo. **Una camiseta oscura o un encuadre más cerrado
dan más que cualquier ajuste de CSS.** El único área limpia que midió `safe-zones`
en este set es la franja alta (0-27 %, luma 91).

## Archivos

| | |
|---|---|
| `caption.sh` | el pipeline entero, en orden. Los cuatro pasos no son intercambiables |
| `alpha.sh` | **el overlay para CapCut** — ProRes 4444 premultiplicado, sin audio, con QC sobre el footage real |
| `burn.sh` | el corte con los subtítulos quemados, para juzgar |
| `plan.py` | transcripción → `cinematic.json` (agrupamiento, jerarquía, tonos, color) |
| `tighten.py` | reescribe los `top:` del plan con el interlineado del style |
| `styles/doac.json` | el look como dato, con la medición al lado de cada número |

## Dos salidas distintas, no las confundas

- **`alpha.sh` → `<proyecto>_ALPHA.mov`** es lo que va a CapCut: subtítulos sobre
  transparencia, ProRes 4444 **premultiplicado** (`p99(max(RGB)/A) ≈ 1.00`), sin
  audio. Entra en una pista encima del corte, empezando en **00:00 exacto** — los
  tiempos salen de la transcripción de ese corte y un frame de corrimiento
  desincroniza todo. ⛔ No re-encodear a H.264 con alpha: se va a negro.
- **`burn.sh` → `final.mp4`** trae el video adentro. Sirve para juzgar, no para montar.

⛔ **No usar `render-and-composite.sh` del skill en proyectos sin matte.** Calcula
la duración contando `frames_fg` (su línea 367); sin esa carpeta da 0 y **aborta
sin dejar archivo ni error visible**. En modo fg global no hay nada que componer,
así que `burn.sh` renderiza `index.html` directo y pasa igual el gate de sincronía.
