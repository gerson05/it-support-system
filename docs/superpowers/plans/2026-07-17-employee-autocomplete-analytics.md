# Employee Autocomplete, Analytics & Technician Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared employee autocomplete widget, analytics section in dashboard, and employee-based technician assignment to tickets.

**Architecture:** A new shared widget `public/js/core/empleado-search.js` is imported by tech-request-form and ticket-detail. Two new PUT endpoints handle requester correction and technician assignment in ticket-routes.js. Analytics data comes from a new GET endpoint in metrics-routes.js and renders as a collapsible section appended to the existing dashboard.

**Tech Stack:** Vanilla ES modules, Express.js, Node.js built-in SQLite (DatabaseSync), Chart.js (already loaded in dashboard)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `public/js/core/empleado-search.js` | CREATE | Reusable autocomplete widget |
| `public/js/features/tech-requests/tech-request-form.js` | EDIT | Attach widget to solicitante fields |
| `public/js/features/tickets/ticket-detail.js` | EDIT | Requester edit mode + technician assignment UI |
| `src/tickets/ticket-routes.js` | EDIT | PUT /api/tickets/:id/requester and PUT /api/tickets/:id/assign |
| `src/metrics/metrics-routes.js` | EDIT | GET /api/analytics/dashboard |
| `public/js/features/dashboard/dashboard.js` | EDIT | Render analytics section after existing content |

---

## Task 1: Create shared employee autocomplete widget

**Files:**
- Create: `public/js/core/empleado-search.js`

- [ ] **Step 1: Create the widget file**

```js
// public/js/core/empleado-search.js

/**
 * Attaches employee autocomplete to a name input and an optional cedula input.
 * Calls GET /api/erp/empleados?q= after 250ms debounce (min 2 chars).
 * Uses mousedown on dropdown items to prevent blur race condition.
 *
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null} cedulaInput  - filled read-only on selection
 * @param {{ onSelect?: (emp: object) => void }} options
 */
export function createEmpleadoSearch(nameInput, cedulaInput, options = {}) {
  if (!nameInput) return;

  let _timer = null;
  let _drop  = null;

  function _closeDrop() { _drop?.remove(); _drop = null; }

  function _openDrop(rows) {
    _closeDrop();
    if (!rows.length) {
      _drop = document.createElement('div');
      _drop.style.cssText = _dropStyle();
      _drop.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--text-3);">Sin resultados</div>';
      _wrap(_drop);
      return;
    }

    _drop = document.createElement('div');
    _drop.style.cssText = _dropStyle();

    rows.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);';
      item.innerHTML = `
        <div style="font-weight:600;color:var(--text);">${r.nombre}</div>
        <div style="color:var(--text-3);">${r.cedula}${r.cargo ? ' · ' + r.cargo : ''}${r.area ? ' · ' + r.area : ''}</div>
      `;
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-2)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        nameInput.value = r.nombre;
        if (cedulaInput) { cedulaInput.value = r.cedula; cedulaInput.readOnly = true; }
        _closeDrop();
        options.onSelect?.(r);
      });
      _drop.appendChild(item);
    });

    _wrap(_drop);
  }

  function _dropStyle() {
    return 'position:absolute;z-index:2000;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);max-height:200px;overflow-y:auto;min-width:100%;top:100%;left:0;';
  }

  function _wrap(drop) {
    let wrap = nameInput.parentElement;
    if (wrap.dataset.empSearch !== '1') {
      const newWrap = document.createElement('div');
      newWrap.style.cssText = 'position:relative;';
      newWrap.dataset.empSearch = '1';
      nameInput.parentNode.insertBefore(newWrap, nameInput);
      newWrap.appendChild(nameInput);
      wrap = newWrap;
    }
    wrap.appendChild(drop);
  }

  nameInput.addEventListener('input', () => {
    clearTimeout(_timer);
    const q = nameInput.value.trim();
    if (q.length < 2) { _closeDrop(); return; }
    _timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/erp/empleados?q=${encodeURIComponent(q)}`);
        const rows = await res.json();
        _openDrop(rows);
      } catch { _closeDrop(); }
    }, 250);
  });

  nameInput.addEventListener('blur', () => setTimeout(_closeDrop, 150));

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeDrop();
  });
}
```

- [ ] **Step 2: Verify file exists and exports correctly**

```bash
node --input-type=module << 'EOF'
import { createEmpleadoSearch } from './public/js/core/empleado-search.js';
console.log(typeof createEmpleadoSearch); // should print "function"
EOF
```
Expected output: `function`

- [ ] **Step 3: Commit**

```bash
git add public/js/core/empleado-search.js
git commit -m "feat: add shared createEmpleadoSearch autocomplete widget"
```

---

## Task 2: Attach autocomplete to tech-request-form

**Files:**
- Modify: `public/js/features/tech-requests/tech-request-form.js`

- [ ] **Step 1: Add the import at the top of the file**

Find the existing imports block (lines 1-14) and add one line:

```js
import { createEmpleadoSearch } from '../../core/empleado-search.js';
```

Add it after the last existing import line:
```js
import {
  iconNote, iconPlus, iconClose, iconEdit,
  iconClipboard, iconWrench, iconCopy, iconSave,
} from '../../utils/icons.js';
import { createEmpleadoSearch } from '../../core/empleado-search.js';
```

- [ ] **Step 2: Attach widget in openModal after wireModalCommon**

In `openModal`, find the line:
```js
  const closeModal = wireModalCommon(overlay, modal, modalItems);
```

Add immediately after it:
```js
  createEmpleadoSearch(
    document.getElementById('tr-f-name'),
    document.getElementById('tr-f-cedula')
  );
```

- [ ] **Step 3: Attach widget in openEditModal after wireModalCommon**

In `openEditModal`, find the same line:
```js
  const closeModal = wireModalCommon(overlay, modal, modalItems);
```

Add immediately after it:
```js
  createEmpleadoSearch(
    document.getElementById('tr-f-name'),
    document.getElementById('tr-f-cedula')
  );
```

- [ ] **Step 4: Manual test**

Start the app (`node server.js`), open a tech-request form, type 2+ characters in the "Nombre completo" field. Verify dropdown appears with employee names and that selecting one fills both name and cédula.

- [ ] **Step 5: Commit**

```bash
git add public/js/features/tech-requests/tech-request-form.js
git commit -m "feat: attach employee autocomplete to tech-request solicitante fields"
```

---

## Task 3: Add API endpoints for requester update and technician assignment

**Files:**
- Modify: `src/tickets/ticket-routes.js`

- [ ] **Step 1: Add PUT /api/tickets/:id/requester after the existing PUT /api/agents/:id route**

Find the line:
```js
router.put('/api/agents/:id', ...canEdit, wrap(async (req, res) => {
```

Add the following two new routes **before** that line (append after the last `router.get('/api/agents', ...)` block):

```js
router.put('/api/tickets/:id/requester', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { requester_name, cedula, agentName = 'Agente' } = req.body;

  if (!requester_name?.trim()) {
    return res.status(400).json({ error: 'El nombre del solicitante es requerido.' });
  }

  const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });

  db.prepare(`UPDATE tickets SET requester_name = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(requester_name.trim(), ticketId);

  logAudit(agentName, 'Solicitante actualizado', 'ticket', ticketId, ticket.ticket_number, { requester_name, cedula });

  res.json({ success: true });
}));

router.put('/api/tickets/:id/assign', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { nombre, cedula, agentName = 'Agente' } = req.body;

  if (!nombre?.trim() || !cedula?.trim()) {
    return res.status(400).json({ error: 'Nombre y cédula son requeridos.' });
  }

  const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });

  let agent = db.prepare('SELECT id FROM agents WHERE name = ?').get(nombre.trim());
  if (!agent) {
    const result = db.prepare('INSERT INTO agents (name) VALUES (?)').run(nombre.trim());
    agent = { id: result.lastInsertRowid };
  }

  db.prepare(`UPDATE tickets SET assigned_to = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(agent.id, ticketId);

  logAudit(agentName, 'Técnico asignado', 'ticket', ticketId, ticket.ticket_number, { nombre, cedula });

  res.json({ success: true, agent_id: agent.id, agent_name: nombre.trim() });
}));
```

- [ ] **Step 2: Verify server starts without errors**

```bash
node server.js
```
Expected: Server starts, no import or syntax errors in output.

- [ ] **Step 3: Smoke-test both endpoints with curl**

```bash
# Get a real ticket ID first
curl -s http://localhost:3000/api/tickets?limit=1 | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).tickets[0]?.id)"

# Test requester update (replace 1 with real ticket id)
curl -s -X PUT http://localhost:3000/api/tickets/1/requester \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"requester_name":"GERSON TEST","agentName":"test"}'

# Test assign
curl -s -X PUT http://localhost:3000/api/tickets/1/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"nombre":"GERSON DJHB","cedula":"1234567","agentName":"test"}'
```
Expected: Both return `{"success":true,...}`

- [ ] **Step 4: Commit**

```bash
git add src/tickets/ticket-routes.js
git commit -m "feat: add PUT /api/tickets/:id/requester and /assign endpoints"
```

---

## Task 4: Update ticket-detail UI — requester edit + technician assignment

**Files:**
- Modify: `public/js/features/tickets/ticket-detail.js`

- [ ] **Step 1: Add import for createEmpleadoSearch**

In the imports at the top of the file (after line 13), add:
```js
import { createEmpleadoSearch } from '../../core/empleado-search.js';
```

- [ ] **Step 2: Add edit button to the requester display row**

Find this exact block (around line 140):
```js
                <div class="info-details-item">
                  <span class="info-details-label">Solicitante:</span>
                  <span class="info-details-val">${ticket.requester_name || 'Sin registrar'}</span>
                </div>
```

Replace with:
```js
                <div class="info-details-item" style="align-items:flex-start;">
                  <span class="info-details-label">Solicitante:</span>
                  <div style="display:flex;flex-direction:column;gap:6px;flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="info-details-val" id="requester-display">${ticket.requester_name || 'Sin registrar'}</span>
                      <button id="btn-edit-requester" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:2px 4px;border-radius:4px;font-size:11px;line-height:1;" title="Editar solicitante">✏️</button>
                    </div>
                    <div id="requester-edit-form" style="display:none;flex-direction:column;gap:6px;">
                      <input type="text" id="requester-name-input" placeholder="Nombre del solicitante" style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;width:100%;" autocomplete="off">
                      <input type="text" id="requester-cedula-input" placeholder="Cédula (auto)" readonly style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:12px;width:100%;">
                      <div style="display:flex;gap:6px;">
                        <button id="btn-save-requester" class="btn btn-primary" style="padding:5px 12px;font-size:12px;">Guardar</button>
                        <button id="btn-cancel-requester" class="btn btn-secondary" style="padding:5px 12px;font-size:12px;">Cancelar</button>
                      </div>
                    </div>
                  </div>
                </div>
```

- [ ] **Step 3: Replace the assign-agent select with employee search UI**

Find this exact block (around line 196):
```js
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="assign-agent">Agente Asignado</label>
                  <select id="assign-agent">
                    <option value="">Sin Asignar</option>
                    <!-- Agentes se cargan dinámicamente -->
                  </select>
                </div>
```

Replace with:
```js
                <div class="form-group" style="margin-bottom: 0;">
                  <label>Técnico Asignado</label>
                  <input type="text" id="assign-tecnico-name" placeholder="Buscar empleado…" autocomplete="off"
                    style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;width:100%;box-sizing:border-box;">
                  <input type="text" id="assign-tecnico-cedula" readonly placeholder="Cédula (auto)"
                    style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:12px;width:100%;box-sizing:border-box;margin-top:4px;">
                  <button id="btn-assign-tecnico" class="btn btn-secondary" disabled
                    style="width:100%;margin-top:6px;padding:7px;">Asignar técnico</button>
                </div>
```

- [ ] **Step 4: Replace the agent-loading block with employee search setup**

Find this block (around line 297):
```js
      // Rellenar lista de agentes en la sección de asignación
      const assignSelect = document.getElementById('assign-agent');
      if (assignSelect) {
        const agents = await DataService.getAgents().catch(() => []);
        assignSelect.innerHTML = '<option value="">Sin Asignar</option>' +
          agents.map(a =>
            `<option value="${a.id}" ${ticket.assigned_to === a.id ? 'selected' : ''}>${a.name}</option>`
          ).join('');
      }
```

Replace with:
```js
      // Setup technician assignment with employee autocomplete
      const techNameInput   = document.getElementById('assign-tecnico-name');
      const techCedulaInput = document.getElementById('assign-tecnico-cedula');
      const btnAssign       = document.getElementById('btn-assign-tecnico');

      if (techNameInput) {
        // Show current assignee name in the input
        if (ticket.assigned_to) {
          const agents = await DataService.getAgents().catch(() => []);
          const cur = agents.find(a => a.id === ticket.assigned_to);
          if (cur) techNameInput.value = cur.name;
        }

        createEmpleadoSearch(techNameInput, techCedulaInput, {
          onSelect: () => { if (btnAssign) btnAssign.disabled = false; }
        });

        btnAssign?.addEventListener('click', async () => {
          const nombre = techNameInput.value.trim();
          const cedula = techCedulaInput?.value.trim();
          if (!nombre || !cedula) return;
          btnAssign.disabled = true;
          try {
            const res = await fetch(`/api/tickets/${ticketId}/assign`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nombre, cedula, agentName: state.currentUser?.username || 'Agente' }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            showToast(`Ticket asignado a ${nombre}`, 'success');
            await loadTicketData();
          } catch (err) {
            showToast(err.message || 'Error al asignar técnico', 'error');
            btnAssign.disabled = false;
          }
        });
      }

      // Requester edit mode
      const btnEditReq    = document.getElementById('btn-edit-requester');
      const editForm      = document.getElementById('requester-edit-form');
      const reqNameInput  = document.getElementById('requester-name-input');
      const reqCedInput   = document.getElementById('requester-cedula-input');

      btnEditReq?.addEventListener('click', () => {
        editForm.style.display = 'flex';
        reqNameInput.value = ticket.requester_name || '';
        reqCedInput.value  = '';
        btnEditReq.style.display = 'none';
        createEmpleadoSearch(reqNameInput, reqCedInput);
        reqNameInput.focus();
      });

      document.getElementById('btn-cancel-requester')?.addEventListener('click', () => {
        editForm.style.display = 'none';
        btnEditReq.style.display = '';
      });

      document.getElementById('btn-save-requester')?.addEventListener('click', async () => {
        const newName = reqNameInput.value.trim();
        if (!newName) { showToast('El nombre es requerido', 'error'); return; }
        try {
          const res = await fetch(`/api/tickets/${ticketId}/requester`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requester_name: newName,
              cedula: reqCedInput.value.trim() || undefined,
              agentName: state.currentUser?.username || 'Agente',
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error);
          showToast('Solicitante actualizado', 'success');
          await loadTicketData();
        } catch (err) {
          showToast(err.message || 'Error al actualizar', 'error');
        }
      });
```

- [ ] **Step 5: Remove assigned_to from the btn-save-actions handler**

Find this block (around line 366):
```js
      const btnSave = document.getElementById('btn-save-actions');
      btnSave.addEventListener('click', async () => {
        const status = document.getElementById('change-status').value;
        const priority = document.getElementById('change-priority').value;
        const assigned_to = document.getElementById('assign-agent').value;

        try {
          await DataService.updateTicket(ticketId, { status, priority, assigned_to });
```

Replace with:
```js
      const btnSave = document.getElementById('btn-save-actions');
      btnSave.addEventListener('click', async () => {
        const status = document.getElementById('change-status').value;
        const priority = document.getElementById('change-priority').value;

        try {
          await DataService.updateTicket(ticketId, { status, priority });
```

- [ ] **Step 6: Manual test**

Open a ticket detail page. Verify:
1. "Solicitante" row shows a ✏️ button — clicking it shows the name input with autocomplete
2. Typing 2+ chars shows employee dropdown; selecting fills cedula
3. "Guardar" updates the displayed name
4. "Técnico Asignado" shows a text input — "Asignar técnico" button is disabled until an employee is selected from dropdown
5. After assignment, the input shows the new assignee name

- [ ] **Step 7: Commit**

```bash
git add public/js/features/tickets/ticket-detail.js
git commit -m "feat: add requester edit mode and employee-based technician assignment to ticket detail"
```

---

## Task 5: Add analytics API endpoint

**Files:**
- Modify: `src/metrics/metrics-routes.js`

- [ ] **Step 1: Append the analytics endpoint at the end of the file, before `export default router`**

Find the last line of the file:
```js
export default router;
```

Insert before it:
```js
router.get('/api/analytics/dashboard', requireAuth, requirePermission('metrics:read'), wrap(async (req, res) => {
  const { cedula } = req.query;

  const ticketsPorArea = db.prepare(`
    SELECT area,
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'abierto' THEN 1 ELSE 0 END) AS abiertos,
           SUM(CASE WHEN status NOT IN ('abierto','en_progreso','en_espera','siguiente_dia') THEN 1 ELSE 0 END) AS cerrados
    FROM tickets
    GROUP BY area
    ORDER BY total DESC
    LIMIT 10
  `).all();

  const topSolicitantes = db.prepare(`
    SELECT requester_name, COUNT(*) AS total
    FROM tickets
    WHERE requester_name IS NOT NULL AND requester_name != 'Sin nombre'
    GROUP BY requester_name
    ORDER BY total DESC
    LIMIT 10
  `).all();

  const despachos = cedula
    ? db.prepare(`
        SELECT numero, destinatario, cedula, sede, fecha, articulos
        FROM despachos
        WHERE cedula = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(cedula)
    : db.prepare(`
        SELECT numero, destinatario, cedula, sede, fecha, articulos
        FROM despachos
        ORDER BY created_at DESC
        LIMIT 50
      `).all();

  res.json({ tickets_por_area: ticketsPorArea, top_solicitantes: topSolicitantes, despachos });
}));

```

- [ ] **Step 2: Smoke-test the endpoint**

```bash
node server.js &
curl -s http://localhost:3000/api/analytics/dashboard | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const j = JSON.parse(d);
  console.log('areas:', j.tickets_por_area?.length);
  console.log('solicitantes:', j.top_solicitantes?.length);
  console.log('despachos:', j.despachos?.length);
"
```
Expected: prints three counts (numbers, not errors)

- [ ] **Step 3: Commit**

```bash
git add src/metrics/metrics-routes.js
git commit -m "feat: add GET /api/analytics/dashboard endpoint"
```

---

## Task 6: Add analytics section to dashboard

**Files:**
- Modify: `public/js/features/dashboard/dashboard.js`

- [ ] **Step 1: Add the analytics section HTML placeholder inside the container HTML**

In `renderDashboard`, find the closing of `#dashboard-content`:
```js
      <!-- Tickets recientes -->
      <div class="card">
        ...
        <div class="table-container">
          ...
        </div>
      </div>
    </div>
  `;
```

Add the analytics section div before the closing `</div>` of `#dashboard-content`:
```js
      <!-- Analytics -->
      <div id="analytics-section" style="margin-top:16px;"></div>
    </div>
  `;
```

- [ ] **Step 2: Add renderAnalyticsSection function before renderDashboard**

Add this function before the `export async function renderDashboard` line:

```js
async function renderAnalyticsSection() {
  const section = document.getElementById('analytics-section');
  if (!section) return;

  section.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:12px;">
      ${IC.bar} Analítica Operacional
    </div>

    <details style="margin-bottom:12px;" open>
      <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-2);padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;list-style:none;display:flex;align-items:center;gap:8px;">
        ${IC.bar} Tickets por Área — Top 10
      </summary>
      <div class="card" style="border-radius:0 0 10px 10px;margin-top:-1px;" id="analytics-por-area">
        <div style="color:var(--text-3);font-size:12px;text-align:center;padding:20px;">Cargando…</div>
      </div>
    </details>

    <details style="margin-bottom:12px;">
      <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-2);padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;list-style:none;display:flex;align-items:center;gap:8px;">
        ${IC.ticket} Top Solicitantes
      </summary>
      <div class="card" style="border-radius:0 0 10px 10px;margin-top:-1px;" id="analytics-solicitantes">
        <div style="color:var(--text-3);font-size:12px;text-align:center;padding:20px;">Cargando…</div>
      </div>
    </details>

    <details>
      <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-2);padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;list-style:none;display:flex;align-items:center;gap:8px;">
        ${IC.inbox} Historial de Despachos
      </summary>
      <div class="card" style="border-radius:0 0 10px 10px;margin-top:-1px;">
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <input type="text" id="analytics-cedula-input" placeholder="Filtrar por cédula…"
            style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
          <button id="analytics-cedula-btn" class="btn btn-secondary" style="padding:7px 14px;font-size:12px;">Buscar</button>
        </div>
        <div id="analytics-despachos">
          <div style="color:var(--text-3);font-size:12px;text-align:center;padding:20px;">Cargando…</div>
        </div>
      </div>
    </details>
  `;

  async function loadAnalytics(cedula = '') {
    try {
      const url = '/api/analytics/dashboard' + (cedula ? `?cedula=${encodeURIComponent(cedula)}` : '');
      const data = await fetch(url).then(r => r.json());

      // Tickets por área
      const areaEl = document.getElementById('analytics-por-area');
      if (areaEl) {
        if (!data.tickets_por_area?.length) {
          areaEl.innerHTML = '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:16px 0;">Sin datos</p>';
        } else {
          const max = Math.max(...data.tickets_por_area.map(a => a.total), 1);
          areaEl.innerHTML = data.tickets_por_area.map(item => {
            const pct = Math.round((item.total / max) * 100);
            return `
              <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:12px;color:var(--text-2);">${item.area || 'General'}</span>
                  <span style="font-size:12px;font-weight:700;color:var(--text);">${item.total} <span style="font-weight:400;color:var(--text-3);">(${item.abiertos} abiertos)</span></span>
                </div>
                <div style="height:5px;background:var(--surface-3);border-radius:99px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:99px;"></div>
                </div>
              </div>`;
          }).join('');
        }
      }

      // Top solicitantes
      const solEl = document.getElementById('analytics-solicitantes');
      if (solEl) {
        if (!data.top_solicitantes?.length) {
          solEl.innerHTML = '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:16px 0;">Sin datos</p>';
        } else {
          solEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border);">
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">#</th>
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">Nombre</th>
                  <th style="text-align:right;padding:6px 8px;color:var(--text-3);font-weight:600;">Tickets</th>
                </tr>
              </thead>
              <tbody>
                ${data.top_solicitantes.map((s, i) => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:8px;color:var(--text-3);">${i + 1}</td>
                    <td style="padding:8px;color:var(--text);">${s.requester_name}</td>
                    <td style="padding:8px;text-align:right;font-weight:700;color:var(--text);">${s.total}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`;
        }
      }

      // Despachos
      const despEl = document.getElementById('analytics-despachos');
      if (despEl) {
        if (!data.despachos?.length) {
          despEl.innerHTML = '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:16px 0;">Sin despachos encontrados</p>';
        } else {
          despEl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border);">
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">Número</th>
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">Destinatario</th>
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">Cédula</th>
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">Sede</th>
                  <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">Fecha</th>
                  <th style="text-align:right;padding:6px 8px;color:var(--text-3);font-weight:600;">Ítems</th>
                </tr>
              </thead>
              <tbody>
                ${data.despachos.map(d => {
                  let itemCount = 0;
                  try { itemCount = JSON.parse(d.articulos || '[]').length; } catch {}
                  return `
                    <tr style="border-bottom:1px solid var(--border);">
                      <td style="padding:8px;color:var(--text);font-weight:600;">${d.numero}</td>
                      <td style="padding:8px;color:var(--text);">${d.destinatario || '—'}</td>
                      <td style="padding:8px;color:var(--text-3);">${d.cedula || '—'}</td>
                      <td style="padding:8px;color:var(--text-2);">${d.sede || '—'}</td>
                      <td style="padding:8px;color:var(--text-3);">${d.fecha || '—'}</td>
                      <td style="padding:8px;text-align:right;color:var(--text);">${itemCount}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>`;
        }
      }
    } catch {
      ['analytics-por-area','analytics-solicitantes','analytics-despachos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<p style="color:var(--danger);font-size:12px;text-align:center;padding:16px 0;">Error cargando datos — intenta de nuevo</p>';
      });
    }
  }

  // Load on init
  await loadAnalytics();

  // Wire despacho search
  document.getElementById('analytics-cedula-btn')?.addEventListener('click', () => {
    const cedula = (document.getElementById('analytics-cedula-input')?.value || '').trim();
    loadAnalytics(cedula);
  });
  document.getElementById('analytics-cedula-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('analytics-cedula-btn')?.click();
  });
}
```

- [ ] **Step 3: Call renderAnalyticsSection at the end of renderDashboard**

Find the last two lines of `renderDashboard`:
```js
  await fetchAndRenderData();
  refreshInterval = setInterval(fetchAndRenderData, 30_000);
}
```

Replace with:
```js
  await fetchAndRenderData();
  await renderAnalyticsSection();
  refreshInterval = setInterval(fetchAndRenderData, 30_000);
}
```

- [ ] **Step 4: Manual test**

Open the dashboard. Scroll down past the trend chart and recent tickets. Verify:
1. "Analítica Operacional" header appears
2. "Tickets por Área" accordion is open by default with horizontal bars
3. "Top Solicitantes" accordion shows a table when opened
4. "Historial de Despachos" accordion shows a table with all recent despachos
5. Typing a cédula number and clicking "Buscar" filters the despachos table

- [ ] **Step 5: Commit**

```bash
git add public/js/features/dashboard/dashboard.js
git commit -m "feat: add operational analytics section to dashboard"
```

---

## Final Verification

- [ ] All 3 features work end-to-end in the running app
- [ ] No console errors in browser devtools
- [ ] Server has no uncaught errors in stdout
- [ ] Push branch to remote

```bash
git push origin feat/inv-picker-server-search
```
