# AI KB Panel en Ticket Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar tab "Asistente AI" en ticket-detail que auto-analiza el ticket contra el KB, muestra sugerencias LLM, y ejecuta comandos KB en el equipo remoto del solicitante.

**Architecture:** Tab izquierdo en `.timeline-card` existente. Auto-análisis al abrir tab via `POST /api/ai/analyze`. Ejecución via `POST /api/monitoring/agents/:id/command` con `tipo:'shell'`; output via polling `GET /api/monitoring/agents/:id/commands`.

**Tech Stack:** Vanilla JS ES modules, Express REST API (ya implementado), SQLite via better-sqlite3

---

## File Map

| Archivo | Cambio |
|---------|--------|
| `public/js/data-service.js` | Agregar 4 métodos al objeto `DataService` (línea 738, antes de `};`) |
| `public/js/components.js` | Agregar 2 funciones export al final del archivo |
| `public/js/ticket-detail.js` | Convertir timeline-card a tabs; agregar lógica AI tab completa |

---

## Task 1: Agregar métodos AI/monitoring a DataService

**Files:**
- Modify: `public/js/data-service.js:738` (insertar antes de `};`)

- [ ] **Step 1: Insertar los 4 métodos nuevos en DataService**

En `public/js/data-service.js`, reemplazar la línea `};` final (línea ~739) con:

```js
  async analyzeTicket(problema, ticketId) {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problema, ticket_id: ticketId })
    });
    if (!res.ok) throw new Error(`analyze error ${res.status}`);
    return res.json(); // { kb: [...], ai: string|null }
  },

  async getOnlineAgents() {
    const res = await fetch('/api/monitoring/agents');
    if (!res.ok) throw new Error(`agents error ${res.status}`);
    const all = await res.json();
    return all.filter(a => a.status === 'online');
  },

  async executeRemoteCommand(agentId, commands) {
    // commands: string[] — se unen con \r\n como script shell único
    const parametro = commands.join('\r\n');
    const res = await fetch(`/api/monitoring/agents/${agentId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'shell', parametro })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `command error ${res.status}`);
    }
    return res.json(); // { cmd_id }
  },

  async getCommandStatus(agentId, cmdId) {
    const res = await fetch(`/api/monitoring/agents/${agentId}/commands`);
    if (!res.ok) throw new Error(`commands error ${res.status}`);
    const list = await res.json();
    return list.find(c => c.id === cmdId) || null;
    // { id, estado: 'pendiente'|'ejecutando'|'completado'|'error', output, exit_code }
  },
};
export default DataService;
```

- [ ] **Step 2: Verificar en navegador**

Abrir DevTools → Console en cualquier ticket abierto. Ejecutar:
```js
const ds = (await import('/js/data-service.js')).default;
await ds.getOnlineAgents();
// debe devolver array (vacío si no hay agentes online, no error)
```

- [ ] **Step 3: Commit**

```bash
git add public/js/data-service.js
git commit -m "feat(ai-panel): add analyzeTicket, getOnlineAgents, executeRemoteCommand to DataService"
```

---

## Task 2: Agregar componentes HTML helpers

**Files:**
- Modify: `public/js/components.js` (agregar al final)

- [ ] **Step 1: Agregar `createAiKbCard` al final de components.js**

```js
/**
 * Tarjeta de resultado KB para el tab AI.
 * @param {object} item  - item de kb_items con campos: id, titulo, categoria, solucion, comandos, _score
 * @param {boolean} isBestMatch
 */
export function createAiKbCard(item, isBestMatch) {
  let cmds = [];
  try { cmds = JSON.parse(item.comandos || '[]'); } catch {}
  const cmdCount = cmds.length;
  const solucionCorta = item.solucion.length > 120
    ? item.solucion.slice(0, 120) + '…'
    : item.solucion;

  return `
    <div class="ai-kb-card" data-kb-id="${item.id}" style="
      background: var(--surface-2, #1e293b);
      border: 1px solid ${isBestMatch ? 'var(--primary, #3b82f6)' : 'var(--border, #334155)'};
      border-radius: 8px; padding: 12px; margin-bottom: 10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="color:var(--primary,#60a5fa);font-weight:600;font-size:13px;">📚 ${item.titulo}</div>
        ${isBestMatch ? '<span style="background:#166534;color:#4ade80;font-size:9px;padding:2px 7px;border-radius:3px;white-space:nowrap;">MEJOR MATCH</span>' : ''}
      </div>
      <div style="color:var(--text-muted,#94a3b8);font-size:11px;margin-bottom:6px;text-transform:capitalize;">
        ${item.categoria}${cmdCount > 0 ? ` · ${cmdCount} comando${cmdCount > 1 ? 's' : ''}` : ''}
      </div>
      <div class="ai-kb-solucion" style="color:var(--text,#cbd5e1);font-size:12px;margin-bottom:10px;">${solucionCorta}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${cmdCount > 0 ? `<button class="btn btn-primary btn-small ai-btn-exec" data-kb-id="${item.id}" style="font-size:12px;">▶ Ejecutar en equipo</button>` : ''}
        <button class="btn btn-secondary btn-small ai-btn-ver" data-kb-id="${item.id}" style="font-size:12px;">Ver solución completa</button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Agregar `createExecutionModal` al final de components.js**

```js
/**
 * Modal de confirmación de ejecución remota.
 * @param {object[]} onlineAgents  - agentes con status='online'
 * @param {string[]} commands      - lista de comandos a ejecutar
 * @param {number|null} linkedAgentId - id del agente vinculado al ticket (null si ninguno)
 * @param {string} kbTitulo        - nombre del item KB para el título
 */
export function createExecutionModal(onlineAgents, commands, linkedAgentId, kbTitulo) {
  const linkedOnline = linkedAgentId
    ? onlineAgents.find(a => a.id === linkedAgentId)
    : null;

  const agentSelectorHtml = linkedOnline
    ? `
      <div style="display:flex;align-items:center;gap:10px;background:rgba(22,101,52,.25);border:1px solid #166534;border-radius:6px;padding:10px;margin-bottom:10px;">
        <span style="font-size:20px;">🖥️</span>
        <div>
          <div style="color:#4ade80;font-weight:600;font-size:13px;">${linkedOnline.name} <span style="background:#166534;color:#4ade80;font-size:9px;padding:1px 5px;border-radius:3px;">Online</span></div>
          <div style="color:#86efac;font-size:11px;">Equipo del solicitante</div>
        </div>
      </div>
      <input type="hidden" id="exec-agent-id" value="${linkedOnline.id}">`
    : `
      <div style="color:#fbbf24;font-size:12px;margin-bottom:8px;">
        ⚠️ ${linkedAgentId ? 'Equipo del solicitante offline.' : 'Sin equipo vinculado.'} Selecciona destino:
      </div>
      <select id="exec-agent-id" style="width:100%;margin-bottom:10px;font-size:12px;">
        ${onlineAgents.length === 0
          ? '<option value="">Sin equipos online disponibles</option>'
          : onlineAgents.map(a =>
              `<option value="${a.id}">${a.name} — Online ✅</option>`
            ).join('')
        }
      </select>`;

  const cmdHtml = commands.map(c => `<div>${c}</div>`).join('');
  const canExec = linkedOnline || onlineAgents.length > 0;

  return `
    <div id="exec-modal-overlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;
      display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="
        background:var(--surface,#0f172a);border:2px solid var(--primary,#3b82f6);
        border-radius:10px;padding:20px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;">
        <div style="font-weight:700;font-size:15px;margin-bottom:14px;">▶ Ejecutar: ${kbTitulo}</div>
        ${agentSelectorHtml}
        <div style="font-size:11px;color:var(--text-muted,#94a3b8);margin-bottom:4px;">Comandos a ejecutar:</div>
        <div style="background:#0a0a0a;border-radius:4px;padding:10px;font-family:monospace;font-size:11px;color:#4ade80;margin-bottom:14px;white-space:pre-wrap;max-height:120px;overflow-y:auto;">${cmdHtml}</div>
        <div id="exec-output-section" style="display:none;margin-bottom:12px;">
          <div style="font-size:11px;color:var(--text-muted,#94a3b8);margin-bottom:4px;">Output:</div>
          <div id="exec-output" style="background:#0a0a0a;border-radius:4px;padding:10px;font-family:monospace;font-size:11px;color:#e2e8f0;white-space:pre-wrap;max-height:160px;overflow-y:auto;"></div>
        </div>
        <div id="exec-post-actions" style="display:none;gap:8px;flex-wrap:wrap;margin-bottom:12px;"></div>
        <div style="display:flex;gap:8px;" id="exec-action-buttons">
          <button id="btn-exec-confirm" class="btn btn-primary" style="flex:1;" ${canExec ? '' : 'disabled'}>
            ✓ Confirmar y ejecutar
          </button>
          <button id="btn-exec-cancel" class="btn btn-secondary">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/js/components.js
git commit -m "feat(ai-panel): add createAiKbCard and createExecutionModal components"
```

---

## Task 3: Convertir timeline-card a tabs en ticket-detail.js

**Files:**
- Modify: `public/js/ticket-detail.js`

El HTML actual de la columna izquierda (línea ~71) es:
```html
<div class="card timeline-card">
  <div class="section-title">Conversación de WhatsApp</div>
  <div class="timeline-messages" id="timeline-messages-container">...</div>
  ...form reply...
</div>
```

- [ ] **Step 1: Reemplazar el wrapper de la columna izquierda**

Localizar en `ticket-detail.js` la línea con `<div class="card timeline-card">` y reemplazarla con:

```html
<div class="card timeline-card">
  <!-- Tabs -->
  <div style="display:flex;gap:0;border-bottom:1px solid var(--border,#334155);margin-bottom:16px;">
    <button id="tab-btn-conv" onclick="switchTab('conv')" style="
      padding:8px 16px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;
      color:var(--primary,#60a5fa);border-bottom:2px solid var(--primary,#3b82f6);">
      💬 Conversación
    </button>
    <button id="tab-btn-ai" onclick="switchTab('ai')" style="
      padding:8px 16px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;
      color:var(--text-muted,#94a3b8);border-bottom:2px solid transparent;">
      🤖 Asistente AI
    </button>
  </div>

  <!-- Panel Conversación -->
  <div id="tab-panel-conv">
    <div class="section-title" style="margin-bottom:14px;">Conversación de WhatsApp</div>
```

Al final de todo el bloque de conversación (antes del cierre del `.card.timeline-card`), agregar:

```html
  </div><!-- /tab-panel-conv -->

  <!-- Panel AI -->
  <div id="tab-panel-ai" style="display:none;">
    <div id="ai-tab-content">
      <!-- se llena por initAiTab() -->
    </div>
  </div>
</div><!-- /card.timeline-card -->
```

- [ ] **Step 2: Agregar función `switchTab` y flag `_aiTabInitialized`**

Justo después de `await loadTicketData();` al final de `renderTicketDetail`, agregar:

```js
// Exponer switchTab en window para los onclick del HTML
let _aiTabInitialized = false;
window.switchTab = function(tab) {
  const conv = document.getElementById('tab-panel-conv');
  const ai   = document.getElementById('tab-panel-ai');
  const btnConv = document.getElementById('tab-btn-conv');
  const btnAi   = document.getElementById('tab-btn-ai');
  if (!conv || !ai) return;

  if (tab === 'conv') {
    conv.style.display = '';
    ai.style.display   = 'none';
    btnConv.style.color = 'var(--primary,#60a5fa)';
    btnConv.style.borderBottomColor = 'var(--primary,#3b82f6)';
    btnAi.style.color = 'var(--text-muted,#94a3b8)';
    btnAi.style.borderBottomColor = 'transparent';
  } else {
    conv.style.display = 'none';
    ai.style.display   = '';
    btnAi.style.color = 'var(--primary,#60a5fa)';
    btnAi.style.borderBottomColor = 'var(--primary,#3b82f6)';
    btnConv.style.color = 'var(--text-muted,#94a3b8)';
    btnConv.style.borderBottomColor = 'transparent';
    if (!_aiTabInitialized) {
      _aiTabInitialized = true;
      initAiTab(ticket);
    }
  }
};
```

- [ ] **Step 3: Verificar tabs en navegador**

Abrir un ticket → deben aparecer 2 tabs. Clic en "🤖 Asistente AI" → muestra el div vacío (sin error). Clic en "💬 Conversación" → vuelve a la conversación.

- [ ] **Step 4: Commit**

```bash
git add public/js/ticket-detail.js
git commit -m "feat(ai-panel): add tabbed layout to ticket-detail left column"
```

---

## Task 4: Implementar auto-análisis y renderizado de resultados

**Files:**
- Modify: `public/js/ticket-detail.js`

- [ ] **Step 1: Agregar imports al tope de ticket-detail.js**

Agregar `createAiKbCard` al import de components.js:

```js
import { showToast, createLoadingSpinner } from './components.js';
// cambiar a:
import { showToast, createLoadingSpinner, createAiKbCard } from './components.js';
```

- [ ] **Step 2: Agregar función `initAiTab` en ticket-detail.js**

Agregar antes de `export async function renderTicketDetail`:

```js
async function initAiTab(ticket) {
  const container = document.getElementById('ai-tab-content');
  if (!container) return;

  const problema = ticket.description || '';

  // Spinner
  container.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--text-muted,#64748b);">
      <div style="font-size:28px;margin-bottom:10px;">⏳</div>
      <div style="font-size:13px;">Analizando problema del ticket...</div>
    </div>`;

  try {
    const { kb, ai } = await DataService.analyzeTicket(problema, ticket.id);

    let html = '';

    // Bloque análisis LLM (solo si hay respuesta)
    if (ai) {
      html += `
        <div style="background:rgba(22,101,52,.2);border:1px solid #166534;border-radius:8px;padding:12px;margin-bottom:14px;">
          <div style="color:#4ade80;font-weight:600;font-size:12px;margin-bottom:6px;">🤖 Análisis IA</div>
          <div style="color:#bbf7d0;font-size:12px;line-height:1.6;">${ai}</div>
        </div>`;
    }

    // Tarjetas KB
    if (kb.length === 0) {
      html += `<div style="color:var(--text-muted,#94a3b8);font-size:13px;text-align:center;padding:20px 0;">
        Sin coincidencias en la base de conocimiento.</div>`;
    } else {
      kb.forEach((item, i) => {
        html += createAiKbCard(item, i === 0);
      });
    }

    // Botón re-analizar + campo editable
    html += `
      <div style="margin-top:14px;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;">
        <textarea id="ai-reanalyze-input" style="flex:1;min-width:160px;font-size:12px;min-height:38px;resize:vertical;"
          placeholder="Ajusta la descripción del problema...">${problema}</textarea>
        <button id="btn-ai-reanalyze" class="btn btn-secondary" style="font-size:12px;white-space:nowrap;">🔄 Re-analizar</button>
      </div>`;

    container.innerHTML = html;

    // Re-analizar
    document.getElementById('btn-ai-reanalyze')?.addEventListener('click', async () => {
      const nuevoProblema = document.getElementById('ai-reanalyze-input')?.value?.trim();
      if (!nuevoProblema) return;
      const fakeTicket = { ...ticket, description: nuevoProblema };
      await initAiTab(fakeTicket);
    });

    // Wiring de tarjetas KB
    wireKbCardEvents(ticket, kb);

  } catch (err) {
    container.innerHTML = `
      <div style="color:var(--color-error,#f87171);font-size:13px;text-align:center;padding:20px;">
        Error al analizar el ticket: ${err.message}
      </div>`;
  }
}
```

- [ ] **Step 3: Verificar en navegador**

Abrir un ticket con descripción (ej: "no imprime"). Clic en tab "🤖 Asistente AI". Debe:
1. Mostrar spinner brevemente
2. Mostrar resultados KB (si hay items en la tabla `kb_items`)
3. Si LLM no configurado: solo tarjetas KB, sin bloque verde AI
4. Botón "🔄 Re-analizar" funcional

- [ ] **Step 4: Commit**

```bash
git add public/js/ticket-detail.js
git commit -m "feat(ai-panel): implement AI tab auto-analysis and KB results rendering"
```

---

## Task 5: Implementar flujo de ejecución remota

**Files:**
- Modify: `public/js/ticket-detail.js`

- [ ] **Step 1: Agregar import `createExecutionModal`**

```js
import { showToast, createLoadingSpinner, createAiKbCard, createExecutionModal } from './components.js';
```

- [ ] **Step 2: Agregar función `wireKbCardEvents` en ticket-detail.js**

Agregar justo después de `initAiTab`:

```js
function wireKbCardEvents(ticket, kbItems) {
  // "Ver solución completa"
  document.querySelectorAll('.ai-btn-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.kbId);
      const item = kbItems.find(k => k.id === id);
      if (!item) return;
      const card = btn.closest('.ai-kb-card');
      const solucionDiv = card?.querySelector('.ai-kb-solucion');
      if (solucionDiv) solucionDiv.textContent = item.solucion;
      btn.style.display = 'none';
    });
  });

  // "Ejecutar en equipo"
  document.querySelectorAll('.ai-btn-exec').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.kbId);
      const item = kbItems.find(k => k.id === id);
      if (!item) return;

      let commands = [];
      try { commands = JSON.parse(item.comandos || '[]'); } catch {}
      if (commands.length === 0) {
        showToast('Este item KB no tiene comandos definidos.', 'warning');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Cargando…';

      try {
        const onlineAgents = await DataService.getOnlineAgents();
        // Intentar vincular por campo equipo_id o nombre del agente en ticket
        const linkedAgentId = ticket.agent_computer_id || null;
        openExecutionModal(item, commands, onlineAgents, linkedAgentId, ticket);
      } catch (err) {
        showToast('Error al obtener agentes: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '▶ Ejecutar en equipo';
      }
    });
  });
}
```

- [ ] **Step 3: Agregar función `openExecutionModal` en ticket-detail.js**

```js
function openExecutionModal(kbItem, commands, onlineAgents, linkedAgentId, ticket) {
  // Eliminar modal previo si existe
  document.getElementById('exec-modal-overlay')?.remove();

  document.body.insertAdjacentHTML(
    'beforeend',
    createExecutionModal(onlineAgents, commands, linkedAgentId, kbItem.titulo)
  );

  // Cerrar al hacer clic fuera del modal
  document.getElementById('exec-modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'exec-modal-overlay') closeExecutionModal();
  });

  document.getElementById('btn-exec-cancel')?.addEventListener('click', closeExecutionModal);

  document.getElementById('btn-exec-confirm')?.addEventListener('click', async () => {
    const agentIdRaw = document.getElementById('exec-agent-id')?.value;
    const agentId = parseInt(agentIdRaw);
    if (!agentId) {
      showToast('Selecciona un equipo destino.', 'warning');
      return;
    }

    const btnConfirm = document.getElementById('btn-exec-confirm');
    const btnCancel  = document.getElementById('btn-exec-cancel');
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Ejecutando…';
    btnCancel.disabled = true;

    try {
      const { cmd_id } = await DataService.executeRemoteCommand(agentId, commands);
      await pollCommandOutput(agentId, cmd_id, ticket);
    } catch (err) {
      showToast('Error al ejecutar: ' + err.message, 'error');
      btnConfirm.disabled = false;
      btnConfirm.textContent = '✓ Confirmar y ejecutar';
      btnCancel.disabled = false;
    }
  });
}

function closeExecutionModal() {
  document.getElementById('exec-modal-overlay')?.remove();
}
```

- [ ] **Step 4: Agregar función `pollCommandOutput` en ticket-detail.js**

```js
async function pollCommandOutput(agentId, cmdId, ticket) {
  const outputSection = document.getElementById('exec-output-section');
  const outputDiv     = document.getElementById('exec-output');
  const actionButtons = document.getElementById('exec-action-buttons');
  const postActions   = document.getElementById('exec-post-actions');

  if (outputSection) outputSection.style.display = '';

  const POLL_INTERVAL = 2000; // ms
  const MAX_POLLS     = 60;   // 2 min máximo
  let polls = 0;

  const poll = async () => {
    polls++;
    if (polls > MAX_POLLS) {
      if (outputDiv) outputDiv.textContent += '\n[Timeout: sin respuesta del agente en 2 min]';
      return;
    }

    try {
      const cmd = await DataService.getCommandStatus(agentId, cmdId);
      if (!cmd) {
        setTimeout(poll, POLL_INTERVAL);
        return;
      }

      if (outputDiv) outputDiv.textContent = cmd.output || '';

      if (cmd.estado === 'completado' || cmd.estado === 'error') {
        // Terminó
        if (actionButtons) actionButtons.style.display = 'none';
        if (postActions) {
          postActions.style.display = 'flex';
          const exitOk = cmd.exit_code === 0;
          postActions.innerHTML = `
            <button id="btn-post-resolve" class="btn btn-primary" style="font-size:12px;">
              ✓ Marcar ticket como resuelto
            </button>
            <button id="btn-post-note" class="btn btn-secondary" style="font-size:12px;">
              Guardar en notas internas
            </button>`;

          if (!exitOk && outputDiv) {
            outputDiv.style.color = '#f87171';
          }

          wirePostExecutionActions(ticket, cmd, postActions);
        }
      } else {
        // Sigue ejecutando
        setTimeout(poll, POLL_INTERVAL);
      }
    } catch (err) {
      if (outputDiv) outputDiv.textContent += `\n[Error polling: ${err.message}]`;
    }
  };

  setTimeout(poll, POLL_INTERVAL);
}
```

- [ ] **Step 5: Verificar en navegador**

Con un agente online, abrir un ticket, tab AI → clic "▶ Ejecutar". Verificar:
1. Modal aparece con agente o selector
2. Clic "Confirmar" → botones se deshabilitan, aparece sección Output
3. Output se actualiza cada 2s mientras ejecuta
4. Al terminar: aparecen botones "Marcar resuelto" / "Guardar en notas"

- [ ] **Step 6: Commit**

```bash
git add public/js/ticket-detail.js
git commit -m "feat(ai-panel): implement remote command execution modal and output polling"
```

---

## Task 6: Acciones post-ejecución

**Files:**
- Modify: `public/js/ticket-detail.js`

- [ ] **Step 1: Agregar función `wirePostExecutionActions`**

```js
function wirePostExecutionActions(ticket, cmd, container) {
  document.getElementById('btn-post-resolve')?.addEventListener('click', async () => {
    try {
      await DataService.updateTicket(ticket.id, { status: 'resuelto' });
      showToast('Ticket marcado como resuelto.', 'success');
      closeExecutionModal();
      // Actualizar el select de estado si está visible
      const sel = document.getElementById('change-status');
      if (sel) sel.value = 'resuelto';
    } catch (err) {
      showToast('Error al resolver ticket: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-post-note')?.addEventListener('click', async () => {
    const nota = `Solución ejecutada remotamente (cmd #${cmd.id}):\n${cmd.output || '(sin output)'}`;
    try {
      await DataService.addInternalNote(
        ticket.id,
        state.currentAgent.id,
        state.currentAgent.name,
        nota
      );
      showToast('Ejecución guardada en notas internas.', 'success');
      closeExecutionModal();
    } catch (err) {
      showToast('Error al guardar nota: ' + err.message, 'error');
    }
  });
}
```

- [ ] **Step 2: Verificar flujo completo**

1. Ticket abierto → tab AI → analizar → tarjeta KB con comandos
2. Ejecutar → modal → confirmar → output aparece
3. Completado → clic "Marcar como resuelto" → toast éxito + select cambia a "resuelto"
4. O clic "Guardar en notas" → toast éxito + nota aparece en "Notas Internas" al recargar

- [ ] **Step 3: Commit final**

```bash
git add public/js/ticket-detail.js
git commit -m "feat(ai-panel): add post-execution actions (resolve ticket, save to notes)"
```

---

## Notas de implementación

- `state.currentAgent` viene del import de `./app.js` — ya disponible en `ticket-detail.js`
- `DataService.updateTicket` y `DataService.addInternalNote` ya existen (líneas 260 y 361 de data-service.js)
- Si KB está vacío en la DB, poblar con `POST /api/ai/kb` antes de probar — ver `src/ai/ai-routes.js`
- Agente online requerido para probar ejecución; usar el ejecutable `agent/agente-it.exe` en un equipo
