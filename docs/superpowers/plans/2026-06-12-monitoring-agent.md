# Monitoring Agent Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows agent (.exe) that POSTs hardware inventory and real-time metrics to the server every 10s, with an admin panel showing all PCs in a live SSE-updated table with accordion detail.

**Architecture:** Node.js CommonJS agent bundled with `pkg` → `.exe`. New Express router handles register/heartbeat/agents/SSE endpoints. SQLite stores agents + 24h metrics. Vanilla JS frontend module follows existing app.js routing pattern.

**Tech Stack:** Node.js 18 (built-in fetch), systeminformation npm, pkg bundler, SQLite (DatabaseSync), SSE, vanilla JS

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `database/schema.sql` | Modify | Add `agentes` + `metricas_agentes` tables |
| `src/config/database.js` | Modify | Add `monitoring:read` permission migration |
| `src/monitoring/monitoring-routes.js` | Create | All monitoring API endpoints + SSE + offline checker |
| `server.js` | Modify | Import monitoring router, start offline checker |
| `public/js/monitoreo.js` | Create | Frontend module — KPIs, table, accordion, SSE client |
| `public/index.html` | Modify | Add `nav-monitoreo` sidebar item |
| `public/js/app.js` | Modify | Import renderMonitoreo, add `#monitoreo` hash case + nav show |
| `agent/agent.js` | Create | Agent main logic (CommonJS for pkg compat) |
| `agent/package.json` | Create | Agent deps: systeminformation only |
| `agent/agent-config.json` | Create | Distributable config template |

---

## Task 1: DB Tables + Permission

**Files:**
- Modify: `database/schema.sql`
- Modify: `src/config/database.js`

- [ ] **Step 1: Add tables to end of `database/schema.sql`**

```sql
-- ═══════════════════════════════════════════════════════════════
-- MÓDULO: MONITOREO DE EQUIPOS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname     TEXT NOT NULL,
  mac_address  TEXT UNIQUE NOT NULL,
  ip           TEXT,
  os_name      TEXT,
  os_version   TEXT,
  cpu_model    TEXT,
  cpu_cores    INTEGER,
  cpu_ghz      REAL,
  ram_total    INTEGER,
  disk_model   TEXT,
  disk_total   INTEGER,
  gpu          TEXT,
  sede         TEXT,
  apodo        TEXT,
  api_key      TEXT UNIQUE NOT NULL,
  estado       TEXT DEFAULT 'offline',
  last_seen    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metricas_agentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agente_id    INTEGER NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  timestamp    TEXT DEFAULT (datetime('now')),
  cpu_percent  REAL,
  ram_used     REAL,
  disk_used    INTEGER,
  uptime       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_metricas_agente ON metricas_agentes(agente_id, timestamp DESC);
```

- [ ] **Step 2: Add `monitoring:read` permission to `src/config/database.js`**

Find the block ending with `(30, 'settings:edit')` and add a new migration entry after all existing ones (before the closing `];`):

```js
  `INSERT OR IGNORE INTO permissions (id, name) VALUES (31, 'monitoring:read')`,
  // IT role (id=1) already has 'full' which bypasses permission checks.
  // Add explicitly so it shows in the roles UI:
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, 31)`,
```

- [ ] **Step 3: Restart server and verify**

```bash
npm start
```

Open browser → DevTools console:
```js
fetch('/api/auth/me').then(r=>r.json()).then(console.log)
```

Expected: current user object (confirms server restarted without errors).

- [ ] **Step 4: Commit**

```bash
git add database/schema.sql src/config/database.js
git commit -m "feat(monitoring): add agentes + metricas_agentes tables and monitoring:read permission"
```

---

## Task 2: Backend Monitoring Routes

**Files:**
- Create: `src/monitoring/monitoring-routes.js`

- [ ] **Step 1: Create `src/monitoring/monitoring-routes.js`**

```js
import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = Router();
const canRead = [requireAuth, requirePermission('monitoring:read')];
const sseClients = new Set();

export function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of [...sseClients]) {
    if (res.writableEnded) { sseClients.delete(res); continue; }
    res.write(msg);
  }
}

export function startOfflineChecker() {
  setInterval(() => {
    const r = db.prepare(`
      UPDATE agentes SET estado = 'offline'
      WHERE estado = 'online' AND datetime(last_seen) < datetime('now', '-30 seconds')
    `).run();
    if (r.changes > 0) broadcast({ type: 'offline_sweep' });
    db.prepare(`DELETE FROM metricas_agentes WHERE timestamp < datetime('now', '-24 hours')`).run();
  }, 20000);
}

function agentAuth(req, res, next) {
  const agentId = parseInt(req.headers['x-agent-id']);
  const apiKey  = req.headers['x-api-key'];
  if (!agentId || !apiKey) return res.status(401).json({ error: 'Missing credentials.' });
  const agent = db.prepare('SELECT id FROM agentes WHERE id = ? AND api_key = ?').get(agentId, apiKey);
  if (!agent) return res.status(403).json({ error: 'Invalid credentials.' });
  req.agentId = agent.id;
  next();
}

/* POST /api/monitoring/register */
router.post('/api/monitoring/register', (req, res) => {
  const { hostname, ip, mac_address, os_name, os_version,
          cpu_model, cpu_cores, cpu_ghz, ram_total,
          disk_model, disk_total, gpu } = req.body;
  if (!hostname || !mac_address) return res.status(400).json({ error: 'hostname and mac_address required.' });

  const existing = db.prepare('SELECT id, api_key FROM agentes WHERE mac_address = ?').get(mac_address);
  if (existing) {
    db.prepare(`
      UPDATE agentes
      SET hostname=?,ip=?,os_name=?,os_version=?,cpu_model=?,cpu_cores=?,cpu_ghz=?,
          ram_total=?,disk_model=?,disk_total=?,gpu=?,estado='online',last_seen=datetime('now')
      WHERE id=?
    `).run(hostname, ip, os_name, os_version, cpu_model, cpu_cores, cpu_ghz,
           ram_total, disk_model, disk_total, gpu, existing.id);
    broadcast({ type: 'agent_updated', agent_id: existing.id });
    return res.json({ id: existing.id, api_key: existing.api_key });
  }

  const api_key = crypto.randomBytes(32).toString('hex');
  const result = db.prepare(`
    INSERT INTO agentes
      (hostname,mac_address,ip,os_name,os_version,cpu_model,cpu_cores,cpu_ghz,
       ram_total,disk_model,disk_total,gpu,api_key,estado,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'online',datetime('now'))
  `).run(hostname, mac_address, ip, os_name, os_version, cpu_model, cpu_cores, cpu_ghz,
         ram_total, disk_model, disk_total, gpu, api_key);

  broadcast({ type: 'agent_registered', agent_id: result.lastInsertRowid });
  res.json({ id: result.lastInsertRowid, api_key });
});

/* POST /api/monitoring/heartbeat */
router.post('/api/monitoring/heartbeat', agentAuth, (req, res) => {
  const { cpu_percent, ram_used, disk_used, uptime } = req.body;

  db.prepare(`UPDATE agentes SET estado='online', last_seen=datetime('now') WHERE id=?`)
    .run(req.agentId);

  db.prepare(`
    INSERT INTO metricas_agentes (agente_id, cpu_percent, ram_used, disk_used, uptime)
    VALUES (?,?,?,?,?)
  `).run(req.agentId, cpu_percent, ram_used, disk_used, uptime);

  const agent = db.prepare('SELECT ram_total, disk_total FROM agentes WHERE id=?').get(req.agentId);
  broadcast({
    type: 'metrics', agent_id: req.agentId,
    cpu_percent, ram_used, disk_used, uptime,
    ram_total: agent?.ram_total, disk_total: agent?.disk_total,
  });

  res.json({ ok: true });
});

/* GET /api/monitoring/agents */
router.get('/api/monitoring/agents', ...canRead, (req, res) => {
  const agents = db.prepare(`
    SELECT a.*,
           m.cpu_percent, m.ram_used, m.disk_used, m.uptime,
           m.timestamp AS metric_ts
    FROM agentes a
    LEFT JOIN metricas_agentes m ON m.id = (
      SELECT id FROM metricas_agentes WHERE agente_id = a.id ORDER BY id DESC LIMIT 1
    )
    ORDER BY a.estado DESC, a.hostname ASC
  `).all();
  res.json(agents);
});

/* GET /api/monitoring/agents/:id */
router.get('/api/monitoring/agents/:id', ...canRead, (req, res) => {
  const agent = db.prepare('SELECT * FROM agentes WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found.' });
  const metrics = db.prepare(`
    SELECT * FROM metricas_agentes
    WHERE agente_id = ? AND timestamp > datetime('now', '-24 hours')
    ORDER BY id DESC LIMIT 144
  `).all(req.params.id);
  res.json({ ...agent, metrics });
});

/* GET /api/monitoring/stream — SSE */
router.get('/api/monitoring/stream', ...canRead, (req, res) => {
  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`data: {"type":"connected"}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add src/monitoring/monitoring-routes.js
git commit -m "feat(monitoring): add monitoring routes — register, heartbeat, agents, SSE"
```

---

## Task 3: Wire into server.js

**Files:**
- Modify: `server.js` (near the import block at top and router registration block ~line 52–66)

- [ ] **Step 1: Add import after the trackingRouter import line**

Find:
```js
import trackingRouter from './src/tracking/tracking-routes.js';
```

Add after it:
```js
import monitoringRouter, { startOfflineChecker } from './src/monitoring/monitoring-routes.js';
```

- [ ] **Step 2: Register the router**

Find:
```js
app.use(trackingRouter);
```

Add after it:
```js
app.use(monitoringRouter);
```

- [ ] **Step 3: Start the offline checker after server starts**

Find the `app.listen(` call at the bottom of server.js (or wherever server start is logged). Add after the server starts listening:

```js
startOfflineChecker();
```

It should look like:
```js
app.listen(PORT, () => {
  console.log(`[Server] Escuchando en http://localhost:${PORT}`);
  startOfflineChecker();
});
```

- [ ] **Step 4: Restart and verify routes exist**

```bash
npm start
```

In another terminal:
```bash
curl http://localhost:3000/api/monitoring/agents
```

Expected: `{"error":"No autenticado."}` (401 — route exists, auth working)

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat(monitoring): wire monitoring router and start offline checker in server.js"
```

---

## Task 4: Frontend Module

**Files:**
- Create: `public/js/monitoreo.js`

- [ ] **Step 1: Create `public/js/monitoreo.js`**

```js
import { state } from './app.js';
import { showToast } from './components.js';

let _sse  = null;
let _agents = {};

export function renderMonitoreo(container) {
  if (_sse) { _sse.close(); _sse = null; }

  container.innerHTML = `
    <div style="margin-bottom:20px;">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);">Monitoreo de Equipos</h1>
    </div>
    <div id="mon-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <input id="mon-search" class="form-control" placeholder="Buscar equipo, sede, IP…" style="flex:1;">
      <select id="mon-filter" class="form-control" style="width:140px;">
        <option value="">Todos</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
      </select>
    </div>
    <div id="mon-table-wrap"></div>
  `;

  loadAgents();
  connectSSE();
  container.querySelector('#mon-search').addEventListener('input', renderTable);
  container.querySelector('#mon-filter').addEventListener('change', renderTable);
}

async function loadAgents() {
  try {
    const data = await fetch('/api/monitoring/agents').then(r => r.json());
    _agents = {};
    data.forEach(a => { _agents[a.id] = a; });
    renderKPIs();
    renderTable();
  } catch {
    showToast('Error cargando agentes', 'error');
  }
}

function renderKPIs() {
  const agents = Object.values(_agents);
  const online = agents.filter(a => a.estado === 'online');

  const avgCpu = online.length
    ? Math.round(online.reduce((s, a) => s + (a.cpu_percent || 0), 0) / online.length)
    : 0;
  const onlineRam = online.filter(a => a.ram_total > 0);
  const avgRam = onlineRam.length
    ? Math.round(onlineRam.reduce((s, a) => s + (a.ram_used || 0) / a.ram_total * 100, 0) / onlineRam.length)
    : 0;
  const onlineDisk = online.filter(a => a.disk_total > 0);
  const avgDisk = onlineDisk.length
    ? Math.round(onlineDisk.reduce((s, a) => s + (a.disk_used || 0) / a.disk_total * 100, 0) / onlineDisk.length)
    : 0;

  const el = document.getElementById('mon-kpis');
  if (!el) return;
  el.innerHTML = [
    { label: 'Online',      value: online.length,                  color: '#22c55e' },
    { label: 'Offline',     value: agents.length - online.length,  color: '#ef4444' },
    { label: 'CPU prom.',   value: `${avgCpu}%`,                   color: '#3b82f6' },
    { label: 'RAM prom.',   value: `${avgRam}%`,                   color: '#8b5cf6' },
    { label: 'Disco prom.', value: `${avgDisk}%`,                  color: '#f59e0b' },
  ].map(k => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:${k.color};">${k.value}</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${k.label}</div>
    </div>
  `).join('');
}

function renderTable() {
  const search = (document.getElementById('mon-search')?.value || '').toLowerCase();
  const filter = document.getElementById('mon-filter')?.value || '';
  const wrap   = document.getElementById('mon-table-wrap');
  if (!wrap) return;

  const agents = Object.values(_agents)
    .filter(a => {
      if (filter && a.estado !== filter) return false;
      if (search && !`${a.hostname||''} ${a.ip||''} ${a.sede||''} ${a.apodo||''}`.toLowerCase().includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === 'online' ? -1 : 1;
      return (a.hostname || '').localeCompare(b.hostname || '');
    });

  if (!agents.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-3);">No hay equipos${filter || search ? ' que coincidan' : ' registrados'}.</div>`;
    return;
  }

  wrap.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:28px 2fr 1fr 1fr 1fr 1fr 1fr 1fr;padding:10px 14px;background:var(--surface-2);font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);">
        <span></span><span>Equipo</span><span>Sede</span>
        <span style="text-align:center;">Estado</span>
        <span style="text-align:center;">CPU</span>
        <span style="text-align:center;">RAM</span>
        <span style="text-align:center;">Disco</span>
        <span style="text-align:center;">Visto</span>
      </div>
      ${agents.map(buildRow).join('')}
    </div>
  `;

  wrap.querySelectorAll('.mon-row').forEach(row => {
    row.querySelector('.mon-row-main').addEventListener('click', () => toggleAccordion(row.dataset.id));
  });
}

function colorFor(pct, base) {
  return pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : base;
}

function miniBar(pct, base) {
  const c = colorFor(pct, base);
  return `<div style="background:var(--border);border-radius:2px;height:3px;margin-top:3px;"><div style="background:${c};width:${Math.min(pct,100)}%;height:100%;border-radius:2px;transition:width .4s;"></div></div>`;
}

function buildRow(a) {
  const online  = a.estado === 'online';
  const cpuPct  = Math.round(a.cpu_percent || 0);
  const ramPct  = a.ram_total  > 0 ? Math.round((a.ram_used  || 0) / a.ram_total  * 100) : 0;
  const diskPct = a.disk_total > 0 ? Math.round((a.disk_used || 0) / a.disk_total * 100) : 0;

  return `
  <div class="mon-row" data-id="${a.id}" style="border-top:1px solid var(--border);">
    <div class="mon-row-main" style="display:grid;grid-template-columns:28px 2fr 1fr 1fr 1fr 1fr 1fr 1fr;padding:11px 14px;align-items:center;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
      <span class="mon-chev" style="color:var(--text-3);font-size:10px;user-select:none;">▶</span>
      <div>
        <div style="font-weight:600;font-family:monospace;font-size:13px;color:var(--text);">${a.hostname||'—'}</div>
        <div style="font-size:11px;color:var(--text-3);">${a.ip||'—'}${a.apodo?` · ${a.apodo}`:''}</div>
      </div>
      <span style="font-size:13px;color:var(--text-2);">${a.sede||'—'}</span>
      <div style="text-align:center;">
        <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:500;background:${online?'#22c55e22':'#ef444422'};color:${online?'#22c55e':'#ef4444'};">● ${online?'Online':'Offline'}</span>
      </div>
      ${online ? `
        <div style="text-align:center;"><div style="font-size:12px;font-weight:600;color:${colorFor(cpuPct,'#3b82f6')};">${cpuPct}%</div>${miniBar(cpuPct,'#3b82f6')}</div>
        <div style="text-align:center;"><div style="font-size:12px;font-weight:600;color:${colorFor(ramPct,'#8b5cf6')};">${a.ram_used||0}GB</div>${miniBar(ramPct,'#8b5cf6')}</div>
        <div style="text-align:center;"><div style="font-size:12px;font-weight:600;color:${colorFor(diskPct,'#22c55e')};">${diskPct}%</div>${miniBar(diskPct,'#22c55e')}</div>
      ` : `
        <span style="text-align:center;color:var(--text-3);">—</span>
        <span style="text-align:center;color:var(--text-3);">—</span>
        <span style="text-align:center;color:var(--text-3);">—</span>
      `}
      <span style="text-align:center;font-size:11px;color:var(--text-3);">${a.last_seen ? timeAgo(a.last_seen) : '—'}</span>
    </div>
    <div class="mon-acc" style="display:none;padding:12px 14px 14px;border-top:1px solid var(--border);background:var(--surface-2);">
      ${buildAccordion(a)}
    </div>
  </div>`;
}

function buildAccordion(a) {
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
    ${[
      ['Procesador',        a.cpu_model||'—',          `${a.cpu_cores||'?'} núcleos · ${a.cpu_ghz||'?'} GHz`],
      ['Memoria RAM',       `${a.ram_total||'?'} GB`,   ''],
      ['Almacenamiento',    `${a.disk_total||'?'} GB`,  a.disk_model||''],
      ['Sistema Operativo', a.os_name||'—',             a.os_version||''],
      ['Red / IP',          a.ip||'—',                  a.mac_address||''],
      ['Uptime',            a.uptime ? uptimeStr(a.uptime) : '—', ''],
    ].map(([label, val, sub]) => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:10px;">
        <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">${label}</div>
        <div style="font-weight:600;font-size:13px;color:var(--text);">${val}</div>
        ${sub ? `<div style="font-size:11px;color:var(--text-3);">${sub}</div>` : ''}
      </div>`).join('')}
  </div>`;
}

function toggleAccordion(id) {
  const row  = document.querySelector(`.mon-row[data-id="${id}"]`);
  if (!row) return;
  const acc  = row.querySelector('.mon-acc');
  const chev = row.querySelector('.mon-chev');
  const open = acc.style.display === 'none';
  acc.style.display = open ? 'block' : 'none';
  chev.textContent  = open ? '▼' : '▶';
}

function connectSSE() {
  _sse = new EventSource('/api/monitoring/stream');
  _sse.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'metrics' && _agents[data.agent_id]) {
      Object.assign(_agents[data.agent_id], {
        cpu_percent: data.cpu_percent,
        ram_used:    data.ram_used,
        disk_used:   data.disk_used,
        uptime:      data.uptime,
        estado:      'online',
        last_seen:   new Date().toISOString(),
        ram_total:   data.ram_total  ?? _agents[data.agent_id].ram_total,
        disk_total:  data.disk_total ?? _agents[data.agent_id].disk_total,
      });
      renderKPIs();
      updateRow(data.agent_id);
    } else if (['offline_sweep','agent_registered','agent_updated'].includes(data.type)) {
      loadAgents();
    }
  };
  _sse.onerror = () => setTimeout(connectSSE, 5000);
}

function updateRow(id) {
  const existing = document.querySelector(`.mon-row[data-id="${id}"]`);
  if (!existing) return;
  const wasOpen = existing.querySelector('.mon-acc').style.display !== 'none';
  const tmp = document.createElement('div');
  tmp.innerHTML = buildRow(_agents[id]);
  const newRow = tmp.firstElementChild;
  if (wasOpen) {
    newRow.querySelector('.mon-acc').style.display = 'block';
    newRow.querySelector('.mon-chev').textContent  = '▼';
  }
  newRow.querySelector('.mon-row-main').addEventListener('click', () => toggleAccordion(id));
  existing.replaceWith(newRow);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z').getTime();
  const s = Math.floor(Math.abs(diff) / 1000);
  if (s < 60)   return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
}

function uptimeStr(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/monitoreo.js
git commit -m "feat(monitoring): add monitoreo.js frontend module — KPIs, table, accordion, SSE"
```

---

## Task 5: Navigation — Sidebar + App.js Routing

**Files:**
- Modify: `public/index.html` (after `nav-inventario` item, line ~77)
- Modify: `public/js/app.js` (import + hash case + nav show)

- [ ] **Step 1: Add nav item to `public/index.html`**

Find:
```html
      <a href="#inventario" class="menu-item" id="nav-inventario" style="display:none;">
        <span class="menu-icon"><i data-lucide="package-search" class="lucide"></i></span>
        <span class="menu-label">Inventario</span>
      </a>
```

Add after it:
```html
      <a href="#monitoreo" class="menu-item" id="nav-monitoreo" style="display:none;">
        <span class="menu-icon"><i data-lucide="monitor" class="lucide"></i></span>
        <span class="menu-label">Monitoreo</span>
      </a>
```

- [ ] **Step 2: Add import to `public/js/app.js`**

Find:
```js
import { renderTrazabilidad } from './trazabilidad.js';
```

Add after it:
```js
import { renderMonitoreo } from './monitoreo.js';
```

- [ ] **Step 3: Add hash case in app.js `handleHash` function**

Find the case block for `#inventario` (around line 271):
```js
      case '#inventario':
        if (state.currentUser && !can('inventario:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'inventario';
        document.getElementById('nav-inventario')?.classList.add('active');
        renderInventario(appContainer);
        break;
```

Add after it:
```js
      case '#monitoreo':
        state.currentPage = 'monitoreo';
        document.getElementById('nav-monitoreo')?.classList.add('active');
        renderMonitoreo(appContainer);
        break;
```

- [ ] **Step 4: Show nav item for full-access users**

Find:
```js
  if (can('full'))               show('nav-users');
```

Add after it:
```js
  if (can('full'))               show('nav-monitoreo');
```

- [ ] **Step 5: Reload browser and verify nav item appears**

Log in as IT user → sidebar should show "Monitoreo". Click it → table renders (empty, no agents yet).

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/js/app.js
git commit -m "feat(monitoring): add Monitoreo nav item and hash routing"
```

---

## Task 6: Agent Files

**Files:**
- Create: `agent/agent.js`
- Create: `agent/package.json`
- Create: `agent/agent-config.json`

- [ ] **Step 1: Create `agent/agent.js`**

```js
'use strict';

const si = require('systeminformation');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join, dirname } = require('path');
const os = require('os');

// When packaged with pkg, process.pkg is defined. Use execPath dir for config.
const IS_PKG  = typeof process.pkg !== 'undefined';
const BASE_DIR = IS_PKG ? dirname(process.execPath) : __dirname;
const CONFIG_PATH = join(BASE_DIR, 'agent-config.json');

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`agent-config.json not found at ${CONFIG_PATH}`);
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

async function getHardwareInfo() {
  const [cpu, mem, disks, nets, osInfo, graphics] = await Promise.all([
    si.cpu(), si.mem(), si.fsSize(), si.networkInterfaces(), si.osInfo(), si.graphics(),
  ]);

  const primaryDisk = disks.find(d => /^C:/i.test(d.fs) || d.mount === '/') || disks[0] || {};
  const netList     = Array.isArray(nets) ? nets : [];
  const primaryNet  = netList.find(n => !n.internal && n.ip4) || {};

  return {
    hostname:    os.hostname(),
    ip:          primaryNet.ip4 || '',
    mac_address: primaryNet.mac || `${os.hostname()}-fallback`,
    os_name:     osInfo.distro || osInfo.platform || '',
    os_version:  osInfo.release || '',
    cpu_model:   cpu.brand || cpu.manufacturer || '',
    cpu_cores:   cpu.physicalCores || cpu.cores || 0,
    cpu_ghz:     parseFloat(cpu.speed) || 0,
    ram_total:   Math.round(mem.total / 1073741824),
    disk_model:  primaryDisk.type || primaryDisk.fs || '',
    disk_total:  primaryDisk.size ? Math.round(primaryDisk.size / 1073741824) : 0,
    gpu:         graphics.controllers?.[0]?.model || '',
  };
}

async function getMetrics() {
  const [load, mem, disks] = await Promise.all([
    si.currentLoad(), si.mem(), si.fsSize(),
  ]);
  const primaryDisk = disks.find(d => /^C:/i.test(d.fs) || d.mount === '/') || disks[0] || {};
  return {
    cpu_percent: Math.round(load.currentLoad * 10) / 10,
    ram_used:    Math.round(mem.used / 1073741824 * 10) / 10,
    disk_used:   primaryDisk.used ? Math.round(primaryDisk.used / 1073741824) : 0,
    uptime:      Math.floor(os.uptime()),
  };
}

async function register(serverUrl, hw) {
  const res = await fetch(`${serverUrl}/api/monitoring/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hw),
  });
  if (!res.ok) throw new Error(`Registration failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function sendHeartbeat(serverUrl, agentId, apiKey) {
  const metrics = await getMetrics();
  const res = await fetch(`${serverUrl}/api/monitoring/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-id':   String(agentId),
      'x-api-key':    apiKey,
    },
    body: JSON.stringify(metrics),
  });
  if (!res.ok) throw new Error(`Heartbeat failed: ${res.status}`);
}

async function main() {
  let cfg = loadConfig();
  const serverUrl = cfg.server_url || 'http://localhost:3000';
  const interval  = cfg.interval_ms || 10000;

  if (!cfg.agent_id) {
    console.log('[Agent] Collecting hardware info...');
    const hw = await getHardwareInfo();
    console.log(`[Agent] Registering with ${serverUrl}...`);
    const result = await register(serverUrl, hw);
    cfg = { ...cfg, agent_id: result.id, api_key: result.api_key };
    saveConfig(cfg);
    console.log(`[Agent] Registered as agent #${cfg.agent_id}`);
  }

  const { agent_id: agentId, api_key: apiKey } = cfg;
  let retryDelay = interval;

  async function tick() {
    try {
      await sendHeartbeat(serverUrl, agentId, apiKey);
      retryDelay = interval;
    } catch (e) {
      console.error(`[Agent] ${e.message} — retry in ${retryDelay / 1000}s`);
      retryDelay = Math.min(retryDelay * 2, 120000);
    }
    setTimeout(tick, retryDelay);
  }

  tick();
  console.log(`[Agent] Running — heartbeat every ${interval / 1000}s to ${serverUrl}`);
}

main().catch(e => {
  console.error('[Agent] Fatal:', e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Create `agent/package.json`**

```json
{
  "name": "agente-it",
  "version": "1.0.0",
  "description": "IT monitoring agent",
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js",
    "build": "npx pkg agent.js --targets node18-win-x64 --output dist/agente-it.exe"
  },
  "dependencies": {
    "systeminformation": "^5.22.0"
  },
  "pkg": {
    "targets": ["node18-win-x64"],
    "outputPath": "dist"
  }
}
```

- [ ] **Step 3: Create `agent/agent-config.json`**

```json
{
  "server_url": "http://192.168.1.100:3000",
  "interval_ms": 10000
}
```

> **Note for distribution:** Change `server_url` to the actual IP of the server PC before copying to each endpoint. The agent saves `agent_id` and `api_key` into this file on first run.

- [ ] **Step 4: Install agent deps and test locally**

```bash
cd agent
npm install
node agent.js
```

Expected output (server must be running on localhost:3000):
```
[Agent] Collecting hardware info...
[Agent] Registering with http://localhost:3000...
[Agent] Registered as agent #1
[Agent] Running — heartbeat every 10s to http://localhost:3000
```

Open the Monitoreo panel in browser → PC appears online.

- [ ] **Step 5: Add agent to .gitignore exclusions**

Ensure `agent/dist/` is in `.gitignore` (the compiled .exe should not be committed):

```bash
echo "agent/dist/" >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add agent/agent.js agent/package.json agent/agent-config.json .gitignore
git commit -m "feat(monitoring): add Node.js agent — hardware inventory + 10s heartbeat"
```

---

## Task 7: Build Script + Final Smoke Test

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add build:agent script to root `package.json`**

Find the `"scripts"` block in root `package.json` and add:
```json
"build:agent": "cd agent && npm install && npm run build"
```

- [ ] **Step 2: Build the .exe**

```bash
npm run build:agent
```

Expected: `agent/dist/agente-it.exe` created (~60MB).

- [ ] **Step 3: Smoke test the .exe**

Copy `agent/dist/agente-it.exe` and `agent/agent-config.json` (with `server_url` pointing to localhost) to a temp folder. Delete `agent_id` from the config if it exists. Run:

```
agente-it.exe
```

Expected: same output as Step 4 above. Panel shows new agent.

- [ ] **Step 4: Final end-to-end check**

1. Open browser → `http://localhost:3000` → Monitoreo
2. Agent running → PC card appears, status Online
3. CPU/RAM/Disco bars update every 10s
4. Click row → accordion opens showing CPU model, RAM, OS, IP
5. Stop the agent (`Ctrl+C`) → within ~30s PC changes to Offline

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat(monitoring): add build:agent script to package.json"
```

---

## Distributing to Remote PCs

For each PC to monitor:
1. Copy `agente-it.exe` + a fresh `agent-config.json` with the correct `server_url`
2. Double-click `agente-it.exe` to run (or set up as Windows startup task via Task Scheduler)
3. Agent auto-registers on first run, appears in the Monitoreo panel

For PCs at other sedes (future): change `server_url` in `agent-config.json` to the public IP/ngrok URL of the server.
