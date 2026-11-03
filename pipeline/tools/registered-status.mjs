import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {config,variant,mapPath} from './project.mjs';
import {digest} from './input-graph.mjs';
import {sourceState} from './source-state.mjs';
import {approvalReport,scenes,outputState} from './scene-state.mjs';
import {checkReview} from './review-video.mjs';
import {estado as pitchState} from './pitch.mjs';
import {estado as clienteState} from './cliente-check.mjs';
import {estado as perillasState} from './perillas.mjs';
import {spawnSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
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
 /* 2-nov-2026: ENTREGADO.json declara una entrega anterior al recibo con huella (programar, adobe, cloudflare… de Chris).
    Lo entregado no se re-litiga: se cierra sin correr los chequeos de producción. Reabrir (workflow-state reopen) lo renombra. */
 const marcador=resolve(base,'ENTREGADO.json');
 if(existsSync(marcador)){let e;try{e=JSON.parse(readFileSync(marcador,'utf8'));}catch{}
  if(!e?.fecha){add('NO VERIFICABLE','ENTREGA','ENTREGADO.json ilegible o sin fecha');return result();}
  add('ENTREGADO','CERRADO',`declarado el ${e.fecha}${e.donde?` · ${e.donde}`:''}${e.nota?` · ${e.nota}`:''} · sin huella del archivo entregado (anterior al recibo de entrega)`);
  return {...result(),entregado:true,declarado:true};
 }
 const src=sourceState(base);add(src.ok?'OK':src.state==='FAIL'?'BLOQUEADO':'NO VERIFICABLE','FUENTE / TRANSCRIPT',src.error||'Contenido vinculado al corte');
 if(!c.brand||!c.style||!v.distribution?.placement)add('NO VERIFICABLE','BRIEF','Falta marca, estilo o destino registrado');
 if(c.lane!=='KIT'){try{const p=pitchState(base);add(p.ok?'OK':p.pendiente?'NO VERIFICABLE':'BLOQUEADO','PITCH',p.resumen);}catch(e){add('NO VERIFICABLE','PITCH',e.message);}}  // 1-nov-2026: 2–3 caminos antes del mapa; Walter elige
 try{const k=clienteState(base);add(k.ok?'OK':k.pendiente?'NO VERIFICABLE':'BLOQUEADO','CLIENTE',k.resumen);}catch(e){add('NO VERIFICABLE','CLIENTE',e.message);}  // 2-nov-2026: reglas de la persona que se revisan en código (C04 «AI», C06 Freddy)
 /* 2-nov-2026: la composición lee las perillas (perillas.js/css generados) y el mapa se mide contra el formato.
    Medida fuera del formato = AVISO (cada perilla salió de uno o dos videos). Con la corrida completa, Chrome mide los subtítulos. */
 try{const q=perillasState(base);add(q.ok?'OK':q.pendiente?'NO VERIFICABLE':'BLOQUEADO','PERILLAS',q.resumen);for(const x of q.avisos)add('AVISO','PERILLA',`${x.perilla}: ${x.detalle}`);
  if(q.ok&&!fast&&c.pitchRequerido===true){const n=spawnSync(process.execPath,[join(dirname(fileURLToPath(import.meta.url)),'perillas.mjs'),base,'--navegador','--json'],{encoding:'utf8',timeout:90000});
   let nav=null;try{nav=JSON.parse(n.stdout).navegador;}catch{}
   if(!nav)add('NO VERIFICABLE','PERILLAS EN PANTALLA',(n.stderr||'no pude medir en el navegador').trim().slice(0,200));
   else add(nav.estado,'PERILLAS EN PANTALLA',nav.detalle);}
 }catch(e){add('NO VERIFICABLE','PERILLAS',e.message);}
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
