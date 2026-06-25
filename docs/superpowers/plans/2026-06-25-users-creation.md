# Módulo Creación de Usuarios - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar módulo para crear usuarios con flujo de dos áreas: Gestión Humana ingresa datos iniciales, IT completa con credenciales auto-generadas.

**Architecture:** Módulo independiente en `src/employees/` con rutas CRUD, auto-generación de usuario/contraseña, auditoría de cambios. Frontend en `public/registrar-empleado.html` con tabs (pendientes/completados) y modal. Datos iniciales importados del Excel.

**Tech Stack:** Node.js/Express, SQLite, Vanilla JS (como resto del proyecto), fórmula para usuario (iniciales+apellido) y contraseña (últimos 4 de cédula).

---

## File Structure

**Backend:**
- Create: `src/employees/employees-routes.js` - Rutas API (GET, POST, PUT, DELETE)
- Create: `src/employees/employees-model.js` - Lógica de BD (queries, auto-generación)
- Create: `src/employees/employees-import.js` - Script carga Excel inicial
- Modify: `server.js` - Registrar router

**Frontend:**
- Create: `public/registrar-empleado.html` - Página principal
- Create: `public/js/employees.js` - Lógica (listado, filtros, modal)
- Create: `public/js/employees-form.js` - Formulario (validaciones, submit)
- Create: `public/js/employees-validate.js` - Utilidades de validación

**Database:**
- Modify: `src/config/database.js` - Crear tablas al iniciar (si no existen)

---

## Task 1: Crear tablas en BD

**Files:**
- Modify: `src/config/database.js`

- [ ] **Step 1: Leer archivo database.js para ver patrón de creación de tablas**

Run: `cat src/config/database.js | head -100`

Expected: Ver cómo se crean tablas (tabla sedes, usuarios, etc.)

- [ ] **Step 2: Agregar SQL de creación de 4 tablas (employees, employee_cargos, employee_areas, employee_logs)**

Editar `src/config/database.js` y agregar después de últimas tablas:

```javascript
// Tabla: employees (registro de empleados)
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    cargo TEXT NOT NULL,
    area TEXT NOT NULL,
    usuario TEXT UNIQUE,
    contraseña TEXT,
    fecha_respuesta_soporte TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    updated_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  )
`);

// Tabla: employee_cargos (lista de cargos válidos)
db.exec(`
  CREATE TABLE IF NOT EXISTS employee_cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL
  )
`);

// Tabla: employee_areas (lista de áreas/farmacias válidas)
db.exec(`
  CREATE TABLE IF NOT EXISTS employee_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL
  )
`);

// Tabla: employee_logs (auditoría de cambios)
db.exec(`
  CREATE TABLE IF NOT EXISTS employee_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    accion TEXT NOT NULL,
    campo_cambio TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (usuario_id) REFERENCES users(id)
  )
`);
```

- [ ] **Step 3: Verificar que el servidor inicia sin errores**

Run: `npm start` (Ctrl+C para detener)

Expected: "Server running on port 3000" sin errores de SQL

- [ ] **Step 4: Commit**

```bash
git add src/config/database.js
git commit -m "feat(employees): create database tables for employee registration module"
```

---

## Task 2: Crear modelo con funciones de auto-generación

**Files:**
- Create: `src/employees/employees-model.js`

- [ ] **Step 1: Crear archivo con funciones de auto-generación**

```javascript
// src/employees/employees-model.js
import db from '../config/database.js';

/**
 * Extraer iniciales de nombres y tomar primer apellido
 * Ej: Kelly Johana Raigoza Herrera -> KJRAIGOZA
 */
function generateUsername(nombreCompleto) {
  const palabras = nombreCompleto.trim().toUpperCase().split(/\s+/);
  if (palabras.length < 2) return palabras[0];
  
  // Iniciales de todos excepto el último (apellido)
  const iniciales = palabras.slice(0, -1).map(p => p[0]).join('');
  const apellido = palabras[palabras.length - 1];
  
  return iniciales + apellido;
}

/**
 * Extraer últimos 4 dígitos de cédula
 * Ej: 1130658563 -> "8563"
 */
function generatePassword(cedula) {
  const cedulaStr = String(cedula).padStart(8, '0');
  return cedulaStr.slice(-4);
}

/**
 * Validar y ajustar username si existe
 * Si KJRAIGOZA existe, devuelve KJRAIGOZA2, KJRAIGOZA3, etc.
 */
function ensureUniqueUsername(baseUsername) {
  let username = baseUsername;
  let counter = 2;
  
  while (db.prepare('SELECT id FROM employees WHERE usuario = ?').get(username)) {
    username = baseUsername + counter;
    counter++;
  }
  
  return username;
}

/**
 * Validar y ajustar contraseña si existe
 * Si últimos 4 existen, generar random 4-6 dígitos
 */
function ensureUniquePassword(basePassword) {
  let password = basePassword;
  
  // Verificar si contraseña ya existe
  while (db.prepare('SELECT id FROM employees WHERE contraseña = ?').get(password)) {
    // Generar random 4-6 dígitos
    password = String(Math.floor(Math.random() * 999999)).padStart(4, '0');
  }
  
  return password;
}

/**
 * Crear log de auditoría
 */
function logChange(employeeId, userId, accion, campoCambio = null, valorAnterior = null, valorNuevo = null) {
  db.prepare(`
    INSERT INTO employee_logs (employee_id, usuario_id, accion, campo_cambio, valor_anterior, valor_nuevo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(employeeId, userId, accion, campoCambio, valorAnterior, valorNuevo);
}

/**
 * Obtener todos los empleados con filtro opcional
 */
function getAllEmployees(filter = null) {
  let query = `
    SELECT e.*, u.username AS created_by_name
    FROM employees e
    LEFT JOIN users u ON u.id = e.created_by
    ORDER BY e.id DESC
  `;
  
  if (filter === 'pendiente') {
    query = `
      SELECT e.*, u.username AS created_by_name
      FROM employees e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.usuario IS NULL OR e.contraseña IS NULL OR e.fecha_respuesta_soporte IS NULL
      ORDER BY e.id DESC
    `;
  } else if (filter === 'completado') {
    query = `
      SELECT e.*, u.username AS created_by_name
      FROM employees e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.usuario IS NOT NULL AND e.contraseña IS NOT NULL AND e.fecha_respuesta_soporte IS NOT NULL
      ORDER BY e.id DESC
    `;
  }
  
  return db.prepare(query).all();
}

/**
 * Obtener un empleado por ID
 */
function getEmployeeById(id) {
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
}

/**
 * Crear nuevo empleado (Gestión Humana)
 */
function createEmployee(cedula, nombreCompleto, cargo, area, createdBy) {
  // Validar cédula única
  if (db.prepare('SELECT id FROM employees WHERE cedula = ?').get(cedula)) {
    throw new Error('CEDULA_EXISTS');
  }
  
  // Validar que cargo y area existan
  const cargoExists = db.prepare('SELECT id FROM employee_cargos WHERE nombre = ?').get(cargo);
  const areaExists = db.prepare('SELECT id FROM employee_areas WHERE nombre = ?').get(area);
  
  if (!cargoExists || !areaExists) {
    throw new Error('INVALID_CARGO_OR_AREA');
  }
  
  const result = db.prepare(`
    INSERT INTO employees (cedula, nombre_completo, cargo, area, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(cedula, nombreCompleto, cargo, area, createdBy);
  
  logChange(result.lastInsertRowid, createdBy, 'create');
  
  return result.lastInsertRowid;
}

/**
 * Completar registro (IT agrega usuario, contraseña, fecha)
 * Genera usuario y contraseña automáticamente
 */
function completeEmployee(employeeId, fechaRespuesta, updatedBy) {
  const employee = getEmployeeById(employeeId);
  
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  if (!fechaRespuesta) throw new Error('FECHA_REQUIRED');
  
  // Generar usuario y contraseña
  const baseUsername = generateUsername(employee.nombre_completo);
  const usuario = ensureUniqueUsername(baseUsername);
  
  const basePassword = generatePassword(employee.cedula);
  const contraseña = ensureUniquePassword(basePassword);
  
  // Actualizar con auto-generados
  db.prepare(`
    UPDATE employees
    SET usuario = ?, contraseña = ?, fecha_respuesta_soporte = ?, updated_by = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(usuario, contraseña, fechaRespuesta, updatedBy, employeeId);
  
  logChange(employeeId, updatedBy, 'complete', 'usuario', null, usuario);
  logChange(employeeId, updatedBy, 'complete', 'contraseña', null, contraseña);
  logChange(employeeId, updatedBy, 'complete', 'fecha_respuesta_soporte', null, fechaRespuesta);
  
  return { usuario, contraseña };
}

/**
 * Editar empleado (ambas áreas pueden editar)
 */
function updateEmployee(employeeId, updates, updatedBy) {
  const employee = getEmployeeById(employeeId);
  
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  
  const allowed = ['nombre_completo', 'cargo', 'area'];
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key) && value !== undefined) {
      const oldValue = employee[key];
      fields.push(`${key} = ?`);
      values.push(value);
      
      if (oldValue !== value) {
        logChange(employeeId, updatedBy, 'update', key, oldValue, value);
      }
    }
  }
  
  if (fields.length === 0) return;
  
  values.push(updatedBy, employeeId);
  const query = `UPDATE employees SET ${fields.join(', ')}, updated_by = ?, updated_at = datetime('now','localtime') WHERE id = ?`;
  
  db.prepare(query).run(...values);
}

/**
 * Eliminar empleado
 */
function deleteEmployee(employeeId, deletedBy) {
  const employee = getEmployeeById(employeeId);
  
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  
  logChange(employeeId, deletedBy, 'delete');
  
  db.prepare('DELETE FROM employee_logs WHERE employee_id = ?').run(employeeId);
  db.prepare('DELETE FROM employees WHERE id = ?').run(employeeId);
}

/**
 * Obtener cargos y áreas (para dropdowns)
 */
function getCargos() {
  return db.prepare('SELECT * FROM employee_cargos ORDER BY nombre').all();
}

function getAreas() {
  return db.prepare('SELECT * FROM employee_areas ORDER BY nombre').all();
}

export {
  generateUsername,
  generatePassword,
  ensureUniqueUsername,
  ensureUniquePassword,
  logChange,
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  completeEmployee,
  updateEmployee,
  deleteEmployee,
  getCargos,
  getAreas,
};
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node -c src/employees/employees-model.js`

Expected: Nada (sintaxis correcta)

- [ ] **Step 3: Commit**

```bash
git add src/employees/employees-model.js
git commit -m "feat(employees): add model with auto-generation logic for username/password"
```

---

## Task 3: Crear rutas API

**Files:**
- Create: `src/employees/employees-routes.js`

- [ ] **Step 1: Crear archivo de rutas**

```javascript
// src/employees/employees-routes.js
import express from 'express';
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
} from './employees-model.js';

const router = express.Router();

// GET - Listado con filtro
router.get('/api/employees', requireAuth, (req, res) => {
  try {
    const { filter } = req.query; // 'pendiente', 'completado', o undefined (todos)
    const employees = getAllEmployees(filter);
    res.json(employees);
  } catch (err) {
    console.error('Error GET /api/employees:', err);
    res.status(500).json({ error: 'Error al obtener empleados.' });
  }
});

// GET - Detalle
router.get('/api/employees/:id', requireAuth, (req, res) => {
  try {
    const employee = getEmployeeById(Number(req.params.id));
    
    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }
    
    res.json(employee);
  } catch (err) {
    console.error('Error GET /api/employees/:id:', err);
    res.status(500).json({ error: 'Error al obtener empleado.' });
  }
});

// POST - Crear nuevo (Gestión Humana)
router.post('/api/employees', requireAuth, (req, res) => {
  try {
    const { cedula, nombre_completo, cargo, area } = req.body;
    
    // Validaciones básicas
    if (!cedula?.trim() || !nombre_completo?.trim() || !cargo?.trim() || !area?.trim()) {
      return res.status(400).json({ error: 'Cédula, nombre, cargo y área son requeridos.' });
    }
    
    if (!/^\d{8,12}$/.test(cedula.trim())) {
      return res.status(400).json({ error: 'Cédula debe tener 8-12 dígitos.' });
    }
    
    if (nombre_completo.trim().length < 3) {
      return res.status(400).json({ error: 'Nombre debe tener al menos 3 caracteres.' });
    }
    
    const id = createEmployee(cedula.trim(), nombre_completo.trim(), cargo.trim(), area.trim(), req.user.id);
    
    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.message === 'CEDULA_EXISTS') {
      return res.status(409).json({ error: 'Cédula ya registrada.' });
    }
    if (err.message === 'INVALID_CARGO_OR_AREA') {
      return res.status(400).json({ error: 'Cargo o área no válidos.' });
    }
    
    console.error('Error POST /api/employees:', err);
    res.status(500).json({ error: 'Error al crear empleado.' });
  }
});

// PUT - Actualizar (ambos pueden editar campos GH, IT agrega credenciales)
router.put('/api/employees/:id', requireAuth, (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { nombre_completo, cargo, area, fecha_respuesta_soporte } = req.body;
    
    if (!getEmployeeById(employeeId)) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }
    
    // Si viene fecha_respuesta_soporte, completar registro (IT)
    if (fecha_respuesta_soporte !== undefined && fecha_respuesta_soporte !== '') {
      const credentials = completeEmployee(employeeId, fecha_respuesta_soporte, req.user.id);
      const employee = getEmployeeById(employeeId);
      return res.json({ ok: true, ...employee, ...credentials });
    }
    
    // Sino, actualizar campos permitidos (ambos)
    const updates = {};
    if (nombre_completo !== undefined) updates.nombre_completo = nombre_completo;
    if (cargo !== undefined) updates.cargo = cargo;
    if (area !== undefined) updates.area = area;
    
    updateEmployee(employeeId, updates, req.user.id);
    const employee = getEmployeeById(employeeId);
    
    res.json({ ok: true, ...employee });
  } catch (err) {
    if (err.message === 'EMPLOYEE_NOT_FOUND') {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }
    if (err.message === 'FECHA_REQUIRED') {
      return res.status(400).json({ error: 'Fecha de respuesta es requerida.' });
    }
    if (err.message === 'INVALID_CARGO_OR_AREA') {
      return res.status(400).json({ error: 'Cargo o área no válidos.' });
    }
    
    console.error('Error PUT /api/employees/:id:', err);
    res.status(500).json({ error: 'Error al actualizar empleado.' });
  }
});

// DELETE - Eliminar
router.delete('/api/employees/:id', requireAuth, (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    
    if (!getEmployeeById(employeeId)) {
      return res.status(404).json({ error: 'Empleado no encontrado.' });
    }
    
    deleteEmployee(employeeId, req.user.id);
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Error DELETE /api/employees/:id:', err);
    res.status(500).json({ error: 'Error al eliminar empleado.' });
  }
});

// GET - Cargos (dropdown)
router.get('/api/employees-data/cargos', requireAuth, (req, res) => {
  try {
    const cargos = getCargos();
    res.json(cargos);
  } catch (err) {
    console.error('Error GET /api/employees-data/cargos:', err);
    res.status(500).json({ error: 'Error al obtener cargos.' });
  }
});

// GET - Áreas (dropdown)
router.get('/api/employees-data/areas', requireAuth, (req, res) => {
  try {
    const areas = getAreas();
    res.json(areas);
  } catch (err) {
    console.error('Error GET /api/employees-data/areas:', err);
    res.status(500).json({ error: 'Error al obtener áreas.' });
  }
});

export default router;
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node -c src/employees/employees-routes.js`

Expected: Nada (sintaxis correcta)

- [ ] **Step 3: Commit**

```bash
git add src/employees/employees-routes.js
git commit -m "feat(employees): add REST API routes for employee CRUD operations"
```

---

## Task 4: Registrar router en server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Agregar import después de otros routers**

Buscar línea ~30 (con otros imports) y agregar:

```javascript
import employeesRouter from './src/employees/employees-routes.js';
```

- [ ] **Step 2: Registrar router en app (buscar línea con `app.use` de otros routers)**

Agregar después de otros routers (alrededor de línea 90+):

```javascript
app.use(employeesRouter);
```

- [ ] **Step 3: Verificar que server inicia**

Run: `npm start` (Ctrl+C para detener)

Expected: "Server running on port 3000" sin errores

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(employees): register employees router in server"
```

---

## Task 5: Importar datos del Excel

**Files:**
- Create: `src/employees/employees-import.js`

- [ ] **Step 1: Crear script de importación**

```javascript
// src/employees/employees-import.js
import XLSX from 'xlsx';
import db from '../config/database.js';

export async function importEmployeeDataFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    
    // Importar CARGOS y AREAS desde hoja "Datos"
    console.log('📋 Importando cargos y áreas...');
    const datosSheet = workbook.Sheets['Datos'];
    const datosData = XLSX.utils.sheet_to_json(datosSheet);
    
    const cargosSet = new Set();
    const areasSet = new Set();
    
    for (const row of datosData) {
      if (row.CARGO) cargosSet.add(row.CARGO.trim());
      if (row['FARMACIAS ']) areasSet.add(row['FARMACIAS '].trim());
    }
    
    let cargoCount = 0, areaCount = 0;
    
    for (const cargo of cargosSet) {
      const existing = db.prepare('SELECT id FROM employee_cargos WHERE nombre = ?').get(cargo);
      if (!existing) {
        db.prepare('INSERT INTO employee_cargos (nombre) VALUES (?)').run(cargo);
        cargoCount++;
      }
    }
    
    for (const area of areasSet) {
      const existing = db.prepare('SELECT id FROM employee_areas WHERE nombre = ?').get(area);
      if (!existing) {
        db.prepare('INSERT INTO employee_areas (nombre) VALUES (?)').run(area);
        areaCount++;
      }
    }
    
    console.log(`✅ Cargos: ${cargoCount} nuevos agregados`);
    console.log(`✅ Áreas: ${areaCount} nuevas agregadas`);
    
    // Importar EMPLEADOS desde hoja "Base"
    console.log('👥 Importando empleados...');
    const baseSheet = workbook.Sheets['Base'];
    const baseData = XLSX.utils.sheet_to_json(baseSheet);
    
    const systemUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    const createdById = systemUser ? systemUser.id : 1;
    
    let employeeCount = 0;
    
    for (const row of baseData.slice(0, 1000)) {
      const cedula = String(row['CEDULA']).trim();
      const nombre = row['NOMBRE COMPLETO']?.trim();
      const cargo = row['CARGO']?.trim();
      const area = row['AREA O PUNTO']?.trim();
      const usuario = row['USUARIO']?.trim();
      const contraseña = row['CONTRASEÑA']?.trim();
      const fecha = row['FECHA RESPUESTA SOPORTE'] ? String(row['FECHA RESPUESTA SOPORTE']).trim() : null;
      
      if (!cedula || !nombre || !cargo || !area) continue;
      
      // Verificar si ya existe
      const existing = db.prepare('SELECT id FROM employees WHERE cedula = ?').get(cedula);
      if (existing) continue;
      
      try {
        const result = db.prepare(`
          INSERT INTO employees (cedula, nombre_completo, cargo, area, usuario, contraseña, fecha_respuesta_soporte, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cedula, nombre, cargo, area, usuario || null, contraseña || null, fecha || null, createdById);
        
        employeeCount++;
      } catch (e) {
        console.warn(`⚠️  Error importando cedula ${cedula}:`, e.message);
      }
    }
    
    console.log(`✅ Empleados: ${employeeCount} importados`);
    console.log('✨ Importación completada');
    
  } catch (err) {
    console.error('❌ Error importando datos:', err);
    throw err;
  }
}
```

- [ ] **Step 2: Crear archivo de utilidad para ejecutar**

Crear `scripts/import-employees.js`:

```javascript
// scripts/import-employees.js
import { importEmployeeDataFromExcel } from '../src/employees/employees-import.js';

const filePath = 'CREACION DE USUARIOS PERSONAL NUEVO (1).xlsx';

importEmployeeDataFromExcel(filePath)
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
```

- [ ] **Step 3: Ejecutar importación**

Run: `node scripts/import-employees.js`

Expected: "✨ Done!" sin errores

- [ ] **Step 4: Verificar datos en BD**

Run: `sqlite3 database/tickets.db "SELECT COUNT(*) FROM employees;"`

Expected: Número > 0

- [ ] **Step 5: Commit**

```bash
git add src/employees/employees-import.js scripts/import-employees.js
git commit -m "feat(employees): add Excel import script for initial data population"
```

---

## Task 6: Crear HTML de la página

**Files:**
- Create: `public/registrar-empleado.html`

- [ ] **Step 1: Crear HTML con estructura base**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crear Usuarios - Personal Nuevo</title>
  <link rel="stylesheet" href="/css/main.css">
  <style>
    .employees-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .employees-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }
    
    .employees-header h1 {
      font-size: 28px;
      color: #333;
      margin: 0;
    }
    
    .btn-nuevo {
      background: #28a745;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }
    
    .btn-nuevo:hover {
      background: #218838;
    }
    
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #ddd;
    }
    
    .tab-button {
      padding: 12px 20px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: #666;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
    }
    
    .tab-button.active {
      color: #007bff;
      border-bottom-color: #007bff;
    }
    
    .tab-button:hover {
      color: #007bff;
    }
    
    .employees-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .employees-table thead {
      background: #f8f9fa;
      border-bottom: 2px solid #ddd;
    }
    
    .employees-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      font-size: 13px;
      text-transform: uppercase;
    }
    
    .employees-table td {
      padding: 12px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    
    .employees-table tr:hover {
      background: #f9f9f9;
    }
    
    .badge-pending {
      display: inline-block;
      background: #dc3545;
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .badge-completed {
      display: inline-block;
      background: #28a745;
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .actions {
      display: flex;
      gap: 8px;
    }
    
    .btn-edit, .btn-delete {
      padding: 4px 8px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
    }
    
    .btn-edit {
      background: #007bff;
      color: white;
    }
    
    .btn-edit:hover {
      background: #0056b3;
    }
    
    .btn-delete {
      background: #dc3545;
      color: white;
    }
    
    .btn-delete:hover {
      background: #c82333;
    }
    
    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
    }
    
    .modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal-content {
      background: white;
      border-radius: 8px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
    }
    
    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      color: #333;
    }
    
    .btn-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }
    
    .form-section {
      margin-bottom: 25px;
      padding: 15px;
      border-left: 4px solid #007bff;
      background: #f8f9fa;
      border-radius: 4px;
    }
    
    .form-section.gh {
      border-left-color: #28a745;
    }
    
    .form-section.it {
      border-left-color: #dc3545;
    }
    
    .form-section h3 {
      margin: 0 0 15px 0;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: #333;
    }
    
    .form-group {
      margin-bottom: 15px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }
    
    .form-group input,
    .form-group select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
    }
    
    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0,123,255,0.1);
    }
    
    .form-group input[readonly] {
      background: #e9ecef;
      cursor: not-allowed;
    }
    
    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 30px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
    
    .btn-submit {
      flex: 1;
      padding: 10px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    
    .btn-submit:hover {
      background: #0056b3;
    }
    
    .btn-cancel {
      flex: 1;
      padding: 10px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    
    .btn-cancel:hover {
      background: #5a6268;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }
    
    .empty-state p {
      margin: 0;
      font-size: 14px;
    }
    
    .loading {
      text-align: center;
      padding: 20px;
      color: #999;
    }
  </style>
</head>
<body>
  <div id="navbar"></div>
  
  <div class="employees-container">
    <div class="employees-header">
      <h1>📋 Creación de Usuarios - Personal Nuevo</h1>
      <button class="btn-nuevo" id="btnNewEmployee">+ Nuevo Empleado</button>
    </div>
    
    <div class="tabs">
      <button class="tab-button active" data-tab="pendientes">Pendientes</button>
      <button class="tab-button" data-tab="completados">Completados</button>
    </div>
    
    <div id="tabContent">
      <div class="loading">Cargando...</div>
    </div>
  </div>
  
  <!-- Modal Crear/Editar -->
  <div id="modalEmployee" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modalTitle">Nuevo Empleado</h2>
        <button class="btn-close" id="btnCloseModal">&times;</button>
      </div>
      
      <form id="formEmployee">
        <!-- Sección Gestión Humana -->
        <div class="form-section gh">
          <h3>Gestión Humana</h3>
          
          <div class="form-group">
            <label for="cedula">Cédula *</label>
            <input type="text" id="cedula" name="cedula" placeholder="Ej: 1130658563" required>
          </div>
          
          <div class="form-group">
            <label for="nombreCompleto">Nombre Completo *</label>
            <input type="text" id="nombreCompleto" name="nombre_completo" placeholder="Ej: Kelly Johana Raigoza Herrera" required>
          </div>
          
          <div class="form-group">
            <label for="cargo">Cargo *</label>
            <select id="cargo" name="cargo" required>
              <option value="">Selecciona un cargo...</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="area">Área/Farmacia *</label>
            <select id="area" name="area" required>
              <option value="">Selecciona un área...</option>
            </select>
          </div>
        </div>
        
        <!-- Sección IT -->
        <div class="form-section it">
          <h3>Información IT</h3>
          
          <div class="form-group">
            <label for="usuario">Usuario (Auto-generado)</label>
            <input type="text" id="usuario" name="usuario" readonly placeholder="Se genera automáticamente">
          </div>
          
          <div class="form-group">
            <label for="contraseña">Contraseña (Auto-generada)</label>
            <input type="text" id="contraseña" name="contraseña" readonly placeholder="Se genera automáticamente">
          </div>
          
          <div class="form-group">
            <label for="fechaRespuesta">Fecha Respuesta Soporte</label>
            <input type="date" id="fechaRespuesta" name="fecha_respuesta_soporte">
          </div>
          
          <p style="font-size: 12px; color: #666; margin-top: 10px; margin-bottom: 0;">
            ℹ️ El usuario y contraseña se generan automáticamente cuando completes la fecha.
          </p>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn-submit">Guardar</button>
          <button type="button" class="btn-cancel" id="btnCancelForm">Cancelar</button>
        </div>
      </form>
    </div>
  </div>
  
  <script src="/js/employees.js"></script>
  <script src="/js/employees-form.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/registrar-empleado.html
git commit -m "feat(employees): create main HTML page with tabs and form modal"
```

---

## Task 7: Crear lógica principal (employees.js)

**Files:**
- Create: `public/js/employees.js`

- [ ] **Step 1: Crear archivo con funciones principales**

```javascript
// public/js/employees.js

let currentTab = 'pendientes';
let allEmployees = [];

const API_BASE = '/api/employees';

// Elementos del DOM
const tabButtons = document.querySelectorAll('.tab-button');
const tabContent = document.getElementById('tabContent');
const btnNewEmployee = document.getElementById('btnNewEmployee');
const modalEmployee = document.getElementById('modalEmployee');
const btnCloseModal = document.getElementById('btnCloseModal');
const formEmployee = document.getElementById('formEmployee');

// Event listeners
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    setActiveTab(tab);
  });
});

btnNewEmployee.addEventListener('click', openNewEmployeeModal);
btnCloseModal.addEventListener('click', closeModal);
document.getElementById('btnCancelForm').addEventListener('click', closeModal);

formEmployee.addEventListener('submit', handleFormSubmit);

// Funciones principales
function setActiveTab(tab) {
  currentTab = tab;
  
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  renderEmployees();
}

function filterEmployees() {
  if (currentTab === 'pendientes') {
    return allEmployees.filter(emp => !emp.usuario || !emp.contraseña || !emp.fecha_respuesta_soporte);
  } else if (currentTab === 'completados') {
    return allEmployees.filter(emp => emp.usuario && emp.contraseña && emp.fecha_respuesta_soporte);
  }
  return allEmployees;
}

function renderEmployees() {
  const filtered = filterEmployees();
  
  if (filtered.length === 0) {
    tabContent.innerHTML = '<div class="empty-state"><p>No hay empleados en esta categoría.</p></div>';
    return;
  }
  
  let html = `
    <table class="employees-table">
      <thead>
        <tr>
          <th>Cédula</th>
          <th>Nombre</th>
          <th>Cargo</th>
          <th>Área</th>
          <th>Estado</th>
          <th>Usuario</th>
          <th>Contraseña</th>
          <th>Fecha</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (const emp of filtered) {
    const isPending = !emp.usuario || !emp.contraseña || !emp.fecha_respuesta_soporte;
    const statusBadge = isPending ? '<span class="badge-pending">PENDIENTE</span>' : '<span class="badge-completed">COMPLETADO</span>';
    
    html += `
      <tr>
        <td>${emp.cedula}</td>
        <td>${emp.nombre_completo}</td>
        <td>${emp.cargo}</td>
        <td>${emp.area}</td>
        <td>${statusBadge}</td>
        <td>${emp.usuario || '-'}</td>
        <td>${emp.contraseña ? '••••' : '-'}</td>
        <td>${emp.fecha_respuesta_soporte || '-'}</td>
        <td>
          <div class="actions">
            <button class="btn-edit" onclick="openEditModal(${emp.id})">Editar</button>
            <button class="btn-delete" onclick="deleteEmployee(${emp.id})">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  tabContent.innerHTML = html;
}

async function loadEmployees() {
  tabContent.innerHTML = '<div class="loading">Cargando empleados...</div>';
  
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error('Error al cargar empleados');
    
    allEmployees = await response.json();
    renderEmployees();
  } catch (err) {
    console.error(err);
    tabContent.innerHTML = '<div class="empty-state"><p>Error al cargar empleados.</p></div>';
  }
}

function openNewEmployeeModal() {
  document.getElementById('modalTitle').textContent = 'Nuevo Empleado';
  formEmployee.reset();
  document.getElementById('cedula').readOnly = false;
  
  // Limpiar readonly de campos IT
  document.getElementById('usuario').value = '';
  document.getElementById('contraseña').value = '';
  
  modalEmployee.classList.add('active');
  
  // Cargar dropdowns
  loadCargosAndAreas();
}

function openEditModal(employeeId) {
  const emp = allEmployees.find(e => e.id === employeeId);
  if (!emp) return;
  
  document.getElementById('modalTitle').textContent = 'Editar Empleado';
  formEmployee.dataset.employeeId = employeeId;
  
  document.getElementById('cedula').value = emp.cedula;
  document.getElementById('cedula').readOnly = true;
  document.getElementById('nombreCompleto').value = emp.nombre_completo;
  document.getElementById('cargo').value = emp.cargo;
  document.getElementById('area').value = emp.area;
  document.getElementById('usuario').value = emp.usuario || '';
  document.getElementById('contraseña').value = emp.contraseña ? '••••' : '';
  document.getElementById('fechaRespuesta').value = emp.fecha_respuesta_soporte || '';
  
  modalEmployee.classList.add('active');
  
  // Cargar dropdowns
  loadCargosAndAreas();
}

function closeModal() {
  modalEmployee.classList.remove('active');
  formEmployee.reset();
  delete formEmployee.dataset.employeeId;
}

async function loadCargosAndAreas() {
  try {
    const [cargosRes, areasRes] = await Promise.all([
      fetch('/api/employees-data/cargos'),
      fetch('/api/employees-data/areas'),
    ]);
    
    const cargos = await cargosRes.json();
    const areas = await areasRes.json();
    
    const cargoSelect = document.getElementById('cargo');
    const areaSelect = document.getElementById('area');
    
    // Limpiar opciones excepto placeholder
    cargoSelect.innerHTML = '<option value="">Selecciona un cargo...</option>';
    areaSelect.innerHTML = '<option value="">Selecciona un área...</option>';
    
    cargos.forEach(c => {
      const option = document.createElement('option');
      option.value = c.nombre;
      option.textContent = c.nombre;
      cargoSelect.appendChild(option);
    });
    
    areas.forEach(a => {
      const option = document.createElement('option');
      option.value = a.nombre;
      option.textContent = a.nombre;
      areaSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Error cargando dropdowns:', err);
    alert('Error al cargar opciones de cargo y área.');
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const cedula = document.getElementById('cedula').value.trim();
  const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
  const cargo = document.getElementById('cargo').value;
  const area = document.getElementById('area').value;
  const fechaRespuesta = document.getElementById('fechaRespuesta').value;
  
  // Validaciones
  if (!cedula || !/^\d{8,12}$/.test(cedula)) {
    alert('Cédula debe tener 8-12 dígitos.');
    return;
  }
  
  if (!nombreCompleto || nombreCompleto.length < 3) {
    alert('Nombre debe tener al menos 3 caracteres.');
    return;
  }
  
  if (!cargo) {
    alert('Selecciona un cargo.');
    return;
  }
  
  if (!area) {
    alert('Selecciona un área.');
    return;
  }
  
  const employeeId = formEmployee.dataset.employeeId;
  const isEdit = !!employeeId;
  
  try {
    let url = API_BASE;
    let method = 'POST';
    let body = { cedula, nombre_completo: nombreCompleto, cargo, area };
    
    if (isEdit) {
      url = `${API_BASE}/${employeeId}`;
      method = 'PUT';
      body = { nombre_completo: nombreCompleto, cargo, area };
      
      // Si hay fecha, significa que IT está completando
      if (fechaRespuesta) {
        body.fecha_respuesta_soporte = fechaRespuesta;
      }
    }
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error}`);
      return;
    }
    
    closeModal();
    loadEmployees();
    alert('Empleado guardado exitosamente.');
    
  } catch (err) {
    console.error(err);
    alert('Error al guardar empleado.');
  }
}

async function deleteEmployee(employeeId) {
  if (!confirm('¿Eliminar este empleado?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/${employeeId}`, { method: 'DELETE' });
    
    if (!response.ok) {
      const error = await response.json();
      alert(`Error: ${error.error}`);
      return;
    }
    
    loadEmployees();
    alert('Empleado eliminado.');
    
  } catch (err) {
    console.error(err);
    alert('Error al eliminar empleado.');
  }
}

// Cargar empleados al iniciar
document.addEventListener('DOMContentLoaded', loadEmployees);
```

- [ ] **Step 2: Commit**

```bash
git add public/js/employees.js
git commit -m "feat(employees): add main JavaScript logic for table rendering and CRUD operations"
```

---

## Task 8: Crear validaciones en formulario (employees-form.js)

**Files:**
- Create: `public/js/employees-form.js`

- [ ] **Step 1: Crear archivo con validaciones**

```javascript
// public/js/employees-form.js

const cedularInput = document.getElementById('cedula');
const nombreInput = document.getElementById('nombreCompleto');
const cargoSelect = document.getElementById('cargo');
const areaSelect = document.getElementById('area');
const fechaInput = document.getElementById('fechaRespuesta');

// Validar cédula en tiempo real
cedularInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 12) value = value.slice(0, 12);
  e.target.value = value;
});

// Validar nombre (solo letras y espacios)
nombreInput.addEventListener('input', (e) => {
  let value = e.target.value;
  if (!/^[a-záéíóúñ\s]*$/i.test(value)) {
    e.target.value = value.replace(/[^a-záéíóúñ\s]/gi, '');
  }
});

// Validar fecha no sea futura
fechaInput.addEventListener('change', (e) => {
  const selected = new Date(e.target.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (selected > today) {
    alert('La fecha no puede ser futura.');
    e.target.value = '';
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add public/js/employees-form.js
git commit -m "feat(employees): add form validation logic"
```

---

## Task 9: Pruebas manuales

- [ ] **Step 1: Iniciar servidor**

Run: `npm start`

Expected: "Server running on port 3000"

- [ ] **Step 2: Abrir página en navegador**

Go to: `http://localhost:3000/registrar-empleado.html`

Expected: Página carga, ve "Creación de Usuarios - Personal Nuevo"

- [ ] **Step 3: Crear nuevo empleado (GH)**

1. Click "+ Nuevo Empleado"
2. Llenar: Cédula (1234567890), Nombre (Juan Pérez López), Cargo (REGENTE), Área (103 MI FARMACIA CORINTO CAUCA)
3. Click Guardar

Expected: Empleado aparece en tab "Pendientes", usuario/contraseña vacíos

- [ ] **Step 4: Completar empleado (IT)**

1. En "Pendientes", click Editar en el registro creado
2. Llenar: Fecha Respuesta Soporte (hoy)
3. Click Guardar

Expected: Usuario (JPLópez) y Contraseña (7890) se generan automáticamente, registro se mueve a "Completados"

- [ ] **Step 5: Verificar usuario duplicado**

1. Crear otro empleado: Juan Pérez López
2. Completar (fecha)
3. Usuario debe ser JPLópez2 (contador automático)

Expected: Sistema agrega número si existe

- [ ] **Step 6: Filtrar y ver estados**

1. Click tab "Completados"
2. Verificar que solo aparecen registros con usuario/contraseña/fecha

Expected: Filtrado correcto

- [ ] **Step 7: Verificar auditoría**

Run en terminal: `sqlite3 database/tickets.db "SELECT * FROM employee_logs ORDER BY id DESC LIMIT 5;"`

Expected: Logs con cambios registrados

---

## Task 10: Testing en BD y API

- [ ] **Step 1: Verificar tabla employees tiene datos**

Run: `sqlite3 database/tickets.db "SELECT COUNT(*) FROM employees;"`

Expected: Número > 0

- [ ] **Step 2: Probar GET /api/employees**

Run: `curl -H "Authorization: Bearer {token}" http://localhost:3000/api/employees | jq`

Expected: JSON array con empleados

- [ ] **Step 3: Probar GET /api/employees?filter=pendiente**

Run: `curl -H "Authorization: Bearer {token}" 'http://localhost:3000/api/employees?filter=pendiente' | jq`

Expected: Solo empleados sin usuario/contraseña

- [ ] **Step 4: Verificar cargos y áreas importados**

Run: `sqlite3 database/tickets.db "SELECT COUNT(*) FROM employee_cargos; SELECT COUNT(*) FROM employee_areas;"`

Expected: Números > 0

---

## Task 11: Integración con navbar (opcional)

**Files:**
- Modify: `public/js/app.js` o navbar equivalente

- [ ] **Step 1: Agregar link a "Crear Usuarios" en menú**

Buscar donde se definen links del menú y agregar:

```javascript
{
  label: '📋 Crear Usuarios',
  href: '/registrar-empleado.html',
  permission: 'full' // solo IT
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/app.js
git commit -m "feat(employees): add menu link to employee registration page"
```

---

## Task 12: Documentación y commit final

- [ ] **Step 1: Crear README para módulo (opcional)**

`src/employees/README.md`:

```markdown
# Módulo Creación de Usuarios

Gestiona el registro de empleados con flujo de dos áreas:

## Flujo
1. Gestión Humana ingresa: cédula, nombre, cargo, área
2. IT completa: fecha (usuario/contraseña se generan automáticamente)

## API Endpoints
- `GET /api/employees?filter=pendiente|completado` - Listado
- `POST /api/employees` - Crear
- `PUT /api/employees/:id` - Actualizar/Completar
- `DELETE /api/employees/:id` - Eliminar

## Auto-Generación
- Usuario: iniciales + apellido (KJRAIGOZA)
- Contraseña: últimos 4 dígitos de cédula (8563)

## Auditoría
Todos los cambios quedan registrados en tabla `employee_logs`.
```

- [ ] **Step 2: Commit final**

```bash
git add -A
git commit -m "docs(employees): add module documentation"
```

---

## Summary

✅ **12 tareas completadas:**
1. BD: 4 tablas (employees, cargos, areas, logs)
2. Backend: modelo + rutas API completas
3. Importación: datos del Excel
4. Frontend: HTML + JS para CRUD, filtros, modal
5. Validaciones: en formulario + API
6. Auditoría: logs de todos los cambios
7. Testing: manual + verificaciones BD
8. Documentación

**Próximos pasos opcionales:**
- Cifrar contraseñas en BD
- Notificaciones por email cuando IT completa
- Integración con Active Directory
