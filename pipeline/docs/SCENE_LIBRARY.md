# Biblioteca de escenas — MOI Overlay Pipeline

**Regla de oro:** cada escena es una **animación con elementos** (íconos, logos, mockups, metáforas visuales que se mueven). El texto va SOLO como etiqueta sobre el elemento. Una escena que es puro texto = subtítulo = no va.

Para cada beat del transcript, elegí el arquetipo cuyo *gatillo* matchea. Buscá siempre el elemento reconocible (logo real, bandera, UI) o la metáfora visual antes que la palabra.

| # | Arquetipo | Cuándo usarlo (gatillo en el transcript) | Elementos / animación |
|---|-----------|------------------------------------------|------------------------|
| 1 | **Hook** | La pregunta/golpe de apertura | Bandera (rojo vivo `#ED1C24`) + pregunta Cormorant gigante + símbolos de dolor. Entra y sale rápido. |
| 2 | **Impostor (Inseguridad)** | Cualquier miedo/objeción/voz interna ("no sabes", "no das") | Fantasma gris que entra, tiembla, se tacha en dorado, hace glitch y **estalla**. Interrupción recurrente entre escenas. |
| 3 | **Term-brand / título** | Cuando se nombra un concepto ("a esto le llamo…") | Pill navy con la palabra en oro, `pop()` con back.out. |
| 4 | **Stat-compare (brecha)** | Comparar dos números (sueldo local vs afuera) | Dos cajas (cream vs navy) con **count-up** (separador de miles), tachón rosa sobre el menor, flecha + **"10×"** surge. |
| 5 | **Authority / credencial** | Por qué TÚ tenés autoridad | Card + placas con **logos reales** (Startupeable, Silicon Valley). Las placas se deslizan. |
| 6 | **Mechanism** | Explicar un cómo-funciona simple | Ícono con micro-animación (dolor → moneda). |
| 7 | **Map** | "dónde están" / geografía | Mapa navy + puntos dorados que **brillan en stagger** + punto blanco "Tú · [país]". |
| 8 | **Logo-chips / roles** | Lista de cosas, herramientas, puestos | Chips cream con ícono/logo, entran en **stagger** desde la derecha. |
| 9 | **Lever / puerta** | Una barrera que en realidad es palanca (inglés, miedo) | Puerta navy que **se abre** (scaleX), pomo que desaparece. |
| 10 | **VS-cards** | Contraste malo vs bueno (CV vs prueba, experiencia vs ganas) | Card gris ✗ vs card oro ✓, marcas que hacen pop. |
| 11 | **Platform logos** | Nombrar plataformas/empresas reales | Chips con **logos** (YC, Wellfound, Get on Board, Wallbit…). |
| 12 | **Web-mockup 3D** | Mencionar una web/recurso | Navegador **tilteado en 3D** (perspective) + screenshot real **scrolleando** + pill de URL. Screenshot va en `assets/`. |
| 13 | **Lost-in-pile** | "se pierde entre muchos" (CV en el montón) | Tu doc **dorado con tag "TÚ"** entre ~35 docs grises; el anillo dorado se apaga y **se pierde**. |
| 14 | **Queue vs shortcut** | Hacer la fila vs saltarla | Docs en fila con ✗ + **avioncito** que vuela y entra por la puerta del fundador. |
| 15 | **Numbered-step** | Cada paso de un método (1 escena por paso) | Badge dorado con número + ícono/logo + texto Cormorant + subtexto mono. |
| 16 | **Flow / pipe** | Cómo se mueve el dinero/algo de A a B | Nodos con **banderas** + logo (Wallbit) + **moneda que viaja** por la línea. |
| 17 | **Checklist** | Cómo validar / señales (estafa sí/no) | Filas con ✓ verde y ✗ rosa, entran en stagger. |
| 18 | **Giveaway** | Regalar algo / sorteo | **Siluetas** (personas) que reciben **monedas doradas** cayendo + monto. |
| 19 | **CTA** | La acción + cuándo (en vivo, fecha, hora) | Card navy + **logo** + acción ("Comenta tu X") + kicker con fecha/hora. |
| 20 | **UI-mockup fiel** | Simular enviar mensaje / un comentario | Réplica **fiel** de la UI real (LinkedIn DM azul `#0A66C2`, comentario social) con burbuja, botón "Enviar", corazón. |
| 21 | **Building-growth** | Definir/“qué es” algo que crece (startup) | Edificio navy que **crece** desde el suelo + ventanas que encienden + flecha verde. |
| 22 | **Closing-analogy** | El reframe final / transformación | Metáfora (avión ✗ → laptop ✓) + frase Cormorant + **QR** al recurso. |

### Cómo interpretar un transcript en escenas (10–12+)
1. Leé el transcript y partí en **beats**: cada idea, dato, objeción, paso, ejemplo o cambio de tema = un beat.
2. A cada beat asignale el arquetipo cuyo gatillo matchea. Si no hay metáfora obvia, **inventá una visual** (no caigas en texto).
3. Maximizá el conteo: un método de 3 pasos = **3 esconas** (una por paso) + 1 título. Una comparación = VS-cards. Un dato = stat-compare.
4. Intercalá el **impostor** en cada miedo/objeción que aparezca en el transcript.
5. Usá **logos/banderas/UI reales** siempre que el beat nombre una empresa, herramienta, país o acción de plataforma.
6. Salida: 1 clip transparente por escena, nombre kebab-case descriptivo, numerado en orden narrativo.

> Implementación de referencia completa (todas estas escenas, funcionando): `../wallbit-video/overlays/index.html`.
