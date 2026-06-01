# Vista de Actas Firmadas en Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una pestaña "Actas" al módulo de Auditoría con tabla filtrable de todos los registros de `acta_uploads`.

**Architecture:** Endpoint nuevo `GET /api/audit/actas` con CTE en SQLite para filtrar sobre campos calculados (persona, agente). Frontend refactoriza `renderAudit` para soportar dos pestañas: "Actividad" (existente) y "Actas" (nueva).

**Tech Stack:** Node.js ESM, `node:sqlite` (DatabaseSync), Express, vanilla JS

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `src/audit/audit-routes.js` | Modificar — agregar `GET /api/audit/actas` |
| `public/js/audit.js` | Modificar — agregar tabs + tabla Actas |

---

## Task 1: src/audit/audit-routes.js — endpoint GET /api/audit/actas

**Files:**
- Modify: `src/audit/audit-routes.js`

- [ ] **Step 1: Agregar el endpoint antes de `export default router`**

Abrir `src/audit/audit-routes.js`. Después del bloque `router.get('/api/audit', ...)` y antes de `export default router;`, agregar:

```js
router.get('/api/audit/actas', (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const type   = req.query.type   || '';
    const status = req.query.status || '';
    const q      = req.query.q      ? `%${req.query.q}%` : '';

    const conditions = [];
    const params     = [];

    if (type)   { conditions.push('entity_type = ?');        params.push(type); }
    if (status === 'uploaded') { conditions.push('uploaded_at IS NOT NULL'); }
    if (status === 'pending')  { conditions.push('uploaded_at IS NULL');     }
    if (q) {
      conditions.push('(entity_ref LIKE ? OR filename LIKE ? OR persona LIKE ? OR agente LIKE ?)');
      params.push(q, q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const cte = `
      WITH actas_full AS (
        SELECT
          a.id, a.token, a.entity_type, a.entity_ref,
          a.filename, a.uploaded_at, a.created_at,
          CASE WHEN a.entity_type = 'despacho'     THEN d.destinatario
               WHEN a.entity_type = 'tech_request' THEN tr.requester_name
          END AS persona,
          CASE WHEN a.entity_type = 'despacho'     THEN d.agente
               WHEN a.entity_type = 'tech_request' THEN tr.agent_name
          END AS agente
        FROM acta_uploads a
        LEFT JOIN despachos d
          ON a.entity_type = 'despacho' AND a.entity_id = d.id
        LEFT JOIN tech_requests tr
          ON a.entity_type = 'tech_request' AND a.entity_id = tr.id
      )
    `;

    const actas = db.prepare(`${cte} SELECT * FROM actas_full ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);

    const total = db.prepare(`${cte} SELECT COUNT(*) AS n FROM actas_full ${where}`)
      .get(...params).n;

    res.json({ actas, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node --check server.js
```

Esperado: sin output.

- [ ] **Step 3: Probar el endpoint**

Con el servidor corriendo (`node server.js`):

```bash
curl -s "http://localhost:3000/api/audit/actas" && echo ""
```

Esperado: `{"actas":[...],"total":N}` — puede ser array vacío si no hay registros.

```bash
curl -s "http://localhost:3000/api/audit/actas?type=despacho&status=uploaded" && echo ""
```

Esperado: solo filas con `entity_type=despacho` y `uploaded_at` no nulo.

```bash
curl -s "http://localhost:3000/api/audit/actas?q=DES" && echo ""
```

Esperado: solo filas cuyo `entity_ref` contiene "DES".

- [ ] **Step 4: Commit**

```bash
git add src/audit/audit-routes.js
git commit -m "feat: GET /api/audit/actas — tabla filtrable de actas firmadas"
```

---

## Task 2: public/js/audit.js — tabs + tabla Actas

**Files:**
- Modify: `public/js/audit.js`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

Reemplazar `public/js/audit.js` con el siguiente contenido:

```js
import { createLoadingSpinner } from './components.js';

const ACTION_ICONS = {
  'Ticket creado':     '🎟️',
  'Ticket actualizado':'✏️',
  'Mensaje enviado':   '💬',
  'Imagen enviada':    '🖼️',
};

export async function renderAudit(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Auditoría</h2>
        <p style="color:var(--text-3);font-size:13px;">Historial completo de acciones y actas del sistema.</p>
      </div>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);">
      <button id="tab-actividad" style="padding:10px 22px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;color:var(--primary);border-bottom:2px solid var(--primary);margin-bottom:-2px;transition:color .15s;">Actividad</button>
      <button id="tab-actas"     style="padding:10px 22px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;color:var(--text-3);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s;">Actas</button>
    </div>

    <!-- Panel Actividad -->
    <div id="panel-actividad">
      <div class="card" style="padding:10px;">
        <div id="audit-container">${createLoadingSpinner()}</div>
      </div>
    </div>

    <!-- Panel Actas -->
    <div id="panel-actas" style="display:none;">
      <div class="card" style="padding:16px 18px;margin-bottom:16px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <input id="actas-search" type="text" placeholder="Buscar por documento, persona o archivo…"
            style="flex:1;min-width:200px;max-width:320px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
          <select id="actas-type" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
            <option value="">Todos los tipos</option>
            <option value="despacho">Despacho</option>
            <option value="tech_request">Requerimiento</option>
          </select>
          <select id="actas-status" style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
            <option value="">Todos los estados</option>
            <option value="uploaded">Recibidas</option>
            <option value="pending">Pendientes</option>
          </select>
          <button id="actas-refresh" class="btn btn-secondary" style="padding:8px 14px;font-size:13px;">Actualizar</button>
        </div>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div id="actas-container">${createLoadingSpinner()}</div>
      </div>
    </div>
  `;

  /* ── Tab switching ── */
  let activeTab = 'actividad';

  function setTab(tab) {
    activeTab = tab;
    const btnAct  = container.querySelector('#tab-actividad');
    const btnAct2 = container.querySelector('#tab-actas');
    const panAct  = container.querySelector('#panel-actividad');
    const panAct2 = container.querySelector('#panel-actas');

    btnAct.style.color             = tab === 'actividad' ? 'var(--primary)' : 'var(--text-3)';
    btnAct.style.borderBottomColor = tab === 'actividad' ? 'var(--primary)' : 'transparent';
    btnAct2.style.color             = tab === 'actas' ? 'var(--primary)' : 'var(--text-3)';
    btnAct2.style.borderBottomColor = tab === 'actas' ? 'var(--primary)' : 'transparent';
    panAct.style.display  = tab === 'actividad' ? '' : 'none';
    panAct2.style.display = tab === 'actas'     ? '' : 'none';

    if (tab === 'actas') loadActas();
  }

  container.querySelector('#tab-actividad').onclick = () => setTab('actividad');
  container.querySelector('#tab-actas').onclick     = () => setTab('actas');

  /* ── Panel Actividad ── */
  async function loadAudit(offset = 0) {
    const auditContainer = container.querySelector('#audit-container');
    if (!auditContainer) return;
    try {
      const res = await fetch(`/api/audit?limit=50&offset=${offset}`);
      const { logs, total } = await res.json();
      if (!logs.length) {
        auditContainer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3);">No hay eventos registrados aún.</div>';
        return;
      }
      auditContainer.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Fecha</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Actor</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Acción</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Ticket</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;">Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => {
              const icon = ACTION_ICONS[log.action] || '📋';
              let detail = '';
              try {
                const d = JSON.parse(log.details || 'null');
                if (d) detail = Object.entries(d).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
              } catch {}
              return `
                <tr style="border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                  <td style="padding:10px 14px;font-size:12px;color:var(--text-3);white-space:nowrap;">${log.created_at}</td>
                  <td style="padding:10px 14px;font-size:13px;font-weight:500;">${log.actor}</td>
                  <td style="padding:10px 14px;font-size:13px;">${icon} ${log.action}</td>
                  <td style="padding:10px 14px;font-size:12px;">${log.entity_number ? `<a href="#ticket/${log.entity_id}" style="color:var(--primary);text-decoration:none;">${log.entity_number}</a>` : '—'}</td>
                  <td style="padding:10px 14px;font-size:12px;color:var(--text-3);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${detail || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="padding:14px;text-align:right;font-size:12px;color:var(--text-3);">${total} eventos totales</div>
      `;
    } catch (err) {
      console.error('[Audit]', err);
      auditContainer.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3);">Error al cargar el log de auditoría.</div>';
    }
  }

  /* ── Panel Actas ── */
  async function loadActas() {
    const wrap = container.querySelector('#actas-container');
    if (!wrap) return;
    wrap.innerHTML = createLoadingSpinner();

    const q      = container.querySelector('#actas-search').value.trim();
    const type   = container.querySelector('#actas-type').value;
    const status = container.querySelector('#actas-status').value;
    const params = new URLSearchParams({ limit: 100 });
    if (q)      params.set('q', q);
    if (type)   params.set('type', type);
    if (status) params.set('status', status);

    try {
      const res = await fetch(`/api/audit/actas?${params}`);
      if (!res.ok) throw new Error('Error del servidor');
      const { actas, total } = await res.json();

      if (!actas.length) {
        wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-3);">📋 Sin actas para los filtros aplicados.</div>`;
        return;
      }

      wrap.innerHTML = `
        <div style="padding:10px 18px;font-size:12px;color:var(--text-3);border-bottom:1px solid var(--border);">${total} acta(s) en total</div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;white-space:nowrap;">Fecha</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Documento</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Tipo</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Persona</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Agente</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Estado</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Archivo</th>
                <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${actas.map(a => {
                const fecha = a.uploaded_at
                  ? new Date(a.uploaded_at).toLocaleString('es-CO')
                  : new Date(a.created_at).toLocaleString('es-CO');
                const tipoBadge = a.entity_type === 'despacho'
                  ? `<span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:500;background:rgba(99,102,241,.15);color:var(--primary);border:1px solid rgba(99,102,241,.3);">Despacho</span>`
                  : `<span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:500;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25);">Requerimiento</span>`;
                const estadoBadge = a.uploaded_at
                  ? `<span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;">Recibida ✓</span>`
                  : `<span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;">Pendiente</span>`;
                const accionBtn = a.uploaded_at
                  ? `<a href="/api/actas/download/${a.token}" style="padding:5px 11px;background:var(--primary);color:#fff;border-radius:6px;font-size:11px;font-weight:500;text-decoration:none;white-space:nowrap;">↓ Descargar</a>`
                  : `<span style="padding:5px 11px;border-radius:6px;font-size:11px;color:var(--text-3);border:1px solid var(--border);">—</span>`;
                return `
                  <tr style="border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                    <td style="padding:10px 14px;font-size:12px;color:var(--text-3);white-space:nowrap;">${fecha}</td>
                    <td style="padding:10px 14px;font-family:monospace;font-size:12px;font-weight:700;color:var(--primary);">${a.entity_ref}</td>
                    <td style="padding:10px 14px;">${tipoBadge}</td>
                    <td style="padding:10px 14px;font-size:13px;font-weight:500;">${a.persona || '—'}</td>
                    <td style="padding:10px 14px;font-size:12px;color:var(--text-2);">${a.agente || '—'}</td>
                    <td style="padding:10px 14px;">${estadoBadge}</td>
                    <td style="padding:10px 14px;font-size:12px;color:var(--text-2);">${a.filename || '—'}</td>
                    <td style="padding:10px 14px;text-align:right;">${accionBtn}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error('[Actas]', err);
      wrap.innerHTML = `<div style="padding:40px;text-align:center;color:#f87171;">Error al cargar las actas.</div>`;
    }
  }

  /* ── Filtros con debounce ── */
  let searchTimer;
  container.querySelector('#actas-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { if (activeTab === 'actas') loadActas(); }, 350);
  });
  container.querySelector('#actas-type').addEventListener('change', () => { if (activeTab === 'actas') loadActas(); });
  container.querySelector('#actas-status').addEventListener('change', () => { if (activeTab === 'actas') loadActas(); });
  container.querySelector('#actas-refresh').addEventListener('click', () => { if (activeTab === 'actas') loadActas(); });

  /* ── Carga inicial ── */
  loadAudit();
}
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node --check server.js
```

Esperado: sin output.

- [ ] **Step 3: Probar en el navegador**

Con el servidor corriendo:
1. Navegar a `http://localhost:3000/#audit`
2. Verificar que se ven dos pestañas: **Actividad** y **Actas**
3. La pestaña Actividad debe cargar el log existente igual que antes
4. Al hacer click en **Actas** debe cargar la tabla con los registros de `acta_uploads`
5. Probar filtro por tipo "Despacho" — debe mostrar solo filas con `entity_type=despacho`
6. Probar filtro por estado "Recibidas" — debe mostrar solo filas con archivo subido
7. Probar búsqueda de texto — escribe "DES" y verificar que filtra por `entity_ref`
8. El botón **↓ Descargar** debe aparecer solo en filas con estado "Recibida"

- [ ] **Step 4: Commit**

```bash
git add public/js/audit.js
git commit -m "feat: audit — pestaña Actas con tabla filtrable y descarga"
```

---

## Checklist de verificación final

- [ ] `GET /api/audit/actas` devuelve `{"actas":[],"total":0}` cuando no hay registros
- [ ] Filtro `type=despacho` muestra solo actas de despachos
- [ ] Filtro `status=uploaded` muestra solo actas con archivo
- [ ] Filtro `status=pending` muestra solo actas sin archivo
- [ ] Filtro `q=DES` filtra por entity_ref
- [ ] Pestaña Actividad no muestra la tabla de actas
- [ ] Pestaña Actas no muestra el log de actividad
- [ ] Botón Descargar lleva a `/api/actas/download/:token`
- [ ] Filas sin archivo muestran "—" en columna Acción
