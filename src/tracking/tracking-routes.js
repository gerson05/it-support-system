import express   from 'express';
import multer    from 'multer';
import path      from 'path';
import fs        from 'fs';
import QRCode    from 'qrcode';
import os        from 'os';
import { fileURLToPath } from 'url';
import db        from '../config/database.js';
import {
  createTracking, getTrackingByToken, getAllTrackings,
  addEvento, addEntregaItems, saveActaFinal,
  marcarDevuelto, countRecentEventos, getDistinctCargos,
} from './tracking-model.js';
import { notifyTrackingEvento } from './tracking-notifier.js';
import { generateActaReceptor  } from './acta-receptor.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router   = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FOTOS_DIR = path.resolve(__dirname, '../../uploads/tracking-fotos');
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

const fotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FOTOS_DIR),
  filename: (req, file, cb) => {
    const ext   = path.extname(file.originalname).toLowerCase() || '.jpg';
    const stamp = Date.now();
    cb(null, `${req.params.token}-${stamp}${ext}`);
  },
});
const uploadFoto = multer({
  storage: fotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se aceptan imágenes JPG o PNG.'));
  },
});

function getBaseUrl(req) {
  if (process.env.PUBLIC_TUNNEL_URL) return process.env.PUBLIC_TUNNEL_URL;
  const host = req.headers.host || '';
  const isLocal = /^(localhost|127\.|::1)/i.test(host);
  if (isLocal) {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal)
          return `${req.protocol}://${a.address}:${host.split(':')[1] || '3000'}`;
      }
    }
  }
  return `${req.protocol}://${host}`;
}

const canRead = [requireAuth, requirePermission('despacho:read')];
const canEdit = [requireAuth, requirePermission('despacho:edit')];

/* ══════════════════════════════════════════════════
   PUBLIC ENDPOINTS (no auth)
   ══════════════════════════════════════════════════ */

/* GET /api/tracking/public/sedes — MUST be before /public/:token */
router.get('/api/tracking/public/sedes', (req, res) => {
  try {
    const sedes  = db.prepare('SELECT id, ciudad, nombre_punto FROM sedes WHERE activo = 1 ORDER BY ciudad, nombre_punto').all();
    const cargos = getDistinctCargos(db);
    res.json({ sedes, cargos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/tracking/public/:token — package info for public page */
router.get('/api/tracking/public/:token', (req, res) => {
  try {
    const tracking = getTrackingByToken(db, req.params.token);
    if (!tracking) return res.status(404).json({ error: 'Paquete no encontrado.' });

    const eventos = tracking.eventos.map(e => ({
      id: e.id, tipo: e.tipo, recibido_por: e.recibido_por,
      entregado_por: e.entregado_por, ubicacion: e.ubicacion,
      observaciones: e.observaciones, estado_paquete: e.estado_paquete,
      created_at: e.created_at,
      tiene_foto: !!e.foto_path && e.foto_path !== 'system',
    }));

    res.json({
      token:         tracking.token,
      estado:        tracking.estado,
      numero:        tracking.numero,
      destinatario:  tracking.destinatario,
      sede_destino:  tracking.sede_destino,
      fecha:         tracking.fecha,
      articulos:     tracking.articulos_parsed,
      eventos,
      tiene_acta:    !!tracking.acta_final,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* POST /api/tracking/public/:token/evento — register reception */
router.post('/api/tracking/public/:token/evento',
  (req, res, next) => {
    const t = db.prepare('SELECT * FROM paquete_tracking WHERE token = ?').get(req.params.token);
    if (!t) return res.status(404).json({ error: 'Paquete no encontrado.' });
    if (['entregado', 'devuelto'].includes(t.estado)) {
      return res.status(409).json({ error: 'Este paquete ya fue entregado o devuelto.' });
    }
    if (countRecentEventos(db, t.id) >= 5) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera antes de registrar otro evento.' });
    }
    req._tracking = t;
    next();
  },
  uploadFoto.single('foto'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'La fotografía es obligatoria.' });

      const { recibido_por, entregado_por, ubicacion, sede_id, observaciones } = req.body;
      if (!recibido_por?.trim()) return res.status(400).json({ error: 'Tu nombre es obligatorio.' });
      if (!entregado_por?.trim()) return res.status(400).json({ error: 'El nombre de quien entrega es obligatorio.' });
      if (!ubicacion?.trim()) return res.status(400).json({ error: 'La ubicación es obligatoria.' });

      const { eventoId, nuevoEstado } = addEvento(db, req._tracking.id, {
        tipo:          'recepcion',
        recibido_por:  recibido_por.trim(),
        entregado_por: entregado_por.trim(),
        ubicacion:     ubicacion.trim(),
        sede_id:       sede_id ? parseInt(sede_id) : null,
        observaciones: observaciones?.trim() || null,
        foto_path:     req.file.path,
        foto_filename: req.file.filename,
        es_entrega_final: false,
        ip:            req.ip,
      });

      const tracking = getTrackingByToken(db, req.params.token);
      const evento   = tracking.eventos.find(e => e.id === eventoId);
      notifyTrackingEvento(tracking, evento).catch(() => {});

      res.json({ ok: true, estado: nuevoEstado });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },
  (err, _req, res, _next) => res.status(400).json({ error: err.message })
);

/* POST /api/tracking/public/:token/entrega-final — final delivery + acta */
router.post('/api/tracking/public/:token/entrega-final',
  (req, res, next) => {
    const t = db.prepare('SELECT * FROM paquete_tracking WHERE token = ?').get(req.params.token);
    if (!t) return res.status(404).json({ error: 'Paquete no encontrado.' });
    if (['entregado', 'devuelto'].includes(t.estado)) {
      return res.status(409).json({ error: 'Este paquete ya fue entregado.' });
    }
    if (countRecentEventos(db, t.id) >= 5) {
      return res.status(429).json({ error: 'Demasiados intentos. Espera antes de registrar otro evento.' });
    }
    req._tracking = t;
    next();
  },
  uploadFoto.single('foto'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'La fotografía es obligatoria.' });

      const { recibido_por, entregado_por, ubicacion, sede_id,
              cargo_receptor, observaciones, items } = req.body;

      if (!recibido_por?.trim()) return res.status(400).json({ error: 'Tu nombre es obligatorio.' });
      if (!entregado_por?.trim()) return res.status(400).json({ error: 'El nombre de quien entrega es obligatorio.' });
      if (!ubicacion?.trim()) return res.status(400).json({ error: 'La ubicación es obligatoria.' });

      let itemsParsed = [];
      try { itemsParsed = typeof items === 'string' ? JSON.parse(items) : (items || []); } catch {}

      const { eventoId } = addEvento(db, req._tracking.id, {
        tipo:            'entrega_final',
        recibido_por:    recibido_por.trim(),
        entregado_por:   entregado_por.trim(),
        ubicacion:       ubicacion.trim(),
        sede_id:         sede_id ? parseInt(sede_id) : null,
        cargo_receptor:  cargo_receptor?.trim() || null,
        observaciones:   observaciones?.trim() || null,
        foto_path:       req.file.path,
        foto_filename:   req.file.filename,
        es_entrega_final: true,
        ip:              req.ip,
      });

      if (itemsParsed.length > 0) {
        addEntregaItems(db, eventoId, itemsParsed);
      }

      const tracking = getTrackingByToken(db, req.params.token);
      const despacho = db.prepare('SELECT * FROM despachos WHERE id = ?').get(req._tracking.despacho_id);
      const evento   = tracking.eventos.find(e => e.id === eventoId);

      const actaItems = itemsParsed.length > 0 ? itemsParsed : tracking.articulos_parsed.map((a, i) => ({
        item_index: i, equipment_name: a.nombre || a.descripcion || 'Artículo',
        cantidad: a.cantidad || 1, recibido_conforme: 1, observacion_item: null,
      }));

      const { filepath, filename } = await generateActaReceptor(despacho, evento, actaItems);
      saveActaFinal(db, req._tracking.id, { filepath, filename,
        firmado_por: recibido_por.trim(), cargo: cargo_receptor?.trim() || '' });

      notifyTrackingEvento(tracking, evento).catch(() => {});

      res.json({ ok: true, estado: 'entregado', acta_disponible: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },
  (err, _req, res, _next) => res.status(400).json({ error: err.message })
);

/* GET /api/tracking/public/:token/acta-final — download acta (public) */
router.get('/api/tracking/public/:token/acta-final', (req, res) => {
  try {
    const tracking = db.prepare('SELECT id FROM paquete_tracking WHERE token = ?').get(req.params.token);
    if (!tracking) return res.status(404).json({ error: 'No encontrado.' });

    const acta = db.prepare('SELECT * FROM paquete_acta_final WHERE tracking_id = ?').get(tracking.id);
    if (!acta || !fs.existsSync(acta.filepath)) return res.status(404).json({ error: 'Acta no disponible.' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(acta.filename)}"`);
    res.sendFile(acta.filepath);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   AUTHENTICATED ENDPOINTS
   ══════════════════════════════════════════════════ */

/* GET /api/tracking/fotos/:filename — MUST be before /:token */
router.get('/api/tracking/fotos/:filename', ...canRead, (req, res) => {
  const filepath = path.join(FOTOS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Foto no encontrada.' });
  res.sendFile(filepath);
});

/* GET /api/tracking — list all trackings */
router.get('/api/tracking', ...canRead, (req, res) => {
  try {
    const { estado, search, limit = 50, offset = 0 } = req.query;
    const result = getAllTrackings(db, { estado, search, limit: parseInt(limit), offset: parseInt(offset) });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/tracking/:token/qr — MUST be before /:token */
router.get('/api/tracking/:token/qr', ...canRead, async (req, res) => {
  try {
    const tracking = db.prepare('SELECT token FROM paquete_tracking WHERE token = ?').get(req.params.token);
    if (!tracking) return res.status(404).json({ error: 'No encontrado.' });
    const url = `${getBaseUrl(req)}/rastrear/${req.params.token}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 300, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* PUT /api/tracking/:token/estado — mark as devuelto — MUST be before /:token */
router.put('/api/tracking/:token/estado', ...canEdit, (req, res) => {
  try {
    const { estado } = req.body;
    if (estado !== 'devuelto') return res.status(400).json({ error: "Solo se permite estado 'devuelto'." });
    const ok = marcarDevuelto(db, req.params.token);
    if (!ok) return res.status(404).json({ error: 'No encontrado o ya está en estado final.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/tracking/by-despacho/:despachoId — MUST be before /:token */
router.get('/api/tracking/by-despacho/:despachoId', ...canRead, (req, res) => {
  try {
    const row = db.prepare('SELECT token FROM paquete_tracking WHERE despacho_id = ?').get(parseInt(req.params.despachoId));
    if (!row) return res.json({ token: null });
    res.json({ token: row.token, qr_url: `${getBaseUrl(req)}/api/tracking/${row.token}/qr` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/tracking/:token — full detail */
router.get('/api/tracking/:token', ...canRead, (req, res) => {
  try {
    const tracking = getTrackingByToken(db, req.params.token);
    if (!tracking) return res.status(404).json({ error: 'No encontrado.' });
    tracking.qr_url = `${getBaseUrl(req)}/rastrear/${tracking.token}`;
    res.json(tracking);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
