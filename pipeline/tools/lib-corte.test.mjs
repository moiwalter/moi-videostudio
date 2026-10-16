import test from 'node:test';
import assert from 'node:assert/strict';
import {durationOfEdit, cuadraConElCorte} from './lib-corte.mjs';

test('a preserved black tail outside the registered edit does not reject its transcript', () => {
  const transcript = {dur: 100.04, identityBound: true};
  const dur = durationOfEdit(117.26, {start: 0, end: 100.3});
  assert.equal(dur, 100.3);
  assert.equal(cuadraConElCorte(transcript, {dur}).veredicto, 'ok');
  assert.equal(cuadraConElCorte(transcript, {dur: 117.26}).veredicto, 'otra-toma');
});

test('untrimmed and valid nonzero-start edit durations remain accurate', () => {
  assert.equal(durationOfEdit(117.26), 117.26);
  assert.equal(durationOfEdit(null), null);
  assert.equal(durationOfEdit(20, {start: 3, end: 15}), 12);
  assert.equal(durationOfEdit(20, {start: 3}), 17);
});

test('invalid trim ranges fail instead of hiding a source mismatch', () => {
  for (const trim of [{start: -1, end: 10}, {start: 10, end: 10}, {end: 21}, {end: NaN}, {end: '10'}]) {
    assert.throws(() => durationOfEdit(20, trim), /source.trim/);
  }
  assert.throws(() => durationOfEdit(null, {end: 10}), /source.trim/);
});
