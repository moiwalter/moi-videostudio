# Layered Talking Head

Use the real recording as the clock and voice. Segment the speaker only when the intended layer treatment needs it. Test hair, hands, edges and difficult movement before processing a whole recording. Keep original and derivative timing aligned.

Declare the layer stack per scene: background/resources, foreground speaker, intended foreground graphics, captions. Inspect at mobile size in native playback and actual export. Brand colors and the recording's face geometry are separate inputs. Preserve the previous reference export and engine; do not rebuild the entire episode for a local correction.

Scene map method (word-level timing, one scene per idea, three speaker postures, word-anchored accents, transition rules): ../../docs/SEGMENTAR-POR-IDEAS.md. Already-built art resources (ASCII, dithering, halftone, CRT): ../../docs/ARTE-MARCAS.md — a catalog, not a default.

Engine, source, brand, variant and next action live in pipeline.json. Shared stage gates: ../../PIPELINE-WORKFLOW.md.

## Escenas y perillas (medidas el 1-nov-2026)

Cuatro tipos de escena, todos medidos en programar-profesión (aprobado por Chris) y Adobe (entregado v3):

| Escena | Qué se ve | Cuándo | Ejemplos |
|---|---|---|---|
| **hook** | Todo en un golpe desde el cuadro 0: texto + objeto + prueba, la persona delante | Los primeros segundos, con su tesis en sus palabras (REGLAS V15, V18) | adobe S01 · programar S01 |
| **presente** | La persona a pantalla completa, a lo sumo un push-in lento | Opina, confiesa, remata | adobe S03, S07, S18 |
| **recuerdo** | Material real arriba, la persona achicada o bajada, fondo oscurecido; los subtítulos suben | Nombra algo que se puede mostrar | adobe S06, S12 · programar S05 |
| **takeover** | El material ocupa toda la pantalla | Cuenta una memoria o entra a un objeto | adobe S13, S20 |

Las perillas (ritmo del hook, duración de escena, cómo se corre la persona en recuerdo, deriva de cámara, tamaño y
alineación de subtítulos) están en `style.json` con su default y dónde se midió. `node tools/capas.mjs <proyecto>`
muestra el valor final de cada una y de qué capa salió. Los defaults salieron de videos de Chris: otra marca los ajusta en
`biblioteca/marcas/<marca>.json → perillas.layered-talking-head`.
