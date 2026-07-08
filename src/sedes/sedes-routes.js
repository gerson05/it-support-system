import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { createTracking, addEvento } from '../tracking/tracking-model.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

function generateDespachoNumero() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like = `DES-${dateStr}-%`;
  const last = db.prepare('SELECT numero FROM despachos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const next = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `DES-${dateStr}-${String(next).padStart(3, '0')}`;
}

router.post('/api/sedes/setup', requireAuth, requirePermission('sedes:create'), wrap(async (req, res) => {
  const { ciudad, nombre_punto, responsable = '', articulos = [], agente = 'IT' } = req.body;
  if (!ciudad?.trim() || !nombre_punto?.trim()) {
    return res.status(400).json({ error: 'Ciudad y nombre del punto son obligatorios.' });
  }

  let sedeId, despachoId = null, trackingToken = null;

  db.exec('BEGIN');
  try {
    if (articulos.length > 0) {
      const numero = generateDespachoNumero();
      const rd = db.prepare(`
        INSERT INTO despachos (numero, destinatario, sede, articulos, agente)
        VALUES (?, ?, ?, ?, ?)
      `).run(numero, responsable || nombre_punto.trim(), nombre_punto.trim(), JSON.stringify(articulos), agente);
      despachoId = rd.lastInsertRowid;
      trackingToken = createTracking(db, despachoId, agente, 'Bodega Central');
    }

    const rs = db.prepare(`
      INSERT INTO puntos (ciudad, nombre, tipo, despacho_id, tracking_token)
      VALUES (?, ?, 'punto', ?, ?)
    `).run(ciudad.trim().toUpperCase(), nombre_punto.trim(), despachoId, trackingToken);
    sedeId = rs.lastInsertRowid;

    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    throw e;
  }

  const baseUrl = process.env.PUBLIC_TUNNEL_URL || `${req.protocol}://${req.headers.host}`;
  const trackingUrl = trackingToken ? `${baseUrl}/rastrear?token=${trackingToken}` : null;

  res.status(201).json({
    success: true,
    sede_id: sedeId,
    despacho_id: despachoId,
    tracking_token: trackingToken,
    tracking_url: trackingUrl,
  });
}));

router.get('/api/sedes', requireAuth, requirePermission('sedes:read'), wrap(async (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.ciudad, p.nombre AS nombre_punto, p.activo, p.created_at,
           p.despacho_id, p.tracking_token, t.estado AS tracking_estado
    FROM puntos p
    LEFT JOIN paquete_tracking t ON t.token = p.tracking_token
    WHERE p.tipo = 'punto'
    ORDER BY p.ciudad, p.id
  `).all();

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.ciudad]) grouped[row.ciudad] = [];
    grouped[row.ciudad].push(row);
  }
  res.json({ grouped, total: rows.length });
}));

router.post('/api/sedes', requireAuth, requirePermission('sedes:create'), wrap(async (req, res) => {
  const { ciudad, nombre_punto } = req.body;
  if (!ciudad?.trim() || !nombre_punto?.trim()) {
    return res.status(400).json({ error: 'Ciudad y nombre del punto son obligatorios.' });
  }
  const result = db.prepare(
    `INSERT INTO puntos (ciudad, nombre, tipo) VALUES (?, ?, 'punto')`
  ).run(ciudad.trim().toUpperCase(), nombre_punto.trim());

  res.status(201).json({ success: true, id: result.lastInsertRowid });
}));

router.put('/api/sedes/:id', requireAuth, requirePermission('sedes:edit'), wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  const { ciudad, nombre_punto, activo } = req.body;

  const fields = [];
  const values = [];
  if (ciudad       !== undefined) { fields.push('ciudad=?');  values.push(ciudad.trim().toUpperCase()); }
  if (nombre_punto !== undefined) { fields.push('nombre=?');  values.push(nombre_punto.trim()); }
  if (activo       !== undefined) { fields.push('activo=?');  values.push(activo ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
  values.push(id);

  db.prepare(`UPDATE puntos SET ${fields.join(',')} WHERE id=? AND tipo='punto'`).run(...values);
  res.json({ success: true });
}));

router.get('/api/sedes/:id/checklist', requireAuth, requirePermission('sedes:read'), wrap(async (req, res) => {
  const sedeId = parseInt(req.params.id);
  const sede = db.prepare('SELECT * FROM puntos WHERE id = ?').get(sedeId);
  if (!sede) return res.status(404).json({ error: 'Punto no encontrado.' });
  if (!sede.despacho_id) return res.json({ checklist: null });

  const despacho = db.prepare('SELECT articulos FROM despachos WHERE id = ?').get(sede.despacho_id);
  const tracking = db.prepare('SELECT estado FROM paquete_tracking WHERE token = ?').get(sede.tracking_token);

  const baseUrl = process.env.PUBLIC_TUNNEL_URL || `${req.protocol}://${req.headers.host}`;
  res.json({
    checklist: {
      sede_id: sedeId,
      nombre_punto: sede.nombre,
      despacho_id: sede.despacho_id,
      tracking_token: sede.tracking_token,
      tracking_url: `${baseUrl}/rastrear?token=${sede.tracking_token}`,
      estado: tracking?.estado || 'creado',
      articulos: JSON.parse(despacho?.articulos || '[]'),
    },
  });
}));

router.post('/api/sedes/:id/marcar-enviado', requireAuth, requirePermission('sedes:edit'), wrap(async (req, res) => {
  const sedeId = parseInt(req.params.id);
  const { agente = 'IT' } = req.body;

  const sede = db.prepare('SELECT tracking_token FROM puntos WHERE id = ?').get(sedeId);
  if (!sede?.tracking_token) {
    return res.status(400).json({ error: 'Este punto no tiene despacho vinculado.' });
  }

  const tracking = db.prepare('SELECT id, estado FROM paquete_tracking WHERE token = ?').get(sede.tracking_token);
  if (!tracking) return res.status(404).json({ error: 'Tracking no encontrado.' });
  if (tracking.estado !== 'creado') {
    return res.status(409).json({ error: `Estado actual es '${tracking.estado}', ya fue procesado.` });
  }

  addEvento(db, tracking.id, {
    tipo: 'en_transito',
    entregado_por: agente,
    observaciones: 'Enviado desde IT',
  });

  res.json({ success: true });
}));

router.delete('/api/sedes/:id', requireAuth, requirePermission('sedes:delete'), wrap(async (req, res) => {
  db.prepare(`UPDATE puntos SET activo=0 WHERE id=? AND tipo='punto'`).run(parseInt(req.params.id));
  res.json({ success: true });
}));

/* ── Bodegas ─────────────────────────────────────────────────────────── */

router.get('/api/bodegas', requireAuth, requirePermission('sedes:read'), wrap(async (req, res) => {
  const rows = db.prepare(
    `SELECT id, nombre, ciudad, activo, created_at FROM puntos WHERE tipo='bodega' ORDER BY ciudad, nombre`
  ).all();
  const grouped = {};
  for (const b of rows) {
    if (!grouped[b.ciudad]) grouped[b.ciudad] = [];
    grouped[b.ciudad].push({ id: b.id, nombre_punto: b.nombre, activo: b.activo });
  }
  res.json({ grouped, total: rows.length, rows });
}));

router.post('/api/bodegas', requireAuth, requirePermission('sedes:create'), wrap(async (req, res) => {
  const { nombre, ciudad } = req.body;
  if (!nombre?.trim() || !ciudad?.trim()) {
    return res.status(400).json({ error: 'Nombre y ciudad son obligatorios.' });
  }
  const result = db.prepare(
    `INSERT INTO puntos (nombre, ciudad, tipo) VALUES (?, ?, 'bodega')`
  ).run(nombre.trim(), ciudad.trim().toUpperCase());
  res.status(201).json({ success: true, id: result.lastInsertRowid });
}));

router.put('/api/bodegas/:id', requireAuth, requirePermission('sedes:edit'), wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, ciudad, activo } = req.body;
  const fields = [], values = [];
  if (nombre  !== undefined) { fields.push('nombre=?');  values.push(nombre.trim()); }
  if (ciudad  !== undefined) { fields.push('ciudad=?');  values.push(ciudad.trim().toUpperCase()); }
  if (activo  !== undefined) { fields.push('activo=?');  values.push(activo ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
  values.push(id);
  db.prepare(`UPDATE puntos SET ${fields.join(',')} WHERE id=? AND tipo='bodega'`).run(...values);
  res.json({ success: true });
}));

router.delete('/api/bodegas/:id', requireAuth, requirePermission('sedes:delete'), wrap(async (req, res) => {
  db.prepare(`UPDATE puntos SET activo=0 WHERE id=? AND tipo='bodega'`).run(parseInt(req.params.id));
  res.json({ success: true });
}));

/* ── Puntos unificados ────────────────────────────────────────────────── */

router.get('/api/puntos', requireAuth, requirePermission('sedes:read'), wrap(async (req, res) => {
  const { tipo, activo } = req.query;
  let sql = `SELECT id, nombre, ciudad, tipo, activo, created_at FROM puntos WHERE 1=1`;
  const params = [];
  if (tipo)              { sql += ` AND tipo = ?`;   params.push(tipo); }
  if (activo !== undefined && activo !== '') { sql += ` AND activo = ?`; params.push(parseInt(activo)); }
  sql += ` ORDER BY ciudad, nombre`;
  const rows = db.prepare(sql).all(...params);
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.ciudad]) grouped[r.ciudad] = [];
    grouped[r.ciudad].push(r);
  }
  res.json({ puntos: rows, grouped, total: rows.length });
}));

router.post('/api/puntos', requireAuth, requirePermission('sedes:create'), wrap(async (req, res) => {
  const { nombre, ciudad, tipo = 'punto' } = req.body;
  if (!nombre?.trim() || !ciudad?.trim()) {
    return res.status(400).json({ error: 'Nombre y ciudad son obligatorios.' });
  }
  if (!['punto', 'bodega'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser punto o bodega.' });
  }
  const result = db.prepare(
    `INSERT INTO puntos (nombre, ciudad, tipo) VALUES (?, ?, ?)`
  ).run(nombre.trim(), ciudad.trim().toUpperCase(), tipo);
  res.status(201).json({ success: true, id: result.lastInsertRowid });
}));

router.put('/api/puntos/:id', requireAuth, requirePermission('sedes:edit'), wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, ciudad, tipo, activo } = req.body;
  const fields = [], values = [];
  if (nombre !== undefined) { fields.push('nombre=?');  values.push(nombre.trim()); }
  if (ciudad !== undefined) { fields.push('ciudad=?');  values.push(ciudad.trim().toUpperCase()); }
  if (tipo   !== undefined) { fields.push('tipo=?');    values.push(tipo); }
  if (activo !== undefined) { fields.push('activo=?');  values.push(activo ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
  values.push(id);
  db.prepare(`UPDATE puntos SET ${fields.join(',')} WHERE id=?`).run(...values);
  res.json({ success: true });
}));

router.delete('/api/puntos/:id', requireAuth, requirePermission('sedes:delete'), wrap(async (req, res) => {
  db.prepare(`UPDATE puntos SET activo=0 WHERE id=?`).run(parseInt(req.params.id));
  res.json({ success: true });
}));

export default router;
