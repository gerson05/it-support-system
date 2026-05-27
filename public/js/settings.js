import { showToast } from './components.js';
import { state } from './app.js';
import { isOfflineMode } from './data-service.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">⚙️ Configuración</h2>
        <p class="page-subtitle">Administra el equipo de IT y la conexión del sistema</p>
      </div>
    </div>

    <div style="display:grid;gap:24px;max-width:700px;">

      <!-- Sección Agentes -->
      <div class="glass-card">
        <h3 style="margin:0 0 16px;font-size:16px;color:var(--text-primary);">👥 Equipo de IT</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 20px;">
          Actualiza los nombres de los 4 miembros del equipo. Estos nombres aparecen en el selector de agente y en los tickets.
        </p>
        <div id="agents-form" style="display:flex;flex-direction:column;gap:12px;">
          <div style="text-align:center;color:var(--text-muted);font-size:13px;">Cargando agentes...</div>
        </div>
        ${isOfflineMode ? '<p style="margin-top:12px;font-size:11px;color:#f59e0b;">⚠️ Modo demo: los cambios no se guardan permanentemente.</p>' : ''}
      </div>

      <!-- Sección Acceso en Red -->
      <div class="glass-card">
        <h3 style="margin:0 0 16px;font-size:16px;color:var(--text-primary);">🌐 Acceso desde otras PCs</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px;">
          Para que las 4 personas de IT accedan al panel desde sus computadoras, deben abrir esta dirección en su navegador:
        </p>
        <div style="background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);border-radius:8px;padding:16px;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">URL del servidor (reemplaza con la IP de esta PC):</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <code id="network-url" style="flex:1;font-size:14px;color:#667eea;background:rgba(102,126,234,0.1);padding:8px 12px;border-radius:6px;word-break:break-all;">http://&lt;IP-DE-ESTA-PC&gt;:3000</code>
            <button id="btn-copy-url" style="padding:8px 12px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;">📋 Copiar</button>
          </div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">
            <strong style="color:var(--text-secondary);">¿Cómo encontrar la IP de esta PC?</strong><br>
            Abre CMD o PowerShell y ejecuta: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">ipconfig</code><br>
            Busca "Dirección IPv4" en tu red local (suele ser 192.168.X.X o 10.0.X.X).
          </div>
        </div>
      </div>

      <!-- Sección WhatsApp -->
      <div class="glass-card">
        <h3 style="margin:0 0 16px;font-size:16px;color:var(--text-primary);">📱 Conexión WhatsApp</h3>
        <div id="wa-settings-status" style="font-size:13px;color:var(--text-muted);">Consultando estado...</div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
          <button id="btn-wa-reconnect" style="padding:10px 18px;background:var(--success);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🔄 Reconectar</button>
          <button id="btn-wa-reset" style="padding:10px 18px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">🆕 Nuevo QR (si no llegan mensajes)</button>
          <button id="btn-wa-logout" style="padding:10px 18px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;cursor:pointer;font-size:13px;">🚪 Cerrar sesión</button>
        </div>
        <p style="margin-top:12px;font-size:11px;color:var(--text-muted);">
          Si la conexión dice "Conectado" pero los mensajes no llegan, usa <strong>🆕 Nuevo QR</strong> para reiniciar la sesión.
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
        <div style="width:32px;height:32px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0;">
          ${a.name.charAt(0).toUpperCase()}
        </div>
        <input
          type="text"
          data-agent-id="${a.id}"
          value="${a.name}"
          style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);border-radius:8px;color:var(--text-primary);font-size:14px;"
          placeholder="Nombre del agente ${a.id}"
        />
        <button data-save-id="${a.id}" style="padding:10px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Guardar</button>
      </div>
    `).join('');

  } catch {
    form.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">⚠️ Solo disponible con el servidor activo (npm start).</p>`;
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
        btnCopy.addEventListener('click', () => {
          navigator.clipboard.writeText(url).catch(() => {});
          showToast(`URL copiada: ${url}`, 'success');
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
