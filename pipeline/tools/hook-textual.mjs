#!/usr/bin/env node
import {resolveProject,ROOT,projectSlug} from './project.mjs';
/* ============================================================================
   hook-textual.mjs — EL HOOK QUE SE LEE, no el que se escucha.

       node tools/hook-textual.mjs <slug> --texto "NADIE CONTRATA UNA CARRERA"
       node tools/hook-textual.mjs <slug> --check          # sólo verifica el puesto
       node tools/hook-textual.mjs <slug> --quitar

   QUÉ ES
   Una frase de ≤5 palabras, grande y notoria, en pantalla desde el frame 0.
   Existe para que el que llega no se vaya ANTES de escucharte: le da contexto
   con el ojo mientras el oído todavía no procesó nada.

   ⛔ LA DOCTRINA NO VIVE ACÁ. Los 5 criterios y los 6 tipos ya están escritos en
   `03-areas/moiwalter/workflow/tiktok_workflow.md` §Paso 3 (Text Overlay Agent).
   Esta herramienta NO los reinventa: los GATEA y después pone el texto en el
   master. Escribir las opciones sigue siendo trabajo del agente.

   DECISIONES DE WALTER (16-ago-2026), que son las que este script asume:
     · QUEMADO en el master, no nativo de TikTok → tipografía de marca exacta
     · SÓLO los primeros 3 s → hace su trabajo y libera la pantalla
     · Los subtítulos NO pueden arrancar antes: medido sobre `cut.srt`, el
       primer subtítulo entra en 0,00 s porque habla desde el frame 0. Sí se
       pisan. El script lo emite como instrucción para el paso de captions.

   ── LO QUE GATEA ───────────────────────────────────────────────────────────
   palabras     ≤5. El criterio "lectura en <1 segundo" del workflow.
   repetición   contra el .srt REAL de los primeros N segundos. El overlay
                complementa, no repite: si el ojo lee lo mismo que el oído
                escucha, el overlay no agrega nada y ocupa pantalla.
   zona TikTok  que no caiga bajo el riel de acciones ni bajo el caption.
                Mapa en `tools/zonas-tiktok.json` — HOY SIN MEDIR, avisa.
   choque       que no aterrice encima de lo que ya pinta la escena en esa
                ventana. En `tu-carrera` los primeros 3 s ya están llenos.

   ── CÓMO SE INYECTA ────────────────────────────────────────────────────────
   Entre marcadores, no por parche a mano. El master lleva:
       <!-- HOOK-TEXTUAL:INICIO -->   ...   <!-- HOOK-TEXTUAL:FIN -->
       (y los equivalentes JS:INICIO / JS:FIN como comentario de bloque)
   Correrlo dos veces reemplaza, no duplica. Si los marcadores no están, los
   crea en su lugar.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = ROOT
const args = process.argv.slice(2)
const val = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] }
const slug = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--check', '--quitar'].includes(args[i - 1])))
const TEXTO = val('texto', null)
const HASTA = +val('hasta', 3.0)
const TIPO = val('tipo', '')
const SOLO_CHECK = args.includes('--check')
const QUITAR = args.includes('--quitar')
const MAX_PALABRAS = +val('palabras', 5)
/* ⛔ DOS TIPOS DE HOOK TEXTUAL, y tienen reglas OPUESTAS sobre la repetición.
   Lo descubrió Walter corrigiéndome el 16-ago: yo propuse cuatro TESIS
   ("Ese permiso no existe") y él pidió PREGUNTAS ("¿qué carreras contratan las
   startups?"). Tenía razón y el propio workflow lo dice —"el título crea la
   pregunta, el video la responde, nunca al revés"—: una tesis resuelve la
   tensión antes de empezar.

     contexto  una pregunta que dice DE QUÉ va el video. Compartir las palabras
               del tema con el audio es correcto, es el punto: así el que cae
               sabe si le sirve. Además es la frase que se busca en TikTok.
     punch     una afirmación que abre una brecha. Acá SÍ es error repetir lo
               que el audio ya dice: el ojo y el oído gastarían el mismo golpe. */
const MODO = val('modo', 'contexto')
/* ⛔ El texto blanco sobre su repisa —libros de colores, tira LED, cuadro— se
   defiende con sombra pero no RESALTA. Dos cosas lo arreglan y las dos son de
   marca, no invento: una placa suave detrás (la regla de "el gris no flota") y
   UNA palabra en naranja, que es exactamente la jerarquía de los takeover.
   La palabra del acento se elige, no se adivina: es la que carga el gancho. */
const ACENTO = val('acento', '')

if (!slug) { console.error('uso: node tools/hook-textual.mjs <slug> --texto "..." [--hasta 3.0] [--tipo <t>] | --check | --quitar'); process.exit(1) }
const dir = projectSlug(resolveProject(slug))
if (!dir) { console.error(`✗ ningún video matchea '${slug}'`); process.exit(1) }
const master = resolve(resolveProject(slug), 'master')
const IDX = resolve(master, 'index.html')

/* ⛔ EL HOOK NO PUEDE DEPENDER DEL DESIGN SYSTEM DE MOI (5-sep-2026).
   Decía class="big", que es una clase de Moi. En el video de Enzo esa clase NO EXISTE en
   ningún lado, así que el navegador cayó al default: SERIF NEGRO, flotando sobre los posters
   de la pared, sin placa. Render válido, `check` en verde, y horrible — el mismo modo de falla
   que los var() indefinidos que ya está documentado. La tipografía del hook se ESCRIBE, sale
   de los tokens de la marca del proyecto, y si la marca es sobria va sobre PLACA OPACA en vez
   de scrim: un degradado sobre una pared con cuadros es ilegible por definición. */
const MARCA_QC = (() => {
  try { return JSON.parse(readFileSync(resolve(resolveProject(slug), 'brand.json'), 'utf8')) } catch { return null }
})()
const SOBRIA = (MARCA_QC?.energy || '').toLowerCase().startsWith('sobri')
const HK = SOBRIA
  ? { peso: 700, tracking: '1.8px', color: 'var(--ink,#000)', sombra: '' }
  : { peso: 800, tracking: '0px', color: 'var(--fg,#fff)',
      sombra: 'text-shadow:0 12px 46px rgba(0,0,0,.95),0 3px 12px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.8)' }

if (!existsSync(IDX)) { console.error(`✗ no hay master/index.html en ${dir}`); process.exit(1) }

const ZONAS = JSON.parse(readFileSync(resolve(AQUI, 'zonas-tiktok.json'), 'utf8'))
let html = readFileSync(IDX, 'utf8')
const problemas = [], avisos = []

/* ── el texto del corte, para el chequeo de repetición ───────────────────── */
const srt = ['local/cut.srt', 'local/cut.txt'].map(f => resolve(master, f)).find(existsSync)
const VACIAS = new Set(['el','la','los','las','un','una','de','del','a','al','en','y','o','que','se','su','sus','es','no','me','te','lo','con','por','para','mi','tu','si','ya','más','pero','como'])
const contenido = t => (t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .match(/[a-z0-9ñ]+/g) || []).filter(w => w.length > 2 && !VACIAS.has(w))

function primerasPalabras(seg) {
  const j = resolve(master, 'local/cut.json')
  if (!existsSync(j)) return null
  const d = JSON.parse(readFileSync(j, 'utf8'))
  const ws = d.segments.flatMap(s => s.words || [])
  return { texto: ws.filter(w => w.start < seg).map(w => w.word.trim()).join(' '),
           primerSub: ws.length ? ws[0].start : null }
}

/* ═══ QUITAR ════════════════════════════════════════════════════════════════ */
if (QUITAR) {
  html = html.replace(/<!-- HOOK-TEXTUAL:INICIO -->[\s\S]*?<!-- HOOK-TEXTUAL:FIN -->/, '<!-- HOOK-TEXTUAL:INICIO --><!-- HOOK-TEXTUAL:FIN -->')
             .replace(/\/\* HOOK-TEXTUAL:JS:INICIO \*\/[\s\S]*?\/\* HOOK-TEXTUAL:JS:FIN \*\//, '/* HOOK-TEXTUAL:JS:INICIO */ /* HOOK-TEXTUAL:JS:FIN */')
  writeFileSync(IDX, html); console.log('✓ hook textual quitado'); process.exit(0)
}

/* ═══ el texto: del flag o del que ya está puesto ═══════════════════════════ */
const puesto = html.match(/<!-- HOOK-TEXTUAL:INICIO -->[\s\S]*?data-hook-texto="([^"]*)"[\s\S]*?<!-- HOOK-TEXTUAL:FIN -->/)
const texto = TEXTO || puesto?.[1]
if (!texto) { console.error('✗ no hay texto: pasá --texto "..." o ponelo antes de usar --check'); process.exit(1) }
const palabras = texto.trim().split(/\s+/).filter(Boolean)

/* ═══ GATE 1 · largo ════════════════════════════════════════════════════════ */
if (palabras.length > MAX_PALABRAS)
  problemas.push(`${palabras.length} palabras (máximo ${MAX_PALABRAS}) — el criterio es "lectura en <1 segundo"`)
if (texto.length > 30)
  avisos.push(`${texto.length} caracteres: a 5 palabras largas el cuerpo baja y deja de ser notorio`)
if (/[,;:]/.test(texto))
  avisos.push('lleva coma o dos puntos — el workflow pide "sin subordinadas"')

/* ═══ GATE 2 · ¿repite lo que ya dice el audio? ═════════════════════════════ */
const pri = primerasPalabras(HASTA)
if (pri) {
  const enAudio = new Set(contenido(pri.texto))
  const choque = contenido(texto).filter(w => enAudio.has(w))
  if (MODO === 'punch') {
    if (choque.length >= 2)
      problemas.push(`repite el audio de los primeros ${HASTA}s (${choque.join(', ')}) — un hook punch complementa, no copia`)
    else if (choque.length === 1)
      avisos.push(`comparte "${choque[0]}" con el audio de los primeros ${HASTA}s`)
  } else if (choque.length) {
    console.log(`   · comparte con el audio: ${choque.join(', ')} — en modo contexto eso está bien`)
  }
  if (MODO === 'contexto' && !/[?¿]/.test(texto))
    avisos.push('modo contexto sin signo de pregunta: si es una afirmación, probablemente sea --modo punch')
  if (pri.primerSub !== null && pri.primerSub < HASTA)
    avisos.push(`⚠ SUBTÍTULOS: habla desde ${pri.primerSub.toFixed(2)}s, así que el primer subtítulo se pisa con el hook.\n       → al generar captions, que arranquen en ${HASTA.toFixed(2)}s. Un solo texto a la vez.`)
}

/* ═══ GATE 3 · la zona segura de TikTok ═════════════════════════════════════ */
const S = ZONAS.seguro
/* el bloque se centra en el ancho seguro y se apoya en el tercio alto: es donde
   el pulgar no tapa y donde el ojo cae primero al abrir un video vertical */
/* ⛔ La franja del hook es la INTERSECCIÓN de dos cosas, no sólo la zona segura
   de TikTok: arriba manda la UI (y ≥ 194) y abajo manda SU PELO. En este corte
   la cabeza arranca en y≈500, así que la franja real son 306 px — no los 420
   que daba la zona de TikTok sola. Con 420 el hook le tapaba 200 px de cabeza. */
const CARA_TOPE = +val('cara-top', 500)
const CAJA = { x: S.x, y: S.y + 2, w: S.w, h: Math.max(120, CARA_TOPE - S.y - 2) }
if (!ZONAS._medido)
  avisos.push('el mapa de la UI de TikTok TODAVÍA NO ESTÁ MEDIDO (tools/zonas-tiktok.json) — la posición es la de referencia, no la de tu teléfono')
for (const z of ZONAS.zonas) {
  const ow = Math.min(CAJA.x + CAJA.w, z.x + z.w) - Math.max(CAJA.x, z.x)
  const oh = Math.min(CAJA.y + CAJA.h, z.y + z.h) - Math.max(CAJA.y, z.y)
  if (ow > 0 && oh > 0) problemas.push(`la caja del hook cae bajo "${z.que}" (${ow}×${oh}px)`)
}

/* ═══ GATE 4 · ¿la escena de esos segundos ya está ocupada? ═════════════════
   No se adivina leyendo el HTML: se le pregunta a `qc-master --solo zona`… pero
   eso mide la cara, no la banda del hook. Acá alcanza con una señal barata y
   honesta: ¿hay alguna .escena viva en la ventana del hook? */
const escenas = [...html.matchAll(/class="escena clip" id="(S\d+)" data-start="([\d.]+)" data-duration="([\d.]+)"/g)]
  .map(m => ({ id: m[1], st: +m[2], du: +m[3] }))
  .filter(e => e.st < HASTA && e.st + e.du > 0)
if (escenas.length)
  avisos.push(`la ventana 0–${HASTA}s ya la ocupan ${escenas.map(e => e.id).join(', ')} — mirá el frame antes de aprobar`)

/* ═══ reporte ═══════════════════════════════════════════════════════════════ */
console.log(`\n${dir} · hook textual\n`)
console.log(`   "${texto}"   ${palabras.length} palabra(s) · ${texto.length} car. · modo ${MODO}${TIPO ? ' · tipo: ' + TIPO : ''}`)
console.log(`   en pantalla 0,00 → ${HASTA.toFixed(2)}s · quemado en el master\n`)
for (const x of problemas) console.log(`   ✗ ${x}`)
for (const x of avisos) console.log(`   ⚠ ${x}`)
if (!problemas.length && !avisos.length) console.log('   ✓ pasa todos los gates')

if (SOLO_CHECK) { console.log(problemas.length ? '\n✗ no lo pongas todavía' : '\n✓ apto'); process.exit(problemas.length ? 1 : 0) }
if (problemas.length) { console.log('\n✗ no se inyecta con errores. Arreglá el texto y reintentá.'); process.exit(1) }

/* ═══ inyección entre marcadores ════════════════════════════════════════════ */
const escapa = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]/g, '')
let acentoUsado = null
const conAcento = escapa(texto).toUpperCase().split(/(\s+)/).map(w => {
  if (!ACENTO || acentoUsado || !norm(w) || norm(w) !== norm(ACENTO)) return w
  acentoUsado = w
  /* mismo problema que class="big": `.or` es de Moi. En una marca sobria el acento no puede
     ser un color de texto —el hot #FCC600 de Startupeable da 2.2:1 y es ILEGIBLE—: es una
     PLACA con el texto en ink encima, que es como esa marca lo usa en su propio material. */
  /* ⛔ EL ACENTO ES `accent`, NO `emphasis` (5-sep-2026, Walter: "democratize should be
     highlighted with the brand color, right?"). Tenía razón: en Startupeable el color de marca
     es el TEAL (accent→teal) y el amarillo es `emphasis`, con la prohibición escrita de
     "usar #FCC600 como acento general: en su material es SÓLO placa de nombre". Resaltar una
     palabra del hook es acento general — el amarillo no va.
     Y va como PLACA con su par completo (surface→teal / text→paper), nunca como color de
     texto: la ficha dice que los dos pares superficie/texto no se cruzan. */
  return SOBRIA
    ? `<span style="background:var(--accent,#03989E);color:var(--paper,#fff);padding:0 .14em;box-decoration-break:clone;-webkit-box-decoration-break:clone">${w}</span>`
    : `<span style="color:var(--accent,#FD551D)">${w}</span>`
}).join('')
if (ACENTO && !acentoUsado) { console.error(`✗ --acento "${ACENTO}" no está en el texto`); process.exit(1) }
const bloqueHTML =
`<!-- HOOK-TEXTUAL:INICIO -->
  <div class="escena clip" id="HOOK" data-start="0" data-duration="${HASTA}" data-track-index="9" data-qc-capa
       data-hook-texto="${escapa(texto)}" style="opacity:1">
    <div id="hk-caja" style="position:absolute;left:${CAJA.x}px;top:${CAJA.y}px;width:${CAJA.w}px;height:${CAJA.h}px;
         display:flex;align-items:center;justify-content:center;text-align:center">
      <!-- la placa se extiende MUY por fuera de la caja del texto: si el degradado
           no termina de desvanecerse dentro del recuadro, el borde del recuadro se
           ve como una banda horizontal sobre el footage. -->
      <!-- data-qc-cara-ok: la placa ROZA su cara y qc-master --solo zona la marca,
           porque el chequeo mide cajas y no caída de opacidad. A esa distancia el
           degradado va por debajo del 15 %: es una viñeta, no una tapa. Se acorta
           hacia abajo para que sea lo mínimo y se declara a propósito. -->
      <div id="hk-scrim" data-qc-cara-ok style="position:absolute;${SOBRIA
           ? `left:-56px;right:-56px;top:-44px;bottom:-40px;background:var(--paper,#fff)`
           : `left:-260px;right:-260px;top:-260px;bottom:-110px;background:radial-gradient(ellipse 46% 40% at 50% 50%,rgba(20,19,20,.86) 0%,rgba(20,19,20,.62) 42%,rgba(20,19,20,.28) 68%,rgba(20,19,20,0) 100%)`}"></div>
      <div id="hk-txt" style="position:relative;font-family:var(--font-display,system-ui);font-weight:${HK.peso};
           letter-spacing:${HK.tracking};text-transform:uppercase;color:${HK.color};
           font-size:${+val('cuerpo', 96)}px;line-height:.94;${HK.sombra}">${conAcento}</div>
    </div>
  </div>
<!-- HOOK-TEXTUAL:FIN -->`

const bloqueJS =
`/* HOOK-TEXTUAL:JS:INICIO */
  /* Entra en el frame 0 sin anticipación: cualquier retraso se come el motivo
     por el que existe. Sale hacia arriba con la gramática del video. */
  tl.fromTo('#hk-scrim',{opacity:0},{opacity:1,duration:0.26,ease:'power2.out'},0.00);
  tl.fromTo('#hk-txt',{opacity:0,y:56,scale:.93},
    {opacity:1,y:0,scale:1,duration:M.dur.pop,ease:M.ease.pop},0.02);
  tl.to(['#hk-txt','#hk-scrim'],{y:-70,opacity:0,scale:.97,duration:0.32,ease:M.ease.cut},${(HASTA - 0.34).toFixed(2)});
  tl.set('#HOOK',{opacity:0},${HASTA.toFixed(2)});
  /* HOOK-TEXTUAL:JS:FIN */`

/* ⛔ LA INSERCIÓN SE VERIFICA, NO SE ASUME (30-ago-2026).
   El ancla del bloque JS era el literal `── LA CÁMARA POR ESCENA`, que de los cinco
   master SÓLO tiene tu-carrera. En los otros cuatro el .replace no matcheaba y era un
   no-op MUDO: el HTML entraba, el JS se descartaba, el hook quedaba en el archivo,
   pasaba `hyperframes check`, y no se animaba NUNCA. Es exactamente el modo de falla
   que este mismo archivo documenta 40 líneas más abajo. Ahora: se prueba el ancla
   ANTES de reemplazar y, si ninguna matchea, se aborta SIN ESCRIBIR — porque medio
   hook es peor que ninguno (uno se ve en el archivo y miente; el otro se nota).

   El reemplazo va como FUNCIÓN, no como string: en String.replace un `$` del texto
   del hook se interpretaría como $&/$1/$$ y saldría corrupto. */
const pone = (txt, intentos, qué, pista) => {
  for (const [re, rep] of intentos) if (re.test(txt)) return txt.replace(re, rep)
  console.error(`\n✗ no encontré dónde poner ${qué} en master/index.html.`)
  console.error(`  NO escribí nada. Un hook a medias entra, pasa el check y no se anima jamás.`)
  console.error(`  Arreglo: ${pista}`)
  process.exit(1)
}

html = pone(html, [
  [/<!-- HOOK-TEXTUAL:INICIO -->[\s\S]*?<!-- HOOK-TEXTUAL:FIN -->/, () => bloqueHTML],
  [/\n\s*<\/div>\s*\n\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap/,
   (m) => `\n${bloqueHTML}\n${m}`],
], 'el HTML del hook',
   'poné los marcadores <!-- HOOK-TEXTUAL:INICIO --> … <!-- HOOK-TEXTUAL:FIN --> donde va la capa.')

/* El ancla robusta es `window.__timelines`: existe en los 5 master y es obligatoria
   —qc-master aborta sin ella—, así que no puede faltar en un master válido. El
   marcador explícito /* HOOK-TEXTUAL:JS *\/ lo escribe el scaffold y gana si está. */
html = pone(html, [
  [/\/\* HOOK-TEXTUAL:JS:INICIO \*\/[\s\S]*?\/\* HOOK-TEXTUAL:JS:FIN \*\//, () => bloqueJS],
  [/\n[ \t]*\/\* HOOK-TEXTUAL:JS \*\//, () => `\n  ${bloqueJS}`],
  [/\n[ \t]*window\.__timelines\s*=\s*window\.__timelines\s*\|\|/,
   (m) => `\n  ${bloqueJS}\n${m}`],
], 'el JS del hook',
   'poné /* HOOK-TEXTUAL:JS */ dentro del <script> del master, antes de window.__timelines.')

/* ⛔ 17-ago: la capa entra al FINAL del DOM con data-start="0". El loop de
   visibilidad del master calcula el cierre de cada escena contra el data-start
   de la SIGUIENTE — con la capa adentro, la última escena se cierra en t=0 y la
   capa se apaga a sí misma en el frame 0. Quedó en el archivo, pasó `check`, y
   este hook no se vio nunca. Se excluye por data-qc-capa (lo mismo que ya
   hacía qc-master.mjs). Idempotente: después del reemplazo el patrón no matchea. */
html = html.replace(/querySelectorAll\('\.escena'\)/g,
  "querySelectorAll('.escena:not([data-qc-capa])')")

writeFileSync(IDX, html)
console.log(`\n✓ puesto en master/index.html (entre marcadores — correlo de nuevo y reemplaza, no duplica)`)
console.log(`  siguiente: node tools/qc-master.mjs ${slug}`)
if (MODO === 'contexto')
  console.log(`\n  ⛔ QUEMADO NO ES BUSCABLE. TikTok no lee el texto de tu mp4. Una pregunta de\n     contexto es justo lo que la gente TIPEA en el buscador, así que poné esta\n     misma frase en el CAPTION al publicar o el gate de búsqueda se pierde.`)
