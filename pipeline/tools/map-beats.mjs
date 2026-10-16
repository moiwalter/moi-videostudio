#!/usr/bin/env node
import {sourceState} from './source-state.mjs';
import {config,resolveProject,ROOT,projectSlug} from './project.mjs';
/**
 * map-beats.mjs — del transcript al MAPA DE BEATS, propuesto para que Walter apruebe.
 *
 * QUÉ RESUELVE
 *   Es el trabajo manual más grande del pipeline: pegar el transcript, escribir la tabla de beats
 *   a mano, crear una carpeta por escena, hacer `ln -s design_system` en cada una, y teclear 20
 *   `meta.json` con las ventanas. Todo eso sale del .srt.
 *
 *   Esto NO decide qué se cuenta — eso es de Walter. Propone el corte en beats y él aprueba,
 *   junta, parte o borra. Después `--aplicar` construye el esqueleto.
 *
 * DOS CARRILES, UN SOLO CORTE EN BEATS
 *   El corte en beats sale del mismo .srt en los dos carriles — por eso viven acá y no en
 *   dos herramientas que se driftan. Lo que cambia es QUÉ se escribe:
 *     KIT     scenes/<SNN>/meta.json por escena  → lo gatea validate-kit.mjs
 *     MASTER  master/BEATS.json, uno solo        → lo gatea qc-master.mjs
 *   En MASTER las escenas viven inline en master/index.html y no hay meta.json donde poner
 *   nada, así que el mapa es un archivo del proyecto, no uno por carpeta.
 *
 * USO
 *   node tools/map-beats.mjs <slug>                  propone la tabla (no escribe nada)
 *   node tools/map-beats.mjs <slug> --largo 7        apunta a beats de ~7s (default 6)
 *   node tools/map-beats.mjs <slug> --aplicar        crea el esqueleto del carril que toque
 *   node tools/map-beats.mjs <slug> --carril master  fuerza el carril (default: se infiere)
 *   node tools/map-beats.mjs <slug> --check          valida el BEATS.json ya escrito (master)
 *   node tools/map-beats.mjs <slug> --aplicar --marca cvander    con otra marca
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { hallarTranscripts, hallarCorte, cuadraConElCorte, fmtSeg } from "./lib-corte.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const RESERVED = new Set(["tools", "templates", "design_system", "assets", "renders", "_archive", "brands"]);

const args = process.argv.slice(2);
/* ⛔ El slug NO es «el primer arg sin --» (30-ago-2026). Con `--largo 7 slug` el valor del
   flag se colaba como slug. Mismo defecto que ya estaba medido en qc-master y new-video.sh:
   todo flag CON VALOR tiene que estar declarado o el parser se come su argumento. */
const FLAGS_CON_VALOR = new Set(["--largo", "--marca", "--carril", "--cortes"]);
const needle = args.find((a, i) => !a.startsWith("--") && !FLAGS_CON_VALOR.has(args[i - 1]));
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!needle) { console.error("uso: node tools/map-beats.mjs <slug> [--largo 6] [--aplicar] [--carril kit|master] [--check] [--emitir] [--marca moi]"); process.exit(1); }

const slug = projectSlug(resolveProject(needle));
if (!slug) { console.error(`✗ ningún video matchea '${needle}'`); process.exit(1); }
const base = resolveProject(needle);
const cfg=config(base);
if(cfg){const identity=sourceState(base);if(!identity.ok){console.error(identity.error);process.exit(2);}}
if(cfg?.engine.name==='remotion'&&(flag('emitir')||flag('aplicar'))){console.error('Remotion: author BEATS.json and React scenes in the registered project; HTML emitter is not applicable.');process.exit(2);}
const TARGET = parseFloat(val("largo", "6"));
const apply = flag("aplicar");
const check = flag("check");
const brandName = val("marca", "moi");

/* El carril sale del disco, igual que en flujo.mjs — no de un campo declarado que se
   olvida de actualizar. El flag existe para forzarlo cuando el master todavía no existe. */
const MASTER_IDX = join(base, "master", "index.html");
/* Cualquiera de los dos marca el carril: el mapa (BEATS.json) llega ANTES que la composición
   (index.html). Mirando sólo el index.html, un proyecto recién mapeado se leía como KIT y
   --check se negaba a correr sobre su propio mapa. */
const esMaster = existsSync(MASTER_IDX) || existsSync(join(base, "master", "BEATS.json"));
const carril = (val("carril", null) || (esMaster ? "master" : "kit")).toLowerCase();
if (!["kit", "master"].includes(carril)) { console.error(`✗ carril '${carril}' no existe — kit | master`); process.exit(1); }
const BEATS_JSON = join(base, "master", "BEATS.json");

/* ── EL VALIDADOR DEL MAPA (master) ────────────────────────────────────────────
   Corre sobre el BEATS.json ya escrito, sin abrir Chrome ni tocar el .srt: es lo que
   flujo.mjs consulta para saber si el mapa está aprobado o a medias. La disciplina es la
   del `seam` del kit: un campo en null NO es un default silencioso, es una decisión que
   falta — y se rebota. Los takeover NO se cuentan ni se exigen: se ganan su lugar. */
if (check) {
  if (carril !== "master") { console.error(`✗ --check es del carril master (este es ${carril})`); process.exit(1); }
  if (!existsSync(BEATS_JSON)) {
    console.error(`\n✗ ${slug} no tiene master/BEATS.json — el mapa del master no está hecho.`);
    console.error(`  node tools/map-beats.mjs ${needle} --carril master --aplicar\n`);
    process.exit(1);
  }
  let B; try { B = JSON.parse(readFileSync(BEATS_JSON, "utf8")); }
  catch (e) { console.error(`✗ BEATS.json ilegible — ${e.message}`); process.exit(1); }

  const errs = [], avis = [];
  /* ⛔ El techo es un DATO DEL VIDEO, no una constante (30-ago-2026). Estaba clavado en 1.19
     acá mientras qc-master ya lo leía de data-qc-camara-techo — dos validadores del mismo
     invariante con distinta verdad. En Enzo la base es 1.20 por decisión cerrada (ventana
     anclada arriba para sacar las notas del escritorio), así que el 1.19 lo marcaba TODO en
     rojo. Misma precedencia que allá: atributo del video > default. */
  const PISO = 1.0;
  let TECHO = 1.19;
  try {
    const fr = readFileSync(MASTER_IDX, "utf8").match(/<div[^>]*data-composition-id="main"[^>]*>/)?.[0] || "";
    const m = fr.match(/data-qc-camara-techo="([\d.]+)"/);
    if (m) TECHO = +m[1];
  } catch {}

  if (!B.hook?.texto) errs.push(`falta el HOOK textual — es obligatorio en el carril master`);
  else {
    const n = B.hook.texto.trim().split(/\s+/).length;
    if (n > 5) errs.push(`el hook tiene ${n} palabras (máximo 5: se lee en menos de un segundo)`);
    if (!(B.hook.end > B.hook.start)) errs.push(`la ventana del hook no es válida`);
  }

  /* ⛔ EL CONCEPTO VA ANTES QUE EL TRATAMIENTO (30-ago-2026, decisión de Walter).
     Elegir "pictograma" beat por beat sin una dirección es decorar. Primero se eligen 5
     conceptos DIVERGENTES sobre el mapa ya cortado —con los beats a la vista, no en el aire—,
     Walter elige uno, y ESE concepto reparte el tratamiento de cada beat. Aprobar un concepto
     no lo vuelve verdad dura: es dirección, y se corrige beat por beat después. */
  const bs = B.beats || [];
  if (!bs.length) errs.push(`el mapa no tiene beats`);
  if (!B.concepto?.nombre)
    errs.push(`el mapa no tiene CONCEPTO. Los 5 conceptos se proponen sobre los beats ya cortados y vos elegís uno; de ahí sale el tratamiento de cada escena.`);
  for (const b of bs) {
    if (b.tratamiento == null)
      errs.push(`${b.id}: tratamiento sin decidir. Sale del concepto — o poné "ninguno" a propósito, como el seam.`);
    if (b.takeover == null) avis.push(`${b.id}: takeover sin declarar (se asume false)`);
  }
  /* Los ASSETS ya no se declaran acá. Walter (30-ago): "muéstrame escena y después asset,
     tú tendrías como un placeholder". El agente deja un hueco a rayas con su descripción y
     el asset se decide DESPUÉS de ver la escena — es mucho más fácil llenar un hueco que se
     ve que imaginarlo en una tabla. */

  const cam = B.camara || [];
  if (!cam.length) {
    console.log(`  · sin cámara declarada — legítimo, no todos los master la usan`);
  } else {
    const dur = B.corte?.dur ?? null;
    const ord = [...cam].sort((a, b) => a.start - b.start);
    if (Math.abs(ord[0].start) > 0.001) errs.push(`la cámara arranca en ${ord[0].start}s, no en 0`);
    if (dur != null && Math.abs(ord[ord.length - 1].end - dur) > 0.05)
      errs.push(`la cámara termina en ${ord[ord.length - 1].end}s y el corte dura ${dur}s`);
    for (let i = 1; i < ord.length; i++) {
      const g = ord[i].start - ord[i - 1].end;
      if (Math.abs(g) > 0.001)
        errs.push(`${g > 0 ? "hueco" : "solape"} de ${Math.abs(g).toFixed(2)}s entre los tramos ${i} y ${i + 1} (${ord[i - 1].end} → ${ord[i].start})`);
    }
    /* continuidad de escala: donde termina un tramo tiene que empezar el siguiente */
    const fin = (t) => t.kind === "in" ? t.base + t.amount : t.base;
    const ini = (t) => t.kind === "out" ? t.base + t.amount : t.base;
    /* ⛔ EL SALTO DE ESCALA ES LA TÉCNICA, NO UN DEFECTO (30-ago-2026).
       Esto era ERROR y marcó en rojo el mapa de Enzo, cuyo DIRECCION.md dice con todas las
       letras: "el valor está en el CORTE entre dos escalas, no en el movimiento — escala FIJA
       por escena, y el cambio ocurre en el corte". Es la MISMA lección que ya se había medido
       en qc-master contra tu-carrera (20 rojos sobre un video entregado) y que no se propagó
       hasta acá: dos validadores del mismo invariante con distinta verdad.
       Queda como aviso: informa dónde salta, y Walter confirma que es a propósito. */
    for (let i = 1; i < ord.length; i++)
      if (Math.abs(ini(ord[i]) - fin(ord[i - 1])) > 0.005)
        avis.push(`la escala salta de ${fin(ord[i - 1]).toFixed(2)} a ${ini(ord[i]).toFixed(2)} en ${ord[i].start}s — si es un corte deliberado, es la técnica`);
    for (const t of ord) {
      const alto = Math.max(ini(t), fin(t));
      if (alto > TECHO + 0.001) errs.push(`escala ${alto.toFixed(2)} en ${t.start}s pasa el techo ${TECHO} — la fuente se ablanda`);
      if (Math.min(ini(t), fin(t)) < PISO - 0.001) avis.push(`escala ${Math.min(ini(t), fin(t)).toFixed(2)} en ${t.start}s por debajo de ${PISO}`);
      if (t.kind !== "hold" && t.amount < 0.11)
        avis.push(`el tramo de ${t.start}s mueve ${(t.amount * 100).toFixed(0)}% — debajo del 11% es el push invisible`);
    }
    const oxs = new Set(ord.map((t) => `${t.originX},${t.originY}`));
    if (oxs.size === 1 && ord.length > 2 && !B.origen_constante_ok)
      errs.push(`el origen es el MISMO en los ${ord.length} tramos (${[...oxs][0]}) — dos escenas a la misma escala se leen como la misma toma. Si es a propósito y está medido, poné "origen_constante_ok": true con el porqué.`);
  }

  console.log(`\n  MAPA DEL MASTER · ${slug} · ${bs.length} beats · ${cam.length} tramos de cámara`);
  for (const e of errs) console.log(`  ✗ ${e}`);
  for (const a of avis) console.log(`  ⚠ ${a}`);
  if (errs.length) { console.log(`\n✗ ${errs.length} error(es) — el mapa no está listo\n`); process.exit(1); }
  console.log(`\n✓ mapa del master válido${avis.length ? ` · ${avis.length} aviso(s)` : ""}\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────── transcript
const srtName = cfg?.transcript?.file || readdirSync(base).filter((f) => f.endsWith(".srt"))
  .sort((a, b) => (/corregid/i.test(b) ? 1 : 0) - (/corregid/i.test(a) ? 1 : 0))[0];
if (!srtName) {
  console.error(`✗ ${slug} no tiene .srt en la raíz.`);
  console.error(`  Transcribí primero:  hyperframes transcribe <corte>.mp4 -m large-v3 -l es --to srt -o <corte>.srt`);
  console.error(`  (el default es small.en = INGLÉS; para español van -m large-v3 -l es)`);
  console.error(`  Respaldo:            whisper <corte>.mp4 --model medium --word_timestamps True --output_format srt`);
  process.exit(1);
}
const cues = cfg?(hallarTranscripts(base)[0]?.cues||[]):[];
for (const blk of (cfg?[]:readFileSync(join(base, srtName), "utf8").split(/\r?\n\r?\n/))) {
  const m = blk.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (!m) continue;
  const t = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
  cues.push({
    start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]),
    text: blk.split(/\r?\n/).slice(2).join(" ").trim(),
  });
}
if (!cues.length) { console.error(`✗ ${srtName} no tiene cues legibles`); process.exit(1); }

// ─────────────────────────────────────────────────────────── el corte en beats
/* HEURÍSTICA (determinista, y a propósito conservadora: es más fácil juntar dos beats que
   descubrir que a uno le falta la mitad).  Se abre un beat nuevo cuando:
     a) el cue arranca con un MARCADOR de discurso o de enumeración — ahí el guion gira;
     b) el beat ya llegó al largo objetivo Y el cue anterior cerró con puntuación de frase;
     c) hay una pausa real (>0.45s) y el beat ya tiene al menos 2.5s.
   Un beat nunca pasa de 2× el objetivo: si se pasa, se corta igual. */
const MARKERS = /^\s*(nivel\s+\d|n[úu]mero\s+\d|paso\s+\d|primero|segundo|tercero|pero|sin embargo|y por eso|as[íi] que|entonces|ahora|adem[áa]s|lo mejor|lo peor|en resumen|resulta que|y eso es|la clave|el problema|porque|cuando|si tú|ojo)/i;

/* ⛔ EL CORTE DE WALTER GANA (30-ago-2026).
   La heurística de abajo corta por puntuación, pausas y largo objetivo — o sea por FORMA. El
   argumento no está ahí: en el video de Enzo partía el término marcado ("personal software") al
   medio, separaba una causa de su efecto, y rompía la tesis en dos. Todo eso lo ve un humano
   leyendo, no un regex contando segundos.
   Con --cortes se pasan los bordes en segundos y la heurística no corre: el mapa lo aprueba
   Walter, así que su corte tiene que poder ENTRAR, no sólo comentarse. */
const CORTES = val("cortes", null);
const beats = [];
let cur = null;
if (CORTES) {
  const bordes = CORTES.split(/[,\s]+/).filter(Boolean).map(Number).sort((a, b) => a - b);
  if (bordes.some(isNaN)) { console.error("✗ --cortes lleva segundos separados por coma: 0,6.8,16.1,…"); process.exit(1); }
  for (let i = 0; i < bordes.length; i++) {
    const a = bordes[i], z = bordes[i + 1] ?? cues[cues.length - 1].end;
    const dentro = cues.filter((c) => c.start >= a - 0.05 && c.start < z - 0.05);
    if (!dentro.length) { console.error(`✗ el tramo ${a}–${z}s no tiene ni un cue del .srt`); process.exit(1); }
    beats.push({ start: dentro[0].start, end: z, texts: dentro.map((c) => c.text) });
  }
}
if (!CORTES)
for (let i = 0; i < cues.length; i++) {
  const c = cues[i], prev = cues[i - 1];
  const len = cur ? c.end - cur.start : 0;
  const gap = prev ? c.start - prev.end : 0;
  const prevClosed = prev ? /[.!?]\s*$/.test(prev.text) : true;

  const nuevo = !cur
    || (MARKERS.test(c.text) && len >= 1.6)
    || (len >= TARGET && prevClosed)
    || (gap > 0.45 && len >= 2.5)
    || (len >= TARGET * 2);

  if (nuevo) { cur = { start: c.start, end: c.end, texts: [c.text] }; beats.push(cur); }
  else { cur.end = c.end; cur.texts.push(c.text); }
}

// etiqueta legible + palabras verbatim recortadas
const clean = (s) => s.replace(/\s+/g, " ").trim();
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const slugify = (s) => clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 2).join("-") || "beat";

const mapped = beats.map((b, i) => {
  const words = clean(b.texts.join(" "));
  return {
    id: `S${String(i + 1).padStart(2, "0")}`,
    name: slugify(words),
    start: b.start, end: b.end, dur: b.end - b.start,
    words,
  };
});

// ─────────────────────────────────────────────────────────── el reloj
/* ⛔ EL RELOJ ES EL CORTE, NO EL .srt (30-ago-2026).
   Acá decía `const cut = cues[cues.length-1].end`: la duración del video salía del último cue
   del transcript, y después la cobertura se medía contra ese mismo número. Circular — el mapa
   siempre cubre el 100 % del reloj que el propio mapa se inventó. Es el defecto que
   lib-corte.mjs documenta haber arreglado para validate-kit y flujo el 29-ago; map-beats quedó
   afuera sólo porque no importaba el módulo. Dos casos medidos ese día: siete-pasos (whisper se
   comió 4,1 s de cola y el kit cantó «100 %») y nacho-brain-rot (17 rojos contra un .srt de otra
   toma). Si no hay corte todavía, se usa el .srt y se dice EN VOZ ALTA que es provisorio. */
const corte = hallarCorte(base);
const srtFin = cues[cues.length - 1].end;
const cut = corte?.dur ?? srtFin;
console.log(`\n  MAPA DE BEATS PROPUESTO · ${slug}  [carril ${carril.toUpperCase()}]`);
if (corte?.dur != null) {
  const v = cuadraConElCorte({ dur: srtFin, mtime: 0 }, { dur: corte.dur, mtime: -1 });
  console.log(`  corte ${fmtSeg(corte.dur)} (${corte.rel}) · transcript ${srtName}`);
  if (v.veredicto === "cola")
    console.log(`  ⚠️  el .srt describe ${fmtSeg(srtFin)} — le faltan ${(corte.dur - srtFin).toFixed(1)}s de COLA. Los beats no llegan al final.`);
  else if (v.veredicto === "otra-toma")
    console.log(`  🔴 el .srt describe ${fmtSeg(srtFin)} y el corte dura ${fmtSeg(corte.dur)} — NO SON LA MISMA TOMA. Re-transcribí antes de seguir.`);
} else {
  console.log(`  ⚠️  sin corte en disco — reloj PROVISORIO tomado del .srt (${fmtSeg(srtFin)}). Volvé a correr con el corte listo.`);
  console.log(`     transcript ${srtName}`);
}
console.log(`  ${cues.length} cues → ${mapped.length} beats · objetivo ~${TARGET}s\n`);
console.log(`  ${"#".padEnd(5)}${"ventana".padEnd(18)}${"dur".padEnd(7)}palabras`);
console.log(`  ${"─".repeat(96)}`);
for (const m of mapped) {
  const w = m.words.length > 62 ? m.words.slice(0, 59) + "…" : m.words;
  const warn = m.dur > TARGET * 2.2 ? " ⚠️ largo" : m.dur < 1.6 ? " ⚠️ corto" : "";
  console.log(`  ${m.id.padEnd(5)}${`${fmt(m.start)}–${fmt(m.end)}`.padEnd(18)}${`${m.dur.toFixed(1)}s`.padEnd(7)}${w}${warn}`);
}
const total = mapped.reduce((t, m) => t + m.dur, 0);
console.log(`  ${"─".repeat(96)}`);
console.log(`  ${mapped.length} beats · ${total.toFixed(1)}s de ${cut.toFixed(1)}s cubiertos (${(total / cut * 100).toFixed(1)}%)\n`);

// ─────────────────────────────────────── CARRIL MASTER: el mapa, no las carpetas
/* En master no hay meta.json por escena donde poner nada: las escenas viven inline en
   master/index.html. El mapa es UN archivo del proyecto. Y la cámara va en su PROPIA lista,
   no derivada de los beats: medido, no supuesto — uplabs tiene 21 tramos para 20 escenas y
   tecnico 7 tramos para 1. Derivarla de los beats habría sido una regla inventada. */
const proponerCamara = (bs, fin) => {
  /* DOS INVARIANTES POR CONSTRUCCIÓN, porque los dos son los que hoy sostiene sólo teclear
     bien la tabla — y son justo los que el --check rebota:

     ① COBERTURA. Los tramos se encadenan: el fin de uno ES el arranque del siguiente, el
        primero arranca en 0 y el último cierra en el corte. NO se usan las ventanas de beat
        tal cual: entre dos beats hay silencio, y copiarlas dejaba huecos de 0,2–0,4 s que la
        cámara no cubría. (Se vio en la primera corrida sobre uplabs: S01 cerraba en 10.8 y
        S02 abría en 11.2.)
     ② CONTINUIDAD DE ESCALA. Cada tramo arranca donde terminó el anterior.

     Techo 1.19 y piso 1.00 duros. El monto 11–16 % sale de la nota de uplabs: debajo de 11 %
     es el push invisible. Si el monto no entra ni subiendo ni bajando se ACHICA hasta el
     mínimo antes de rendirse a un `hold` — un hold por aritmética es una toma fija que nadie
     decidió, y una escena quieta al lado de otra quieta es la única que sí se ve muerta.
     El origen se corre por tramo: es lo que evita que dos escenas a la misma escala se lean
     como la misma toma. */
  const TECHO = 1.19, PISO = 1.0, MIN = 0.11;
  const MONTOS = [0.14, 0.12, 0.16, 0.11, 0.13, 0.15];
  const OX = [50, 47, 52, 48, 51, 46, 49], OY = [36, 38, 34, 37, 35, 39, 36];
  let cur = 1.02, dir = "in";
  return bs.map((b, i) => {
    const ini = i === 0 ? 0 : +bs[i].start.toFixed(2);
    const cierre = i === bs.length - 1 ? +fin.toFixed(2) : +bs[i + 1].start.toFixed(2);
    let kind = b.takeover ? "hold" : dir;
    let amount = MONTOS[i % MONTOS.length];
    if (kind !== "hold") {
      const cabe = (k, a) => k === "in" ? cur + a <= TECHO : cur - a >= PISO;
      const otro = kind === "in" ? "out" : "in";
      if (!cabe(kind, amount)) {
        if (cabe(otro, amount)) kind = otro;
        else {
          const techoDisp = TECHO - cur, pisoDisp = cur - PISO;
          if (techoDisp >= pisoDisp && techoDisp >= MIN) { kind = "in"; amount = +techoDisp.toFixed(2); }
          else if (pisoDisp >= MIN) { kind = "out"; amount = +pisoDisp.toFixed(2); }
          else kind = "hold";
        }
      }
    }
    let bse;
    if (kind === "in") { bse = cur; cur += amount; }
    else if (kind === "out") { bse = cur - amount; cur -= amount; }
    else bse = cur;
    if (kind !== "hold") dir = kind === "in" ? "out" : "in";
    return { kind, start: ini, end: cierre,
             base: +bse.toFixed(3), amount: kind === "hold" ? 0 : +amount.toFixed(3),
             originX: OX[i % OX.length], originY: OY[i % OY.length] };
  });
};

/* ── EL EMISOR DE CÁMARA ───────────────────────────────────────────────────────
   BEATS.json → el bloque CAM de master/index.html. Existe para matar un modo de falla
   medido: hasta hoy las ventanas de la tabla CAM eran una SEGUNDA COPIA, tecleada a mano,
   de las ventanas de beat. Dos copias de un mismo dato driftan — es el mismo defecto que el
   kit ya pagó (meta en 132 frames con el clip en 150).

   Se emite entre marcadores y se VERIFICA que el reemplazo haya entrado, igual que el hook:
   un .replace que no matchea es un no-op mudo, y un no-op mudo acá deja el html con la tabla
   vieja mientras el mapa dice otra cosa. */
if (flag("emitir")) {
  if (carril !== "master") { console.error(`✗ --emitir es del carril master`); process.exit(1); }
  if (!existsSync(BEATS_JSON)) { console.error(`✗ ${slug} no tiene master/BEATS.json — hacé el mapa primero`); process.exit(1); }
  if (!existsSync(MASTER_IDX)) { console.error(`✗ ${slug} no tiene master/index.html`); process.exit(1); }
  const B = JSON.parse(readFileSync(BEATS_JSON, "utf8"));
  const tramos = B.camara || [];
  if (!tramos.length) { console.error(`✗ el mapa no declara cámara — nada que emitir`); process.exit(1); }

  const filas = tramos.map((t) =>
    `    ['${t.kind}'.padEnd(6), ${t.start.toFixed(2).padStart(7)}, ${t.end.toFixed(2).padStart(7)}, ${t.base.toFixed(3)}, ${t.amount.toFixed(3)}, ${t.originX}, ${t.originY}],`
      .replace("'" + t.kind + "'.padEnd(6)", `'${t.kind}'${" ".repeat(Math.max(0, 6 - t.kind.length))}`)
  ).join("\n").replace(/,$/, "");

  const bloque = `/* CAMARA:INICIO — GENERADO desde master/BEATS.json. NO se edita a mano:
     cambiá el mapa y volvé a correr \`node tools/map-beats.mjs ${needle} --emitir\`.
     El gate 'mapa' de qc-master compara este bloque contra el BEATS.json y canta el drift. */
  var CAM = [
    //  tipo    desde    hasta   base   monto  ox  oy
${filas}
  ];
  for (var ci = 0; ci < CAM.length; ci++) {
    var c = CAM[ci];
    M.camera(tl, '#cam', c[1], c[2] - c[1], c[0], { base: c[3], amount: c[4], originX: c[5], originY: c[6] });
  }
  /* CAMARA:FIN */`;

  let html = readFileSync(MASTER_IDX, "utf8");
  const intentos = [
    [/\/\* CAMARA:INICIO[\s\S]*?\/\* CAMARA:FIN \*\//, () => bloque],
    [/\n[ \t]*\/\* CAMARA \*\//, () => `\n  ${bloque}`],
    [/\n[ \t]*\/\* HOOK-TEXTUAL:JS/, (m) => `\n  ${bloque}\n${m}`],
    [/\n[ \t]*window\.__timelines\s*=\s*window\.__timelines\s*\|\|/, (m) => `\n  ${bloque}\n${m}`],
  ];
  let puesto = null;
  for (const [re, rep] of intentos) if (re.test(html)) { puesto = html.replace(re, rep); break; }
  if (!puesto) {
    console.error(`\n✗ no encontré dónde poner el bloque de cámara en master/index.html.`);
    console.error(`  NO escribí nada. Poné /* CAMARA */ dentro del <script>, antes de window.__timelines.\n`);
    process.exit(1);
  }
  /* ── LAS ESCENAS ────────────────────────────────────────────────────────────
     ⛔ EL CONTENIDO ES DE WALTER, LAS VENTANAS SON DEL MAPA.
     Este emisor NO escribe lo que hay adentro de una escena: eso es la decisión creativa.
     Lo único que hace es que el `data-start` / `data-duration` del html sean SIEMPRE los del
     mapa — que es el modo de falla que este trabajo entero vino a matar: dos copias del mismo
     dato, tecleadas aparte, que driftan sin que nadie lo vea. Una escena que ya existe se
     RESPETA (sólo se le corrigen las ventanas); una que falta se crea VACÍA.
     Pistas: 1 = overlays · 2 = takeovers opacos (la convención de nacho). */
  const bs2 = B.beats || [];
  let creadas = 0, ajustadas = 0, intactas = 0;
  for (const b of bs2) {
    const dur = +(b.end - b.start).toFixed(2);
    const pista = b.takeover ? 2 : 1;
    const re = new RegExp(`<div([^>]*\\bid="${b.id}"[^>]*)>`);
    const m = puesto.match(re);
    if (m && /escena/.test(m[1])) {
      let attrs = m[1]
        .replace(/\sdata-start="[^"]*"/, ` data-start="${b.start}"`)
        .replace(/\sdata-duration="[^"]*"/, ` data-duration="${dur}"`)
        .replace(/\sdata-track-index="[^"]*"/, ` data-track-index="${pista}"`);
      if (!/data-start=/.test(attrs)) attrs += ` data-start="${b.start}"`;
      if (!/data-duration=/.test(attrs)) attrs += ` data-duration="${dur}"`;
      if (attrs === m[1]) intactas++; else { ajustadas++; puesto = puesto.replace(re, `<div${attrs}>`); }
    } else if (!m) {
      const nuevo = `  <div class="escena clip" id="${b.id}" data-start="${b.start}" data-duration="${dur}" data-track-index="${pista}"></div>`;
      const marca = /\n[ \t]*<!-- ESCENAS:FIN -->/;
      if (!marca.test(puesto)) {
        console.error(`\n✗ falta el marcador <!-- ESCENAS:FIN --> en master/index.html y ${b.id} no existe.`);
        console.error(`  NO escribí nada: no voy a adivinar dónde va una escena.\n`);
        process.exit(1);
      }
      puesto = puesto.replace(marca, (mm) => `\n${nuevo}${mm}`);
      creadas++;
    }
  }

  /* ── LOS FRAGMENTOS ─────────────────────────────────────────────────────────
     Si existe master/escenas/<SNN>.html, ESE archivo es el dueño del contenido de la escena
     y se baja acá. Es la celda de build-master.mjs: catorce agentes editando un solo
     index.html es la receta del pisón mudo, así que cada uno escribe su fragmento y el
     emisor los mete en su div.
     Sin fragmento, lo que haya inline se RESPETA — el master viejo se escribió a mano y no
     se le toca nada. Hallar el cierre pide contar divs: una regex no balancea tags. */
  const cierreDe = (txt, desde) => {
    let i = desde, prof = 0;
    while (i < txt.length) {
      const ab = txt.indexOf("<div", i), ce = txt.indexOf("</div>", i);
      if (ce < 0) return -1;
      if (ab >= 0 && ab < ce) { prof++; i = ab + 4; continue; }
      if (prof === 0) return ce;
      prof--; i = ce + 6;
    }
    return -1;
  };
  let inyectadas = 0;
  const dirFrag = join(base, "master", "escenas");
  for (const b of bs2) {
    const f = join(dirFrag, `${b.id}.html`);
    if (!existsSync(f)) continue;
    const re = new RegExp(`<div[^>]*\\bid="${b.id}"[^>]*>`);
    const m = puesto.match(re);
    if (!m) continue;
    const ini = m.index + m[0].length;
    const fin = cierreDe(puesto, ini);
    if (fin < 0) { console.error(`✗ no encontré el </div> de ${b.id} — no toco el html`); process.exit(1); }
    const frag = readFileSync(f, "utf8").trim();
    if (puesto.slice(ini, fin).trim() === frag) continue;
    puesto = puesto.slice(0, ini) + frag + puesto.slice(fin);
    inyectadas++;
  }

  /* ── LOS BUILDERS ───────────────────────────────────────────────────────────
     Una escena que se mueve trae `master/escenas/<SNN>.js` con `function build(tl, M)`.
     Ese archivo NO puede ser un <script> suelto: la timeline del master es ÚNICA y pausada.
     Acá cada builder recibe SU sub-timeline (tiempos relativos a la escena, arrancando en 0)
     y se engancha en el arranque del beat. Es el patrón que uplabs ya usaba con
     `ESCENAS = [['S01', 0.00, build_0], …]`, ahora generado en vez de tecleado. */
  const conJs = bs2.filter((b) => existsSync(join(dirFrag, `${b.id}.js`)));
  if (conJs.length) {
    const cuerpos = conJs.map((b) => {
      const src = readFileSync(join(dirFrag, `${b.id}.js`), "utf8").trim();
      return `  /* ${b.id} — master/escenas/${b.id}.js */\n  function __b_${b.id}(tl, M) {\n${src.split("\n").map((l) => "    " + l).join("\n")}\n    if (typeof build === "function") build(tl, M);\n  }`;
    }).join("\n\n");
    const cableado = `/* ESCENAS:JS:INICIO — GENERADO desde master/escenas/*.js. NO se edita a mano.
     Cada escena recibe SU sub-timeline: los tiempos de adentro son RELATIVOS a la escena. */
${cuerpos}

  var __SUB = [
${conJs.map((b) => `    ['${b.id}', ${b.start}, __b_${b.id}],`).join("\n")}
  ];
  for (var si = 0; si < __SUB.length; si++) {
    var sub = gsap.timeline();
    __SUB[si][2](sub, M);
    tl.add(sub, __SUB[si][1]);
  }
  /* ESCENAS:JS:FIN */`;
    const intentosJs = [
      [/\/\* ESCENAS:JS:INICIO[\s\S]*?\/\* ESCENAS:JS:FIN \*\//, () => cableado],
      [/\n[ \t]*\/\* CAMARA:INICIO/, (m) => `\n  ${cableado}\n${m}`],
      [/\n[ \t]*window\.__timelines\s*=\s*window\.__timelines\s*\|\|/, (m) => `\n  ${cableado}\n${m}`],
    ];
    let conCable = null;
    for (const [re, rep] of intentosJs) if (re.test(puesto)) { conCable = puesto.replace(re, rep); break; }
    if (!conCable) { console.error(`✗ no encontré dónde cablear los builders — no escribo nada`); process.exit(1); }
    puesto = conCable;
  }

  writeFileSync(MASTER_IDX, puesto);
  console.log(`\n  ✓ ${tramos.length} tramo(s) de cámara emitidos en master/index.html`);
  if (conJs.length) console.log(`  ✓ ${conJs.length} builder(s) de escena cableados`);
  if (inyectadas) console.log(`  ✓ ${inyectadas} fragmento(s) de master/escenas/ bajados a su escena`);
  console.log(`  ✓ escenas: ${creadas} creada(s) vacía(s) · ${ajustadas} con la ventana corregida · ${intactas} ya al día`);
  if (creadas) console.log(`    Las creadas están VACÍAS a propósito: el contenido es tuyo.`);
  console.log(`    Verificalo contra el video:  node tools/qc-master.mjs ${needle} --solo mapa\n`);
  process.exit(0);
}

if (carril === "master") {
  const beatsM = mapped.map((m) => ({
    id: m.id, name: m.name, start: +m.start.toFixed(2), end: +m.end.toFixed(2), words: m.words,
    takeover: false,        // se declara al aprobar. NUNCA una cuota: se ganan su lugar.
    tratamiento: null,      // ⛔ null = sin decidir. Sale del concepto; --check lo rebota.
  }));
  const cam = proponerCamara(beatsM, cut);

  console.log(`  ── LÍNEA GRÁFICA PROPUESTA ${"─".repeat(72)}`);
  console.log(`  ${"#".padEnd(5)}${"ventana".padEnd(16)}${"cámara".padEnd(22)}${"TK".padEnd(4)}${"tratamiento".padEnd(14)}assets`);
  console.log(`  ${"─".repeat(96)}`);
  for (let i = 0; i < beatsM.length; i++) {
    const b = beatsM[i], c = cam[i];
    const esc = c.kind === "hold" ? `hold ${c.base.toFixed(2)}` : `${c.kind} ${c.base.toFixed(2)}+${c.amount.toFixed(2)}`;
    console.log(`  ${b.id.padEnd(5)}${`${fmt(b.start)}–${fmt(b.end)}`.padEnd(16)}${`${esc} o${c.originX}/${c.originY}`.padEnd(22)}${(b.takeover ? "●" : "·").padEnd(4)}${"— sin decidir".padEnd(14)}—`);
  }
  console.log(`  ${"─".repeat(96)}`);
  console.log(`  CONCEPTO: ⛔ sin elegir — van 5 propuestas sobre estos beats, elegís 1`);
  console.log(`  HOOK: ⛔ sin decidir — es OBLIGATORIO en el carril master\n`);

  if (!apply) {
    console.log(`  Esto es una PROPUESTA — no se escribió nada.`);
    console.log(`  La cámara y los beats se proponen; el TRATAMIENTO, los ASSETS, los TAKEOVER y el`);
    console.log(`  HOOK los decidís vos — por eso nacen vacíos y --check los rebota si siguen así.`);
    console.log(`  Cuando esté: node tools/map-beats.mjs ${needle} --carril master --aplicar\n`);
    process.exit(0);
  }

  if (existsSync(BEATS_JSON)) {
    console.error(`✗ ${slug}/master/BEATS.json YA EXISTE — no lo piso.`);
    console.error(`  Es el mapa que aprobaste: si lo regenero, se van tus tratamientos, assets y takeover.`);
    console.error(`  Si de verdad querés empezar de cero, borralo a mano primero.\n`);
    process.exit(1);
  }
  mkdirSync(join(base, "master"), { recursive: true });
  writeFileSync(BEATS_JSON, JSON.stringify({
    _comment: "Mapa del carril MASTER. La cámara va en su PROPIA lista: no es 1:1 con los beats. " +
              "tratamiento en null = sin decidir, y --check lo rebota. Los takeover no llevan cuota.",
    corte: corte ? { src: corte.rel, dur: +cut.toFixed(2), fps: corte.fps ? +corte.fps.toFixed(3) : null } 
                 : { src: null, dur: +cut.toFixed(2), fps: null, _provisorio: "reloj tomado del .srt: no había corte en disco" },
    concepto: null,   // ⛔ lo elige Walter entre 5 propuestas, DESPUÉS de aprobar los beats
    hook: { texto: null, start: 0, end: 3 },
    beats: beatsM,
    camara: cam,
  }, null, 2) + "\n");

  console.log(`  ✓ master/BEATS.json escrito · ${beatsM.length} beats · ${cam.length} tramos de cámara`);
  console.log(`\n  ▶ SIGUIENTE — lo que el mapa NO puede decidir por vos:`);
  console.log(`     1. el HOOK (obligatorio): node tools/hook-textual.mjs ${needle} --texto "…"`);
  console.log(`     2. el "tratamiento" de cada beat, y los "assets" que haya que conseguir`);
  console.log(`     3. marcá "takeover": true donde se lo hayan ganado`);
  console.log(`     4. node tools/map-beats.mjs ${needle} --check     (el contrato del mapa)\n`);
  process.exit(0);
}

if (!apply) {
  console.log(`  Esto es una PROPUESTA — no se escribió nada.`);
  console.log(`  Revisalo: junta beats que son una sola idea, parte los ⚠️ largos, borra los que no llevan overlay.`);
  console.log(`  Cuando esté: node tools/map-beats.mjs ${needle} --aplicar\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────── --aplicar (KIT)
const scenesDir = join(base, "scenes");
mkdirSync(scenesDir, { recursive: true });
const DS_REL = "../../../design_system";
let creadas = 0, saltadas = 0;

let brand = null;
try { brand = JSON.parse(readFileSync(join(ROOT, "biblioteca/marcas", `${brandName}.json`), "utf8")); }
catch { console.error(`✗ no pude leer brands/${brandName}.json`); process.exit(1); }
const fps = brand.canvas?.fps ?? 30;

for (const m of mapped) {
  const folder = `${m.id}-${m.name}`;
  const dir = join(scenesDir, folder);
  if (existsSync(dir)) { saltadas++; continue; }        // nunca pisa una escena que ya existe
  mkdirSync(join(dir, "renders"), { recursive: true });
  try { symlinkSync(DS_REL, join(dir, "design_system")); } catch {}
  writeFileSync(join(dir, "meta.json"), JSON.stringify({
    _comment: `generado por map-beats.mjs desde ${srtName}. La duración la manda el data-duration del index.html.`,
    id: m.id, name: m.name,
    brand: brandName,
    type: "alpha",
    timing: { fps, durationFrames: Math.round(m.dur * fps) },
    beat: { label: m.name.toUpperCase().replace(/-/g, " "), words: m.words, start: fmt(m.start), end: fmt(m.end), money: false },
    place: fmt(m.start),
    zone: null,
    seam: null,
    approved: false,
  }, null, 2) + "\n");
  creadas++;
}

// el bloque de tokens de marca, una vez por video: las escenas lo importan
const tokens = execFileSync("node", [join(HERE, "brand.mjs"), "tokens", brandName], { encoding: "utf8" });
writeFileSync(join(base, "_brand-tokens.css"), `/* ${brandName} — generado. Regenerar: node tools/brand.mjs tokens ${brandName} */\n${tokens}`);
writeFileSync(join(base, "brand.json"), JSON.stringify(brand, null, 2) + "\n");

console.log(`  ✓ ${creadas} escena(s) creada(s)${saltadas ? ` · ${saltadas} ya existían (NO se pisaron)` : ""}`);
console.log(`  ✓ _brand-tokens.css + brand.json (marca: ${brand.label || brandName})`);
console.log(`\n  ▶ SIGUIENTE:`);
console.log(`     1. marcá los money-beats (2–4) en su meta.json → "money": true`);
console.log(`     2. escena por escena: construir → tools/preview.sh ${needle} <SNN> → aprobar`);
console.log(`     3. node tools/validate-kit.mjs ${needle}   (el contrato)\n`);
