# Mensaje para propagar el fix a otros proyectos con el mismo motor

Copiá y pegá esto en cualquier sesión de Claude Code que trabaje con overlays alpha
(HyperFrames / Remotion / cualquier render con canal alpha que termine en CapCut).

---

**BUG CRÍTICO en cualquier overlay alpha que vaya a CapCut — aplicalo a este repo.**

CapCut compone el ProRes 4444 asumiendo alpha **PREMULTIPLICADO (asociado)**. HyperFrames —y los renders de navegador en general— producen alpha **STRAIGHT (no asociado)**. Con esa mezcla CapCut hace:

```
lo que hace CapCut:  out = RGB   + BG*(1-A)     ← suma
lo correcto:         out = RGB*A + BG*(1-A)     ← mezcla
```

**Síntoma:** todo píxel de alpha parcial revienta a blanco. Un glow radial sale como mancha/elipse de **borde duro**, el borde antialiaseado del texto como nube brillante, y sobre fondo negro como nube gris. **Lo opaco (A=1) sale perfecto** — por eso el defecto se disfraza y parece "un problema del glow" o "un bug de CapCut".

**Trampa de diagnóstico:** compositar el clip localmente con ffmpeg SIEMPRE se ve bien, porque ffmpeg compone correcto. El único oráculo válido es una captura del NLE. No se juzga sobre fondo negro: el negro esconde el defecto por definición.

**El arreglo es un transcode, no un re-render.** Guardando `RGB' = RGB*A`, la cuenta de CapCut se vuelve la correcta:

```bash
ffmpeg -y -i in.mov \
  -vf "format=gbrap12le,premultiply=inplace=1,format=yuva444p12le" \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p12le -alpha_bits 16 -vendor apl0 \
  out.mov
```

**Qué hacer en este repo:**

1. Encontrar dónde se renderiza/exporta el alpha (busca `--format mov`, `prores`, `yuva444`, `alpha:true`).
2. Agregar el paso de premultiply **al final de ese script**, para que ningún `.mov` salga sin pasar por ahí.
3. Convertir los clips ya exportados (in-place, guardando backup `.straight.mov` — otros NLE como Resolve/Premiere/AE sí esperan straight).
4. Documentarlo como regla dura en el README/playbook del repo, no solo en un commit.

**Verificación objetiva** (en un frame con material semitransparente — un glow, texto, un borde suave; NO uses un frame donde todo sea opaco o no vas a reproducir nada):

decodificá a RGBA y medí el percentil 99 de `max(R,G,B)/A` sobre los píxeles con `0.08 < A < 0.75`:
- **≈ 1.0** → premultiplicado, correcto para CapCut
- **>> 1** (típico 4–12) → straight, se va a ver roto

En premultiplicado el color ya viene multiplicado por el alpha, así que `RGB` nunca puede superar a `A`. En straight, un dorado al 20% de alpha da `RGB≈0.97, A=0.20` → ratio 4.8. Esa es la prueba que separa los dos casos sin ambigüedad.

**Reglas de estética que salieron del mismo diagnóstico** (ya no son bugs, pero valen para overlays sobre footage claro):
- Sombra oscura: radio ≤ 8px. Una sombra de 44–80px es una mancha, no una sombra.
- Separar cards con **rim claro** (`inset 0 0 0 3px rgba(...,.16)`), no con sombra grande.
- Card oscura: opacidad ≥ .92, o se ve el footage a través.
- Texto: **contorno tight** (offsets de 2px), no halo de 14–34px.
- **Un `text-shadow` borroso NO es un glow** — sobre tipografía display genera una copia difusa por glifo (nube grumosa). Un glow es un `radial-gradient` DETRÁS del texto con el color del acento y `alpha→0`.
- **Las sombras animadas desde GSAP pisan el CSS.** Si linteás solo el CSS, el bug vuelve al reproducir la animación. Ninguna sombra se anima desde JS: se anima la opacidad de una capa de glow aparte.

---

**Herramientas listas para copiar** (de `~/Downloads/Personal/moi/video-edit/tools/`):
- `premultiply.sh` — el transcode, in-place con backup
- `alpha-qc.py` — lint de CSS+JS (aborta el render) + contact sheet negro | blanco | footage real

Referencia completa: `~/Downloads/Personal/moi/video-edit/SCENE_PLAYBOOK.md` §3b.
