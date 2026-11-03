#!/usr/bin/env node
/**
 * perillas.mjs — que la composición LEA las perillas y que un chequeo MIDA si el video las cumple.
 *
 * POR QUÉ (2-nov-2026, Walter): las perillas estaban medidas y resueltas por capas, pero ninguna composición las usaba:
 * los números seguían escritos a mano en cada plantilla. «No quiero que eso no esté probado antes de subir al repo.»
 *
 * DOS PIEZAS
 *   1. Lectura. `--escribir` deja junto a la composición activa (respeta la variante):
 *        perillas.js   window.PERILLAS = {barrido: .34, …}   (para la animación)
 *        perillas.css  :root{--subtitulos-tamano:62px; …} y [data-perilla="subtitulos"]{font-size, text-align}
 *      Son GENERADOS: si alguien cambia una perilla y no regenera, o edita el archivo a mano, queda BLOQUEADO.
 *      La composición marca su caja de subtítulos con data-perilla="subtitulos".
 *   2. Medida. Del mapa de escenas (BEATS.json, en sus tres esquemas: {start,end}, {t,e}, {s,e}) salen hook, cambios en los primeros 10 s
 *      (el hook cuenta), mediana por escena y escenas más cortas que el mínimo. Fuera del rango que el formato admite
 *      = AVISO, nunca bloqueo: cada perilla se midió en uno o dos videos y el criterio sigue siendo de Walter.
 *      `--navegador` abre la composición en Chrome y mide el tamaño REAL de los subtítulos: un tamaño escrito a mano
 *      encima de la perilla queda BLOQUEADO.
 *   Lo que no se puede medir del mapa (escala de la placa, color…) se pasa a la composición y el reporte lo lista
 *   como «sin medir», no como chequeado.
 *
 * Calibración: los videos aprobados donde se midió cada formato dan verde (perillas.test.mjs). Un proyecto anterior
 * (sin pitchRequerido) no tiene que cargar los archivos: lo entregado no se rehace.
 *
 * USO
 *   node tools/perillas.mjs <proyecto>                 reporte
 *   node tools/perillas.mjs <proyecto> --escribir      genera perillas.js + perillas.css
 *   node tools/perillas.mjs <proyecto> --check         0 = lee las perillas al día (los AVISOS no fallan)
 *   node tools/perillas.mjs <proyecto> --navegador     además mide en Chrome
 *   [--formato <id>] mide contra otro formato · [--json]
 */
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {resolveProject,isMain,variant} from './project.mjs';
import {resolverCapas} from './capas.mjs';
import {loadStyle} from './style.mjs';

const leer=p=>JSON.parse(readFileSync(p,'utf8'));
const r2=n=>Math.round(n*1000)/1000;
const kebab=k=>k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
const ALINEA={izquierda:'left',centro:'center',derecha:'right'};

/* ── el mapa ─────────────────────────────────────────────────────────────────────────── */
/** Escenas de un BEATS.json en cualquiera de los dos esquemas: beats[{start,end}] o escenas[{t,e}] (optimismo). */
export function escenasDelMapa(map){
  const a=map?.beats||map?.escenas;
  if(!Array.isArray(a)||!a.length)throw Error('El mapa no tiene escenas (beats[] o escenas[])');
  return a.map(x=>{const start=x.start??x.t??x.s,end=x.end??x.e;
    if(typeof start!=='number'||typeof end!=='number')throw Error(`Escena ${x.id??'?'} sin inicio o fin numérico`);
    return {id:x.id,start,end};});
}
/** Una sola definición de cada medida. */
export function medirMapa(esc){
  const d=esc.map(x=>x.end-x.start), s=[...d].sort((a,b)=>a-b), n=s.length;
  return {
    duracionHook:r2(d[0]),
    cambiosPrimeros10s:esc.filter(x=>x.start<10).length,           // el hook cuenta (2-nov: layered y moderno medían distinto)
    duracionEscena:r2(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2),
    cortas:min=>esc.filter(x=>x.end-x.start<min-1e-9).map(x=>({id:x.id,dur:r2(x.end-x.start)})),
  };
}

/* ── las capas de este proyecto (variante activa incluida) ───────────────────────────── */
function contexto(base,opts={}){const formato=opts.formato||null;
  const v=variant(base);if(!v)throw Error('El proyecto no tiene pipeline.json');
  const capas=resolverCapas({marca:v.brand,estilo:formato||v.style,episodio:{archivo:'pipeline.json',perillas:v.perillas||{}}});
  return {v,capas,dir:dirname(resolve(base,v.engine.entry)),entry:resolve(base,v.engine.entry),
    map:resolve(base,v.paths?.map||'master/BEATS.json'),requerido:v.pitchRequerido===true,style:opts.estilo||loadStyle(capas.formato.id)};   // opts.estilo: sólo para las evals
}

/* ── 1. lectura ──────────────────────────────────────────────────────────────────────── */
function valorCSS(k,v){if(k==='subtitulosTamano')return `${v}px`;if(k==='subtitulosAlineacion')return ALINEA[v]||v;return String(v);}
export function generar(base,opts={}){
  const {capas}=contexto(base,opts), P=capas.perillas, ks=Object.keys(P);
  const cab=`GENERADO por pipeline/tools/perillas.mjs desde las capas de ${capas.formato.id} — no editar a mano: cambia la perilla y corre --escribir.`;
  const valores=Object.fromEntries(ks.map(k=>[k,P[k].valor]));
  const js=`/* ${cab}\n${ks.map(k=>`   ${k} ← ${P[k].origen}`).join('\n')} */\nwindow.PERILLAS=Object.freeze(${JSON.stringify(valores,null,2)});\n`;
  const sub=ks.includes('subtitulosTamano')||ks.includes('subtitulosAlineacion');
  const css=`/* ${cab} */\n:root{\n${ks.map(k=>`  --${kebab(k)}: ${valorCSS(k,P[k].valor)};`).join('\n')}\n}\n`+
    (sub?`[data-perilla="subtitulos"]{${ks.includes('subtitulosTamano')?'font-size:var(--subtitulos-tamano);':''}${ks.includes('subtitulosAlineacion')?'text-align:var(--subtitulos-alineacion);':''}}\n`:'');
  return {js,css,valores};
}
export function escribir(base,opts={}){
  const {dir}=contexto(base,opts),g=generar(base,opts);
  writeFileSync(join(dir,'perillas.js'),g.js);writeFileSync(join(dir,'perillas.css'),g.css);
  return {dir,...g};
}
const cargado=(html,f)=>new RegExp(`(src|href)=["'](\\./)?${f.replace('.','\\.')}["']`).test(html);

function lectura(base,ctx,opts){
  if(!ctx.requerido)return {estado:'OK',detalle:'proyecto anterior a las perillas: sus valores están escritos en su plantilla (no se rehace trabajo hecho)'};
  if(!existsSync(ctx.entry))return {estado:'NO VERIFICABLE',detalle:`falta la composición ${ctx.v.engine.entry}`};
  const html=readFileSync(ctx.entry,'utf8');
  const fj=join(ctx.dir,'perillas.js'),fc=join(ctx.dir,'perillas.css');
  if(!existsSync(fj)||!existsSync(fc))return {estado:'NO VERIFICABLE',detalle:'faltan perillas.js/perillas.css: node tools/perillas.mjs <proyecto> --escribir'};
  const falta=['perillas.js','perillas.css'].filter(f=>!cargado(html,f));
  if(falta.length)return {estado:'NO VERIFICABLE',detalle:`la composición no carga ${falta.join(' ni ')}: los valores siguen escritos a mano`};
  const g=generar(base,opts);
  if(readFileSync(fj,'utf8')!==g.js||readFileSync(fc,'utf8')!==g.css){
    let viejo={};try{viejo=JSON.parse(readFileSync(fj,'utf8').match(/window\.PERILLAS=Object\.freeze\((\{[\s\S]*?\})\);/)[1]);}catch{}
    const dif=Object.keys(g.valores).filter(k=>JSON.stringify(viejo[k])!==JSON.stringify(g.valores[k])).map(k=>`${k}: ${JSON.stringify(viejo[k])} → ${JSON.stringify(g.valores[k])}`);
    return {estado:'BLOQUEADO',detalle:`perillas.js/css no coinciden con las capas (${dif.join(' · ')||'editado a mano'}): regenerar con --escribir`};
  }
  return {estado:'OK',detalle:`la composición carga perillas.js + perillas.css al día (${Object.keys(g.valores).length} perillas)`};
}

/* ── 2. medida ───────────────────────────────────────────────────────────────────────── */
const MEDIBLES=['duracionHook','cambiosPrimeros10s','duracionEscena'];
export function revisarPerillas(base,opts={}){
  const ctx=contexto(base,opts), decl=ctx.style.perillas||{}, P=ctx.capas.perillas;
  const lec=lectura(base,ctx,opts), medidas=[];
  if(!Object.keys(decl).length)return {formato:ctx.capas.formato.id,lectura:lec,medidas,sinMedir:[],resumen:`el formato ${ctx.capas.formato.id} no declara perillas: no hay nada que medir`};
  let m=null,sinMapa=null;
  if(existsSync(ctx.map)){try{m=medirMapa(escenasDelMapa(leer(ctx.map)));}catch(e){sinMapa=e.message;}}else sinMapa='sin mapa de escenas todavía';
  if(m){
    for(const k of MEDIBLES.filter(k=>decl[k])){
      const [lo,hi]=decl[k].rango, x=m[k], dentro=x>=lo-1e-9&&x<=hi+1e-9;
      medidas.push({perilla:k,estado:dentro?'OK':'AVISO',medido:x,valor:P[k].valor,detalle:`medido ${x} (perilla ${P[k].valor}; el formato admite ${lo}–${hi})`});
    }
    if(decl.minimoRecurso){const c=m.cortas(P.minimoRecurso.valor);
      medidas.push({perilla:'minimoRecurso',estado:c.length?'AVISO':'OK',medido:c.length,valor:P.minimoRecurso.valor,
        detalle:c.length?`${c.length} escena(s) bajo ${P.minimoRecurso.valor} s: ${c.map(x=>`${x.id} ${x.dur}`).join(' · ')} — si es un recurso de lectura, alargar o sacar; si es un golpe, va`:`ninguna escena bajo ${P.minimoRecurso.valor} s`});}
  }
  const medidasK=new Set(medidas.map(x=>x.perilla));
  const sinMedir=Object.keys(decl).filter(k=>!medidasK.has(k)&&!['subtitulosTamano','subtitulosAlineacion'].includes(k));
  const av=medidas.filter(x=>x.estado!=='OK');
  const resumen=[sinMapa,`${medidas.length-av.length}/${medidas.length} medidas dentro del formato`,av.length?`avisos: ${av.map(x=>x.perilla).join(', ')}`:null].filter(Boolean).join(' · ');
  return {formato:ctx.capas.formato.id,lectura:lec,medidas,sinMedir,resumen};
}

/** Para el router: ok · pendiente (NO VERIFICABLE) · error (BLOQUEADO). Los AVISOS de medida no cambian el estado. */
export function estado(base,opts={}){
  const r=revisarPerillas(base,opts);
  return {ok:r.lectura.estado==='OK',pendiente:r.lectura.estado==='NO VERIFICABLE',resumen:`${r.lectura.detalle} · ${r.resumen}`,avisos:r.medidas.filter(x=>x.estado==='AVISO')};
}

/* ── en el navegador: lo que de verdad se pinta ──────────────────────────────────────── */
export async function medirEnNavegador(base,opts={}){
  const ctx=contexto(base,opts),P=ctx.capas.perillas;
  if(!P.subtitulosTamano)return {estado:'OK',detalle:'el formato no tiene perilla de subtítulos'};
  let puppeteer=null;try{puppeteer=(await import(createRequire(import.meta.url).resolve('puppeteer-core'))).default;}catch{}
  const cache=resolve(process.env.HOME,'.cache/puppeteer/chrome'), build=existsSync(cache)?readdirSync(cache).sort().pop():null;
  const CHROME=build&&resolve(cache,build,'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  if(!puppeteer||!CHROME||!existsSync(CHROME))return {estado:'NO VERIFICABLE',sinNavegador:true,detalle:'sin puppeteer-core/Chrome: no puedo medir en el navegador'};
  const esperado=generar(base,opts).valores;
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
  try{
    const pg=await b.newPage();await pg.goto(pathToFileURL(ctx.entry).href,{waitUntil:'load',timeout:30000});
    await new Promise(r=>setTimeout(r,300));
    const x=await pg.evaluate(()=>({P:window.PERILLAS||null,
      subs:[...document.querySelectorAll('[data-perilla="subtitulos"]')].map(e=>{const s=getComputedStyle(e);return {fs:parseFloat(s.fontSize),ta:s.textAlign,exc:e.getAttribute('data-perilla-excepcion'),id:e.id||e.className||e.tagName};})}));
    const valoresIguales=JSON.stringify(x.P)===JSON.stringify(esperado);
    if(!valoresIguales)return {estado:'BLOQUEADO',valoresIguales,detalle:'window.PERILLAS en la página no coincide con las capas (¿no carga perillas.js o es viejo?)'};
    if(!x.subs.length)return {estado:'NO VERIFICABLE',valoresIguales,detalle:'ningún elemento con data-perilla="subtitulos": no sé dónde están los subtítulos'};
    const ta=ALINEA[P.subtitulosAlineacion?.valor];
    const mal=x.subs.filter(s=>!s.exc&&(Math.abs(s.fs-P.subtitulosTamano.valor)>0.5||(ta&&s.ta!==ta)));
    if(mal.length)return {estado:'BLOQUEADO',valoresIguales,tamano:mal[0].fs,detalle:`subtítulos pintados a ${mal.map(s=>`${s.fs}px ${s.ta}`).join(', ')}; la perilla dice ${P.subtitulosTamano.valor}px ${ta||''} — hay un tamaño escrito a mano encima`};
    return {estado:'OK',valoresIguales,tamano:x.subs.find(s=>!s.exc)?.fs??null,detalle:`${x.subs.length} caja(s) de subtítulos a ${P.subtitulosTamano.valor}px ${ta||''}${x.subs.some(s=>s.exc)?` · excepciones: ${x.subs.filter(s=>s.exc).map(s=>s.exc).join(', ')}`:''}`};
  }finally{await b.close();}
}

if(isMain(import.meta.url)){
  const a=process.argv.slice(2),val=n=>{const i=a.indexOf(n);return i<0?null:a[i+1];};
  try{
    const base=resolveProject(a.find((x,i)=>!x.startsWith('--')&&a[i-1]!=='--formato'));const opts={formato:val('--formato')};
    if(a.includes('--escribir')){const w=escribir(base,opts);console.log(`✓ perillas.js + perillas.css en ${w.dir} (${Object.keys(w.valores).length} perillas)`);}
    const r=revisarPerillas(base,opts);const nav=a.includes('--navegador')?await medirEnNavegador(base,opts):null;
    if(a.includes('--json'))console.log(JSON.stringify({...r,navegador:nav},null,2));
    else{
      console.log(`${r.lectura.estado==='OK'?'✓':'✗'} PERILLAS (${r.formato}) · ${r.lectura.detalle}`);
      for(const x of r.medidas)console.log(`  ${x.estado==='OK'?'✓':'·'} ${x.perilla}: ${x.detalle}`);
      if(r.sinMedir.length)console.log(`  sin medir (pasan a la composición): ${r.sinMedir.join(', ')}`);
      console.log(`  ${r.resumen}`);if(nav)console.log(`  ${nav.estado==='OK'?'✓':'✗'} navegador: ${nav.detalle}`);
    }
    if(a.includes('--check'))process.exitCode=(r.lectura.estado==='OK'&&(!nav||nav.estado!=='BLOQUEADO'))?0:1;
  }catch(e){console.error(`✗ ${e.message}`);process.exitCode=1;}
}
