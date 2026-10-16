# Revisión de video: de Studio a la entrega

Reglas compartidas incorporadas desde Cvander0910v3 (13-sep-2026). `hyperframes check` y `qc-master` verifican aspectos técnicos; no deciden si una máscara está limpia o si una demo se entiende. La revisión de imagen es trabajo del agente/revisor. Este registro no añade una aprobación que Walter deba dar ni sustituye sus instrucciones.

## En el flujo existente

Los nuevos proyectos MASTER creados por `new-video.sh` reciben `REVIEW.json`. `flujo.mjs` verifica su vigencia después de los controles técnicos; `--rapido` también comprueba el registro. Si se declara un archivo exportado, verifica además esa etapa. `flujo --entregado` exige el recibo del export para proyectos que lo usan. Los proyectos históricos sin recibo no se reabren.

En KIT sigue vigente su proceso de revisión en CapCut, incluido alpha premultiplicado. Un VP9 con alpha dentro de MASTER es una capa interna: no requiere tratar todo el MP4 como kit.

```bash
node tools/review-video.mjs <slug> --init             # solo si aún no existe REVIEW.json
node tools/review-video.mjs <slug> --fingerprint      # solo lectura; identidad de los inputs
node tools/review-video.mjs <slug> --check --stage preview
node tools/review-video.mjs <slug> --check --stage export
```

`--init --composition otra-carpeta/index.html` permite un proyecto existente con otra ruta, sin mover su composición. No inicializar sobre entregas cerradas solo para satisfacer un formato nuevo.

## Lo que se comprueba

| Etapa | Comprobación | Evidencia que conserva el revisor |
|---|---|---|
| Preview: visual | Captions, logos, recursos legibles, márgenes, duración de las animaciones, entrada/centro/salida. | Capturas con tiempos y una nota de lo revisado. |
| Preview: layers | Orden, misma fuente/pose/tiempo; pelo/manos; máscara sin entorno opaco sobre recursos. Revisar todos los usos si aparece un fallo compartido. | Máscaras/comparativas y prueba en movimiento. `not_applicable` con motivo si no se usa ese tratamiento. |
| Preview: timing | Play/pausa/seek en Studio nativo, límites y continuidad de audio. | Registro de tiempos/observaciones, con límites de preview declarados. |
| Export: visual | Revisar el MP4 resultante en escenas críticas y el instante exacto de defectos previos. | Imágenes extraídas del MP4 con tiempos. |
| Export: audio | Comprobar audio y lipsync; evitar pista duplicada y deriva. | Informe de escucha/comparación. `not_applicable` con motivo para un video sin audio. |
| Export: decode | Archivo completo, duración/resolución/FPS, decodificación y defectos técnicos visibles. | Reporte de ffprobe/FFmpeg u otra herramienta pertinente. |

Cada check empieza `pending`. El agente escribe `pass` y una nota concreta después de comprobarlo, añade rutas de evidencia y el `fingerprint` observado. El script **no rellena passes**. La autorización de exportar se toma de la conversación; no se deriva de estos campos.

`export.file` apunta al archivo vigente; `export.sha256` identifica exactamente el MP4 revisado. Solo completar export después de generarlo y comprobarlo. El fingerprint cubre composición y referencias locales en HTML/CSS, incluidos videos/alpha/fuentes; declarar en `extraInputs` dependencias dinámicas o importadas desde JS que no aparecen allí. URLs remotas no se congelan ni se verifican con este hash: localizar los medios de entrega y comprobarlos. Un input que cambia invalida el recibo anterior.

La existencia de una captura o la declaración `pass` no prueba por sí misma calidad visual: el verificador comprueba integridad/vigencia documental, no analiza los píxeles. La revisión honesta y específica sigue siendo necesaria.

## Ritmo de trabajo

Iterar en Studio; editar la escena activa dentro de la timeline completa. No exportar MP4 por cada avance. Al pedir Walter exportación, hacerla y verificar el archivo sin reconfirmación. No ejecutar sesiones de captura/check simultáneas en este entorno ni escribir dentro del proyecto mientras se audita Play: hot reload puede destruir el contexto del navegador.

Mantener `CONTEXT.md` corto: último feedback, fuente editable, excepciones, evidencia, entrega vigente y siguiente paso. Archivar el historial aparte. Conservar capas editables; si un fallo está horneado, reconstruirlo desde las fuentes en lugar de acumular otra alpha encima.
