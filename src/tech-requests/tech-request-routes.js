import express from 'express';
import db from '../config/database.js';
import {
  createTechRequest,
  getAllTechRequests,
  getTechRequestById,
  updateTechRequest,
  addTechRequestNote,
  getTechRequestStats,
} from './tech-request-model.js';
import { generateActa } from './acta-generator.js';
import { appEvents } from '../events/broadcaster.js';

const router = express.Router();

/* ── Estadísticas generales del módulo ── */
router.get('/api/tech-requests/stats', (req, res) => {
  try {
    res.json(getTechRequestStats(db));
  } catch (err) {
    console.error('Error en GET /api/tech-requests/stats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

/* ── Listar solicitudes con filtros y paginación ── */
router.get('/api/tech-requests', (req, res) => {
  try {
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
  } catch (err) {
    console.error('Error en GET /api/tech-requests:', err);
    res.status(500).json({ error: 'Error al consultar solicitudes.' });
  }
});

/* ── Crear nueva solicitud ── */
router.post('/api/tech-requests', (req, res) => {
  try {
    const {
      type, requester_name, cedula, cargo, sede,
      description, quantity,
      equipment_name, equipment_serial,
      priority,
    } = req.body;

    // Validaciones obligatorias
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
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('Error en POST /api/tech-requests:', err);
    res.status(500).json({ error: 'Error al crear la solicitud.' });
  }
});

/* ── Detalle de una solicitud ── */
router.get('/api/tech-requests/:id', (req, res) => {
  try {
    const req2 = getTechRequestById(db, parseInt(req.params.id));
    if (!req2) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    res.json(req2);
  } catch (err) {
    console.error('Error en GET /api/tech-requests/:id:', err);
    res.status(500).json({ error: 'Error al obtener la solicitud.' });
  }
});

/* ── Actualizar solicitud (estado, prioridad, asignación) ── */
router.put('/api/tech-requests/:id', (req, res) => {
  try {
    const id        = parseInt(req.params.id);
    const agentName = req.body.agentName || 'IT';
    const updated   = updateTechRequest(db, id, req.body, agentName);
    if (!updated) return res.status(404).json({ error: 'Solicitud no encontrada o sin cambios.' });
    appEvents.emit('tech-request:updated', { id });
    res.json({ success: true, message: 'Solicitud actualizada.' });
  } catch (err) {
    console.error('Error en PUT /api/tech-requests/:id:', err);
    res.status(500).json({ error: 'Error al actualizar la solicitud.' });
  }
});

/* ── Agregar nota interna ── */
router.post('/api/tech-requests/:id/notes', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { agentName, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'El contenido es requerido.' });

    addTechRequestNote(db, id, agentName || 'IT', content);
    appEvents.emit('tech-request:updated', { id });
    res.json({ success: true });
  } catch (err) {
    console.error('Error en POST /api/tech-requests/:id/notes:', err);
    res.status(500).json({ error: 'Error al agregar la nota.' });
  }
});

/* ── Generar Acta de Entrega (.docx) ── */
router.post('/api/tech-requests/:id/acta', async (req, res) => {
  try {
    const id  = parseInt(req.params.id);
    const req2 = getTechRequestById(db, id);
    if (!req2) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (req2.type !== 'requerimiento') {
      return res.status(400).json({ error: 'El acta de entrega solo aplica para requerimientos.' });
    }

    const { items, accesorios, observaciones, agentName } = req.body;

    // items: [{ idx, marca, modelo, serial }, ...]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un equipo para generar el acta.' });
    }
    if (!items[0].marca || !items[0].modelo) {
      return res.status(400).json({ error: 'Marca y Modelo son obligatorios para el primer equipo.' });
    }

    const buffer = await generateActa(
      req2,
      items.map(item => ({
        marca: item.marca || '',
        modelo: item.modelo || '',
        serial: item.serial || '',
        imei: item.imei || '',
        accesorios,
        observaciones,
      })),
      agentName || 'Soporte IT',
    );

    const filename = `Acta_Entrega_${req2.request_number}_${req2.requester_name.replace(/\s+/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);

  } catch (err) {
    console.error('Error generando acta:', err);
    res.status(500).json({ error: 'Error al generar el documento.' });
  }
});

export default router;
