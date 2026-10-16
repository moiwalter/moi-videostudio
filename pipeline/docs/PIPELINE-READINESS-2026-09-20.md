# Revisión final del pipeline · 20 de septiembre de 2026

**Actualización posterior: Walter ordenó eliminar el proyecto anterior de Enzo y empezar desde cero.** El estado vigente está en [el proyecto nuevo](../../proyectos/startupeable/2026-09-enzo/INICIO.md). Los resultados técnicos de esta auditoría describen el momento anterior al reinicio. El proceso comparte estructura y controles para Remotion y HyperFrames; el criterio visual sigue requiriendo ver y escuchar las escenas. Esta revisión corrigió fallos concretos y dejó la recuperación documentada.

[Workflow interactivo: 24 gates](PIPELINE-WORKFLOW.html) · [Entrada única](../../START_HERE.md) · [Comandos](PIPELINE-OPERATIONS.md) · [Estado actual de Enzo](../../proyectos/startupeable/2026-09-enzo/INICIO.md)

## Evidencia y alcance

- **44/44 pruebas pasaron**; antes de los cambios pasaban 35. Incluyen entrada → scaffold → catálogo, ambos motores, protección contra sobrescritura, fuente/transcript por variante, aprobaciones, recursos, revisión y controles de salida.
- Se comprobaron seis combinaciones aisladas: proyecto nuevo y carpeta de entrada previa, para HyperFrames MASTER, HyperFrames KIT y Remotion MASTER. Conservaron el archivo original y rechazaron reinicializar el editor.
- El router enumera los **16 proyectos**. Los dos exports de referencia de Cvander conservan sus bytes y se reconocen como entregas históricas; sus observaciones editoriales existentes siguen visibles.
- El archivo derivado que usaba Enzo pasó los controles técnicos en esta auditoría. Después fue eliminado por el reinicio solicitado; esa medición es histórica y no describe una nueva edición.
- Esta revisión no produjo un nuevo render de cliente ni aprobó escenas. El piloto técnico de Remotion ya documentado pertenece a la revisión anterior; no se presenta como un nuevo episodio terminado.

Logs y mediciones: [pruebas](../../archivo/auditoria-pipeline/2026-09-20-readiness/after-tests.log), [estado antes](../../archivo/auditoria-pipeline/2026-09-20-readiness/status-before.json), [estado después](../../archivo/auditoria-pipeline/2026-09-20-readiness/status-after.json), [fuente y mapa de Enzo](../../archivo/auditoria-pipeline/2026-09-20-readiness/enzo-source-audit.json). Copias de los archivos anteriores en `../../archivo/auditoria-pipeline/2026-09-20-readiness/before/`.

## Qué se corrigió

| Problema demostrado | Comportamiento actual |
|---|---|
| Mover el archivo primero creaba una carpeta que el scaffold rechazaba. | Se adopta únicamente una entrada marcada `intake-pending` con `edicion/` vacía. Conserva originales y procedencia. |
| HyperFrames MASTER salía antes de registrar proyecto y carpetas comunes. | MASTER y KIT se registran antes de terminar; el catálogo recibe el proyecto. |
| Vincular voz podía conservar una exención vieja de «sin transcripción». | El binding elimina esa exención, conserva dudas pendientes y valida argumentos. |
| El control de fuente leía la base aunque estuviera seleccionada otra variante. | Se verifica y vincula el corte de la variante activa; otras variantes se conservan. |
| Un carril inválido podía saltarse la rama de revisión MASTER. | Preflight rechaza carril/etapa inválidos y lee el destino de la variante activa. |
| Aprobaciones pendientes antiguas aparecían como un volcado extenso sin acción clara. | El router resume la escena pendiente y el siguiente paso; una huella sin decisión no se llama aprobada. |
| Consultar una entrega histórica en texto terminaba con un error, aunque JSON funcionaba. | Ambas salidas comparten correctamente el código de estado; se comprobó sin modificar el proyecto. |
| La página inicial mezclaba comandos vigentes con recetas antiguas de un solo motor. | START_HERE queda como entrada breve y actual. Las recetas anteriores permanecen archivadas. |

## Gates y responsabilidades

| Paso | Qué permite continuar | Si falta o falla |
|---|---|---|
| 0. Archivo recibido | Traslado real a originales/recursos, verificación, procedencia y aviso de ruta. | Reportar el error real; si falta identidad, usar carpeta provisional. No pedir permiso rutinario. |
| 1. Recuperar proyecto | Cliente, variante, última decisión fechada, corte, motor y versión. | Reconciliar notas; no confundir mapa elegido con escena aprobada. |
| 2. Marca, estilo, plataforma | Decisiones de este cliente y episodio, obtenidas del contexto. | Resolver solo lo pendiente. No heredar automáticamente el morado o collage de Cvander. |
| 3. Fuente y transcripción | Archivo exacto, identidad, idioma, reloj y escucha de dudas. | Reparar el tramo afectado; no recortar un corte cerrado ni inventar palabras. |
| 4. Dirección y mapa | Propuesta comprensible y decisión real registrada. | Mostrar la idea concreta; no construir todo el video para descubrir si funciona. |
| 5. Recursos | Candidatos auténticos con procedencia y recorte legible. | Buscar o reemplazar antes de animar; el control de archivos no mide relevancia. |
| 6. Hook | Preview nativo con rostro, voz, texto y movimiento; decisión del usuario. | Corregir aquí antes de extender el tratamiento. |
| 7. Escenas | Una escena activa, inspección de uniones y decisión sobre esa revisión. | Mantener pendiente; avanzar solo en preparación independiente. |
| 8. Montaje completo | Continuidad, capas, subtítulos, zonas seguras y audio revisados. | Corregir el alcance afectado; registrar evidencia real. |
| 9. Render | Preflight vigente y autorización existente. | Resolver el bloqueo; no pedir nuevamente una autorización ya dada. |
| 10. Entrega | Archivo decodificado y visto/escuchado; versión, evidencia y siguiente acción guardadas. | Reparar la salida. Un render correcto técnicamente no firma calidad editorial. |

La revisión de zonas seguras depende de la plataforma y del encuadre real. La reproducción nativa y el MP4 final son comprobaciones distintas. Las aprobaciones y autorizaciones anteriores persisten dentro de su alcance.

## Enzo: reinicio solicitado después de la auditoría

El usuario ordenó borrar los proyectos anteriores de este video y empezar desde cero. Se eliminó `proyectos/startupeable/2026-08-tecnico-vs-no-tecnico/`, incluidas sus versiones archivadas internas, escenas, recursos, propuestas, transcripciones y derivado de audio. También se retiró su alias de compatibilidad.

Nuevo proyecto: [`proyectos/startupeable/2026-09-enzo/`](../../proyectos/startupeable/2026-09-enzo/). Solo se conserva `originales/enzo01.mp4`, verificado por SHA-256 antes y después del traslado. `edicion/` está vacía y el índice declara `intake-pending`.

Motor, estilo, plataforma, dirección, hook y mapa se definen desde el nuevo brief. Las decisiones del montaje eliminado no se heredan. Los logs anteriores de esta auditoría conservan su valor histórico, pero no son instrucciones para recuperar el proyecto borrado.

[Registro del reinicio](../../proyectos/startupeable/2026-09-enzo/revision/REINICIO.json) · [Entrada actual](../../proyectos/startupeable/2026-09-enzo/INICIO.md).

## Qué falta demostrar en la próxima edición

El siguiente ensayo creativo es el hook de Enzo. Ahí se debe comprobar legibilidad, comprensión de la idea, ritmo y encuadre. Las pruebas del pipeline evitan varios errores de organización y estado; no garantizan por sí solas un buen hook, buenos recursos o una edición dinámica.

Para esta nueva edición, el agente lee INICIO.md y prepara una dirección nueva desde el original; el reinicio explícito sustituye las decisiones del montaje eliminado. El usuario aporta únicamente decisiones pendientes y feedback sobre lo que ve. El modo rápido sigue siendo orientativo; los otros proyectos antiguos con pendientes permanecen visibles y no se reabren automáticamente.
