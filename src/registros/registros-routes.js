import express from 'express';
import db from '../config/database.js';
import { requireAuth } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

router.get('/api/registros-it', requireAuth, wrap(async (req, res) => {
  const { tipo, search, desde, hasta, page = 1, limit = 50 } = req.query;
  const rows = [];

  if (!tipo || tipo === 'requerimiento' || tipo === 'incidencia') {
    let q = `
      SELECT
        r.id,
        r.request_number  AS numero,
        r.type            AS tipo,
        r.requester_name  AS nombre,
        r.cedula,
        r.cargo,
        r.sede,
        ''                AS area,
        r.description     AS descripcion,
        r.priority        AS prioridad,
        r.status          AS estado,
        r.equipment_name  AS equipo,
        r.equipment_serial AS serial,
        r.created_at,
        r.updated_at,
        NULL              AS requiere_acta,
        NULL              AS nro_acta,
        NULL              AS agente,
        NULL              AS observaciones
      FROM tech_requests r WHERE 1=1
    `;
    const params = [];
    if (tipo) { q += ' AND r.type = ?'; params.push(tipo); }
    if (search) {
      q += ' AND (r.request_number LIKE ? OR r.requester_name LIKE ? OR r.sede LIKE ? OR r.description LIKE ?)';
      const searchPattern = `%${search}%`; params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    if (desde) { q += ' AND DATE(r.created_at) >= ?'; params.push(desde); }
    if (hasta) { q += ' AND DATE(r.created_at) <= ?'; params.push(hasta); }
    rows.push(...db.prepare(q).all(...params));
  }

  if (!tipo || tipo === 'despacho') {
    let q = `
      SELECT
        d.id,
        d.numero,
        'despacho'        AS tipo,
        d.destinatario    AS nombre,
        NULL              AS cedula,
        NULL              AS cargo,
        d.sede,
        d.area,
        d.articulos       AS descripcion,
        NULL              AS prioridad,
        NULL              AS estado,
        NULL              AS equipo,
        NULL              AS serial,
        d.created_at,
        d.created_at      AS updated_at,
        d.requiere_acta,
        d.acta_numero     AS nro_acta,
        d.agente,
        d.observaciones
      FROM despachos d WHERE 1=1
    `;
    const params = [];
    if (search) {
      q += ' AND (d.numero LIKE ? OR d.destinatario LIKE ? OR d.sede LIKE ?)';
      const searchPattern = `%${search}%`; params.push(searchPattern, searchPattern, searchPattern);
    }
    if (desde) { q += ' AND DATE(d.created_at) >= ?'; params.push(desde); }
    if (hasta) { q += ' AND DATE(d.created_at) <= ?'; params.push(hasta); }
    rows.push(...db.prepare(q).all(...params));
  }

  rows.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  const total  = rows.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const data   = rows.slice(offset, offset + parseInt(limit));

  res.json({ registros: data, total, page: parseInt(page), limit: parseInt(limit) });
}));

router.get('/api/registros-it/sheet-url', requireAuth, (_req, res) => {
  const url = process.env.REGISTROS_SHEET_URL || null;
  res.json({ url });
});

export default router;
