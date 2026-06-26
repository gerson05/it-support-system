/* ── Numbering ───────────────────────────────────────────────────────── */

export function generateNumero(db) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like    = `DES-${dateStr}-%`;
  const last    = db.prepare('SELECT numero FROM despachos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const next    = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `DES-${dateStr}-${String(next).padStart(3, '0')}`;
}

export function generateActaNumero(db) {
  const year = new Date().getFullYear();
  const like = `ACTA-${year}-%`;
  const last = db.prepare("SELECT acta_numero FROM despachos WHERE acta_numero LIKE ? ORDER BY id DESC LIMIT 1").get(like);
  const next = last ? parseInt(last.acta_numero.split('-')[2]) + 1 : 1;
  return `ACTA-${year}-${String(next).padStart(3, '0')}`;
}

/* ── Despachos ───────────────────────────────────────────────────────── */

export function getDespachos(db, { search, requiere_acta, acta_firmada, limit = 20, offset = 0 } = {}) {
  let query  = 'SELECT * FROM despachos WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (numero LIKE ? OR destinatario LIKE ? OR sede LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (requiere_acta !== undefined && requiere_acta !== '') {
    query += ' AND requiere_acta = ?';
    params.push(parseInt(requiere_acta));
  }
  if (acta_firmada !== undefined && acta_firmada !== '') {
    query += ' AND acta_firmada = ?';
    params.push(parseInt(acta_firmada));
  }
  const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as n')).get(...params).n;
  const rows  = db.prepare(`${query} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), parseInt(offset));
  return { despachos: rows, total };
}

export function getDespachoById(db, id) {
  return db.prepare('SELECT * FROM despachos WHERE id = ?').get(id) || null;
}

export function insertDespacho(db, { numero, destinatario, cedula, sede, area, articulos, observaciones, requiere_acta, acta_numero, ticket_id, agente, fecha }) {
  db.prepare(`
    INSERT INTO despachos (numero, destinatario, cedula, sede, area, articulos, observaciones, requiere_acta, acta_numero, ticket_id, agente, fecha)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    numero, destinatario, cedula || null, sede || null, area || null,
    JSON.stringify(articulos), observaciones || null,
    requiere_acta ? 1 : 0, acta_numero || null,
    ticket_id || null, agente || null,
    fecha || null,
  );
  return db.prepare('SELECT last_insert_rowid() as id').get().id;
}

export function deleteDespacho(db, id) {
  db.prepare('DELETE FROM confirmaciones_entrega WHERE despacho_id = ?').run(id);
  db.prepare('DELETE FROM paquete_tracking WHERE despacho_id = ?').run(id);
  db.prepare('DELETE FROM despachos WHERE id = ?').run(id);
}

export function patchDespacho(db, id, fieldMap) {
  const entries = Object.entries(fieldMap);
  if (!entries.length) return;
  const setClauses = entries.map(([col]) => `${col} = ?`).join(', ');
  const values     = entries.map(([, v]) => v);
  db.prepare(`UPDATE despachos SET ${setClauses} WHERE id = ?`).run(...values, id);
}

/* ── Borradores ──────────────────────────────────────────────────────── */

export function getBorrador(db, agente) {
  const row = db.prepare('SELECT * FROM despacho_borradores WHERE agente = ?').get(agente);
  if (!row) return null;
  return { ...row, articulos: JSON.parse(row.articulos || '[]') };
}

export function upsertBorrador(db, { agente, destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id }) {
  db.prepare(`
    INSERT INTO despacho_borradores (agente, destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(agente) DO UPDATE SET
      destinatario  = excluded.destinatario,
      sede          = excluded.sede,
      area          = excluded.area,
      articulos     = excluded.articulos,
      observaciones = excluded.observaciones,
      requiere_acta = excluded.requiere_acta,
      ticket_id     = excluded.ticket_id,
      updated_at    = excluded.updated_at
  `).run(
    agente, destinatario || '', sede || '', area || '',
    JSON.stringify(articulos || []), observaciones || '',
    requiere_acta ? 1 : 0, ticket_id || null,
  );
}

export function deleteBorrador(db, agente) {
  db.prepare('DELETE FROM despacho_borradores WHERE agente = ?').run(agente);
}

/* ── Tipos de artículo ───────────────────────────────────────────────── */

export function getTiposArticulo(db) {
  return db.prepare("SELECT id, nombre FROM tipos_articulo WHERE activo = 1 ORDER BY nombre ASC").all();
}

export function upsertTipoArticulo(db, nombre) {
  const existing = db.prepare("SELECT id FROM tipos_articulo WHERE nombre = ?").get(nombre);
  if (existing) {
    db.prepare("UPDATE tipos_articulo SET activo = 1 WHERE id = ?").run(existing.id);
    return { id: existing.id, nombre };
  }
  const r = db.prepare("INSERT INTO tipos_articulo (nombre) VALUES (?)").run(nombre);
  return { id: r.lastInsertRowid, nombre };
}

export function deactivateTipoArticulo(db, id) {
  db.prepare("UPDATE tipos_articulo SET activo = 0 WHERE id = ?").run(id);
}

/* ── Confirmaciones de entrega ───────────────────────────────────────── */

export function getConfirmacion(db, despachoId) {
  return db.prepare('SELECT * FROM confirmaciones_entrega WHERE despacho_id = ?').get(despachoId) || null;
}

export function createConfirmacion(db, despachoId, token) {
  db.prepare('INSERT INTO confirmaciones_entrega (despacho_id, token) VALUES (?, ?)').run(despachoId, token);
}

export function getConfirmacionByToken(db, token) {
  return db.prepare(`
    SELECT c.token, c.confirmed_at, c.id,
           d.numero, d.destinatario, d.articulos, d.sede, d.requiere_acta, c.despacho_id
    FROM confirmaciones_entrega c
    JOIN despachos d ON d.id = c.despacho_id
    WHERE c.token = ?
  `).get(token) || null;
}

export function confirmDelivery(db, id, ip) {
  db.prepare(`UPDATE confirmaciones_entrega SET confirmed_at = datetime('now','localtime'), ip = ? WHERE id = ?`)
    .run(ip, id);
}
