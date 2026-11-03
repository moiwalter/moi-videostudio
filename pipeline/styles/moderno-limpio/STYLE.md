# Moderno limpio

Estilo de edición tomado de dos reels de Nick Saraev y uno de Milad Aslani (nombre de Walter, 31-oct-2026), con cine y
archivo que un techie reconoce y tweets reales. Primer video: «optimismo» de Christian, r4 aprobado por Walter («perfecto»).
Sirve cuando el video admite muchos recursos.

## El contrato
- **La persona está siempre**: placa recortada o pantalla completa. La cabeza recortada rompe el borde de su placa
  (profundidad). El fondo oscuro es el recurso desenfocado.
- **Recursos por lo que se ve MUDO en 2 s**, no por lo que dicen. Pocos, cada uno ≥2,5–3 s, animaciones lentas.
  Buscar primero en `biblioteca/documental/` (`catalogo.json` + `buscar.py`, campo `lectura_visual`).
- **Tweets = embed oficial capturado** (`tools/capturar-tweet.py`), nunca retipeados ni con frases de otro artículo.
  Entran enteros, respiran ~1 s, la cámara baja a la frase sin cortar un costado y el marcador avanza palabra por palabra.
- **Nunca dos recursos superpuestos en el mismo lugar** (da doble exposición): barrido, o uno sale y después entra el otro.
- **Premium sin flash**: cámara que respira, foco, sombras en capas, reflejo de vidrio, rastro de luz en los barridos.
  Filtro nostálgico sólo en archivo y cine; el grano como **capa CSS**, nunca horneado.
- **La voz aprobada no se estira** para que se lea: se recorta o se agranda el recurso.
- Audio: WAV de 16 bits (Studio no decodifica 24); voz con denoise suave, −16 LUFS.

## Escenas y perillas (medidas el 1-nov-2026)

Medidas en un solo video aprobado, optimismo (r4 + cambios de Chris). Con un segundo video aprobado se revisan.

| Escena | Qué se ve | Cuándo | Ejemplos (optimismo) |
|---|---|---|---|
| **hook** | Recurso arriba, título grande en la unión, Chris en su placa; completo desde el cuadro 0 | La tesis, en sus palabras | hook |
| **placa** | Ventana con el recurso (tweet, clip, foto) y Chris recortado abajo | Nombra algo que se puede mostrar (la de siempre) | ansiedad · nadie · sf |
| **completo** | Chris a pantalla completa, subtítulos de 70 px | Respiro entre bloques, opinión, golpe | sf0 · olvida · fuck · enjoy |
| **grande** | Ventana grande o pila de pantallas, Chris fuera ≤ 4,5 s | Ráfaga que necesita toda la pantalla | lideres |
| **blanco** | Fundido a blanco con capturas reales de producto | Nombra herramientas concretas | herramientas |

Las perillas (hook 3,9 s, mediana de escena 3,08 s, recurso mínimo 2,5 s, persona fuera ≤ 4,5 s, placa .72, ventana
1000×720, respiro y acercamiento del tweet, barrido, subtítulos 62 px centrados) están en `style.json`, cada una con dónde
se midió. `node tools/capas.mjs <proyecto>` muestra el valor final y de qué capa salió.

## Bugs ya resueltos en el template
Guardián de visibilidad por cuadro (Studio revierte mal los `set()` al saltar atrás), estado inicial fuera del timeline,
apagar los `<video>` de una ventana oculta, y no usar el Limiter de pedalboard como techo.

## Por dónde empezar
- Copiar el template: `proyectos/cvander/2026-10-cvander-optimismo/edicion/moderno/` (regenerar: `tools/build.py` →
  `tools/sfx.py` → `tools/musica.py` → render). Aprendizajes: `APRENDIZAJES.md`; desarme de las referencias:
  `../referencias/EDICION-REFERENCIAS.md` de ese proyecto.
- La tipografía y los colores son los de la marca; los tweets y terminales conservan su letra porque son capturas reales.
