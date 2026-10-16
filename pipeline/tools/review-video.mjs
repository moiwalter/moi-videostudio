#!/usr/bin/env node
// Evidence receipt, not a vision model or Walter's editorial approval.
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {inputGraph} from './input-graph.mjs';
import {config,variant,ROOT,isMain,resolveProject} from './project.mjs';
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const item = () => ({ status: 'pending', note: '' });
export function template(composition = 'master/index.html') {
  return { schemaVersion: 1, composition, extraInputs: [],
    preview: { fingerprint: null, checks: { visual: item(), layers: item(), timing: item() }, evidence: [] },
    export: { fingerprint: null, file: null, sha256: null, checks: { visual: item(), audio: item(), decode: item() }, evidence: [] } };
}
// Tracks locally referenced HTML/CSS/scripts/media, including alpha replacement.
export function fingerprint(base, receipt) {
  const cfg=config(base), selected=variant(base);
  const roots=[receipt.composition,...[cfg?.source?.file,cfg?.transcript?.file].filter(Boolean),...(receipt.extraInputs||[]),...(cfg?.sharedInputs||[])];
  for(const f of ['brand.json','package.json','package-lock.json','tsconfig.json','remotion.config.ts']) if(existsSync(resolve(base,f)))roots.push(f);
  return inputGraph(base,{roots,publicDir:cfg?.publicDir||'public',assetBase:dirname(resolve(base,receipt.composition)),values:{engine:selected?.engine,props:selected?.props,style:cfg?.style,distribution:selected?.distribution,audio:selected?.audio}});
}
export function checkReview(base, stage = 'preview', receiptFile = 'REVIEW.json') {
  const file = resolve(base, receiptFile);
  if (!existsSync(file)) return { ok: false, errors: ['Falta REVIEW.json; crear con --init.'] };
  const d = JSON.parse(readFileSync(file, 'utf8')), errors = [];
  if (d.schemaVersion !== 1) errors.push('schemaVersion debe ser 1.');
  const selected=variant(base);if(selected&&resolve(base,d.composition)!==resolve(base,selected.engine.entry))errors.push('Review composition differs from the registered render entry.');
  const fp = fingerprint(base, d);
  for (const phase of stage === 'export' ? ['preview', 'export'] : ['preview']) {
    const rec = d[phase];
    if (rec?.fingerprint !== fp.sha256) errors.push(`${phase}: revisión ausente o anterior a los inputs actuales.`);
    const keys = phase === 'preview' ? ['visual', 'layers', 'timing'] : ['visual', 'audio', 'decode'];
    for (const key of keys) {
      const c = rec?.checks?.[key];
      const na = ['layers', 'audio'].includes(key) && c?.status === 'not_applicable' && c.note?.trim();
      if (!(c?.status === 'pass' && c.note?.trim()) && !na) errors.push(`${phase}.${key}: falta revisión y nota de lo comprobado.`);
    }
    if (!Array.isArray(rec?.evidence) || !rec.evidence.length) errors.push(`${phase}: falta evidencia local.`);
    else for (const e of rec.evidence) if (typeof e !== 'string' || !existsSync(resolve(base, e)) || !statSync(resolve(base, e)).isFile()) errors.push(`${phase}: evidencia ausente ${e}`);
  }
  if (stage === 'export') {
    const output = d.export?.file && resolve(base, d.export.file);
    if (!output || !existsSync(output) || !statSync(output).isFile() || statSync(output).size === 0) errors.push('export: falta el archivo entregable.');
    else if (hash(output) !== d.export.sha256) errors.push('export: el archivo no coincide con el SHA256 revisado.');
  }
  return { ok: errors.length === 0, stage, fingerprint: fp.sha256, inputs: fp.inputs, errors,
    scope: 'Valida vigencia y presencia del recibo. La inspección visual sigue siendo trabajo del revisor; no concede aprobación editorial.' };
}
if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2), values = new Set(['--stage', '--composition', '--receipt']);
    const slug = args.find((a, i) => !a.startsWith('--') && !values.has(args[i - 1]));
    const val = (key, fallback) => { const i = args.indexOf(key); if (i < 0) return fallback; if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Falta valor de ${key}`); return args[i + 1]; };
    for (const a of args.filter(a => a.startsWith('--'))) if (!['--init', '--check', '--fingerprint', '--stage', '--composition', '--receipt'].includes(a)) throw Error(`Flag desconocido: ${a}`);
    if (!slug) throw Error('uso: review-video.mjs <slug|ruta> --init | --fingerprint | --check [--stage preview|export]');
    const base = resolveProject(slug);
    const stage = val('--stage', 'preview');
    if (!['preview', 'export'].includes(stage)) throw Error(`Stage desconocido: ${stage}`);
    if (!existsSync(base) || !statSync(base).isDirectory()) throw Error(`No existe proyecto: ${base}`);
    const file = resolve(base, val('--receipt', variant(base)?.review || 'REVIEW.json'));
    if (args.includes('--init')) {
      if (existsSync(file)) throw Error('REVIEW.json ya existe; no se sobrescribe.');
      mkdirSync(dirname(file), {recursive:true});
      writeFileSync(file, JSON.stringify(template(val('--composition', variant(base)?.engine.entry || 'master/index.html')), null, 2) + '\n');
      console.log('REVIEW.json creado pendiente. Completar después de revisar; no es una aprobación.');
    } else if (args.includes('--fingerprint')) {
      console.log(JSON.stringify(fingerprint(base, JSON.parse(readFileSync(file, 'utf8'))), null, 2));
    } else {
      const r = checkReview(base, stage, file); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.ok ? 0 : 1;
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
