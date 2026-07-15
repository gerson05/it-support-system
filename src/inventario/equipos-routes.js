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

router.get('/api/inventario/equipos/next-placa', ...canRead, wrap(async (req, res) => {
  const sede = req.query.sede || '';
  const code = getSedeCode(sede);
  const num  = nextConsecutivo(db, code);
  res.json({ placa: `AF-${code}${num}`, code, num });
}));

router.get('/api/inventario/equipos', ...canRead, wrap(async (req, res) => {
  const { search, area, categoria, page = 1, limit = 20 } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(CAST(id AS TEXT) LIKE ? OR placa LIKE ? OR marca LIKE ? OR nombre_equipo LIKE ? OR serial LIKE ? OR responsable LIKE ? OR area LIKE ? OR modelo LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s, s);
  }
  if (area)      { where.push('area LIKE ?');      params.push(`%${area}%`); }
  if (categoria) { where.push('categoria = ?');    params.push(categoria); }
  const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const rows  = db.prepare(`SELECT * FROM inventario_equipos ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_equipos ${wc}`).get(...params);
  res.json({ equipos: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
}));

router.post('/api/inventario/equipos', ...canCreate, wrap(async (req, res) => {
  const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra, categoria } = req.body;
  if (!placa?.trim() || !marca?.trim() || !nombre_equipo?.trim() || !serial?.trim()) {
    return res.status(400).json({ error: 'placa, marca, nombre_equipo y serial son requeridos.' });
  }
  const qr_token = randomUUID();
  try {
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
    throw err;
  }
}));

router.put('/api/inventario/equipos/:id', ...canEdit, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!db.prepare('SELECT id FROM inventario_equipos WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Equipo no encontrado.' });
  }
  const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra, categoria } = req.body;
  try {
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
    throw err;
  }
}));

router.delete('/api/inventario/equipos/:id', ...canDelete, wrap(async (req, res) => {
  const result = db.prepare('DELETE FROM inventario_equipos WHERE id = ?').run(parseInt(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Equipo no encontrado.' });
  res.json({ ok: true });
}));

router.get('/api/inventario/puntos', ...canRead, wrap(async (req, res) => {
  const rows = db.prepare(`
    SELECT area FROM inventario_equipos   WHERE area IS NOT NULL AND area != ''
    UNION
    SELECT area FROM inventario_celulares WHERE area IS NOT NULL AND area != ''
    UNION
    SELECT area FROM inventario_ups       WHERE area IS NOT NULL AND area != ''
    ORDER BY area
  `).all();
  res.json({ puntos: rows.map(r => r.area) });
}));

router.get('/api/inventario/reporte', ...canRead, wrap(async (req, res) => {
  const { area, apiTab, categoria } = req.query;
  const result = { area, resumen: [], equipos: [], celulares: [], ups: [], total: 0 };
  const areaParam  = area ? [`%${area}%`] : [];
  const areaWhere  = area ? 'area LIKE ?' : null;

  if (!apiTab || apiTab === 'equipos') {
    const conditions = areaWhere ? [areaWhere] : [];
    const params     = [...areaParam];
    if (categoria) { conditions.push('categoria = ?'); params.push(categoria); }
    const wc = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    result.equipos = db.prepare(
      `SELECT * FROM inventario_equipos ${wc} ORDER BY categoria, placa`
    ).all(...params);
  }

  if (!apiTab || apiTab === 'celulares') {
    const wc = areaWhere ? `WHERE ${areaWhere}` : '';
    result.celulares = db.prepare(
      `SELECT * FROM inventario_celulares ${wc} ORDER BY modelo`
    ).all(...areaParam);
  }

  if (!apiTab || apiTab === 'ups') {
    const wc = areaWhere ? `WHERE ${areaWhere}` : '';
    result.ups = db.prepare(
      `SELECT * FROM inventario_ups ${wc} ORDER BY placa`
    ).all(...areaParam);
  }

  const cats = {};
  result.equipos.forEach(e => { const k = e.categoria || 'otros'; cats[k] = (cats[k] || 0) + 1; });
  if (result.celulares.length) cats['celulares'] = result.celulares.length;
  if (result.ups.length)       cats['ups']       = result.ups.length;
  result.resumen = Object.entries(cats).map(([categoria, count]) => ({ categoria, count }));
  result.total   = result.equipos.length + result.celulares.length + result.ups.length;

  res.json(result);
}));

export default router;
