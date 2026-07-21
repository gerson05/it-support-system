import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock database before importing auth-service (module uses db at top level)
await mock.module('../config/database.js', {
  exports: {
    default: {
      prepare: () => ({
        run:  () => ({ changes: 1 }),
        get:  () => null,
        all:  () => [],
      }),
    },
  },
});

const { hashPassword, verifyPassword } = await import('./auth-service.js');

// ── hashPassword ──────────────────────────────────────────────────────────────

test('hashPassword: returns a bcrypt hash string', async () => {
  const hash = await hashPassword('mypassword');
  assert.ok(typeof hash === 'string');
  assert.ok(hash.startsWith('$2'));
  assert.ok(hash.length > 40);
});

test('hashPassword: same input produces different hashes (salt)', async () => {
  const hash1 = await hashPassword('same');
  const hash2 = await hashPassword('same');
  assert.notEqual(hash1, hash2);
});

test('hashPassword: empty string produces a valid hash', async () => {
  const hash = await hashPassword('');
  assert.ok(hash.startsWith('$2'));
});

// ── verifyPassword ────────────────────────────────────────────────────────────

test('verifyPassword: correct password returns true', async () => {
  const hash = await hashPassword('secret123');
  assert.equal(await verifyPassword('secret123', hash), true);
});

test('verifyPassword: wrong password returns false', async () => {
  const hash = await hashPassword('secret123');
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('verifyPassword: empty string against non-empty hash returns false', async () => {
  const hash = await hashPassword('notempty');
  assert.equal(await verifyPassword('', hash), false);
});

test('verifyPassword: correct after empty-string hash', async () => {
  const hash = await hashPassword('');
  assert.equal(await verifyPassword('', hash), true);
  assert.equal(await verifyPassword('x', hash), false);
});

test('verifyPassword: round-trips multiple passwords', async () => {
  const passwords = ['abc', 'P@$$w0rd!', '12345678', 'contraseña'];
  for (const pw of passwords) {
    const hash = await hashPassword(pw);
    assert.equal(await verifyPassword(pw, hash), true);
    assert.equal(await verifyPassword(pw + 'x', hash), false);
  }
});
