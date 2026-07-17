/**
 * ticket-ai-panel.js
 *
 * AI Assistant tab logic for the ticket detail view.
 * Handles:
 *  - KB article rendering and analysis (initAiTab)
 *  - KB card event wiring (wireKbCardEvents)
 *  - Remote execution modal (openExecutionModal / closeExecutionModal)
 *  - Command output polling (pollCommandOutput)
 *  - Post-execution actions: resolve ticket + add internal note (wirePostExecutionActions)
 */

import { showToast, createAiKbCard, createExecutionModal } from '../../ui/components.js';
import { iconSparkle, iconRefresh, iconCheck, iconZap } from '../../utils/icons.js';
import { state } from '../../core/app.js';
import DataService from '../../core/api.js';

/* ── Public API ─────────────────────────────────────────── */

export async function initAiTab(ticket) {
  const container = document.getElementById('ai-tab-content');
  if (!container) return;

  const problema = ticket.description || '';

  container.innerHTML = `
    <style>
      @keyframes ai-spin   { to { transform: rotate(360deg); } }
      @keyframes ai-pulse  { 0%,100%{opacity:.25} 50%{opacity:1} }
    </style>
    <div style="text-align:center;padding:44px 20px;">
      <div style="display:flex;justify-content:center;margin-bottom:18px;">
        <div style="
          width:44px;height:44px;border-radius:50%;
          border:3px solid var(--border-2,rgba(255,255,255,.16));
          border-top-color:var(--primary,#6366f1);
          animation:ai-spin .75s linear infinite;">
        </div>
      </div>
      <div style="font-size:13px;font-weight:500;color:var(--text-2,#94a3b8);margin-bottom:12px;">
        Analizando problema del ticket…
      </div>
      <div style="display:flex;justify-content:center;gap:5px;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary,#6366f1);animation:ai-pulse 1.2s ease-in-out infinite;animation-delay:0s;"></span>
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary,#6366f1);animation:ai-pulse 1.2s ease-in-out infinite;animation-delay:.2s;"></span>
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary,#6366f1);animation:ai-pulse 1.2s ease-in-out infinite;animation-delay:.4s;"></span>
      </div>
    </div>`;

  try {
    const { kb, ai } = await DataService.analyzeTicket(problema, ticket.id);

    let html = '';

    if (ai) {
      html += `
        <div style="background:rgba(22,101,52,.2);border:1px solid #166534;border-radius:8px;padding:12px;margin-bottom:14px;">
          <div style="color:#4ade80;font-weight:600;font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:5px;">${iconSparkle(13)} Análisis IA</div>
          <div id="ai-analysis-text" style="color:#bbf7d0;font-size:12px;line-height:1.6;white-space:pre-wrap;"></div>
        </div>`;
    }

    if (kb.length === 0) {
      html += `<div style="color:var(--text-muted,#94a3b8);font-size:13px;text-align:center;padding:20px 0;">
        Sin coincidencias en la base de conocimiento.</div>`;
    } else {
      kb.forEach((item, i) => { html += createAiKbCard(item, i === 0); });
    }

    html += `
      <div style="margin-top:14px;display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;">
        <textarea id="ai-reanalyze-input" style="flex:1;min-width:160px;font-size:12px;min-height:38px;resize:vertical;"
          placeholder="Ajusta la descripción del problema...">${problema}</textarea>
        <button id="btn-ai-reanalyze" class="btn btn-secondary" style="font-size:12px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;">${iconRefresh(13)} Re-analizar</button>
      </div>`;

    container.innerHTML = html;

    if (ai) {
      const aiTextEl = container.querySelector('#ai-analysis-text');
      if (aiTextEl) aiTextEl.textContent = ai;
    }

    document.getElementById('btn-ai-reanalyze')?.addEventListener('click', async () => {
      const nuevoProblema = document.getElementById('ai-reanalyze-input')?.value?.trim();
      if (!nuevoProblema) return;
      await initAiTab({ ...ticket, description: nuevoProblema });
    });

    wireKbCardEvents(ticket, kb);

  } catch (err) {
    const safeMsg = (err.message || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    container.innerHTML = `
      <div style="color:var(--color-error,#f87171);font-size:13px;text-align:center;padding:20px;">
        Error al analizar el ticket: ${safeMsg}
      </div>`;
  }
}

/* ── Private helpers ────────────────────────────────────── */

function wireKbCardEvents(ticket, kbItems) {
  // "Ver solución completa"
  document.querySelectorAll('.ai-btn-ver').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = parseInt(btn.dataset.kbId);
      const item = kbItems.find(k => k.id === id);
      if (!item) return;
      const card       = btn.closest('.ai-kb-card');
      const solucionDiv = card?.querySelector('.ai-kb-solucion');
      if (solucionDiv) solucionDiv.textContent = item.solucion;
      btn.style.display = 'none';
    });
  });

  // "Ejecutar en equipo"
  document.querySelectorAll('.ai-btn-exec').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = parseInt(btn.dataset.kbId);
      const item = kbItems.find(k => k.id === id);
      if (!item) return;

      let commands = [];
      try { commands = JSON.parse(item.comandos || '[]'); } catch {}
      if (commands.length === 0) {
        showToast('Este item KB no tiene comandos definidos.', 'warning');
        return;
      }

      btn.disabled    = true;
      btn.textContent = 'Cargando…';

      try {
        const onlineAgents  = await DataService.getOnlineAgents();
        const linkedAgentId = ticket.agent_computer_id || null;
        openExecutionModal(item, commands, onlineAgents, linkedAgentId, ticket);
      } catch (err) {
        showToast('Error al obtener agentes: ' + err.message, 'error');
      } finally {
        btn.disabled    = false;
        btn.innerHTML = `${iconZap(13)} Ejecutar en equipo`;
      }
    });
  });
}

function openExecutionModal(kbItem, commands, onlineAgents, linkedAgentId, ticket) {
  document.getElementById('exec-modal-overlay')?.remove();

  document.body.insertAdjacentHTML(
    'beforeend',
    createExecutionModal(onlineAgents, commands, linkedAgentId, kbItem.titulo)
  );

  document.getElementById('exec-modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'exec-modal-overlay') closeExecutionModal();
  });

  document.getElementById('btn-exec-cancel')?.addEventListener('click', closeExecutionModal);

  document.getElementById('btn-exec-confirm')?.addEventListener('click', async () => {
    const agentId = parseInt(document.getElementById('exec-agent-id')?.value, 10);
    if (!agentId) {
      showToast('Selecciona un equipo destino.', 'warning');
      return;
    }

    const btnConfirm        = document.getElementById('btn-exec-confirm');
    const btnCancel         = document.getElementById('btn-exec-cancel');
    btnConfirm.disabled     = true;
    btnConfirm.textContent  = 'Ejecutando…';
    btnCancel.disabled      = true;

    try {
      const { cmd_id } = await DataService.executeRemoteCommand(agentId, commands);
      await pollCommandOutput(agentId, cmd_id, ticket);
    } catch (err) {
      showToast('Error al ejecutar: ' + err.message, 'error');
      btnConfirm.disabled    = false;
      btnConfirm.innerHTML = `${iconCheck(13)} Confirmar y ejecutar`;
      btnCancel.disabled     = false;
    }
  });
}

function closeExecutionModal() {
  document.getElementById('exec-modal-overlay')?.remove();
}

async function pollCommandOutput(agentId, cmdId, ticket) {
  const outputSection = document.getElementById('exec-output-section');
  const outputDiv     = document.getElementById('exec-output');
  const actionButtons = document.getElementById('exec-action-buttons');
  const postActions   = document.getElementById('exec-post-actions');

  if (outputSection) outputSection.style.display = 'block';

  const POLL_INTERVAL = 2000;
  const MAX_POLLS     = 60;
  let   polls         = 0;

  const poll = async () => {
    polls++;
    if (polls > MAX_POLLS) {
      if (outputDiv) outputDiv.textContent += '\n[Timeout: sin respuesta del agente en 2 min]';
      return;
    }

    try {
      const cmd = await DataService.getCommandStatus(agentId, cmdId);
      if (!cmd) { setTimeout(poll, POLL_INTERVAL); return; }

      if (outputDiv) outputDiv.textContent = cmd.output || '';

      if (cmd.estado === 'completado' || cmd.estado === 'error') {
        if (actionButtons) actionButtons.style.display = 'none';

        const isAutoResolveChecked = document.getElementById('exec-auto-resolve')?.checked;

        if (cmd.estado === 'completado' && isAutoResolveChecked) {
          try {
            await DataService.updateTicket(ticket.id, { status: 'resuelto' });
            const noteContent = `Solución ejecutada remotamente con éxito (cmd #${cmd.id}):\n${cmd.output || '(sin output)'}`;
            await DataService.addInternalNote(
              ticket.id,
              state.currentUser?.id,
              state.currentUser?.username || 'IT',
              noteContent
            );
            showToast('¡Solución ejecutada con éxito! El ticket se ha marcado como resuelto.', 'success');
            closeExecutionModal();
            window.dispatchEvent(new Event('hashchange'));
            return;
          } catch (err) {
            showToast('Error en piloto automático: ' + err.message, 'error');
          }
        }

        if (postActions) {
          postActions.style.display = 'flex';
          postActions.innerHTML = `
            <button id="btn-post-resolve" class="btn btn-primary" style="font-size:12px;display:inline-flex;align-items:center;gap:5px;">
              ${iconCheck(13)} Marcar ticket como resuelto
            </button>
            <button id="btn-post-note" class="btn btn-secondary" style="font-size:12px;">
              Guardar en notas internas
            </button>`;

          if (cmd.exit_code != null && cmd.exit_code !== 0 && outputDiv) {
            outputDiv.style.color = '#f87171';
          }

          wirePostExecutionActions(ticket, cmd, postActions);
        }
      } else {
        setTimeout(poll, POLL_INTERVAL);
      }
    } catch (err) {
      if (outputDiv) outputDiv.textContent += `\n[Error polling: ${err.message}]`;
    }
  };

  setTimeout(poll, POLL_INTERVAL);
}

function wirePostExecutionActions(ticket, cmd, container) {
  document.getElementById('btn-post-resolve')?.addEventListener('click', async () => {
    try {
      await DataService.updateTicket(ticket.id, { status: 'resuelto' });
      showToast('Ticket marcado como resuelto.', 'success');
      closeExecutionModal();
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
        state.currentUser?.id,
        state.currentUser?.username || 'IT',
        nota
      );
      showToast('Ejecución guardada en notas internas.', 'success');
      closeExecutionModal();
    } catch (err) {
      showToast('Error al guardar nota: ' + err.message, 'error');
    }
  });
}
