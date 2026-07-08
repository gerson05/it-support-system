import express from 'express';
import crypto  from 'crypto';
import QRCode  from 'qrcode';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { getBaseUrl } from './import-service.js';
import { getSedeCode, nextConsecutivo } from './sede-codes.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('inventario:read')];
const canCreate = [requireAuth, requirePermission('inventario:create')];

router.post('/api/inventario/registro-token', ...canCreate, wrap(async (req, res) => {
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
}));

router.get('/api/inventario/registro-tokens', ...canRead, wrap(async (req, res) => {
  const rows = db.prepare(`
    SELECT id,token,tipo,label,created_by,expires_at,max_uses,use_count,active,created_at
    FROM registro_tokens ORDER BY created_at DESC LIMIT 50
  `).all();
  res.json({ tokens: rows });
}));

router.delete('/api/inventario/registro-tokens/:id', ...canCreate, wrap(async (req, res) => {
  db.prepare('UPDATE registro_tokens SET active=0 WHERE id=?').run(parseInt(req.params.id));
  res.json({ ok: true });
}));

router.get('/api/inventario/registro-status/:token', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM registro_tokens WHERE token=?').get(req.params.token);
  if (!row || !row.active) return res.json({ valid: false, reason: 'Enlace no válido.' });
  if (row.expires_at && new Date(row.expires_at) < new Date())
    return res.json({ valid: false, reason: 'Este enlace ha expirado.' });
  if (row.max_uses !== null && row.use_count >= row.max_uses)
    return res.json({ valid: false, reason: 'Este enlace ya alcanzó el límite de usos.' });
  res.json({
    valid:      true,
    tipo:       row.tipo,
    label:      row.label,
    use_count:  row.use_count,
    max_uses:   row.max_uses,
    expires_at: row.expires_at,
  });
}));

router.get('/api/inventario/registro-qr/:token', wrap(async (req, res) => {
  const row = db.prepare('SELECT token FROM registro_tokens WHERE token=?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Token no encontrado.' });
  const url = `${getBaseUrl(req)}/registrar/${req.params.token}`;
  const png = await QRCode.toBuffer(url, { type:'png', width:280, margin:1 });
  res.setHeader('Content-Type','image/png');
  res.send(png);
}));

router.get('/api/inventario/registrar/:token/next-placa', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM registro_tokens WHERE token=?').get(req.params.token);
  if (!row || !row.active) return res.status(403).json({ error: 'Token inválido.' });
  if (row.expires_at && new Date(row.expires_at) < new Date())
    return res.status(403).json({ error: 'Token expirado.' });
  const sede = req.query.sede || '';
  const code = getSedeCode(sede);
  const num  = nextConsecutivo(db, code);
  res.json({ placa: `AF-${code}${num}` });
}));

router.post('/api/inventario/registrar/:token', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM registro_tokens WHERE token=?').get(req.params.token);
  if (!row || !row.active) return res.status(403).json({ error: 'Enlace no válido.' });
  if (row.expires_at && new Date(row.expires_at) < new Date())
    return res.status(403).json({ error: 'Enlace expirado.' });
  if (row.max_uses !== null && row.use_count >= row.max_uses)
    return res.status(403).json({ error: 'Límite de usos alcanzado.' });

  const tipo = row.tipo;
  const b    = req.body;
  let   id;

  try {
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
          (placa,fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(b.placa||null,b.fecha_registro||null,b.area||null,b.ciudad||null,b.nombre_completo.trim(),
             b.cedula||null,b.linea||null,b.operador||null,b.equipo||null,
             b.almacenamiento||null,b.ram||null,b.modelo||null,b.imei.trim(),
             b.imei2||null,b.estado||'nuevo',b.accesorio||null,b.fecha_entrega||null,b.entregado_por||null);
      if (!r.changes) return res.status(409).json({ error: 'Ya existe un celular con ese IMEI.' });
      id = r.lastInsertRowid;
    }
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Registro duplicado.' });
    throw err;
  }

  db.prepare('UPDATE registro_tokens SET use_count=use_count+1 WHERE token=?').run(req.params.token);
  res.status(201).json({ ok: true, id });
}));

export default router;
