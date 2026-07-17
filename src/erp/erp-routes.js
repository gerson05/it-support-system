import express from 'express';
import db from '../config/database.js';
import { requireAuth } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

/**
 * Employee lookup — used by despacho form destinatario autocomplete.
 * Searches local employees table (synced from HR import).
 * ?q=<cedula or partial name>
 */
router.get('/api/erp/empleados', requireAuth, wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const byId  = /^\d{6,}$/.test(q);
  let rows;
  if (byId) {
    rows = db.prepare(
      `SELECT cedula, nombre_completo, cargo, area
       FROM employees
       WHERE cedula LIKE ? LIMIT 20`
    ).all(`${q}%`);
  } else {
    rows = db.prepare(
      `SELECT cedula, nombre_completo, cargo, area
       FROM employees
       WHERE nombre_completo LIKE ? LIMIT 20`
    ).all(`%${q}%`);
  }

  res.json(rows.map(r => ({
    cedula:  r.cedula,
    nombre:  r.nombre_completo,
    cargo:   r.cargo,
    area:    r.area,
  })));
}));

/**
 * Puntos/sedes — for despacho sede field autocomplete.
 * Returns active puntos from local DB.
 */
router.get('/api/erp/sedes', requireAuth, wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = q
    ? db.prepare(
        `SELECT nombre, ciudad FROM puntos
         WHERE activo = 1 AND (nombre LIKE ? OR ciudad LIKE ?)
         ORDER BY nombre LIMIT 30`
      ).all(`%${q}%`, `%${q}%`)
    : db.prepare(
        `SELECT nombre, ciudad FROM puntos
         WHERE activo = 1 ORDER BY nombre LIMIT 100`
      ).all();
  res.json(rows);
}));

export default router;
