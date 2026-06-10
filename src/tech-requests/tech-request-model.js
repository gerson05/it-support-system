/**
 * Modelo de datos para Requerimientos Tecnológicos e Incidencias.
 */

/** Genera el número correlativo: RQ-YYYYMMDD-001 / IN-YYYYMMDD-001 */
function generateNumber(db, type) {
  const prefix  = type === 'requerimiento' ? 'RQ' : 'IN';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like    = `${prefix}-${dateStr}-%`;
  const last    = db.prepare(
    'SELECT request_number FROM tech_requests WHERE request_number LIKE ? ORDER BY id DESC LIMIT 1'
  ).get(like);
  const next = last ? parseInt(last.request_number.split('-')[2]) + 1 : 1;
  return `${prefix}-${dateStr}-${String(next).padStart(3, '0')}`;
}

/** Crea una nueva solicitud y devuelve el objeto completo. */
export function createTechRequest(db, data) {
  const {
    type, requester_name, cedula, cargo, sede,
    description, quantity = 1,
    equipment_name = null, equipment_serial = null,
    priority = 'media', assigned_to = null,
    items = [],   // array de { equipment_name, quantity, serial } — solo requerimientos
  } = data;

  const request_number = generateNumber(db, type);

  // Para requerimientos con ítems, quantity = suma total de unidades
  const totalQty = (type === 'requerimiento' && Array.isArray(items) && items.length)
    ? items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0)
    : quantity;

  db.prepare(`
    INSERT INTO tech_requests
      (request_number, type, requester_name, cedula, cargo, sede,
       description, quantity, equipment_name, equipment_serial,
       priority, assigned_to)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    request_number, type, requester_name, cedula, cargo, sede,
    description, totalQty, equipment_name, equipment_serial,
    priority, assigned_to ?? null,
  );

  const { id } = db.prepare('SELECT last_insert_rowid() as id').get();

  // Insertar ítems para requerimientos
  if (type === 'requerimiento' && Array.isArray(items) && items.length > 0) {
    const stmt = db.prepare(
      'INSERT INTO tech_request_items (request_id, equipment_name, quantity, serial) VALUES (?,?,?,?)'
    );
    for (const item of items) {
      if (item.equipment_name?.trim()) {
        stmt.run(id, item.equipment_name.trim(), parseInt(item.quantity) || 1, item.serial?.trim() || null);
      }
    }
  }

  // Registrar en historial
  const itemsSummary = (type === 'requerimiento' && items.length > 0)
    ? ` — ${items.length} equipo(s): ${items.slice(0, 3).map(i => i.equipment_name).join(', ')}${items.length > 3 ? '…' : ''}`
    : '';

  db.prepare(`
    INSERT INTO tech_request_history (request_id, agent_name, action)
    VALUES (?, 'Sistema', ?)
  `).run(id, `Solicitud creada — Tipo: ${type}, Sede: ${sede}${itemsSummary}`);

  return { id, request_number };
}

/** Devuelve listado paginado con filtros. */
export function getAllTechRequests(db, filters = {}) {
  const {
    type, status, sede, priority, assigned_to, search,
    page = 1, limit = 15,
  } = filters;

  const where  = [];
  const params = [];

  if (type)        { where.push('r.type = ?');              params.push(type); }
  if (status)      { where.push('r.status = ?');            params.push(status); }
  if (sede)        { where.push('r.sede LIKE ?');           params.push(`%${sede}%`); }
  if (priority)    { where.push('r.priority = ?');          params.push(priority); }
  if (assigned_to) { where.push('r.assigned_to = ?');       params.push(assigned_to); }
  if (search) {
    where.push(`(
      r.request_number LIKE ? OR r.requester_name LIKE ? OR
      r.cedula LIKE ?        OR r.sede LIKE ?          OR
      r.description LIKE ?   OR r.equipment_name LIKE ?
    )`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset      = (page - 1) * limit;

  const rows = db.prepare(`
    SELECT r.*,
           a.name AS agent_name
    FROM   tech_requests r
    LEFT JOIN agents a ON r.assigned_to = a.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total FROM tech_requests r ${whereClause}
  `).get(...params);

  return {
    requests: rows,
    total,
    page:        parseInt(page),
    limit:       parseInt(limit),
    total_pages: Math.ceil(total / limit),
  };
}

/** Devuelve el detalle completo de una solicitud (con historial e ítems). */
export function getTechRequestById(db, id) {
  const req = db.prepare(`
    SELECT r.*, a.name AS agent_name
    FROM   tech_requests r
    LEFT JOIN agents a ON r.assigned_to = a.id
    WHERE  r.id = ?
  `).get(id);

  if (!req) return null;

  req.history = db.prepare(`
    SELECT * FROM tech_request_history
    WHERE request_id = ?
    ORDER BY created_at ASC
  `).all(id);

  // Ítems de equipos (requerimientos con múltiples equipos)
  req.items = db.prepare(
    'SELECT * FROM tech_request_items WHERE request_id = ? ORDER BY id ASC'
  ).all(id);

  return req;
}

/** Actualiza campos editables de una solicitud. */
export function updateTechRequest(db, id, data, agentName = 'IT') {
  const fields  = [];
  const params  = [];
  const changes = [];

  // Campos de gestión
  const managementFields = ['status', 'priority', 'assigned_to', 'resolution_notes'];
  for (const key of managementFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key] === '' ? null : data[key]);
      if (key === 'status')      changes.push(`Estado → ${data[key]}`);
      if (key === 'priority')    changes.push(`Prioridad → ${data[key]}`);
      if (key === 'assigned_to') changes.push(
        data[key] ? `Asignado a agente #${data[key]}` : 'Desasignado'
      );
    }
  }

  // Campos del solicitante / contenido (edición directa)
  const contentFields = [
    'requester_name', 'cedula', 'cargo', 'sede',
    'description', 'equipment_name', 'equipment_serial', 'quantity',
  ];
  let hasContentEdit = false;
  for (const key of contentFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key] === '' ? null : data[key]);
      hasContentEdit = true;
    }
  }
  if (hasContentEdit) {
    changes.push(`Datos del solicitante/solicitud editados por ${agentName}`);
  }

  if (!fields.length) return false;

  fields.push(`updated_at = datetime('now','localtime')`);

  if (data.status === 'completado') {
    fields.push(`completed_at = datetime('now','localtime')`);
  }

  const result = db.prepare(`
    UPDATE tech_requests SET ${fields.join(', ')} WHERE id = ?
  `).run(...params, id);

  if (result.changes && changes.length) {
    db.prepare(`
      INSERT INTO tech_request_history (request_id, agent_name, action)
      VALUES (?, ?, ?)
    `).run(id, agentName, changes.join(' | '));
  }

  return result.changes > 0;
}

/**
 * Reemplaza todos los ítems de un requerimiento.
 * Borra los existentes e inserta los nuevos en una transacción.
 */
export function replaceRequestItems(db, requestId, items = []) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM tech_request_items WHERE request_id = ?').run(requestId);
    const stmt = db.prepare(
      'INSERT INTO tech_request_items (request_id, equipment_name, quantity, serial) VALUES (?,?,?,?)'
    );
    let totalQty = 0;
    for (const item of items) {
      if (item.equipment_name?.trim()) {
        const qty = parseInt(item.quantity) || 1;
        stmt.run(requestId, item.equipment_name.trim(), qty, item.serial?.trim() || null);
        totalQty += qty;
      }
    }
    if (totalQty > 0) {
      db.prepare('UPDATE tech_requests SET quantity = ? WHERE id = ?').run(totalQty, requestId);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Agrega una nota interna al historial. */
export function addTechRequestNote(db, id, agentName, note) {
  db.prepare(`
    INSERT INTO tech_request_history (request_id, agent_name, action)
    VALUES (?, ?, ?)
  `).run(id, agentName, `📝 Nota: ${note}`);
  db.prepare(`UPDATE tech_requests SET updated_at = datetime('now','localtime') WHERE id = ?`).run(id);
  return true;
}

/** Elimina una solicitud y todos sus datos relacionados. */
export function deleteTechRequest(db, id) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM tech_request_history WHERE request_id = ?').run(id);
    db.prepare('DELETE FROM tech_request_items WHERE request_id = ?').run(id);
    const result = db.prepare('DELETE FROM tech_requests WHERE id = ?').run(id);
    db.exec('COMMIT');
    return result.changes > 0;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Estadísticas básicas para el dashboard del módulo. */
export function getTechRequestStats(db) {
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM tech_requests GROUP BY status
  `).all();

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count FROM tech_requests GROUP BY type
  `).all();

  const bySede = db.prepare(`
    SELECT sede, COUNT(*) as count FROM tech_requests GROUP BY sede ORDER BY count DESC LIMIT 10
  `).all();

  return { byStatus, byType, bySede };
}
