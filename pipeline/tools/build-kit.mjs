#!/usr/bin/env node
import {hallarTranscripts} from './lib-corte.mjs';
import {config,engineVersion,resolveProject,resolveScene,ROOT,projectSlug} from './project.mjs';
/**
 * build-kit.mjs — orquestador DETERMINISTA del kit de talking-head.
 *
 * EL PRINCIPIO (heredado de stacksync-gtm/ORCHESTRATION.md)
 *   Los agentes proponen, los validadores disponen. **Cero LLM en el control de flujo.**
 *   El orden, el paralelismo, los reintentos y el ensamblado son código. El agente vive solo en
 *   la hoja del árbol — escribir el index.html de UNA escena — encerrado en una celda con gates
 *   que revisan su salida y lo obligan a reintentar. Un agente no puede entregar una escena rota:
 *   el gate falla y el error exacto se vuelve su próximo prompt.
 *
 * LO QUE NO AUTOMATIZA (a propósito)
 *   · El MAPA DE BEATS — lo aprueba Walter antes de que se construya nada. Es la decisión de qué
 *     se cuenta y dónde; un agente eligiendo eso produce un video promedio.
 *   · El SIGN-OFF final — el gusto no se gatea.
 *   Todo lo de en medio es seguro de automatizar PRECISAMENTE porque el contrato (meta.json) le
 *   da al agente un spec cerrado a la entrada y un chequeo duro a la salida.
 *
 * USO
 *   node tools/build-kit.mjs <slug> --verify           # solo gates, sin agentes (empieza acá)
 *   node tools/build-kit.mjs <slug>                    # construye las escenas PENDIENTES
 *   node tools/build-kit.mjs <slug> --escena S05b      # una sola
 *   node tools/build-kit.mjs <slug> --rehacer          # reconstruye TODAS (aun las que ya pasan)
 *   node tools/build-kit.mjs <slug> --jobs 3           # concurrencia (default 2: renderiza, pesa)
 *
 * Log por intento: scenes/<SNN>/.build-log.json — reanudable y debuggeable.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, lstatSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const RESERVED = new Set(["tools", "templates", "design_system", "assets", "renders", "_archive"]);
const MAX_ATTEMPTS = 3;
const PY = process.env.PY || "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3";
// La versión vive en tools/HF_VERSION (una sola fuente para los 15 tools).
let HF_VER;

// ─────────────────────────────────────────────────────────── args
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const needle = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
if (!needle) { console.error("uso: node tools/build-kit.mjs <slug> [--verify] [--escena SNN] [--rehacer] [--jobs N]"); process.exit(1); }

const slug = projectSlug(resolveProject(needle));
if (!slug) { console.error(`✗ ningún video matchea '${needle}'`); process.exit(1); }
const base = resolveProject(needle);
HF_VER=engineVersion(base);
const verifyOnly = flag("verify");
if (!verifyOnly && !flag("delegate")) { console.error("Author locally, then use --verify. --delegate is reserved for explicitly requested delegation."); process.exit(2); }
const jobs = Math.max(1, parseInt(val("jobs", "2"), 10));
const only = val("escena", null);

const log = (m) => console.log(m);
const sh = (cmd, cmdArgs, opts = {}) => {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", maxBuffer: 1 << 26, ...opts });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim(), status: r.status };
};

// ─────────────────────────────────────────────────────────── transcripción (para G4)
function transcriptNumbers() {
  const srtName = readdirSync(base).filter((f) => f.endsWith(".srt"))
    .sort((a, b) => (/corregid/i.test(b) ? 1 : 0) - (/corregid/i.test(a) ? 1 : 0))[0];
  const declared=config(base)?hallarTranscripts(base)[0]:null;
  const md = !config(base)&&existsSync(join(base, "TRANSCRIPT.md")) ? readFileSync(join(base, "TRANSCRIPT.md"), "utf8") : "";
  const srt = config(base)?(declared?.identityBound?declared.cues.map(c=>c.text).join(" "):""):(srtName ? readFileSync(join(base, srtName), "utf8") : "");
  const text = `${md}\n${srt}`;
  const nums = new Set();
  for (const m of text.matchAll(/\d[\d.,]*/g)) nums.add(m[0].replace(/[.,]$/, ""));
  // los números escritos con palabras también cuentan como dichos
  const words = { cero:"0", uno:"1", dos:"2", tres:"3", cuatro:"4", cinco:"5", seis:"6", siete:"7",
                  ocho:"8", nueve:"9", diez:"10", once:"11", doce:"12", quince:"15", veinte:"20",
                  treinta:"30", cuarenta:"40", cincuenta:"50", cien:"100", mil:"1000" };
  for (const [w, n] of Object.entries(words))
    if (new RegExp(`\\b${w}\\b`, "i").test(text)) nums.add(n);
  return { nums, found: !!(md || srt) };
}
const TRANS = transcriptNumbers();

// ─────────────────────────────────────────────────────────── LOS GATES
// Cada uno: barato → caro, se corta en el primero que falla, y devuelve un error que el agente
// pueda accionar (no "algo salió mal": la línea, el número, el archivo).

function G1_check(sc) {
  // `check` = lint + validación en runtime (Chrome headless) + layout + CONTRASTE.
  // Subsume al lint por +1.5s (medido: lint 4.6s · check 6.1s · draft render 7.3s), y agrega
  // tres cosas que el lint solo no ve: assets que no cargan, texto ilegible por contraste, y
  // errores JS en ejecución. Habría atrapado la fuente que caía en Georgia en silencio.
  const r = sh("npx", ["--yes", `hyperframes@${HF_VER}`, "check"], { cwd: sc.dir });
  if (r.ok) return { ok: true };
  const lines = r.out.split("\n").filter((l) => /✗|⚠/.test(l));
  return { ok: false, error: `hyperframes check falló:\n${(lines.length ? lines : r.out.split("\n").slice(-14)).slice(0, 12).join("\n")}` };
}

function G2_css(sc) {                                    // el gate del alpha, ANTES de gastar un render
  const r = sh(PY, [join(HERE, "alpha-qc.py"), "--css", join(sc.dir, "index.html")]);
  if (r.ok) return { ok: true };
  return { ok: false, error: `sombras horneadas que se ven como mancha sobre el footage (SCENE_PLAYBOOK §3b):\n${r.out}` };
}

function G3_dup(sc) {                                    // no re-duplicar assets ni forkear tools
  const ds = join(sc.dir, "design_system");
  if (existsSync(ds) && !lstatSync(ds).isSymbolicLink())
    return { ok: false, error: `design_system es una carpeta copiada, tiene que ser un symlink al design system del pipeline (regla 1 y 5 de START_HERE)` };
  for (const f of ["fonts", "assets"])
    if (existsSync(join(sc.dir, f)) && !lstatSync(join(sc.dir, f)).isSymbolicLink())
      return { ok: false, error: `la escena copió ${f}/ — usa el symlink design_system, los assets no se duplican por escena` };
  const forked = readdirSync(sc.dir).filter((f) => /\.(sh|py)$/.test(f));
  if (forked.length)
    return { ok: false, error: `scripts forkeados dentro de la escena (${forked.join(", ")}) — se usan los genéricos de tools/, y si a uno le falta algo se arregla el tool (regla 5)` };
  return { ok: true };
}

function G4_datos(sc) {                                  // ningún número inventado en pantalla
  if (!TRANS.found) return { ok: false, error: "UNVERIFIABLE: falta transcript para comprobar los datos" };
  const html = readFileSync(join(sc.dir, "index.html"), "utf8");
  const visible = html
    // El <head> entero fuera: <title> y <meta> NUNCA se ven en el video, y como todo id de
    // escena lleva dígitos (S09-alpha), el título hacía fallar G4 en TODAS las escenas.
    // Un gate que grita en falso en cada corrida es un gate que alguien apaga.
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")          // los comentarios tampoco se ven
    .replace(/<[^>]+>/g, " ");
  const declared = new Set((sc.meta.datos || []).map(String));
  const offenders = [];
  for (const m of visible.matchAll(/\d[\d.,]*%?/g)) {
    const raw = m[0].replace(/[.,]$/, "");
    const plain = raw.replace(/%$/, "");
    if (plain.length < 2) continue;                       // 1..9 sueltos son numeración, no dato
    if (TRANS.nums.has(plain) || declared.has(raw) || declared.has(plain)) continue;
    offenders.push(raw);
  }
  const uniq = [...new Set(offenders)];
  if (!uniq.length) return { ok: true };
  return { ok: false, error:
    `números en pantalla que Walter NO dice en el corte y que no están declarados: ${uniq.join(", ")}\n` +
    `  Un dato en pantalla que el audio no respalda es la falla que ya costó un "arreglar el dato".\n` +
    `  Arreglo: usa el número que dice, o si es correcto y deliberado declaralo en meta.json → "datos": ["${uniq[0]}"]` };
}

function G5_render(sc) {                                  // ¿renderiza de verdad?
  const r = sh("bash", [join(HERE, "proxy.sh"), slug, sc.id]);
  if (!r.ok) return { ok: false, error: `el render draft falló:\n${r.out.split("\n").slice(-16).join("\n")}` };
  return { ok: true };
}

function G6_contrato() {                                  // el contrato del kit, a nivel VIDEO
  const r = sh("node", [join(HERE, "validate-kit.mjs"), slug]);
  return r.ok ? { ok: true } : { ok: false, error: r.out };
}

function G7_premult(sc) {                                 // solo si ya hay alpha lockeado
  const rDir = join(sc.dir, "renders");
  if (!existsSync(rDir)) return { ok: true, skipped: "sin renders todavía" };
  const mov = readdirSync(rDir).find((f) => /\.mov$/i.test(f) && !/\.straight\.mov$/i.test(f));
  if (!mov) return { ok: true, skipped: "sin alpha lockeado" };
  const r = sh(PY, [join(HERE, "alpha-qc.py"), "--premult", join(rDir, mov)]);
  return r.ok ? { ok: true } : { ok: false, error: r.out };
}

const SCENE_GATES = [
  ["G1 check", G1_check], ["G2 alpha-css", G2_css], ["G3 no-dup", G3_dup],
  ["G4 datos", G4_datos], ["G5 render", G5_render], ["G7 premult", G7_premult],
];

// ─────────────────────────────────────────────────────────── el agente (hoja del árbol)
function promptFor(sc, prevError) {
  const b = typeof sc.meta.beat === "string" ? { words: sc.meta.beat } : (sc.meta.beat || {});
  const dur = (sc.meta.timing?.durationFrames ?? 150) / (sc.meta.timing?.fps ?? 30);
  return [
    `Construí UNA escena de overlay para el talking-head "${slug}" de Moi.`,
    `Escribí SOLO el archivo ${join(sc.dir, "index.html")}. No toques ningún otro archivo.`,
    ``,
    `ESPECIFICACIÓN (cerrada — no la reinterpretes):`,
    `  escena: ${sc.name}   tipo: ${sc.meta.type || "alpha"}   zona: ${sc.meta.zone || "libre, respetá la silueta"}`,
    `  beat: ${b.label || "-"} — "${b.words || ""}"`,
    `  entra a los ${sc.meta.place || b.start} y dura EXACTAMENTE ${dur.toFixed(1)}s (data-duration="${dur.toFixed(1)}")`,
    b.money ? `  ⚠️ es un MONEY-BEAT: uno de los momentos más fuertes del video.` : ``,
    ``,
    `CONTRATO OBLIGATORIO:`,
    `  · Leé y obedecé ${join(ROOT, "pipeline/docs/SCENE_PLAYBOOK.md")} (contrato HTML §3, ley del alpha §3b, REGLAS DE ANIMACIÓN §3c, lenguaje visual §6).`,
    `  · §3c, las cuatro que más se rompen: (1) NO animes letterSpacing/width/height/top/left/fontSize/margin/padding`,
    `    — se redondean a píxel entero y TARTAMUDEAN bajo captura frame-por-frame; animá x/y/scale/rotation/opacity.`,
    `    (2) NO pongas transform en CSS si GSAP le anima transform — GSAP escribe el string completo y descarta`,
    `    el translateX(-50%) del centrado; el estado inicial va con gsap.set(). (3) dos tweens no pisan la misma`,
    `    propiedad del mismo target al mismo tiempo (revisá las cotas del loop). (4) colores por token, nunca hex.`,
    `  · Línea gráfica: ${join(ROOT, "pipeline/docs/BRAND.md")}. Arquetipos: SCENE_LIBRARY.md — copiá, no reinventes.`,
    `  · Timeline GSAP única y PAUSADA en window.__timelines["main"]. Nada de Date.now ni Math.random.`,
    `  · design_system por symlink. Cero scripts nuevos en la carpeta de la escena.`,
    `  · Sin sombras negras de radio >8px a opacidad ≥.25. Un glow es un radial-gradient DETRÁS del texto, jamás un text-shadow borroso, jamás negro.`,
    `  · Ningún número en pantalla que Walter no diga en el transcript.`,
    ``,
    prevError ? `EL INTENTO ANTERIOR FALLÓ UN GATE. Arreglá EXACTAMENTE esto:\n${prevError}` : ``,
    ``,
    `Cuando termines, no expliques nada: el archivo es la entrega.`,
  ].filter(Boolean).join("\n");
}

function runAgent(sc, prevError) {
  const r = sh("claude", ["-p", promptFor(sc, prevError)], { cwd: ROOT, timeout: 1000 * 60 * 12 });
  if (!r.ok) return { ok: false, error: `el agente no pudo correr (¿está el CLI 'claude' en PATH?): ${r.out.slice(0, 400)}` };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────── escenas
const scenesDir = join(base, "scenes");
if (!existsSync(scenesDir)) { console.error(`✗ ${slug} no tiene scenes/`); process.exit(1); }
let scenes = readdirSync(scenesDir).sort().filter((n) => statSync(join(scenesDir, n)).isDirectory())
  .map((name) => {
    const dir = join(scenesDir, name);
    const mp = join(dir, "meta.json");
    let meta = {};
    try { meta = JSON.parse(readFileSync(mp, "utf8")); } catch { meta = {}; }
    return { name, dir, meta, id: meta.id || name.split("-")[0], hasMeta: existsSync(mp) };
  });
if (only) {const selected=resolveScene(scenes.map(s=>s.name),only);scenes=scenes.filter(s=>s.name===selected);}
if (!scenes.length) { console.error(`✗ no hay escenas que matcheen`); process.exit(1); }

// ─────────────────────────────────────────────────────────── celda auto-sanable
function runGates(sc, { skipRender }) {
  for (const [label, fn] of SCENE_GATES) {
    if (skipRender && label === "G5 render") { log("      ~ G5 render: no ejecutado en --verify; no acredita entrega"); continue; }
    if (!existsSync(join(sc.dir, "index.html")) && label !== "G3 no-dup")
      return { ok: false, gate: label, error: "la escena no tiene index.html" };
    const r = fn(sc);
    if (r.skipped) { log(`      ~ ${label}: ${r.skipped}`); continue; }
    if (!r.ok) return { ok: false, gate: label, error: r.error };
    log(`      ✓ ${label}`);
  }
  return { ok: true };
}

function cell(sc) {
  const attempts = [];
  const needsBuild = !verifyOnly && (flag("rehacer") || !existsSync(join(sc.dir, "index.html")));
  for (let n = 1; n <= (verifyOnly ? 1 : MAX_ATTEMPTS); n++) {
    log(`\n  ── ${sc.name}  (intento ${n}/${verifyOnly ? 1 : MAX_ATTEMPTS})`);
    if (!sc.hasMeta) {
      const e = "sin meta.json — el contrato se define ANTES de construir (templates/scene.meta.json)";
      attempts.push({ n, gate: "contrato", error: e });
      log(`      ✗ ${e}`);
      break;
    }
    if (!verifyOnly && (needsBuild || attempts.length)) {
      const a = runAgent(sc, attempts.at(-1)?.error);
      if (!a.ok) { attempts.push({ n, gate: "agente", error: a.error }); log(`      ✗ ${a.error}`); break; }
    }
    const g = runGates(sc, { skipRender: verifyOnly });
    if (g.ok) {
      if(!verifyOnly)writeFileSync(join(sc.dir, ".build-log.json"), JSON.stringify({ scene: sc.name, status: "OK", attempts }, null, 2));
      return { name: sc.name, status: "OK", attempts: n };
    }
    // La primera línea del error es el encabezado ("check falló:") y el detalle viene después:
    // mostrar solo [0] dejaba al humano con un "falló" sin causa. El agente sí recibe todo.
    const det = g.error.split("\n").filter((l) => /✗|⚠/.test(l));
    log(`      ✗ ${g.gate}: ${det.length ? det[0].trim() : g.error.split("\n")[0]}`);
    if (det.length > 1) log(`         (+${det.length - 1} más — todo el detalle va al prompt del reintento)`);
    attempts.push({ n, gate: g.gate, error: g.error });
    if (verifyOnly) break;
  }
  if(!verifyOnly)writeFileSync(join(sc.dir, ".build-log.json"), JSON.stringify({ scene: sc.name, status: "BLOCKED", attempts }, null, 2));
  return { name: sc.name, status: "BLOCKED", attempts: attempts.length, last: attempts.at(-1) };
}

// ─────────────────────────────────────────────────────────── correr (concurrencia acotada)
log(`\n  BUILD KIT · ${slug}${verifyOnly ? "  [--verify: solo gates, sin agentes]" : ""}`);
log(`  ${scenes.length} escena(s) · concurrencia ${verifyOnly ? 1 : jobs} · reintentos ${verifyOnly ? 1 : MAX_ATTEMPTS}`);
if (!TRANS.found) log(`  ! sin TRANSCRIPT.md ni .srt — G4 (datos) queda saltado`);

const results = [];
for (const sc of scenes) results.push(cell(sc));       // secuencial: los renders son el cuello, no los agentes

// ─────────────────────────────────────────────────────────── contrato a nivel video + cierre
log(`\n  ── contrato del kit (nivel video)`);
const contract = G6_contrato();
if (contract.ok) log(`      ✓ G6 contrato`);
else log(contract.error);

const ok = results.filter((r) => r.status === "OK");
const blocked = results.filter((r) => r.status === "BLOCKED");
log(`\n  ${ok.length}/${results.length} escenas verdes${blocked.length ? `  ·  ${blocked.length} BLOQUEADA(S)` : ""}`);
for (const b of blocked) log(`      ⛔ ${b.name} — ${b.last?.gate}: ${(b.last?.error || "").split("\n")[0]}`);
if (blocked.length) log(`\n  Ninguna escena bloqueada se entrega. El detalle de cada intento está en scenes/<escena>/.build-log.json`);
log(`\n  Siguiente paso humano: aprobar las verdes en preview, lockear con tools/alpha.sh, y firmar el kit.\n`);
if (verifyOnly) log("Verificación parcial: no ejecuta render ni firma entrega.");
process.exit(blocked.length || !contract.ok ? 1 : verifyOnly ? 2 : 0);
