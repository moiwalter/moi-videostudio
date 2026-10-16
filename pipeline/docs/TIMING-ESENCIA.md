# El timing — la esencia, para cualquier video

> **Para quién:** un agente que va a editar o animar un video de cualquier formato (explainer, voz en off, ad, deck animado, talking-head). Explica **por qué** cuidamos el timing, **qué queremos lograr** y **cómo funciona**.
> **Origen:** las revisiones de Walter en videos de Moi y de Christian (sep–oct 2026). El método completo aplicado a talking-head está en [SEGMENTAR-POR-IDEAS.md](SEGMENTAR-POR-IDEAS.md). Este documento es lo que sobrevive en cualquier formato.

## La idea en una frase

**La imagen interpreta lo que se dice, en el momento en que se dice.** No es decoración que acompaña al audio. Es una segunda lectura de la misma frase, y por eso tiene que llegar al mismo tiempo que la frase.

## Por qué importa tanto

Quien mira no ve el audio y la imagen por separado: los junta. Cuando coinciden, el video se siente inteligente, como si la imagen *entendiera* lo que se dice. Cuando no coinciden, pasan dos cosas:

1. **Nadie lo nombra como "sincronía".** En el video de Christian "programar como profesión", las animaciones iban hasta 3 s adelantadas y el desfase cambiaba por tramo. Walter no dijo "está desincronizado". Dijo: *"la última parte no interpreta lo que dice"*. Un timing malo **se siente como que el video es tonto**, no como un error técnico. Por eso no se corrige con feedback de "muévelo un poco": hay que medir.
2. **Se pierde la atención.** Si la imagen se adelanta, revela lo que todavía no se dijo y mata la curiosidad. Si se atrasa, la frase ya pasó y la imagen llega a explicar algo viejo. En ninguno de los dos casos la imagen suma.

Lo que queremos: que cada cosa que aparece en pantalla **se gane su lugar** porque dice algo de esa frase, en ese segundo.

## Cómo funciona

### 1. Un solo reloj: el audio final

Todo tiempo de la composición es **el segundo real del audio terminado** (voz grabada, TTS o música). No el guion, no una estimación.

- El guion leído no sirve para medir: **el audio grabado dura ~1,8× lo que dura el guion leído en papel.**
- Si el audio cambia en un punto (se corta una frase, se regraba una toma), **todo lo que viene después se corre a la vez**. Nunca se corrige un ancla suelta.

### 2. Medir cada palabra, nunca adivinar

- Los tiempos de cada palabra salen de **alineación forzada**: se le da al alineador el texto conocido y el audio, y devuelve el inicio y el fin real de cada palabra (wav2vec2 en español, torchaudio).
- **Whisper sirve para el texto, no para los tiempos.** Se adelanta hasta 3 s en tramos con pausas, y como el error cambia por tramo, ningún offset lo arregla.
- Las pausas se miden en la **energía del audio** (dónde hay voz y dónde no), no en el transcript.
- Antes de animar, se limpian los "eh", las pausas largas y las tomas repetidas del audio. Whisper no los escribe y se esconden justo en las pausas, que es donde van las transiciones. **Todo corte de habla se le propone a Walter, nunca se hace solo.**

### 3. La unidad es la idea, no el tiempo

- Se arma un **mapa de ideas**: una escena = una idea, con su frase exacta y sus segundos. No hay duración fija por escena; dura lo que dura la idea.
- **La escena cambia en la pausa entre dos ideas, nunca a mitad de frase.**
- Cada escena dice qué se ve, cómo se llega a ella y en qué estado está (construida / revisada / aprobada).

### 4. Dentro de la idea, el acento cae en una palabra

- Cada animación se ancla al segundo real de **una palabra concreta**, la que carga el significado. En el código, la palabra va comentada al lado del número, para que cualquiera pueda verificarla.
- Ejemplos: una placa cae en "se acabó"; los agentes se multiplican en "montón de agentes"; las personas se encienden en "cree".
- **El tono también decide**: zoom lento en una confesión, imagen degradada en "qué ansiedad", el color vuelve en "pero es lo que hay".
- La palabra se elige **por significado**. Hoy no medimos el énfasis en el audio.

### 5. Las transiciones viven en las pausas

- Arrancan cuando termina la frase y aterrizan antes de la palabra siguiente. Duran lo que dura la pausa (0,3–1,3 s). **La voz nunca espera a la imagen.**
- Cada tipo de transición **significa algo** y se usa sólo para eso. Nunca dos iguales seguidas.
- Sin rebotes ni pops de escala.

### 6. Cuánto dura una imagen

Entra en la pausa anterior a su idea y sale en la pausa siguiente. Además:

- **No se adelanta.** Una pantalla quieta que espera a la palabra que la usa está mal (Google estuvo 7 s inmóvil esperando "Antes llegabas a Google"). Entra justo antes de que se nombre.
- **Si dura menos de ~2 s, ¿qué representa?** Si no representa nada, se quita (una biblioteca genérica de 1,7 s "no se ganó su lugar").
- **Si pasa más de ~3 s sin cambios, es sospechosa.**
- **Ilustra la frase, no el argumento.** Un recurso que sirve a la tesis del video, pero no a lo que se dice en ese segundo, sobra ("¿por qué está eso ahí?").
- **Material real, no texto que repite el subtítulo.** Si se nombra un sitio o un canal, se muestra la captura real.

## El flujo, en orden

```
audio final → limpiar habla (propuesto, Walter decide) → texto por tramo
→ alineación forzada (tiempo de cada palabra) → mapa de ideas (una escena por idea)
→ anclar cada animación a su palabra → render de revisión → checklist
```

**Checklist antes de entregar**, escena por escena: ¿cambia en una pausa? ¿su animación cae en la palabra correcta? ¿dura menos de 2 s o pasa más de 3 s quieta? ¿ilustra lo que se dice AHORA? Y escuchar el video entero una vez: leer los tiempos no reemplaza el oído.

## Lo que cambia según el formato

- **Talking-head:** además, hay tres posturas (persona sola / persona chica con material arriba / material a pantalla completa). Están en SEGMENTAR-POR-IDEAS.md.
- **Voz en off o TTS:** igual que arriba. Si el TTS entrega timestamps por palabra, igual se verifican contra la energía del audio.
- **Sin voz (sólo música):** el reloj sigue siendo el audio, pero las anclas pasan a ser los golpes de la música en vez de las palabras. ⚠️ Este método nació y se probó con voz; con música no lo hemos validado.

Herramientas de referencia (proyecto de Christian, todavía no movidas a `pipeline/tools/`):
`~/Movies/VideoStudio/proyectos/cvander/2026-09-cvander-programar-profesion/edicion/master/tools/` → `alinear.py` (tiempos por palabra), `guion.py` (texto por tramo), `corrimiento.py T DELTA` (corre todas las anclas cuando cambia el audio), `make-captions.py`.
Limpieza del habla: `~/Movies/VideoStudio/pipeline/tools/limpiar-habla.py`.
