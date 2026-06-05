import { showToast, copyToClipboard } from './components.js';
import { iconAlert } from './icons.js';
import { state } from './app.js';
import { isOfflineMode } from './data-service.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div style="margin-bottom:28px;">
      <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Configuración</h2>
      <p style="color:var(--text-3);font-size:13px;">Administra el equipo de IT y la conexión del sistema</p>
    </div>

    <div style="display:grid;gap:16px;max-width:680px;">

      <!-- Equipo de IT -->
      <div class="card">
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:4px;">Equipo de IT</div>
          <p style="font-size:13px;color:var(--text-2);line-height:1.5;">Actualiza los nombres de los 4 miembros. Aparecen en el selector de agente y en los tickets.</p>
        </div>
        <div id="agents-form" style="display:flex;flex-direction:column;gap:10px;">
          <div style="text-align:center;color:var(--text-3);font-size:13px;padding:16px;">Cargando agentes...</div>
        </div>
        ${isOfflineMode ? '<p style="margin-top:10px;font-size:11px;color:#f59e0b;padding:8px 12px;background:rgba(245,158,11,.08);border-radius:6px;">Modo demo: los cambios no se guardan permanentemente.</p>' : ''}
      </div>

      <!-- Acceso en red -->
      <div class="card">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:14px;">Acceso desde otras PCs</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.5;">
          Para que el equipo de IT acceda al panel desde sus computadoras, deben abrir esta dirección en su navegador:
        </p>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:8px;font-weight:500;text-transform:uppercase;letter-spacing:.4px;">URL del servidor</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <code id="network-url" style="flex:1;font-size:13px;color:var(--primary);background:var(--primary-light);padding:8px 12px;border-radius:var(--radius-sm);word-break:break-all;border:1px solid rgba(99,102,241,.2);">http://&lt;IP&gt;:3000</code>
            <button id="btn-copy-url" class="btn btn-primary btn-small" style="white-space:nowrap;">Copiar</button>
          </div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-3);line-height:1.6;">
            <strong style="color:var(--text-2);">¿Cómo encontrar la IP?</strong><br>
            Abre CMD y ejecuta <code style="background:var(--surface-3);padding:2px 6px;border-radius:3px;font-size:11px;">ipconfig</code> · busca "Dirección IPv4" (suele ser 192.168.X.X o 10.0.X.X).
          </div>
        </div>
      </div>

      <!-- WhatsApp -->
      <div class="card">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:14px;">Conexión WhatsApp</div>
        <div id="wa-settings-status" style="font-size:13px;color:var(--text-2);padding:10px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:14px;">
          Consultando estado...
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="btn-wa-reconnect" class="btn btn-success">Reconectar</button>
          <button id="btn-wa-reset" class="btn btn-primary">Nuevo QR</button>
          <button id="btn-wa-logout" class="btn btn-danger">Cerrar sesión</button>
        </div>
        <p style="margin-top:12px;font-size:12px;color:var(--text-3);">
          Si la conexión dice "Conectado" pero los mensajes no llegan, usa <strong style="color:var(--text-2);">Nuevo QR</strong> para reiniciar la sesión.
        </p>
      </div>

    </div>
  `;

  await loadAgentsForm();
  loadNetworkUrl();
  loadWaStatus();
  bindEvents();
}

async function loadAgentsForm() {
  const form = document.getElementById('agents-form');
  if (!form) return;

  try {
    const res = await fetch('/api/agents');
    if (!res.ok) throw new Error('Sin servidor');
    const agents = await res.json();
    state.agents = agents;

    form.innerHTML = agents.map(a => `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,var(--primary),var(--purple));border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;">
          ${a.name.charAt(0).toUpperCase()}
        </div>
        <input type="text" data-agent-id="${a.id}" value="${a.name}" placeholder="Nombre del agente ${a.id}"/>
        <button data-save-id="${a.id}" class="btn btn-primary btn-small">Guardar</button>
      </div>
    `).join('');

  } catch {
    form.innerHTML = `<p style="color:var(--text-muted);font-size:13px;display:flex;align-items:center;gap:6px;">${iconAlert(14)} Solo disponible con el servidor activo (npm start).</p>`;
  }
}

async function loadNetworkUrl() {
  const urlEl = document.getElementById('network-url');
  const btnCopy = document.getElementById('btn-copy-url');
  if (!urlEl) return;
  try {
    const res = await fetch('/api/network-info');
    if (res.ok) {
      const data = await res.json();
      const url = `http://${data.ip}:${data.port}`;
      urlEl.textContent = url;
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          const ok = await copyToClipboard(url);
          if (ok) {
            showToast(`URL copiada: ${url}`, 'success');
          } else {
            showToast('No se pudo copiar la URL', 'error');
          }
        });
      }
      return;
    }
  } catch { /* fallback */ }
  const port = window.location.port || '3000';
  urlEl.textContent = `http://<IP-DE-ESTA-PC>:${port}`;
}

async function loadWaStatus() {
  const el = document.getElementById('wa-settings-status');
  if (!el) return;
  try {
    const res = await fetch('/api/whatsapp/status');
    if (!res.ok) throw new Error();
    const data = await res.json();
    const labels = {
      connected: '✅ <strong style="color:#22c55e;">Conectado</strong> — WhatsApp está activo y recibiendo mensajes.',
      awaiting_qr: '📱 <strong style="color:#f59e0b;">Esperando QR</strong> — Escanea el código en el panel lateral.',
      disconnected: '❌ <strong style="color:#ef4444;">Desconectado</strong> — Haz clic en "Reconectar" para iniciar.',
      reconnecting: '🔄 <strong style="color:#667eea;">Reconectando...</strong> — El sistema intenta restablecer la conexión.',
    };
    el.innerHTML = labels[data.status] || data.status;
  } catch {
    el.textContent = 'Estado no disponible (servidor apagado).';
  }
}

function bindEvents() {
  // Guardar nombre de agente
  document.getElementById('agents-form')?.addEventListener('click', async (e) => {
    const saveId = e.target.dataset.saveId;
    if (!saveId) return;

    const input = document.querySelector(`input[data-agent-id="${saveId}"]`);
    const newName = input?.value?.trim();
    if (!newName) { showToast('El nombre no puede estar vacío.', 'error'); return; }

    try {
      const res = await fetch(`/api/agents/${saveId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) throw new Error();

      const agent = state.agents.find(a => a.id === parseInt(saveId));
      if (agent) agent.name = newName;

      // Actualizar avatar si es el agente activo
      if (state.currentAgent?.id === parseInt(saveId)) {
        state.currentAgent.name = newName;
        const avatar = document.getElementById('current-agent-avatar');
        if (avatar) avatar.textContent = newName.charAt(0).toUpperCase();
      }

      // Refrescar selector de agentes en sidebar
      const agentSelect = document.getElementById('agent-select');
      if (agentSelect) {
        agentSelect.innerHTML = state.agents.map(a =>
          `<option value="${a.id}"${a.id === state.currentAgent?.id ? ' selected' : ''}>${a.name}</option>`
        ).join('');
      }

      // Actualizar avatar del botón
      const btn = document.querySelector(`button[data-save-id="${saveId}"]`);
      const avatarDiv = btn?.previousElementSibling?.previousElementSibling;
      if (avatarDiv) avatarDiv.textContent = newName.charAt(0).toUpperCase();

      showToast(`Nombre actualizado: ${newName}`, 'success');
    } catch {
      showToast('Error al guardar. Verifica que el servidor esté activo.', 'error');
    }
  });

  // Copiar URL de red — el handler real se añade en loadNetworkUrl() cuando hay IP del servidor

  // Reconectar WhatsApp
  document.getElementById('btn-wa-reconnect')?.addEventListener('click', async () => {
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST' });
      showToast('Iniciando conexión. Revisa el QR en el panel lateral.', 'info');
      setTimeout(loadWaStatus, 2000);
    } catch {
      showToast('Error al reconectar.', 'error');
    }
  });

  // Reset completo — borra auth y genera QR nuevo
  document.getElementById('btn-wa-reset')?.addEventListener('click', async () => {
    if (!confirm('Esto cerrará la sesión actual y generará un QR nuevo para escanear. ¿Continuar?')) return;
    const btn = document.getElementById('btn-wa-reset');
    btn.textContent = 'Reiniciando...';
    btn.disabled = true;
    try {
      await fetch('/api/whatsapp/reset', { method: 'POST' });
      showToast('Sesión reiniciada. Escanea el nuevo QR en el panel lateral izquierdo.', 'success');
      setTimeout(loadWaStatus, 3000);
    } catch {
      showToast('Error al reiniciar.', 'error');
    }
    btn.textContent = '🆕 Nuevo QR (si no llegan mensajes)';
    btn.disabled = false;
  });

  // Cerrar sesión WhatsApp
  document.getElementById('btn-wa-logout')?.addEventListener('click', async () => {
    if (!confirm('¿Seguro que deseas cerrar la sesión de WhatsApp? Tendrás que escanear el QR nuevamente.')) return;
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      showToast('Sesión cerrada. El QR aparecerá en unos segundos.', 'info');
      setTimeout(loadWaStatus, 3000);
    } catch {
      showToast('Error al cerrar sesión.', 'error');
    }
  });
}
