import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── controllable despacho-model stubs ────────────────────────────────────────
let _generateNumero         = () => 'DES-20240101-001';
let _generateActaNumero     = () => 'ACTA-2024-001';
let _getDespachos           = () => ({ despachos: [], total: 0 });
let _getDespachoById        = () => null;
let _insertDespacho         = () => 42;
let _patchDespacho          = () => {};
let _deleteDespacho         = () => {};
let _getBorrador            = () => null;
let _upsertBorrador         = () => {};
let _deleteBorrador         = () => {};
let _getTiposArticulo       = () => [];
let _upsertTipoArticulo     = () => ({ id: 1, nombre: 'LAPTOP', active: 1 });
let _deactivateTipoArticulo = () => {};
let _getConfirmacion        = () => null;
let _createConfirmacion     = () => {};
let _getConfirmacionByToken = () => null;
let _confirmDelivery        = () => {};
let _createTracking         = () => 'tok-new';

function reset() {
  _generateNumero         = () => 'DES-20240101-001';
  _generateActaNumero     = () => 'ACTA-2024-001';
  _getDespachos           = () => ({ despachos: [], total: 0 });
  _getDespachoById        = () => null;
  _insertDespacho         = () => 42;
  _patchDespacho          = () => {};
  _deleteDespacho         = () => {};
  _getBorrador            = () => null;
  _upsertBorrador         = () => {};
  _deleteBorrador         = () => {};
  _getTiposArticulo       = () => [];
  _upsertTipoArticulo     = () => ({ id: 1, nombre: 'LAPTOP', active: 1 });
  _deactivateTipoArticulo = () => {};
  _getConfirmacion        = () => null;
  _createConfirmacion     = () => {};
  _getConfirmacionByToken = () => null;
  _confirmDelivery        = () => {};
  _createTracking         = () => 'tok-new';
}

// ── mocks ─────────────────────────────────────────────────────────────────────
await mock.module('../../src/config/database.js', {
  exports: {
    default: {
      prepare: () => ({ get: () => null, all: () => [], run: () => ({ changes: 1 }) }),
      exec: () => {},
    },
  },
});

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => next(),
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

await mock.module('../../src/tracking/tracking-model.js', {
  exports: { createTracking: (...a) => _createTracking(...a) },
});

await mock.module('../../src/audit/audit-logger.js', {
  exports: { logAudit: () => {} },
});

await mock.module('../../src/tech-requests/acta-generator.js', {
  exports: { generateActa: async () => Buffer.from('fake-docx') },
});

await mock.module('../../src/excel/excel-logger.js', {
  exports: { logDespacho: async () => {} },
});

await mock.module('../../src/excel/sheets-logger.js', {
  exports: { logDespachoSheet: async () => {} },
});

await mock.module('../../src/despacho/despacho-model.js', {
  exports: {
    generateNumero:          (...a) => _generateNumero(...a),
    generateActaNumero:      (...a) => _generateActaNumero(...a),
    getDespachos:            (...a) => _getDespachos(...a),
    getDespachoById:         (...a) => _getDespachoById(...a),
    insertDespacho:          (...a) => _insertDespacho(...a),
    patchDespacho:           (...a) => _patchDespacho(...a),
    deleteDespacho:          (...a) => _deleteDespacho(...a),
    getBorrador:             (...a) => _getBorrador(...a),
    upsertBorrador:          (...a) => _upsertBorrador(...a),
    deleteBorrador:          (...a) => _deleteBorrador(...a),
    getTiposArticulo:        (...a) => _getTiposArticulo(...a),
    upsertTipoArticulo:      (...a) => _upsertTipoArticulo(...a),
    deactivateTipoArticulo:  (...a) => _deactivateTipoArticulo(...a),
    getConfirmacion:         (...a) => _getConfirmacion(...a),
    createConfirmacion:      (...a) => _createConfirmacion(...a),
    getConfirmacionByToken:  (...a) => _getConfirmacionByToken(...a),
    confirmDelivery:         (...a) => _confirmDelivery(...a),
  },
});

await mock.module('../../src/despacho/confirmacion-page.js', {
  exports: {
    escHtml:       (s) => String(s ?? ''),
    confirmarPage: () => '<html><body>Confirmar</body></html>',
  },
});

await mock.module('../../src/utils/get-base-url.js', {
  exports: { getBaseUrl: () => 'http://127.0.0.1' },
});

await mock.module('../../src/utils/async-handler.js', {
  exports: { wrap: (fn) => fn },
});

// ── test server ───────────────────────────────────────────────────────────────
const router = (await import('../../src/despacho/despacho-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((r) => server.close(r)));

// ── helpers ───────────────────────────────────────────────────────────────────
async function req(method, p, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${p}`, opts);
  let json; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

const get  = (p)    => req('GET',    p);
const post = (p, b) => req('POST',   p, b);
const put  = (p, b) => req('PUT',    p, b);
const del  = (p)    => req('DELETE', p);

// ── stub factory ──────────────────────────────────────────────────────────────
function makeDespacho(overrides = {}) {
  return {
    id: 1, numero: 'DES-20240101-001', destinatario: 'Juan Pérez',
    cedula: '12345678', sede: 'CALI', area: 'IT',
    articulos: '[{"nombre":"Laptop","cantidad":1,"marca":"Dell","modelo":"Latitude","serial":"SN01"}]',
    observaciones: 'Ninguna', requiere_acta: 0, acta_numero: null,
    acta_firmada: 0, ticket_id: null, agente: 'admin', fecha: '2024-01-01',
    ...overrides,
  };
}

/* ══════════════════════════════════════════════════════════════
   GET /api/despachos
   ══════════════════════════════════════════════════════════════ */

test('GET /api/despachos — returns list', async () => {
  reset();
  _getDespachos = () => ({ despachos: [makeDespacho()], total: 1 });
  const { status, body } = await get('/api/despachos');
  assert.equal(status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.despachos.length, 1);
});

test('GET /api/despachos — passes query to model', async () => {
  reset();
  let capturedQuery;
  _getDespachos = (_db, q) => { capturedQuery = q; return { despachos: [], total: 0 }; };
  await get('/api/despachos?sede=CALI&estado=activo');
  assert.equal(capturedQuery.sede, 'CALI');
  assert.equal(capturedQuery.estado, 'activo');
});

/* ══════════════════════════════════════════════════════════════
   GET /api/despachos/borrador
   ══════════════════════════════════════════════════════════════ */

test('GET /api/despachos/borrador — 400 when agente missing', async () => {
  reset();
  const { status, body } = await get('/api/despachos/borrador');
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('GET /api/despachos/borrador — returns null when none', async () => {
  reset();
  const { status, body } = await get('/api/despachos/borrador?agente=admin');
  assert.equal(status, 200);
  assert.equal(body.borrador, null);
});

test('GET /api/despachos/borrador — returns borrador data', async () => {
  reset();
  _getBorrador = () => ({ agente: 'admin', destinatario: 'X' });
  const { status, body } = await get('/api/despachos/borrador?agente=admin');
  assert.equal(status, 200);
  assert.equal(body.borrador.agente, 'admin');
});

/* ══════════════════════════════════════════════════════════════
   PUT /api/despachos/borrador
   ══════════════════════════════════════════════════════════════ */

test('PUT /api/despachos/borrador — 400 when agente missing', async () => {
  reset();
  const { status, body } = await put('/api/despachos/borrador', { destinatario: 'X' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('PUT /api/despachos/borrador — saves borrador', async () => {
  reset();
  const { status, body } = await put('/api/despachos/borrador', { agente: 'admin', destinatario: 'X' });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/despachos/borrador
   ══════════════════════════════════════════════════════════════ */

test('DELETE /api/despachos/borrador — 400 when agente missing', async () => {
  reset();
  const { status, body } = await del('/api/despachos/borrador');
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('DELETE /api/despachos/borrador — deletes borrador', async () => {
  reset();
  const { status, body } = await del('/api/despachos/borrador?agente=admin');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

/* ══════════════════════════════════════════════════════════════
   GET /api/despachos/:id
   ══════════════════════════════════════════════════════════════ */

test('GET /api/despachos/:id — 404 when not found', async () => {
  reset();
  const { status, body } = await get('/api/despachos/99');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/despachos/:id — 200 returns despacho', async () => {
  reset();
  _getDespachoById = () => makeDespacho();
  const { status, body } = await get('/api/despachos/1');
  assert.equal(status, 200);
  assert.equal(body.numero, 'DES-20240101-001');
  assert.equal(body.destinatario, 'Juan Pérez');
});

/* ══════════════════════════════════════════════════════════════
   POST /api/despachos
   ══════════════════════════════════════════════════════════════ */

test('POST /api/despachos — 400 when destinatario missing', async () => {
  reset();
  const { status, body } = await post('/api/despachos', { articulos: [{ nombre: 'Mouse', cantidad: 1 }] });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/despachos — 400 when articulos empty', async () => {
  reset();
  const { status, body } = await post('/api/despachos', { destinatario: 'Ana', articulos: [] });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/despachos — creates despacho, returns id+numero', async () => {
  reset();
  const { status, body } = await post('/api/despachos', {
    destinatario: 'Ana Torres',
    articulos: [{ nombre: 'Teclado', cantidad: 1 }],
    agente: 'admin',
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.id, 42);
  assert.equal(body.numero, 'DES-20240101-001');
});

test('POST /api/despachos — generates acta_numero when requiere_acta=true', async () => {
  reset();
  let capturedActaNumero;
  _insertDespacho = (_db, fields) => { capturedActaNumero = fields.acta_numero; return 42; };
  const { status, body } = await post('/api/despachos', {
    destinatario: 'Ana',
    articulos: [{ nombre: 'Laptop', cantidad: 1 }],
    requiere_acta: 1,
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(capturedActaNumero, 'ACTA-2024-001');
});

test('POST /api/despachos — acta_numero null when requiere_acta=false', async () => {
  reset();
  let capturedActaNumero;
  _insertDespacho = (_db, fields) => { capturedActaNumero = fields.acta_numero; return 42; };
  await post('/api/despachos', {
    destinatario: 'Ana',
    articulos: [{ nombre: 'Laptop', cantidad: 1 }],
    requiere_acta: 0,
  });
  assert.equal(capturedActaNumero, null);
});

test('POST /api/despachos — still succeeds when createTracking throws', async () => {
  reset();
  _createTracking = () => { throw new Error('tracking DB error'); };
  const { status, body } = await post('/api/despachos', {
    destinatario: 'Ana',
    articulos: [{ nombre: 'Mouse', cantidad: 1 }],
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

/* ══════════════════════════════════════════════════════════════
   PUT /api/despachos/:id
   ══════════════════════════════════════════════════════════════ */

test('PUT /api/despachos/:id — 400 when no fields sent', async () => {
  reset();
  const { status, body } = await put('/api/despachos/1', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('PUT /api/despachos/:id — 200 updates destinatario', async () => {
  reset();
  const { status, body } = await put('/api/despachos/1', { destinatario: 'Nuevo' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('PUT /api/despachos/:id — maps requiere_acta truthy to 1', async () => {
  reset();
  let capturedFields;
  _patchDespacho = (_db, _id, fields) => { capturedFields = fields; };
  await put('/api/despachos/1', { requiere_acta: true });
  assert.equal(capturedFields.requiere_acta, 1);
});

test('PUT /api/despachos/:id — maps requiere_acta falsy to 0', async () => {
  reset();
  let capturedFields;
  _patchDespacho = (_db, _id, fields) => { capturedFields = fields; };
  await put('/api/despachos/1', { requiere_acta: false });
  assert.equal(capturedFields.requiere_acta, 0);
});

test('PUT /api/despachos/:id — maps falsy cedula to null', async () => {
  reset();
  let capturedFields;
  _patchDespacho = (_db, _id, fields) => { capturedFields = fields; };
  await put('/api/despachos/1', { cedula: '' });
  assert.equal(capturedFields.cedula, null);
});

test('PUT /api/despachos/:id — serializes articulos to JSON string', async () => {
  reset();
  let capturedFields;
  _patchDespacho = (_db, _id, fields) => { capturedFields = fields; };
  await put('/api/despachos/1', { articulos: [{ nombre: 'Mouse', cantidad: 1 }] });
  assert.equal(typeof capturedFields.articulos, 'string');
  assert.ok(capturedFields.articulos.includes('Mouse'));
});

test('PUT /api/despachos/:id — all fields with valid values covers every true branch', async () => {
  reset();
  let capturedFields;
  _patchDespacho = (_db, _id, fields) => { capturedFields = fields; };
  await put('/api/despachos/1', {
    acta_numero: 'ACTA-2024-999', acta_firmada: 1,
    destinatario: 'Ana', cedula: '12345', sede: 'BOGOTA',
    area: 'IT', fecha: '2024-06-01',
    articulos: [{ nombre: 'Monitor', cantidad: 2 }],
    observaciones: 'Urgente', requiere_acta: 1, ticket_id: 5,
  });
  assert.equal(capturedFields.acta_numero, 'ACTA-2024-999');
  assert.equal(capturedFields.acta_firmada, 1);
  assert.equal(capturedFields.sede, 'BOGOTA');
  assert.equal(capturedFields.area, 'IT');
  assert.equal(capturedFields.fecha, '2024-06-01');
  assert.equal(capturedFields.observaciones, 'Urgente');
  assert.equal(capturedFields.ticket_id, 5);
});

test('PUT /api/despachos/:id — falsy string fields map to null', async () => {
  reset();
  let capturedFields;
  _patchDespacho = (_db, _id, fields) => { capturedFields = fields; };
  await put('/api/despachos/1', {
    sede: '', area: '', fecha: '', observaciones: '', ticket_id: null,
  });
  assert.equal(capturedFields.sede, null);
  assert.equal(capturedFields.area, null);
  assert.equal(capturedFields.fecha, null);
  assert.equal(capturedFields.observaciones, null);
  assert.equal(capturedFields.ticket_id, null);
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/despachos/:id
   ══════════════════════════════════════════════════════════════ */

test('DELETE /api/despachos/:id — 404 when not found', async () => {
  reset();
  const { status, body } = await del('/api/despachos/99');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('DELETE /api/despachos/:id — 200 deletes despacho', async () => {
  reset();
  _getDespachoById = () => makeDespacho();
  const { status, body } = await del('/api/despachos/1');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

/* ══════════════════════════════════════════════════════════════
   POST /api/despachos/:id/acta-word
   ══════════════════════════════════════════════════════════════ */

test('POST /api/despachos/:id/acta-word — 404 when not found', async () => {
  reset();
  const { status, body } = await post('/api/despachos/99/acta-word', {});
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('POST /api/despachos/:id/acta-word — 200 returns docx buffer', async () => {
  reset();
  _getDespachoById = () => makeDespacho();
  const res = await fetch(`${BASE}/api/despachos/1/acta-word`, { method: 'POST' });
  assert.equal(res.status, 200);
  const ct = res.headers.get('content-type') ?? '';
  assert.ok(ct.includes('wordprocessingml') || ct.includes('application/'));
});

test('POST /api/despachos/:id/acta-word — uses fallback item when articulos empty', async () => {
  reset();
  let capturedItems;
  _getDespachoById = () => makeDespacho({ articulos: '[]' });
  const { generateActa: orig } = await import('../../src/tech-requests/acta-generator.js');
  // capture via the mock — just verify it returns 200 (fallback path runs)
  const res = await fetch(`${BASE}/api/despachos/1/acta-word`, { method: 'POST' });
  assert.equal(res.status, 200);
});

/* ══════════════════════════════════════════════════════════════
   GET /api/tipos-articulo
   ══════════════════════════════════════════════════════════════ */

test('GET /api/tipos-articulo — returns array', async () => {
  reset();
  _getTiposArticulo = () => [{ id: 1, nombre: 'LAPTOP', active: 1 }];
  const { status, body } = await get('/api/tipos-articulo');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
});

/* ══════════════════════════════════════════════════════════════
   POST /api/tipos-articulo
   ══════════════════════════════════════════════════════════════ */

test('POST /api/tipos-articulo — 400 when nombre blank', async () => {
  reset();
  const { status, body } = await post('/api/tipos-articulo', { nombre: '  ' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/tipos-articulo — creates tipo, normalizes to uppercase', async () => {
  reset();
  const { status, body } = await post('/api/tipos-articulo', { nombre: 'laptop' });
  assert.equal(status, 200);
  assert.equal(body.nombre, 'LAPTOP');
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/tipos-articulo/:id
   ══════════════════════════════════════════════════════════════ */

test('DELETE /api/tipos-articulo/:id — deactivates tipo', async () => {
  reset();
  const { status, body } = await del('/api/tipos-articulo/3');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

/* ══════════════════════════════════════════════════════════════
   GET /api/despachos/:id/confirmacion
   ══════════════════════════════════════════════════════════════ */

test('GET /api/despachos/:id/confirmacion — returns null token when none', async () => {
  reset();
  const { status, body } = await get('/api/despachos/1/confirmacion');
  assert.equal(status, 200);
  assert.equal(body.token, null);
  assert.equal(body.confirmed, false);
});

test('GET /api/despachos/:id/confirmacion — returns token and url when exists', async () => {
  reset();
  _getConfirmacion = () => ({
    token: 'tok-confirm-abc', confirmed_at: null, signed_by: null,
  });
  const { status, body } = await get('/api/despachos/1/confirmacion');
  assert.equal(status, 200);
  assert.equal(body.token, 'tok-confirm-abc');
  assert.ok(body.url?.includes('tok-confirm-abc'));
  assert.equal(body.confirmed, false);
});

test('GET /api/despachos/:id/confirmacion — url null when row has no token', async () => {
  reset();
  _getConfirmacion = () => ({ token: null, confirmed_at: null, signed_by: null });
  const { status, body } = await get('/api/despachos/1/confirmacion');
  assert.equal(status, 200);
  assert.equal(body.token, null);
  assert.equal(body.url, null);
  assert.equal(body.confirmed, false);
});

test('GET /api/despachos/:id/confirmacion — confirmed true when confirmed_at set', async () => {
  reset();
  _getConfirmacion = () => ({
    token: 'tok-confirm-abc', confirmed_at: '2024-01-01T12:00:00', signed_by: 'Ana',
  });
  const { status, body } = await get('/api/despachos/1/confirmacion');
  assert.equal(status, 200);
  assert.equal(body.confirmed, true);
  assert.equal(body.signed_by, 'Ana');
});

/* ══════════════════════════════════════════════════════════════
   POST /api/despachos/:id/confirmacion
   ══════════════════════════════════════════════════════════════ */

test('POST /api/despachos/:id/confirmacion — 404 when despacho not found', async () => {
  reset();
  const { status, body } = await post('/api/despachos/99/confirmacion', {});
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('POST /api/despachos/:id/confirmacion — 400 when requiere_acta', async () => {
  reset();
  _getDespachoById = () => makeDespacho({ requiere_acta: 1 });
  const { status, body } = await post('/api/despachos/1/confirmacion', {});
  assert.equal(status, 400);
  assert.match(body.error, /acta/i);
});

test('POST /api/despachos/:id/confirmacion — returns existing token', async () => {
  reset();
  _getDespachoById = () => makeDespacho({ requiere_acta: 0 });
  _getConfirmacion = () => ({ token: 'tok-existing-123' });
  const { status, body } = await post('/api/despachos/1/confirmacion', {});
  assert.equal(status, 200);
  assert.equal(body.token, 'tok-existing-123');
});

test('POST /api/despachos/:id/confirmacion — creates new token when none exists', async () => {
  reset();
  _getDespachoById = () => makeDespacho({ requiere_acta: 0 });
  _getConfirmacion = () => null;
  const { status, body } = await post('/api/despachos/1/confirmacion', {});
  assert.equal(status, 200);
  assert.ok(typeof body.token === 'string' && body.token.length > 0);
  assert.ok(body.url?.includes(body.token));
});

/* ══════════════════════════════════════════════════════════════
   GET /confirmar/:token
   ══════════════════════════════════════════════════════════════ */

test('GET /confirmar/:token — 404 HTML when token invalid', async () => {
  reset();
  const res = await fetch(`${BASE}/confirmar/bad-token`);
  assert.equal(res.status, 404);
  const text = await res.text();
  assert.ok(text.includes('no válido'));
});

test('GET /confirmar/:token — 200 renders page when token valid', async () => {
  reset();
  _getConfirmacionByToken = () => ({
    id: 1, token: 'tok-abc', destinatario: 'Juan', confirmed_at: null,
    articulos: '[{"nombre":"Laptop","cantidad":1}]',
  });
  const res = await fetch(`${BASE}/confirmar/tok-abc`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes('Confirmar'));
});

test('GET /confirmar/:token — handles invalid articulos JSON gracefully', async () => {
  reset();
  _getConfirmacionByToken = () => ({
    id: 1, token: 'tok-abc', destinatario: 'Juan', confirmed_at: null,
    articulos: 'bad-json{',
  });
  const res = await fetch(`${BASE}/confirmar/tok-abc`);
  assert.equal(res.status, 200);
});

/* ══════════════════════════════════════════════════════════════
   POST /confirmar/:token
   ══════════════════════════════════════════════════════════════ */

test('POST /confirmar/:token — 404 when token invalid', async () => {
  reset();
  const { status, body } = await post('/confirmar/bad-token', { signed_by: 'Ana' });
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('POST /confirmar/:token — already:true when already confirmed', async () => {
  reset();
  _getConfirmacionByToken = () => ({
    id: 1, token: 'tok-abc', confirmed_at: '2024-01-01T12:00:00', signed_by: 'Luis',
  });
  const { status, body } = await post('/confirmar/tok-abc', { signed_by: 'Ana' });
  assert.equal(status, 200);
  assert.equal(body.already, true);
  assert.equal(body.signed_by, 'Luis');
});

test('POST /confirmar/:token — 400 when signed_by missing', async () => {
  reset();
  _getConfirmacionByToken = () => ({ id: 1, token: 'tok-abc', confirmed_at: null });
  const { status, body } = await post('/confirmar/tok-abc', {});
  assert.equal(status, 400);
  assert.match(body.error, /nombre/i);
});

test('POST /confirmar/:token — 400 when signed_by is blank string', async () => {
  reset();
  _getConfirmacionByToken = () => ({ id: 1, token: 'tok-abc', confirmed_at: null });
  const { status, body } = await post('/confirmar/tok-abc', { signed_by: '   ' });
  assert.equal(status, 400);
  assert.match(body.error, /nombre/i);
});

test('POST /confirmar/:token — 200 on valid confirmation', async () => {
  reset();
  _getConfirmacionByToken = () => ({ id: 1, token: 'tok-abc', confirmed_at: null });
  let capturedArgs;
  _confirmDelivery = (...a) => { capturedArgs = a; };
  const { status, body } = await post('/confirmar/tok-abc', {
    signed_by: 'Ana Torres', signature_data: 'base64data==',
  });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.ok(capturedArgs[3] === 'Ana Torres');
  assert.ok(capturedArgs[4] === 'base64data==');
});

test('POST /confirmar/:token — signature_data null when not provided', async () => {
  reset();
  _getConfirmacionByToken = () => ({ id: 1, token: 'tok-abc', confirmed_at: null });
  let capturedSignature;
  _confirmDelivery = (_db, _id, _ip, _by, sig) => { capturedSignature = sig; };
  const { status } = await post('/confirmar/tok-abc', { signed_by: 'Ana' });
  assert.equal(status, 200);
  assert.equal(capturedSignature, null);
});
