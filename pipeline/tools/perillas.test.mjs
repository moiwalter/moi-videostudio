/* perillas.test.mjs — evals de perillas.mjs, escritas ANTES del código (2-nov-2026).
   Walter: «no quiero que eso no esté probado antes de subir al repo».
   Dos promesas: (1) la composición RECIBE las perillas (perillas.js + perillas.css generados, nunca a mano);
   (2) un chequeo MIDE si el video las cumple. Y la calibración: los videos aprobados donde se midieron dan verde. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {ROOT,resolveProject} from './project.mjs';
import {escenasDelMapa,medirMapa,generar,escribir,revisarPerillas,estado,medirEnNavegador} from './perillas.mjs';

function proyecto(t,{style='moderno-limpio',requerido=true,perillas={},beats=null,variante=false}={}){
  const base=mkdtempSync(join(tmpdir(),'perillas-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
  const put=(p,v)=>{mkdirSync(dirname(join(base,p)),{recursive:true});writeFileSync(join(base,p),typeof v==='string'?v:JSON.stringify(v));};
  const dir=variante?'moderno':'master';
  const cfg={schemaVersion:1,brand:'cvander',style,lane:'MASTER',engine:{name:'hyperframes',version:'0.8.29',entry:'master/index.html',composition:'main'},
    paths:{map:'master/BEATS.json'},distribution:{placement:'organic-reel'},perillas,...(requerido?{pitchRequerido:true}:{})};
  if(variante){cfg.activeVariant='moderno';cfg.variants={moderno:{engine:{entry:'moderno/index.html'},paths:{map:'moderno/BEATS.json'}}};}
  put(`${dir}/index.html`,'<html><head></head><body><div id="caps"></div></body></html>');
  put(`${dir}/BEATS.json`,beats||{beats:[{id:'S01',start:0,end:3.9},{id:'S02',start:3.9,end:7},{id:'S03',start:7,end:9.5},{id:'S04',start:9.5,end:12.6},{id:'S05',start:12.6,end:16}]});
  put('pipeline.json',cfg);
  return {base,put,dir,cfg,save:()=>put('pipeline.json',cfg)};
}
const conPerillas=(p,extra='')=>p.put(`${p.dir}/index.html`,`<html><head><link rel="stylesheet" href="perillas.css"><script src="perillas.js"></script></head><body><div data-perilla="subtitulos" ${extra}>hola</div></body></html>`);

/* ── el mapa ─────────────────────────────────────────────────────────────────────── */
test('the map is read in its three schemas: {start,end}, {t,e} and {s,e}',()=>{
  assert.deepEqual(escenasDelMapa({beats:[{id:'a',start:0,end:2}]}),[{id:'a',start:0,end:2}]);
  assert.deepEqual(escenasDelMapa({escenas:[{id:'hook',t:0,e:3.9}]}),[{id:'hook',start:0,end:3.9}]);
  assert.deepEqual(escenasDelMapa({beats:[{id:'S01',s:0,e:6.44}]}),[{id:'S01',start:0,end:6.44}]);   // UFM (paper-collage)
  assert.throws(()=>escenasDelMapa({beats:[{id:'a',start:0}]}),/a/);   // una escena sin fin no se adivina
  assert.throws(()=>escenasDelMapa({}),/escenas/);
});
test('one definition of each measure: hook, changes in the first 10 s (hook counts), median, short scenes',()=>{
  const m=medirMapa([{id:'h',start:0,end:3.9},{id:'b',start:3.9,end:4.85},{id:'c',start:4.85,end:9.16},{id:'d',start:9.16,end:12},{id:'e',start:12,end:15}]);
  assert.equal(m.duracionHook,3.9);
  assert.equal(m.cambiosPrimeros10s,4);        // h, b, c, d arrancan antes de 10 s — el hook cuenta
  assert.equal(m.duracionEscena,3);            // mediana de 3.9 .95 4.31 2.84 3 → 3
  assert.deepEqual(m.cortas(2.5).map(x=>x.id),['b']);
  // con un número par de escenas la mediana es el promedio de las dos del medio: 1 2 | 4 8 → 3
  assert.equal(medirMapa([{id:'a',start:0,end:1},{id:'b',start:1,end:3},{id:'c',start:3,end:7},{id:'d',start:7,end:15}]).duracionEscena,3);
});

/* ── (1) la composición recibe las perillas ───────────────────────────────────────── */
test('generated files carry every resolved knob, with its origin, and the CSS maps subtitles',t=>{
  const p=proyecto(t,{perillas:{barrido:0.4}});
  const g=generar(p.base);
  assert.match(g.js,/window\.PERILLAS=/);
  const valores=JSON.parse(g.js.match(/window\.PERILLAS=Object\.freeze\((\{[\s\S]*?\})\);/)[1]);
  assert.equal(valores.barrido,0.4);                 // el episodio gana
  assert.equal(valores.escalaPlaca,0.72);            // default del formato
  assert.match(g.js,/barrido.*episodio/);            // dice de dónde salió
  assert.match(g.css,/--subtitulos-tamano:\s*62px/);
  assert.match(g.css,/--subtitulos-alineacion:\s*center/);
  assert.match(g.css,/\[data-perilla="subtitulos"\]\{[^}]*font-size:var\(--subtitulos-tamano\)/);
  assert.match(g.css,/--barrido:\s*0\.4\b/);
  assert.match(g.js+g.css,/no editar/i);
});
test('files are written next to the active variant composition',t=>{
  const p=proyecto(t,{variante:true});escribir(p.base);
  assert.ok(existsSync(join(p.base,'moderno/perillas.js')));assert.ok(existsSync(join(p.base,'moderno/perillas.css')));
  assert.ok(!existsSync(join(p.base,'master/perillas.js')));
});
test('a new project whose composition does not load the knobs is not verifiable; loading fresh files is OK',t=>{
  const p=proyecto(t);
  const r0=revisarPerillas(p.base);assert.equal(r0.lectura.estado,'NO VERIFICABLE');
  escribir(p.base);assert.equal(revisarPerillas(p.base).lectura.estado,'NO VERIFICABLE');   // archivos sin cargar = no leídas
  conPerillas(p);assert.equal(revisarPerillas(p.base).lectura.estado,'OK');
});
test('changing a knob after generating makes the composition stale (blocked), regenerating fixes it',t=>{
  const p=proyecto(t);escribir(p.base);conPerillas(p);
  p.cfg.perillas={barrido:0.5};p.save();
  const r=revisarPerillas(p.base);assert.equal(r.lectura.estado,'BLOQUEADO');assert.match(r.lectura.detalle,/barrido/);
  escribir(p.base);assert.equal(revisarPerillas(p.base).lectura.estado,'OK');
});
test('a hand-edited perillas.js is caught',t=>{
  const p=proyecto(t);escribir(p.base);conPerillas(p);
  const f=join(p.base,'master/perillas.js');writeFileSync(f,readFileSync(f,'utf8').replace('"barrido": 0.34','"barrido": 0.2'));
  assert.equal(revisarPerillas(p.base).lectura.estado,'BLOQUEADO');
});
test('a project from before the knobs is not asked to load them (delivered work is not redone)',t=>{
  const p=proyecto(t,{requerido:false});
  const r=revisarPerillas(p.base);assert.equal(r.lectura.estado,'OK');assert.match(r.lectura.detalle,/anterior/);
});

/* ── (2) el video las cumple ──────────────────────────────────────────────────────── */
test('measures inside the format range are OK; outside are AVISO, never BLOQUEADO',t=>{
  const p=proyecto(t,{beats:{beats:[{id:'S01',start:0,end:9},{id:'S02',start:9,end:20}]}});   // hook 9 s: moderno admite 2–6
  const r=revisarPerillas(p.base);
  const hook=r.medidas.find(m=>m.perilla==='duracionHook');
  assert.equal(hook.estado,'AVISO');assert.equal(hook.medido,9);assert.match(hook.detalle,/2.*6/);
  assert.ok(!r.medidas.some(m=>m.estado==='BLOQUEADO'));
  const ok=revisarPerillas(proyecto(t).base).medidas.find(m=>m.perilla==='duracionHook');assert.equal(ok.estado,'OK');
});
test('short scenes under minimoRecurso are listed by id as AVISO',t=>{
  const p=proyecto(t,{beats:{beats:[{id:'S01',start:0,end:3.9},{id:'golpe',start:3.9,end:5},{id:'S03',start:5,end:9}]}});
  const m=revisarPerillas(p.base).medidas.find(x=>x.perilla==='minimoRecurso');
  assert.equal(m.estado,'AVISO');assert.match(m.detalle,/golpe/);
});
test('knobs that cannot be measured from the map are reported as passed to the composition, not as checked',t=>{
  const r=revisarPerillas(proyecto(t).base);
  assert.ok(r.sinMedir.includes('escalaPlaca'));assert.ok(!r.medidas.some(m=>m.perilla==='escalaPlaca'));
});
test('a format without knobs says so instead of passing silently',t=>{
  const r=revisarPerillas(proyecto(t).base,{estilo:{id:'sin-perillas',perillas:{}}});   // todos los formatos reales ya tienen (2-nov)
  assert.equal(r.medidas.length,0);assert.match(r.resumen,/no declara perillas/);
});
test('router state: stale is an error, missing load is pending, the rest is ok',t=>{
  const p=proyecto(t);assert.equal(estado(p.base).pendiente,true);
  escribir(p.base);conPerillas(p);assert.equal(estado(p.base).ok,true);
  p.cfg.perillas={barrido:0.5};p.save();const e=estado(p.base);assert.equal(e.ok,false);assert.ok(!e.pendiente);
});

/* ── en el navegador: lo que de verdad se pinta ───────────────────────────────────── */
test('in the browser the subtitles render at the knob size; a hard-coded size is caught',async t=>{
  const p=proyecto(t);escribir(p.base);conPerillas(p);
  const a=await medirEnNavegador(p.base);
  if(a.sinNavegador){t.skip('sin Chrome/puppeteer');return;}
  assert.equal(a.estado,'OK',a.detalle);assert.equal(a.tamano,62);assert.equal(a.valoresIguales,true);
  conPerillas(p,'style="font-size:54px"');
  const b=await medirEnNavegador(p.base);assert.equal(b.estado,'BLOQUEADO');assert.match(b.detalle,/54/);
  p.put(`${p.dir}/index.html`,'<html><head><link rel="stylesheet" href="perillas.css"><script src="perillas.js"></script></head><body></body></html>');
  const c=await medirEnNavegador(p.base);assert.equal(c.estado,'NO VERIFICABLE');assert.match(c.detalle,/data-perilla="subtitulos"/);
});

/* ── calibración: lo aprobado donde se midieron da verde (sólo lectura) ──────────── */
test('calibration: the approved videos where each format was measured come out green',t=>{
  const casos={'cvander-optimismo':'moderno-limpio','programar-profesion':'layered-talking-head','cvander-adobe':'layered-talking-head','cvander-cloudflare':'vlog',
    'preguntale-humano-ep01':'micro-podcast','cvander-jobs':'investigacion-cinematica','cvander-univguate':'paper-collage'};
  for(const [slug,formato] of Object.entries(casos)){
    let base;try{base=resolveProject(slug);}catch{t.skip(`${slug} no está en este disco`);return;}
    const r=revisarPerillas(base,{formato});
    const fuera=r.medidas.filter(m=>m.estado!=='OK'&&m.perilla!=='minimoRecurso');
    assert.deepEqual(fuera,[],`${slug} (${formato}): ${JSON.stringify(fuera)}`);
    assert.equal(r.lectura.estado,'OK',`${slug}: ${r.lectura.detalle}`);   // entregado = anterior, no se le pide cargar
  }
});
test('the CLI writes, reports and fails only on a real error',t=>{
  const p=proyecto(t);const cli=a=>spawnSync(process.execPath,[join(ROOT,'pipeline/tools/perillas.mjs'),p.base,...a],{encoding:'utf8'});
  assert.equal(cli(['--escribir']).status,0);assert.ok(existsSync(join(p.base,'master/perillas.js')));
  conPerillas(p);const r=cli(['--check']);assert.equal(r.status,0,r.stderr+r.stdout);assert.match(r.stdout,/PERILLAS/);
  p.cfg.perillas={barrido:0.5};p.save();assert.equal(cli(['--check']).status,1);
});
test('the router shows the PERILLAS row: pending, blocked when stale, AVISO per measure, and checks the screen on a full run',async t=>{
  const {registeredStatus}=await import('./registered-status.mjs');
  const fila=(r,n)=>r.ch.find(c=>c.nombre===n);
  const p=proyecto(t,{beats:{beats:[{id:'S01',start:0,end:9},{id:'S02',start:9,end:20}]}});
  assert.equal(fila(registeredStatus(p.base,'x',{fast:true}),'PERILLAS').estado,'NO VERIFICABLE');
  escribir(p.base);conPerillas(p);
  const r=registeredStatus(p.base,'x',{fast:true});
  assert.equal(fila(r,'PERILLAS').estado,'OK');
  assert.ok(r.ch.some(c=>c.estado==='AVISO'&&c.nombre==='PERILLA'&&/duracionHook/.test(c.detalle)));
  assert.equal(fila(r,'PERILLAS EN PANTALLA'),undefined);                     // la rápida no abre Chrome
  conPerillas(p,'style="font-size:54px"');
  const full=registeredStatus(p.base,'x',{fast:false});
  if(!/sin puppeteer/.test(fila(full,'PERILLAS EN PANTALLA')?.detalle||'')){assert.equal(fila(full,'PERILLAS EN PANTALLA').estado,'BLOQUEADO');assert.ok(full.bloqueo);}
  p.cfg.perillas={barrido:0.5};p.save();
  assert.equal(fila(registeredStatus(p.base,'x',{fast:true}),'PERILLAS').estado,'BLOQUEADO');
});
