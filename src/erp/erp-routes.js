import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';
import { ERPClient } from './erp-client.js';
import { runFullSync, syncStatus } from './erp-sync.js';

const router = express.Router();

/**
 * Employee lookup — used by despacho form destinatario autocomplete.
 * Searches local employees table (synced from HR import).
 * ?q=<cedula or partial name>
 */
router.get('/api/erp/empleados', requireAuth, wrap(async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json([]);

  const byId  = /^\d{6,}$/.test(query);
  let rows;
  if (byId) {
    rows = db.prepare(
      `SELECT cedula, nombre_completo, cargo, area
       FROM employees
       WHERE cedula LIKE ? LIMIT 20`
    ).all(`${query}%`);
  } else {
    rows = db.prepare(
      `SELECT cedula, nombre_completo, cargo, area
       FROM employees
       WHERE nombre_completo LIKE ? LIMIT 20`
    ).all(`%${query}%`);
  }

  res.json(rows.map(r => ({
    cedula:  r.cedula,
    nombre:  r.nombre_completo,
    cargo:   r.cargo,
    area:    r.area,
  })));
}));

/**
 * Puntos/sedes — for despacho sede field autocomplete.
 * Returns active puntos from local DB.
 */
router.get('/api/erp/sedes', requireAuth, wrap(async (req, res) => {
  const query = (req.query.q || '').trim();
  const rows = query
    ? db.prepare(
        `SELECT nombre, ciudad FROM puntos
         WHERE activo = 1 AND (nombre LIKE ? OR ciudad LIKE ?)
         ORDER BY nombre LIMIT 30`
      ).all(`%${query}%`, `%${query}%`)
    : db.prepare(
        `SELECT nombre, ciudad FROM puntos
         WHERE activo = 1 ORDER BY nombre LIMIT 100`
      ).all();
  res.json(rows);
}));

/* GET /api/erp/sync/status */
router.get('/api/erp/sync/status', requireAuth, (req, res) => {
  res.json({
    running:    syncStatus.running,
    lastRun:    syncStatus.lastRun,
    lastResult: syncStatus.lastResult,
    configured: !!(process.env.ERP_USER && process.env.ERP_PASS),
    empleados_servlet: process.env.ERP_EMPLEADOS_OBJ || null,
  });
});

/* POST /api/erp/sync — manual trigger (admin only) */
router.post('/api/erp/sync', requireAuth, requirePermission('settings:edit'), wrap(async (req, res) => {
  if (syncStatus.running) {
    return res.status(409).json({ error: 'Sync already in progress.' });
  }
  if (!process.env.ERP_USER || !process.env.ERP_PASS) {
    return res.status(400).json({ error: 'ERP_USER / ERP_PASS not configured in environment.' });
  }

  // Run in background, respond immediately
  const client = new ERPClient();
  runFullSync(client).catch(e => console.error('[ERP Sync] background error:', e.message));

  res.json({ started: true, message: 'Sync iniciado — usa GET /api/erp/sync/status para ver progreso.' });
}));

router.get('/api/erp/empleado/:cedula', requireAuth, wrap(async (req, res) => {
  const cedula = req.params.cedula.trim();
  const row = db.prepare(
    `SELECT cedula, nombre_completo, cargo, area FROM employees WHERE cedula = ?`
  ).get(cedula);
  if (!row) return res.status(404).json({ error: 'Cédula no encontrada en el sistema.' });
  res.json({ cedula: row.cedula, nombre: row.nombre_completo, cargo: row.cargo, area: row.area });
}));

router.get('/api/erp/empleado/:cedula/historial', requireAuth, wrap(async (req, res) => {
  const cedula = req.params.cedula.trim();

  const empleado = db.prepare(
    `SELECT cedula, nombre_completo, cargo, area FROM employees WHERE cedula = ?`
  ).get(cedula);

  const tickets = db.prepare(
    `SELECT id, ticket_number, area, status, priority, description, created_at
     FROM tickets
     WHERE requester_name IN (SELECT nombre_completo FROM employees WHERE cedula = ?)
     ORDER BY created_at DESC LIMIT 20`
  ).all(cedula);

  const despachos = db.prepare(
    `SELECT numero, destinatario, sede, fecha, articulos, created_at
     FROM despachos WHERE cedula = ? ORDER BY created_at DESC LIMIT 20`
  ).all(cedula);

  const techRequests = db.prepare(
    `SELECT request_number, type, status, priority, description, sede, created_at
     FROM tech_requests WHERE cedula = ? ORDER BY created_at DESC LIMIT 20`
  ).all(cedula);

  res.json({ empleado, tickets, despachos, tech_requests: techRequests });
}));

/**
 * POST /api/erp/import/empleados — upload Excel with employee list
 * Expected columns (any order): cedula, nombre_completo, cargo, area
 * Aliases accepted: CEDULA/NIT, NOMBRE/NOMBRE_COMPLETO, CARGO, AREA
 */
router.post('/api/erp/import/empleados', requireAuth, requirePermission('settings:edit'), wrap(async (req, res) => {
  const multer  = (await import('multer')).default;
  const ExcelJS = (await import('exceljs')).default;
  const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  await new Promise((resolve, reject) => upload.single('file')(req, res, e => e ? reject(e) : resolve()));

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const ws = wb.getWorksheet(1);

  const header = [];
  ws.getRow(1).eachCell(cell => header.push(String(cell.value || '').trim().toUpperCase()));

  const col = name => header.findIndex(h => h.includes(name));
  const iCedula = col('CEDULA') !== -1 ? col('CEDULA') : col('NIT');
  const iNombre = col('NOMBRE') !== -1 ? col('NOMBRE') : -1;
  const iCargo  = col('CARGO');
  const iArea   = col('AREA');

  if (iCedula === -1 || iNombre === -1) {
    return res.status(400).json({ error: `Columnas requeridas no encontradas. Encabezados detectados: ${header.join(', ')}` });
  }

  const upsert = db.prepare(`
    INSERT INTO employees (cedula, nombre_completo, cargo, area)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(cedula) DO UPDATE SET
      nombre_completo = excluded.nombre_completo,
      cargo           = excluded.cargo,
      area            = excluded.area,
      updated_at      = datetime('now','localtime')
  `);

  let imported = 0; let skipped = 0;
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const cedula = String(row.getCell(iCedula + 1).value || '').trim();
    const nombre = String(row.getCell(iNombre + 1).value || '').trim();
    if (!cedula || !nombre) { skipped++; return; }
    const cargo = iCargo !== -1 ? String(row.getCell(iCargo + 1).value || '').trim() : '';
    const area  = iArea  !== -1 ? String(row.getCell(iArea  + 1).value || '').trim() : '';
    try { upsert.run(cedula, nombre, cargo, area); imported++; }
    catch { skipped++; }
  });

  res.json({ success: true, imported, skipped });
}));

/**
 * POST /api/erp/import/puntos — upload Excel with pharmacy locations
 * Expected columns: nombre, ciudad (or NOMBRE, CIUDAD)
 */
router.post('/api/erp/import/puntos', requireAuth, requirePermission('settings:edit'), wrap(async (req, res) => {
  const multer  = (await import('multer')).default;
  const ExcelJS = (await import('exceljs')).default;
  const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  await new Promise((resolve, reject) => upload.single('file')(req, res, e => e ? reject(e) : resolve()));

  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const ws = wb.getWorksheet(1);

  const header = [];
  ws.getRow(1).eachCell(cell => header.push(String(cell.value || '').trim().toUpperCase()));
  const iNombre = header.findIndex(h => h.includes('NOMBRE') || h.includes('PUNTO') || h.includes('SEDE'));
  const iCiudad = header.findIndex(h => h.includes('CIUDAD') || h.includes('MUNIC'));

  if (iNombre === -1) {
    return res.status(400).json({ error: `Columna NOMBRE no encontrada. Encabezados: ${header.join(', ')}` });
  }

  let imported = 0; let skipped = 0;
  const insert = db.prepare(`INSERT OR IGNORE INTO puntos (nombre, ciudad, activo) VALUES (?, ?, 1)`);
  const update = db.prepare(`UPDATE puntos SET ciudad=?, activo=1 WHERE nombre=?`);

  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const nombre = String(row.getCell(iNombre + 1).value || '').trim();
    if (!nombre) { skipped++; return; }
    const ciudad = iCiudad !== -1 ? String(row.getCell(iCiudad + 1).value || '').trim() : '';
    try {
      const result = insert.run(nombre, ciudad);
      if (result.changes) { imported++; } else { update.run(ciudad, nombre); }
    } catch { skipped++; }
  });

  res.json({ success: true, imported, skipped });
}));

export default router;
