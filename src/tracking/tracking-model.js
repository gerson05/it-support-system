import crypto from 'crypto';

export async function createTracking(db, despachoId, agentName = 'IT', ubicacionOrigen = 'Bodega Central') {
  const token = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO paquete_tracking (despacho_id, token, estado)
    VALUES (?, ?, 'creado')
  `).run(despachoId, token);

  const tracking = await db.prepare('SELECT id FROM paquete_tracking WHERE token = ?').get(token);

  await db.prepare(`
    INSERT INTO paquete_eventos
      (tracking_id, tipo, recibido_por, entregado_por, ubicacion, foto_path, foto_filename, estado_paquete)
    VALUES (?, 'creacion', ?, 'Sistema', ?, 'system', 'system', 'creado')
  `).run(tracking.id, agentName, ubicacionOrigen);

  return token;
}

export async function getTrackingByToken(db, token) {
  const tracking = await db.prepare(`
    SELECT t.*, d.numero, d.destinatario, d.sede as sede_destino,
           d.articulos, d.agente, d.fecha
    FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id
    WHERE t.token = ?
  `).get(token);
  if (!tracking) return null;

  tracking.eventos = await db.prepare(`
    SELECT * FROM paquete_eventos WHERE tracking_id = ? ORDER BY id ASC
  `).all(tracking.id);

  tracking.acta_final = await db.prepare(
    'SELECT * FROM paquete_acta_final WHERE tracking_id = ?'
  ).get(tracking.id) || null;

  try { tracking.articulos_parsed = JSON.parse(tracking.articulos || '[]'); } catch { tracking.articulos_parsed = []; }

  return tracking;
}

export async function getTrackingByDespachoId(db, despachoId) {
  return await db.prepare('SELECT * FROM paquete_tracking WHERE despacho_id = ?').get(despachoId) || null;
}

export async function getAllTrackings(db, { estado, search, limit = 50, offset = 0 } = {}) {
  let where = '1=1';
  const params = [];

  if (estado) { where += ' AND t.estado = ?'; params.push(estado); }
  if (search) {
    where += ' AND (d.numero LIKE ? OR d.destinatario LIKE ? OR d.sede LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const total = await db.prepare(`
    SELECT COUNT(*) as n FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id WHERE ${where}
  `).get(...params).n;

  const rows = await db.prepare(`
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

export async function addEvento(db, trackingId, {
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

  await db.exec('BEGIN');
  try {
    const { lastInsertRowid: eventoId } = await db.prepare(`
      INSERT INTO paquete_eventos
        (tracking_id, tipo, recibido_por, entregado_por, ubicacion, sede_id,
         cargo_receptor, observaciones, foto_path, foto_filename, estado_paquete, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trackingId, tipo, recibido_por, entregado_por, ubicacion, sede_id,
      cargo_receptor, observaciones, foto_path, foto_filename, nuevoEstado, ip
    );

    await db.prepare(`
      UPDATE paquete_tracking
      SET estado = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(nuevoEstado, trackingId);

    await db.exec('COMMIT');
    return { eventoId, nuevoEstado };
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

export async function addEntregaItems(db, eventoId, items = []) {
  const stmt = await db.prepare(`
    INSERT INTO paquete_entrega_items
      (evento_id, item_index, equipment_name, cantidad, recibido_conforme, observacion_item)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of items) {
    await stmt.run(
      eventoId,
      item.item_index ?? 0,
      item.equipment_name || 'Artículo',
      item.cantidad || 1,
      item.recibido_conforme ? 1 : 0,
      item.observacion_item || null,
    );
  }
}

export async function saveActaFinal(db, trackingId, { filepath, filename, firmado_por, cargo }) {
  await db.prepare(`
    INSERT OR REPLACE INTO paquete_acta_final (tracking_id, filepath, filename, firmado_por, cargo)
    VALUES (?, ?, ?, ?, ?)
  `).run(trackingId, filepath, filename, firmado_por, cargo);
}

export async function marcarDevuelto(db, token) {
  const result = await db.prepare(`
    UPDATE paquete_tracking
    SET estado = 'devuelto', updated_at = datetime('now','localtime')
    WHERE token = ? AND estado NOT IN ('entregado')
  `).run(token);
  return result.changes > 0;
}

export async function countRecentEventos(db, trackingId) {
  return await db.prepare(`
    SELECT COUNT(*) as n FROM paquete_eventos
    WHERE tracking_id = ?
      AND created_at > datetime('now', '-1 hour', 'localtime')
      AND tipo != 'creacion'
  `).get(trackingId).n;
}

export async function getDistinctCargos(db) {
  return (await db.prepare(`
    SELECT DISTINCT cargo FROM tech_requests
    WHERE cargo IS NOT NULL AND cargo != ''
    ORDER BY cargo LIMIT 60
  `).all()).map(r => r.cargo);
}

export async function getTrackingRow(db, token) {
  return await db.prepare('SELECT * FROM paquete_tracking WHERE token = ?').get(token) || null;
}

export async function getActaFinalByToken(db, token) {
  const row = await db.prepare('SELECT id FROM paquete_tracking WHERE token = ?').get(token);
  if (!row) return null;
  return await db.prepare('SELECT * FROM paquete_acta_final WHERE tracking_id = ?').get(row.id) || null;
}

export async function getSedesActivas(db) {
  return await db.prepare(
    `SELECT id, ciudad, nombre AS nombre_punto FROM puntos WHERE tipo='punto' AND activo = 1 ORDER BY ciudad, nombre`
  ).all();
}
