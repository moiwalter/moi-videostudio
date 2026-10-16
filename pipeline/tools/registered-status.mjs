import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {config,variant,mapPath} from './project.mjs';
import {digest} from './input-graph.mjs';
import {sourceState} from './source-state.mjs';
import {approvalReport,scenes,outputState} from './scene-state.mjs';
import {checkReview} from './review-video.mjs';
export function registeredStatus(base,slug,{fast=false,variantId=null}={}){
 const c=config(base),v=variant(base,variantId),ch=[];
 const add=(estado,nombre,detalle)=>ch.push({estado,nombre,detalle});
 const result=()=>({slug,carril:c.lane,engine:v.engine,variant:v.variant,entry:v.engine.entry,escenasMaster:v.sceneCount??null,escenasKit:0,ch,bloqueo:ch.find(c=>c.estado==='BLOQUEADO')||null,nextAction:v.nextAction||null,currentExport:v.state==='delivered'?(c.lane==='KIT'?null:(v.delivery?.files?.find(f=>f.file===v.export?.file)||v.delivery?.files?.at(-1)||null)):(v.export||null),currentExports:v.state==='delivered'?v.delivery?.files||[]:v.export?[v.export]:[]});
 if(!['hyperframes','remotion'].includes(v.engine.name)){add('NO VERIFICABLE','MOTOR',`Motor no soportado: ${v.engine.name}`);return result();}
 if(c.lane!=='KIT'&&!existsSync(resolve(base,v.engine.entry))){add('BLOQUEADO','COMPOSICIÓN',`Falta ${v.engine.entry}`);return result();}
 add('OK','PROYECTO',`${v.engine.name} ${v.engine.version||'(versión pendiente)'} · ${v.engine.entry}${v.engine.composition?' · '+v.engine.composition:''}`);
 if(['reference','exported','delivered'].includes(v.state)){
  const outputs=v.state==='delivered'?v.delivery?.files:[v.export];
  if(!outputs?.length||outputs.some(o=>!o?.file||!o.sha256)){add('NO VERIFICABLE','ENTREGA','Falta identidad de los archivos entregados');return result();}
  for(const o of outputs){const out=resolve(base,o.file);if(!existsSync(out)||digest(out)!==o.sha256){add('BLOQUEADO','ENTREGA',`Archivo ausente o distinto: ${o.file}`);return result();}}
  const evidence=v.state==='delivered'?v.delivery?.evidence:v.evidence;
  if(!evidence?.length||evidence.some(f=>!existsSync(resolve(base,f)))){add('NO VERIFICABLE','EVIDENCIA','Falta evidencia de la revisión original');return result();}
  add('ENTREGADO','ENTREGA VERIFICADA',outputs.map(o=>o.file).join(', ')+'; identidad comprobada, sin reabrir producción');
  for(const note of v.openIssues||[])add('AVISO','PENDIENTE EDITORIAL',note);
  return {...result(),entregado:true,declarado:true,historical:v.state!=='delivered'};
 }
 const src=sourceState(base);add(src.ok?'OK':src.state==='FAIL'?'BLOQUEADO':'NO VERIFICABLE','FUENTE / TRANSCRIPT',src.error||'Contenido vinculado al corte');
 if(!c.brand||!c.style||!v.distribution?.placement)add('NO VERIFICABLE','BRIEF','Falta marca, estilo o destino registrado');
 const lanes=c.lane==='KIT+MASTER'?['KIT','MASTER']:[c.lane];
 for(const lane of lanes){
  const report=approvalReport(base,lane);
  add(report.ok?'OK':'NO VERIFICABLE','APROBACIÓN '+lane,report.ok?'Decisiones e inputs vigentes':report.scenes.length?report.scenes.filter(s=>!s.ok).map(s=>`${s.id}: ${s.error||s.state}`).join('; '):'Falta mapa de escenas');
  if(lane==='KIT'){const outputs=scenes(base,'KIT').map(s=>({id:s.id,...outputState(base,s)}));add(outputs.length&&outputs.every(s=>s.ok)?'OK':'NO VERIFICABLE','OUTPUTS KIT',outputs.filter(s=>!s.ok).map(s=>`${s.id}: ${s.error||s.state}`).join('; ')||'Archivos vigentes');}
  else{
   const review=resolve(base,v.review||'REVIEW.json');
   try{const data=JSON.parse(readFileSync(review,'utf8'));const r=checkReview(base,data.export?.file?'export':'preview',review);add(r.ok?'OK':'NO VERIFICABLE','REVISIÓN NATIVA',r.ok?'Recibo vigente; valida evidencia, no ejecuta inspección visual':r.errors.join('; '));}catch(e){add('NO VERIFICABLE','REVISIÓN',e.message);}
  }
 }
 if(fast)add('NO VERIFICABLE','GATES OMITIDOS','Modo rápido: no ejecuta verificaciones técnicas de reproducción/render');
 return result();
}
