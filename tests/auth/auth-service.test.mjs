import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mutable mock — tests can override per-call
let _mockGet = () => null;
let _mockAll = () => [];
let _mockRun = () => ({ changes: 1 });

await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: (sql) => ({
        run:  (...a) => _mockRun(sql, ...a),
        get:  (...a) => _mockGet(sql, ...a),
        all:  (...a) => _mockAll(sql, ...a),
      }),
    },
  },
});

const {
  hashPassword, verifyPassword,
  createSession, getSession, deleteSession, deleteUserSessions, initAdminUser,
} = await import('../../src/auth/auth-service.js');

function resetMocks() {
  _mockGet = () => null;
  _mockAll = () => [];
  _mockRun = () => ({ changes: 1 });
}

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

// ── createSession ─────────────────────────────────────────────────────────────

test('createSession: returns token and expiresAt', () => {
  const result = createSession(42);
  assert.ok(typeof result.token === 'string');
  assert.equal(result.token.length, 64); // 32 bytes hex = 64 chars
  assert.ok(typeof result.expiresAt === 'string');
  assert.ok(result.expiresAt.includes('T')); // ISO format
  resetMocks();
});

test('createSession: token is unique per call', () => {
  const r1 = createSession(1);
  const r2 = createSession(1);
  assert.notEqual(r1.token, r2.token);
  resetMocks();
});

// ── getSession ────────────────────────────────────────────────────────────────

test('getSession: null token returns null without db call', () => {
  let called = false;
  _mockGet = () => { called = true; return null; };
  assert.equal(getSession(null), null);
  assert.equal(called, false);
  resetMocks();
});

test('getSession: valid token with no session row returns null', () => {
  _mockGet = () => null;
  assert.equal(getSession('sometoken'), null);
  resetMocks();
});

test('getSession: inactive user returns null', () => {
  _mockGet = () => ({ user_id: 1, active: 0, role_id: 1, username: 'bob', role_name: 'agent' });
  assert.equal(getSession('tok'), null);
  resetMocks();
});

test('getSession: valid active session returns user object with permissions', () => {
  let getCallCount = 0;
  _mockGet = () => {
    getCallCount++;
    if (getCallCount === 1) return { user_id: 5, active: 1, role_id: 2, username: 'alice', role_name: 'admin' };
    return null;
  };
  _mockAll = () => [{ name: 'tickets:read' }, { name: 'tickets:write' }];
  const user = getSession('validtok');
  assert.equal(user.id, 5);
  assert.equal(user.username, 'alice');
  assert.equal(user.role, 'admin');
  assert.deepEqual(user.permissions, ['tickets:read', 'tickets:write']);
  resetMocks();
});

// ── deleteSession ─────────────────────────────────────────────────────────────

test('deleteSession: calls db run with token', () => {
  let ranWith;
  _mockRun = (_sql, tok) => { ranWith = tok; return { changes: 1 }; };
  deleteSession('mytoken');
  assert.equal(ranWith, 'mytoken');
  resetMocks();
});

// ── deleteUserSessions ────────────────────────────────────────────────────────

test('deleteUserSessions: calls db run with user id', () => {
  let ranWith;
  _mockRun = (_sql, uid) => { ranWith = uid; return { changes: 1 }; };
  deleteUserSessions(7);
  assert.equal(ranWith, 7);
  resetMocks();
});

// ── initAdminUser ─────────────────────────────────────────────────────────────

test('initAdminUser: skips creation when users already exist', async () => {
  let insertCalled = false;
  _mockGet = () => ({ n: 1 });
  _mockRun = (sql) => { if (sql.includes('INSERT INTO users')) insertCalled = true; return { changes: 1 }; };
  await initAdminUser();
  assert.equal(insertCalled, false);
  resetMocks();
});

test('initAdminUser: creates admin user when table is empty', async () => {
  let insertCalled = false;
  _mockGet = () => ({ n: 0 });
  _mockRun = (sql) => { if (sql.includes('INSERT INTO users')) insertCalled = true; return { changes: 1 }; };
  const logSpy = mock.method(console, 'log', () => {});
  try {
    await initAdminUser();
  } finally {
    logSpy.mock.restore();
  }
  assert.equal(insertCalled, true);
  resetMocks();
});
