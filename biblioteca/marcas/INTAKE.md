# INTAKE DE MARCA — qué preguntar antes de animar nada

El video de Christian funcionó porque se hizo sobre SU marca, no sobre la de Moi. Estas son las
preguntas mínimas. Si alguna no se puede contestar, NO se inventa: se pide el asset o se pregunta.

1. **Colores** — ¿cuál es el acento (el color de "esto importa")? ¿la superficie clara? ¿la oscura?
   ¿el positivo y el negativo? Pedir hex, o el CSS de su web, o su manual de marca.
   *De dónde sacarlos sin inventar:* el CSS de su sitio (`--var` o los hex más repetidos), su deck,
   su logo. NUNCA "a ojo" de una captura comprimida.
2. **Tipografía** — ¿display (títulos) y sans (UI)? ¿tienen las licencias/archivos?
   Si no hay, decirlo y proponer un sustituto — no asumir que la que se ve es la que tienen.
3. **Logo** — SVG o PNG con transparencia. Sin eso no hay chip de logo ni lockup.
4. **Energía** — ¿efusiva (overshoot, stamps, punch) o sobria (enterprise, sin overshoot)?
   Es la diferencia entre que se sienta suyo o se sienta de otro.
5. **Prohibiciones** — qué NO se hace nunca con su marca (Moi: sin scrim, sin wipes champán,
   sin escenas de solo texto).
6. **Sponsors** — ¿hay una marca invitada? Sus colores van aparte, no se mezclan con la paleta.

Cuando estén las respuestas: `node tools/brand.mjs new <nombre>` y llenar el JSON.
Después `brand.mjs check <slug> <nombre>` gatea que ninguna escena se salga.
