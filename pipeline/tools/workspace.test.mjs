import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync,symlinkSync,cpSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {ROOT,projects,resolveProject,newProjectPath,projectSlug,registerProject,refreshCatalog} from './project.mjs';
function fixture(t){const root=mkdtempSync(join(tmpdir(),'workspace-layout-test-'));t.after(()=>{assert.match(root,/workspace-layout-test-/);rmSync(root,{recursive:true,force:true});});return root;}
test('nested projects resolve by client and reject duplicate bare slugs',t=>{const root=fixture(t);for(const client of ['one','two'])mkdirSync(join(root,'proyectos',client,'episode','edicion'),{recursive:true});mkdirSync(join(root,'pipeline'));mkdirSync(join(root,'biblioteca'));assert.deepEqual(projects(root),['one/episode','two/episode']);assert.throws(()=>resolveProject('episode',root),/ambiguo/);assert.equal(resolveProject('one/episode',root),join(root,'proyectos/one/episode/edicion'));assert.equal(projectSlug(resolveProject('one/episode',root)),'episode');assert.equal(resolveProject(join(root,'proyectos/one/episode'),root),join(root,'proyectos/one/episode/edicion'));});
test('new projects create adjacent media folders and a catalog without losing existing projects',t=>{const root=fixture(t);for(const slug of ['first','second']){const base=newProjectPath(slug,'client',root);mkdirSync(base,{recursive:true});registerProject(base,'client',root);assert.equal(JSON.parse(readFileSync(join(root,'proyectos/client',slug,'PROYECTO.json'))).editable,'edicion');}assert.equal(JSON.parse(readFileSync(join(root,'catalogo.json'))).projects.length,2);assert.throws(()=>newProjectPath('../escape','client',root),/inválido/);assert.throws(()=>newProjectPath('first','client',root),/existente/);});
test('project CLI still executes through a compatibility symlink',t=>{const root=fixture(t),alias=join(root,'project.mjs');symlinkSync(join(ROOT,'pipeline/tools/project.mjs'),alias);const r=spawnSync(process.execPath,[alias,'root'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),ROOT);});

test('catalog refresh preserves workspace metadata and removes deleted fixture entries',t=>{const root=fixture(t);writeFileSync(join(root,'catalogo.json'),JSON.stringify({schemaVersion:1,unclassifiedPackages:[{folder:'archive'}],projects:[]}));const base=newProjectPath('episode','client',root);mkdirSync(base,{recursive:true});registerProject(base,'client',root);rmSync(join(root,'proyectos/client/episode'),{recursive:true});refreshCatalog(root);const c=JSON.parse(readFileSync(join(root,'catalogo.json')));assert.equal(c.projects.length,0);assert.equal(c.unclassifiedPackages[0].folder,'archive');});

test('intake can initialize later without overwriting an existing editor or provenance',t=>{
 const root=fixture(t),project=join(root,'proyectos/client/episode'),base=join(project,'edicion');
 mkdirSync(base,{recursive:true});mkdirSync(join(project,'originales'));
 writeFileSync(join(project,'originales/recording.mp4'),'synthetic intake');
 const index={schemaVersion:1,state:'intake-pending',client:'client',slug:'episode',sources:[{file:'originales/recording.mp4',from:'/test-input/recording.mp4'}]};
 writeFileSync(join(project,'PROYECTO.json'),JSON.stringify(index));
 assert.equal(newProjectPath('episode','client',root),base);
 writeFileSync(join(base,'pipeline.json'),JSON.stringify({schemaVersion:1,lane:'MASTER',engine:{name:'remotion',version:'4.0.525',entry:'src/index.ts'}}));
 registerProject(base,'client',root);
 const updated=JSON.parse(readFileSync(join(project,'PROYECTO.json')));
 assert.equal(updated.state,'created');assert.deepEqual(updated.sources,index.sources);assert.equal(updated.engine.name,'remotion');
 assert.throws(()=>newProjectPath('episode','client',root),/existente/);
 assert.equal(readFileSync(join(project,'originales/recording.mp4'),'utf8'),'synthetic intake');
 // An incorrect pending label must not make existing editor content replaceable.
 writeFileSync(join(project,'PROYECTO.json'),JSON.stringify(index));
 assert.throws(()=>newProjectPath('episode','client',root),/existente/);
});

test('fresh and intake scaffolds register both engines and lanes in an isolated workspace',t=>{
 const root=fixture(t);
 for(const folder of ['pipeline/tools','pipeline/styles','pipeline/templates'])cpSync(join(ROOT,folder),join(root,folder),{recursive:true});
 mkdirSync(join(root,'biblioteca/marcas'),{recursive:true});mkdirSync(join(root,'biblioteca/design_system/fonts'),{recursive:true});
 cpSync(join(ROOT,'biblioteca/marcas/moi.json'),join(root,'biblioteca/marcas/moi.json'));
 for(const [engine,lane] of [['hyperframes','master'],['hyperframes','kit'],['remotion','master']])for(const intake of [false,true]){
  const slug=`${engine}-${lane}-${intake?'intake':'fresh'}`,project=join(root,'proyectos/moi',slug),base=join(project,'edicion');
  if(intake){mkdirSync(base,{recursive:true});mkdirSync(join(project,'originales'));writeFileSync(join(project,'originales/source.mp4'),'synthetic input');writeFileSync(join(project,'PROYECTO.json'),JSON.stringify({state:'intake-pending',client:'moi',slug,sources:['originales/source.mp4']}));}
  const args=[join(root,'pipeline/tools/new-video.sh'),slug,'--marca','moi','--carril',lane,'--engine',engine];
  const run=()=>spawnSync('bash',args,{encoding:'utf8',timeout:20000});
  const r=run();assert.equal(r.status,0,r.stderr);
  const index=JSON.parse(readFileSync(join(project,'PROYECTO.json')));
  assert.equal(index.engine.name,engine);assert.equal(JSON.parse(readFileSync(join(base,'pipeline.json'))).lane,lane.toUpperCase());
  for(const folder of ['originales','recursos','revision','entregas'])assert.ok(existsSync(join(project,folder)));
  if(intake){assert.deepEqual(index.sources,['originales/source.mp4']);assert.equal(readFileSync(join(project,'originales/source.mp4'),'utf8'),'synthetic input');}
  const configBefore=readFileSync(join(base,'pipeline.json'),'utf8');assert.notEqual(run().status,0);assert.equal(readFileSync(join(base,'pipeline.json'),'utf8'),configBefore);
 }
 assert.equal(JSON.parse(readFileSync(join(root,'catalogo.json'))).projects.length,6);
});
