import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

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

export default router;
