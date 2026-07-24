/**
 * Integration tests for src/requerimientos/req-routes.js
 * Uses node:test + mock.module + in-process HTTP server.
 */
import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── 1. Mutable mock state ────────────────────────────────────────────────────

let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });

// ── 2. Mock database BEFORE any route import ────────────────────────────────

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

// ── 3. Mock email service (avoids nodemailer / SMTP at import) ───────────────

await mock.module('../../src/requerimientos/email-service.js', {
  exports: {
    sendReqEmail: async () => {},
  },
});

// ── 4. Mock sheets-service (dynamic import inside /api/req/puntos) ───────────

await mock.module('../../src/farmacias/sheets-service.js', {
  exports: {
    readSheet: async () => [],
  },
});

// ── 5. Mock async-handler ────────────────────────────────────────────────────

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  },
});

// ── 6. Import router AFTER mocks ─────────────────────────────────────────────

const router = (await import('../../src/requerimientos/req-routes.js')).default;

// ── 7. Create test server ────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

after(() => new Promise(r => server.close(r)));

// ── Reset helper ─────────────────────────────────────────────────────────────

function reset() {
  _get = () => null;
  _all = () => [];
  _run = () => ({ changes: 1, lastInsertRowid: 1 });
}

// ── Helper: build a valid admin token ────────────────────────────────────────
// The route uses: HMAC-SHA256(secret, "GESTION:<ts>").<ts>
// Default secret is 'dev-secret', default user is 'GESTION'
import crypto from 'node:crypto';

function makeAdminToken() {
  const secret = process.env.REQ_ADMIN_SECRET || 'dev-secret';
  const user   = process.env.REQ_ADMIN_USER   || 'GESTION';
  const ts     = Date.now();
  const hmac   = crypto.createHmac('sha256', secret).update(`${user}:${ts}`).digest('hex');
  return `${hmac}.${ts}`;
}

// ── Valid POST /api/req body ──────────────────────────────────────────────────

function validReqBody(overrides = {}) {
  return {
    area:        'Sistemas',
    nombre:      'Juan Perez',
    correo:      'juan@test.com',
    punto:       'Farmacia Norte',
    tipo:        'Sistemas',
    descripcion: 'El equipo no enciende',
    prioridad:   'NORMAL',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

// GET /api/req/puntos

test('GET /api/req/puntos returns empty array when sheet has no data', async () => {
  reset();
  const res = await fetch(`${BASE}/api/req/puntos`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

// POST /api/req/admin/login

test('POST /api/req/admin/login returns 401 for wrong credentials', async () => {
  reset();
  const res = await fetch(`${BASE}/api/req/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'wrong', password: 'bad' }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.ok(body.error);
});

test('POST /api/req/admin/login returns token for valid credentials', async () => {
  reset();
  const user = process.env.REQ_ADMIN_USER || 'GESTION';
  const pass = process.env.REQ_ADMIN_PASS || 'GST123';
  const res = await fetch(`${BASE}/api/req/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: user, password: pass }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(typeof body.token === 'string');
  assert.ok(body.token.includes('.'));
});

// POST /api/req — validation

test('POST /api/req returns 400 for missing required fields', async () => {
  reset();
  const res = await fetch(`${BASE}/api/req`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ area: 'Sistemas' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Campos requeridos'));
});

test('POST /api/req returns 400 for invalid tipo', async () => {
  reset();
  const res = await fetch(`${BASE}/api/req`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReqBody({ tipo: 'InvalidTipo' })),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Tipo'));
});

test('POST /api/req returns 400 for invalid prioridad', async () => {
  reset();
  const res = await fetch(`${BASE}/api/req`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReqBody({ prioridad: 'BAJA' })),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Prioridad'));
});

test('POST /api/req creates requerimiento and returns ticket_num', async () => {
  reset();
  // _get returns null (no existing ticket for same month → seq 1)
  // _run succeeds
  const res = await fetch(`${BASE}/api/req`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReqBody()),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(typeof body.ticket_num === 'string');
  assert.ok(body.ticket_num.startsWith('REQ-'));
});

test('POST /api/req increments sequence when ticket exists for same month', async () => {
  reset();
  const now = new Date();
  const ym  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  _get = () => ({ ticket_num: `REQ-${ym}-005` });
  const res = await fetch(`${BASE}/api/req`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReqBody()),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.ticket_num.endsWith('-006'));
});

// GET /api/req — list with pagination

test('GET /api/req returns paginated list', async () => {
  reset();
  const rows = [
    { id: 1, ticket_num: 'REQ-202607-001', tipo: 'Sistemas', estado: 'Recibido' },
    { id: 2, ticket_num: 'REQ-202607-002', tipo: 'Locativo', estado: 'En proceso' },
  ];
  _all = () => rows;
  _get = () => ({ c: 2 });
  const res = await fetch(`${BASE}/api/req`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  assert.equal(body.rows.length, 2);
  assert.equal(body.total, 2);
  assert.equal(body.page, 1);
});

test('GET /api/req uses page query param', async () => {
  reset();
  _all = () => [];
  _get = () => ({ c: 50 });
  const res = await fetch(`${BASE}/api/req?page=3`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.page, 3);
});

test('GET /api/req filters by tipo', async () => {
  reset();
  _all = () => [{ id: 1, ticket_num: 'REQ-202607-001', tipo: 'Sistemas' }];
  _get = () => ({ c: 1 });
  const res = await fetch(`${BASE}/api/req?tipo=Sistemas`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rows.length, 1);
});

// GET /api/req/:id

test('GET /api/req/:id returns 404 when not found', async () => {
  reset();
  _get = () => null;
  const res = await fetch(`${BASE}/api/req/999`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});

test('GET /api/req/:id returns ticket', async () => {
  reset();
  _get = () => ({ id: 7, ticket_num: 'REQ-202607-007', tipo: 'Bodega' });
  const res = await fetch(`${BASE}/api/req/7`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 7);
  assert.equal(body.ticket_num, 'REQ-202607-007');
});

// PUT /api/req/:id/estado

test('PUT /api/req/:id/estado returns 401 without auth token', async () => {
  reset();
  const res = await fetch(`${BASE}/api/req/1/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'Resuelto' }),
  });
  assert.equal(res.status, 401);
});

test('PUT /api/req/:id/estado returns 400 for invalid estado', async () => {
  reset();
  const token = makeAdminToken();
  const res = await fetch(`${BASE}/api/req/1/estado`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ estado: 'InvalidEstado' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Estado'));
});

test('PUT /api/req/:id/estado returns 404 when ticket not found', async () => {
  reset();
  _run = () => ({ changes: 0 });
  const token = makeAdminToken();
  const res = await fetch(`${BASE}/api/req/999/estado`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ estado: 'Resuelto' }),
  });
  assert.equal(res.status, 404);
});

test('PUT /api/req/:id/estado updates estado successfully', async () => {
  reset();
  _run = () => ({ changes: 1 });
  const token = makeAdminToken();
  const res = await fetch(`${BASE}/api/req/1/estado`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ estado: 'Resuelto' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
