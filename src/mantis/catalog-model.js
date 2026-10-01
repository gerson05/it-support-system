/**
 * Catálogos de Mantis en la base de datos. Cada carga de Excel reemplaza el catálogo
 * (el export de Mantis es completo). SQL portable SQLite/MariaDB: sin upsert nativo.
 */
import { linkComprobantes } from './comprobante-linker.js';

export const TIPOS = ['perfiles', 'bodegas', 'comprobantes'];

async function upsert(db, table, keyCol, row) {
  const cols = Object.keys(row).filter(c => c !== keyCol);
  const exists = await db.prepare(`SELECT ${keyCol} FROM ${table} WHERE ${keyCol} = ?`).get(row[keyCol]);
  if (exists) {
    await db.prepare(
      `UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now','localtime') WHERE ${keyCol} = ?`
    ).run(...cols.map(c => row[c]), row[keyCol]);
  } else {
    const all = [keyCol, ...cols];
    await db.prepare(`INSERT INTO ${table} (${all.join(', ')}) VALUES (${all.map(() => '?').join(', ')})`)
      .run(...all.map(c => row[c]));
  }
}

/** Borra las filas que ya no vienen en el archivo. */
async function removeMissing(db, table, keyCol, keys) {
  const current = await db.prepare(`SELECT ${keyCol} AS k FROM ${table}`).all();
  const keep = new Set(keys.map(String));
  for (const { k } of current) {
    if (!keep.has(String(k))) await db.prepare(`DELETE FROM ${table} WHERE ${keyCol} = ?`).run(k);
  }
}

async function logCarga(db, tipo, archivo, filas, usuario) {
  await db.prepare('INSERT INTO mantis_cargas (tipo, archivo, filas, usuario) VALUES (?, ?, ?, ?)')
    .run(tipo, archivo || null, filas, usuario || null);
}

/**
 * Recalcula el comprobante de todas las bodegas. Las asignaciones manuales se respetan
 * mientras el comprobante siga existiendo en el catálogo.
 */
export async function relinkBodegas(db) {
  const bodegas      = await db.prepare('SELECT codigo, nombre, centro_costo, comprobante, comprobante_origen FROM mantis_bodegas').all();
  const comprobantes = await db.prepare('SELECT codigo, nombre, fuente, estado FROM mantis_comprobantes').all();
  const validos      = new Set(comprobantes.map(c => c.codigo));
  const links        = linkComprobantes(bodegas, comprobantes);

  let enlazadas = 0;
  for (const b of bodegas) {
    let comprobante = null, origen = null;
    if (b.comprobante_origen === 'manual' && validos.has(b.comprobante)) {
      comprobante = b.comprobante; origen = 'manual';
    } else if (links.has(b.codigo)) {
      ({ comprobante, origen } = links.get(b.codigo));
    }
    if (comprobante) enlazadas++;
    if (comprobante !== b.comprobante || origen !== b.comprobante_origen) {
      await db.prepare('UPDATE mantis_bodegas SET comprobante = ?, comprobante_origen = ? WHERE codigo = ?')
        .run(comprobante, origen, b.codigo);
    }
  }
  return { enlazadas, total: bodegas.length };
}

/**
 * Carga un catálogo ya interpretado (ver catalog-parser.js).
 * @returns {{ tipo, filas, enlazadas? }}
 */
export async function importCatalog(db, tipo, items, { archivo, usuario } = {}) {
  if (!TIPOS.includes(tipo)) throw Object.assign(new Error('Tipo de catálogo inválido.'), { code: 'BAD_TIPO' });
  if (!items.length) throw Object.assign(new Error('El archivo no tiene filas con datos.'), { code: 'EMPTY' });

  if (tipo === 'perfiles') {
    for (const p of items) await upsert(db, 'mantis_perfiles', 'codigo', { codigo: p.codigo, nombre: p.nombre });
    await removeMissing(db, 'mantis_perfiles', 'codigo', items.map(p => p.codigo));
  } else if (tipo === 'comprobantes') {
    for (const c of items) await upsert(db, 'mantis_comprobantes', 'codigo', c);
    await removeMissing(db, 'mantis_comprobantes', 'codigo', items.map(c => c.codigo));
  } else {
    for (const b of items) await upsert(db, 'mantis_bodegas', 'codigo', b);
    await removeMissing(db, 'mantis_bodegas', 'codigo', items.map(b => b.codigo));
  }

  await logCarga(db, tipo, archivo, items.length, usuario);
  const result = { tipo, filas: items.length };
  if (tipo !== 'perfiles') result.enlazadas = (await relinkBodegas(db)).enlazadas;
  return result;
}

const like = (q) => `%${String(q || '').trim()}%`;

export async function searchPerfiles(db, q, limit = 20) {
  return db.prepare(
    `SELECT codigo, nombre FROM mantis_perfiles
     WHERE nombre LIKE ? OR CAST(codigo AS CHAR) = ?
     ORDER BY nombre LIMIT ?`
  ).all(like(q), String(q || '').trim(), limit);
}

/** Solo bodegas activas (las "P" pendientes e "I" inactivas no se ofrecen). */
export async function searchBodegas(db, q, limit = 20) {
  return db.prepare(
    `SELECT codigo, nombre, ciudad, comprobante FROM mantis_bodegas
     WHERE estado = 'A' AND (nombre LIKE ? OR ciudad LIKE ? OR CAST(codigo AS CHAR) = ?)
     ORDER BY nombre LIMIT ?`
  ).all(like(q), like(q), String(q || '').trim(), limit);
}

export async function getPerfil(db, codigo) {
  return db.prepare('SELECT codigo, nombre FROM mantis_perfiles WHERE codigo = ?').get(codigo);
}

export async function getBodega(db, codigo) {
  return db.prepare('SELECT codigo, nombre, ciudad, estado, comprobante FROM mantis_bodegas WHERE codigo = ?').get(codigo);
}

export async function getComprobante(db, codigo) {
  return db.prepare('SELECT codigo, nombre, estado FROM mantis_comprobantes WHERE codigo = ?').get(codigo);
}

/** Bodegas activas de dispensación que no quedaron enlazadas a un comprobante. */
export async function bodegasSinComprobante(db) {
  return db.prepare(
    `SELECT codigo, nombre, ciudad, centro_costo FROM mantis_bodegas
     WHERE estado = 'A' AND punto_dispensacion = 1 AND (comprobante IS NULL OR comprobante = '')
     ORDER BY nombre`
  ).all();
}

export async function setComprobanteManual(db, bodegaCodigo, comprobante) {
  const bodega = await getBodega(db, bodegaCodigo);
  if (!bodega) throw Object.assign(new Error('Bodega no encontrada.'), { code: 'NOT_FOUND' });
  const code = String(comprobante || '').trim().toUpperCase();
  if (!(await getComprobante(db, code))) {
    throw Object.assign(new Error(`El comprobante "${code}" no existe en el catálogo.`), { code: 'BAD_COMPROBANTE' });
  }
  await db.prepare(`UPDATE mantis_bodegas SET comprobante = ?, comprobante_origen = 'manual' WHERE codigo = ?`)
    .run(code, bodegaCodigo);
  return { codigo: bodegaCodigo, comprobante: code };
}

export async function catalogStatus(db) {
  const count = async (sql) => (await db.prepare(sql).get())?.n ?? 0;
  const ultima = async (tipo) => db.prepare(
    'SELECT archivo, filas, usuario, created_at FROM mantis_cargas WHERE tipo = ? ORDER BY id DESC LIMIT 1'
  ).get(tipo);
  return {
    perfiles:      { total: await count('SELECT COUNT(*) AS n FROM mantis_perfiles'),     ultima: await ultima('perfiles') },
    bodegas:       { total: await count(`SELECT COUNT(*) AS n FROM mantis_bodegas WHERE estado = 'A'`), ultima: await ultima('bodegas') },
    comprobantes:  { total: await count('SELECT COUNT(*) AS n FROM mantis_comprobantes'), ultima: await ultima('comprobantes') },
    sin_comprobante: (await bodegasSinComprobante(db)).length,
  };
}
