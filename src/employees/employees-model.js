import db from '../config/database.js';
import {
  suggestUsername as _suggestUsername, suggestPassword as _suggestPassword,
  isValidUsername, isValidPassword,
} from './credentials.js';
import { getPerfil, getBodega, getComprobante } from '../mantis/catalog-model.js';

// ─── Usuario / clave (regla en credentials.js) ──────────────────────────────

const usernameTaken = async (u, exceptId = null) =>
  Boolean(await db.prepare('SELECT id FROM employees WHERE UPPER(usuario) = ? AND id <> ?').get(String(u).toUpperCase(), exceptId ?? -1));

const passwordTaken = async (p, exceptId = null) =>
  Boolean(await db.prepare('SELECT id FROM employees WHERE contraseña = ? AND id <> ?').get(String(p), exceptId ?? -1));

export const suggestUsername = (fullName) => _suggestUsername(fullName, (u) => usernameTaken(u));
export const suggestPassword = () => _suggestPassword((p) => passwordTaken(p));

const fail = (message, code) => { throw Object.assign(new Error(message), { code }); };

/**
 * Resuelve perfil, sede (bodega) y comprobante contra los catálogos de Mantis.
 * Devuelve las columnas listas para guardar en employees.
 */
async function resolveMantisFields({ perfil_codigo, bodega_codigo, comprobante }) {
  const perfil = await getPerfil(db, Number(perfil_codigo));
  if (!perfil) fail('Selecciona un cargo de la lista.', 'BAD_PERFIL');
  const bodega = await getBodega(db, Number(bodega_codigo));
  if (!bodega || bodega.estado !== 'A') fail('Selecciona una sede activa de la lista.', 'BAD_BODEGA');

  const comp = String(comprobante || bodega.comprobante || '').trim().toUpperCase();
  if (!comp) fail('Esta sede no tiene comprobante asignado. Escríbelo o asígnalo en "Catálogos Mantis".', 'NO_COMPROBANTE');
  if (!(await getComprobante(db, comp))) fail(`El comprobante "${comp}" no existe en el catálogo.`, 'BAD_COMPROBANTE');

  return {
    cargo:         perfil.nombre,
    perfil_codigo: perfil.codigo,
    area:          bodega.nombre,
    sede:          bodega.nombre,
    bodega_codigo: bodega.codigo,
    comprobante:   comp,
  };
}

// ─── Audit ───────────────────────────────────────────────────────────────────

async function _log(employeeId, userId, accion, campo = null) {
  try {
    await db.prepare(`
      INSERT INTO employee_logs (employee_id, usuario_id, accion, campo_cambio, timestamp)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
    `).run(employeeId, userId ?? null, accion, campo);
  } catch { /* no bloquear operación principal si log falla */ }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAllEmployees() {
  return await db.prepare(`
    SELECT e.*, u.username AS created_by_name
    FROM employees e
    LEFT JOIN users u ON u.id = e.created_by
    ORDER BY e.id DESC
  `).all();
}

export async function getEmployeeById(id) {
  return await db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(id)) ?? null;
}

export async function getPendingCount() {
  return (await db.prepare(
    `SELECT COUNT(*) AS n FROM employees
     WHERE usuario IS NULL OR (mantis_estado IS NOT NULL AND mantis_estado <> 'creado')`
  ).get()).n;
}

export async function getCargos() {
  return await db.prepare('SELECT id, nombre FROM employee_cargos ORDER BY nombre').all();
}

export async function createCargo(nombre) {
  const normalized = nombre.trim();
  if (!normalized) throw Object.assign(new Error('Nombre requerido'), { code: 'MISSING_FIELDS' });
  const existing = await db.prepare('SELECT id, nombre FROM employee_cargos WHERE nombre = ? COLLATE NOCASE').get(normalized);
  if (existing) return existing;
  const result = await db.prepare('INSERT INTO employee_cargos (nombre) VALUES (?)').run(normalized);
  return { id: result.lastInsertRowid, nombre: normalized };
}

export async function getAreas() {
  return await db.prepare(
    `SELECT id, nombre, ciudad, tipo FROM puntos WHERE activo = 1 ORDER BY ciudad, nombre`
  ).all();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Valida un usuario/clave escrito a mano, o genera uno si viene vacío. */
async function resolveCredentials({ nombre_completo, usuario, contraseña }, exceptId = null) {
  let u = String(usuario || '').trim().toUpperCase();
  if (u) {
    if (!isValidUsername(u)) fail('El usuario solo puede tener letras (y hasta 3 números al final).', 'BAD_USERNAME');
    if (await usernameTaken(u, exceptId)) fail(`El usuario ${u} ya existe.`, 'USERNAME_TAKEN');
  } else {
    u = await suggestUsername(nombre_completo);
  }

  let p = String(contraseña || '').trim();
  if (p) {
    if (!isValidPassword(p)) fail('La clave debe tener exactamente 4 dígitos.', 'BAD_PASSWORD');
    if (await passwordTaken(p, exceptId)) fail('Esa clave ya la tiene otro usuario.', 'PASSWORD_TAKEN');
  } else {
    p = await suggestPassword();
  }
  return { usuario: u, contraseña: p };
}

/**
 * Crea un empleado.
 * - Con perfil_codigo + bodega_codigo (flujo Mantis): usuario y clave quedan generados de una vez
 *   y el empleado queda "pendiente" de crearse en Mantis.
 * - Sin ellos (flujo anterior): queda pendiente de que IT genere las credenciales.
 * Devuelve { id, usuario?, contraseña? }.
 */
export async function createEmployee({ cedula, nombre_completo, cargo, area, created_by,
  usuario, contraseña, perfil_codigo, bodega_codigo, comprobante }) {
  const mantis = perfil_codigo !== undefined && perfil_codigo !== null && perfil_codigo !== '';
  if (!cedula || !nombre_completo || (!mantis && (!cargo || !area))) fail('Campos requeridos faltantes', 'MISSING_FIELDS');
  if (await db.prepare('SELECT id FROM employees WHERE cedula = ?').get(cedula)) fail('Cédula ya registrada', 'CEDULA_EXISTS');

  if (!mantis) {
    const result = await db.prepare(`
      INSERT INTO employees (cedula, nombre_completo, cargo, area, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(cedula, nombre_completo, cargo, area, created_by ?? null);
    await _log(result.lastInsertRowid, created_by, 'create');
    return { id: result.lastInsertRowid };
  }

  const f     = await resolveMantisFields({ perfil_codigo, bodega_codigo, comprobante });
  const creds = await resolveCredentials({ nombre_completo, usuario, contraseña });

  const result = await db.prepare(`
    INSERT INTO employees (cedula, nombre_completo, cargo, area, created_by,
                           usuario, contraseña, perfil_codigo, bodega_codigo, sede, comprobante, mantis_estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
  `).run(cedula, nombre_completo, f.cargo, f.area, created_by ?? null,
    creds.usuario, creds.contraseña, f.perfil_codigo, f.bodega_codigo, f.sede, f.comprobante);

  await _log(result.lastInsertRowid, created_by, 'create', `usuario=${creds.usuario}`);
  return { id: result.lastInsertRowid, ...creds };
}

/**
 * Cierra la gestión de un empleado.
 * - Flujo Mantis (ya tiene usuario): lo marca como creado en Mantis.
 * - Flujo anterior: genera usuario y clave.
 */
export async function completeEmployee(id, fecha, userId) {
  const emp = await getEmployeeById(id);
  if (!emp) fail('Empleado no encontrado', 'NOT_FOUND');
  if (!fecha) fail('Fecha requerida', 'FECHA_REQUIRED');

  if (emp.usuario && emp.mantis_estado) {
    await db.prepare(`
      UPDATE employees
      SET fecha_respuesta_soporte = ?, mantis_estado = 'creado', mantis_error = NULL,
          mantis_creado_at = datetime('now','localtime'),
          updated_by = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(fecha, userId ?? null, Number(id));
    await _log(id, userId, 'complete', 'mantis=creado');
    return { usuario: emp.usuario, contraseña: emp.contraseña };
  }

  const { usuario, contraseña } = await resolveCredentials({ nombre_completo: emp.nombre_completo }, Number(id));
  await db.prepare(`
    UPDATE employees
    SET usuario = ?, contraseña = ?, fecha_respuesta_soporte = ?,
        updated_by = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(usuario, contraseña, fecha, userId ?? null, Number(id));

  await _log(id, userId, 'complete', `usuario=${usuario}`);
  return { usuario, contraseña };
}

/** Registra el resultado de enviar el empleado a Mantis por API. */
export async function setMantisResult(id, { ok, error = null }) {
  await db.prepare(`
    UPDATE employees
    SET mantis_estado = ?, mantis_error = ?,
        mantis_creado_at = CASE WHEN ? = 1 THEN datetime('now','localtime') ELSE mantis_creado_at END
    WHERE id = ?
  `).run(ok ? 'creado' : 'error', ok ? null : String(error || '').slice(0, 500), ok ? 1 : 0, Number(id));
}

export async function updateEmployee(id, data, userId) {
  data = { ...data };
  const emp = await getEmployeeById(id);
  if (!emp?.mantis_estado) {
    // Empleados del flujo anterior: solo datos básicos (las credenciales las genera "Completar")
    for (const k of ['perfil_codigo', 'bodega_codigo', 'sede', 'comprobante', 'usuario', 'contraseña']) delete data[k];
  }
  if (emp?.mantis_estado &&(data.perfil_codigo || data.bodega_codigo || data.comprobante !== undefined)) {
    const f = await resolveMantisFields({
      perfil_codigo: data.perfil_codigo ?? emp.perfil_codigo,
      bodega_codigo: data.bodega_codigo ?? emp.bodega_codigo,
      comprobante:   data.comprobante ?? (data.bodega_codigo ? null : emp.comprobante),
    });
    Object.assign(data, f);
  }
  if (emp?.mantis_estado && (data.usuario !== undefined || data.contraseña !== undefined)) {
    const creds = await resolveCredentials({
      nombre_completo: data.nombre_completo ?? emp.nombre_completo,
      usuario:         data.usuario ?? emp.usuario,
      contraseña:      data.contraseña ?? emp.contraseña,
    }, Number(id));
    Object.assign(data, creds);
  }

  const allowed = ['nombre_completo', 'cargo', 'area',
    'perfil_codigo', 'bodega_codigo', 'sede', 'comprobante', 'usuario', 'contraseña'];
  const fields = [], vals = [];
  for (const k of allowed) {
    if (data[k] !== undefined) { fields.push(`${k} = ?`); vals.push(data[k]); }
  }
  if (!fields.length) return;

  vals.push(userId ?? null, Number(id));
  await db.prepare(`
    UPDATE employees SET ${fields.join(', ')},
    updated_by = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(...vals);

  _log(id, userId, 'update', fields.join(','));
}

export async function deleteEmployee(id, userId) {
  if (!(await getEmployeeById(id))) fail('No encontrado', 'NOT_FOUND');
  await _log(id, userId, 'delete');
  await db.prepare('DELETE FROM employee_logs WHERE employee_id = ?').run(Number(id));
  await db.prepare('DELETE FROM employees WHERE id = ?').run(Number(id));
}
