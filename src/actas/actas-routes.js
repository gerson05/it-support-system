import express    from 'express';
import multer     from 'multer';
import path       from 'path';
import fs         from 'fs';
import crypto     from 'crypto';
import QRCode     from 'qrcode';
import { fileURLToPath } from 'url';
import db         from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';
import { getBaseUrl } from '../utils/get-base-url.js';

const canRead = [requireAuth, requirePermission('despacho:read')];
const canEdit = [requireAuth, requirePermission('despacho:edit')];


const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../uploads/actas-firmadas');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXTS = new Set(['.pdf', '.docx']);
const MAX_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.token}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIMES.has(file.mimetype) || !ALLOWED_EXTS.has(ext)) {
      return cb(new Error('Solo se aceptan archivos PDF o DOCX.'));
    }
    cb(null, true);
  },
});

const router = express.Router();

router.get('/api/actas', ...canRead, wrap(async (req, res) => {
  const { q, entity_type, status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = '1=1';
  const params = [];

  if (entity_type) { where += ' AND entity_type = ?'; params.push(entity_type); }
  if (status === 'uploaded') { where += ' AND uploaded_at IS NOT NULL'; }
  if (status === 'pending')  { where += ' AND uploaded_at IS NULL'; }
  if (q) {
    where += ' AND (entity_ref LIKE ? OR token LIKE ? OR d.numero LIKE ? OR d.destinatario LIKE ? OR d.sede LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const joinedWhere = where
    .replace(/\bentity_type\b/g, 'a.entity_type')
    .replace(/\bentity_ref\b/g, 'a.entity_ref')
    .replace(/\btoken\b/g, 'a.token')
    .replace(/\buploaded_at\b/g, 'a.uploaded_at');

  const total = db.prepare(`
    SELECT COUNT(*) as n
    FROM acta_uploads a
    LEFT JOIN despachos d ON a.entity_type = 'despacho' AND d.id = a.entity_id
    WHERE ${joinedWhere}
  `).get(...params).n;

  const actas = db.prepare(`
    SELECT a.*,
           COALESCE(d.numero, a.entity_ref) AS despacho_numero,
           COALESCE(d.destinatario, a.entity_ref, '—') AS despacho_destinatario,
           COALESCE(d.sede, '—') AS despacho_sede,
           d.fecha AS despacho_fecha,
           d.acta_numero AS despacho_acta_numero,
           d.acta_firmada AS despacho_acta_firmada,
           CASE
             WHEN a.uploaded_at IS NOT NULL
               OR a.filename IS NOT NULL
               OR a.filepath IS NOT NULL
               OR COALESCE(a.signed_by, '') <> ''
               OR COALESCE(a.signed_role, '') <> ''
               OR COALESCE(d.acta_firmada, 0) = 1
             THEN 1 ELSE 0
           END AS acta_firmada_real,
           CASE
             WHEN a.uploaded_at IS NOT NULL
               OR a.filename IS NOT NULL
               OR a.filepath IS NOT NULL
               OR COALESCE(a.signed_by, '') <> ''
               OR COALESCE(a.signed_role, '') <> ''
               OR COALESCE(d.acta_firmada, 0) = 1
             THEN 'firmada'
             WHEN a.token IS NOT NULL THEN 'pendiente'
             ELSE 'sin_link'
           END AS acta_estado,
           CASE
             WHEN COALESCE(a.signed_by, '') <> '' THEN a.signed_by
             WHEN COALESCE(d.acta_firmada, 0) = 1 THEN 'Firmada'
             ELSE NULL
           END AS firmante_display
    FROM acta_uploads a
    LEFT JOIN despachos d ON a.entity_type = 'despacho' AND d.id = a.entity_id
    WHERE ${joinedWhere}
    ORDER BY a.rowid DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  const base = getBaseUrl(req);
  const actasWithUrl = actas.map(a => ({
    ...a,
    url: a.token ? `${base}/firmar/${a.token}` : null,
  }));
  res.json({ actas: actasWithUrl, total });
}));

router.post('/api/actas/token', ...canEdit, wrap(async (req, res) => {
  const { entity_type, entity_id, entity_ref } = req.body;
  if (!entity_type || !entity_id || !entity_ref) {
    return res.status(400).json({ error: 'entity_type, entity_id y entity_ref son obligatorios.' });
  }

  const existing = db.prepare(
    'SELECT * FROM acta_uploads WHERE entity_type = ? AND entity_id = ?'
  ).get(entity_type, Number(entity_id));

  const token = crypto.randomUUID();

  if (existing) {
    if (existing.filepath && fs.existsSync(existing.filepath)) {
      fs.unlinkSync(existing.filepath);
    }
    db.prepare(`
      UPDATE acta_uploads
      SET token = ?, entity_ref = ?, filename = NULL, filepath = NULL, signed_by = NULL, signed_role = NULL, uploaded_at = NULL
      WHERE entity_type = ? AND entity_id = ?
    `).run(token, entity_ref, entity_type, Number(entity_id));
  } else {
    db.prepare(`
      INSERT INTO acta_uploads (token, entity_type, entity_id, entity_ref)
      VALUES (?, ?, ?, ?)
    `).run(token, entity_type, Number(entity_id), entity_ref);
  }

  const url = `${getBaseUrl(req)}/firmar/${token}`;
  res.json({ token, url });
}));

router.get('/api/actas/status/:token', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
  if (!row) return res.json({ valid: false });
  const uploaded = !!(
    row.uploaded_at || row.filename || row.filepath || row.signed_by || row.signed_role
  );

  if (uploaded) {
    return res.json({
      valid: true,
      uploaded: true,
      uploaded_at: row.uploaded_at || null,
      entity_ref: row.entity_ref,
      signed_by: row.signed_by || null,
      signed_role: row.signed_role || null,
    });
  }
  res.json({ valid: true, uploaded: false, entity_ref: row.entity_ref, entity_type: row.entity_type });
}));

router.post('/api/actas/upload/:token',
  (req, res, next) => {
    const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Token no encontrado.' });
    if (row.filepath && fs.existsSync(row.filepath)) {
      try { fs.unlinkSync(row.filepath); } catch (e) { console.error('Error al eliminar acta previa:', e); }
    }
    next();
  },
  upload.single('acta'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

    db.prepare(`
      UPDATE acta_uploads
      SET filename = ?, filepath = ?, signed_by = ?, signed_role = ?, uploaded_at = datetime('now','localtime')
      WHERE token = ?
    `).run(
      req.file.originalname,
      req.file.path,
      (req.body.signed_by || '').trim() || null,
      (req.body.signed_role || '').trim() || null,
      req.params.token,
    );

    const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
    if (row && row.entity_type === 'despacho') {
      db.prepare('UPDATE despachos SET acta_firmada = 1 WHERE id = ?').run(row.entity_id);
    }

    res.json({ ok: true });
  }),
  (err, _req, res, next) => {
    if (err.name === 'MulterError' || err.message?.includes('Solo se aceptan')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
);

router.get('/api/actas/download/:token', wrap(async (req, res) => {
  const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
  if (!row || !row.filepath) return res.status(404).json({ error: 'Archivo no encontrado.' });
  if (!fs.existsSync(row.filepath)) return res.status(404).json({ error: 'Archivo no encontrado en disco.' });

  const filename = row.filename || path.basename(row.filepath);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.sendFile(row.filepath);
}));

router.get('/api/actas/qr/:token', wrap(async (req, res) => {
  const row = db.prepare('SELECT token FROM acta_uploads WHERE token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Token no encontrado.' });

  const url = `${getBaseUrl(req)}/firmar/${req.params.token}`;
  const png = await QRCode.toBuffer(url, { type: 'png', width: 200, margin: 1 });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
}));

router.get('/api/actas/info/:entityType/:entityId', ...canRead, wrap(async (req, res) => {
  const { entityType, entityId } = req.params;
  const row = db.prepare(
    'SELECT * FROM acta_uploads WHERE entity_type = ? AND entity_id = ?'
  ).get(entityType, Number(entityId));

  if (!row) return res.json({ token: null });

  const url = `${getBaseUrl(req)}/firmar/${row.token}`;
  res.json({
    token:       row.token,
    url,
    uploaded:    !!row.uploaded_at,
    uploaded_at: row.uploaded_at || null,
    filename:    row.filename    || null,
    signed_by:   row.signed_by   || null,
    signed_role: row.signed_role || null,
  });
}));

export default router;
