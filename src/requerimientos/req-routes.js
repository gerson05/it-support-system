// src/requerimientos/req-routes.js
import express    from 'express';
import crypto     from 'node:crypto';
import multer     from 'multer';
import path       from 'node:path';
import fs         from 'node:fs';
import db         from '../config/database.js';
import { sendReqEmail } from './email-service.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

// ── Photo upload ────────────────────────────────────────────────────────
const uploadDir = 'uploads/requerimientos';
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file,  cb) =>
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// ── Admin auth ──────────────────────────────────────────────────────────
const ADMIN_USER = process.env.REQ_ADMIN_USER || 'GESTION';
const ADMIN_PASS = process.env.REQ_ADMIN_PASS || 'GST123';
if (!process.env.REQ_ADMIN_USER || !process.env.REQ_ADMIN_PASS)
  console.warn('[Req] WARNING: REQ_ADMIN_USER / REQ_ADMIN_PASS not set, using insecure defaults');
const TOKEN_TTL  = 8 * 60 * 60 * 1000; // 8 h

function makeToken(ts) {
  if (!process.env.REQ_ADMIN_SECRET) console.warn('[Req] WARNING: REQ_ADMIN_SECRET not set, using insecure default');
  const secret = process.env.REQ_ADMIN_SECRET || 'dev-secret';
  const hmac   = crypto.createHmac('sha256', secret).update(`${ADMIN_USER}:${ts}`).digest('hex');
  return `${hmac}.${ts}`;
}

function verifyAdminToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  const [hmac, tsStr] = auth.slice(7).split('.');
  const ts = parseInt(tsStr, 10);
  if (!ts || Date.now() - ts > TOKEN_TTL) return false;
  const secret = process.env.REQ_ADMIN_SECRET || 'dev-secret';
  const expected = crypto.createHmac('sha256', secret).update(`${ADMIN_USER}:${ts}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// ── Puntos cache ────────────────────────────────────────────────────────
let puntosCache = null;
let puntosTs    = 0;

// ── Ticket numbering ────────────────────────────────────────────────────
function nextTicket() {
  const now = new Date();
  const ym  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = db.prepare(
    "SELECT ticket_num FROM requerimientos WHERE ticket_num LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`REQ-${ym}-%`);
  let seq = 1;
  if (last) {
    const m = last.ticket_num.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `REQ-${ym}-${String(seq).padStart(3, '0')}`;
}

// ── GET /api/req/puntos ─────────────────────────────────────────────────
router.get('/api/req/puntos', async (_req, res) => {
  if (puntosCache && Date.now() - puntosTs < 10 * 60 * 1000) return res.json(puntosCache);
  try {
    const { readSheet } = await import('../farmacias/sheets-service.js');
    const data   = await readSheet();
    const puntos = [];
    data.forEach(dept => {
      dept.municipios?.forEach(muni => {
        muni.farmacias?.forEach(f => {
          if (f.nombre) puntos.push({ nombre: f.nombre, municipio: muni.nombre || '', departamento: dept.nombre || '' });
        });
      });
    });
    puntosCache = puntos;
    puntosTs    = Date.now();
    res.json(puntos);
  } catch { res.json([]); }
});

// ── POST /api/req/upload-foto ───────────────────────────────────────────
router.post('/api/req/upload-foto', upload.array('fotos', 5), (req, res) => {
  const rutas = (req.files || []).map(f => `/uploads/requerimientos/${f.filename}`);
  res.json({ rutas });
});

// ── POST /api/req/admin/login ───────────────────────────────────────────
router.post('/api/req/admin/login', (req, res) => {
  const { usuario, password } = req.body || {};
  if (usuario !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  const ts = Date.now();
  res.json({ token: makeToken(ts) });
});

// ── POST /api/req ───────────────────────────────────────────────────────
router.post('/api/req', wrap(async (req, res) => {
  const { area, nombre, correo, punto, tipo, descripcion,
          fecha_requerida, ticket_relacionado, observaciones, prioridad, fotos } = req.body;

  if (!area?.trim() || !nombre?.trim() || !punto?.trim() || !tipo?.trim() || !descripcion?.trim())
    return res.status(400).json({ error: 'Campos requeridos: area, nombre, punto, tipo, descripcion.' });

  const TIPOS_VALIDOS = ['Locativo','Sistemas','Bodega','Calidad','Mantenimiento','Otro'];
  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });

  const PRIORIDADES_VALIDAS = ['NORMAL', 'ALTA', 'URGENTE'];
  if (prioridad && !PRIORIDADES_VALIDAS.includes(prioridad))
    return res.status(400).json({ error: 'Prioridad inválida.' });

  const ticket_num = nextTicket();

  db.prepare(`INSERT INTO requerimientos
    (ticket_num,area,nombre,correo,punto,tipo,descripcion,fecha_requerida,ticket_relacionado,observaciones,prioridad,fotos)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(ticket_num, area.trim(), nombre.trim(), (correo||'').trim(), punto.trim(),
         tipo, descripcion.trim(), fecha_requerida||'', ticket_relacionado||'',
         observaciones||'', prioridad||'NORMAL', JSON.stringify(fotos||[]));

  sendReqEmail({ ticket_num, area, nombre, correo, punto, tipo,
                 descripcion, fecha_requerida, observaciones, prioridad })
    .catch(e => console.error('[Req] Email error:', e.message));

  res.json({ ok: true, ticket_num });
}));

// ── GET /api/req ────────────────────────────────────────────────────────
router.get('/api/req', (req, res) => {
  const { q, tipo, estado, prioridad, page = '1' } = req.query;
  const limit  = 20;
  const parsedPage = parseInt(page, 10);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (safePage - 1) * limit;
  const where  = [];
  const params = [];

  if (q)         { where.push('(ticket_num LIKE ? OR punto LIKE ? OR descripcion LIKE ? OR nombre LIKE ?)'); const s=`%${q}%`; params.push(s,s,s,s); }
  if (tipo)      { where.push('tipo = ?');      params.push(tipo); }
  if (estado)    { where.push('estado = ?');    params.push(estado); }
  if (prioridad) { where.push('prioridad = ?'); params.push(prioridad); }

  const W     = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows  = db.prepare(`SELECT * FROM requerimientos ${W} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM requerimientos ${W}`).get(...params).c;

  res.json({ rows, total, page: safePage, pages: Math.ceil(total / limit) });
});

// ── GET /api/req/:id ────────────────────────────────────────────────────
router.get('/api/req/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM requerimientos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrado.' });
  res.json(row);
});

// ── PUT /api/req/:id/estado ─────────────────────────────────────────────
router.put('/api/req/:id/estado', (req, res) => {
  if (!verifyAdminToken(req)) return res.status(401).json({ error: 'No autorizado.' });
  const ESTADOS = ['Recibido','Asignado','En proceso','Pendiente info','Resuelto','Cancelado'];
  const { estado } = req.body || {};
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });
  const info = db.prepare(`UPDATE requerimientos SET estado=?, updated_at=datetime('now','localtime') WHERE id=?`)
                 .run(estado, req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'No encontrado.' });
  res.json({ ok: true });
});

export default router;
