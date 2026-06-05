# Inventario IT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Inventario module to the IT Support SPA covering Equipos and Celulares, with barcode scanning on mobile and full CRUD backed by SQLite.

**Architecture:** New module follows the exact pattern of tech-requests (Express router + SQLite migrations + vanilla JS renderXxx function). Barcode scanning uses the native BarcodeDetector API with graceful fallback to manual input. No test runner present — verify via browser after each task.

**Tech Stack:** Node.js/Express, node:sqlite (DatabaseSync), vanilla ES modules, BarcodeDetector API, existing requireAuth/requirePermission middleware.

---

### Task 1: DB — Add tables and permissions

**Files:**
- Modify: `src/config/database.js` (migrations array)

- [ ] **Step 1: Add the two inventory tables and four permissions to the migrations array**

Open `src/config/database.js`. Append these entries **inside** the `migrations` array (after the last existing entry, before the closing `]`):

```javascript
  // ── Inventario ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS inventario_equipos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    placa            TEXT NOT NULL UNIQUE,
    marca            TEXT NOT NULL,
    nombre_equipo    TEXT NOT NULL,
    serial           TEXT NOT NULL UNIQUE,
    procesador       TEXT,
    ram              TEXT,
    tipo_ram         TEXT,
    cap_disco        TEXT,
    tipo_disco       TEXT,
    serial_cargador  TEXT,
    area             TEXT,
    responsable      TEXT,
    fecha_compra     TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS inventario_celulares (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_registro   TEXT DEFAULT (date('now','localtime')),
    area             TEXT,
    ciudad           TEXT,
    nombre_completo  TEXT NOT NULL,
    cedula           TEXT,
    linea            TEXT,
    operador         TEXT,
    equipo           TEXT,
    almacenamiento   TEXT,
    ram              TEXT,
    modelo           TEXT,
    imei             TEXT UNIQUE,
    imei2            TEXT,
    estado           TEXT DEFAULT 'nuevo',
    accesorio        TEXT,
    fecha_entrega    TEXT,
    entregado_por    TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (31, 'inventario:read'),
    (32, 'inventario:create'),
    (33, 'inventario:edit'),
    (34, 'inventario:delete')`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (1,31),(1,32),(1,33),(1,34),
    (3,31),(3,32),(3,33),
    (4,31),
    (5,31),
    (6,31)`,
```

- [ ] **Step 2: Restart the server and verify tables exist**

```bash
node -e "
import('node:sqlite').then(({DatabaseSync})=>{
  const db = new DatabaseSync('./database/tickets.db');
  console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'inventario%'\").all());
});
"
```
Expected output:
```
[ { name: 'inventario_equipos' }, { name: 'inventario_celulares' } ]
```

- [ ] **Step 3: Commit**
```bash
git add src/config/database.js
git commit -m "feat(inventario): add DB tables and permissions"
```

---

### Task 2: Backend routes

**Files:**
- Create: `src/inventario/inventario-routes.js`

- [ ] **Step 1: Create the routes file**

```javascript
// src/inventario/inventario-routes.js
import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = express.Router();

const canRead   = [requireAuth, requirePermission('inventario:read')];
const canCreate = [requireAuth, requirePermission('inventario:create')];
const canEdit   = [requireAuth, requirePermission('inventario:edit')];
const canDelete = [requireAuth, requirePermission('inventario:delete')];

/* ── EQUIPOS ── */

router.get('/api/inventario/equipos', ...canRead, (req, res) => {
  try {
    const { search, area, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(placa LIKE ? OR marca LIKE ? OR nombre_equipo LIKE ? OR serial LIKE ? OR responsable LIKE ? OR area LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (area) { where.push('area LIKE ?'); params.push(`%${area}%`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows  = db.prepare(`SELECT * FROM inventario_equipos ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_equipos ${wc}`).get(...params);
    res.json({ equipos: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('GET /api/inventario/equipos:', err);
    res.status(500).json({ error: 'Error al consultar equipos.' });
  }
});

router.post('/api/inventario/equipos', ...canCreate, (req, res) => {
  try {
    const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra } = req.body;
    if (!placa?.trim() || !marca?.trim() || !nombre_equipo?.trim() || !serial?.trim()) {
      return res.status(400).json({ error: 'placa, marca, nombre_equipo y serial son requeridos.' });
    }
    const result = db.prepare(`
      INSERT INTO inventario_equipos
        (placa,marca,nombre_equipo,serial,procesador,ram,tipo_ram,cap_disco,tipo_disco,serial_cargador,area,responsable,fecha_compra)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(placa.trim(), marca.trim(), nombre_equipo.trim(), serial.trim(),
           procesador||null, ram||null, tipo_ram||null, cap_disco||null,
           tipo_disco||null, serial_cargador||null, area||null,
           responsable||null, fecha_compra||null);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un equipo con esa placa o serial.' });
    console.error('POST /api/inventario/equipos:', err);
    res.status(500).json({ error: 'Error al crear equipo.' });
  }
});

router.put('/api/inventario/equipos/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_equipos WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    }
    const { placa, marca, nombre_equipo, serial, procesador, ram, tipo_ram, cap_disco, tipo_disco, serial_cargador, area, responsable, fecha_compra } = req.body;
    db.prepare(`
      UPDATE inventario_equipos SET
        placa=?,marca=?,nombre_equipo=?,serial=?,procesador=?,ram=?,tipo_ram=?,
        cap_disco=?,tipo_disco=?,serial_cargador=?,area=?,responsable=?,
        fecha_compra=?,updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(placa, marca, nombre_equipo, serial,
           procesador||null, ram||null, tipo_ram||null,
           cap_disco||null, tipo_disco||null, serial_cargador||null,
           area||null, responsable||null, fecha_compra||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Placa o serial ya existe en otro equipo.' });
    console.error('PUT /api/inventario/equipos/:id:', err);
    res.status(500).json({ error: 'Error al actualizar equipo.' });
  }
});

router.delete('/api/inventario/equipos/:id', ...canDelete, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventario_equipos WHERE id = ?').run(parseInt(req.params.id));
    if (!result.changes) return res.status(404).json({ error: 'Equipo no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/inventario/equipos/:id:', err);
    res.status(500).json({ error: 'Error al eliminar equipo.' });
  }
});

/* ── CELULARES ── */

router.get('/api/inventario/celulares', ...canRead, (req, res) => {
  try {
    const { search, area, estado, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(nombre_completo LIKE ? OR cedula LIKE ? OR imei LIKE ? OR modelo LIKE ? OR area LIKE ? OR ciudad LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (area)   { where.push('area LIKE ?');   params.push(`%${area}%`); }
    if (estado) { where.push('estado = ?');    params.push(estado); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const rows  = db.prepare(`SELECT * FROM inventario_celulares ${wc} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM inventario_celulares ${wc}`).get(...params);
    res.json({ celulares: rows, total, page: parseInt(page), limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('GET /api/inventario/celulares:', err);
    res.status(500).json({ error: 'Error al consultar celulares.' });
  }
});

router.post('/api/inventario/celulares', ...canCreate, (req, res) => {
  try {
    const { fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, estado, accesorio, fecha_entrega, entregado_por } = req.body;
    if (!nombre_completo?.trim() || !imei?.trim()) {
      return res.status(400).json({ error: 'nombre_completo e imei son requeridos.' });
    }
    const result = db.prepare(`
      INSERT INTO inventario_celulares
        (fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(fecha_registro||null, area||null, ciudad||null, nombre_completo.trim(),
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei.trim(),
           imei2||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un celular con ese IMEI.' });
    console.error('POST /api/inventario/celulares:', err);
    res.status(500).json({ error: 'Error al crear celular.' });
  }
});

router.put('/api/inventario/celulares/:id', ...canEdit, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!db.prepare('SELECT id FROM inventario_celulares WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Celular no encontrado.' });
    }
    const { fecha_registro, area, ciudad, nombre_completo, cedula, linea, operador, equipo, almacenamiento, ram, modelo, imei, imei2, estado, accesorio, fecha_entrega, entregado_por } = req.body;
    db.prepare(`
      UPDATE inventario_celulares SET
        fecha_registro=?,area=?,ciudad=?,nombre_completo=?,cedula=?,linea=?,
        operador=?,equipo=?,almacenamiento=?,ram=?,modelo=?,imei=?,imei2=?,
        estado=?,accesorio=?,fecha_entrega=?,entregado_por=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(fecha_registro||null, area||null, ciudad||null, nombre_completo,
           cedula||null, linea||null, operador||null, equipo||null,
           almacenamiento||null, ram||null, modelo||null, imei,
           imei2||null, estado||'nuevo', accesorio||null,
           fecha_entrega||null, entregado_por||null, id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'IMEI ya existe en otro celular.' });
    console.error('PUT /api/inventario/celulares/:id:', err);
    res.status(500).json({ error: 'Error al actualizar celular.' });
  }
});

router.delete('/api/inventario/celulares/:id', ...canDelete, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventario_celulares WHERE id = ?').run(parseInt(req.params.id));
    if (!result.changes) return res.status(404).json({ error: 'Celular no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/inventario/celulares/:id:', err);
    res.status(500).json({ error: 'Error al eliminar celular.' });
  }
});

export default router;
```

- [ ] **Step 2: Verify file saved correctly**
```bash
node --input-type=module <<'EOF'
import './src/inventario/inventario-routes.js';
console.log('routes OK');
EOF
```
Expected: `routes OK`

- [ ] **Step 3: Commit**
```bash
git add src/inventario/inventario-routes.js
git commit -m "feat(inventario): add CRUD API routes for equipos and celulares"
```

---

### Task 3: Register router in server.js and permissions in user-routes.js

**Files:**
- Modify: `server.js`
- Modify: `src/auth/user-routes.js`

- [ ] **Step 1: Import and register the router in server.js**

Add the import line after the last existing router import:
```javascript
import inventarioRouter from './src/inventario/inventario-routes.js';
```

Add `app.use(inventarioRouter);` after `app.use(actasRouter);` and `app.use(registrosRouter);`

- [ ] **Step 2: Add inventario to PERMISSION_MODULES in user-routes.js**

In `src/auth/user-routes.js`, add to the `PERMISSION_MODULES` array:
```javascript
{ module: 'inventario', label: 'Inventario', actions: ['read', 'create', 'edit', 'delete'] },
```

- [ ] **Step 3: Verify routes respond**

Start the server (`npm start` or `npm run dev`), then:
```bash
curl -s http://localhost:3000/api/inventario/equipos -H "Cookie: ..." 
# Without auth should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/inventario/equipos
# Expected: 401
```

- [ ] **Step 4: Commit**
```bash
git add server.js src/auth/user-routes.js
git commit -m "feat(inventario): register router and expose permissions in user-routes"
```

---

### Task 4: Sidebar nav item and app.js wiring

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/app.js`

- [ ] **Step 1: Add nav item to index.html**

In `public/index.html`, add this nav item inside `<nav class="sidebar-menu">`, after the `#audit` item and before `#farmacias`:

```html
      <a href="#inventario" class="menu-item" id="nav-inventario" style="display:none;">
        <span class="menu-icon"><i data-lucide="package-search" class="lucide"></i></span>
        <span class="menu-label">Inventario</span>
      </a>
```

- [ ] **Step 2: Update app.js — import, router case, _applyUserUI, _firstAccessibleHash**

**Add import** at the top of `public/js/app.js` with the other imports:
```javascript
import { renderInventario } from './inventario.js';
```

**Add router case** inside the `switch (hash)` block, after the `#audit` case:
```javascript
      case '#inventario':
        if (state.currentUser && !can('inventario:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'inventario';
        document.getElementById('nav-inventario')?.classList.add('active');
        renderInventario(appContainer);
        break;
```

**Add to `_applyUserUI`** after the `can('audit:read')` line:
```javascript
  if (can('inventario:read')) show('nav-inventario');
```

**Add to `_firstAccessibleHash`** after the `despacho` line:
```javascript
  if (can('inventario:read'))     return '#inventario';
```

- [ ] **Step 3: Create stub inventario.js to verify wiring before full implementation**

Create `public/js/inventario.js` with a minimal stub:
```javascript
export function renderInventario(container) {
  container.innerHTML = '<div style="padding:32px;"><h2>Inventario — cargando…</h2></div>';
}
```

- [ ] **Step 4: Open browser, log in as IT, click Inventario in sidebar**

Expected: sidebar shows "Inventario" icon, clicking it renders "Inventario — cargando…" in main area.

- [ ] **Step 5: Commit**
```bash
git add public/index.html public/js/app.js public/js/inventario.js
git commit -m "feat(inventario): wire sidebar nav and SPA router"
```

---

### Task 5: Frontend — list view (tabs, table, search, pagination)

**Files:**
- Modify: `public/js/inventario.js` (replace stub with full implementation)

- [ ] **Step 1: Replace inventario.js with the list view implementation**

```javascript
// public/js/inventario.js
import { showToast } from './components.js';

const toTitleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

let _activeTab  = 'equipos'; // 'equipos' | 'celulares'
let _page       = 1;
const _limit    = 20;
let _search     = '';
let _filterArea = '';

/* ── Entry point ── */
export function renderInventario(container) {
  _page = 1; _search = ''; _filterArea = '';
  container.innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Inventario TI</h2>
        <p style="color:var(--text-muted);font-size:14px;">Gestión de equipos, celulares y dispositivos.</p>
      </div>
      <button id="btn-inv-new"
        style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;">
        ＋ Registrar equipo
      </button>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--glass-border);margin-bottom:0;">
      <button id="tab-equipos" class="tab-btn tab-active" data-tab="equipos">
        🖥 Equipos <span class="tab-count" id="count-equipos">…</span>
      </button>
      <button id="tab-celulares" class="tab-btn" data-tab="celulares">
        📱 Celulares <span class="tab-count" id="count-celulares">…</span>
      </button>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-top:0;border-radius:0 0 12px 12px;padding:14px 20px;">
      <div class="filter-bar">
        <input type="search" id="inv-search" placeholder="Buscar placa, serial, nombre, área…"
          style="flex:1;min-width:180px;" value="">
        <input type="text" id="inv-area" placeholder="Filtrar por área"
          style="width:160px;">
        <button id="btn-inv-clear" class="btn btn-secondary btn-small">Limpiar</button>
      </div>
    </div>

    <div id="inv-table-wrap" style="margin-top:16px;"></div>
    <div id="inv-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px;"></div>
    <div id="inv-modal-wrap"></div>
  `;

  // Tab switching
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      _activeTab = btn.dataset.tab;
      _page = 1;
      loadTable();
    });
  });

  // Search
  let debounce;
  document.getElementById('inv-search').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _search = e.target.value.trim(); _page = 1; loadTable(); }, 300);
  });
  document.getElementById('inv-area').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _filterArea = e.target.value.trim(); _page = 1; loadTable(); }, 300);
  });
  document.getElementById('btn-inv-clear').addEventListener('click', () => {
    _search = ''; _filterArea = ''; _page = 1;
    document.getElementById('inv-search').value = '';
    document.getElementById('inv-area').value   = '';
    loadTable();
  });

  document.getElementById('btn-inv-new').addEventListener('click', () => openForm(null));

  loadTable();
  loadCounts();
}

/* ── Load table ── */
async function loadTable() {
  const wrap = document.getElementById('inv-table-wrap');
  wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>';

  const params = new URLSearchParams({ page: _page, limit: _limit });
  if (_search)     params.set('search', _search);
  if (_filterArea) params.set('area',   _filterArea);

  try {
    const res  = await fetch(`/api/inventario/${_activeTab}?${params}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();

    const rows  = _activeTab === 'equipos' ? data.equipos : data.celulares;
    const total = data.total;

    if (!rows.length) {
      wrap.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);">Sin registros.</div>';
      document.getElementById('inv-pagination').innerHTML = '';
      return;
    }

    wrap.innerHTML = _activeTab === 'equipos' ? renderEquiposTable(rows) : renderCelularesTable(rows);

    wrap.querySelectorAll('.btn-inv-edit').forEach(btn => {
      btn.addEventListener('click', () => openForm(JSON.parse(decodeURIComponent(btn.dataset.row))));
    });
    wrap.querySelectorAll('.btn-inv-del').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.label));
    });

    renderPagination(total, data.total_pages);
  } catch (err) {
    wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">Error: ${err.message}</div>`;
  }
}

function renderEquiposTable(rows) {
  return `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr>
        <th>Placa</th><th>Marca / Equipo</th><th>Serial</th>
        <th>Procesador</th><th>RAM</th><th>Disco</th>
        <th>Área</th><th>Responsable</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td style="font-family:monospace;font-size:12px;">${esc(r.placa)}</td>
          <td><strong>${esc(r.marca)}</strong><br><small style="color:var(--text-muted);">${esc(r.nombre_equipo)}</small></td>
          <td style="font-family:monospace;font-size:12px;">${esc(r.serial)}</td>
          <td style="font-size:12px;">${esc(r.procesador||'—')}</td>
          <td style="font-size:12px;">${esc(r.ram||'—')} ${esc(r.tipo_ram||'')}</td>
          <td style="font-size:12px;">${esc(r.cap_disco||'—')} ${esc(r.tipo_disco||'')}</td>
          <td style="font-size:12px;">${esc(r.area||'—')}</td>
          <td style="font-size:12px;">${esc(r.responsable||'—')}</td>
          <td style="white-space:nowrap;">
            <button class="btn-inv-edit btn btn-small btn-secondary"
              data-row="${encodeURIComponent(JSON.stringify(r))}">✏</button>
            <button class="btn-inv-del btn btn-small" style="background:rgba(239,68,68,.12);color:var(--danger);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;margin-left:4px;"
              data-id="${r.id}" data-label="${esc(r.placa)} — ${esc(r.marca)}">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderCelularesTable(rows) {
  return `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr>
        <th>IMEI</th><th>Modelo / Equipo</th><th>Asignado a</th>
        <th>Área</th><th>Ciudad</th><th>Estado</th>
        <th>Operador</th><th>F. Entrega</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td style="font-family:monospace;font-size:12px;">${esc(r.imei)}</td>
          <td><strong>${esc(r.modelo||r.equipo||'—')}</strong><br><small style="color:var(--text-muted);">${esc(r.almacenamiento||'')} ${esc(r.ram||'')}</small></td>
          <td style="font-size:12px;">${esc(r.nombre_completo)}<br><small style="color:var(--text-muted);">${esc(r.cedula||'')}</small></td>
          <td style="font-size:12px;">${esc(r.area||'—')}</td>
          <td style="font-size:12px;">${esc(r.ciudad||'—')}</td>
          <td><span class="badge badge-${r.estado||'nuevo'}">${esc(r.estado||'nuevo')}</span></td>
          <td style="font-size:12px;">${esc(r.operador||'—')}</td>
          <td style="font-size:12px;">${esc(r.fecha_entrega||'—')}</td>
          <td style="white-space:nowrap;">
            <button class="btn-inv-edit btn btn-small btn-secondary"
              data-row="${encodeURIComponent(JSON.stringify(r))}">✏</button>
            <button class="btn-inv-del btn btn-small" style="background:rgba(239,68,68,.12);color:var(--danger);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;margin-left:4px;"
              data-id="${r.id}" data-label="${esc(r.imei)} — ${esc(r.modelo||r.equipo||'')}">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderPagination(total, totalPages) {
  const pg = document.getElementById('inv-pagination');
  if (totalPages <= 1) { pg.innerHTML = ''; return; }
  let html = `<button class="btn btn-small btn-secondary" id="pg-prev" ${_page===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - _page) <= 1)
      html += `<button class="btn btn-small ${i===_page?'btn-primary':'btn-secondary'}" data-p="${i}">${i}</button>`;
    else if (Math.abs(i - _page) === 2)
      html += `<span style="padding:0 4px;color:var(--text-muted);">…</span>`;
  }
  html += `<button class="btn btn-small btn-secondary" id="pg-next" ${_page===totalPages?'disabled':''}>›</button>`;
  pg.innerHTML = html;
  pg.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { _page = parseInt(b.dataset.p); loadTable(); }));
  pg.querySelector('#pg-prev')?.addEventListener('click', () => { _page--; loadTable(); });
  pg.querySelector('#pg-next')?.addEventListener('click', () => { _page++; loadTable(); });
}

async function loadCounts() {
  for (const tab of ['equipos', 'celulares']) {
    try {
      const r = await fetch(`/api/inventario/${tab}?page=1&limit=1`);
      const d = await r.json();
      const el = document.getElementById(`count-${tab}`);
      if (el) el.textContent = d.total ?? '';
    } catch {}
  }
}

async function confirmDelete(id, label) {
  if (!confirm(`¿Eliminar "${label}"?`)) return;
  try {
    const res = await fetch(`/api/inventario/${_activeTab}/${id}`, { method: 'DELETE' });
    const d   = await res.json();
    if (!res.ok) throw new Error(d.error);
    showToast('Registro eliminado.', 'success');
    loadTable();
    loadCounts();
  } catch (err) {
    showToast(err.message || 'Error al eliminar.', 'error');
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

Note: `openForm` and scanner functions are added in Task 6. Export the file as-is (openForm called from click listeners — will be defined in same file in Task 6).

- [ ] **Step 2: Test in browser**

Navigate to `#inventario` → see tabs, empty table, search bar, "+ Registrar equipo" button. Console should have no errors.

- [ ] **Step 3: Commit**
```bash
git add public/js/inventario.js
git commit -m "feat(inventario): list view with tabs, search, pagination"
```

---

### Task 6: Frontend — form modal + barcode scanner

**Files:**
- Modify: `public/js/inventario.js` (append form + scanner code)

- [ ] **Step 1: Append the form modal and scanner functions to inventario.js**

Add these functions at the bottom of `public/js/inventario.js`:

```javascript
/* ── Form modal ── */
function openForm(row) {
  const isEdit    = !!row;
  const isEquipo  = _activeTab === 'equipos';
  const modalWrap = document.getElementById('inv-modal-wrap');

  modalWrap.innerHTML = isEquipo ? equipoFormHTML(row) : celularFormHTML(row);

  const overlay = modalWrap.querySelector('.modal-overlay');
  const form    = modalWrap.querySelector('#inv-form');
  const errEl   = modalWrap.querySelector('#inv-form-err');

  const close = () => { overlay.style.display = 'none'; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalWrap.querySelector('#btn-inv-form-cancel').addEventListener('click', close);

  // Title-case blur on text inputs
  form.querySelectorAll('input[type=text]').forEach(inp => {
    inp.addEventListener('blur', e => {
      const skip = ['placa','serial','imei','imei2','serial_cargador'];
      if (!skip.includes(e.target.name)) e.target.value = toTitleCase(e.target.value.trim());
    });
  });

  // Scan buttons
  form.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', () => openScanner(btn.dataset.target));
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.style.display = 'none';
    const data = Object.fromEntries(new FormData(form));
    const url  = isEdit
      ? `/api/inventario/${_activeTab}/${row.id}`
      : `/api/inventario/${_activeTab}`;
    try {
      const res  = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(isEdit ? 'Registro actualizado.' : 'Registro creado.', 'success');
      close();
      loadTable();
      loadCounts();
    } catch (err) {
      errEl.textContent  = err.message || 'Error al guardar.';
      errEl.style.display = 'block';
    }
  });
}

function equipoFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header">
        <h3>${r ? 'Editar equipo' : 'Nuevo equipo'}</h3>
        <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${scanField('Placa *','placa',v('placa'),true)}
            ${selectField('Marca *','marca',v('marca'),['Lenovo','Dell','HP','Samsung','Toshiba','Acer','Asus','Apple','Otro'])}
            ${inputField('Nombre del equipo *','nombre_equipo',v('nombre_equipo'))}
            ${scanField('Serial *','serial',v('serial'),true)}
            ${selectField('Procesador','procesador',v('procesador'),['Intel Core i3','Intel Core i5','Intel Core i7','Intel Core i9','AMD Ryzen 3','AMD Ryzen 5','AMD Ryzen 7','Otro'])}
            ${selectField('RAM','ram',v('ram'),['4GB','8GB','16GB','32GB','64GB'])}
            ${selectField('Tipo de RAM','tipo_ram',v('tipo_ram'),['DDR3','DDR4','DDR5','LPDDR4','LPDDR5'])}
            ${selectField('Capacidad Disco','cap_disco',v('cap_disco'),['128GB','256GB','512GB','1TB','2TB'])}
            ${selectField('Tipo de Disco','tipo_disco',v('tipo_disco'),['SSD','HDD','M2','SATA','NVMe'])}
            ${inputField('Serial Cargador','serial_cargador',v('serial_cargador'))}
            ${inputField('Área','area',v('area'))}
            ${inputField('Responsable','responsable',v('responsable'))}
          </div>
          <div style="margin-top:12px;">
            ${inputField('Fecha de compra','fecha_compra',v('fecha_compra'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function celularFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header">
        <h3>${r ? 'Editar celular' : 'Nuevo celular'}</h3>
        <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${scanField('IMEI *','imei',v('imei'),true)}
            ${inputField('IMEI 2','imei2',v('imei2'))}
            ${selectField('Marca / Equipo','equipo',v('equipo'),['Samsung','Xiaomi Redmi','Honor','ZTE','Infinix','Motorola','iPhone','Otro'])}
            ${inputField('Modelo','modelo',v('modelo'))}
            ${selectField('Almacenamiento','almacenamiento',v('almacenamiento'),['32GB','64GB','128GB','256GB','512GB'])}
            ${selectField('RAM','ram',v('ram'),['2GB','3GB','4GB','6GB','8GB','12GB','16GB'])}
            ${selectField('Operador','operador',v('operador'),['CLARO','TIGO','MOVISTAR','WOM','ETB','AVANTEL'])}
            ${inputField('Línea','linea',v('linea'))}
            ${inputField('Área','area',v('area'))}
            ${inputField('Ciudad','ciudad',v('ciudad'))}
            ${inputField('Nombre completo *','nombre_completo',v('nombre_completo'))}
            ${inputField('Cédula','cedula',v('cedula'))}
            ${selectField('Estado','estado',v('estado')||'nuevo',['nuevo','seminuevo','usado'])}
            ${inputField('Accesorio','accesorio',v('accesorio'))}
            ${inputField('Entregado por','entregado_por',v('entregado_por'))}
          </div>
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${inputField('Fecha de registro','fecha_registro',v('fecha_registro'),'date')}
            ${inputField('Fecha de entrega','fecha_entrega',v('fecha_entrega'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function inputField(label, name, value = '', type = 'text') {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <input type="${type}" name="${name}" class="form-control" value="${esc(value)}" ${label.includes('*')?'required':''}>
  </div>`;
}

function selectField(label, name, value, options) {
  const opts = options.map(o => `<option value="${esc(o)}" ${value===o?'selected':''}>${esc(o)}</option>`).join('');
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <select name="${name}" class="form-control">
      <option value="">— Seleccionar —</option>
      ${opts}
    </select>
  </div>`;
}

function scanField(label, name, value = '', required = false) {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <div style="display:flex;gap:6px;">
      <input type="text" name="${name}" id="scan-input-${name}" class="form-control" value="${esc(value)}" ${required?'required':''} style="flex:1;">
      <button type="button" class="btn-scan" data-target="scan-input-${name}"
        style="padding:0 10px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:16px;flex-shrink:0;"
        title="Escanear código de barras">📷</button>
    </div>
  </div>`;
}

/* ── Barcode scanner ── */
async function openScanner(targetInputId) {
  if (!('BarcodeDetector' in window)) {
    showToast('Tu navegador no soporta BarcodeDetector. Ingresa el dato manualmente.', 'warning');
    return;
  }

  let stream, rafId;

  const overlay = document.createElement('div');
  overlay.id    = 'scanner-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:20px;width:min(380px,94vw);text-align:center;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:600;font-size:15px;">Escanear código</span>
        <button id="btn-close-scan" style="background:transparent;border:none;font-size:20px;cursor:pointer;color:var(--text-2);">✕</button>
      </div>
      <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;">
        <video id="scan-video" autoplay playsinline style="width:100%;display:block;border-radius:10px;"></video>
        <div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:var(--primary);transform:translateY(-50%);box-shadow:0 0 8px var(--primary);pointer-events:none;"></div>
      </div>
      <p style="margin-top:12px;font-size:13px;color:var(--text-muted);">Apunta la cámara al código de barras del equipo</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  };

  document.getElementById('btn-close-scan').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  try {
    const detector = new BarcodeDetector({
      formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
    });

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    const video = document.getElementById('scan-video');
    video.srcObject = stream;

    const scan = async () => {
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const val = codes[0].rawValue;
            const inp = document.getElementById(targetInputId);
            if (inp) { inp.value = val; inp.dispatchEvent(new Event('input')); }
            close();
            showToast(`Escaneado: ${val}`, 'success');
            return;
          }
        } catch {}
      }
      rafId = requestAnimationFrame(scan);
    };

    video.addEventListener('loadeddata', () => { rafId = requestAnimationFrame(scan); });
  } catch (err) {
    close();
    if (err.name === 'NotAllowedError') {
      showToast('Permiso de cámara denegado. Actívalo en ajustes del navegador.', 'error');
    } else {
      showToast('No se pudo acceder a la cámara.', 'error');
    }
  }
}
```

- [ ] **Step 2: Test in browser on desktop**

Click "+ Registrar equipo" → modal opens with all fields. Try both tabs (Equipos / Celulares). Fill required fields, submit → toast "Registro creado", table refreshes.

- [ ] **Step 3: Test scanner on mobile (Chrome Android or Safari iOS 17+)**

Open the app on mobile, go to Inventario, click "+ Registrar equipo", tap 📷 next to Placa → camera opens → point at any barcode → field fills automatically.

If `BarcodeDetector` not supported → toast "Tu navegador no soporta BarcodeDetector" appears, field is still manually editable.

- [ ] **Step 4: Commit**
```bash
git add public/js/inventario.js
git commit -m "feat(inventario): form modal, smart dropdowns, barcode scanner"
```

---

### Task 7: Add tab styles and scanner CSS

**Files:**
- Modify: `public/css/styles.css`

- [ ] **Step 1: Add .tab-btn styles if not present**

Check `public/css/styles.css` for `.tab-btn`. If not present, append:

```css
/* ── Inventory tab buttons (reuses pattern from tech-requests) ── */
.tab-btn {
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-2);
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: var(--transition);
  white-space: nowrap;
}
.tab-btn:hover    { color: var(--text); }
.tab-btn.tab-active {
  border-bottom-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  margin-left: 6px;
  color: var(--text-2);
}
```

- [ ] **Step 2: Verify tabs render correctly in both light and dark mode**

Toggle theme on the inventario page — tabs should look correct in both modes.

- [ ] **Step 3: Commit**
```bash
git add public/css/styles.css
git commit -m "feat(inventario): tab and count badge styles"
```

---

## Self-Review

**Spec coverage:**
- ✅ DB tables: inventario_equipos + inventario_celulares (Task 1)
- ✅ CRUD routes for both types (Task 2)
- ✅ Permissions inventario:read/create/edit/delete (Task 1 + 3)
- ✅ Sidebar nav + SPA routing (Task 4)
- ✅ List with search, filter by area, pagination (Task 5)
- ✅ Form modal with smart dropdowns (Task 6)
- ✅ Barcode scanner via BarcodeDetector (Task 6)
- ✅ Title case on text fields (Task 6, toTitleCase on blur)
- ✅ Tab styles (Task 7)

**No placeholders found.**

**Type consistency:** All function names (openForm, openScanner, loadTable, renderEquiposTable, renderCelularesTable) defined before use within the same file. API endpoints match between routes (Task 2) and frontend fetch calls (Task 6).
