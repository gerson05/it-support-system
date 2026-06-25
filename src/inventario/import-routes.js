import express from 'express';
import multer  from 'multer';
import ExcelJS from 'exceljs';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import {
  EQUIPOS_COLMAP,
  UPS_COLMAP,
  CELULARES_COLMAP,
  buildMapping,
  cellText,
} from './import-service.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const canCreate = [requireAuth, requirePermission('inventario:create')];

/* ── POST /api/inventario/:type/import — parse xlsx, return preview ── */
router.post('/api/inventario/:type/import', ...canCreate, upload.single('file'), async (req, res) => {
  const type = req.params.type;
  if (!['equipos', 'celulares', 'ups'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    /* Sheet selection: ?sheet=name or defaults to first sheet */
    const sheetName  = req.query.sheet;
    const ws         = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: `Hoja "${sheetName ?? 'primera'}" no encontrada.` });

    const sheetNames = wb.worksheets.map(s => s.name);

    /* Read headers + their actual column numbers */
    const headerEntries = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
      const h = String(cell.value ?? '').trim();
      if (h) headerEntries.push({ name: h, col: colNum });
    });
    const headers = headerEntries.map(e => e.name);

    const colmap  = type === 'equipos' ? EQUIPOS_COLMAP : type === 'ups' ? UPS_COLMAP : CELULARES_COLMAP;
    const mapping = buildMapping(headers, colmap);

    const rows = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj = {};
      let hasData = false;
      headerEntries.forEach(({ name: h, col }) => {
        const field = mapping[h];
        if (!field) return;
        const raw = row.getCell(col).value;
        const val = cellText(raw);
        if (val) hasData = true;
        obj[field] = val || null;
      });
      if (hasData) rows.push(obj);
    });

    res.json({ preview: rows.slice(0, 5), mapping, total: rows.length, rows, sheets: sheetNames, activeSheet: ws.name });
  } catch (err) {
    console.error('POST /api/inventario/:type/import:', err);
    res.status(400).json({ error: 'No se pudo leer el archivo. Verifica que sea un .xlsx válido.' });
  }
});

/* ── POST /api/inventario/:type/import/confirm — bulk insert ── */
router.post('/api/inventario/:type/import/confirm', ...canCreate, (req, res) => {
  const type = req.params.type;
  if (!['equipos', 'celulares', 'ups'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });

  const { rows, mode = 'skip' } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Sin filas.' });

  const orClause = mode === 'overwrite' ? 'OR REPLACE' : 'OR IGNORE';
  let inserted = 0, skipped = 0;
  const errors = [];

  try {
    db.exec('BEGIN');

    if (type === 'equipos') {
      const stmt = db.prepare(`
        INSERT ${orClause} INTO inventario_equipos
          (placa,marca,nombre_equipo,serial,procesador,ram,tipo_ram,cap_disco,
           tipo_disco,serial_cargador,area,responsable,fecha_compra)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      rows.forEach((r, i) => {
        if (!r.placa?.trim() || !r.serial?.trim() || !r.marca?.trim() || !r.nombre_equipo?.trim()) {
          errors.push({ row: i + 2, message: `Fila ${i + 2}: placa, serial, marca y nombre de equipo son requeridos.` });
          return;
        }
        try {
          const result = stmt.run(
            r.placa?.trim()||null, r.marca?.trim()||null, r.nombre_equipo?.trim()||null,
            r.serial?.trim()||null, r.procesador||null, r.ram||null, r.tipo_ram||null,
            r.cap_disco||null, r.tipo_disco||null, r.serial_cargador||null,
            r.area||null, r.responsable||null, r.fecha_compra||null
          );
          result.changes ? inserted++ : skipped++;
        } catch (err) {
          errors.push({ row: i + 2, message: err.message });
        }
      });
    }

    if (type === 'celulares') {
      const stmt = db.prepare(`
        INSERT ${orClause} INTO inventario_celulares
          (fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,
           almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      rows.forEach((r, i) => {
        if (!r.imei?.trim() || !r.nombre_completo?.trim()) {
          errors.push({ row: i + 2, message: `Fila ${i + 2}: imei y nombre completo son requeridos.` });
          return;
        }
        try {
          const result = stmt.run(
            r.fecha_registro||null, r.area||null, r.ciudad||null,
            r.nombre_completo?.trim()||null, r.cedula||null, r.linea||null,
            r.operador||null, r.equipo||null, r.almacenamiento||null,
            r.ram||null, r.modelo||null, r.imei.trim(),
            r.imei2||null, r.estado||'nuevo', r.accesorio||null,
            r.fecha_entrega||null, r.entregado_por||null
          );
          result.changes ? inserted++ : skipped++;
        } catch (err) {
          errors.push({ row: i + 2, message: err.message });
        }
      });
    }

    if (type === 'ups') {
      const stmt = db.prepare(`
        INSERT ${orClause} INTO inventario_ups
          (placa,marca,nombre_equipo,serial,area,voltaje,fecha_compra,fecha_despacho)
        VALUES (?,?,?,?,?,?,?,?)
      `);
      rows.forEach((r, i) => {
        if (!r.placa?.trim()) {
          errors.push({ row: i + 2, message: `Fila ${i + 2}: placa es requerida.` });
          return;
        }
        try {
          const result = stmt.run(
            r.placa.trim(), r.marca||null, r.nombre_equipo||null, r.serial||null,
            r.area||null, r.voltaje||null, r.fecha_compra||null, r.fecha_despacho||null
          );
          result.changes ? inserted++ : skipped++;
        } catch (err) {
          errors.push({ row: i + 2, message: err.message });
        }
      });
    }

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('Import confirm error:', err);
    return res.status(500).json({ error: err.message });
  }

  res.json({ inserted, skipped, errors });
});

export default router;
