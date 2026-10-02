import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHrDb } from '../helpers/hr-db.mjs';
import {
  importarRegistros, registrarAlta, buscarEmpleados, getEmpleado, actualizarEmpleado, resumenPersonal,
  getMapeo, guardarMapeo, getConfig, setConfig, getPlantilla, guardarPlantilla,
  registrarCertificado, ultimosCertificados, CONFIG_DEFAULT,
} from '../../src/hr/personal-model.js';

const reg = (...rs) => new Map(rs.map(r => [r.cedula, r]));

test('migration 037 grants hr permissions to gestion_humana', async () => {
  const db = createHrDb();
  const perms = await db.prepare(
    `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
     JOIN roles r ON r.id = rp.role_id WHERE r.name = 'gestion_humana' ORDER BY p.name`
  ).all();
  assert.deepEqual(perms.map(p => p.name), ['hr:edit', 'hr:read']);
});

test('importarRegistros: files complement each other by cédula, in any order', async () => {
  const db = createHrDb();
  // Primero el archivo de género (crea registros que aún no son empleados)
  let r = await importarRegistros(db, reg(
    { cedula: '1', nombre: 'ANA', genero: 'F', es_empleado: 0 },
    { cedula: '9', nombre: 'EMPRESA', es_empleado: 0 },
  ), { archivo: 'nits.xlsx', usuario: 'gh', campos: ['cedula', 'genero'] });
  assert.deepEqual(r, { creados: 2, actualizados: 0 });
  assert.equal(await getEmpleado(db, '1'), null, 'not an employee yet');

  // Luego la nómina
  r = await importarRegistros(db, reg(
    { cedula: '1', nombre: 'ANA MARIA', cargo: 'AUX', estado: 'A', salario: 100, es_empleado: 1 },
    { cedula: '2', nombre: 'LUIS', cargo: 'DIG', estado: 'I', fecha_retiro: '2025-01-01', es_empleado: 1 },
  ), { archivo: 'nomina.xls' });
  assert.deepEqual(r, { creados: 1, actualizados: 1 });

  const ana = await getEmpleado(db, '1');
  assert.equal(ana.nombre, 'ANA MARIA');
  assert.equal(ana.genero, 'F', 'gender from the first file kept');
  assert.equal(ana.es_empleado, 1);
  assert.equal(ana.fuente, 'nomina.xls');

  // Archivo sin cambios para una cédula existente: no cuenta como actualizado
  r = await importarRegistros(db, reg({ cedula: '1', es_empleado: 0 }));
  assert.deepEqual(r, { creados: 0, actualizados: 0 });

  const res = await resumenPersonal(db);
  assert.equal(res.empleados, 2);
  assert.equal(res.activos, 1);
  assert.equal(res.retirados, 1);
  assert.equal(res.con_genero, 1);
  assert.equal(res.cargas.length, 3);
  assert.equal(res.cargas[0].archivo, 'carga');
});

test('importarRegistros: inserts in batches (many rows)', async () => {
  const db = createHrDb();
  const muchos = new Map();
  for (let i = 0; i < 700; i++) muchos.set(`${1000 + i}`, { cedula: `${1000 + i}`, genero: i % 2 ? 'M' : 'F', es_empleado: 0 });
  const r = await importarRegistros(db, muchos, { archivo: 'nits.xlsx' });
  assert.equal(r.creados, 700);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM hr_empleados').get()).n, 700);
});

test('registrarAlta: new users from "Crear usuarios" become active employees unless HR data exists', async () => {
  const db = createHrDb();
  assert.equal(await registrarAlta(db, { cedula: '5', nombre: 'NUEVO', cargo: 'AUX' }), true);
  let e = await getEmpleado(db, '5');
  assert.equal(e.estado, 'A');
  assert.equal(e.fuente, 'Crear usuarios');

  await importarRegistros(db, reg({ cedula: '6', genero: 'M', es_empleado: 0 }));
  assert.equal(await registrarAlta(db, { cedula: '6', nombre: 'CON GENERO', cargo: 'AUX' }), true);
  e = await getEmpleado(db, '6');
  assert.equal(e.genero, 'M');
  assert.equal(e.nombre, 'CON GENERO');

  await importarRegistros(db, reg({ cedula: '7', nombre: 'DE NOMINA', cargo: 'JEFE', es_empleado: 1 }));
  assert.equal(await registrarAlta(db, { cedula: '7', nombre: 'OTRO', cargo: 'AUX' }), false);
  assert.equal((await getEmpleado(db, '7')).cargo, 'JEFE');
});

test('buscarEmpleados: by cédula prefix or name, employees only', async () => {
  const db = createHrDb();
  await importarRegistros(db, reg(
    { cedula: '111222', nombre: 'ANA DEMO', estado: 'A', es_empleado: 1 },
    { cedula: '111333', nombre: 'TERCERO', es_empleado: 0 },
  ));
  assert.deepEqual((await buscarEmpleados(db, '111')).map(e => e.cedula), ['111222']);
  assert.deepEqual((await buscarEmpleados(db, 'demo')).map(e => e.cedula), ['111222']);
  assert.deepEqual(await buscarEmpleados(db, '  '), []);
});

test('actualizarEmpleado: manual corrections', async () => {
  const db = createHrDb();
  await importarRegistros(db, reg({ cedula: '1', nombre: 'ANA', es_empleado: 1 }));
  assert.equal(await actualizarEmpleado(db, '1', { genero: 'F', salario: 1000 }), true);
  const e = await getEmpleado(db, '1');
  assert.equal(e.genero, 'F');
  assert.equal(e.fuente, 'Corrección manual');
  assert.equal(await actualizarEmpleado(db, '1', {}), true);
  assert.equal(await actualizarEmpleado(db, '404', { genero: 'F' }), false);
});

test('mapeos, config, plantilla and certificate log', async () => {
  const db = createHrDb();
  assert.equal(await getMapeo(db, 'x'), null);
  await guardarMapeo(db, 'x', { 0: 'cedula' });
  await guardarMapeo(db, 'x', { 0: 'cedula', 1: 'nombre' });
  assert.deepEqual(await getMapeo(db, 'x'), { 0: 'cedula', 1: 'nombre' });
  await db.prepare(`INSERT INTO hr_mapeos (firma, mapeo) VALUES ('roto', '{no json')`).run();
  assert.equal(await getMapeo(db, 'roto'), null);

  assert.deepEqual(await getConfig(db), CONFIG_DEFAULT);
  await setConfig(db, { salario_minimo: '$1.750.905' });
  const cfg = await setConfig(db, { auxilio_transporte: '260.000', salario_minimo: '1750905', otro: 'x' });
  assert.deepEqual(cfg, { auxilio_transporte: '260000', salario_minimo: '1750905' });

  assert.equal(await getPlantilla(db), null);
  await guardarPlantilla(db, Buffer.from('v1'), { archivo: 'a.docx', usuario: 'gh' });
  await guardarPlantilla(db, Buffer.from('v2'), { archivo: 'b.docx' });
  const p = await getPlantilla(db);
  assert.equal(p.archivo, 'b.docx');
  assert.equal(p.buffer.toString(), 'v2');

  await registrarCertificado(db, { cedula: '1', nombre: 'ANA', tipo: 'activo', usuario: 'gh' });
  await registrarCertificado(db, { cedula: '2', nombre: 'LUIS', tipo: 'retirado' });
  assert.deepEqual((await ultimosCertificados(db)).map(c => c.cedula), ['2', '1']);
});
