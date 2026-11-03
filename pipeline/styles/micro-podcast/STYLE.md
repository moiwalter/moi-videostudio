# Micro-podcast (conversación a distancia)

Quien conduce manda preguntas por escrito, **se graba preguntando**, y el invitado **graba su respuesta aparte**.
Llegan dos o más videos verticales sueltos que tienen que sentirse como una conversación. Nació con
«Pregúntale a un humano» de Christian (ep01 entregado 16-oct-2026, ep02 publicado 31-oct). Sirve para cualquier
marca que entreviste a distancia.

## Lo que hace que funcione
- **El que escucha nunca está congelado.** Mientras uno habla, el otro aparece *escuchando*: un clip generado
  (Higgsfield → Kling 3.0) desde un cuadro real con la boca cerrada, revisado en hoja de contactos para que no
  «hable», y alargado con ida y vuelta.
- **Varias composiciones mezcladas** en un mismo episodio (Christian no quiso una sola): tercios, la llamada, la caja de
  prompt, en paralelo, pregunta fija, carta. El catálogo visual de las 21 escenas y 22 transiciones del ep01 está en
  `templates/micro-podcast/catalogo-ep01/index.html`.
- **El invitado entra con autoridad verificable** ([REGLAS V19](../../docs/REGLAS.md#v19--el-invitado-se-presenta-con-autoridad-verificable)).
- **Cada unión es una decisión** (V21, `templates/transiciones-corte.js`): el cambio de persona lleva la transición más fuerte, dentro de la toma de quien conduce una más suave, y dentro de la respuesta del invitado **corte seco** por defecto (Walter, ep02 31-oct: quitó «los zoom-blur entre cortes de Victoriano»). Perillas `transicionCambioPersona` · `transicionDentroConductor` · `transicionDentroInvitado`.
- **Audio nivelado por persona** antes de normalizar (V07, `tools/nivelar-voces.py`).
- Hook: los tres elementos a la vez (tarjeta arriba · título al medio · persona abajo), sin subtítulos durante el hook.

## Lo que pone cada marca
La intro de la serie, el tag, la paleta, las fuentes, los subtítulos y las reglas de texto (en Cvander: «AI», nunca «IA»)
salen de la marca y de su serie. Una intro de serie se reusa TAL CUAL (V20) y va sin sus SFX dentro del episodio.

## Por dónde empezar
- Kit para copiar: `templates/micro-podcast/` (`LEEME.md` dice qué cambiar en cada archivo).
- Paso a paso probado (20 pasos, de WhatsApp a CapCut): `second-brain/02-projects/cvander/workflow/micro_podcast.md`.
  Es la versión de Christian; para otra marca, cambiar intro, tag, marca y cobro.
- Referencia nativa: `proyectos/cvander/2026-10-cvander-preguntale-humano-ep01/edicion/master/index.html`.
