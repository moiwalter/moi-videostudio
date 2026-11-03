/* El formato qmd-vertical: perillas medidas, marca, componentes y la aritmética de los tools.
   La suite de node es la que corre el repo (`node --test pipeline/tools/*.test.mjs`);
   las cuentas de Python las dispara este archivo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from './project.mjs';
import {loadStyle} from './style.mjs';
import {validarPerillas} from './capas.mjs';

const tools = join(ROOT, 'pipeline/tools');
const py = spawnSync('python3', ['-m', 'unittest', 'qmd_lib_test'], {cwd: tools, encoding: 'utf8'});

test('la aritmética de qmd-vertical pasa', () => {
  assert.equal(py.status, 0, py.stdout + py.stderr);
});

test('el formato declara perillas medidas y las dos orientaciones', () => {
  const s = loadStyle('qmd-vertical');
  assert.deepEqual(validarPerillas(s), []);
  assert.ok(s.perillas.duracionHook && s.perillas.duracionEscena);
  assert.equal(s.perillas.lightWrap.default, 0.22);
  assert.equal(s.perillas.zoomMax.default, 1.19);
  assert.deepEqual(s.engines.orientaciones, ['1080x1920', '1920x1080']);
  assert.equal(s.engines.videoFrameFormat, 'png');
  for (const p of Object.values(s.perillas)) assert.ok(!/walter|chris|qmd/i.test(p.que), p.que);
});

test('la marca qmd es el look claro, con el verde de cierre, y el oscuro está retirado', () => {
  const b = JSON.parse(readFileSync(join(ROOT, 'biblioteca/marcas/qmd.json'), 'utf8'));
  assert.equal(b.palette.paper, '#f6f6f2');
  assert.equal(b.palette.green, '#0b4d35');
  assert.equal(b.estiloPorDefecto, 'qmd-vertical');
  assert.equal(b.fonts.display, 'Instrument Sans');
  assert.ok(b.retiredModes.includes('dark'));
  assert.equal(b.modes.dark, undefined);
  const tok = spawnSync(process.execPath, [join(tools, 'brand.mjs'), 'tokens', 'qmd'], {encoding: 'utf8'});
  assert.equal(tok.status, 0, tok.stderr);
  assert.match(tok.stdout, /--paper:\s*#f6f6f2/);
  assert.match(tok.stdout, /Instrument Sans/);
  assert.doesNotMatch(tok.stdout, /mode-dark/);
});

test('los componentes compartidos están y el grano no se pinta sobre la cara', () => {
  const dir = join(ROOT, 'pipeline/componentes');
  for (const f of ['takeovers/takeovers.css', 'takeovers/transitions.js', 'odometro.css', 'odometro.js', 'fondos-luz.css', 'rejilla-logos.css', 'subtitulos.css', 'fin-verde.css', 'placa.css'])
    assert.ok(readFileSync(join(dir, f), 'utf8').length > 40, f);
  const grano = readFileSync(join(dir, 'fondos-luz.css'), 'utf8');
  const placa = readFileSync(join(dir, 'placa.css'), 'utf8');
  assert.match(grano, /z-index:\s*17/);
  assert.match(placa, /z-index:\s*18/);
  const fin = readFileSync(join(dir, 'fin-verde.html'), 'utf8');
  assert.match(fin, /quotemydata\.com/);
  assert.doesNotMatch(fin, /CTA|sign up|book a/i);
  const tk = readFileSync(join(dir, 'takeovers/transitions.js'), 'utf8');
  assert.match(tk, /brightness\(0\)/);
});

test('los tools no tienen rutas fijas de la máquina donde se armó goldmine', () => {
  const mal = [/\/workspace\/pipelines/, /\/home\/box/, /VideoStudio-qmd/];
  const names = readdirSync(tools).filter(f => /^(rvm_matte|make_alpha|fix_matte|head_anchor|cut_master|refine_words|music|master_mix|sfx|qa|edge_flicker|edge_compare|frames|probe|qmd-voz|qmd_lib)/.test(f));
  assert.ok(names.length >= 12, names.join(','));
  for (const f of names) {
    const t = readFileSync(join(tools, f), 'utf8');
    for (const re of mal) assert.equal(re.test(t), false, `${f} contiene ${re}`);
  }
});
