#!/usr/bin/env node
// Canonical workspace identity. Queries never modify a project.
import {existsSync,readFileSync,readdirSync,statSync,lstatSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,basename,join,isAbsolute,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const toolsParent=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const ROOT=basename(toolsParent)==='pipeline'?dirname(toolsParent):toolsParent;
export const RESERVED=new Set(['tools','pipeline','proyectos','biblioteca','archivo','por-clasificar','00-entrada','templates','design_system','brands','styles','assets','node_modules','renders','_fixture','_legacy','_archive']);
export function isMain(url){try{return !!process.argv[1]&&realpathSync(process.argv[1])===fileURLToPath(url);}catch{return false;}}
function entries(root){
 const out=[];const nested=join(root,'proyectos');
 if(existsSync(nested))for(const client of readdirSync(nested,{withFileTypes:true}).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
  for(const p of readdirSync(join(nested,client.name),{withFileTypes:true}).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
   const base=join(nested,client.name,p.name,'edicion');
   if(existsSync(base)&&statSync(base).isDirectory())out.push({name:p.name,key:client.name+'/'+p.name,base});
  }
 }
 for(const d of readdirSync(root,{withFileTypes:true}))if(d.isDirectory()&&!d.name.startsWith('.')&&!RESERVED.has(d.name))out.push({name:d.name,key:d.name,base:join(root,d.name)});
 return out;
}
export function projects(root=ROOT){const all=entries(root);return all.map(p=>all.filter(q=>q.name===p.name).length===1?p.name:p.key).sort();}
export function projectSlug(base){return basename(base)==='edicion'?basename(dirname(base)):basename(base);}
export function resolveProject(needle,root=ROOT){
 if(!needle)throw Error('Falta proyecto.');
 if(isAbsolute(needle)){
  const p=resolve(needle);
  if(!existsSync(p)||!statSync(p).isDirectory())throw Error(`No existe proyecto: ${needle}`);
  // Keep temporary fixtures lexical; normalize only compatibility links to real editor directories.
  if(existsSync(join(p,'edicion'))&&statSync(join(p,'edicion')).isDirectory())return join(p,'edicion');
  return realpathSync(p);
 }
 const all=entries(root);let matches=all.filter(p=>p.key===needle);
 if(!matches.length)matches=all.filter(p=>p.name===needle);
 if(!matches.length)matches=all.filter(p=>p.key.includes(needle));
 if(matches.length!==1)throw Error(matches.length?`Proyecto ambiguo '${needle}': ${matches.map(p=>p.key).join(', ')}`:`No existe proyecto: ${needle}`);
 return matches[0].base;
}
export function newProjectPath(slug,client,root=ROOT){
 if(!/^[a-zA-Z0-9_-]+$/.test(slug)||!/^[a-zA-Z0-9_-]+$/.test(client))throw Error('Slug o cliente inválido');
 const project=join(root,'proyectos',client,slug),base=join(project,'edicion');
 if(existsSync(project)){
  const index=join(project,'PROYECTO.json');
  const intake=existsSync(index)?JSON.parse(readFileSync(index,'utf8')):null;
  // Intake happens before choosing an engine. Adopt only a declared intake with an empty editor.
  if(lstatSync(project).isSymbolicLink()||intake?.state!=='intake-pending'||intake.client!==client||intake.slug!==slug||
     (existsSync(base)&&(!lstatSync(base).isDirectory()||readdirSync(base).length)))throw Error('Proyecto existente; no se sobrescribe (solo intake-pending con edicion vacía)');
 }
 return base;
}
export function registerProject(base,client,root=ROOT){
 const project=dirname(base);if(basename(base)!=='edicion'||!project.startsWith(join(root,'proyectos')+'/'))return;
 for(const folder of ['originales','recursos','revision','entregas'])mkdirSync(join(project,folder),{recursive:true});
 const cfg=config(base),file=join(project,'PROYECTO.json');
 const item={schemaVersion:1,client,slug:projectSlug(base),editable:'edicion',originales:'originales',recursos:'recursos',revision:'revision',entregas:'entregas',engine:cfg?.engine||null,activeVariant:cfg?.activeVariant||null};
 const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
 const updated={...item,...previous};
 if(cfg){updated.engine=cfg.engine;updated.activeVariant=cfg.activeVariant||null;if(updated.state==='intake-pending')updated.state='created';}
 writeFileSync(file,JSON.stringify(updated,null,2)+'\n');
 // The catalog is reconstructed from existing indexes, so interrupted/new projects cannot erase other entries.
 refreshCatalog(root);
}
export function refreshCatalog(root=ROOT){
 const file=join(root,'catalogo.json');
 const previous=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
 const catalog=entries(root).filter(p=>existsSync(join(dirname(p.base),'PROYECTO.json'))).map(p=>{
  const index=JSON.parse(readFileSync(join(dirname(p.base),'PROYECTO.json'),'utf8'));
  return {...(index.id?{id:index.id}:{}),slug:p.name,client:basename(dirname(dirname(p.base))),project:relative(root,dirname(p.base)),editable:relative(root,p.base)};
 });
 writeFileSync(file,JSON.stringify({...previous,schemaVersion:1,projects:catalog},null,2)+'\n');
 return catalog;
}
export function resolveScene(names,needle){if(names.includes(needle))return needle;const matches=names.filter(n=>n===needle||n.startsWith(needle+'-'));if(matches.length!==1)throw Error(`Escena ${matches.length?'ambigua':'ausente'}: ${needle}`);return matches[0];}
export function config(base){const p=join(base,'pipeline.json');if(!existsSync(p))return null;const d=JSON.parse(readFileSync(p,'utf8'));if(d.schemaVersion!==1)throw Error('pipeline.json: schemaVersion debe ser 1');if(!['MASTER','KIT','KIT+MASTER'].includes(d.lane))throw Error('pipeline.json: lane inválido');if(!d.engine?.name||!d.engine.entry)throw Error('pipeline.json: engine.name y engine.entry requeridos');return d;}
export function variant(base,id){const d=config(base);if(!d)return null;const key=id||d.activeVariant;const v=key?d.variants?.[key]:{};if(key&&!v)throw Error(`Variante ausente: ${key}`);return {...d,...v,engine:{...d.engine,...v?.engine},variant:key};}
export function masterDir(base){return resolve(base,variant(base)?.paths?.master||'master');}
export function mapPath(base){return resolve(base,variant(base)?.paths?.map||'master/BEATS.json');}
export function entryPath(base,id){const v=variant(base,id);return resolve(base,v?.engine.entry||'master/index.html');}
export function engineVersion(base){const d=variant(base);if(d?.engine.version)return d.engine.version;let dir=existsSync(join(base,'package.json'))?base:masterDir(base);if(existsSync(join(dir,'package.json'))){const p=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));const dep=p.dependencies?.hyperframes||p.devDependencies?.hyperframes;const pin=JSON.stringify(p.scripts||{}).match(/hyperframes@(\d+\.\d+\.\d+)/);if(dep&&/^\d+\.\d+\.\d+$/.test(dep))return dep;if(pin)return pin[1];}return readFileSync(join(ROOT,'pipeline/tools/HF_VERSION'),'utf8').trim();}
export function assertEngineRuntime(base){const v=variant(base);if(!v?.engine.version)throw Error('Motor sin versión registrada');if(v.engine.name==='remotion')for(const name of ['remotion','@remotion/cli']){const f=join(base,'node_modules',name,'package.json');if(!existsSync(f))throw Error(`Instalar dependencias locales del proyecto: falta ${name}`);const actual=JSON.parse(readFileSync(f,'utf8')).version;if(actual!==v.engine.version)throw Error(`Motor instalado ${name}@${actual} difiere del pin ${v.engine.version}`);}return v.engine.version;}
if(isMain(import.meta.url)){try{const [cmd,needle,id]=process.argv.slice(2);if(cmd==='root')console.log(ROOT);else if(cmd==='new-path')console.log(newProjectPath(needle,id));else if(cmd==='register'){registerProject(resolve(needle),id);console.log(needle);}else{const base=resolveProject(needle);if(cmd==='resolve')console.log(base);else if(cmd==='slug')console.log(projectSlug(base));else if(cmd==='version')console.log(engineVersion(base));else if(cmd==='scene'){const names=readdirSync(join(base,'scenes')).filter(n=>statSync(join(base,'scenes',n)).isDirectory());console.log(resolveScene(names,id));}else if(cmd==='show')console.log(JSON.stringify(variant(base),null,2));else throw Error('Uso: project.mjs root|new-path|register|resolve|slug|version|scene|show');}}catch(e){console.error(e.message);process.exitCode=1;}}
