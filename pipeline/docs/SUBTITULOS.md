# Los subtítulos NO se hacen acá

Van con **`~/Downloads/Personal/moi/caption-kit/`**, que corre sobre el skill
`embedded-captions` de HyperFrames (motor Cinematic).

```bash
bash ~/Downloads/Personal/moi/caption-kit/caption.sh <corte.mp4> <proyecto> --em "dos,palabras"
bash ~/Downloads/Personal/moi/caption-kit/alpha.sh   <proyecto>      # → el .mov para CapCut
```

El 12-ago-2026 se empezó un compilador propio dentro de `video-edit/tools/` y
Walter lo corrigió: **esto va con el sistema de HyperFrames, no con una
herramienta paralela.** Ese compilador se retiró; no rehacerlo. Las reglas del
look, medidas sobre videos reales, están en `caption-kit/README.md`.

`video-edit/` sigue siendo el pipeline de OVERLAYS gráficos (el kit de escenas
para CapCut). Los subtítulos son otra capa y otro sistema.

---

## Master con gráficos → el flujo completo (17-ago-2026)

El kit asume un talking-head limpio. Un master de `video-edit` tiene gráficos en
la banda del plano, y ahí el subtítulo aterriza encima. La regla de Walter:
**si es gráfico o takeover, no va subtítulo.** Las ventanas NO se teclean:

```bash
V=$(node tools/qc-master.mjs <slug> --solo banda --ventanas)   # las MIDE
bash ~/Downloads/Personal/moi/caption-kit/caption.sh \
     <slug>/master/renders/<slug>-master.mp4 <proyecto> --style doac-moi \
     --em "palabras,calientes" --sin "$V"
bash ~/Downloads/Personal/moi/caption-kit/burn.sh <proyecto>
```

Tres cosas que costaron una mañana y ya están resueltas dentro:

1. ⛔ **No se filtran palabras antes de compilar.** `make-cinematic` exige
   VERBATIM y `check-timing --strict` exige ≤80 ms entre palabra y página.
   Filtrar rompía el primero; recortar bordes rompía el segundo (una página
   quedó 1,98 s tarde). **Un subtítulo desincronizado es peor que uno ausente.**
   Se autoriza todo y se borran PÁGINAS enteras después.
2. ⛔ **Decide la VOZ, no la caja de la página.** Borrar toda página que solapara
   la ventana se llevaba diálogo dicho fuera del gráfico. Se borra sólo si la voz
   cae adentro; las páginas cortan en el borde para que ninguna quede a caballo.
3. ⛔ **Reservar la banda es más barato ANTES.** El gate `banda` de `qc-master`
   avisa en la escena 1. En `tu-carrera` se descubrió al final: 10 escenas ya
   construidas invadiendo el carril.
