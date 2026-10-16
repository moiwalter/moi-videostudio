# PENDIENTES — sistema de talking-head

Última actualización: 8-ago-2026.

## Necesitan un corte real con audio (hoy no hay ninguno en disco)

1. **`SS=2` vs nativo.** `final.sh` renderiza nativo 1080×1920 por default; `SS=2` supersamplea
   (2× lineal = 4× píxeles) y baja con lanczos. La pregunta abierta es si en hairlines de 1px y
   texto chico se nota. **Se decide comparando en el navegador, no discutiéndolo:** renderizar la
   misma escena de las dos formas y mirarlas al lado.

2. **`transcribe` en español.** El CLI de HyperFrames trae `transcribe`, pero su default es
   `small.en` (**inglés**) y de los modelos disponibles solo `large-v3` es multilingüe → para
   español van `-m large-v3 -l es`. **Sin verificar contra whisper.** Hasta que se compare en un
   corte en español, el respaldo documentado sigue siendo whisper.

## Necesitan un video real

3. **`build-kit` con agentes sobre un video de verdad.** El 8-ago-2026 corrió por primera vez
   sobre el `_fixture` y el loop de auto-corrección funcionó (intento 1 rebotó en G1 `check`,
   intento 2 pasó los cinco gates; el agente respetó §3c: cero propiedades prohibidas animadas,
   sin `transform` en CSS, 23 usos de tokens, duración exacta al beat). Lo que falta es volumen
   real: un corte tuyo, 15–25 escenas, y ver cuántas quedan BLOQUEADAS después de 3 intentos.
   Cada escena es una corrida de agente con hasta 3 reintentos — el costo escala lineal.

4. ~~**El armado del master desde acá**~~ ✅ **HECHO el 13-ago-2026** — pero no como decía acá.

   Se construyó en `2026-08-que-es-startup/master/`: **una sola composición** con el footage como
   `<video>` en la pista 0, su `<audio>` aparte, las 19 escenas como clips encima y el zoom
   animado sobre un wrapper `#cam` **sin temporizar**. No hizo falta `armar.mjs` ni volver
   `footage` un tipo de primera clase: al entrar el video a la composición, **el master ES la
   composición** y `scenes/` + los alpha + el premultiply + el `KIT_README` **salen del camino
   entero** para video propio. (Siguen valiendo para lo que Walter arma él en CapCut: sponsored.)

   Dos cosas que este pendiente predecía mal:
   - **"scale 1.00 → 1.03 en toda la escena"** es demasiado poco y además la idea equivocada.
     Lo que funciona es **una escala distinta por escena** (1.00–1.17) con in/out/fija alternados:
     el valor del zoom no es el movimiento, es que **el corte entre dos escalas lee como segunda
     cámara**. Un 1.03 parejo en todo el video es invisible.
   - **"el armado va ÚLTIMO, después de la aprobación por escena"** — al revés. Con el master en
     el navegador, aprobar por escena aislada dejó de tener sentido: se revisa el video entero
     corriendo y se corrige la escena que falle. Es más barato y es lo que Walter pidió
     explícitamente (*"que puedas hacer cambio de sólo las escenitas que te diga"*).

   Lo que sí quedó pendiente: **el zoom todavía no está declarado en ningún `meta.json`** ni lo
   verifica un gate. Hoy vive en las llamadas a `MOI.camera` del `index.html` y en `ESCENAS.md`.
   Si un día hay tres videos así, ahí sí conviene el contrato.

## Deuda conocida que se deja así a propósito

- **35 escenas publicadas, 29 fallan `hyperframes check`** (10× `gsap_non_transform_motion`,
  4× `gsap_css_transform_conflict`, el resto contraste). Se publicaron y se veían bien: son
  clases de defecto que antes eran invisibles. **No se tocan** — la lección quedó encodeada en
  `SCENE_PLAYBOOK.md` §3c y en el prompt del agente, para que no haya diez más.
- **Escenas viejas con hex literales** (1.062 colores, cero tokens). Las nuevas nacen con tokens
  vía `new-scene.sh`; migrar las viejas es tocar videos publicados.
- **`2026-08-dos-puertas`** es del carril retirado: `scenes/` vacío, `index.html` monolítico y
  seis scripts copiados adentro. Autocontenido y funcionando. No se migra.
