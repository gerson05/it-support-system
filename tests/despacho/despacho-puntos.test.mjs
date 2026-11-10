import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createMemoryDb } from '../helpers/sqlite-memory-db.mjs';
import { migrations as m020 } from '../../src/config/migrations/020-puntos-unificados.js';

let db;
await mock.module('../../src/config/database.js', {
  exports: { default: { prepare: (sql) => db.prepare(sql), exec: (sql) => db.exec(sql) } },
});
await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth: (req, _res, next) => { req.user = { id: 1, username: 'soporte' }; next(); },
    requirePermission: () => (_req, _res, next) => next(),
  },
});
const audits = [];
await mock.module('../../src/audit/audit-logger.js', { exports: { logAudit: async (...a) => { audits.push(a); } } });
await mock.module('../../src/utils/async-handler.js', {
  exports: { wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next) },
});

const router = (await import('../../src/despacho/despacho-puntos-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

const crear = async (body) => {
  const r = await fetch(`${BASE}/api/despachos/puntos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};

beforeEach(() => {
  db = createMemoryDb(m020.filter(s => /CREATE TABLE IF NOT EXISTS puntos/i.test(s)));
  audits.length = 0;
});

test('creates a new sede in puntos (city uppercased, spaces cleaned) and audits it', async () => {
  const r = await crear({ nombre: '  Sede   Norte ', ciudad: 'cali', tipo: 'punto' });
  assert.equal(r.status, 201);
  assert.equal(r.body.existia, false);
  const row = await db.prepare('SELECT nombre, ciudad, tipo, activo FROM puntos WHERE id = ?').get(r.body.id);
  assert.deepEqual(row, { nombre: 'Sede Norte', ciudad: 'CALI', tipo: 'punto', activo: 1 });
  assert.equal(audits.length, 1);
  assert.equal(audits[0][1], 'Sede creada desde Despachos');
});

test('bodega type; anything else becomes punto', async () => {
  assert.equal((await crear({ nombre: 'B1', ciudad: 'Palmira', tipo: 'bodega' })).body.tipo, 'bodega');
  assert.equal((await crear({ nombre: 'P1', ciudad: 'Palmira', tipo: 'x' })).body.tipo, 'punto');
});

test('reuses an existing sede with the same name and city, reactivating it', async () => {
  const a = await crear({ nombre: 'Sede Sur', ciudad: 'Cali' });
  await db.prepare('UPDATE puntos SET activo = 0 WHERE id = ?').run(a.body.id);
  const b = await crear({ nombre: 'sede sur', ciudad: 'CALI' });
  assert.equal(b.status, 200);
  assert.equal(b.body.existia, true);
  assert.equal(b.body.id, a.body.id);
  assert.equal((await db.prepare('SELECT activo FROM puntos WHERE id = ?').get(a.body.id)).activo, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM puntos').get()).n, 1);
  // mismo nombre en otra ciudad sí es otra sede
  assert.equal((await crear({ nombre: 'Sede Sur', ciudad: 'Bogotá' })).status, 201);
});

test('accent/case-insensitive: reuses the stored city spelling and existing sede', async () => {
  await db.prepare("INSERT INTO puntos (nombre, ciudad) VALUES ('Mi Farmacia', 'JAMUNDI')").run();
  const nueva = await crear({ nombre: 'Sede Nueva', ciudad: 'Jamundí' });
  assert.equal(nueva.status, 201);
  assert.equal(nueva.body.ciudad, 'JAMUNDI');
  const misma = await crear({ nombre: 'mi fármacia', ciudad: 'jamundí' });
  assert.equal(misma.body.existia, true);
  assert.equal((await db.prepare('SELECT COUNT(DISTINCT ciudad) AS n FROM puntos').get()).n, 1);
});

test('requires nombre and ciudad', async () => {
  assert.equal((await crear({ nombre: 'X' })).status, 400);
  assert.equal((await crear({ ciudad: 'Cali' })).status, 400);
  assert.match((await crear({})).body.error, /obligatorios/);
});
