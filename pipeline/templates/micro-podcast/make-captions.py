#!/usr/bin/env python3
"""Grupos de subtítulo en un solo lugar. `*palabra` = caja de énfasis. Se emparejan en orden con local/words-aligned.json.
Salida: captions-data.js + local/cut.srt. Uso (desde master/): python3 tools/make-captions.py"""
import json, re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
G = [
 # A · Chris, pregunta 1
 "*Advertencia,", "esto no es", "*legal *advice", "Le quise preguntar", "a mi amigo *Ricardo,", "abogado mexicano,", "que siempre me comenta",
 "cómo está evolucionando", "*AI en el mundo", "del *derecho", "¿Valdrá la pena", "tirarle a alguno de estos", "*modelos *de *frontera", "algún *contrato",
 "para que me lo revise?", "¿Qué tan *confiable", "es el resultado?", "¿Es una opinión", "que puedo contar?", "¿Me estoy ahorrando", "la *plata que le puedo dar",
 "a un *bufete de abogado?", "¿Qué opinas, *Richie?",
 # B · Ricardo, respuesta 1
 "Sin lugar a dudas,", "creo que un", "modelo de frontera,", "principalmente un *Astra,", "un *Opus *5.5,", "van a darte una", "claridad *increíble,",
 "incluso si no sabes derecho", "Lo que sí es importante", "es tener *criterio", "y es saber cuándo usarla", "y para qué usarla", "Si tienes dudas,",
 "quieres averiguar un poco más", "qué significa, o leer,", "o saber entender mejor", "un *contrato,", "viene *increíble", "*Pero ante temas", "de *responsabilidad,",
 "ante temas donde está", "en *riesgo o en peligro", "alguna cuestión,", "digamos que siempre", "el mejor consejo es:", "ve con un *experto",
 "A pesar de que son", "herramientas muy valiosas,", "te vas a dar cuenta", "que siempre va a haber", "un *gap", "que la AI no puede interpretar,",
 "o que no sabe,", "o que no conoce", "el *contexto,", "que no conoce la *plaza,", "que no conoce la *forma", "en la que se hacen las cosas",
 "Y eso solamente", "un *experto o un profesional", "lo puede hacer",
 # C · Chris, pregunta 2
 "Ok, sí veo que", "hay un *cambio", "Veo que la industria", "está definitivamente", "*transformándose", "*Harvey, *Legora en Europa,", "en *Brasil acabaron",
 "una inversión", "bastante fuerte también", "¿Son buenas inversiones?", "¿Veremos pronto algo así", "en *Latinoamérica,", "en *México,", "en *Centroamérica,",
 "en las diferentes", "jurisprudencias?",
 # D · Ricardo, respuesta 2
 "*Sí *y *no", "La verdad es que,", "como tú sabes,", "el dinero está", "muy concentrado", "en *Estados *Unidos,", "está muy concentrado", "en las jurisdicciones",
 "que tienen mayor", "poder adquisitivo", "Entonces, la verdad es que", "ayer estaba haciendo", "un análisis de cuántas", "inversiones, por ejemplo,",
 "había colocado *YC", "el último año,", "los últimos dos años", "en *Latinoamérica,", "en comparación a,", "digamos, los cinco años", "previos,", "y era *muy, *muy *poco",
 "Entonces, hoy en día,", "creo que, si bien es cierto,", "hay grandes productos", "que se están desarrollando", "en todo el mundo,", "la concentración principal",
 "está en *Estados *Unidos", "y evidentemente", "estos gigantes como", "*Harvey, como *Legora,", "creo que se posicionaron", "rápido,", "pero eso no quiere decir que",
 "vayan a ser *los *únicos", "Así que, evidentemente,", "si tienes una idea,", "*échala *a *andar",
 # E · Chris, su opinión
 "Ok, la verdad,", "yo creo que", "son *herramientas,", "hay que usarlas", "Y a mí me pasa", "que antes había", "*términos *y *condiciones", "que simplemente",
 "no tenía tiempo de leer", "Revisaba, *googleaba", "para ver si estaba", "pasando por algo", "Y definitivamente", "pasárselo a un *ChatGPT,", "pasárselo a *Claude",
 "y que me dé", "un poco de consejo", "es *mejor que lo que", "hacía antes", "Pero sí hay que tener", "un poquito de *cuidado,", "particularmente si estás",
 "tomando decisiones", "de negocios importantes", "y no simplemente darle", "*confianza *absoluta", "Y también", "tengan cuidado", "porque el *riesgo hoy,",
 "en la mayoría de casos", "y en nuestros países,", "sigue siendo", "*nuestro", "De la persona que *aceptó,", "de la persona que *mandó", "ese contrato,",
 "de la persona que *firma", "Y no puedes venir", "y decir: *ChatGPT", "tuvo la culpa,", "porque no creo que eso", "pase en *juicio",
]
W = json.load(open(R / 'local/words-aligned.json'))
ALIAS = {'ai': 'ia'}  # L039: en pantalla "AI" también cuando Ricardo dice "la IA"
norm = lambda s: re.sub(r'[^\wáéíóúñü.]', '', s.lower()).strip('.')
caps = []; i = 0
for g in G:
    ws = []
    for t in g.split():
        em = t.startswith('*'); t = t.lstrip('*'); n = norm(t)
        if i >= len(W) or norm(W[i]['t']) not in (n, ALIAS.get(n)):
            sys.exit(f'✗ "{t}" en «{g}» no coincide con la palabra {i}: {W[i]["t"] if i < len(W) else "FIN"}')
        ws.append({'t': t, 's': W[i]['s'], 'e': W[i]['e'], 'em': em}); i += 1
    caps.append({'s': ws[0]['s'], 'e': ws[-1]['e'], 'w': ws, 'q': W[i - 1]['quien']})
left = [w['t'] for w in W[i:]]
if left: print('⚠ palabras sin subtítulo al final:', ' '.join(left))
(R / 'captions-data.js').write_text('window.CAPS=' + json.dumps(caps, ensure_ascii=False) + ';\n')
f = lambda t: f"{int(t//3600):02}:{int(t%3600//60):02}:{int(t%60):02},{int(round(t%1*1000)):03}"
(R / 'local/cut.srt').write_text('\n'.join(f"{k+1}\n{f(c['s'])} --> {f(c['e'])}\n{' '.join(w['t'] for w in c['w'])}\n" for k, c in enumerate(caps)))
print(len(caps), 'grupos')
