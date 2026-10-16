#!/usr/bin/env node
/**
 * validate-kit.mjs — el contrato del kit de talking-head, verificado por máquina.
 *
 * POR QUÉ EXISTE
 *   El kit de `niveles-control` se construyó contra el guion LEÍDO (~1:11) cuando el corte real
 *   duraba 2:09.8. Resultado: 12 clips cubriendo 71.5 s de 129.8 s (55 %) — y entre lo que quedó
 *   desnudo estaban los dos beats que Walter marcó y 13 s del GIRO, que era la TESIS del video.
 *   Esa cuenta se estaba haciendo a mano en SCENES.md. Acá la hace el programa.
 *
 *   En un talking-head no hay seams de cámara (el ancla es Walter hablando), así que el contrato
 *   NO es el de motion-graphics. Es el de COLOCACIÓN: que cada overlay caiga en la palabra exacta,
 *   que dos no se pisen en la misma zona, que no quede pantalla desnuda, y que la duración del clip
 *   alcance para el beat. El seam de continuidad existe SOLO entre escenas full-frame contiguas,
 *   es OPCIONAL, y cuando no va se declara `null` a propósito.
 *
 * USO
 *   node tools/validate-kit.mjs <slug>              # valida
 *   node tools/validate-kit.mjs <slug> --tabla      # además imprime la tabla generada
 *   node tools/validate-kit.mjs <slug> --hueco 1.5  # umbral de hueco en segundos (default 2.0)
 *
 * SALIDA: exit 0 = verde · 1 = algo roto (usable como gate en un pipeline)
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { hallarCorte, cuadraConElCorte, fmtSeg, hallarTranscripts } from "./lib-corte.mjs";
import {sourceState} from './source-state.mjs';
import {config,resolveProject,ROOT,projectSlug} from './project.mjs';
import {scenes as registeredScenes,approvalState,outputState} from "./scene-state.mjs";
import {loadStyle} from "./style.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const RESERVED = new Set(["tools", "templates", "design_system", "assets", "renders", "_archive"]);
const SEAM_MIN_FRAMES = 12;          // <0.4s @30fps no alcanza para una transición: es un parpadeo
const ZONES = ["superior", "centro", "lateral-izq", "lateral-der", "inferior", "full"];

const errors = [], warns = [], notes = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ─────────────────────────────────────────────────────────── args
const args = process.argv.slice(2);
const needle = args.find((a,i) => !a.startsWith("--") && args[i-1]!=="--hueco");
if (!needle) {
  console.error("uso: node tools/validate-kit.mjs <slug> [--tabla] [--hueco 2.0]");
  process.exit(1);
}
const showTable = args.includes("--tabla");
// OJO: sin el flag, indexOf da -1 y args[0] es el slug. `parseFloat("2026-08-...")` = 2026, y el
// umbral se iba a 2026 s → ningún hueco lo superaba y el gate decía "sin pantalla desnuda" con
// 22 s desnudos. Nunca leer args[i+1] sin confirmar que i >= 0.
const gapIdx = args.indexOf("--hueco");
const gapMax = gapIdx >= 0 ? (parseFloat(args[gapIdx + 1]) || 2.0) : 2.0;

const base = resolveProject(needle);
const slug=projectSlug(base);
const finalStage=args.includes('--final');
const registered=config(base);
if(registered){const identity=sourceState(base);if(!identity.ok){console.error(identity.error);process.exit(identity.state==='FAIL'?1:2);}}
const continuousCoverage=registered?.style?loadStyle(registered.style).continuousOverlayCoverage:true;

// ─────────────────────────────────────────────────────────── helpers
/** "1:22.5" | "0:05" | "82.5" → segundos */
function toSec(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  const m = s.match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2].replace(",", "."));
}
const fmt = (sec) =>
  sec == null ? "—" : `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9áéíóúñ ]/gi, " ").replace(/\s+/g, " ").trim();

function ffprobe(file, entries) {
  try {
    return execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", entries, "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────── transcript (el reloj del corte)
function loadSrt() {
  if(registered){const t=hallarTranscripts(base).find(t=>t.cues);return t?{...t,file:t.rel}:null;}
  const cands = readdirSync(base).filter((f) => f.endsWith(".srt"));
  // el corregido manda sobre el crudo si hay más de uno
  const pick = cands.sort((a, b) => (/corregid/i.test(b) ? 1 : 0) - (/corregid/i.test(a) ? 1 : 0))[0];
  if (!pick) return null;
  const raw = readFileSync(join(base, pick), "utf8");
  const cues = [];
  for (const blk of raw.split(/\r?\n\r?\n/)) {
    const m = blk.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
    if (!m) continue;
    const t = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
    const text = blk.split(/\r?\n/).slice(2).join(" ").trim();
    cues.push({ start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]), text });
  }
  return { file: pick, cues, mtime:statSync(join(base,pick)).mtimeMs, dur: cues.length ? cues[cues.length - 1].end : null };
}
const srt = loadSrt();
if (!srt) warn("no hay .srt en la raíz del proyecto — no puedo verificar que los beats caigan en habla real (invariante ① saltado)");

/* ⛔ EL RELOJ ES EL CORTE, NO EL .SRT (29-ago-2026).
   Antes: `const cut = srt?.dur ?? null` — se medía la cobertura contra el último cue del mismo
   .srt del que salieron las ventanas. Circular: el kit siempre cubre el 100 % de su propio
   reloj. `siete-pasos` daba «✓ cobertura 100.0 %» con el .srt 4,1 s más corto que el corte,
   así que los 4 s del cierre iban desnudos y nadie lo veía. Ver lib-corte.mjs. */
const corteReal = hallarCorte(base);
if (corteReal && srt) {
  const v = cuadraConElCorte(srt, corteReal);
  if (v.veredicto === "otra-toma") {
    errors.push(
      `${srt.file} describe ${fmtSeg(srt.dur)} pero ${corteReal.rel} dura ${fmtSeg(corteReal.dur)}` +
      `${v.masViejo ? " y el .srt es MÁS VIEJO que el corte" : ""} — es otra toma. ` +
      `Re-transcribí antes de leer un solo timestamp de acá: todo error de colocación que reporte ` +
      `este gate sobre un .srt equivocado es un artefacto, no un defecto del kit.`
    );
  } else if (v.veredicto === "cola") {
    errors.push(
      `${srt.file} termina en ${fmtSeg(srt.dur)} y ${corteReal.rel} dura ${fmtSeg(corteReal.dur)} — ` +
      `faltan ${v.delta.toFixed(1)} s de cola (whisper suele comerse la frase de cierre). ` +
      `La cobertura de abajo está medida contra el reloj corto: esos ${v.delta.toFixed(1)} s finales van DESNUDOS.`
    );
  }
}
/* Si el .srt no es de este corte, los invariantes ① y ③ NO SE CORREN.
   Antes sí corrían: nacho-brain-rot escupía 17 errores de colocación con timestamps precisos
   («el beat dice 0:03.2 pero esas palabras se hablan en 0:06.9») medidos contra la toma vieja.
   Ninguno era real y todos parecían reales — que es exactamente el modo de falla que este
   gate existe para eliminar. Un input que no se puede confiar no produce hallazgos: produce
   UN error, el del input, y el resto queda declarado como no verificable. */
const vCorte = srt && corteReal ? cuadraConElCorte(srt, corteReal) : null;
/* "cola" ≠ "otra-toma", y la diferencia cambia qué se puede verificar:
     · otra-toma → NINGUNA colocación vale (los 17 falsos rojos de nacho). Se corta todo.
     · cola      → las colocaciones ANTERIORES al último cue sí valen; lo que no se puede
                   afirmar es el tramo final. Cortar todo acá sería sobre-corregir y perder
                   los 12 chequeos buenos de siete-pasos por 4 s de cierre. */
const srtConfiable = !vCorte || vCorte.veredicto === "ok" || vCorte.veredicto === "cola";
if (!corteReal) warn("no encuentro el corte en disco — la cobertura se mide contra el .srt, que es su propia medición (invariante ③ debilitado)");


// ─────────────────────────────────────────────────────────── escenas
const scenesDir = join(base, "scenes");
if (!existsSync(scenesDir)) { console.error(`✗ ${slug} no tiene scenes/ — ¿es un proyecto del carril retirado (index.html único)? Ver ../_legacy/overlay-pipeline/RETIRADO.md`); process.exit(1); }

const scenes = [];
for (const name of readdirSync(scenesDir).sort()) {
  const dir = join(scenesDir, name);
  if (!statSync(dir).isDirectory()) continue;
  /* `_archivadas/` y `_retiradas/` son carpetas de descarte, no escenas: cuando un corte se
     re-graba, las escenas que ya no existen se mueven ahí en vez de borrarse (nacho-brain-rot
     archivó S02 al pasar de 74,5 s a 57,0 s). Sin esta línea el gate las reportaba como
     «sin meta.json» — un rojo por hacer bien las cosas. */
  if (name.startsWith("_") || name.startsWith(".")) continue;
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) { err(`${name}: sin meta.json`); continue; }
  let meta;
  try { meta = JSON.parse(readFileSync(metaPath, "utf8")); }
  catch (e) { err(`${name}: meta.json ilegible — ${e.message}`); continue; }

  // beat: string (formato v1, 20 escenas en disco) u objeto (v2, con ventana)
  const beat = typeof meta.beat === "string" ? { words: meta.beat } : (meta.beat || {});
  const fps = meta.timing?.fps ?? 30;
  const type = meta.type || "alpha";

  // La duración la manda el index.html (data-duration). meta.json la DUPLICA, y una copia se
  // desincroniza: en niveles-control tres escenas se extendieron en el html y el meta quedó en
  // el valor viejo (132 frames cuando el clip ya duraba 150). El html es la verdad; el meta y el
  // render se comparan CONTRA él.
  const htmlPath = join(dir, "index.html");
  let htmlFrames = null;
  if (existsSync(htmlPath)) {
    const m = readFileSync(htmlPath, "utf8").match(/data-duration\s*=\s*"([\d.]+)"/);
    if (m) htmlFrames = Math.round(parseFloat(m[1]) * fps);
  }
  const metaFrames = meta.timing?.durationFrames ?? null;
  if (htmlFrames != null && metaFrames != null && Math.abs(htmlFrames - metaFrames) > 1)
    err(`${name}: index.html dura ${(htmlFrames / fps).toFixed(1)}s (${htmlFrames}f) pero meta.json dice ${metaFrames}f — el html manda, actualiza el meta`);
  const frames = htmlFrames ?? metaFrames;
  const bStart = toSec(beat.start), bEnd = toSec(beat.end);
  const place = toSec(meta.place) ?? bStart;

  if (typeof meta.beat === "string")
    notes.push(`${name}: beat en formato v1 (texto suelto) — sin start/end no se puede verificar colocación ni cobertura`);
  if (frames == null) err(`${name}: sin data-duration en index.html ni timing.durationFrames en meta.json`);
  if (meta.zone && !ZONES.includes(meta.zone)) err(`${name}: zone '${meta.zone}' no válida (${ZONES.join(" · ")})`);

  // render en disco (nombre estable — CapCut relinkea por ruta)
  const rDir = join(dir, "renders");
  let render = null;
  if (existsSync(rDir)) {
    const files = readdirSync(rDir).filter((f) => /\.(mov|mp4)$/i.test(f) && !/\.straight\.mov$/i.test(f) && !f.startsWith("_"));
    render = files.length ? join(rDir, files[0]) : null;
    if(finalStage){const state=outputState(base,registeredScenes(base,'KIT').find(sc=>sc.id===name));if(state.ok&&state.file)render=state.file;}
  }

  scenes.push({
    name, dir, meta, type, fps, frames, beat, bStart, bEnd, place,
    zone: meta.zone || (type === "full" ? "full" : null),
    dur: frames != null ? frames / fps : null,
    seam: meta.seam === undefined ? undefined : meta.seam,
    render,
  });
}
if (!scenes.length) { console.error(`✗ ${slug}/scenes/ está vacío`); process.exit(1); }

// ─────────────────── ⓘ ids únicos — TODAS las tools matchean por substring (`*S01*`) y agarran
// la primera. Dos escenas con el mismo id significa renderizar/previsualizar la equivocada sin
// un solo error. (Pasó de verdad: el scaffold creaba S01-overlay y map-beats creaba S01-…)
const byId = new Map();
for (const s of scenes) {
  if (byId.has(s.meta.id || s.name.split("-")[0])) {
    const id = s.meta.id || s.name.split("-")[0];
    err(`id '${id}' duplicado: ${byId.get(id)} y ${s.name} — el match parcial de preview/alpha/final va a agarrar la equivocada. Renombrá una.`);
  } else byId.set(s.meta.id || s.name.split("-")[0], s.name);
}

const placed = scenes.filter((s) => s.place != null && s.dur != null)
  .sort((a, b) => a.place - b.place);

// ─────────────────── ① el beat existe en el transcript y la colocación cae ahí
if (srt && srtConfiable) {
  for (const s of scenes) {
    if (!s.beat.words || s.bStart == null) continue;
    const w = norm(s.beat.words).split(" ").filter((x) => x.length > 3).slice(0, 6);
    if (w.length < 2) continue;                        // beat demasiado corto para buscarlo
    const hit = srt.cues.find((c) => {
      const t = norm(c.text);
      return w.filter((x) => t.includes(x)).length >= Math.max(2, Math.ceil(w.length * 0.5));
    });
    if (!hit) { warn(`${s.name}: las palabras del beat no aparecen en ${srt.file} — ¿se regrabó el corte y no se re-mapeó?`); continue; }
    if (s.bStart < hit.start - 1.2 || s.bStart > hit.end + 1.2)
      err(`${s.name}: el beat dice ${fmt(s.bStart)} pero esas palabras se hablan en ${fmt(hit.start)}–${fmt(hit.end)} — el overlay cae sobre la frase equivocada`);
  }
}

// ─────────────────── ② dos overlays no se pisan en la misma zona
for (let i = 0; i < placed.length; i++) {
  for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    /* ⛔ EPSILON DE MEDIO FRAME (1-sep-2026). Iba `b.place >= a.place + a.dur` a secas y en
       coma flotante `13.8 + 5.4 === 19.200000000000003`, así que un clip que termina EXACTO
       donde arranca el siguiente se reportaba como solape en la misma zona. Es la juntura
       que uno QUIERE: sin hueco (un frame sin clip hace parpadear un overlay persistente)
       y sin solape. Medio frame de tolerancia es menos que la resolución del timeline. */
    if (b.place >= a.place + a.dur - 1 / 60) break;    // ordenado: ya no hay solape posible
    if (!a.zone || !b.zone) {
      warn(`${a.name} y ${b.name} se solapan (${fmt(b.place)}) y al menos una no declara zone — no puedo saber si se tapan`);
    } else if (a.zone === b.zone) {
      err(`${a.name} y ${b.name} se solapan en la MISMA zona '${a.zone}' a los ${fmt(b.place)} — se van a tapar`);
    }
  }
}

// ─────────────────── ③ cobertura: nada de pantalla desnuda (EL bug del 55 %)
const cut = corteReal?.dur ?? srt?.dur ?? null;
let coverage = null, gaps = [];
if (cut && placed.length && continuousCoverage) {
  const merged = [];
  for (const s of placed) {
    const seg = [s.place, s.place + s.dur];
    const last = merged[merged.length - 1];
    if (last && seg[0] <= last[1]) last[1] = Math.max(last[1], seg[1]);
    else merged.push(seg);
  }
  const covered = merged.reduce((t, [a, b]) => t + (Math.min(b, cut) - Math.max(a, 0)), 0);
  coverage = (covered / cut) * 100;
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a - cursor > gapMax) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cut - cursor > gapMax) gaps.push([cursor, cut]);
  for (const [a, b] of gaps)
    err(`pantalla DESNUDA ${fmt(a)}–${fmt(b)} (${(b - a).toFixed(1)} s sin overlay) — regla: overlays durante todo el video`);
}

// ─────────────────── ④ el clip renderizado dura lo que dice el meta, y alcanza para el beat
for (const s of scenes) {
  if (s.bStart != null && s.bEnd != null && s.dur != null) {
    const beatDur = s.bEnd - s.bStart;
    if (s.dur < beatDur - 0.35)
      err(`${s.name}: el clip dura ${s.dur.toFixed(1)} s pero el beat dura ${beatDur.toFixed(1)} s — quedan ${(beatDur - s.dur).toFixed(1)} s del beat sin animación`);
  }
  if (s.render && s.frames != null) {
    const nb = ffprobe(s.render, "stream=nb_frames");
    const real = nb && /^\d+$/.test(nb) ? parseInt(nb, 10) : null;
    if (real && Math.abs(real - s.frames) > 2)
      err(`${s.name}: la composición dura ${s.frames}f pero ${basename(s.render)} tiene ${real}f — el render está viejo, re-lockea la escena`);
  }
}

// ─────────────────── ⑤ el kit está completo (nombres estables en disco)
for (const s of scenes) {
  if (s.type === "footage") continue;
  if (!existsSync(join(s.dir, "index.html"))) { err(`${s.name}: type '${s.type}' pero no tiene index.html`); continue; }
  if (!s.render) (finalStage?err:warn)(`${s.name}: sin render en renders/ — PENDIENTE, no entra al kit`);
}

if(finalStage){for(const sc of registeredScenes(base,'KIT')){const a=approvalState(base,sc);if(!a.ok)err(`${sc.id}: approval ${a.state}`);const o=outputState(base,sc);if(!o.ok)err(`${sc.id}: export ausente o anterior a sus inputs`);}}

// ─────────────────── ⑥ seam — OPCIONAL, solo entre full-frame contiguas
const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const seamPairs = [];
for (let i = 0; i < placed.length - 1; i++) {
  const a = placed[i], b = placed[i + 1];
  const adjacent = Math.abs(b.place - (a.place + a.dur)) <= 0.2;   // pegadas, sin volver a Walter
  const bothFull = a.type === "full" && b.type === "full";
  const aExit = a.seam?.exit, bEntry = b.seam?.entry;

  if (!bothFull || !adjacent) {
    if (aExit || bEntry)
      err(`seam declarado entre ${a.name} y ${b.name}, pero ${!bothFull ? "no son las dos full-frame" : "no están contiguas (vuelve el footage en medio)"} — un seam solo existe entre full-frame pegadas`);
    continue;
  }
  // candidatas: acá el seam es una decisión, y se registra
  if (a.seam === undefined || b.seam === undefined) {
    warn(`${a.name} → ${b.name}: full-frame contiguas sin decisión de seam. Escribe "seam": null (corte duro) o el objeto con carry — no lo dejes sin declarar`);
    continue;
  }
  if (a.seam === null || b.seam === null) continue;                 // corte duro, decidido
  if (!!aExit !== !!bEntry) {
    err(`seam colgado entre ${a.name} y ${b.name}: ${aExit ? "la primera declara exit y la segunda no declara entry" : "la segunda declara entry y la primera no declara exit"}`);
    continue;
  }
  if (!eq(aExit, bEntry)) {
    err(`seam ROTO ${a.name} → ${b.name}: exit ${JSON.stringify(aExit)} ≠ entry ${JSON.stringify(bEntry)} — el elemento salta en el corte`);
    continue;
  }
  const runway = Math.min(a.frames ?? 0, b.frames ?? 0);
  if (runway < SEAM_MIN_FRAMES) {
    err(`seam ${a.name} → ${b.name}: solo ${runway} frames de pista (mínimo ${SEAM_MIN_FRAMES} = 0.4 s @30fps) — sin tiempo no es transición, es parpadeo. Ponlo en null`);
    continue;
  }
  seamPairs.push([a.name, b.name, aExit?.carry ?? "?"]);
}

// ─────────────────────────────────────────────────────────── salida
console.log(`\n  VALIDATE KIT · ${slug}`);
console.log(`  ${scenes.length} escenas · ${placed.length} con colocación · corte ${cut ? fmt(cut) : "desconocido"}${corteReal ? ` (${corteReal.rel})` : ""}${srt ? ` · transcript ${srt.file}${vCorte?.veredicto === "otra-toma" ? " ⚠ NO ES DE ESTE CORTE" : vCorte?.veredicto === "cola" ? ` ⚠ le faltan ${vCorte.delta.toFixed(1)} s de cola` : ""}` : ""}`);
if (coverage != null) {
  const icon = gaps.length ? "✗" : "✓";
  console.log(`  ${icon} cobertura ${coverage.toFixed(1)} %  ${gaps.length ? `— ${gaps.length} hueco(s) > ${gapMax}s` : "— sin pantalla desnuda"}`);
}
if (seamPairs.length) {
  console.log(`  ✓ ${seamPairs.length} seam(s) calzado(s) — PEGAR SIN GAP y SIN transición de CapCut:`);
  for (const [a, b, carry] of seamPairs) console.log(`      ${a} → ${b}   (viaja: ${carry})`);
}

if (showTable) {
  console.log(`\n  TABLA GENERADA (para KIT_README — no la escribas a mano)\n`);
  console.log("  | # | Clip | Entra en | Dur | Zona | Beat |");
  console.log("  |---|------|----------|-----|------|------|");
  placed.forEach((s, i) => {
    const clip = s.render ? basename(s.render) : `${s.name} ⏳PENDIENTE`;
    const words = (s.beat.words || "").slice(0, 54).replace(/\|/g, "/");
    console.log(`  | ${i + 1} | \`${clip}\` | **${fmt(s.place)}** | ${s.dur?.toFixed(1)} | ${s.zone ?? "—"} | ${words} |`);
  });
}

if (notes.length) {
  console.log(`\n  ${notes.length} escena(s) en formato v1 (beat sin ventana):`);
  for (const n of notes.slice(0, 8)) console.log(`      · ${n}`);
  if (notes.length > 8) console.log(`      · … y ${notes.length - 8} más`);
}
if (warns.length) {
  console.log(`\n  ${warns.length} aviso(s):`);
  for (const w of warns) console.log(`      ! ${w}`);
}
if (errors.length) {
  console.log(`\n  ${errors.length} ERROR(ES) — el kit no se entrega así:`);
  for (const e of errors) console.log(`      ✗ ${e}`);
  console.log("");
  process.exit(1);
}

/* ⛔ UN GATE QUE SALTÓ SUS INVARIANTES NO SALE VERDE (29-ago-2026).
   `validate-kit wallbit-invertir` imprimía «✓ contrato del kit VERDE» después de saltar el
   invariante ① (no había .srt) y con las 15 escenas en formato v1 (beat sin ventana, o sea
   colocación y cobertura IMPOSIBLES de verificar). Verificó cero y firmó verde. Ese verde es
   peor que un rojo: compra confianza sobre un kit que nadie revisó. Sale por código 2. */
const saltados = [];
if (!srt && !registered?.transcript?.notApplicable) saltados.push("① colocación — no hay .srt en la raíz");
if (srt && !srtConfiable) saltados.push("① colocación — el .srt es de otra toma (ver el error de arriba)");
if (notes.length) saltados.push(`①③ colocación y cobertura — ${notes.length} escena(s) en formato v1 (beat sin ventana)`);
if (continuousCoverage && coverage == null) saltados.push("③ cobertura — sin reloj del corte");
if (saltados.length) {
  console.log(`\n  ? NO VERIFICABLE — el contrato no se pudo comprobar entero:`);
  for (const x of saltados) console.log(`      · invariante ${x}`);
  console.log(`  Esto NO es verde. Lo que no se midió, no está bien: está sin mirar.\n`);
  process.exit(2);
}
console.log(`\n  ✓ contrato del kit VERDE\n`);
