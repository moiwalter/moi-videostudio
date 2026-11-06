# Portadas — el pipeline

**Una herramienta, un estado, un lugar.** Hasta el 25-oct-2026 el método estaba repartido entre un WORKFLOW del vault,
4 lecciones y carpetas distintas por video (`frames/`, `v3/`, `refs/`, `opciones-v2/`…). Ahora:

| Qué | Dónde |
|---|---|
| La herramienta | `tools/portada.sh <proyecto> <paso>` (→ `pipeline/tools/portada.py`) |
| La spec de la marca (paletas, tratamientos, zona segura, prompt) | `pipeline/portadas/<marca>.json` |
| Referencias de estilo fijas | `pipeline/portadas/referencias/<marca>/` |
| Logos oficiales (compartidos entre videos) | `biblioteca/logos/<id>.jpg` + `FUENTES.json` (de dónde salió cada uno) |
| El estado de UNA portada | `proyectos/<cliente>/<video>/portadas/PORTADA.json` |
| La entrega | `portadas/portada-final.png` + `entregas/<video>-portada.png` |

## Los pasos

```
tools/portada.sh <proyecto> init     --tag "…" --lineas "LÍNEA 1|*LÍNEA DE ACENTO|LÍNEA 3" --logos id1,id2
tools/portada.sh <proyecto> cuadros  --clip <video> --desde 5 --hasta 9 --paso .25
tools/portada.sh <proyecto> foto     --clip <video> --t 8.0
tools/portada.sh <proyecto> fondos   [--opciones lila:color,morado:grieta,crema:bloque]
tools/portada.sh <proyecto> editar   C "cambia sólo el fondo a lila como A" [--como C2]
tools/portada.sh <proyecto> componer [--escala 1.0]
tools/portada.sh <proyecto> elegir   C2
tools/portada.sh <proyecto> estado
```

1. **init.** El texto es el que dicta Walter o Chris, **exacto**. El paso falla si dice «IA» (L039: siempre «AI») o si falta
   un logo en `biblioteca/logos/`. Los logos no se generan nunca: se bajan de la fuente oficial y se anotan en `FUENTES.json`.
   Jerarquía por sentido (L041): el `*` marca la línea de acento, que es la que pasa (el verbo, la cifra), y va enorme.
2. **cuadros.** Hoja con los cuadros numerados por segundo. Se elige a ojo: sonrisa o cejas arriba, con la cara algo
   lejos del lente, porque el gran angular de cerca lo envejece (L041). Si Walter señala un plano, se barre ESE plano.
3. **foto.** Extrae el cuadro, lo recorta con `hyperframes remove-background` y limpia el borde (el recorte arrastra el
   color del fondo en el pelo). **Es la foto real: el generador nunca dibuja a Chris** (L055).
   **Antes, medir el clip:** con ≤720 px de ancho (WhatsApp da 576×1024) el cuadro no sirve para portada; agrandado queda
   blando. Se usa un recorte nítido ya aprobado de esa persona, con el mismo encuadre. Si `remove-background` se trae
   el fondo (un edificio, una pared), recortar con BiRefNet-portrait (`rembg`). (L060; la foto concreta de Chris que se
   usa en ese caso está en las lecciones de cvander.)
4. **fondos.** Codex genera en paralelo **el diseño SIN persona**: patrón, tag, titular y chips, con la mitad de abajo
   libre. Cada opción = paleta × tratamiento del acento, que son **direcciones distintas, no 3 colores** (L050). Las
   referencias se arman solas: las fijas, las **2 últimas portadas entregadas** de la marca (L041), en JPG chico (un PNG
   pesado tira «network error») y los logos. Codex corre con `stdin` cerrado o se cuelga (L050).
5. **editar.** Cuando Walter pide «la C pero con X», se hace una **edición fiel** del fondo de C, no una regeneración:
   nace la opción C2 y C queda intacta.
6. **componer.** Mide dónde terminan titular y chips (en la franja central) y pega a Chris con la cabeza 25 px debajo.
   La escala es uniforme, **1:1 por defecto**: Chris queda cerca, cara grande, y la chaqueta llega a los bordes sin
   inventar nada (L054). Arma la hoja `opciones.jpg` con las letras. **La hoja se mira de verdad antes de mostrarla.**
   Avisa si la cabeza arranca por debajo de y=1100 (titular demasiado largo, la cara sale de la zona segura).
7. **elegir.** Copia la elegida a `portada-final.png` y `entregas/`, y archiva el resto en `portadas/archivo/`. Hay una
   sola versión activa, y `PORTADA.json` dice cuál es (`aprobada` / `descartada`).

## Lo que no se hace

- Tarjeta HTML hecha a mano o el video de fondo con velo (5-oct: «no hacemos eso así»).
- Fotograma borroso como fondo de pantalla, o un retrato chico dentro de un recuadro (L041).
- Dejar que el generador redibuje a Chris: le ensancha el cuerpo («es muy gigante», L055).
- Fundir los costados del selfie («muy pele»). Si a escala 1:1 no alcanza, se completa sólo lo que falta fuera del
  cuadro (outpaint) y la foto real va encima.
- Recomponer una portada ya entregada porque la herramienta cambió: lo entregado se lee, no se edita.

## Agregar otra marca

Copiar `pipeline/portadas/cvander.json` a `<marca>.json` (paletas, tratamientos, prompt y zona segura de esa marca),
poner sus referencias en `pipeline/portadas/referencias/<marca>/` y pasar `init --marca <marca>`.

## Historial

- 25-oct-2026: nace, con la portada de Cloudflare Connect («LA SEMANA QUE SE ROMPIÓ INTERNET», opción C2 = bloque violeta
  sobre lila). Reprodujo la portada aprobada píxel a píxel antes de ajustar la medición del borde de los chips.
