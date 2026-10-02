import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nameWords, usernameCandidates, suggestUsername, claveDesdeCedula,
} from '../../src/employees/credentials.js';

const taken = (...names) => async (u) => names.includes(u);

test('nameWords: uppercase, no accents, Ñ → N, ignores symbols', () => {
  assert.deepEqual(nameWords('  Alba Lucía  Ospina-Castañeda '), ['ALBA', 'LUCIA', 'OSPINA', 'CASTANEDA']);
  assert.deepEqual(nameWords(''), []);
  assert.deepEqual(nameWords(null), []);
});

test('usernameCandidates: matches real Mantis users', () => {
  assert.equal(usernameCandidates('GLADYS GARCIA OSORIO')[0], 'GGOSORIO');
  assert.equal(usernameCandidates('ALBA LUCIA OSPINA CASTAÑEDA')[0], 'AOCASTANEDA');
  assert.equal(usernameCandidates('MARLLURY CAROLINA HERRERA PINILLA')[0], 'MHPINILLA');
});

test('usernameCandidates: alternative uses first surname as main', () => {
  assert.deepEqual(usernameCandidates('LISETH DAYANA HERRERA ROSERO'), ['LHROSERO', 'LDHERRERA']);
  assert.deepEqual(usernameCandidates('GLADYS GARCIA OSORIO'), ['GGOSORIO', 'GOGARCIA']);
});

test('usernameCandidates: short names', () => {
  assert.deepEqual(usernameCandidates(''), []);
  assert.deepEqual(usernameCandidates('Maria'), ['MARIA']);
  assert.deepEqual(usernameCandidates('Juan Perez'), ['JPEREZ', 'JUPEREZ']);
  assert.deepEqual(usernameCandidates('Ana Ana Ana'), ['AAANA']);
});

test('suggestUsername: base, then alternative, then numbered', async () => {
  const name = 'LISETH DAYANA HERRERA ROSERO';
  assert.equal(await suggestUsername(name, taken()), 'LHROSERO');
  assert.equal(await suggestUsername(name, taken('LHROSERO')), 'LDHERRERA');
  assert.equal(await suggestUsername(name, taken('LHROSERO', 'LDHERRERA')), 'LHROSERO2');
  assert.equal(await suggestUsername(name, taken('LHROSERO', 'LDHERRERA', 'LHROSERO2')), 'LHROSERO3');
  assert.equal(await suggestUsername('', taken()), '');
});

test('suggestUsername: gives up after many collisions', async () => {
  await assert.rejects(() => suggestUsername('Juan Perez', async () => true), { code: 'USERNAME_EXHAUSTED' });
});

test('claveDesdeCedula: last 4 digits, padded when shorter', () => {
  assert.equal(claveDesdeCedula('1130658563'), '8563');
  assert.equal(claveDesdeCedula('1.130.658.563'), '8563');
  assert.equal(claveDesdeCedula(1107095763), '5763');
  assert.equal(claveDesdeCedula('123'), '0123');
  assert.equal(claveDesdeCedula(''), '0000');
});
