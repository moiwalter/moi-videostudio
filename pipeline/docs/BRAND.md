# Línea gráfica — MOI Overlay

Consistencia de marca innegociable. **Misma identidad que la web PVP de Moi**
(`moiwalter.github.io/pvp-web`) — y desde el 12-ago-2026 eso es verificable, no una intención.

> ⛔ **REESCRITO el 12-ago-2026.** Hasta ese día esta línea era falsa: la web declaraba
> `--brand:#fd551d` sobre `#141314` con Geist, y el video renderizaba cream + navy + dorado con
> Cormorant. **Dos identidades, mientras el documento juraba que eran una.** Walter lo cazó
> preguntando *"¿revisaste que cambiamos el color de Moi al de la web?"*.
> Los tokens de abajo salen del `:root` de la web, con **los mismos nombres**, para que la próxima
> vez la comparación sea un diff y no una discusión. La paleta vieja vive en git.
> **Regla que queda: la web es la fuente. Si cambia su `:root`, este archivo está desactualizado.**

## Lienzo
- **1080×1920 vertical**, 30fps.
- Render **alpha** (`--variables '{"alpha":true}'`) → fondo transparente. `body.alpha{background:transparent}`.
- Fondo gris `#6E7378` SOLO en preview mp4 (se aclaró desde `#3a3d42`: con la paleta oscura, un
  preview gris oscuro esconde justo los bordes que hay que juzgar).

## Paleta — espejo del `:root` de la web
| Token | Hex | Var en la web | Uso |
|-------|-----|---------------|-----|
| ink | `#141314` | `--bg` | el fondo de la marca. Cards oscuras, full-frames |
| ink-muted | `#1A1A1A` | `--bg-muted` | cards sobre el corte `rgba(26,25,26,.97)` |
| surface | `#333333` | `--surface` | superficies elevadas, bordes de bloque |
| fg | `#EEEEEE` | `--fg` | **el texto**. Ya no es tinta oscura |
| fg-muted | `#818081` | `--fg-muted` | labels secundarios, kickers |
| **brand** | **`#FD551D`** | `--brand` | **EL acento.** Números, palabras clave, tachones, badges |
| brand-muted | `#FD8D68` | `--brand-muted` / `--rose` | negativo / ✗ / el acento en bajo volumen |
| hot | `#FAD146` | `--hot` | el golpe fuerte: lo que tiene que aterrizar más que el naranja |
| sand | `#FAF8F5` | — | la única superficie clara. Con cuidado: es lo más brillante del cuadro |
| green | `#007934` | — | positivo / ✓ |
| navy-deep | `#111D35` | — | azul profundo de sus secciones oscuras |
| wallbit-blue | `#0D99FF` | — | SOLO escenas Wallbit (sponsored), de su CSS. No mezclar |
| wallbit-dark | `#14161C` | — | dark de Wallbit |

⚠️ **`--surface` está declarado DOS VECES y gana el segundo.** La paleta lo define `#333333`
(espejo de `--surface` de la web) y el bloque de roles lo vuelve a definir como `surface → ink-muted`
(`#1A1A1A`). En una escena, `var(--surface)` devuelve **`#1A1A1A`**, no `#333333`. No es un bug del
generador —los roles se emiten después a propósito— pero es una trampa: se descubrió el 12-ago
animando un color a `#333333` a mano y viendo que no coincidía con el resto del cuadro.
**Regla: nunca hardcodear el gris de una superficie.** Si hay que animar hacia él, leerlo con
`getComputedStyle` del elemento que ya lo usa. Si algún día se quiere el `#333333` real, hay que
renombrar el token de paleta (p. ej. `slate`) — pero eso toca escenas ya aprobadas.

⚠️ **La identidad se dio vuelta.** Antes: tinta oscura sobre cards cream. Ahora: **texto claro
sobre fondo casi negro**. Una escena vieja copiada sin revisar sale con texto oscuro sobre oscuro y
se ve bien en el editor pero muere sobre el corte. Y el acento **ya no es el dorado, es el naranja**.

## ⛔ EL GRIS NO FLOTA (12-ago-2026 — la corrección más cara del video 1)

Walter: *"el plomo no se distingue bien en el video, en TODO el video estoy viendo ese problema."*
Tenía razón, y la causa era de **método**: yo juzgaba las escenas sobre el gris del preview
(`#6E7378`), que es casi el mismo tono que `--fg-muted` (`#818081`). Sobre ese fondo todo "se veía
bien" por accidente. Sobre su footage —pared crema clara, repisa brillante, tira LED— el gris medio
**desaparece**.

Al componer los alphas sobre un frame real apareció el patrón, limpio:

| qué | sobre el corte |
|---|---|
| texto o forma **gris flotando** | ❌ desaparece |
| lo mismo **sobre card oscura** | ✅ perfecto |
| forma **oscura** (ink / ink-muted) | ✅ se lee fuerte |
| **naranja de marca** | ✅ salta |

**Las tres reglas que quedan:**
1. **Ningún texto gris flotando.** O va sobre card oscura, o lleva contorno tight (§3b regla 4).
2. **Ninguna forma de relleno claro sin aro oscuro.** `box-shadow:0 0 0 4px rgba(ink,.85)` — aro de
   radio 0, que no viola el límite de sombras porque no tiene blur.
3. **Se juzga componiendo sobre el corte**, nunca sobre el preview.
   `ffmpeg -i local/qc-plate.png -ss T -i SNN_ALPHA.mov -filter_complex "[1:v]premultiply=inplace=1[fg];[0:v][fg]overlay"`

Y un efecto secundario que apareció al arreglarlo: **una pista `--surface` sobre card `--card` también
desaparece** — dos oscuros juntos. Sobre card, los elementos estructurales van en `rgba(fg,.20)`.

## Tipografía
- **Geist Black (900)** → display: títulos, preguntas, frases. Apretado, `letter-spacing:-.02em`.
- **Geist** 400/500/600/700 → labels, UI, cuerpo.
- **Geist Mono** → captions, tags, meta, URLs, kickers (uppercase + letter-spacing).

⛔ **Cormorant Garamond e IBM Plex salieron.** La web no tiene una sola serif — declara
`--font-sans:'Geist'` y nada más. Los `.ttf` viejos siguen en `design_system/fonts` solo para
re-renderizar material anterior. Geist es SIL OFL 1.1; la licencia está al lado de los archivos.

## Componentes
- Cards oscuras `rgba(26,25,26,.97)`, radius 20–28px, sombra `0 12px 55px rgba(0,0,0,.32)`,
  rim claro `inset 0 0 0 3px rgba(255,255,255,.10)` para despegarlas del corte.
- La card cream ya no aplica: sobre esta paleta es el elemento más brillante del cuadro y **se come la cara**.
- Logos en chip: cuadro blanco con padding y radius.
- Legibilidad por **text-shadow**, NO por velo oscuro.
- Marca de agua `MOI` abajo-izquierda (Plex Mono, letter-spaced).

## Animación
- **Energía: EFUSIVA** (feedback Walter 2026-07-09) — overshoot marcado (`back.out(1.9–2.2)`), **punch de scale cuando un número aterriza** (1→1.15→1), palabras clave entran en **stamp** (scale 2→1 + micro-shake de la card), pulso de glow en el acento. Nada tímido/enterprise. Los límites siguen: sin destellos/wipes entre escenas, sin velo.
- Entradas: `inUp` (y:30→0, power3.out), `pop` (scale .6→1, back.out 1.8), chips x:40→0 stagger back.out(1.6).
- Números: `countTo` 0.9s + `miles()` (separador de miles manual).
- SVG: draw-on (`stroke-dashoffset`→0).
- Web 3D: `perspective:2200px`, rotationY -34→-13, rotationX 11→6, scroll `yPercent`.
- Salida estándar: `out` (opacity→0, y:-16, power2.in).

## PROHIBIDO (feedback de Walter)
- ❌ Escenas de **solo texto** (eso es subtítulo). Siempre animación con elementos.
- ❌ **Velo oscuro / scrim** global → se ve como "fade negro" sobre su video.
- ❌ **Destellos / wipes champán** entre escenas. Transición = fade limpio.
- ❌ **HEVC con alpha** para CapCut → muestra **fondo negro**. SIEMPRE ProRes 4444 (`yuva444p12le`).
- ❌ Concatenar con `-c copy` → rompe timestamps. Combinar = re-encode `prores_ks`.
- ❌ Números mal / sin separador de miles / cifras incoherentes (ej. $250 cuando el punto es $2.500).
- ❌ **Dorado, cream y navy de la paleta vieja.** Son de otra identidad. `brand.mjs check` los rechaza.
- ❌ **Serif de display** en material nuevo.

## Salida
- 1 clip transparente **por escena**, ProRes 4444, nombre `NN_kebab-descriptivo.mov`, orden narrativo.
- Walter sincroniza cada clip a su audio en CapCut (timing manual, no mío).
