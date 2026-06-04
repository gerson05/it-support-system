import express from 'express';
import db from '../config/database.js';
import { requireAuth } from '../auth/auth-middleware.js';

const router = express.Router();

/**
 * GET /api/registros-it
 * Devuelve requerimientos, incidencias y despachos en un array unificado.
 */
router.get('/api/registros-it', requireAuth, (req, res) => {
  try {
    const { tipo, search, desde, hasta, page = 1, limit = 50 } = req.query;
    const rows = [];

    /* ── Tech requests (requerimientos + incidencias) ── */
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
      const p = [];
      if (tipo) { q += ' AND r.type = ?'; p.push(tipo); }
      if (search) {
        q += ' AND (r.request_number LIKE ? OR r.requester_name LIKE ? OR r.sede LIKE ? OR r.description LIKE ?)';
        const s = `%${search}%`; p.push(s, s, s, s);
      }
      if (desde) { q += ' AND DATE(r.created_at) >= ?'; p.push(desde); }
      if (hasta) { q += ' AND DATE(r.created_at) <= ?'; p.push(hasta); }
      rows.push(...db.prepare(q).all(...p));
    }

    /* ── Despachos ── */
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
      const p = [];
      if (search) {
        q += ' AND (d.numero LIKE ? OR d.destinatario LIKE ? OR d.sede LIKE ?)';
        const s = `%${search}%`; p.push(s, s, s);
      }
      if (desde) { q += ' AND DATE(d.created_at) >= ?'; p.push(desde); }
      if (hasta) { q += ' AND DATE(d.created_at) <= ?'; p.push(hasta); }
      rows.push(...db.prepare(q).all(...p));
    }

    /* Ordenar por fecha desc y paginar */
    rows.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    const total  = rows.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const data   = rows.slice(offset, offset + parseInt(limit));

    res.json({ registros: data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Error GET /api/registros-it:', err);
    res.status(500).json({ error: 'Error al obtener registros.' });
  }
});

/** GET /api/registros-it/sheet-url — devuelve la URL del Google Sheet */
router.get('/api/registros-it/sheet-url', requireAuth, (_req, res) => {
  const url = process.env.REGISTROS_SHEET_URL || null;
  res.json({ url });
});

export default router;
