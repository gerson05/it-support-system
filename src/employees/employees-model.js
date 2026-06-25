/**
 * Modelo de datos y queries SQLite para la gestión de empleados.
 * Incluye auto-generación de username/password y auditoría de cambios.
 */

/**
 * Generar usuario a partir del nombre completo
 * Extrae iniciales de todos los nombres excepto el último (apellido),
 * combina con el apellido.
 * Ejemplo: Kelly Johana Raigoza Herrera -> KJ + Raigoza -> KJRAIGOZA
 */
export function generateUsername(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';

  const parts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return '';

  // Último elemento es el apellido
  const lastName = parts[parts.length - 1];

  // Extraer iniciales de todos menos el último
  const initials = parts.slice(0, -1)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  return (initials + lastName).toUpperCase();
}

/**
 * Generar contraseña a partir de la cédula
 * Toma los últimos 4 dígitos, formateados a 4 caracteres
 * Ejemplo: 1130658563 -> 8563
 */
export function generatePassword(cedula) {
  if (!cedula) return '';

  const cedStr = String(cedula).replace(/\D/g, '');
  if (cedStr.length < 4) return cedStr.padStart(4, '0');

  return cedStr.slice(-4);
}

/**
 * Asegurar usuario único - si existe, agregar contador
 * KJRAIGOZA -> KJRAIGOZA2, KJRAIGOZA3, etc.
 */
export function ensureUniqueUsername(db, baseUsername) {
  let username = baseUsername;
  let counter = 2;

  const checkStmt = db.prepare('SELECT COUNT(*) as cnt FROM employees WHERE usuario = ?');

  while (checkStmt.get(username).cnt > 0) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
}

/**
 * Asegurar contraseña única - si existe, generar aleatorio
 */
export function ensureUniquePassword(db, basePassword) {
  const checkStmt = db.prepare('SELECT COUNT(*) as cnt FROM employees WHERE contraseña = ?');

  if (checkStmt.get(basePassword).cnt === 0) {
    return basePassword;
  }

  // Generar contraseña aleatorio de 4-6 dígitos
  let password;
  let attempts = 0;
  do {
    const length = Math.floor(Math.random() * 3) + 4; // 4-6
    password = Math.floor(Math.random() * Math.pow(10, length))
      .toString()
      .padStart(length, '0');
    attempts++;
  } while (checkStmt.get(password).cnt > 0 && attempts < 100);

  return password;
}

/**
 * Registrar cambio en employee_logs
 */
export function logChange(db, employeeId, action, details = '') {
  const stmt = db.prepare(`
    INSERT INTO employee_logs (employee_id, accion, campo_cambio, timestamp)
    VALUES (?, ?, ?, datetime('now','localtime'))
  `);

  stmt.run(employeeId, action, details);
}

/**
 * Obtener todos los empleados
 */
export function getAllEmployees(db, filters = {}) {
  const { search, area, cargo, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM employees WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (nombre_completo LIKE ? OR cedula LIKE ? OR usuario LIKE ?)';
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  if (area) {
    query += ' AND area = ?';
    params.push(area);
  }

  if (cargo) {
    query += ' AND cargo = ?';
    params.push(cargo);
  }

  const countQuery = query.replace(/SELECT \*/, 'SELECT COUNT(*) as total');
  const countParams = [...params];

  query += ' ORDER BY nombre_completo ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;
    const employees = db.prepare(query).all(...params);

    return {
      total,
      page,
      limit,
      data: employees
    };
  } catch (err) {
    console.error('[EMPLOYEES] Error en getAllEmployees:', err.message);
    return { total: 0, page, limit, data: [] };
  }
}

/**
 * Obtener empleado por ID
 */
export function getEmployeeById(db, id) {
  try {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (employee) {
      const logs = db.prepare('SELECT * FROM employee_logs WHERE employee_id = ? ORDER BY logged_at DESC')
        .all(id);
      return { ...employee, logs };
    }
    return null;
  } catch (err) {
    console.error('[EMPLOYEES] Error en getEmployeeById:', err.message);
    return null;
  }
}

/**
 * Crear empleado con auto-generación de credenciales
 */
export function createEmployee(db, employeeData) {
  try {
    const {
      nombre_completo,
      cedula,
      cargo,
      area
    } = employeeData;

    if (!nombre_completo || !cedula || !cargo || !area) {
      throw new Error('Campos requeridos: nombre_completo, cedula, cargo, area');
    }

    // Auto-generar credenciales
    let usuario = generateUsername(nombre_completo);
    usuario = ensureUniqueUsername(db, usuario);

    let contraseña = generatePassword(cedula);
    contraseña = ensureUniquePassword(db, contraseña);

    const stmt = db.prepare(`
      INSERT INTO employees (
        cedula, nombre_completo, cargo, area, usuario, contraseña,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `);

    const result = stmt.run(
      cedula, nombre_completo, cargo, area, usuario, contraseña
    );

    logChange(db, result.lastInsertRowid, 'CREATE', `Usuario: ${usuario}`);

    return {
      id: result.lastInsertRowid,
      usuario,
      contraseña,
      ...employeeData
    };
  } catch (err) {
    console.error('[EMPLOYEES] Error en createEmployee:', err.message);
    throw err;
  }
}

/**
 * Completar datos de empleado parcialmente creado
 */
export function completeEmployee(db, id, updateData) {
  try {
    const employee = getEmployeeById(db, id);
    if (!employee) throw new Error('Empleado no encontrado');

    const fields = [];
    const values = [];

    const updatable = [
      'nombre_completo', 'cedula', 'area', 'cargo', 'fecha_respuesta_soporte'
    ];

    for (const field of updatable) {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }

    if (fields.length === 0) return employee;

    values.push(id);
    const query = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    logChange(db, id, 'COMPLETE', JSON.stringify(updateData));

    return getEmployeeById(db, id);
  } catch (err) {
    console.error('[EMPLOYEES] Error en completeEmployee:', err.message);
    throw err;
  }
}

/**
 * Actualizar empleado
 */
export function updateEmployee(db, id, updateData) {
  try {
    const employee = getEmployeeById(db, id);
    if (!employee) throw new Error('Empleado no encontrado');

    const fields = [];
    const values = [];

    const updatable = [
      'nombre_completo', 'cedula', 'area', 'cargo', 'fecha_respuesta_soporte'
    ];

    for (const field of updatable) {
      if (updateData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }

    if (fields.length === 0) return employee;

    values.push(id);
    const query = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    logChange(db, id, 'UPDATE', JSON.stringify(updateData));

    return getEmployeeById(db, id);
  } catch (err) {
    console.error('[EMPLOYEES] Error en updateEmployee:', err.message);
    throw err;
  }
}

/**
 * Eliminar empleado (soft delete)
 */
export function deleteEmployee(db, id) {
  try {
    const employee = getEmployeeById(db, id);
    if (!employee) throw new Error('Empleado no encontrado');

    db.prepare('UPDATE employees SET activo = 0 WHERE id = ?').run(id);
    logChange(db, id, 'DELETE', 'Marcado como inactivo');

    return { success: true, id };
  } catch (err) {
    console.error('[EMPLOYEES] Error en deleteEmployee:', err.message);
    throw err;
  }
}

/**
 * Obtener lista de cargos disponibles
 */
export function getCargos(db) {
  try {
    return db.prepare('SELECT nombre FROM employee_cargos ORDER BY nombre')
      .all()
      .map(row => row.nombre);
  } catch (err) {
    console.error('[EMPLOYEES] Error en getCargos:', err.message);
    return [];
  }
}

/**
 * Obtener lista de áreas disponibles
 */
export function getAreas(db) {
  try {
    return db.prepare('SELECT nombre FROM employee_areas ORDER BY nombre')
      .all()
      .map(row => row.nombre);
  } catch (err) {
    console.error('[EMPLOYEES] Error en getAreas:', err.message);
    return [];
  }
}
