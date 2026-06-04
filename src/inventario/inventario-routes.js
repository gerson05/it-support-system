import express from 'express';
import crypto  from 'crypto';
import os      from 'os';
import QRCode  from 'qrcode';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import multer from 'multer';
import ExcelJS from 'exceljs';

function getBaseUrl(req) {
  if (process.env.PUBLIC_TUNNEL_URL) return process.env.PUBLIC_TUNNEL_URL;
  const host = req.headers.host || '';
  const isLocal = /^(localhost|127\.|::1)/i.test(host);
  if (isLocal) {
    const port = host.split(':')[1] || '3000';
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) return `${req.protocol}://${a.address}:${port}`;
      }
    }
  }
  return `${req.protocol}://${host}`;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeHeader(h) {
  return String(h ?? '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').trim();
}

const EQUIPOS_COLMAP = {
  placa:           ['placa'],
  marca:           ['marca'],
  nombre_equipo:   ['nombre de equipo', 'nombre equipo'],
  serial:          ['serial/emei', 'serial', 's/n', 'serial/imei'],
  procesador:      ['procesador'],
  ram:             ['ram'],
  tipo_ram:        ['tipo de ram', 'tipo ram'],
  cap_disco:       ['capacidad disco', 'cap disco'],
  tipo_disco:      ['tipo de disco', 'tipo disco'],
  serial_cargador: ['serial cargador'],
  area:            ['area'],
  responsable:     ['responsable'],
  fecha_compra:    ['fecha de compra', 'fecha compra'],
};

const CELULARES_COLMAP = {
  fecha_registro:  ['fecha'],
  area:            ['area'],
  ciudad:          ['ciudad'],
  nombre_completo: ['nombre completo'],
  cedula:          ['cedula'],
  linea:           ['linea'],
  operador:        ['operador'],
  equipo:          ['equipo'],
  almacenamiento:  ['alm', 'almacenamiento'],
  ram:             ['ram'],
  modelo:          ['modelo'],
  imei:            ['imei'],
  imei2:           ['imei 2', 'imei2'],
  estado:          ['estado'],
  accesorio:       ['accesorio'],
  fecha_entrega:   ['fecha de entrega'],
  entregado_por:   ['entregado por'],
};

function buildMapping(headers, colmap) {
  const mapping = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    let matched = null;
    for (const [field, aliases] of Object.entries(colmap)) {
      if (aliases.includes(norm)) { matched = field; break; }
    }
    mapping[h] = matched;
  }
  return mapping;
}

function cellText(raw) {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'object' && 'result' in raw) return String(raw.result ?? '').trim();
  if (typeof raw === 'object' && 'text'   in raw) return String(raw.text   ?? '').trim();
  return String(raw).trim();
}

const router = express.Router();

const canRead   = [requireAuth, requirePermission('inventario:read')];
const canCreate = [requireAuth, requirePermission('inventario:create')];
const canEdit   = [requireAuth, requirePermission('inventario:edit')];
const canDelete = [requireAuth, requirePermission('inventario:delete')];

/* ── EQUIPOS ── */

router.get('/api/inventario/equipos', ...canRead, (req, res) => {
  try {
    const { search, area, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(placa LIKE ? OR marca LIKE ? OR nombre_equipo LIKE ? OR serial LIKE ? OR responsable LIKE ? OR area LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (area) { where.push('area LIKE ?'); params.push(`%${area}%`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows  = db.prepare(`SELECT * FROM inventario_equipos ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_equipos ${wc}`).get(...params);
    res.json({ equipos: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('GET /api/inventario/equipos:', err);
    res.status(500).json({ error: 'Error al consultar equipos.' });
  }
});

router.post('/api/inventario/equipos', ...canCreate, (req, res) => {
  try {
    const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra } = req.body;
    if (!placa?.trim() || !marca?.trim() || !nombre_equipo?.trim() || !serial?.trim()) {
      return res.status(400).json({ error: 'placa, marca, nombre_equipo y serial son requeridos.' });
    }
    const result = db.prepare(`
      INSERT INTO inventario_equipos
        (placa,marca,nombre_equipo,serial,procesador,ram,tipo_ram,cap_disco,tipo_disco,serial_cargador,area,responsable,fecha_compra)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(placa.trim(), marca.trim(), nombre_equipo.trim(), serial.trim(),
           procesador||null, ram||null, tipo_ram||null, cap_disco||null,
           tipo_disco||null, serial_cargador||null, area||null,
           responsable||null, fecha_compra||null);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un equipo con esa placa o serial.' });
    console.error('POST /api/inventario/equipos:', err);
    res.status(500).json({ error: 'Error al crear equipo.' });
  }
});

router.put('/api/inventario/equipos/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_equipos WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    }
    const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra } = req.body;
    db.prepare(`
      UPDATE inventario_equipos SET
        placa=?,marca=?,nombre_equipo=?,serial=?,procesador=?,ram=?,tipo_ram=?,
        cap_disco=?,tipo_disco=?,serial_cargador=?,area=?,responsable=?,
        fecha_compra=?,updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(placa, marca, nombre_equipo, serial,
           procesador||null, ram||null, tipo_ram||null,
           cap_disco||null, tipo_disco||null, serial_cargador||null,
           area||null, responsable||null, fecha_compra||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Placa o serial ya existe en otro equipo.' });
    console.error('PUT /api/inventario/equipos/:id:', err);
    res.status(500).json({ error: 'Error al actualizar equipo.' });
  }
});

router.delete('/api/inventario/equipos/:id', ...canDelete, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventario_equipos WHERE id = ?').run(parseInt(req.params.id));
    if (!result.changes) return res.status(404).json({ error: 'Equipo no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/inventario/equipos/:id:', err);
    res.status(500).json({ error: 'Error al eliminar equipo.' });
  }
});

/* ── CELULARES ── */

router.get('/api/inventario/celulares', ...canRead, (req, res) => {
  try {
    const { search, area, estado, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(nombre_completo LIKE ? OR cedula LIKE ? OR imei LIKE ? OR modelo LIKE ? OR area LIKE ? OR ciudad LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (area)   { where.push('area LIKE ?');   params.push(`%${area}%`); }
    if (estado) { where.push('estado = ?');    params.push(estado); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows  = db.prepare(`SELECT * FROM inventario_celulares ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_celulares ${wc}`).get(...params);
    res.json({ celulares: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('GET /api/inventario/celulares:', err);
    res.status(500).json({ error: 'Error al consultar celulares.' });
  }
});

router.post('/api/inventario/celulares', ...canCreate, (req, res) => {
  try {
    const { fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, estado, accesorio, fecha_entrega, entregado_por } = req.body;
    if (!nombre_completo?.trim() || !imei?.trim()) {
      return res.status(400).json({ error: 'nombre_completo e imei son requeridos.' });
    }
    const result = db.prepare(`
      INSERT INTO inventario_celulares
        (fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(fecha_registro||null, area||null, ciudad||null, nombre_completo.trim(),
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei.trim(),
           imei2||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un celular con ese IMEI.' });
    console.error('POST /api/inventario/celulares:', err);
    res.status(500).json({ error: 'Error al crear celular.' });
  }
});

router.put('/api/inventario/celulares/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_celulares WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Celular no encontrado.' });
    }
    const { fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, estado, accesorio, fecha_entrega, entregado_por } = req.body;
    db.prepare(`
      UPDATE inventario_celulares SET
        fecha_registro=?,area=?,ciudad=?,nombre_completo=?,cedula=?,linea=?,
        operador=?,equipo=?,almacenamiento=?,ram=?,modelo=?,imei=?,imei2=?,
        estado=?,accesorio=?,fecha_entrega=?,entregado_por=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(fecha_registro||null, area||null, ciudad||null, nombre_completo,
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei,
           imei2||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'IMEI ya existe en otro celular.' });
    console.error('PUT /api/inventario/celulares/:id:', err);
    res.status(500).json({ error: 'Error al actualizar celular.' });
  }
});

router.delete('/api/inventario/celulares/:id', ...canDelete, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventario_celulares WHERE id = ?').run(parseInt(req.params.id));
    if (!result.changes) return res.status(404).json({ error: 'Celular no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/inventario/celulares/:id:', err);
    res.status(500).json({ error: 'Error al eliminar celular.' });
  }
});

/* ── IMPORT: parse xlsx ── */
router.post('/api/inventario/:type/import', ...canCreate, upload.single('file'), async (req, res) => {
  const type = req.params.type;
  if (!['equipos', 'celulares'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'El archivo no tiene hojas.' });

    const headers = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, cell => headers.push(String(cell.value ?? '')));

    const colmap  = type === 'equipos' ? EQUIPOS_COLMAP : CELULARES_COLMAP;
    const mapping = buildMapping(headers, colmap);

    const rows = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj = {};
      let hasData = false;
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (!field) return;
        const raw = row.getCell(i + 1).value;
        const val = cellText(raw);
        if (val) hasData = true;
        obj[field] = val || null;
      });
      if (hasData) rows.push(obj);
    });

    res.json({ preview: rows.slice(0, 5), mapping, total: rows.length, rows });
  } catch (err) {
    console.error('POST /api/inventario/:type/import:', err);
    res.status(400).json({ error: 'No se pudo leer el archivo. Verifica que sea un .xlsx válido.' });
  }
});

/* ── IMPORT: confirm insert ── */
router.post('/api/inventario/:type/import/confirm', ...canCreate, (req, res) => {
  const type = req.params.type;
  if (!['equipos', 'celulares'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });

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
    } else {
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

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    console.error('Import confirm error:', err);
    return res.status(500).json({ error: err.message });
  }

  res.json({ inserted, skipped, errors });
});

/* ══════════════════════════════════════════════════════════
   REGISTRO MÓVIL — tokens compartibles
   ══════════════════════════════════════════════════════════ */

/* POST /api/inventario/registro-token — crea token (requiere auth) */
router.post('/api/inventario/registro-token', ...canCreate, (req, res) => {
  try {
    const { tipo = 'equipos', label, expires_hours, max_uses } = req.body;
    if (!['equipos','celulares'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });

    const token     = crypto.randomUUID();
    const expiresAt = expires_hours
      ? new Date(Date.now() + Number(expires_hours) * 3600000).toISOString().replace('T',' ').slice(0,19)
      : null;
    const maxUses   = max_uses ? Number(max_uses) : null;
    const createdBy = req.session?.username || req.user?.username || null;

    db.prepare(`INSERT INTO registro_tokens (token,tipo,label,created_by,expires_at,max_uses)
                VALUES (?,?,?,?,?,?)`)
      .run(token, tipo, label||null, createdBy, expiresAt, maxUses);

    const url = `${getBaseUrl(req)}/registrar/${token}`;
    res.json({ token, url });
  } catch (err) {
    console.error('POST /api/inventario/registro-token:', err);
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/inventario/registro-tokens — lista tokens activos (requiere auth) */
router.get('/api/inventario/registro-tokens', ...canRead, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id,token,tipo,label,created_by,expires_at,max_uses,use_count,active,created_at
      FROM registro_tokens ORDER BY created_at DESC LIMIT 50
    `).all();
    res.json({ tokens: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/inventario/registro-tokens/:id — desactiva token */
router.delete('/api/inventario/registro-tokens/:id', ...canCreate, (req, res) => {
  try {
    db.prepare('UPDATE registro_tokens SET active=0 WHERE id=?').run(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/inventario/registro-status/:token — valida token (público) */
router.get('/api/inventario/registro-status/:token', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM registro_tokens WHERE token=?').get(req.params.token);
    if (!row || !row.active) return res.json({ valid: false, reason: 'Enlace no válido.' });
    if (row.expires_at && new Date(row.expires_at) < new Date())
      return res.json({ valid: false, reason: 'Este enlace ha expirado.' });
    if (row.max_uses !== null && row.use_count >= row.max_uses)
      return res.json({ valid: false, reason: 'Este enlace ya alcanzó el límite de usos.' });
    res.json({
      valid:     true,
      tipo:      row.tipo,
      label:     row.label,
      use_count: row.use_count,
      max_uses:  row.max_uses,
      expires_at:row.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/inventario/registro-qr/:token — QR PNG (público) */
router.get('/api/inventario/registro-qr/:token', async (req, res) => {
  try {
    const row = db.prepare('SELECT token FROM registro_tokens WHERE token=?').get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Token no encontrado.' });
    const url = `${getBaseUrl(req)}/registrar/${req.params.token}`;
    const png = await QRCode.toBuffer(url, { type:'png', width:280, margin:1 });
    res.setHeader('Content-Type','image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/inventario/registrar/:token — registra equipo/celular sin auth */
router.post('/api/inventario/registrar/:token', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM registro_tokens WHERE token=?').get(req.params.token);
    if (!row || !row.active) return res.status(403).json({ error: 'Enlace no válido.' });
    if (row.expires_at && new Date(row.expires_at) < new Date())
      return res.status(403).json({ error: 'Enlace expirado.' });
    if (row.max_uses !== null && row.use_count >= row.max_uses)
      return res.status(403).json({ error: 'Límite de usos alcanzado.' });

    const tipo = row.tipo;
    const b    = req.body;
    let   id;

    if (tipo === 'equipos') {
      if (!b.placa?.trim() || !b.serial?.trim() || !b.marca?.trim() || !b.nombre_equipo?.trim())
        return res.status(400).json({ error: 'placa, marca, nombre_equipo y serial son requeridos.' });
      const r = db.prepare(`
        INSERT OR IGNORE INTO inventario_equipos
          (placa,marca,nombre_equipo,serial,procesador,ram,tipo_ram,cap_disco,tipo_disco,serial_cargador,area,responsable,fecha_compra)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(b.placa.trim(),b.marca.trim(),b.nombre_equipo.trim(),b.serial.trim(),
             b.procesador||null,b.ram||null,b.tipo_ram||null,b.cap_disco||null,
             b.tipo_disco||null,b.serial_cargador||null,b.area||null,b.responsable||null,b.fecha_compra||null);
      if (!r.changes) return res.status(409).json({ error: 'Ya existe un equipo con esa placa o serial.' });
      id = r.lastInsertRowid;
    } else {
      if (!b.imei?.trim() || !b.nombre_completo?.trim())
        return res.status(400).json({ error: 'imei y nombre_completo son requeridos.' });
      const r = db.prepare(`
        INSERT OR IGNORE INTO inventario_celulares
          (fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(b.fecha_registro||null,b.area||null,b.ciudad||null,b.nombre_completo.trim(),
             b.cedula||null,b.linea||null,b.operador||null,b.equipo||null,
             b.almacenamiento||null,b.ram||null,b.modelo||null,b.imei.trim(),
             b.imei2||null,b.estado||'nuevo',b.accesorio||null,b.fecha_entrega||null,b.entregado_por||null);
      if (!r.changes) return res.status(409).json({ error: 'Ya existe un celular con ese IMEI.' });
      id = r.lastInsertRowid;
    }

    db.prepare('UPDATE registro_tokens SET use_count=use_count+1 WHERE token=?').run(req.params.token);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Registro duplicado.' });
    console.error('POST /api/inventario/registrar/:token:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
