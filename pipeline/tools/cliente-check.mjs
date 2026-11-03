#!/usr/bin/env node
/**
 * cliente-check.mjs — corre las reglas de una persona que se pueden revisar en código (biblioteca/clientes/<cliente>.json).
 *
 * POR QUÉ (2-nov-2026): las reglas de Chris que más se repiten («AI», nunca «IA»; nunca el clip con Freddy) estaban
 * escritas como dato pero ninguna herramienta las corría, salvo la portada. Una regla en prosa se salta.
 *
 * TIPOS DE CHEQUEO
 *   texto-prohibido  `patron` (regex) sobre el texto que se VE en la composición: texto de los elementos y strings de los
 *                    scripts. No cuenta comentarios, CSS, atributos ni claves. Si la persona lo dice en voz, el subtítulo
 *                    de su voz puede llevarlo (C04): frena sólo si en pantalla hay MÁS apariciones que en el transcript.
 *   recurso-vetado   `patrones` (o `patron`) contra la ruta de cada archivo que usa la composición y contra su ORIGEN
 *                    declarado en el INDEX.json de su carpeta ({"c04": "originales/2000344A….MP4"}): un clip renombrado
 *                    se detecta por de dónde salió. Límite: una copia sin INDEX y con otro nombre no se ve.
 *   manual / herramienta: no se revisan acá (no se finge que se chequearon).
 *
 * QUÉ NO VE (revisión independiente del 2-nov-2026; lo demás que encontró está arreglado y tiene eval):
 *   texto en CSS `content:`, en JSON cargado con fetch(), en entidades HTML (I&#65;), dentro de imágenes o videos.
 *   La tolerancia por la voz es un total: un título nuestro puede «gastar» la de un subtítulo que no está en los archivos.
 *   Un error al leer la composición queda NO VERIFICABLE, no BLOQUEADO.
 *
 * Se EXIGE en el router sólo a los proyectos con pitchRequerido (creados desde el 1-nov). En uno anterior se puede
 * auditar a mano: lo entregado se lee, no se reabre.
 *
 * USO   node tools/cliente-check.mjs <proyecto> [--json]
 */
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,dirname,basename,extname,relative} from 'node:path';
import {resolveProject,isMain,config,variant,masterDir,entryPath,projectSlug} from './project.mjs';
import {inputGraph} from './input-graph.mjs';
import {loadCliente,reglasCliente} from './capas.mjs';

const leer=p=>JSON.parse(readFileSync(p,'utf8'));

/** Strings literales de un JS, con un lexer chico: los comentarios, las regex y « // » dentro de un string no lo
    descolocan, y los template literals pueden tener varias líneas (revisión del 2-nov). */
export function stringsJS(js){
  const out=[];let i=0,prev='';const n=js.length;
  const antesDeRegex=c=>!c||'(,=:[!&|?{};+-*%<>~^'.includes(c);
  while(i<n){
    const c=js[i],d=js[i+1];
    if(c==='/'&&d==='/'){while(i<n&&js[i]!=='\n')i++;continue;}
    if(c==='/'&&d==='*'){const k=js.indexOf('*/',i+2);i=k<0?n:k+2;continue;}
    if(c==='"'||c==="'"||c==='`'){let k=i+1,buf='';while(k<n&&js[k]!==c){if(js[k]==='\\'){buf+=js[k+1]??'';k+=2;continue;}if(js[k]==='\n'&&c!=='`')break;buf+=js[k++];}out.push(buf);i=k+1;prev=c;continue;}
    if(c==='/'&&antesDeRegex(prev)){let k=i+1,clase=false;while(k<n&&js[k]!=='\n'){if(js[k]==='\\'){k+=2;continue;}if(js[k]==='[')clase=true;else if(js[k]===']')clase=false;else if(js[k]==='/'&&!clase)break;k++;}i=k+1;while(i<n&&/[a-z]/i.test(js[i]))i++;prev='/';continue;}
    if(!/\s/.test(c))prev=c;i++;
  }
  return out;
}
/** Texto de JSX/TSX entre etiquetas (Remotion): <h1>La IA</h1>. */
function textoJSX(src){return [...src.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)</g)].map(m=>m[1]);}
/** El texto que se ve: texto de los elementos + strings de los <script>. Sin comentarios, CSS ni atributos. */
export function textoEnPantalla(html){
  let s=html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
  const scripts=[];s=s.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi,(_,js)=>{scripts.push(...stringsJS(js));return ' ';});
  const texto=s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ');
  const pegado=s.replace(/<\/?(?:span|b|i|em|strong|u|mark|sup|sub)\b[^>]*>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ');  // letras partidas en spans
  return [texto,...scripts,'\u0000',pegado,...scripts].join('\n').replace(/[ \t]+/g,' ');
}
function textoVoz(base){
  const f=variant(base)?.transcript?.file;const p=f?resolve(base,f):null;if(!p||!existsSync(p))return '';
  if(!/\.json$/i.test(p))return readFileSync(p,'utf8');
  // Palabras si las hay; si no, el texto por segmento. Así un whisper con las dos cosas no cuenta la voz dos veces.
  const pal=[],seg=[];const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(['t','word','punctuated_word'].includes(k)&&typeof x==='string')pal.push(x);else if(k==='text'&&typeof x==='string')seg.push(x);else walk(x);}};
  walk(leer(p));return (pal.length?pal:seg).join(' ');
}
function raices(base){
  const rs=[];
  const entry=entryPath(base);  // la variante activa (revisión del 2-nov: antes leía siempre la raíz)
  if(existsSync(entry))rs.push(entry);
  const sc=join(base,'scenes');if(existsSync(sc))for(const d of readdirSync(sc).sort()){const f=join(sc,d,'index.html');if(existsSync(f))rs.push(f);}
  return rs;
}
const contexto=(s,i,n)=>s.slice(Math.max(0,i-30),i+n+30).replace(/\s+/g,' ').trim();

/** Reglas automatizables de la persona sobre un proyecto. [{id, ok, detalle}] */
export function revisarCliente(base,reglas){
  const rs=raices(base);if(!rs.length)throw Error('Todavía no hay composición que revisar');
  const cfg=variant(base),faltan=[];
  const g=inputGraph(base,{roots:rs,hash:false,assetBase:masterDir(base),publicDir:cfg?.publicDir||'public',faltantes:faltan});
  const archivos=g.inputs.map(f=>resolve(base,f));
  const pantalla=archivos.filter(f=>/\.(html?|m?js|cjs|jsx|tsx?)$/i.test(f)).map(f=>{const src=readFileSync(f,'utf8');return {f,t:/\.html?$/i.test(f)?textoEnPantalla(src):[...stringsJS(src),...(/\.[jt]sx$/i.test(f)?textoJSX(src):[])].join('\n')};});
  const out=[];
  for(const r of reglas){
    const c=r.chequeo||{};
    if(c.tipo==='texto-prohibido'){
      const re=new RegExp(c.patron,'g');const hits=[];
      for(const {f,t} of pantalla){
        const vistas=t.split('\u0000');const porVista=vistas.map(v=>[...v.matchAll(re)].map(m=>`${relative(base,f)}: «${contexto(v,m.index,m[0].length)}»`));
        hits.push(...porVista.reduce((a,b)=>b.length>a.length?b:a,[]));  // la vista normal o la de letras pegadas, la que vea más
      }
      const enVoz=[...textoVoz(base).matchAll(re)].length;
      const ok=hits.length<=enVoz;
      out.push({id:r.id,ok,detalle:!hits.length?`sin «${c.patron}» en pantalla`:ok?`${hits.length} en pantalla y ${enVoz} en la voz: son subtítulos de lo que dice (se transcribe tal cual)`:`${hits.length} en pantalla y ${enVoz} en la voz → ${hits.length-enVoz} de más: ${hits.slice(0,6).join(' · ')}`});
    }else if(c.tipo==='recurso-vetado'){
      const pats=(c.patrones||[c.patron]).filter(Boolean).map(p=>p.toLowerCase());const hits=[];
      const indices=new Map();
      // El corte: lo que se concatenó en cut.mp4 no aparece en la composición (Cloudflare: bloque 1 = hook-walter.mp4).
      const src=cfg?.source?.file?resolve(base,cfg.source.file):null;
      const cortes=[...new Set([src&&join(dirname(src),'cut.json'),join(base,'local/cut.json'),join(masterDir(base),'local/cut.json')].filter(f=>f&&existsSync(f)))];
      if(src){const p=pats.find(q=>relative(base,src).toLowerCase().includes(q));if(p)hits.push(`fuente ${relative(base,src)} (nombre: ${p})`);}
      for(const cj of cortes){let b=[];try{b=leer(cj).bloques||[];}catch{}for(const x of b){const o=String(x.archivo||'');const p=pats.find(q=>o.toLowerCase().includes(q));if(p)hits.push(`${relative(base,cj)}: bloque ${x.fuente||'?'} ← ${o} (origen: ${p})`);}}
      for(const x of faltan){const p=pats.find(q=>x.ref.toLowerCase().includes(q));if(p)hits.push(`${x.ref} (referencia desde ${x.desde}; nombre: ${p})`);}
      for(const f of archivos){
        const rel=relative(base,f);
        if(/\.(html?|css|m?js|cjs|jsx|tsx?|json|md|txt|py|tpl)$/i.test(rel))continue;  // un archivo de código que se llama como el clip no es el clip
        const p=pats.find(x=>rel.toLowerCase().includes(x));if(p){hits.push(`${rel} (nombre: ${p})`);continue;}
        const ix=join(dirname(f),'INDEX.json');
        if(!indices.has(ix))indices.set(ix,existsSync(ix)?(()=>{try{return leer(ix);}catch{return null;}})():null);
        const origen=indices.get(ix)?.[basename(f,extname(f))];
        const o=typeof origen==='string'?origen:origen?JSON.stringify(origen):'';
        const q=pats.find(x=>o.toLowerCase().includes(x));if(q)hits.push(`${rel} ← ${o} (origen: ${q})`);
      }
      out.push({id:r.id,ok:!hits.length,detalle:hits.length?`usa material vetado: ${hits.join(' · ')}`:`ningún archivo vetado entre los ${archivos.length} que usa${faltan.length?` (+${faltan.length} referencias que no son rutas directas, revisadas por nombre)`:''}`});
    }
  }
  return out;
}

/** Para el router: ok · pendiente (no hay composición) · error. */
export function estado(base){
  const cfg=config(base);if(!cfg)throw Error('Sin pipeline.json');
  const cli=loadCliente(cfg.brand);if(!cli)return {ok:true,resumen:`la marca ${cfg.brand} no tiene archivo de cliente`};
  const auto=reglasCliente(cli).filter(r=>['texto-prohibido','recurso-vetado'].includes(r.chequeo?.tipo));
  if(cfg.pitchRequerido!==true)return {ok:true,resumen:`proyecto anterior al chequeo: no se exige (auditar: node tools/cliente-check.mjs ${projectSlug(base)})`};
  let r;try{r=revisarCliente(base,auto);}catch(e){return {ok:false,pendiente:true,resumen:e.message};}
  const mal=r.filter(x=>!x.ok);
  return {ok:!mal.length,resumen:mal.length?mal.map(x=>`${x.id} ${x.detalle}`).join(' · '):`${r.map(x=>x.id).join(', ')} ok`};
}

if(isMain(import.meta.url)){
  try{
    const a=process.argv.slice(2);const base=resolveProject(a.find(x=>!x.startsWith('--')));const cfg=config(base);
    const cli=loadCliente(cfg?.brand);if(!cli){console.log(`· la marca ${cfg?.brand} no tiene archivo de cliente`);process.exit(0);}
    const r=revisarCliente(base,reglasCliente(cli));
    if(a.includes('--json'))console.log(JSON.stringify(r,null,2));else for(const x of r)console.log(`${x.ok?'✓':'✗'} ${x.id} · ${x.detalle}`);
    process.exitCode=r.every(x=>x.ok)?0:1;
  }catch(e){console.error(`✗ ${e.message}`);process.exitCode=1;}
}
