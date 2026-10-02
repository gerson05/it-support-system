import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS, campoPara, detectarEncabezado, sugerirMapeo, firmaEncabezados, validarMapeo, construirRegistros,
} from '../../src/hr/personal-import.js';

const LISTADO = [
  ['Contrato', 'Nit', 'Nombre', 'Tipo de contrato', 'Inicio de contrato', 'Retiro', 'Termino de contrato', 'Estado de contrato', 'Sueldo', 'Cargo'],
  ['2', '9990001', 'ANA DEMO', 'TERF', 42801, '', '', 'A', 1750905, 'TELEFONISTA'],
  ['3', '9990002', 'LUIS DEMO', 'TERF', '16/03/2015', '30/06/2025', '', 'I', 2000000, 'DIGITADOR'],
];

test('campoPara: recognizes common header names', () => {
  assert.equal(campoPara('Nit Identificacion'), 'cedula');
  assert.equal(campoPara('Género'), 'genero');
  assert.equal(campoPara('Inicio de contrato'), 'fecha_ingreso');
  assert.equal(campoPara('Salario básico'), 'salario');
  assert.equal(campoPara('Termino de contrato'), null);
  assert.equal(campoPara(''), null);
});

test('detectarEncabezado: skips titles, needs cédula plus another field', () => {
  assert.equal(detectarEncabezado([['Reporte'], [], ...LISTADO]), 2);
  assert.equal(detectarEncabezado([['Cedula'], ['123']]), -1);
  assert.equal(detectarEncabezado([['Nombre', 'Cargo']]), -1);
});

test('sugerirMapeo: first column of each field only', () => {
  assert.deepEqual(sugerirMapeo(LISTADO[0]), {
    0: 'contrato', 1: 'cedula', 2: 'nombre', 3: 'tipo_contrato', 4: 'fecha_ingreso',
    5: 'fecha_retiro', 7: 'estado', 8: 'salario', 9: 'cargo',
  });
  assert.deepEqual(sugerirMapeo(['Cedula', 'Nombre', 'Documento']), { 0: 'cedula', 1: 'nombre' });
});

test('firmaEncabezados: stable and insensitive to accents/case', () => {
  assert.equal(firmaEncabezados(['Cédula', 'Nombre']), firmaEncabezados(['CEDULA', ' nombre ']));
  assert.notEqual(firmaEncabezados(['Cedula', 'Nombre']), firmaEncabezados(['Cedula', 'Cargo']));
});

test('validarMapeo', () => {
  assert.equal(validarMapeo({ 0: 'cedula', 1: 'nombre' }), null);
  assert.match(validarMapeo({ 1: 'nombre' }), /cédula/);
  assert.match(validarMapeo({ 0: 'cedula', 1: 'cargo', 2: 'cargo' }), /Cargo/);
  assert.match(validarMapeo({ 0: 'cedula', 1: 'otro' }), /desconocido/);
  assert.ok(CAMPOS.salario.label);
});

test('construirRegistros: normalizes values and marks employees', () => {
  const { registros, filas, sinCedula } = construirRegistros(LISTADO, 0, sugerirMapeo(LISTADO[0]));
  assert.equal(filas, 2);
  assert.equal(sinCedula, 0);
  assert.deepEqual(registros.get('9990001'), {
    contrato: '2', cedula: '9990001', nombre: 'ANA DEMO', tipo_contrato: 'a término fijo',
    fecha_ingreso: '2017-03-07', estado: 'A', salario: 1750905, cargo: 'TELEFONISTA', es_empleado: 1,
  });
  assert.equal(registros.get('9990002').fecha_retiro, '2025-06-30');
});

test('construirRegistros: gender-only file does not mark employees', () => {
  const rows = [['Nit Identificacion', 'Nombre Completo', 'Genero'], ['9990001', 'ANA', 'F'], ['', 'SIN', 'M'], ['', '', '']];
  const { registros, filas, sinCedula } = construirRegistros(rows, 0, sugerirMapeo(rows[0]));
  assert.equal(filas, 2);
  assert.equal(sinCedula, 1);
  assert.deepEqual(registros.get('9990001'), { cedula: '9990001', nombre: 'ANA', genero: 'F', es_empleado: 0 });
});

test('construirRegistros: retiro without estado → inactive; several contracts per person', () => {
  const rows = [
    ['Cedula', 'Fecha ingreso', 'Fecha retiro', 'Estado', 'Sexo'],
    ['9990003', '01/01/2015', '01/01/2016', '', 'M'],
    ['9990003', '01/01/2018', '', 'A', ''],
    ['9990004', '01/01/2010', '01/01/2012', 'I', ''],
    ['9990004', '01/01/2013', '01/01/2014', 'I', 'F'],
  ];
  const { registros } = construirRegistros(rows, 0, sugerirMapeo(rows[0]));
  const a = registros.get('9990003');
  assert.equal(a.estado, 'A', 'active contract wins');
  assert.equal(a.fecha_ingreso, '2018-01-01');
  assert.equal(a.genero, 'M', 'gender kept from another row');
  const b = registros.get('9990004');
  assert.equal(b.fecha_ingreso, '2013-01-01', 'most recent contract wins');
  assert.equal(b.genero, 'F');

  const single = construirRegistros([['Cedula', 'Fecha retiro'], ['9990005', '01/02/2020']], 0, { 0: 'cedula', 1: 'fecha_retiro' });
  assert.equal(single.registros.get('9990005').estado, 'I');
});
