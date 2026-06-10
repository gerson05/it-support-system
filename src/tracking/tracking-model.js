import crypto from 'crypto';

export function createTracking(db, despachoId, agentName = 'IT', ubicacionOrigen = 'Bodega Central') {
  const token = crypto.randomUUID();
  db.prepare(`
    INSERT INTO paquete_tracking (despacho_id, token, estado)
    VALUES (?, ?, 'creado')
  `).run(despachoId, token);

  const tracking = db.prepare('SELECT id FROM paquete_tracking WHERE token = ?').get(token);

  db.prepare(`
    INSERT INTO paquete_eventos
      (tracking_id, tipo, recibido_por, entregado_por, ubicacion, foto_path, foto_filename, estado_paquete)
    VALUES (?, 'creacion', ?, 'Sistema', ?, 'system', 'system', 'creado')
  `).run(tracking.id, agentName, ubicacionOrigen);

  return token;
}

export function getTrackingByToken(db, token) {
  const tracking = db.prepare(`
    SELECT t.*, d.numero, d.destinatario, d.sede as sede_destino,
           d.articulos, d.agente, d.fecha
    FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id
    WHERE t.token = ?
  `).get(token);
  if (!tracking) return null;

  tracking.eventos = db.prepare(`
    SELECT * FROM paquete_eventos WHERE tracking_id = ? ORDER BY id ASC
  `).all(tracking.id);

  tracking.acta_final = db.prepare(
    'SELECT * FROM paquete_acta_final WHERE tracking_id = ?'
  ).get(tracking.id) || null;

  try { tracking.articulos_parsed = JSON.parse(tracking.articulos || '[]'); } catch { tracking.articulos_parsed = []; }

  return tracking;
}

export function getTrackingByDespachoId(db, despachoId) {
  return db.prepare('SELECT * FROM paquete_tracking WHERE despacho_id = ?').get(despachoId) || null;
}

export function getAllTrackings(db, { estado, search, limit = 50, offset = 0 } = {}) {
  let where = '1=1';
  const params = [];

  if (estado) { where += ' AND t.estado = ?'; params.push(estado); }
  if (search) {
    where += ' AND (d.numero LIKE ? OR d.destinatario LIKE ? OR d.sede LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id WHERE ${where}
  `).get(...params).n;

  const rows = db.prepare(`
    SELECT t.id, t.token, t.estado, t.updated_at,
           d.numero, d.destinatario, d.sede as sede_destino, d.fecha,
           (SELECT COUNT(*) FROM paquete_eventos WHERE tracking_id = t.id AND tipo != 'creacion') as evento_count,
           (SELECT ubicacion FROM paquete_eventos WHERE tracking_id = t.id ORDER BY id DESC LIMIT 1) as ultimo_evento_ubicacion,
           (SELECT created_at FROM paquete_eventos WHERE tracking_id = t.id ORDER BY id DESC LIMIT 1) as ultimo_evento_at
    FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id
    WHERE ${where}
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
}

export function addEvento(db, trackingId, {
  tipo, recibido_por, entregado_por, ubicacion, sede_id = null,
  cargo_receptor = null, observaciones = null,
  foto_path, foto_filename, es_entrega_final = false, ip = null,
}) {
  let nuevoEstado;
  if (es_entrega_final) {
    nuevoEstado = 'entregado';
  } else if (sede_id) {
    nuevoEstado = 'en_sede';
  } else {
    nuevoEstado = 'en_transito';
  }

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO paquete_eventos
        (tracking_id, tipo, recibido_por, entregado_por, ubicacion, sede_id,
         cargo_receptor, observaciones, foto_path, foto_filename, estado_paquete, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trackingId, tipo, recibido_por, entregado_por, ubicacion, sede_id,
      cargo_receptor, observaciones, foto_path, foto_filename, nuevoEstado, ip
    );

    const { id: eventoId } = db.prepare('SELECT last_insert_rowid() as id').get();

    db.prepare(`
      UPDATE paquete_tracking
      SET estado = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(nuevoEstado, trackingId);

    db.exec('COMMIT');
    return { eventoId, nuevoEstado };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function addEntregaItems(db, eventoId, items = []) {
  const stmt = db.prepare(`
    INSERT INTO paquete_entrega_items
      (evento_id, item_index, equipment_name, cantidad, recibido_conforme, observacion_item)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of items) {
    stmt.run(
      eventoId,
      item.item_index ?? 0,
      item.equipment_name || 'Artículo',
      item.cantidad || 1,
      item.recibido_conforme ? 1 : 0,
      item.observacion_item || null,
    );
  }
}

export function saveActaFinal(db, trackingId, { filepath, filename, firmado_por, cargo }) {
  db.prepare(`
    INSERT OR REPLACE INTO paquete_acta_final (tracking_id, filepath, filename, firmado_por, cargo)
    VALUES (?, ?, ?, ?, ?)
  `).run(trackingId, filepath, filename, firmado_por, cargo);
}

export function marcarDevuelto(db, token) {
  const result = db.prepare(`
    UPDATE paquete_tracking
    SET estado = 'devuelto', updated_at = datetime('now','localtime')
    WHERE token = ? AND estado NOT IN ('entregado')
  `).run(token);
  return result.changes > 0;
}

export function countRecentEventos(db, trackingId) {
  return db.prepare(`
    SELECT COUNT(*) as n FROM paquete_eventos
    WHERE tracking_id = ?
      AND created_at > datetime('now', '-1 hour', 'localtime')
      AND tipo != 'creacion'
  `).get(trackingId).n;
}

export function getDistinctCargos(db) {
  return db.prepare(`
    SELECT DISTINCT cargo FROM tech_requests
    WHERE cargo IS NOT NULL AND cargo != ''
    ORDER BY cargo LIMIT 60
  `).all().map(r => r.cargo);
}
