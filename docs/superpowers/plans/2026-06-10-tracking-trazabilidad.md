# Sistema de Trazabilidad de Despachos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement end-to-end package tracking for all despachos: auto-generated QR per dispatch, public mobile reception form with mandatory photo, dynamic multi-stop history, final delivery acta, WhatsApp + SSE notifications, and internal timeline view.

**Architecture:** New `src/tracking/` module (model + routes + notifier + acta generator). Tracking record auto-created on `POST /api/despachos`. Public page `/rastrear/:token` (same SPA pattern as `/firmar/:token`). Internal module `#trazabilidad` in legacy JS frontend.

**Tech Stack:** Node.js/Express · node:sqlite (no `db.transaction()` — use `db.exec('BEGIN/COMMIT/ROLLBACK')`) · multer (already installed) · qrcode (already installed) · AdmZip (reuse acta-generator.js pattern) · vanilla JS legacy frontend

---

## File Map

**Create:**
- `src/tracking/tracking-model.js` — all DB operations for 4 tracking tables
- `src/tracking/tracking-routes.js` — public + authenticated Express routes
- `src/tracking/tracking-notifier.js` — WhatsApp + SSE broadcast on events
- `src/tracking/acta-receptor.js` — Word doc generation for final delivery acta
- `public/rastrear.html` — public SPA shell (mirrors firmar.html structure)
- `public/js/tracking-public.js` — public reception form logic
- `public/js/trazabilidad.js` — internal tracking list + timeline module

**Modify:**
- `src/config/database.js` — add 4 tables + 3 indexes as migrations
- `src/despacho/despacho-routes.js` — call `createTracking()` in POST handler
- `server.js` — import trackingRouter + register `/rastrear/:token` SPA route
- `public/js/app.js` — add `#trazabilidad` route + import trazabilidad.js
- `public/index.html` — add Trazabilidad sidebar item

---

## Task 1: Database Migrations

**Files:**
- Modify: `src/config/database.js`

- [ ] **Step 1: Add the 4 new tables and 3 indexes to the migrations array**

Open `src/config/database.js`. After the last migration entry (the `role_permissions` for inventario UPS, around line 244), add the following entries to the `migrations` array:

```js
  // ── Tracking de paquetes ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS paquete_tracking (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    despacho_id INTEGER NOT NULL UNIQUE,
    token       TEXT    NOT NULL UNIQUE,
    estado      TEXT    NOT NULL DEFAULT 'creado',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (despacho_id) REFERENCES despachos(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_eventos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id      INTEGER NOT NULL,
    tipo             TEXT NOT NULL,
    recibido_por     TEXT NOT NULL,
    entregado_por    TEXT NOT NULL,
    ubicacion        TEXT NOT NULL,
    sede_id          INTEGER,
    cargo_receptor   TEXT,
    observaciones    TEXT,
    foto_path        TEXT NOT NULL,
    foto_filename    TEXT NOT NULL,
    estado_paquete   TEXT NOT NULL,
    ip               TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_entrega_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id         INTEGER NOT NULL,
    item_index        INTEGER NOT NULL,
    equipment_name    TEXT NOT NULL,
    cantidad          INTEGER NOT NULL DEFAULT 1,
    recibido_conforme INTEGER NOT NULL DEFAULT 1,
    observacion_item  TEXT,
    FOREIGN KEY (evento_id) REFERENCES paquete_eventos(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_acta_final (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id  INTEGER NOT NULL UNIQUE,
    filepath     TEXT NOT NULL,
    filename     TEXT NOT NULL,
    firmado_por  TEXT NOT NULL,
    cargo        TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_paquete_tracking_despacho ON paquete_tracking(despacho_id)`,
  `CREATE INDEX IF NOT EXISTS idx_paquete_tracking_token    ON paquete_tracking(token)`,
  `CREATE INDEX IF NOT EXISTS idx_paquete_eventos_tracking  ON paquete_eventos(tracking_id)`,
```

- [ ] **Step 2: Create upload directories**

```bash
mkdir -p uploads/tracking-fotos
mkdir -p uploads/tracking-actas
```

- [ ] **Step 3: Restart server and verify tables exist**

```bash
node -e "
import('./src/config/database.js').then(m => {
  const db = m.default;
  const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'paquete%'\").all();
  console.log(tables);
});
"
```

Expected output: `[ { name: 'paquete_tracking' }, { name: 'paquete_eventos' }, { name: 'paquete_entrega_items' }, { name: 'paquete_acta_final' } ]`

- [ ] **Step 4: Commit**

```bash
git add src/config/database.js
git commit -m "feat(tracking): add paquete_tracking, eventos, items, acta_final tables"
```

---

## Task 2: tracking-model.js

**Files:**
- Create: `src/tracking/tracking-model.js`

- [ ] **Step 1: Create the file with all model functions**

```js
import crypto from 'crypto';

/**
 * Creates a tracking record + initial 'creacion' event for a despacho.
 * Called automatically when a despacho is created.
 */
export function createTracking(db, despachoId, agentName = 'IT', ubicacionOrigen = 'Bodega Central') {
  const token = crypto.randomUUID();
  db.prepare(`
    INSERT INTO paquete_tracking (despacho_id, token, estado)
    VALUES (?, ?, 'creado')
  `).run(despachoId, token);

  const tracking = db.prepare('SELECT id FROM paquete_tracking WHERE token = ?').get(token);

  db.prepare(`
    INSERT INTO paquete_eventos
      (tracking_id, tipo, recibido_por, entregado_por, ubicacion, foto_path, foto_filename, estado_paquete)
    VALUES (?, 'creacion', ?, 'Sistema', ?, 'system', 'system', 'creado')
  `).run(tracking.id, agentName, ubicacionOrigen);

  return token;
}

/**
 * Returns full tracking detail: record + all events + acta_final + despacho info.
 */
export function getTrackingByToken(db, token) {
  const tracking = db.prepare(`
    SELECT t.*, d.numero, d.destinatario, d.sede as sede_destino,
           d.articulos, d.agente, d.fecha
    FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id
    WHERE t.token = ?
  `).get(token);
  if (!tracking) return null;

  tracking.eventos = db.prepare(`
    SELECT * FROM paquete_eventos WHERE tracking_id = ? ORDER BY id ASC
  `).all(tracking.id);

  tracking.acta_final = db.prepare(
    'SELECT * FROM paquete_acta_final WHERE tracking_id = ?'
  ).get(tracking.id) || null;

  try { tracking.articulos_parsed = JSON.parse(tracking.articulos || '[]'); } catch { tracking.articulos_parsed = []; }

  return tracking;
}

/**
 * Returns tracking by despacho ID (used internally when creating a despacho).
 */
export function getTrackingByDespachoId(db, despachoId) {
  return db.prepare('SELECT * FROM paquete_tracking WHERE despacho_id = ?').get(despachoId) || null;
}

/**
 * Returns paginated list of all trackings with latest event info.
 */
export function getAllTrackings(db, { estado, search, limit = 50, offset = 0 } = {}) {
  let where = '1=1';
  const params = [];

  if (estado) { where += ' AND t.estado = ?'; params.push(estado); }
  if (search) {
    where += ' AND (d.numero LIKE ? OR d.destinatario LIKE ? OR d.sede LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id WHERE ${where}
  `).get(...params).n;

  const rows = db.prepare(`
    SELECT t.id, t.token, t.estado, t.updated_at,
           d.numero, d.destinatario, d.sede as sede_destino, d.fecha,
           (SELECT COUNT(*) FROM paquete_eventos WHERE tracking_id = t.id AND tipo != 'creacion') as evento_count,
           (SELECT ubicacion FROM paquete_eventos WHERE tracking_id = t.id ORDER BY id DESC LIMIT 1) as ultimo_evento_ubicacion,
           (SELECT created_at FROM paquete_eventos WHERE tracking_id = t.id ORDER BY id DESC LIMIT 1) as ultimo_evento_at
    FROM paquete_tracking t
    JOIN despachos d ON d.id = t.despacho_id
    WHERE ${where}
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
}

/**
 * Inserts a reception event and updates tracking estado.
 * Returns the inserted evento ID.
 */
export function addEvento(db, trackingId, {
  tipo, recibido_por, entregado_por, ubicacion, sede_id = null,
  cargo_receptor = null, observaciones = null,
  foto_path, foto_filename, es_entrega_final = false, ip = null,
}) {
  let nuevoEstado;
  if (es_entrega_final) {
    nuevoEstado = 'entregado';
  } else if (sede_id) {
    nuevoEstado = 'en_sede';
  } else {
    nuevoEstado = 'en_transito';
  }

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO paquete_eventos
        (tracking_id, tipo, recibido_por, entregado_por, ubicacion, sede_id,
         cargo_receptor, observaciones, foto_path, foto_filename, estado_paquete, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trackingId, tipo, recibido_por, entregado_por, ubicacion, sede_id,
      cargo_receptor, observaciones, foto_path, foto_filename, nuevoEstado, ip
    );

    const { id: eventoId } = db.prepare('SELECT last_insert_rowid() as id').get();

    db.prepare(`
      UPDATE paquete_tracking
      SET estado = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(nuevoEstado, trackingId);

    db.exec('COMMIT');
    return { eventoId, nuevoEstado };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Inserts items for a final delivery event.
 */
export function addEntregaItems(db, eventoId, items = []) {
  const stmt = db.prepare(`
    INSERT INTO paquete_entrega_items
      (evento_id, item_index, equipment_name, cantidad, recibido_conforme, observacion_item)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of items) {
    stmt.run(
      eventoId,
      item.item_index ?? 0,
      item.equipment_name || 'Artículo',
      item.cantidad || 1,
      item.recibido_conforme ? 1 : 0,
      item.observacion_item || null,
    );
  }
}

/**
 * Saves the generated acta final record.
 */
export function saveActaFinal(db, trackingId, { filepath, filename, firmado_por, cargo }) {
  db.prepare(`
    INSERT OR REPLACE INTO paquete_acta_final (tracking_id, filepath, filename, firmado_por, cargo)
    VALUES (?, ?, ?, ?, ?)
  `).run(trackingId, filepath, filename, firmado_por, cargo);
}

/**
 * Updates tracking estado to 'devuelto' (IT-only action).
 */
export function marcarDevuelto(db, token) {
  const result = db.prepare(`
    UPDATE paquete_tracking
    SET estado = 'devuelto', updated_at = datetime('now','localtime')
    WHERE token = ? AND estado NOT IN ('entregado')
  `).run(token);
  return result.changes > 0;
}

/**
 * Rate-limit check: count events in the last 60 minutes for this tracking.
 */
export function countRecentEventos(db, trackingId) {
  return db.prepare(`
    SELECT COUNT(*) as n FROM paquete_eventos
    WHERE tracking_id = ?
      AND created_at > datetime('now', '-1 hour', 'localtime')
      AND tipo != 'creacion'
  `).get(trackingId).n;
}

/**
 * Returns distinct cargo values from tech_requests for autocomplete.
 */
export function getDistinctCargos(db) {
  return db.prepare(`
    SELECT DISTINCT cargo FROM tech_requests
    WHERE cargo IS NOT NULL AND cargo != ''
    ORDER BY cargo LIMIT 60
  `).all().map(r => r.cargo);
}
```

- [ ] **Step 2: Verify the file loads without syntax errors**

```bash
node --input-type=module <<'EOF'
import('./src/tracking/tracking-model.js').then(() => console.log('OK')).catch(console.error);
EOF
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/tracking/tracking-model.js
git commit -m "feat(tracking): add tracking-model with CRUD functions"
```

---

## Task 3: tracking-notifier.js

**Files:**
- Create: `src/tracking/tracking-notifier.js`

- [ ] **Step 1: Create the notifier**

```js
import { broadcast, appEvents } from '../events/broadcaster.js';
import { sendWhatsAppMessage } from '../whatsapp/messenger.js';

const IT_PHONE = process.env.IT_PHONE;

/**
 * Notify IT team when a tracking event is registered.
 * @param {Object} tracking - from getTrackingByToken()
 * @param {Object} evento   - the newly created event row
 */
export async function notifyTrackingEvento(tracking, evento) {
  // ── SSE broadcast ──────────────────────────────────────────────
  appEvents.emit('tracking:evento', {
    token:    tracking.token,
    estado:   tracking.estado,
    numero:   tracking.numero,
    ubicacion: evento.ubicacion,
  });

  // ── WhatsApp ───────────────────────────────────────────────────
  if (!IT_PHONE) return;

  const estadoEmoji = {
    en_transito: '🚚',
    en_sede:     '📍',
    entregado:   '✅',
    devuelto:    '↩️',
  }[evento.estado_paquete] || '📦';

  let msg;
  if (evento.tipo === 'entrega_final') {
    msg =
      `✅ *Paquete entregado*\n` +
      `*${tracking.numero}* entregado en ${evento.ubicacion}\n\n` +
      `👤 Recibió: ${evento.recibido_por}${evento.cargo_receptor ? ` (${evento.cargo_receptor})` : ''}\n` +
      `🤝 Entregado por: ${evento.entregado_por}\n` +
      `📄 Acta de recepción generada\n` +
      `🕐 ${new Date().toLocaleString('es-CO')}`;
  } else {
    msg =
      `${estadoEmoji} *Movimiento de paquete*\n` +
      `*${tracking.numero}* → ${tracking.sede_destino || tracking.destinatario}\n\n` +
      `📍 Recibido en: ${evento.ubicacion}\n` +
      `👤 Recibió: ${evento.recibido_por}\n` +
      `🤝 Entregado por: ${evento.entregado_por}\n` +
      `🕐 ${new Date().toLocaleString('es-CO')}\n\n` +
      `Estado: ${estadoEmoji} ${evento.estado_paquete.replace('_', ' ')}`;
  }

  try {
    await sendWhatsAppMessage(IT_PHONE, msg);
  } catch (err) {
    console.error('[tracking-notifier] WhatsApp error:', err.message);
  }
}
```

- [ ] **Step 2: Add SSE event wiring in broadcaster.js**

In `src/events/broadcaster.js`, add at the end:

```js
appEvents.on('tracking:evento', (data) => broadcast('tracking-evento', data));
```

- [ ] **Step 3: Commit**

```bash
git add src/tracking/tracking-notifier.js src/events/broadcaster.js
git commit -m "feat(tracking): add tracking-notifier for WhatsApp + SSE"
```

---

## Task 4: acta-receptor.js

**Files:**
- Create: `src/tracking/acta-receptor.js`

- [ ] **Step 1: Create acta generator that wraps the existing acta-generator.js**

```js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateActa } from '../tech-requests/acta-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTAS_DIR = path.resolve(__dirname, '../../uploads/tracking-actas');

if (!fs.existsSync(ACTAS_DIR)) fs.mkdirSync(ACTAS_DIR, { recursive: true });

/**
 * Generates a Word receipt document for a final delivery event.
 *
 * @param {Object} despacho  - { numero, destinatario, sede, agente }
 * @param {Object} evento    - { recibido_por, cargo_receptor, ubicacion }
 * @param {Array}  items     - [{ equipment_name, cantidad, recibido_conforme, observacion_item }]
 * @returns {{ filepath, filename }}
 */
export async function generateActaReceptor(despacho, evento, items) {
  const requestObj = {
    request_number: despacho.numero,
    requester_name: evento.recibido_por,
    cedula: '',
    cargo: evento.cargo_receptor || '',
    sede: evento.ubicacion,
    items: items.map((item, idx) => ({
      equipment_name: item.equipment_name,
      quantity: item.cantidad || 1,
      serial: '',
    })),
  };

  const eqItems = items.map(item => ({
    marca: item.recibido_conforme ? '✓ Conforme' : '✗ No conforme',
    modelo: '',
    serial: '',
    accesorios: '',
    observaciones: item.observacion_item || '',
  }));

  const buffer = await generateActa(requestObj, eqItems, evento.recibido_por);

  const safeName = (despacho.numero || 'DES').replace(/[^a-zA-Z0-9\-_]/g, '_');
  const filename = `Acta_Recepcion_${safeName}.docx`;
  const filepath = path.join(ACTAS_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  return { filepath, filename };
}
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
node --input-type=module <<'EOF'
import('./src/tracking/acta-receptor.js').then(() => console.log('OK')).catch(console.error);
EOF
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/tracking/acta-receptor.js
git commit -m "feat(tracking): add acta-receptor Word doc generator"
```

---

## Task 5: tracking-routes.js

**Files:**
- Create: `src/tracking/tracking-routes.js`

**Critical note on route order:** Express matches routes in declaration order. Fixed-segment routes (`/public/sedes`, `/fotos/:f`) MUST be declared before param routes (`/public/:token`, `/:token`) or Express will match the fixed segment as a param value.

- [ ] **Step 1: Create the routes file**

```js
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

    // Return only public-safe fields (no internal file paths)
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
    // Validate token exists before running multer
    const t = db.prepare('SELECT * FROM paquete_tracking WHERE token = ?').get(req.params.token);
    if (!t) return res.status(404).json({ error: 'Paquete no encontrado.' });
    if (['entregado', 'devuelto'].includes(t.estado)) {
      return res.status(409).json({ error: 'Este paquete ya fue entregado o devuelto.' });
    }
    // Rate limit: 5 events per token in last 60 min
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

      // Generate acta
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
    // Add QR URL
    tracking.qr_url = `${getBaseUrl(req)}/rastrear/${tracking.token}`;
    res.json(tracking);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
```

- [ ] **Step 2: Verify it loads cleanly**

```bash
node --input-type=module <<'EOF'
import('./src/tracking/tracking-routes.js').then(() => console.log('OK')).catch(console.error);
EOF
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/tracking/tracking-routes.js
git commit -m "feat(tracking): add tracking routes (public + authenticated)"
```

---

## Task 6: server.js Integration

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Import and register tracking router**

In `server.js`, add after the existing imports (around line 20):

```js
import trackingRouter from './src/tracking/tracking-routes.js';
```

After `app.use(userRouter);` (around line 64), add:

```js
app.use(trackingRouter);
```

- [ ] **Step 2: Add the /rastrear/:token SPA route**

After the existing `/registrar/:token` route (around line 80), add:

```js
// Página pública de seguimiento de paquetes
app.get('/rastrear/:token', (_req, res) => {
  const f = fs.existsSync(clientDist)
    ? path.join(clientDist, 'index.html')
    : path.join(__dirname, 'public', 'rastrear.html');
  res.sendFile(f);
});
```

- [ ] **Step 3: Restart server and test the public sedes endpoint**

```bash
curl http://localhost:3000/api/tracking/public/sedes
```

Expected: JSON with `{ sedes: [...], cargos: [...] }`

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(tracking): register tracking router and /rastrear/:token SPA route"
```

---

## Task 7: public/rastrear.html

**Files:**
- Create: `public/rastrear.html`

- [ ] **Step 1: Create the public SPA shell**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seguimiento de Paquete — Mi Farmacia IT</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a; color: #e2e8f0;
      min-height: 100vh;
    }
    #app-root { min-height: 100vh; }
    .spinner-wrap {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; flex-direction: column; gap: 16px;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(99,102,241,.2);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner-text { font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <div id="app-root">
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <span class="spinner-text">Cargando…</span>
    </div>
  </div>
  <script type="module" src="/js/tracking-public.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify it serves at the right URL**

Open browser: `http://localhost:3000/rastrear/test-token-123`

Expected: Page loads (shows spinner, then error "Paquete no encontrado" from the API).

- [ ] **Step 3: Commit**

```bash
git add public/rastrear.html
git commit -m "feat(tracking): add public rastrear.html SPA shell"
```

---

## Task 8: public/js/tracking-public.js

**Files:**
- Create: `public/js/tracking-public.js`

- [ ] **Step 1: Create the public form JS**

```js
/* public/js/tracking-public.js
 * Handles the public package reception form at /rastrear/:token
 */

const token = location.pathname.split('/').pop();
const root  = document.getElementById('app-root');

let _sedes  = [];
let _cargos = [];
let _pkg    = null;

/* ── Styles ── */
const style = document.createElement('style');
style.textContent = `
  body { background: #0f172a; }
  .pf-wrap { max-width: 480px; margin: 0 auto; padding: 0 0 40px; }
  .pf-header {
    background: linear-gradient(135deg,#1e1b4b,#312e81);
    padding: 24px 20px 28px; color: #fff;
  }
  .pf-badge {
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(255,255,255,.15);padding:4px 10px;
    border-radius:99px;font-size:11px;font-weight:600;margin-bottom:12px;
  }
  .pf-num { font-size:22px;font-weight:800;letter-spacing:-.5px;margin-bottom:4px; }
  .pf-sub { font-size:13px;opacity:.8; }
  .pf-body { padding:16px; display:flex; flex-direction:column; gap:14px; }
  .pf-card {
    background:#1e293b;border:1px solid rgba(255,255,255,.08);
    border-radius:12px;padding:14px 16px;
  }
  .pf-card-title {
    font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;
    letter-spacing:.06em;margin-bottom:12px;display:flex;align-items:center;gap:6px;
  }
  .pf-label { font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:5px;display:block; }
  .pf-input {
    width:100%;padding:10px 12px;border:1.5px solid rgba(255,255,255,.1);
    border-radius:8px;font-size:14px;color:#e2e8f0;background:#0f172a;outline:none;
    transition:border-color .2s;
  }
  .pf-input:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15); }
  .pf-row { display:flex;flex-direction:column;gap:12px; }
  .pf-photo-btn {
    width:100%;padding:20px;border:2px dashed rgba(99,102,241,.4);
    border-radius:10px;background:rgba(99,102,241,.06);color:#818cf8;
    font-size:13px;font-weight:600;display:flex;flex-direction:column;
    align-items:center;gap:6px;cursor:pointer;transition:all .2s;
  }
  .pf-photo-btn:hover { border-color:rgba(99,102,241,.7);background:rgba(99,102,241,.1); }
  .pf-photo-preview {
    width:100%;max-height:200px;object-fit:cover;border-radius:8px;
    border:1px solid rgba(255,255,255,.1);display:none;margin-top:8px;
  }
  .pf-check-row {
    display:flex;align-items:flex-start;gap:10px;
    padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);
  }
  .pf-check-row:last-child { border-bottom:none; }
  .pf-check-row input[type=checkbox] { width:18px;height:18px;margin-top:2px;accent-color:#6366f1;flex-shrink:0; }
  .pf-check-label { font-size:13px;color:#e2e8f0;flex:1; }
  .pf-check-qty { font-size:11px;color:#64748b;margin-top:2px; }
  .pf-check-obs { width:100%;margin-top:6px;padding:7px 10px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:#0f172a;color:#94a3b8;font-size:12px;resize:none; }
  .pf-submit {
    width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
    border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:700;
    cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.4);transition:all .2s;
  }
  .pf-submit:disabled { background:#334155;color:#475569;cursor:not-allowed;box-shadow:none; }
  .pf-final-toggle {
    display:flex;align-items:center;gap:10px;padding:12px;
    background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);
    border-radius:8px;cursor:pointer;
  }
  .pf-final-toggle input[type=checkbox] { width:18px;height:18px;accent-color:#10b981;flex-shrink:0; }
  .pf-final-toggle label { font-size:13px;color:#6ee7b7;font-weight:500;cursor:pointer; }
  .pf-final-section { display:none; }
  .pf-final-section.visible { display:flex;flex-direction:column;gap:12px; }
  .pf-info-row { display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05); }
  .pf-info-row:last-child { border-bottom:none; }
  .pf-info-key { color:#64748b; }
  .pf-info-val { font-weight:500;max-width:200px;text-align:right; }
  .pf-estado {
    display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
    border-radius:99px;font-size:11px;font-weight:600;
  }
  .estado-creado    { background:rgba(100,116,139,.2);color:#94a3b8; }
  .estado-en_transito { background:rgba(245,158,11,.15);color:#f59e0b; }
  .estado-en_sede   { background:rgba(99,102,241,.15);color:#818cf8; }
  .estado-entregado { background:rgba(16,185,129,.15);color:#10b981; }
  .estado-devuelto  { background:rgba(239,68,68,.15);color:#f87171; }
  /* Success screen */
  .success-wrap {
    max-width:480px;margin:0 auto;padding:40px 20px;
    display:flex;flex-direction:column;align-items:center;text-align:center;
  }
  .success-icon {
    width:80px;height:80px;border-radius:50%;
    background:linear-gradient(135deg,#10b981,#059669);
    display:flex;align-items:center;justify-content:center;font-size:36px;
    margin-bottom:20px;box-shadow:0 8px 24px rgba(16,185,129,.4);
  }
  /* Search select */
  .sede-search-wrap { position:relative; }
  .sede-dropdown {
    position:absolute;top:100%;left:0;right:0;z-index:100;
    background:#1e293b;border:1px solid rgba(99,102,241,.3);border-radius:8px;
    max-height:220px;overflow-y:auto;display:none;
    box-shadow:0 8px 20px rgba(0,0,0,.4);
  }
  .sede-dropdown.open { display:block; }
  .sede-option {
    padding:10px 14px;font-size:13px;color:#e2e8f0;cursor:pointer;
    border-bottom:1px solid rgba(255,255,255,.05);transition:background .1s;
  }
  .sede-option:hover, .sede-option.selected { background:rgba(99,102,241,.15); }
  .sede-option .opt-ciudad { font-size:11px;color:#64748b;margin-top:1px; }
  .sede-option-free { padding:10px 14px;font-size:13px;color:#818cf8;cursor:pointer;font-style:italic; }
  .sede-option-free:hover { background:rgba(99,102,241,.1); }
`;
document.head.appendChild(style);

/* ── Helpers ── */
function estadoBadge(e) {
  return `<span class="pf-estado estado-${e}">${{
    creado:'📦 Creado', en_transito:'🚚 En tránsito', en_sede:'📍 En sede',
    entregado:'✅ Entregado', devuelto:'↩️ Devuelto',
  }[e] || e}</span>`;
}

function showError(msg) {
  root.innerHTML = `
    <div style="max-width:480px;margin:40px auto;padding:20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">❌</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Enlace no válido</div>
      <div style="font-size:13px;color:#64748b;">${msg}</div>
    </div>`;
}

function showDelivered() {
  root.innerHTML = `
    <div style="max-width:480px;margin:40px auto;padding:20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Paquete ya entregado</div>
      <div style="font-size:13px;color:#64748b;">Este paquete ya fue recibido en su destino final.</div>
    </div>`;
}

function showSuccess(data) {
  root.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">✓</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:8px;">¡Recepción registrada!</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:28px;line-height:1.6;">
        El equipo IT ha sido notificado.<br>Tu evidencia quedó guardada correctamente.
      </div>
      <div style="background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;width:100%;text-align:left;">
        <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Resumen</div>
        ${Object.entries({
          'Paquete': _pkg?.numero || token,
          'Estado': data.estado?.replace('_', ' '),
          'Fecha y hora': new Date().toLocaleString('es-CO'),
        }).map(([k, v]) => `
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="color:#64748b;">${k}</span>
            <span style="font-weight:600;">${v}</span>
          </div>`).join('')}
      </div>
      ${data.acta_disponible ? `
        <a href="/api/tracking/public/${token}/acta-final"
           style="margin-top:20px;padding:12px 24px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
          📄 Descargar Acta de Recepción
        </a>` : ''}
      <div style="margin-top:20px;font-size:11px;color:#334155;">
        🔒 Este registro no puede modificarse una vez enviado.
      </div>
    </div>`;
}

/* ── Sede search widget ── */
function buildSedeSearch(containerId, onSelect) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = `
    <input class="pf-input" id="sede-input" placeholder="Buscar sede o farmacia…" autocomplete="off">
    <div class="sede-dropdown" id="sede-dropdown"></div>
    <input type="hidden" id="sede-id-hidden">
  `;
  const input    = wrap.querySelector('#sede-input');
  const dropdown = wrap.querySelector('#sede-dropdown');
  const hiddenId = wrap.querySelector('#sede-id-hidden');

  function render(q) {
    const q2 = q.toLowerCase();
    const filtered = _sedes.filter(s =>
      s.nombre_punto.toLowerCase().includes(q2) || s.ciudad.toLowerCase().includes(q2)
    ).slice(0, 15);
    dropdown.innerHTML = filtered.map(s => `
      <div class="sede-option" data-id="${s.id}" data-nombre="${s.nombre_punto} · ${s.ciudad}">
        ${s.nombre_punto}
        <div class="opt-ciudad">${s.ciudad}</div>
      </div>`).join('') +
      `<div class="sede-option-free" data-free="1">✏️ Escribir ubicación manualmente: "${q || '…'}"</div>`;
    dropdown.classList.add('open');
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));

  dropdown.addEventListener('click', e => {
    const opt  = e.target.closest('.sede-option');
    const free = e.target.closest('.sede-option-free');
    if (opt) {
      input.value   = opt.dataset.nombre;
      hiddenId.value = opt.dataset.id;
      dropdown.classList.remove('open');
      onSelect({ id: opt.dataset.id, nombre: opt.dataset.nombre });
    } else if (free) {
      hiddenId.value = '';
      dropdown.classList.remove('open');
      onSelect({ id: null, nombre: input.value });
    }
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) dropdown.classList.remove('open');
  });

  return { getValue: () => input.value, getId: () => hiddenId.value };
}

/* ── Main render ── */
function renderForm() {
  const articulos = _pkg.articulos || [];

  root.innerHTML = `
    <div class="pf-wrap">
      <div class="pf-header">
        <div class="pf-badge">📦 Seguimiento de Paquete</div>
        <div class="pf-num">${_pkg.numero}</div>
        <div class="pf-sub">Destino: ${_pkg.sede_destino || _pkg.destinatario}</div>
      </div>
      <div class="pf-body">

        <!-- Info -->
        <div class="pf-card">
          <div class="pf-card-title">ℹ️ Información del despacho</div>
          <div class="pf-info-row"><span class="pf-info-key">Remitente</span><span class="pf-info-val">${_pkg.eventos?.[0]?.recibido_por || 'IT'}</span></div>
          <div class="pf-info-row"><span class="pf-info-key">Artículos</span><span class="pf-info-val">${articulos.length} ítem(s)</span></div>
          <div class="pf-info-row"><span class="pf-info-key">Estado actual</span><span class="pf-info-val">${estadoBadge(_pkg.estado)}</span></div>
        </div>

        <!-- Recepción -->
        <div class="pf-card">
          <div class="pf-card-title">✓ Confirmar recepción</div>
          <div class="pf-row">
            <div>
              <label class="pf-label">¿Quién te entregó el paquete? *</label>
              <input class="pf-input" id="entregado-por" placeholder="Nombre del mensajero o agente…">
            </div>
            <div>
              <label class="pf-label">Tu nombre completo *</label>
              <input class="pf-input" id="recibido-por" placeholder="Tu nombre…">
            </div>
            <div>
              <label class="pf-label">Ubicación de recepción *</label>
              <div class="sede-search-wrap" id="sede-search-container"></div>
            </div>
            <div>
              <label class="pf-label">Observaciones (opcional)</label>
              <input class="pf-input" id="observaciones" placeholder="Estado del embalaje, novedades…">
            </div>
          </div>
        </div>

        <!-- Final delivery toggle -->
        <div class="pf-final-toggle" id="final-toggle-wrap">
          <input type="checkbox" id="es-entrega-final">
          <label for="es-entrega-final">Soy el destinatario final / esta es la entrega definitiva</label>
        </div>

        <!-- Final section (cargo + checklist) -->
        <div class="pf-card pf-final-section" id="final-section">
          <div class="pf-card-title">📋 Confirmación de entrega final</div>
          <div class="pf-row">
            <div>
              <label class="pf-label">Tu cargo en la empresa *</label>
              <input class="pf-input" id="cargo-receptor" list="cargos-list" placeholder="Escribe o selecciona tu cargo…">
              <datalist id="cargos-list">
                ${_cargos.map(c => `<option value="${c}">`).join('')}
              </datalist>
            </div>
          </div>
          ${articulos.length > 0 ? `
            <div style="margin-top:14px;">
              <div class="pf-card-title">📦 Artículos a confirmar</div>
              ${articulos.map((a, i) => `
                <div class="pf-check-row">
                  <input type="checkbox" id="item-${i}" data-idx="${i}" checked>
                  <div style="flex:1;">
                    <div class="pf-check-label">${a.nombre || a.descripcion || 'Artículo'}</div>
                    <div class="pf-check-qty">Cantidad: ${a.cantidad || 1}</div>
                    <textarea class="pf-check-obs" id="item-obs-${i}" rows="1"
                      placeholder="Observación (opcional)…"></textarea>
                  </div>
                </div>`).join('')}
            </div>` : ''}
        </div>

        <!-- Foto -->
        <div class="pf-card">
          <div class="pf-card-title">📷 Fotografía de evidencia *</div>
          <label class="pf-photo-btn" for="foto-input">
            <span style="font-size:28px;">📷</span>
            <span>Tomar foto o subir imagen</span>
            <span style="font-size:11px;opacity:.6;">JPG/PNG · máx 5 MB</span>
          </label>
          <input type="file" id="foto-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
          <img id="foto-preview" class="pf-photo-preview" alt="Preview">
        </div>

        <button class="pf-submit" id="btn-submit" disabled>Registrar recepción</button>
        <div style="text-align:center;font-size:11px;color:#334155;">
          Mi Farmacia · Sistema IT · Registro seguro
        </div>
      </div>
    </div>`;

  /* Sede search */
  let sedeSeleccionada = { id: null, nombre: '' };
  buildSedeSearch('sede-search-container', val => { sedeSeleccionada = val; checkReady(); });

  /* Final toggle */
  const finalToggle  = document.getElementById('es-entrega-final');
  const finalSection = document.getElementById('final-section');
  finalToggle.addEventListener('change', () => {
    finalSection.classList.toggle('visible', finalToggle.checked);
  });

  /* Photo preview */
  const fotoInput   = document.getElementById('foto-input');
  const fotoPreview = document.getElementById('foto-preview');
  fotoInput.addEventListener('change', () => {
    const f = fotoInput.files[0];
    if (f) {
      fotoPreview.src = URL.createObjectURL(f);
      fotoPreview.style.display = 'block';
    }
    checkReady();
  });

  /* Inputs */
  ['recibido-por', 'entregado-por'].forEach(id =>
    document.getElementById(id).addEventListener('input', checkReady));

  function checkReady() {
    const ok = document.getElementById('recibido-por').value.trim() &&
               document.getElementById('entregado-por').value.trim() &&
               sedeSeleccionada.nombre.trim() &&
               fotoInput.files.length > 0;
    document.getElementById('btn-submit').disabled = !ok;
  }

  /* Submit */
  document.getElementById('btn-submit').addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const isFinal = finalToggle.checked;
    const fd = new FormData();
    fd.append('recibido_por',  document.getElementById('recibido-por').value.trim());
    fd.append('entregado_por', document.getElementById('entregado-por').value.trim());
    fd.append('ubicacion',     sedeSeleccionada.nombre.trim());
    if (sedeSeleccionada.id) fd.append('sede_id', sedeSeleccionada.id);
    fd.append('observaciones', document.getElementById('observaciones').value.trim());
    fd.append('foto', fotoInput.files[0]);

    let endpoint = `/api/tracking/public/${token}/evento`;

    if (isFinal) {
      endpoint = `/api/tracking/public/${token}/entrega-final`;
      fd.append('cargo_receptor', document.getElementById('cargo-receptor')?.value?.trim() || '');

      if (_pkg.articulos?.length > 0) {
        const items = _pkg.articulos.map((a, i) => ({
          item_index: i,
          equipment_name: a.nombre || a.descripcion || 'Artículo',
          cantidad: a.cantidad || 1,
          recibido_conforme: document.getElementById(`item-${i}`)?.checked ? 1 : 0,
          observacion_item: document.getElementById(`item-obs-${i}`)?.value?.trim() || null,
        }));
        fd.append('items', JSON.stringify(items));
      }
    }

    try {
      const res  = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
      showSuccess(data);
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Registrar recepción';
    }
  });
}

/* ── Boot ── */
async function init() {
  try {
    const [pkgRes, sedesRes] = await Promise.all([
      fetch(`/api/tracking/public/${token}`),
      fetch('/api/tracking/public/sedes'),
    ]);

    if (!pkgRes.ok) {
      showError('Este enlace no existe o no es válido. Contacta al equipo IT.');
      return;
    }

    _pkg   = await pkgRes.json();
    const sedesData = await sedesRes.json();
    _sedes  = sedesData.sedes  || [];
    _cargos = sedesData.cargos || [];

    if (_pkg.estado === 'entregado') { showDelivered(); return; }
    if (_pkg.estado === 'devuelto') { showError('Este paquete fue marcado como devuelto.'); return; }

    renderForm();
  } catch (err) {
    showError('No se pudo cargar la información. Verifica tu conexión.');
  }
}

init();
```

- [ ] **Step 2: Verify by opening in browser**

1. Restart server
2. Create a test despacho via the app (auto-generates tracking)
3. Get the token: `node -e "import('./src/config/database.js').then(m => console.log(m.default.prepare('SELECT token FROM paquete_tracking LIMIT 1').get()))"`
4. Open: `http://localhost:3000/rastrear/<token>`
5. Verify: form loads, sedes search works, photo preview shows, submit button enables when all filled

- [ ] **Step 3: Commit**

```bash
git add public/rastrear.html public/js/tracking-public.js
git commit -m "feat(tracking): add public reception form (tracking-public.js)"
```

---

## Task 9: public/js/trazabilidad.js

**Files:**
- Create: `public/js/trazabilidad.js`

- [ ] **Step 1: Create the internal tracking module**

```js
/* public/js/trazabilidad.js
 * Internal tracking list + timeline view for IT team.
 */
import { formatDate } from './app.js';

const ESTADOS = {
  creado:      { label: 'Creado',      cls: 'badge-pendiente', icon: '📦' },
  en_transito: { label: 'En tránsito', cls: 'badge-en_progreso', icon: '🚚' },
  en_sede:     { label: 'En sede',     cls: 'badge-en_espera', icon: '📍' },
  entregado:   { label: 'Entregado',   cls: 'badge-resuelto', icon: '✅' },
  devuelto:    { label: 'Devuelto',    cls: 'badge-critica', icon: '↩️' },
};

function estadoBadge(e) {
  const c = ESTADOS[e] || { label: e, cls: '', icon: '📦' };
  return `<span class="badge ${c.cls}">${c.icon} ${c.label}</span>`;
}

function progressPct(estado) {
  return { creado: 10, en_transito: 40, en_sede: 70, entregado: 100, devuelto: 0 }[estado] || 0;
}

function timeAgo(dt) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

/* ── List view ── */
async function renderList(container, onDetail) {
  container.innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Trazabilidad de Paquetes</h2>
        <p style="color:var(--text-muted);font-size:14px;">Seguimiento en tiempo real de despachos activos.</p>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
      <input id="tl-search" type="text" placeholder="Buscar por número, destino…"
        style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
      <select id="tl-estado"
        style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-muted);font-size:13px;">
        <option value="">Todos los estados</option>
        <option value="creado">Creado</option>
        <option value="en_transito">En tránsito</option>
        <option value="en_sede">En sede</option>
        <option value="entregado">Entregado</option>
        <option value="devuelto">Devuelto</option>
      </select>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="tl-table-wrap">
        <div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>
      </div>
    </div>`;

  async function load() {
    const search = document.getElementById('tl-search')?.value?.trim() || '';
    const estado = document.getElementById('tl-estado')?.value || '';
    const qs = new URLSearchParams({ limit: 50 });
    if (search) qs.set('search', search);
    if (estado) qs.set('estado', estado);

    const wrap = document.getElementById('tl-table-wrap');
    try {
      const res  = await fetch(`/api/tracking?${qs}`);
      const data = await res.json();

      if (!data.rows?.length) {
        wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">No hay paquetes con seguimiento activo.</div>`;
        return;
      }

      wrap.innerHTML = `
        <div style="padding:12px 18px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">
          ${data.total} paquete(s)
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Número</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Destino</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Estado</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Último evento</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Progreso</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              ${data.rows.map(r => {
                const pct = progressPct(r.estado);
                return `
                  <tr class="tr-tracking-row" data-token="${r.token}"
                    style="border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s;"
                    onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                    <td style="padding:12px 14px;font-family:monospace;font-size:12px;font-weight:700;color:var(--primary);">${r.numero}</td>
                    <td style="padding:12px 14px;font-size:13px;">${r.sede_destino || r.destinatario || '—'}</td>
                    <td style="padding:12px 14px;">${estadoBadge(r.estado)}</td>
                    <td style="padding:12px 14px;font-size:12px;color:var(--text-muted);">${r.ultimo_evento_ubicacion || '—'}</td>
                    <td style="padding:12px 14px;">
                      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden;width:80px;">
                        <div style="height:100%;border-radius:99px;background:linear-gradient(90deg,#6366f1,#10b981);width:${pct}%;"></div>
                      </div>
                    </td>
                    <td style="padding:12px 14px;font-size:12px;color:var(--text-muted);">${timeAgo(r.ultimo_evento_at || r.updated_at)}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;

      wrap.querySelectorAll('.tr-tracking-row').forEach(row =>
        row.addEventListener('click', () => onDetail(row.dataset.token)));
    } catch (e) {
      wrap.innerHTML = `<div style="padding:30px;color:#f87171;text-align:center;">Error al cargar: ${e.message}</div>`;
    }
  }

  let timer;
  document.getElementById('tl-search').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 300); });
  document.getElementById('tl-estado').addEventListener('change', load);
  load();
}

/* ── Timeline/detail view ── */
async function renderDetail(container, token, onBack) {
  container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>`;

  try {
    const res  = await fetch(`/api/tracking/${token}`);
    if (!res.ok) throw new Error('No encontrado');
    const t = await res.json();

    const STEP_LABELS = ['Creado', 'Despachado', 'En tránsito', 'En sede', 'Entregado'];
    const stepActive  = { creado: 0, en_transito: 2, en_sede: 3, entregado: 4, devuelto: 4 };
    const currentStep = stepActive[t.estado] ?? 0;

    container.innerHTML = `
      <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button id="btn-back-tl"
          style="padding:6px 14px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);color:var(--text-muted);font-size:13px;cursor:pointer;">
          ← Volver
        </button>
        ${estadoBadge(t.estado)}
        <span style="font-size:18px;font-weight:700;">${t.numero} — Trazabilidad</span>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px;">
        ${t.sede_destino || t.destinatario} · ${formatDate(t.created_at)}
      </p>

      <!-- Progress bar -->
      <div style="display:flex;margin-bottom:28px;overflow:hidden;border-radius:10px;">
        ${STEP_LABELS.map((label, i) => `
          <div style="flex:1;padding:10px 6px;text-align:center;font-size:11px;font-weight:600;
            ${i < currentStep ? 'background:rgba(16,185,129,.15);color:#6ee7b7;' :
              i === currentStep ? 'background:rgba(99,102,241,.2);color:#818cf8;' :
              'background:rgba(255,255,255,.03);color:#334155;'}
            ${i < STEP_LABELS.length - 1 ? 'border-right:1px solid rgba(255,255,255,.05);' : ''}">
            ${label}
          </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start;">

        <!-- Timeline -->
        <div class="card">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em;">
            Historial de movimientos
          </h4>
          ${t.eventos.map((e, idx) => {
            const isLast  = idx === t.eventos.length - 1;
            const isDone  = e.estado_paquete !== 'en_transito' || !isLast;
            const dotCls  = e.tipo === 'creacion' ? 'background:#6366f1;border-color:#6366f1;'
              : e.tipo === 'entrega_final' ? 'background:#10b981;border-color:#10b981;'
              : isDone ? 'background:#10b981;border-color:#10b981;' : 'background:#f59e0b;border-color:#f59e0b;';
            return `
              <div style="display:flex;gap:0;">
                <div style="display:flex;flex-direction:column;align-items:center;width:32px;flex-shrink:0;">
                  <div style="width:12px;height:12px;border-radius:50%;border:2px solid;margin-top:3px;${dotCls}"></div>
                  ${!isLast ? `<div style="width:2px;flex:1;min-height:20px;background:${isDone ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.07)'};"></div>` : ''}
                </div>
                <div style="flex:1;padding:0 0 ${isLast ? 0 : 20}px 10px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <span style="font-size:14px;font-weight:600;">
                      ${e.tipo === 'creacion' ? '📦 Despacho creado' :
                        e.tipo === 'entrega_final' ? '✅ Entrega final' :
                        `📍 Recibido en ${e.ubicacion}`}
                    </span>
                    <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${formatDate(e.created_at)}</span>
                  </div>
                  <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">
                    ${e.tipo === 'creacion'
                      ? `Creado por ${e.recibido_por}`
                      : `Recibido por <strong style="color:var(--text)">${e.recibido_por}</strong>${e.cargo_receptor ? ` (${e.cargo_receptor})` : ''} · Entregó: ${e.entregado_por}`}
                  </div>
                  ${e.observaciones ? `<div style="font-size:12px;color:#64748b;font-style:italic;">"${e.observaciones}"</div>` : ''}
                  ${e.foto_path && e.foto_path !== 'system' ? `
                    <img src="/api/tracking/fotos/${e.foto_filename}" alt="Evidencia"
                      style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-top:8px;cursor:pointer;border:1px solid rgba(255,255,255,.1);"
                      onclick="window.open('/api/tracking/fotos/${e.foto_filename}','_blank')">` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- Right panel -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <!-- QR -->
          <div class="card">
            <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">QR del paquete</h4>
            <img src="/api/tracking/${token}/qr" alt="QR" style="width:100%;border-radius:8px;background:#fff;padding:8px;">
            <a href="/api/tracking/${token}/qr" download="QR-${t.numero}.png"
              class="btn btn-primary" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;text-decoration:none;">
              ⬇ Descargar QR
            </a>
          </div>

          <!-- Info -->
          <div class="card" style="font-size:13px;">
            <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">Detalles</h4>
            ${[
              ['Número', t.numero],
              ['Destinatario', t.destinatario],
              ['Sede destino', t.sede_destino || '—'],
              ['Eventos', t.eventos.length],
              ['Creado', formatDate(t.created_at)],
            ].map(([k, v]) => `
              <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);">
                <span style="color:var(--text-muted);">${k}</span>
                <span style="font-weight:500;">${v}</span>
              </div>`).join('')}
          </div>

          ${t.acta_final ? `
            <div class="card">
              <h4 style="font-size:13px;font-weight:700;color:#10b981;margin-bottom:10px;">Acta de recepción</h4>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                Firmada por: ${t.acta_final.firmado_por}<br>Cargo: ${t.acta_final.cargo}
              </p>
              <a href="/api/tracking/public/${token}/acta-final"
                class="btn btn-secondary btn-small" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;">
                📄 Descargar acta
              </a>
            </div>` : ''}

          ${t.estado !== 'entregado' && t.estado !== 'devuelto' ? `
            <button id="btn-devuelto"
              style="padding:8px 16px;border:1px solid rgba(239,68,68,.3);border-radius:8px;background:rgba(239,68,68,.08);color:#f87171;font-size:12px;cursor:pointer;">
              ↩️ Marcar como devuelto
            </button>` : ''}
        </div>
      </div>`;

    document.getElementById('btn-back-tl')?.addEventListener('click', onBack);

    document.getElementById('btn-devuelto')?.addEventListener('click', async () => {
      if (!confirm('¿Marcar este paquete como devuelto?')) return;
      const res = await fetch(`/api/tracking/${token}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'devuelto' }),
      });
      if (res.ok) renderDetail(container, token, onBack);
    });

  } catch (e) {
    container.innerHTML = `<div style="padding:30px;color:#f87171;text-align:center;">Error: ${e.message}</div>`;
  }
}

/* ── Main export ── */
export async function renderTrazabilidad(container) {
  renderList(container, (token) => renderDetail(container, token, () => renderList(container, (t) => renderDetail(container, t, () => renderList(container, () => {})))));
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/trazabilidad.js
git commit -m "feat(tracking): add trazabilidad internal list + timeline view"
```

---

## Task 10: Wire up sidebar + routing

**Files:**
- Modify: `public/js/app.js`
- Modify: `public/index.html`

- [ ] **Step 1: Import renderTrazabilidad in app.js**

At the top of `public/js/app.js`, add alongside the other imports:

```js
import { renderTrazabilidad } from './trazabilidad.js';
```

- [ ] **Step 2: Add #trazabilidad route to the router() function in app.js**

Inside the `switch (hash)` block in `router()`, add after the `#despacho` case:

```js
      case '#trazabilidad':
        if (state.currentUser && !can('despacho:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'trazabilidad';
        document.getElementById('nav-trazabilidad')?.classList.add('active');
        renderTrazabilidad(appContainer);
        break;
```

- [ ] **Step 3: Add sidebar item in public/index.html**

In `public/index.html`, find the sidebar nav item for "Despacho" (has `id="nav-despacho"`). Add the Trazabilidad item immediately after it:

```html
<a href="#trazabilidad" class="menu-item" id="nav-trazabilidad" data-permission="despacho:read">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
    <path d="M16 12h2a2 2 0 0 1 0 4h-2"/>
    <path d="M8 12H6a2 2 0 0 0 0 4h2"/>
  </svg>
  Trazabilidad
</a>
```

- [ ] **Step 4: Verify navigation**

Open the app → verify "Trazabilidad" appears in sidebar → click it → table loads.

- [ ] **Step 5: Commit**

```bash
git add public/js/app.js public/index.html
git commit -m "feat(tracking): add Trazabilidad sidebar item and router entry"
```

---

## Task 11: Despacho Integration

**Files:**
- Modify: `src/despacho/despacho-routes.js`
- Modify: `public/js/despacho.js`

- [ ] **Step 1: Auto-create tracking on POST /api/despachos**

In `src/despacho/despacho-routes.js`, add import at the top:

```js
import { createTracking } from '../tracking/tracking-model.js';
```

In the `POST /api/despachos` handler, after `res.json({ success: true, id, numero });` — actually, insert it BEFORE the response, right after the `logDespacho` calls:

```js
    // Auto-crear tracking para este despacho
    try {
      createTracking(db, id, agente || 'IT', 'Bodega Central');
    } catch (err) {
      console.error('[tracking] Error al crear tracking:', err.message);
    }

    res.json({ success: true, id, numero });
```

- [ ] **Step 2: Add tracking section to despacho detail modal in public/js/despacho.js**

In `despacho.js`, find the `openDetailModal` function. After the `body.innerHTML = ...` assignment (inside the `fetchDespacho.then()` callback), add tracking section fetch:

```js
    // Load tracking for this despacho (efficient: lookup by despacho ID)
    const tkRes = await fetch(`/api/tracking/by-despacho/${d.id}`).then(r => r.ok ? r.json() : { token: null });

    if (tkRes.token) {
      const trackingSection = document.createElement('div');
      trackingSection.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid var(--glass-border);';
      trackingSection.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">
            Tracking del paquete
          </h4>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="${tkRes.qr_url}" download="QR-${d.numero}.png"
             class="btn btn-secondary btn-small" style="text-decoration:none;font-size:12px;padding:5px 12px;">
             ⬇ QR del paquete
          </a>
          <a href="#trazabilidad" onclick="this.closest('.modal-overlay')?.remove()"
             class="btn btn-secondary btn-small" style="text-decoration:none;font-size:12px;padding:5px 12px;">
             🗺️ Ver timeline completo
          </a>
        </div>`;
      overlay.querySelector('#modal-body').appendChild(trackingSection);
    }
```

- [ ] **Step 3: Verify full flow**

1. Create a new despacho via the app
2. Check console: no tracking errors
3. In DB: `SELECT * FROM paquete_tracking ORDER BY id DESC LIMIT 1;` — should show a row
4. Open the despacho detail modal → tracking section appears with QR download
5. Click QR download → PNG downloads
6. Go to `#trazabilidad` → new despacho appears in list
7. Click row → timeline shows "Despacho creado" event

- [ ] **Step 4: Commit**

```bash
git add src/despacho/despacho-routes.js public/js/despacho.js
git commit -m "feat(tracking): auto-create tracking on despacho + show in detail modal"
```

---

## Final Verification Checklist

- [ ] New despacho → tracking auto-created, QR available
- [ ] `/rastrear/:token` → public form loads on mobile, shows package info
- [ ] Sedes search filters in real time, free text works
- [ ] Photo required — submit disabled without it, preview shows after selection
- [ ] Submit without final checkbox → estado becomes `en_transito` or `en_sede`
- [ ] Submit with final checkbox + cargo + items → `entregado` state + acta generated
- [ ] Success screen shows "Descargar Acta" only on final delivery
- [ ] After submission → token page shows "Paquete ya entregado" if state = entregado
- [ ] Rate limiting: 6th event on same token within 1 hour → 429 error
- [ ] IT team: sidebar "Trazabilidad" shows all packages with state badges
- [ ] Click row → timeline with events, photos (click to enlarge), times
- [ ] QR download button → PNG with correct URL
- [ ] "Marcar devuelto" → state changes, button disappears
- [ ] WhatsApp notification sent on each event (requires IT_PHONE env var set)
- [ ] SSE: `tracking-evento` event broadcast on each reception

---

## Environment Variable

Add to `.env` if not already present:

```
IT_PHONE=573XXXXXXXXX   # WhatsApp number of IT team for notifications
```
