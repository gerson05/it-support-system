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

/* GET /api/inventario/ups/next-placa?sede=YUMBO */
router.get('/api/inventario/ups/next-placa', ...canRead, (req, res) => {
  try {
    const sede = req.query.sede || '';
    const code = getSedeCode(sede);
    const num  = nextConsecutivo(db, code);
    res.json({ placa: `AF-${code}${num}`, code, num });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular placa.' });
  }
});

/* GET /api/inventario/ups */
router.get('/api/inventario/ups', ...canRead, (req, res) => {
  try {
    const { search, area, page = 1, limit = 20 } = req.query;
    const where = [], params = [];
    if (search) {
      where.push('(placa LIKE ? OR marca LIKE ? OR nombre_equipo LIKE ? OR serial LIKE ? OR area LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (area) { where.push('area LIKE ?'); params.push(`%${area}%`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows = db.prepare(`SELECT * FROM inventario_ups ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_ups ${wc}`).get(...params);
    res.json({ ups: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* POST /api/inventario/ups */
router.post('/api/inventario/ups', ...canCreate, (req, res) => {
  try {
    const { placa, marca, nombre_equipo, serial, area, voltaje, fecha_compra, fecha_despacho } = req.body;
    if (!placa?.trim()) return res.status(400).json({ error: 'placa es requerida.' });
    const qr_token = randomUUID();
    const result = db.prepare(
      `INSERT INTO inventario_ups (placa,marca,nombre_equipo,serial,area,voltaje,fecha_compra,fecha_despacho,qr_token) VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(placa.trim(), marca||null, nombre_equipo||null, serial||null, area||null, voltaje||null, fecha_compra||null, fecha_despacho||null, qr_token);
    res.status(201).json({ ok: true, id: result.lastInsertRowid, qr_token });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una UPS con esa placa.' });
    res.status(500).json({ error: err.message });
  }
});

/* PUT /api/inventario/ups/:id */
router.put('/api/inventario/ups/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_ups WHERE id=?').get(id)) return res.status(404).json({ error: 'UPS no encontrada.' });
    const { placa, marca, nombre_equipo, serial, area, voltaje, fecha_compra, fecha_despacho } = req.body;
    db.prepare(
      `UPDATE inventario_ups SET placa=?,marca=?,nombre_equipo=?,serial=?,area=?,voltaje=?,fecha_compra=?,fecha_despacho=?,updated_at=datetime('now','localtime') WHERE id=?`
    ).run(placa, marca||null, nombre_equipo||null, serial||null, area||null, voltaje||null, fecha_compra||null, fecha_despacho||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Placa ya existe en otra UPS.' });
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/inventario/ups/:id */
router.delete('/api/inventario/ups/:id', ...canDelete, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventario_ups WHERE id=?').run(parseInt(req.params.id));
    if (!result.changes) return res.status(404).json({ error: 'UPS no encontrada.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
