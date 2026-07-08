import express from 'express';
import db from '../config/database.js';
import {
  createTechRequest,
  getAllTechRequests,
  getTechRequestById,
  updateTechRequest,
  replaceRequestItems,
  addTechRequestNote,
  getTechRequestStats,
  deleteTechRequest,
} from './tech-request-model.js';
import { generateActa } from './acta-generator.js';
import { appEvents } from '../events/broadcaster.js';
import { logTechRequest, updateTechRequestRow } from '../excel/excel-logger.js';
import { logTechRequestSheet, updateTechRequestSheet } from '../excel/sheets-logger.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('tech-requests:read')];
const canCreate = [requireAuth, requirePermission('tech-requests:create')];
const canEdit   = [requireAuth, requirePermission('tech-requests:edit')];
const canDelete = [requireAuth, requirePermission('tech-requests:delete')];

router.get('/api/tech-requests/stats', ...canRead, wrap(async (req, res) => {
  res.json(getTechRequestStats(db));
}));

router.get('/api/tech-requests', ...canRead, wrap(async (req, res) => {
  const filters = {
    type:        req.query.type,
    status:      req.query.status,
    sede:        req.query.sede,
    priority:    req.query.priority,
    assigned_to: req.query.assigned_to,
    search:      req.query.search,
    page:        req.query.page  ? parseInt(req.query.page)  : 1,
    limit:       req.query.limit ? parseInt(req.query.limit) : 15,
  };
  res.json(getAllTechRequests(db, filters));
}));

router.post('/api/tech-requests', ...canCreate, wrap(async (req, res) => {
  const {
    type, requester_name, cedula, cargo, sede,
    description, quantity,
    equipment_name, equipment_serial,
    priority,
  } = req.body;

  const missing = ['type','requester_name','cedula','cargo','sede','description']
    .filter(f => !req.body[f]?.trim?.());
  if (missing.length) {
    return res.status(400).json({ error: `Campos requeridos faltantes: ${missing.join(', ')}` });
  }
  if (!['requerimiento','incidencia'].includes(type)) {
    return res.status(400).json({ error: 'El tipo debe ser "requerimiento" o "incidencia".' });
  }

  const result = createTechRequest(db, req.body);
  appEvents.emit('tech-request:created', { id: result.id, request_number: result.request_number, type });

  const trData = {
    tipo:             type,
    numero:           result.request_number,
    requester_name,   cedula, cargo, sede,
    description,      priority,
    equipment_name,   equipment_serial,
    items:            req.body.items || [],
  };
  logTechRequest(trData).catch(err => console.error('[excel-logger] tech-request:', err.message));
  logTechRequestSheet(trData).catch(err => console.error('[sheets-logger] tech-request:', err.message));

  res.status(201).json({ success: true, ...result });
}));

router.get('/api/tech-requests/:id', ...canRead, wrap(async (req, res) => {
  const req2 = getTechRequestById(db, parseInt(req.params.id));
  if (!req2) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  res.json(req2);
}));

router.put('/api/tech-requests/:id', ...canEdit, wrap(async (req, res) => {
  const id        = parseInt(req.params.id);
  const agentName = req.body.agentName || 'IT';
  const updated   = updateTechRequest(db, id, req.body, agentName);
  if (!updated) return res.status(404).json({ error: 'Solicitud no encontrada o sin cambios.' });
  appEvents.emit('tech-request:updated', { id });

  if (Array.isArray(req.body.items)) {
    replaceRequestItems(db, id, req.body.items);
  }

  if (req.body.status) {
    const row = db.prepare('SELECT request_number FROM tech_requests WHERE id = ?').get(id);
    if (row) {
      updateTechRequestRow(row.request_number, req.body.status)
        .catch(err => console.error('[excel-logger] update status:', err.message));
      updateTechRequestSheet(row.request_number, req.body.status)
        .catch(err => console.error('[sheets-logger] update status:', err.message));
    }
  }

  res.json({ success: true, message: 'Solicitud actualizada.' });
}));

router.delete('/api/tech-requests/:id', ...canDelete, wrap(async (req, res) => {
  const deleted = deleteTechRequest(db, parseInt(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  appEvents.emit('tech-request:deleted', { id: parseInt(req.params.id) });
  res.json({ success: true });
}));

router.post('/api/tech-requests/:id/notes', ...canEdit, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  const { agentName, content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'El contenido es requerido.' });

  addTechRequestNote(db, id, agentName || 'IT', content);
  appEvents.emit('tech-request:updated', { id });
  res.json({ success: true });
}));

router.post('/api/tech-requests/:id/acta', ...canEdit, wrap(async (req, res) => {
  const id  = parseInt(req.params.id);
  const req2 = getTechRequestById(db, id);
  if (!req2) return res.status(404).json({ error: 'Solicitud no encontrada.' });

  const { items, accesorios, observaciones, agentName } = req.body;

  let eqItems;
  if (req2.type === 'incidencia') {
    const { marca = '', modelo = '', serial = '' } = items?.[0] || {};
    eqItems = [{ marca, modelo, serial: serial || req2.equipment_serial || '', accesorios, observaciones }];
    if (!req2.items || req2.items.length === 0) {
      req2.items = [{ equipment_name: req2.equipment_name || 'Equipo', quantity: 1, serial: req2.equipment_serial || '' }];
    }
  } else {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un equipo para generar el acta.' });
    }
    if (!items[0].marca || !items[0].modelo) {
      return res.status(400).json({ error: 'Marca y Modelo son obligatorios para el primer equipo.' });
    }
    eqItems = items.map(item => ({
      marca: item.marca || '',
      modelo: item.modelo || '',
      serial: item.serial || '',
      imei: item.imei || '',
      accesorios,
      observaciones,
    }));
  }

  const buffer = await generateActa(req2, eqItems, agentName || 'Soporte IT');

  const filename = `Acta_Entrega_${req2.request_number}_${req2.requester_name.replace(/\s+/g, '_')}.docx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
}));

export default router;
