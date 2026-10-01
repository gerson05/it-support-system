/**
 * Integration tests for src/employees/employees-routes.js
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
        get: async (...a) => _get(sql, ...a),
        all: async (...a) => _all(sql, ...a),
        run: async (...a) => _run(sql, ...a),
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

// ── 4. Mock employees-model (keeps model functions testable via db mock) ─────
//    The model imports db directly, so we mock it at the model level too
//    by re-exporting controlled implementations.

let _modelEmployees = [];
let _modelEmployee  = null;
let _modelCreateId  = 1;
let _modelCargos    = [];
let _modelAreas     = [];
let _modelPending   = 0;
let _modelCreateErr = null;
let _modelUpdateErr = null;
let _modelDeleteErr = null;
let _lastCreateData = null;
let _mantisResults  = [];
let _mantisConfigured = false;
let _mantisCreateErr  = null;

await mock.module('../../src/mantis/mantis-client.js', {
  exports: {
    buildMantisPayload: (emp) => ({ usuario: emp.usuario }),
    isMantisConfigured: () => _mantisConfigured,
    createUser: async () => { if (_mantisCreateErr) throw _mantisCreateErr; return { ok: true }; },
  },
});

await mock.module('../../src/employees/employees-model.js', {
  exports: {
    getAllEmployees:  () => _modelEmployees,
    getEmployeeById: (_id) => _modelEmployee,
    createEmployee:  (data) => {
      if (_modelCreateErr) throw _modelCreateErr;
      _lastCreateData = data;
      _modelEmployee ??= { id: _modelCreateId, nombre_completo: data.nombre_completo, cargo: data.cargo || 'PERFIL', area: data.area || 'SEDE' };
      return { id: _modelCreateId, ...(data.perfil_codigo ? { usuario: 'GGOSORIO', contraseña: '4821' } : {}) };
    },
    completeEmployee: (_id, _fecha, _userId) => ({ usuario: 'UTEST', contraseña: '1234' }),
    setMantisResult:  (id, result) => { _mantisResults.push({ id, ...result }); },
    suggestUsername:  (nombre) => `SUG-${nombre}`,
    suggestPassword:  () => '0042',
    updateEmployee:   (_id, _data, _userId) => {
      if (_modelUpdateErr) throw _modelUpdateErr;
    },
    deleteEmployee:   (_id, _userId) => {
      if (_modelDeleteErr) throw _modelDeleteErr;
    },
    getCargos:   () => _modelCargos,
    createCargo: (nombre) => ({ id: 99, nombre }),
    getAreas:    () => _modelAreas,
    getPendingCount: () => _modelPending,
  },
});

// ── 5. Mock broadcaster (no SSE side-effects) ───────────────────────────────

await mock.module('../../src/events/broadcaster.js', {
  exports: {
    appEvents: { emit: () => {} },
  },
});

// ── 6. Mock WhatsApp messenger ───────────────────────────────────────────────

await mock.module('../../src/whatsapp/messenger.js', {
  exports: {
    sendWhatsAppMessage: async () => {},
  },
});

// ── 7. Mock async-handler (simple passthrough) ───────────────────────────────

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  },
});

// ── 8. Import router AFTER all mocks ────────────────────────────────────────

const router = (await import('../../src/employees/employees-routes.js')).default;

// ── 9. Create test server ────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

after(() => new Promise(r => server.close(r)));

// ── Reset helpers ────────────────────────────────────────────────────────────

function reset() {
  _get = () => null;
  _all = () => [];
  _run = () => ({ changes: 1, lastInsertRowid: 1 });

  _modelEmployees = [];
  _modelEmployee  = null;
  _modelCreateId  = 1;
  _modelCargos    = [];
  _modelAreas     = [];
  _modelPending   = 0;
  _modelCreateErr = null;
  _modelUpdateErr = null;
  _modelDeleteErr = null;
  _lastCreateData = null;
  _mantisResults  = [];
  _mantisConfigured = false;
  _mantisCreateErr  = null;
}

const post = (path, body) => fetch(`${BASE}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
});

// ── Tests ────────────────────────────────────────────────────────────────────

// GET /api/employees — list

test('GET /api/employees returns empty array', async () => {
  reset();
  _modelEmployees = [];
  const res = await fetch(`${BASE}/api/employees`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

test('GET /api/employees returns employee list', async () => {
  reset();
  _modelEmployees = [
    { id: 1, nombre_completo: 'Ana Gomez', cargo: 'Aux', area: 'TI' },
    { id: 2, nombre_completo: 'Luis Perez', cargo: 'Jefe', area: 'Admin' },
  ];
  const res = await fetch(`${BASE}/api/employees`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2);
  assert.equal(body[0].nombre_completo, 'Ana Gomez');
});

// GET /api/employees/pending-count

test('GET /api/employees/pending-count returns count', async () => {
  reset();
  _modelPending = 3;
  const res = await fetch(`${BASE}/api/employees/pending-count`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 3);
});

// GET /api/employees/:id

test('GET /api/employees/:id returns 404 when not found', async () => {
  reset();
  _modelEmployee = null;
  const res = await fetch(`${BASE}/api/employees/99`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});

test('GET /api/employees/:id returns employee', async () => {
  reset();
  _modelEmployee = { id: 5, nombre_completo: 'Carlos', cargo: 'Tech', area: 'IT' };
  const res = await fetch(`${BASE}/api/employees/5`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 5);
  assert.equal(body.nombre_completo, 'Carlos');
});

// POST /api/employees — validation

test('POST /api/employees returns 400 for missing cedula', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Ana Gomez', cargo: 'Aux', area: 'TI' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Cédula'));
});

test('POST /api/employees returns 400 for invalid cedula (too short)', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: '123', nombre_completo: 'Ana Gomez', cargo: 'Aux', area: 'TI' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/employees returns 400 for short name', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: '12345678', nombre_completo: 'AB', cargo: 'Aux', area: 'TI' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Nombre'));
});

test('POST /api/employees returns 400 when cargo/area missing', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: '12345678', nombre_completo: 'Ana Gomez' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Cargo'));
});

test('POST /api/employees creates employee successfully', async () => {
  reset();
  _modelCreateId = 42;
  const res = await fetch(`${BASE}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: '12345678', nombre_completo: 'Ana Gomez', cargo: 'Aux', area: 'TI' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.id, 42);
});

test('POST /api/employees returns 409 on duplicate cedula', async () => {
  reset();
  _modelCreateErr = Object.assign(new Error('Cédula ya registrada'), { code: 'CEDULA_EXISTS' });
  const res = await fetch(`${BASE}/api/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cedula: '12345678', nombre_completo: 'Ana Gomez', cargo: 'Aux', area: 'TI' }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.ok(body.error.includes('Cédula'));
});

// PUT /api/employees/:id

test('PUT /api/employees/:id returns 404 when not found', async () => {
  reset();
  _modelEmployee = null;
  const res = await fetch(`${BASE}/api/employees/99`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'New Name' }),
  });
  assert.equal(res.status, 404);
});

test('PUT /api/employees/:id updates basic fields', async () => {
  reset();
  _modelEmployee = { id: 5, nombre_completo: 'Carlos', cargo: 'Tech', area: 'IT' };
  const res = await fetch(`${BASE}/api/employees/5`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre_completo: 'Carlos Updated', cargo: 'Senior', area: 'IT' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('PUT /api/employees/:id completes credentials when fecha_respuesta_soporte provided', async () => {
  reset();
  _modelEmployee = { id: 5, nombre_completo: 'Carlos', cargo: 'Tech', area: 'IT', usuario: 'CTECH', contraseña: '5678' };
  const res = await fetch(`${BASE}/api/employees/5`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre_completo: 'Carlos',
      cargo: 'Tech',
      area: 'IT',
      fecha_respuesta_soporte: '2026-07-21',
    }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.usuario);
});

// DELETE /api/employees/:id

test('DELETE /api/employees/:id returns 404 when not found', async () => {
  reset();
  _modelDeleteErr = Object.assign(new Error('No encontrado'), { code: 'NOT_FOUND' });
  const res = await fetch(`${BASE}/api/employees/99`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('DELETE /api/employees/:id deletes successfully', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees/5`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

// GET /api/employees-data/cargos

test('GET /api/employees-data/cargos returns cargo list', async () => {
  reset();
  _modelCargos = [{ id: 1, nombre: 'Auxiliar' }, { id: 2, nombre: 'Jefe' }];
  const res = await fetch(`${BASE}/api/employees-data/cargos`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 2);
  assert.equal(body[0].nombre, 'Auxiliar');
});

// POST /api/employees-data/cargos

test('POST /api/employees-data/cargos returns 400 when nombre missing', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees-data/cargos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Nombre'));
});

test('POST /api/employees-data/cargos creates cargo', async () => {
  reset();
  const res = await fetch(`${BASE}/api/employees-data/cargos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Nuevo Cargo' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.nombre, 'Nuevo Cargo');
  assert.equal(body.id, 99);
});

// GET /api/employees-data/areas

test('GET /api/employees-data/areas returns areas list', async () => {
  reset();
  _modelAreas = [{ id: 1, nombre: 'Oficina Norte', ciudad: 'Cali', tipo: 'sede' }];
  const res = await fetch(`${BASE}/api/employees-data/areas`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].nombre, 'Oficina Norte');
});

// ── Flujo Mantis ─────────────────────────────────────────────────────────────

test('GET /api/employees/sugerir-usuario returns suggestion', async () => {
  reset();
  const body = await (await fetch(`${BASE}/api/employees/sugerir-usuario?nombre=${encodeURIComponent('Gladys Garcia Osorio')}`)).json();
  assert.equal(body.usuario, 'SUG-Gladys Garcia Osorio');
});

test('GET /api/employees/sugerir-usuario empty name → empty usuario', async () => {
  reset();
  const body = await (await fetch(`${BASE}/api/employees/sugerir-usuario`)).json();
  assert.equal(body.usuario, '');
});

test('GET /api/employees/sugerir-clave returns 4 digits', async () => {
  reset();
  const body = await (await fetch(`${BASE}/api/employees/sugerir-clave`)).json();
  assert.equal(body.clave, '0042');
});

test('GET /api/employees/mantis-status reports configuration', async () => {
  reset();
  _mantisConfigured = true;
  const body = await (await fetch(`${BASE}/api/employees/mantis-status`)).json();
  assert.equal(body.configured, true);
});

test('POST /api/employees (Mantis) requires sede', async () => {
  reset();
  const res = await post('/api/employees', { cedula: '12345678', nombre_completo: 'Gladys Garcia Osorio', perfil_codigo: 10 });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /sede/i);
});

test('POST /api/employees (Mantis) creates without cargo/area and returns credentials', async () => {
  reset();
  const res = await post('/api/employees', {
    cedula: '12345678', nombre_completo: 'Gladys Garcia Osorio', perfil_codigo: 10, bodega_codigo: 581, comprobante: 'PAS',
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.usuario, 'GGOSORIO');
  assert.equal(body.contraseña, '4821');
  assert.ok(body.empleado);
  assert.equal(_lastCreateData.perfil_codigo, 10);
  assert.equal(_lastCreateData.bodega_codigo, 581);
  assert.equal(_lastCreateData.comprobante, 'PAS');
});

test('POST /api/employees maps model validation errors to 400/409', async () => {
  reset();
  _modelCreateErr = Object.assign(new Error('El usuario GGOSORIO ya existe.'), { code: 'USERNAME_TAKEN' });
  let res = await post('/api/employees', { cedula: '12345678', nombre_completo: 'Gladys Garcia Osorio', perfil_codigo: 10, bodega_codigo: 581 });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /ya existe/);

  _modelCreateErr = Object.assign(new Error('Selecciona un cargo de la lista.'), { code: 'BAD_PERFIL' });
  res = await post('/api/employees', { cedula: '12345678', nombre_completo: 'Gladys Garcia Osorio', perfil_codigo: 99, bodega_codigo: 581 });
  assert.equal(res.status, 400);
});

test('POST /api/employees unexpected model error → 500', async () => {
  reset();
  _modelCreateErr = new Error('db down');
  const res = await post('/api/employees', { cedula: '12345678', nombre_completo: 'Ana Gomez', cargo: 'Aux', area: 'TI' });
  assert.equal(res.status, 500);
});

test('PUT /api/employees/:id maps validation error', async () => {
  reset();
  _modelEmployee = { id: 5, nombre_completo: 'Carlos', mantis_estado: 'pendiente' };
  _modelUpdateErr = Object.assign(new Error('La clave debe tener exactamente 4 dígitos.'), { code: 'BAD_PASSWORD' });
  const res = await fetch(`${BASE}/api/employees/5`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contraseña: '12' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/employees/:id/mantis → 404 / 400 / 501 / 502 / 200', async () => {
  reset();
  assert.equal((await post('/api/employees/9/mantis')).status, 404);

  _modelEmployee = { id: 9, usuario: 'X' };
  assert.equal((await post('/api/employees/9/mantis')).status, 400);

  _modelEmployee = { id: 9, usuario: 'GGOSORIO', mantis_estado: 'pendiente' };
  _mantisCreateErr = Object.assign(new Error('no configurado'), { code: 'MANTIS_NOT_CONFIGURED' });
  assert.equal((await post('/api/employees/9/mantis')).status, 501);
  assert.equal(_mantisResults.length, 0);

  _mantisCreateErr = Object.assign(new Error('perfil inválido'), { code: 'X' });
  const r502 = await post('/api/employees/9/mantis');
  assert.equal(r502.status, 502);
  assert.deepEqual(_mantisResults.at(-1), { id: 9, ok: false, error: 'perfil inválido' });

  _mantisCreateErr = null;
  const ok = await post('/api/employees/9/mantis');
  assert.equal(ok.status, 200);
  assert.deepEqual(_mantisResults.at(-1), { id: 9, ok: true });
});
