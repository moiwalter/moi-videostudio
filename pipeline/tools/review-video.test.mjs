import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { template, fingerprint, checkReview } from './review-video.mjs';
import {ROOT as root,refreshCatalog} from './project.mjs';
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'video-review-test-'));
  t.after(() => { if (!dir.includes("video-review-test-")) throw Error("Unexpected fixture cleanup path"); rmSync(dir, { recursive: true, force: true }); });
  mkdirSync(join(dir, 'master')); mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'master/index.html'), '<video src="../assets/subject.webm"></video><link href="style.css" rel="stylesheet">');
  writeFileSync(join(dir, 'master/style.css'), 'body{color:#fff}');
  writeFileSync(join(dir, 'assets/subject.webm'), 'synthetic test input; not media');
  writeFileSync(join(dir, 'evidence.txt'), 'test receipt evidence');
  const receipt = template();
  const save = () => writeFileSync(join(dir, 'REVIEW.json'), JSON.stringify(receipt));
  const pass = phase => {
    receipt[phase].fingerprint = fingerprint(dir, receipt).sha256;
    for (const c of Object.values(receipt[phase].checks)) Object.assign(c, { status: 'pass', note: 'synthetic unit-test declaration; not production QA' });
    receipt[phase].evidence = ['evidence.txt']; save();
  };
  save(); return { dir, receipt, save, pass };
}
test('pending review cannot pass; evidence and notes are required', t => {
  const f = fixture(t); assert.equal(checkReview(f.dir).ok, false);
  f.pass('preview'); assert.equal(checkReview(f.dir).ok, true);
  f.receipt.preview.evidence = ['missing.jpg']; f.save(); assert.equal(checkReview(f.dir).ok, false);
  f.receipt.preview.evidence = ['evidence.txt']; f.receipt.preview.checks.visual.note = ''; f.save(); assert.equal(checkReview(f.dir).ok, false);
});
test('replacing alpha invalidates a review even if index stays identical', t => {
  const f = fixture(t); f.pass('preview'); const before = digest(join(f.dir, 'master/index.html'));
  writeFileSync(join(f.dir, 'assets/subject.webm'), 'different mask');
  assert.equal(digest(join(f.dir, 'master/index.html')), before);
  assert.equal(checkReview(f.dir).ok, false);
});
test('HTML and CSS changes invalidate the recorded input fingerprint', t => {
  const f = fixture(t); f.pass('preview');
  writeFileSync(join(f.dir, 'master/style.css'), 'body{color:#000}'); assert.equal(checkReview(f.dir).ok, false);
  f.pass('preview'); writeFileSync(join(f.dir, 'master/index.html'), '<main>new scene</main>'); assert.equal(checkReview(f.dir).ok, false);
});
test('nested HyperFrames assets resolve from the composition root and invalidate review', t => {
  const f = fixture(t);
  mkdirSync(join(f.dir, 'master/compositions/frames'), {recursive:true});
  mkdirSync(join(f.dir, 'master/assets'));
  writeFileSync(join(f.dir, 'master/index.html'), '<div data-composition-src="compositions/frames/S01.html"></div>');
  writeFileSync(join(f.dir, 'master/compositions/frames/S01.html'), '<template><img src="assets/logo.svg"></template>');
  writeFileSync(join(f.dir, 'master/assets/logo.svg'), '<svg>first</svg>');
  f.pass('preview'); assert.equal(checkReview(f.dir).ok, true);
  assert.ok(fingerprint(f.dir, f.receipt).inputs.includes('master/assets/logo.svg'));
  writeFileSync(join(f.dir, 'master/assets/logo.svg'), '<svg>replacement</svg>');
  assert.equal(checkReview(f.dir).ok, false);
});
test('export review requires the actual output and detects replacement', t => {
  const f = fixture(t); f.pass('preview'); f.pass('export'); assert.equal(checkReview(f.dir, 'export').ok, false);
  writeFileSync(join(f.dir, 'final.mp4'), 'synthetic output');
  Object.assign(f.receipt.export, { file: 'final.mp4', sha256: digest(join(f.dir, 'final.mp4')) }); f.save();
  assert.equal(checkReview(f.dir, 'export').ok, true);
  writeFileSync(join(f.dir, 'final.mp4'), 'replaced output'); assert.equal(checkReview(f.dir, 'export').ok, false);
});
test('not-applicable requires a reason and is limited to optional layers/audio', t => {
  const f = fixture(t); f.pass('preview'); f.receipt.preview.checks.layers = { status: 'not_applicable', note: 'No foreground cutout in this fixture' }; f.save(); assert.equal(checkReview(f.dir).ok, true);
  f.receipt.preview.checks.layers.note = ''; f.save(); assert.equal(checkReview(f.dir).ok, false);
  f.pass('preview'); f.receipt.preview.checks.visual.status = 'not_applicable'; f.save(); assert.equal(checkReview(f.dir).ok, false);
});
test('CLI fails on unknown stages and refuses to overwrite existing receipt', t => {
  const f = fixture(t); const run = args => spawnSync(process.execPath, [join(root, 'pipeline/tools/review-video.mjs'), f.dir, ...args], { encoding: 'utf8' });
  assert.equal(run(['--check', '--stage', 'exportt']).status, 1);
  const before = readFileSync(join(f.dir, 'REVIEW.json'), 'utf8'); assert.equal(run(['--init']).status, 1); assert.equal(readFileSync(join(f.dir, 'REVIEW.json'), 'utf8'), before);
});
test('new Cvander MASTER receives brand, guidance and pending review; existing brand output stays scoped', t => {
  const slug = `_test-cvander-pipeline-${process.pid}`; const dir = join(root, 'proyectos/cvander', slug, 'edicion');
  assert.equal(existsSync(dir), false);
  t.after(() => { rmSync(dirname(dir), { recursive: true, force: true }); refreshCatalog(root); });
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  const built = run('bash', ['tools/new-video.sh', slug, '--marca', 'cvander', '--carril', 'master']); assert.equal(built.status, 0, built.stderr);
  assert.equal(JSON.parse(readFileSync(join(dir, 'brand.json'))).name, 'cvander');
  // 1-nov-2026: la marca ya no trae videoWorkflow; el formato sale de estiloPorDefecto y la guía de Chris del archivo de cliente.
  const production = readFileSync(join(dir, 'PRODUCTION.md'), 'utf8');
  assert.match(production, /EDITING STYLE: Layered Talking Head/);
  assert.match(production, /CLIENTE: Christian Van Der Henst/);
  assert.match(production, /edicion_por_capas\.md/);
  assert.match(readFileSync(join(dir, 'master/_tokens.css'), 'utf8'), /font-family:'Rubik'/);
  assert.match(readFileSync(join(dir, 'master/_tokens.css'), 'utf8'), /font-weight:200 900/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'REVIEW.json'))).preview.checks.layers.status, 'pending');
  const brief = run(process.execPath, ['tools/brief.mjs', slug, '--direccion', 'Dirección de prueba', '--check']); assert.equal(brief.status, 0, brief.stderr);
  assert.equal(JSON.parse(readFileSync(join(dir, 'master/BRIEF.json'))).marca.slug, 'cvander');
  // Removing the receipt must not silently opt a newly scaffolded project out.
  rmSync(join(dir, 'REVIEW.json'));
  const refused = run(process.execPath, ['tools/flujo.mjs', slug, '--entregado']); assert.equal(refused.status, 1); assert.equal(existsSync(join(dir, 'ENTREGADO.json')), false);
  const moi = run(process.execPath, ['tools/brand.mjs', 'brief', 'moi']); assert.equal(moi.status, 0); assert.doesNotMatch(moi.stdout, /FLUJO DE VIDEO: cvander-layered|Rubik|Lineal/);
});
