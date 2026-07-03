import express from 'express';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import {
  getAllEmployees, getEmployeeById,
  createEmployee, completeEmployee, updateEmployee, deleteEmployee,
  getCargos, getAreas, getPendingCount,
} from './employees-model.js';
import { appEvents } from '../events/broadcaster.js';
import { sendWhatsAppMessage } from '../whatsapp/messenger.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('employees:read')];
const canCreate = [requireAuth, requirePermission('employees:create')];
const canEdit   = [requireAuth, requirePermission('employees:edit')];
const canDelete = [requireAuth, requirePermission('employees:delete')];

// GET /api/employees
router.get('/api/employees', ...canRead, (req, res) => {
  try {
    res.json(getAllEmployees());
  } catch (err) {
    console.error('[employees] GET /api/employees:', err.message);
    res.status(500).json({ error: 'Error al obtener empleados.' });
  }
});

// GET /api/employees/:id
router.get('/api/employees/:id', ...canRead, (req, res) => {
  try {
    const emp = getEmployeeById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json(emp);
  } catch (err) {
    console.error('[employees] GET /api/employees/:id:', err.message);
    res.status(500).json({ error: 'Error al obtener empleado.' });
  }
});

// POST /api/employees  (Gestión Humana crea)
router.post('/api/employees', ...canCreate, (req, res) => {
  try {
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
    console.error('[employees] POST /api/employees:', err.message);
    res.status(500).json({ error: 'Error al crear empleado.' });
  }
});

// PUT /api/employees/:id  (GH edita datos, IT agrega fecha → auto-genera credenciales)
router.put('/api/employees/:id', ...canEdit, async (req, res) => {
  try {
    const id = req.params.id;
    if (!getEmployeeById(id)) return res.status(404).json({ error: 'Empleado no encontrado.' });

    const { fecha_respuesta_soporte, nombre_completo, cargo, area } = req.body;

    if (fecha_respuesta_soporte) {
      // IT completa: genera usuario + contraseña automáticamente
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
    console.error('[employees] PUT /api/employees/:id:', err.message);
    res.status(500).json({ error: 'Error al actualizar empleado.' });
  }
});

// DELETE /api/employees/:id
router.delete('/api/employees/:id', ...canDelete, (req, res) => {
  try {
    deleteEmployee(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Empleado no encontrado.' });
    console.error('[employees] DELETE /api/employees/:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar empleado.' });
  }
});

// GET /api/employees/pending-count
router.get('/api/employees/pending-count', ...canRead, (req, res) => {
  try { res.json({ count: getPendingCount() }); }
  catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// GET /api/employees-data/cargos
router.get('/api/employees-data/cargos', ...canRead, (req, res) => {
  try { res.json(getCargos()); }
  catch (err) { res.status(500).json({ error: 'Error al obtener cargos.' }); }
});

// GET /api/employees-data/areas
router.get('/api/employees-data/areas', ...canRead, (req, res) => {
  try { res.json(getAreas()); }
  catch (err) { res.status(500).json({ error: 'Error al obtener áreas.' }); }
});

export default router;
