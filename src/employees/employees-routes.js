import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  completeEmployee,
  updateEmployee,
  deleteEmployee,
  getCargos,
  getAreas,
  generateUsername,
  generatePassword,
  ensureUniqueUsername,
  ensureUniquePassword
} from './employees-model.js';

const router = express.Router();

/**
 * GET /api/employees
 * Obtener lista de empleados con filtros opcionales
 */
router.get('/api/employees', requireAuth, (req, res) => {
  try {
    const filters = {
      search: req.query.search || '',
      area: req.query.area || '',
      cargo: req.query.cargo || '',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = getAllEmployees(db, filters);
    res.json(result);
  } catch (err) {
    console.error('[EMPLOYEES] GET /api/employees error:', err.message);
    res.status(500).json({ error: 'Error al obtener empleados' });
  }
});

/**
 * GET /api/employees/:id
 * Obtener detalles de un empleado específico
 */
router.get('/api/employees/:id', requireAuth, (req, res) => {
  try {
    const employee = getEmployeeById(db, req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    res.json(employee);
  } catch (err) {
    console.error('[EMPLOYEES] GET /api/employees/:id error:', err.message);
    res.status(500).json({ error: 'Error al obtener empleado' });
  }
});

/**
 * POST /api/employees
 * Crear nuevo empleado (solo Gestión Humana)
 * Validación:
 * - cedula: 8-12 dígitos
 * - nombre: >= 3 caracteres
 * - cargo y area requeridos
 */
router.post('/api/employees', requireAuth, requirePermission('rh'), (req, res) => {
  try {
    const { cedula, nombre_completo, area, cargo } = req.body;

    // Validar cedula (8-12 dígitos)
    const cedulaRegex = /^\d{8,12}$/;
    if (!cedula || !cedulaRegex.test(String(cedula).trim())) {
      return res.status(400).json({ error: 'CEDULA_INVALID', message: 'Cédula debe contener 8-12 dígitos' });
    }

    // Validar nombre (>= 3 caracteres)
    if (!nombre_completo || nombre_completo.trim().length < 3) {
      return res.status(400).json({ error: 'NOMBRE_INVALID', message: 'Nombre debe tener al menos 3 caracteres' });
    }

    // Validar cargo y area requeridos
    if (!cargo || !area) {
      return res.status(400).json({ error: 'INVALID_CARGO_OR_AREA', message: 'Cargo y área son requeridos' });
    }

    // Verificar si cédula ya existe
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM employees WHERE cedula = ?').get(String(cedula).trim());
    if (existing.cnt > 0) {
      return res.status(409).json({ error: 'CEDULA_EXISTS', message: 'Esta cédula ya está registrada' });
    }

    // Crear empleado
    const result = createEmployee(db, {
      cedula: String(cedula).trim(),
      nombre_completo: nombre_completo.trim(),
      area: area.trim(),
      cargo: cargo.trim()
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('[EMPLOYEES] POST /api/employees error:', err.message);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

/**
 * PUT /api/employees/:id
 * Actualizar empleado (ambos roles)
 * Lógica:
 * - Si fecha_respuesta_soporte está presente: llama completeEmployee
 * - Si no: llama updateEmployee
 * - Si fecha_respuesta_soporte y no está presente: error 400
 */
router.put('/api/employees/:id', requireAuth, (req, res) => {
  try {
    const { fecha_respuesta_soporte, ...updateData } = req.body;

    // Validar que el empleado existe
    const employee = getEmployeeById(db, req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'EMPLOYEE_NOT_FOUND', message: 'Empleado no encontrado' });
    }

    let result;

    // Si se proporciona fecha_respuesta_soporte, usar completeEmployee
    if (fecha_respuesta_soporte !== undefined && fecha_respuesta_soporte !== null) {
      result = completeEmployee(db, req.params.id, updateData);
    } else if (Object.keys(updateData).length > 0) {
      // Si hay otros datos para actualizar, usar updateEmployee
      result = updateEmployee(db, req.params.id, updateData);
    } else {
      // Si no hay datos para actualizar
      return res.status(400).json({ error: 'FECHA_REQUIRED', message: 'Se requieren datos para actualizar' });
    }

    res.json(result);
  } catch (err) {
    console.error('[EMPLOYEES] PUT /api/employees/:id error:', err.message);
    res.status(500).json({ error: 'Error al actualizar empleado' });
  }
});

/**
 * DELETE /api/employees/:id
 * Eliminar empleado (soft delete - marcar como inactivo)
 */
router.delete('/api/employees/:id', requireAuth, requirePermission('rh'), (req, res) => {
  try {
    const employee = getEmployeeById(db, req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const result = deleteEmployee(db, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[EMPLOYEES] DELETE /api/employees/:id error:', err.message);
    res.status(500).json({ error: 'Error al eliminar empleado' });
  }
});

/**
 * GET /api/employees-data/cargos
 * Obtener lista de cargos disponibles para dropdown
 */
router.get('/api/employees-data/cargos', requireAuth, (req, res) => {
  try {
    const cargos = getCargos(db);
    res.json({ data: cargos });
  } catch (err) {
    console.error('[EMPLOYEES] GET /api/employees-data/cargos error:', err.message);
    res.status(500).json({ error: 'Error al obtener cargos' });
  }
});

/**
 * GET /api/employees-data/areas
 * Obtener lista de áreas disponibles para dropdown
 */
router.get('/api/employees-data/areas', requireAuth, (req, res) => {
  try {
    const areas = getAreas(db);
    res.json({ data: areas });
  } catch (err) {
    console.error('[EMPLOYEES] GET /api/employees-data/areas error:', err.message);
    res.status(500).json({ error: 'Error al obtener áreas' });
  }
});

export default router;
