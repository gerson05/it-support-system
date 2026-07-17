import { showToast, copyToClipboard } from '../../ui/components.js';
import { isOfflineMode } from '../../core/api.js';

export async function renderSettings(container) {
  container.innerHTML = `
    <div style="margin-bottom:28px;">
      <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Configuración</h2>
      <p style="color:var(--text-3);font-size:13px;">Administra el equipo de IT y la conexión del sistema</p>
    </div>

    <div style="display:grid;gap:16px;max-width:680px;">

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

      <!-- Mensajes automáticos WP -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:4px;">Mensajes automáticos de WhatsApp</div>
            <div style="font-size:12px;color:var(--text-2);line-height:1.5;">Textos que el bot envía automáticamente. <span id="wp-msg-status" style="color:var(--primary);"></span></div>
          </div>
          <button id="btn-open-wp-messages" class="btn btn-secondary btn-small" style="white-space:nowrap;">Editar mensajes →</button>
        </div>
      </div>

      <!-- ERP Import -->
      <div class="card">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:14px;">Importar datos ERP (Medivalle)</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="font-size:12px;color:var(--text-3);">Exporta desde el ERP a Excel y sube el archivo para actualizar la BD local.</div>

          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px;">Empleados</div>
              <div style="font-size:11px;color:var(--text-3);">Columnas: CEDULA, NOMBRE_COMPLETO, CARGO, AREA</div>
            </div>
            <input type="file" id="erp-import-empleados-file" accept=".xlsx,.xls" style="display:none;">
            <button id="btn-erp-import-empleados" class="btn btn-secondary btn-small">📥 Subir Excel</button>
          </div>
          <div id="erp-import-empleados-status" style="font-size:12px;color:var(--text-3);display:none;"></div>

          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px;">Puntos / Sedes</div>
              <div style="font-size:11px;color:var(--text-3);">Columnas: NOMBRE, CIUDAD</div>
            </div>
            <input type="file" id="erp-import-puntos-file" accept=".xlsx,.xls" style="display:none;">
            <button id="btn-erp-import-puntos" class="btn btn-secondary btn-small">📥 Subir Excel</button>
          </div>
          <div id="erp-import-puntos-status" style="font-size:12px;color:var(--text-3);display:none;"></div>
        </div>
      </div>

      <!-- Herramientas externas -->
      <div class="card">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:14px;">Herramientas Externas</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px;">MediCalc</div>
            <div style="font-size:12px;color:var(--text-3);line-height:1.5;">Calculadora de dispensación segura — Medivalle SF S.A.S</div>
          </div>
          <a href="/medicalc.html" target="_blank" class="btn btn-secondary btn-small" style="white-space:nowrap;text-decoration:none;">Abrir →</a>
        </div>
      </div>

    </div>
  `;

  loadNetworkUrl();
  loadWaStatus();
  loadWpMessages();
  bindEvents();
  wireErpImport('empleados');
  wireErpImport('puntos');

  function wireErpImport(type) {
    const btn    = document.getElementById(`btn-erp-import-${type}`);
    const input  = document.getElementById(`erp-import-${type}-file`);
    const status = document.getElementById(`erp-import-${type}-status`);
    if (!btn || !input) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      btn.disabled = true; btn.textContent = 'Importando…';
      status.style.display = 'block'; status.textContent = 'Procesando archivo…'; status.style.color = 'var(--text-3)';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/erp/import/${type}`, { method: 'POST', body: fd });
        const d = await res.json();
        if (!res.ok) { status.textContent = '✗ ' + d.error; status.style.color = 'var(--danger)'; }
        else { status.textContent = `✓ ${d.imported} importados, ${d.skipped} omitidos`; status.style.color = '#10b981'; }
      } catch { status.textContent = '✗ Error al importar'; status.style.color = 'var(--danger)'; }
      finally { btn.disabled = false; btn.textContent = '📥 Subir Excel'; input.value = ''; }
    });
  }

  async function loadErpSyncStatus() {
    try {
      const s = await fetch('/api/erp/sync/status').then(r => r.json());
      const el = document.getElementById('erp-sync-status');
      if (!el) return;
      if (!s.configured) {
        el.innerHTML = '<span style="color:var(--text-3);">ERP_USER / ERP_PASS no configurados en .env</span>';
        return;
      }
      if (s.running) {
        el.innerHTML = '<span style="color:#f59e0b;">⟳ Sincronizando…</span>';
        setTimeout(loadErpSyncStatus, 3000);
        return;
      }
      const r = s.lastResult;
      if (!s.lastRun) {
        el.innerHTML = '<span style="color:var(--text-3);">Sin sincronización previa — haz clic en "Sincronizar ahora"</span>';
      } else {
        const ok = !r?.errors?.length;
        el.innerHTML = `
          <span style="color:${ok ? '#10b981' : '#f59e0b'};">${ok ? '✓' : '⚠'} Última sync: ${new Date(s.lastRun).toLocaleString('es-CO')}</span><br>
          <span style="font-size:11px;color:var(--text-3);">Empleados: ${r?.empleados ?? 0} · Puntos: ${r?.puntos ?? 0}${r?.errors?.length ? ' · ' + r.errors.length + ' errores' : ''}</span>
          ${!s.empleados_servlet ? '<br><span style="font-size:11px;color:#f59e0b;">⚠ ERP_EMPLEADOS_OBJ no configurado — configura el servlet de empleados en .env</span>' : ''}
        `;
      }
    } catch {
      const el = document.getElementById('erp-sync-status');
      if (el) el.innerHTML = '<span style="color:var(--danger);">Error cargando estado</span>';
    }
  }

  document.getElementById('btn-erp-sync')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-erp-sync');
    btn.disabled = true; btn.textContent = 'Iniciando…';
    try {
      const res = await fetch('/api/erp/sync', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { showToast(d.error, 'error'); return; }
      showToast('Sync ERP iniciado.', 'success');
      setTimeout(loadErpSyncStatus, 2000);
    } catch {
      showToast('Error al iniciar sync.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = '⟳ Sincronizar ahora';
    }
  });
}

async function loadWpMessages() {
  const status = document.getElementById('wp-msg-status');
  try {
    const res  = await fetch('/api/admin/wp-messages');
    if (!res.ok) throw new Error();
    const msgs = await res.json();
    const customCount = Object.values(msgs).filter(m => m.isCustom).length;
    if (status) status.textContent = customCount ? `${customCount} personalizado${customCount !== 1 ? 's' : ''}` : '';
  } catch { /* silent */ }
}

function openWpMessagesModal() {
  const existing = document.getElementById('wp-messages-modal');
  if (existing) { existing.remove(); }

  const overlay = document.createElement('div');
  overlay.id = 'wp-messages-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow-y:auto;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);width:min(680px,100%);box-shadow:0 24px 64px rgba(0,0,0,.5);display:flex;flex-direction:column;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">Mensajes automáticos de WhatsApp</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;">Usa <code style="background:var(--surface-3);padding:1px 5px;border-radius:3px;">{variable}</code> para insertar valores dinámicos</div>
        </div>
        <button id="btn-close-wp-modal" style="width:32px;height:32px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text-2);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
      </div>
      <!-- Body -->
      <div id="wp-messages-list" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:calc(90vh - 100px);">
        <div style="text-align:center;padding:30px;font-size:13px;color:var(--text-3);">Cargando mensajes…</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#btn-close-wp-modal').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  populateWpMessagesList();
}

async function populateWpMessagesList() {
  const list = document.getElementById('wp-messages-list');
  if (!list) return;
  try {
    const res  = await fetch('/api/admin/wp-messages');
    if (!res.ok) throw new Error();
    const msgs = await res.json();

    const customCount = Object.values(msgs).filter(m => m.isCustom).length;
    const status = document.getElementById('wp-msg-status');
    if (status) status.textContent = customCount ? `${customCount} personalizado${customCount !== 1 ? 's' : ''}` : '';

    list.innerHTML = Object.values(msgs).map(m => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface-2);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
          <div style="font-size:12px;font-weight:600;color:var(--text);">${m.label}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${m.vars.length ? `<span style="font-size:10px;color:var(--text-3);">Variables: ${m.vars.map(v => `<code style="background:var(--surface-3);padding:1px 4px;border-radius:3px;">${v}</code>`).join(' ')}</span>` : ''}
            ${m.isCustom ? `<span style="font-size:10px;font-weight:600;color:var(--primary);padding:2px 7px;border:1px solid var(--primary);border-radius:99px;">Personalizado</span>` : ''}
          </div>
        </div>
        <textarea data-key="${m.key}" rows="4"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;resize:vertical;box-sizing:border-box;font-family:monospace;line-height:1.5;"
        >${m.value.replace(/</g,'&lt;')}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end;">
          ${m.isCustom ? `<button class="btn-wp-reset" data-key="${m.key}" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-3);cursor:pointer;">Restaurar por defecto</button>` : ''}
          <button class="btn-wp-save" data-key="${m.key}" style="font-size:11px;padding:4px 12px;border:none;border-radius:6px;background:var(--primary);color:#fff;cursor:pointer;font-weight:600;">Guardar</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.btn-wp-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key      = btn.dataset.key;
        const textarea = list.querySelector(`textarea[data-key="${key}"]`);
        const value    = textarea?.value?.trim();
        if (!value) { showToast('El mensaje no puede estar vacío.', 'warning'); return; }
        btn.disabled = true; btn.textContent = 'Guardando…';
        try {
          const r = await fetch(`/api/admin/wp-messages/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          });
          if (!r.ok) throw new Error();
          showToast('Mensaje guardado ✓', 'success');
          populateWpMessagesList();
        } catch {
          showToast('Error al guardar.', 'error');
          btn.disabled = false; btn.textContent = 'Guardar';
        }
      });
    });

    list.querySelectorAll('.btn-wp-reset').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Restaurar el mensaje al texto original?')) return;
        btn.disabled = true;
        try {
          await fetch(`/api/admin/wp-messages/${btn.dataset.key}`, { method: 'DELETE' });
          showToast('Mensaje restaurado al original.', 'success');
          populateWpMessagesList();
        } catch {
          showToast('Error al restaurar.', 'error');
          btn.disabled = false;
        }
      });
    });

  } catch {
    if (list) list.innerHTML = `<div style="font-size:12px;color:var(--text-3);padding:20px;text-align:center;">No disponible (servidor apagado).</div>`;
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
  // Copiar URL de red — el handler real se añade en loadNetworkUrl() cuando hay IP del servidor

  // Abrir modal de mensajes WP
  document.getElementById('btn-open-wp-messages')?.addEventListener('click', openWpMessagesModal);

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
