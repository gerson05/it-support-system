import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../helpers/sqlite-memory-db.mjs';
import { migrations as m015 } from '../../src/config/migrations/015-employees-fix.js';
import { migrations as m036 } from '../../src/config/migrations/036-mantis-catalogos.js';
import {
  importCatalog, relinkBodegas, searchPerfiles, searchBodegas, getPerfil, getBodega, getComprobante,
  bodegasSinComprobante, setComprobanteManual, catalogStatus,
} from '../../src/mantis/catalog-model.js';

const PERFILES = [{ codigo: 10, nombre: 'AUXILIAR DE DISPENSACION' }, { codigo: 15, nombre: 'ADMIN BODEGA' }];
const BODEGAS = [
  { codigo: 581, nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', ciudad: 'CALI', estado: 'A', punto_dispensacion: 1, centro_costo: '' },
  { codigo: 648, nombre: '648 BODEGA SAN FERNANDO', ciudad: 'CALI', estado: 'A', punto_dispensacion: 1, centro_costo: '' },
  { codigo: 700, nombre: '700 MI FARMACIA PENDIENTE', ciudad: 'PASTO', estado: 'P', punto_dispensacion: 1, centro_costo: '' },
];
const COMPROBANTES = [
  { codigo: 'PAS', nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', fuente: 'DISPENSACION', estado: 'Activo' },
  { codigo: 'SFE', nombre: 'SAN FERNANDO ESPECIAL', fuente: 'COMPRAS', estado: 'Activo' },
];

async function freshDb() {
  return createMemoryDb([...m015, ...m036]);
}

test('importCatalog: validates type and empty files', async () => {
  const db = await freshDb();
  await assert.rejects(() => importCatalog(db, 'otro', [{}]), { code: 'BAD_TIPO' });
  await assert.rejects(() => importCatalog(db, 'perfiles', []), { code: 'EMPTY' });
});

test('importCatalog perfiles: inserts, updates and removes missing rows', async () => {
  const db = await freshDb();
  assert.deepEqual(await importCatalog(db, 'perfiles', PERFILES, { archivo: 'p.xls', usuario: 'gh' }), { tipo: 'perfiles', filas: 2 });
  await importCatalog(db, 'perfiles', [{ codigo: 10, nombre: 'AUX DISPENSACION' }]);
  assert.deepEqual(await getPerfil(db, 10), { codigo: 10, nombre: 'AUX DISPENSACION' });
  assert.equal(await getPerfil(db, 15), null);
});

test('bodegas + comprobantes: auto link, status counts and pending list', async () => {
  const db = await freshDb();
  await importCatalog(db, 'comprobantes', COMPROBANTES);
  const r = await importCatalog(db, 'bodegas', BODEGAS, { archivo: 'b.xls', usuario: 'gh' });
  assert.equal(r.enlazadas, 1);
  assert.equal((await getBodega(db, 581)).comprobante, 'PAS');

  const sin = await bodegasSinComprobante(db);
  assert.deepEqual(sin.map(b => b.codigo), [648], 'pending (P) bodegas are not listed');

  const st = await catalogStatus(db);
  assert.equal(st.bodegas.total, 2, 'only active bodegas are counted');
  assert.equal(st.comprobantes.total, 2);
  assert.equal(st.sin_comprobante, 1);
  assert.equal(st.bodegas.ultima.archivo, 'b.xls');
  assert.equal(st.perfiles.ultima, null);
});

test('manual comprobante is kept across reloads while it still exists', async () => {
  const db = await freshDb();
  await importCatalog(db, 'comprobantes', COMPROBANTES);
  await importCatalog(db, 'bodegas', BODEGAS);

  await assert.rejects(() => setComprobanteManual(db, 999, 'SFE'), { code: 'NOT_FOUND' });
  await assert.rejects(() => setComprobanteManual(db, 648, 'NOPE'), { code: 'BAD_COMPROBANTE' });
  assert.deepEqual(await setComprobanteManual(db, 648, ' sfe '), { codigo: 648, comprobante: 'SFE' });

  await importCatalog(db, 'bodegas', BODEGAS);
  assert.equal((await getBodega(db, 648)).comprobante, 'SFE');

  // Si el comprobante desaparece del catálogo, la asignación manual se limpia
  await importCatalog(db, 'comprobantes', [COMPROBANTES[0]]);
  assert.equal((await getBodega(db, 648)).comprobante, null);
  assert.equal(await getComprobante(db, 'SFE'), null);
});

test('relinkBodegas: returns totals', async () => {
  const db = await freshDb();
  await importCatalog(db, 'bodegas', BODEGAS);
  assert.deepEqual(await relinkBodegas(db), { enlazadas: 0, total: 3 });
});

test('search: perfiles by name or code; bodegas only active, by name, city or code', async () => {
  const db = await freshDb();
  await importCatalog(db, 'perfiles', PERFILES);
  await importCatalog(db, 'comprobantes', COMPROBANTES);
  await importCatalog(db, 'bodegas', BODEGAS);

  assert.deepEqual((await searchPerfiles(db, 'auxi')).map(p => p.codigo), [10]);
  assert.deepEqual((await searchPerfiles(db, '15')).map(p => p.codigo), [15]);
  assert.equal((await searchPerfiles(db, '')).length, 2);

  const pas = await searchBodegas(db, 'pasoancho');
  assert.deepEqual(pas, [{ codigo: 581, nombre: '581 MI FARMACIA PASOANCHO (FOMAG)', ciudad: 'CALI', comprobante: 'PAS' }]);
  assert.deepEqual((await searchBodegas(db, '648')).map(b => b.codigo), [648]);
  assert.equal((await searchBodegas(db, 'pasto')).length, 0, 'pending bodegas are hidden');
  assert.equal((await searchBodegas(db, 'cali')).length, 2);
});
