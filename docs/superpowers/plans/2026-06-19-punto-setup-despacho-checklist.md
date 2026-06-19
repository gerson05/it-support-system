# Punto Setup — Despacho + Checklist + Trazabilidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When creating a new punto in Red de Puntos, optionally generate a linked despacho + trazabilidad entry and expose a per-punto checklist that IT can mark as sent (and the destination confirms receipt via the existing public tracking link).

**Architecture:** Modal multi-paso reemplaza el form inline en sedes-admin.js. Un nuevo endpoint POST /api/sedes/setup crea sede + despacho + tracking en una sola transacción SQLite. La trazabilidad usa la infraestructura existente (paquete_tracking, addEvento); los artículos del despacho sirven como checklist.

**Tech Stack:** Node.js (node:sqlite DatabaseSync), Express, vanilla JS ES modules, existing tracking-model.js functions (createTracking, addEvento).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/config/database.js` | Modify | Add 2 migration entries for `sedes` new columns |
| `src/sedes/sedes-routes.js` | Modify | Add POST /setup, GET /:id/checklist, POST /:id/marcar-enviado; update GET query |
| `public/js/punto-setup-modal.js` | Create | 3-step creation modal + checklist modal |
| `public/js/sedes-admin.js` | Modify | Replace inline form with button, add badges + checklist buttons |

---

## Task 1: DB Migration — add `despacho_id` and `tracking_token` to `sedes`

**Files:**
- Modify: `src/config/database.js:532` (end of migrations array, just before `];`)

- [ ] **Step 1: Add two migration entries**

Open `src/config/database.js`. Find line 532 (the closing backtick+comma of the last migration entry, right before `];`). Add after it:

```js
  `ALTER TABLE sedes ADD COLUMN despacho_id INTEGER REFERENCES despachos(id)`,
  `ALTER TABLE sedes ADD COLUMN tracking_token TEXT`,
```

The end of the file should look like:

```js
    updated_at         TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `ALTER TABLE sedes ADD COLUMN despacho_id INTEGER REFERENCES despachos(id)`,
  `ALTER TABLE sedes ADD COLUMN tracking_token TEXT`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* columna ya existe */ }
}
```

- [ ] **Step 2: Verify migration runs without error**

```bash
node -e "import('./src/config/database.js').then(() => console.log('OK'))"
```

Expected output: `OK` (no error). If it throws, check the SQL syntax.

- [ ] **Step 3: Verify columns exist in DB**

```bash
node -e "
import db from './src/config/database.js';
const cols = db.prepare(\"PRAGMA table_info(sedes)\").all();
console.log(cols.map(c => c.name));
"
```

Expected: array includes `'despacho_id'` and `'tracking_token'`.

- [ ] **Step 4: Commit**

```bash
git add src/config/database.js
git commit -m "feat(sedes): add despacho_id and tracking_token columns to sedes table"
```

---

## Task 2: Backend — `POST /api/sedes/setup`

**Files:**
- Modify: `src/sedes/sedes-routes.js`

- [ ] **Step 1: Add import for `createTracking` at top of sedes-routes.js**

The current imports in `src/sedes/sedes-routes.js` (lines 1-4):
```js
import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
```

Replace with:
```js
import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { createTracking } from '../tracking/tracking-model.js';
```

- [ ] **Step 2: Add `generateDespachoNumero` helper after `const router = express.Router();`**

After line `const router = express.Router();`, insert:

```js
function generateDespachoNumero() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like = `DES-${dateStr}-%`;
  const last = db.prepare('SELECT numero FROM despachos WHERE numero LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const next = last ? parseInt(last.numero.split('-')[2]) + 1 : 1;
  return `DES-${dateStr}-${String(next).padStart(3, '0')}`;
}
```

- [ ] **Step 3: Add `POST /api/sedes/setup` endpoint after the `generateDespachoNumero` function**

```js
router.post('/api/sedes/setup', requireAuth, requirePermission('sedes:create'), (req, res) => {
  try {
    const { ciudad, nombre_punto, responsable = '', articulos = [], agente = 'IT' } = req.body;
    if (!ciudad?.trim() || !nombre_punto?.trim()) {
      return res.status(400).json({ error: 'Ciudad y nombre del punto son obligatorios.' });
    }

    let sedeId, despachoId = null, trackingToken = null;

    db.exec('BEGIN');
    try {
      if (articulos.length > 0) {
        const numero = generateDespachoNumero();
        const rd = db.prepare(`
          INSERT INTO despachos (numero, destinatario, sede, articulos, agente)
          VALUES (?, ?, ?, ?, ?)
        `).run(numero, responsable || nombre_punto.trim(), nombre_punto.trim(), JSON.stringify(articulos), agente);
        despachoId = rd.lastInsertRowid;
        trackingToken = createTracking(db, despachoId, agente, 'Bodega Central');
      }

      const rs = db.prepare(`
        INSERT INTO sedes (ciudad, nombre_punto, despacho_id, tracking_token)
        VALUES (?, ?, ?, ?)
      `).run(ciudad.trim().toUpperCase(), nombre_punto.trim(), despachoId, trackingToken);
      sedeId = rs.lastInsertRowid;

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const baseUrl = process.env.PUBLIC_TUNNEL_URL || `${req.protocol}://${req.headers.host}`;
    const trackingUrl = trackingToken ? `${baseUrl}/rastrear?token=${trackingToken}` : null;

    res.status(201).json({
      success: true,
      sede_id: sedeId,
      despacho_id: despachoId,
      tracking_token: trackingToken,
      tracking_url: trackingUrl,
    });
  } catch (e) {
    console.error('Error POST /api/sedes/setup:', e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 4: Test endpoint manually**

Start the server, then:

```bash
curl -s -X POST http://localhost:3000/api/sedes/setup \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{
    "ciudad": "CALI",
    "nombre_punto": "TEST FARMACIA SETUP",
    "responsable": "Juan Perez",
    "articulos": [{"nombre":"Computador","cantidad":1,"marca":"Dell","modelo":"Latitude","serial":"","descripcion":""}],
    "agente": "IT"
  }'
```

Expected response:
```json
{"success":true,"sede_id":42,"despacho_id":17,"tracking_token":"<uuid>","tracking_url":"http://localhost:3000/rastrear?token=<uuid>"}
```

Also test without articulos:
```bash
curl -s -X POST http://localhost:3000/api/sedes/setup \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"ciudad":"BOGOTA","nombre_punto":"TEST SIN ARTICULOS","articulos":[]}'
```

Expected: `{"success":true,"sede_id":43,"despacho_id":null,"tracking_token":null,"tracking_url":null}`

- [ ] **Step 5: Commit**

```bash
git add src/sedes/sedes-routes.js
git commit -m "feat(sedes): add POST /api/sedes/setup — atomic sede + despacho + tracking creation"
```

---

## Task 3: Backend — checklist endpoint + marcar-enviado + update GET query

**Files:**
- Modify: `src/sedes/sedes-routes.js`

- [ ] **Step 1: Add import for `addEvento` at top of sedes-routes.js**

Update the tracking import line (added in Task 2 Step 1):
```js
import { createTracking, addEvento } from '../tracking/tracking-model.js';
```

- [ ] **Step 2: Update `GET /api/sedes` query to include new columns + tracking estado**

In `src/sedes/sedes-routes.js`, find the existing GET /api/sedes handler. Replace its query:

Old:
```js
    const rows = db.prepare(`
      SELECT id, ciudad, nombre_punto, activo, created_at
      FROM sedes ORDER BY ciudad, id
    `).all();
```

New:
```js
    const rows = db.prepare(`
      SELECT s.id, s.ciudad, s.nombre_punto, s.activo, s.created_at,
             s.despacho_id, s.tracking_token, t.estado AS tracking_estado
      FROM sedes s
      LEFT JOIN paquete_tracking t ON t.token = s.tracking_token
      ORDER BY s.ciudad, s.id
    `).all();
```

- [ ] **Step 3: Add `GET /api/sedes/:id/checklist` endpoint**

Add after the existing PUT /api/sedes/:id handler:

```js
router.get('/api/sedes/:id/checklist', requireAuth, requirePermission('sedes:read'), (req, res) => {
  try {
    const sedeId = parseInt(req.params.id);
    const sede = db.prepare('SELECT * FROM sedes WHERE id = ?').get(sedeId);
    if (!sede) return res.status(404).json({ error: 'Punto no encontrado.' });
    if (!sede.despacho_id) return res.json({ checklist: null });

    const despacho = db.prepare('SELECT articulos FROM despachos WHERE id = ?').get(sede.despacho_id);
    const tracking = db.prepare('SELECT estado FROM paquete_tracking WHERE token = ?').get(sede.tracking_token);

    const baseUrl = process.env.PUBLIC_TUNNEL_URL || `${req.protocol}://${req.headers.host}`;
    res.json({
      checklist: {
        sede_id: sedeId,
        nombre_punto: sede.nombre_punto,
        despacho_id: sede.despacho_id,
        tracking_token: sede.tracking_token,
        tracking_url: `${baseUrl}/rastrear?token=${sede.tracking_token}`,
        estado: tracking?.estado || 'creado',
        articulos: JSON.parse(despacho?.articulos || '[]'),
      },
    });
  } catch (e) {
    console.error('Error GET /api/sedes/:id/checklist:', e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 4: Add `POST /api/sedes/:id/marcar-enviado` endpoint**

Add immediately after the checklist endpoint:

```js
router.post('/api/sedes/:id/marcar-enviado', requireAuth, requirePermission('sedes:edit'), (req, res) => {
  try {
    const sedeId = parseInt(req.params.id);
    const { agente = 'IT' } = req.body;

    const sede = db.prepare('SELECT tracking_token FROM sedes WHERE id = ?').get(sedeId);
    if (!sede?.tracking_token) {
      return res.status(400).json({ error: 'Este punto no tiene despacho vinculado.' });
    }

    const tracking = db.prepare('SELECT id, estado FROM paquete_tracking WHERE token = ?').get(sede.tracking_token);
    if (!tracking) return res.status(404).json({ error: 'Tracking no encontrado.' });
    if (tracking.estado !== 'creado') {
      return res.status(409).json({ error: `Estado actual es '${tracking.estado}', ya fue procesado.` });
    }

    addEvento(db, tracking.id, {
      tipo: 'en_transito',
      entregado_por: agente,
      observaciones: 'Enviado desde IT',
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Error POST /api/sedes/:id/marcar-enviado:', e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 5: Test GET checklist**

Use the `sede_id` from Task 2 Step 4's first test (with articulos):

```bash
curl -s http://localhost:3000/api/sedes/42/checklist \
  -H "Cookie: <your-session-cookie>"
```

Expected:
```json
{
  "checklist": {
    "sede_id": 42,
    "nombre_punto": "TEST FARMACIA SETUP",
    "despacho_id": 17,
    "tracking_token": "<uuid>",
    "tracking_url": "http://localhost:3000/rastrear?token=<uuid>",
    "estado": "creado",
    "articulos": [{"nombre":"Computador","cantidad":1,"marca":"Dell","modelo":"Latitude","serial":"","descripcion":""}]
  }
}
```

For the sede without articulos (id 43): `{"checklist":null}`

- [ ] **Step 6: Test marcar-enviado**

```bash
curl -s -X POST http://localhost:3000/api/sedes/42/marcar-enviado \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"agente":"IT Admin"}'
```

Expected: `{"success":true}`

Then re-check checklist: `estado` should now be `"en_transito"`.

Try marcar-enviado again: should get 409 `"Estado actual es 'en_transito', ya fue procesado."`

- [ ] **Step 7: Commit**

```bash
git add src/sedes/sedes-routes.js
git commit -m "feat(sedes): add checklist and marcar-enviado endpoints; update GET to include tracking estado"
```

---

## Task 4: Frontend — `public/js/punto-setup-modal.js` (new file)

**Files:**
- Create: `public/js/punto-setup-modal.js`

- [ ] **Step 1: Create the file with full content**

```js
import { state } from './app.js';
import { showToast } from './components.js';
import { buildArticuloRow } from './despacho-form.js';

function collectArticulos(wrap) {
  return [...wrap.querySelectorAll('.articulo-row')].map(row => ({
    nombre:      row.querySelector('[data-field="nombre"]').value.trim(),
    cantidad:    parseInt(row.querySelector('[data-field="cantidad"]').value) || 1,
    marca:       row.querySelector('[data-field="marca"]').value.trim(),
    modelo:      row.querySelector('[data-field="modelo"]').value.trim(),
    serial:      row.querySelector('[data-field="serial"]').value.trim(),
    descripcion: row.querySelector('[data-field="descripcion"]').value.trim(),
  })).filter(a => a.nombre);
}

function wireRow(row, wrap, rowCount) {
  row.querySelector('.btn-remove-row')?.addEventListener('click', () => row.remove());
  row.querySelector('.btn-dup-row')?.addEventListener('click', () => {
    const div = document.createElement('div');
    div.innerHTML = buildArticuloRow(rowCount.value++, false);
    const newRow = div.firstElementChild;
    row.after(newRow);
    wireRow(newRow, wrap, rowCount);
  });
}

function stepsHtml(active) {
  return ['Punto', 'Artículos', 'Confirmar'].map((s, i) => {
    const n = i + 1;
    const done = n < active;
    const curr = n === active;
    return `<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
      background:${curr ? 'var(--primary)' : done ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.06)'};
      color:${curr ? '#fff' : done ? '#818cf8' : 'var(--text-3)'};">
      ${done ? '✓' : n} · ${s}</span>`;
  }).join('');
}

export function openPuntoSetupModal(onSuccess) {
  let currentStep = 1;
  const data = { ciudad: '', nombre_punto: '', responsable: '', articulos: [] };
  let step2rowCount = { value: 1 };

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';

  function render() {
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:580px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Nuevo punto de atención</h2>
          <button id="ps-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
        </div>
        <div id="ps-body"></div>
      </div>`;

    overlay.querySelector('#ps-x').addEventListener('click', () => overlay.remove());
    const body = overlay.querySelector('#ps-body');

    if (currentStep === 1) {
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:22px;">${stepsHtml(1)}</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">CIUDAD *</label>
            <input id="ps-ciudad" type="text" value="${data.ciudad}" placeholder="Ej: CALI, BOGOTÁ…"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;text-transform:uppercase;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">NOMBRE DEL PUNTO *</label>
            <input id="ps-nombre" type="text" value="${data.nombre_punto}" placeholder="Ej: MI FARMACIA - CALI CENTRO"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">RESPONSABLE EN PUNTO <span style="font-weight:400;color:var(--text-3);">(opcional)</span></label>
            <input id="ps-responsable" type="text" value="${data.responsable}" placeholder="Nombre del receptor en destino"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px;gap:8px;">
          <button id="ps-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">Cancelar</button>
          <button id="ps-next1" class="btn btn-primary">Siguiente →</button>
        </div>`;

      body.querySelector('#ps-cancel').addEventListener('click', () => overlay.remove());
      body.querySelector('#ps-next1').addEventListener('click', () => {
        const ciudad = body.querySelector('#ps-ciudad').value.trim().toUpperCase();
        const nombre = body.querySelector('#ps-nombre').value.trim();
        if (!ciudad || !nombre) { showToast('Ciudad y nombre del punto son obligatorios', 'error'); return; }
        data.ciudad = ciudad;
        data.nombre_punto = nombre;
        data.responsable = body.querySelector('#ps-responsable').value.trim();
        currentStep = 2;
        render();
      });
      setTimeout(() => body.querySelector('#ps-ciudad')?.focus(), 50);
    }

    else if (currentStep === 2) {
      step2rowCount = { value: 1 };
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:22px;">${stepsHtml(2)}</div>
        <p style="font-size:12px;color:var(--text-3);margin-bottom:12px;">Si agregas artículos se crea un despacho + trazabilidad automáticamente. Puedes omitir este paso.</p>
        <div id="ps-articulos-wrap">${buildArticuloRow(0, true)}</div>
        <button type="button" id="ps-add-row" style="font-size:12px;color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 0;margin-top:4px;">+ Agregar artículo</button>
        <div style="display:flex;justify-content:space-between;margin-top:20px;gap:8px;">
          <button id="ps-back2" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">← Anterior</button>
          <div style="display:flex;gap:8px;">
            <button id="ps-skip2" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">Omitir artículos</button>
            <button id="ps-next2" class="btn btn-primary">Siguiente →</button>
          </div>
        </div>`;

      const wrap = body.querySelector('#ps-articulos-wrap');
      wireRow(wrap.querySelector('.articulo-row'), wrap, step2rowCount);

      body.querySelector('#ps-add-row').addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = buildArticuloRow(step2rowCount.value++, false);
        const row = div.firstElementChild;
        wrap.appendChild(row);
        wireRow(row, wrap, step2rowCount);
      });

      body.querySelector('#ps-back2').addEventListener('click', () => { currentStep = 1; render(); });

      body.querySelector('#ps-skip2').addEventListener('click', () => {
        data.articulos = [];
        currentStep = 3;
        render();
      });

      body.querySelector('#ps-next2').addEventListener('click', () => {
        data.articulos = collectArticulos(wrap);
        currentStep = 3;
        render();
      });
    }

    else if (currentStep === 3) {
      const arts = data.articulos;
      const articulosHtml = arts.length
        ? arts.map(a => `
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:4px;">
              <span style="width:14px;height:14px;border:1px solid var(--primary);border-radius:3px;display:inline-block;flex-shrink:0;"></span>
              ${a.nombre} × ${a.cantidad}${a.marca ? ' — ' + a.marca : ''}
            </div>`).join('')
        : `<div style="font-size:12px;color:var(--text-3);font-style:italic;">Sin artículos — solo se creará el punto.</div>`;

      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:22px;">${stepsHtml(3)}</div>
        <div style="background:var(--surface-2);border-radius:8px;padding:14px;margin-bottom:12px;font-size:13px;display:flex;flex-direction:column;gap:6px;">
          <div>✅ Punto: <strong>${data.nombre_punto}</strong></div>
          <div>📍 Ciudad: <strong>${data.ciudad}</strong></div>
          ${data.responsable ? `<div>👤 Responsable: <strong>${data.responsable}</strong></div>` : ''}
          ${arts.length ? `
          <div>📦 Despacho automático (${arts.length} artículo${arts.length !== 1 ? 's' : ''})</div>
          <div>🔗 Trazabilidad con link público para confirmación en destino</div>` : ''}
        </div>
        ${arts.length ? `
        <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#818cf8;margin-bottom:8px;">Checklist que se generará</div>
          ${articulosHtml}
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-top:20px;gap:8px;">
          <button id="ps-back3" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">← Anterior</button>
          <button id="ps-submit" class="btn btn-primary" style="background:#10b981;border-color:#10b981;">✓ Crear punto</button>
        </div>`;

      body.querySelector('#ps-back3').addEventListener('click', () => { currentStep = 2; render(); });

      body.querySelector('#ps-submit').addEventListener('click', async () => {
        const btn = body.querySelector('#ps-submit');
        btn.disabled = true;
        btn.textContent = 'Creando…';
        try {
          const res = await fetch('/api/sedes/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ciudad: data.ciudad,
              nombre_punto: data.nombre_punto,
              responsable: data.responsable,
              articulos: data.articulos,
              agente: state.currentAgent?.name || 'IT',
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Error al crear el punto');

          overlay.remove();
          showToast(`Punto ${data.nombre_punto} creado${json.despacho_id ? ' · Despacho generado' : ''}`, 'success');
          if (json.tracking_url) {
            navigator.clipboard?.writeText(json.tracking_url).catch(() => {});
            showToast('Link de trazabilidad copiado al portapapeles', 'info');
          }
          onSuccess?.();
        } catch (e) {
          showToast(e.message, 'error');
          btn.disabled = false;
          btn.textContent = '✓ Crear punto';
        }
      });
    }
  }

  document.body.appendChild(overlay);
  render();
}

export async function openChecklistModal(sedeId) {
  let data;
  try {
    const res = await fetch(`/api/sedes/${sedeId}/checklist`);
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar checklist');
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  if (!data.checklist) {
    showToast('Este punto no tiene despacho asociado', 'info');
    return;
  }

  const cl = data.checklist;
  const BADGE = {
    creado:      { label: 'Pendiente envío', color: '#facc15', bg: 'rgba(234,179,8,.12)',    border: 'rgba(234,179,8,.2)',    icon: '📦' },
    en_transito: { label: 'En tránsito',     color: '#818cf8', bg: 'rgba(99,102,241,.1)',     border: 'rgba(99,102,241,.2)',   icon: '🚚' },
    en_sede:     { label: 'En sede',          color: '#34d399', bg: 'rgba(16,185,129,.1)',     border: 'rgba(16,185,129,.2)',   icon: '📍' },
    entregado:   { label: 'Entregado',        color: '#34d399', bg: 'rgba(16,185,129,.1)',     border: 'rgba(16,185,129,.2)',   icon: '✅' },
  };
  const est = BADGE[cl.estado] || BADGE.creado;

  const rowIcon = cl.estado === 'entregado' ? '✅' : cl.estado === 'en_transito' ? '🚚' : '📦';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;">
        <div>
          <h2 style="margin:0 0 6px;font-size:16px;font-weight:700;color:var(--text);">${cl.nombre_punto}</h2>
          <span style="font-size:12px;padding:3px 10px;border-radius:12px;background:${est.bg};color:${est.color};border:1px solid ${est.border};">${est.icon} ${est.label}</span>
        </div>
        <button id="cl-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;flex-shrink:0;">✕</button>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);margin-bottom:8px;">Artículos despachados</div>
        ${cl.articulos.map(a => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="font-size:16px;">${rowIcon}</span>
            <div style="flex:1;">
              <div style="font-size:13px;">${a.nombre}</div>
              ${a.marca ? `<div style="font-size:11px;color:var(--text-3);">${a.marca}${a.modelo ? ' · ' + a.modelo : ''}${a.serial ? ' · SN: ' + a.serial : ''}</div>` : ''}
            </div>
            <span style="font-size:12px;color:var(--text-3);">× ${a.cantidad}</span>
          </div>`).join('')}
      </div>

      <div id="cl-actions"></div>
    </div>`;

  overlay.querySelector('#cl-x').addEventListener('click', () => overlay.remove());

  const actionsEl = overlay.querySelector('#cl-actions');

  if (cl.estado === 'creado') {
    actionsEl.innerHTML = `
      <button id="cl-enviado" class="btn btn-primary" style="width:100%;justify-content:center;">✓ Marcar como enviado</button>`;
    actionsEl.querySelector('#cl-enviado').addEventListener('click', async () => {
      const btn = actionsEl.querySelector('#cl-enviado');
      btn.disabled = true;
      btn.textContent = 'Marcando…';
      try {
        const res = await fetch(`/api/sedes/${sedeId}/marcar-enviado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agente: state.currentAgent?.name || 'IT' }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error');
        showToast('Marcado como enviado · Comparte el link con el punto', 'success');
        overlay.remove();
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = '✓ Marcar como enviado';
      }
    });
  } else if (cl.estado === 'en_transito' || cl.estado === 'en_sede') {
    actionsEl.innerHTML = `
      <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:12px;">
        <div style="font-size:11px;font-weight:600;color:#818cf8;margin-bottom:6px;">Link para confirmar recepción en el punto:</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input readonly value="${cl.tracking_url}" id="cl-link-input"
            style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:11px;min-width:0;">
          <button id="cl-copy" style="padding:6px 12px;border:1px solid var(--primary);border-radius:6px;background:rgba(99,102,241,.15);color:#818cf8;font-size:12px;cursor:pointer;white-space:nowrap;">Copiar</button>
        </div>
      </div>`;
    actionsEl.querySelector('#cl-copy').addEventListener('click', () => {
      navigator.clipboard?.writeText(cl.tracking_url).then(() => showToast('Link copiado', 'success'));
    });
  }

  document.body.appendChild(overlay);
}
```

- [ ] **Step 2: Verify file saved correctly — check export names**

```bash
grep "^export" public/js/punto-setup-modal.js
```

Expected:
```
export function openPuntoSetupModal(onSuccess) {
export async function openChecklistModal(sedeId) {
```

- [ ] **Step 3: Commit**

```bash
git add public/js/punto-setup-modal.js
git commit -m "feat(sedes): add punto-setup-modal with 3-step creation modal and checklist modal"
```

---

## Task 5: Frontend — Update `sedes-admin.js`

**Files:**
- Modify: `public/js/sedes-admin.js`

- [ ] **Step 1: Add imports at top of sedes-admin.js**

Current line 1-5:
```js
/**
 * Gestión de Red de Puntos desde el panel de administración.
 */
import { showToast } from './components.js';
import { iconMapPin } from './icons.js';
```

Replace with:
```js
/**
 * Gestión de Red de Puntos desde el panel de administración.
 */
import { showToast } from './components.js';
import { iconMapPin } from './icons.js';
import { openPuntoSetupModal, openChecklistModal } from './punto-setup-modal.js';
```

- [ ] **Step 2: Replace inline form card with "Nuevo punto" button**

Find and replace the "Formulario agregar" card block. In `sedes-admin.js`, find:

```js
    <!-- Formulario agregar -->
    <div class="card" style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:14px;">Agregar nuevo punto</div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;">
        <div class="form-group" style="margin:0;">
          <label>Ciudad</label>
          <input type="text" id="new-sede-ciudad" placeholder="Ej: CALI, MANIZALES…" autocomplete="off" style="text-transform:uppercase;">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Nombre del punto</label>
          <input type="text" id="new-sede-punto" placeholder="Ej: MI FARMACIA - CALI CENTRO" autocomplete="off">
        </div>
        <button class="btn btn-primary" id="btn-add-sede" style="height:38px;padding:0 18px;">Agregar</button>
      </div>
    </div>
```

Replace with:

```js
    <!-- Botón nuevo punto -->
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end;">
      <button id="btn-nuevo-punto" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:7px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo punto
      </button>
    </div>
```

- [ ] **Step 3: Update the punto row render template inside `renderList` (or equivalent render function)**

In `sedes-admin.js`, find the `puntos.map(p => ...)` template. It currently looks like:

```js
            ${puntos.map(p => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.04);${!p.activo ? 'opacity:.5;' : ''}">
                <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${p.activo ? '#10b981' : '#6b7280'};"></span>
                <span style="flex:1;font-size:13px;">${p.nombre_punto}</span>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  <button class="btn-sede-toggle" data-id="${p.id}" data-activo="${p.activo}"
```

Replace the entire `puntos.map(...)` block with:

```js
            ${puntos.map(p => {
              const trackingEstado = p.tracking_estado;
              const badgeHtml = trackingEstado === 'creado'
                ? `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(234,179,8,.12);color:#facc15;border:1px solid rgba(234,179,8,.2);">📦 Pendiente envío</span>`
                : trackingEstado === 'en_transito'
                ? `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.2);">🚚 En tránsito</span>`
                : (trackingEstado === 'en_sede' || trackingEstado === 'entregado')
                ? `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(16,185,129,.1);color:#34d399;border:1px solid rgba(16,185,129,.2);">✅ Entregado</span>`
                : '';
              const checklistBtn = p.despacho_id
                ? `<button class="btn-ver-checklist" data-id="${p.id}" style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);font-size:11px;cursor:pointer;">Ver checklist</button>`
                : '';
              return `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.04);flex-wrap:wrap;${!p.activo ? 'opacity:.5;' : ''}">
                <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${p.activo ? '#10b981' : '#6b7280'};"></span>
                <span style="flex:1;font-size:13px;min-width:120px;">${p.nombre_punto}</span>
                ${badgeHtml}
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  ${checklistBtn}
                  <button class="btn-sede-toggle" data-id="${p.id}" data-activo="${p.activo}"
                    style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);font-size:11px;cursor:pointer;">
                    ${p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button class="btn-sede-delete" data-id="${p.id}"
                    style="padding:4px 10px;border:1px solid rgba(239,68,68,.3);border-radius:6px;background:rgba(239,68,68,.1);color:#f87171;font-size:11px;cursor:pointer;">
                    Eliminar
                  </button>
                </div>
              </div>`;
            }).join('')}
```

Note: the `.map(p => `` ...)`` `` ` template changed to `.map(p => { ... return \`...\`; })` to allow the `const` declarations inside.

- [ ] **Step 4: Add event listeners for `#btn-nuevo-punto` and `.btn-ver-checklist`**

In `sedes-admin.js`, find the section where `btn-add-sede` click handler was registered:

```js
  // Agregar nuevo punto
  document.getElementById('btn-add-sede').addEventListener('click', async () => {
    ...
  });

  // Enter en los campos de texto
  ['new-sede-ciudad', 'new-sede-punto'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-add-sede').click();
    });
  });
```

Replace entirely with:

```js
  // Nuevo punto — abre modal multi-paso
  container.querySelector('#btn-nuevo-punto').addEventListener('click', () => {
    openPuntoSetupModal(() => loadSedes());
  });
```

Then, inside `renderList` (or wherever the toggle/delete listeners are wired up after rendering), add event delegation for checklist buttons. Find the block that does `.querySelectorAll('.btn-sede-toggle')` and `.querySelectorAll('.btn-sede-delete')` and add after it:

```js
    listEl.querySelectorAll('.btn-ver-checklist').forEach(btn => {
      btn.addEventListener('click', () => openChecklistModal(parseInt(btn.dataset.id)));
    });
```

- [ ] **Step 5: Verify the page loads without errors**

Open the app in the browser, navigate to Settings → Red de Puntos. Verify:
- "Nuevo punto" button appears where the inline form was
- Existing puntos still display correctly
- Puntos with `despacho_id` show "Ver checklist" button
- Click "Nuevo punto" → 3-step modal opens

- [ ] **Step 6: End-to-end test**

1. Click "Nuevo punto"
2. Fill ciudad "MEDELLIN", nombre "FARMACIA TEST E2E", responsable "Test User"
3. Click "Siguiente" → Step 2 (artículos)
4. Add article: "Monitor" × 1, marca "Samsung"
5. Click "Siguiente" → Step 3 (confirmar) — should show resumen with checklist preview
6. Click "Crear punto" → toast appears, modal closes, list reloads
7. New punto appears with badge "📦 Pendiente envío" and "Ver checklist" button
8. Click "Ver checklist" → modal opens showing "Monitor × 1" and "Marcar como enviado" button
9. Click "Marcar como enviado" → toast, modal closes
10. Click "Ver checklist" again → badge now shows "🚚 En tránsito" and link copiable
11. Navigate to Trazabilidad → new despacho appears in the tracking list

- [ ] **Step 7: Commit**

```bash
git add public/js/sedes-admin.js
git commit -m "feat(sedes): replace inline form with multi-step modal; add checklist badges and buttons"
```

---

## Self-Review Checklist

- [x] **DB migration**: 2 columns added with `ALTER TABLE` — caught by `try/catch` if column already exists ✓
- [x] **POST /setup**: transaction wraps all inserts — rollback on error ✓
- [x] **generateDespachoNumero**: same pattern as existing `generateNumero` in despacho-routes.js ✓
- [x] **createTracking signature**: `(db, despachoId, agentName, ubicacionOrigen)` — matches tracking-model.js:3 ✓
- [x] **addEvento signature**: `(db, trackingId, { tipo, entregado_por, observaciones })` — matches tracking-model.js:80 ✓
- [x] **GET /api/sedes**: explicit column list updated — `despacho_id` and `tracking_token` now included ✓
- [x] **sedes-admin.js map**: changed from template-literal arrow to block-body arrow to support const declarations ✓
- [x] **openChecklistModal**: imported in sedes-admin.js ✓
- [x] **Tracking visible in Trazabilidad**: uses same `paquete_tracking` table — appears automatically ✓
