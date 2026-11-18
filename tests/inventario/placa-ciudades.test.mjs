import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createMemoryDb } from '../helpers/sqlite-memory-db.mjs';
import { migrations as m038 } from '../../src/config/migrations/038-placa-ciudades.js';

let db;
let permisos = ['inventario:create'];
await mock.module('../../src/config/database.js', {
  exports: { default: { prepare: (sql) => db.prepare(sql), exec: (sql) => db.exec(sql) } },
});
await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth: (req, _res, next) => { req.user = { id: 1, username: 'soporte' }; req.permissions = permisos; next(); },
    requirePermission: () => (_req, _res, next) => next(),
  },
});
const audits = [];
await mock.module('../../src/audit/audit-logger.js', { exports: { logAudit: async (...a) => { audits.push(a); } } });
await mock.module('../../src/utils/async-handler.js', {
  exports: { wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next) },
});

const router = (await import('../../src/inventario/placa-ciudades-routes.js')).default;
const { codigoPlaca, sugerirCodigo } = await import('../../src/inventario/sede-codes.js');
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

const crear = async (body) => {
  const r = await fetch(`${BASE}/api/inventario/placa-ciudades`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};
const sugerir = async (nombre) => (await (await fetch(`${BASE}/api/inventario/placa-ciudades/sugerir?nombre=${encodeURIComponent(nombre)}`)).json()).codigo;

beforeEach(() => {
  db = createMemoryDb([...m038, 'CREATE TABLE inventario_equipos (id INTEGER PRIMARY KEY, placa TEXT)']);
  audits.length = 0;
  permisos = ['inventario:create'];
});

test('sugerirCodigo: first letter + consonants, skipping taken codes', () => {
  assert.equal(sugerirCodigo('Manizales'), 'MNZ');
  assert.equal(sugerirCodigo('Sandoná'), 'SND');
  assert.equal(sugerirCodigo('Real'), 'REA');
  assert.equal(sugerirCodigo('Manizales', new Set(['MNZ'])), 'MAN');
  assert.equal(sugerirCodigo('A'), 'AX1');
  assert.equal(sugerirCodigo('   '), null);
});

test('creates a city in its group with an automatic code and audits it', async () => {
  const r = await crear({ nombre: 'Real', grupo: 'Cali (sub-sedes)' });
  assert.equal(r.status, 201);
  assert.deepEqual({ ...r.body, id: undefined }, { id: undefined, grupo: 'Cali (sub-sedes)', nombre: 'Real', valor: 'REAL', codigo: 'REA' });
  assert.equal(audits[0][1], 'Ciudad de placa creada');
  const lista = await (await fetch(`${BASE}/api/inventario/placa-ciudades`)).json();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].codigo, 'REA');
});

test('next placa uses the created code (before the fixed map)', async () => {
  await crear({ nombre: 'Cali Real', grupo: 'Cali (sub-sedes)', codigo: 'crl' });
  assert.equal(await codigoPlaca(db, 'CALI REAL'), 'CRL');
  assert.equal(await codigoPlaca(db, 'Manizales'), 'MNZ');
});

test('suggested code skips fixed codes, created codes and placa prefixes already in use', async () => {
  assert.equal(await sugerir('Mnzarbe'), 'MNA');  // MNZ ya es de Manizales
  await db.prepare("INSERT INTO inventario_equipos (placa) VALUES ('AF-SND004')").run();
  assert.notEqual(await sugerir('Sandoná'), 'SND');
  await crear({ nombre: 'Rosal', grupo: 'Otro' });
  assert.notEqual(await sugerir('Rosales'), 'RSL');
});

test('rejects duplicates: base list name, created name, taken or invalid code', async () => {
  assert.equal((await crear({ nombre: 'Manizales', grupo: 'Caldas' })).status, 409);
  assert.equal((await crear({ nombre: 'Real', grupo: 'Cali' })).status, 201);
  assert.equal((await crear({ nombre: 'réal', grupo: 'Cali' })).status, 409);
  assert.match((await crear({ nombre: 'Nuevo', grupo: 'X', codigo: 'MNZ' })).body.error, /MNZ ya está en uso/);
  assert.equal((await crear({ nombre: 'Nuevo', grupo: 'X', codigo: 'A1' })).status, 400);
});

test('requires nombre and grupo', async () => {
  assert.equal((await crear({ nombre: 'X' })).status, 400);
  assert.equal((await crear({ grupo: 'Cali' })).status, 400);
});

test('permissions: inventario:create/edit or full; others get 403', async () => {
  for (const p of [['inventario:edit'], ['full']]) {
    permisos = p;
    assert.equal((await crear({ nombre: 'Punto ' + p[0], grupo: 'Cali' })).status, 201);
  }
  permisos = ['inventario:read'];
  assert.equal((await crear({ nombre: 'Otro', grupo: 'Cali' })).status, 403);
});
