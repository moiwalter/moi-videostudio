// Evals de cliente-check.mjs, escritas ANTES del código (2-nov-2026). Cada una es un caso que el chequeo tiene que ver.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {revisarCliente,textoEnPantalla,estado} from './cliente-check.mjs';
import {registeredStatus} from './registered-status.mjs';

const C04={id:'C04',regla:'AI, nunca IA',chequeo:{tipo:'texto-prohibido',patron:'\\bIA\\b'}};
const C06={id:'C06',regla:'clip de Freddy vetado',chequeo:{tipo:'recurso-vetado',patrones:['amigos-moscone','hook-walter','2000344A']}};
const REGLAS=[C04,C06,{id:'C01',regla:'manual',chequeo:{tipo:'manual'}}];

function proyecto(t,{html='<main></main>',voz='hola a todos esto es un video',extra={}}={}){
 const base=mkdtempSync(join(tmpdir(),'cliente-check-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
 const put=(p,v)=>{mkdirSync(dirname(join(base,p)),{recursive:true});writeFileSync(join(base,p),typeof v==='string'?v:JSON.stringify(v));};
 put('pipeline.json',{schemaVersion:1,brand:'cvander',lane:'MASTER',engine:{name:'hyperframes',entry:'master/index.html'},transcript:{file:'local/words.json'}});
 put('local/words.json',voz.split(' ').map((t,i)=>({t,s:i,e:i+.5})));
 put('master/index.html',html);
 for(const [p,v] of Object.entries(extra))put(p,v);
 return base;
}
const errores=r=>r.filter(x=>!x.ok).map(x=>x.id);

test('1 · «IA» en un título nuestro frena (Chris no lo dijo)',t=>{
 const r=revisarCliente(proyecto(t,{html:'<h1 class="hook">Adobe, clonado con IA</h1>'}),REGLAS);
 assert.deepEqual(errores(r),['C04']);assert.match(r.find(x=>x.id==='C04').detalle,/clonado con IA/);
});
test('2 · «AI» pasa, y «IA» dentro de otra palabra no cuenta (VÍA, MIAMI, IAs)',t=>{
 const r=revisarCliente(proyecto(t,{html:'<h1>AI soul.md</h1><p>VIA MIAMI IAs</p>'}),REGLAS);
 assert.deepEqual(errores(r),[]);
});
test('3 · lo que no se ve no cuenta: comentarios, atributos, CSS, claves de JS',t=>{
 const html='<!-- IA vieja --><style>.IA{color:red}</style><div data-k="IA" class="IA">ok</div><script>var FILL={IA:.82}; // IA\n/* IA */</script>';
 assert.deepEqual(errores(revisarCliente(proyecto(t,{html}),REGLAS)),[]);
});
test('4 · un texto en un string de JS sí cuenta (los títulos se escriben desde el script)',t=>{
 const r=revisarCliente(proyecto(t,{html:'<script>titulo.textContent="IA y agentes";</script>'}),REGLAS);
 assert.deepEqual(errores(r),['C04']);
});
test('5 · subtítulo de lo que Chris dice: si lo dijo en voz, no frena (C04: «lo que dice se transcribe tal cual»)',t=>{
 const r=revisarCliente(proyecto(t,{html:'<div class="cap">la IA cambia todo</div>',voz:'la IA cambia todo'}),REGLAS);
 assert.deepEqual(errores(r),[]);assert.match(r.find(x=>x.id==='C04').detalle,/voz/);
});
test('6 · …pero un «IA» de más que la voz no explica sí frena',t=>{
 const r=revisarCliente(proyecto(t,{html:'<div class="cap">la IA cambia todo</div><h1>Todo es IA</h1>',voz:'la IA cambia todo'}),REGLAS);
 assert.deepEqual(errores(r),['C04']);
});
test('7 · el clip vetado referenciado por nombre frena',t=>{
 const r=revisarCliente(proyecto(t,{html:'<video src="assets/amigos-moscone.mp4"></video>',extra:{'master/assets/amigos-moscone.mp4':'x'}}),REGLAS);
 assert.deepEqual(errores(r),['C06']);
});
test('8 · el clip vetado RENOMBRADO frena por su origen (INDEX.json: c04 → 2000344A…)',t=>{
 const r=revisarCliente(proyecto(t,{html:'<video src="assets/clips/c04.mp4"></video>',extra:{'master/assets/clips/c04.mp4':'x','master/assets/clips/INDEX.json':{c04:'originales/2000344A-8DC0.MP4',c05:'originales/OTRO.MP4'}}}),REGLAS);
 assert.deepEqual(errores(r),['C06']);assert.match(r.find(x=>x.id==='C06').detalle,/2000344A/);
});
test('9 · un clip permitido de la misma carpeta pasa',t=>{
 const r=revisarCliente(proyecto(t,{html:'<video src="assets/clips/c05.mp4"></video>',extra:{'master/assets/clips/c05.mp4':'x','master/assets/clips/INDEX.json':{c04:'originales/2000344A.MP4',c05:'originales/OTRO.MP4'}}}),REGLAS);
 assert.deepEqual(errores(r),[]);
});
test('10 · las reglas manuales no se fingen como chequeadas',t=>{
 const r=revisarCliente(proyecto(t),REGLAS);
 assert.equal(r.find(x=>x.id==='C01'),undefined);assert.equal(r.length,2);
});
test('11 · textoEnPantalla saca el texto visible y los strings, sin marcas',()=>{
 const s=textoEnPantalla('<p>Hola <b>mundo</b></p><script>x="dos";// tres\n</script><!-- cuatro -->');
 assert.match(s,/Hola/);assert.match(s,/mundo/);assert.match(s,/dos/);assert.doesNotMatch(s,/tres|cuatro|<b>/);
});
test('12 · una referencia que no es ruta directa (prop de un componente) no tumba el chequeo, y se revisa por nombre',t=>{
 const ok=revisarCliente(proyecto(t,{html:'<img src="ufm-logo.png">'}),REGLAS);
 assert.deepEqual(errores(ok),[]);assert.match(ok.find(x=>x.id==='C06').detalle,/1 referencias/);
 const mal=revisarCliente(proyecto(t,{html:'<video src="amigos-moscone.mp4"></video>'}),REGLAS);
 assert.deepEqual(errores(mal),['C06']);
});
const conPitch=(base,v)=>{const p=join(base,'pipeline.json');const c=JSON.parse(readFileSync(p,'utf8'));c.pitchRequerido=v;writeFileSync(p,JSON.stringify(c));return base;};
test('13 · proyecto NUEVO (pitchRequerido) con «IA» en el hook: el estado no es ok y nombra la regla',t=>{
 const e=estado(conPitch(proyecto(t,{html:'<h1>Todo es IA</h1>'}),true));
 assert.equal(e.ok,false);assert.equal(e.pendiente,undefined);assert.match(e.resumen,/C04/);
});
test('14 · proyecto ANTERIOR con el mismo error: no se exige (lo entregado no se reabre) y dice cómo auditarlo',t=>{
 const e=estado(proyecto(t,{html:'<h1>Todo es IA</h1>'}));
 assert.equal(e.ok,true);assert.match(e.resumen,/no se exige/);assert.match(e.resumen,/cliente-check\.mjs/);
});
test('15 · proyecto nuevo sin composición todavía: pendiente, no error',t=>{
 const base=conPitch(proyecto(t),true);rmSync(join(base,'master/index.html'));
 const e=estado(base);assert.equal(e.ok,false);assert.equal(e.pendiente,true);
});
test('16 · el router muestra la fila CLIENTE BLOQUEADO en un proyecto nuevo con el clip vetado',t=>{
 const base=conPitch(proyecto(t,{html:'<video src="assets/amigos-moscone.mp4"></video>',extra:{'master/assets/amigos-moscone.mp4':'x'}}),true);
 let r;try{r=registeredStatus(base,'_t',{fast:true});}catch(e){return assert.fail('registeredStatus lanzó: '+e.message);}
 const fila=r.ch.find(c=>c.nombre==='CLIENTE');assert.equal(fila?.estado,'BLOQUEADO',JSON.stringify(r.ch));assert.match(fila.detalle,/C06/);
});

// ── Hallazgos de la revisión independiente (2-nov-2026), escritos antes del arreglo ──
const C04s={id:'C04',chequeo:{tipo:'texto-prohibido',patron:'\\bIAs?\\b'}};
test('17 · sigue a la variante activa: escanea SU composición y SU transcript',t=>{
 const base=proyecto(t,{html:'<h1>ok</h1>',extra:{'master-v2/index.html':'<h1>La IA</h1>','local/v2.json':[{t:'hola'}]}});
 const p=join(base,'pipeline.json');const c=JSON.parse(readFileSync(p,'utf8'));c.activeVariant='B';c.variants={B:{engine:{entry:'master-v2/index.html'},paths:{master:'master-v2'},transcript:{file:'local/v2.json'}}};writeFileSync(p,JSON.stringify(c));
 assert.deepEqual(errores(revisarCliente(base,REGLAS)),['C04']);
});
test('18 · el clip vetado DENTRO DEL CORTE (cut.json bloques[].archivo) frena — el caso real de Cloudflare',t=>{
 const base=proyecto(t,{html:'<video src="../local/cut.mp4"></video>',extra:{'local/cut.mp4':'x','local/cut.json':{bloques:[{fuente:'hook',archivo:'originales/hook-walter.mp4',t0:0,t1:8.9},{fuente:'voz',archivo:'edicion/local/voz.wav',t0:8.9,t1:90}]}}});
 const r=revisarCliente(base,REGLAS);assert.deepEqual(errores(r),['C06']);assert.match(r.find(x=>x.id==='C06').detalle,/cut\.json/);
});
test('19 · template literal de varias líneas: el texto adentro cuenta',t=>{
 assert.deepEqual(errores(revisarCliente(proyecto(t,{html:'<script>el.innerHTML=`<div>\n La IA\n</div>`;</script>'}),REGLAS)),['C04']);
});
test('20 · « // » dentro de un string no es comentario: el resto de la línea se sigue leyendo',t=>{
 assert.deepEqual(errores(revisarCliente(proyecto(t,{html:"<script>var u='https://x.com // y'; t.textContent='Todo es IA';</script>"}),REGLAS)),['C04']);
});
test('21 · una regex con comillas no descoloca las comillas siguientes',t=>{
 assert.deepEqual(errores(revisarCliente(proyecto(t,{html:"<script>var q=s.replace(/[\"']/g,''); t.textContent='Todo es IA';</script>"}),REGLAS)),['C04']);
});
test('22 · letras partidas en spans (animación por letra) se leen juntas',t=>{
 assert.deepEqual(errores(revisarCliente(proyecto(t,{html:'<h1><span>I</span><span>A</span> manda</h1>'}),REGLAS)),['C04']);
});
test('23 · un HTML o CSS cuyo NOMBRE contiene el patrón no es el clip vetado',t=>{
 const base=proyecto(t,{html:'<link href="hook-walter-intro.css"><h1>ok</h1>',extra:{'master/hook-walter-intro.css':'h1{}'}});
 assert.deepEqual(errores(revisarCliente(base,REGLAS)),[]);
});
test('24 · texto JSX de Remotion (.tsx) cuenta',t=>{
 const base=proyecto(t,{html:'<script src="Scene.tsx"></script>',extra:{'master/Scene.tsx':'export const S=()=> <h1>La IA</h1>;'}});
 assert.deepEqual(errores(revisarCliente(base,REGLAS)),['C04']);
});
test('25 · transcript de whisper con texto por segmento Y por palabra: la voz se cuenta una vez',t=>{
 const base=proyecto(t,{html:'<div class="cap">la IA</div><h1>Es IA</h1>'});
 writeFileSync(join(base,'local/words.json'),JSON.stringify({segments:[{text:'la IA',words:[{word:'la'},{word:'IA'}]}]}));
 assert.deepEqual(errores(revisarCliente(base,REGLAS)),['C04']);
});
test('26 · «IAs» también es «IA» (el patrón de C04 lo cubre)',t=>{
 assert.deepEqual(errores(revisarCliente(proyecto(t,{html:'<h1>Las IAs</h1>'}),[C04s])),['C04']);
});
test('27 · letras partidas + títulos desde script: se cuentan los dos, ninguno tapa al otro',t=>{
 const r=revisarCliente(proyecto(t,{html:'<h1><span>I</span><span>A</span></h1><script>a.textContent="IA uno";b.textContent="IA dos";</script>',voz:'la IA y la IA dos veces'}),REGLAS);
 assert.deepEqual(errores(r),['C04'],'3 en pantalla, 2 en la voz');
});
