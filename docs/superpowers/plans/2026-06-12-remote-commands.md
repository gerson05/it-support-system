# Remote Commands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow IT admins to execute PowerShell commands on monitored PCs from the Monitoreo panel, with output streaming in real time via SSE.

**Architecture:** Pull-based — server queues commands in SQLite; agent picks them up in the next heartbeat response (≤10s), spawns PowerShell with `spawn()`, and POSTs output chunks back to the server which SSE-broadcasts them to the admin panel.

**Tech Stack:** Node.js 18 (better-sqlite3, Express, SSE, child_process.spawn), vanilla JS frontend

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `database/schema.sql` | Modify | Add `comandos_agente` table + index |
| `src/config/database.js` | Modify | Migration: table + `monitoring:command` permission (id=36) |
| `src/monitoring/monitoring-routes.js` | Modify | 3 new endpoints + heartbeat mod + dangling cleanup |
| `agent/agent.js` | Modify | `sendHeartbeat` returns data; new `executeCommand`; `tick` loops commands |
| `public/js/monitoreo.js` | Modify | Extended `buildAccordion`; send functions; SSE handlers |

---

## Task 1: DB Schema + Permission

**Files:**
- Modify: `database/schema.sql`
- Modify: `src/config/database.js`

- [ ] **Step 1: Append table to `database/schema.sql`**

Find the end of the file (currently ends with `CREATE INDEX IF NOT EXISTS idx_metricas_agente ...`). Add after it:

```sql

-- ═══════════════════════════════════════════════════════════════
-- MÓDULO: COMANDOS REMOTOS DE AGENTES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comandos_agente (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agente_id   INTEGER NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  parametro   TEXT,
  estado      TEXT DEFAULT 'pendiente',
  output      TEXT DEFAULT '',
  exit_code   INTEGER,
  creado_por  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comandos_agente ON comandos_agente(agente_id, estado);
```

- [ ] **Step 2: Add migration to `src/config/database.js`**

Find the last entry before the closing `];` of the migrations array (currently `... idx_paquete_eventos_tracking ...`). Add after it:

```js
  // ── Comandos remotos de agentes ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS comandos_agente (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agente_id   INTEGER NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL,
    parametro   TEXT,
    estado      TEXT DEFAULT 'pendiente',
    output      TEXT DEFAULT '',
    exit_code   INTEGER,
    creado_por  TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comandos_agente ON comandos_agente(agente_id, estado)`,
  `INSERT OR IGNORE INTO permissions (id, name) VALUES (36, 'monitoring:command')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, 36)`,
```

- [ ] **Step 3: Verify server starts without errors**

```bash
npm start
```

Watch for any SQLite errors in startup output. Server should print the usual startup banner. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add database/schema.sql src/config/database.js
git commit -m "feat(remote-commands): add comandos_agente table and monitoring:command permission"
```

---

## Task 2: Backend Endpoints + Heartbeat Modification

**Files:**
- Modify: `src/monitoring/monitoring-routes.js`

- [ ] **Step 1: Add `canCommand` constant after `canRead` (line 7)**

Find:
```js
const canRead = [requireAuth, requirePermission('monitoring:read')];
```

Add after it:
```js
const canCommand = [requireAuth, requirePermission('monitoring:command')];
```

- [ ] **Step 2: Add the 3 new routes before `export default router`**

Find the SSE route block ending:
```js
  req.on('close', () => sseClients.delete(res));
});

export default router;
```

Replace with:
```js
  req.on('close', () => sseClients.delete(res));
});

/* POST /api/monitoring/agents/:id/command — queue a command for an agent */
router.post('/api/monitoring/agents/:id/command', ...canCommand, (req, res) => {
  const { tipo, parametro } = req.body;
  const validTypes = ['reboot', 'shutdown', 'kill_process', 'clear_temp', 'processes', 'shell'];
  if (!validTypes.includes(tipo)) return res.status(400).json({ error: 'Tipo de comando inválido.' });
  if ((tipo === 'kill_process' || tipo === 'shell') && !parametro?.trim())
    return res.status(400).json({ error: 'parametro requerido para este tipo.' });

  const agent = db.prepare('SELECT id FROM agentes WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agente no encontrado.' });

  const creado_por = req.user?.username || req.user?.name || 'admin';
  const result = db.prepare(`
    INSERT INTO comandos_agente (agente_id, tipo, parametro, creado_por)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, tipo, parametro || null, creado_por);

  broadcast({ type: 'command_queued', agent_id: parseInt(req.params.id), cmd_id: result.lastInsertRowid });
  res.json({ cmd_id: result.lastInsertRowid });
});

/* POST /api/monitoring/command/:id/output — agent streams output chunks */
router.post('/api/monitoring/command/:id/output', agentAuth, (req, res) => {
  const { chunk, done, exit_code } = req.body;
  const cmd = db.prepare('SELECT agente_id FROM comandos_agente WHERE id = ?').get(req.params.id);
  if (!cmd) return res.status(404).json({ error: 'Comando no encontrado.' });
  if (cmd.agente_id !== req.agentId) return res.status(403).json({ error: 'Forbidden.' });

  if (chunk) {
    db.prepare(`UPDATE comandos_agente SET output = output || ?, updated_at = datetime('now') WHERE id = ?`)
      .run(chunk, req.params.id);
    broadcast({ type: 'command_output', cmd_id: parseInt(req.params.id), agent_id: req.agentId, chunk });
  }

  if (done) {
    const estado = (exit_code === 0) ? 'completado' : 'error';
    db.prepare(`UPDATE comandos_agente SET estado = ?, exit_code = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(estado, exit_code ?? 1, req.params.id);
    broadcast({ type: 'command_done', cmd_id: parseInt(req.params.id), agent_id: req.agentId, exit_code: exit_code ?? 1 });
  }

  res.json({ ok: true });
});

/* GET /api/monitoring/agents/:id/commands — last 50 commands for an agent */
router.get('/api/monitoring/agents/:id/commands', ...canCommand, (req, res) => {
  const commands = db.prepare(`
    SELECT * FROM comandos_agente
    WHERE agente_id = ?
    ORDER BY id DESC LIMIT 50
  `).all(req.params.id);
  res.json(commands);
});

export default router;
```

- [ ] **Step 3: Modify heartbeat to return pending commands**

Find:
```js
  res.json({ ok: true });
});

/* GET /api/monitoring/agents */
```

Replace `res.json({ ok: true });` with:
```js
  const pending = db.prepare(`
    SELECT id, tipo, parametro FROM comandos_agente
    WHERE agente_id = ? AND estado = 'pendiente'
    ORDER BY id ASC LIMIT 5
  `).all(req.agentId);

  if (pending.length) {
    const ids = pending.map(c => c.id);
    db.prepare(
      `UPDATE comandos_agente SET estado = 'ejecutando', updated_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(',')})`
    ).run(...ids);
  }

  res.json({ ok: true, commands: pending });
});

/* GET /api/monitoring/agents */
```

- [ ] **Step 4: Add dangling command cleanup to `startOfflineChecker`**

Find inside `startOfflineChecker`:
```js
    db.prepare(`DELETE FROM metricas_agentes WHERE timestamp < datetime('now', '-24 hours')`).run();
```

Add after it:
```js
    db.prepare(`
      UPDATE comandos_agente
      SET estado = 'error',
          output = output || '\n[Error: tiempo de espera agotado]',
          updated_at = datetime('now')
      WHERE estado = 'ejecutando'
        AND datetime(updated_at) < datetime('now', '-5 minutes')
    `).run();
```

- [ ] **Step 5: Verify new routes exist**

```bash
npm start
```

In a new terminal (server must be running, log in first to get session cookie, or use an IT user's token):

```bash
curl -s http://localhost:3000/api/monitoring/agents/999/command -X POST -H "Content-Type: application/json" -d "{\"tipo\":\"processes\"}"
```

Expected: `{"error":"No autenticado."}` (401 — route exists, auth working).

- [ ] **Step 6: Commit**

```bash
git add src/monitoring/monitoring-routes.js
git commit -m "feat(remote-commands): add command endpoints and heartbeat command delivery"
```

---

## Task 3: Agent — Command Execution

**Files:**
- Modify: `agent/agent.js`

- [ ] **Step 1: Add `spawn` to the requires at the top of `agent/agent.js`**

Find:
```js
const { readFileSync, writeFileSync, existsSync } = require('fs');
```

Add after it:
```js
const { spawn } = require('child_process');
```

- [ ] **Step 2: Add `executeCommand` function after `sendHeartbeat`**

Find:
```js
async function main() {
```

Add before it:
```js
async function executeCommand(serverUrl, agentId, apiKey, cmd) {
  const commandMap = {
    reboot:       ['shutdown', ['/r', '/t', '30']],
    shutdown:     ['shutdown', ['/s', '/t', '30']],
    kill_process: ['taskkill', ['/F', '/IM', cmd.parametro || '']],
    clear_temp:   ['powershell', ['-NoProfile', '-Command',
      'Remove-Item "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue;' +
      'Remove-Item "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue;' +
      'Write-Output "Temporales eliminados."']],
    processes:    ['tasklist', ['/FO', 'TABLE']],
    shell:        ['powershell', ['-NoProfile', '-Command', cmd.parametro || 'Write-Output "sin comando"']],
  };

  const [prog, args] = commandMap[cmd.tipo] || ['powershell', ['-NoProfile', '-Command', `Write-Output "tipo desconocido: ${cmd.tipo}"`]];

  async function postChunk(chunk, done, exit_code) {
    try {
      await fetch(`${serverUrl}/api/monitoring/command/${cmd.id}/output`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-id':   String(agentId),
          'x-api-key':    apiKey,
        },
        body: JSON.stringify({ chunk, done, exit_code }),
      });
    } catch (e) {
      console.error(`[Agent] chunk POST failed for cmd ${cmd.id}: ${e.message}`);
    }
  }

  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(prog, args, { shell: false, windowsHide: true });
    } catch (e) {
      postChunk(`[Error al lanzar proceso: ${e.message}]\n`, true, 1).then(resolve);
      return;
    }

    proc.stdout.on('data', (data) => postChunk(data.toString(), false, undefined));
    proc.stderr.on('data', (data) => postChunk(data.toString(), false, undefined));

    proc.on('error', async (err) => {
      await postChunk(`[Error: ${err.message}]\n`, true, 1);
      resolve();
    });

    proc.on('close', async (code) => {
      await postChunk('', true, code ?? 0);
      resolve();
    });
  });
}

```

- [ ] **Step 3: Modify `sendHeartbeat` to return parsed JSON**

Find:
```js
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
```

Replace with:
```js
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
  return res.json();
}
```

- [ ] **Step 4: Modify `tick()` to loop through commands**

Find:
```js
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
```

Replace with:
```js
  async function tick() {
    try {
      const data = await sendHeartbeat(serverUrl, agentId, apiKey);
      retryDelay = interval;
      for (const cmd of data.commands || []) {
        executeCommand(serverUrl, agentId, apiKey, cmd).catch(e =>
          console.error(`[Agent] Comando ${cmd.id} (${cmd.tipo}) falló: ${e.message}`)
        );
      }
    } catch (e) {
      console.error(`[Agent] ${e.message} — retry in ${retryDelay / 1000}s`);
      retryDelay = Math.min(retryDelay * 2, 120000);
    }
    setTimeout(tick, retryDelay);
  }
```

- [ ] **Step 5: Manual verification (agent must be running, server running)**

With server running on localhost:3000 and agent registered:

```bash
cd agent
node agent.js
```

In a separate window, create a command via curl (replace AGENT_ID, SESSION_COOKIE with real values):
```bash
curl -X POST http://localhost:3000/api/monitoring/agents/1/command \
  -H "Content-Type: application/json" \
  -H "Cookie: <session_cookie>" \
  -d '{"tipo":"processes"}'
```

Expected in agent console within 10s: heartbeat picks up the command and logs nothing unusual. Check DB:
```bash
# In sqlite3 or a DB viewer:
SELECT id, tipo, estado, substr(output,1,100) FROM comandos_agente ORDER BY id DESC LIMIT 1;
```

Expected: `estado = 'completado'`, output contains process list.

- [ ] **Step 6: Commit**

```bash
git add agent/agent.js
git commit -m "feat(remote-commands): agent executes commands from heartbeat response with streaming output"
```

---

## Task 4: Frontend — Remote Control UI

**Files:**
- Modify: `public/js/monitoreo.js`

- [ ] **Step 1: Replace `buildAccordion` (lines 161–177) with extended version**

Find and replace the entire `buildAccordion` function:

```js
function buildAccordion(a) {
  const hwCards = [
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
    </div>`).join('');

  const btnStyle = (bg, fg) =>
    `style="background:${bg};color:${fg};border:1px solid ${fg}40;border-radius:5px;padding:5px 12px;font-size:12px;cursor:pointer;font-weight:500;"`;

  return `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      ${hwCards}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px;">
      <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">⚡ Control Remoto</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        <button onclick="monSendCmd(${a.id},'reboot')"    ${btnStyle('#ef444418','#ef4444')}>⟳ Reiniciar PC</button>
        <button onclick="monSendCmd(${a.id},'shutdown')"  ${btnStyle('#64748b18','#94a3b8')}>⊟ Apagar PC</button>
        <button onclick="monPromptCmd(${a.id},'kill_process','Nombre del proceso (ej: chrome.exe)')" ${btnStyle('#8b5cf618','#8b5cf6')}>✕ Matar proceso…</button>
        <button onclick="monSendCmd(${a.id},'clear_temp')" ${btnStyle('#06b6d418','#06b6d4')}>🗑 Limpiar temp</button>
        <button onclick="monSendCmd(${a.id},'processes')" ${btnStyle('#3b82f618','#3b82f6')}>≡ Ver procesos</button>
      </div>
      <div style="background:#0d1117;border-radius:6px;overflow:hidden;border:1px solid #30363d;">
        <div style="background:#161b22;padding:6px 12px;font-size:11px;color:#6e7681;border-bottom:1px solid #30363d;">
          Consola — ${a.hostname||'equipo'}
        </div>
        <pre id="mon-console-${a.id}" style="padding:10px 14px;font-family:monospace;font-size:11px;color:#c9d1d9;min-height:60px;max-height:300px;overflow-y:auto;margin:0;white-space:pre-wrap;word-break:break-all;"></pre>
        <div style="border-top:1px solid #30363d;display:flex;align-items:center;padding:6px 10px;gap:8px;">
          <span style="color:#3fb950;font-family:monospace;font-size:12px;flex-shrink:0;">PS&gt;</span>
          <input id="mon-shell-${a.id}"
            placeholder="Comando PowerShell libre…"
            style="flex:1;background:transparent;border:none;outline:none;color:#c9d1d9;font-family:monospace;font-size:12px;"
            onkeydown="if(event.key==='Enter')monSendShell(${a.id})"/>
          <button onclick="monSendShell(${a.id})"
            style="background:#238636;color:#fff;border:none;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer;flex-shrink:0;">▶</button>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Add three global command functions before `toggleAccordion`**

Find:
```js
function toggleAccordion(id) {
```

Add before it:
```js
window.monSendCmd = async function(agentId, tipo, parametro) {
  const pre = document.getElementById(`mon-console-${agentId}`);
  if (pre) {
    pre.textContent += `\n$ ${tipo}${parametro ? ' ' + parametro : ''}\n`;
    pre.scrollTop = pre.scrollHeight;
  }
  try {
    const body = { tipo };
    if (parametro !== undefined && parametro !== null) body.parametro = parametro;
    const res = await fetch(`/api/monitoring/agents/${agentId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      if (pre) pre.textContent += `[Error: ${err.error}]\n`;
    }
  } catch {
    showToast('Error enviando comando', 'error');
  }
};

window.monPromptCmd = function(agentId, tipo, label) {
  const pre = document.getElementById(`mon-console-${agentId}`);
  if (!pre) return;
  const existing = document.getElementById(`mon-prompt-${agentId}`);
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = `mon-prompt-${agentId}`;
  wrap.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 10px;border-top:1px solid #30363d;background:#161b22;';
  wrap.innerHTML = `
    <input id="mon-prompt-input-${agentId}" placeholder="${label}"
      style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 8px;color:#c9d1d9;font-family:monospace;font-size:11px;outline:none;"
      onkeydown="if(event.key==='Enter'){const v=this.value.trim();if(v)monSendCmd(${agentId},'${tipo}',v);document.getElementById('mon-prompt-${agentId}')?.remove();}
                 if(event.key==='Escape')document.getElementById('mon-prompt-${agentId}')?.remove();" />
    <button onclick="const v=document.getElementById('mon-prompt-input-${agentId}').value.trim();if(v)monSendCmd(${agentId},'${tipo}',v);document.getElementById('mon-prompt-${agentId}')?.remove();"
      style="background:#238636;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;">OK</button>
    <button onclick="document.getElementById('mon-prompt-${agentId}')?.remove();"
      style="background:transparent;color:#6e7681;border:1px solid #30363d;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;">✕</button>
  `;
  pre.parentElement.insertBefore(wrap, pre.nextSibling);
  wrap.querySelector('input').focus();
};

window.monSendShell = function(agentId) {
  const input = document.getElementById(`mon-shell-${agentId}`);
  if (!input || !input.value.trim()) return;
  monSendCmd(agentId, 'shell', input.value.trim());
  input.value = '';
};

```

- [ ] **Step 3: Add SSE handlers for command events in `connectSSE`**

Find:
```js
    } else if (['offline_sweep','agent_registered','agent_updated'].includes(data.type)) {
      loadAgents();
    }
```

Replace with:
```js
    } else if (['offline_sweep','agent_registered','agent_updated'].includes(data.type)) {
      loadAgents();
    } else if (data.type === 'command_output' && data.chunk) {
      const pre = document.getElementById(`mon-console-${data.agent_id}`);
      if (pre) { pre.textContent += data.chunk; pre.scrollTop = pre.scrollHeight; }
    } else if (data.type === 'command_done') {
      const pre = document.getElementById(`mon-console-${data.agent_id}`);
      if (pre) {
        pre.textContent += `[salió con código ${data.exit_code}]\n`;
        pre.scrollTop = pre.scrollHeight;
      }
    }
```

- [ ] **Step 4: Verify in browser**

```bash
npm start
```

1. Open `http://localhost:3000` → log in as IT admin → go to `#monitoreo`
2. Expand any online agent row → accordion shows hardware cards + "⚡ Control Remoto" section + console
3. Click "≡ Ver procesos" → within 10s (next heartbeat) console fills with `tasklist` output
4. Type a command in the PS> input → press Enter → output appears streaming
5. Click "✕ Matar proceso…" → inline prompt appears → type `notepad.exe` → OK → console shows result

- [ ] **Step 5: Commit**

```bash
git add public/js/monitoreo.js
git commit -m "feat(remote-commands): add remote control UI to monitoring accordion with streaming console"
```
