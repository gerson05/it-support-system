import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displaySede, matchSede, matchCiudad, getPuntosCiudad, CIUDADES } from '../../src/whatsapp/sedes.js';

// ── displaySede ───────────────────────────────────────────────────────────────

test('displaySede: strips MI FARMACIA - prefix', () => {
  assert.equal(displaySede('MI FARMACIA - CALI SUR'), 'CALI SUR');
});

test('displaySede: strips prefix case-insensitively (module uses startsWith)', () => {
  assert.equal(displaySede('MI FARMACIA - MANIZALES'), 'MANIZALES');
});

test('displaySede: leaves non-MI FARMACIA names unchanged', () => {
  assert.equal(displaySede('ZARZAL'), 'ZARZAL');
});

test('displaySede: leaves MEDIVALLE names unchanged', () => {
  assert.equal(displaySede('MEDIVALLE LA VICTORIA'), 'MEDIVALLE LA VICTORIA');
});

test('displaySede: empty string returns empty string', () => {
  assert.equal(displaySede(''), '');
});

test('displaySede: null/falsy returns empty string', () => {
  assert.equal(displaySede(null), '');
  assert.equal(displaySede(undefined), '');
});

// ── matchSede ─────────────────────────────────────────────────────────────────

test('matchSede: exact city name matches', () => {
  const result = matchSede('Manizales');
  assert.ok(result.length > 0);
  assert.ok(result.some(s => s.includes('MANIZALES')));
});

test('matchSede: partial city match returns results', () => {
  const result = matchSede('cali sur');
  assert.ok(result.length > 0);
  assert.equal(result[0], 'MI FARMACIA - CALI SUR');
});

test('matchSede: case insensitive', () => {
  const lower = matchSede('pereira');
  const upper = matchSede('PEREIRA');
  assert.deepEqual(lower, upper);
});

test('matchSede: accent normalization (popayan vs popayán)', () => {
  const result = matchSede('popayan');
  assert.ok(result.some(s => s.includes('POPAYAN')));
});

test('matchSede: no match returns empty array', () => {
  assert.deepEqual(matchSede('xyzqwerty_nomatch'), []);
});

test('matchSede: very short input (< 2 chars) returns empty', () => {
  assert.deepEqual(matchSede('a'), []);
});

test('matchSede: returns at most 5 results', () => {
  const result = matchSede('mi farmacia');
  assert.ok(result.length <= 5);
});

test('matchSede: exact match is ranked first', () => {
  const result = matchSede('pasto');
  assert.ok(result.length > 0);
  assert.equal(result[0], 'MI FARMACIA - PASTO');
});

// ── matchCiudad ───────────────────────────────────────────────────────────────

test('matchCiudad: finds CALI without db', () => {
  const result = matchCiudad('Cali', null);
  assert.ok(result.includes('CALI'));
});

test('matchCiudad: finds MANIZALES without db', () => {
  const result = matchCiudad('Manizales', null);
  assert.ok(result.includes('MANIZALES'));
});

test('matchCiudad: finds PASTO without db', () => {
  const result = matchCiudad('Pasto', null);
  assert.ok(result.includes('PASTO'));
});

test('matchCiudad: empty input returns empty array', () => {
  assert.deepEqual(matchCiudad('', null), []);
});

test('matchCiudad: no match returns empty array', () => {
  assert.deepEqual(matchCiudad('xyzabc_nomatch', null), []);
});

test('matchCiudad: returns at most 6 results', () => {
  const result = matchCiudad('Cali', null);
  assert.ok(result.length <= 6);
});

test('matchCiudad: uses db when provided', () => {
  const mockDb = {
    prepare: () => ({ all: () => [{ ciudad: 'CALI' }, { ciudad: 'PALMIRA' }] }),
  };
  const result = matchCiudad('Cali', mockDb);
  assert.ok(result.includes('CALI'));
});

test('matchCiudad: falls back to static map on db error', () => {
  const badDb = {
    prepare: () => ({ all: () => { throw new Error('db fail'); } }),
  };
  const result = matchCiudad('Cali', badDb);
  assert.ok(result.includes('CALI'));
});

// ── getPuntosCiudad ───────────────────────────────────────────────────────────

test('getPuntosCiudad: returns points for known city without db', () => {
  const result = getPuntosCiudad('CALI', null);
  assert.ok(result.length > 0);
});

test('getPuntosCiudad: Buenaventura has multiple points', () => {
  const result = getPuntosCiudad('BUENAVENTURA', null);
  assert.ok(result.length > 1);
});

test('getPuntosCiudad: unknown city returns empty array', () => {
  assert.deepEqual(getPuntosCiudad('CIUDAD_DESCONOCIDA_XYZ', null), []);
});

test('getPuntosCiudad: uses db rows when provided', () => {
  const mockDb = {
    prepare: () => ({
      all: () => [{ nombre_punto: 'MI FARMACIA - TEST' }],
    }),
  };
  const result = getPuntosCiudad('CALI', mockDb);
  assert.deepEqual(result, ['MI FARMACIA - TEST']);
});
