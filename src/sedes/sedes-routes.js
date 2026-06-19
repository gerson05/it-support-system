import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { createTracking } from '../tracking/tracking-model.js';

const router = express.Router();

function generateDespachoNumero() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like = `DES-${dateStr}-%`;
  const last = db.prepare('SELECT numero FROM despachos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const next = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `DES-${dateStr}-${String(next).padStart(3, '0')}`;
}

router.post('/api/sedes/setup', requireAuth, requirePermission('sedes:create'), (req, res) => {
  try {
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
        INSERT INTO sedes (ciudad, nombre_punto, despacho_id, tracking_token)
        VALUES (?, ?, ?, ?)
      `).run(ciudad.trim().toUpperCase(), nombre_punto.trim(), despachoId, trackingToken);
      sedeId = rs.lastInsertRowid;

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
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
  } catch (e) {
    console.error('Error POST /api/sedes/setup:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ── Listar todas las sedes agrupadas por ciudad ── */
router.get('/api/sedes', requireAuth, requirePermission('sedes:read'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, ciudad, nombre_punto, activo, created_at
      FROM sedes ORDER BY ciudad, id
    `).all();

    // Agrupar por ciudad
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.ciudad]) grouped[row.ciudad] = [];
      grouped[row.ciudad].push(row);
    }
    res.json({ grouped, total: rows.length });
  } catch (err) {
    console.error('Error GET /api/sedes:', err);
    res.status(500).json({ error: 'Error al obtener sedes.' });
  }
});

/* ── Agregar nuevo punto ── */
router.post('/api/sedes', requireAuth, requirePermission('sedes:create'), (req, res) => {
  try {
    const { ciudad, nombre_punto } = req.body;
    if (!ciudad?.trim() || !nombre_punto?.trim()) {
      return res.status(400).json({ error: 'Ciudad y nombre del punto son obligatorios.' });
    }
    const result = db.prepare(
      `INSERT INTO sedes (ciudad, nombre_punto) VALUES (?, ?)`
    ).run(ciudad.trim().toUpperCase(), nombre_punto.trim());

    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Error POST /api/sedes:', err);
    res.status(500).json({ error: 'Error al crear el punto.' });
  }
});

/* ── Actualizar punto (nombre o activo) ── */
router.put('/api/sedes/:id', requireAuth, requirePermission('sedes:edit'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { ciudad, nombre_punto, activo } = req.body;

    const fields = [];
    const values = [];
    if (ciudad      !== undefined) { fields.push('ciudad=?');       values.push(ciudad.trim().toUpperCase()); }
    if (nombre_punto !== undefined) { fields.push('nombre_punto=?'); values.push(nombre_punto.trim()); }
    if (activo      !== undefined) { fields.push('activo=?');       values.push(activo ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
    values.push(id);

    db.prepare(`UPDATE sedes SET ${fields.join(',')} WHERE id=?`).run(...values);
    res.json({ success: true });
  } catch (err) {
    console.error('Error PUT /api/sedes:', err);
    res.status(500).json({ error: 'Error al actualizar.' });
  }
});

/* ── Eliminar punto (soft delete) ── */
router.delete('/api/sedes/:id', requireAuth, requirePermission('sedes:delete'), (req, res) => {
  try {
    db.prepare(`UPDATE sedes SET activo=0 WHERE id=?`).run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Error DELETE /api/sedes:', err);
    res.status(500).json({ error: 'Error al eliminar.' });
  }
});

export default router;
