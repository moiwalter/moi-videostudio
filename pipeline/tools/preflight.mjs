#!/usr/bin/env node
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveProject,resolveScene,config,variant,isMain} from './project.mjs';
import {scenes,approvalState,outputState} from './scene-state.mjs';
import {sourceState} from './source-state.mjs';
import {checkReview} from './review-video.mjs';
import {verifyExport} from './verify-export.mjs';
import {checkResources} from './resources.mjs';
export function preflight(base,{lane=null,scene=null,stage='render'}={}){
 if(!['render','delivery'].includes(stage))throw Error('stage inválido');
 if(lane!==null&&!['MASTER','KIT'].includes(lane))throw Error('lane inválido: MASTER | KIT');
 const c=config(base),v=variant(base),checks=[];const add=(ok,name,detail)=>checks.push({ok,name,detail});
 if(c&&lane&&c.lane!=='KIT+MASTER'&&lane!==c.lane)throw Error('lane no pertenece al proyecto');
 if(!c)add(false,'project identity','Registrar pipeline.json antes de renderizar');
 if(c){const src=sourceState(base);add(src.ok,'source',src.error||src.state);if(!v.brand||!v.style||!v.distribution?.placement)add(false,'brief','Marca, estilo y placement requeridos');if(!['hyperframes','remotion'].includes(v.engine.name))add(false,'engine','Motor no soportado');}
 const lanes=lane?[lane]:(c?.lane==='KIT+MASTER'?['MASTER','KIT']:[c?.lane||'MASTER']);
 for(const l of lanes){const all=scenes(base,l);const selected=scene?resolveScene(all.map(s=>s.id),scene):null;const list=all.filter(s=>!selected||s.id===selected);add(list.length>0,'scenes '+l,'No se valida un conjunto vacío');for(const sc of list){const a=approvalState(base,sc);add(a.ok,'approval '+sc.id,a.error||a.state);if(sc.data.type!=='footage'){const r=checkResources(base,sc.entry,{assetBase:sc.lane==='MASTER'?sc.dir:sc.dir});add(r.ok,'resources '+sc.id,r.error||'local');}if(stage==='delivery'&&l==='KIT'){const out=outputState(base,sc);add(out.ok,'output '+sc.id,out.error||out.file||out.state);}}
  if(l==='KIT'&&stage==='delivery'&&checks.every(c=>c.ok)){const r=spawnSync(process.execPath,[join(dirname(fileURLToPath(import.meta.url)),'validate-kit.mjs'),base,'--final'],{encoding:'utf8',timeout:60000});add(r.status===0,'KIT contract',((r.stdout||'')+(r.stderr||'')).slice(-2000));}
  if(l==='MASTER'){const path=resolve(base,v?.review||'REVIEW.json');if(!existsSync(path))add(false,'review','Falta revisión nativa');else try{const r=checkReview(base,stage==='delivery'?'export':'preview',path);add(r.ok,'review',r.errors.join('; '));if(r.ok&&stage==='delivery'){const receipt=JSON.parse(readFileSync(path,'utf8'));const q=verifyExport(resolve(base,receipt.export.file),{...v.distribution,audio:v.audio?.mode==='silent'?'none':'required',audioTargets:v.audio?.targets||{}});add(q.ok,'export technical QA',q.errors.join('; '));}}catch(e){add(false,'review',e.message);}}
 }
 return {ok:checks.length>0&&checks.every(c=>c.ok),stage,checks};
}
if(isMain(import.meta.url)){try{const [needle,...a]=process.argv.slice(2),val=n=>a.includes(n)?a[a.indexOf(n)+1]:null;const stage=val('--stage')||'render';if(!['render','delivery'].includes(stage))throw Error('stage inválido');const r=preflight(resolveProject(needle),{lane:val('--lane'),scene:val('--scene'),stage});console.log(JSON.stringify(r,null,2));process.exitCode=r.ok?0:2;}catch(e){console.error(e.message);process.exitCode=1;}}
