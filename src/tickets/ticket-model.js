/**
 * Modelo de datos y queries SQLite para la gestión de tickets de IT.
 */

// Mapeo de nombres legibles para las áreas
const AREA_LABELS = {
  'cartera': 'Cartera',
  'compra': 'Compra',
  'gestion_humana': 'Gestión Humana',
  'pqrs': 'PQRS',
  'contabilidad': 'Contabilidad',
  'farmacia': 'Farmacia',
  'cuentas_medicas': 'Cuentas Médicas',
  'general': 'General / IT'
};

/**
 * Obtener todos los tickets aplicando filtros y paginación
 */
export function getAllTickets(db, filters = {}) {
  const {
    status,
    priority,
    area,
    assigned_to,
    search,
    page = 1,
    limit = 10
  } = filters;

  const offset = (page - 1) * limit;
  let query = 'SELECT t.*, a.name as agent_name FROM tickets t LEFT JOIN agents a ON t.assigned_to = a.id WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM tickets t WHERE 1=1';
  const params = [];
  const countParams = [];

  if (status) {
    query += ' AND t.status = ?';
    countQuery += ' AND t.status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (priority) {
    query += ' AND t.priority = ?';
    countQuery += ' AND t.priority = ?';
    params.push(priority);
    countParams.push(priority);
  }

  if (area) {
    query += ' AND t.area = ?';
    countQuery += ' AND t.area = ?';
    params.push(area);
    countParams.push(area);
  }

  if (assigned_to !== undefined && assigned_to !== '') {
    if (assigned_to === 'null' || assigned_to === null) {
      query += ' AND t.assigned_to IS NULL';
      countQuery += ' AND t.assigned_to IS NULL';
    } else {
      query += ' AND t.assigned_to = ?';
      countQuery += ' AND t.assigned_to = ?';
      params.push(parseInt(assigned_to));
      countParams.push(parseInt(assigned_to));
    }
  }

  if (search) {
    const searchPattern = `%${search}%`;
    query += ' AND (t.ticket_number LIKE ? OR t.description LIKE ? OR t.phone LIKE ? OR t.requester_name LIKE ?)';
    countQuery += ' AND (t.ticket_number LIKE ? OR t.description LIKE ? OR t.phone LIKE ? OR t.requester_name LIKE ?)';
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  // Ordenar por fecha de actualización (más recientes primero)
  query += ' ORDER BY t.updated_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  try {
    const totalRow = db.prepare(countQuery).get(...countParams);
    const total = totalRow ? totalRow.total : 0;
    
    const tickets = db.prepare(query).all(...params);
    
    // Formatear nombres de áreas legibles
    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      area_label: AREA_LABELS[ticket.area] || ticket.area
    }));

    return {
      tickets: formattedTickets,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('Error en getAllTickets:', error);
    throw error;
  }
}

/**
 * Obtener un ticket por ID con su conversación completa y notas
 */
export function getTicketById(db, id) {
  try {
    const ticket = db.prepare(`
      SELECT t.*, a.name as agent_name 
      FROM tickets t 
      LEFT JOIN agents a ON t.assigned_to = a.id 
      WHERE t.id = ?
    `).get(id);

    if (!ticket) return null;

    ticket.area_label = AREA_LABELS[ticket.area] || ticket.area;

    // Obtener los mensajes del ticket (historial del chat)
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE ticket_id = ? 
      ORDER BY created_at ASC
    `).all(id);

    // Obtener notas internas
    const notes = db.prepare(`
      SELECT * FROM internal_notes 
      WHERE ticket_id = ? 
      ORDER BY created_at ASC
    `).all(id);

    return {
      ...ticket,
      messages,
      notes
    };
  } catch (error) {
    console.error('Error en getTicketById:', error);
    throw error;
  }
}

/**
 * Actualizar campos del ticket (estado, prioridad, agente asignado)
 */
export function updateTicket(db, id, data) {
  const fields = [];
  const params = [];

  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);
    
    // Si pasa a resuelto, guardamos la fecha de resolución
    if (data.status === 'resuelto') {
      fields.push('resolved_at = datetime(\'now\', \'localtime\')');
    } else {
      fields.push('resolved_at = NULL');
    }
  }

  if (data.priority !== undefined) {
    fields.push('priority = ?');
    params.push(data.priority);
  }

  if (data.assigned_to !== undefined) {
    fields.push('assigned_to = ?');
    params.push(data.assigned_to === '' || data.assigned_to === null ? null : parseInt(data.assigned_to));
  }

  if (data.requester_name !== undefined) {
    fields.push('requester_name = ?');
    params.push(data.requester_name);
  }

  if (data.category !== undefined) {
    fields.push('category = ?');
    params.push(data.category);
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = datetime(\'now\', \'localtime\')');
  params.push(id);

  const query = `UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`;

  try {
    const result = db.prepare(query).run(...params);
    return result.changes > 0;
  } catch (error) {
    console.error('Error en updateTicket:', error);
    throw error;
  }
}

/**
 * Agregar un nuevo mensaje al historial de un ticket
 */
export function addMessage(db, ticketId, senderType, senderName, content) {
  try {
    const result = db.prepare(`
      INSERT INTO messages (ticket_id, sender_type, sender_name, content)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, senderType, senderName, content);

    // Actualizar la fecha de modificación del ticket
    db.prepare(`
      UPDATE tickets 
      SET updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(ticketId);

    return result.changes > 0;
  } catch (error) {
    console.error('Error en addMessage:', error);
    throw error;
  }
}

/**
 * Agregar una nota interna de IT para uso del equipo
 */
export function addInternalNote(db, ticketId, agentId, agentName, content) {
  try {
    const result = db.prepare(`
      INSERT INTO internal_notes (ticket_id, agent_id, agent_name, content)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, agentId, agentName, content);

    // Actualizar la fecha de modificación del ticket sin cambiar el estado
    db.prepare(`
      UPDATE tickets 
      SET updated_at = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(ticketId);

    return result.changes > 0;
  } catch (error) {
    console.error('Error en addInternalNote:', error);
    throw error;
  }
}
