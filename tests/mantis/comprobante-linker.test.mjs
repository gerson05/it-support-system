import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkComprobantes, similarity } from '../../src/mantis/comprobante-linker.js';

const disp = (codigo, nombre, estado = 'Activo') => ({ codigo, nombre, fuente: 'DISPENSACION', estado });

test('similarity: identical, unrelated and empty strings', () => {
  assert.equal(similarity('Drogueria del Centro', 'DROGUERIA DEL CENTRO'), 1);
  assert.ok(similarity('DROGUERIA DEL CENTRO TORO', 'DROGUERIA DEL CENTRO -TORO') > 0.9);
  assert.ok(similarity('ABC', 'XYZ') < 0.2);
  assert.equal(similarity('', 'X'), 0);
});

test('link by bodega number at the start of the comprobante name', () => {
  const links = linkComprobantes(
    [{ codigo: 581, nombre: '581 MI FARMACIA PASOANCHO (FOMAG)' }],
    [disp('PAS', '581 MI FARMACIA PASOANCHO (FOMAG)'), { codigo: '270', nombre: '581 REEMBOLSO', fuente: 'Causacion', estado: 'Activo' }],
  );
  assert.deepEqual(links.get(581), { comprobante: 'PAS', origen: 'numero' });
});

test('link by identical name (ignoring the leading number)', () => {
  const links = linkComprobantes(
    [{ codigo: 202, nombre: 'DRODESCUENTOS ULLOA' }],
    [disp('ULL', 'DRODESCUENTOS ULLOA')],
  );
  assert.deepEqual(links.get(202), { comprobante: 'ULL', origen: 'nombre' });
});

test('link by similarity of name or cost center', () => {
  const links = linkComprobantes(
    [
      { codigo: 190, nombre: 'DROGUERIA DEL CENTRO TORO V', centro_costo: 'PRINCIPAL' },
      { codigo: 249, nombre: 'BOD 249', centro_costo: 'DROGUERIA ISABELA ROBAYO' },
    ],
    [disp('TRO', 'DROGUERIA DEL CENTRO TORO'), disp('DAG', 'DROGUERIA ISABELA ROBAYO DAGUA'), disp('ZZZ', 'OTRA COSA')],
  );
  assert.deepEqual(links.get(190), { comprobante: 'TRO', origen: 'similitud' });
  assert.deepEqual(links.get(249), { comprobante: 'DAG', origen: 'similitud' });
});

test('no link when nothing is similar enough or there is a near tie', () => {
  const links = linkComprobantes(
    [{ codigo: 1, nombre: 'BODEGA SAN FERNANDO' }, { codigo: 2, nombre: 'DROGUERIA ABCDE' }],
    [disp('AAA', 'DROGUERIA ABCDEF'), disp('BBB', 'DROGUERIA ABCDEG'), disp('CCC', 'BODEGA MC')],
  );
  assert.equal(links.has(1), false);
  assert.equal(links.has(2), false, 'two equally similar candidates → leave for manual');
});

test('active comprobantes win over inactive ones with the same number', () => {
  const links = linkComprobantes(
    [{ codigo: 36, nombre: '36 MI FARMACIA ZARAGOZA' }],
    [disp('OLD', '36 MI FARMACIA ZARAGOZA', 'Inactivo'), disp('ZAR', '36 MI FARMACIA ZARAGOZA')],
  );
  assert.equal(links.get(36).comprobante, 'ZAR');
});
