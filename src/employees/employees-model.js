import db from '../config/database.js';

// ─── Username / Password generation ─────────────────────────────────────────

export function generateUsername(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0]).join('');
  return initials + lastName;
}

export function generatePassword(cedula) {
  const s = String(cedula).replace(/\D/g, '');
  return s.length >= 4 ? s.slice(-4) : s.padStart(4, '0');
}

export function ensureUniqueUsername(base) {
  let name = base;
  let n = 2;
  while (db.prepare('SELECT id FROM employees WHERE usuario = ?').get(name)) {
    name = base + n++;
  }
  return name;
}

export function ensureUniquePassword(base) {
  let pw = base;
  let attempts = 0;
  while (db.prepare('SELECT id FROM employees WHERE contraseña = ?').get(pw) && attempts < 50) {
    pw = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
  }
  return pw;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

function _log(employeeId, userId, accion, campo = null) {
  try {
    db.prepare(`
      INSERT INTO employee_logs (employee_id, usuario_id, accion, campo_cambio, timestamp)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
    `).run(employeeId, userId ?? null, accion, campo);
  } catch { /* no bloquear operación principal si log falla */ }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getAllEmployees() {
  return db.prepare(`
    SELECT e.*, u.username AS created_by_name
    FROM employees e
    LEFT JOIN users u ON u.id = e.created_by
    ORDER BY e.id DESC
  `).all();
}

export function getEmployeeById(id) {
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(id)) ?? null;
}

export function getPendingCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM employees WHERE usuario IS NULL').get().n;
}

export function getCargos() {
  return db.prepare('SELECT id, nombre FROM employee_cargos ORDER BY nombre').all();
}

export function createCargo(nombre) {
  const normalized = nombre.trim();
  if (!normalized) throw Object.assign(new Error('Nombre requerido'), { code: 'MISSING_FIELDS' });
  const existing = db.prepare('SELECT id, nombre FROM employee_cargos WHERE nombre = ? COLLATE NOCASE').get(normalized);
  if (existing) return existing;
  const result = db.prepare('INSERT INTO employee_cargos (nombre) VALUES (?)').run(normalized);
  return { id: result.lastInsertRowid, nombre: normalized };
}

export function getAreas() {
  return db.prepare(
    `SELECT id, nombre, ciudad, tipo FROM puntos WHERE activo = 1 ORDER BY ciudad, nombre`
  ).all();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function createEmployee({ cedula, nombre_completo, cargo, area, created_by }) {
  if (!cedula || !nombre_completo || !cargo || !area) {
    throw Object.assign(new Error('Campos requeridos faltantes'), { code: 'MISSING_FIELDS' });
  }
  if (db.prepare('SELECT id FROM employees WHERE cedula = ?').get(cedula)) {
    throw Object.assign(new Error('Cédula ya registrada'), { code: 'CEDULA_EXISTS' });
  }
  const result = db.prepare(`
    INSERT INTO employees (cedula, nombre_completo, cargo, area, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(cedula, nombre_completo, cargo, area, created_by ?? null);

  _log(result.lastInsertRowid, created_by, 'create');
  return result.lastInsertRowid;
}

export function completeEmployee(id, fecha, userId) {
  const emp = getEmployeeById(id);
  if (!emp) throw Object.assign(new Error('Empleado no encontrado'), { code: 'NOT_FOUND' });
  if (!fecha) throw Object.assign(new Error('Fecha requerida'), { code: 'FECHA_REQUIRED' });

  const usuario   = ensureUniqueUsername(generateUsername(emp.nombre_completo));
  const contraseña = ensureUniquePassword(generatePassword(emp.cedula));

  db.prepare(`
    UPDATE employees
    SET usuario = ?, contraseña = ?, fecha_respuesta_soporte = ?,
        updated_by = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(usuario, contraseña, fecha, userId ?? null, Number(id));

  _log(id, userId, 'complete', `usuario=${usuario}`);
  return { usuario, contraseña };
}

export function updateEmployee(id, data, userId) {
  const allowed = ['nombre_completo', 'cargo', 'area'];
  const fields = [], vals = [];
  for (const k of allowed) {
    if (data[k] !== undefined) { fields.push(`${k} = ?`); vals.push(data[k]); }
  }
  if (!fields.length) return;

  vals.push(userId ?? null, Number(id));
  db.prepare(`
    UPDATE employees SET ${fields.join(', ')},
    updated_by = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(...vals);

  _log(id, userId, 'update', fields.join(','));
}

export function deleteEmployee(id, userId) {
  if (!getEmployeeById(id)) throw Object.assign(new Error('No encontrado'), { code: 'NOT_FOUND' });
  _log(id, userId, 'delete');
  db.prepare('DELETE FROM employee_logs WHERE employee_id = ?').run(Number(id));
  db.prepare('DELETE FROM employees WHERE id = ?').run(Number(id));
}
