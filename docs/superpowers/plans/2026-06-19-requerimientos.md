# Sistema de Requerimientos Medivalle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone public requirements system (form + list + admin panel) with Medivalle SF SAS branding, hosted on the same Express server as the IT panel but visually independent.

**Architecture:** New `src/requerimientos/` module with 6 API endpoints, `requerimientos` table added via existing migration pattern in `database.js`, and three new HTML pages (`herramientas.html`, `requerimientos.html`, `public/js/requerimientos.js`). Admin auth uses HMAC-SHA256 with Node built-in `crypto` — no extra packages except `nodemailer`.

**Tech Stack:** Node.js ESM, Express, SQLite (`node:sqlite`), multer (already installed), nodemailer (new), Canvas API (frontend photo compression), vanilla JS frontend.

---

## Task 1: Install nodemailer + DB migration

**Files:**
- Modify: `package.json`
- Modify: `src/config/database.js` (line 513, before closing `]`)

- [ ] **Step 1: Install nodemailer**

```bash
npm install nodemailer
```

Expected output: `added 1 package` (nodemailer has no dependencies)

- [ ] **Step 2: Add migration to database.js**

Find line 513 (`\`CREATE INDEX IF NOT EXISTS idx_confirmaciones_token ON confirmaciones_entrega(token)\``) and add after it, before the closing `];`:

```js
  `CREATE TABLE IF NOT EXISTS requerimientos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_num         TEXT UNIQUE NOT NULL,
    area               TEXT NOT NULL,
    nombre             TEXT NOT NULL,
    correo             TEXT DEFAULT '',
    punto              TEXT NOT NULL,
    tipo               TEXT NOT NULL,
    descripcion        TEXT NOT NULL,
    fecha_requerida    TEXT DEFAULT '',
    ticket_relacionado TEXT DEFAULT '',
    observaciones      TEXT DEFAULT '',
    prioridad          TEXT NOT NULL DEFAULT 'NORMAL',
    estado             TEXT NOT NULL DEFAULT 'Recibido',
    fotos              TEXT DEFAULT '[]',
    created_at         TEXT DEFAULT (datetime('now','localtime')),
    updated_at         TEXT DEFAULT (datetime('now','localtime'))
  )`,
```

- [ ] **Step 3: Add env vars to .env.example**

Append to `.env.example`:

```env

# ── Sistema de Requerimientos Medivalle ──────────────────────────────────
REQ_GMAIL_USER=gestion.medivallesf@gmail.com
REQ_GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
REQ_ADMIN_SECRET=cambiar_en_produccion
```

- [ ] **Step 4: Verify table is created**

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('./database/tickets.db');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE name='requerimientos'\").get())"
```

Expected: `{ name: 'requerimientos' }`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/config/database.js .env.example
git commit -m "feat(requerimientos): install nodemailer, add requerimientos table migration"
```

---

## Task 2: Email service

**Files:**
- Create: `src/requerimientos/email-service.js`

- [ ] **Step 1: Create email-service.js**

```js
// src/requerimientos/email-service.js
import nodemailer from 'nodemailer';

const TIPO_ABREV = {
  Locativo: 'LOC', Sistemas: 'SIS', Bodega: 'BOD',
  Calidad: 'CAL', Mantenimiento: 'MAN', Otro: 'OTR',
};
const PRIOR_EMOJI = { URGENTE: '🔴', ALTA: '🟠', NORMAL: '🟢' };
const DEST = 'gestion.medivallesf@gmail.com';

export async function sendReqEmail(data) {
  const { ticket_num, area, nombre, correo, punto, tipo,
          descripcion, fecha_requerida, observaciones, prioridad } = data;

  const user = process.env.REQ_GMAIL_USER;
  const pass = process.env.REQ_GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('REQ_GMAIL_USER / REQ_GMAIL_APP_PASSWORD no configurados');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const fechaHora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const abrev    = TIPO_ABREV[tipo]     || 'OTR';
  const emoji    = PRIOR_EMOJI[prioridad] || '🟢';
  const correoStr = correo ? ` — ${correo}` : '';

  const text = `📋 Nuevo Requerimiento — MEDIVALLE SF SAS

Ticket      ${ticket_num}
Área        ${area}
Solicitante ${nombre}${correoStr}
Tipo        ${abrev}
Punto       ${punto}
Prioridad   ${emoji} ${prioridad}
Fecha req.  ${fecha_requerida || '—'}

Descripción:
${descripcion}

Obs.: ${observaciones || '—'}

─────────────────────────────
Sistema de Requerimientos MEDIVALLE SF SAS · ${fechaHora}`;

  const html = `<pre style="font-family:monospace;font-size:13px;line-height:1.8;color:#111;background:#f8f9fa;padding:20px;border-radius:8px;border:1px solid #dee2e6;max-width:600px">${text}</pre>`;

  await transporter.sendMail({
    from: `"Requerimientos Medivalle" <${user}>`,
    to: DEST,
    subject: `📋 ${ticket_num} — ${tipo} | ${punto} | ${emoji} ${prioridad}`,
    text,
    html,
  });
}
```

- [ ] **Step 2: Verify module parses without error**

```bash
node --input-type=module --eval "import './src/requerimientos/email-service.js'; console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/requerimientos/email-service.js
git commit -m "feat(requerimientos): add nodemailer email service with exact format"
```

---

## Task 3: API routes

**Files:**
- Create: `src/requerimientos/req-routes.js`

- [ ] **Step 1: Create req-routes.js**

```js
// src/requerimientos/req-routes.js
import express    from 'express';
import crypto     from 'node:crypto';
import multer     from 'multer';
import path       from 'node:path';
import fs         from 'node:fs';
import db         from '../config/database.js';
import { sendReqEmail } from './email-service.js';

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
const ADMIN_USER = 'GESTION';
const ADMIN_PASS = 'GST123';
const TOKEN_TTL  = 8 * 60 * 60 * 1000; // 8 h

function makeToken(ts) {
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
  const expected = makeToken(ts).split('.')[0];
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
  const last = db.prepare('SELECT ticket_num FROM requerimientos ORDER BY id DESC LIMIT 1').get();
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

// ── POST /api/req ───────────────────────────────────────────────────────
router.post('/api/req', (req, res) => {
  const { area, nombre, correo, punto, tipo, descripcion,
          fecha_requerida, ticket_relacionado, observaciones, prioridad, fotos } = req.body;

  if (!area?.trim() || !nombre?.trim() || !punto?.trim() || !tipo?.trim() || !descripcion?.trim())
    return res.status(400).json({ error: 'Campos requeridos: area, nombre, punto, tipo, descripcion.' });

  const TIPOS_VALIDOS = ['Locativo','Sistemas','Bodega','Calidad','Mantenimiento','Otro'];
  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });

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
});

// ── GET /api/req ────────────────────────────────────────────────────────
router.get('/api/req', (req, res) => {
  const { q, tipo, estado, prioridad, page = '1' } = req.query;
  const limit  = 20;
  const offset = (Math.max(1, parseInt(page)) - 1) * limit;
  const where  = [];
  const params = [];

  if (q)         { where.push('(ticket_num LIKE ? OR punto LIKE ? OR descripcion LIKE ? OR nombre LIKE ?)'); const s=`%${q}%`; params.push(s,s,s,s); }
  if (tipo)      { where.push('tipo = ?');      params.push(tipo); }
  if (estado)    { where.push('estado = ?');    params.push(estado); }
  if (prioridad) { where.push('prioridad = ?'); params.push(prioridad); }

  const W     = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows  = db.prepare(`SELECT * FROM requerimientos ${W} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM requerimientos ${W}`).get(...params).c;

  res.json({ rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
});

// ── GET /api/req/:id ────────────────────────────────────────────────────
router.get('/api/req/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM requerimientos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrado.' });
  res.json(row);
});

// ── POST /api/req/admin/login ───────────────────────────────────────────
router.post('/api/req/admin/login', (req, res) => {
  const { usuario, password } = req.body || {};
  if (usuario !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  const ts = Date.now();
  res.json({ token: makeToken(ts) });
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
```

- [ ] **Step 2: Register router in server.js**

Add import after line 25 (`import aiRouter`):
```js
import reqRouter from './src/requerimientos/req-routes.js';
```

Add `app.use` after `app.use(aiRouter);`:
```js
app.use(reqRouter);
```

- [ ] **Step 3: Verify routes load**

```bash
npm start &
sleep 3
curl -s http://localhost:3000/api/req/puntos | head -c 100
curl -s -X POST http://localhost:3000/api/req/admin/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"GESTION","password":"GST123"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token?'TOKEN OK':'FAIL'))"
```

Expected: puntos returns `[]` or JSON array; login returns `TOKEN OK`

- [ ] **Step 4: Test create + list**

```bash
curl -s -X POST http://localhost:3000/api/req \
  -H "Content-Type: application/json" \
  -d '{"area":"Sistemas","nombre":"Test","punto":"Punto Test","tipo":"Sistemas","descripcion":"Prueba de creacion","prioridad":"NORMAL"}' \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)))"
```

Expected: `{ ok: true, ticket_num: 'REQ-202606-001' }`

```bash
curl -s "http://localhost:3000/api/req" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log('total:',r.total,'rows:',r.rows.length)})"
```

Expected: `total: 1 rows: 1`

- [ ] **Step 5: Kill test server + commit**

```bash
pkill -f "node.*server" 2>/dev/null; true
git add src/requerimientos/req-routes.js server.js
git commit -m "feat(requerimientos): add all API endpoints + wire into server"
```

---

## Task 4: Portal `/herramientas.html`

**Files:**
- Create: `public/herramientas.html`

- [ ] **Step 1: Create herramientas.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Herramientas Internas — Medivalle SF S.A.S</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:#0a0a14;min-height:100vh;display:flex;flex-direction:column}

    /* TOPBAR */
    .topbar{background:#11273C;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}
    .topbar-left{display:flex;align-items:center;gap:12px}
    .topbar-logo{background:#05A0D8;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0}
    .topbar-name{color:#fff;font-size:14px;font-weight:700;line-height:1.2}
    .topbar-sub{color:rgba(255,255,255,.4);font-size:10px;text-transform:uppercase;letter-spacing:.5px}
    .topbar-nav{display:flex;gap:6px}
    .nav-link{color:rgba(255,255,255,.6);font-size:12px;font-weight:500;text-decoration:none;padding:5px 12px;border-radius:5px;border:1px solid rgba(255,255,255,.12);transition:all .15s}
    .nav-link:hover{color:#fff;background:rgba(255,255,255,.08)}
    .nav-link.active{background:#05A0D8;color:#fff;border-color:#05A0D8}

    /* HERO */
    .hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center}
    .hero-badge{background:rgba(5,160,216,.12);border:1px solid rgba(5,160,216,.25);color:#05A0D8;font-size:11px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:.4px;text-transform:uppercase;margin-bottom:20px}
    .hero h1{font-size:32px;font-weight:800;color:#fff;letter-spacing:-.5px;margin-bottom:10px}
    .hero p{font-size:15px;color:rgba(255,255,255,.45);max-width:480px;line-height:1.6}

    /* CARDS */
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;max-width:720px;width:100%;margin-top:40px}
    .tool-card{background:#15152a;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:28px;text-align:left;text-decoration:none;transition:all .2s;display:flex;flex-direction:column;gap:16px}
    .tool-card:hover{border-color:rgba(5,160,216,.5);background:#1a1a34;transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.4)}
    .card-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
    .card-icon.req{background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25)}
    .card-icon.calc{background:rgba(5,160,216,.15);border:1px solid rgba(5,160,216,.25)}
    .card-name{font-size:17px;font-weight:700;color:#fff;margin-bottom:4px}
    .card-desc{font-size:13px;color:rgba(255,255,255,.45);line-height:1.5}
    .card-cta{margin-top:auto;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#05A0D8}

    .footer{padding:20px;text-align:center;font-size:11px;color:rgba(255,255,255,.2);border-top:1px solid rgba(255,255,255,.06)}
  </style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <div class="topbar-logo">M</div>
    <div>
      <div class="topbar-name">Medivalle SF S.A.S</div>
      <div class="topbar-sub">Herramientas Internas</div>
    </div>
  </div>
  <div class="topbar-nav">
    <a href="/requerimientos.html" class="nav-link">📋 Requerimientos</a>
    <a href="/medicalc.html" class="nav-link">🧮 MediCalc</a>
  </div>
</div>

<div class="hero">
  <div class="hero-badge">Portal Interno</div>
  <h1>Herramientas Medivalle</h1>
  <p>Acceso centralizado a las herramientas internas de Medivalle SF S.A.S. Selecciona la herramienta que necesitas.</p>

  <div class="cards">
    <a href="/requerimientos.html" class="tool-card">
      <div class="card-icon req">📋</div>
      <div>
        <div class="card-name">Sistema de Requerimientos</div>
        <div class="card-desc">Levanta solicitudes de mantenimiento, sistemas, calidad, bodega y más. Seguimiento en tiempo real del estado de tu solicitud.</div>
      </div>
      <div class="card-cta">Abrir sistema <span>→</span></div>
    </a>

    <a href="/medicalc.html" class="tool-card">
      <div class="card-icon calc">🧮</div>
      <div>
        <div class="card-name">MediCalc</div>
        <div class="card-desc">Calculadora de dispensación segura. Líquidos, insulinas, goteros, viales, dosis por peso, equivalencias y más.</div>
      </div>
      <div class="card-cta">Abrir calculadora <span>→</span></div>
    </a>
  </div>
</div>

<div class="footer">Medivalle SF S.A.S · Sistema de Herramientas Internas</div>
</body>
</html>
```

- [ ] **Step 2: Verify page loads**

Open `http://localhost:3000/herramientas.html` — should show dark portal with two tool cards.

- [ ] **Step 3: Commit**

```bash
git add public/herramientas.html
git commit -m "feat(requerimientos): add herramientas.html portal landing page"
```

---

## Task 5: Update medicalc.html topbar

**Files:**
- Modify: `public/medicalc.html` (sidebar + app-header section)

- [ ] **Step 1: Replace sidebar + app-header with Medivalle topbar**

In `public/medicalc.html`, replace everything between `<body>` and `<!-- ═══ CALCULADORA` with:

```html
<body>

<!-- TOPBAR MEDIVALLE -->
<div style="background:#11273C;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;z-index:100">
  <a href="/herramientas.html" style="display:flex;align-items:center;gap:12px;text-decoration:none">
    <div style="background:#05A0D8;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px">M</div>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:700;line-height:1.2">Medivalle SF S.A.S</div>
      <div style="color:rgba(255,255,255,.4);font-size:10px;text-transform:uppercase;letter-spacing:.5px">Herramientas Internas</div>
    </div>
  </a>
  <div style="display:flex;gap:6px">
    <a href="/requerimientos.html" style="color:rgba(255,255,255,.6);font-size:12px;font-weight:500;text-decoration:none;padding:5px 12px;border-radius:5px;border:1px solid rgba(255,255,255,.12)">📋 Requerimientos</a>
    <a href="/medicalc.html" style="background:#05A0D8;color:#fff;font-size:12px;font-weight:600;text-decoration:none;padding:5px 12px;border-radius:5px;border:1px solid #05A0D8">🧮 MediCalc</a>
  </div>
</div>

<!-- ADVERTENCIA GLOBAL -->
<div class="mc-warning">
  <span>⚠️</span>
  <span>Toda prescripción corresponde a <b>30 días (1 mes)</b> salvo que se indique lo contrario en el campo Duración.</span>
</div>
```

Also remove from `medicalc.css` these rules that referenced the old sidebar layout:
- `.main-content` (no longer needed — medicalc is standalone)
- `.mc-page-title`, `.mc-header-icon`, `.mc-page-title-name`, `.mc-page-title-sub`, `.mc-badge` (replaced by inline topbar)

And update `medicalc.css` body to:
```css
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: #0a0a14;
  min-height: 100vh;
  color: #e8edf5;
}
```

- [ ] **Step 2: Remove the old `.main-content` wrapper div**

In `medicalc.html`, change:
```html
<div class="main-content">
  ...
  <div class="medicalc-wrap">
```
to just:
```html
<div class="medicalc-wrap">
```

And at the bottom change:
```html
  </div><!-- /medicalc-wrap -->
</div><!-- /main-content -->
```
to:
```html
</div><!-- /medicalc-wrap -->
```

- [ ] **Step 3: Verify medicalc still works**

Open `http://localhost:3000/medicalc.html` — should show Medivalle topbar at top with nav links, calculator below. No sidebar. All tabs work.

- [ ] **Step 4: Commit**

```bash
git add public/medicalc.html public/css/medicalc.css
git commit -m "feat(requerimientos): update medicalc topbar to match Medivalle portal"
```

---

## Task 6: `requerimientos.html` — HTML skeleton + styles

**Files:**
- Create: `public/requerimientos.html`

- [ ] **Step 1: Create requerimientos.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>Requerimientos — Medivalle SF S.A.S</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:#0a0a14;min-height:100vh;color:#e8edf5}

    /* ── TOPBAR ─────────────────────────────────────── */
    .topbar{background:#11273C;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;z-index:100}
    .topbar-left{display:flex;align-items:center;gap:12px;text-decoration:none}
    .topbar-logo{background:#05A0D8;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0}
    .topbar-name{color:#fff;font-size:14px;font-weight:700;line-height:1.2}
    .topbar-sub{color:rgba(255,255,255,.4);font-size:10px;text-transform:uppercase;letter-spacing:.5px}
    .topbar-nav{display:flex;gap:6px;align-items:center}
    .nav-link{color:rgba(255,255,255,.6);font-size:12px;font-weight:500;text-decoration:none;padding:5px 12px;border-radius:5px;border:1px solid rgba(255,255,255,.12);transition:all .15s;white-space:nowrap}
    .nav-link:hover{color:#fff;background:rgba(255,255,255,.08)}
    .nav-link.active{background:#6366f1;color:#fff;border-color:#6366f1}

    /* ── PAGE TABS ──────────────────────────────────── */
    .page-tabs{background:#0e0e1c;border-bottom:1px solid rgba(255,255,255,.08);display:flex;padding:0 24px;gap:0}
    .tab-btn{padding:13px 20px;font-size:13px;font-weight:600;color:rgba(255,255,255,.4);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;position:relative}
    .tab-btn:hover{color:rgba(255,255,255,.7)}
    .tab-btn.active{color:#e8edf5;border-bottom-color:#6366f1}
    .tab-btn.tab-admin{margin-left:auto;color:#22c55e}
    .tab-btn.tab-admin.active{border-bottom-color:#22c55e}
    .tab-badge{background:#ef4444;color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:99px;margin-left:5px;vertical-align:middle}

    /* ── TAB PANELS ─────────────────────────────────── */
    .tab-panel{display:none;padding:24px;max-width:720px;margin:0 auto}
    .tab-panel.active{display:block}
    .tab-panel.wide{max-width:1000px}

    /* ── SECTION TITLES ─────────────────────────────── */
    .sec-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#6366f1;margin:20px 0 10px;display:flex;align-items:center;gap:7px}
    .sec-title::before{content:'';width:3px;height:14px;background:#6366f1;border-radius:2px;flex-shrink:0}
    .sec-title:first-child{margin-top:0}

    /* ── CARD ───────────────────────────────────────── */
    .card{background:#15152a;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:24px}

    /* ── FIELDS ─────────────────────────────────────── */
    .field-row{display:grid;gap:12px;margin-bottom:12px}
    .field-row.cols-2{grid-template-columns:1fr 1fr}
    .field-row.cols-3{grid-template-columns:1fr 1fr 1fr}
    .field label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:rgba(255,255,255,.4);margin-bottom:5px}
    .field label .req{color:#ef4444}
    .field input,.field select,.field textarea{width:100%;background:#1b1b32;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:9px 12px;font-size:14px;color:#e8edf5;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
    .field input::placeholder,.field textarea::placeholder{color:rgba(255,255,255,.2);font-weight:400}
    .field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(99,102,241,.6);box-shadow:0 0 0 3px rgba(99,102,241,.12)}
    .field textarea{min-height:90px;resize:vertical}
    .field select option{background:#1b1b32}
    .field .hint{font-size:10px;color:rgba(255,255,255,.25);margin-top:4px}

    /* ── PUNTO AUTOCOMPLETE ─────────────────────────── */
    .punto-wrap{position:relative}
    .punto-dropdown{position:absolute;top:100%;left:0;right:0;background:#1b1b32;border:1px solid rgba(99,102,241,.4);border-top:none;border-radius:0 0 8px 8px;max-height:180px;overflow-y:auto;z-index:50;display:none}
    .punto-dropdown.open{display:block}
    .punto-item{padding:8px 12px;cursor:pointer;font-size:13px;color:#e8edf5;border-bottom:1px solid rgba(255,255,255,.05)}
    .punto-item:last-child{border-bottom:none}
    .punto-item:hover{background:rgba(99,102,241,.12)}
    .punto-item .punto-sub{font-size:10px;color:rgba(255,255,255,.3);margin-top:1px}

    /* ── TIPOS GRID ─────────────────────────────────── */
    .tipos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .tipo-btn{background:#1b1b32;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 8px;text-align:center;cursor:pointer;transition:all .15s}
    .tipo-btn:hover{border-color:rgba(99,102,241,.4);background:#21213c}
    .tipo-btn.active{border-color:#6366f1;background:rgba(99,102,241,.12)}
    .tipo-btn .tipo-icon{font-size:22px;margin-bottom:5px}
    .tipo-btn .tipo-name{font-size:11px;font-weight:700;color:#e8edf5}
    .tipo-btn .tipo-sub{font-size:9px;color:rgba(255,255,255,.3);margin-top:2px}

    /* ── PRIORIDAD ──────────────────────────────────── */
    .prior-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
    .prior-btn{background:#1b1b32;border:2px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;text-align:center;cursor:pointer;transition:all .15s}
    .prior-btn .prior-emoji{font-size:20px;margin-bottom:4px}
    .prior-btn .prior-name{font-size:11px;font-weight:800}
    .prior-btn .prior-sub{font-size:9px;color:rgba(255,255,255,.35);margin-top:2px}
    .prior-btn[data-prior="URGENTE"].active{border-color:#ef4444;background:rgba(239,68,68,.1)}
    .prior-btn[data-prior="URGENTE"].active .prior-name{color:#ef4444}
    .prior-btn[data-prior="ALTA"].active{border-color:#f97316;background:rgba(249,115,22,.1)}
    .prior-btn[data-prior="ALTA"].active .prior-name{color:#f97316}
    .prior-btn[data-prior="NORMAL"].active{border-color:#22c55e;background:rgba(34,197,94,.1)}
    .prior-btn[data-prior="NORMAL"].active .prior-name{color:#22c55e}

    /* ── FOTOS ──────────────────────────────────────── */
    .foto-zone{border:2px dashed rgba(255,255,255,.15);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:border-color .15s;background:#1b1b32}
    .foto-zone:hover,.foto-zone.drag{border-color:#6366f1;background:rgba(99,102,241,.06)}
    .foto-zone-icon{font-size:28px;margin-bottom:8px}
    .foto-zone-txt{font-size:13px;font-weight:600;color:rgba(255,255,255,.6)}
    .foto-zone-sub{font-size:10px;color:rgba(255,255,255,.3);margin-top:4px}
    .foto-previews{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
    .foto-preview{position:relative;width:70px;height:70px}
    .foto-preview img{width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.1)}
    .foto-preview .remove-foto{position:absolute;top:-5px;right:-5px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}

    /* ── SUBMIT BTN ─────────────────────────────────── */
    .btn-submit{width:100%;background:#6366f1;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit}
    .btn-submit:hover{background:#4f46e5}
    .btn-submit:disabled{background:#3a3a6a;cursor:not-allowed}

    /* ── LIST VIEW ──────────────────────────────────── */
    .filters-bar{background:#15152a;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
    .filter-input{flex:1;min-width:200px;background:#1b1b32;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:8px 12px;font-size:13px;color:#e8edf5;font-family:inherit;outline:none}
    .filter-input:focus{border-color:rgba(99,102,241,.5)}
    .filter-input::placeholder{color:rgba(255,255,255,.25)}
    .filter-select{background:#1b1b32;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:8px 10px;font-size:12px;color:#e8edf5;font-family:inherit;outline:none}
    .btn-clear{background:none;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:7px 12px;font-size:11px;color:rgba(255,255,255,.5);cursor:pointer;font-family:inherit}
    .btn-clear:hover{color:#e8edf5;border-color:rgba(255,255,255,.3)}

    .req-card{background:#15152a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;margin-bottom:8px;display:grid;grid-template-columns:100px 1fr auto;gap:12px;align-items:start}
    .req-ticket{font-size:11px;font-weight:700;color:#6366f1;font-family:monospace}
    .req-date{font-size:10px;color:rgba(255,255,255,.3);margin-top:2px}
    .req-nombre{font-size:13px;font-weight:600;color:#e8edf5}
    .req-desc{font-size:12px;color:rgba(255,255,255,.4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
    .req-punto{font-size:11px;color:rgba(255,255,255,.35);margin-top:3px}
    .chips{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}
    .chip{font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.3px}
    .chip-tipo{background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.25)}
    .chip-prior-URGENTE{background:rgba(239,68,68,.12);color:#fca5a5;border:1px solid rgba(239,68,68,.25)}
    .chip-prior-ALTA{background:rgba(249,115,22,.12);color:#fdba74;border:1px solid rgba(249,115,22,.25)}
    .chip-prior-NORMAL{background:rgba(34,197,94,.1);color:#86efac;border:1px solid rgba(34,197,94,.2)}
    .chip-estado-Recibido{background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.25)}
    .chip-estado-Asignado{background:rgba(139,92,246,.12);color:#c4b5fd;border:1px solid rgba(139,92,246,.25)}
    .chip-estado-En\ proceso{background:rgba(249,115,22,.12);color:#fdba74;border:1px solid rgba(249,115,22,.25)}
    .chip-estado-Pendiente\ info{background:rgba(245,158,11,.1);color:#fde68a;border:1px solid rgba(245,158,11,.2)}
    .chip-estado-Resuelto{background:rgba(34,197,94,.1);color:#86efac;border:1px solid rgba(34,197,94,.2)}
    .chip-estado-Cancelado{background:rgba(100,116,139,.1);color:#94a3b8;border:1px solid rgba(100,116,139,.2)}

    .pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;font-size:12px;color:rgba(255,255,255,.4)}
    .page-btn{background:#1b1b32;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 12px;color:#e8edf5;cursor:pointer;font-family:inherit;font-size:12px}
    .page-btn:disabled{opacity:.35;cursor:not-allowed}

    /* ── ADMIN ──────────────────────────────────────── */
    .admin-banner{background:linear-gradient(135deg,#0f2a40,#12528F);border-radius:12px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;border:1px solid rgba(5,160,216,.2)}
    .admin-avatar{background:#22c55e;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;flex-shrink:0}
    .admin-name{color:#fff;font-size:14px;font-weight:700}
    .admin-role{color:rgba(255,255,255,.45);font-size:11px;margin-top:1px}
    .btn-logout{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit}

    .stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px}
    .stat-card{background:#15152a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;text-align:center}
    .stat-num{font-size:22px;font-weight:800}
    .stat-lbl{font-size:9px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.3);margin-top:2px;letter-spacing:.3px}
    .stat-Recibido .stat-num{color:#3b82f6}
    .stat-Asignado .stat-num{color:#8b5cf6}
    .stat-EnProceso .stat-num{color:#f97316}
    .stat-Pendiente .stat-num{color:#f59e0b}
    .stat-Resuelto .stat-num{color:#22c55e}
    .stat-Cancelado .stat-num{color:#64748b}

    .admin-table{background:#15152a;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}
    .admin-thead{display:grid;grid-template-columns:110px 1fr 90px 130px 90px 130px 90px;gap:0;background:#1b1b32;border-bottom:1px solid rgba(255,255,255,.08);padding:9px 16px}
    .admin-th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:rgba(255,255,255,.3)}
    .admin-row{display:grid;grid-template-columns:110px 1fr 90px 130px 90px 130px 90px;gap:0;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.05);align-items:center}
    .admin-row:last-child{border-bottom:none}
    .admin-row:hover{background:rgba(255,255,255,.02)}

    .estado-select{background:#1b1b32;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer;outline:none;font-family:inherit;color:#e8edf5;width:100%}
    .estado-Recibido{background:rgba(59,130,246,.12)!important;color:#93c5fd!important;border-color:rgba(59,130,246,.3)!important}
    .estado-Asignado{background:rgba(139,92,246,.12)!important;color:#c4b5fd!important;border-color:rgba(139,92,246,.3)!important}
    .estado-EnProceso{background:rgba(249,115,22,.12)!important;color:#fdba74!important;border-color:rgba(249,115,22,.3)!important}
    .estado-Pendiente{background:rgba(245,158,11,.1)!important;color:#fde68a!important;border-color:rgba(245,158,11,.2)!important}
    .estado-Resuelto{background:rgba(34,197,94,.1)!important;color:#86efac!important;border-color:rgba(34,197,94,.2)!important}
    .estado-Cancelado{background:rgba(100,116,139,.1)!important;color:#94a3b8!important;border-color:rgba(100,116,139,.2)!important}

    .btn-ver{background:none;border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:4px 10px;font-size:10px;color:rgba(255,255,255,.5);cursor:pointer;font-family:inherit}
    .btn-ver:hover{border-color:#6366f1;color:#a5b4fc}

    /* ── LOGIN MODAL ────────────────────────────────── */
    .login-modal{background:#15152a;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:32px;max-width:360px;margin:60px auto;text-align:center}
    .login-icon{font-size:36px;margin-bottom:12px}
    .login-title{font-size:18px;font-weight:700;color:#e8edf5;margin-bottom:6px}
    .login-sub{font-size:13px;color:rgba(255,255,255,.4);margin-bottom:24px}
    .login-field{margin-bottom:12px;text-align:left}
    .login-field label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:5px;letter-spacing:.4px}
    .login-field input{width:100%;background:#1b1b32;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px 12px;font-size:14px;color:#e8edf5;font-family:inherit;outline:none}
    .login-field input:focus{border-color:rgba(99,102,241,.5);box-shadow:0 0 0 3px rgba(99,102,241,.12)}
    .btn-login{width:100%;background:#22c55e;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:4px}
    .btn-login:hover{background:#16a34a}
    .login-err{color:#fca5a5;font-size:12px;margin-top:8px;display:none}

    /* ── SUCCESS MODAL ──────────────────────────────── */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:1000;display:none}
    .modal-overlay.open{display:flex}
    .modal-box{background:#15152a;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:36px;max-width:400px;width:90%;text-align:center}
    .modal-icon{font-size:48px;margin-bottom:12px}
    .modal-title{font-size:20px;font-weight:800;color:#e8edf5;margin-bottom:8px}
    .modal-ticket{font-size:22px;font-weight:800;color:#22c55e;font-family:monospace;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);border-radius:8px;padding:10px 20px;display:inline-block;margin:12px 0}
    .modal-sub{font-size:13px;color:rgba(255,255,255,.45);margin-bottom:20px;line-height:1.5}
    .btn-modal-close{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}

    /* ── DETAIL MODAL ───────────────────────────────── */
    .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;text-align:left}
    .detail-field label{font-size:9px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.3);letter-spacing:.4px}
    .detail-field p{font-size:13px;color:#e8edf5;margin-top:3px}
    .detail-desc{text-align:left;margin-bottom:12px}
    .detail-desc label{font-size:9px;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.3);letter-spacing:.4px}
    .detail-desc p{font-size:13px;color:#e8edf5;margin-top:4px;line-height:1.6}
    .detail-fotos{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    .detail-fotos img{width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.1);cursor:pointer}

    /* ── EMPTY STATE ────────────────────────────────── */
    .empty{text-align:center;padding:48px 24px;color:rgba(255,255,255,.25)}
    .empty-icon{font-size:36px;margin-bottom:10px}
    .empty p{font-size:13px}

    @media(max-width:640px){
      .topbar{padding:10px 14px}
      .tab-panel{padding:14px}
      .field-row.cols-2,.field-row.cols-3{grid-template-columns:1fr}
      .tipos-grid{grid-template-columns:repeat(2,1fr)}
      .prior-grid{grid-template-columns:repeat(3,1fr)}
      .stats-grid{grid-template-columns:repeat(3,1fr)}
      .admin-thead,.admin-row{display:none}
      .req-card{grid-template-columns:1fr}
    }
  </style>
</head>
<body>

<!-- TOPBAR -->
<div class="topbar">
  <a href="/herramientas.html" class="topbar-left" style="text-decoration:none">
    <div class="topbar-logo">M</div>
    <div>
      <div class="topbar-name">Medivalle SF S.A.S</div>
      <div class="topbar-sub">Herramientas Internas</div>
    </div>
  </a>
  <div class="topbar-nav">
    <a href="/requerimientos.html" class="nav-link active">📋 Requerimientos</a>
    <a href="/medicalc.html" class="nav-link">🧮 MediCalc</a>
  </div>
</div>

<!-- TABS -->
<div class="page-tabs">
  <button class="tab-btn active" onclick="switchTab('form')">Nueva Solicitud</button>
  <button class="tab-btn" onclick="switchTab('lista')">Ver Solicitudes</button>
  <button class="tab-btn tab-admin" onclick="switchTab('admin')">
    🔐 Gestión <span class="tab-badge" id="badge-pendientes" style="display:none"></span>
  </button>
</div>

<!-- TAB: FORM -->
<div class="tab-panel active" id="panel-form">
  <div class="card">
    <div class="sec-title">Datos del solicitante</div>
    <div class="field-row cols-2">
      <div class="field">
        <label>Área <span class="req">*</span></label>
        <input id="f-area" type="text" placeholder="Ej: Gestión de Calidad, Sistemas...">
      </div>
      <div class="field">
        <label>Nombre completo <span class="req">*</span></label>
        <input id="f-nombre" type="text" placeholder="Nombre completo">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Correo / Extensión</label>
        <input id="f-correo" type="text" placeholder="correo@medivalle.co  ó  ext. 123">
      </div>
    </div>

    <div class="sec-title">Punto afectado</div>
    <div class="field">
      <label>Punto <span class="req">*</span></label>
      <div class="punto-wrap">
        <input id="f-punto" type="text" placeholder="Buscar farmacia o punto..." autocomplete="off"
               oninput="filtrarPuntos()" onfocus="filtrarPuntos()" onblur="setTimeout(()=>cerrarPuntos(),200)">
        <div class="punto-dropdown" id="punto-dropdown"></div>
      </div>
      <div class="hint">Escribe para filtrar · haz clic en el campo para ver la lista completa</div>
    </div>

    <div class="sec-title">Tipo de requerimiento <span style="color:#ef4444;font-size:10px">*</span></div>
    <div class="tipos-grid">
      <div class="tipo-btn" data-tipo="Locativo" onclick="selTipo(this)">
        <div class="tipo-icon">🏠</div><div class="tipo-name">Locativo</div><div class="tipo-sub">Infraestructura, electricidad</div>
      </div>
      <div class="tipo-btn" data-tipo="Sistemas" onclick="selTipo(this)">
        <div class="tipo-icon">💻</div><div class="tipo-name">Sistemas</div><div class="tipo-sub">Equipos, software, redes</div>
      </div>
      <div class="tipo-btn" data-tipo="Bodega" onclick="selTipo(this)">
        <div class="tipo-icon">📦</div><div class="tipo-name">Bodega</div><div class="tipo-sub">Materiales, insumos</div>
      </div>
      <div class="tipo-btn" data-tipo="Calidad" onclick="selTipo(this)">
        <div class="tipo-icon">📄</div><div class="tipo-name">Calidad</div><div class="tipo-sub">Documentos, formatos</div>
      </div>
      <div class="tipo-btn" data-tipo="Mantenimiento" onclick="selTipo(this)">
        <div class="tipo-icon">🔧</div><div class="tipo-name">Mantenimiento</div><div class="tipo-sub">Neveras, aires, equipos</div>
      </div>
      <div class="tipo-btn" data-tipo="Otro" onclick="selTipo(this)">
        <div class="tipo-icon">📋</div><div class="tipo-name">Otro</div><div class="tipo-sub">No clasificado</div>
      </div>
    </div>

    <div class="sec-title">Detalle del requerimiento</div>
    <div class="field" style="margin-bottom:12px">
      <label>Descripción <span class="req">*</span></label>
      <textarea id="f-desc" placeholder="Describe el problema, dónde ocurre, desde cuándo..."></textarea>
    </div>
    <div class="field-row cols-3">
      <div class="field">
        <label>Fecha requerida</label>
        <input id="f-fecha" type="date">
      </div>
      <div class="field">
        <label>Ticket relacionado</label>
        <input id="f-ticket-rel" type="text" placeholder="REQ-...">
      </div>
      <div class="field">
        <label>Observaciones</label>
        <input id="f-obs" type="text" placeholder="Notas adicionales">
      </div>
    </div>

    <div class="sec-title">Prioridad</div>
    <div class="prior-grid">
      <div class="prior-btn" data-prior="URGENTE" onclick="selPrior(this)">
        <div class="prior-emoji">🔴</div><div class="prior-name">URGENTE</div><div class="prior-sub">Afecta operación</div>
      </div>
      <div class="prior-btn" data-prior="ALTA" onclick="selPrior(this)">
        <div class="prior-emoji">🟠</div><div class="prior-name">ALTA</div><div class="prior-sub">En 48 horas</div>
      </div>
      <div class="prior-btn active" data-prior="NORMAL" onclick="selPrior(this)">
        <div class="prior-emoji">🟢</div><div class="prior-name">NORMAL</div><div class="prior-sub">Hasta 7 días</div>
      </div>
    </div>

    <div class="sec-title">Evidencia fotográfica (opcional)</div>
    <div class="foto-zone" id="foto-zone" onclick="document.getElementById('foto-input').click()"
         ondragover="event.preventDefault();this.classList.add('drag')"
         ondragleave="this.classList.remove('drag')"
         ondrop="handleDrop(event)">
      <div class="foto-zone-icon">📷</div>
      <div class="foto-zone-txt">Toca para adjuntar fotos de evidencia</div>
      <div class="foto-zone-sub">Máx 5 fotos · Se comprimen automáticamente</div>
    </div>
    <input type="file" id="foto-input" accept="image/*" multiple style="display:none" onchange="handleFotos(this.files)">
    <div class="foto-previews" id="foto-previews"></div>

    <button class="btn-submit" id="btn-submit" onclick="submitForm()">
      📤 Enviar solicitud
    </button>
  </div>
</div>

<!-- TAB: LISTA -->
<div class="tab-panel" id="panel-lista">
  <div class="filters-bar">
    <input class="filter-input" id="l-q" placeholder="🔍 Buscar por ticket, punto, descripción..." oninput="debounceList()">
    <select class="filter-select" id="l-tipo" onchange="loadLista()">
      <option value="">Todos los tipos</option>
      <option>Locativo</option><option>Sistemas</option><option>Bodega</option>
      <option>Calidad</option><option>Mantenimiento</option><option>Otro</option>
    </select>
    <select class="filter-select" id="l-estado" onchange="loadLista()">
      <option value="">Todos los estados</option>
      <option>Recibido</option><option>Asignado</option><option>En proceso</option>
      <option>Pendiente info</option><option>Resuelto</option><option>Cancelado</option>
    </select>
    <select class="filter-select" id="l-prior" onchange="loadLista()">
      <option value="">Todas las prioridades</option>
      <option value="URGENTE">🔴 Urgente</option>
      <option value="ALTA">🟠 Alta</option>
      <option value="NORMAL">🟢 Normal</option>
    </select>
    <button class="btn-clear" onclick="clearListFilters()">✕ Limpiar</button>
  </div>
  <div id="lista-container"></div>
  <div class="pagination" id="lista-pagination"></div>
</div>

<!-- TAB: ADMIN -->
<div class="tab-panel wide" id="panel-admin"></div>

<!-- SUCCESS MODAL -->
<div class="modal-overlay" id="modal-success">
  <div class="modal-box">
    <div class="modal-icon">✅</div>
    <div class="modal-title">¡Solicitud enviada!</div>
    <div class="modal-ticket" id="modal-ticket-num">REQ-000000-000</div>
    <div class="modal-sub">Guarda este número para hacer seguimiento. Se envió una notificación al equipo de gestión.</div>
    <button class="btn-modal-close" onclick="closeSuccess()">Aceptar</button>
  </div>
</div>

<!-- DETAIL MODAL -->
<div class="modal-overlay" id="modal-detail">
  <div class="modal-box" style="max-width:560px;text-align:left">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08)">
      <span id="detail-ticket" style="font-size:14px;font-weight:700;color:#6366f1;font-family:monospace"></span>
      <button onclick="document.getElementById('modal-detail').classList.remove('open')" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:18px">✕</button>
    </div>
    <div id="detail-body"></div>
  </div>
</div>

<script src="/js/requerimientos.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify page loads**

Open `http://localhost:3000/requerimientos.html` — should show topbar + 3 tabs + form with all fields. No JS errors in console (JS file not yet created — that's fine, script will 404 but page structure is correct).

- [ ] **Step 3: Commit**

```bash
git add public/requerimientos.html
git commit -m "feat(requerimientos): add requerimientos.html full HTML/CSS skeleton"
```

---

## Task 7: `requerimientos.js` — frontend logic

**Files:**
- Create: `public/js/requerimientos.js`

- [ ] **Step 1: Create requerimientos.js**

```js
// public/js/requerimientos.js
'use strict';

// ── State ────────────────────────────────────────────────────────────────
let puntos       = [];
let selectedTipo = '';
let selectedPrior = 'NORMAL';
let fotosRutas   = [];
let fotoFiles    = [];
let listPage     = 1;
let listDebounce = null;
let adminToken   = sessionStorage.getItem('req_admin_token') || null;

// ── Init ─────────────────────────────────────────────────────────────────
async function init() {
  await loadPuntos();
  loadPendientesBadge();
}

async function loadPuntos() {
  try {
    const r = await fetch('/api/req/puntos');
    puntos = await r.json();
  } catch { puntos = []; }
}

// ── Tab switching ────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btnMap = { form: 0, lista: 1, admin: 2 };
  document.querySelectorAll('.tab-btn')[btnMap[tab]].classList.add('active');
  document.getElementById(`panel-${tab}`).classList.add('active');
  if (tab === 'lista') { listPage = 1; loadLista(); }
  if (tab === 'admin') renderAdmin();
}

// ── Punto autocomplete ───────────────────────────────────────────────────
function filtrarPuntos() {
  const q = document.getElementById('f-punto').value.toLowerCase();
  const dd = document.getElementById('punto-dropdown');
  const filtered = q
    ? puntos.filter(p => p.nombre.toLowerCase().includes(q) || p.municipio.toLowerCase().includes(q))
    : puntos;
  if (!filtered.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = filtered.slice(0, 40).map(p =>
    `<div class="punto-item" onmousedown="selPunto('${p.nombre.replace(/'/g,"\\'")}')">
       ${p.nombre}<div class="punto-sub">${p.municipio}${p.departamento ? ' · '+p.departamento : ''}</div>
     </div>`
  ).join('');
  dd.classList.add('open');
}

function selPunto(nombre) {
  document.getElementById('f-punto').value = nombre;
  cerrarPuntos();
}

function cerrarPuntos() {
  document.getElementById('punto-dropdown').classList.remove('open');
}

// ── Tipo selection ───────────────────────────────────────────────────────
function selTipo(el) {
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedTipo = el.dataset.tipo;
}

// ── Prioridad selection ──────────────────────────────────────────────────
function selPrior(el) {
  document.querySelectorAll('.prior-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedPrior = el.dataset.prior;
}

// ── Photo handling ───────────────────────────────────────────────────────
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('foto-zone').classList.remove('drag');
  handleFotos(e.dataTransfer.files);
}

function handleFotos(files) {
  const remaining = 5 - fotoFiles.length;
  const toAdd = Array.from(files).slice(0, remaining);
  toAdd.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    fotoFiles.push(file);
    compressAndPreview(file);
  });
}

function compressAndPreview(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1200;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      addPreview(dataUrl, fotoFiles.length - 1);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function addPreview(dataUrl, idx) {
  const wrap = document.getElementById('foto-previews');
  const div  = document.createElement('div');
  div.className = 'foto-preview';
  div.dataset.idx = idx;
  div.innerHTML = `<img src="${dataUrl}"><button class="remove-foto" onclick="removeFoto(${idx})">✕</button>`;
  wrap.appendChild(div);
}

function removeFoto(idx) {
  fotoFiles.splice(idx, 1);
  document.querySelectorAll('.foto-preview').forEach(el => el.remove());
  const copy = [...fotoFiles];
  fotoFiles = [];
  copy.forEach(f => { fotoFiles.push(f); compressAndPreview(f); });
}

async function uploadFotos() {
  if (!fotoFiles.length) return [];
  const form = new FormData();
  for (const f of fotoFiles) {
    const blob = await fileToCompressedBlob(f);
    form.append('fotos', blob, f.name);
  }
  const r = await fetch('/api/req/upload-foto', { method: 'POST', body: form });
  const data = await r.json();
  return data.rutas || [];
}

function fileToCompressedBlob(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.7);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Form submit ──────────────────────────────────────────────────────────
async function submitForm() {
  const area  = document.getElementById('f-area').value.trim();
  const nombre= document.getElementById('f-nombre').value.trim();
  const punto = document.getElementById('f-punto').value.trim();
  const desc  = document.getElementById('f-desc').value.trim();

  if (!area || !nombre || !punto || !selectedTipo || !desc) {
    alert('Por favor completa todos los campos obligatorios (Área, Nombre, Punto, Tipo y Descripción).');
    return;
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.innerHTML = '⏳ Enviando...';

  try {
    const fotos = await uploadFotos();
    const body  = {
      area, nombre,
      correo:             document.getElementById('f-correo').value.trim(),
      punto,
      tipo:               selectedTipo,
      descripcion:        desc,
      fecha_requerida:    document.getElementById('f-fecha').value,
      ticket_relacionado: document.getElementById('f-ticket-rel').value.trim(),
      observaciones:      document.getElementById('f-obs').value.trim(),
      prioridad:          selectedPrior,
      fotos,
    };
    const r    = await fetch('/api/req', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error al enviar');

    document.getElementById('modal-ticket-num').textContent = data.ticket_num;
    document.getElementById('modal-success').classList.add('open');
    resetForm();
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📤 Enviar solicitud';
  }
}

function resetForm() {
  ['f-area','f-nombre','f-correo','f-punto','f-desc','f-fecha','f-ticket-rel','f-obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  selectedTipo  = '';
  selectedPrior = 'NORMAL';
  fotoFiles     = [];
  fotosRutas    = [];
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.prior-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.prior-btn[data-prior="NORMAL"]').classList.add('active');
  document.getElementById('foto-previews').innerHTML = '';
}

function closeSuccess() {
  document.getElementById('modal-success').classList.remove('open');
}

// ── List view ────────────────────────────────────────────────────────────
function debounceList() {
  clearTimeout(listDebounce);
  listDebounce = setTimeout(() => { listPage = 1; loadLista(); }, 350);
}

function clearListFilters() {
  ['l-q','l-tipo','l-estado','l-prior'].forEach(id => { document.getElementById(id).value = ''; });
  listPage = 1;
  loadLista();
}

async function loadLista() {
  const q      = document.getElementById('l-q').value;
  const tipo   = document.getElementById('l-tipo').value;
  const estado = document.getElementById('l-estado').value;
  const prior  = document.getElementById('l-prior').value;
  const params = new URLSearchParams({ page: listPage });
  if (q)      params.set('q', q);
  if (tipo)   params.set('tipo', tipo);
  if (estado) params.set('estado', estado);
  if (prior)  params.set('prioridad', prior);

  const container = document.getElementById('lista-container');
  container.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><p>Cargando...</p></div>';

  try {
    const r    = await fetch('/api/req?' + params);
    const data = await r.json();

    if (!data.rows.length) {
      container.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>No hay requerimientos con esos filtros.</p></div>';
      document.getElementById('lista-pagination').innerHTML = '';
      return;
    }

    container.innerHTML = data.rows.map(req => `
      <div class="req-card" onclick="showDetail(${req.id})">
        <div>
          <div class="req-ticket">${req.ticket_num}</div>
          <div class="req-date">${fmtDate(req.created_at)}</div>
        </div>
        <div>
          <div class="req-nombre">${esc(req.nombre)} · ${esc(req.area)}</div>
          <div class="req-desc">${esc(req.descripcion)}</div>
          <div class="req-punto">📍 ${esc(req.punto)}</div>
          <div class="chips">
            <span class="chip chip-tipo">${esc(req.tipo)}</span>
            <span class="chip chip-prior-${req.prioridad}">${req.prioridad}</span>
            <span class="chip chip-estado-${req.estado}">${esc(req.estado)}</span>
          </div>
        </div>
        <div style="font-size:20px;cursor:pointer">›</div>
      </div>
    `).join('');

    renderPagination(data.page, data.pages);
  } catch {
    container.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>Error al cargar.</p></div>';
  }
}

function renderPagination(page, pages) {
  const el = document.getElementById('lista-pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="page-btn" onclick="goPage(${page-1})" ${page<=1?'disabled':''}>← Anterior</button>
    <span>Página ${page} de ${pages}</span>
    <button class="page-btn" onclick="goPage(${page+1})" ${page>=pages?'disabled':''}>Siguiente →</button>
  `;
}

function goPage(p) { listPage = p; loadLista(); window.scrollTo(0,0); }

// ── Detail modal ─────────────────────────────────────────────────────────
async function showDetail(id) {
  const r   = await fetch(`/api/req/${id}`);
  const req = await r.json();
  document.getElementById('detail-ticket').textContent = req.ticket_num;
  const fotos = JSON.parse(req.fotos || '[]');
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-field"><label>Área</label><p>${esc(req.area)}</p></div>
      <div class="detail-field"><label>Nombre</label><p>${esc(req.nombre)}</p></div>
      <div class="detail-field"><label>Correo / Ext.</label><p>${esc(req.correo||'—')}</p></div>
      <div class="detail-field"><label>Punto</label><p>${esc(req.punto)}</p></div>
      <div class="detail-field"><label>Tipo</label><p>${esc(req.tipo)}</p></div>
      <div class="detail-field"><label>Prioridad</label><p>${req.prioridad}</p></div>
      <div class="detail-field"><label>Estado</label><p>${esc(req.estado)}</p></div>
      <div class="detail-field"><label>Fecha requerida</label><p>${req.fecha_requerida||'—'}</p></div>
    </div>
    <div class="detail-desc"><label>Descripción</label><p>${esc(req.descripcion)}</p></div>
    ${req.observaciones ? `<div class="detail-desc"><label>Observaciones</label><p>${esc(req.observaciones)}</p></div>` : ''}
    ${fotos.length ? `<div class="detail-desc"><label>Fotos</label><div class="detail-fotos">${fotos.map(f=>`<img src="${f}" onclick="window.open('${f}')">`).join('')}</div></div>` : ''}
    <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:12px">Creado: ${fmtDate(req.created_at)}</div>
  `;
  document.getElementById('modal-detail').classList.add('open');
}

// ── Admin ─────────────────────────────────────────────────────────────────
function renderAdmin() {
  const panel = document.getElementById('panel-admin');
  if (!adminToken) {
    panel.innerHTML = `
      <div class="login-modal">
        <div class="login-icon">🔐</div>
        <div class="login-title">Acceso de Gestión</div>
        <div class="login-sub">Ingresa tus credenciales para administrar los requerimientos</div>
        <div class="login-field"><label>Usuario</label><input id="admin-user" type="text" placeholder="Usuario" onkeydown="if(event.key==='Enter')doLogin()"></div>
        <div class="login-field"><label>Contraseña</label><input id="admin-pass" type="password" placeholder="Contraseña" onkeydown="if(event.key==='Enter')doLogin()"></div>
        <button class="btn-login" onclick="doLogin()">Ingresar</button>
        <div class="login-err" id="login-err">Credenciales incorrectas.</div>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <div class="admin-banner">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="admin-avatar">G</div>
        <div><div class="admin-name">GESTION</div><div class="admin-role">Administrador de Requerimientos · Sesión activa</div></div>
      </div>
      <button class="btn-logout" onclick="doLogout()">Cerrar sesión</button>
    </div>
    <div class="stats-grid" id="admin-stats"></div>
    <div class="filters-bar">
      <input class="filter-input" id="a-q" placeholder="🔍 Buscar..." oninput="debounceAdmin()">
      <select class="filter-select" id="a-tipo" onchange="loadAdmin()">
        <option value="">Todos los tipos</option>
        <option>Locativo</option><option>Sistemas</option><option>Bodega</option>
        <option>Calidad</option><option>Mantenimiento</option><option>Otro</option>
      </select>
      <select class="filter-select" id="a-estado" onchange="loadAdmin()">
        <option value="">Todos los estados</option>
        <option>Recibido</option><option>Asignado</option><option>En proceso</option>
        <option>Pendiente info</option><option>Resuelto</option><option>Cancelado</option>
      </select>
      <select class="filter-select" id="a-prior" onchange="loadAdmin()">
        <option value="">Todas las prioridades</option>
        <option value="URGENTE">🔴 Urgente</option>
        <option value="ALTA">🟠 Alta</option>
        <option value="NORMAL">🟢 Normal</option>
      </select>
      <button class="btn-clear" onclick="clearAdminFilters()">✕ Limpiar</button>
    </div>
    <div class="admin-table">
      <div class="admin-thead">
        <div class="admin-th">Ticket</div>
        <div class="admin-th">Solicitante / Desc.</div>
        <div class="admin-th">Tipo</div>
        <div class="admin-th">Punto</div>
        <div class="admin-th">Prioridad</div>
        <div class="admin-th">Estado</div>
        <div class="admin-th">Acción</div>
      </div>
      <div id="admin-rows"></div>
    </div>
    <div class="pagination" id="admin-pagination"></div>
  `;
  loadAdminStats();
  loadAdmin();
}

let adminPage     = 1;
let adminDebounce = null;

function debounceAdmin() {
  clearTimeout(adminDebounce);
  adminDebounce = setTimeout(() => { adminPage = 1; loadAdmin(); }, 350);
}

function clearAdminFilters() {
  ['a-q','a-tipo','a-estado','a-prior'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  adminPage = 1;
  loadAdmin();
}

async function loadAdminStats() {
  const states = ['Recibido','Asignado','En proceso','Pendiente info','Resuelto','Cancelado'];
  const keys   = ['Recibido','Asignado','EnProceso','Pendiente','Resuelto','Cancelado'];
  try {
    const results = await Promise.all(
      states.map(s => fetch(`/api/req?estado=${encodeURIComponent(s)}&page=1`).then(r=>r.json()))
    );
    const el = document.getElementById('admin-stats');
    if (!el) return;
    el.innerHTML = states.map((s,i) =>
      `<div class="stat-card stat-${keys[i]}"><div class="stat-num">${results[i].total}</div><div class="stat-lbl">${s}</div></div>`
    ).join('');
  } catch {}
}

async function loadAdmin() {
  const qEl      = document.getElementById('a-q');
  const tipoEl   = document.getElementById('a-tipo');
  const estadoEl = document.getElementById('a-estado');
  const priorEl  = document.getElementById('a-prior');
  if (!qEl) return;
  const params = new URLSearchParams({ page: adminPage });
  if (qEl.value)      params.set('q', qEl.value);
  if (tipoEl.value)   params.set('tipo', tipoEl.value);
  if (estadoEl.value) params.set('estado', estadoEl.value);
  if (priorEl.value)  params.set('prioridad', priorEl.value);

  try {
    const r    = await fetch('/api/req?' + params);
    const data = await r.json();
    const cont = document.getElementById('admin-rows');
    if (!cont) return;

    if (!data.rows.length) {
      cont.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>Sin resultados.</p></div>';
      document.getElementById('admin-pagination').innerHTML = '';
      return;
    }

    cont.innerHTML = data.rows.map(req => {
      const estadoClass = req.estado.replace(' ','');
      return `
        <div class="admin-row">
          <div>
            <div style="font-size:11px;font-weight:700;color:#6366f1;font-family:monospace">${req.ticket_num}</div>
            <div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:2px">${fmtDate(req.created_at)}</div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:#e8edf5">${esc(req.nombre)} · ${esc(req.area)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${esc(req.descripcion)}</div>
          </div>
          <div><span class="chip chip-tipo" style="font-size:9px">${esc(req.tipo)}</span></div>
          <div style="font-size:11px;color:rgba(255,255,255,.5)">${esc(req.punto)}</div>
          <div><span class="chip chip-prior-${req.prioridad}" style="font-size:9px">${req.prioridad}</span></div>
          <div>
            <select class="estado-select estado-${estadoClass}" onchange="updateEstado(${req.id},this)">
              ${['Recibido','Asignado','En proceso','Pendiente info','Resuelto','Cancelado'].map(s=>
                `<option${s===req.estado?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div><button class="btn-ver" onclick="showDetail(${req.id})">Ver</button></div>
        </div>`;
    }).join('');

    const pag = document.getElementById('admin-pagination');
    if (pag && data.pages > 1) {
      pag.innerHTML = `
        <button class="page-btn" onclick="goAdminPage(${data.page-1})" ${data.page<=1?'disabled':''}>← Anterior</button>
        <span>Página ${data.page} de ${data.pages}</span>
        <button class="page-btn" onclick="goAdminPage(${data.page+1})" ${data.page>=data.pages?'disabled':''}>Siguiente →</button>`;
    } else if (pag) pag.innerHTML = '';
  } catch (e) { console.error(e); }
}

function goAdminPage(p) { adminPage = p; loadAdmin(); window.scrollTo(0,0); }

async function updateEstado(id, selectEl) {
  const estado = selectEl.value;
  const estadoClass = estado.replace(' ','');
  selectEl.className = `estado-select estado-${estadoClass}`;
  try {
    const r = await fetch(`/api/req/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ estado }),
    });
    if (r.status === 401) { adminToken = null; sessionStorage.removeItem('req_admin_token'); renderAdmin(); return; }
    if (!r.ok) throw new Error();
    loadAdminStats();
    loadPendientesBadge();
  } catch { alert('Error al actualizar el estado.'); }
}

async function doLogin() {
  const usuario  = document.getElementById('admin-user').value;
  const password = document.getElementById('admin-pass').value;
  const errEl    = document.getElementById('login-err');
  errEl.style.display = 'none';
  try {
    const r    = await fetch('/api/req/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, password }) });
    const data = await r.json();
    if (!r.ok) { errEl.style.display = 'block'; return; }
    adminToken = data.token;
    sessionStorage.setItem('req_admin_token', adminToken);
    renderAdmin();
  } catch { errEl.style.display = 'block'; }
}

function doLogout() {
  adminToken = null;
  sessionStorage.removeItem('req_admin_token');
  renderAdmin();
}

// ── Badge ─────────────────────────────────────────────────────────────────
async function loadPendientesBadge() {
  try {
    const r    = await fetch('/api/req?estado=Recibido&page=1');
    const data = await r.json();
    const badge = document.getElementById('badge-pendientes');
    if (data.total > 0) { badge.textContent = data.total; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt.replace(' ','T'));
  return isNaN(d) ? dt : d.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// Close detail modal on overlay click
document.getElementById('modal-detail').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('open');
});

init();
```

- [ ] **Step 2: Verify full flow in browser**

1. Open `http://localhost:3000/requerimientos.html`
2. Fill form: Área="Sistemas", Nombre="Test User", Punto=(write any text), click "Sistemas" tipo, write description, click Submit
3. Modal should appear with ticket number (e.g. `REQ-202606-002`)
4. Click "Ver Solicitudes" — ticket should appear in list
5. Click "Gestión" → login with GESTION / GST123 → admin panel shows
6. Change estado of the ticket to "En proceso" → select color changes

- [ ] **Step 3: Commit**

```bash
git add public/js/requerimientos.js
git commit -m "feat(requerimientos): add full frontend logic (form, list, admin, auth)"
```

---

## Task 8: Link from settings + final wiring

**Files:**
- Modify: `public/js/settings.js` (update Herramientas Externas card)

- [ ] **Step 1: Update settings card to link to portal**

In `public/js/settings.js`, find the "Herramientas Externas" card and update the link from `/medicalc.html` to `/herramientas.html`:

Find:
```js
          <a href="/medicalc.html" target="_blank" class="btn btn-secondary btn-small" style="white-space:nowrap;text-decoration:none;">Abrir →</a>
```

Replace with:
```js
          <a href="/herramientas.html" target="_blank" class="btn btn-secondary btn-small" style="white-space:nowrap;text-decoration:none;">Abrir portal →</a>
```

- [ ] **Step 2: Final end-to-end smoke test**

```bash
# 1. Server running
curl -s http://localhost:3000/herramientas.html | grep -c "Herramientas Medivalle"
# Expected: 1

# 2. Create req
curl -s -X POST http://localhost:3000/api/req \
  -H "Content-Type: application/json" \
  -d '{"area":"Calidad","nombre":"VANESA","correo":"gestiondecalidad@medivalle.co","punto":"Oficina Principal Cali","tipo":"Calidad","descripcion":"HUMEDAD EN OFICINA ADMINISTRATIVA","observaciones":"prueba","prioridad":"URGENTE"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).ticket_num))"
# Expected: REQ-202606-003 (or next sequential)

# 3. Login + update estado
TOKEN=$(curl -s -X POST http://localhost:3000/api/req/admin/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"GESTION","password":"GST123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
echo "Token: $TOKEN"

# 4. Update estado (use id=1 or the id returned)
curl -s -X PUT http://localhost:3000/api/req/1/estado \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"estado":"En proceso"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(d))"
# Expected: {"ok":true}
```

- [ ] **Step 3: Final commit**

```bash
git add public/js/settings.js
git commit -m "feat(requerimientos): update settings portal link, complete system"
```

---

## Self-review checklist

- [x] **DB migration** — Task 1 adds table via existing migrations array pattern ✓
- [x] **6 API endpoints** — All in Task 3: GET puntos, POST upload, POST req, GET req, GET req/:id, POST admin/login, PUT :id/estado ✓
- [x] **Email** — Task 2 email-service.js with exact format from spec ✓
- [x] **Photo upload** — multer in req-routes.js + canvas compression in JS ✓
- [x] **Admin HMAC auth** — makeToken/verifyAdminToken in req-routes.js, no extra packages ✓
- [x] **3 tabs** — form, lista, admin all in requerimientos.html + requerimientos.js ✓
- [x] **Punto autocomplete** — filtrarPuntos() with dropdown ✓
- [x] **6 estados** — Recibido, Asignado, En proceso, Pendiente info, Resuelto, Cancelado ✓
- [x] **Portal herramientas.html** — Task 4 ✓
- [x] **medicalc topbar update** — Task 5 ✓
- [x] **server.js wiring** — in Task 3 step 2 ✓
- [x] **Env vars** — .env.example updated in Task 1 ✓
- [x] **Puntos fallback** — returns [] if GOOGLE_SHEETS_CSV_URL not set ✓
- [x] **Email non-blocking** — .catch() in POST /api/req ✓
- [x] **Settings link to portal** — Task 8 ✓
