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
