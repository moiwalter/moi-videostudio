#!/usr/bin/env node
/**
 * flujo.mjs — EL ÚNICO COMANDO. Dice en qué estado está un video y CUÁL ES LA ACCIÓN SIGUIENTE.
 *
 *   node tools/flujo.mjs                 → lista todos los videos y su estado
 *   node tools/flujo.mjs <slug>          → el estado de uno + la próxima acción
 *   node tools/flujo.mjs <slug> --rapido → salta los gates caros (puppeteer/render)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE (29-ago-2026)
 *
 * El pipeline ya tenía el principio correcto escrito en ORCHESTRATION.md — «cero LLM en el
 * control de flujo» — pero aplicado sólo DENTRO de una escena. El "¿qué sigue?" a nivel VIDEO
 * seguía saliendo de que alguien (yo) leyera 60 KB de prosa repartida en 5 archivos que
 * driftean entre sí. Resultado medido:
 *
 *   · `approve.sh` — "la puerta del render" — usado en 2 de 6 proyectos (0/12 en siete-pasos).
 *   · «Re-transcribe CADA corte nuevo» es prosa → nacho-brain-rot tiene el corte del 24-ago
 *     y los dos .srt del 22-ago (la toma vieja de 74,5 s). validate-kit agarró el .srt viejo
 *     y escupió 17 errores rojos con timestamps precisos: TODOS artefactos del input.
 *   · El QC del transcript (8-gramas, cola, gaps) vive en un heredoc de new-video.sh.
 *   · premultiply, en cambio, vive DENTRO de alpha.sh → no se saltó nunca, en ningún proyecto.
 *
 * La regla que sale de ahí, y que ya estaba escrita en el encabezado de qc-master.mjs:
 *
 *     «un gate que depende de que alguien se acuerde de un flag no es un gate»
 *
 * Entonces: lo que era prosa acá es código, y el orden lo decide este script, no el criterio
 * de la sesión.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * TRES ESTADOS, y el tercero es el que faltaba
 *
 *   OK              el chequeo corrió y pasó
 *   BLOQUEADO       el chequeo corrió y falló → hay UNA acción siguiente
 *   NO VERIFICABLE  el chequeo NO PUDO correr → **nunca sale verde**
 *
 * El tercero existe porque las dos herramientas viejas firmaban verde sin haber medido:
 * `validate-kit wallbit-invertir` imprimía «✓ contrato del kit VERDE» tras saltar el
 * invariante ① (sin .srt, 15 escenas v1 sin ventana), y `qc-master nacho` imprimía
 * «✓ carril master limpio» sobre una composición de CERO escenas. Un verde que no midió
 * es peor que un rojo: compra confianza.
 */

import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { hallarCorte, hallarTranscripts, cuadraConElCorte, fmtSeg as seg } from "./lib-corte.mjs";

import {config,resolveProject,projects,ROOT,masterDir} from './project.mjs';
import {registeredStatus} from './registered-status.mjs';
import {approvalReport,approvalState,scenes,outputState} from './scene-state.mjs';
import {preflight} from './preflight.mjs';
import {sourceState} from './source-state.mjs';
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = ROOT;
const NO_PROYECTO = new Set(["tools", "templates", "design_system", "brands", "assets", "node_modules", "_legacy", "_fixture"]);

/* ── args ─────────────────────────────────────────────────────────────────────────────
   El slug se toma como el primer argumento que no empieza con "--", SIN filtrar por
   dígito inicial. qc-master.mjs filtraba con `!/^\d/.test(a)` y como TODOS los slugs
   empiezan con el año, `qc-master.mjs 2026-08-tu-carrera` imprimía el "uso:" y salía:
   el gate del carril master era ininvocable con el nombre real de cualquier proyecto. */
const args = process.argv.slice(2);
const slugArg = args.find((a) => !a.startsWith("--")) || null;
const RAPIDO = args.includes("--rapido");
const JSON_OUT = args.includes("--json");

const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", b: "\x1b[34m", dim: "\x1b[2m", bold: "\x1b[1m", x: "\x1b[0m" };
const col = process.stdout.isTTY && !JSON_OUT ? C : Object.fromEntries(Object.keys(C).map((k) => [k, ""]));

const dias = (f) => Math.round((Date.now() - statSync(f).mtimeMs) / 86400000);

/* ── resolución del proyecto ─────────────────────────────────────────────────────────── */
function proyectos(){return projects(RAIZ);}
function resolverSlug(needle){return resolveProject(needle,RAIZ);}
/* ── el carril sale del FILESYSTEM, no de que alguien se acuerde ──────────────────────
   MASTER = hay master/index.html con escenas dentro (el footage entra a la composición).
   KIT    = hay scenes/<SNN>/ con meta.json (capas alpha para que Walter monte en CapCut).
   Un master/ vacío NO es carril master: nacho-brain-rot tiene master/index.html con CERO
   escenas y su entregable real es KIT-CAPCUT/. */
function detectarCarril(base) {
  const registered=config(base);
  const masterHtml = join(base, "master", "index.html");
  let escenasMaster = 0;
  if (existsSync(masterHtml)) {
    const html = readFileSync(masterHtml, "utf8");
    escenasMaster = (html.match(/class="[^"]*\bescena\b/g) || []).length || (html.match(/class="[^"]*\bclip\b/g) || []).length;
  }
  const scenesDir = join(base, "scenes");
  const escenasKit = existsSync(scenesDir)
    ? readdirSync(scenesDir).filter((d) => /^S\d/i.test(d) && existsSync(join(scenesDir, d, "meta.json"))).length
    : 0;
  if(registered)return {carril:registered.lane,escenasMaster,escenasKit};
  if (escenasMaster > 0 && escenasKit === 0) return { carril: "MASTER", escenasMaster, escenasKit };
  if (escenasKit > 0 && escenasMaster === 0) return { carril: "KIT", escenasMaster, escenasKit };
  if (escenasKit > 0 && escenasMaster > 0) return { carril: "KIT+MASTER", escenasMaster, escenasKit };
  return { carril: "SIN ARMAR", escenasMaster, escenasKit };
}

// Keep the requirement if REVIEW.json is accidentally removed from a new project.
function usesReview(base) {
  if (existsSync(join(base, "REVIEW.json"))) return true;
  try { return JSON.parse(readFileSync(join(base, "master", "BRIEF.json"), "utf8")).reviewRequired === true; }
  catch { return false; }
}

/* ── C1 · el CORTE (el reloj de todo) ─────────────────────────────────────────────────── */
/* ── C2 · el TRANSCRIPT tiene que ser DE ESE CORTE ───────────────────────────────────── */
/* ── C3 · QC del transcript (los 3 números del heredoc de new-video.sh, en código) ─────
   Un `-l` que no es el idioma del audio NO falla: whisper traduce y alucina. Un corte en
   inglés corrido con `-l es` devolvió 426 palabras en vez de 324 y 51 8-gramas repetidos.
   Un mapa de beats sobre eso pone cada overlay en la palabra equivocada **y validate-kit
   da verde**, porque valida contra el transcript, no contra el audio. */
function qcTranscript(t, durCorte) {
  const texto = t.words ? t.words.map((w) => (w.text || w.word || "").trim()).join(" ") : t.cues.map((c) => c.text).join(" ");
  const pal = texto.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
  const vistos = new Map();
  let repes = 0;
  for (let i = 0; i + 8 <= pal.length; i++) {
    const g = pal.slice(i, i + 8).join(" ");
    const n = (vistos.get(g) || 0) + 1;
    vistos.set(g, n);
    if (n === 2) repes++;
  }
  const cola = durCorte != null && t.dur != null ? durCorte - t.dur : null;
  return { palabras: pal.length, repes, cola };
}

/* ── C4-C7 · estado de las escenas del carril KIT ────────────────────────────────────── */
function estadoEscenas(base) {
  const dir = join(base, "scenes");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const d = join(dir, name);
    let st; try { st = statSync(d); } catch { continue; }
    if (!st.isDirectory() || name.startsWith("_") || name.startsWith(".")) continue;
    const metaP = join(d, "meta.json");
    if (!existsSync(metaP)) { out.push({ name, sinMeta: true }); continue; }
    let meta = {}; try { meta = JSON.parse(readFileSync(metaP, "utf8")); } catch {}
    const html = join(d, "index.html");
    const construida = existsSync(html);
    const v1 = typeof meta.beat === "string" || meta.beat?.start == null;
    const rendersDir = join(d, "renders");
    let render = null;
    if (existsSync(rendersDir)) {
      const rs = readdirSync(rendersDir).filter((f) => /\.(mov|mp4)$/i.test(f) && !/proxy|draft/i.test(f));
      if (rs.length) {
        const p = join(rendersDir, rs.sort()[rs.length - 1]);
        render = { rel: rs[rs.length - 1], mtime: statSync(p).mtimeMs };
      }
    }
    const viejo = construida && render && render.mtime < statSync(html).mtimeMs;
    out.push({ name, meta, construida, v1, aprobada: approvalState(base, scenes(base,'KIT').find(s=>s.id===name)).ok, render, viejo: !outputState(base, scenes(base,'KIT').find(s=>s.id===name)).ok, tipo: meta.type });
  }
  return out;
}

/* ── el barrido ──────────────────────────────────────────────────────────────────────── */
/* ⛔ NO EVALÚES CON ESTAS REGLAS LO QUE NO ES DE ESTE CARRIL (29-ago-2026).
   Dos carpetas viven acá y no son talking-heads de este pipeline:
     · `2026-08-dos-puertas` — del carril RETIRADO (index.html monolítico, scenes/ vacío,
       seis scripts copiados adentro). Autocontenido y funcionando; START_HERE dice que no
       se migra.
     · `cvander-telegram` — otro sistema entero, con su propio BRIEF/DESIGN/hyperframes.json.
   Sin esta rama las dos salían «✗ CORTE» para siempre. Un tablero con alarmas permanentes
   que nadie va a accionar enseña a ignorar el tablero — que es peor que no tenerlo. */
function esDelPipeline(base) {
  return !!config(base) || existsSync(join(base, "kit.config.sh"))
      || existsSync(join(base, "master", "index.html"))
      || (existsSync(join(base, "scenes")) && readdirSync(join(base, "scenes")).some((d) => existsSync(join(base, "scenes", d, "meta.json"))));
}

function revisar(slug) {
  const base = resolveProject(slug);
  const descriptor=config(base);
  if(descriptor)return registeredStatus(base,slug,{fast:RAPIDO});
  if (!esDelPipeline(base)) {
    return { slug, carril: "—", escenasKit: 0, escenasMaster: 0, ajeno: true, bloqueo: null,
             ch: [{ estado: "AJENO", nombre: "FUERA DEL CARRIL", detalle: "no es un talking-head de este pipeline (sin kit.config.sh, sin master/, sin scenes con meta)" }] };
  }
  const { carril, escenasMaster, escenasKit } = detectarCarril(base);
  const ch = [];       // chequeos corridos
  const push = (estado, nombre, detalle, accion) => ch.push({ estado, nombre, detalle, accion });
  let bloqueo = null;

  /* ── ¿ENTREGADO? ────────────────────────────────────────────────────────────────────
     Un proyecto cerrado hace meses no tiene el corte en disco (pesa 100-800 MB y se borra
     al publicar). Eso NO es un bloqueo: es un proyecto terminado. Sin esta rama,
     `niveles-control` — publicado el 28-jul con 16.700 vistas — salía «✗ CORTE: no encuentro
     el corte», que es cierto y es inútil. Un tablero que grita sobre lo que ya se entregó
     enseña a ignorarlo. */
  /* ⛔ UN VIDEO ENTREGADO ESTÁ CERRADO: NO SE RE-LITIGA (30-ago-2026).
     Walter: *"¿para qué regenerar, bro, si ya entregamos los videos?"*. Tenía razón y el
     defecto era de diseño: la detección miraba `KIT_README.md` en la RAÍZ, así que sólo
     reconocía los del carril KIT. Los del carril master (que-es-startup, tu-carrera) y nacho
     —cuyo README vive dentro de KIT-CAPCUT/— salían BLOQUEADOS pidiendo re-transcribir un
     corte que ya se montó, se exportó y se entregó. Un tablero que manda a rehacer trabajo
     terminado se gana que lo ignoren, y ahí perdés también las alarmas que sí importan.

     La entrega es un HECHO, no una inferencia: se declara, igual que `seam: null` y
     `data-qc-cara`. La heurística queda sólo como sugerencia. */
  const marcador = join(base, "ENTREGADO.json");
  let entrega = null;
  if (existsSync(marcador)) { try { entrega = JSON.parse(readFileSync(marcador, "utf8")); } catch { entrega = { fecha: "?" }; } }

  const conRenders = (d) => existsSync(d) && readdirSync(d).some((f) => /\.(mov|mp4)$/i.test(f));
  const kitDir = ["KIT", "KIT-CAPCUT", "clips", "renders"].map((d) => join(base, d)).find(conRenders);
  const rendersEscena = existsSync(join(base, "scenes")) &&
    readdirSync(join(base, "scenes")).some((d) => conRenders(join(base, "scenes", d, "renders")));
  const readmeKit = existsSync(join(base, "KIT_README.md")) ||
    (kitDir && existsSync(join(kitDir, "KIT_README.md")));
  const pareceEntregado = !!(readmeKit && (kitDir || rendersEscena));
  const entregado = !!entrega || pareceEntregado;

  /* Declarado entregado = cerrado, sin importar qué siga en disco. Los proyectos del carril
     master conservan el corte (el footage vive DENTRO de la composición), así que la rama de
     abajo —que se apoya en que el corte ya no esté— nunca los alcanzaba. */
  if (entrega) {
    push("ENTREGADO", "CERRADO", `declarado el ${entrega.fecha}${entrega.donde ? ` · ${entrega.donde}` : ""}${entrega.nota ? ` · ${entrega.nota}` : ""}`);
    return { slug, carril, escenasKit, escenasMaster, ch, bloqueo: null, entregado: true, declarado: true };
  }

  // C1 · CORTE
  const corte = hallarCorte(base);
  if (!corte && entregado) {
    const n = kitDir ? readdirSync(kitDir).filter((f) => /\.(mov|mp4)$/i.test(f)).length
      : readdirSync(join(base, "scenes")).filter((d) => conRenders(join(base, "scenes", d, "renders"))).length;
    push("ENTREGADO", "KIT", `${n} clips en ${kitDir ? basename(kitDir) + "/" : "scenes/*/renders/"}${entrega ? ` · declarado ${entrega.fecha}` : " · inferido"}`);
    push("NO VERIFICABLE", "CONTRATO", "sin el corte no se puede re-verificar nada de este video");
    return { slug, carril, escenasKit, escenasMaster, ch, bloqueo: null, entregado: true, declarado: !!entrega };
  }
  if (!corte) {
    push("BLOQUEADO", "CORTE", "no encuentro el corte del video", {
      texto: "Dejá el corte terminado en local/corte.mp4 (o en la raíz del proyecto).",
      cmds: [`# el corte es el reloj de todo: sin él no se mapea nada`],
    });
    return { slug, carril, escenasKit, escenasMaster, ch, bloqueo: ch[ch.length - 1], saltados: 7 };
  }
  push("OK", "CORTE", `${corte.rel} · ${seg(corte.dur)} · ${corte.wh} @${corte.fps ? Math.round(corte.fps) : "?"}`);

  if(descriptor){const identity=sourceState(base);if(!identity.ok){push(identity.state==='FAIL'?'BLOQUEADO':'NO VERIFICABLE','IDENTIDAD',identity.error);return {slug,carril,escenasKit,escenasMaster,ch,bloqueo:ch.find(c=>c.estado==='BLOQUEADO')||null};}}
  // C2 · TRANSCRIPT ≡ CORTE  ← el chequeo que no existía
  const ts = hallarTranscripts(base);
  if (!ts.length) {
    push("BLOQUEADO", "TRANSCRIPT", "no hay .srt ni local/transcript.json", {
      texto: "Transcribí el corte. ⚠️ -l es EL IDIOMA DEL AUDIO: pedir otro no falla, traduce y alucina.",
      cmds: [
        `npx hyperframes@${hfVersion()} transcribe ${corte.rel} -m large-v3 -l <idioma>`,
        `npx hyperframes@${hfVersion()} transcribe local/transcript.json --to srt -o corte.srt`,
      ],
    });
  } else {
    const tol = Math.max(1.5, corte.dur * 0.02);
    const buenos = ts.filter((t) => t.dur != null && Math.abs(t.dur - corte.dur) <= tol);
    if (!buenos.length) {
      const peor = ts.map((t) => `${t.rel} describe ${seg(t.dur)}`).join(" · ");
      push("BLOQUEADO", "TRANSCRIPT", `${peor} — el corte dura ${seg(corte.dur)}`, {
        texto:
          `Ningún transcript corresponde a este corte (tolerancia ±${tol.toFixed(1)} s). Todo timing que salga de acá ` +
          `cae en la palabra equivocada, y los gates lo reportan como si el KIT estuviera roto.`,
        cmds: [
          `npx hyperframes@${hfVersion()} transcribe ${corte.rel} -m large-v3 -l <idioma>`,
          `node tools/flujo.mjs ${slug}`,
        ],
      });
    } else {
      const t = buenos.sort((a, b) => b.mtime - a.mtime)[0];
      const viejo = t.mtime < corte.mtime;
      push(viejo ? "BLOQUEADO" : "OK", "TRANSCRIPT",
        `${t.rel} · ${seg(t.dur)}${viejo ? " — es MÁS VIEJO que el corte" : ""}`,
        viejo ? { texto: "El corte se tocó después de transcribir. Re-transcribí.", cmds: [`npx hyperframes@${hfVersion()} transcribe ${corte.rel} -m large-v3 -l <idioma>`] } : null);

      // C3 · QC del transcript
      if (!viejo) {
        const q = qcTranscript(t, corte.dur);
        const problemas = [];
        if (q.repes > 10) problemas.push(`${q.repes} 8-gramas repetidos (whisper entró en loop o tradujo)`);
        if (q.cola != null && q.cola > 3) problemas.push(`se come ${q.cola.toFixed(1)} s de cola (la frase de cierre)`);
        if (problemas.length) {
          push("BLOQUEADO", "QC TRANSCRIPT", problemas.join(" · "), {
            texto: "Si la cola se pierde, re-transcribí SÓLO la cola y empalmá con offset: la pasada corta acierta donde la larga se cansó.",
            cmds: [`ffmpeg -ss <t> -i ${corte.rel} -c copy local/cola.mp4`, `npx hyperframes@${hfVersion()} transcribe local/cola.mp4 -m large-v3 -l <idioma>`],
          });
        } else {
          push("OK", "QC TRANSCRIPT", `${q.palabras} palabras · ${q.repes} 8-gramas repetidos · cola ${q.cola == null ? "?" : q.cola.toFixed(1) + " s"}`);
        }
      }
    }
  }

  /* C3b · EL BRIEF — antes de mapear nada (30-ago-2026, "quiero que sea determinístico").
     Las preguntas del arranque dependían de que yo me acordara de hacerlas. Una regla que vive
     en la memoria de alguien es una intención, no una regla. Ahora bloquea. */
  if (carril === "MASTER" || carril === "KIT+MASTER") {
    const r = correr("node", [join(AQUI, "brief.mjs"), slug, "--check"]);
    push(r.ok ? "OK" : "BLOQUEADO", "BRIEF", r.resumen, r.ok ? null : {
      texto: "Faltan las dos preguntas del arranque: de quién es el video (la marca) y si tenés una dirección o te propongo 5 conceptos.",
      cmds: [`node tools/brief.mjs ${slug}`],
    });
  }

  // C4 · MAPA DE BEATS
  if (carril === "SIN ARMAR") {
    push("BLOQUEADO", "MAPA DE BEATS", "no hay escenas todavía", {
      texto: "El mapa es TUYO, nunca de un agente: es la decisión de qué se cuenta y dónde.",
      cmds: [`node tools/map-beats.mjs ${slug}`, `# revisalo (juntá, partí, borrá) y después:`, `node tools/map-beats.mjs ${slug} --aplicar`],
    });
  } else if (carril === "MASTER" || carril === "KIT+MASTER") {
    /* En master el mapa NO son las escenas del html: es master/BEATS.json, donde viven la
       línea gráfica (cámara, takeover, tratamiento, assets) y el hook. Contar divs decía
       "OK" sobre un video cuyo mapa no existía. */
    const mapa = join(base, "master", "BEATS.json");
    if (!existsSync(mapa)) {
      push("BLOQUEADO", "MAPA DE BEATS", `carril master sin master/BEATS.json (${escenasMaster} escenas en el html)`, {
        texto: "El mapa es TUYO, nunca de un agente: la cámara y los beats se proponen, pero el tratamiento, los assets, los takeover y el HOOK los decidís vos.",
        cmds: [`node tools/map-beats.mjs ${slug} --carril master`, `# revisalo y después:`, `node tools/map-beats.mjs ${slug} --carril master --aplicar`],
      });
    } else {
      const r = correr("node", [join(AQUI, "map-beats.mjs"), slug, "--check"]);
      push(r.ok ? "OK" : "BLOQUEADO", "MAPA DE BEATS", r.resumen, r.ok ? null : {
        texto: "El mapa del master está a medias. Lo que falta son decisiones tuyas, no cálculo.",
        cmds: [`node tools/map-beats.mjs ${slug} --check`],
      });

      /* C4b · EL HTML SINCRONIZADO. Barato y sin Chrome: el mapa puede estar perfecto y el
         html no haberlo consumido nunca. Sin este paso el flujo mandaba directo al gate, que
         canta 13 rojos de "escena vacía" sin decir que lo que falta es correr el emisor. */
      if (r.ok) {
        const B = JSON.parse(readFileSync(mapa, "utf8"));
        const htmlM = existsSync(join(base, "master", "index.html")) ? readFileSync(join(base, "master", "index.html"), "utf8") : "";
        const faltan = (B.beats || []).filter((b) => !new RegExp(`id="${b.id}"`).test(htmlM)).map((b) => b.id);
        const sinCam = (B.camara || []).length > 0 && !/CAMARA:INICIO/.test(htmlM);
        if (faltan.length || sinCam) {
          push("BLOQUEADO", "HTML SINCRONIZADO",
            [faltan.length ? `${faltan.length} escena(s) del mapa no están en el html (${faltan.slice(0, 4).join(", ")}${faltan.length > 4 ? "…" : ""})` : null,
             sinCam ? "la cámara del mapa no se emitió" : null].filter(Boolean).join(" · "),
            { texto: "El emisor sincroniza las VENTANAS y la cámara; el contenido de cada escena lo escribís vos y no se toca.",
              cmds: [`node tools/map-beats.mjs ${slug} --emitir`] });
        } else {
          push("OK", "HTML SINCRONIZADO", `${(B.beats || []).length} escena(s) y ${(B.camara || []).length} tramo(s) de cámara en el html`);
        }
      }
    }
  } else {
    const es = estadoEscenas(base);
    const v1 = es.filter((e) => e.v1 && !e.sinMeta);
    const sinMeta = es.filter((e) => e.sinMeta);
    if (sinMeta.length) push("NO VERIFICABLE", "MAPA DE BEATS", `${sinMeta.length} carpeta(s) sin meta.json: ${sinMeta.map((e) => e.name).join(", ")}`);
    else if (v1.length) push("NO VERIFICABLE", "MAPA DE BEATS", `${v1.length}/${es.length} escenas en formato v1 (beat sin ventana) — la colocación NO se puede verificar`);
    else push("OK", "MAPA DE BEATS", `${es.length} escenas con ventana verificable`);

    // C5 · CONSTRUIDAS
    const faltan = es.filter((e) => !e.sinMeta && !e.construida);
    if (faltan.length) {
      push("BLOQUEADO", "ESCENAS", `${faltan.length} sin index.html: ${faltan.slice(0, 4).map((e) => e.name).join(", ")}${faltan.length > 4 ? "…" : ""}`, {
        texto: "Construí la siguiente escena y decidila en el NAVEGADOR, nunca abriendo un render.",
        cmds: [`tools/preview.sh ${slug} ${faltan[0].name.split("-")[0]}`],
      });
    } else if (es.length) {
      push("OK", "ESCENAS", `${es.length}/${es.length} construidas`);

      // C6 · APROBACIÓN (el paso que se salta siempre)
      const noAprob = es.filter((e) => !e.aprobada);
      if (noAprob.length) {
        push("BLOQUEADO", "APROBACIÓN", `${noAprob.length}/${es.length} sin aprobar — lock-all no las va a renderizar`, {
          texto: "Mirala en preview y aprobala. Es la puerta del render: se decide en el navegador y se renderiza UNA vez.",
          cmds: [`tools/preview.sh ${slug} ${noAprob[0].name.split("-")[0]}`, `tools/approve.sh ${slug} ${noAprob[0].name.split("-")[0]}`],
        });
      } else {
        push("OK", "APROBACIÓN", `${es.length}/${es.length} aprobadas`);

        // C7 · LOCK
        const sinRender = es.filter((e) => !e.render);
        const viejos = es.filter((e) => e.viejo);
        if (sinRender.length || viejos.length) {
          push("BLOQUEADO", "LOCK", `${sinRender.length} sin render · ${viejos.length} con render viejo`, {
            texto: "Renderiza SÓLO lo aprobado y desactualizado. El alpha sale premultiplicado o revienta a blanco en CapCut.",
            cmds: [`tools/lock-all.sh ${slug}`],
          });
        } else {
          push("OK", "LOCK", `${es.length} renders al día`);
        }
      }
    }
  }

  const reportApprovals = lane => {
    const r=approvalReport(base,lane),pending=r.scenes.filter(s=>!s.ok);
    const state=r.ok?'OK':!r.scenes.length||pending.every(s=>s.state==='UNVERIFIABLE')?'NO VERIFICABLE':'BLOQUEADO';
    push(state,'APROBACIÓN '+lane,r.ok?'Inputs y decisiones vigentes':pending.map(s=>`${s.id}: ${s.error||s.state}`).join('; ')||'Falta mapa de escenas',r.ok?null:{
      texto:'Leer la última dirección y feedback antes de retomar; reparar o revisar solo la escena activa y registrar la decisión real. No renderizar un montaje descartado.',
      cmds:[`node tools/${lane==='MASTER'?'approve-master.mjs':'scene-state.mjs'} ${slug} --check`]
    });
  };
  if(carril==='MASTER'||carril==='KIT+MASTER')reportApprovals('MASTER');
  if(carril==='KIT+MASTER'){
    reportApprovals('KIT');
    const stale=scenes(base,'KIT').filter(sc=>!outputState(base,sc).ok);if(stale.length)push('NO VERIFICABLE','LOCK KIT',`${stale.length} entregable(s) ausente(s) o desactualizados`);
  }
  bloqueo = ch.find((c) => c.estado === "BLOQUEADO") || null;

  // C8 · GATES (sólo si no hay bloqueo antes — correrlos sobre inputs rotos es lo que produjo
  //             los 17 rojos falsos de nacho-brain-rot)
  if (!bloqueo && !ch.some(c=>c.estado==="NO VERIFICABLE") && !RAPIDO) {
    /* ⛔ KIT+MASTER corre LOS DOS gates (30-ago-2026). El carril híbrido se detectaba desde
       que existe la función, y después caía en el `else` del kit: sobre nacho-brain-rot
       —el único proyecto con los dos entregables— qc-master NO CORRÍA NUNCA. Un carril
       detectado y no ramificado es peor que no detectarlo: da la sensación de estar cubierto. */
    const gates = [];
    if (carril === "MASTER" || carril === "KIT+MASTER")
      gates.push(["qc-master", "qc-master.mjs", "Arreglá la escena que falla y volvé a correr el flujo."]);
    if (carril === "KIT" || carril === "KIT+MASTER")
      gates.push(["validate-kit", "validate-kit.mjs", "El contrato del kit no cierra."]);
    for (const [nombre, script, texto] of gates) {
      const r = correr("node", [join(AQUI, script), slug]);
      const estado = r.ok ? "OK" : r.codigo === 2 ? "NO VERIFICABLE" : "BLOQUEADO";
      push(estado, `GATE ${nombre}`, r.resumen,
        r.ok ? null : { texto: r.codigo === 2 ? "El gate no pudo medir. Eso NO es «limpio»: revisá que el entregable de este video sea el de este carril." : texto,
                        cmds: [`node tools/${script} ${slug}`] });
    }
  } else if (bloqueo && !RAPIDO) {
    push("NO VERIFICABLE", "GATES", "no corrieron: hay un bloqueo antes y medirían sobre un input roto");
  }

  if(RAPIDO)push('NO VERIFICABLE','GATES OMITIDOS','Modo rápido: las verificaciones técnicas no se ejecutaron');
  // Evidence review is independent of technical QC. Enabled for new MASTER scaffolds;
  // old episodes are not retroactively reopened. --rapido still checks the receipt.
  if (!ch.some(c => c.estado === "BLOQUEADO") && (carril === "MASTER" || carril === "KIT+MASTER") && usesReview(base)) {
    let stage = "preview";
    try { if (JSON.parse(readFileSync(join(base, "REVIEW.json"), "utf8")).export?.file) stage = "export"; } catch {}
    const r = correr("node", [join(AQUI, "review-video.mjs"), slug, "--check", "--stage", stage]);
    push(r.ok ? "OK" : "BLOQUEADO", "REVISIÓN VISUAL", r.resumen, r.ok ? null : {
      texto: "Revisar Studio/MP4 según la etapa y completar REVIEW.json con evidencia vigente. El recibo no sustituye la inspección ni pide nueva aprobación del usuario.",
      cmds: [`node tools/review-video.mjs ${slug} --check --stage ${stage}`],
    });
    bloqueo = ch.find((c) => c.estado === "BLOQUEADO") || null;
  }

  bloqueo = ch.find((c) => c.estado === "BLOQUEADO") || null;
  return { slug, carril, escenasKit, escenasMaster, corte, ch, bloqueo };
}

/* ⛔ EL EXIT 2 NO ES UN BLOQUEO (30-ago-2026).
   execFileSync tira excepción con CUALQUIER código ≠ 0, así que el tercer estado que
   qc-master y validate-kit se tomaron el trabajo de emitir —código 2, NO VERIFICABLE—
   llegaba acá como `ok:false` y se reportaba como BLOQUEADO. Justo la distinción que el
   encabezado de este archivo declara como su razón de existir se perdía al cruzar el
   subproceso: "el gate no pudo medir" y "el gate midió y está mal" son cosas distintas y
   se arreglan distinto. */
function correr(cmd, argv) {
  try {
    const out = execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, codigo: 0, resumen: resumenDe(out) };
  } catch (e) {
    const out = (e.stdout || "") + (e.stderr || "");
    return { ok: false, codigo: e.status ?? 1, resumen: resumenDe(out) };
  }
}
const resumenDe = (out) => {
  const l = out.split("\n").map((s) => s.trim()).filter(Boolean);
  const err = l.find((s) => /ERROR\(ES\)|error\(es\)/.test(s));
  const ok = l.find((s) => /✓/.test(s));
  return (err || ok || l[l.length - 1] || "").replace(/\x1b\[[0-9;]*m/g, "").slice(0, 90);
};

function hfVersion() {
  try { return readFileSync(join(AQUI, "HF_VERSION"), "utf8").trim(); } catch { return "latest"; }
}

/* ── salida ──────────────────────────────────────────────────────────────────────────── */
const ICONO = { AVISO: "·", OK: `${col.g}✓${col.x}`, BLOQUEADO: `${col.r}✗${col.x}`, "NO VERIFICABLE": `${col.y}?${col.x}`, ENTREGADO: `${col.b}▪${col.x}`, AJENO: `${col.dim}·${col.x}` };

function statusCode(r){if(r.bloqueo)return 1;if(r.ajeno||r.ch.some(c=>c.estado==='NO VERIFICABLE'))return 2;return 0;}

function imprimir(r) {
  console.log(`\n  ${col.bold}${r.slug}${col.x} · carril ${r.carril}${r.escenasKit ? ` · ${r.escenasKit} escenas` : ""}\n`);
  for (const c of r.ch) {
    console.log(`  ${ICONO[c.estado]} ${c.nombre.padEnd(15)} ${col.dim}${c.detalle}${col.x}`);
  }
  if (r.ajeno) { console.log(`\n  ${col.dim}· fuera del carril — este pipeline no lo gobierna; no es una verificación${col.x}\n`); return 2; }
  if (r.entregado) {
    console.log(`\n  ${col.b}▪ ENTREGADO${col.x} — proyecto cerrado, no hay acción pendiente`);
    if (!r.declarado) console.log(`  ${col.dim}(inferido de los clips en disco — declaralo con: node tools/flujo.mjs ${r.slug} --entregado)${col.x}`);
    console.log();
    return statusCode(r);
  }
  if(r.nextAction)console.log(`  Next: ${r.nextAction}`);
  const noVer = r.ch.filter((c) => c.estado === "NO VERIFICABLE");
  if (r.bloqueo) {
    console.log(`\n  ${col.bold}▶ SIGUIENTE${col.x}`);
    console.log(`      ${r.bloqueo.accion?.texto || r.bloqueo.detalle}`);
    for (const c of r.bloqueo.accion?.cmds || []) console.log(`      ${col.b}${c}${col.x}`);
    console.log(`\n  ${col.dim}(se corta en el primer bloqueo — los chequeos de abajo no corrieron)${col.x}\n`);
    return 1;
  }
  if (noVer.length) {
    console.log(`\n  ${col.y}⚠ NO VERIFICABLE${col.x} — ${noVer.length} chequeo(s) no pudieron medir. Esto NO es verde.`);
    for (const c of noVer) console.log(`      · ${c.nombre}: ${c.detalle}`);
    console.log();
    return 2;
  }
  console.log(`\n  ${col.g}✓ el flujo está al día${col.x} — los chequeos aplicables reportados están vigentes\n`);
  return 0;
}

/* ── main ────────────────────────────────────────────────────────────────────────────── */
function main(){
if (!slugArg) {
  if(!JSON_OUT)console.log(`\n  ${col.bold}VIDEOS${col.x} ${col.dim}(node tools/flujo.mjs <slug> para el detalle)${col.x}\n`);
  let aggregate=0; const reports=[];
  for (const p of proyectos()) {
    let r;try{r=revisar(p);}catch(e){r={slug:p,carril:'?',ch:[{estado:'BLOQUEADO',nombre:'CONFIG',detalle:e.message}],bloqueo:{nombre:'CONFIG',detalle:e.message}};}
    reports.push(r); aggregate=aggregate===1||statusCode(r)===1?1:Math.max(aggregate,statusCode(r));
    const est = r.ajeno ? `${col.dim}· fuera del carril${col.x}`
      : r.entregado ? `${col.b}▪ entregado${col.x}`
      : r.bloqueo ? `${col.r}✗ ${r.bloqueo.nombre}${col.x}`
      : r.ch.some((c) => c.estado === "NO VERIFICABLE") ? `${col.y}? no verificable${col.x}`
      : `${col.g}✓ al día${col.x}`;
    if(!JSON_OUT)console.log(`  ${p.padEnd(32)} ${String(r.carril).padEnd(11)} ${est}`);
  }
  if(JSON_OUT)console.log(JSON.stringify(reports,null,2));else console.log();
  return process.exitCode=aggregate;
}

/* `--entregado` cierra un video: escribe el hecho en el proyecto en vez de dejarlo en la
   cabeza de alguien. Es el mismo patrón que `approve.sh` — la decisión se vuelve un dato. */
if (args.includes("--entregado")) {
  const slugE = resolverSlug(slugArg);
  const f = join(slugE, "ENTREGADO.json");
  const pf=preflight(slugE,{stage:"delivery"});if(!pf.ok){console.error(JSON.stringify(pf,null,2));return process.exitCode=1;}
  const cfg=config(slugE);
  // Delivery preflight already checks the selected variant and both applicable lanes.

  const idx = args.indexOf("--entregado");
  const nota = args.slice(idx + 1).filter((a) => !a.startsWith("--") && a !== slugArg).join(" ") || null;
  const cuerpo = { fecha: new Date().toISOString().slice(0, 10), donde: null, nota };
  if(cfg){
    const current=cfg.activeVariant?cfg.variants[cfg.activeVariant]:cfg;
    const files=[], evidence=[];
    if(cfg.lane.includes('KIT'))for(const sc of scenes(slugE,'KIT'))if(sc.data.type!=='footage'){const receipt=JSON.parse(readFileSync(join(sc.dir,'renders/.render.json'),'utf8'));files.push({file:receipt.file,sha256:receipt.sha256});evidence.push(join(sc.dir,'renders/.render.json'));}
    if(cfg.lane.includes('MASTER')){const receiptPath=join(slugE,current.review||cfg.review||'REVIEW.json');const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));current.export={file:receipt.export.file,sha256:receipt.export.sha256};files.push(current.export);evidence.push(...receipt.export.evidence);}
    current.state='delivered';current.delivery={...cuerpo,files,evidence};current.nextAction='Delivered; reopen only for an authorized change.';
    writeFileSync(join(slugE,"pipeline.json"),JSON.stringify(cfg,null,2)+"\n");
  }
  writeFileSync(f, JSON.stringify(cuerpo, null, 2) + "\n");
  console.log(`\n  ▪ ${slugE} declarado ENTREGADO (${cuerpo.fecha})${nota ? ` — ${nota}` : ""}`);
  console.log(`  ${col.dim}Entrega registrada. Usar workflow-state.mjs para reabrir una revisión autorizada.${col.x}\n`);
  return process.exitCode=0;
}

let r;
try{r = revisar(resolverSlug(slugArg));}catch(e){console.error(e.message);return process.exitCode=1;}
if (JSON_OUT) { console.log(JSON.stringify(r, null, 2)); return process.exitCode=statusCode(r); }
return process.exitCode=imprimir(r);

}
main();
