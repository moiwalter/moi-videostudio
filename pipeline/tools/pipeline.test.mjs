import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,readdirSync,statSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {ROOT,resolveProject,resolveScene,engineVersion,refreshCatalog} from './project.mjs';
import {inputGraph,digest} from './input-graph.mjs';
import {scenes,sceneFingerprint,approvalState,outputState} from './scene-state.mjs';
import {sourceState} from './source-state.mjs';
import {preflight} from './preflight.mjs';
import {registeredStatus} from './registered-status.mjs';
import {checkResources} from './resources.mjs';
import {template,fingerprint,checkReview} from './review-video.mjs';
import {checkSound} from './qc-sonido.mjs';
import {verifyExport} from './verify-export.mjs';
function fixture(t,{lane='MASTER',engine='remotion'}={}){
 const base=mkdtempSync(join(tmpdir(),'pipeline-regression-'));
 t.after(()=>rmSync(base,{recursive:true,force:true}));
 const put=(p,v)=>{mkdirSync(dirname(join(base,p)),{recursive:true});writeFileSync(join(base,p),typeof v==='string'?v:JSON.stringify(v));};
 put('source.mp4','synthetic source for unit test; not actual footage');put('speech.srt','1\n00:00:00,000 --> 00:00:01,000\nExample\n');
 put('src/index.ts','import {Scene} from "./Scene";');put('src/Scene.tsx','export const Scene=()=>null;');
 put('master/index.html','<main></main>');put('master/BEATS.json',{beats:[{id:'S01',entry:'src/Scene.tsx',start:0,end:1}]});
 const cfg={schemaVersion:1,brand:'fixture',style:'paper-collage',lane,engine:{name:engine,version:engine==='remotion'?'4.0.525':'0.8.37',entry:engine==='remotion'?'src/index.ts':'master/index.html',composition:'Video'},distribution:{placement:'organic-reel'},source:{file:'source.mp4',sha256:digest(join(base,'source.mp4'))},transcript:{file:'speech.srt',sha256:digest(join(base,'speech.srt')),sourceSha256:digest(join(base,'source.mp4')),language:'en'}};
 const save=()=>put('pipeline.json',cfg);save();
 const kit=id=>{put(`scenes/${id}/index.html`,'<main></main>');put(`scenes/${id}/meta.json`,{id,type:'full',beat:{start:0,end:1},timing:{fps:30,durationFrames:30}});return scenes(base,'KIT').find(s=>s.id===id);};
 const approve=(sc)=>{const a={fingerprint:sceneFingerprint(base,sc).sha256,decision:'Synthetic regression fixture, never a production approval'};sc.data.approval=a;put(relative(base,sc.metaPath),sc.lane==='MASTER'?sc.map:sc.data);};
 return {base,put,cfg,save,kit,approve};
}
const cli=(file,args=[],opts={})=>spawnSync(process.execPath,[join(ROOT,'pipeline/tools',file),...args],{encoding:'utf8',timeout:20000,...opts});
const tree=base=>{const r={};function visit(p){for(const n of readdirSync(p)){const f=join(p,n);if(statSync(f).isDirectory())visit(f);else r[relative(base,f)]=digest(f);}}visit(base);return r;};
test('project and scene resolution rejects ambiguity and preserves exact matches',t=>{const f=fixture(t);mkdirSync(join(f.base,'alpha-video'));mkdirSync(join(f.base,'beta-video'));assert.throws(()=>resolveProject('video',f.base),/ambiguo/);assert.equal(resolveProject('alpha-video',f.base),join(f.base,'alpha-video'));assert.throws(()=>resolveScene(['S01-a','S01-b'],'S01'),/ambigua/);assert.equal(resolveScene(['S01','S01-a'],'S01'),'S01');});
test('KIT approval is content-bound; changing another scene leaves it approved',t=>{const f=fixture(t,{lane:'KIT',engine:'hyperframes'}),a=f.kit('S01-a');f.kit('S02-b');f.approve(a);assert.equal(approvalState(f.base,scenes(f.base,'KIT')[0]).ok,true);f.put('scenes/S02-b/index.html','different');assert.equal(approvalState(f.base,scenes(f.base,'KIT')[0]).ok,true);f.put('scenes/S01-a/index.html','changed');assert.equal(approvalState(f.base,scenes(f.base,'KIT')[0]).state,'STALE');});
test('shared CSS and a referenced real image invalidate dependent approval',t=>{const f=fixture(t,{lane:'KIT',engine:'hyperframes'});const a=f.kit('S01-a');f.put('scenes/shared.css','body{color:red}');f.put('scenes/S01-a/photo.jpg','image bytes');f.put('scenes/S01-a/index.html','<link href="../shared.css"><img src="photo.jpg">');f.approve(a);f.put('scenes/shared.css','body{color:blue}');assert.equal(approvalState(f.base,scenes(f.base,'KIT')[0]).state,'STALE');f.approve(scenes(f.base,'KIT')[0]);f.put('scenes/S01-a/photo.jpg','replaced photograph');assert.equal(approvalState(f.base,scenes(f.base,'KIT')[0]).state,'STALE');});
test('MASTER timing and variant props invalidate approvals',t=>{const f=fixture(t);f.approve(scenes(f.base)[0]);f.cfg.activeVariant='B';f.cfg.variants={B:{props:{accent:'red'}}};f.save();assert.equal(approvalState(f.base,scenes(f.base)[0]).state,'STALE');f.approve(scenes(f.base)[0]);const map=JSON.parse(readFileSync(join(f.base,'master/BEATS.json')));map.beats[0].end=2;f.put('master/BEATS.json',map);assert.equal(approvalState(f.base,scenes(f.base)[0]).state,'STALE');});
test('TSX imports, JSON, fonts, JSX assets and dynamic public resources are tracked',t=>{const f=fixture(t);f.put('src/data.json',{title:'A'});f.put('public/photo.png','photo');f.put('public/font.woff2','font');f.put('src/Scene.tsx','import data from "./data.json"; import "./style.css"; const x=staticFile(data.title); export const Scene=()=> <img src="/photo.png"/>;');f.put('src/style.css','@font-face{src:url(/font.woff2)}');const g=inputGraph(f.base,{roots:['src/index.ts']});for(const file of ['src/data.json','public/font.woff2','public/photo.png'])assert.ok(g.inputs.includes(file));f.put('public/photo.png','new');assert.notEqual(inputGraph(f.base,{roots:['src/index.ts']}).sha256,g.sha256);rmSync(join(f.base,'public/font.woff2'));assert.throws(()=>inputGraph(f.base,{roots:['src/index.ts']}),/ausente/);});
test('unresolved dynamic imports fail instead of silently omitting dependencies',t=>{const f=fixture(t);f.put('src/Scene.tsx','const scene=import(sceneName);');assert.throws(()=>inputGraph(f.base,{roots:['src/index.ts']}),/Dynamic import/);});
test('same-length replacement of source or transcript breaks source binding',t=>{const f=fixture(t);assert.equal(sourceState(f.base).ok,true);const old=readFileSync(join(f.base,'source.mp4'),'utf8');f.put('source.mp4','X'+old.slice(1));assert.equal(sourceState(f.base).state,'FAIL');f.put('source.mp4',old);f.put('speech.srt',readFileSync(join(f.base,'speech.srt'),'utf8').replace('Example','Changed'));assert.equal(sourceState(f.base).state,'FAIL');});
test('real local resources pass and placeholders remain a draft',t=>{const f=fixture(t);f.put('master/photo.jpg','test image');f.put('master/index.html','<img src="photo.jpg">');assert.equal(checkResources(f.base,join(f.base,'master/index.html')).ok,true);f.put('master/index.html','<div data-asset="real-photo"></div>');assert.equal(checkResources(f.base,join(f.base,'master/index.html')).ok,false);assert.equal(checkResources(f.base,join(f.base,'master/index.html'),{allowPlaceholders:true}).draft,true);});
test('approval CLI cannot invent a decision or approve placeholders',t=>{const f=fixture(t,{lane:'KIT'});f.kit('S01');assert.equal(cli('scene-state.mjs',[f.base,'S01']).status,1);f.put('scenes/S01/index.html','<div data-asset="pending"></div>');assert.equal(cli('scene-state.mjs',[f.base,'S01','--decision','unit test only']).status,1);assert.equal(approvalState(f.base,scenes(f.base,'KIT')[0]).ok,false);});
test('final KIT preflight requires outputs even when every scene is approved',t=>{const f=fixture(t,{lane:'KIT',engine:'hyperframes'});f.approve(f.kit('S01'));assert.equal(preflight(f.base,{stage:'render'}).ok,true);assert.equal(preflight(f.base,{stage:'delivery'}).ok,false);assert.equal(outputState(f.base,scenes(f.base,'KIT')[0]).state,'PENDING');});
test('direct final and alpha stop before renderer when approval is missing',t=>{const f=fixture(t,{lane:'KIT',engine:'hyperframes'});f.kit('S01');const before=tree(f.base);for(const name of ['alpha.sh','final.sh']){const r=spawnSync('bash',[join(ROOT,'pipeline/tools',name),f.base,'S01'],{encoding:'utf8',timeout:10000});assert.equal(r.status,2,r.stderr);assert.match(r.stdout,/approval S01/);}assert.deepEqual(tree(f.base),before);});
test('read-only status has consistent text/JSON exits and honest quick coverage',t=>{const f=fixture(t);const before=tree(f.base);const a=cli('flujo.mjs',[f.base,'--rapido']),b=cli('flujo.mjs',[f.base,'--rapido','--json']);assert.equal(a.status,2,a.stderr);assert.equal(b.status,a.status,b.stderr);assert.ok(JSON.parse(b.stdout).ch.some(c=>c.nombre==='GATES OMITIDOS'));assert.deepEqual(tree(f.base),before);});
test('Remotion and custom HyperFrames historical deliveries are visible and checked',t=>{for(const engine of ['remotion','hyperframes']){const f=fixture(t,{engine});f.cfg.engine.entry=engine==='remotion'?'src/index.ts':'custom/index.html';if(engine==='hyperframes')f.put('custom/index.html','<main></main>');f.put('delivered.mp4','unit fixture export');f.put('evidence.json',{});Object.assign(f.cfg,{state:'reference',export:{file:'delivered.mp4',sha256:digest(join(f.base,'delivered.mp4'))},evidence:['evidence.json']});f.save();assert.equal(registeredStatus(f.base,'fixture').entregado,true);f.put('delivered.mp4','replaced output');assert.ok(registeredStatus(f.base,'fixture').bloqueo);}});
test('project engine pin takes precedence over shared default',t=>{const f=fixture(t,{engine:'hyperframes'});assert.equal(engineVersion(f.base),'0.8.37');});
test('review rejects an entry different from the composition that will render',t=>{const f=fixture(t);const r=template('master/index.html');f.put('REVIEW.json',r);assert.ok(checkReview(f.base).errors.some(e=>/composition differs/.test(e)));});
test('build verify creates no fragment directory or build log; delegation is explicit',t=>{const f=fixture(t,{engine:'hyperframes'});const before=tree(f.base);const r=cli('build-master.mjs',[f.base,'--verify']);assert.equal(r.status,2,r.stderr);assert.deepEqual(tree(f.base),before);assert.equal(existsSync(join(f.base,'master/escenas')),false);assert.equal(cli('build-master.mjs',[f.base]).status,2);});
test('new Remotion scaffold is brand-specific and starts pending',t=>{const slug=`_test-remotion-${process.pid}`,base=join(ROOT,'proyectos/moi',slug,'edicion');t.after(()=>{rmSync(dirname(base),{recursive:true,force:true});refreshCatalog(ROOT);});const r=spawnSync('bash',[join(ROOT,'pipeline/tools/new-video.sh'),slug,'--marca','moi','--carril','master','--engine','remotion','--style','paper-collage'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const cfg=JSON.parse(readFileSync(join(base,'pipeline.json')));assert.equal(cfg.engine.name,'remotion');assert.equal(cfg.style,'paper-collage');const brief=readFileSync(join(base,'PRODUCTION.md'),'utf8');assert.match(brief,/Paper Collage/);assert.doesNotMatch(brief,/cvander-layered|Rubik|#3C0058/);assert.equal(existsSync(join(base,'src/brand.json')),false);assert.equal(cli('flujo.mjs',[base,'--json','--rapido']).status,2);});
test('declaring delivered cannot bypass approvals and final review',t=>{const f=fixture(t);assert.equal(cli('flujo.mjs',[f.base,'--entregado']).status,1);assert.equal(existsSync(join(f.base,'ENTREGADO.json')),false);});
test('audio and export QC measures actual streams, format and decode',t=>{const f=fixture(t);const file=join(f.base,'test.mp4');const r=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=purple:s=160x284:r=30:d=1','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const audio=checkSound(file);assert.equal(audio.ok,true);assert.equal(audio.measured.sampleRate,48000);assert.equal(checkSound(file,{targetLUFS:-1}).ok,false);const qa=verifyExport(file,{width:160,height:284,fps:30,frames:30});assert.equal(qa.ok,true,JSON.stringify(qa.errors));assert.equal(qa.visualReview,'pending');assert.equal(verifyExport(file,{width:1080}).ok,false);});
test('Cvander production reference exports remain byte-for-byte identical',()=>{const saved=JSON.parse(readFileSync(join(ROOT,'archivo/auditoria-pipeline/before-pipeline-fixes/preserved-exports.json')));for(const [file,hash] of Object.entries(saved))assert.equal(digest(join(resolveProject(file.split('/')[0]),...file.split('/').slice(1))),hash);for(const slug of ['2026-09-cvandersep2-paper','2026-09-cvander-0910'])assert.equal(registeredStatus(resolveProject(slug),slug).entregado,true);});
test('recorded Remotion pin must match the actual local runtime',async t=>{const {assertEngineRuntime}=await import('./project.mjs');const f=fixture(t);f.put('node_modules/remotion/package.json',{version:'4.0.525'});f.put('node_modules/@remotion/cli/package.json',{version:'4.0.525'});assert.equal(assertEngineRuntime(f.base),'4.0.525');f.put('node_modules/remotion/package.json',{version:'4.0.526'});assert.throws(()=>assertEngineRuntime(f.base),/difiere/);});
test('malformed project in aggregate status cannot hide other results',t=>{
 /* Proyectos de juguete (2-nov-2026): antes corría sobre todos los proyectos reales y leía decenas de GB del disco (90 s). */
 const root=mkdtempSync(join(tmpdir(),'flujo-raiz-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const put=(p,v)=>{mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),v);};
 put('_roto/pipeline.json','{broken');
 put('cerrado/kit.config.sh','# legacy kit\n');put('cerrado/ENTREGADO.json',JSON.stringify({fecha:'2026-09-30'}));
 const r=cli('flujo.mjs',['--rapido','--json'],{env:{...process.env,FLUJO_RAIZ:root}});
 assert.equal(r.status,1,r.stderr);const reports=JSON.parse(r.stdout);
 assert.equal(reports.length,2);
 assert.ok(reports.find(x=>x.slug==='_roto')?.bloqueo);
 assert.ok(reports.find(x=>x.slug==='cerrado')?.entregado);
});
test('bound Whisper JSON becomes timed cues and ignores harmless mtime drift',async t=>{const {hallarTranscripts,cuadraConElCorte}=await import('./lib-corte.mjs');const f=fixture(t);f.put('speech.json',{transcription:[{offsets:{from:0,to:1000},text:'Real timed words'}]});f.cfg.transcript={file:join(f.base,'speech.json'),sha256:digest(join(f.base,'speech.json')),sourceSha256:f.cfg.source.sha256,language:'en'};f.save();const transcript=hallarTranscripts(f.base)[0];assert.equal(transcript.cues[0].end,1);assert.equal(transcript.cues[0].text,'Real timed words');assert.equal(cuadraConElCorte(transcript,{dur:1,mtime:Date.now()+10000}).veredicto,'ok');});
test('review CLI follows the active variant receipt and preserves historical review',t=>{const f=fixture(t);f.cfg.activeVariant='B';f.cfg.variants={B:{review:'review/B.json'}};f.save();f.put('REVIEW.json',{historical:true});assert.equal(cli('review-video.mjs',[f.base,'--init']).status,0);assert.equal(JSON.parse(readFileSync(join(f.base,'REVIEW.json'))).historical,true);assert.equal(JSON.parse(readFileSync(join(f.base,'review/B.json'))).composition,'src/index.ts');});

test('preflight rejects invalid stages and lanes instead of skipping MASTER review',t=>{
 const f=fixture(t);f.approve(scenes(f.base)[0]);
 assert.throws(()=>preflight(f.base,{lane:'master'}),/lane inválido/);
 assert.throws(()=>preflight(f.base,{lane:'KIT'}),/no pertenece/);
 assert.throws(()=>preflight(f.base,{stage:'anything'}),/stage inválido/);
 assert.equal(preflight(f.base,{lane:'MASTER'}).ok,false);
 assert.equal(cli('preflight.mjs',[f.base,'--lane','master']).status,1);
});
test('preflight uses the destination selected by the active variant',t=>{
 const f=fixture(t,{lane:'KIT',engine:'hyperframes'});f.cfg.distribution={placement:null};f.cfg.activeVariant='reel';f.cfg.variants={reel:{distribution:{placement:'organic-reel'}}};f.save();f.approve(f.kit('S01'));
 assert.equal(preflight(f.base).ok,true);
});
test('binding real speech removes a no-speech exemption and preserves unresolved words',t=>{
 const f=fixture(t);f.cfg.transcript={notApplicable:'old silent test',unresolved:[{start:0,end:1}]};f.save();
 const result=cli('source-state.mjs',[f.base,'--bind','--source','source.mp4','--transcript','speech.srt','--language','en']);
 assert.equal(result.status,2,result.stderr);const cfg=JSON.parse(readFileSync(join(f.base,'pipeline.json')));assert.equal(cfg.transcript.notApplicable,undefined);assert.equal(cfg.transcript.unresolved.length,1);
 const before=readFileSync(join(f.base,'pipeline.json'),'utf8');assert.equal(cli('source-state.mjs',[f.base,'--bind','--source','source.mp4','--transcript','speech.srt','--language']).status,1);assert.equal(readFileSync(join(f.base,'pipeline.json'),'utf8'),before);
});
test('source checks and binding follow the active variant without changing other cuts',t=>{
 const f=fixture(t),rootSource={...f.cfg.source},rootTranscript={...f.cfg.transcript};
 f.put('alternate.mp4','alternate synthetic source');f.cfg.activeVariant='B';f.cfg.variants={B:{source:{file:'alternate.mp4',sha256:digest(join(f.base,'alternate.mp4'))}}};f.save();
 assert.equal(sourceState(f.base).state,'FAIL');
 // Desde el 5-oct-2026 vincular un corte con habla deja pendiente la limpieza (eh, pausas, retakes) hasta registrar su recibo.
 assert.equal(cli('source-state.mjs',[f.base,'--bind','--source','alternate.mp4','--transcript','speech.srt','--language','en']).status,2);
 assert.match(sourceState(f.base).error,/limpieza del habla/);
 f.put('limpieza.json',{cortes:[]});
 assert.equal(cli('source-state.mjs',[f.base,'--limpieza','limpieza.json','--decision','synthetic: nothing to cut']).status,0);
 const cfg=JSON.parse(readFileSync(join(f.base,'pipeline.json')));assert.deepEqual(cfg.source,rootSource);assert.deepEqual(cfg.transcript,rootTranscript);assert.equal(sourceState(f.base).ok,true);
 f.put('alternate.mp4','changed alternate source');assert.equal(sourceState(f.base).state,'FAIL');
});
test('legacy pending approvals produce an actionable block without altering the project',t=>{
 const f=fixture(t,{engine:'hyperframes'});rmSync(join(f.base,'pipeline.json'));
 f.put('master/escenas/S01.html','<main>Draft</main>');f.put('master/BEATS.json',{beats:[{id:'S01',start:0,end:1}]});
 f.put('master/index.html','<div class="escena">Draft</div>');f.put('corte.srt','1\n00:00:00,000 --> 00:00:01,000\nTest words\n');
 const generated=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=purple:s=160x284:r=30:d=1','-c:v','libx264',join(f.base,'cut.mp4')],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
 const before=tree(f.base),r=cli('flujo.mjs',[f.base,'--rapido','--json']);assert.equal(r.status,1,r.stderr);
 const state=JSON.parse(r.stdout),gate=state.ch.find(c=>c.nombre==='APROBACIÓN MASTER');assert.equal(gate.estado,'BLOQUEADO');assert.match(gate.detalle,/S01: PENDING/);assert.match(gate.accion.texto,/última dirección/);assert.deepEqual(tree(f.base),before);
});
test('a fingerprint without a user decision never reports APPROVED',t=>{
 const f=fixture(t);f.approve(scenes(f.base)[0]);const sc=scenes(f.base)[0];sc.data.approval.decision=' ';f.put('master/BEATS.json',sc.map);assert.equal(approvalState(f.base,scenes(f.base)[0]).state,'PENDING');
});
test('historical delivery text status exits like JSON and remains read-only',t=>{
 const f=fixture(t);f.put('delivered.mp4','synthetic delivered bytes');f.put('evidence.json',{});
 Object.assign(f.cfg,{state:'reference',export:{file:'delivered.mp4',sha256:digest(join(f.base,'delivered.mp4'))},evidence:['evidence.json']});f.save();
 const before=tree(f.base),text=cli('flujo.mjs',[f.base,'--rapido']),json=cli('flujo.mjs',[f.base,'--rapido','--json']);
 assert.equal(text.status,0,text.stderr);assert.equal(text.status,json.status,json.stderr);assert.match(text.stdout,/ENTREGADO/);assert.equal(JSON.parse(json.stdout).entregado,true);assert.deepEqual(tree(f.base),before);
});
test('registered project declared ENTREGADO is closed, and reopening it lifts the marker',t=>{
 /* 2-nov-2026: 8 videos de Chris ya entregados (programar, adobe, cloudflare…) tienen pipeline.json pero no el recibo de
    entrega con huella (son anteriores a él). El router los mostraba pendientes y pedía construir el hook. Walter: «entregados todos». */
 const f=fixture(t);f.approve(scenes(f.base)[0]);
 assert.equal(registeredStatus(f.base,'x',{fast:true}).entregado,undefined);
 f.put('ENTREGADO.json',{fecha:'2026-10-08',donde:null,nota:'#15 Adobe'});
 const r=registeredStatus(f.base,'x',{fast:true});
 assert.equal(r.entregado,true);assert.equal(r.declarado,true);assert.equal(r.bloqueo,null);
 const e=r.ch.find(c=>c.estado==='ENTREGADO');assert.match(e.detalle,/2026-10-08/);assert.match(e.detalle,/sin huella/);
 assert.ok(!r.ch.some(c=>['NO VERIFICABLE','BLOQUEADO'].includes(c.estado)),JSON.stringify(r.ch));
 assert.equal(cli('workflow-state.mjs',[f.base,'reopen','--task','cambio autorizado de prueba']).status,0);
 assert.ok(!existsSync(join(f.base,'ENTREGADO.json')));assert.ok(readdirSync(f.base).some(n=>/^ENTREGADO\.reabierto-.+\.json$/.test(n)));
 assert.notEqual(registeredStatus(f.base,'x',{fast:true}).entregado,true);
 f.put('ENTREGADO.json','{roto');const b=registeredStatus(f.base,'x',{fast:true});
 assert.notEqual(b.entregado,true);assert.ok(b.ch.some(c=>c.estado==='NO VERIFICABLE'&&c.nombre==='ENTREGA'));
});
