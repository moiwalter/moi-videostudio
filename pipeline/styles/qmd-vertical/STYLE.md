# QMD vertical

Talking-head corto con la persona siempre en cuadro, grande, el cuerpo saliendo por abajo, y una **placa apaisada** detrás del torso cuya borde superior lo rompe la cabeza. El material (logos reales, UI, un número héroe) vive en un tablero arriba o detrás de la persona. El suelo no se queda quieto. El cierre es el logo y el dominio, sin frase de CTA.

Se midió en **goldmine v3.3** (aprobado el 2026-11-01). Los números están en `style.json` con la cita. `node tools/capas.mjs <proyecto>` muestra el valor final y de qué capa salió.

Entrega **las dos orientaciones**: 1080×1920 y 1920×1080. El markup es uno solo; los takeovers cambian con `@container (aspect-ratio < 1)`. No se mantienen dos copias de la escena.

## En qué se diferencia de Layered Talking Head

Los dos ponen a una persona hablando con material real. No son el mismo tratamiento.

| | Layered Talking Head | QMD vertical |
|---|---|---|
| La persona | Sube y baja de plano: presente a pantalla completa, recuerdo achicada o bajada, takeover en el que el material se la come | Siempre en cuadro y grande (1.00–1.17 de la fuente). No se achica para dejar ver un recurso |
| El fondo de la persona | La propia toma, o un recurso a pantalla | Una placa **apaisada** (en v3.3, 952×640) que se disuelve hacia el suelo; la cabeza sale de la placa |
| El ritmo de cámara | Una deriva lenta de todo el video (1 → 1.035) | Un cambio de zoom en **cada** join, con techo 1.19 |
| El suelo | El de la toma | Manchas de gradiente, curvas de topo, grilla de puntos, un haz y grano. El grano va **debajo** del recorte, nunca en la cara |
| El cierre | El de la marca, sin contrato propio | Flood de color, logo real y el dominio, unos 4 s, sin CTA |
| El sonido | Lo declara el episodio | Cama compuesta (piano muestreado + batería real), una sola mezcla a −14 LUFS / −1 dBTP, la voz ≥12 dB sobre la música en 300–3500 Hz |
| Orientación | La del episodio, en la práctica 9:16 | Las dos, del mismo markup |

Layered sigue siendo el formato cuando la persona tiene que hacerse chica para que un recurso ocupe arriba. QMD vertical es el formato cuando la persona es el plano y el recurso se le acomoda alrededor.

## El recorte

RVM (resnet50, `downsample_ratio` 0.4). Encima, en este orden, medido en v3.3:

1. Niveles 0.035–0.97 (se va la neblina, quedan los mechones).
2. Promedio temporal con flujo óptico: los vecinos se deforman al cuadro y sólo cuentan si el alfa y el color coinciden. No cruza un jump cut.
3. Filtro guiado en la banda del borde.
4. Choke de 1 px y emplume σ 1.4 sólo en el borde. Gamma 1.15 en el alfa.
5. Descontaminación de color y despill verde.
6. Light wrap del **22 %** del color de la escena, en los 2–3 px de afuera.
7. Preescala 1.2× en Lanczos (el navegador sólo reduce) y unsharp suave en el interior sólido, no en el borde.
8. Sombra de contacto **estática** en CSS (`#fgwrap`), no animada.

El estado recurrente del matting se reinicia en cada join.

## Movimiento

- Zoom distinto a cada lado de un join. 1.00 no sigue a 1.00.
- Takeovers: `cutT`, `tkIn`, `tkOut`, `flood`, `hl`. Sin `TK.drop` (el giro chico rompe la regla de esta casa).
- **Brillo.** GSAP, si un tween de `filter` arranca en `"none"`, interpola el brillo que falta como 0. En v3.3 eso dejó un par de cuadros del orador en silueta negra en el join de 4.6 s. `TK.cutT` arranca siempre de un `blur()` + `brightness()` mayor que 0. Está prohibido `filter: "none"` y `brightness(0)` sobre la persona.
- Render con `--video-frame-format png`.

## Sonido

`pipeline/tools/music.py` compone la partitura (pretty_midi). FluidSynth la toca con Salamander Grand Piano y MuseScore_General; la batería son one-shots licenciados. Nada de oscilador puro. Esos archivos **no están en el repo**: `pipeline/docs/ACTIVOS-EXTERNOS.md`.

En v3.3: 110.6 BPM, duck de 5 dB mientras habla, la cama 9.5 LU bajo la voz antes del duck y 14.6 LU después, un solo silencio en el giro, cadencia que resuelve en el outro. `master_mix.py` suma voz + sfx + música y limita el true peak. `sfx.py` alinea cada muestra a su pico.

## Cierre

Después de la última palabra (en v3.3, 0.34 s de aire) un flood verde crece desde la cara, el logo blanco entra y debajo sólo el dominio. Se sostiene ~4 s. Sin frase de llamada a la acción.

## Por dónde empezar

1. El plan de escenas se aprueba antes de construir. Ver `pipeline/templates/qmd-vertical/LEEME.md`.
2. Componentes compartidos (takeovers, odómetro, fondos, grilla de logos, subtítulos, cierre): `pipeline/componentes/`.
3. Herramientas: `pipeline/tools/rvm_matte.py`, `make_alpha.py`, `fix_matte.py`, `head_anchor.py`, `cut_master.py`, `refine_words.py`, `music.py`, `master_mix.py`, `sfx.py`, `qa.py`, `edge_flicker.py`.
4. El generador de referencia es `pipeline/templates/qmd-vertical/build.mjs` (el de goldmine v3.3, con las rutas del repo). Se copia al episodio; no se edita el video aprobado para probar el formato.
