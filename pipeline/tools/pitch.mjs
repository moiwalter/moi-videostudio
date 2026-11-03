#!/usr/bin/env node
/**
 * pitch.mjs — antes del mapa de escenas, proponer 2–3 caminos y que Walter elija.
 *
 * POR QUÉ (1-nov-2026, Walter): «el video llega, conversamos, hace el pitch del formato… se pueden mezclar formatos».
 * Antes el formato lo decidía un default al crear el proyecto (Chris → layered) y nadie mostraba alternativas.
 * Un video mezclado tampoco tenía dónde quedar escrito.
 *
 * QUÉ GARANTIZA
 *   - Cada camino es un formato o una mezcla, con su porqué y frases del corte como evidencia. La evidencia se busca
 *     en el transcript vinculado: una frase que no está en el corte se rechaza (no se inventa).
 *   - La elección lleva la decisión de Walter con sus palabras. El formato base pasa a pipeline.json (`style`) y la
 *     lista entera a `formatos`.
 *   - Si el camino es una mezcla, cada escena de BEATS.json dice su `formato`, y sólo de los elegidos.
 *   - Se exige a los proyectos nuevos (pitchRequerido, lo pone init-project). Uno anterior no se bloquea: no se rehace
 *     trabajo hecho.
 *   - Lo que propone es el agente; lo que decide es Walter. Este archivo sólo verifica y registra.
 *
 * USO
 *   node tools/pitch.mjs <proyecto>                                   estado
 *   node tools/pitch.mjs <proyecto> --propuesta caminos.json          registra 2–3 caminos
 *   node tools/pitch.mjs <proyecto> --elegir B --decision "«la B»"    registra la elección de Walter
 *   node tools/pitch.mjs <proyecto> --check                           0 = se puede mapear / el mapa respeta el pitch
 *
 * caminos.json: {"caminos":[{"id":"A","nombre":"…","formatos":["layered-talking-head"],"base":"layered-talking-head",
 *   "reparto":"(sólo si mezcla) qué tramo va en qué formato","porque":"…","evidencia":[{"t":12.3,"frase":"lo que dice"}]}]}
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {resolveProject,isMain,mapPath} from './project.mjs';
import {loadStyle} from './style.mjs';

const leer=p=>JSON.parse(readFileSync(p,'utf8'));
const escribir=(p,d)=>writeFileSync(p,JSON.stringify(d,null,2)+'\n');
export const normalizar=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9ñ]+/g,' ').trim();

/** Todo el texto de un transcript: JSON (cualquier campo text/word) o texto plano. */
export function textoTranscript(file){
  const raw=readFileSync(file,'utf8');
  if(!/\.json$/i.test(file))return normalizar(raw);
  const out=[];const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(['text','word','punctuated_word'].includes(k)&&typeof x==='string')out.push(x);else walk(x);}};
  walk(JSON.parse(raw));return normalizar(out.join(' '));
}

function rutas(base){
  const cfgP=join(base,'pipeline.json');if(!existsSync(cfgP))throw Error('El proyecto no tiene pipeline.json');
  return {cfgP,briefP:join(base,'master/BRIEF.json'),beatsP:mapPath(base)};
}

export function validarCaminos(base,data){
  const errs=[];const cs=data?.caminos;
  if(!Array.isArray(cs)||cs.length<2||cs.length>3)return [`Se proponen 2 o 3 caminos (llegaron ${Array.isArray(cs)?cs.length:0})`];
  const cfg=leer(join(base,'pipeline.json'));
  const tf=cfg.transcript?.file?resolve(base,cfg.transcript.file):null;
  if(!tf||!existsSync(tf))return ['Sin transcript vinculado en pipeline.json: no se puede verificar que la evidencia esté en el corte'];
  const texto=textoTranscript(tf);
  const ids=new Set();
  for(const c of cs){
    const q=`camino ${c.id??'?'}`;
    if(!c.id||ids.has(c.id))errs.push(`${q}: id vacío o repetido`);ids.add(c.id);
    if(!c.nombre?.trim())errs.push(`${q}: falta nombre`);
    if(!Array.isArray(c.formatos)||!c.formatos.length)errs.push(`${q}: falta formatos`);
    for(const f of c.formatos||[]){try{loadStyle(f);}catch{errs.push(`${q}: el formato ${f} no existe en pipeline/styles`);}}
    if(!c.formatos?.includes(c.base))errs.push(`${q}: base ${c.base} no está entre sus formatos`);
    if((c.formatos||[]).length>1&&!c.reparto?.trim())errs.push(`${q}: es una mezcla y no dice el reparto (qué tramo va en qué formato)`);
    if(!c.porque?.trim())errs.push(`${q}: falta el porqué`);
    if(!Array.isArray(c.evidencia)||!c.evidencia.length)errs.push(`${q}: falta evidencia (frases del corte)`);
    for(const e of c.evidencia||[]){const n=normalizar(e.frase||'');if(n.split(' ').filter(Boolean).length<3)errs.push(`${q}: «${e.frase}» es muy corta; la evidencia es una frase de al menos 3 palabras`);else if(!` ${texto} `.includes(` ${n} `))errs.push(`${q}: «${e.frase}» no está en el transcript`);}
  }
  return errs;
}

export function proponer(base,data){
  const errs=validarCaminos(base,data);if(errs.length)throw Error(errs.join('\n'));
  const {briefP}=rutas(base);mkdirSync(join(base,'master'),{recursive:true});
  const B=existsSync(briefP)?leer(briefP):{};
  const historial=[...(B.pitch?.historial||[])];
  if(B.pitch?.caminos)historial.push({fecha:B.pitch.fecha,caminos:B.pitch.caminos,elegido:B.pitch.elegido});
  B.pitch={fecha:new Date().toISOString(),caminos:data.caminos,elegido:null,historial};
  escribir(briefP,B);
}

export function elegir(base,id,decision){
  if(!decision?.trim())throw Error('Falta --decision: las palabras de Walter al elegir');
  const {briefP,cfgP}=rutas(base);const B=existsSync(briefP)?leer(briefP):{};
  if(!B.pitch?.caminos)throw Error('No hay propuesta: primero --propuesta');
  const c=B.pitch.caminos.find(x=>x.id===id);if(!c)throw Error(`No existe el camino ${id}. Hay: ${B.pitch.caminos.map(x=>x.id).join(', ')}`);
  B.pitch.elegido={id,decision,fecha:new Date().toISOString()};escribir(briefP,B);
  const cfg=leer(cfgP);cfg.style=c.base;cfg.formatos=c.formatos;escribir(cfgP,cfg);
  return c;
}

/** El estado del pitch: ok = se puede mapear y el mapa (si existe) respeta lo elegido. pendiente = falta una decisión
    (el router lo marca NO VERIFICABLE, como el brief o el mapa que faltan); sin pendiente y no ok = error (BLOQUEADO). */
export function estado(base){
  const {briefP,beatsP}=rutas(base);
  const B=existsSync(briefP)?leer(briefP):{};const p=B.pitch;
  const beats=existsSync(beatsP)?(leer(beatsP).beats||[]):[];const hayMapa=beats.length>0;  // un mapa vacío no es trabajo hecho
  /* Se exige sólo a los proyectos creados desde el 1-nov-2026 (init-project los marca con pitchRequerido). Adivinar
     "trabajo hecho" por los archivos falló: optimismo y ep02 están terminados y su mapa no está donde se lo busca. */
  const requerido=leer(rutas(base).cfgP).pitchRequerido===true;
  if(!p?.caminos)return requerido?{ok:false,pendiente:true,resumen:`falta el pitch: proponer 2–3 caminos (formato o mezcla) antes del mapa${hayMapa?' — el mapa ya se armó sin pitch':''}`}:{ok:true,resumen:'proyecto anterior al pitch: no se exige (no se rehace trabajo hecho)'};
  if(!p.elegido)return {ok:false,pendiente:true,resumen:`pitch propuesto (${p.caminos.map(c=>`${c.id} ${c.nombre}`).join(' · ')}), falta que Walter elija`};
  const c=p.caminos.find(x=>x.id===p.elegido.id);
  const res=`camino ${c.id} «${c.nombre}» (${c.formatos.join(' + ')}) — ${p.elegido.decision}`;
  if(!hayMapa||c.formatos.length<2)return {ok:true,resumen:res};
  const sin=beats.filter(b=>!b.formato).map(b=>b.id), fuera=beats.filter(b=>b.formato&&!c.formatos.includes(b.formato)).map(b=>`${b.id}=${b.formato}`);
  const errs=[sin.length?`escenas sin formato: ${sin.join(', ')}`:null,fuera.length?`formato fuera del camino elegido: ${fuera.join(', ')}`:null].filter(Boolean);
  return errs.length?{ok:false,resumen:`${res} · ${errs.join(' · ')}`}:{ok:true,resumen:`${res} · ${beats.length} escenas con formato`};
}

if(isMain(import.meta.url)){
  const a=process.argv.slice(2),val=n=>{const i=a.indexOf(n);return i<0?null:a[i+1];};
  try{
    const needle=a.find((x,i)=>!x.startsWith('--')&&!['--propuesta','--elegir','--decision'].includes(a[i-1]));
    const base=resolveProject(needle);
    if(val('--propuesta')){proponer(base,leer(resolve(val('--propuesta'))));console.log('✓ pitch registrado: falta que Walter elija → --elegir <id> --decision "…"');}
    else if(val('--elegir')){const c=elegir(base,val('--elegir'),val('--decision'));console.log(`✓ elegido ${c.id} «${c.nombre}» · formato base ${c.base}${c.formatos.length>1?` · mezcla ${c.formatos.join(' + ')}: cada escena de BEATS.json lleva "formato"`:''}`);}
    else{const e=estado(base);console.log(`${e.ok?'✓':'✗'} PITCH · ${e.resumen}`);if(a.includes('--check'))process.exitCode=e.ok?0:1;}
  }catch(e){console.error(`✗ ${e.message}`);process.exitCode=1;}
}
