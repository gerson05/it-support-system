import express from 'express';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import {
  getAllEmployees, getEmployeeById,
  createEmployee, completeEmployee, updateEmployee, deleteEmployee,
  getCargos, createCargo, getAreas, getPendingCount,
} from './employees-model.js';
import { appEvents } from '../events/broadcaster.js';
import { sendWhatsAppMessage } from '../whatsapp/messenger.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('employees:read')];
const canCreate = [requireAuth, requirePermission('employees:create')];
const canEdit   = [requireAuth, requirePermission('employees:edit')];
const canDelete = [requireAuth, requirePermission('employees:delete')];

router.get('/api/employees', ...canRead, wrap(async (req, res) => {
  res.json(getAllEmployees());
}));

router.get('/api/employees/pending-count', ...canRead, wrap(async (req, res) => {
  res.json({ count: getPendingCount() });
}));

router.get('/api/employees/:id', ...canRead, wrap(async (req, res) => {
  const emp = getEmployeeById(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
  res.json(emp);
}));

router.post('/api/employees', ...canCreate, wrap(async (req, res) => {
  const { cedula, nombre_completo, cargo, area } = req.body;

  if (!cedula || !/^\d{8,12}$/.test(String(cedula).trim())) {
    return res.status(400).json({ error: 'Cédula debe tener 8-12 dígitos.' });
  }
  if (!nombre_completo || nombre_completo.trim().length < 3) {
    return res.status(400).json({ error: 'Nombre debe tener al menos 3 caracteres.' });
  }
  if (!cargo || !area) {
    return res.status(400).json({ error: 'Cargo y área son requeridos.' });
  }

  try {
    const id = createEmployee({
      cedula: String(cedula).trim(),
      nombre_completo: nombre_completo.trim(),
      cargo: cargo.trim(),
      area: area.trim(),
      created_by: req.user.id,
    });

    const payload = { id, nombre_completo: nombre_completo.trim(), cargo: cargo.trim(), area: area.trim() };
    appEvents.emit('employee:created', payload);

    const itNumber = process.env.IT_WHATSAPP_NUMBER;
    if (itNumber) {
      sendWhatsAppMessage(itNumber,
        `🔔 *Nuevo empleado pendiente de credenciales*\n👤 ${payload.nombre_completo}\n💼 ${payload.cargo} | ${payload.area}\n\nIngresa al panel → Crear Usuarios para generar accesos.`
      ).catch(() => {});
    }

    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.code === 'CEDULA_EXISTS') return res.status(409).json({ error: 'Cédula ya registrada.' });
    throw err;
  }
}));

router.put('/api/employees/:id', ...canEdit, wrap(async (req, res) => {
  const id = req.params.id;
  if (!getEmployeeById(id)) return res.status(404).json({ error: 'Empleado no encontrado.' });

  const { fecha_respuesta_soporte, nombre_completo, cargo, area } = req.body;

  try {
    if (fecha_respuesta_soporte) {
      updateEmployee(id, { nombre_completo, cargo, area }, req.user.id);
      const creds = completeEmployee(id, fecha_respuesta_soporte, req.user.id);
      appEvents.emit('employee:credentialed', { pending: getPendingCount() });
      return res.json({ ok: true, ...creds, ...getEmployeeById(id) });
    }

    updateEmployee(id, { nombre_completo, cargo, area }, req.user.id);
    res.json({ ok: true, ...getEmployeeById(id) });
  } catch (err) {
    if (err.code === 'NOT_FOUND')     return res.status(404).json({ error: 'Empleado no encontrado.' });
    if (err.code === 'FECHA_REQUIRED') return res.status(400).json({ error: 'Fecha requerida.' });
    throw err;
  }
}));

router.delete('/api/employees/:id', ...canDelete, wrap(async (req, res) => {
  try {
    deleteEmployee(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Empleado no encontrado.' });
    throw err;
  }
}));

router.get('/api/employees-data/cargos', ...canRead, wrap(async (req, res) => {
  res.json(getCargos());
}));

router.post('/api/employees-data/cargos', ...canEdit, wrap(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'Nombre requerido.' });
  const cargo = createCargo(String(nombre).trim());
  res.status(201).json(cargo);
}));

router.get('/api/employees-data/areas', ...canRead, wrap(async (req, res) => {
  res.json(getAreas());
}));

export default router;
