# VideoStudio — entrada única al pipeline

Workspace: `/Users/TERABYTE10/Movies/VideoStudio/`. Incluye videos personales y de clientes. Stacksync conserva su propio repositorio.

[Diagrama interactivo: 24 gates](pipeline/docs/PIPELINE-WORKFLOW.html) · [Comandos vigentes](pipeline/docs/PIPELINE-OPERATIONS.md) · [Última revisión y caso Enzo](pipeline/docs/PIPELINE-READINESS-2026-09-20.md)

## 1. Al recibir un archivo

Moverlo al proyecto **sin preguntar**, verificarlo y comunicar inmediatamente la ruta completa. Grabaciones en `originales/`; apoyo en `recursos/`. Crear la carpeta primero, aunque falten motor o estilo. Si falta identidad, usar una carpeta provisional. Seguir [ENTRADA-DE-ARCHIVOS.md](pipeline/docs/ENTRADA-DE-ARCHIVOS.md): no sobrescribir nombres ni confundir una copia con un traslado.

La carpeta creada antes del editor lleva `state: "intake-pending"`, cliente/slug y procedencia en `PROYECTO.json`. `edicion/` queda vacía hasta inicializarla con `new-video.sh`.

```text
proyectos/<cliente>/<video>/
  PROYECTO.json
  originales/   grabaciones recibidas
  edicion/      motor, código, fuente de trabajo y estado
  recursos/     fotos, logos, clips y procedencia
  revision/     previews y evidencia de revisión
  entregas/     exportaciones finales versionadas
```

[Catálogo](catalogo.json) · [Mapa de carpetas](CARPETAS.md). Biblioteca común en `biblioteca/`; herramientas, estilos y documentos en `pipeline/`. Las rutas antiguas son alias de compatibilidad.

## 2. Recuperar decisiones antes de actuar

```bash
node pipeline/tools/flujo.mjs <slug> --rapido --json
```

Usar cliente/slug si el nombre se repite. Leer la petición actual, CONTEXT y `pipeline.json` de la variante activa. Mantener motor, pin, corte cerrado, aprobaciones y autorización existentes. Remotion sigue en Remotion; usar una herramienta de HyperFrames no cambia el motor.

En proyectos antiguos sin `pipeline.json`, reconciliar las decisiones fechadas del brief, dirección y mapa. Una pausa vieja puede preceder una decisión más reciente. Un mapa elegido tampoco demuestra aprobación de escenas. Registrar el estado reconciliado antes de retomar producción.

El modo rápido **omite QA técnica**. Estados: 0 = controles reportados vigentes; 1 = fallo/bloqueo; 2 = pendiente/no verificable. Una entrega histórica intacta permanece cerrada hasta una corrección solicitada.

## 3. Separar marca, estilo, episodio y plataforma

[Estilos disponibles](pipeline/docs/EDITING_STYLES.md): Paper Collage, Layered Talking Head y Moi Overlay, cada uno con su contrato. La marca determina paleta, fuentes y tono; el estilo determina el tratamiento. El episodio determina guion, recursos y escenas. La plataforma determina encuadre y zonas seguras.

Resolver estas decisiones desde el contexto; preguntar solamente lo que falte. Inicializar con `pipeline/tools/new-video.sh` según los [comandos](pipeline/docs/PIPELINE-OPERATIONS.md). Una carpeta `intake-pending` se adopta sin perder originales. Un editor existente nunca se reinicializa.

Vincular el corte exacto y su transcripción por contenido. Escuchar idioma, palabras dudosas y cierre. Un hash demuestra identidad; no demuestra que las palabras sean correctas. Un corte cambiado exige revisar su reloj y dependencias.

## 4. Mapa → recursos → hook → una escena

1. Recuperar o proponer la dirección y mapa; conservar decisiones ya dadas. En un talking-head MASTER, el mapa se arma con [Segmentar por ideas](pipeline/docs/SEGMENTAR-POR-IDEAS.md): tiempos reales por palabra, una escena por idea, tres posturas, acento en palabras puntuales. Recursos de arte ya construidos (ASCII, dithering, halftone): [ARTE-MARCAS.md](pipeline/docs/ARTE-MARCAS.md).
2. Buscar recursos reales con procedencia. Revisar el candidato y su recorte antes de animarlo.
3. Construir el hook real con la persona, la voz y la marca de este cliente. No trasladar colores o textos de otro episodio por defecto.
4. Mostrarlo en el preview nativo con audio y sus uniones. Registrar la decisión real sobre esa revisión.
5. Continuar **escena por escena**. Si el hook falla, corregirlo antes de extender el tratamiento a todo el video.

Preparación independiente puede avanzar mientras llega feedback. No inventar aprobaciones a partir de un check técnico. No delegar a otros agentes sin petición explícita.

## 5. Revisión → render autorizado → entrega comprobada

MASTER entrega el video completo; KIT entrega clips para montaje; KIT+MASTER debe cumplir ambos contratos. MASTER funciona con el motor registrado, Remotion o HyperFrames.

Antes de exportar: escenas vigentes, recursos resueltos, revisión nativa actual y preflight válido. Reutilizar la autorización de render ya recibida. Después: decodificar el archivo, comprobar formato y audio, y mirar/escuchar imagen, uniones, subtítulos y sincronía. KIT con alpha para CapCut requiere premultiplicación y su comprobación real.

Finales nuevos en `entregas/`, con nombre de versión. Conservar anteriores y registrar entrega, evidencia y siguiente acción. Publicar es una acción aparte.

## 6. Correcciones y continuidad

Cambió una escena → revisar esa escena y sus uniones. Cambió algo compartido → sus dependientes. Cambió el corte → transcripción y tiempos. No reiniciar todo por mover un subtítulo. Guardar CONTEXT breve y una referencia vigente por variante.

La guía anterior, con recetas históricas, se conserva [en el archivo de auditoría](archivo/auditoria-pipeline/2026-09-20-readiness/before/START_HERE.md). Para operar manda esta página y los comandos vigentes; consultar documentación técnica antigua solo para el tratamiento al que pertenece.
