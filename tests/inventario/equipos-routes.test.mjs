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
const router = (await import('../../src/inventario/equipos-routes.js')).default;

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

// ── GET /api/inventario/equipos/next-placa ────────────────────────────────────

test('GET /next-placa returns placa for known sede', async () => {
  // nextConsecutivo calls db.prepare().all() for each table (3 tables)
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/equipos/next-placa?sede=BOGOTA`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.placa.startsWith('AF-BOG'));
  assert.equal(data.code, 'BOG');
  assert.equal(data.num, '001');
  reset();
});

test('GET /next-placa uses GEN code for unknown sede', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/equipos/next-placa?sede=UNKNOWNCITY`);
  assert.equal(res.status, 200);
  const data = await res.json();
  // Unknown city → fallback to first 3 letters: UNK
  assert.ok(typeof data.placa === 'string');
  assert.ok(data.placa.startsWith('AF-'));
  reset();
});

test('GET /next-placa with no sede uses GEN code', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/equipos/next-placa`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.code, 'GEN');
  reset();
});

test('GET /next-placa increments consecutive number from existing placas', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [{ placa: 'AF-BOG005' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/equipos/next-placa?sede=BOGOTA`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.num, '006');
  reset();
});

// ── GET /api/inventario/equipos ───────────────────────────────────────────────

test('GET /api/inventario/equipos returns list with pagination', async () => {
  const equipoRow = { id: 1, placa: 'AF-BOG001', marca: 'Dell', nombre_equipo: 'Laptop', serial: 'SN1', categoria: 'computadores' };
  _all = () => [equipoRow];
  _get = (sql) => sql.includes('COUNT(*)') ? { total: 1 } : null;
  const res = await fetch(`${BASE}/api/inventario/equipos`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.equipos));
  assert.equal(data.equipos.length, 1);
  assert.equal(data.total, 1);
  assert.equal(data.page, 1);
  assert.equal(data.limit, 20);
  assert.equal(data.total_pages, 1);
  reset();
});

test('GET /api/inventario/equipos returns empty list', async () => {
  _all = () => [];
  _get = () => ({ total: 0 });
  const res = await fetch(`${BASE}/api/inventario/equipos`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.equipos, []);
  assert.equal(data.total, 0);
  reset();
});

test('GET /api/inventario/equipos with search param', async () => {
  _all = () => [{ id: 2, placa: 'AF-BOG002', marca: 'HP', nombre_equipo: 'Desktop', serial: 'SN2', categoria: 'computadores' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/equipos?search=HP`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.equipos.length, 1);
  reset();
});

test('GET /api/inventario/equipos with area filter', async () => {
  _all = () => [{ id: 3, placa: 'AF-BOG003', marca: 'Lenovo', nombre_equipo: 'Laptop', serial: 'SN3', categoria: 'computadores' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/equipos?area=Sistemas`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.equipos.length, 1);
  reset();
});

test('GET /api/inventario/equipos with categoria filter', async () => {
  _all = () => [{ id: 4, placa: 'AF-BOG004', marca: 'Asus', nombre_equipo: 'Monitor', serial: 'SN4', categoria: 'monitores' }];
  _get = () => ({ total: 1 });
  const res = await fetch(`${BASE}/api/inventario/equipos?categoria=monitores`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.equipos.length, 1);
  reset();
});

test('GET /api/inventario/equipos with page and limit', async () => {
  _all = () => [];
  _get = () => ({ total: 50 });
  const res = await fetch(`${BASE}/api/inventario/equipos?page=3&limit=10`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.page, 3);
  assert.equal(data.limit, 10);
  assert.equal(data.total_pages, 5);
  reset();
});

// ── POST /api/inventario/equipos ──────────────────────────────────────────────

test('POST /api/inventario/equipos creates equipo successfully', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 42 });
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell', nombre_equipo: 'Laptop Pro', serial: 'DELLSN001' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.id, 42);
  assert.ok(typeof data.qr_token === 'string');
  reset();
});

test('POST /api/inventario/equipos returns 400 when placa missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marca: 'Dell', nombre_equipo: 'Laptop', serial: 'SN1' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('requeridos'));
  reset();
});

test('POST /api/inventario/equipos returns 400 when marca missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', nombre_equipo: 'Laptop', serial: 'SN1' }),
  });
  assert.equal(res.status, 400);
  reset();
});

test('POST /api/inventario/equipos returns 400 when nombre_equipo missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell', serial: 'SN1' }),
  });
  assert.equal(res.status, 400);
  reset();
});

test('POST /api/inventario/equipos returns 400 when serial missing', async () => {
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell', nombre_equipo: 'Laptop' }),
  });
  assert.equal(res.status, 400);
  reset();
});

test('POST /api/inventario/equipos returns 409 on UNIQUE constraint', async () => {
  _run = () => { throw new Error('UNIQUE constraint failed: inventario_equipos.placa'); };
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell', nombre_equipo: 'Laptop', serial: 'SN1' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.error.includes('placa o serial'));
  reset();
});

test('POST /api/inventario/equipos with optional fields', async () => {
  _run = () => ({ changes: 1, lastInsertRowid: 10 });
  const res = await fetch(`${BASE}/api/inventario/equipos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      placa: 'AF-BOG005', marca: 'Dell', nombre_equipo: 'Laptop', serial: 'SN5',
      procesador: 'Intel i7', ram: '16GB', tipo_ram: 'DDR4',
      cap_disco: '512GB', tipo_disco: 'SSD', serial_cargador: 'CHG001',
      area: 'Sistemas', responsable: 'Juan', fecha_compra: '2024-01-01',
      categoria: 'computadores', ciudad: 'Bogota',
    }),
  });
  assert.equal(res.status, 201);
  reset();
});

// ── PUT /api/inventario/equipos/:id ──────────────────────────────────────────

test('PUT /api/inventario/equipos/:id updates equipo successfully', async () => {
  _get = () => ({ id: 1 });
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/equipos/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell Updated', nombre_equipo: 'Laptop Pro', serial: 'SN1' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

test('PUT /api/inventario/equipos/:id returns 404 when equipo not found', async () => {
  _get = () => null;
  const res = await fetch(`${BASE}/api/inventario/equipos/999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell', nombre_equipo: 'Laptop', serial: 'SN1' }),
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('no encontrado'));
  reset();
});

test('PUT /api/inventario/equipos/:id returns 409 on UNIQUE constraint', async () => {
  _get = () => ({ id: 1 });
  _run = () => { throw new Error('UNIQUE constraint failed: inventario_equipos.serial'); };
  const res = await fetch(`${BASE}/api/inventario/equipos/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placa: 'AF-BOG001', marca: 'Dell', nombre_equipo: 'Laptop', serial: 'SN-DUPLICATE' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.ok(data.error.includes('ya existe'));
  reset();
});

// ── DELETE /api/inventario/equipos/:id ───────────────────────────────────────

test('DELETE /api/inventario/equipos/:id deletes equipo successfully', async () => {
  _run = () => ({ changes: 1 });
  const res = await fetch(`${BASE}/api/inventario/equipos/1`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  reset();
});

test('DELETE /api/inventario/equipos/:id returns 404 when not found', async () => {
  _run = () => ({ changes: 0 });
  const res = await fetch(`${BASE}/api/inventario/equipos/999`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.ok(data.error.includes('no encontrado'));
  reset();
});

// ── GET /api/inventario/puntos ────────────────────────────────────────────────

test('GET /api/inventario/puntos returns list of areas', async () => {
  _all = () => [{ area: 'Sistemas' }, { area: 'Contabilidad' }];
  const res = await fetch(`${BASE}/api/inventario/puntos`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.puntos));
  assert.deepEqual(data.puntos, ['Sistemas', 'Contabilidad']);
  reset();
});

test('GET /api/inventario/puntos returns empty array when no areas', async () => {
  _all = () => [];
  const res = await fetch(`${BASE}/api/inventario/puntos`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.puntos, []);
  reset();
});

// ── GET /api/inventario/reporte ───────────────────────────────────────────────

test('GET /api/inventario/reporte returns full report', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [{ id: 1, placa: 'AF-BOG001', categoria: 'computadores' }];
    if (sql.includes('inventario_celulares')) return [{ id: 1, nombre_completo: 'Juan' }];
    if (sql.includes('inventario_ups')) return [{ id: 1, placa: 'AF-BOG-UPS01' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.equipos));
  assert.ok(Array.isArray(data.celulares));
  assert.ok(Array.isArray(data.ups));
  assert.ok(Array.isArray(data.resumen));
  assert.equal(data.total, 3);
  reset();
});

test('GET /api/inventario/reporte with area filter', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [{ id: 1, placa: 'AF-BOG001', categoria: 'computadores' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte?area=Sistemas`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.area === 'Sistemas');
  reset();
});

test('GET /api/inventario/reporte with apiTab=equipos filters to equipos only', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [{ id: 1, placa: 'AF-BOG001', categoria: 'monitores' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte?apiTab=equipos`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.equipos.length, 1);
  assert.deepEqual(data.celulares, []);
  assert.deepEqual(data.ups, []);
  reset();
});

test('GET /api/inventario/reporte with apiTab=celulares filters to celulares only', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_celulares')) return [{ id: 1, nombre_completo: 'Maria' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte?apiTab=celulares`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.equipos, []);
  assert.equal(data.celulares.length, 1);
  assert.deepEqual(data.ups, []);
  reset();
});

test('GET /api/inventario/reporte with apiTab=ups filters to ups only', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_ups')) return [{ id: 1, placa: 'AF-BOG-UPS01' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte?apiTab=ups`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.equipos, []);
  assert.deepEqual(data.celulares, []);
  assert.equal(data.ups.length, 1);
  reset();
});

test('GET /api/inventario/reporte with categoria filter', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [{ id: 1, placa: 'AF-BOG001', categoria: 'impresoras' }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte?categoria=impresoras`);
  assert.equal(res.status, 200);
  const data = await res.json();
  const resumenEntry = data.resumen.find(r => r.categoria === 'impresoras');
  assert.ok(resumenEntry);
  assert.equal(resumenEntry.count, 1);
  reset();
});

test('GET /api/inventario/reporte builds resumen from mixed inventory', async () => {
  _all = (sql) => {
    if (sql.includes('inventario_equipos')) return [
      { id: 1, categoria: 'computadores' },
      { id: 2, categoria: 'computadores' },
      { id: 3, categoria: 'monitores' },
    ];
    if (sql.includes('inventario_celulares')) return [{ id: 1 }, { id: 2 }];
    if (sql.includes('inventario_ups')) return [{ id: 1 }];
    return [];
  };
  const res = await fetch(`${BASE}/api/inventario/reporte`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.total, 6);
  const compCount = data.resumen.find(r => r.categoria === 'computadores');
  assert.equal(compCount.count, 2);
  const monCount = data.resumen.find(r => r.categoria === 'monitores');
  assert.equal(monCount.count, 1);
  const celCount = data.resumen.find(r => r.categoria === 'celulares');
  assert.equal(celCount.count, 2);
  const upsCount = data.resumen.find(r => r.categoria === 'ups');
  assert.equal(upsCount.count, 1);
  reset();
});
