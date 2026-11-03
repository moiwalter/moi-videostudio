import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from './project.mjs';
import {resolverPerillas,validarPerillas,resolverCapas,loadCliente,reglasCliente} from './capas.mjs';
import {loadStyle} from './style.mjs';

const fmt={id:'prueba',perillas:{
  ritmoHook:{que:'segundos hasta el primer cambio',default:2,rango:[0.5,6],medido:'video de prueba'},
  acento:{que:'color del acento',default:'marca',opciones:['marca','neutro'],medido:'video de prueba'}}};

test('perillas: gana la capa más específica y cada valor dice de dónde salió',()=>{
  const r=resolverPerillas(fmt,[
    {capa:'marca',archivo:'m.json',valores:{ritmoHook:3}},
    {capa:'cliente',archivo:'c.json',valores:{acento:'neutro'}},
    {capa:'episodio',archivo:'e.json',valores:{ritmoHook:1.5}}]);
  assert.deepEqual(r.ritmoHook,{valor:1.5,origen:'episodio e.json',que:'segundos hasta el primer cambio'});
  assert.equal(r.acento.origen,'cliente c.json');
  assert.equal(resolverPerillas(fmt).ritmoHook.origen,'formato prueba');
});

test('perillas: una capa no puede inventar una perilla ni salirse del rango',()=>{
  assert.throws(()=>resolverPerillas(fmt,[{capa:'marca',archivo:'m.json',valores:{velocidad:2}}]),/no tiene/);
  assert.throws(()=>resolverPerillas(fmt,[{capa:'episodio',archivo:'e.json',valores:{ritmoHook:9}}]),/fuera de/);
  assert.throws(()=>resolverPerillas(fmt,[{capa:'episodio',archivo:'e.json',valores:{acento:'rojo'}}]),/no está en/);
});

test('perillas: un default sin medición no entra',()=>{
  const sin={id:'x',perillas:{a:{que:'q',default:1,rango:[0,2]}}};
  assert.match(validarPerillas(sin).join(),/medido/);
  assert.throws(()=>resolverPerillas(sin),/mal declaradas/);
});

test('todos los formatos del pipeline declaran sus perillas bien',()=>{
  for(const id of readdirSync(join(ROOT,'pipeline/styles')))assert.deepEqual(validarPerillas(loadStyle(id)),[],id);
});

test('todo formato tiene perillas: al menos el ritmo (hook, mediana) y los subtítulos si los tiene',()=>{
  /* 2-nov-2026, Walter: «todos deberían tener perillas. Si es algo bueno, todos deberían tener». */
  for(const id of readdirSync(join(ROOT,'pipeline/styles'))){
    const p=loadStyle(id).perillas||{};
    assert.ok(Object.keys(p).length>=4,`${id}: tiene ${Object.keys(p).length} perillas`);
    for(const k of ['duracionHook','duracionEscena'])assert.ok(p[k],`${id}: falta ${k}`);
  }
});

test('archivos de cliente: cada regla tiene id único, texto y fuente',()=>{
  const dir=join(ROOT,'biblioteca/clientes');
  for(const f of readdirSync(dir).filter(f=>f.endsWith('.json'))){
    const c={archivo:f,datos:JSON.parse(readFileSync(join(dir,f),'utf8'))};
    const rs=reglasCliente(c),ids=rs.map(r=>r.id);
    assert.equal(new Set(ids).size,ids.length,`${f}: ids repetidos`);
    for(const r of rs){assert.ok(r.regla?.trim(),`${f} ${r.id}: sin regla`);assert.ok(r.fuente?.length,`${f} ${r.id}: sin fuente`);}
  }
});

test('capas de Chris: marca sin reglas generales, cliente con las suyas',()=>{
  const r=resolverCapas({marca:'cvander'});
  assert.equal(r.formato.id,'layered-talking-head');            // estiloPorDefecto de la marca
  assert.match(r.formato.origen,/estiloPorDefecto/);
  assert.equal(r.marca.subtitulos.fuente,'Rubik');
  const ids=r.cliente.reglas.map(x=>x.id);
  for(const id of ['C01','C04','C05','C06'])assert.ok(ids.includes(id),id);
  assert.equal(loadCliente('moi'),null);
});

test('brief de agente: Chris trae su cliente y las REGLAS; Moi no hereda nada de Chris',()=>{
  const run=(...a)=>spawnSync(process.execPath,[join(ROOT,'pipeline/tools/brand.mjs'),'brief',...a],{encoding:'utf8'});
  const c=run('cvander');assert.equal(c.status,0,c.stderr);
  assert.match(c.stdout,/layered-talking-head/);
  assert.match(c.stdout,/C04 En pantalla siempre «AI»/);
  assert.match(c.stdout,/REGLAS DEL PIPELINE/);
  assert.doesNotMatch(c.stdout,/sustituir logos de producto/);    // pasó a REGLAS V13
  assert.doesNotMatch(run('cvander','moderno-limpio').stdout,/Encuadre de referencia/); // el de 0910 es del formato layered
  const m=run('moi','moi-overlay');assert.equal(m.status,0);
  assert.doesNotMatch(m.stdout,/CLIENTE:|Rubik|«AI»/);
});
