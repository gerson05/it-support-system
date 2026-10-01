import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nameWords, usernameCandidates, suggestUsername, suggestPassword, isValidUsername, isValidPassword,
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

test('suggestPassword: 4 digits, skips taken ones, keeps leading zeros', async () => {
  const seq = [1234, 7, 9999];
  const pw = await suggestPassword(taken('1234'), () => seq.shift());
  assert.equal(pw, '0007');
  const random = await suggestPassword(taken());
  assert.match(random, /^\d{4}$/);
});

test('suggestPassword: gives up when everything is taken', async () => {
  await assert.rejects(() => suggestPassword(async () => true, () => 1), { code: 'PASSWORD_EXHAUSTED' });
});

test('isValidUsername / isValidPassword', () => {
  assert.equal(isValidUsername('GGOSORIO'), true);
  assert.equal(isValidUsername('GGOSORIO2'), true);
  assert.equal(isValidUsername('gg'), false);
  assert.equal(isValidUsername('G'), false);
  assert.equal(isValidUsername('GG OSORIO'), false);
  assert.equal(isValidPassword('0042'), true);
  assert.equal(isValidPassword('42'), false);
  assert.equal(isValidPassword('abcd'), false);
});
