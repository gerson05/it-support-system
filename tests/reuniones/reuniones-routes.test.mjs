/**
 * Integration tests for src/reuniones/reuniones-routes.js
 * Uses node:test + mock.module + in-process HTTP server.
 */
import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

// ── 1. Mutable mock state ────────────────────────────────────────────────────

let _get = () => null;
let _all = () => [];
let _run = () => ({ changes: 1, lastInsertRowid: 10 });

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

// ── 3. Mock auth middleware ──────────────────────────────────────────────────

await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth:       (_req, _res, next) => { _req.user = { id: 1 }; next(); },
    requirePermission: ()  => (_req, _res, next) => next(),
  },
});

// ── 4. Mock calendar-service (no Google API calls) ───────────────────────────

let _calendarResult = { meetLink: 'https://meet.google.com/test-link', eventId: 'evt-123' };

await mock.module('../../src/reuniones/calendar-service.js', {
  exports: {
    crearEventoConMeet: async () => _calendarResult,
    cancelarEvento:     async () => true,
  },
});

// ── 5. Mock async-handler ────────────────────────────────────────────────────

await mock.module('../../src/utils/async-handler.js', {
  exports: {
    wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  },
});

// ── 6. Import router AFTER all mocks ─────────────────────────────────────────

const router = (await import('../../src/reuniones/reuniones-routes.js')).default;

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
  _run = () => ({ changes: 1, lastInsertRowid: 10 });
  _calendarResult = { meetLink: 'https://meet.google.com/test-link', eventId: 'evt-123' };
}

// ── Date helpers: times always in the future ──────────────────────────────────

function futureISO(offsetMinutes = 60) {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}

function validReunionBody(overrides = {}) {
  return {
    sala_id:            1,
    titulo:             'Reunión de prueba',
    tipo:               'interna',
    fecha_inicio:       futureISO(60),
    fecha_fin:          futureISO(90),
    organizador_nombre: 'Ana Gomez',
    organizador_correo: 'ana@test.com',
    participantes:      [],
    descripcion:        'Desc de prueba',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

// ── Salas ────────────────────────────────────────────────────────────────────

test('GET /api/reuniones/salas returns sala list', async () => {
  reset();
  _all = () => [{ id: 1, nombre: 'Sala A', descripcion: '', activo: 1 }];
  const res = await fetch(`${BASE}/api/reuniones/salas`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.salas));
  assert.equal(body.salas[0].nombre, 'Sala A');
});

test('POST /api/reuniones/salas returns 400 for missing nombre', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones/salas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Nombre'));
});

test('POST /api/reuniones/salas creates sala', async () => {
  reset();
  _run = () => ({ changes: 1, lastInsertRowid: 7 });
  const res = await fetch(`${BASE}/api/reuniones/salas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Sala B', descripcion: 'Segunda sala' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.id, 7);
});

test('PUT /api/reuniones/salas/:id returns 400 when nothing to update', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones/salas/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Nada'));
});

test('PUT /api/reuniones/salas/:id updates sala', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones/salas/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Sala A Renamed' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('DELETE /api/reuniones/salas/:id soft-deletes sala', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones/salas/1`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

// ── Reuniones (auth endpoints) ────────────────────────────────────────────────

test('GET /api/reuniones returns reuniones list', async () => {
  reset();
  _all = () => [
    { id: 1, titulo: 'Reunión 1', tipo: 'interna', estado: 'activa' },
  ];
  const res = await fetch(`${BASE}/api/reuniones`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.reuniones));
  assert.equal(body.reuniones.length, 1);
});

test('GET /api/reuniones filters by sala_id', async () => {
  reset();
  _all = () => [];
  const res = await fetch(`${BASE}/api/reuniones?sala_id=2`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.reuniones));
});

test('POST /api/reuniones returns 400 for missing required fields', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'Only title' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Campos requeridos'));
});

test('POST /api/reuniones returns 400 for invalid tipo', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReunionBody({ tipo: 'invalido' })),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Tipo'));
});

test('POST /api/reuniones returns 400 for past fecha_inicio', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReunionBody({
      fecha_inicio: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      fecha_fin:    new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    })),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('pasado'));
});

test('POST /api/reuniones returns 400 for duration under 15 min', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReunionBody({
      fecha_inicio: futureISO(60),
      fecha_fin:    futureISO(70), // only 10 minutes
    })),
  });
  // conflicto check: _get returns null (no conflict), but duration 10min < 15min
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('15 minutos'));
});

test('POST /api/reuniones returns 409 on scheduling conflict', async () => {
  reset();
  // conflicto() calls db.prepare().get() — return an existing meeting
  _get = () => ({ id: 5 });
  const res = await fetch(`${BASE}/api/reuniones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReunionBody()),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.ok(body.error.includes('horario'));
});

test('POST /api/reuniones creates reunión successfully', async () => {
  reset();
  // no conflict → null, then INSERT → id 10, then SELECT → full object
  let callCount = 0;
  _get = () => {
    callCount++;
    if (callCount === 1) return null; // no conflict
    return { id: 10, titulo: 'Reunión de prueba', meet_link: 'https://meet.google.com/test-link' };
  };
  _run = () => ({ changes: 1, lastInsertRowid: 10 });
  const res = await fetch(`${BASE}/api/reuniones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReunionBody()),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.reunion);
  assert.equal(typeof body.meet_link_generado, 'boolean');
});

test('PUT /api/reuniones/:id returns 404 when not found', async () => {
  reset();
  _get = () => null;
  const res = await fetch(`${BASE}/api/reuniones/99`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'New Title' }),
  });
  assert.equal(res.status, 404);
});

test('PUT /api/reuniones/:id returns 400 when editing cancelled meeting', async () => {
  reset();
  _get = () => ({ id: 1, estado: 'cancelada', sala_id: 1, fecha_inicio: futureISO(60), fecha_fin: futureISO(90) });
  const res = await fetch(`${BASE}/api/reuniones/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'New Title' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('cancelada'));
});

test('PUT /api/reuniones/:id returns 400 when nothing to update', async () => {
  reset();
  _get = () => ({ id: 1, estado: 'activa', sala_id: 1, fecha_inicio: futureISO(60), fecha_fin: futureISO(90) });
  const res = await fetch(`${BASE}/api/reuniones/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Nada'));
});

test('PUT /api/reuniones/:id updates title', async () => {
  reset();
  _get = () => ({ id: 1, estado: 'activa', sala_id: 1, fecha_inicio: futureISO(60), fecha_fin: futureISO(90) });
  const res = await fetch(`${BASE}/api/reuniones/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'Título Actualizado' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('DELETE /api/reuniones/:id returns 404 when not found', async () => {
  reset();
  _get = () => null;
  const res = await fetch(`${BASE}/api/reuniones/99`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('DELETE /api/reuniones/:id cancels meeting', async () => {
  reset();
  _get = () => ({ id: 1, google_event_id: 'evt-abc' });
  const res = await fetch(`${BASE}/api/reuniones/1`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

// ── Public endpoints ──────────────────────────────────────────────────────────

test('GET /api/reuniones/public/salas returns public sala list', async () => {
  reset();
  _all = () => [{ id: 1, nombre: 'Sala A', descripcion: 'desc' }];
  const res = await fetch(`${BASE}/api/reuniones/public/salas`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.salas));
  assert.equal(body.salas[0].nombre, 'Sala A');
});

test('GET /api/reuniones/public/disponibilidad returns 400 for missing params', async () => {
  reset();
  const res = await fetch(`${BASE}/api/reuniones/public/disponibilidad`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('sala_id'));
});

test('GET /api/reuniones/public/disponibilidad returns occupied slots', async () => {
  reset();
  _all = () => [
    { id: 2, titulo: 'Reunión existente', fecha_inicio: futureISO(30), fecha_fin: futureISO(60) },
  ];
  const res = await fetch(`${BASE}/api/reuniones/public/disponibilidad?sala_id=1&fecha=2026-07-22`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.ocupados));
  assert.equal(body.ocupados.length, 1);
});

test('POST /api/reuniones/public creates public meeting', async () => {
  reset();
  let callCount = 0;
  _get = () => {
    callCount++;
    if (callCount === 1) return null; // no conflict
    return { id: 20, titulo: 'Reunión de prueba', token_externo: 'tok-abc', meet_link: 'https://meet.google.com/x' };
  };
  _run = () => ({ changes: 1, lastInsertRowid: 20 });
  const res = await fetch(`${BASE}/api/reuniones/public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validReunionBody()),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.token_externo);
  assert.ok(body.reunion);
});

test('GET /api/reuniones/public/:token returns 404 when token not found', async () => {
  reset();
  _get = () => null;
  const res = await fetch(`${BASE}/api/reuniones/public/nonexistent-token`);
  assert.equal(res.status, 404);
});

test('GET /api/reuniones/public/:token returns meeting by token', async () => {
  reset();
  _get = () => ({ id: 5, titulo: 'Mi Reunión', token_externo: 'abc-123', sala_nombre: 'Sala A' });
  const res = await fetch(`${BASE}/api/reuniones/public/abc-123`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.reunion);
  assert.equal(body.reunion.titulo, 'Mi Reunión');
});

test('DELETE /api/reuniones/public/:token returns 404 when token not found', async () => {
  reset();
  _get = () => null;
  const res = await fetch(`${BASE}/api/reuniones/public/bad-token`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('DELETE /api/reuniones/public/:token returns 400 when already cancelled', async () => {
  reset();
  _get = () => ({ id: 3, google_event_id: null, estado: 'cancelada' });
  const res = await fetch(`${BASE}/api/reuniones/public/some-token`, { method: 'DELETE' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('cancelada'));
});

test('DELETE /api/reuniones/public/:token cancels meeting by token', async () => {
  reset();
  _get = () => ({ id: 3, google_event_id: 'evt-xyz', estado: 'activa' });
  const res = await fetch(`${BASE}/api/reuniones/public/some-token`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
