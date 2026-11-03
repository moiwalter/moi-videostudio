#!/usr/bin/env node
/**
 * capas.mjs — las capas de un video, de la más general a la más específica, y de dónde salió cada valor.
 *
 *   motor → formato (styles/<id>) → marca (biblioteca/marcas) → cliente (biblioteca/clientes) → episodio (pipeline.json)
 *
 * POR QUÉ EXISTE (1-nov-2026, Walter): el mismo formato tiene que servirle a Chris y a Moi cambiando color, velocidad y
 * ritmo del hook, y las reglas de una persona (Chris: el inglés va en inglés, «AI» nunca «IA») no pueden vivir mezcladas
 * con la marca ni con las reglas de todos. Antes la marca de Chris traía reglas generales adentro y se copiaban a cada
 * proyecto sin decir de dónde venían.
 *
 * REGLAS
 *   - Gana la capa más específica. Cada valor resuelto lleva su `origen` (archivo + capa).
 *   - Una perilla sólo existe si el FORMATO la declara. Una capa que ajusta una perilla que el formato no tiene es un
 *     error (así un typo no se vuelve un valor que nadie usa).
 *   - Las perillas no se inventan: su `default` se mide en un video aprobado y lo dice en `medido`.
 *
 * USO
 *   node tools/capas.mjs <proyecto> [--json]          resuelve las capas de un proyecto registrado
 *   node tools/capas.mjs --marca cvander --estilo moderno-limpio [--json]
 */
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT,isMain,resolveProject,config} from './project.mjs';
import {loadStyle} from './style.mjs';

const MARCAS=join(ROOT,'biblioteca/marcas'), CLIENTES=join(ROOT,'biblioteca/clientes');
const rel=p=>p.startsWith(ROOT+'/')?p.slice(ROOT.length+1):p;
const leer=p=>JSON.parse(readFileSync(p,'utf8'));

export function loadMarca(id){const p=join(MARCAS,`${id}.json`);if(!existsSync(p))throw Error(`Marca desconocida: ${id}`);return {datos:leer(p),archivo:rel(p)};}

/** El cliente de una marca: el archivo de biblioteca/clientes cuyo `marca` (o `id`) coincide. null si no hay. */
export function loadCliente(marca){
  if(!existsSync(CLIENTES))return null;
  const hits=readdirSync(CLIENTES).filter(f=>f.endsWith('.json')).map(f=>({archivo:rel(join(CLIENTES,f)),datos:leer(join(CLIENTES,f))})).filter(c=>c.datos.marca===marca||c.datos.id===marca);
  if(hits.length>1)throw Error(`Más de un cliente para la marca ${marca}: ${hits.map(h=>h.archivo).join(', ')}`);
  return hits[0]||null;
}

/** Reglas del cliente como una lista plana (las de sus series van con su serie). */
export function reglasCliente(c){
  if(!c)return [];
  const base=(c.datos.reglas||[]).map(r=>({...r,serie:null}));
  const series=Object.entries(c.datos.series||{}).flatMap(([s,v])=>(v.reglas||[]).map(r=>({...r,serie:s})));
  return [...base,...series];
}

function valida(nombre,p,valor){
  if(p.opciones&&!p.opciones.includes(valor))return `${nombre}=${JSON.stringify(valor)} no está en ${JSON.stringify(p.opciones)}`;
  if(p.rango){if(typeof valor!=='number')return `${nombre} tiene que ser un número`;if(valor<p.rango[0]||valor>p.rango[1])return `${nombre}=${valor} fuera de [${p.rango.join(', ')}]`;}
  return null;
}

/** El contrato de las perillas de un formato. Devuelve la lista de errores (vacía = bien). */
export function validarPerillas(style){
  const errs=[];
  for(const [k,p] of Object.entries(style.perillas||{})){
    if(!p.que)errs.push(`${k}: falta "que" (qué cambia en pantalla)`);
    if(!('default' in p))errs.push(`${k}: falta "default"`);
    if(!p.opciones&&!p.rango)errs.push(`${k}: falta "opciones" o "rango"`);
    if(!p.medido)errs.push(`${k}: falta "medido" (en qué video aprobado se midió el default)`);
    if('default' in p){const e=valida(k,p,p.default);if(e)errs.push(`default: ${e}`);}
  }
  return errs;
}

/**
 * Resuelve las perillas: default del formato, y encima cada capa en orden (la última gana).
 * capas = [{capa:'marca', archivo, valores:{perilla:valor}}, …]
 */
export function resolverPerillas(style,capas=[]){
  const decl=style.perillas||{}, out={};
  const e0=validarPerillas(style);if(e0.length)throw Error(`El formato ${style.id} tiene perillas mal declaradas:\n  ${e0.join('\n  ')}`);
  for(const [k,p] of Object.entries(decl))out[k]={valor:p.default,origen:`formato ${style.id}`,que:p.que};
  for(const c of capas){
    for(const [k,v] of Object.entries(c.valores||{})){
      if(!decl[k])throw Error(`${c.capa} (${c.archivo}) ajusta "${k}", que el formato ${style.id} no tiene. Perillas: ${Object.keys(decl).join(', ')||'(ninguna)'}`);
      const e=valida(k,decl[k],v);if(e)throw Error(`${c.capa} (${c.archivo}): ${e}`);
      out[k]={valor:v,origen:`${c.capa} ${c.archivo}`,que:decl[k].que};
    }
  }
  return out;
}

/** Las perillas que una marca o un cliente ajustan para ESTE formato: `perillas: {"<estilo>": {…}, "*": {…}}`. */
const ajustes=(datos,styleId)=>({...(datos?.perillas?.['*']||{}),...(datos?.perillas?.[styleId]||{})});

/** Todas las capas resueltas. episodio = {archivo, perillas, direccion} del proyecto, si hay. */
export function resolverCapas({marca,estilo,episodio=null,motor=null}){
  const m=loadMarca(marca);
  const styleId=estilo||m.datos.estiloPorDefecto;
  if(!styleId)throw Error(`Sin formato: el proyecto no declara style y la marca ${marca} no tiene estiloPorDefecto`);
  const st=loadStyle(styleId), cli=loadCliente(marca);
  const capas=[{capa:'marca',archivo:m.archivo,valores:ajustes(m.datos,styleId)}];
  if(cli)capas.push({capa:'cliente',archivo:cli.archivo,valores:ajustes(cli.datos,styleId)});
  if(episodio)capas.push({capa:'episodio',archivo:episodio.archivo,valores:episodio.perillas||{}});
  return {
    motor,
    formato:{id:st.id,version:st.version,label:st.label,origen:estilo?'proyecto':`marca ${m.archivo} (estiloPorDefecto)`,principios:st.principles,escenas:st.escenas||null},
    perillas:resolverPerillas(st,capas),
    marca:{id:marca,archivo:m.archivo,subtitulos:m.datos.subtitulos||null,encuadre:m.datos.encuadre||null},
    cliente:cli?{id:cli.datos.id,archivo:cli.archivo,reglas:reglasCliente(cli)}:null,
    episodio:episodio?{archivo:episodio.archivo,direccion:episodio.direccion??null}:null,
    reglas:'pipeline/docs/REGLAS.md',
  };
}

export function capasProyecto(needle){
  const base=resolveProject(needle), cfg=config(base);
  if(!cfg)throw Error(`El proyecto ${needle} no tiene pipeline.json`);
  const bp=join(base,'master/BRIEF.json'), brief=existsSync(bp)?leer(bp):null;
  return resolverCapas({marca:cfg.brand,estilo:cfg.style,motor:cfg.engine?`${cfg.engine.name}@${cfg.engine.version}`:null,
    episodio:{archivo:rel(join(base,'pipeline.json')),perillas:cfg.perillas||{},direccion:brief?.direccion?.angulo??null}});
}

/** El bloque de cliente que va en el brief de un agente. */
export function clienteBrief(c){
  if(!c)return '';
  const rs=reglasCliente(c);
  return [`CLIENTE: ${c.datos.persona||c.datos.id} — reglas de esta persona (${c.archivo}):`,
    ...rs.map(r=>`  · ${r.id}${r.serie?` [serie ${r.serie}]`:''} ${r.regla}${r.chequeo?.tipo&&r.chequeo.tipo!=='manual'?` [chequeo: ${r.chequeo.tipo}]`:''}`),
    ...Object.entries(c.datos.guias||{}).filter(([k])=>!k.startsWith('_')).map(([k,v])=>`  guía ${k}: ${v}`)].join('\n');
}

export function texto(r){
  const L=[];
  if(r.motor)L.push(`MOTOR      ${r.motor}`);
  L.push(`FORMATO    ${r.formato.label} (${r.formato.id}@${r.formato.version})  ← ${r.formato.origen}`);
  const ks=Object.entries(r.perillas);
  L.push(ks.length?'PERILLAS':'PERILLAS   (este formato todavía no declara perillas)');
  for(const [k,v] of ks)L.push(`  ${k} = ${JSON.stringify(v.valor)}  ← ${v.origen}   (${v.que})`);
  L.push(`MARCA      ${r.marca.id}  ← ${r.marca.archivo}`);
  if(r.marca.encuadre?.[r.formato.id])L.push(`  encuadre de ${r.formato.id}: ${JSON.stringify(Object.fromEntries(Object.entries(r.marca.encuadre[r.formato.id]).filter(([k])=>!k.startsWith("_"))))}`);
  if(r.marca.subtitulos)L.push(`  subtítulos (identidad): ${r.marca.subtitulos.fuente} ${r.marca.subtitulos.peso}, tracking ${r.marca.subtitulos.tracking}; énfasis ${JSON.stringify(r.marca.subtitulos.enfasis)}`);
  if(r.cliente){L.push(`CLIENTE    ${r.cliente.id}  ← ${r.cliente.archivo}`);for(const x of r.cliente.reglas)L.push(`  ${x.id}${x.serie?` [${x.serie}]`:''} ${x.regla}`);}
  else L.push('CLIENTE    (sin archivo de cliente para esta marca)');
  if(r.episodio)L.push(`EPISODIO   ← ${r.episodio.archivo}${r.episodio.direccion?`\n  dirección: ${r.episodio.direccion}`:''}`);
  L.push(`REGLAS     ${r.reglas} (valen para todo video)`);
  return L.join('\n');
}

if(isMain(import.meta.url)){
  try{
    const a=process.argv.slice(2), val=n=>{const i=a.indexOf(n);return i<0?null:a[i+1];};
    const r=val('--marca')?resolverCapas({marca:val('--marca'),estilo:val('--estilo')}):capasProyecto(a.find((x,i)=>!x.startsWith('--')&&!['--marca','--estilo'].includes(a[i-1])));
    console.log(a.includes('--json')?JSON.stringify(r,null,2):texto(r));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
