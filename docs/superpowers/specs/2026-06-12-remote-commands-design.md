# Remote Commands — Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Goal

Allow IT admins to execute commands on monitored Windows PCs directly from the Monitoreo panel. Output streams in real time via SSE. Includes 5 predefined action buttons + free PowerShell console.

---

## Architecture

Pull-based command delivery. Agent stays outbound-only (no inbound ports). Server queues commands in SQLite; agent picks them up on next heartbeat (≤10s). Once picked up, output chunks stream immediately via POST → SSE broadcast.

```
Admin click → POST /api/monitoring/agents/:id/command
           → INSERT comandos_agente (estado=pendiente)
           → SSE broadcast: command_queued

Agent heartbeat response includes commands[]
           → agent spawns PowerShell process (spawn, not execSync)
           → per stdout/stderr chunk:
                POST /api/monitoring/command/:id/output { chunk, done:false }
                → SSE broadcast: command_output → frontend appends to console
           → on process exit:
                POST /api/monitoring/command/:id/output { done:true, exit_code }
                → SSE broadcast: command_done → frontend shows exit code
```

---

## DB Schema

Add to `database/schema.sql`:

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

**`tipo` values:** `reboot` | `shutdown` | `kill_process` | `clear_temp` | `processes` | `shell`

**`parametro`:** process name for `kill_process`; PowerShell command string for `shell`; NULL for others.

**`estado` values:** `pendiente` → `ejecutando` → `completado` | `error`

---

## Backend

### New endpoints in `src/monitoring/monitoring-routes.js`

#### `POST /api/monitoring/agents/:id/command` — [requireAuth + requirePermission('monitoring:command')]
```
body: { tipo: string, parametro?: string }
→ validates agente exists
→ INSERT INTO comandos_agente (agente_id, tipo, parametro, creado_por=req.user.username)
→ broadcast({ type:'command_queued', agent_id, cmd_id })
→ res.json({ cmd_id })
```

#### `POST /api/monitoring/command/:id/output` — [agentAuth]
```
body: { chunk: string, done: boolean, exit_code?: number }
→ UPDATE comandos_agente SET output = output || chunk, updated_at = now()
   if done: SET estado = exit_code===0 ? 'completado' : 'error', exit_code
→ broadcast({ type:'command_output', cmd_id, agent_id, chunk })
   if done: broadcast({ type:'command_done', cmd_id, agent_id, exit_code })
→ res.json({ ok: true })
```

#### `GET /api/monitoring/agents/:id/commands` — [requireAuth + requirePermission('monitoring:command')]
```
→ SELECT last 50 commands for agent, ORDER BY id DESC
→ res.json(commands)
```

### Modified: heartbeat response

```js
// After updating agent estado/last_seen, fetch and mark pending commands:
const pending = db.prepare(`
  SELECT id, tipo, parametro FROM comandos_agente
  WHERE agente_id = ? AND estado = 'pendiente'
  ORDER BY id ASC LIMIT 5
`).all(req.agentId);

if (pending.length) {
  db.prepare(`
    UPDATE comandos_agente SET estado = 'ejecutando', updated_at = datetime('now')
    WHERE id IN (${pending.map(() => '?').join(',')})
  `).run(...pending.map(c => c.id));
}

res.json({ ok: true, commands: pending });
```

---

## Agent (`agent/agent.js`)

### Modified: `sendHeartbeat` → returns commands

```js
async function sendHeartbeat(serverUrl, agentId, apiKey) {
  const metrics = await getMetrics();
  const res = await fetch(`${serverUrl}/api/monitoring/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-agent-id':String(agentId), 'x-api-key':apiKey },
    body: JSON.stringify(metrics),
  });
  if (!res.ok) throw new Error(`Heartbeat failed: ${res.status}`);
  return res.json(); // { ok, commands: [] }
}
```

### New: `executeCommand(serverUrl, agentId, apiKey, cmd)`

Maps `cmd.tipo` to PowerShell args:

| tipo | args |
|---|---|
| `reboot` | `shutdown /r /t 30` |
| `shutdown` | `shutdown /s /t 30` |
| `kill_process` | `taskkill /F /IM <parametro>` |
| `clear_temp` | `Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue` |
| `processes` | `tasklist /FO TABLE` |
| `shell` | `powershell -NoProfile -Command "<parametro>"` |

Uses `spawn('powershell', ['-NoProfile', '-Command', builtCommand], { shell: false })`.

Streams `stdout` and `stderr` via POST to `/api/monitoring/command/:id/output`. On `close` event, sends `{ done: true, exit_code }`.

### Modified: `tick()`

```js
const data = await sendHeartbeat(serverUrl, agentId, apiKey);
for (const cmd of data.commands || []) {
  executeCommand(serverUrl, agentId, apiKey, cmd).catch(e =>
    console.error(`[Agent] Command ${cmd.id} failed: ${e.message}`)
  );
}
```

---

## Frontend (`public/js/monitoreo.js`)

### `buildAccordion(a)` — extended

After the 6 hardware cards grid, append a "Control Remoto" section:

```html
<div class="remote-section">
  <div class="section-label">⚡ Control Remoto</div>
  <div class="action-buttons">
    <button onclick="sendCommand(agentId, 'reboot')">⟳ Reiniciar PC</button>
    <button onclick="sendCommand(agentId, 'shutdown')">⊟ Apagar PC</button>
    <button onclick="promptAndSend(agentId, 'kill_process', 'Nombre del proceso (ej: chrome.exe)')">✕ Matar proceso…</button>
    <button onclick="sendCommand(agentId, 'clear_temp')">🗑 Limpiar temp</button>
    <button onclick="sendCommand(agentId, 'processes')">≡ Ver procesos</button>
  </div>
  <div class="console-wrap" id="console-${agentId}">
    <div class="console-header">...</div>
    <pre class="console-output" id="output-${agentId}"></pre>
    <div class="console-input-row">
      <span>PS&gt;</span>
      <input id="shell-${agentId}" placeholder="Comando PowerShell libre…" />
      <button onclick="sendShell(agentId)">▶ Ejecutar</button>
    </div>
  </div>
</div>
```

### New functions

**`sendCommand(agentId, tipo, parametro?)`**
```js
→ append "$ <tipo> <parametro>\n" to console output
→ POST /api/monitoring/agents/:agentId/command { tipo, parametro }
→ on success: show spinner in console
→ on error: show error toast
```

**`promptAndSend(agentId, tipo, promptText)`**
```js
→ show inline mini-form (input + confirm) instead of window.prompt
→ on confirm: sendCommand(agentId, tipo, inputValue)
```

**`sendShell(agentId)`**
```js
→ read input value
→ sendCommand(agentId, 'shell', inputValue)
→ clear input
```

### Modified: SSE handler in `connectSSE()`

```js
} else if (data.type === 'command_output') {
  const pre = document.getElementById(`output-${data.agent_id}`);
  if (pre) { pre.textContent += data.chunk; pre.scrollTop = pre.scrollHeight; }
} else if (data.type === 'command_done') {
  const pre = document.getElementById(`output-${data.agent_id}`);
  if (pre) pre.textContent += `\n[exit: ${data.exit_code}]\n`;
} else if (data.type === 'command_queued') {
  // spinner already shown by sendCommand
}
```

### Console is append-mode (terminal-style)

Each `sendCommand` appends a prompt line (`$ tipo parametro`) followed by streaming output. Previous commands remain visible above — the console scrolls to bottom automatically. Output is DOM-only (not persisted); refreshing the page clears it.

---

## File Map

| File | Action |
|---|---|
| `database/schema.sql` | Add `comandos_agente` table + index |
| `src/config/database.js` | Migration for table |
| `src/monitoring/monitoring-routes.js` | 3 new endpoints + heartbeat response mod |
| `agent/agent.js` | `sendHeartbeat` returns data; `executeCommand`; `tick` loops commands |
| `public/js/monitoreo.js` | `buildAccordion` extended; `sendCommand`/`sendShell`/`promptAndSend`; SSE handlers |

---

## Security

- Command creation requires `monitoring:command` permission (id=36, assigned only to role_id=1).
- Migration: `INSERT OR IGNORE INTO permissions (id,name) VALUES (36,'monitoring:command')` + role_permission (1,36).
- `shell` tipo allows arbitrary PowerShell — intentional for IT use, restricted to IT role only.
- Agent auth on output endpoint prevents output spoofing (agentAuth checks x-agent-id + x-api-key).
- Commands scoped to agent via `agente_id` FK — no cross-agent execution possible.
- `comandos_agente` records are kept permanently for audit trail.

---

## Error Handling

- Agent offline when command queued: stays `pendiente` in DB; delivered on next agent connection.
- Agent crash mid-command: `ejecutando` records left dangling — a periodic cleanup job marks them `error` after 5 minutes with no update.
- PowerShell spawn failure: `executeCommand` catches and POSTs error message as chunk + `done:true, exit_code:1`.
- Network error during chunk POST: agent retries once after 2s, then logs and moves on.
