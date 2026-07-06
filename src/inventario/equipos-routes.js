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

/* GET /api/inventario/equipos/next-placa?sede=YUMBO */
router.get('/api/inventario/equipos/next-placa', ...canRead, (req, res) => {
  try {
    const sede = req.query.sede || '';
    const code = getSedeCode(sede);
    const num  = nextConsecutivo(db, code);
    res.json({ placa: `AF-${code}${num}`, code, num });
  } catch (err) {
    console.error('GET /api/inventario/equipos/next-placa:', err);
    res.status(500).json({ error: 'Error al calcular placa.' });
  }
});

/* GET /api/inventario/equipos */
router.get('/api/inventario/equipos', ...canRead, (req, res) => {
  try {
    const { search, area, categoria, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(placa LIKE ? OR marca LIKE ? OR nombre_equipo LIKE ? OR serial LIKE ? OR responsable LIKE ? OR area LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (area)      { where.push('area LIKE ?');      params.push(`%${area}%`); }
    if (categoria) { where.push('categoria = ?');    params.push(categoria); }
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

/* POST /api/inventario/equipos */
router.post('/api/inventario/equipos', ...canCreate, (req, res) => {
  try {
    const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra, categoria } = req.body;
    if (!placa?.trim() || !marca?.trim() || !nombre_equipo?.trim() || !serial?.trim()) {
      return res.status(400).json({ error: 'placa, marca, nombre_equipo y serial son requeridos.' });
    }
    const qr_token = randomUUID();
    const result = db.prepare(`
      INSERT INTO inventario_equipos
        (placa,marca,nombre_equipo,serial,procesador,ram,tipo_ram,cap_disco,tipo_disco,serial_cargador,area,responsable,fecha_compra,qr_token,categoria)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(placa.trim(), marca.trim(), nombre_equipo.trim(), serial.trim(),
           procesador||null, ram||null, tipo_ram||null, cap_disco||null,
           tipo_disco||null, serial_cargador||null, area||null,
           responsable||null, fecha_compra||null, qr_token, categoria||'computadores');
    res.status(201).json({ ok: true, id: result.lastInsertRowid, qr_token });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un equipo con esa placa o serial.' });
    console.error('POST /api/inventario/equipos:', err);
    res.status(500).json({ error: 'Error al crear equipo.' });
  }
});

/* PUT /api/inventario/equipos/:id */
router.put('/api/inventario/equipos/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_equipos WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    }
    const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra, categoria } = req.body;
    db.prepare(`
      UPDATE inventario_equipos SET
        placa=?,marca=?,nombre_equipo=?,serial=?,procesador=?,ram=?,tipo_ram=?,
        cap_disco=?,tipo_disco=?,serial_cargador=?,area=?,responsable=?,
        fecha_compra=?,categoria=?,updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(placa, marca, nombre_equipo, serial,
           procesador||null, ram||null, tipo_ram||null,
           cap_disco||null, tipo_disco||null, serial_cargador||null,
           area||null, responsable||null, fecha_compra||null,
           categoria||'computadores', id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Placa o serial ya existe en otro equipo.' });
    console.error('PUT /api/inventario/equipos/:id:', err);
    res.status(500).json({ error: 'Error al actualizar equipo.' });
  }
});

/* DELETE /api/inventario/equipos/:id */
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

export default router;
