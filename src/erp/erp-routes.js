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

router.get('/api/erp/empleado/:cedula', requireAuth, wrap(async (req, res) => {
  const cedula = req.params.cedula.trim();
  const row = db.prepare(
    `SELECT cedula, nombre_completo, cargo, area FROM employees WHERE cedula = ?`
  ).get(cedula);
  if (!row) return res.status(404).json({ error: 'Cédula no encontrada en el sistema.' });
  res.json({ cedula: row.cedula, nombre: row.nombre_completo, cargo: row.cargo, area: row.area });
}));

router.get('/api/erp/empleado/:cedula/historial', requireAuth, wrap(async (req, res) => {
  const cedula = req.params.cedula.trim();

  const empleado = db.prepare(
    `SELECT cedula, nombre_completo, cargo, area FROM employees WHERE cedula = ?`
  ).get(cedula);

  const tickets = db.prepare(
    `SELECT id, ticket_number, area, status, priority, description, created_at
     FROM tickets
     WHERE requester_name IN (SELECT nombre_completo FROM employees WHERE cedula = ?)
     ORDER BY created_at DESC LIMIT 20`
  ).all(cedula);

  const despachos = db.prepare(
    `SELECT numero, destinatario, sede, fecha, articulos, created_at
     FROM despachos WHERE cedula = ? ORDER BY created_at DESC LIMIT 20`
  ).all(cedula);

  const techRequests = db.prepare(
    `SELECT request_number, type, status, priority, description, sede, created_at
     FROM tech_requests WHERE cedula = ? ORDER BY created_at DESC LIMIT 20`
  ).all(cedula);

  res.json({ empleado, tickets, despachos, tech_requests: techRequests });
}));

export default router;
