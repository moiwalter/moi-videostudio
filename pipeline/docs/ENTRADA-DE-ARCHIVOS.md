# Paso cero: incorporar el archivo al proyecto

Regla permanente indicada por Walter el 20 de septiembre de 2026: cuando entrega un archivo local para trabajar en un video, el agente lo **mueve dentro de la carpeta de ese video, sin pedir confirmación**, y comunica su ubicación nueva antes de continuar con la edición.

## Regla dura: una sola copia en disco (Walter, 3 de noviembre de 2026)

El espacio del Mac es el problema principal: nunca dejar dos copias de lo mismo. La entrada termina cuando el origen ya no está en Downloads, Desktop o WhatsApp.

- **Fotos, audio y clips de Christian o de cualquier cliente:** todo se mueve con `mv`; no usar `cp`, ni extraer dejando el original.
- **ZIP:** extraer al proyecto, verificar y retirar el ZIP y cualquier archivo suelto junto a él.
- **Si se convierte o redimensiona:** mover también el original a `recursos/` y registrarlo. Un hash no detecta estas copias.
- **Al renombrar:** mover con el nombre nuevo y registrar `originalPath`.
- **Carpeta de origen:** cuando quede vacía, retirarla también.
- **Antes de dar la entrada por terminada:** comprobar que el origen ya no existe.

## Secuencia obligatoria

1. Recuperar el proyecto de la conversación. Si es nuevo, crear su carpeta en `~/Movies/VideoStudio/proyectos/<cliente>/<video>/`. La incorporación del archivo no espera a decidir motor, marca visual, estilo, hook o escenas.
2. Mover físicamente la grabación recibida a `<proyecto>/originales/<nombre-del-archivo>`. Los recursos de apoyo claramente identificados —fotos, logos, clips de apoyo— van a `<proyecto>/recursos/`. Conservar el nombre; si existe otro archivo con ese nombre, usar un sufijo único sin sobrescribirlo.
3. Comprobar que el archivo está íntegro y accesible en el destino. Si el traslado requiere copiar entre volúmenes, verificar la copia antes de retirar el archivo del origen. Si ya está dentro del proyecto correcto, conservar su ubicación y comunicarla.
4. Registrar la ruta relativa actual y la procedencia en `PROYECTO.json`. Actualizar las referencias de trabajo necesarias. Vincular `pipeline.json.source` únicamente cuando se haya identificado la fuente que define el reloj de edición; recibir un recurso adicional no sustituye la fuente activa ni su transcript.
5. Avisar inmediatamente con la ruta absoluta o un enlace: **«Moví `archivo.mp4` a `[ruta completa]/originales/archivo.mp4`. Trabajaremos desde ahí».** Después seguir con análisis, transcripción y edición.

## Si aún falta identificar el proyecto

Usar los datos disponibles en la conversación. Si no alcanzan para identificar un proyecto, crear una carpeta provisional `proyectos/por-clasificar/<fecha>-<nombre-del-archivo>/`, con `originales/`, `edicion/` y un `PROYECTO.json` mínimo que indique `state: "intake-pending"`. Mover el archivo allí y comunicar que la carpeta es provisional. Resolver luego los datos editoriales pendientes; no bloquear el traslado ni asignar el archivo a un cliente por conjetura.

## Inicializar el editor después de recibir el archivo

Para cualquier carpeta nueva creada antes del scaffold —provisional o con cliente conocido—, dejar `edicion/` vacía y registrar estos campos en `PROYECTO.json`, además de las rutas y la procedencia del archivo:

```json
{"schemaVersion":1,"state":"intake-pending","client":"cliente","slug":"nombre-del-video","editable":"edicion","sources":[]}
```

Cuando se conozcan marca, estilo y motor, ejecutar `pipeline/tools/new-video.sh` con el mismo cliente y slug. Adopta únicamente una carpeta marcada `intake-pending` con editor vacío; conserva originales y procedencia, inicializa el motor y actualiza el catálogo. Nunca usar esta vía para reconstruir un editor existente. No dejar notas ni archivos de edición en `edicion/` antes de inicializarla; las notas de entrada pertenecen al índice.

Si se usó `por-clasificar`, trasladar primero la carpeta provisional completa a su cliente definitivo sin sobrescribir otro proyecto, actualizar `client`/`slug` y las referencias, y comunicar la ruta final. Entonces inicializar el editor. Mantener rutas relativas para que originales y recursos viajen juntos.

## Condiciones

- La instrucción del usuario ya autoriza este traslado rutinario. No preguntar «¿lo muevo?» ni añadir un gate de aprobación para hacerlo.
- Comenzar el trabajo desde el archivo centralizado; no dejar la fuente operativa en Downloads, Desktop o una carpeta suelta, ni usar únicamente un enlace dentro del proyecto como sustituto de moverla.
- Las instrucciones explícitas de un caso concreto prevalecen, por ejemplo «solo revísalo» o «no muevas este archivo».
- Si el archivo no existe o macOS impide el traslado, informar de la ruta y el error real. No afirmar que se movió ni ocultar que solo se pudo copiar.
- Esta regla pertenece al workspace VideoStudio. Stacksync conserva su repositorio y no se reorganiza desde este pipeline.

Esta incorporación organiza los archivos. Las decisiones creativas y las aprobaciones de escenas siguen sus gates habituales.
