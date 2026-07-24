import db from '../config/database.js';

// ─── Username / Password generation ─────────────────────────────────────────

export async function generateUsername(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0]).join('');
  return initials + lastName;
}

export async function generatePassword(cedula) {
  const cleaned = String(cedula).replace(/\D/g, '');
  return cleaned.length >= 4 ? cleaned.slice(-4) : cleaned.padStart(4, '0');
}

export async function ensureUniqueUsername(base) {
  let name = base;
  let retries = 2;
  while (await db.prepare('SELECT id FROM employees WHERE usuario = ?').get(name)) {
    name = base + retries++;
  }
  return name;
}

export async function ensureUniquePassword(base) {
  let pw = base;
  let attempts = 0;
  while (await db.prepare('SELECT id FROM employees WHERE contraseña = ?').get(pw) && attempts < 50) {
    pw = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
  }
  return pw;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

function _log(employeeId, userId, accion, campo = null) {
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
  return (await db.prepare('SELECT COUNT(*) AS n FROM employees WHERE usuario IS NULL').get()).n;
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

export async function createEmployee({ cedula, nombre_completo, cargo, area, created_by }) {
  if (!cedula || !nombre_completo || !cargo || !area) {
    throw Object.assign(new Error('Campos requeridos faltantes'), { code: 'MISSING_FIELDS' });
  }
  if (await db.prepare('SELECT id FROM employees WHERE cedula = ?').get(cedula)) {
    throw Object.assign(new Error('Cédula ya registrada'), { code: 'CEDULA_EXISTS' });
  }
  const result = await db.prepare(`
    INSERT INTO employees (cedula, nombre_completo, cargo, area, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(cedula, nombre_completo, cargo, area, created_by ?? null);

  _log(result.lastInsertRowid, created_by, 'create');
  return result.lastInsertRowid;
}

export async function completeEmployee(id, fecha, userId) {
  const emp = getEmployeeById(id);
  if (!emp) throw Object.assign(new Error('Empleado no encontrado'), { code: 'NOT_FOUND' });
  if (!fecha) throw Object.assign(new Error('Fecha requerida'), { code: 'FECHA_REQUIRED' });

  const usuario   = ensureUniqueUsername(generateUsername(emp.nombre_completo));
  const contraseña = ensureUniquePassword(generatePassword(emp.cedula));

  await db.prepare(`
    UPDATE employees
    SET usuario = ?, contraseña = ?, fecha_respuesta_soporte = ?,
        updated_by = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(usuario, contraseña, fecha, userId ?? null, Number(id));

  _log(id, userId, 'complete', `usuario=${usuario}`);
  return { usuario, contraseña };
}

export async function updateEmployee(id, data, userId) {
  const allowed = ['nombre_completo', 'cargo', 'area'];
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
  if (!getEmployeeById(id)) throw Object.assign(new Error('No encontrado'), { code: 'NOT_FOUND' });
  _log(id, userId, 'delete');
  await db.prepare('DELETE FROM employee_logs WHERE employee_id = ?').run(Number(id));
  await db.prepare('DELETE FROM employees WHERE id = ?').run(Number(id));
}
