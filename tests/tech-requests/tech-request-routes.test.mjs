/**
 * Integration tests for src/tech-requests/tech-request-routes.js
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

// ── 2. Mock database (used directly in route for the status-update SELECT) ───

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

// ── 3. Mock auth middleware ──────────────────────────────────────────────────

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => { _req.user = { id: 1 }; next(); },
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

// ── 4. Mock tech-request-model (all model functions) ────────────────────────

let _stats         = { byStatus: [], byType: [], bySede: [] };
let _allRequests   = { requests: [], total: 0, page: 1, limit: 15, total_pages: 0 };
let _requestById   = null;
let _createResult  = { id: 1, request_number: 'RQ-20260721-001' };
let _updateResult  = true;
let _deleteResult  = true;

await mock.module('../../src/tech-requests/tech-request-model.js', {
  exports: {
    getTechRequestStats:  (_db)              => _stats,
    getAllTechRequests:    (_db, _filters)    => _allRequests,
    getTechRequestById:   (_db, _id)         => _requestById,
    createTechRequest:    (_db, _data)       => _createResult,
    updateTechRequest:    (_db, _id, _data)  => _updateResult,
    replaceRequestItems:  (_db, _id, _items) => {},
    addTechRequestNote:   (_db, _id, _agent, _content) => true,
    deleteTechRequest:    (_db, _id)         => _deleteResult,
  },
});

// ── 5. Mock acta-generator (avoids docx/filesystem dependencies) ─────────────

await mock.module('../../src/tech-requests/acta-generator.js', {
  exports: {
    generateActa: async () => Buffer.from('fake-docx-content'),
  },
});

// ── 6. Mock broadcaster ───────────────────────────────────────────────────────

await mock.module('../../src/events/broadcaster.js', {
  exports: {
    appEvents: { emit: () => {} },
  },
});

// ── 7. Mock excel-logger (avoids ExcelJS file I/O) ───────────────────────────

await mock.module('../../src/excel/excel-logger.js', {
  exports: {
    logTechRequest:       async () => {},
    updateTechRequestRow: async () => {},
    logDespacho:          async () => {},
  },
});

// ── 8. Mock sheets-logger (avoids Google Sheets network calls) ───────────────

await mock.module('../../src/excel/sheets-logger.js', {
  exports: {
    logTechRequestSheet:    async () => {},
    updateTechRequestSheet: async () => {},
    logDespachoSheet:       async () => {},
  },
});

// ── 9. Mock async-handler ────────────────────────────────────────────────────

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  },
});

// ── 10. Import router AFTER all mocks ────────────────────────────────────────

const router = (await import('../../src/tech-requests/tech-request-routes.js')).default;

// ── 11. Create test server ───────────────────────────────────────────────────

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

  _stats         = { byStatus: [], byType: [], bySede: [] };
  _allRequests   = { requests: [], total: 0, page: 1, limit: 15, total_pages: 0 };
  _requestById   = null;
  _createResult  = { id: 1, request_number: 'RQ-20260721-001' };
  _updateResult  = true;
  _deleteResult  = true;
}

// ── Valid body for POST /api/tech-requests ────────────────────────────────────

function validTechBody(overrides = {}) {
  return {
    type:           'requerimiento',
    requester_name: 'Juan Perez',
    cedula:         '12345678',
    cargo:          'Auxiliar',
    sede:           'Oficina Norte',
    description:    'Necesito un monitor adicional',
    priority:       'media',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

// GET /api/tech-requests/stats

test('GET /api/tech-requests/stats returns stats', async () => {
  reset();
  _stats = {
    byStatus: [{ status: 'pendiente', count: 5 }],
    byType:   [{ type: 'requerimiento', count: 3 }],
    bySede:   [],
  };
  const res = await fetch(`${BASE}/api/tech-requests/stats`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.byStatus));
  assert.equal(body.byStatus[0].status, 'pendiente');
});

// GET /api/tech-requests — list

test('GET /api/tech-requests returns empty list', async () => {
  reset();
  const res = await fetch(`${BASE}/api/tech-requests`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.requests));
  assert.equal(body.total, 0);
});

test('GET /api/tech-requests returns requests list', async () => {
  reset();
  _allRequests = {
    requests: [
      { id: 1, request_number: 'RQ-20260721-001', type: 'requerimiento', status: 'pendiente' },
      { id: 2, request_number: 'IN-20260721-001', type: 'incidencia',    status: 'en_proceso' },
    ],
    total: 2, page: 1, limit: 15, total_pages: 1,
  };
  const res = await fetch(`${BASE}/api/tech-requests`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.requests.length, 2);
  assert.equal(body.requests[0].request_number, 'RQ-20260721-001');
});

test('GET /api/tech-requests passes filters through', async () => {
  reset();
  _allRequests = { requests: [], total: 0, page: 2, limit: 15, total_pages: 0 };
  const res = await fetch(`${BASE}/api/tech-requests?type=incidencia&page=2&status=completado`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.page, 2);
});

// POST /api/tech-requests — validation

test('POST /api/tech-requests returns 400 for missing required fields', async () => {
  reset();
  const res = await fetch(`${BASE}/api/tech-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'requerimiento' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Campos requeridos'));
});

test('POST /api/tech-requests returns 400 for invalid type', async () => {
  reset();
  const res = await fetch(`${BASE}/api/tech-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validTechBody({ type: 'consulta' })),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('tipo'));
});

test('POST /api/tech-requests creates requerimiento successfully', async () => {
  reset();
  _createResult = { id: 5, request_number: 'RQ-20260721-005' };
  const res = await fetch(`${BASE}/api/tech-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validTechBody()),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.request_number, 'RQ-20260721-005');
});

test('POST /api/tech-requests creates incidencia successfully', async () => {
  reset();
  _createResult = { id: 6, request_number: 'IN-20260721-001' };
  const res = await fetch(`${BASE}/api/tech-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validTechBody({ type: 'incidencia', equipment_name: 'PC Dell', equipment_serial: 'SN-001' })),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.id, 6);
});

// GET /api/tech-requests/:id

test('GET /api/tech-requests/:id returns 404 when not found', async () => {
  reset();
  _requestById = null;
  const res = await fetch(`${BASE}/api/tech-requests/999`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error.includes('no encontrada'));
});

test('GET /api/tech-requests/:id returns tech request', async () => {
  reset();
  _requestById = {
    id: 3,
    request_number: 'RQ-20260721-003',
    type: 'requerimiento',
    requester_name: 'Carlos',
    history: [],
    items: [],
  };
  const res = await fetch(`${BASE}/api/tech-requests/3`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 3);
  assert.equal(body.request_number, 'RQ-20260721-003');
});

// PUT /api/tech-requests/:id

test('PUT /api/tech-requests/:id returns 404 when not found', async () => {
  reset();
  _updateResult = false; // model returns false → route returns 404
  const res = await fetch(`${BASE}/api/tech-requests/99`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'en_proceso' }),
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error.includes('no encontrada'));
});

test('PUT /api/tech-requests/:id updates successfully', async () => {
  reset();
  _updateResult = true;
  // The route does a db.prepare SELECT when req.body.status is set
  _get = () => ({ request_number: 'RQ-20260721-001' });
  const res = await fetch(`${BASE}/api/tech-requests/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completado', agentName: 'Admin' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

test('PUT /api/tech-requests/:id updates without status change', async () => {
  reset();
  _updateResult = true;
  const res = await fetch(`${BASE}/api/tech-requests/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority: 'alta', agentName: 'Admin' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

// DELETE /api/tech-requests/:id

test('DELETE /api/tech-requests/:id returns 404 when not found', async () => {
  reset();
  _deleteResult = false;
  const res = await fetch(`${BASE}/api/tech-requests/99`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error.includes('no encontrada'));
});

test('DELETE /api/tech-requests/:id deletes successfully', async () => {
  reset();
  _deleteResult = true;
  const res = await fetch(`${BASE}/api/tech-requests/1`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

// POST /api/tech-requests/:id/notes

test('POST /api/tech-requests/:id/notes returns 400 for missing content', async () => {
  reset();
  const res = await fetch(`${BASE}/api/tech-requests/1/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName: 'Admin', content: '' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('contenido'));
});

test('POST /api/tech-requests/:id/notes adds note successfully', async () => {
  reset();
  const res = await fetch(`${BASE}/api/tech-requests/1/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName: 'Admin', content: 'Se revisó el equipo y se actualizó el estado.' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

// POST /api/tech-requests/:id/acta

test('POST /api/tech-requests/:id/acta returns 404 when not found', async () => {
  reset();
  _requestById = null;
  const res = await fetch(`${BASE}/api/tech-requests/99/acta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ marca: 'Dell', modelo: 'OptiPlex' }] }),
  });
  assert.equal(res.status, 404);
});

test('POST /api/tech-requests/:id/acta returns 400 for requerimiento without items', async () => {
  reset();
  _requestById = { id: 1, request_number: 'RQ-20260721-001', type: 'requerimiento', requester_name: 'Ana', items: [] };
  const res = await fetch(`${BASE}/api/tech-requests/1/acta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [] }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('equipo'));
});

test('POST /api/tech-requests/:id/acta returns 400 for requerimiento missing marca/modelo', async () => {
  reset();
  _requestById = { id: 1, request_number: 'RQ-20260721-001', type: 'requerimiento', requester_name: 'Ana', items: [] };
  const res = await fetch(`${BASE}/api/tech-requests/1/acta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ serial: 'SN-001' }] }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Marca'));
});

test('POST /api/tech-requests/:id/acta generates docx for requerimiento', async () => {
  reset();
  _requestById = {
    id: 1, request_number: 'RQ-20260721-001', type: 'requerimiento',
    requester_name: 'Ana Lopez', items: [],
  };
  const res = await fetch(`${BASE}/api/tech-requests/1/acta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items:    [{ marca: 'Dell', modelo: 'OptiPlex 3080', serial: 'SN-001' }],
      agentName: 'Soporte IT',
    }),
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('wordprocessingml'));
  assert.ok(res.headers.get('content-disposition').includes('Acta_Entrega'));
});

test('POST /api/tech-requests/:id/acta generates docx for incidencia', async () => {
  reset();
  _requestById = {
    id: 2, request_number: 'IN-20260721-001', type: 'incidencia',
    requester_name: 'Carlos Mesa', equipment_name: 'Laptop', equipment_serial: 'LP-001',
    items: [],
  };
  const res = await fetch(`${BASE}/api/tech-requests/2/acta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items:    [{ marca: 'HP', modelo: 'EliteBook', serial: 'LP-001' }],
      agentName: 'Soporte IT',
    }),
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('wordprocessingml'));
});
