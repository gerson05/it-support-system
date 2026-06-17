import express from 'express';
import db from '../config/database.js';
import { logAudit }    from '../audit/audit-logger.js';
import { generateActa } from '../tech-requests/acta-generator.js';
import { logDespacho }      from '../excel/excel-logger.js';
import { logDespachoSheet } from '../excel/sheets-logger.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { createTracking } from '../tracking/tracking-model.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('despacho:read')];
const canCreate = [requireAuth, requirePermission('despacho:create')];
const canEdit   = [requireAuth, requirePermission('despacho:edit')];

// Generate acta number: ACTA-YYYY-NNN
function generateActaNumero() {
  const year = new Date().getFullYear();
  const like = `ACTA-${year}-%`;
  const last = db.prepare("SELECT acta_numero FROM despachos WHERE acta_numero LIKE ? ORDER BY id DESC LIMIT 1").get(like);
  const next = last ? parseInt(last.acta_numero.split('-')[2]) + 1 : 1;
  return `ACTA-${year}-${String(next).padStart(3, '0')}`;
}

// Generate dispatch number: DES-YYYYMMDD-NNN
function generateNumero() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const like = `DES-${dateStr}-%`;
  const last = db.prepare('SELECT numero FROM despachos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const next = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `DES-${dateStr}-${String(next).padStart(3, '0')}`;
}

// GET /api/despachos — list with optional filters
router.get('/api/despachos', ...canRead, (req, res) => {
  try {
    const { search, requiere_acta, acta_firmada, limit = 20, offset = 0 } = req.query;
    let query = 'SELECT * FROM despachos WHERE 1=1';
    const params = [];
    if (search) {
      query += ' AND (numero LIKE ? OR destinatario LIKE ? OR sede LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (requiere_acta !== undefined && requiere_acta !== '') {
      query += ' AND requiere_acta = ?';
      params.push(parseInt(requiere_acta));
    }
    if (acta_firmada !== undefined && acta_firmada !== '') {
      query += ' AND acta_firmada = ?';
      params.push(parseInt(acta_firmada));
    }
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as n');
    const total = db.prepare(countQuery).get(...params).n;
    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const rows = db.prepare(query).all(...params);
    res.json({ despachos: rows, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/despachos/borrador?agente=X
router.get('/api/despachos/borrador', ...canRead, (req, res) => {
  try {
    const { agente } = req.query;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    const row = db.prepare('SELECT * FROM despacho_borradores WHERE agente = ?').get(agente);
    if (!row) return res.json({ borrador: null });
    res.json({
      borrador: {
        ...row,
        articulos: JSON.parse(row.articulos || '[]'),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/despachos/borrador — crea o sobreescribe el borrador del agente
router.put('/api/despachos/borrador', ...canEdit, (req, res) => {
  try {
    const { agente, destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id } = req.body;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    db.prepare(`
      INSERT INTO despacho_borradores (agente, destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(agente) DO UPDATE SET
        destinatario  = excluded.destinatario,
        sede          = excluded.sede,
        area          = excluded.area,
        articulos     = excluded.articulos,
        observaciones = excluded.observaciones,
        requiere_acta = excluded.requiere_acta,
        ticket_id     = excluded.ticket_id,
        updated_at    = excluded.updated_at
    `).run(
      agente,
      destinatario  || '',
      sede          || '',
      area          || '',
      JSON.stringify(articulos || []),
      observaciones || '',
      requiere_acta ? 1 : 0,
      ticket_id     || null,
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/despachos/borrador?agente=X
router.delete('/api/despachos/borrador', ...canEdit, (req, res) => {
  try {
    const { agente } = req.query;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    db.prepare('DELETE FROM despacho_borradores WHERE agente = ?').run(agente);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/despachos/:id
router.get('/api/despachos/:id', ...canRead, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM despachos WHERE id = ?').get(parseInt(req.params.id));
    if (!row) return res.status(404).json({ error: 'Despacho no encontrado.' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/despachos — create
router.post('/api/despachos', ...canCreate, (req, res) => {
  try {
    const { destinatario, cedula, sede, area, articulos, observaciones, requiere_acta = 0, ticket_id, agente } = req.body;
    if (!destinatario || !articulos || !articulos.length) {
      return res.status(400).json({ error: 'Destinatario y artículos son obligatorios.' });
    }
    const numero = generateNumero();
    const acta_numero = requiere_acta ? generateActaNumero() : null;
    db.prepare(`INSERT INTO despachos (numero, destinatario, cedula, sede, area, articulos, observaciones, requiere_acta, acta_numero, ticket_id, agente)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        numero,
        destinatario,
        cedula || null,
        sede || null,
        area || null,
        JSON.stringify(articulos),
        observaciones || null,
        requiere_acta ? 1 : 0,
        acta_numero || null,
        ticket_id || null,
        agente || null
      );
    const { id } = db.prepare('SELECT last_insert_rowid() as id').get();
    logAudit(agente || 'Sistema', 'Despacho creado', 'despacho', id, numero, { destinatario, sede });

    const desData = { numero, destinatario, sede, area, articulos, observaciones, requiere_acta, acta_numero, agente };
    logDespacho(desData).catch(err => console.error('[excel-logger] despacho:', err.message));
    logDespachoSheet(desData).catch(err => console.error('[sheets-logger] despacho:', err.message));

    // Auto-crear tracking para este despacho
    try {
      createTracking(db, id, agente || 'IT', 'Bodega Central');
    } catch (err) {
      console.error('[tracking] Error al crear tracking:', err.message);
    }

    res.json({ success: true, id, numero });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/despachos/:id — update content fields and/or acta fields
router.put('/api/despachos/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      // Campos de acta (solo se sobreescriben si vienen explícitos)
      acta_numero, acta_firmada,
      // Campos de contenido (edición completa)
      destinatario, sede, area, articulos, observaciones, requiere_acta, ticket_id,
      agente,
    } = req.body;

    const fields  = [];
    const params  = [];

    // Campos de acta: preservar valor existente si no vienen en el body
    if (acta_numero   !== undefined) { fields.push('acta_numero = ?');   params.push(acta_numero); }
    if (acta_firmada  !== undefined) { fields.push('acta_firmada = ?');  params.push(acta_firmada); }

    // Campos de contenido: sobreescribir cuando vienen
    if (destinatario  !== undefined) { fields.push('destinatario = ?');  params.push(destinatario); }
    if (cedula        !== undefined) { fields.push('cedula = ?');        params.push(cedula || null); }
    if (sede          !== undefined) { fields.push('sede = ?');          params.push(sede || null); }
    if (area          !== undefined) { fields.push('area = ?');          params.push(area || null); }
    if (articulos     !== undefined) { fields.push('articulos = ?');     params.push(JSON.stringify(articulos)); }
    if (observaciones !== undefined) { fields.push('observaciones = ?'); params.push(observaciones || null); }
    if (requiere_acta !== undefined) { fields.push('requiere_acta = ?'); params.push(requiere_acta ? 1 : 0); }
    if (ticket_id     !== undefined) { fields.push('ticket_id = ?');     params.push(ticket_id || null); }

    if (!fields.length) return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });

    params.push(id);
    db.prepare(`UPDATE despachos SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare('SELECT * FROM despachos WHERE id = ?').get(id);
    logAudit(agente || 'Sistema', 'Despacho actualizado', 'despacho', id, row?.numero, { acta_firmada, destinatario });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/despachos/:id/acta-word — genera acta Word con plantilla corporativa
router.post('/api/despachos/:id/acta-word', ...canRead, async (req, res) => {
  try {
    const d = db.prepare('SELECT * FROM despachos WHERE id = ?').get(parseInt(req.params.id));
    if (!d) return res.status(404).json({ error: 'Despacho no encontrado.' });

    const articulos = JSON.parse(d.articulos || '[]');
    const items = articulos.map(a => ({
      equipment_name: a.nombre || a.descripcion || a.articulo || 'Artículo',
      quantity: a.cantidad || a.qty || 1,
      serial: a.serial || '',
    }));
    if (items.length === 0) items.push({ equipment_name: 'Ver observaciones', quantity: 1, serial: '' });

    const requestObj = {
      request_number: d.acta_numero || d.numero,
      requester_name: d.destinatario || '',
      cedula: d.cedula || '',
      cargo: d.area || '',
      sede: d.sede || '',
      items,
    };

    const eqItems = articulos.map(a => ({
      marca: a.marca || '',
      modelo: a.modelo || '',
      serial: a.serial || '',
      accesorios: '',
      observaciones: d.observaciones || '',
    }));
    if (eqItems.length === 0) {
      eqItems.push({ marca: '', modelo: '', serial: '', accesorios: '', observaciones: d.observaciones || '' });
    }

    const buffer = await generateActa(requestObj, eqItems, d.agente || 'Soporte IT');
    const filename = `Acta_${(d.acta_numero || d.numero).replace(/\//g, '-')}_${(d.destinatario || '').replace(/\s+/g, '_')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (e) {
    console.error('Error generando acta Word despacho:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
