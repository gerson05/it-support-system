import { test, mock, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import * as XLSX from 'xlsx';
import { createHrDb } from '../helpers/hr-db.mjs';
import { docxFixture, textoDocx } from '../helpers/docx-fixture.mjs';

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

const router = (await import('../../src/hr/hr-routes.js')).default;
const app = express();
app.use(express.json());
app.use(router);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const server = createServer(app);
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise(r => server.close(r)));

beforeEach(() => { db = createHrDb(); audits.length = 0; });

function xlsx(rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet0');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
async function multipart(path, buffer, name, extra = {}) {
  const fd = new FormData();
  if (buffer) fd.append('file', new Blob([buffer]), name);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: fd });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  return { status: res.status, body: isJson ? await res.json() : Buffer.from(await res.arrayBuffer()), res };
}
const json = async (path, method = 'GET', body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  return { status: res.status, body: isJson ? await res.json() : Buffer.from(await res.arrayBuffer()), res };
};

const LISTADO = [
  ['Contrato', 'Nit', 'Nombre', 'Tipo de contrato', 'Inicio de contrato', 'Retiro', 'Estado de contrato', 'Sueldo', 'Cargo'],
  ['2', '9990001', 'ANA DEMO', 'TERF', '07/03/2017', '', 'A', 1850905, 'TELEFONISTA'],
  ['3', '9990002', 'LUIS DEMO', 'OBRA', '01/02/2019', '31/05/2024', 'I', 2000000, 'DIGITADOR'],
];
const NITS = [['Nit Identificacion', 'Nombre Completo', 'Genero'], ['9990001', 'ANA DEMO', 'F'], ['9990002', 'LUIS DEMO', 'M'], ['800123456', 'EMPRESA', 'E']];

async function cargar(rows, name) {
  const prev = await multipart('/api/hr/personal/preview', xlsx(rows), name);
  return multipart('/api/hr/personal/importar', xlsx(rows), name, { mapeo: JSON.stringify(prev.body.mapeo) });
}

test('preview: recognizes columns; errors for missing / unreadable / headerless files', async () => {
  const p = await multipart('/api/hr/personal/preview', xlsx(LISTADO), 'listado.xls');
  assert.equal(p.status, 200);
  assert.equal(p.body.recordado, false);
  assert.equal(p.body.personas, 2);
  assert.equal(p.body.empleados, 2);
  assert.equal(p.body.mapeo[1], 'cedula');
  assert.equal(p.body.mapeo[7], 'salario');

  assert.equal((await multipart('/api/hr/personal/preview', null)).status, 400);
  const sinEnc = await multipart('/api/hr/personal/preview', xlsx([['a', 'b'], [1, 2]]), 'x.xlsx');
  assert.equal(sinEnc.status, 400);
  assert.match(sinEnc.body.error, /cédula/);
  const roto = await multipart('/api/hr/personal/preview', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]), 'x.xls');
  assert.equal(roto.status, 400);
});

test('importar: validates mapping, loads, remembers format, complements by cédula', async () => {
  const sinMapeo = await multipart('/api/hr/personal/importar', xlsx(LISTADO), 'l.xls');
  assert.equal(sinMapeo.status, 400);
  const malJson = await multipart('/api/hr/personal/importar', xlsx(LISTADO), 'l.xls', { mapeo: '{' });
  assert.equal(malJson.status, 400);
  const sinCedula = await multipart('/api/hr/personal/importar', xlsx(LISTADO), 'l.xls', { mapeo: JSON.stringify({ 2: 'nombre' }) });
  assert.match(sinCedula.body.error, /cédula/);
  const vacio = await multipart('/api/hr/personal/importar', xlsx([LISTADO[0], ['', '', 'X']]), 'l.xls', { mapeo: JSON.stringify({ 1: 'cedula', 2: 'nombre' }) });
  assert.match(vacio.body.error, /No se encontraron/);

  const r = await cargar(LISTADO, 'listado.xls');
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.creados, r.body.actualizados], [2, 0]);
  assert.equal(audits.at(-1)[1], 'Excel de personal cargado');

  const otra = await multipart('/api/hr/personal/preview', xlsx(LISTADO), 'listado.xls');
  assert.equal(otra.body.recordado, true);

  const n = await cargar(NITS, 'nits.xlsx');
  assert.deepEqual([n.body.creados, n.body.actualizados], [1, 2]);
  assert.equal(n.body.resumen.con_genero, 2);
});

test('consulta y certificado: activo y retirado', async () => {
  await cargar(LISTADO, 'listado.xls');
  await cargar(NITS, 'nits.xlsx');

  assert.deepEqual((await json('/api/hr/empleados?q=demo')).body.map(e => e.cedula), ['9990001', '9990002']);
  assert.equal((await json('/api/hr/empleados/404')).status, 404);

  const ana = (await json('/api/hr/empleados/9990001')).body;
  assert.equal(ana.tipo, 'activo');
  assert.deepEqual(ana.faltantes, []);
  assert.equal(ana.vista_previa.tratamiento, 'la señora');

  const sinPlantilla = await json('/api/hr/certificados', 'POST', { cedula: '9990001' });
  assert.equal(sinPlantilla.status, 409);

  const subida = await multipart('/api/hr/plantilla', docxFixture(), 'plantilla.docx');
  assert.equal(subida.status, 200);
  assert.deepEqual(subida.body.desconocidos, ['otro_campo']);

  const cert = await json('/api/hr/certificados', 'POST', { cedula: '9990001' });
  assert.equal(cert.status, 200);
  assert.match(cert.res.headers.get('content-type'), /wordprocessingml/);
  assert.match(cert.res.headers.get('content-disposition'), /Certificado%20laboral%20ANA%20DEMO\.docx/);
  assert.match(textoDocx(cert.body)[1], /celebra un contrato a término fijo desde el 7 de marzo de 2017/);

  const ret = await json('/api/hr/certificados', 'POST', { cedula: '9990002' });
  assert.match(textoDocx(ret.body)[1], /celebró un contrato por obra o labor desde el 1 de febrero de 2019 hasta el 31 de mayo de 2024/);
  assert.equal(textoDocx(ret.body)[2], 'Desempeñó el cargo de DIGITADOR.');

  const resumen = (await json('/api/hr/resumen')).body;
  assert.deepEqual(resumen.certificados.map(c => c.tipo), ['retirado', 'activo']);
  assert.equal(resumen.plantilla.archivo, 'plantilla.docx');
  assert.equal(resumen.campos.cedula, 'Cédula');

  const plantilla = await json('/api/hr/plantilla');
  assert.equal(plantilla.status, 200);
  assert.ok(plantilla.body.length > 100);
});

test('certificado: missing data → 400 with list; manual correction fixes it', async () => {
  await cargar([['Cedula', 'Nombre', 'Estado'], ['9990003', 'SIN DATOS', 'A']], 'min.xlsx');
  await multipart('/api/hr/plantilla', docxFixture(), 'plantilla.docx');
  assert.equal((await json('/api/hr/certificados', 'POST', { cedula: '404' })).status, 404);

  const falta = await json('/api/hr/certificados', 'POST', { cedula: '9990003' });
  assert.equal(falta.status, 400);
  assert.deepEqual(falta.body.faltantes, ['cargo', 'tipo_contrato', 'fecha_ingreso', 'salario']);
  assert.match(falta.body.error, /Cargo, Tipo de contrato, Fecha de ingreso, Salario/);

  const fix = await json('/api/hr/empleados/9990003', 'PUT', {
    nombre: 'CON DATOS', genero: 'Femenino', cargo: 'AUX', tipo_contrato: 'TERF',
    fecha_ingreso: '2020-01-15', fecha_retiro: '', estado: 'A', salario: '$1.750.905',
  });
  assert.equal(fix.status, 200);
  assert.deepEqual(fix.body.faltantes, []);
  assert.equal(fix.body.empleado.salario, 1750905);
  assert.equal(audits.at(-1)[1], 'Datos de empleado corregidos');
  assert.equal((await json('/api/hr/empleados/404', 'PUT', { nombre: 'X' })).status, 404);
  assert.equal((await json('/api/hr/certificados', 'POST', { cedula: '9990003' })).status, 200);
});

test('plantilla: rejects missing, invalid or incomplete files; 404 before upload', async () => {
  assert.equal((await json('/api/hr/plantilla')).status, 404);
  assert.equal((await multipart('/api/hr/plantilla', null)).status, 400);
  const invalida = await multipart('/api/hr/plantilla', Buffer.from('no es un docx'), 'x.docx');
  assert.match(invalida.body.error, /Word/);
  const incompleta = await multipart('/api/hr/plantilla',
    docxFixture({ cuerpo: '<w:p><w:r><w:t>{{nombre}}</w:t></w:r></w:p>', encabezado: 'Sin campos' }), 'x.docx');
  assert.match(incompleta.body.error, /\{\{cedula\}\}/);
});

test('config: requires year and confirmation, records who changed it', async () => {
  const valores = { auxilio_transporte: '260.000', salario_minimo: '1.750.905', vigencia: '2027' };
  const sinConfirmar = await json('/api/hr/config', 'PUT', valores);
  assert.equal(sinConfirmar.status, 400);
  assert.match(sinConfirmar.body.error, /confirmar/);
  assert.equal((await json('/api/hr/config', 'PUT')).status, 400);
  const sinAnio = await json('/api/hr/config', 'PUT', { ...valores, vigencia: '27', confirmar: true });
  assert.match(sinAnio.body.error, /año/);
  const sinAux = await json('/api/hr/config', 'PUT', { ...valores, auxilio_transporte: '0', confirmar: true });
  assert.match(sinAux.body.error, /auxilio/);

  audits.length = 0;
  const r = await json('/api/hr/config', 'PUT', { ...valores, confirmar: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.auxilio_transporte, '260000');
  assert.equal(r.body.salario_minimo, '1750905');
  assert.equal(r.body.vigencia, '2027');
  assert.equal(r.body.actualizado_por, 'gh');
  assert.ok(r.body.actualizado_at);
  assert.equal(audits.length, 1);
  assert.equal(audits[0][4], '2027');
  assert.equal(audits[0][5].despues.auxilio_transporte, '260000');

  const sinSmmlv = await json('/api/hr/config', 'PUT', { auxilio_transporte: '260000', vigencia: '2027', confirmar: true });
  assert.equal(sinSmmlv.body.salario_minimo, '');
});
