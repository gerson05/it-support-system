import express    from 'express';
import multer     from 'multer';
import path       from 'path';
import fs         from 'fs';
import crypto     from 'crypto';
import os         from 'os';
import QRCode     from 'qrcode';
import { fileURLToPath } from 'url';
import db         from '../config/database.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../uploads/actas-firmadas');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXTS = new Set(['.pdf', '.docx']);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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

/* ── POST /api/actas/token ── */
router.post('/api/actas/token', (req, res) => {
  try {
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
        SET token = ?, entity_ref = ?, filename = NULL, filepath = NULL, uploaded_at = NULL
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/actas/status/:token (público) ── */
router.get('/api/actas/status/:token', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
    if (!row) return res.json({ valid: false });

    if (row.uploaded_at) {
      return res.json({ valid: true, uploaded: true, uploaded_at: row.uploaded_at, entity_ref: row.entity_ref });
    }
    res.json({ valid: true, uploaded: false, entity_ref: row.entity_ref, entity_type: row.entity_type });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/actas/upload/:token (público) ── */
router.post('/api/actas/upload/:token', (req, res, next) => {
  const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
  if (!row) return res.status(404).json({ error: 'Token no encontrado.' });
  if (row.uploaded_at) return res.status(400).json({ error: 'Este documento ya fue subido anteriormente.' });
  next();
}, upload.single('acta'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

    db.prepare(`
      UPDATE acta_uploads
      SET filename = ?, filepath = ?, uploaded_at = datetime('now','localtime')
      WHERE token = ?
    `).run(req.file.originalname, req.file.path, req.params.token);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}, (err, _req, res, _next) => {
  if (err) return res.status(400).json({ error: err.message });
});

/* ── GET /api/actas/download/:token ── */
router.get('/api/actas/download/:token', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM acta_uploads WHERE token = ?').get(req.params.token);
    if (!row || !row.filepath) return res.status(404).json({ error: 'Archivo no encontrado.' });
    if (!fs.existsSync(row.filepath)) return res.status(404).json({ error: 'Archivo no encontrado en disco.' });

    const filename = row.filename || path.basename(row.filepath);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.sendFile(row.filepath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/actas/qr/:token ── */
router.get('/api/actas/qr/:token', async (req, res) => {
  try {
    const row = db.prepare('SELECT token FROM acta_uploads WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Token no encontrado.' });

    const url = `${getBaseUrl(req)}/firmar/${req.params.token}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 200, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/actas/info/:entityType/:entityId ── */
router.get('/api/actas/info/:entityType/:entityId', (req, res) => {
  try {
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
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
