import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  norm, readSheetRows, parsePerfiles, parseBodegas, parseComprobantes, PARSERS,
} from '../../src/mantis/catalog-parser.js';

/** Excel en memoria con el formato de los exports de Mantis (título + fila vacía + encabezados). */
function excel(rows, bookType = 'xlsx') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet0');
  return XLSX.write(wb, { type: 'buffer', bookType });
}

test('norm: uppercase, no accents, single spaces', () => {
  assert.equal(norm('  Código   del  Perfil '), 'CODIGO DEL PERFIL');
  assert.equal(norm('Castañeda (FOMAG)'), 'CASTANEDA FOMAG');
  assert.equal(norm(null), '');
});

test('readSheetRows: reads .xlsx and old .xls (BIFF)', () => {
  const rows = [['Código del Perfil', 'Nombre del Perfil'], [10, 'AUXILIAR DE DISPENSACION']];
  assert.deepEqual(readSheetRows(excel(rows, 'xlsx'))[1], [10, 'AUXILIAR DE DISPENSACION']);
  assert.deepEqual(readSheetRows(excel(rows, 'biff8'))[1], [10, 'AUXILIAR DE DISPENSACION']);
});

test('parsePerfiles: codes and names, skips blanks', () => {
  const rows = readSheetRows(excel([
    ['Código del Perfil', 'Nombre del Perfil'],
    [15, 'ADMIN BODEGA'],
    ['', ''],
    [10, 'AUXILIAR DE DISPENSACION'],
    ['x', 'SIN CODIGO'],
  ]));
  assert.deepEqual(parsePerfiles(rows), [
    { codigo: 15, nombre: 'ADMIN BODEGA' },
    { codigo: 10, nombre: 'AUXILIAR DE DISPENSACION' },
  ]);
});

test('parseBodegas: finds header after title rows, maps optional columns', () => {
  const rows = readSheetRows(excel([
    ['Bodegas'],
    [],
    ['Codigo Bodega', 'Nombre Bodega', 'Ciudad', 'Centro de costo', 'Estado', 'Bodega Punto Dispensación'],
    [581, '581 MI FARMACIA PASOANCHO (FOMAG)', 'CALI', 'PASOANCHO', 'A', 'S'],
    [4, '4 DEVOLUCION', 'CALI', 'PRINCIPAL', 'i', 'N'],
  ]));
  assert.deepEqual(parseBodegas(rows), [
    { codigo: 581, nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', ciudad: 'CALI', estado: 'A', punto_dispensacion: 1, centro_costo: 'PASOANCHO' },
    { codigo: 4, nombre: '4 DEVOLUCION', ciudad: 'CALI', estado: 'I', punto_dispensacion: 0, centro_costo: 'PRINCIPAL' },
  ]);
});

test('parseBodegas: works without optional columns', () => {
  const rows = [['Codigo Bodega', 'Nombre Bodega', 'Estado'], [1, 'PRINCIPAL', 'A']];
  assert.deepEqual(parseBodegas(rows), [
    { codigo: 1, nombre: 'PRINCIPAL', ciudad: '', estado: 'A', punto_dispensacion: 0, centro_costo: '' },
  ]);
});

test('parseComprobantes: maps code, name, fuente, estado', () => {
  const rows = [
    ['Tipos de Comprobantes'],
    ['Tipo de Comprobante', 'Comprobante', 'Codigo de Fuente', 'Fuente', 'Estado'],
    ['PAS', '581 MI FARMACIA PASOANCHO (FOMAG)', 45, 'DISPENSACION', 'Activo'],
    ['', 'SIN CODIGO', 1, 'X', 'Activo'],
  ];
  assert.deepEqual(parseComprobantes(rows), [
    { codigo: 'PAS', nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', fuente: 'DISPENSACION', estado: 'Activo' },
  ]);
  assert.deepEqual(parseComprobantes([['Tipo de Comprobante', 'Comprobante'], ['ZDN', 'ZDONACION']]),
    [{ codigo: 'ZDN', nombre: 'ZDONACION', fuente: '', estado: '' }]);
});

test('parsers reject a file of the wrong type', () => {
  const perfiles = [['Código del Perfil', 'Nombre del Perfil'], [10, 'X']];
  assert.throws(() => parseBodegas(perfiles), { code: 'BAD_FILE', message: /bodegas/ });
  assert.throws(() => parseComprobantes(perfiles), { code: 'BAD_FILE' });
  assert.throws(() => parsePerfiles([['otra', 'cosa']]), { code: 'BAD_FILE', message: /perfiles/ });
});

test('PARSERS exposes one parser per catalog type', () => {
  assert.deepEqual(Object.keys(PARSERS).sort(), ['bodegas', 'comprobantes', 'perfiles']);
});

test('readSheetRows: empty workbook gives no rows', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'S');
  assert.deepEqual(readSheetRows(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), []);
});

test('readSheetRows: CSV is read as UTF-8 and dates stay as typed (day/month)', () => {
  const csv = Buffer.from('﻿Documento,Salario básico,Fecha de ingreso\n9990002,2400000,01/02/2019\n', 'utf-8');
  assert.deepEqual(readSheetRows(csv), [['Documento', 'Salario básico', 'Fecha de ingreso'], ['9990002', '2400000', '01/02/2019']]);
});
