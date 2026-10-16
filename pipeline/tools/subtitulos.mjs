#!/usr/bin/env node
import {config,resolveProject,ROOT,projectSlug} from './project.mjs';
/* ============================================================================
   subtitulos.mjs — carril de subtítulos para el CARRIL MASTER.

       node tools/subtitulos.mjs <slug> [--sin "0-17.26"] [--cuerpo 56]
                                        [--y 1520] [--sin-medir] [--quitar]

   ⛔ POR QUÉ EXISTE, y por qué NO es el skill `embedded-captions`.
   La decisión anotada es "subtítulos con embedded-captions, NO compilador
   propio", y sigue siendo la correcta para un talking-head normal. Pero el
   skill tiene un portón que RECHAZA footage con texto quemado, y el master de
   `tu-carrera` tiene texto diseñado en prácticamente los 100 segundos (hoja de
   contacto a 1 fps: hook, muro de comentarios, 7 takeovers, placas, fotos,
   el método PVP). Además el skill no sabe excluir ventanas de tiempo, que es
   justo lo que hace falta acá. Cuando la herramienta elegida DECLINA el caso,
   la preferencia por esa herramienta no obliga.

   ── LAS TRES REGLAS QUE PIDIÓ WALTER (16-ago-2026) ─────────────────────────
   · más chicos que el resto de la tipografía de la pieza
   · NUNCA sobre un takeover — ahí la pantalla ya es texto
   · fuera del bloque inicial de comentarios, donde chocarían

   Los takeovers NO se listan a mano: se detectan solos leyendo qué escenas
   contienen un `.tk`. Teclear esa lista sería garantizar que se desincronice
   la próxima vez que se mueva una escena.

   ⚠️ 17-ago: la segunda regla se cumple MEJOR midiendo. "Takeover" no equivale
   a "banda ocupada" — la mitad son pictogramas con el pie del cuadro vacío, y
   vetarlos a todos dejaba 47 s de los 100 sin subtítulo (53 % de cobertura).
   Ahora se abre la composición y se mide si algo pinta en la banda del carril
   en el momento de cada frase. La regla que Walter pidió es "que no choque";
   esto la aplica de verdad en vez de aproximarla. `--sin-medir` vuelve al veto
   viejo.

   ⛔ El carril vive en la BANDA BAJA (y ≥ 1450). El FOOTAGE no cuenta como
   ocupación: el subtítulo va sobre su cara y su cuarto a propósito. Sólo los
   gráficos de escena vetan. `--sin` sigue mandando por encima de la medición.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = ROOT
const args = process.argv.slice(2)
const val = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] }
const slug = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--quitar'))
const CUERPO = +val('cuerpo', 56)
const Y = +val('y', 1520)
const MAXPAL = +val('palabras', 5)
const QUITAR = args.includes('--quitar')
const SIN = (val('sin', '') || '').split(',').filter(Boolean)
  .map(r => r.split('-').map(Number)).filter(r => r.length === 2)

if (!slug) { console.error('uso: node tools/subtitulos.mjs <slug> [--sin "a-b,c-d"] [--cuerpo 56] [--quitar]'); process.exit(1) }
const dir = projectSlug(resolveProject(slug))
if (!dir) { console.error(`✗ ningún video matchea '${slug}'`); process.exit(1) }
const selected=config(resolveProject(slug));
if(selected&&(selected.engine.name==='remotion'||selected.style!=='moi-overlay')){console.error('Este helper es del caption lane Moi HTML. Para el estilo seleccionado, editar captions en su composición nativa según el brief.');process.exit(2);}
const master = resolve(resolveProject(slug), 'master')
const IDX = resolve(master, 'index.html')
if (!existsSync(IDX)) { console.error(`✗ no hay master/index.html en ${dir}`); process.exit(1) }
let html = readFileSync(IDX, 'utf8')

if (QUITAR) {
  html = html.replace(/<!-- SUBS:INICIO -->[\s\S]*?<!-- SUBS:FIN -->/, '<!-- SUBS:INICIO --><!-- SUBS:FIN -->')
             .replace(/\/\* SUBS:JS:INICIO \*\/[\s\S]*?\/\* SUBS:JS:FIN \*\//, '/* SUBS:JS:INICIO */ /* SUBS:JS:FIN */')
  writeFileSync(IDX, html); console.log('✓ subtítulos quitados'); process.exit(0)
}

/* ── los takeovers se DETECTAN, no se teclean ─────────────────────────────── */
const bloques = [...html.matchAll(/<div[^>]*class="escena clip" id="(S\d+)"[^>]*data-start="([\d.]+)"[^>]*data-duration="([\d.]+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="escena clip"|<\/div>\s*<script)/g)]
const escenas = [...html.matchAll(/class="escena clip" id="(S\d+)" data-start="([\d.]+)" data-duration="([\d.]+)"/g)]
  .map(m => ({ id: m[1], st: +m[2], du: +m[3] }))
/* ⛔ Los .escena están VACÍOS en el HTML: el contenido lo inyecta el script en
   runtime con H('SNN', ...). Buscar class="tk" en el cuerpo devuelve CERO
   siempre — y un cero silencioso acá pone subtítulos encima de los 7
   takeovers, que es exactamente lo que no puede pasar. Se detecta por la
   llamada al helper, que es la convención del master. */
const idsTk = new Set()
for (const m of html.matchAll(/H\(\s*'(S\d+)'\s*,\s*tkwrap\(/g)) idsTk.add(m[1])
for (const m of html.matchAll(/id="(S\d+)"[^>]*>\s*<div[^>]*class="tk"/g)) idsTk.add(m[1])
if (!idsTk.size && /tkwrap\(/.test(html)) {
  console.error('✗ la composición usa tkwrap() pero no detecté NINGÚN takeover.')
  console.error('  Un cero acá pondría subtítulos encima de todos. Revisá el patrón antes de seguir.')
  process.exit(2)
}
const veta = escenas.filter(e => idsTk.has(e.id)).map(e => [e.st, e.st + e.du])
for (const r of SIN) veta.push(r)
veta.sort((a, b) => a[0] - b[0])
const vetado = (a, b) => veta.some(([x, y]) => a < y && b > x)

/* ── palabras → frases ────────────────────────────────────────────────────── */
const J = resolve(master, 'local/cut.json')
if (!existsSync(J)) { console.error('✗ falta local/cut.json (transcripción word-level)'); process.exit(1) }
const ws = JSON.parse(readFileSync(J, 'utf8')).segments.flatMap(s => s.words || [])
const frases = []
let cur = null
for (let i = 0; i < ws.length; i++) {
  const w = ws[i], t = w.word.trim()
  if (!cur) cur = { in: w.start, out: w.end, ps: [t] }
  else { cur.ps.push(t); cur.out = w.end }
  const sig = ws[i + 1]
  const pausa = sig ? sig.start - w.end : 9
  /* corta por puntuación fuerte, por pausa, o al llegar al tope de palabras */
  if (/[.,;:?!]$/.test(t) || pausa > 0.26 || cur.ps.length >= MAXPAL || !sig) {
    frases.push(cur); cur = null
  }
}
/* mínimo 0,5 s en pantalla: una frase más corta es ilegible → se funde con la anterior */
const limpias = []
for (const f of frases) {
  const prev = limpias[limpias.length - 1]
  if (f.out - f.in < 0.5 && prev && f.in - prev.out < 0.4 && prev.ps.length + f.ps.length <= MAXPAL + 2) {
    prev.ps.push(...f.ps); prev.out = f.out
  } else limpias.push(f)
}
/* ══ EL VETO SE MIDE, NO SE SUPONE ═════════════════════════════════════════
   La regla de Walter es "que no choque". "Nunca sobre un takeover" era la
   APROXIMACIÓN a esa regla, y aproximaba mal: se escribió pensando en los
   takeovers que son un muro de texto (`PEDÍAN PERMISO` ocupa el cuadro entero),
   pero varios son un pictograma con el pie del cuadro vacío — el diploma de
   S07 termina en y≈1040, la puerta de S26 en y≈1355. Vetarlos costaba 19,4 s
   de subtítulo sobre 100, sin que hubiera nada con qué chocar.

   Así que se abre la composición y se MIDE si la banda del carril está ocupada
   en el momento de cada frase. Ocupada = un gráfico de escena pintando ahí. El
   FOOTAGE no cuenta: el carril va sobre su cara y su cuarto a propósito — eso
   es un subtítulo, no una pisada.

   `--sin` sigue mandando por encima de la medición: es la escotilla para lo que
   el ojo sabe y el píxel no. `--sin-medir` vuelve al veto por takeover.
   ═══════════════════════════════════════════════════════════════════════════ */
const SIN_MEDIR = args.includes('--sin-medir')
const enSin = (a, b) => SIN.some(([x, y]) => a < y && b > x)
let libre = null, comoSeVetó = 'takeover declarado'

if (!SIN_MEDIR) {
  const req = createRequire(import.meta.url)
  let puppeteer = null
  try { puppeteer = (await import(req.resolve('puppeteer-core', { paths: [AQUI, RAIZ, process.cwd()] }))).default } catch {}
  const cacheChrome = resolve(process.env.HOME, '.cache/puppeteer/chrome')
  const build = existsSync(cacheChrome) ? readdirSync(cacheChrome).sort().pop() : null
  const CHROME = build && resolve(cacheChrome, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')

  if (!puppeteer || !CHROME || !existsSync(CHROME)) {
    console.log('⚠ sin puppeteer-core/Chrome: no puedo medir la banda, vuelvo al veto por takeover')
  } else {
    const frameTag = html.match(/<div[^>]*data-composition-id="main"[^>]*>/)?.[0] || ''
    const numAttr = (a, d) => +(frameTag.match(new RegExp(a + '="([\\d.]+)"'))?.[1] ?? d)
    const CW = numAttr('data-width', 1080), CH = numAttr('data-height', 1920)
    /* la banda: el ancho del carril y ALTO DE DOS LÍNEAS, que es el peor caso */
    const BANDA = { x0: 70, x1: CW - 70, y0: Y - 8, y1: Math.min(CH, Y + 2 * (CUERPO * 1.16) + 28 + 8) }

    const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json' }
    const srv = createServer((rq, rs) => {
      const f = resolve(master, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/+/, '') || 'index.html')
      if (!existsSync(f) || statSync(f).isDirectory()) { rs.writeHead(404).end(); return }
      rs.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' })
      rs.end(readFileSync(f))
    })
    await new Promise(r => srv.listen(0, r))
    const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
    const pg = await b.newPage()
    await pg.setViewport({ width: CW, height: CH, deviceScaleFactor: 1 })
    await pg.goto(`http://localhost:${srv.address().port}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise(r => setTimeout(r, 6000))

    if (!await pg.evaluate(() => !!(window.__timelines && window.__timelines.main))) {
      console.log('⚠ no encontré window.__timelines.main: vuelvo al veto por takeover')
      await b.close(); srv.close()
    } else {
      /* se mide con el carril ANTERIOR escondido, o se mediría a sí mismo */
      const ocupadas = await pg.evaluate(({ cand, BANDA }) => {
        const tl = window.__timelines.main
        const subs = document.getElementById('SUBS'); if (subs) subs.style.display = 'none'
        const efec = (el, tope) => { let o = 1, n = el
          while (n && n !== tope && n.id !== 'frame') { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement }
          return o }
        const pinta = c => {
          const t = c.tagName
          if (t === 'IMG' || t === 'CANVAS' || t === 'svg' || t === 'SVG') return true
          const s = getComputedStyle(c)
          if (s.backgroundColor && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(s.backgroundColor) && s.backgroundColor !== 'transparent') return true
          if (s.backgroundImage && s.backgroundImage !== 'none') return true
          if (parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0) return true
          for (const n of c.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true
          return false
        }
        const cruza = r => Math.min(r.right, BANDA.x1) - Math.max(r.left, BANDA.x0) > 8 &&
                           Math.min(r.bottom, BANDA.y1) - Math.max(r.top, BANDA.y0) > 8
        /* ⛔ UNA PLACA A SANGRE NO ES UNA PISADA, ES EL SUELO.
           Los takeovers tapan el footage con un fondo que cubre el cuadro
           entero. Contarlo como ocupación dejaba TODOS los takeovers vetados
           —el resultado idéntico al veto viejo— cuando lo que hay debajo del
           carril es un rectángulo oscuro vacío. Un fondo sin imagen ni texto
           que cubre ≥85 % del lienzo es la superficie sobre la que el subtítulo
           se apoya. Si ese mismo elemento trae texto o es una imagen, sí veta. */
        const LIENZO = BANDA.CW * BANDA.CH
        const esMedia = c => ['IMG', 'CANVAS', 'svg', 'SVG', 'VIDEO'].includes(c.tagName)
        const conTexto = c => [...c.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
        const esSuelo = (c, r) => r.width * r.height >= 0.85 * LIENZO && !esMedia(c) && !conTexto(c)
        /* ⛔ el <video> del a-roll NO ocupa: el carril va sobre el footage a
           propósito. Sólo cuentan los gráficos de escena. */
        const capas = [...document.querySelectorAll('.escena:not([data-qc-capa])')]
        return cand.map(f => {
          for (const frac of [0.2, 0.5, 0.8]) {
            tl.time(f.i + (f.o - f.i) * frac)
            for (const e of capas) {
              const oe = efec(e); if (oe <= 0.02) continue
              for (const c of e.querySelectorAll('*')) {
                if (oe * efec(c, e) <= 0.06) continue
                const r = c.getBoundingClientRect()
                if (!cruza(r) || esSuelo(c, r)) continue
                if (pinta(c)) return true
              }
            }
          }
          return false
        })
      }, { cand: limpias.map(f => ({ i: f.in, o: f.out })), BANDA: { ...BANDA, CW, CH } })
      await b.close(); srv.close()
      libre = limpias.map((_, i) => !ocupadas[i])
      comoSeVetó = `banda medida (x ${BANDA.x0}–${BANDA.x1}, y ${BANDA.y0}–${Math.round(BANDA.y1)})`
    }
  }
}

const usadas = [], razones = { sin: 0, ocupado: 0, takeover: 0 }
limpias.forEach((f, i) => {
  if (enSin(f.in, f.out)) { razones.sin++; return }
  if (libre ? !libre[i] : vetado(f.in, f.out)) { razones[libre ? 'ocupado' : 'takeover']++; return }
  usadas.push(f)
})
const fuera = limpias.length - usadas.length

/* ── inyección ────────────────────────────────────────────────────────────── */
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const datos = JSON.stringify(usadas.map(f => ({ i: +f.in.toFixed(2), o: +f.out.toFixed(2), t: f.ps.join(' ') })))

const bloqueHTML = `<!-- SUBS:INICIO -->
  <div class="escena clip" id="SUBS" data-start="0" data-duration="100.26" data-track-index="8" data-qc-capa style="opacity:1">
    <div id="sb-wrap" style="position:absolute;left:70px;right:70px;top:${Y}px;
         display:flex;align-items:flex-start;justify-content:center"></div>
  </div>
<!-- SUBS:FIN -->`

const bloqueJS = `/* SUBS:JS:INICIO */
  /* ⛔ El carril NO se anima: un subtítulo con entrada coreografiada le roba
     atención justo a lo que está diciendo. Corte seco con 4 cuadros de fundido,
     que es lo que hace cualquier reproductor.

     ⛔ Y el fundido NO se cruza entre frases PEGADAS. Todas las frases caen en
     el MISMO renglón: si la que sale todavía está a media opacidad cuando la
     que entra ya empezó, las dos se pintan superpuestas y queda un borrón
     ilegible —se vio en el frame de 96,5 s—. Un reproductor de verdad no cruza
     subtítulos: corta. Fundido sólo contra el vacío, en el borde de un hueco. */
  (function(){
    var SB = ${datos};
    var host = document.getElementById('sb-wrap');
    var FUNDE = 0.13, PEGADO = 0.12;
    SB.forEach(function(f,n){
      var d = document.createElement('div');
      d.id = 'sb'+n; d.className = 'sb-l';
      d.textContent = f.t;
      host.appendChild(d);
      var ant = SB[n-1], sig = SB[n+1];
      var pegAntes   = !!ant && f.i - ant.o <= PEGADO;
      var pegDespues = !!sig && sig.i - f.o <= PEGADO;
      tl.set(d,{opacity:0},0);
      if (pegAntes) tl.set(d,{opacity:1},f.i);
      else tl.to(d,{opacity:1,duration:FUNDE,ease:'none'},f.i);
      if (pegDespues) tl.set(d,{opacity:0},sig.i);
      else tl.to(d,{opacity:0,duration:FUNDE,ease:'none'},Math.max(f.i+0.24, f.o-0.04));
      tl.set(d,{opacity:0},(sig ? Math.max(f.o, sig.i) : f.o)+0.10);
    });
  })();
  /* SUBS:JS:FIN */`

const bloqueCSS = `
/* ── el carril de subtítulos ───────────────────────────────────────────────
   Más chico que todo lo demás de la pieza a propósito: los titulares van de
   136 a 198 px y las placas a 48; el subtítulo acompaña, no compite. Placa
   oscura porque nada flota sobre su cuarto (BRAND.md). */
.sb-l{position:absolute;left:0;right:0;margin:0 auto;width:max-content;max-width:100%;
  font-family:'Geist',sans-serif;font-weight:700;font-size:${CUERPO}px;line-height:1.16;
  color:var(--fg);text-align:center;letter-spacing:-.01em;
  background:rgba(var(--ink-rgb),.88);border-radius:16px;padding:14px 26px;
  box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0}
`

if (!/\.sb-l\{/.test(html)) html = html.replace('</style>', bloqueCSS + '</style>')
else html = html.replace(/\n\/\* ── el carril de subtítulos[\s\S]*?opacity:0\}\n/, bloqueCSS)

html = /<!-- SUBS:INICIO -->/.test(html)
  ? html.replace(/<!-- SUBS:INICIO -->[\s\S]*?<!-- SUBS:FIN -->/, bloqueHTML)
  : html.replace(/(\n\s*<\/div>\s*\n\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap)/, `\n${bloqueHTML}\n$1`)
html = /\/\* SUBS:JS:INICIO \*\//.test(html)
  ? html.replace(/\/\* SUBS:JS:INICIO \*\/[\s\S]*?\/\* SUBS:JS:FIN \*\//, bloqueJS)
  : html.replace(/(\n\s*\/\* ── LA CÁMARA POR ESCENA)/, `\n  ${bloqueJS}\n$1`)

/* ⛔ 17-ago: la capa entra al FINAL del DOM con data-start="0". El loop de
   visibilidad del master calcula el cierre de cada escena contra el data-start
   de la SIGUIENTE — con la capa adentro, la última escena se cierra en t=0 y la
   capa se apaga a sí misma en el frame 0. Quedó en el archivo, pasó `check`, y
   el hook textual no se vio nunca. Se excluye por data-qc-capa (lo mismo que ya
   hacía qc-master.mjs). Idempotente: después del reemplazo el patrón no matchea. */
html = html.replace(/querySelectorAll\('\.escena'\)/g,
  "querySelectorAll('.escena:not([data-qc-capa])')")

writeFileSync(IDX, html)
const seg = usadas.reduce((a, f) => a + (f.out - f.in), 0)
console.log(`\n${dir} · subtítulos`)
console.log(`   ${usadas.length} frases · ${seg.toFixed(1)}s con carril de ${(+val('dur', 100.26)).toFixed(0)}s · cuerpo ${CUERPO}px en y ${Y}`)
console.log(`   veto por ${comoSeVetó}`)
console.log(`   ${fuera} frases descartadas: ${razones.sin} por --sin · ${razones.ocupado} con la banda ocupada${razones.takeover ? ` · ${razones.takeover} por takeover` : ''}`)
console.log(`   takeovers detectados solos: ${[...idsTk].join(', ')}${libre ? ' (informativo: ya no vetan por sí solos)' : ''}`)
if (SIN.length) console.log(`   ventanas --sin: ${SIN.map(r => r.join('–')).join(' · ')}`)
console.log(`\n✓ puesto. siguiente: node tools/qc-master.mjs ${slug}`)
