import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import * as XLSX from 'xlsx';
import { createMemoryDb } from '../helpers/sqlite-memory-db.mjs';
import { migrations as m015 } from '../../src/config/migrations/015-employees-fix.js';
import { migrations as m036 } from '../../src/config/migrations/036-mantis-catalogos.js';

let db;
await mock.module('../../src/config/database.js', {
  exports: { default: { prepare: (sql) => db.prepare(sql), exec: (sql) => db.exec(sql) } },
});
await mock.module('../../src/auth/auth-middleware.js', {
  exports: {
    requireAuth: (req, _res, next) => { req.user = { id: 1, username: 'gh' }; next(); },
    requirePermission: () => (_req, _res, next) => next(),
  },
});
const audits = [];
await mock.module('../../src/audit/audit-logger.js', { exports: { logAudit: async (...a) => { audits.push(a); } } });
await mock.module('../../src/utils/async-handler.js', {
  exports: { wrap: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next) },
});

const router = (await import('../../src/mantis/mantis-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

beforeEach(() => {
  db = createMemoryDb(['CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)', ...m015, ...m036]);
  audits.length = 0;
});

function xls(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet0');
  return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
}

async function upload(tipo, rows, name = `${tipo}.xls`) {
  const fd = new FormData();
  fd.append('file', new Blob([xls(rows)]), name);
  const res = await fetch(`${BASE}/api/mantis/catalogos/${tipo}`, { method: 'POST', body: fd });
  return { status: res.status, body: await res.json() };
}

const getJson = async (path) => (await fetch(`${BASE}${path}`)).json();

const PERFILES = [['Código del Perfil', 'Nombre del Perfil'], [10, 'AUXILIAR DE DISPENSACION'], [15, 'ADMIN BODEGA']];
const BODEGAS = [
  ['Bodegas'], [],
  ['Codigo Bodega', 'Nombre Bodega', 'Ciudad', 'Centro de costo', 'Estado', 'Bodega Punto Dispensación'],
  [581, '581 MI FARMACIA PASOANCHO (FOMAG)', 'CALI', 'PASOANCHO', 'A', 'S'],
  [648, '648 BODEGA SAN FERNANDO', 'CALI', 'BODEGA YUMBO', 'A', 'S'],
];
const COMPROBANTES = [
  ['Tipo de Comprobante', 'Comprobante', 'Fuente', 'Estado'],
  ['PAS', '581 MI FARMACIA PASOANCHO (FOMAG)', 'DISPENSACION', 'Activo'],
  ['SFE', 'SAN FERNANDO', 'COMPRAS', 'Activo'],
];

test('upload: rejects invalid type, missing file, wrong or empty Excel', async () => {
  assert.equal((await upload('otro', PERFILES)).status, 400);
  const noFile = await fetch(`${BASE}/api/mantis/catalogos/perfiles`, { method: 'POST' });
  assert.equal(noFile.status, 400);

  const wrong = await upload('bodegas', PERFILES);
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /bodegas/);

  const empty = await upload('perfiles', [PERFILES[0]]);
  assert.equal(empty.status, 400);
  assert.match(empty.body.error, /no tiene filas/);

  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from('not an excel at all \u0000\u0001')]), 'x.xls');
  const garbage = await fetch(`${BASE}/api/mantis/catalogos/perfiles`, { method: 'POST', body: fd });
  assert.equal(garbage.status, 400);
});

test('upload all three catalogs, then search like the form does', async () => {
  const p = await upload('perfiles', PERFILES);
  assert.equal(p.status, 200);
  assert.equal(p.body.filas, 2);
  await upload('comprobantes', COMPROBANTES);
  const b = await upload('bodegas', BODEGAS, 'Bodegas2026.xls');
  assert.equal(b.body.enlazadas, 1);
  assert.equal(b.body.estado.sin_comprobante, 1);
  assert.equal(audits.at(-1)[1], 'Catálogo Mantis cargado: bodegas');

  assert.deepEqual(await getJson('/api/mantis/perfiles?q=auxi'), [{ codigo: 10, nombre: 'AUXILIAR DE DISPENSACION' }]);
  const sedes = await getJson('/api/mantis/bodegas?q=pasoancho');
  assert.equal(sedes[0].codigo, 581);
  assert.equal(sedes[0].comprobante, 'PAS');

  const st = await getJson('/api/mantis/catalogos');
  assert.equal(st.perfiles.total, 2);
  assert.equal(st.bodegas.ultima.archivo, 'Bodegas2026.xls');
});

test('assign comprobante manually to a bodega without one', async () => {
  await upload('comprobantes', COMPROBANTES);
  await upload('bodegas', BODEGAS);
  assert.deepEqual((await getJson('/api/mantis/bodegas/sin-comprobante')).map(b => b.codigo), [648]);

  const put = (codigo, comprobante) => fetch(`${BASE}/api/mantis/bodegas/${codigo}/comprobante`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprobante }),
  });
  assert.equal((await put(999, 'SFE')).status, 404);
  assert.equal((await put(648, 'NOPE')).status, 400);

  const ok = await put(648, 'sfe');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, codigo: 648, comprobante: 'SFE' });
  assert.equal(audits.at(-1)[1], 'Comprobante asignado a bodega');
  assert.deepEqual(await getJson('/api/mantis/bodegas/sin-comprobante'), []);
});

test('unexpected errors are passed to the error handler', async () => {
  db = { prepare: () => { throw new Error('db down'); } };
  const res = await fetch(`${BASE}/api/mantis/bodegas/1/comprobante`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprobante: 'X' }),
  });
  assert.equal(res.status, 500);
});
