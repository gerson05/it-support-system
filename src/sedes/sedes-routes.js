import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = express.Router();

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
