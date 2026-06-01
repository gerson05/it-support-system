import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/api/audit', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const logs = db.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as n FROM audit_log`).get().n;
    res.json({ logs, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/audit/actas', (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const type   = req.query.type   || '';
    const status = req.query.status || '';
    const q      = req.query.q      ? `%${req.query.q}%` : '';

    const conditions = [];
    const params     = [];

    if (type)   { conditions.push('entity_type = ?');        params.push(type); }
    if (status === 'uploaded') { conditions.push('uploaded_at IS NOT NULL'); }
    if (status === 'pending')  { conditions.push('uploaded_at IS NULL');     }
    if (q) {
      conditions.push('(entity_ref LIKE ? OR filename LIKE ? OR persona LIKE ? OR agente LIKE ?)');
      params.push(q, q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const cte = `
      WITH actas_full AS (
        SELECT
          a.id, a.token, a.entity_type, a.entity_ref,
          a.filename, a.uploaded_at, a.created_at,
          CASE WHEN a.entity_type = 'despacho'     THEN d.destinatario
               WHEN a.entity_type = 'tech_request' THEN tr.requester_name
          END AS persona,
          CASE WHEN a.entity_type = 'despacho'     THEN d.agente
               WHEN a.entity_type = 'tech_request' THEN ag.name
          END AS agente
        FROM acta_uploads a
        LEFT JOIN despachos d
          ON a.entity_type = 'despacho' AND a.entity_id = d.id
        LEFT JOIN tech_requests tr
          ON a.entity_type = 'tech_request' AND a.entity_id = tr.id
        LEFT JOIN agents ag
          ON a.entity_type = 'tech_request' AND tr.assigned_to = ag.id
      )
    `;

    const actas = db.prepare(`${cte} SELECT * FROM actas_full ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    const total = db.prepare(`${cte} SELECT COUNT(*) AS n FROM actas_full ${where}`)
      .get(...params).n;

    res.json({ actas, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
