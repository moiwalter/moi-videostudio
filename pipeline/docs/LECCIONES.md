# Lecciones — la bitácora

> Lo que pasó en un video y **todavía no es regla**. Lo ya aprendido vive en [REGLAS.md](REGLAS.md) (V01–V29); las
> reglas de una persona, en `biblioteca/clientes/<cliente>.json`. Hasta el 1-nov-2026 este archivo tenía las reglas:
> los links viejos a `LECCIONES.md#vnn-…` ahora son `REGLAS.md#vnn-…`.

## Cómo se usa

1. **Cada corrección de Walter se anota acá el mismo día**, con su cita textual y el proyecto. No se escribe una regla
   desde un solo caso.
2. **Se decide a quién le toca:**
   - ¿Cambia cómo se edita cualquier video? → candidata a `REGLAS.md`.
   - ¿Sólo vale para esa persona o serie? → candidata al archivo del cliente.
   - Si tiene las dos mitades, se parte.
3. **Se promueve cuando** Walter la confirma como regla, o la misma corrección vuelve en un segundo video. Al
   promoverla se le da su `Vnn` (o `Cnn` en el cliente), su estado acá pasa a `→ Vnn` y se mira si se puede chequear
   en código.
4. **Si Walter dice «no es regla»**, queda acá con ese estado: es algo que se considera, no algo que se aplica en
   automático.

Formato de cada entrada:

```
### AAAA-MM-DD · <cliente>/<proyecto> · <título corto>
- **Pasó:** qué se hizo y qué dijo Walter (cita textual).
- **Candidata:** la regla que sugiere, en una línea.
- **Para:** pipeline | cliente <id> | las dos
- **Estado:** abierta | → Vnn / Cnn (fecha) | no es regla (Walter, fecha)
```

---

### 2026-10-31 · cvander/2026-10-cvander-optimismo · «Pasa muy rápido»: alargar antes que quitar
- **Pasó:** Walter dijo que todo pasaba muy rápido y se sacaron tweets para dar aire. Walter: «¿por qué redujiste
  tweets? podemos alargar el espacio en el que aparecen en lugar de sólo quitarlos… es que cortan muy rápido».
- **Candidata:** ante «pasa muy rápido», alargar primero (el recurso cubre varias frases, menos cortes a pantalla
  completa, animaciones más lentas); quitar sólo lo que él señale.
- **Para:** pipeline
- **Estado:** no es regla (Walter, 31-oct: «no es regla, pero para esto sí funciona»).

### 2026-11-03 · cvander/2026-11-cvander-preguntale-humano-mario-valle · Los bordes del corte se miden en la onda del ORIGINAL
- **Pasó:** Walter: «en la limpieza recuerda ver las ondas para ser más preciso». Al auditar con la onda aparecieron
  tres errores que el oído no había marcado: (1) 9 de 11 tramos tenían el borde sobre voz porque se habían elegido con
  tiempos de whisper (adelantados): se comía el ataque de «No he probado» y la cola de «tú» en «el producto vas a ser
  tú»; (2) cada pieza de video se redondea al cuadro y `concat` rellena, así que el reloj de `tiempos.json` se corrió
  0,26 s al final, y los cortes de la 2ª/3ª pasada, medidos sobre ese corte, quedaron movidos (uno se comía la «r» de
  «riesgo»); (3) `alinear.py` con el texto entero usa ventanas de 30 s y «Grokbot» (en el borde de 60 s) salió 0,9 s tarde.
- **Candidata:** todo borde de corte se mide en el archivo ORIGINAL (energía + centroide cada 30 ms) y cae en un valle;
  si tiene que caer sobre voz, fundido de 25–40 ms. Cada pieza dura cuadros enteros. La alineación del corte final va
  por bloque (uno por tramo), nunca con ventanas fijas. Un «eeh» se distingue de una palabra lenta por el centroide
  quieto (sd ~150–300 Hz vs >700 Hz).
- **Para:** pipeline
- **Estado:** abierta

### 2026-11-03 · cvander/2026-11-cvander-preguntale-humano-mario-valle · «Bad animations and decisions» tras armar todo de una vez
- **Pasó:** Walter pidió «hazlo de una vez» y se armó el master completo (17 escenas) en una pasada. Correcciones en el camino: título del gancho
  rechazado («no me gusta el título»), faltaba el logo de Claude Code, Mario se veía chico, el tag le tapaba la cara, tomas quietas demasiado tiempo,
  faltaba dinero/trading. Al final: «you are doing bad animations and decisions».
- **Candidata:** (sin causa confirmada por Walter — no inventarla) aun con «hazlo de una vez», mostrar el gancho + 1–2 escenas en el Studio
  antes de extender el tratamiento a las 17 (START_HERE §4.5: «si el hook falla, corregirlo antes de extender»).
- **Para:** pipeline
- **Estado:** abierta — preguntarle qué no le gustó, en concreto.

### 3-nov-2026 · Mario Valle — una miniatura o tarjeta sobre un plano de cara
- **Qué pasó:** Walter: «el episodio de YouTube está tapando la cara de las personas». La miniatura se había revisado en un solo cuadro; los planos del cierre tienen la cara a distintas alturas y todos quedaban tapados.
- **Candidata:** una tarjeta que dura varios planos se verifica contra CADA plano que cruza. Si las caras caen abajo, tarjeta arriba y bajar el video; moverla sobre el mismo encuadre no alcanza.
- **Para:** pipeline
- **Estado:** abierta

### 3-nov-2026 · Mario Valle — «muestra la app» = la app legible, varias veces
- **Qué pasó:** con una sola toma de J Balvin, el teléfono se veía chico. Walter: «pon varios que muestren la app». El canal oficial tenía 6 tomas útiles, recortadas al teléfono.
- **Candidata:** cuando pide ver un producto, revisar el canal oficial completo antes de quedarse con el primer anuncio que lo muestra.
- **Para:** pipeline
- **Estado:** abierta

### 3-nov-2026 · Mario Valle — un snapshot no prueba reproducción en orden
- **Qué pasó:** REVIEW decía «misma transformación» y los snapshots salían limpios, pero el render traía a Mario duplicado y un cuadro negro: dos tweens solapadas sobre `#cam`, y un `filter` animado desde `none` (brightness arranca en 0).
- **Candidata:** tras cualquier composición con cámara + recorte, comprobar el render o la reproducción, no sólo cuadros sueltos. Barrer YAVG cuadro a cuadro para detectar parpadeos. Nunca animar `filter` desde `none` sin declarar el inicio.
- **Para:** pipeline
- **Estado:** abierta
