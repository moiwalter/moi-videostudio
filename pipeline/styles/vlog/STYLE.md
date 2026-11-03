# Vlog de evento (recap)

Para cuando la persona fue a un evento y hay **muchas tomas del mismo evento** (celular, de ella y de otros) más material
de afuera. La base es su voz, grabada aparte; las tomas se cortan al golpe de esa voz. Walter (2-nov-2026): «tiene muchas
tomas del mismo evento… también lo ayudamos con videos externos, es como un blog recap».

Primer video: **Cloudflare Connect** de Christian (`proyectos/cvander/2026-10-cvander-cloudflare/`), entregado el 25-oct.
Chris: «El video está buenísimo. Realmente bueno».

## El contrato
- **La voz manda**: los cortes de las tomas caen en el golpe de la voz.
- **Lo que las tomas no muestran lo pone el material de afuera**: keynote oficial, archivo (la salida a bolsa), y notas
  reales capturadas en vertical como pantalla de celular (`capturar-noticia.py`), nunca retipeadas.
- **Swipe de TikTok** entre notas: la actual sale por arriba y la siguiente entra pegada desde abajo; ya posada, la página
  sigue subiendo despacio.
- **Un tramo puede cambiar de tono** (en Cloudflare, el hacking: «súper cibernético, como programar se acabó»), con su
  color, su sonido y una entrada y una salida claras. Después vuelve el tono vlog.
- **Un solo grade para todas las tomas**: tomas de celulares distintos tienen que leerse como un solo evento.
- **Los datos se verifican antes de escribirlos.** Lo que no se puede confirmar queda como footage, sin nombre ni logo
  (World y Pablo de Guatemala en Cloudflare).

## Escenas y perillas (medidas el 2-nov-2026)

| Escena | Qué se ve | Ejemplos (cloudflare) |
|---|---|---|
| **hook** | Una toma cruda con su audio; después entra la voz | S01 |
| **vlog** | Tomas del evento cortadas al golpe de la voz | S02 · S10 · S17 |
| **nota** | La página real de la noticia, como pantalla de celular | S12 · S13 |
| **tono** | Tramo con otro mundo visual y sonoro | S03–S07 |
| **archivo** | Keynote oficial, archivo | S19 · S20 |

Perillas en `style.json`, cada una con dónde se midió: hook 8,9 s · mediana de escena 4,58 s · tramo de tono 26 % ·
swipe 0,36 s · deriva de la nota 70 px · color comercial limpio · subtítulos 66 px centrados en la zona segura.
Con un solo video medido, se revisan cuando haya un segundo vlog aprobado.

## Por dónde empezar
Copiar la máquina de `2026-10-cvander-cloudflare/edicion/master/` (`build.py` → `plantilla.tpl`, `SONIDO.json` →
`tools/score_cf.py` para música y efectos). El paso a paso de cada ronda está en su `CONTEXT.md`.
