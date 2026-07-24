/**
 * Integration tests for src/sedes/sedes-routes.js
 * Uses node:test + mock.module + real HTTP server (no DB, no auth).
 */
import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

/* ── controllable stubs ─────────────────────────────────────────────────── */
let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });

function reset() {
  _get = () => null;
  _all = () => [];
  _run = () => ({ changes: 1, lastInsertRowid: 1 });
}

/* ── mocks (must come before router import) ─────────────────────────────── */
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

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => next(),
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

await mock.module('../../src/tracking/tracking-model.js', {
  exports: {
    createTracking: () => 'token-xyz',
    addEvento:      () => {},
  },
});

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => fn,
  },
});

/* ── build test server ───────────────────────────────────────────────────── */
const router = (await import('../../src/sedes/sedes-routes.js')).default;

const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((r) => server.close(r)));

/* ── helpers ─────────────────────────────────────────────────────────────── */
async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

const get  = (p)    => req('GET',    p);
const post = (p, b) => req('POST',   p, b);
const put  = (p, b) => req('PUT',    p, b);
const del  = (p)    => req('DELETE', p);

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/sedes
   ══════════════════════════════════════════════════════════════════════════ */
test('GET /api/sedes — returns grouped results', async () => {
  reset();
  _all = () => [
    { id: 1, ciudad: 'CALI', nombre_punto: 'Central', activo: 1, created_at: '2024-01-01', despacho_id: null, tracking_token: null, tracking_estado: null },
    { id: 2, ciudad: 'CALI', nombre_punto: 'Norte',   activo: 1, created_at: '2024-01-02', despacho_id: null, tracking_token: null, tracking_estado: null },
  ];

  const { status, body } = await get('/api/sedes');
  assert.equal(status, 200);
  assert.ok(body.grouped);
  assert.equal(body.total, 2);
  assert.ok(Array.isArray(body.grouped['CALI']));
  assert.equal(body.grouped['CALI'].length, 2);
});

test('GET /api/sedes — empty when no rows', async () => {
  reset();
  _all = () => [];

  const { status, body } = await get('/api/sedes');
  assert.equal(status, 200);
  assert.deepEqual(body, { grouped: {}, total: 0 });
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/sedes
   ══════════════════════════════════════════════════════════════════════════ */
test('POST /api/sedes — creates a new punto', async () => {
  reset();
  _run = () => ({ changes: 1, lastInsertRowid: 42 });

  const { status, body } = await post('/api/sedes', { ciudad: 'Bogotá', nombre_punto: 'Centro' });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.id, 42);
});

test('POST /api/sedes — 400 when ciudad is missing', async () => {
  const { status, body } = await post('/api/sedes', { nombre_punto: 'Centro' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/sedes — 400 when nombre_punto is missing', async () => {
  const { status, body } = await post('/api/sedes', { ciudad: 'Cali' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/sedes — 400 when both fields are empty strings', async () => {
  const { status, body } = await post('/api/sedes', { ciudad: '  ', nombre_punto: '  ' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/sedes/setup
   ══════════════════════════════════════════════════════════════════════════ */
test('POST /api/sedes/setup — creates sede without articulos', async () => {
  reset();
  _run = () => ({ changes: 1, lastInsertRowid: 5 });

  const { status, body } = await post('/api/sedes/setup', {
    ciudad: 'Pereira',
    nombre_punto: 'Punto Pereira',
  });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.tracking_token, null);
});

test('POST /api/sedes/setup — creates sede with articulos and tracking token', async () => {
  reset();
  _run = () => ({ changes: 1, lastInsertRowid: 10 });
  // generateDespachoNumero inner .get() call returns null (first despacho)
  _get = () => null;

  const { status, body } = await post('/api/sedes/setup', {
    ciudad: 'Medellín',
    nombre_punto: 'Norte',
    articulos: [{ nombre: 'Laptop', cantidad: 1 }],
  });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.tracking_token, 'token-xyz');
  assert.ok(body.tracking_url?.includes('token-xyz'));
});

test('POST /api/sedes/setup — 400 when ciudad missing', async () => {
  const { status, body } = await post('/api/sedes/setup', { nombre_punto: 'Punto' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   PUT /api/sedes/:id
   ══════════════════════════════════════════════════════════════════════════ */
test('PUT /api/sedes/:id — updates fields', async () => {
  reset();
  const { status, body } = await put('/api/sedes/1', { ciudad: 'Cali', activo: false });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('PUT /api/sedes/:id — 400 when no fields sent', async () => {
  const { status, body } = await put('/api/sedes/1', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   DELETE /api/sedes/:id
   ══════════════════════════════════════════════════════════════════════════ */
test('DELETE /api/sedes/:id — soft-deletes', async () => {
  reset();
  const { status, body } = await del('/api/sedes/7');
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/sedes/:id/checklist
   ══════════════════════════════════════════════════════════════════════════ */
test('GET /api/sedes/:id/checklist — 404 when sede not found', async () => {
  reset();
  _get = () => null;
  const { status, body } = await get('/api/sedes/99/checklist');
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('GET /api/sedes/:id/checklist — returns null checklist when no despacho', async () => {
  reset();
  _get = () => ({ id: 1, nombre: 'Central', despacho_id: null, tracking_token: null });
  const { status, body } = await get('/api/sedes/1/checklist');
  assert.equal(status, 200);
  assert.equal(body.checklist, null);
});

test('GET /api/sedes/:id/checklist — returns checklist with despacho data', async () => {
  reset();
  const responses = [
    { id: 1, nombre: 'Central', despacho_id: 10, tracking_token: 'tok-abc' },
    { articulos: JSON.stringify([{ nombre: 'Mouse', cantidad: 1 }]) },
    { estado: 'creado' },
  ];
  let callCount = 0;
  _get = () => responses[callCount++] || null;

  const { status, body } = await get('/api/sedes/1/checklist');
  assert.equal(status, 200);
  assert.ok(body.checklist);
  assert.equal(body.checklist.sede_id, 1);
  assert.ok(Array.isArray(body.checklist.articulos));
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/sedes/:id/marcar-enviado
   ══════════════════════════════════════════════════════════════════════════ */
test('POST /api/sedes/:id/marcar-enviado — 400 when no tracking_token', async () => {
  reset();
  _get = () => ({ tracking_token: null });
  const { status, body } = await post('/api/sedes/1/marcar-enviado', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/sedes/:id/marcar-enviado — 404 when tracking not found', async () => {
  reset();
  let n = 0;
  _get = () => n++ === 0 ? { tracking_token: 'tok-abc' } : null;
  const { status, body } = await post('/api/sedes/1/marcar-enviado', {});
  assert.equal(status, 404);
  assert.ok(body.error);
});

test('POST /api/sedes/:id/marcar-enviado — 409 when already processed', async () => {
  reset();
  let n = 0;
  _get = () => n++ === 0
    ? { tracking_token: 'tok-abc' }
    : { id: 5, estado: 'en_transito' };
  const { status, body } = await post('/api/sedes/1/marcar-enviado', {});
  assert.equal(status, 409);
  assert.ok(body.error);
});

test('POST /api/sedes/:id/marcar-enviado — success when estado is creado', async () => {
  reset();
  let n = 0;
  _get = () => n++ === 0
    ? { tracking_token: 'tok-abc' }
    : { id: 5, estado: 'creado' };
  const { status, body } = await post('/api/sedes/1/marcar-enviado', { agente: 'tester' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/bodegas
   ══════════════════════════════════════════════════════════════════════════ */
test('GET /api/bodegas — returns grouped bodegas', async () => {
  reset();
  _all = () => [
    { id: 1, nombre: 'Bodega Principal', ciudad: 'CALI', activo: 1, created_at: '2024-01-01' },
  ];
  const { status, body } = await get('/api/bodegas');
  assert.equal(status, 200);
  assert.equal(body.total, 1);
  assert.ok(body.grouped['CALI']);
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/bodegas
   ══════════════════════════════════════════════════════════════════════════ */
test('POST /api/bodegas — creates bodega', async () => {
  reset();
  _run = () => ({ changes: 1, lastInsertRowid: 7 });
  const { status, body } = await post('/api/bodegas', { nombre: 'Bodega Sur', ciudad: 'Cali' });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.id, 7);
});

test('POST /api/bodegas — 400 when nombre missing', async () => {
  const { status, body } = await post('/api/bodegas', { ciudad: 'Cali' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/puntos
   ══════════════════════════════════════════════════════════════════════════ */
test('GET /api/puntos — returns all puntos', async () => {
  reset();
  _all = () => [
    { id: 1, nombre: 'Punto A', ciudad: 'BOGOTA', tipo: 'punto', activo: 1, created_at: '2024-01-01' },
    { id: 2, nombre: 'Bodega B', ciudad: 'BOGOTA', tipo: 'bodega', activo: 1, created_at: '2024-01-02' },
  ];
  const { status, body } = await get('/api/puntos');
  assert.equal(status, 200);
  assert.equal(body.total, 2);
  assert.ok(Array.isArray(body.puntos));
  assert.ok(body.grouped['BOGOTA']);
});

test('GET /api/puntos — filters by tipo query param', async () => {
  reset();
  _all = () => [
    { id: 1, nombre: 'Punto A', ciudad: 'CALI', tipo: 'punto', activo: 1, created_at: '2024-01-01' },
  ];
  const { status, body } = await get('/api/puntos?tipo=punto');
  assert.equal(status, 200);
  assert.equal(body.total, 1);
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/puntos
   ══════════════════════════════════════════════════════════════════════════ */
test('POST /api/puntos — creates punto with default tipo', async () => {
  reset();
  _run = () => ({ changes: 1, lastInsertRowid: 15 });
  const { status, body } = await post('/api/puntos', { nombre: 'Punto Z', ciudad: 'Cali' });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(body.id, 15);
});

test('POST /api/puntos — 400 for invalid tipo', async () => {
  const { status, body } = await post('/api/puntos', { nombre: 'X', ciudad: 'Cali', tipo: 'almacen' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/puntos — 400 when nombre missing', async () => {
  const { status, body } = await post('/api/puntos', { ciudad: 'Cali' });
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   PUT /api/puntos/:id
   ══════════════════════════════════════════════════════════════════════════ */
test('PUT /api/puntos/:id — updates punto', async () => {
  reset();
  const { status, body } = await put('/api/puntos/3', { nombre: 'Nuevo nombre' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('PUT /api/puntos/:id — 400 when nothing to update', async () => {
  const { status, body } = await put('/api/puntos/3', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

/* ══════════════════════════════════════════════════════════════════════════
   DELETE /api/puntos/:id
   ══════════════════════════════════════════════════════════════════════════ */
test('DELETE /api/puntos/:id — soft-deletes', async () => {
  reset();
  const { status, body } = await del('/api/puntos/9');
  assert.equal(status, 200);
  assert.equal(body.success, true);
});
