/**
 * Datos de personal (hr_empleados) y apoyo del módulo de certificados.
 * Cada carga actualiza solo los campos que trae el archivo; varios archivos se
 * complementan por cédula. SQL portable SQLite/MariaDB (sin upsert nativo).
 */

const COLUMNAS = ['nombre', 'genero', 'cargo', 'tipo_contrato', 'contrato',
  'fecha_ingreso', 'fecha_retiro', 'estado', 'salario'];
const LOTE = 300;

/**
 * Guarda los registros de una carga.
 * @param {Map<string, object>} registros  ver personal-import.construirRegistros
 * @returns {{ creados, actualizados }}
 */
export async function importarRegistros(db, registros, { archivo, usuario, campos = [] } = {}) {
  const existentes = new Map(
    (await db.prepare('SELECT cedula, es_empleado FROM hr_empleados').all()).map(r => [r.cedula, r])
  );
  const nuevos = [];
  let actualizados = 0;
  const fuente = String(archivo || 'carga').slice(0, 255);

  for (const rec of registros.values()) {
    const prev = existentes.get(rec.cedula);
    if (!prev) { nuevos.push(rec); continue; }

    const cols = COLUMNAS.filter(c => rec[c] !== undefined);
    if (!cols.length && !(rec.es_empleado && !prev.es_empleado)) continue;
    await db.prepare(
      `UPDATE hr_empleados SET ${cols.map(c => `${c} = ?, `).join('')}
       es_empleado = ?, fuente = ?, updated_at = datetime('now','localtime') WHERE cedula = ?`
    ).run(...cols.map(c => rec[c]), Math.max(prev.es_empleado || 0, rec.es_empleado || 0), fuente, rec.cedula);
    actualizados++;
  }

  const insertCols = ['cedula', ...COLUMNAS, 'es_empleado', 'fuente'];
  for (let i = 0; i < nuevos.length; i += LOTE) {
    const lote = nuevos.slice(i, i + LOTE);
    const valores = lote.flatMap(r => insertCols.map(c =>
      c === 'fuente' ? fuente : c === 'es_empleado' ? (r.es_empleado || 0) : (r[c] ?? null)));
    await db.prepare(
      `INSERT INTO hr_empleados (${insertCols.join(', ')}) VALUES ${lote.map(() => `(${insertCols.map(() => '?').join(', ')})`).join(', ')}`
    ).run(...valores);
  }

  await db.prepare(
    'INSERT INTO hr_cargas (archivo, filas, creados, actualizados, campos, usuario) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(fuente, registros.size, nuevos.length, actualizados, campos.join(','), usuario || null);

  return { creados: nuevos.length, actualizados };
}

/**
 * Alta desde "Crear usuarios": registra a la persona como empleada activa si aún no
 * existe. Si ya viene de los Excel de Gestión Humana no se toca (esos datos mandan).
 */
export async function registrarAlta(db, { cedula, nombre, cargo }) {
  const prev = await db.prepare('SELECT cedula, es_empleado FROM hr_empleados WHERE cedula = ?').get(cedula);
  if (prev?.es_empleado) return false;
  if (prev) {
    await db.prepare(
      `UPDATE hr_empleados SET nombre = COALESCE(nombre, ?), cargo = COALESCE(cargo, ?), estado = 'A',
       es_empleado = 1, fuente = 'Crear usuarios', updated_at = datetime('now','localtime') WHERE cedula = ?`
    ).run(nombre, cargo, cedula);
  } else {
    await db.prepare(
      `INSERT INTO hr_empleados (cedula, nombre, cargo, estado, es_empleado, fuente) VALUES (?, ?, ?, 'A', 1, 'Crear usuarios')`
    ).run(cedula, nombre, cargo);
  }
  return true;
}

export async function buscarEmpleados(db, q, limit = 15) {
  const t = String(q || '').trim();
  if (!t) return [];
  return db.prepare(
    `SELECT cedula, nombre, cargo, estado FROM hr_empleados
     WHERE es_empleado = 1 AND (cedula LIKE ? OR nombre LIKE ?)
     ORDER BY nombre LIMIT ?`
  ).all(`${t}%`, `%${t}%`, limit);
}

export async function getEmpleado(db, cedula) {
  return db.prepare('SELECT * FROM hr_empleados WHERE cedula = ? AND es_empleado = 1').get(cedula);
}

/** Correcciones manuales desde la vista previa del certificado. */
export async function actualizarEmpleado(db, cedula, datos) {
  if (!(await getEmpleado(db, cedula))) return false;
  const cols = COLUMNAS.filter(c => datos[c] !== undefined);
  if (!cols.length) return true;
  await db.prepare(
    `UPDATE hr_empleados SET ${cols.map(c => `${c} = ?`).join(', ')}, fuente = 'Corrección manual',
     updated_at = datetime('now','localtime') WHERE cedula = ? AND es_empleado = 1`
  ).run(...cols.map(c => datos[c]), cedula);
  return true;
}

export async function resumenPersonal(db) {
  const n = async (sql) => (await db.prepare(sql).get())?.n ?? 0;
  return {
    empleados: await n('SELECT COUNT(*) AS n FROM hr_empleados WHERE es_empleado = 1'),
    activos:   await n(`SELECT COUNT(*) AS n FROM hr_empleados WHERE es_empleado = 1 AND estado = 'A'`),
    retirados: await n(`SELECT COUNT(*) AS n FROM hr_empleados WHERE es_empleado = 1 AND estado = 'I'`),
    con_genero: await n('SELECT COUNT(*) AS n FROM hr_empleados WHERE es_empleado = 1 AND genero IS NOT NULL'),
    cargas: await db.prepare(
      'SELECT archivo, filas, creados, actualizados, campos, usuario, created_at FROM hr_cargas ORDER BY id DESC LIMIT 30'
    ).all(),
  };
}

// ── Mapeos recordados ─────────────────────────────────────────────────────

export async function getMapeo(db, firma) {
  const row = await db.prepare('SELECT mapeo FROM hr_mapeos WHERE firma = ?').get(firma);
  if (!row) return null;
  try { return JSON.parse(row.mapeo); } catch { return null; }
}

export async function guardarMapeo(db, firma, mapeo) {
  const json = JSON.stringify(mapeo);
  if (await db.prepare('SELECT firma FROM hr_mapeos WHERE firma = ?').get(firma)) {
    await db.prepare(`UPDATE hr_mapeos SET mapeo = ?, updated_at = datetime('now','localtime') WHERE firma = ?`).run(json, firma);
  } else {
    await db.prepare('INSERT INTO hr_mapeos (firma, mapeo) VALUES (?, ?)').run(firma, json);
  }
}

// ── Configuración (salario mínimo, auxilio de transporte) ──────────────────

export const CONFIG_DEFAULT = { auxilio_transporte: '249095', salario_minimo: '', vigencia: '' };
/** Quién y cuándo cambió los valores (los pone el servidor, no el formulario). */
const CONFIG_META = ['actualizado_por', 'actualizado_at'];

export async function getConfig(db) {
  const rows = await db.prepare('SELECT clave, valor FROM hr_config').all();
  return { ...CONFIG_DEFAULT, ...Object.fromEntries(rows.map(r => [r.clave, r.valor])) };
}

export async function setConfig(db, datos, meta = {}) {
  const valores = [
    ...Object.keys(CONFIG_DEFAULT).filter(c => datos[c] !== undefined).map(c => [c, String(datos[c] ?? '').replace(/\D/g, '')]),
    ...CONFIG_META.filter(c => meta[c] !== undefined).map(c => [c, String(meta[c] ?? '').slice(0, 255)]),
  ];
  for (const [clave, valor] of valores) {
    if (await db.prepare('SELECT clave FROM hr_config WHERE clave = ?').get(clave)) {
      await db.prepare('UPDATE hr_config SET valor = ? WHERE clave = ?').run(valor, clave);
    } else {
      await db.prepare('INSERT INTO hr_config (clave, valor) VALUES (?, ?)').run(clave, valor);
    }
  }
  return getConfig(db);
}

// ── Plantilla del certificado ──────────────────────────────────────────────

export async function getPlantilla(db, tipo = 'certificado_laboral') {
  const row = await db.prepare('SELECT archivo, contenido, usuario, updated_at FROM hr_plantillas WHERE tipo = ?').get(tipo);
  return row ? { ...row, buffer: Buffer.from(row.contenido, 'base64') } : null;
}

export async function guardarPlantilla(db, buffer, { archivo, usuario, tipo = 'certificado_laboral' }) {
  const contenido = buffer.toString('base64');
  if (await db.prepare('SELECT tipo FROM hr_plantillas WHERE tipo = ?').get(tipo)) {
    await db.prepare(
      `UPDATE hr_plantillas SET archivo = ?, contenido = ?, usuario = ?, updated_at = datetime('now','localtime') WHERE tipo = ?`
    ).run(archivo, contenido, usuario || null, tipo);
  } else {
    await db.prepare('INSERT INTO hr_plantillas (tipo, archivo, contenido, usuario) VALUES (?, ?, ?, ?)')
      .run(tipo, archivo, contenido, usuario || null);
  }
}

export async function registrarCertificado(db, { cedula, nombre, tipo, usuario }) {
  await db.prepare('INSERT INTO hr_certificados (cedula, nombre, tipo, usuario) VALUES (?, ?, ?, ?)')
    .run(cedula, nombre, tipo, usuario || null);
}

export async function ultimosCertificados(db, limit = 50) {
  return db.prepare('SELECT cedula, nombre, tipo, usuario, created_at FROM hr_certificados ORDER BY id DESC LIMIT ?').all(limit);
}
