# Plantilla qmd-vertical

Contrato: `pipeline/styles/qmd-vertical/STYLE.md`. Marca: `biblioteca/marcas/qmd.json`. Piezas: `pipeline/componentes/`.

## Cómo arranca un episodio

1. `pipeline/tools/new-video.sh <slug> --marca qmd --carril master --engine hyperframes --style qmd-vertical`
2. El plan de escenas se escribe y se aprueba **antes** de construir. Un check que pasa no es una aprobación.
3. Copiá `build.mjs` a `edicion/src/build.mjs` del episodio y cambiá las escenas. El generador busca la raíz del repo subiendo hasta `pipeline/styles/qmd-vertical/style.json`. `QMD_MASTER` apunta al master del episodio si no vive en `../master`.
4. Renderizá **dos veces**, 1080×1920 y 1920×1080, con `--video-frame-format png`. El markup es el mismo; los takeovers usan container queries.
5. `node pipeline/tools/perillas.mjs <proyecto> --escribir` y cargá `perillas.js` / `perillas.css` en la composición.

## Generador de referencia

`build.mjs` es el de goldmine v3.3, con las rutas de este repo. No rehace ese video: es la receta. Las escenas, las palabras y los joins de ese episodio siguen adentro; un episodio nuevo los reemplaza.

## Arranque mínimo

`arranque.html` es una composición corta (número, subtítulo, dominio) para `hyperframes check`. En 0.8.214 el check mira `index.html`: se copia ahí. Las fuentes están en `fonts/` (enlaces a `biblioteca/design_system/fonts`). No es un episodio.
