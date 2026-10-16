/**
 * lib-corte.mjs — EL CORTE Y SU RELOJ. Módulo compartido: `flujo.mjs` y `validate-kit.mjs`
 * hallan el corte y su transcript con ESTE código, no con una copia cada uno (regla #5 de
 * START_HERE: si a una herramienta le falta algo, se arregla la herramienta).
 *
 * ⛔ EL INVARIANTE QUE ESTE MÓDULO EXISTE PARA SOSTENER (29-ago-2026):
 *
 *     El reloj del video es el CORTE. El .srt es una MEDICIÓN del corte, no el corte.
 *
 * `validate-kit` derivaba la duración del video del último cue del .srt (`cut = srt.dur`) y
 * después medía la cobertura contra ese mismo número. Circular: el kit siempre cubre el 100 %
 * del reloj que el propio kit usó. Dos casos medidos el mismo día:
 *
 *   · `siete-pasos`: local/corte.mp4 dura 99,9 s y corte-v2.srt describe 95,8 s — whisper se
 *     comió 4,1 s de cola. validate-kit cantó «✓ cobertura 100.0 %». El kit cubre el 100 % de
 *     un video 4 s más corto que el real, y los 4 s finales (el cierre) van desnudos.
 *   · `nacho-brain-rot`: el corte es de 57,0 s (24-ago) y los dos .srt de la raíz son de la
 *     toma vieja de 74,5 s (22-ago). validate-kit agarró el .srt viejo y escupió 17 errores
 *     rojos con timestamps precisos — todos artefactos del input, ninguno real.
 *
 * Los dos son el MISMO defecto y ninguno se ve: la herramienta no falla, miente con precisión.
 */

import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join,resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {sourceState} from './source-state.mjs';
import {config} from "./project.mjs";

export function ffprobe(file, entries) {
  try {
    return execFileSync("ffprobe", ["-v", "error", "-show_entries", entries, "-of", "csv=p=0", file], { encoding: "utf8" }).trim();
  } catch { return null; }
}

/** A registered source may preserve unused head/tail footage outside the edit. */
export function durationOfEdit(sourceDuration, trim) {
  if (trim == null) return sourceDuration;
  const start = trim.start ?? 0, end = trim.end ?? sourceDuration;
  if (!Number.isFinite(sourceDuration) || !Number.isFinite(start) || !Number.isFinite(end) ||
      start < 0 || end <= start || end > sourceDuration) {
    throw new Error('source.trim must be a finite, non-empty range within the source duration');
  }
  return end - start;
}

/** El corte terminado: el reloj de TODO el sync. */
export function hallarCorte(base) {
  const registered=config(base);
  if(registered&&!registered.source?.file)return null;
  const cands = registered?.source?.file?[registered.source.file]:[];
  if(cands.length&&!existsSync(resolve(base,cands[0])))return null;
  for (const p of ["local/corte.mp4", "local/cut.mp4", "local/corte-final.mp4"]) {
    if (!registered && existsSync(join(base, p))) cands.push(p);
  }
  if (!cands.length) {
    // el mp4 más grande de la raíz, ignorando los crudos de cámara (IMG_*)
    let mejor = null, mejorSz = 0;
    for (const f of readdirSync(base)) {
      if (!/\.mp4$/i.test(f) || /^IMG_/i.test(f)) continue;
      const sz = statSync(join(base, f)).size;
      if (sz > mejorSz) { mejor = f; mejorSz = sz; }
    }
    if (mejor) cands.push(mejor);
  }
  if (!cands.length) return null;

  const rel = cands[0], abs = resolve(base, rel);
  const dur = parseFloat(ffprobe(abs, "format=duration") || "");
  const wh = (ffprobe(abs, "stream=width,height") || "").split("\n")[0].replace(",", "×");
  const fr = ffprobe(abs, "stream=r_frame_rate");
  let fps = null;
  if (fr && fr.includes("/")) { const [a, b] = fr.split("\n")[0].split("/").map(Number); if (b) fps = a / b; }
  const sourceDuration = isFinite(dur) ? dur : null;
  return { rel, abs, dur: durationOfEdit(sourceDuration, registered?.source?.trim), sourceDuration,
    wh, fps, mtime: statSync(abs).mtimeMs };
}

export function parseSrt(file) {
  const cues = [];
  for (const blk of readFileSync(file, "utf8").split(/\r?\n\r?\n/)) {
    const m = blk.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
    if (!m) continue;
    const t = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
    cues.push({ start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]), text: blk.split(/\r?\n/).slice(2).join(" ").trim() });
  }
  return cues;
}

/** Todos los transcripts del proyecto (los .srt de la raíz + local/transcript.json). */
export function hallarTranscripts(base) {
  const out = [];
  const c=config(base);
  if(c?.transcript?.file){
    const f=c.transcript.file,abs=resolve(base,f);if(!existsSync(abs))return [];
    let cues;
    if(/\.srt$/i.test(f))cues=parseSrt(abs);
    else {const d=JSON.parse(readFileSync(abs,'utf8'));
      const rows=d.transcription?d.transcription.map(r=>({start:r.offsets?.from/1000,end:r.offsets?.to/1000,text:r.text})):Array.isArray(d)?d:d.words||d.segments||[];
      cues=rows.map(r=>({start:Number(r.start),end:Number(r.end),text:r.text||r.word||r.words?.map(w=>w.word||w.text||'').join(' ')||''})).filter(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.text.trim());
    }
    if(!cues.length)return [];
    return [{rel:f,abs,cues,words:cues,dur:cues.at(-1).end,mtime:statSync(abs).mtimeMs,identityBound:sourceState(base).ok}];
  }
  if(c)return [];
  for (const f of readdirSync(base)) {
    if (!/\.srt$/i.test(f)) continue;
    const abs = join(base, f), cues = parseSrt(abs);
    out.push({ rel: f, abs, cues, dur: cues.length ? cues[cues.length - 1].end : null, mtime: statSync(abs).mtimeMs });
  }
  const json = join(base, "local", "transcript.json");
  if (existsSync(json)) {
    try {
      const d = JSON.parse(readFileSync(json, "utf8"));
      const ws = Array.isArray(d) ? d : d.words || d.segments || [];
      if (ws.length) out.push({ rel: "local/transcript.json", abs: json, words: ws, dur: ws[ws.length - 1].end, mtime: statSync(json).mtimeMs });
    } catch { /* un transcript ilegible se ignora acá; el chequeo de arriba ya reporta que falta */ }
  }
  return out;
}

/**
 * ¿Este transcript es de ESTE corte? Devuelve un veredicto explícito, nunca un booleano pelado:
 * el modo de falla importa porque la acción siguiente es distinta.
 *
 *   ok           cuadra dentro de tolerancia
 *   cola         el .srt termina ANTES que el corte → whisper se comió el cierre
 *   otra-toma    la diferencia es grande, o el .srt es más viejo que el corte → es otro corte
 *   sin-medida   no se puede comparar (falta duración de alguno)
 */
export function cuadraConElCorte(t, corte) {
  if (!t || !corte || t.dur == null || corte.dur == null) return { veredicto: "sin-medida" };
  const delta = corte.dur - t.dur;                       // + = el srt se queda corto
  const tol = Math.max(1.5, corte.dur * 0.02);
  const masViejo = !t.identityBound && t.mtime < corte.mtime;
  if (Math.abs(delta) <= tol && !masViejo) return { veredicto: "ok", delta, tol };
  if (masViejo || Math.abs(delta) > Math.max(8, corte.dur * 0.08)) return { veredicto: "otra-toma", delta, tol, masViejo };
  return { veredicto: delta > 0 ? "cola" : "otra-toma", delta, tol, masViejo };
}

export const fmtSeg = (s) => {
  if (s == null || !isFinite(s)) return "?";
  const m = Math.floor(s / 60), r = s - m * 60;
  return m ? `${m}:${r.toFixed(1).padStart(4, "0")}` : `${r.toFixed(1)} s`;
};
