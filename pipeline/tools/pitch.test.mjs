/* Evals del pitch (1-nov-2026). Se escribieron ANTES que pitch.mjs: definen cómo tiene que comportarse.
   El pitch: antes del mapa de escenas se proponen 2–3 caminos (un formato o una mezcla), cada uno con su porqué
   y frases REALES del corte; Walter elige y su decisión queda registrada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const PITCH=fileURLToPath(new URL('./pitch.mjs',import.meta.url));

function proyecto(t,{beats=null,nuevo=true}={}){
  const base=mkdtempSync(join(tmpdir(),'pitch-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
  mkdirSync(join(base,'master'),{recursive:true});
  writeFileSync(join(base,'pipeline.json'),JSON.stringify({schemaVersion:1,lane:'MASTER',brand:'cvander',style:'layered-talking-head',...(nuevo?{pitchRequerido:true}:{}),
    engine:{name:'hyperframes',version:'0',entry:'master/index.html',composition:'main'},transcript:{file:'t.json'}},null,2));
  writeFileSync(join(base,'t.json'),JSON.stringify({segments:[{text:' Probé seis herramientas esta semana'},{text:' y la que más me sorprendió fue Claude.'},{text:' Mira este tweet de Andrej Karpathy.'}]}));
  writeFileSync(join(base,'master/BRIEF.json'),JSON.stringify({marca:{slug:'cvander',existe:true},direccion:{tiene:false,angulo:null}}));
  if(beats)writeFileSync(join(base,'master/BEATS.json'),JSON.stringify({beats}));
  return base;
}
const run=(base,...a)=>spawnSync(process.execPath,[PITCH,base,...a],{encoding:'utf8'});
const caminos=(base,obj)=>{const f=join(base,'caminos.json');writeFileSync(f,JSON.stringify(obj));return f;};
const A={id:'A',nombre:'Recorte con recursos',formatos:['layered-talking-head'],base:'layered-talking-head',
  porque:'Opina sobre herramientas que se pueden mostrar',evidencia:[{t:0.4,frase:'Probé seis herramientas esta semana'}]};
const B={id:'B',nombre:'Layered + tweets reales',formatos:['layered-talking-head','moderno-limpio'],base:'layered-talking-head',
  reparto:'el tramo del tweet de Karpathy en moderno limpio; el resto layered',
  porque:'Nombra un tweet: moderno limpio lo muestra con el embed real',evidencia:[{t:6.1,frase:'Mira este tweet de Andrej Karpathy'}]};
const pitchDe=base=>JSON.parse(readFileSync(join(base,'master/BRIEF.json'),'utf8')).pitch;
const cfg=base=>JSON.parse(readFileSync(join(base,'pipeline.json'),'utf8'));

test('sin pitch, el check bloquea antes del mapa',t=>{
  const b=proyecto(t);const r=run(b,'--check');
  assert.equal(r.status,1);assert.match(r.stdout+r.stderr,/pitch/i);
});

test('se proponen 2 o 3 caminos, ni uno ni cuatro',t=>{
  const b=proyecto(t);
  let r=run(b,'--propuesta',caminos(b,{caminos:[A]}));assert.equal(r.status,1);assert.match(r.stderr,/2 o 3/);
  const C={...A,id:'C'},D={...A,id:'D'};
  r=run(b,'--propuesta',caminos(b,{caminos:[A,B,C,D]}));assert.equal(r.status,1);assert.match(r.stderr,/2 o 3/);
});

test('un formato que no existe se rechaza',t=>{
  const b=proyecto(t);
  const r=run(b,'--propuesta',caminos(b,{caminos:[A,{...B,formatos:['formato-inventado'],base:'formato-inventado'}]}));
  assert.equal(r.status,1);assert.match(r.stdout+r.stderr,/formato-inventado no existe/);
});

test('la base de una mezcla tiene que ser uno de sus formatos, y una mezcla dice el reparto',t=>{
  const b=proyecto(t);
  let r=run(b,'--propuesta',caminos(b,{caminos:[A,{...B,base:'micro-podcast'}]}));assert.equal(r.status,1);assert.match(r.stderr,/base micro-podcast/);
  const {reparto,...sinReparto}=B;
  r=run(b,'--propuesta',caminos(b,{caminos:[A,sinReparto]}));assert.equal(r.status,1);assert.match(r.stderr,/reparto/);
});

test('cada camino trae porqué y evidencia, y la evidencia tiene que estar en el corte (no se inventa)',t=>{
  const b=proyecto(t);
  let r0=run(b,'--propuesta',caminos(b,{caminos:[A,{...B,porque:''}]}));assert.equal(r0.status,1);assert.match(r0.stderr,/porqué/);
  r0=run(b,'--propuesta',caminos(b,{caminos:[A,{...B,evidencia:[]}]}));assert.equal(r0.status,1);assert.match(r0.stderr,/falta evidencia/);
  r0=run(b,'--propuesta',caminos(b,{caminos:[A,{...B,evidencia:[{t:2,frase:'Claude'}]}]}));assert.equal(r0.status,1);assert.match(r0.stderr,/al menos 3 palabras/);
  const r=run(b,'--propuesta',caminos(b,{caminos:[A,{...B,evidencia:[{t:6,frase:'esto nunca lo dijo'}]}]}));
  assert.equal(r.status,1);assert.match(r.stdout+r.stderr,/esto nunca lo dijo/);
  // mayúsculas, tildes y puntuación no cuentan
  assert.equal(run(b,'--propuesta',caminos(b,{caminos:[A,{...B,evidencia:[{t:2,frase:'la que mas me sorprendio fue claude'}]}]})).status,0);
});

test('una propuesta válida queda esperando la elección; el check sigue bloqueado',t=>{
  const b=proyecto(t);
  const r=run(b,'--propuesta',caminos(b,{caminos:[A,B]}));assert.equal(r.status,0,r.stderr);
  assert.equal(pitchDe(b).caminos.length,2);assert.equal(pitchDe(b).elegido,null);
  assert.equal(run(b,'--check').status,1);
});

test('elegir exige la decisión de Walter en sus palabras, y un camino que exista',t=>{
  const b=proyecto(t);run(b,'--propuesta',caminos(b,{caminos:[A,B]}));
  let r=run(b,'--elegir','B');assert.equal(r.status,1);assert.match(r.stderr,/decision/);
  r=run(b,'--elegir','Z','--decision','la Z');assert.equal(r.status,1);assert.match(r.stderr,/No existe el camino Z/);
  assert.equal(pitchDe(b).elegido,null);
});

test('elegir registra la decisión y deja el proyecto en el formato elegido',t=>{
  const b=proyecto(t);run(b,'--propuesta',caminos(b,{caminos:[A,B]}));
  const r=run(b,'--elegir','B','--decision','«la B, con los tweets»');assert.equal(r.status,0,r.stderr);
  const p=pitchDe(b);assert.equal(p.elegido.id,'B');assert.equal(p.elegido.decision,'«la B, con los tweets»');assert.ok(p.elegido.fecha);
  assert.equal(cfg(b).style,'layered-talking-head');
  assert.deepEqual(cfg(b).formatos,['layered-talking-head','moderno-limpio']);
  assert.equal(run(b,'--check').status,0);
});

test('elegir un camino de otro formato cambia el formato del proyecto',t=>{
  const b=proyecto(t);
  const M={...A,id:'M',formatos:['moderno-limpio'],base:'moderno-limpio'};
  run(b,'--propuesta',caminos(b,{caminos:[A,M]}));run(b,'--elegir','M','--decision','«moderno»');
  assert.equal(cfg(b).style,'moderno-limpio');assert.deepEqual(cfg(b).formatos,['moderno-limpio']);
});

test('con una mezcla, cada escena del mapa dice de qué formato es, y sólo de los elegidos',t=>{
  const ok=[{id:'S01',formato:'layered-talking-head'},{id:'S02',formato:'moderno-limpio'}];
  const b=proyecto(t,{beats:[{id:'S01',formato:'layered-talking-head'},{id:'S02'}]});
  run(b,'--propuesta',caminos(b,{caminos:[A,B]}));run(b,'--elegir','B','--decision','«la B»');
  let r=run(b,'--check');assert.equal(r.status,1);assert.match(r.stdout,/S02/);
  writeFileSync(join(b,'master/BEATS.json'),JSON.stringify({beats:[ok[0],{id:'S02',formato:'micro-podcast'}]}));
  r=run(b,'--check');assert.equal(r.status,1);assert.match(r.stdout,/micro-podcast/);
  writeFileSync(join(b,'master/BEATS.json'),JSON.stringify({beats:ok}));
  assert.equal(run(b,'--check').status,0);
});

test('un solo formato no obliga a marcar cada escena',t=>{
  const b=proyecto(t,{beats:[{id:'S01'},{id:'S02'}]});
  run(b,'--propuesta',caminos(b,{caminos:[A,B]}));run(b,'--elegir','A','--decision','«la A»');
  assert.equal(run(b,'--check').status,0);
});

test('un proyecto anterior al pitch no se bloquea, tenga o no mapa (no se rehace trabajo hecho)',t=>{
  for(const beats of [null,[{id:'S01'}]]){
    const b=proyecto(t,{beats,nuevo:false});
    const r=run(b,'--check');assert.equal(r.status,0);assert.match(r.stdout,/anterior al pitch/);
  }
});

test('un proyecto nuevo que armó el mapa sin pitch se bloquea',t=>{
  const b=proyecto(t,{beats:[{id:'S01'}]});
  assert.equal(run(b,'--check').status,1);
});

test('init-project marca los proyectos nuevos con pitchRequerido',t=>{
  const d=mkdtempSync(join(tmpdir(),'pitch-init-'));t.after(()=>rmSync(d,{recursive:true,force:true}));
  const r=spawnSync(process.execPath,[fileURLToPath(new URL('./init-project.mjs',import.meta.url)),d,'cvander','MASTER','hyperframes'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(cfg(d).pitchRequerido,true);
});

test('una propuesta nueva después de elegir guarda la anterior en el historial',t=>{
  const b=proyecto(t);run(b,'--propuesta',caminos(b,{caminos:[A,B]}));run(b,'--elegir','A','--decision','«la A»');
  run(b,'--propuesta',caminos(b,{caminos:[A,B]}));
  const p=pitchDe(b);assert.equal(p.elegido,null);assert.equal(p.historial.length,1);assert.equal(p.historial[0].elegido.id,'A');
  assert.equal(run(b,'--check').status,1);
});

test('sin transcript vinculado no se puede verificar la evidencia: se rechaza',t=>{
  const b=proyecto(t);const c=cfg(b);delete c.transcript;writeFileSync(join(b,'pipeline.json'),JSON.stringify(c));
  const r=run(b,'--propuesta',caminos(b,{caminos:[A,B]}));assert.equal(r.status,1);assert.match(r.stdout+r.stderr,/transcript/i);
});


test('el mapa se busca donde lo declara el proyecto (paths.map), no sólo en master/',t=>{
  const b=proyecto(t);const c=cfg(b);c.paths={map:'moderno/BEATS.json'};writeFileSync(join(b,'pipeline.json'),JSON.stringify(c));
  mkdirSync(join(b,'moderno'));writeFileSync(join(b,'moderno/BEATS.json'),JSON.stringify({beats:[{id:'S01'},{id:'S02',formato:'moderno-limpio'}]}));
  run(b,'--propuesta',caminos(b,{caminos:[A,B]}));run(b,'--elegir','B','--decision','«la B»');
  const r=run(b,'--check');assert.equal(r.status,1);assert.match(r.stdout,/S01/);
});

test('punta a punta: un proyecto nuevo de verdad queda frenado en el router hasta que Walter elige',t=>{
  const ROOT=fileURLToPath(new URL('../..',import.meta.url));
  const slug=`_test-pitch-${process.pid}`,dir=join(ROOT,'proyectos/cvander',slug,'edicion');
  t.after(()=>{rmSync(join(ROOT,'proyectos/cvander',slug),{recursive:true,force:true});spawnSync(process.execPath,['-e',`import('${new URL('./project.mjs',import.meta.url).href}').then(m=>m.refreshCatalog&&m.refreshCatalog())`]);});
  const sh=(cmd,args)=>spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8'});
  const nv=sh('bash',['tools/new-video.sh',slug,'--marca','cvander','--carril','master']);assert.equal(nv.status,0,nv.stderr);
  const fila=()=>{const r=sh(process.execPath,['tools/flujo.mjs',slug,'--rapido','--json']);return JSON.parse(r.stdout).ch.find(c=>c.nombre==='PITCH');};
  assert.equal(fila().estado,'NO VERIFICABLE');   // falta una decisión, no hay un error
  writeFileSync(join(dir,'t.json'),JSON.stringify({segments:[{text:'Probé seis herramientas esta semana y mira este tweet de Andrej Karpathy'}]}));
  const c=cfg(dir);c.transcript={file:'t.json'};writeFileSync(join(dir,'pipeline.json'),JSON.stringify(c,null,2));
  assert.equal(run(dir,'--propuesta',caminos(dir,{caminos:[A,B]})).status,0);
  assert.equal(fila().estado,'NO VERIFICABLE');
  run(dir,'--propuesta',caminos(dir,{caminos:[A,B]}));run(dir,'--elegir','B','--decision','«la B»');
  mkdirSync(join(dir,'master'),{recursive:true});writeFileSync(join(dir,'master/BEATS.json'),JSON.stringify({beats:[{id:'S01'}]}));
  assert.equal(fila().estado,'BLOQUEADO');           // mezcla con una escena sin formato: eso sí es un error
  rmSync(join(dir,'master/BEATS.json'));
  run(dir,'--propuesta',caminos(dir,{caminos:[A,B]}));
  assert.equal(run(dir,'--elegir','A','--decision','«la A»').status,0);
  const f=fila();assert.equal(f.estado,'OK');assert.match(f.detalle,/«la A»/);
});
