#!/usr/bin/env node
import {hallarTranscripts} from './lib-corte.mjs';
/**
 * build-master.mjs — LA CAPA AGÉNTICA DEL CARRIL MASTER.
 *
 * El equivalente de build-kit.mjs para el otro carril. Mismo principio, que es de la casa:
 *
 *     El determinismo es la feature. Los agentes proponen, los validadores disponen.
 *     El orquestador es un script — CERO LLM en el control de flujo.
 *
 * QUÉ RESUELVE
 *   Hasta el 30-ago-2026 el master tenía mapa (BEATS.json), contrato (--check), emisor
 *   (--emitir) y gate (qc-master), pero el CONTENIDO de cada escena se tecleaba a mano. El kit
 *   dejó de hacerlo hace tres semanas; el master no.
 *
 * ⛔ LA CELDA ES UN FRAGMENTO, NO EL index.html.
 *   En master las escenas viven INLINE en master/index.html — un solo archivo. Catorce agentes
 *   editando el mismo archivo es la receta del pisón silencioso. Así que cada agente escribe
 *   SOLO `master/escenas/<SNN>.html`, que es el interior de su escena, y `map-beats --emitir`
 *   lo mete en su div. El agente nunca abre index.html.
 *
 * ⛔ LO QUE NUNCA ES DE UN AGENTE
 *   · el MAPA (BEATS.json) — la línea gráfica entera: qué se cuenta, dónde, con qué cámara,
 *     qué beat se ganó un takeover, cuál es el hook. Eso es de Walter.
 *   · el SIGN-OFF. El gusto no se gatea.
 *   El agente sólo escribe el interior de una escena cuya intención YA está decidida.
 *
 * USO
 *   node tools/build-master.mjs <slug> --verify        sólo gates, CERO tokens  ← empezá acá
 *   node tools/build-master.mjs <slug>                 construye las que faltan
 *   node tools/build-master.mjs <slug> --solo S07      una sola
 *   node tools/build-master.mjs <slug> --rehacer       reconstruye aunque exista
 *   node tools/build-master.mjs <slug> --intentos 2    default 3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {checkResources} from './resources.mjs';
import {config,resolveProject,resolveScene,ROOT,projectSlug} from './project.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));


const args = process.argv.slice(2);
const FLAGS_CON_VALOR = new Set(["--solo", "--intentos", "--nota", "--minutos"]);
const needle = args.find((a, i) => !a.startsWith("--") && !FLAGS_CON_VALOR.has(args[i - 1]));
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!needle) { console.error("uso: node tools/build-master.mjs <slug> [--verify] [--solo SNN] [--rehacer] [--intentos 3]"); process.exit(1); }

const RESERVED = new Set(["tools", "templates", "design_system", "assets", "renders", "brands", "node_modules", "_archive", "_legacy", "_fixture"]);
const slug = projectSlug(resolveProject(needle));
if (!slug) { console.error(`✗ ningún video matchea '${needle}'`); process.exit(1); }

const base = resolveProject(needle);
const master = join(base, "master");
const MAPA = join(master, "BEATS.json");
const IDX = join(master, "index.html");
const FRAG = join(master, "escenas");
const verifyOnly = flag("verify");
if (!verifyOnly && !flag("delegate")) { console.error("Author locally, then use --verify. --delegate is reserved for explicitly requested delegation."); process.exit(2); }
const only = val("solo", null);
const MAX = +val("intentos", "3");
const NOTA = val("nota", null);

if (!existsSync(MAPA)) { console.error(`✗ ${slug} no tiene master/BEATS.json — el mapa va primero, y es TUYO:\n  node tools/map-beats.mjs ${needle} --carril master`); process.exit(1); }
if (!existsSync(IDX)) { console.error(`✗ ${slug} no tiene master/index.html`); process.exit(1); }
const B = JSON.parse(readFileSync(MAPA, "utf8"));
if (!verifyOnly) mkdirSync(FRAG, { recursive: true });

const log = (s) => console.log(s);
function sh(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", maxBuffer: 1 << 26, ...opts });
  return { ok: r.status === 0, codigo: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

/* ── el transcript, para el gate de datos ─────────────────────────────────── */
const TRANS = (() => {
  const registered=config(base),declared=registered?hallarTranscripts(base)[0]:null;
  const srt=registered?null:readdirSync(base).find(f=>f.endsWith(".srt"));
  const txt=registered?(declared?.identityBound?declared.cues.map(c=>c.text).join(" "):""):(srt?readFileSync(join(base,srt),"utf8"):"");
  if(!txt)return {found:false,nums:new Set()};
  const nums = new Set();
  for (const m of txt.matchAll(/\d[\d.,]*/g)) nums.add(m[0].replace(/[.,]$/, ""));
  return { found: true, nums, texto: txt };
})();

/* ══ LOS GATES DE UNA ESCENA ════════════════════════════════════════════════
   Baratos y sin Chrome: corren por escena, en cada intento. Los caros (los que
   necesitan el navegador) corren UNA vez sobre la composición entera, al final. */

function G1_soloFragmento(sc) {
  const h = readFileSync(sc.file, "utf8");
  if (/<script/i.test(h))
    return { ok: false, error: `el fragmento tiene un <script>. La timeline del master es ÚNICA y pausada: una escena que crea la suya rompe el render determinista.\n  La animación va en master/escenas/${sc.id}.js como \`function build(tl, M){ … }\` — recibe SU sub-timeline, con los tiempos relativos a la escena arrancando en 0. El emisor la engancha en su lugar.` };
  if (/<(html|head|body)[\s>]/i.test(h))
    return { ok: false, error: `el fragmento trae <html>/<head>/<body>. Es el INTERIOR de un div, no una página.` };
  if (/\bclass="escena/.test(h))
    return { ok: false, error: `el fragmento redeclara el div de la escena. El div lo pone el emisor: acá va sólo lo de ADENTRO.` };
  return { ok: true };
}

function G2_datos(sc) {
  if (!TRANS.found) return { ok: true, skipped: "sin .srt: no puedo verificar los datos" };
  const visible = readFileSync(sc.file, "utf8")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  const declarados = new Set((sc.beat.datos || []).map(String));
  const malos = [];
  for (const m of visible.matchAll(/\d[\d.,]*%?/g)) {
    const raw = m[0].replace(/[.,]$/, ""), plano = raw.replace(/%$/, "");
    if (plano.length < 2) continue;
    if (TRANS.nums.has(plano) || declarados.has(raw) || declarados.has(plano)) continue;
    malos.push(raw);
  }
  const u = [...new Set(malos)];
  if (!u.length) return { ok: true };
  return { ok: false, error:
    `números en pantalla que Walter NO dice en el corte: ${u.join(", ")}\n` +
    `  Un dato que el audio no respalda es la falla que ya costó un "arreglar el dato".\n` +
    `  Usá el número que dice, o declaralo a propósito en BEATS.json → ese beat → "datos": ["${u[0]}"]` };
}

/* La paleta sale de brand.json del proyecto — la marca es un DATO, no una constante, y ya
   vive ahí (regla del 8-ago). Se juntan TODOS los hex del archivo, incluidos los de `mimesis`
   (colores que son fidelidad a una UI real —una terminal, un banco— y no marca). */
const PALETA = (() => {
  const f = join(base, "brand.json");
  if (!existsSync(f)) return new Set();
  const acc = new Set();
  (function hex(o) {
    if (typeof o === "string") { for (const m of o.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) acc.add(m[0].toLowerCase()); }
    else if (Array.isArray(o)) o.forEach(hex);
    else if (o && typeof o === "object") Object.values(o).forEach(hex);
  })(JSON.parse(readFileSync(f, "utf8")));
  return acc;
})();

function G3_marca(sc) {
  const paleta = PALETA;
  const h = readFileSync(sc.file, "utf8");
  const hex = [...new Set([...h.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase()))];
  if (!hex.length) return { ok: true };
  if (!paleta.size) return { ok: true, skipped: `${hex.length} hex literal(es) — sin brand.json no puedo gatear color` };
  const fuera = hex.filter((c) => !paleta.has(c));
  if (!fuera.length) return { ok: true };
  return { ok: false, error: `colores fuera de la paleta de la marca: ${fuera.join(", ")}\n  Usá los tokens de _brand-tokens.css (var(--…)), no hex literales.` };
}

function G4_takeover(sc) {
  const h = readFileSync(sc.file, "utf8");
  const tiene = /class="[^"]*\btk\b/.test(h);
  if (sc.beat.takeover && !tiene)
    return { ok: false, error: `el mapa dice que este beat se ganó un TAKEOVER y el fragmento no tiene ningún elemento class="tk". El takeover toma el cuadro entero.` };
  if (!sc.beat.takeover && tiene)
    return { ok: false, error: `el fragmento construye un takeover que el mapa NO declara. Los takeover se aprueban en el mapa, no acá — se ganan su lugar.` };
  return { ok: true };
}

// Resources are researched by the agent and reviewed in their actual crop.
function G5_placeholders(sc) {
  return checkResources(base,sc.file,{assetBase:master,allowPlaceholders:config(base)?.resourcePolicy==='draft-placeholders'});
}

const GATES = [["G1 fragmento", G1_soloFragmento], ["G2 datos", G2_datos], ["G3 marca", G3_marca], ["G4 takeover", G4_takeover], ["G5 resources", G5_placeholders]];

/* ══ EL AGENTE — sólo en las hojas del árbol ════════════════════════════════ */

/* La ficha de marca para un agente la arma brand.mjs, que ya conoce tokens, roles, energía,
   prohibiciones y mimesis. Una copia a mano acá se driftaría del JSON en la primera edición. */
const brandBrief = (() => {
  let m = null;
  try { m = JSON.parse(readFileSync(join(base, "brand.json"), "utf8")).name } catch {}
  if (!m) return "(sin brand.json en el proyecto)";
  const r = sh("node", [join(HERE, "brand.mjs"), "brief", m, ...(config(base)?.style?[config(base).style]:[])]);
  return r.ok ? r.out.trim() : `(no pude armar la ficha de ${m})`;
})();
function promptFor(sc, prevError) {
  const dur = (sc.beat.end - sc.beat.start).toFixed(1);
  const cam = (B.camara || []).find((t) => t.start <= sc.beat.start && t.end > sc.beat.start);
  return [
    `Construí el INTERIOR de UNA escena del video "${slug}" (carril MASTER del pipeline compartido).`,
    `Escribí SOLO el archivo ${sc.file}. No toques ningún otro archivo. NUNCA abras master/index.html.`,
    ``,
    `QUÉ ES ESTE ARCHIVO`,
    `  Un FRAGMENTO de HTML: lo que va ADENTRO del div de la escena. Sin <html>, sin <body>,`,
    `  sin <script>, sin volver a declarar el div. Podés usar <style> con selectores propios.`,
    `  El div contenedor ya existe y lo maneja el emisor.`,
    ``,
    `  LA ANIMACIÓN VA APARTE: escribí también ${sc.file.replace(/\.html$/, ".js")} con`,
    `  \`function build(tl, M){ … }\`. Recibe SU sub-timeline (tiempos RELATIVOS a la escena,`,
    `  arrancando en 0) y el objeto de movimiento M (M.enter/M.dur/M.ease — ver design_system/motion.js).`,
    `  Una escena sin .js no se mueve, y una escena que no se mueve casi nunca es lo correcto.`,
    ``,
    `  ⬚ LOS ASSETS NO LOS CONSEGUÍS VOS. Si la escena pide una imagen, una captura o un video,`,
    `  dejá un hueco: <div data-asset="captura del panel de Wallbit" style="…tamaño y posición…"></div>.`,
    `  Walter lo ve a rayas en el preview y decide qué poner. NUNCA apuntes a un archivo que no existe.`,
    ``,
    `LA ESPECIFICACIÓN (cerrada — no la reinterpretes; el mapa lo aprobó Walter)`,
    `  beat ${sc.id}: "${sc.beat.words}"`,
    `  entra a los ${sc.beat.start}s y dura ${dur}s`,
    `  tratamiento: ${sc.beat.tratamiento}`,
    ``,
    `EL CONCEPTO — es de TODO el video, no de esta escena. NO inventes tu propio vocabulario:`,
    `  ${B.concepto?.nombre}: ${B.concepto?.regla}`,
    ...(B.concepto?.reglas_duras || []).map((r) => `  ${r}`),
    (sc.beat.placas || []).length
      ? `  LAS PLACAS DE ESTE BEAT (usá EXACTAMENTE estos rótulos, no los reescribas):\n${sc.beat.placas.map((x) => `      · ${x}`).join("\n")}`
      : ``,
    sc.beat.takeover ? `  ⚠️ TAKEOVER: este beat se ganó el cuadro entero. Envolvé todo en un elemento class="tk" que cubra la pantalla, y declarále data-qc-cara-ok y data-qc-banda-ok — tapar la cara y la banda es el PUNTO de un takeover, pero se declara a propósito o el gate de zona lo marca (y tiene razón: nadie tapa la cara sin querer).` : `  NO es takeover: el footage de Walter sigue siendo el protagonista. Trabajá en los márgenes, dejá la columna central libre.`,
    (sc.beat.assets || []).length ? `  assets a usar: ${sc.beat.assets.join(", ")}` : ``,
    cam ? `  la cámara acá hace "${cam.kind}" — el footage se mueve, tu gráfico NO lo sigue: vive en coordenadas de lienzo.` : ``,
    ``,
    `EL CONTRATO`,
    `  · Lienzo ${B.corte?.fps ? "" : ""}1080×1920. Colores por token de _brand-tokens.css (var(--…)), NUNCA hex literal.`,
    `  · Representá el significado del beat con recursos reconocibles del estilo seleccionado.`,
    `  · Ningún número en pantalla que Walter no diga en el corte.`,
    `  · Nada de Date.now ni Math.random: el render es determinista.`,
    `  · Medí la cara del hablante y la banda de subtítulos de ESTE video; respetá el brief.`,
    /* ⛔ BRAND.md ES DE MOI (5-sep-2026). Pasárselo en un video de cliente le entrega la línea
       gráfica equivocada: Startupeable es tinta sobre papel con energía SOBRIA, la polaridad
       inversa de Moi. La marca sale de `brand.mjs brief` —que existe exactamente para esto— y
       la dirección del video, de su propio DIRECCION.md. */
    `  · LA MARCA (obligatoria, no la reinterpretes):`,
    brandBrief.split("\n").map((l) => `      ${l}`).join("\n"),
    existsSync(join(base, "DIRECCION.md")) ? `  · La dirección de ESTE video está en ${join(base, "DIRECCION.md")} — leela ENTERA antes de escribir.` : ``,
    `  · Arquetipos de escena (FORMAS, no colores): ${join(ROOT, "pipeline/docs/SCENE_LIBRARY.md")} — copiá la estructura, nunca la paleta.`,
    ``,
    /* ⛔ EL REBOTE DE WALTER ES UN INPUT DE PRIMERA CLASE (5-sep-2026).
       El loop que él describió es: se le muestra UNA escena, y aprueba o pide cambios. Hasta
       hoy al agente sólo le llegaba el error de un GATE — o sea la parte mecánica. La crítica
       después del preview («es tímido», «le respira encima», «falta un ancla») no tenía por
       dónde entrar y había que reescribir la escena a mano. Va PRIMERO y manda sobre todo lo
       demás: un gate dice que algo está roto, Walter dice que algo está mal. No es lo mismo. */
    NOTA ? `⛔ WALTER VIO ESTA ESCENA EN EL PREVIEW Y LA REBOTÓ. Esto MANDA sobre cualquier otra\n   instrucción de arriba — es criterio, no un gate:\n${NOTA}\n` : ``,
    prevError ? `EL INTENTO ANTERIOR FALLÓ UN GATE. Arreglá EXACTAMENTE esto:\n${prevError}` : ``,
    ``,
    `Cuando termines no expliques nada: el archivo es la entrega.`,
  ].filter(Boolean).join("\n");
}

/* ⛔ EL TIMEOUT SE DISTINGUE DE UN FALLO REAL (5-sep-2026).
   El límite era 12 min y el mensaje decía «¿está el CLI 'claude' en PATH?». Una escena que
   salió bien tardó 9 min; al sumarle el rebote de Walter, la ficha de marca y "leé el
   DIRECCION.md entero", el agente pasó los 12 y spawnSync lo mató — y el gate culpó al PATH,
   que estaba perfecto. Tres intentos quemados persiguiendo un error inventado.
   Un mensaje de error que apunta a la causa equivocada cuesta más que no tener mensaje. */
const AGENTE_MS = 1000 * 60 * +val("minutos", "25");
function runAgent(sc, prevError) {
  const t0 = Date.now();
  const r = sh("claude", ["-p", promptFor(sc, prevError)], { cwd: ROOT, timeout: AGENTE_MS });
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  if (!r.ok) {
    const seCortó = r.codigo == null || Date.now() - t0 >= AGENTE_MS - 2000;
    return { ok: false, error: seCortó
      ? `el agente se pasó del límite de ${AGENTE_MS / 60000} min (tardó ${mins}). No es un fallo suyo: es que la escena pide más tiempo. Subilo con --minutos 40.`
      : `el agente salió con código ${r.codigo} a los ${mins} min: ${r.out.slice(0, 400) || "(sin salida)"}` };
  }
  return { ok: true };
}

/* ══ LAS ESCENAS ════════════════════════════════════════════════════════════ */
let escenas = (B.beats || []).map((b) => ({ id: b.id, beat: b, file: join(FRAG, `${b.id}.html`) }));
if (only) {const selected=resolveScene(escenas.map(s=>s.id),only);escenas=escenas.filter(s=>s.id===selected);}
if (!escenas.length) { console.error(`✗ no hay escenas que matcheen '${only}'`); process.exit(1); }

/* ══ LA CELDA AUTO-SANABLE ══════════════════════════════════════════════════ */
function corrergates(sc) {
  for (const [label, fn] of GATES) {
    const r = fn(sc);
    if (r.skipped) { return {ok:false,gate:label,error:`NO VERIFICABLE: ${r.skipped}`}; }
    if (!r.ok) return { ok: false, gate: label, error: r.error };
    log(`      ✓ ${label}`);
  }
  return { ok: true };
}

function celda(sc) {
  const intentos = [];
  const hay = existsSync(sc.file);
  const construir = !verifyOnly && (flag("rehacer") || NOTA || !hay);

  if (!hay && verifyOnly) { log(`   ~ ${sc.id}  sin fragmento (--verify no construye)`); return { id: sc.id, estado: "sin-construir", intentos }; }
  if (!hay && !construir) { log(`   ~ ${sc.id}  sin fragmento`); return { id: sc.id, estado: "sin-construir", intentos }; }

  for (let i = 1; i <= (construir ? MAX : 1); i++) {
    if (construir) {
      log(`   → ${sc.id}  intento ${i}/${MAX} — el agente escribe el fragmento…`);
      const prev = intentos.length ? `${intentos[intentos.length - 1].gate}: ${intentos[intentos.length - 1].error}` : null;
      const a = runAgent(sc, prev);
      if (!a.ok) { intentos.push({ n: i, gate: "agente", error: a.error }); log(`      ✗ ${a.error.split("\n")[0]}`); continue; }
      if (!existsSync(sc.file)) { intentos.push({ n: i, gate: "agente", error: "el agente no dejó el archivo" }); log(`      ✗ no escribió ${sc.id}.html`); continue; }
    } else log(`   · ${sc.id}  verificando el fragmento que ya existe`);

    const g = corrergates(sc);
    if (g.ok) { log(`   ✓ ${sc.id}  pasa los ${GATES.length} gates`); return { id: sc.id, estado: "ok", intentos }; }
    intentos.push({ n: i, gate: g.gate, error: g.error });
    log(`      ✗ ${g.gate}`);
    for (const l of g.error.split("\n").slice(0, 2)) log(`        ${l}`);
    if (!construir) break;
  }
  return { id: sc.id, estado: "falla", intentos };
}

/* ══ CORRIDA ════════════════════════════════════════════════════════════════ */
log(`\n  BUILD MASTER · ${slug} · ${escenas.length} escena(s)${verifyOnly ? "  [--verify: cero tokens]" : ""}\n`);
const res = escenas.map(celda);

/* El gate del VIDEO corre una sola vez, al final: necesita Chrome y mide la composición
   entera. Antes hay que bajar los fragmentos al html — si no, el gate mide divs vacíos. */
let veredictoVideo = null;
const listas = res.filter((r) => r.estado === "ok").length;
if (listas && !verifyOnly && !flag("sin-emitir")) {
  log(`\n  → bajando los fragmentos al html (map-beats --emitir)…`);
  const e = sh("node", [join(HERE, "map-beats.mjs"), slug, "--emitir"]);
  log(e.out.split("\n").filter((l) => l.includes("✓")).map((l) => `  ${l.trim()}`).join("\n") || "");
  log(`  → el gate del carril (qc-master)…`);
  const q = sh("node", [join(HERE, "qc-master.mjs"), slug]);
  /* Si el gate murió ANTES de medir (falta data-duration, no arranca Chrome) no hay líneas
     de reporte que filtrar, y un resumen vacío deja al usuario sin saber qué pasó. */
  const lineas = q.out.split("\n").filter((l) => /^── |limpio|ERROR\(|VERIFICABLE/.test(l));
  veredictoVideo = { codigo: q.codigo, resumen: (lineas.length ? lineas : q.out.trim().split("\n").slice(-6)).join("\n") };
  log(veredictoVideo.resumen.split("\n").map((l) => `    ${l}`).join("\n"));
}

if(!verifyOnly)writeFileSync(join(master, ".build-log.json"), JSON.stringify({ slug, cuando: new Date().toISOString(), verifyOnly, escenas: res, video: veredictoVideo }, null, 2) + "\n");

const fallan = res.filter((r) => r.estado === "falla");
const faltan = res.filter((r) => r.estado === "sin-construir");
log(`\n  ${listas}/${res.length} escena(s) pasan los gates${fallan.length ? ` · ${fallan.length} fallan` : ""}${faltan.length ? ` · ${faltan.length} sin construir` : ""}`);
log(`  detalle por intento: master/.build-log.json`);
if (fallan.length) {
  log(verifyOnly
    ? `\n✗ ${fallan.map((r) => r.id).join(", ")} no pasan los gates. Corré sin --verify para que el agente las arregle,\n  o editá el fragmento a mano en master/escenas/.\n`
    : `\n✗ ${fallan.map((r) => r.id).join(", ")} no pasaron después de ${MAX} intento(s) — miralas a mano\n`);
  process.exit(1);
}
if (faltan.length && verifyOnly) { log(`\n  Faltan ${faltan.length}: corré sin --verify para que las construya.\n`); process.exit(2); }
if (veredictoVideo && veredictoVideo.codigo !== 0) { log(`\n✗ las escenas pasan pero el VIDEO no — el gate del carril manda\n`); process.exit(1); }
if (verifyOnly || !veredictoVideo) { log("Verificación parcial: composición completa y export no comprobados; no acredita entrega."); process.exit(2); }
log("Gates técnicos completos; comprobar revisión y aprobaciones vigentes antes del render.");
