import express from 'express';
import { randomUUID } from 'crypto';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { getSedeCode, nextConsecutivo } from './sede-codes.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('inventario:read')];
const canCreate = [requireAuth, requirePermission('inventario:create')];
const canEdit   = [requireAuth, requirePermission('inventario:edit')];
const canDelete = [requireAuth, requirePermission('inventario:delete')];

/* GET /api/inventario/celulares/next-placa?sede=YUMBO */
router.get('/api/inventario/celulares/next-placa', ...canRead, (req, res) => {
  try {
    const sede = req.query.sede || '';
    const code = getSedeCode(sede);
    const num  = nextConsecutivo(db, code);
    res.json({ placa: `AF-${code}${num}`, code, num });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular placa.' });
  }
});

/* GET /api/inventario/celulares */
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

/* POST /api/inventario/celulares */
router.post('/api/inventario/celulares', ...canCreate, (req, res) => {
  try {
    const { placa, fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, estado, accesorio, fecha_entrega, entregado_por } = req.body;
    if (!nombre_completo?.trim() || !imei?.trim()) {
      return res.status(400).json({ error: 'nombre_completo e imei son requeridos.' });
    }
    const qr_token = randomUUID();
    const result = db.prepare(`
      INSERT INTO inventario_celulares
        (placa,fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por,qr_token)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(placa?.trim()||null, fecha_registro||null, area||null, ciudad||null, nombre_completo.trim(),
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei.trim(),
           imei2||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null, qr_token);
    res.status(201).json({ ok: true, id: result.lastInsertRowid, qr_token });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un celular con ese IMEI o placa.' });
    console.error('POST /api/inventario/celulares:', err);
    res.status(500).json({ error: 'Error al crear celular.' });
  }
});

/* PUT /api/inventario/celulares/:id */
router.put('/api/inventario/celulares/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_celulares WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Celular no encontrado.' });
    }
    const { placa, fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, estado, accesorio, fecha_entrega, entregado_por } = req.body;
    db.prepare(`
      UPDATE inventario_celulares SET
        placa=?,fecha_registro=?,area=?,ciudad=?,nombre_completo=?,cedula=?,linea=?,
        operador=?,equipo=?,almacenamiento=?,ram=?,modelo=?,imei=?,imei2=?,
        estado=?,accesorio=?,fecha_entrega=?,entregado_por=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(placa?.trim()||null, fecha_registro||null, area||null, ciudad||null, nombre_completo,
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei,
           imei2||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'IMEI o placa ya existe en otro celular.' });
    console.error('PUT /api/inventario/celulares/:id:', err);
    res.status(500).json({ error: 'Error al actualizar celular.' });
  }
});

/* DELETE /api/inventario/celulares/:id */
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

export default router;
