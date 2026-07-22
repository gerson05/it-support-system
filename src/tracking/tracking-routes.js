import express   from 'express';
import multer    from 'multer';
import path      from 'path';
import fs        from 'fs';
import QRCode    from 'qrcode';
import { fileURLToPath } from 'url';
import db        from '../config/database.js';
import {
  createTracking, getTrackingByToken, getAllTrackings,
  addEvento, addEntregaItems, saveActaFinal,
  marcarDevuelto, countRecentEventos, getDistinctCargos,
  getTrackingRow, getActaFinalByToken, getSedesActivas,
  getTrackingByDespachoId,
} from './tracking-model.js';
import { notifyTrackingEvento } from './tracking-notifier.js';
import { generateActaReceptor  } from './acta-receptor.js';
import { generateRotuloHtml    } from './rotulo-generator.js';
import { getBaseUrl            } from '../utils/url.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const router    = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FOTOS_DIR = path.resolve(__dirname, '../../uploads/tracking-fotos');
if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

const fotoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FOTOS_DIR),
  filename: (req, file, cb) => {
    const ext   = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.params.token}-${Date.now()}${ext}`);
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

const canRead = [requireAuth, requirePermission('despacho:read')];
const canEdit = [requireAuth, requirePermission('despacho:edit')];

function validateTracking(req, res, next) {
  const tracking = getTrackingRow(db, req.params.token);
  if (!tracking) return res.status(404).json({ error: 'Paquete no encontrado.' });
  if (['entregado', 'devuelto'].includes(tracking.estado))
    return res.status(409).json({ error: 'Este paquete ya fue entregado o devuelto.' });
  if (countRecentEventos(db, tracking.id) >= 5)
    return res.status(429).json({ error: 'Demasiados intentos. Espera antes de registrar otro evento.' });
  req._tracking = tracking;
  next();
}

// Route-level multer error handler — 400 for multer/file errors, rethrows others
const multerErrHandler = (err, _req, res, next) => {
  if (err.name === 'MulterError' || err.message?.includes('Solo se aceptan')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

/* ══════════════════════════════════════════════════
   PUBLIC ENDPOINTS
   ══════════════════════════════════════════════════ */

router.get('/api/tracking/public/sedes', wrap(async (req, res) => {
  res.json({ sedes: getSedesActivas(db), cargos: getDistinctCargos(db) });
}));

router.get('/api/tracking/public/:token', wrap(async (req, res) => {
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
    token:        tracking.token,
    estado:       tracking.estado,
    numero:       tracking.numero,
    destinatario: tracking.destinatario,
    sede_destino: tracking.sede_destino,
    fecha:        tracking.fecha,
    articulos:    tracking.articulos_parsed,
    eventos,
    tiene_acta:   !!tracking.acta_final,
  });
}));

router.post('/api/tracking/public/:token/evento',
  validateTracking,
  uploadFoto.single('foto'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'La fotografía es obligatoria.' });
    const { recibido_por, entregado_por, ubicacion, sede_id, observaciones } = req.body;
    if (!recibido_por?.trim())  return res.status(400).json({ error: 'Tu nombre es obligatorio.' });
    if (!entregado_por?.trim()) return res.status(400).json({ error: 'El nombre de quien entrega es obligatorio.' });
    if (!ubicacion?.trim())     return res.status(400).json({ error: 'La ubicación es obligatoria.' });

    const { eventoId, nuevoEstado } = addEvento(db, req._tracking.id, {
      tipo: 'recepcion', recibido_por: recibido_por.trim(),
      entregado_por: entregado_por.trim(), ubicacion: ubicacion.trim(),
      sede_id: sede_id ? parseInt(sede_id) : null,
      observaciones: observaciones?.trim() || null,
      foto_path: req.file.path, foto_filename: req.file.filename,
      es_entrega_final: false, ip: req.ip,
    });

    const tracking = getTrackingByToken(db, req.params.token);
    notifyTrackingEvento(tracking, tracking.eventos.find(e => e.id === eventoId)).catch(() => {});
    res.json({ ok: true, estado: nuevoEstado });
  }),
  multerErrHandler
);

router.post('/api/tracking/public/:token/entrega-final',
  validateTracking,
  uploadFoto.single('foto'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'La fotografía es obligatoria.' });
    const { recibido_por, entregado_por, ubicacion, sede_id,
            cargo_receptor, observaciones, items } = req.body;
    if (!recibido_por?.trim())  return res.status(400).json({ error: 'Tu nombre es obligatorio.' });
    if (!entregado_por?.trim()) return res.status(400).json({ error: 'El nombre de quien entrega es obligatorio.' });
    if (!ubicacion?.trim())     return res.status(400).json({ error: 'La ubicación es obligatoria.' });

    let itemsParsed = [];
    try { itemsParsed = typeof items === 'string' ? JSON.parse(items) : (items || []); } catch {}

    const { eventoId } = addEvento(db, req._tracking.id, {
      tipo: 'entrega_final', recibido_por: recibido_por.trim(),
      entregado_por: entregado_por.trim(), ubicacion: ubicacion.trim(),
      sede_id: sede_id ? parseInt(sede_id) : null,
      cargo_receptor: cargo_receptor?.trim() || null,
      observaciones: observaciones?.trim() || null,
      foto_path: req.file.path, foto_filename: req.file.filename,
      es_entrega_final: true, ip: req.ip,
    });

    if (itemsParsed.length > 0) addEntregaItems(db, eventoId, itemsParsed);

    const tracking = getTrackingByToken(db, req.params.token);
    const despacho = db.prepare('SELECT * FROM despachos WHERE id = ?').get(req._tracking.despacho_id);
    const evento   = tracking.eventos.find(e => e.id === eventoId);

    const actaItems = itemsParsed.length > 0
      ? itemsParsed
      : tracking.articulos_parsed.map((a, i) => ({
          item_index: i, equipment_name: a.nombre || a.descripcion || 'Artículo',
          cantidad: a.cantidad || 1, recibido_conforme: 1, observacion_item: null,
        }));

    const { filepath, filename } = await generateActaReceptor(despacho, evento, actaItems);
    saveActaFinal(db, req._tracking.id, {
      filepath, filename, firmado_por: recibido_por.trim(), cargo: cargo_receptor?.trim() || '',
    });
    notifyTrackingEvento(tracking, evento).catch(() => {});
    res.json({ ok: true, estado: 'entregado', acta_disponible: true });
  }),
  multerErrHandler
);

router.get('/api/tracking/public/:token/acta-final', wrap(async (req, res) => {
  const acta = getActaFinalByToken(db, req.params.token);
  if (!acta || !fs.existsSync(acta.filepath)) return res.status(404).json({ error: 'Acta no disponible.' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(acta.filename)}"`);
  res.sendFile(acta.filepath);
}));

/* ══════════════════════════════════════════════════
   AUTHENTICATED ENDPOINTS
   ══════════════════════════════════════════════════ */

router.get('/api/tracking/fotos/:filename', ...canRead, (req, res) => {
  const filepath = path.join(FOTOS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Foto no encontrada.' });
  res.sendFile(filepath);
});

router.get('/api/tracking', ...canRead, wrap(async (req, res) => {
  const { estado, search, limit = 50, offset = 0 } = req.query;
  res.json(getAllTrackings(db, { estado, search, limit: parseInt(limit), offset: parseInt(offset) }));
}));

router.get('/api/tracking/:token/rotulo', ...canRead, wrap(async (req, res) => {
  const row = db.prepare(`
    SELECT t.token, d.numero, d.destinatario, d.sede as sede_destino, d.fecha
    FROM paquete_tracking t JOIN despachos d ON d.id = t.despacho_id
    WHERE t.token = ?
  `).get(req.params.token);
  if (!row) return res.status(404).json({ error: 'No encontrado.' });

  const trackingUrl  = `${getBaseUrl(req)}/rastrear/${req.params.token}`;
  const sedesActivas = req.query.modo === 'todos' ? getSedesActivas(db) : [];
  const html         = await generateRotuloHtml(row, req.query, trackingUrl, sedesActivas);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}));

router.get('/api/tracking/:token/qr', ...canRead, wrap(async (req, res) => {
  const tracking = getTrackingRow(db, req.params.token);
  if (!tracking) return res.status(404).json({ error: 'No encontrado.' });
  const png = await QRCode.toBuffer(`${getBaseUrl(req)}/rastrear/${req.params.token}`, { type: 'png', width: 300, margin: 2 });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
}));

router.put('/api/tracking/:token/estado', ...canEdit, wrap(async (req, res) => {
  const { estado } = req.body;
  if (estado !== 'devuelto') return res.status(400).json({ error: "Solo se permite estado 'devuelto'." });
  const ok = marcarDevuelto(db, req.params.token);
  if (!ok) return res.status(404).json({ error: 'No encontrado o ya está en estado final.' });
  res.json({ ok: true });
}));

router.get('/api/tracking/by-despacho/:despachoId', ...canRead, wrap(async (req, res) => {
  const row = getTrackingByDespachoId(db, parseInt(req.params.despachoId));
  if (!row) return res.json({ token: null });
  res.json({ token: row.token, qr_url: `${getBaseUrl(req)}/api/tracking/${row.token}/qr` });
}));

router.get('/api/tracking/:token', ...canRead, wrap(async (req, res) => {
  const tracking = getTrackingByToken(db, req.params.token);
  if (!tracking) return res.status(404).json({ error: 'No encontrado.' });
  tracking.qr_url = `${getBaseUrl(req)}/rastrear/${tracking.token}`;
  res.json(tracking);
}));

export default router;
