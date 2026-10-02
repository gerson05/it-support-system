import express from 'express';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import {
  getAllEmployees, getEmployeeById,
  createEmployee, completeEmployee, updateEmployee, deleteEmployee, setMantisResult,
  getCargos, createCargo, getAreas, getPendingCount,
  suggestUsername, claveDesdeCedula,
} from './employees-model.js';
import { buildMantisPayload, createUser as createMantisUser, isMantisConfigured } from '../mantis/mantis-client.js';
import { appEvents } from '../events/broadcaster.js';
import { sendWhatsAppMessage } from '../whatsapp/messenger.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('employees:read')];
const canCreate = [requireAuth, requirePermission('employees:create')];
const canEdit   = [requireAuth, requirePermission('employees:edit')];
const canDelete = [requireAuth, requirePermission('employees:delete')];

/** Errores de validación del modelo → respuesta HTTP. */
const MODEL_ERRORS = {
  BAD_PERFIL: 400, BAD_BODEGA: 400, NO_COMPROBANTE: 400, BAD_COMPROBANTE: 400,
  MISSING_FIELDS: 400, CEDULA_EXISTS: 409, NOT_FOUND: 404, FECHA_REQUIRED: 400,
};
const MODEL_MESSAGES = {
  CEDULA_EXISTS: 'Cédula ya registrada.',
  NOT_FOUND: 'Empleado no encontrado.',
  FECHA_REQUIRED: 'Fecha requerida.',
};
function sendModelError(res, err) {
  const status = MODEL_ERRORS[err.code];
  if (!status) throw err;
  return res.status(status).json({ error: MODEL_MESSAGES[err.code] || err.message, code: err.code });
}

const hasValue = (v) => v !== undefined && v !== null && v !== '';

router.get('/api/employees', ...canRead, wrap(async (req, res) => {
  res.json(await getAllEmployees());
}));

router.get('/api/employees/pending-count', ...canRead, wrap(async (req, res) => {
  res.json({ count: await getPendingCount() });
}));

/** Usuario sugerido según la regla de Mantis (GGOSORIO, LDHERRERA…). */
router.get('/api/employees/sugerir-usuario', ...canCreate, wrap(async (req, res) => {
  const nombre = String(req.query.nombre || '').trim();
  res.json({ usuario: nombre ? await suggestUsername(nombre) : '' });
}));

/** Clave = últimos 4 dígitos de la cédula. */
router.get('/api/employees/sugerir-clave', ...canCreate, wrap(async (req, res) => {
  const cedula = String(req.query.cedula || '').replace(/\D/g, '');
  res.json({ clave: cedula ? claveDesdeCedula(cedula) : '' });
}));

router.get('/api/employees/mantis-status', ...canRead, wrap(async (req, res) => {
  res.json({ configured: isMantisConfigured() });
}));

router.get('/api/employees/:id', ...canRead, wrap(async (req, res) => {
  const emp = await getEmployeeById(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
  res.json(emp);
}));

router.post('/api/employees', ...canCreate, wrap(async (req, res) => {
  const { cedula, nombre_completo, cargo, area, perfil_codigo, bodega_codigo, comprobante } = req.body;
  const mantis = hasValue(perfil_codigo);

  if (!cedula || !/^\d{8,12}$/.test(String(cedula).trim())) {
    return res.status(400).json({ error: 'Cédula debe tener 8-12 dígitos.' });
  }
  if (!nombre_completo || nombre_completo.trim().length < 3) {
    return res.status(400).json({ error: 'Nombre debe tener al menos 3 caracteres.' });
  }
  if (mantis && !hasValue(bodega_codigo)) {
    return res.status(400).json({ error: 'Selecciona la sede.' });
  }
  if (!mantis && (!cargo || !area)) {
    return res.status(400).json({ error: 'Cargo y área son requeridos.' });
  }

  try {
    const created = await createEmployee({
      cedula: String(cedula).trim(),
      nombre_completo: nombre_completo.trim(),
      cargo: cargo?.trim(),
      area: area?.trim(),
      perfil_codigo, bodega_codigo, comprobante,
      created_by: req.user.id,
    });
    const emp = await getEmployeeById(created.id);

    const payload = { id: created.id, nombre_completo: emp.nombre_completo, cargo: emp.cargo, area: emp.area };
    appEvents.emit('employee:created', payload);

    const itNumber = process.env.IT_WHATSAPP_NUMBER;
    if (itNumber) {
      sendWhatsAppMessage(itNumber,
        `🔔 *Nuevo empleado pendiente ${mantis ? 'de crear en Mantis' : 'de credenciales'}*\n👤 ${payload.nombre_completo}\n💼 ${payload.cargo} | ${payload.area}\n\nIngresa al panel → Crear Usuarios.`
      ).catch(() => {});
    }

    res.status(201).json({ ok: true, ...created, empleado: emp });
  } catch (err) {
    return sendModelError(res, err);
  }
}));

router.put('/api/employees/:id', ...canEdit, wrap(async (req, res) => {
  const id = req.params.id;
  if (!await getEmployeeById(id)) return res.status(404).json({ error: 'Empleado no encontrado.' });

  const { fecha_respuesta_soporte, nombre_completo, cargo, area,
    perfil_codigo, bodega_codigo, comprobante } = req.body;
  const data = { nombre_completo, cargo, area, perfil_codigo, bodega_codigo, comprobante };

  try {
    if (fecha_respuesta_soporte) {
      await updateEmployee(id, data, req.user.id);
      const creds = await completeEmployee(id, fecha_respuesta_soporte, req.user.id);
      appEvents.emit('employee:credentialed', { pending: await getPendingCount() });
      return res.json({ ok: true, ...creds, ...await getEmployeeById(id) });
    }

    await updateEmployee(id, data, req.user.id);
    res.json({ ok: true, ...await getEmployeeById(id) });
  } catch (err) {
    return sendModelError(res, err);
  }
}));

/** Envía el empleado a Mantis por API (cuando esté configurada). */
router.post('/api/employees/:id/mantis', ...canEdit, wrap(async (req, res) => {
  const emp = await getEmployeeById(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
  if (!emp.mantis_estado) return res.status(400).json({ error: 'Este empleado no tiene datos de Mantis.' });

  try {
    await createMantisUser(buildMantisPayload(emp));
  } catch (err) {
    if (err.code === 'MANTIS_NOT_CONFIGURED') return res.status(501).json({ error: err.message, code: err.code });
    await setMantisResult(emp.id, { ok: false, error: err.message });
    return res.status(502).json({ error: `Mantis respondió con error: ${err.message}`, code: err.code });
  }

  await setMantisResult(emp.id, { ok: true });
  appEvents.emit('employee:credentialed', { pending: await getPendingCount() });
  res.json({ ok: true, ...await getEmployeeById(emp.id) });
}));

router.delete('/api/employees/:id', ...canDelete, wrap(async (req, res) => {
  try {
    await deleteEmployee(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    return sendModelError(res, err);
  }
}));

router.get('/api/employees-data/cargos', ...canRead, wrap(async (req, res) => {
  res.json(await getCargos());
}));

router.post('/api/employees-data/cargos', ...canEdit, wrap(async (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'Nombre requerido.' });
  const cargo = await createCargo(String(nombre).trim());
  res.status(201).json(cargo);
}));

router.get('/api/employees-data/areas', ...canRead, wrap(async (req, res) => {
  res.json(await getAreas());
}));

export default router;
