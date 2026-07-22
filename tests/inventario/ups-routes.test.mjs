import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── 1. Mock db FIRST (before any imports that use it) ─────────────────────────
let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 1 });

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

// ── 2. Mock auth middleware ───────────────────────────────────────────────────
await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => next(),
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

// ── 3. Import router AFTER mocks ─────────────────────────────────────────────
const router = (await import('../../src/inventario/ups-routes.js')).default;

// ── 4. Create test server ─────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

function reset() {
  _get = () => null;
  _all = () => [];
  _run = () => ({ changes: 1, lastInsertRowid: 1 });
}

// ── GET /api/inventario/ups/next-placa ────────────────────────────────────────

test('GET /ups/next-placa returns placa for known sede', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/ups/next-placa?sede=MANIZALES`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.placa.startsWith('AF-MNZ'));
  assert.equal(data.code, 'MNZ');
  assert.equal(data.num, '001');
  reset();
});

test('GET /ups/next-placa with no sede uses GEN code', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/ups/next-placa`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.code, 'GEN');
  assert.equal(data.placa, 'AF-GEN001');
  reset();
});

test('GET /ups/next-placa increments from existing records across all tables', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [{ placa: 'AF-MNZ002' }];
    if (sql.includes('inventario_ups'))     return [{ placa: 'AF-MNZ010' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/ups/next-placa?sede=MANIZALES`);
  assert.equal(res.status, 200);
  const data = await res.json();
  // max across all tables is 010, so next is 011
  assert.equal(data.num, '011');
  reset();
});

test('GET /ups/next-placa for unknown sede falls back to letter code', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/ups/next-placa?sede=CIUDADDESCONOCIDA`);
  assert.equal(res.status, 200);
  const data = await res.json();
  // Fallback: first 3 letters of normalized name = CIU
  assert.ok(typeof data.placa === 'string');
  assert.ok(data.placa.startsWith('AF-'));
  reset();
});

// ── GET /api/inventario/ups ───────────────────────────────────────────────────

test('GET /api/inventario/ups returns list with pagination', async () => {
  const upsRow = { id: 1, placa: 'AF-BOG001', marca: 'APC', nombre_equipo: 'UPS 600VA', serial: 'UPSSN001' };
  _all = () => [upsRow];
  _get = (sql) => sql.includes('COUNT(*)') ? { total: 1 } : null;
  const res = await fetch(`${BASE}/api/inventario/ups`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.ups));
  assert.equal(data.ups.length, 1);
  assert.equal(data.total, 1);
  assert.equal(data.page, 1);
  assert.equal(data.limit, 20);
  assert.equal(data.total_pages, 1);
  reset();
});

test('GET /api/inventario/ups returns empty list', async () => {
  _all = () => [];
  _get = () => ({ total: 0 });
  const res = await fetch(`${BASE}/api/inventario/ups`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.ups, []);
  assert.equal(data.total, 0);
  assert.equal(data.total_pages, 0);
  reset();
});

test('GET /api/inventario/ups with search param', async () => {
  _all = () => [{ id: 2, placa: 'AF-BOG002', marca: 'Eaton', nombre_equipo: 'UPS 1500VA', serial: 'EATONSN001' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/ups?search=Eaton`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ups.length, 1);
  reset();
});

test('GET /api/inventario/ups with area filter', async () => {
  _all = () => [{ id: 3, placa: 'AF-BOG003', marca: 'APC', nombre_equipo: 'UPS 900VA', serial: 'UPSSN003' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/ups?area=Servidores`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ups.length, 1);
  reset();
});

test('GET /api/inventario/ups with page and limit', async () => {
  _all = () => [];
  _get = () => ({ total: 40 });
  const res = await fetch(`${BASE}/api/inventario/ups?page=2&limit=10`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.page, 2);
  assert.equal(data.limit, 10);
  assert.equal(data.total_pages, 4);
  reset();
});

test('GET /api/inventario/ups with search and area combined', async () => {
  _all = () => [{ id: 4, placa: 'AF-BOG004', marca: 'APC', area: 'Sistemas', serial: 'UPSSN004' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/ups?search=APC&area=Sistemas`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ups.length, 1);
  reset();
});

// ── POST /api/inventario/ups ──────────────────────────────────────────────────

test('POST /api/inventario/ups creates UPS successfully with placa only', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 77 });
  const res = await fetch(`${BASE}/api/inventario/ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.id, 77);
  assert.ok(typeof data.qr_token === 'string');
  reset();
});

test('POST /api/inventario/ups creates UPS with all fields', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 78 });
  const res = await fetch(`${BASE}/api/inventario/ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placa: 'AF-BOG002', marca: 'APC', nombre_equipo: 'UPS 1000VA',
      serial: 'APCUPS001', area: 'Servidores', voltaje: '120V',
      fecha_compra: '2024-01-15', fecha_despacho: '2024-01-20', ciudad: 'Bogota',
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.id, 78);
  reset();
});

test('POST /api/inventario/ups returns 400 when placa missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marca: 'APC', nombre_equipo: 'UPS 600VA' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('placa'));
  reset();
});

test('POST /api/inventario/ups returns 400 when placa is whitespace only', async () => {
  const res = await fetch(`${BASE}/api/inventario/ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: '   ' }),
  });
  assert.equal(res.status, 400);
  reset();
});

test('POST /api/inventario/ups returns 409 on UNIQUE constraint', async () => {
  _run = () => { throw new Error('UNIQUE constraint failed: inventario_ups.placa'); };
  const res = await fetch(`${BASE}/api/inventario/ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.error.includes('placa'));
  reset();
});

test('POST /api/inventario/ups propagates non-UNIQUE errors as 500', async () => {
  _run = () => { throw new Error('disk I/O error'); };
  const res = await fetch(`${BASE}/api/inventario/ups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001' }),
  });
  assert.equal(res.status, 500);
  reset();
});

// ── PUT /api/inventario/ups/:id ───────────────────────────────────────────────

test('PUT /api/inventario/ups/:id updates UPS successfully', async () => {
  _get = () => ({ id: 1 });
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/ups/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'APC Updated', nombre_equipo: 'UPS 1200VA' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

test('PUT /api/inventario/ups/:id returns 404 when not found', async () => {
  _get = () => null;
  const res = await fetch(`${BASE}/api/inventario/ups/999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'APC' }),
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('no encontrada'));
  reset();
});

test('PUT /api/inventario/ups/:id returns 409 on UNIQUE constraint', async () => {
  _get = () => ({ id: 1 });
  _run = () => { throw new Error('UNIQUE constraint failed: inventario_ups.placa'); };
  const res = await fetch(`${BASE}/api/inventario/ups/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG-DUPLICATE' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.error.includes('ya existe'));
  reset();
});

test('PUT /api/inventario/ups/:id with all optional fields', async () => {
  _get = () => ({ id: 2 });
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/ups/2`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placa: 'AF-MNZ001', marca: 'Eaton', nombre_equipo: 'UPS 750VA',
      serial: 'EATONSN002', area: 'Redes', voltaje: '220V',
      fecha_compra: '2023-06-01', fecha_despacho: '2023-06-10', ciudad: 'Manizales',
    }),
  });
  assert.equal(res.status, 200);
  reset();
});

test('PUT /api/inventario/ups/:id propagates non-UNIQUE errors as 500', async () => {
  _get = () => ({ id: 1 });
  _run = () => { throw new Error('database is locked'); };
  const res = await fetch(`${BASE}/api/inventario/ups/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001' }),
  });
  assert.equal(res.status, 500);
  reset();
});

// ── DELETE /api/inventario/ups/:id ───────────────────────────────────────────

test('DELETE /api/inventario/ups/:id deletes UPS successfully', async () => {
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/ups/1`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

test('DELETE /api/inventario/ups/:id returns 404 when not found', async () => {
  _run = () => ({ changes: 0 });
  const res = await fetch(`${BASE}/api/inventario/ups/999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('no encontrada'));
  reset();
});
