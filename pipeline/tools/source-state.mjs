#!/usr/bin/env node
import {writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveProject,config,variant,isMain} from './project.mjs';
import {digest} from './input-graph.mjs';
export function sourceState(base){const c=variant(base);if(!c?.source?.file)return {ok:false,state:'UNVERIFIABLE',error:'Falta fuente explícita en pipeline.json'};try{const s=digest(resolve(base,c.source.file));if(!c.source.sha256)return {ok:false,state:'PENDING',error:'Fuente sin identidad registrada'};if(s!==c.source.sha256)return {ok:false,state:'FAIL',error:'La fuente/corte cambió; revalidar transcript y tiempos'};if(c.transcript?.notApplicable)return {ok:true,state:'N/A',note:c.transcript.notApplicable};const t=c.transcript;if(!t?.file||!t.sha256||!t.language)return {ok:false,state:'PENDING',error:'Falta transcript vinculado y lenguaje'};if(t.sourceSha256!==s||digest(resolve(base,t.file))!==t.sha256)return {ok:false,state:'FAIL',error:'Transcript o fuente distinto de la vinculación registrada'};if(t.limpiezaRequerida&&(!t.limpieza?.decision?.trim()||t.limpieza.sourceSha256!==s||!t.limpieza.file||digest(resolve(base,t.limpieza.file))!==t.limpieza.sha256))return {ok:false,state:'PENDING',error:'Falta la limpieza del habla sobre este corte (tools/limpiar-habla.py + --limpieza): eh, pausas largas y retakes'};if(t.unresolved?.length)return {ok:false,state:'PENDING',error:`${t.unresolved.length} tramo(s) de speech sin resolver`,unresolved:t.unresolved};return {ok:true,state:'PASS'};}catch(e){return {ok:false,state:'UNVERIFIABLE',error:e.message};}}
if(isMain(import.meta.url)){
 try{
  const [needle,...a]=process.argv.slice(2),base=resolveProject(needle);
  if(a.includes('--limpieza')){
   // Recibo de tools/limpiar-habla.py corrido sobre el corte vigente. Ata la lista al hash de la fuente: si el corte cambia, vence.
   const val=n=>{const i=a.indexOf(n),v=i<0?null:a[i+1];if(!v||v.startsWith('--'))throw Error(`Falta valor para ${n}`);return v;};
   const file=val('--limpieza'),decision=val('--decision');const lista=JSON.parse(readFileSync(resolve(base,file),'utf8')).cortes||[];const sin=lista.filter(x=>x.decision!=='cortar'&&x.decision!=='dejar').length;if(sin)throw Error(`${sin} cortes propuestos sin decisión: todos los cortes son propuestos y los decide Walter ("cortar" o "dejar")`);const quedan=lista.filter(x=>x.decision==='cortar').length;if(quedan)throw Error(`${quedan} cortes aprobados siguen sin aplicarse en este corte: cortar, volver a alinear y regenerar la lista`);const c=config(base),v=variant(base);if(!v?.source?.sha256)throw Error('Vincular la fuente primero (--bind)');
   const target=c.activeVariant?c.variants[c.activeVariant]:c;
   target.transcript={...v.transcript,limpiezaRequerida:true,limpieza:{file,sha256:digest(resolve(base,file)),sourceSha256:digest(resolve(base,v.source.file)),decision}};
   writeFileSync(join(base,'pipeline.json'),JSON.stringify(c,null,2)+'\n');
  }
  if(a.includes('--bind')){
   const val=n=>{const i=a.indexOf(n),v=i<0?null:a[i+1];if(!v||v.startsWith('--'))throw Error(`Falta valor para ${n}`);return v;};
   const file=val('--source'),trans=val('--transcript'),language=val('--language');
   const c=config(base),v=variant(base);if(!c)throw Error('Registrar proyecto primero');
   const target=c.activeVariant?c.variants[c.activeVariant]:c;
   const sha256=digest(resolve(base,file)),transcriptSha=digest(resolve(base,trans));
   target.source={...v.source,file,sha256};
   // Desde el 5-oct-2026 (L036 de cvander) todo corte con habla que se vincula exige después el recibo de limpieza.
   target.transcript={...v.transcript,file:trans,sha256:transcriptSha,sourceSha256:sha256,language,limpiezaRequerida:true};
   // Binding real speech cancels a previous no-speech exemption; unresolved spans still require listening.
   delete target.transcript.notApplicable;
   writeFileSync(join(base,'pipeline.json'),JSON.stringify(c,null,2)+'\n');
  }
  const r=sourceState(base);console.log(JSON.stringify(r,null,2));process.exitCode=r.ok?0:r.state==='FAIL'?1:2;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
