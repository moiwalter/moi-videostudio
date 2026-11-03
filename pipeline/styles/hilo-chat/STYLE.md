# Hilo de chat con video adentro

Un hilo de chat ocupa toda la pantalla y cada beat es un **video-mensaje** dentro de una burbuja, con el texto abajo,
timestamps corriendo y checks. Desarmado de un reel de 522K likes (12-ago-2026) y producido como la serie de Telegram
de Christian × Maria la del Valley (v1 aprobada por Christian: «realmente genial»).

## El contrato
- **Es un collab por naturaleza:** un lado confiesa o pregunta, el otro dictamina. Lo que hace o rompe el video es que la
  segunda voz **dictamine**, no que informe.
- **Un episodio es un archivo de datos** (`beats.js`); la máquina se reusa entre episodios.
- Medidas de la referencia: 1080×1920, ~24 mensajes en 66 s (≈2,7 s por beat), adjunto al 62 % del ancho, recorte ~3:4.
  El hook es el mensaje #1, sin título aparte.
- **La ficción es explícita**, nunca escondida.
- El brief decide si el video sale del chat: el episodio de agosto nunca salió; 0910 pidió video a pantalla completa por
  unas frases y volver al chat.

## Por dónde empezar
- Desarme y reglas de producción: `second-brain/02-projects/cvander/workflow/formato_hilo_chat.md`.
- La máquina: `proyectos/cvander/cvander-telegram/edicion/` (HyperFrames). `ESTADO.md` es lo primero que se lee.
