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
const router = (await import('../../src/inventario/celulares-routes.js')).default;

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

// ── GET /api/inventario/celulares/next-placa ──────────────────────────────────

test('GET /celulares/next-placa returns placa for known sede', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/celulares/next-placa?sede=PEREIRA`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.placa.startsWith('AF-PRR'));
  assert.equal(data.code, 'PRR');
  assert.equal(data.num, '001');
  reset();
});

test('GET /celulares/next-placa with no sede uses GEN code', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/celulares/next-placa`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.code, 'GEN');
  assert.equal(data.placa, 'AF-GEN001');
  reset();
});

test('GET /celulares/next-placa increments from existing records', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_celulares')) return [{ placa: 'AF-PRR003' }, { placa: 'AF-PRR007' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/celulares/next-placa?sede=PEREIRA`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.num, '008');
  reset();
});

// ── GET /api/inventario/celulares ─────────────────────────────────────────────

test('GET /api/inventario/celulares returns list with pagination', async () => {
  const celularRow = { id: 1, nombre_completo: 'Juan Perez', imei: '123456789012345', modelo: 'Samsung A52' };
  _all = () => [celularRow];
  _get = (sql) => sql.includes('COUNT(*)') ? { total: 1 } : null;
  const res = await fetch(`${BASE}/api/inventario/celulares`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.celulares));
  assert.equal(data.celulares.length, 1);
  assert.equal(data.total, 1);
  assert.equal(data.page, 1);
  assert.equal(data.limit, 20);
  assert.equal(data.total_pages, 1);
  reset();
});

test('GET /api/inventario/celulares returns empty list', async () => {
  _all = () => [];
  _get = () => ({ total: 0 });
  const res = await fetch(`${BASE}/api/inventario/celulares`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.celulares, []);
  assert.equal(data.total, 0);
  reset();
});

test('GET /api/inventario/celulares with search param', async () => {
  _all = () => [{ id: 2, nombre_completo: 'Maria Lopez', imei: '987654321098765', modelo: 'iPhone 12' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares?search=Maria`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.celulares.length, 1);
  reset();
});

test('GET /api/inventario/celulares with area filter', async () => {
  _all = () => [{ id: 3, nombre_completo: 'Carlos', imei: '111111111111111', modelo: 'Motorola G' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares?area=Ventas`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.celulares.length, 1);
  reset();
});

test('GET /api/inventario/celulares with estado filter', async () => {
  _all = () => [{ id: 4, nombre_completo: 'Ana', imei: '222222222222222', modelo: 'Huawei P30', estado: 'nuevo' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares?estado=nuevo`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.celulares.length, 1);
  reset();
});

test('GET /api/inventario/celulares with page and limit', async () => {
  _all = () => [];
  _get = () => ({ total: 100 });
  const res = await fetch(`${BASE}/api/inventario/celulares?page=2&limit=25`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.page, 2);
  assert.equal(data.limit, 25);
  assert.equal(data.total_pages, 4);
  reset();
});

test('GET /api/inventario/celulares with combined search and estado filters', async () => {
  _all = () => [{ id: 5, nombre_completo: 'Luis', imei: '333333333333333', modelo: 'Samsung S21', estado: 'usado' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares?search=Samsung&estado=usado`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.celulares.length, 1);
  reset();
});

// ── POST /api/inventario/celulares ────────────────────────────────────────────

test('POST /api/inventario/celulares creates celular successfully', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 55 });
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Juan Perez', imei: '123456789012345' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.id, 55);
  assert.ok(typeof data.qr_token === 'string');
  reset();
});

test('POST /api/inventario/celulares returns 400 when nombre_completo missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imei: '123456789012345' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('requeridos'));
  reset();
});

test('POST /api/inventario/celulares returns 400 when imei missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Juan Perez' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('requeridos'));
  reset();
});

test('POST /api/inventario/celulares returns 400 when both fields missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelo: 'Samsung' }),
  });
  assert.equal(res.status, 400);
  reset();
});

test('POST /api/inventario/celulares returns 409 on UNIQUE constraint', async () => {
  _run = () => { throw new Error('UNIQUE constraint failed: inventario_celulares.imei'); };
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Juan Perez', imei: '123456789012345' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.error.includes('IMEI o placa'));
  reset();
});

test('POST /api/inventario/celulares with all optional fields', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 60 });
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placa: 'AF-BOG001', fecha_registro: '2024-01-15', area: 'Ventas',
      ciudad: 'Bogota', nombre_completo: 'Maria Lopez', cedula: '12345678',
      linea: '3001234567', operador: 'Claro', equipo: 'Samsung',
      almacenamiento: '128GB', ram: '6GB', modelo: 'A52',
      imei: '123456789012345', imei2: '987654321098765', serial: 'SAMSN001',
      estado: 'nuevo', accesorio: 'Funda', fecha_entrega: '2024-01-20',
      entregado_por: 'IT', numero_telefono: '3001234567',
    }),
  });
  assert.equal(res.status, 201);
  reset();
});

test('POST /api/inventario/celulares defaults estado to nuevo when not provided', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 61 });
  const res = await fetch(`${BASE}/api/inventario/celulares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Pedro', imei: '444444444444444' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

// ── PUT /api/inventario/celulares/:id ────────────────────────────────────────

test('PUT /api/inventario/celulares/:id updates celular successfully', async () => {
  _get = () => ({ id: 1 });
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Juan Actualizado', imei: '123456789012345', modelo: 'Samsung A52 Updated' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

test('PUT /api/inventario/celulares/:id returns 404 when not found', async () => {
  _get = () => null;
  const res = await fetch(`${BASE}/api/inventario/celulares/999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Juan', imei: '123456789012345' }),
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('no encontrado'));
  reset();
});

test('PUT /api/inventario/celulares/:id returns 409 on UNIQUE constraint', async () => {
  _get = () => ({ id: 1 });
  _run = () => { throw new Error('UNIQUE constraint failed: inventario_celulares.imei'); };
  const res = await fetch(`${BASE}/api/inventario/celulares/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Juan', imei: '111111111111111' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.error.includes('IMEI o placa'));
  reset();
});

test('PUT /api/inventario/celulares/:id updates all optional fields', async () => {
  _get = () => ({ id: 2 });
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares/2`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placa: 'AF-BOG002', fecha_registro: '2024-02-01', area: 'Contabilidad',
      ciudad: 'Medellin', nombre_completo: 'Sofia Gomez', cedula: '87654321',
      linea: '3109876543', operador: 'Movistar', equipo: 'Apple',
      almacenamiento: '256GB', ram: '4GB', modelo: 'iPhone 13',
      imei: '555555555555555', imei2: null, serial: 'IPHSN002',
      estado: 'usado', accesorio: 'Protector', fecha_entrega: '2024-02-05',
      entregado_por: 'Almacen', numero_telefono: '3109876543',
    }),
  });
  assert.equal(res.status, 200);
  reset();
});

// ── DELETE /api/inventario/celulares/:id ─────────────────────────────────────

test('DELETE /api/inventario/celulares/:id deletes celular successfully', async () => {
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/celulares/1`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

test('DELETE /api/inventario/celulares/:id returns 404 when not found', async () => {
  _run = () => ({ changes: 0 });
  const res = await fetch(`${BASE}/api/inventario/celulares/999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('no encontrado'));
  reset();
});
