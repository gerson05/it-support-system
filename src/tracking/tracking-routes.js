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

const LOGO_PATH = path.resolve(__dirname, '../../uploads/rotulo-imgs/unique_0_id10.png');
const LOGO_B64  = fs.existsSync(LOGO_PATH)
  ? 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64')
  : '';

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

/* GET /api/tracking/:token/rotulo — printable shipping labels with QR */
router.get('/api/tracking/:token/rotulo', ...canRead, async (req, res) => {
  try {
    const row = db.prepare(`
      SELECT t.token, d.numero, d.destinatario, d.sede as sede_destino, d.fecha
      FROM paquete_tracking t JOIN despachos d ON d.id = t.despacho_id
      WHERE t.token = ?
    `).get(req.params.token);
    if (!row) return res.status(404).json({ error: 'No encontrado.' });

    const {
      modo          = 'single',
      tipo_articulo = 'ARTÍCULO',
      remite        = 'DPTO. DE SISTEMAS',
      remitente     = '',
      cajas         = '1',
      sedes         = '',
      printer       = 'normal',
      label_size    = '10x8',
    } = req.query;

    const trackingUrl = `${getBaseUrl(req)}/rastrear/${req.params.token}`;
    const qrBuf   = await QRCode.toBuffer(trackingUrl, { type: 'png', width: 220, margin: 1 });
    const qrB64   = `data:image/png;base64,${qrBuf.toString('base64')}`;

    let dd, mm, aaaa;
    if (row.fecha && /^\d{4}-\d{2}-\d{2}/.test(row.fecha)) {
      [aaaa, mm, dd] = row.fecha.slice(0, 10).split('-');
    } else {
      const now = new Date();
      dd   = String(now.getDate()).padStart(2, '0');
      mm   = String(now.getMonth() + 1).padStart(2, '0');
      aaaa = now.getFullYear();
    }

    let destinations = [];
    if (modo === 'todos') {
      const allSedes = db.prepare(
        'SELECT nombre_punto FROM sedes WHERE activo = 1 ORDER BY ciudad, nombre_punto'
      ).all();
      destinations = allSedes.map(s => s.nombre_punto).filter(Boolean);
      if (!destinations.length) destinations = [row.sede_destino || row.destinatario || '—'];
    } else if (modo === 'custom' && sedes) {
      destinations = sedes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (!destinations.length) destinations = [row.sede_destino || row.destinatario || '—'];
    } else {
      destinations = [row.sede_destino || row.destinatario || '—'];
    }

    const tipo        = (tipo_articulo || 'ARTÍCULO').toUpperCase();
    const emiteBase   = (remite || 'DPTO. DE SISTEMAS').toUpperCase();
    const emiteNombre = remitente ? remitente.toUpperCase() : '';
    const emite       = emiteNombre ? `${emiteBase} · ${emiteNombre}` : emiteBase;
    const cajasN      = parseInt(cajas) || 1;
    const numero      = row.numero || '';

    const isLabel = printer === 'etiqueta';
    let wMM = 100, hMM = 80;
    if (isLabel) {
      const parts = label_size.split('x').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        wMM = Math.round(parts[0] * 10);
        hMM = Math.round(parts[1] * 10);
      }
    }

    function labelHtml(destino, idx) {
      return `
      <div class="label">
        <div class="lbl-top">
          <div class="lbl-logo">
            ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="MedivalleSF">` : '<span style="font-size:11px;font-weight:700;color:#1e3a5f;">MedivalleSF S.A.S</span>'}
          </div>
          <div class="lbl-title">FORMATO PARA DESPACHO</div>
          <div class="lbl-qr-top">
            <img src="${qrB64}" alt="QR">
            <div class="qr-num">${numero}</div>
          </div>
        </div>
        <div class="lbl-data">
          <div class="lbl-row fecha-row">
            <div class="lk">FECHA</div>
            <div class="lv fecha-wrap">
              <div class="fecha-col"><div class="f-sub">DÍA</div><div class="f-val">${dd}</div></div>
              <div class="fecha-col"><div class="f-sub">MES</div><div class="f-val">${mm}</div></div>
              <div class="fecha-col last"><div class="f-sub">AÑO</div><div class="f-val">${aaaa}</div></div>
            </div>
          </div>
          <div class="lbl-row dest-row">
            <div class="lk">DESTINO</div>
            <div class="lv dest">${destino}</div>
          </div>
          <div class="lbl-row remite-row">
            <div class="lk">REMITE</div>
            <div class="lv remite">${emite}</div>
          </div>
          <div class="lbl-row no-border cajas-row">
            <div class="lk">CAJAS</div>
            <div class="lv cajas-num">${cajasN}</div>
            <div class="lk lk-desc">DESCRIPCIÓN</div>
            <div class="lv tipo">${tipo}</div>
          </div>
        </div>
      </div>`;
    }

    function labelHtmlCompact(destino) {
      const qrMM = Math.min(Math.round(hMM * 0.27), 22);
      return `
      <div class="label-c">
        <div class="lc-head">
          <div class="lc-logo">
            ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="logo">` : '<span class="lc-brand">MedivalleSF S.A.S</span>'}
          </div>
          <div class="lc-title">FORMATO PARA DESPACHO</div>
          <div class="lc-qr">
            <img src="${qrB64}" style="width:${qrMM}mm;height:${qrMM}mm;">
            <div class="qr-num">${numero}</div>
          </div>
        </div>
        <div class="lc-dest">${destino}</div>
        <div class="lc-fecha">
          <span style="font-size:${Math.max(7, Math.round(hMM * 0.075))}px;color:#555;font-weight:600;">FECHA</span>
          <span>${dd} / ${mm} / ${aaaa}</span>
        </div>
        <div class="lc-foot">
          <div class="lc-fcell">
            <div class="lc-key">DESCRIPCIÓN</div>
            <div class="lc-val lc-tipo">${tipo}</div>
          </div>
          <div class="lc-fsep"></div>
          <div class="lc-fcell lc-fcell-grow">
            <div class="lc-key">REMITE</div>
            <div class="lc-val">${emite}</div>
          </div>
          <div class="lc-fsep"></div>
          <div class="lc-fcell lc-cajas">
            <div class="lc-key">CAJAS</div>
            <div class="lc-val lc-cajas-num">${cajasN}</div>
          </div>
        </div>
      </div>`;
    }

    const labelsHtml = destinations.map((d, i) =>
      isLabel ? labelHtmlCompact(d) : labelHtml(d, i)
    ).join('\n');

    const normalCss = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f4f8}
.topbar{background:#1e3a5f;color:#fff;padding:10px 18px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:20}
.topbar strong{font-size:15px}
.topbar span{opacity:.8;font-size:13px;flex:1}
.topbar button{background:#fff;color:#1e3a5f;border:none;padding:7px 18px;font-size:13px;font-weight:700;cursor:pointer;border-radius:4px}
.topbar button:hover{background:#dde8f8}
.page{padding:10mm;background:#fff;max-width:210mm;margin:14px auto;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.grid{display:flex;flex-direction:column;gap:10mm}
.label{border:2.5px solid #1e3a5f;page-break-inside:avoid;break-inside:avoid;width:100%}
.lbl-top{display:flex;align-items:stretch;border-bottom:2px solid #1e3a5f;min-height:90px}
.lbl-logo{width:140px;min-width:140px;display:flex;align-items:center;justify-content:center;padding:8px 12px;background:#fff;border-right:2px solid #1e3a5f}
.lbl-logo img{max-width:120px;max-height:72px;object-fit:contain}
.lbl-title{flex:1;background:#fff;color:#1e3a5f;display:flex;align-items:center;justify-content:center;text-align:center;font-size:20px;font-weight:700;letter-spacing:5px;text-transform:uppercase;padding:10px 8px;line-height:1.3}
.lbl-qr-top{width:120px;min-width:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 8px;background:#fff;border-left:2px solid #1e3a5f;gap:4px}
.lbl-qr-top img{width:80px;height:80px}
.qr-num{font-size:7px;color:#666;text-align:center;word-break:break-all;font-family:monospace}
.lbl-data{width:100%}
.lbl-row{border-bottom:1.5px solid #888;display:flex;align-items:stretch}
.lbl-row.no-border{border-bottom:none}
.lk{font-weight:700;background:#fff;border-right:1.5px solid #888;width:90px;min-width:90px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#000;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px 6px;line-height:1.3}
.lv{font-weight:700;color:#000;flex:1;padding:6px 12px;display:flex;align-items:center;text-transform:uppercase}
.fecha-row{min-height:80px}
.fecha-wrap{display:flex;padding:0;flex:1}
.fecha-col{flex:1;text-align:center;border-right:1.5px solid #888;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.fecha-col.last{border-right:none}
.f-sub{font-size:10px;color:#444;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
.f-val{font-size:44px;font-weight:900;color:#000;line-height:1}
.dest-row{min-height:90px}
.dest{font-size:22px!important;color:#000!important;font-weight:900!important;text-transform:uppercase!important;line-height:1.25;word-break:break-word}
.remite-row{min-height:55px}
.remite{font-size:14px!important;color:#000!important;font-weight:600!important;text-transform:uppercase!important}
.cajas-row{min-height:55px}
.cajas-num{flex:0 0 70px!important;min-width:70px!important;max-width:70px;border-right:1.5px solid #888;justify-content:center;font-size:32px!important;color:#000!important;padding:4px 0!important}
.lk-desc{border-left:none;width:110px;min-width:110px}
.tipo{font-size:17px!important;color:#000!important;font-weight:700!important;text-transform:uppercase!important}
@media print{
  @page{size:A4 portrait;margin:8mm}
  body{background:#fff}
  .topbar{display:none}
  .page{box-shadow:none;margin:0;padding:0;max-width:none}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}`;

    const labelCss = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f4f8}
.topbar{background:#1e3a5f;color:#fff;padding:8px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:20}
.topbar strong{font-size:14px}
.topbar span{opacity:.8;font-size:12px;flex:1}
.topbar button{background:#fff;color:#1e3a5f;border:none;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;border-radius:4px}
.topbar button:hover{background:#dde8f8}
.print-area{background:#fff;width:fit-content;max-width:98vw;margin:14px auto;padding:4mm;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:3mm}
.label-c{border:1.5px solid #1e3a5f;page-break-inside:avoid;break-inside:avoid;width:${wMM - 4}mm;min-height:${hMM - 4}mm;display:flex;flex-direction:column;overflow:hidden}
.lc-head{display:flex;align-items:stretch;border-bottom:1.5px solid #1e3a5f;flex-shrink:0;min-height:${Math.round(hMM * 0.27)}mm;max-height:${Math.round(hMM * 0.35)}mm}
.lc-logo{flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding:1.5mm 2mm;border-right:1.5px solid #1e3a5f;min-width:18mm;max-width:28mm}
.lc-logo img{max-height:${Math.round(hMM * 0.22)}mm;max-width:26mm;object-fit:contain}
.lc-brand{font-size:8px;font-weight:700;color:#1e3a5f;text-align:center}
.lc-title{flex:1;background:#fff;color:#1e3a5f;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:${Math.max(7, Math.round(hMM * 0.085))}px;padding:2mm;line-height:1.2}
.lc-qr{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5mm 2mm;border-left:1.5px solid #1e3a5f;gap:1mm}
.qr-num{font-size:6px;color:#555;text-align:center;word-break:break-all;font-family:monospace;max-width:${Math.round(hMM * 0.27)}mm}
.lc-dest{flex:0 0 auto;min-height:${Math.round(hMM * 0.26)}mm;max-height:${Math.round(hMM * 0.32)}mm;overflow:hidden;font-size:${Math.max(10, Math.round(hMM * 0.16))}px;font-weight:900;text-transform:uppercase;color:#000;padding:2mm 3mm;display:flex;align-items:center;border-bottom:1.5px solid #888;word-break:break-word;line-height:1.1}
.lc-fecha{flex-shrink:0;padding:2mm 3mm;border-bottom:1.5px solid #1e3a5f;font-size:${Math.max(12, Math.round(hMM * 0.145))}px;font-weight:700;color:#000;letter-spacing:1px;display:flex;align-items:center;gap:3mm}
.lc-foot{display:flex;flex-shrink:0;min-height:${Math.round(hMM * 0.30)}mm}
.lc-fcell{display:flex;flex-direction:column;justify-content:center;padding:1.5mm 2.5mm;flex:1}
.lc-fcell-grow{flex:2}
.lc-cajas{flex:0 0 auto;min-width:12mm;align-items:center;padding:1mm 2.5mm}
.lc-fsep{width:1.5px;background:#888;flex-shrink:0}
.lc-key{font-size:${Math.max(9, Math.round(hMM * 0.11))}px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#555;margin-bottom:.8mm}
.lc-val{font-size:${Math.max(12, Math.round(hMM * 0.145))}px;font-weight:700;text-transform:uppercase;color:#000;line-height:1.1}
.lc-tipo{font-size:${Math.max(13, Math.round(hMM * 0.165))}px!important}
.lc-cajas-num{font-size:${Math.max(16, Math.round(hMM * 0.27))}px!important;text-align:center}
@media print{
  @page{size:${wMM}mm ${hMM}mm;margin:2mm}
  body{background:#fff}
  .topbar{display:none!important}
  .print-area{margin:0;padding:0;box-shadow:none;gap:0;width:auto}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Rótulos · ${numero}</title>
<style>
${isLabel ? labelCss : normalCss}
</style>
</head>
<body>
<div class="topbar">
  <strong>Rótulos de Despacho · ${numero}</strong>
  <span>${destinations.length} rótulo(s) &nbsp;·&nbsp; ${tipo}${isLabel ? ` &nbsp;·&nbsp; ${wMM / 10}×${hMM / 10} cm` : ''}</span>
  <button onclick="window.print()">🖨&nbsp; Imprimir</button>
  <button onclick="window.close()" style="background:#c0ccdd">Cerrar</button>
</div>
${isLabel
  ? `<div class="print-area">\n${labelsHtml}\n</div>`
  : `<div class="page">\n  <div class="grid">\n${labelsHtml}\n  </div>\n</div>`
}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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
