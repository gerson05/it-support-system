import express  from 'express';
import crypto   from 'crypto';
import db       from '../config/database.js';
import { logAudit }          from '../audit/audit-logger.js';
import { generateActa }      from '../tech-requests/acta-generator.js';
import { logDespacho }       from '../excel/excel-logger.js';
import { logDespachoSheet }  from '../excel/sheets-logger.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { createTracking }    from '../tracking/tracking-model.js';
import {
  generateNumero, generateActaNumero,
  getDespachos, getDespachoById, insertDespacho, patchDespacho, deleteDespacho,
  getBorrador, upsertBorrador, deleteBorrador,
  getTiposArticulo, upsertTipoArticulo, deactivateTipoArticulo,
  getConfirmacion, createConfirmacion, getConfirmacionByToken, confirmDelivery,
} from './despacho-model.js';
import { escHtml, confirmarPage } from './confirmacion-page.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('despacho:read')];
const canCreate = [requireAuth, requirePermission('despacho:create')];
const canEdit   = [requireAuth, requirePermission('despacho:edit')];
const canDelete = [requireAuth, requirePermission('despacho:delete')];

/* ── Despachos CRUD ──────────────────────────────────────────────────── */

router.get('/api/despachos', ...canRead, (req, res) => {
  try {
    res.json(getDespachos(db, req.query));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/despachos/borrador', ...canRead, (req, res) => {
  try {
    const { agente } = req.query;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    res.json({ borrador: getBorrador(db, agente) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/api/despachos/borrador', ...canEdit, (req, res) => {
  try {
    if (!req.body.agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    upsertBorrador(db, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/despachos/borrador', ...canEdit, (req, res) => {
  try {
    const { agente } = req.query;
    if (!agente) return res.status(400).json({ error: 'agente es obligatorio.' });
    deleteBorrador(db, agente);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/despachos/:id', ...canRead, (req, res) => {
  try {
    const row = getDespachoById(db, parseInt(req.params.id));
    if (!row) return res.status(404).json({ error: 'Despacho no encontrado.' });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/despachos', ...canCreate, (req, res) => {
  try {
    const { destinatario, cedula, sede, area, articulos, observaciones,
            requiere_acta = 0, ticket_id, agente } = req.body;
    if (!destinatario || !articulos?.length)
      return res.status(400).json({ error: 'Destinatario y artículos son obligatorios.' });

    const numero      = generateNumero(db);
    const acta_numero = requiere_acta ? generateActaNumero(db) : null;
    const id          = insertDespacho(db, { numero, destinatario, cedula, sede, area,
                                             articulos, observaciones, requiere_acta,
                                             acta_numero, ticket_id, agente });

    logAudit(agente || 'Sistema', 'Despacho creado', 'despacho', id, numero, { destinatario, sede });

    const desData = { numero, destinatario, sede, area, articulos, observaciones, requiere_acta, acta_numero, agente };
    logDespacho(desData).catch(err => console.error('[excel-logger] despacho:', err.message));
    logDespachoSheet(desData).catch(err => console.error('[sheets-logger] despacho:', err.message));

    try {
      createTracking(db, id, agente || 'IT', 'Bodega Central');
    } catch (err) {
      console.error('[tracking] Error al crear tracking:', err.message);
    }

    res.json({ success: true, id, numero });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/api/despachos/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      acta_numero, acta_firmada,
      destinatario, cedula, sede, area, articulos, observaciones, requiere_acta, ticket_id,
      fecha, agente,
    } = req.body;

    const fieldMap = {};
    if (acta_numero   !== undefined) fieldMap.acta_numero   = acta_numero;
    if (acta_firmada  !== undefined) fieldMap.acta_firmada  = acta_firmada;
    if (destinatario  !== undefined) fieldMap.destinatario  = destinatario;
    if (cedula        !== undefined) fieldMap.cedula        = cedula || null;
    if (sede          !== undefined) fieldMap.sede          = sede || null;
    if (area          !== undefined) fieldMap.area          = area || null;
    if (fecha         !== undefined) fieldMap.fecha         = fecha || null;
    if (articulos     !== undefined) fieldMap.articulos     = JSON.stringify(articulos);
    if (observaciones !== undefined) fieldMap.observaciones = observaciones || null;
    if (requiere_acta !== undefined) fieldMap.requiere_acta = requiere_acta ? 1 : 0;
    if (ticket_id     !== undefined) fieldMap.ticket_id     = ticket_id || null;

    if (!Object.keys(fieldMap).length)
      return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });

    patchDespacho(db, id, fieldMap);
    const row = getDespachoById(db, id);
    logAudit(agente || 'Sistema', 'Despacho actualizado', 'despacho', id, row?.numero, { acta_firmada, destinatario });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/despachos/:id', ...canDelete, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const row = getDespachoById(db, id);
    if (!row) return res.status(404).json({ error: 'Despacho no encontrado.' });
    deleteDespacho(db, id);
    logAudit(req.user?.username || 'Sistema', 'Despacho eliminado', 'despacho', id, row.numero, { destinatario: row.destinatario });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/despachos/:id/acta-word', ...canRead, async (req, res) => {
  try {
    const d = getDespachoById(db, parseInt(req.params.id));
    if (!d) return res.status(404).json({ error: 'Despacho no encontrado.' });

    const articulos = JSON.parse(d.articulos || '[]');
    const items     = articulos.length
      ? articulos.map(a => ({ equipment_name: a.nombre || a.descripcion || a.articulo || 'Artículo', quantity: a.cantidad || a.qty || 1, serial: a.serial || '' }))
      : [{ equipment_name: 'Ver observaciones', quantity: 1, serial: '' }];

    const eqItems = articulos.length
      ? articulos.map(a => ({ marca: a.marca || '', modelo: a.modelo || '', serial: a.serial || '', accesorios: '', observaciones: d.observaciones || '' }))
      : [{ marca: '', modelo: '', serial: '', accesorios: '', observaciones: d.observaciones || '' }];

    const buffer   = await generateActa({ request_number: d.acta_numero || d.numero, requester_name: d.destinatario || '', cedula: d.cedula || '', cargo: d.area || '', sede: d.sede || '', fecha: d.fecha || null, items }, eqItems, d.agente || 'Soporte IT');
    const filename = `Acta_${(d.acta_numero || d.numero).replace(/\//g, '-')}_${(d.destinatario || '').replace(/\s+/g, '_')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (e) {
    console.error('Error generando acta Word despacho:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ── Tipos de artículo ───────────────────────────────────────────────── */

router.get('/api/tipos-articulo', ...canRead, (req, res) => {
  try { res.json(getTiposArticulo(db)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/tipos-articulo', ...canEdit, (req, res) => {
  try {
    const nombre = (req.body.nombre || '').trim().toUpperCase();
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido.' });
    res.json(upsertTipoArticulo(db, nombre));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/tipos-articulo/:id', ...canEdit, (req, res) => {
  try {
    deactivateTipoArticulo(db, parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Confirmaciones de entrega ───────────────────────────────────────── */

router.get('/api/despachos/:id/confirmacion', ...canRead, (req, res) => {
  try {
    const row = getConfirmacion(db, parseInt(req.params.id));
    if (!row) return res.json({ token: null, confirmed: false });
    res.json({ token: row.token, confirmed: !!row.confirmed_at, confirmed_at: row.confirmed_at || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/api/despachos/:id/confirmacion', ...canEdit, (req, res) => {
  try {
    const despachoId = parseInt(req.params.id);
    const d = getDespachoById(db, despachoId);
    if (!d) return res.status(404).json({ error: 'Despacho no encontrado.' });
    if (d.requiere_acta) return res.status(400).json({ error: 'Este despacho requiere acta firmada.' });

    const existing = getConfirmacion(db, despachoId);
    if (existing) return res.json({ token: existing.token });

    const token = crypto.randomBytes(20).toString('hex');
    createConfirmacion(db, despachoId, token);
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/confirmar/:token', (req, res) => {
  try {
    const row = getConfirmacionByToken(db, req.params.token);
    if (!row) return res.status(404).send('<h2>Enlace no válido.</h2>');
    let arts = [];
    try { arts = JSON.parse(row.articulos || '[]'); } catch {}
    const artRows = arts.map(a => `
      <div class="art-row">
        <span class="art-nombre">${escHtml(a.nombre || a.descripcion || '—')}</span>
        <span class="art-qty">× ${a.cantidad || 1}</span>
      </div>`).join('');
    res.send(confirmarPage(row, artRows, !!row.confirmed_at));
  } catch (e) { res.status(500).send('<h2>Error interno.</h2>'); }
});

router.post('/confirmar/:token', express.urlencoded({ extended: false }), (req, res) => {
  try {
    const row = getConfirmacionByToken(db, req.params.token);
    if (!row) return res.status(404).send('<h2>Enlace no válido.</h2>');
    if (row.confirmed_at) return res.redirect('/confirmar/' + req.params.token);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    confirmDelivery(db, row.id, ip);
    res.redirect('/confirmar/' + req.params.token);
  } catch (e) { res.status(500).send('<h2>Error interno.</h2>'); }
});

export default router;
