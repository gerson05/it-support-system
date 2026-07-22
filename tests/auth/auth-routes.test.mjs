import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── Controllable stubs ──────────────────────────────────────────────────────
let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });
let _verifyPassword = async () => true;

await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: (sql) => ({
        get:  (...a) => _get(sql, ...a),
        all:  (...a) => _all(sql, ...a),
        run:  (...a) => _run(sql, ...a),
      }),
      exec: () => {},
    },
  },
});

await mock.module('../../src/auth/auth-service.js', {
  exports: {
    verifyPassword: async (plain, hash) => _verifyPassword(plain, hash),
    createSession:  (_userId) => ({ token: 'test-token-123', expiresAt: new Date().toISOString() }),
    deleteSession:  (_token) => {},
  },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => {
      _req.user        = { id: 99, username: 'tester', role: 'admin' };
      _req.permissions = ['tickets:read', 'metrics:read'];
      next();
    },
    requirePermission: () => (_req, _res, next) => next(),
  },
});

const router = (await import('../../src/auth/auth-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

// ── Helper ──────────────────────────────────────────────────────────────────
async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json, headers: res.headers };
}

// ── POST /api/auth/login ────────────────────────────────────────────────────

test('POST /api/auth/login – 400 when username missing', async () => {
  const { status, body } = await req('POST', '/api/auth/login', { password: 'secret' });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/);
});

test('POST /api/auth/login – 400 when password missing', async () => {
  const { status, body } = await req('POST', '/api/auth/login', { username: 'alice' });
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/);
});

test('POST /api/auth/login – 400 when body is empty', async () => {
  const { status, body } = await req('POST', '/api/auth/login', {});
  assert.equal(status, 400);
  assert.match(body.error, /requeridos/);
});

test('POST /api/auth/login – 401 when user not found in db', async () => {
  _get = () => null;           // no user row returned
  _verifyPassword = async () => true;
  const { status, body } = await req('POST', '/api/auth/login', { username: 'ghost', password: 'x' });
  assert.equal(status, 401);
  assert.match(body.error, /Credenciales/);
});

test('POST /api/auth/login – 401 when password wrong', async () => {
  _get = (sql) => {
    if (/users WHERE username/.test(sql)) return { id: 1, password_hash: 'hash', active: 1, role_id: 2 };
    return null;
  };
  _verifyPassword = async () => false;
  const { status, body } = await req('POST', '/api/auth/login', { username: 'alice', password: 'wrong' });
  assert.equal(status, 401);
  assert.match(body.error, /Credenciales/);
});

test('POST /api/auth/login – 403 when user is inactive', async () => {
  _get = (sql) => {
    if (/users WHERE username/.test(sql)) return { id: 1, password_hash: 'hash', active: 0, role_id: 2 };
    return null;
  };
  _verifyPassword = async () => true;
  const { status, body } = await req('POST', '/api/auth/login', { username: 'alice', password: 'correct' });
  assert.equal(status, 403);
  assert.match(body.error, /desactivada/);
});

test('POST /api/auth/login – 200 and returns role on valid credentials', async () => {
  _get = (sql) => {
    if (/users WHERE username/.test(sql)) return { id: 1, password_hash: 'hash', active: 1, role_id: 2 };
    if (/roles WHERE id/.test(sql))       return { name: 'admin' };
    return null;
  };
  _verifyPassword = async () => true;
  const { status, body, headers } = await req('POST', '/api/auth/login', { username: 'alice', password: 'correct' });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.role, 'admin');
  // session cookie must be set
  const cookie = headers.get('set-cookie') ?? '';
  assert.match(cookie, /it_session/);
});

test('POST /api/auth/login – cookie has httpOnly flag', async () => {
  _get = (sql) => {
    if (/users WHERE username/.test(sql)) return { id: 1, password_hash: 'hash', active: 1, role_id: 2 };
    if (/roles WHERE id/.test(sql))       return { name: 'admin' };
    return null;
  };
  _verifyPassword = async () => true;
  const { headers } = await req('POST', '/api/auth/login', { username: 'alice', password: 'correct' });
  const cookie = headers.get('set-cookie') ?? '';
  assert.match(cookie, /HttpOnly/i);
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────

test('POST /api/auth/logout – 200 without a session cookie', async () => {
  const res = await fetch(`${BASE}/api/auth/logout`, { method: 'POST' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
});

test('POST /api/auth/logout – 200 with a session cookie present', async () => {
  const res = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: 'it_session=some-token-value' },
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
});

test('POST /api/auth/logout – clears the it_session cookie', async () => {
  const res = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: 'it_session=some-token-value' },
  });
  const cookie = res.headers.get('set-cookie') ?? '';
  assert.match(cookie, /it_session/);
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────

test('GET /api/auth/me – 200 returns user from req.user set by middleware', async () => {
  const { status, body } = await req('GET', '/api/auth/me');
  assert.equal(status, 200);
  assert.equal(body.id, 99);
  assert.equal(body.username, 'tester');
  assert.equal(body.role, 'admin');
  assert.ok(Array.isArray(body.permissions));
});

test('GET /api/auth/me – response includes permissions array', async () => {
  const { body } = await req('GET', '/api/auth/me');
  assert.deepEqual(body.permissions, ['tickets:read', 'metrics:read']);
});
