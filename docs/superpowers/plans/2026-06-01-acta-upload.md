# Subida de Acta Firmada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el receptor de un acta la suba firmada vía link/QR único, almacenarla en disco, y visualizarla desde el panel IT en los módulos de despachos y tech-requests.

**Architecture:** Tabla central `acta_uploads` con token UUID por documento. API en `src/actas/actas-routes.js` con 6 endpoints (token, status, upload con multer, download, QR, info). Página pública `/firmar/:token` sin login. Integración en los paneles de despachos (`despacho.js`) y tech-requests (`tech-request-detail.js`).

**Tech Stack:** Node.js ESM, `node:sqlite` (DatabaseSync), Express, `multer` (nuevo), `qrcode` (ya instalado), vanilla JS

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `src/config/database.js` | Modificar — migración `acta_uploads` |
| `src/actas/actas-routes.js` | Crear — 6 endpoints API |
| `server.js` | Modificar — montar router + ruta `/firmar/:token` |
| `public/firmar.html` | Crear — página pública receptores |
| `public/js/firmar.js` | Crear — lógica de la página de subida |
| `public/js/despacho.js` | Modificar — link de firma en modal detalle |
| `public/js/tech-request-detail.js` | Modificar — link de firma tras generar acta |
| `uploads/actas-firmadas/` | Existe — directorio de archivos subidos |

---

## Task 1: multer + migración + estructura

**Files:**
- Modify: `src/config/database.js`

- [ ] **Step 1: Instalar multer**

```bash
cd "C:\Users\equipo sitemas 1\.gemini\antigravity\scratch\it-tickets"
npm install multer
```

Esperado: `added N packages` sin errores.

- [ ] **Step 2: Agregar migración al array `migrations` en `database.js`**

Abrir `src/config/database.js`. Al final del array `migrations` (antes del `];`), agregar:

```js
  `CREATE TABLE IF NOT EXISTS acta_uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('tech_request','despacho')),
    entity_id   INTEGER NOT NULL,
    entity_ref  TEXT NOT NULL,
    filename    TEXT,
    filepath    TEXT,
    uploaded_at TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_acta_uploads_entity
   ON acta_uploads(entity_type, entity_id)`,
```

- [ ] **Step 3: Verificar sintaxis**

```bash
node --check server.js
```

Esperado: sin output.

- [ ] **Step 4: Commit**

```bash
git add src/config/database.js package.json package-lock.json
git commit -m "feat: instalar multer y migración tabla acta_uploads"
```

---

## Task 2: src/actas/actas-routes.js

**Files:**
- Create: `src/actas/actas-routes.js`

- [ ] **Step 1: Crear el directorio y archivo**

Crear `src/actas/actas-routes.js` con el siguiente contenido:

```js
import express    from 'express';
import multer     from 'multer';
import path       from 'path';
import fs         from 'fs';
import crypto     from 'crypto';
import QRCode     from 'qrcode';
import { fileURLToPath } from 'url';
import db         from '../config/database.js';

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

/* ── POST /api/actas/token
   Genera o regenera el token de subida para un documento.
   Body: { entity_type, entity_id, entity_ref } ── */
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
      // Borrar archivo previo si existe
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

    const url = `${req.protocol}://${req.headers.host}/firmar/${token}`;
    res.json({ token, url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/actas/status/:token
   Público — consultado por firmar.html al cargar ── */
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

/* ── POST /api/actas/upload/:token
   Público — sube el archivo firmado ── */
router.post('/api/actas/upload/:token', (req, res, next) => {
  // Verificar token antes de aceptar el archivo
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
  // Multer error handler
  if (err) return res.status(400).json({ error: err.message });
});

/* ── GET /api/actas/download/:token
   Panel IT — descarga el archivo firmado ── */
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

/* ── GET /api/actas/qr/:token
   Panel IT — devuelve imagen PNG del QR ── */
router.get('/api/actas/qr/:token', async (req, res) => {
  try {
    const row = db.prepare('SELECT token FROM acta_uploads WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Token no encontrado.' });

    const url = `${req.protocol}://${req.headers.host}/firmar/${req.params.token}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 200, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/actas/info/:entityType/:entityId
   Panel IT — estado del token para un documento ── */
router.get('/api/actas/info/:entityType/:entityId', (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const row = db.prepare(
      'SELECT * FROM acta_uploads WHERE entity_type = ? AND entity_id = ?'
    ).get(entityType, Number(entityId));

    if (!row) return res.json({ token: null });

    const url = `${req.protocol}://${req.headers.host}/firmar/${row.token}`;
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
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node --check server.js
```

Si hay error de importación de multer, verificar que `npm install multer` se ejecutó en el Task 1.

- [ ] **Step 3: Commit**

```bash
git add src/actas/actas-routes.js
git commit -m "feat: actas-routes — token, status, upload, download, QR, info"
```

---

## Task 3: server.js — montar router + ruta /firmar/:token

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Agregar import del router**

Abrir `server.js`. Después de la línea `import farmaciasRouter from './src/farmacias/farmacias-routes.js';` agregar:

```js
import actasRouter    from './src/actas/actas-routes.js';
```

- [ ] **Step 2: Montar el router**

Después de `app.use(farmaciasRouter);` agregar:

```js
app.use(actasRouter);
```

- [ ] **Step 3: Agregar ruta catch para /firmar/:token**

Esta ruta sirve `firmar.html` para cualquier token. Debe ir DESPUÉS de `app.use(express.static(...))` y DESPUÉS de `app.use(actasRouter)`:

```js
// Página pública de subida de acta firmada
app.get('/firmar/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'firmar.html'));
});
```

- [ ] **Step 4: Verificar arranque del servidor**

```bash
node --check server.js
```

Esperado: sin output.

- [ ] **Step 5: Probar el endpoint de token con curl**

```bash
node server.js &
sleep 2
curl -s -X POST http://localhost:3000/api/actas/token \
  -H "Content-Type: application/json" \
  -d '{"entity_type":"despacho","entity_id":1,"entity_ref":"DES-20260601-001"}'
kill %1
```

Esperado: `{"token":"uuid-aqui","url":"http://localhost:3000/firmar/uuid-aqui"}`

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat: montar actasRouter y ruta /firmar/:token en server.js"
```

---

## Task 4: public/firmar.html + public/js/firmar.js

**Files:**
- Create: `public/firmar.html`
- Create: `public/js/firmar.js`

- [ ] **Step 1: Crear public/firmar.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subir Acta Firmada — Mi Farmacia IT</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a; color: #e2e8f0;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .card {
      background: #1e293b; border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px; padding: 32px 28px; max-width: 420px; width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,.5);
    }
    .logo {
      display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
    }
    .logo-icon {
      width: 40px; height: 40px; background: #6366f1; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .logo-text h1 { font-size: 16px; font-weight: 700; color: #e2e8f0; }
    .logo-text p  { font-size: 12px; color: #64748b; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .ref  { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 8px; }
    .file-zone {
      border: 2px dashed rgba(255,255,255,.12); border-radius: 10px;
      padding: 28px 20px; text-align: center; cursor: pointer;
      transition: border-color .2s, background .2s; margin-bottom: 16px;
    }
    .file-zone:hover, .file-zone.drag-over {
      border-color: #6366f1; background: rgba(99,102,241,.06);
    }
    .file-zone .icon { font-size: 28px; margin-bottom: 8px; }
    .file-zone p { font-size: 13px; color: #64748b; }
    .file-zone .file-name { font-size: 13px; color: #6366f1; font-weight: 500; margin-top: 6px; }
    #file-input { display: none; }
    .btn {
      width: 100%; padding: 12px; border: none; border-radius: 9px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s;
    }
    .btn-primary { background: #6366f1; color: #fff; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { background: #334155; color: #64748b; cursor: not-allowed; }
    .hint { font-size: 11px; color: #475569; text-align: center; margin-top: 12px; }
    .state-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
    .state-title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 8px; }
    .state-msg   { font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.6; }
    .spinner {
      width: 32px; height: 32px; border: 3px solid rgba(99,102,241,.2);
      border-top-color: #6366f1; border-radius: 50%;
      animation: spin .8s linear infinite; margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #state-loading, #state-ready, #state-success, #state-already, #state-invalid {
      display: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">💊</div>
      <div class="logo-text">
        <h1>Mi Farmacia IT</h1>
        <p>Sistema de Soporte</p>
      </div>
    </div>

    <!-- Estado: cargando -->
    <div id="state-loading">
      <div class="spinner"></div>
      <p style="text-align:center;color:#64748b;font-size:13px;">Verificando enlace…</p>
    </div>

    <!-- Estado: listo para subir -->
    <div id="state-ready">
      <h2>Acta de Entrega</h2>
      <p class="ref" id="entity-ref"></p>
      <label>Sube el acta firmada:</label>
      <div class="file-zone" id="file-zone">
        <div class="icon">📄</div>
        <p>Toca aquí o arrastra el archivo</p>
        <p class="file-name" id="file-name-display" style="display:none;"></p>
      </div>
      <input type="file" id="file-input" accept=".pdf,.docx">
      <button class="btn btn-primary" id="btn-upload" disabled>Subir acta firmada</button>
      <p class="hint">Formatos aceptados: PDF, DOCX &nbsp;·&nbsp; Máx. 10 MB</p>
    </div>

    <!-- Estado: subida exitosa -->
    <div id="state-success">
      <div class="state-icon">✅</div>
      <div class="state-title">¡Acta recibida!</div>
      <p class="state-msg">El equipo de IT ya recibió tu acta firmada.<br>Puedes cerrar esta ventana.</p>
    </div>

    <!-- Estado: ya subida -->
    <div id="state-already">
      <div class="state-icon">✅</div>
      <div class="state-title">Acta ya entregada</div>
      <p class="state-msg" id="already-msg"></p>
    </div>

    <!-- Estado: token inválido -->
    <div id="state-invalid">
      <div class="state-icon">❌</div>
      <div class="state-title">Enlace no válido</div>
      <p class="state-msg">Este enlace no existe o ya no es válido.<br>Contacta al equipo de IT.</p>
    </div>
  </div>

  <script src="js/firmar.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear public/js/firmar.js**

```js
const token = window.location.pathname.split('/firmar/')[1]?.trim();

function show(stateId) {
  ['state-loading','state-ready','state-success','state-already','state-invalid']
    .forEach(id => {
      document.getElementById(id).style.display = id === stateId ? 'block' : 'none';
    });
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) +
    ' a las ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}

async function init() {
  if (!token) { show('state-invalid'); return; }
  show('state-loading');

  try {
    const res  = await fetch(`/api/actas/status/${token}`);
    const data = await res.json();

    if (!data.valid) { show('state-invalid'); return; }

    if (data.uploaded) {
      document.getElementById('already-msg').textContent =
        `Ya recibimos tu acta firmada el ${formatDate(data.uploaded_at)}. Si hay un error, contacta a IT.`;
      show('state-already');
      return;
    }

    document.getElementById('entity-ref').textContent = data.entity_ref || '';
    show('state-ready');
    setupUpload();

  } catch {
    show('state-invalid');
  }
}

function setupUpload() {
  const fileInput      = document.getElementById('file-input');
  const fileZone       = document.getElementById('file-zone');
  const fileNameDisplay = document.getElementById('file-name-display');
  const btnUpload      = document.getElementById('btn-upload');
  let   selectedFile   = null;

  // Click en zona
  fileZone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  fileZone.addEventListener('dragover', e => { e.preventDefault(); fileZone.classList.add('drag-over'); });
  fileZone.addEventListener('dragleave', () => fileZone.classList.remove('drag-over'));
  fileZone.addEventListener('drop', e => {
    e.preventDefault();
    fileZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  // Selección normal
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf','docx'].includes(ext)) {
      alert('Solo se aceptan archivos PDF o DOCX.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite de 10 MB.');
      return;
    }
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileNameDisplay.style.display = 'block';
    btnUpload.disabled = false;
  }

  btnUpload.addEventListener('click', async () => {
    if (!selectedFile) return;
    btnUpload.disabled = true;
    btnUpload.textContent = 'Subiendo…';

    const fd = new FormData();
    fd.append('acta', selectedFile);

    try {
      const res  = await fetch(`/api/actas/upload/${token}`, { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Error al subir el archivo.');
        btnUpload.disabled = false;
        btnUpload.textContent = 'Subir acta firmada';
        return;
      }
      show('state-success');
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
      btnUpload.disabled = false;
      btnUpload.textContent = 'Subir acta firmada';
    }
  });
}

init();
```

- [ ] **Step 3: Verificar en el navegador**

Con el servidor corriendo (`node server.js`), abrir `http://localhost:3000/firmar/token-invalido`. Debe mostrar el estado "❌ Enlace no válido".

- [ ] **Step 4: Commit**

```bash
git add public/firmar.html public/js/firmar.js
git commit -m "feat: página pública firmar.html para subida de acta firmada"
```

---

## Task 5: despacho.js — link de firma en modal de detalle

**Files:**
- Modify: `public/js/despacho.js`

Leer el archivo completo antes de editar.

- [ ] **Step 1: Agregar función `fetchActaInfo` al módulo**

Después de `async function updateDespacho(id, data) { ... }` (bloque de API calls), agregar:

```js
async function fetchActaInfo(entityType, entityId) {
  try {
    const res = await fetch(`/api/actas/info/${entityType}/${entityId}`);
    if (!res.ok) return { token: null };
    return res.json();
  } catch { return { token: null }; }
}
```

- [ ] **Step 2: Modificar `openDetailModal` para obtener actaInfo**

Dentro de `openDetailModal`, el callback `.then(d => { ... })` debe convertirse en `async` y obtener actaInfo en paralelo. Cambiar:

```js
  fetchDespacho(id).then(d => {
    const body = overlay.querySelector('#modal-body');
    body.innerHTML = `...${renderActaSection(d)}...`;
    // ...
    setupActaInteraction(body, d, overlay);
  }).catch(e => {
```

Por:

```js
  fetchDespacho(id).then(async d => {
    const actaInfo = await fetchActaInfo('despacho', d.id);
    const body = overlay.querySelector('#modal-body');
    body.innerHTML = `...${renderActaSection(d, actaInfo)}...`;
    // ...
    setupActaInteraction(body, d, actaInfo, overlay);
  }).catch(e => {
```

- [ ] **Step 3: Modificar `renderActaSection(d, actaInfo)` para mostrar estado del link**

Reemplazar la función completa:

```js
function renderActaSection(d, actaInfo = { token: null }) {
  if (!d.requiere_acta) {
    return `<div style="display:flex;align-items:center;gap:8px;">${actaBadge(d)}<span style="font-size:12px;color:var(--text-3);">Este despacho no requiere acta de entrega.</span></div>`;
  }

  // Sección de archivo firmado
  let firmaSection = '';
  if (actaInfo.token && actaInfo.uploaded) {
    firmaSection = `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#d1fae5;border-radius:8px;border:1px solid #6ee7b7;margin-bottom:10px;">
        <span style="font-size:18px;">✅</span>
        <div style="flex:1;">
          <div style="font-weight:600;color:#065f46;font-size:13px;">Acta firmada recibida</div>
          <div style="font-size:12px;color:#047857;">${actaInfo.uploaded_at ? new Date(actaInfo.uploaded_at).toLocaleString('es-CO') : ''}</div>
        </div>
        <a id="btn-download-acta" style="padding:6px 12px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;">📥 Descargar</a>
      </div>`;
  } else if (actaInfo.token && !actaInfo.uploaded) {
    firmaSection = `
      <div style="padding:10px 14px;background:var(--surface-3);border-radius:8px;border:1px solid var(--border);margin-bottom:10px;">
        <div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:8px;">🔗 Link de firma activo — pendiente de subida</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
          <input id="link-firma-input" type="text" readonly value="${actaInfo.url || ''}"
            style="flex:1;padding:6px 9px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px;font-family:monospace;">
          <button id="btn-copy-link" style="padding:6px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--text-2);font-size:11px;cursor:pointer;white-space:nowrap;">📋 Copiar</button>
        </div>
        <img id="qr-img" src="/api/actas/qr/${actaInfo.token}" alt="QR" style="width:100px;height:100px;border-radius:6px;background:#fff;padding:4px;display:block;margin-bottom:8px;">
        <button id="btn-regen-link" style="font-size:11px;color:var(--text-3);background:none;border:none;cursor:pointer;text-decoration:underline;">🔄 Regenerar link</button>
      </div>`;
  } else {
    firmaSection = `
      <div style="margin-bottom:10px;">
        <button id="btn-get-link" class="btn btn-secondary" style="font-size:12px;padding:7px 14px;">🔗 Obtener link de firma</button>
      </div>`;
  }

  if (d.acta_firmada) {
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#d1fae5;border-radius:8px;border:1px solid #6ee7b7;">
        <span style="font-size:18px;">✓</span>
        <div>
          <div style="font-weight:600;color:#065f46;font-size:13px;">Acta marcada como firmada</div>
          ${d.acta_numero ? `<div style="font-size:12px;color:#047857;">N° ${d.acta_numero}</div>` : ''}
        </div>
      </div>
      ${firmaSection}`;
  }

  return `
    <div style="padding:12px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">${actaBadge(d)}</div>
      ${firmaSection}
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="input-acta-numero" type="text" placeholder="N° de acta (opcional)" value="${d.acta_numero || ''}"
          style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;">
        <button id="btn-firmar" class="btn btn-primary" style="white-space:nowrap;">Marcar como firmada</button>
      </div>
    </div>`;
}
```

- [ ] **Step 4: Modificar `setupActaInteraction(body, d, actaInfo, overlay)` para los nuevos botones**

Reemplazar la función completa:

```js
function setupActaInteraction(body, d, actaInfo = { token: null }, overlay) {
  // ── Marcar como firmada (flujo manual existente) ──
  const btnFirmar = body.querySelector('#btn-firmar');
  if (btnFirmar) {
    btnFirmar.onclick = async () => {
      const actaNumero = body.querySelector('#input-acta-numero')?.value.trim() || null;
      btnFirmar.disabled = true;
      btnFirmar.textContent = 'Guardando…';
      try {
        await updateDespacho(d.id, { acta_firmada: 1, acta_numero: actaNumero, agente: state.currentAgent.name });
        showToast('Acta marcada como firmada', 'success');
        overlay.remove();
        document.querySelector('#btn-refresh-despachos')?.click();
      } catch (e) {
        showToast(e.message, 'error');
        btnFirmar.disabled = false;
        btnFirmar.textContent = 'Marcar como firmada';
      }
    };
  }

  // ── Obtener link de firma ──
  const btnGetLink = body.querySelector('#btn-get-link');
  if (btnGetLink) {
    btnGetLink.onclick = async () => {
      btnGetLink.disabled = true;
      btnGetLink.textContent = 'Generando…';
      try {
        const res  = await fetch('/api/actas/token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ entity_type: 'despacho', entity_id: d.id, entity_ref: d.acta_numero || d.numero }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        // Re-renderizar la sección de acta con el nuevo token
        const newActaInfo = await fetchActaInfo('despacho', d.id);
        body.querySelector('#acta-section').innerHTML = renderActaSection(d, newActaInfo);
        setupActaInteraction(body, d, newActaInfo, overlay);
        showToast('Link generado. Compártelo con el receptor.', 'success');
      } catch (e) {
        showToast(e.message, 'error');
        btnGetLink.disabled = false;
        btnGetLink.textContent = '🔗 Obtener link de firma';
      }
    };
  }

  // ── Copiar link ──
  const btnCopyLink = body.querySelector('#btn-copy-link');
  if (btnCopyLink) {
    btnCopyLink.onclick = () => {
      const input = body.querySelector('#link-firma-input');
      if (!input) return;
      navigator.clipboard.writeText(input.value)
        .then(() => showToast('Link copiado al portapapeles', 'success'))
        .catch(() => { input.select(); document.execCommand('copy'); showToast('Link copiado', 'success'); });
    };
  }

  // ── Regenerar link ──
  const btnRegen = body.querySelector('#btn-regen-link');
  if (btnRegen) {
    btnRegen.onclick = async () => {
      if (!confirm('¿Regenerar el link? El link anterior dejará de funcionar.')) return;
      btnRegen.textContent = 'Regenerando…';
      try {
        const res = await fetch('/api/actas/token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ entity_type: 'despacho', entity_id: d.id, entity_ref: d.acta_numero || d.numero }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const newActaInfo = await fetchActaInfo('despacho', d.id);
        body.querySelector('#acta-section').innerHTML = renderActaSection(d, newActaInfo);
        setupActaInteraction(body, d, newActaInfo, overlay);
        showToast('Link regenerado', 'success');
      } catch (e) {
        showToast(e.message, 'error');
        btnRegen.textContent = '🔄 Regenerar link';
      }
    };
  }

  // ── Descargar acta firmada ──
  const btnDownload = body.querySelector('#btn-download-acta');
  if (btnDownload && actaInfo.token) {
    btnDownload.href = `/api/actas/download/${actaInfo.token}`;
  }
}
```

- [ ] **Step 5: Verificar sintaxis**

```bash
node --check server.js
```

- [ ] **Step 6: Commit**

```bash
git add public/js/despacho.js
git commit -m "feat: link de firma en modal detalle de despacho"
```

---

## Task 6: tech-request-detail.js — link de firma tras generar acta

**Files:**
- Modify: `public/js/tech-request-detail.js`

Leer el archivo completo antes de editar para ubicar exactamente el contexto.

- [ ] **Step 1: Agregar función `fetchActaInfoTR` al archivo**

Al inicio del archivo, después de los imports existentes, agregar:

```js
async function fetchActaInfoTR(entityId) {
  try {
    const res = await fetch(`/api/actas/info/tech_request/${entityId}`);
    if (!res.ok) return { token: null };
    return res.json();
  } catch { return { token: null }; }
}
```

- [ ] **Step 2: Agregar sección de link de firma en el HTML del detalle**

En `tech-request-detail.js`, la función principal renderiza el HTML del detalle (`container.innerHTML = ...`). Buscar el div con `id="btn-generar-acta"` o la sección de botones del header. Añadir un contenedor para la sección de firma DESPUÉS del bloque del modal de acta (`div id="acta-modal-overlay"`):

Justo después del `</div>` que cierra el `acta-modal-overlay`, agregar este bloque dentro del `container.innerHTML`:

```html
    <!-- Sección link de firma -->
    ${!isInc ? `
    <div id="firma-section" style="background:var(--surface-2,#141422);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">
        📋 Acta Firmada
      </div>
      <div id="firma-content">
        <div style="font-size:13px;color:#64748b;margin-bottom:10px;">
          Genera el acta, compártela con el receptor y solicita que la suba firmada.
        </div>
        <button id="btn-get-firma-link" style="padding:8px 16px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:#818cf8;font-size:13px;font-weight:500;cursor:pointer;">
          🔗 Obtener link de firma
        </button>
      </div>
    </div>` : ''}
```

- [ ] **Step 3: Agregar función `renderFirmaSection` y `setupFirmaSection`**

Después de la función `setupActaModal` (o al final del archivo, antes del export), agregar:

```js
function renderFirmaContent(actaInfo, req) {
  if (actaInfo.token && actaInfo.uploaded) {
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(16,185,129,.1);border-radius:8px;border:1px solid rgba(16,185,129,.3);margin-bottom:10px;">
        <span style="font-size:18px;">✅</span>
        <div style="flex:1;">
          <div style="font-weight:600;color:#6ee7b7;font-size:13px;">Acta firmada recibida</div>
          <div style="font-size:12px;color:#94a3b8;">${actaInfo.uploaded_at ? new Date(actaInfo.uploaded_at).toLocaleString('es-CO') : ''}</div>
        </div>
        <a href="/api/actas/download/${actaInfo.token}" style="padding:6px 12px;background:#059669;color:#fff;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;">📥 Descargar</a>
      </div>`;
  }
  if (actaInfo.token && !actaInfo.uploaded) {
    return `
      <div style="font-size:12px;font-weight:500;color:#94a3b8;margin-bottom:8px;">🔗 Link activo — pendiente de subida por el receptor</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <input type="text" readonly value="${actaInfo.url || ''}"
          style="flex:1;padding:6px 9px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:#0f172a;color:#e2e8f0;font-size:11px;font-family:monospace;">
        <button id="btn-copy-link-tr" style="padding:6px 10px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:#1e293b;color:#94a3b8;font-size:11px;cursor:pointer;white-space:nowrap;">📋 Copiar</button>
      </div>
      <img src="/api/actas/qr/${actaInfo.token}" alt="QR" style="width:100px;height:100px;border-radius:6px;background:#fff;padding:4px;display:block;margin-bottom:8px;">
      <button id="btn-regen-link-tr" style="font-size:11px;color:#64748b;background:none;border:none;cursor:pointer;text-decoration:underline;">🔄 Regenerar link</button>`;
  }
  return `
    <div style="font-size:13px;color:#64748b;margin-bottom:10px;">Genera el acta, compártela con el receptor y solicita que la suba firmada.</div>
    <button id="btn-get-firma-link" style="padding:8px 16px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:#818cf8;font-size:13px;font-weight:500;cursor:pointer;">🔗 Obtener link de firma</button>`;
}

async function setupFirmaSection(container, req) {
  const section = container.querySelector('#firma-section');
  if (!section) return;

  const content = container.querySelector('#firma-content');

  async function refresh() {
    const actaInfo = await fetchActaInfoTR(req.id);
    content.innerHTML = renderFirmaContent(actaInfo, req);
    wireButtons(actaInfo);
  }

  function wireButtons(actaInfo) {
    const btnGet = content.querySelector('#btn-get-firma-link');
    if (btnGet) {
      btnGet.onclick = async () => {
        btnGet.disabled = true; btnGet.textContent = 'Generando…';
        try {
          const res = await fetch('/api/actas/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_type: 'tech_request', entity_id: req.id, entity_ref: req.request_number }),
          });
          if (!res.ok) throw new Error((await res.json()).error);
          await refresh();
          showToast('Link generado. Compártelo con el receptor.', 'success');
        } catch (e) { showToast(e.message, 'error'); btnGet.disabled = false; btnGet.textContent = '🔗 Obtener link de firma'; }
      };
    }

    const btnCopy = content.querySelector('#btn-copy-link-tr');
    if (btnCopy) {
      const input = content.querySelector('input[readonly]');
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(input?.value || '')
          .then(() => showToast('Link copiado', 'success'))
          .catch(() => { input?.select(); document.execCommand('copy'); showToast('Link copiado', 'success'); });
      };
    }

    const btnRegen = content.querySelector('#btn-regen-link-tr');
    if (btnRegen) {
      btnRegen.onclick = async () => {
        if (!confirm('¿Regenerar el link? El link anterior dejará de funcionar.')) return;
        btnRegen.textContent = 'Regenerando…';
        try {
          const res = await fetch('/api/actas/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_type: 'tech_request', entity_id: req.id, entity_ref: req.request_number }),
          });
          if (!res.ok) throw new Error((await res.json()).error);
          await refresh();
          showToast('Link regenerado', 'success');
        } catch (e) { showToast(e.message, 'error'); btnRegen.textContent = '🔄 Regenerar link'; }
      };
    }
  }

  await refresh();
}
```

- [ ] **Step 4: Llamar `setupFirmaSection` desde la función principal**

En la función principal que renderiza el detalle (buscar dónde se llama `setupActaModal(container, req, id, agents)` o similar), agregar después de esa llamada:

```js
  if (!isInc) {
    setupFirmaSection(container, req);
  }
```

- [ ] **Step 5: Verificar sintaxis**

```bash
node --check server.js
```

- [ ] **Step 6: Commit**

```bash
git add public/js/tech-request-detail.js
git commit -m "feat: link de firma en detalle de requerimiento tech-request"
```

---

## Checklist de verificación final

- [ ] `POST /api/actas/token` genera un UUID nuevo cada vez y lo almacena correctamente
- [ ] `GET /api/actas/status/:token-invalido` devuelve `{"valid":false}`
- [ ] `GET /firmar/:cualquier-token` sirve `firmar.html` (no 404)
- [ ] La página de subida muestra los 4 estados correctos (cargando, listo, éxito, ya subido, inválido)
- [ ] Solo acepta PDF y DOCX — rechaza PNG con mensaje de error
- [ ] Rechaza archivos mayores a 10 MB
- [ ] El archivo subido se guarda en `uploads/actas-firmadas/`
- [ ] Tras subir, `GET /api/actas/status/:token` devuelve `uploaded: true`
- [ ] `GET /api/actas/download/:token` descarga el archivo correctamente
- [ ] `GET /api/actas/qr/:token` devuelve una imagen PNG válida
- [ ] En despacho detail: aparece "Obtener link de firma" cuando no hay token
- [ ] En despacho detail: aparece link + QR cuando hay token sin archivo
- [ ] En despacho detail: aparece "Descargar acta firmada" cuando hay archivo
- [ ] En tech-request detail: la sección de firma aparece solo para requerimientos (no incidencias)
- [ ] Regenerar link borra el archivo previo si existía y genera nuevo UUID
