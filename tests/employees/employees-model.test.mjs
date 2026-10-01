import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../helpers/sqlite-memory-db.mjs';
import { migrations as m015 } from '../../src/config/migrations/015-employees-fix.js';
import { migrations as m036 } from '../../src/config/migrations/036-mantis-catalogos.js';

// La base real en memoria reemplaza a src/config/database.js
let db;
const proxy = {
  prepare: (sql) => db.prepare(sql),
  exec: (sql) => db.exec(sql),
};
await mock.module('../../src/config/database.js', { exports: { default: proxy } });

const M = await import('../../src/employees/employees-model.js');
const { importCatalog } = await import('../../src/mantis/catalog-model.js');

const MANTIS = { perfil_codigo: 10, bodega_codigo: 581 };

beforeEach(async () => {
  db = createMemoryDb([
    'CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)',
    "INSERT INTO users (id, username) VALUES (1, 'gh')",
    ...m015, ...m036,
  ]);
  await importCatalog(db, 'perfiles', [{ codigo: 10, nombre: 'AUXILIAR DE DISPENSACION' }, { codigo: 15, nombre: 'ADMIN BODEGA' }]);
  await importCatalog(db, 'comprobantes', [
    { codigo: 'PAS', nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', fuente: 'DISPENSACION', estado: 'Activo' },
    { codigo: 'SFE', nombre: 'SAN FERNANDO', fuente: 'COMPRAS', estado: 'Activo' },
  ]);
  await importCatalog(db, 'bodegas', [
    { codigo: 581, nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', ciudad: 'CALI', estado: 'A', punto_dispensacion: 1, centro_costo: '' },
    { codigo: 648, nombre: '648 BODEGA SAN FERNANDO', ciudad: 'CALI', estado: 'A', punto_dispensacion: 1, centro_costo: '' },
    { codigo: 700, nombre: '700 INACTIVA', ciudad: 'CALI', estado: 'I', punto_dispensacion: 1, centro_costo: '' },
  ]);
});

test('createEmployee (Mantis): resolves catalogs and generates credentials', async () => {
  const r = await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', created_by: 1, ...MANTIS });
  assert.equal(r.usuario, 'GGOSORIO');
  assert.match(r.contraseña, /^\d{4}$/);

  const emp = await M.getEmployeeById(r.id);
  assert.equal(emp.cargo, 'AUXILIAR DE DISPENSACION');
  assert.equal(emp.perfil_codigo, 10);
  assert.equal(emp.sede, '581 MI FARMACIA PASOANCHO (FOMAG)');
  assert.equal(emp.area, '581 MI FARMACIA PASOANCHO (FOMAG)');
  assert.equal(emp.bodega_codigo, 581);
  assert.equal(emp.comprobante, 'PAS');
  assert.equal(emp.mantis_estado, 'pendiente');
  assert.equal(await M.getPendingCount(), 1);
});

test('createEmployee (Mantis): username collision uses first surname, password never repeats', async () => {
  const a = await M.createEmployee({ cedula: '1001', nombre_completo: 'Liseth Dayana Herrera Rosero', ...MANTIS });
  const b = await M.createEmployee({ cedula: '1002', nombre_completo: 'Luis David Herrera Rosero', ...MANTIS });
  const c = await M.createEmployee({ cedula: '1003', nombre_completo: 'Laura Diana Herrera Rosero', ...MANTIS });
  assert.deepEqual([a.usuario, b.usuario, c.usuario], ['LHROSERO', 'LDHERRERA', 'LHROSERO2']);
  assert.equal(new Set([a.contraseña, b.contraseña, c.contraseña]).size, 3);
});

test('createEmployee (Mantis): manual usuario/clave are validated', async () => {
  await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS, usuario: 'ggosorio', contraseña: '1234' });
  await assert.rejects(() => M.createEmployee({ cedula: '1002', nombre_completo: 'Otra Persona', ...MANTIS, usuario: 'GGOSORIO' }), { code: 'USERNAME_TAKEN' });
  await assert.rejects(() => M.createEmployee({ cedula: '1002', nombre_completo: 'Otra Persona', ...MANTIS, contraseña: '1234' }), { code: 'PASSWORD_TAKEN' });
  await assert.rejects(() => M.createEmployee({ cedula: '1002', nombre_completo: 'Otra Persona', ...MANTIS, usuario: 'G G' }), { code: 'BAD_USERNAME' });
  await assert.rejects(() => M.createEmployee({ cedula: '1002', nombre_completo: 'Otra Persona', ...MANTIS, contraseña: '12' }), { code: 'BAD_PASSWORD' });
});

test('createEmployee (Mantis): invalid catalog selections', async () => {
  const base = { cedula: '1001', nombre_completo: 'Gladys Garcia Osorio' };
  await assert.rejects(() => M.createEmployee({ ...base, perfil_codigo: 99, bodega_codigo: 581 }), { code: 'BAD_PERFIL' });
  await assert.rejects(() => M.createEmployee({ ...base, perfil_codigo: 10, bodega_codigo: 700 }), { code: 'BAD_BODEGA' });
  await assert.rejects(() => M.createEmployee({ ...base, perfil_codigo: 10, bodega_codigo: 648 }), { code: 'NO_COMPROBANTE' });
  await assert.rejects(() => M.createEmployee({ ...base, perfil_codigo: 10, bodega_codigo: 648, comprobante: 'XXX' }), { code: 'BAD_COMPROBANTE' });
  const ok = await M.createEmployee({ ...base, perfil_codigo: 10, bodega_codigo: 648, comprobante: 'sfe' });
  assert.equal((await M.getEmployeeById(ok.id)).comprobante, 'SFE');
});

test('createEmployee: duplicate cedula and missing fields', async () => {
  await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  await assert.rejects(() => M.createEmployee({ cedula: '1001', nombre_completo: 'Otra', ...MANTIS }), { code: 'CEDULA_EXISTS' });
  await assert.rejects(() => M.createEmployee({ cedula: '1002', nombre_completo: 'Otra' }), { code: 'MISSING_FIELDS' });
});

test('legacy flow: create pending, complete generates credentials with the new rule', async () => {
  const { id } = await M.createEmployee({ cedula: '2001', nombre_completo: 'Alba Lucia Ospina Castañeda', cargo: 'Aux', area: 'Cali' });
  assert.equal(await M.getPendingCount(), 1);
  await assert.rejects(() => M.completeEmployee(id, '', 1), { code: 'FECHA_REQUIRED' });
  await assert.rejects(() => M.completeEmployee(999, '2026-10-01', 1), { code: 'NOT_FOUND' });

  const creds = await M.completeEmployee(id, '2026-10-01', 1);
  assert.equal(creds.usuario, 'AOCASTANEDA');
  assert.match(creds.contraseña, /^\d{4}$/);
  const emp = await M.getEmployeeById(id);
  assert.equal(emp.usuario, 'AOCASTANEDA');
  assert.equal(emp.mantis_estado, null);
  assert.equal(await M.getPendingCount(), 0);
});

test('Mantis flow: complete marks as created without changing credentials', async () => {
  const r = await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  const creds = await M.completeEmployee(r.id, '2026-10-01', 1);
  assert.deepEqual(creds, { usuario: r.usuario, contraseña: r.contraseña });
  const emp = await M.getEmployeeById(r.id);
  assert.equal(emp.mantis_estado, 'creado');
  assert.ok(emp.mantis_creado_at);
  assert.equal(await M.getPendingCount(), 0);
});

test('setMantisResult: error then success', async () => {
  const r = await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  await M.setMantisResult(r.id, { ok: false, error: 'perfil inválido' });
  let emp = await M.getEmployeeById(r.id);
  assert.equal(emp.mantis_estado, 'error');
  assert.equal(emp.mantis_error, 'perfil inválido');
  await M.setMantisResult(r.id, { ok: true });
  emp = await M.getEmployeeById(r.id);
  assert.equal(emp.mantis_estado, 'creado');
  assert.equal(emp.mantis_error, null);
});

test('updateEmployee (Mantis): changes catalogs and credentials with validation', async () => {
  const a = await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  const b = await M.createEmployee({ cedula: '1002', nombre_completo: 'Alba Lucia Ospina Castañeda', ...MANTIS });

  await M.updateEmployee(a.id, { perfil_codigo: 15, bodega_codigo: 648, comprobante: 'SFE', usuario: 'GGOSORIO', contraseña: '0001' }, 1);
  let emp = await M.getEmployeeById(a.id);
  assert.equal(emp.cargo, 'ADMIN BODEGA');
  assert.equal(emp.bodega_codigo, 648);
  assert.equal(emp.comprobante, 'SFE');
  assert.equal(emp.contraseña, '0001');

  await assert.rejects(() => M.updateEmployee(b.id, { usuario: 'GGOSORIO' }, 1), { code: 'USERNAME_TAKEN' });

  // Cambiar solo la sede toma el comprobante de la nueva sede
  await M.updateEmployee(a.id, { bodega_codigo: 581 }, 1);
  emp = await M.getEmployeeById(a.id);
  assert.equal(emp.comprobante, 'PAS');
});

test('updateEmployee (legacy): ignores Mantis fields and credentials', async () => {
  const { id } = await M.createEmployee({ cedula: '2001', nombre_completo: 'Pedro Perez', cargo: 'Aux', area: 'Cali' });
  await M.updateEmployee(id, { nombre_completo: 'Pedro Pablo Perez', usuario: 'HACK', perfil_codigo: 10 }, 1);
  const emp = await M.getEmployeeById(id);
  assert.equal(emp.nombre_completo, 'Pedro Pablo Perez');
  assert.equal(emp.usuario, null);
  assert.equal(emp.perfil_codigo, null);
  await M.updateEmployee(id, {}, 1); // sin cambios: no falla
});

test('suggestUsername / suggestPassword use registered employees', async () => {
  await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  assert.equal(await M.suggestUsername('Gladys Garcia Osorio'), 'GOGARCIA');
  assert.match(await M.suggestPassword(), /^\d{4}$/);
});

test('deleteEmployee: removes and reports missing', async () => {
  const { id } = await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  await M.deleteEmployee(id, 1);
  assert.equal(await M.getEmployeeById(id), null);
  await assert.rejects(() => M.deleteEmployee(id, 1), { code: 'NOT_FOUND' });
});

test('getAllEmployees lists newest first', async () => {
  await M.createEmployee({ cedula: '1001', nombre_completo: 'Gladys Garcia Osorio', ...MANTIS });
  await M.createEmployee({ cedula: '1002', nombre_completo: 'Pedro Perez', cargo: 'Aux', area: 'Cali' });
  const all = await M.getAllEmployees();
  assert.deepEqual(all.map(e => e.cedula), ['1002', '1001']);
});
