# PLAN — el módulo de sonido

> Implementation update19-sep-2026: see PIPELINE-OPERATIONS.md, EDITING_STYLES.md and PIPELINE-WORKFLOW.md for installed contracts and checks. This file retains the original plan; unchecked historical items are not the current status. Native visual/listening review and style-specific pilots remain explicit.

> Doctrina y evidencia: [SOUND.md](SOUND.md). Este archivo es **qué se construye y en qué orden**.
> Escrito el 13-sep-2026. **Nada de esto se construye sin que Walter apruebe las 3 decisiones de §0.**

## El principio, que es el mismo de siempre

> **El determinismo es la feature. Los agentes proponen, los validadores disponen.**
> El sonido entra por donde entró la marca: **como DATO**, no como constante ni como prosa.

Está medido en este pipeline que *toda regla que quedó en prosa se saltó y toda regla que se volvió
código se cumplió siempre*. Las tres reglas de audio que ya existían están en prosa. Por eso el
módulo no es "una biblioteca de sonidos": es **un dato, un emisor y un gate**.

---

## §0 · LAS TRES DECISIONES QUE SON TUYAS (bloquean todo lo demás)

**D1 · ¿Los videos de Moi llevan música?**
El efecto global de música de fondo vs. nada es **r = .03** sobre 97 estudios. No es upside gratis.
Opciones: (a) cama en todos · (b) sólo en el hook y el cierre, hablado en seco · (c) sin cama,
sólo SFX. **Yo recomiendo (b)**: es lo único que aprovecha el silencio como contraste, que es la
jugada mejor sostenida de toda la investigación.

**D2 · ¿`recut.py` deja aire a propósito?**
Hoy comprime el aire de 10,3% a 2,4% y **ningún hueco supera 0,28 s**. Sin aire no hay silencio-como-
énfasis y la cama vive agachada el 97,6% del tiempo. Opciones: (a) se queda como está y el sonido
se adapta · (b) `recut.py` aprende a **preservar N huecos declarados** en el mapa de beats.

**D3 · ¿El vocabulario de SFX se genera o se cura?**
15 sonidos reusados en todos los videos. Generar da variedad; curar da **identidad reconocible y
determinismo**. Yo recomiendo **curar una vez y congelar** — un sonido que cambia cada video no es
una marca. *(La respuesta de licencias de Suno/ElevenLabs está pendiente y puede mover esto.)*

---

## §1 · ARQUITECTURA — cinco capas

```
brands/<marca>.json  ──  "sound": identidad sonora (BPM, paleta, prohibiciones, objetivo LUFS)
        │                 ↑ mismo lugar y misma disciplina que "palette" y "energy"
        ▼
tools/sfx-anatomia.py ──  mide onset · PICO · fin · cola de cada SFX  →  sfx/anatomia.json
        │                 ↑ esto es lo que vuelve CÓDIGO la regla "beat − pico"
        ▼
tools/map-sonido.mjs  ──  BEATS.json + motion.js + paleta  →  master/SONIDO.json  (PROPONE)
        │                 ↑ Walter aprueba, edita, borra. Igual que el mapa de beats.
        ▼
tools/map-sonido --emitir ─ SONIDO.json → <audio> + data-automation + data-fx-carve en el html
        │                 ↑ sincroniza SÓLO lo que le pertenece. Nunca toca contenido.
        ▼
tools/qc-sonido.mjs   ──  el gate. 9 invariantes medibles. Lo que no se pudo medir: NO VERIFICABLE.
```

**El sonido se DERIVA del movimiento, no se coloca a mano.** `design_system/motion.js` ya tiene el
vocabulario de intención (`snap · settle · alive · pop · weight`) con duraciones de resorte en forma
cerrada. Una escena que pide `punch` se gana un impacto; una que pide `breathe` no se gana nada.

---

## §2 · LOS 9 INVARIANTES DEL GATE

Todos medibles. Ninguno es de gusto.

| # | Invariante | Fuente |
|---|---|---|
| **S1** | todo `<audio>` tiene `id` | bug real: sin `id` el render sale **mudo** |
| **S2** | integrado dentro de tolerancia del objetivo · TP ≤ −1 dBTP · **short-term ≤ objetivo +5 LU** | AES TD1004 (norma escrita para ≤60 s) |
| **S3** | todo SFX colocado en `evento − pico` ±1 cuadro, contra `anatomia.json` | medido, no estimado |
| **S4** | la cama ≥ **20 dB** bajo la voz (excepción: golpes de 1–2 s) | WCAG 2.1 SC 1.4.7 |
| **S5** | ningún corte de imagen con intervalo **< 460 ms** | Repp 2006 — piso del sistema visual |
| **S6** | ≤ **5 capas** simultáneas por ventana de 5 s; ≤ 2–3 del mismo color | Murch, *Ley del Dos y Medio* |
| **S7** | todo impacto con energía en **200 Hz – 1,5 kHz** | el parlante del teléfono corta en ~500 Hz |
| **S8** | la cama no pierde > 2 dB al sumar a mono | el iPhone en vertical es mono en la práctica |
| **S9** | todo asset conformado a **48 kHz** antes de tocar el navegador | `decodeAudioData` remuestrea en silencio |

⛔ **Un chequeo que no pudo medir sale `NO VERIFICABLE`, nunca verde.** Ya hay precedente: `validate-kit`
firmaba «VERDE» tras saltarse sus invariantes.

---

## §3 · ORDEN DE CONSTRUCCIÓN

### Etapa 1 — LOUDNESS (independiente de todo lo demás) ⭐ empezar acá
No toca ni una decisión creativa y arregla un problema medido de **8 a 13 dB en todo lo publicado**.

- [ ] `tools/loudness.mjs` — mide I / maxS / LRA / TP de cualquier archivo
- [ ] `--normalizar` — loudnorm de **dos pasadas** con `linear=true` (una pasada bombea y cambia el LRA)
- [ ] objetivo declarado en `brands/<marca>.json`, no tecleado
- [ ] invariante **S2** en el gate
- [ ] pasar los 4 masters ya entregados y medir el antes/después

**Se entrega solo. Si el resto del plan muere, esto ya pagó.**

### Etapa 2 — LA ANATOMÍA (vuelve código la regla que está en prosa)
- [ ] `tools/sfx-anatomia.py` — envolvente RMS a 10 ms → onset · pico · fin de evento · cola
- [ ] `sfx/anatomia.json` como contrato, regenerable
- [ ] marcar **cola muerta** (>1 s) — `riser` trae 5,87 s de cola que su propio manifiesto ignora
- [ ] invariante **S3**

### Etapa 3 — LA IDENTIDAD SONORA (el dato)
- [ ] bloque `sound` en `brands/<marca>.json` — BPM, paleta por intención, prohibiciones, objetivo
- [ ] `brand.mjs sound <marca>` lista y valida, igual que `brand.mjs tokens`
- [ ] ⛔ prohibición dura: **cama con voz cantada bajo guion hablado** (Salamé & Baddeley)
- [ ] curar y congelar los ~15 sonidos *(depende de D3)*

### Etapa 4 — EL MAPA
- [ ] `tools/map-sonido.mjs` — propone desde `BEATS.json` + intenciones de `motion.js`
- [ ] `--check` — el contrato, con la misma disciplina que `seam: null`
- [ ] `--emitir` — escribe `<audio>` + automatización + carve. **Nunca toca contenido de escena.**
- [ ] invariantes **S1 · S4 · S5 · S6**

### Etapa 5 — LA CAMA
- [ ] decidir proveedor *(bloqueado por la investigación de licencias)*
- [ ] **encargar el BPM, no detectarlo** — la grilla de compases sale por construcción
- [ ] fallback para música ajena: `beat_this` en `~/.beats/venv` (downbeat F1 78,3 en GTZAN)
- [ ] usar el `carve.mjs` de HyperFrames — ya implementa la jugada de DPA, no reescribirlo

### Etapa 6 — EL CARRIL KIT
En KIT no podemos mezclar: Walter edita en CapCut. El entregable es **los archivos + la tabla de
colocación con `start = beat − pico` ya calculado**, igual que `validate-kit --tabla`.
- [ ] sección de sonido en el `KIT_README`, **generada, nunca tecleada**

### Etapa 7 — EL FLUJO
- [ ] paso de sonido en `flujo.mjs` (entre C7 lock y C8 gates)
- [ ] ⛔ **sin esto el módulo es prosa** y se salta, como se saltó todo lo que quedó en prosa

---

## §4 · LO QUE NO SE AUTOMATIZA

Va acá para que ningún agente lo intente: si el video necesita música · cuál beat carga el giro ·
dónde cae el silencio · si el sync apretado lee como diseño o como Mickey Mousing · **el 74% de la
Regla de los Seis** (Emoción 51% + Historia 23%; Ritmo es el 10%).

**El mapa y el sign-off son de Walter.** El módulo gatea *colocación*, no *gusto de muestra* —
Chion: *"para un plano de un martillo, cualquiera de cien sonidos sirve."*
