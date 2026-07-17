# Design: Employee Autocomplete, Analytics Dashboard, Technician Assignment

**Date:** 2026-07-17  
**Branch:** feat/inv-picker-server-search  
**Status:** Approved

---

## Overview

Three features that leverage the local `employees` table (281 records from ERP import) to improve ticket management UX and add operational analytics.

1. **Employee autocomplete widget** — shared utility used in tech-request form and ticket detail
2. **Analytics section in dashboard** — tickets by area, top requesters, despacho history by cédula
3. **Technician assignment** — replace generic agent select with employee search in ticket detail

---

## Feature 1: Employee Autocomplete Widget

### New File: `public/js/core/empleado-search.js`

Exports a single function:

```js
createEmpleadoSearch(nameInput, cedulaInput, options = {})
```

**Behavior:**
- Attaches to existing `<input>` elements (does not create them)
- Fires after 250ms debounce, minimum 2 characters typed
- Calls `GET /api/erp/empleados?q=<text>` (existing endpoint, no changes)
- Renders absolute-positioned dropdown below `nameInput`
- Each item shows: `nombre_completo` (bold) + `cargo · area` (muted)
- On item select (mousedown to prevent blur race): fills `nameInput` with `nombre`, fills `cedulaInput` with `cedula`
- Escape key closes dropdown without clearing text
- Click outside closes dropdown
- On API error: dropdown hides silently, inputs remain editable as free text

**Options:**
- `onSelect(employee)` — optional callback after selection

### Integration Points

**`tech-request-form.js`** — `solicitanteFields()` section  
After rendering the form, call:
```js
createEmpleadoSearch(
  document.getElementById('tr-f-name'),
  document.getElementById('tr-f-cedula')
);
```
No changes to form submit logic — values are already read from those inputs.

**`ticket-detail.js`** — requester panel  
Add edit mode to the requester display row. Currently shows static text. Add:
- Edit pencil icon next to `requester_name`
- On click: shows `nameInput` + `cedulaInput` (read-only) in place
- `createEmpleadoSearch()` attached to those inputs
- Save button calls `PUT /api/tickets/:id/requester`
- On success: reverts to static display with updated name

### New API Endpoint

```
PUT /api/tickets/:id/requester
Body: { requester_name: string, cedula?: string }
Auth: requireAuth + canEdit
Response: { success: true }
```

Updates `tickets.requester_name`. Logs to audit. No schema migration needed.

---

## Feature 2: Analytics Section in Dashboard

### New API Endpoint

```
GET /api/analytics/dashboard
GET /api/analytics/dashboard?cedula=<num>   (filters despachos)
Auth: requireAuth + canRead
```

**Response shape:**
```json
{
  "tickets_por_area": [
    { "area": "Sistemas", "total": 42, "abiertos": 12, "cerrados": 30 }
  ],
  "top_solicitantes": [
    { "requester_name": "JUAN PEREZ", "total": 15 }
  ],
  "despachos": [
    {
      "numero": "D-001",
      "destinatario": "MARIA GARCIA",
      "cedula": "1234567",
      "sede": "PRINCIPAL",
      "fecha": "2026-07-17",
      "articulos": "[...]"
    }
  ]
}
```

**SQL queries:**
- `tickets_por_area`: `SELECT area, COUNT(*) total, SUM(CASE WHEN status='abierto' THEN 1 ELSE 0 END) abiertos FROM tickets GROUP BY area ORDER BY total DESC LIMIT 10`
- `top_solicitantes`: `SELECT requester_name, COUNT(*) total FROM tickets WHERE requester_name IS NOT NULL AND requester_name != 'Sin nombre' GROUP BY requester_name ORDER BY total DESC LIMIT 10`
- `despachos`: `SELECT d.numero, d.destinatario, d.cedula, d.sede, d.fecha, d.articulos FROM despachos d ORDER BY d.created_at DESC LIMIT 50` (+ WHERE cedula=? when filter active)

**Module:** `src/metrics/metrics-routes.js` (existing file, append new route)

### Dashboard UI

Appended to `public/js/features/dashboard/dashboard.js` as `renderAnalyticsSection(container)`.

**Layout:**
```
─── ANALÍTICA ─────────────────────────────────
│ [Tickets por Área]      [Top Solicitantes]   │
│  Horizontal bar chart    Table: nombre|total  │
│  Chart.js (existing)     top 10               │
│                                               │
│ [Historial de Despachos]                      │
│  Cédula: [____________] [Buscar]              │
│  Table: #, destinatario, sede, fecha, items   │
─────────────────────────────────────────────────
```

- Reuses Chart.js already loaded by dashboard
- Despachos search: input + button, calls same endpoint with `?cedula=`
- All three subsections in a collapsible `<details>` block per subsection
- Data loaded once on `renderDashboard()`, despacho search re-fetches on demand

---

## Feature 3: Technician Assignment

### Approach: Dynamic Agent Creation (no migration)

The `tickets.assigned_to` column stays as `INTEGER FK → agents(id)`. When an employee is selected as technician:

1. Client sends `PUT /api/tickets/:id/assign` with `{ nombre, cedula }`
2. Server: `SELECT id FROM agents WHERE name = ?`
3. If not found: `INSERT INTO agents (name) VALUES (nombre)` → gets new ID
4. `UPDATE tickets SET assigned_to = <id>`
5. Returns `{ success, agent_id, agent_name }`

The 4 generic agents remain in the table and are unaffected. New named agents accumulate as technicians are assigned. The `agents` table grows organically.

### UI Changes in `ticket-detail.js`

Replace the `<select id="assign-agent">` section:

**Current:** Static select with 4 options fetched from `/api/agents`  
**New:**
- Text input with `createEmpleadoSearch()` attached
- Cédula display (read-only, auto-filled)
- "Asignar" button disabled until cédula auto-filled (user must select from dropdown)
- Currently assigned agent name shown as value in the input on load; cédula empty if was generic agent
- On success: updates displayed assignment, shows toast

### New API Endpoint

```
PUT /api/tickets/:id/assign
Body: { nombre: string, cedula: string }
Auth: requireAuth + canEdit
Response: { success: true, agent_id: number, agent_name: string }
```

---

## Files Changed

| File | Action |
|------|--------|
| `public/js/core/empleado-search.js` | CREATE |
| `public/js/features/tech-requests/tech-request-form.js` | EDIT — attach widget to solicitante fields |
| `public/js/features/tickets/ticket-detail.js` | EDIT — requester edit mode + assignment UI |
| `public/js/features/dashboard/dashboard.js` | EDIT — append analytics section |
| `src/metrics/metrics-routes.js` | EDIT — add `/api/analytics/dashboard` |
| `src/tickets/ticket-routes.js` | EDIT — add PUT /requester and PUT /assign |

No new files in `src/`. No database migrations.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `/api/erp/empleados` fails | Dropdown hides, input stays editable as free text |
| Employee search returns 0 results | Shows "Sin resultados" in dropdown |
| PUT /assign fails | Toast error, UI does not update assigned display |
| PUT /requester fails | Toast error, edit mode stays open for retry |
| Analytics endpoint fails | Section shows "Error cargando datos, intentar de nuevo" |

---

## Non-Goals

- No sync back to ERP (read-only from local DB)
- No cargo-based filtering on technician select (show all employees)
- No new database migrations
- No changes to WhatsApp bot flow (tickets from WA keep free-text requester_name)
