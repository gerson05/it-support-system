import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createMemoryDb } from '../helpers/sqlite-memory-db.mjs';
import { textoDocx } from '../helpers/docx-fixture.mjs';

const migs = await Promise.all(['004-inventario', '012-qr-activos', '014-celulares-placa', '023-celulares-serial',
  '026-inventario-categoria', '027-celulares-numero-telefono', '028-inventario-sede', '033-inventario-cedula',
  '034-inventario-modelo'].map(m => import(`../../src/config/migrations/${m}.js`)));
const createInvDb = () => createMemoryDb(migs.flatMap(m => m.migrations)
  .filter(s => /^\s*(CREATE TABLE|ALTER TABLE)\s+(IF NOT EXISTS\s+)?inventario_/i.test(s)));

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

const { buscarPersonas, listarPersonas, asignadosA, elementosPorId, _test } = await import('../../src/inventario/paz-salvo-model.js');
const { textoCertificacion } = await import('../../src/inventario/paz-salvo-acta.js');
const router = (await import('../../src/inventario/paz-salvo-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

async function seed() {
  const eq = (placa, serial, extra) => db.prepare(`INSERT INTO inventario_equipos
    (placa, marca, nombre_equipo, serial, modelo, categoria, area, ciudad, nombre_completo, responsable, cedula, serial_cargador)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(placa, extra.marca || 'Lenovo', extra.nombre || 'Portátil', serial,
    extra.modelo || 'T14', extra.categoria || 'computadores', 'Sistemas', 'Cali',
    extra.nombre_completo ?? null, extra.responsable ?? null, extra.cedula ?? null, extra.cargador ?? null);
  await eq('AF-1', 'S1', { nombre_completo: 'Ana Gómez', cedula: '1.144.555', cargador: 'C9' });
  await eq('AF-2', 'S2', { categoria: 'monitores', nombre: 'Monitor 24', nombre_completo: 'Ana Gómez', cedula: '1144555' });
  await eq('AF-3', 'S3', { responsable: 'ana gómez' });                 // dato antiguo: solo responsable, sin cédula
  await eq('AF-4', 'S4', { nombre_completo: 'Luis Pérez', cedula: '999' });
  await db.prepare(`INSERT INTO inventario_celulares (placa, nombre_completo, cedula, equipo, modelo, imei, numero_telefono, area)
    VALUES ('CEL-1', 'Ana Gómez', '1144555', 'Samsung', 'A52', '356000000000001', '3001234567', 'Sistemas')`).run();
  await db.prepare(`INSERT INTO inventario_ups (placa, marca, nombre_equipo, serial, nombre_completo, cedula)
    VALUES ('UPS-1', 'APC', 'UPS 1KVA', 'U1', 'Ana Gómez', '1144555')`).run();
}

beforeEach(async () => { db = createInvDb(); audits.length = 0; await seed(); });

test('buscarPersonas: groups by cédula across tables; requires 3 chars', async () => {
  assert.deepEqual(await buscarPersonas(db, 'an'), []);
  const r = await buscarPersonas(db, 'ana');
  const ana = r.find(p => p.cedula === '1144555');
  assert.equal(ana.nombre, 'Ana Gómez');
  assert.equal(ana.elementos, 5);                       // 3 equipos (uno antiguo sin cédula) + celular + UPS
  assert.ok(!r.find(p => !p.cedula));                   // el registro sin cédula se unió por nombre
  assert.equal((await buscarPersonas(db, '999'))[0].nombre, 'Luis Pérez');
});

test('asignadosA: by cédula includes old same-name records without cédula; by name only', async () => {
  const porCedula = await asignadosA(db, { cedula: '1144555', nombre: 'Ana Gómez' });
  assert.deepEqual(porCedula.map(e => e.placa).sort(), ['AF-1', 'AF-2', 'AF-3', 'CEL-1', 'UPS-1']);
  const cel = porCedula.find(e => e.tipo === 'Celular');
  assert.equal(cel.serial, '356000000000001');
  assert.equal(cel.detalle, 'Tel. 3001234567');
  assert.equal(porCedula.find(e => e.placa === 'AF-2').tipo, 'Monitor');
  assert.equal(porCedula.find(e => e.placa === 'AF-1').detalle, 'Cargador C9');
  assert.equal(porCedula.find(e => e.tipo === 'UPS').marca, 'APC');
  assert.deepEqual((await asignadosA(db, { nombre: 'luis  pérez' })).map(e => e.placa), ['AF-4']);
  assert.deepEqual(await asignadosA(db, {}), []);
});

test('elementosPorId: reads from DB, ignores unknown tables and missing ids', async () => {
  const r = await elementosPorId(db, [
    { tabla: 'inventario_equipos', id: 1, devuelto: false, observacion: ' sin cargador ' },
    { tabla: 'inventario_ups', id: 1 },
    { tabla: 'users', id: 1 }, { tabla: 'inventario_equipos', id: 99 }, null,
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].devuelto, false);
  assert.equal(r[0].observacion, 'sin cargador');
  assert.equal(r[1].devuelto, true);
  assert.equal(_test.normCedula(' 1.144-555 '), '1144555');
});

test('textoCertificacion: paz y salvo only when everything is returned', () => {
  const p = { nombre: 'Ana', cedula: '1' };
  assert.equal(textoCertificacion(p, []).pazYSalvo, true);
  assert.match(textoCertificacion(p, []).texto, /no tiene equipos/);
  assert.equal(textoCertificacion(p, [{ devuelto: true }]).pazYSalvo, true);
  const pend = textoCertificacion({ nombre: 'Ana' }, [{ devuelto: true }, { devuelto: false }]);
  assert.equal(pend.pazYSalvo, false);
  assert.match(pend.texto, /1 elemento/);
});

test('routes: personas, asignados and acta .docx (no inventory changes)', async () => {
  const per = await (await fetch(`${BASE}/api/inventario/paz-salvo/personas?q=g%C3%B3mez`)).json();
  assert.ok(per.personas.length >= 1);
  assert.equal((await fetch(`${BASE}/api/inventario/paz-salvo/asignados`)).status, 400);
  const asig = await (await fetch(`${BASE}/api/inventario/paz-salvo/asignados?cedula=1144555&nombre=Ana%20G%C3%B3mez`)).json();
  assert.equal(asig.elementos.length, 5);

  const antes = await db.prepare('SELECT * FROM inventario_equipos ORDER BY id').all();
  const sinNombre = await fetch(`${BASE}/api/inventario/paz-salvo/acta`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  assert.equal(sinNombre.status, 400);

  const r = await fetch(`${BASE}/api/inventario/paz-salvo/acta`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: 'Ana Gómez', cedula: '1144555', cargo: 'Auxiliar $1 & <IT>', fecha_retiro: '2026-10-21',
      observaciones: 'Entrega en sede Cali',
      elementos: asig.elementos.map(e => ({ tabla: e.tabla, id: e.id, devuelto: e.placa !== 'CEL-1', observacion: e.placa === 'AF-1' ? 'Sin maletín' : '' })),
    }),
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /wordprocessingml/);
  assert.match(r.headers.get('content-disposition'), /Paz%20y%20salvo%20-%20Ana%20G%C3%B3mez\.docx/);
  const texto = textoDocx(Buffer.from(await r.arrayBuffer())).join('\n');
  for (const s of ['ACTA DE DEVOLUCIÓN Y PAZ Y SALVO', 'Ana Gómez', '1144555', 'Auxiliar $1 &amp; &lt;IT&gt;', '21/10/2026',
    'AF-1', 'CEL-1', 'Pendiente', 'Devuelto', 'Sin maletín', 'Entrega en sede Cali', 'NO se encuentra a paz y salvo']) {
    assert.ok(texto.includes(s), `falta "${s}"`);
  }
  assert.equal(audits[0][1], 'Acta de devolución con pendientes generada');
  assert.deepEqual(await db.prepare('SELECT * FROM inventario_equipos ORDER BY id').all(), antes);

  const ok = await fetch(`${BASE}/api/inventario/paz-salvo/acta`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Persona Sin Equipos', fecha_retiro: 'mal' }) });
  const t2 = textoDocx(Buffer.from(await ok.arrayBuffer())).join('\n');
  assert.ok(t2.includes('No registra equipos'));
  assert.ok(t2.includes('PAZ Y SALVO con el área de Sistemas'));
  assert.equal(audits[1][1], 'Paz y salvo generado');
});

test('acta de entrega (shared template code) still renders', async () => {
  const { generateActa } = await import('../../src/tech-requests/acta-generator.js');
  const buf = await generateActa(
    { request_number: 'REQ-1', requester_name: 'Ana Gómez', cedula: '1144555', cargo: 'Auxiliar', sede: 'Cali',
      fecha: '2026-10-21', items: [{ equipment_name: 'Portátil', quantity: 1 }] },
    [{ marca: 'Lenovo', modelo: 'T14', serial: 'S1', accesorios: 'Cargador $2' }]);
  const t = textoDocx(buf).join('\n');
  for (const s of ['ACTA DE ENTREGA', 'REQ-1', 'Ana Gómez', 'Lenovo', 'Cargador $2']) assert.ok(t.includes(s), `falta "${s}"`);
});

test('listarPersonas: all people with assets, summary by type, filters', async () => {
  const todas = await listarPersonas(db);
  assert.deepEqual(todas.map(p => p.nombre), ['Ana Gómez', 'Luis Pérez']);
  const ana = todas.find(p => p.cedula === '1144555');
  assert.equal(ana.cedula, '1144555');
  assert.deepEqual(ana.resumen, { Computador: 2, Monitor: 1, Celular: 1, UPS: 1 });
  assert.deepEqual(ana.areas, ['Sistemas', 'Cali']);
  // búsqueda por placa o IMEI encuentra al dueño
  assert.deepEqual((await listarPersonas(db, { q: 'af-4' })).map(p => p.nombre), ['Luis Pérez']);
  assert.deepEqual((await listarPersonas(db, { q: '3560000' })).map(p => p.cedula), ['1144555']);
  // por tipo
  assert.deepEqual((await listarPersonas(db, { tipo: 'celulares' })).map(p => p.resumen), [{ Celular: 1 }]);
  assert.deepEqual((await listarPersonas(db, { tipo: 'monitores' })).map(p => p.resumen), [{ Monitor: 1 }]);
  assert.equal((await listarPersonas(db, { tipo: 'ups' }))[0].resumen.UPS, 1);
  // por área / sede
  assert.equal((await listarPersonas(db, { area: 'cali' })).length, 2);
  assert.equal((await listarPersonas(db, { area: 'bogotá' })).length, 0);
  // equipos sin persona no aparecen
  await db.prepare("INSERT INTO inventario_equipos (placa, marca, nombre_equipo, serial) VALUES ('AF-9', 'HP', 'Bodega', 'S9')").run();
  assert.equal((await listarPersonas(db)).length, 2);
  // sin cédula y sin homónimo con cédula: queda como persona aparte
  await db.prepare("INSERT INTO inventario_ups (placa, nombre_completo) VALUES ('UPS-2', 'Marta Díaz')").run();
  assert.ok((await listarPersonas(db)).find(p => p.nombre === 'Marta Díaz' && !p.cedula));
  // dos personas con cédula y el mismo nombre: no se adivina a quién sumar
  await db.prepare("INSERT INTO inventario_ups (placa, nombre_completo, cedula) VALUES ('UPS-3', 'Ana Gómez', '777')").run();
  assert.ok((await listarPersonas(db)).find(p => p.nombre.toLowerCase() === 'ana gómez' && !p.cedula));
});

test('GET /api/inventario/personas: paginated list', async () => {
  const r = await (await fetch(`${BASE}/api/inventario/personas?page=2&limit=1`)).json();
  assert.equal(r.total, 2);
  assert.equal(r.total_pages, 2);
  assert.equal(r.page, 2);
  assert.deepEqual(r.personas.map(p => p.nombre), ['Luis Pérez']);
  const f = await (await fetch(`${BASE}/api/inventario/personas?search=luis&page=x&limit=999`)).json();
  assert.equal(f.total, 1);
  assert.equal(f.limit, 100);
  assert.equal(f.page, 1);
});
