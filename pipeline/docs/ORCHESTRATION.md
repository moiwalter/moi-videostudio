# ORCHESTRATION — la capa agéntica del kit de talking-head

> Cómo correr el pipeline con agentes haciendo el trabajo pesado **sin** los errores que los agentes
> traen normalmente. Adaptado de `stacksync-gtm/content/video_demos/ORCHESTRATION.md` al talking-head.
> Implementado en [tools/build-kit.mjs](../tools/build-kit.mjs).

> ⚠️ **ESTE DOCUMENTO ES DEL CARRIL KIT. El carril MASTER todavía no tiene capa agéntica.**
> Se escribió el 8-ago-2026; el carril master nació el 13-ago y acá no aparece. Todo lo de abajo
> —`build-kit.mjs`, las celdas por escena, los 7 gates— asume `scenes/<SNN>/meta.json`, que en
> master **no existe**: las escenas viven inline en `master/index.html`. Y dos de los siete gates
> (G2 y G7) son sobre alpha, que en master no aplica.
>
> **Qué SÍ tiene el master hoy** (30-ago-2026): el mapa (`master/BEATS.json`), su contrato
> (`map-beats --check`), el emisor (`map-beats --emitir`) y el gate (`qc-master.mjs`, 9 chequeos,
> uno de ellos comparando el video contra su mapa). Lo que falta es el equivalente de
> `build-kit.mjs`: un orquestador que le dé una escena a un agente, encerrada con los gates del
> carril master. El loop manual está en `START_HERE.md` §El loop del carril MASTER.
>
> **YA EXISTE `tools/build-master.mjs`** (30-ago-2026): mismo principio, celda distinta.
> En master las escenas viven inline en un solo `index.html`, y catorce agentes editando el
> mismo archivo es la receta del pisón mudo — así que **la celda es un fragmento**:
> cada agente escribe SOLO `master/escenas/<SNN>.html` (el interior de su div) y
> `map-beats --emitir` lo baja a su escena. El agente nunca abre `index.html`.
>
> Sus 4 gates por escena son baratos y sin Chrome: **G1 fragmento** (sin `<script>`, sin
> `<html>`, sin redeclarar el div) · **G2 datos** (ningún número que Walter no diga en el
> corte) · **G3 marca** (hex fuera de la paleta de `brand.json`) · **G4 takeover** (lo que el
> mapa declara existe, y lo que no está declarado no se construye). El gate caro —`qc-master`,
> que necesita el navegador— corre **una vez** sobre la composición entera, al final.
> `--verify` corre todo con CERO tokens: empezá siempre por ahí.
>
> **Lo que NO cambia entre carriles** es el principio de abajo y el reparto de abajo: el MAPA y el
> SIGN-OFF son de Walter, nunca de un agente. En master el mapa incluye la línea gráfica entera
> —cámara, takeover, tratamiento, assets y hook—, así que la superficie protegida es MÁS grande,
> no menos.

---

## Perfil y revisión compartidos · 13-sep-2026

`build-master.mjs` recibe `brand.mjs brief`; ese brief ahora incluye `videoWorkflow` cuando la marca lo declara. (1-nov-2026: cvander ya no lo declara; el brief lleva el formato del proyecto o `estiloPorDefecto`, la identidad de subtítulos de la marca y las reglas de `biblioteca/clientes/cvander.json`. Ver EDITING_STYLES.md «Layers and knobs».) Cvander tiene perfil recuperado de0910, sin copiar su timing. Los nuevos proyectos MASTER incluyen un recibo REVIEW.json: `flujo` comprueba vigencia y evidencia, y `--entregado` exige la etapa export. Ver [REVIEW.md](REVIEW.md). El recibo lo completa el revisor; no es un modelo de visión ni una nueva solicitud de aprobación del usuario. Los gates técnicos no garantizan limpieza de máscara.

## El principio

> **El determinismo es la feature. Los agentes proponen, los validadores disponen.**
> El orquestador es un script — **cero LLM en el control de flujo.** Los agentes viven solo en las
> hojas del árbol, cada uno encerrado en una celda con gates que revisan su salida y lo obligan a
> reintentar con el error exacto como próximo prompt.

Si un LLM decide *qué pasa después* — qué escena sigue, si un overlay "está bien", cuánto dura —
vuelve la no-determinación que el pipeline existe para quitar. Entonces:

- **Control de flujo → código.** Orden, reintentos, concurrencia, el contrato del kit.
- **Trabajo creativo de hoja → agentes, gateados.** Escribir el `index.html` de UNA escena.
- **Gusto y verdad → Walter.** El mapa de beats, el sign-off.

La varianza queda atrapada dentro de una celda. Un agente **no puede entregar una escena rota**:
el gate falla y el error se vuelve su siguiente instrucción.

---

## Arquitectura

```
ORQUESTADOR DETERMINISTA  (tools/build-kit.mjs — NO hay LLM en el control de flujo)
│  entradas: TRANSCRIPT.md · el .srt del corte · scenes/<SNN>/meta.json (el contrato)
│  precondición: Walter aprobó el MAPA DE BEATS. Sin eso no se construye nada.
│
├─ por cada escena ──────────────────────────────────────────────┐
│   ┌──────────────────── celda auto-sanable ───────────────────┐ │
│   │ AGENTE  →  escribe scenes/<SNN>/index.html                │ │
│   │            contexto entregado (y SOLO esto):              │ │
│   │              • beat: label, palabras verbatim, start/end  │ │
│   │              • durationFrames exactos + zona segura       │ │
│   │              • si es money-beat                           │ │
│   │              • SCENE_PLAYBOOK + BRAND + SCENE_LIBRARY     │ │
│   │                         │                                  │ │
│   │   G1  hyperframes lint                                     │ │
│   │   G2  alpha-qc --css      (sombras horneadas)              │ │
│   │   G3  no-dup              (symlink + cero scripts locales) │ │
│   │   G4  datos               (ningún número que no dijo)      │ │
│   │   G5  render draft        (proxy.sh)                       │ │
│   │   G7  alpha-qc --premult  (si ya hay alpha lockeado)       │ │
│   │                         │                                  │ │
│   │   todo verde → OK          alguno falla → el error         │ │
│   │                            se vuelve el próximo prompt,    │ │
│   │                            reintentos ≤3, después BLOQUEA  │ │
│   └────────────────────────────────────────────────────────────┘ │
│
├─ G6  validate-kit.mjs   (contrato a nivel VIDEO: colocación, cobertura, duración, seam)
└─ HUMANO  Walter aprueba en preview → lockea con alpha.sh → firma el kit
```

---

## Los gates (esto es lo que hace seguros a los agentes)

Cada uno es determinista, rápido, y devuelve un error accionable — la línea, el número, el archivo.
Nunca "algo salió mal".

| Gate | Comando | Pasa cuando | Al fallar, se le devuelve |
|---|---|---|---|
| **G1 lint** | `npx hyperframes lint` | composición válida, timeline pausada en `window.__timelines["main"]`, sin `Date.now`/`Math.random` | las líneas del lint |
| **G2 alpha-css** | `alpha-qc.py --css` | sin sombras oscuras >8px a opacidad ≥.25; sin glow hecho con `text-shadow` borroso | la línea + el valor exacto |
| **G3 no-dup** | chequeo de filesystem | `design_system` es symlink · no copió `fonts/`/`assets/` · **cero scripts `.sh`/`.py` en la carpeta de la escena** | qué duplicó y qué regla rompió |
| **G4 datos** | números en pantalla vs transcript | todo número visible lo dice Walter en el corte, o está declarado en `meta.datos` | los números huérfanos |
| **G5 render** | `tools/proxy.sh` | la escena renderiza sin error | el stderr del render |
| **G6 contrato** | `validate-kit.mjs` | colocación en la palabra real · sin solape en la misma zona · **sin pantalla desnuda** · duración html=meta=render · seam calzado o `null` declarado | el diff exacto |
| **G7 premult** | `alpha-qc.py --premult` | `p99(RGB/A) ≈ 1.0` — alpha premultiplicado | el ratio medido |

**G4 no es el gate de Stacksync.** Allá el equivalente es *"ninguna afirmación que el producto no
haga"* (`capability.md`). Acá no puede ser "el texto ⊆ el transcript": un rótulo como **NO ANOTAS
NADA** es legítimo y no es verbatim. El modo de falla real de este pipeline está anotado en
`SCENES.md`: *"S05-nivel3 · **+ arreglar el dato**"*. Un número en pantalla que el audio no respalda
es la falla. Por eso G4 gatea **números**, no palabras.

**G3 existe por un caso concreto:** `2026-08-dos-puertas` terminó con seis scripts copiados dentro
(`premultiply.sh`, `alpha-qc.py`, `render.sh`, `split.sh`, `combine.sh`, `verify.sh`) y `scenes/`
vacío. El gate lo marca en rojo el día 1.

---

## Etapa → modo de ejecución

| Etapa | Modo | Por qué |
|---|---|---|
| Transcripción word-timed | herramienta (whisper) | determinista |
| **Mapa de beats** | **WALTER — nunca agente** | es la decisión de qué se cuenta y dónde. Un agente eligiendo esto produce un video promedio |
| Contrato (`meta.json` por escena) | agente propone **+ validador dispone** | el agente propone ventanas; `validate-kit` las verifica contra el .srt |
| **Construir escenas** | **AGENTE en celda gateada** | el trabajo de volumen — donde la orquestación paga |
| Lock + alpha | herramienta (`alpha.sh`) + G7 | premultiply obligatorio |
| Tabla del KIT_README | **generada** (`validate-kit --tabla`) | los timings no se teclean |
| **Sign-off** | **WALTER** | el gusto no se gatea |

**Protegido de los agentes: el mapa de beats (la intención) y el sign-off (el gusto).** Todo lo de en
medio es seguro de automatizar *precisamente porque* `meta.json` le da al agente un spec cerrado a la
entrada y un chequeo duro a la salida.

---

## Reintentos y escalada

1. El agente produce → corren G1→G7 en orden (barato → caro, se corta en el primero que falla).
2. Al fallar: el error del gate se agrega al contexto y reintenta. Máximo **3** por escena.
3. Después de 3: la escena queda **BLOQUEADA** y se le muestra a Walter con el último error.
   **Nunca se entrega una escena roja, y un agente nunca "decide" que está bien.**
4. Cada intento queda en `scenes/<SNN>/.build-log.json` — debuggeable y reanudable.

---

## Cómo se corre

```bash
node tools/build-kit.mjs <slug> --verify           # solo gates, cero agentes — EMPEZÁ ACÁ
node tools/build-kit.mjs <slug>                    # construye las escenas pendientes
node tools/build-kit.mjs <slug> --escena S05b      # una sola
node tools/build-kit.mjs <slug> --rehacer          # reconstruye todas
node tools/validate-kit.mjs <slug> --tabla         # la tabla del KIT_README, generada
```

`--verify` es el modo honesto para arrancar: corre los gates sobre lo que ya existe y te dice en qué
estado está el kit sin gastar un token ni un render.

---

## Lo que esto elimina

| Error de hoy | Lo mata |
|---|---|
| Kit construido contra el guion leído y no contra el corte real (55 % de cobertura) | G6 — la cobertura se calcula, no se estima |
| Overlay que cae sobre la frase equivocada | G6 — la ventana se verifica contra el .srt |
| El clip dura menos que el beat y deja pantalla desnuda | G6 — compara duración vs ventana |
| `meta.json` desincronizado del `index.html` (132 frames cuando el clip ya duraba 150) | G6 — el html manda y se comparan las tres fuentes |
| Alpha straight que revienta a blanco en CapCut | G7 — medido, no supuesto |
| Sombras negras que se ven bien sobre negro y son manchas sobre Walter | G2 — antes de gastar el render |
| Un dato inventado en pantalla | G4 |
| Scripts forkeados dentro de la carpeta del video | G3 |
| "¿Qué escena sigue?" respondido distinto cada sesión | imposible — el flujo es un script |

---

## Nota de costo

Los agentes en paralelo + los renders draft pesan. Las perillas: la concurrencia (`--jobs`; el cuello
son los renders, no los agentes) y gatear con draft y renderizar en calidad una sola vez al final.
Ninguna de las dos afecta la correctitud — solo cambian throughput por gasto.
