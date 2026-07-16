import express from 'express';
import { randomUUID } from 'crypto';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { getSedeCode, nextConsecutivo } from './sede-codes.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('inventario:read')];
const canCreate = [requireAuth, requirePermission('inventario:create')];
const canEdit   = [requireAuth, requirePermission('inventario:edit')];
const canDelete = [requireAuth, requirePermission('inventario:delete')];

router.get('/api/inventario/celulares/next-placa', ...canRead, wrap(async (req, res) => {
  const sede = req.query.sede || '';
  const code = getSedeCode(sede);
  const num  = nextConsecutivo(db, code);
  res.json({ placa: `AF-${code}${num}`, code, num });
}));

router.get('/api/inventario/celulares', ...canRead, wrap(async (req, res) => {
  const { search, area, estado, page = 1, limit = 20 } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(CAST(id AS TEXT) LIKE ? OR nombre_completo LIKE ? OR cedula LIKE ? OR imei LIKE ? OR modelo LIKE ? OR equipo LIKE ? OR area LIKE ? OR ciudad LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s, s);
  }
  if (area)   { where.push('area LIKE ?');   params.push(`%${area}%`); }
  if (estado) { where.push('estado = ?');    params.push(estado); }
  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const rows  = db.prepare(`SELECT * FROM inventario_celulares ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_celulares ${wc}`).get(...params);
  res.json({ celulares: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
}));

router.post('/api/inventario/celulares', ...canCreate, wrap(async (req, res) => {
  const { placa, fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, serial, estado, accesorio, fecha_entrega, entregado_por, numero_telefono } = req.body;
  if (!nombre_completo?.trim() || !imei?.trim()) {
    return res.status(400).json({ error: 'nombre_completo e imei son requeridos.' });
  }
  const qr_token = randomUUID();
  try {
    const result = db.prepare(`
      INSERT INTO inventario_celulares
        (placa,fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,almacenamiento,ram,modelo,imei,imei2,serial,estado,accesorio,fecha_entrega,entregado_por,numero_telefono,qr_token)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(placa?.trim()||null, fecha_registro||null, area||null, ciudad||null, nombre_completo.trim(),
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei.trim(),
           imei2||null, serial||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null, numero_telefono||null, qr_token);
    res.status(201).json({ ok: true, id: result.lastInsertRowid, qr_token });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un celular con ese IMEI o placa.' });
    throw err;
  }
}));

router.put('/api/inventario/celulares/:id', ...canEdit, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.prepare('SELECT id FROM inventario_celulares WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Celular no encontrado.' });
  }
  const { placa, fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, serial, estado, accesorio, fecha_entrega, entregado_por, numero_telefono } = req.body;
  try {
    db.prepare(`
      UPDATE inventario_celulares SET
        placa=?,fecha_registro=?,area=?,ciudad=?,nombre_completo=?,cedula=?,linea=?,
        operador=?,equipo=?,almacenamiento=?,ram=?,modelo=?,imei=?,imei2=?,serial=?,
        estado=?,accesorio=?,fecha_entrega=?,entregado_por=?,numero_telefono=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(placa?.trim()||null, fecha_registro||null, area||null, ciudad||null, nombre_completo,
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei,
           imei2||null, serial||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null, numero_telefono||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'IMEI o placa ya existe en otro celular.' });
    throw err;
  }
}));

router.delete('/api/inventario/celulares/:id', ...canDelete, wrap(async (req, res) => {
  const result = db.prepare('DELETE FROM inventario_celulares WHERE id = ?').run(parseInt(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Celular no encontrado.' });
  res.json({ ok: true });
}));

export default router;
