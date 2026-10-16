#!/usr/bin/env node
import {existsSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {resolveProject,resolveScene,config,variant,masterDir,mapPath,isMain} from './project.mjs';
import {inputGraph,digest} from './input-graph.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function scenes(base,lane='MASTER'){
 const cfg=config(base);
 if(lane==='KIT'){const dir=join(base,'scenes');if(!existsSync(dir))return [];return readdirSync(dir).filter(n=>!n.startsWith('_')&&!n.startsWith('.')&&existsSync(join(dir,n,'meta.json'))).sort().map(id=>({id,lane,dir:join(dir,id),metaPath:join(dir,id,'meta.json'),data:read(join(dir,id,'meta.json')),entry:join(dir,id,'index.html')}));}
 const path=mapPath(base);if(!existsSync(path))return [];const map=read(path);return (map.beats||[]).map(b=>({id:b.id,lane,dir:masterDir(base),metaPath:path,data:b,map,entry:resolve(base,b.entry||relative(base,join(masterDir(base),'escenas',b.id+'.html')))}));
}
function clean(data){const {approved,aprobada,approval,render,...rest}=data;return rest;}
export function sceneFingerprint(base,sc){
 const cfg=variant(base);if(sc.data.type==='footage'){const src=sc.data.source||cfg?.source?.file;if(!src)throw Error(`Footage ${sc.id}: falta source explícito`);return inputGraph(base,{roots:[src],values:clean(sc.data)});}
 const roots=[sc.entry,...[cfg?.source?.file,cfg?.transcript?.file].filter(Boolean),...(sc.data.extraInputs||[]),...(cfg?.sharedInputs||[])];
 if(sc.lane==='MASTER'){const js=sc.entry.replace(/\.html$/,'.js');if(js!==sc.entry&&existsSync(js))roots.push(js);for(const f of ['_tokens.css','_brand-tokens.css'])if(existsSync(join(masterDir(base),f)))roots.push(join(masterDir(base),f));}
 else for(const f of ['_brand-tokens.css'])if(existsSync(join(base,f)))roots.push(join(base,f));
 for(const f of ['brand.json','package.json','package-lock.json','tsconfig.json','remotion.config.ts'])if(existsSync(join(base,f)))roots.push(f);
 for(const a of sc.data.assets||[]){const p=typeof a==='object'?(a.file||a.path):null;if(p)roots.push(p);}
 return inputGraph(base,{roots,publicDir:cfg?.publicDir||'public',assetBase:sc.lane==='MASTER'?masterDir(base):sc.dir,values:{scene:clean(sc.data),map:sc.map?Object.fromEntries(Object.entries(sc.map).filter(([k])=>k!=="beats")):null,engine:cfg?.engine,style:cfg?.style,distribution:cfg?.distribution,props:cfg?.props}});
}
export function approvalState(base,sc){try{const fp=sceneFingerprint(base,sc);const a=sc.data.approval;return {id:sc.id,ok:!!(a?.fingerprint===fp.sha256&&a.decision?.trim()),state:!a?'PENDING':a.fingerprint!==fp.sha256?'STALE':!a.decision?.trim()?'PENDING':'APPROVED',fingerprint:fp.sha256,inputs:fp.inputs};}catch(e){return {id:sc.id,ok:false,state:'UNVERIFIABLE',error:e.message};}}
export function outputState(base,sc){const p=join(sc.dir,'renders','.render.json');if(sc.data.type==='footage')return {ok:true,state:'N/A'};if(!existsSync(p))return {ok:false,state:'PENDING',error:'Falta recibo del render'};try{const d=read(p);const f=resolve(base,d.file);return {ok:d.fingerprint===sceneFingerprint(base,sc).sha256&&existsSync(f)&&digest(f)===d.sha256,state:d.fingerprint===sceneFingerprint(base,sc).sha256&&existsSync(f)&&digest(f)===d.sha256?'CURRENT':'STALE',file:f};}catch(e){return {ok:false,state:'UNVERIFIABLE',error:e.message};}}
export function approvalReport(base,lane='MASTER'){const results=scenes(base,lane).map(sc=>approvalState(base,sc));return {ok:!!results.length&&results.every(r=>r.ok),scenes:results};}
export function recordOutput(base,sc,file){const f=resolve(file);const r=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',f],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||'ffprobe falló');const probe=JSON.parse(r.stdout),v=probe.streams.find(s=>s.codec_type==='video');if(!v)throw Error('Render sin video');const expected=sc.data.timing?.durationFrames;if(expected!=null&&(!Number.isFinite(Number(v.nb_frames))||Math.abs(Number(v.nb_frames)-expected)>1))throw Error('Render con duración equivocada');if(sc.data.type==='alpha'&&!/^(?:yuva|gbrap|rgba|bgra|argb|abgr)/.test(v.pix_fmt||''))throw Error('Render alpha sin canal alpha');const cfg=variant(base);const dims=cfg?.distribution||{};if(dims.width&&v.width!==dims.width||dims.height&&v.height!==dims.height)throw Error('Render con resolución equivocada');const fps=sc.data.timing?.fps||dims.fps;if(fps){const [a,b]=(v.r_frame_rate||'0/1').split('/').map(Number);if(Math.abs(a/b-fps)>.001)throw Error('Render con FPS equivocado');}const decode=spawnSync('ffmpeg',['-v','error','-xerror','-nostdin','-i',f,'-f','null','-'],{encoding:'utf8',timeout:60000});if(decode.status!==0)throw Error(decode.stderr||'Render no decodifica');writeFileSync(join(sc.dir,'renders','.render.json'),JSON.stringify({schemaVersion:1,file:relative(base,f),sha256:digest(f),fingerprint:sceneFingerprint(base,sc).sha256,video:v},null,2)+'\n');}
export function sceneMain(defaultLane='KIT'){
 try{
  const a=process.argv.slice(2),values=new Set(['--decision','--lane','--record-output']);const free=a.filter((v,i)=>!v.startsWith('--')&&!values.has(a[i-1]));const base=resolveProject(free[0]);const val=n=>a[a.indexOf(n)+1];const lane=a.includes('--lane')?val('--lane'):defaultLane;const list=scenes(base,lane);
  if(a.includes('--estado')||a.includes('--check')||!free[1]){const r=approvalReport(base,lane);console.log(JSON.stringify(r,null,2));process.exitCode=r.ok?0:2;return;}
  const id=resolveScene(list.map(s=>s.id),free[1]),sc=list.find(s=>s.id===id);
  if(a.includes('--record-output')){recordOutput(base,sc,val('--record-output'));return;}
  if(a.includes('--check-scene')){const r=approvalState(base,sc);console.log(JSON.stringify(r));process.exitCode=r.ok?0:2;return;}
  const remove=a.includes('--quitar')||a.includes('--revocar');const decision=a.includes('--decision')?val('--decision'):null;
  if(!remove&&(!decision||decision.startsWith('--')))throw Error('Registrar la decisión real del usuario con --decision "texto o referencia"; un gate no concede aprobación.');
  if(!remove&&sc.data.type!=='footage'&&/data-asset\s*=/.test(readFileSync(sc.entry,'utf8')))throw Error('La escena tiene placeholders; resolver los recursos antes de aprobar la entrega.');
  if(remove){delete sc.data.approval;delete sc.data.approved;delete sc.data.aprobada;}
  else {const fp=sceneFingerprint(base,sc);sc.data.approval={fingerprint:fp.sha256,decision,at:new Date().toISOString()};if(lane==='KIT')sc.data.approved=true;else sc.data.aprobada={cuando:new Date().toISOString().slice(0,10),huella:fp.sha256};}
  writeFileSync(sc.metaPath,JSON.stringify(lane==='MASTER'?sc.map:sc.data,null,2)+'\n');console.log(`${id}: ${remove?'revocada':'decisión registrada'}`);
 }catch(e){console.error(e.message);process.exitCode=1;}
}
if(isMain(import.meta.url))sceneMain();
