#!/usr/bin/env node
/* ============================================================================
   qc-master.mjs — el `validate-kit` del CARRIL MASTER.

       node tools/qc-master.mjs <slug> [--solo pisadas|capas|banda|tipo|assets|zona]
                                       [--fps 30] [--gracia 0.34]
                                       [--cara 468,1440] [--json]

   POR QUÉ EXISTE (16-ago-2026, master de tu-carrera)
   Todo `tools/` estaba construido para el carril KIT — alpha, premultiply,
   validate-kit, approve, lock-all. El carril MASTER tenía dos herramientas y
   ningún gate propio. Los cuatro bugs que más costaron en `tu-carrera` los cazó
   el OJO de Walter en el preview, y `hyperframes check` dio 0 errores en los
   cuatro:

     · cuatro escenas pintando encima de la siguiente (las 4 fotos dibujadas dos
       veces, lo que además anulaba el velo de su propio beat)
     · dos titulares saliéndose del cuadro por abajo (t26 terminaba en 1967)
     · la tabla del PVP a 26 px y la landing a 388 px: ilegibles
     · los chips saliéndose por la derecha (content-box suma el padding)

   No es que el gate falle: `check` mira DENTRO de la ventana de cada escena.
   Estos son problemas ENTRE escenas, CONTRA el lienzo y CONTRA la resolución
   del asset. Nadie los cubría.

   La regla del pipeline es "se verifica, no se estima". Esto convierte
   "mirá el frame" en una medición.

   ── LOS CINCO CHEQUEOS ─────────────────────────────────────────────────────
   pisadas  cuadro por cuadro: ¿dos escenas pintando a la vez? Sólo vale el
            solape de salida del takeover (≤ --gracia).
   capas    lo contrario de pisadas, para lo que pisadas ignora: cada capa
            (data-qc-capa) tiene que pintar en al menos una muestra de su
            ventana. Una capa inyectada que no se ve en ningún frame es el bug
            del 16-ago — existía, pasaba `check`, y no estaba en el video.
   tipo     por cada texto grande: líneas, línea más ancha vs. su caja, y borde
            inferior vs. el lienzo.
   assets   tamaño renderizado vs. natural de cada <img>: lo estirado sale
            blando, lo mostrado a un tercio sale ilegible.
   vivas    ¿cada escena dibuja ALGO? Un video en negro pasa todos los demás
            chequeos en verde: cero elementos es cero invasiones y cero solapes.
   zona     nada estático tapando su cara. Los transitorios (algo que cae y
            cruza) no cuentan: se mide la DURACIÓN.

   ── ESCOTILLAS (en el HTML, no en flags) ───────────────────────────────────
   data-qc-escala-ok    este <img> se muestra chico a propósito
   data-qc-cara-ok      este elemento puede estar sobre su cara
   data-qc-vacia-ok     esta escena es sólo footage y no dibuja nada a propósito
   data-layout-allow-overlap  ya lo respeta `hyperframes check`

   DEPENDENCIA: puppeteer-core + un Chrome de ~/.cache/puppeteer.
   ========================================================================== */
import { createServer } from 'node:http'
import { readFileSync, existsSync, readdirSync, statSync, createReadStream } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = ROOT
const req = createRequire(import.meta.url)

const args = process.argv.slice(2)
/* ⛔ NO filtres el slug por "empieza con dígito" (29-ago-2026).
   Decía `!/^\d/.test(a)` para saltarse los valores numéricos de los flags, pero TODOS los
   slugs empiezan con el año: `qc-master.mjs 2026-08-tu-carrera` imprimía el "uso:" y salía
   con código 1. O sea que el gate del carril master era ININVOCABLE con el nombre real de
   cualquier proyecto, y desde otro script parecía un gate en rojo. Ahora se descartan los
   valores de flag por POSICIÓN (el token anterior es un --flag con valor), no por su forma. */
/* ⛔ TODO flag con valor va acá o se come su argumento (30-ago-2026).
   `--banda` se leía en el gate de la banda pero nunca se declaró: con
   `qc-master --banda 1320,1520 tu-carrera` el slug detectado era "1320,1520".
   Es el MISMO defecto que el comentario de arriba dice haber arreglado — se
   arregló la causa de un caso y no la lista. Al agregar un flag: agregalo acá. */
import {config,resolveProject,ROOT,projectSlug} from './project.mjs';
const FLAGS_CON_VALOR = new Set(['--fps', '--gracia', '--cara', '--solo', '--banda', '--camara-techo'])
const slug = args.find((a, i) => !a.startsWith('--') && !FLAGS_CON_VALOR.has(args[i - 1]))
const val = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] }
const FPS = +val('fps', 30), GRACIA = +val('gracia', 0.34)
const CARA_FLAG = val('cara', null)
const SOLO = val('solo', null)
const JSON_OUT = args.includes('--json')
const TODO_ASSETS = args.includes('--assets-todo')
if (!slug) { console.error('uso: node tools/qc-master.mjs <slug> [--solo vivas|pisadas|capas|banda|tipo|assets|zona] [--banda sup,inf] [--json]'); process.exit(1) }
/* ⛔ Un --solo con typo hacía que NINGÚN gate corriera: hallazgos vacío → exit 2
   "ningún chequeo pudo medir", sin decir nunca que el nombre no existe. Un gate
   que se calla por un typo es peor que uno que no existe. */
const CHEQUEOS = ['vivas', 'pisadas', 'capas', 'banda', 'tipo', 'assets', 'zona', 'camara', 'mapa']
if (SOLO && !CHEQUEOS.includes(SOLO)) {
  console.error(`✗ --solo '${SOLO}' no es un chequeo. Son: ${CHEQUEOS.join(' · ')}`); process.exit(1)
}

const dir = projectSlug(resolveProject(slug))
const master = resolve(resolveProject(slug), 'master')
if (!existsSync(resolve(master, 'index.html'))) { console.error(`✗ no hay master/index.html en ${dir}`); process.exit(1) }

/* la duración y el lienzo salen del CONTRATO, no de un flag: si se re-corta el
   video y nadie actualiza el argumento, el barrido se queda corto en silencio */
const html = readFileSync(resolve(master, 'index.html'), 'utf8')
const frame = html.match(/<div[^>]*data-composition-id="main"[^>]*>/)?.[0] || ''
const num = (a, d) => +(frame.match(new RegExp(a + '="([\\d.]+)"'))?.[1] ?? d)
const FIN = num('data-duration', 0), CW = num('data-width', 1080), CH = num('data-height', 1920)

/* ── LA CARA ES UN DATO DEL VIDEO, NO UNA CONSTANTE (17-ago-2026) ───────────
   El default era `468,1440`: el encuadre de Walter en tu-carrera. Sobre el
   corte de otra persona ese rango mide contra una cara que no está ahí — y no
   falla ruidosamente, mide MAL: da errores donde no hay nada y, peor, pasa en
   verde una placa que sí le tapa la cara. El flag `--cara` existía, pero un
   gate que depende de que alguien se acuerde de un flag no es un gate.
   Ahora sale de `data-qc-cara="A,B"` en el frame, medido por video. El flag
   sigue mandando por encima, para probar sin editar el HTML. */
/* ⛔ EL ENCUADRE ES UN DATO DE LA MARCA (30-ago-2026).
   El default era `468,1440` clavado acá: el encuadre de Walter en tu-carrera, y sobre el corte
   de otra persona medía contra una cara que no está. La corrección del 17-ago fue pedirlo por
   VIDEO (data-qc-cara), pero eso convirtió en tarea manual algo que no cambia entre videos: es
   el mismo cuarto, la misma cámara, la misma distancia. Ahora sale de brands/<marca>.json → qc,
   medido una vez por marca. Un cliente con otro encuadre lo declara en SU marca, no en cada video.
   Precedencia: flag > atributo del video > marca > default. */
const MARCA_QC = (() => {
  try { const cfg=config(resolveProject(slug));return cfg?.geometry?.faceRange?{cara:cfg.geometry.faceRange}:cfg?.geometry?.reuseBrandSetup===true?JSON.parse(readFileSync(resolve(resolveProject(slug),'brand.json'),'utf8')).qc:null }
  catch { return null }
})()
const caraAttr = frame.match(/data-qc-cara="(\d+)\s*,\s*(\d+)"/)
  || (MARCA_QC?.cara ? [null, String(MARCA_QC.cara[0]), String(MARCA_QC.cara[1])] : null)
const caraSrc = CARA_FLAG ? '--cara' : frame.includes('data-qc-cara="') ? 'data-qc-cara' : MARCA_QC?.cara ? 'brand.json' : 'DEFAULT'

/* El techo de escala, con la MISMA precedencia que la cara: flag > atributo > default.
   1.19 sale medido de uplabs («la fuente ya viene subida 2,33× desde 464 px y más que eso
   se ablanda visiblemente»), pero depende de la resolución de la fuente: un corte 4K
   aguanta más. Por eso es un dato del video y no una constante del gate. */
const techoAttr = frame.match(/data-qc-camara-techo="([\d.]+)"/)
const ETIQ_TECHO = techoAttr ? +techoAttr[1] : 1.19
const [CARA_A, CARA_B] = (CARA_FLAG || (caraAttr ? `${caraAttr[1]},${caraAttr[2]}` : '468,1440'))
  .split(',').map(Number)
if (caraSrc === 'DEFAULT' && (!SOLO || SOLO==='zona')) {
  const r={state:'UNVERIFIABLE',check:'zona',error:'Falta encuadre medido de ESTE video: data-qc-cara. No se usa la cara de otro episodio.'};
  console.error(JSON_OUT?JSON.stringify(r):r.error);process.exit(2);
}
if (!FIN) { console.error('✗ no encontré data-duration en el #frame de la composición'); process.exit(1) }

let puppeteer
try { puppeteer = (await import(req.resolve('puppeteer-core', { paths: [AQUI, RAIZ, process.cwd()] }))).default }
catch { console.error('✗ falta puppeteer-core. `npm i puppeteer-core` en video-edit/ y reintentá.'); process.exit(2) }
const cacheChrome = resolve(process.env.HOME, '.cache/puppeteer/chrome')
const build = existsSync(cacheChrome) ? readdirSync(cacheChrome).sort().pop() : null
const CHROME = build && resolve(cacheChrome, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
if (!CHROME || !existsSync(CHROME)) { console.error('✗ no encontré un Chrome en ~/.cache/puppeteer/chrome'); process.exit(2) }

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json' }
/* ⛔ EL SERVER TIENE QUE HABLAR RANGE (30-ago-2026).
   Servía el archivo entero con readFileSync + rs.end(). Con un corte de 195 MB, Chrome pide
   el video, no puede buscar dentro de él y `networkidle2` NUNCA se asienta: el gate moría con
   «Navigation timeout of 60000 ms exceeded», que se lee como "el video está roto" cuando lo
   único roto era el server de pruebas. Un mp4 se sirve por tramos o no se sirve. */
const srv = createServer((rq, rs) => {
  const f = resolve(master, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/+/, '') || 'index.html')
  if (!existsSync(f) || statSync(f).isDirectory()) { rs.writeHead(404).end(); return }
  const tipo = MIME[extname(f)] || 'application/octet-stream'
  const total = statSync(f).size
  const rango = rq.headers.range && /^bytes=(\d*)-(\d*)$/.exec(rq.headers.range)
  if (rango) {
    const ini = rango[1] ? +rango[1] : 0
    const fin = rango[2] ? Math.min(+rango[2], total - 1) : total - 1
    if (ini >= total) { rs.writeHead(416, { 'Content-Range': `bytes */${total}` }).end(); return }
    rs.writeHead(206, { 'Content-Type': tipo, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${ini}-${fin}/${total}`, 'Content-Length': fin - ini + 1 })
    createReadStream(f, { start: ini, end: fin }).pipe(rs)
    return
  }
  rs.writeHead(200, { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Content-Length': total })
  createReadStream(f).pipe(rs)
})
await new Promise(r => srv.listen(0, r))

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'shell' })
const p = await b.newPage()
await p.setViewport({ width: CW, height: CH, deviceScaleFactor: 1 })
await p.goto(`http://localhost:${srv.address().port}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 6000))
if (!await p.evaluate(() => !!(window.__timelines && window.__timelines.main))) {
  console.error('✗ no encontré window.__timelines.main'); await b.close(); srv.close(); process.exit(2)
}

/* helpers que viven en la página: opacidad efectiva, ¿deja tinta?, ¿está dentro? */
await p.evaluate(({ CW, CH }) => {
  window.__qc = {
    efectiva(el, tope) { let o = 1, n = el
      while (n && n !== tope && n.id !== 'frame') { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement }
      return o },
    /* ⛔ No alcanza "tiene opacidad y tiene ancho". Una escena que sale empujando
       sus elementos fuera del cuadro los deja opacos y con tamaño; y un wrapper
       de posición —un div 1080×420 sin fondo ni texto— ocupa caja y no pinta
       nada. Contar cajas dio 18 "pisadas" en un video impecable. */
    dentro(r) { return Math.min(r.right, CW) - Math.max(r.left, 0) > 6 && Math.min(r.bottom, CH) - Math.max(r.top, 0) > 6 },
    /* ⛔ getBoundingClientRect NO SABE DE overflow:hidden (5-sep-2026).
       El gate de banda marcó en rojo una lámina de S04 "9px dentro de la banda de subtítulos".
       Estaba dentro del rect, sí — pero su contenedor recorta en 1120 y la lámina caía en 1268:
       invisible. Verificado con una captura. Un rojo sobre algo que no se ve es un rojo falso, y
       un gate que miente se apaga. `visible` intersecta el rect con el de cada ancestro que
       recorta; si no queda nada, el elemento no está en pantalla. */
    visible(el, tope) {
      let r = el.getBoundingClientRect()
      let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom
      for (let n = el.parentElement; n && n !== tope; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
        const p = n.getBoundingClientRect()
        x1 = Math.max(x1, p.left); y1 = Math.max(y1, p.top)
        x2 = Math.min(x2, p.right); y2 = Math.min(y2, p.bottom)
        if (x2 - x1 <= 0 || y2 - y1 <= 0) return null
      }
      return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 }
    },
    pinta(c) {
      const t = c.tagName
      if (t === 'IMG' || t === 'VIDEO' || t === 'CANVAS' || t === 'svg' || t === 'SVG') return true
      const s = getComputedStyle(c)
      if (s.backgroundColor && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(s.backgroundColor) && s.backgroundColor !== 'transparent') return true
      if (s.backgroundImage && s.backgroundImage !== 'none') return true
      if (s.boxShadow && s.boxShadow !== 'none') return true
      if (parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0) return true
      for (const n of c.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true
      return false
    },
    escenas() {
      return [...document.querySelectorAll('.escena')].map(e => ({
        id: e.id, st: parseFloat(e.dataset.start), du: parseFloat(e.dataset.duration),
        tk: !!e.querySelector('.tk'),
        /* ⛔ Una CAPA convive con la secuencia a propósito — el hook textual vive
           en la banda alta mientras la escena de turno usa el resto. No es una
           pisada: es el diseño. Sigue entrando a tipo / assets / zona. */
        capa: e.hasAttribute('data-qc-capa'),
      }))
    },
  }
}, { CW, CH })

const ESC = await p.evaluate(() => window.__qc.escenas())
const hallazgos = []
const add = (nivel, chequeo, msg) => hallazgos.push({ nivel, chequeo, msg })
const corre = n => !SOLO || SOLO === n

/* ═══ 1 · PISADAS ═══════════════════════════════════════════════════════════ */
if (corre('pisadas')) {
  const ts = []
  for (let f = 0; f <= Math.round(FIN * FPS); f++) ts.push(+(f / FPS).toFixed(4))
  const vis = await p.evaluate((ts) => {
    const tl = window.__timelines.main, Q = window.__qc
    const esc = [...document.querySelectorAll('.escena')].filter(e => !e.hasAttribute('data-qc-capa'))
    return ts.map(t => { tl.time(t)
      return [t, esc.filter(e => {
        const o = Q.efectiva(e); if (o <= 0.004) return false
        return [...e.querySelectorAll('*')].some(c =>
          o * Q.efectiva(c, e) > 0.02 && Q.dentro(c.getBoundingClientRect()) && Q.pinta(c))
      }).map(e => e.id)]
    })
  }, ts)
  let tramos = [], act = null
  for (const [t, on] of vis) {
    if (on.length > 1) { const k = on.join('+')
      if (act && act.k === k && Math.abs(t - act.fin) < 1.5 / FPS) act.fin = t
      else { if (act) tramos.push(act); act = { k, ini: t, fin: t } }
    } else if (act) { tramos.push(act); act = null }
  }
  if (act) tramos.push(act)
  for (const x of tramos) {
    const d = +(x.fin - x.ini).toFixed(2)
    if (d > GRACIA) add('ERROR', 'pisadas', `${x.ini.toFixed(2)}–${x.fin.toFixed(2)}s (${d}s) ${x.k} — una escena sigue pintando sobre la siguiente`)
    else add('ok', 'pisadas', `${x.ini.toFixed(2)}–${x.fin.toFixed(2)}s (${d}s) ${x.k} — salida de takeover`)
  }
}

/* ═══ 1b · CAPAS QUE NO PINTAN ══════════════════════════════════════════════
   `pisadas` sólo mira escenas y descarta las capas a propósito, así que nadie
   miraba si la capa se ve. El 16-ago el hook textual quedó inyectado, con su
   timeline y su CSS correctos, y NO se vio en un solo frame: entra al final del
   DOM con data-start="0" y envenenaba el "siguiente" del loop de visibilidad
   del master, que lo apagaba en el frame 0. `hyperframes check` dio 0 errores
   —el elemento existe y está en ventana— y esto tampoco lo cazaba. Lo cazó el
   ojo de Walter en el preview, un día después. Es exactamente el tipo de bug
   que esta herramienta existe para convertir en medición. */
if (corre('capas')) {
  const capas = ESC.filter(e => e.capa)
  const res = capas.length ? await p.evaluate((capas) => {
    const tl = window.__timelines.main, Q = window.__qc
    const N = 40
    return capas.map(c => {
      const el = document.getElementById(c.id)
      let on = 0, primera = null
      for (let i = 0; i <= N; i++) {
        const t = c.st + c.du * (i / N)
        tl.time(t)
        const o = Q.efectiva(el)
        const pinta = o > 0.004 && [...el.querySelectorAll('*')].some(x =>
          o * Q.efectiva(x, el) > 0.02 && Q.dentro(x.getBoundingClientRect()) && Q.pinta(x))
        if (pinta) { on++; if (primera === null) primera = +t.toFixed(2) }
      }
      return { id: c.id, on, N: N + 1, primera }
    })
  }, capas) : []
  for (const r of res) {
    if (!r.on) add('ERROR', 'capas', `${r.id} no pinta en NINGUNA de las ${r.N} muestras de su ventana — está en el archivo, pasa check, y no se ve`)
    else add('ok', 'capas', `${r.id} pinta en ${r.on}/${r.N} muestras · primera en ${r.primera}s`)
  }
}

/* ═══ 1c · LA BANDA DE SUBTÍTULOS ES TERRENO RESERVADO ══════════════════════
   Los subtítulos NO se hacen acá: van con caption-kit sobre el master ya
   renderizado (ver SUBTITULOS.md). Su estilo `doac-moi` pone el plano en
   y 1382–1843 — un dato medido sobre los shorts de DOAC, no una preferencia.

   Si el master pinta gráficos ahí, el subtítulo aterriza encima y no hay flag
   del kit que lo salve: `plan.py` no sabe excluir ventanas de tiempo. El
   17-ago-2026 pasó exactamente eso —el muro de comentarios y las 4 fotos de
   `tu-carrera` ocupaban la banda, y 120 de 533 líneas del plan caían encima—.
   La decisión de Walter fue que **el master reserva la banda**, para que el kit
   siga siendo genérico y no haya que parchearlo por video.

   Escotilla: data-qc-banda-ok en el elemento que va ahí a propósito (y asume
   que ese video no lleva subtítulos, o que el subtítulo lo esquiva).
   La banda se puede mover con --banda 1382,1843. Una placa a sangre no cuenta:
   es el SUELO sobre el que se apoya el subtítulo, no un choque. */
/* ── LA BANDA TAMBIÉN ES UN DATO DEL VIDEO (17-ago-2026) ────────────────────
   El default 1382–1843 salió de medir los shorts de DOAC: es dónde caerían
   NUESTROS subtítulos. Pero un corte que llega con subtítulos ya quemados
   —el de uplabs— los tiene en otro lado (1320–1520), y medir contra la banda
   ajena reporta choques donde no hay y calla los que sí. Mismo arreglo que
   data-qc-cara: sale del frame, y el flag sigue mandando por encima. */
const BANDA_FLAG = val('banda', null)
const bandaAttr = frame.match(/data-qc-banda="(\d+)\s*,\s*(\d+)"/)
const bandaSrc = BANDA_FLAG ? '--banda' : bandaAttr ? 'data-qc-banda' : 'DEFAULT'
const [BSUP, BINF] = (BANDA_FLAG || (bandaAttr ? `${bandaAttr[1]},${bandaAttr[2]}` : '1382,1843'))
  .split(',').map(Number)
if (corre('banda')) {
  const invasores = await p.evaluate(({ ESC, BSUP, BINF, CW, CH }) => {
    const tl = window.__timelines.main, Q = window.__qc
    const LIENZO = CW * CH
    const esMedia = c => ['IMG', 'CANVAS', 'svg', 'SVG', 'VIDEO'].includes(c.tagName)
    const conTexto = c => [...c.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
    const sel = c => c.id ? '#' + c.id : (c.className && typeof c.className === 'string' ? '.' + c.className.trim().split(/\s+/)[0] : c.tagName.toLowerCase())
    const out = []
    for (const e of ESC) {
      if (e.capa) continue
      const el = document.getElementById(e.id)
      let peor = null
      for (const frac of [0.25, 0.5, 0.75, 0.95]) {
        tl.time(e.st + e.du * frac)
        const oe = Q.efectiva(el); if (oe <= 0.02) continue
        for (const c of el.querySelectorAll('*')) {
          if (oe * Q.efectiva(c, el) <= 0.06) continue
          /* closest, no hasAttribute: declarar la escotilla en un takeover
             tiene que cubrir lo que lleva adentro. El gate de zona ya usaba
             closest para data-qc-cara-ok; éste se había quedado atrás y
             obligaba a repetir el atributo en cada hijo. */
          if (c.closest('[data-qc-banda-ok]')) continue
          const r = Q.visible(c, el)          // recortado por sus ancestros: lo que de verdad se ve
          if (!r) continue
          const solape = Math.min(r.bottom, BINF) - Math.max(r.top, BSUP)
          if (solape <= 8 || Math.min(r.right, CW) - Math.max(r.left, 0) <= 8) continue
          if (r.width * r.height >= 0.85 * LIENZO && !esMedia(c) && !conTexto(c)) continue  // el suelo
          if (!Q.pinta(c)) continue
          if (!peor || solape > peor.px) peor = { sel: sel(c), px: Math.round(solape), top: Math.round(r.top), bottom: Math.round(r.bottom) }
        }
      }
      if (peor) out.push({ id: e.id, st: e.st, du: e.du, ...peor })
    }
    return out
  }, { ESC, BSUP, BINF, CW, CH })
  for (const e of ESC.filter(x => !x.capa)) {
    const bad = invasores.find(i => i.id === e.id)
    if (bad) add('ERROR', 'banda', `${bad.id} (${bad.st}–${(bad.st + bad.du).toFixed(2)}s) invade la banda de subtítulos con ${bad.sel} — ${bad.px}px dentro (caja ${bad.top}–${bad.bottom}, banda ${BSUP}–${BINF})`)
    else add('ok', 'banda', `${e.id} deja libre ${BSUP}–${BINF}`)
  }

  /* --ventanas: la salida que come el kit de subtítulos. Se emite en vez del
     reporte, ya lista para pegar en `caption.sh ... --sin "<esto>"`. La regla
     de Walter (17-ago) es "si es gráfico o takeover, no va subtítulo" — y la
     lista de CUÁNDO no se teclea nunca: se mide acá y se pasa allá. */
  if (args.includes('--ventanas')) {
    const v = invasores.map(i => [i.st, +(i.st + i.du).toFixed(2)]).sort((a, b) => a[0] - b[0])
    const m = []
    for (const [a, z] of v) {
      const u = m[m.length - 1]
      if (u && a <= u[1] + 0.05) u[1] = Math.max(u[1], z); else m.push([a, z])
    }
    await b.close(); srv.close()
    console.log(m.map(([a, z]) => `${a}-${z}`).join(','))
    process.exit(0)
  }
}

/* ═══ 2 · TIPOGRAFÍA · 3 · ASSETS · 4 · ZONA SEGURA ═════════════════════════
   Se muestrean las escenas en su punto medio-tardío (60 % de su ventana), que
   es cuando ya entró todo. Para la zona segura se barre más fino porque lo que
   importa ahí es la DURACIÓN, no la presencia. */
const medidas = await p.evaluate(({ ESC, CW, CH, CARA_A, CARA_B, FPS }) => {
  const tl = window.__timelines.main, Q = window.__qc
  const tipo = [], assets = [], zona = []
  const vistoImg = new Set()

  /* ⛔ VARIOS puntos de muestreo por escena, no uno.
     La primera versión muestreaba al 60 % de la ventana y se saltaba TODO
     titular que entra tarde: `t26` entra en 98,72 dentro de una escena que se
     muestreaba en 98,11, así que el gate no lo veía — y `t26` es justamente uno
     de los dos titulares que se salían del cuadro y que motivaron esta
     herramienta. Un gate que no habría cazado su propio caso fundacional no es
     un gate. */
  const MUESTRAS = [0.30, 0.55, 0.78, 0.94]
  const yaMedido = new Set()
  for (const e of ESC) {
    const el = document.getElementById(e.id)
    for (const frac of MUESTRAS) {
    tl.time(e.st + e.du * frac)

    /* ── tipografía ────────────────────────────────────────────────────────
       ⛔ Se mide la CAJA DE MAQUETADO (offset*), no el rect: en el instante de
          muestreo el elemento puede estar a mitad de un tween de escala o
          empujado fuera del cuadro a propósito, y el rect miente. La primera
          versión reportó "OPERACIONES desborda su caja por 1082 px" — era el
          sello a mitad del golpe, con scale 2,2. Lo que se valida es el DISEÑO.
       ⛔ Sólo elementos de BLOQUE, y el más externo: midiendo también los
          <span> interiores, un inline tiene clientWidth 0, caía al ancho del
          rect y TODOS los titulares daban "0 px de margen".
       ⛔ Y se saltan los invisibles en ese instante: el sello de S11 ya se
          retiró a y:-540 cuando se muestrea, y salía "SE SALE por arriba". */
    const esBloque = c => ['block','flex','grid','inline-block'].includes(getComputedStyle(c).display)
    for (const c of el.querySelectorAll('*')) {
      const s = getComputedStyle(c)
      const fs = parseFloat(s.fontSize)
      if (fs < 60 || !c.textContent.trim() || !esBloque(c)) continue
      const pa = c.parentElement
      if (pa && pa !== el && parseFloat(getComputedStyle(pa).fontSize) >= 60 && pa.textContent.trim()) continue
      if (Q.efectiva(c, el) <= 0.02) continue
      const clave = e.id + '|' + (c.id || c.className) + '|' + c.textContent.trim().slice(0, 20)
      if (yaMedido.has(clave)) continue
      yaMedido.add(clave)
      const W = c.offsetWidth, H = c.offsetHeight
      if (W < 4 || H < 4) continue
      let x = 0, y = 0, n = c
      while (n && n.id !== 'frame') { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
      const r = c.getBoundingClientRect()
      const k = W ? (r.width / W) || 1 : 1              /* escala viva, para normalizar */
      const lh = parseFloat(s.lineHeight) || fs * 1.2
      const rng = document.createRange(); rng.selectNodeContents(c)
      const ancho = Math.max(0, ...[...rng.getClientRects()].map(z => z.width)) / k
      tipo.push({ escena: e.id, texto: c.textContent.trim().slice(0, 34), fs: Math.round(fs),
        lineas: Math.max(1, Math.round(H / lh)), ancho: Math.round(ancho),
        caja: Math.round(c.clientWidth || W), top: Math.round(y), bottom: Math.round(y + H) })
    }

    /* ── assets: renderizado vs natural ── */
    for (const im of el.querySelectorAll('img')) {
      const src = (im.getAttribute('src') || '').split('/').pop()
      const key = e.id + '|' + src
      if (vistoImg.has(key)) continue
      vistoImg.add(key)
      const r = im.getBoundingClientRect()
      if (r.width < 4 || !im.naturalWidth) continue
      /* también el alto: un <img> con width y height fijos se estira en un eje
         solo y el ancho no lo delata */
      const rw = r.width / im.naturalWidth
      const rh = im.naturalHeight ? r.height / im.naturalHeight : rw
      assets.push({ escena: e.id, src, rend: Math.round(r.width), nat: im.naturalWidth,
        ratio: +Math.max(rw, rh).toFixed(2),
        exento: im.hasAttribute('data-qc-escala-ok') || !!im.closest('[data-qc-escala-ok]') })
    }
    }
  }

  /* ── zona segura: cuánto TIEMPO hay algo estático sobre su cara ── */
  for (const e of ESC) {
    if (e.tk) continue                     /* el takeover es pantalla completa por diseño */
    const el = document.getElementById(e.id)
    let frames = 0, peor = null
    const paso = 3 / FPS
    for (let t = e.st; t < e.st + e.du; t += paso) {
      tl.time(t)
      const o0 = Q.efectiva(el); if (o0 <= 0.004) continue
      let hit = null
      for (const c of el.querySelectorAll('*')) {
        if (c.hasAttribute('data-qc-cara-ok') || c.closest('[data-qc-cara-ok]')) continue
        if (o0 * Q.efectiva(c, el) <= 0.02 || !Q.pinta(c)) continue
        const r = c.getBoundingClientRect()
        const w = Math.min(r.right, CW) - Math.max(r.left, 0)
        const h = Math.min(r.bottom, CARA_B) - Math.max(r.top, CARA_A)
        if (w > 0 && h > 0 && w * h > 30000) { hit = { sel: c.id || c.className || c.tagName, area: Math.round(w * h) }; break }
      }
      if (hit) { frames++; if (!peor || hit.area > peor.area) peor = hit }
    }
    if (frames) zona.push({ escena: e.id, seg: +(frames * paso).toFixed(2), peor })
  }
  return { tipo, assets, zona }
}, { ESC, CW, CH, CARA_A, CARA_B, FPS })

if (corre('tipo')) for (const t of medidas.tipo) {
  const et = `${t.escena} "${t.texto}" ${t.fs}px ${t.lineas}L`
  if (t.bottom > CH - 20) add('ERROR', 'tipo', `${et} — SE SALE por abajo (fin ${t.bottom} > ${CH - 20})`)
  else if (t.top < 20) add('ERROR', 'tipo', `${et} — SE SALE por arriba (top ${t.top})`)
  else if (t.ancho > t.caja + 1) add('ERROR', 'tipo', `${et} — la línea (${t.ancho}) desborda su caja (${t.caja})`)
  else if (t.caja && t.ancho / t.caja > 0.985) add('AVISO', 'tipo', `${et} — ${t.caja - t.ancho}px de margen: una ruleta, no un diseño`)
  else add('ok', 'tipo', `${et} · ${t.ancho}/${t.caja} · fin ${t.bottom}`)
}

/* ⛔ Sólo el ESTIRADO es un aviso. Achicar una foto o un escudo es correcto —
   la primera versión tiraba 28 avisos porque marcaba todo lo mostrado a menos
   de la mitad, y los 5 escudos de universidad (960 px de origen a 48 px en
   pantalla) son exactamente el uso correcto de un logo. El caso que sí duele
   —una captura de web con texto chico— no se puede distinguir desde afuera del
   bitmap, así que se lista con `--assets-todo` y lo juzga el ojo. */
if (corre('assets')) for (const a of medidas.assets) {
  const et = `${a.escena} ${a.src} ${a.rend}px de ${a.nat}px (${a.ratio}×)`
  if (a.exento) { add('ok', 'assets', `${et} — exento`); continue }
  /* ⛔ UN SVG NO SE ESTIRA. El "natural" de un vector es su viewBox, que es una
     unidad de autoría, no una resolución: el lockup de Uplabs mide 159×24 y a
     398 px sale igual de nítido que a 3980. Marcarlo entrena a ignorar avisos,
     que es peor que no tener el chequeo. (Única excepción real: un SVG que
     envuelve un <image> rasterizado — eso sí se pixela, y hay que verlo a ojo.) */
  if (/\.svg(\?|$)/i.test(a.src)) { add('ok', 'assets', `${et} — vector, no aplica`); continue }
  if (a.ratio > 1.15) add('AVISO', 'assets', `${et} — ESTIRADO, va a salir blando`)
  else if (a.ratio < 0.5 && TODO_ASSETS) add('AVISO', 'assets', `${et} — mostrado chico; si es captura con texto, miralo`)
  else add('ok', 'assets', et)
}

if (corre('zona')) for (const z of medidas.zona) {
  const et = `${z.escena} ${z.seg}s sobre su cara (${z.peor?.sel})`
  if (z.seg > 0.6) add('ERROR', 'zona', `${et} — no es un transitorio, le tapa la cara`)
  else add('ok', 'zona', `${et} — transitorio`)
}

/* ══ VIVAS — ¿cada escena DIBUJA algo dentro de su ventana? ══════════════════
   ⛔ POR QUÉ EXISTE (18-ago-2026, uplabs). Dos veces en una sesión el video
   entero salió en negro —una recursión infinita en un helper de entrada, y
   antes un `var t` que le pisaba el parámetro a su sub-timeline— y las tres
   puertas dieron VERDE las dos veces. No es que fallaran: `pisadas` busca dos
   escenas pintando a la vez, `banda`/`zona` miden lo que invade una franja, y
   `tipo`/`assets` recorren lo que existe. NINGUNA pregunta lo más básico:
   ¿hay algo en pantalla? Con cero elementos, cero invasiones y cero solapes:
   un video en negro es el estado más limpio posible para los otros chequeos.
   Lo cazó a mano un contact-sheet, las dos veces. Esto lo vuelve una medición.
   La escena de puro footage es legítima: se declara con data-qc-vacia-ok. */
if (corre('vivas')) {
  const muertas = await p.evaluate(({ ESC }) => {
    const tl = window.__timelines.main, Q = window.__qc
    const out = []
    for (const e of ESC) {
      const el = document.getElementById(e.id)
      if (!el || el.hasAttribute('data-qc-vacia-ok')) continue
      let max = 0
      for (const frac of [0.15, 0.35, 0.55, 0.75, 0.92]) {
        tl.time(e.st + e.du * frac)
        if (Q.efectiva(el) <= 0.02) continue
        let n = 0
        for (const c of el.querySelectorAll('*')) {
          const r = c.getBoundingClientRect()
          if (r.width < 8 || r.height < 8) continue
          if (Q.efectiva(c, el) <= 0.06 || !Q.pinta(c)) continue
          n++
        }
        if (n > max) max = n
      }
      out.push({ id: e.id, max, st: e.st, du: e.du })
    }
    return out
  }, { ESC })
  for (const m of muertas) {
    if (m.max === 0) add('ERROR', 'vivas', `${m.id} (${m.st}–${(m.st + m.du).toFixed(2)}s) NO DIBUJA NADA en toda su ventana — la escena existe en el HTML y no llega al cuadro`)
    else add('ok', 'vivas', `${m.id} pinta hasta ${m.max} elemento(s)`)
  }
}

/* ═══ 5 · LA CÁMARA ═════════════════════════════════════════════════════════
   Cobertura previa: CERO, y era estructural. #cam es HERMANO de las .escena, y todos los
   gates recorren `el.querySelectorAll('*')` con el = una .escena — así que el wrapper del
   footage no entraba en ningún barrido. La tabla CAM se tecleaba a mano y nadie la miraba.

   Este gate NO lee la tabla: mide el TRANSFORM RENDERIZADO de #cam cuadro a cuadro. Un mapa
   declarado y un video no son lo mismo, y el que se ve es el segundo. (La tabla declarada la
   valida `map-beats.mjs --check` sobre master/BEATS.json — son dos cosas distintas y las dos
   sirven.)

   ⛔ NO TENER CÁMARA ES LEGÍTIMO. nacho-brain-rot no carga motion.js ni tiene #cam, y
   START_HERE dice que en algunos videos la regla es cero movimiento. La ausencia sale `ok`,
   nunca error: un gate que exige una feature opcional es un gate que se desactiva. */
if (corre('camara')) {
  const cam = await p.evaluate(({ FIN, FPS, CW, CH }) => {
    const el = document.querySelector('#cam')
    if (!el) return { hay: false }
    const tl = window.__timelines.main
    const paso = 3 / FPS, out = []
    for (let t = 0; t <= FIN + 1e-6; t += paso) {
      tl.time(Math.min(t, FIN))
      const cs = getComputedStyle(el)
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform)
      const o = cs.transformOrigin.split(' ')
      out.push({
        t: +t.toFixed(3),
        sc: +Math.hypot(m.a, m.b).toFixed(4),
        ox: +((parseFloat(o[0]) / CW) * 100).toFixed(1),
        oy: +((parseFloat(o[1]) / CH) * 100).toFixed(1),
      })
    }
    return { hay: true, out }
  }, { FIN, FPS, CW, CH })

  if (!cam.hay) {
    add('ok', 'camara', 'este master no tiene #cam — sin cámara, que es una opción válida')
  } else {
    const m = cam.out
    const TECHO = +val('camara-techo', ETIQ_TECHO)
    const SALTO = 0.02, MIN_MOV = 0.11, RUIDO = 0.002, MIN_DUR = 0.3

    /* ① SALTO — pero SÓLO fuera de un corte (30-ago-2026).
       La v1 de este chequeo marcaba TODA discontinuidad de escala y sacó 20 errores sobre
       tu-carrera, que es un video entregado y aprobado. El video tenía razón y el gate no:
       la doctrina del 13-ago dice que «lo que produce el dinamismo es EL CORTE entre dos
       escalas, no el movimiento dentro de una», y que un jump cut se DISIMULA cambiando de
       escala. O sea que el salto en el corte es la técnica, no el defecto — medido: en
       tu-carrera la escala pasa de 1.06 a 1.00 exactamente en 5.44 s, que es donde arranca
       la escena siguiente.
       La v2 marcaba en rojo el salto que no caía en el arranque de una .escena — y seguía
       cantando 4 rojos en tu-carrera y 8 en tecnico, los dos entregados. También estaba mal:
       los cortes de CÁMARA caen en cortes del FOOTAGE, que el DOM no conoce. tecnico tiene 7
       tramos para 1 escena («sus cortes son beats narrativos») y que-es-startup tiene un jump
       cut anotado a mano en 43,96 dentro de S13.

       Conclusión medida: desde el render NO se puede distinguir un corte de escala deliberado
       de un pop accidental. Así que esto es un AVISO, no un error — informa dónde cambia la
       escala fuera del arranque de una escena y Walter confirma. Un gate que canta rojo sobre
       trabajo entregado se desactiva solo, y entonces no gatea nada. */
    const cortes = ESC.map(e => e.st).concat([0]).sort((a, b) => a - b)
    const enCorte = (t) => cortes.some(c => Math.abs(c - t) <= 2 / FPS)
    let saltos = 0, enCortes = 0
    for (let i = 1; i < m.length; i++) {
      const d = Math.abs(m[i].sc - m[i - 1].sc)
      if (d <= SALTO) continue
      if (enCorte(m[i].t)) { enCortes++; continue }
      saltos++
      add('AVISO', 'camara', `la escala cambia ${m[i - 1].sc.toFixed(3)} → ${m[i].sc.toFixed(3)} en ${m[i].t.toFixed(2)}s y ahí no arranca ninguna escena — si no cae en un corte del footage, es un pop`)
    }
    if (!saltos) add('ok', 'camara', `continuidad: ningún pop fuera de un corte (${enCortes} cambio(s) de escala en corte, que es la técnica)`)

    /* ② TECHO — número duro, medido: arriba de esto la fuente del corte se ablanda. */
    const alto = m.reduce((a, x) => x.sc > a.sc ? x : a, m[0])
    if (alto.sc > TECHO + 0.005) add('ERROR', 'camara', `escala ${alto.sc.toFixed(3)} en ${alto.t.toFixed(2)}s pasa el techo ${TECHO} — la fuente se ablanda`)
    else add('ok', 'camara', `techo: máximo ${alto.sc.toFixed(3)} ≤ ${TECHO}`)

    /* ③ ORIGEN — la regla del 13-ago: el origen se corre por escena, si no dos escenas a la
       misma escala se leen como la misma toma. La escotilla es para el caso medido de
       tecnico-vs-no-tecnico (originY 0 SIEMPRE, y su comentario dice que no es copiable). */
    const origenes = new Set(m.map(x => `${x.ox},${x.oy}`))
    const ORIGEN_OK = html.includes('data-qc-camara-origen-ok')
    if (origenes.size === 1 && !ORIGEN_OK)
      add('ERROR', 'camara', `el origen es ${[...origenes][0]} % en TODO el video — dos escenas a la misma escala se leen como la misma toma. Si es a propósito y está medido, declaralo con data-qc-camara-origen-ok en el #frame`)
    else
      add('ok', 'camara', `origen: ${origenes.size} posición(es) distinta(s)${ORIGEN_OK && origenes.size === 1 ? ' (constante, declarado a propósito)' : ''}`)

    /* ④ MOVIMIENTO — cada tramo de cambio continuo tiene que MOVER. Aviso y no error: un
       hold mueve 0 por diseño y el umbral es de gusto, no de rotura. */
    let tramos = 0
    for (let i = 0; i < m.length - 1;) {
      if (Math.abs(m[i + 1].sc - m[i].sc) <= RUIDO) { i++; continue }   // quieto: no es un tramo
      let j = i
      while (j < m.length - 1 && Math.abs(m[j + 1].sc - m[j].sc) > RUIDO) j++
      const d = Math.abs(m[j].sc - m[i].sc)
      /* los micro-tramos son ruido de muestreo o el arranque de un fromTo, no una intención */
      if (m[j].t - m[i].t < MIN_DUR) { i = j + 1; continue }
      tramos++
      if (d < MIN_MOV)
        add('AVISO', 'camara', `el tramo ${m[i].t.toFixed(2)}–${m[j].t.toFixed(2)}s mueve ${(d * 100).toFixed(0)} % — debajo de ${(MIN_MOV * 100).toFixed(0)} % es el push invisible`)
      i = j
    }
    add('ok', 'camara', `${tramos} tramo(s) de movimiento medidos`)

    /* ⑤ COLA — la forma OBSERVABLE de "la cámara no cubre todo": si los tramos declarados
       no llegan al final, la escala se congela y el cierre queda muerto. */
    let quieta = FIN
    for (let i = m.length - 1; i > 0; i--) { if (Math.abs(m[i].sc - m[i - 1].sc) > RUIDO) { quieta = FIN - m[i].t; break } }
    if (quieta > Math.max(6, FIN * 0.15))
      add('AVISO', 'camara', `los últimos ${quieta.toFixed(1)}s no tienen movimiento de cámara — ¿los tramos llegan hasta el final del corte?`)
    else add('ok', 'camara', `la cámara llega al cierre (${quieta.toFixed(1)}s quietos al final)`)
  }
}

/* ═══ 6 · EL VIDEO CONTRA SU MAPA ═══════════════════════════════════════════
   ⛔ DOS VERDES QUE NO SE HABLAN NO SON UN VERDE (30-ago-2026).
   `map-beats --check` mide el MAPA. Los gates de arriba miden el VIDEO. Ninguno de los dos
   verifica que el video SEA el mapa: se podía declarar `takeover: true` en tres beats,
   construir cero, y las dos herramientas daban verde. Es el mismo modo de falla que ya se
   pagó tres veces en este repo —el kit medido contra el guion en vez del corte, la tabla CAM
   como segunda copia tecleada a mano de las ventanas de beat, el hook que entraba a medias—
   y las tres veces el problema fue el mismo: DOS COSAS QUE TENÍAN QUE COINCIDIR Y NADIE
   COMPARÓ.

   Sin BEATS.json sale `ok`: los master viejos no tienen mapa y no se los va a marcar en rojo
   por eso (flujo.mjs sí lo pide para los nuevos, que es donde corresponde). */
if (corre('mapa')) {
  const mapaPath = resolve(master, 'BEATS.json')
  if (!existsSync(mapaPath)) {
    add('ok', 'mapa', 'sin master/BEATS.json — este master es anterior al mapa, no se compara')
  } else {
    let MAPA = null
    try { MAPA = JSON.parse(readFileSync(mapaPath, 'utf8')) }
    catch (e) { add('ERROR', 'mapa', `BEATS.json ilegible — ${e.message}`) }

    if (MAPA) {
      const bs = MAPA.beats || []

      /* ① EL HOOK — es obligatorio en el carril master. Que esté en el mapa no prueba que
         esté en el video: justamente el bug del 16-ago fue un hook que quedó en el archivo
         y no se animó nunca. */
      const hookDOM = await p.evaluate(() => {
        const h = document.querySelector('#HOOK')
        return h ? { texto: h.getAttribute('data-hook-texto') || '', dur: +h.dataset.duration } : null
      })
      if (MAPA.hook?.texto && !hookDOM)
        add('ERROR', 'mapa', `el mapa declara el hook "${MAPA.hook.texto}" y en el video NO HAY #HOOK — corré hook-textual.mjs`)
      else if (MAPA.hook?.texto && hookDOM && hookDOM.texto.trim() !== MAPA.hook.texto.trim())
        add('ERROR', 'mapa', `el hook del video dice "${hookDOM.texto}" y el mapa dice "${MAPA.hook.texto}" — driftaron`)
      else if (hookDOM)
        add('ok', 'mapa', `hook presente y coincide: "${hookDOM.texto}"`)

      /* ② LOS TAKEOVER — declarados vs construidos. En los dos sentidos: uno declarado y no
         construido es trabajo que falta; uno construido y no declarado es una decisión que
         no pasó por el mapa (que es donde se aprueban). */
      const tkEsc = ESC.filter(e => e.tk)
      for (const b of bs.filter(x => x.takeover)) {
        const hay = tkEsc.some(e => e.st < b.end - 0.05 && (e.st + e.du) > b.start + 0.05)
        if (!hay) add('ERROR', 'mapa', `${b.id} (${b.start}–${b.end}s) declara takeover en el mapa y NO hay ningún .tk en esa ventana`)
        else add('ok', 'mapa', `${b.id}: takeover declarado y construido`)
      }
      for (const e of tkEsc) {
        const dec = bs.some(b => b.takeover && b.start < (e.st + e.du) - 0.05 && b.end > e.st + 0.05)
        if (!dec) add('AVISO', 'mapa', `${e.id} tiene un takeover construido que el mapa NO declara — los takeover se aprueban en el mapa`)
      }

      /* ③ LA CÁMARA — el mapa contra lo que de verdad se renderiza. Esto es lo que mata el
         modo de falla de la tabla CAM tecleada a mano: si el array del html driftó del mapa,
         acá se ve. Se mide en el MEDIO del tramo, lejos de los bordes donde hay tween. */
      const cam = MAPA.camara || []
      if (cam.length) {
        const esperado = cam.map(t => {
          const ini = t.kind === 'out' ? t.base + t.amount : t.base
          const fin = t.kind === 'in' ? t.base + t.amount : t.base
          return { t: (t.start + t.end) / 2, sc: (ini + fin) / 2, start: t.start, end: t.end }
        }).filter(x => x.t <= FIN)
        const medido = await p.evaluate(({ pts }) => {
          const el = document.querySelector('#cam'); if (!el) return null
          const tl = window.__timelines.main
          return pts.map(x => {
            tl.time(x.t)
            const cs = getComputedStyle(el)
            const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform)
            return +Math.hypot(m.a, m.b).toFixed(4)
          })
        }, { pts: esperado })
        if (!medido) add('ERROR', 'mapa', `el mapa declara ${cam.length} tramo(s) de cámara y el video no tiene #cam`)
        else {
          let drift = 0
          for (let i = 0; i < esperado.length; i++) {
            const d = Math.abs(medido[i] - esperado[i].sc)
            if (d > 0.015) { drift++; add('ERROR', 'mapa', `el tramo ${esperado[i].start}–${esperado[i].end}s debería estar en ~${esperado[i].sc.toFixed(3)} y el video mide ${medido[i].toFixed(3)} — el mapa y el html driftaron`) }
          }
          if (!drift) add('ok', 'mapa', `cámara: ${esperado.length} tramo(s) coinciden con el mapa`)
        }
      }

      /* ④ LAS VENTANAS — aviso, no error: en master la cámara y las escenas no son 1:1 y un
         beat puede construirse en más de una escena. Lo que importa es que no haya un beat
         del mapa sin NADA construido cerca. */
      let huerfanos = 0
      for (const b of bs) {
        const hay = ESC.some(e => !e.capa && e.st < b.end - 0.05 && (e.st + e.du) > b.start + 0.05)
        if (!hay) { huerfanos++; add('AVISO', 'mapa', `${b.id} (${b.start}–${b.end}s) está en el mapa y no tiene ninguna escena construida en su ventana`) }
      }
      if (!huerfanos) add('ok', 'mapa', `los ${bs.length} beats del mapa tienen escena construida`)
    }
  }
}


await b.close(); srv.close()

/* ═══ reporte ═══════════════════════════════════════════════════════════════ */

const err = hallazgos.filter(h => h.nivel === 'ERROR')
const avi = hallazgos.filter(h => h.nivel === 'AVISO')
/* ⛔ EL TERCER ESTADO TAMBIÉN EXISTE EN LA SALIDA DE MÁQUINA (30-ago-2026).
   Este `if` salía ANTES del bloque de NO VERIFICABLE de más abajo, así que con --json una
   composición con CERO escenas devolvía exit 0: para un humano el gate decía "no revisé
   nada", y para un script decía "todo bien". La distinción sólo servía si mirabas. */
const medidos = hallazgos.length
const noVerificable = !ESC.length || !medidos
const veredicto = err.length ? 'ERROR' : noVerificable ? 'NO_VERIFICABLE' : 'OK'
const codigo = err.length ? 1 : noVerificable ? 2 : 0
if (JSON_OUT) {
  console.log(JSON.stringify({ video: dir, dur: FIN, escenas: ESC.length, medidos, veredicto, hallazgos }, null, 2))
  process.exit(codigo)
}

console.log(`\n${dir} · ${FIN}s · ${ESC.length} escenas · lienzo ${CW}×${CH} · zona viva y ${CARA_A}–${CARA_B} (${caraSrc})\n`)
for (const n of CHEQUEOS) {
  if (!corre(n)) continue
  const h = hallazgos.filter(x => x.chequeo === n)
  const e = h.filter(x => x.nivel === 'ERROR').length, a = h.filter(x => x.nivel === 'AVISO').length
  console.log(`── ${n.toUpperCase().padEnd(8)} ${e ? '✗ ' + e + ' error(es)' : '✓'}${a ? ' · ' + a + ' aviso(s)' : ''} · ${h.length} medido(s)`)
  for (const x of h) if (x.nivel !== 'ok') console.log(`   ${x.nivel === 'ERROR' ? '✗' : '⚠'} ${x.msg}`)
}
/* ⛔ UN GATE QUE NO MIDIÓ NADA NO SALE VERDE (29-ago-2026).
   `qc-master nacho-brain-rot` imprimía «✓ carril master limpio» sobre una composición con
   CERO escenas: 0 errores porque 0 mediciones. Ese verde es peor que un rojo, porque compra
   confianza sobre algo que nadie revisó. Mismo defecto que tenía validate-kit con las
   escenas v1. Tercer estado: NO VERIFICABLE, y sale por código 2 — ni éxito ni fallo. */
if (err.length) {
  console.log(`\n✗ ${err.length} ERROR(ES)${avi.length ? ` · ${avi.length} aviso(s)` : ''} — no renderices todavía`)
  process.exit(1)
}
if (noVerificable) {
  console.log(`\n? NO VERIFICABLE — ${!ESC.length ? 'la composición no tiene escenas' : 'ningún chequeo pudo medir'}.`)
  console.log(`  Esto NO es «limpio»: el gate no revisó nada. Si el entregable de este video`)
  console.log(`  no es el master, corré el gate del carril que corresponde.`)
  process.exit(2)
}
console.log(`\n✓ carril master limpio${avi.length ? ` · ${avi.length} aviso(s) para tu ojo` : ''} · ${medidos} medición(es)`)
process.exit(0)
