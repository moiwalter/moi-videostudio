#!/usr/bin/env node
import {resolveProject,ROOT,projectSlug} from './project.mjs';
/**
 * encuadre.mjs — DÓNDE ESTÁ WALTER EN EL CUADRO. Medido, no tecleado.
 *
 * POR QUÉ EXISTE
 *   `qc-master` necesita saber qué franja vertical NO se puede tapar para poder decir "esta
 *   placa le tapa la cara". Hasta hoy esa franja se escribía A MANO en data-qc-cara del #frame,
 *   y si faltaba el gate medía contra `468,1440` — el encuadre de tu-carrera. Sobre el corte de
 *   otra persona eso no falla ruidoso: mide MAL. Da errores donde no hay nada y deja pasar una
 *   placa que sí tapa una cara.
 *
 *   Pero pedirle a Walter que mida su propio encuadre en cada video es trabajo inútil: la
 *   herramienta ya abre el video en Chrome. Si puede verlo, que lo vea.
 *
 * CÓMO LO MIDE (sin modelos, sin CDN, sin red)
 *   En un talking-head el fondo está QUIETO y la persona se MUEVE: habla, gesticula, respira.
 *   Se muestrean N cuadros repartidos por el corte, se los dibuja en un canvas, y por cada FILA
 *   de píxeles se acumula cuánto cambia entre cuadro y cuadro. La franja donde el cambio se
 *   concentra ES la persona. Es la misma idea que un detector de movimiento, hecha por filas.
 *
 *   Deliberadamente NO se usa reconocimiento facial: haría falta un modelo, red, y fallaría
 *   distinto en cada corte. La diferencia temporal es aritmética y no tiene opinión.
 *
 * USO
 *   node tools/encuadre.mjs <slug>              mide y te lo muestra
 *   node tools/encuadre.mjs <slug> --escribir   además lo deja en el #frame
 *   node tools/encuadre.mjs <slug> --muestras 30
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = ROOT
const args = process.argv.slice(2)
const FLAGS_CON_VALOR = new Set(['--muestras', '--umbral'])
const slug = args.find((a, i) => !a.startsWith('--') && !FLAGS_CON_VALOR.has(args[i - 1]))
const val = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] }
const ESCRIBIR = args.includes('--escribir')
const N = +val('muestras', 24)
const UMBRAL = +val('umbral', 0.10)
if (!slug) { console.error('uso: node tools/encuadre.mjs <slug> [--escribir] [--muestras 24]'); process.exit(1) }

const dir = projectSlug(resolveProject(slug))
if (!dir) { console.error(`✗ ningún video matchea '${slug}'`); process.exit(1) }
const master = resolve(resolveProject(slug), 'master')
const IDX = resolve(master, 'index.html')
if (!existsSync(IDX)) { console.error(`✗ ${dir} no tiene master/index.html`); process.exit(1) }

const html = readFileSync(IDX, 'utf8')
const frame = html.match(/<div[^>]*data-composition-id="main"[^>]*>/)?.[0] || ''
const num = (a, d) => +(frame.match(new RegExp(a + '="([\\d.]+)"'))?.[1] ?? d)
const CW = num('data-width', 1080), CH = num('data-height', 1920), FIN = num('data-duration', 0)
const src = html.match(/<video[^>]*\bsrc="([^"]+)"/)?.[1]
if (!src) { console.error(`✗ no encontré el <video> del corte en master/index.html`); process.exit(1) }
if (!FIN) { console.error(`✗ el #frame no declara data-duration`); process.exit(1) }

/* servidor con Range: un mp4 se sirve por tramos o el <video> no puede buscar dentro */
const MIME = { '.html': 'text/html', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }
const srv = createServer((rq, rs) => {
  /* ⛔ LA PÁGINA DE MEDICIÓN SE SIRVE DESDE ACÁ, no con setContent (30-ago-2026).
     Con setContent la página queda en about:blank, el <video> del localhost es CROSS-ORIGIN,
     y dibujarlo en un canvas lo CONTAMINA: getImageData tira SecurityError y el video ni
     siquiera reporta dimensiones. Mismo origen o no hay medición. */
  if (rq.url.startsWith('/__medir')) {
    rs.writeHead(200, { 'Content-Type': 'text/html' })
    rs.end(`<body style="margin:0"><video id="v" src="/${src}" muted playsinline></video></body>`)
    return
  }
  const f = resolve(master, decodeURIComponent(rq.url.split('?')[0]).replace(/^\/+/, ''))
  if (!existsSync(f) || statSync(f).isDirectory()) { rs.writeHead(404).end(); return }
  const tipo = MIME[extname(f)] || 'application/octet-stream', total = statSync(f).size
  const r = rq.headers.range && /^bytes=(\d*)-(\d*)$/.exec(rq.headers.range)
  if (r) {
    const ini = r[1] ? +r[1] : 0, fin = r[2] ? Math.min(+r[2], total - 1) : total - 1
    rs.writeHead(206, { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${ini}-${fin}/${total}`, 'Content-Length': fin - ini + 1 })
    createReadStream(f, { start: ini, end: fin }).pipe(rs); return
  }
  rs.writeHead(200, { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Content-Length': total })
  createReadStream(f).pipe(rs)
})
await new Promise(r => srv.listen(0, r))

const req = createRequire(import.meta.url)
let puppeteer
try { puppeteer = (await import(req.resolve('puppeteer-core', { paths: [AQUI, RAIZ, process.cwd()] }))).default }
catch { console.error('✗ falta puppeteer-core'); process.exit(2) }
const cache = resolve(process.env.HOME, '.cache/puppeteer/chrome')
const build = existsSync(cache) ? readdirSync(cache).sort().pop() : null
const CHROME = build && resolve(cache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
if (!CHROME || !existsSync(CHROME)) { console.error('✗ no encontré Chrome en ~/.cache/puppeteer/chrome'); process.exit(2) }

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'shell' })
const p = await b.newPage()
/* Una página MÍNIMA: sólo el <video>. No se carga el master entero a propósito — las escenas
   taparían al sujeto y estaríamos midiendo nuestros propios gráficos, no a la persona. */
await p.goto(`http://localhost:${srv.address().port}/__medir`, { waitUntil: 'domcontentloaded', timeout: 30000 })

const medida = await p.evaluate(async ({ N, FIN, CH, UMBRAL }) => {
  const v = document.getElementById('v')
  await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('el <video> no cargó')); setTimeout(ok, 25000) })
  if (!v.videoWidth) return { error: 'el video no reporta dimensiones' }
  const W = 160, H = 284                                   // chico a propósito: se mide forma, no detalle
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })
  const gris = []
  for (let i = 0; i < N; i++) {
    const t = (FIN * (i + 0.5)) / N
    await new Promise((ok) => { v.onseeked = ok; v.currentTime = t; setTimeout(ok, 4000) })
    g.drawImage(v, 0, 0, W, H)
    const d = g.getImageData(0, 0, W, H).data
    const f = new Float64Array(H)
    for (let y = 0; y < H; y++) { let s = 0
      for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; s += (d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114) }
      f[y] = s / W }
    gris.push(f)
  }
  if (gris.length < 2) return { error: 'no pude muestrear cuadros' }
  /* movimiento por fila = cuánto cambia esa fila entre cuadro y cuadro */
  const mov = new Float64Array(H)
  for (let i = 1; i < gris.length; i++) for (let y = 0; y < H; y++) mov[y] += Math.abs(gris[i][y] - gris[i - 1][y])
  /* suavizado: una fila suelta es ruido de compresión, una franja es una persona */
  const suave = new Float64Array(H)
  for (let y = 0; y < H; y++) { let s = 0, n = 0
    for (let k = -4; k <= 4; k++) { const j = y + k; if (j >= 0 && j < H) { s += mov[j]; n++ } }
    suave[y] = s / n }
  const max = Math.max(...suave)
  if (!max) return { error: 'el corte no tiene movimiento medible' }
  const umbral = max * UMBRAL
  let a = -1, z = -1
  for (let y = 0; y < H; y++) if (suave[y] >= umbral) { if (a < 0) a = y; z = y }
  return { a: Math.round((a / H) * CH), z: Math.round((z / H) * CH), muestras: gris.length }
}, { N, FIN, CH, UMBRAL }).catch((e) => ({ error: e.message }))

await b.close(); srv.close()
if (medida.error) { console.error(`✗ no pude medir: ${medida.error}`); process.exit(1) }

/* La banda de subtítulos no se mide: es una DECISIÓN de layout, no un hecho del corte.
   Se deriva de la convención del carril (abajo, sobre la zona segura de TikTok). */
const cara = [Math.max(0, medida.a - 40), Math.min(CH, medida.z + 40)]
const banda = [Math.round(CH * 0.6875), Math.round(CH * 0.7917)]

console.log(`\n  ENCUADRE MEDIDO · ${dir}`)
console.log(`  ${medida.muestras} cuadros repartidos en ${FIN}s · lienzo ${CW}×${CH}\n`)
console.log(`  data-qc-cara="${cara[0]},${cara[1]}"      ← la franja donde estás vos (no tapar)`)
console.log(`  data-qc-banda="${banda[0]},${banda[1]}"     ← la banda de subtítulos (convención, no medida)\n`)

if (ESCRIBIR) {
  let nuevo = frame
  nuevo = /data-qc-cara="/.test(nuevo)
    ? nuevo.replace(/data-qc-cara="[^"]*"/, `data-qc-cara="${cara[0]},${cara[1]}"`)
    : nuevo.replace(/>$/, ` data-qc-cara="${cara[0]},${cara[1]}">`)
  nuevo = /data-qc-banda="/.test(nuevo)
    ? nuevo.replace(/data-qc-banda="[^"]*"/, `data-qc-banda="${banda[0]},${banda[1]}"`)
    : nuevo.replace(/>$/, ` data-qc-banda="${banda[0]},${banda[1]}">`)
  if (nuevo === frame) { console.log(`  (ya estaba igual — no toqué el archivo)\n`); process.exit(0) }
  writeFileSync(IDX, html.replace(frame, nuevo))
  console.log(`  ✓ escrito en el #frame de master/index.html\n`)
} else {
  console.log(`  Para dejarlo puesto:  node tools/encuadre.mjs ${slug} --escribir\n`)
}
