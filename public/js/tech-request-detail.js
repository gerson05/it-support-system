/**
 * Vista de detalle de un Requerimiento / Incidencia.
 */

import { showToast } from './components.js';
import { state, formatDate, formatTimeAgo } from './app.js';

const STATUS_CFG = {
  pendiente:   { label: 'Pendiente',   cls: 'badge-pendiente'   },
  en_revision: { label: 'En Revisión', cls: 'badge-en_espera'   },
  en_proceso:  { label: 'En Proceso',  cls: 'badge-en_progreso' },
  completado:  { label: 'Completado',  cls: 'badge-resuelto'    },
  rechazado:   { label: 'Rechazado',   cls: 'badge-critica'     },
};

const PRIORITY_CFG = {
  baja:   { label: 'Baja',    cls: 'badge-baja'    },
  media:  { label: 'Media',   cls: 'badge-media'   },
  alta:   { label: 'Alta',    cls: 'badge-alta'    },
  critica:{ label: 'Crítica', cls: 'badge-critica' },
};

function sb(s) {
  const c = STATUS_CFG[s] || { label: s, cls: '' };
  return `<span class="badge ${c.cls}">${c.label}</span>`;
}
function pb(p) {
  const c = PRIORITY_CFG[p] || { label: p, cls: '' };
  return `<span class="badge ${c.cls}">${c.label}</span>`;
}

export async function renderTechRequestDetail(container, id) {
  container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">⏳ Cargando solicitud…</div>`;

  let req;
  try {
    const res = await fetch(`/api/tech-requests/${id}`);
    if (!res.ok) throw new Error('No encontrado');
    req = await res.json();
  } catch {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:#ef4444;">❌ No se pudo cargar la solicitud.</div>`;
    return;
  }

  const isInc  = req.type === 'incidencia';
  const typeLabel = isInc ? '🔧 Incidencia' : '📋 Requerimiento';

  /* ── Cargar agentes ── */
  let agents = [];
  try {
    const ar = await fetch('/api/agents');
    if (ar.ok) agents = await ar.json();
  } catch {}

  const agentOptions = agents.map(a =>
    `<option value="${a.id}" ${req.assigned_to === a.id ? 'selected' : ''}>${a.name}</option>`
  ).join('');

  container.innerHTML = `
    <!-- Encabezado -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
      <button onclick="history.back()" class="btn btn-secondary" style="padding:8px 14px;">← Volver</button>
      <div>
        <h2 style="font-size:22px;font-weight:700;">${typeLabel} — ${req.request_number}</h2>
        <p style="color:var(--text-muted);font-size:13px;">Creado ${formatTimeAgo(req.created_at)} · ${formatDate(req.created_at)}</p>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
        ${sb(req.status)} ${pb(req.priority)}
        ${!isInc ? `<button class="btn btn-primary" id="btn-generar-acta" style="padding:8px 16px;">📄 Generar Acta</button>` : ''}
      </div>
    </div>

    <!-- Modal Acta de Entrega (TODOS los equipos) -->
    <div id="acta-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:2000;align-items:center;justify-content:center;">
      <div style="background:#1e1e38;border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px;width:min(780px,96vw);max-height:85vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.8);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:18px;font-weight:700;">📄 Acta de Entrega - ${req.requester_name}</h3>
          <button id="acta-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">✕</button>
        </div>

        <p style="color:#94a3b8;font-size:12px;margin-bottom:16px;padding:10px;background:rgba(102,126,234,.1);border-radius:6px;border-left:3px solid #667eea;">
          📋 Completa los detalles de cada equipo. Una sola acta incluirá todos los ítems.
        </p>

        <!-- Tabla de equipos -->
        <div style="margin-bottom:16px;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
              <tr style="background:rgba(255,255,255,.05);border-bottom:2px solid rgba(255,255,255,.1);">
                <th style="padding:8px;text-align:left;color:#e2e8f0;font-weight:600;">Equipo</th>
                <th style="padding:8px;text-align:center;color:#e2e8f0;font-weight:600;">Cant.</th>
                <th style="padding:8px;text-align:left;color:#e2e8f0;font-weight:600;">Marca</th>
                <th style="padding:8px;text-align:left;color:#e2e8f0;font-weight:600;">Modelo</th>
                <th style="padding:8px;text-align:left;color:#e2e8f0;font-weight:600;">Serial</th>
              </tr>
            </thead>
            <tbody id="acta-items-table" style="font-size:12px;">
              <!-- Se rellena dinámicamente -->
            </tbody>
          </table>
        </div>

        <!-- Campos comunes (accesorios, observaciones) -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#e2e8f0;">Accesorios entregados (aplica a todos)</label>
            <input type="text" id="acta-accesorios" placeholder="Ej: Control, Cable de energía, Caja, Manuales…"
              style="width:100%;padding:8px;background:#0f0f22;border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#f1f5f9;font-size:12px;box-sizing:border-box;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#e2e8f0;">Observaciones (opcional)</label>
            <textarea id="acta-obs" rows="2"
              style="width:100%;padding:8px;background:#0f0f22;border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#f1f5f9;font-size:12px;box-sizing:border-box;resize:vertical;margin-top:4px;"
              placeholder="Estado del equipo, condiciones especiales…"></textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);">
          <button class="btn btn-secondary" id="acta-modal-cancel" style="font-size:13px;">Cancelar</button>
          <button class="btn btn-primary" id="acta-btn-download" style="padding:8px 16px;font-size:13px;">⬇️ Generar Acta Única (.docx)</button>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start;">

      <!-- Columna izquierda: datos + historial -->
      <div>

        <!-- Datos del solicitante -->
        <div class="card" style="margin-bottom:20px;">
          <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em;">Datos del Solicitante</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${field('Nombre',  req.requester_name)}
            ${field('Cédula',  req.cedula)}
            ${field('Cargo',   req.cargo)}
            ${field('Sede / Punto', req.sede)}
            ${isInc ? field('Equipo afectado', req.equipment_name || '—') : ''}
            ${isInc && req.equipment_serial ? field('Serial / Inventario', req.equipment_serial) : ''}
            ${!isInc ? renderRequestedItems(req) : ''}
          </div>
        </div>

        <!-- Descripción -->
        <div class="card" style="margin-bottom:20px;">
          <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">
            ${isInc ? 'Descripción de la Falla' : 'Descripción del Requerimiento'}
          </h4>
          <p style="line-height:1.7;white-space:pre-wrap;">${escHtml(req.description)}</p>
        </div>

        ${req.resolution_notes ? `
        <div class="card" style="margin-bottom:20px;border-left:3px solid var(--success);">
          <h4 style="font-size:14px;font-weight:700;color:var(--success);margin-bottom:8px;">✅ Notas de Resolución</h4>
          <p style="line-height:1.7;white-space:pre-wrap;">${escHtml(req.resolution_notes)}</p>
        </div>` : ''}

        <!-- Historial -->
        <div class="card">
          <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em;">📋 Historial de Actividad</h4>
          <div id="tr-history">
            ${renderHistory(req.history)}
          </div>

          <!-- Agregar nota -->
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--glass-border);">
            <textarea id="tr-note-input" rows="2" placeholder="Agregar nota interna…"
              style="width:100%;resize:vertical;margin-bottom:10px;"></textarea>
            <button class="btn btn-secondary" id="tr-btn-add-note">📝 Agregar Nota</button>
          </div>
        </div>

      </div>

      <!-- Columna derecha: gestión -->
      <div>
        <div class="card" style="margin-bottom:16px;">
          <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em;">Gestión</h4>

          <div class="form-group" style="margin-bottom:14px;">
            <label>Estado</label>
            <select id="tr-sel-status">
              <option value="pendiente"   ${req.status==='pendiente'   ?'selected':''}>Pendiente</option>
              <option value="en_revision" ${req.status==='en_revision' ?'selected':''}>En Revisión</option>
              <option value="en_proceso"  ${req.status==='en_proceso'  ?'selected':''}>En Proceso</option>
              <option value="completado"  ${req.status==='completado'  ?'selected':''}>Completado</option>
              <option value="rechazado"   ${req.status==='rechazado'   ?'selected':''}>Rechazado</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label>Prioridad</label>
            <select id="tr-sel-priority">
              <option value="baja"    ${req.priority==='baja'   ?'selected':''}>Baja</option>
              <option value="media"   ${req.priority==='media'  ?'selected':''}>Media</option>
              <option value="alta"    ${req.priority==='alta'   ?'selected':''}>Alta</option>
              <option value="critica" ${req.priority==='critica'?'selected':''}>Crítica</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label>Asignar a</label>
            <select id="tr-sel-agent">
              <option value="">— Sin asignar —</option>
              ${agentOptions}
            </select>
          </div>

          <div class="form-group" style="margin-bottom:16px;" id="tr-res-notes-wrap">
            <label>Notas de resolución <span style="font-size:11px;color:var(--text-muted);">(al completar/rechazar)</span></label>
            <textarea id="tr-res-notes" rows="3" style="resize:vertical;"
              placeholder="Indica cómo se resolvió o el motivo del rechazo…">${req.resolution_notes || ''}</textarea>
          </div>

          <button class="btn btn-primary" id="tr-btn-save" style="width:100%;">💾 Guardar Cambios</button>
        </div>

        <!-- Resumen -->
        <div class="card" style="font-size:13px;">
          <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">Resumen</h4>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${mini('Tipo',        typeLabel)}
            ${mini('Agente',      req.agent_name || 'Sin asignar')}
            ${mini('Creación',    formatDate(req.created_at))}
            ${mini('Actualizado', formatDate(req.updated_at))}
            ${req.completed_at ? mini('Completado', formatDate(req.completed_at)) : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  /* ── Guardar cambios ── */
  document.getElementById('tr-btn-save').addEventListener('click', async () => {
    const btn    = document.getElementById('tr-btn-save');
    const status = document.getElementById('tr-sel-status').value;
    const prio   = document.getElementById('tr-sel-priority').value;
    const agent  = document.getElementById('tr-sel-agent').value;
    const resNotes = document.getElementById('tr-res-notes').value.trim();

    btn.textContent = 'Guardando…';
    btn.disabled    = true;

    try {
      const res = await fetch(`/api/tech-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          priority:         prio,
          assigned_to:      agent || null,
          resolution_notes: resNotes || null,
          agentName:        state.currentAgent?.name || 'IT',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('✅ Solicitud actualizada', 'success');
      renderTechRequestDetail(container, id); // recargar
    } catch (err) {
      showToast(err.message, 'error');
      btn.textContent = '💾 Guardar Cambios';
      btn.disabled    = false;
    }
  });

  /* ── Modal Acta de Entrega ── */
  if (!isInc) {
    const actaOverlay = document.getElementById('acta-modal-overlay');

    document.getElementById('btn-generar-acta').addEventListener('click', () => {
      // Renderizar tabla con TODOS los equipos
      const tbody = document.getElementById('acta-items-table');
      if (req.items && req.items.length > 0) {
        tbody.innerHTML = req.items.map((item, idx) => {
          const nameParts = (item.equipment_name || '').split(' ');
          const possibleBrand = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          return `
            <tr style="border-bottom:1px solid rgba(255,255,255,.05);">
              <td style="padding:8px;color:#e2e8f0;">${item.equipment_name}</td>
              <td style="padding:8px;text-align:center;color:#e2e8f0;">${item.quantity}</td>
              <td style="padding:8px;">
                <input type="text" class="acta-item-marca" data-idx="${idx}"
                  value="${possibleBrand || item.equipment_name || ''}"
                  style="width:100%;padding:4px;background:#0f0f22;border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#f1f5f9;font-size:11px;box-sizing:border-box;">
              </td>
              <td style="padding:8px;">
                <input type="text" class="acta-item-modelo" data-idx="${idx}"
                  value="${item.equipment_name || ''}"
                  style="width:100%;padding:4px;background:#0f0f22;border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#f1f5f9;font-size:11px;box-sizing:border-box;">
              </td>
              <td style="padding:8px;">
                <input type="text" class="acta-item-serial" data-idx="${idx}"
                  value="${item.serial || ''}"
                  style="width:100%;padding:4px;background:#0f0f22;border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#f1f5f9;font-size:11px;box-sizing:border-box;">
              </td>
            </tr>
          `;
        }).join('');
      }
      actaOverlay.style.display = 'flex';
    });

    const closeActa = () => { actaOverlay.style.display = 'none'; };
    document.getElementById('acta-modal-close').addEventListener('click', closeActa);
    document.getElementById('acta-modal-cancel').addEventListener('click', closeActa);
    actaOverlay.addEventListener('click', e => { if (e.target === actaOverlay) closeActa(); });

    document.getElementById('acta-btn-download').addEventListener('click', async () => {
      const accesorios = document.getElementById('acta-accesorios').value.trim();
      const obs        = document.getElementById('acta-obs').value.trim();

      // Recolectar datos de TODOS los equipos editados
      const items = Array.from(document.querySelectorAll('.acta-item-marca')).map((el, idx) => ({
        idx,
        marca: el.value.trim(),
        modelo: document.querySelector(`.acta-item-modelo[data-idx="${idx}"]`)?.value.trim() || '',
        serial: document.querySelector(`.acta-item-serial[data-idx="${idx}"]`)?.value.trim() || '',
      }));

      // Validar que al menos marca y modelo estén en el primer equipo
      if (!items[0]?.marca || !items[0]?.modelo) {
        showToast('Completa al menos Marca y Modelo del primer equipo', 'error');
        return;
      }

      const btn = document.getElementById('acta-btn-download');
      btn.textContent = '⏳ Generando…';
      btn.disabled = true;

      try {
        const res = await fetch(`/api/tech-requests/${id}/acta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,  // Array de { idx, marca, modelo, serial }
            accesorios,
            observaciones: obs,
            agentName: state.currentAgent?.name || 'Soporte IT',
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al generar');
        }

        // Descargar el archivo
        const blob     = await res.blob();
        const url      = URL.createObjectURL(blob);
        const filename = res.headers.get('Content-Disposition')
          ?.match(/filename="?([^"]+)"?/)?.[1]
          || `Acta_${req.request_number}.docx`;

        const a = document.createElement('a');
        a.href     = url;
        a.download = decodeURIComponent(filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ Acta descargada correctamente', 'success');
        closeActa();

        // Registrar en historial
        await fetch(`/api/tech-requests/${id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentName: state.currentAgent?.name || 'IT',
            content: `Acta de entrega generada — Equipo: ${marca} ${modelo}`,
          }),
        });

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.textContent = '⬇️ Descargar Acta (.docx)';
        btn.disabled = false;
      }
    });
  }

  /* ── Agregar nota ── */
  document.getElementById('tr-btn-add-note').addEventListener('click', async () => {
    const input = document.getElementById('tr-note-input');
    const note  = input.value.trim();
    if (!note) { showToast('Escribe una nota primero', 'error'); return; }

    try {
      const res = await fetch(`/api/tech-requests/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: state.currentAgent?.name || 'IT', content: note }),
      });
      if (!res.ok) throw new Error();
      input.value = '';
      showToast('Nota agregada', 'success');
      // Recargar solo el historial
      const hr = await fetch(`/api/tech-requests/${id}`);
      const updated = await hr.json();
      document.getElementById('tr-history').innerHTML = renderHistory(updated.history);
    } catch {
      showToast('Error al agregar nota', 'error');
    }
  });
}

/* ─ Helpers de UI ─ */

function renderHistory(history = []) {
  if (!history.length) return `<p style="color:var(--text-muted);font-size:13px;">Sin actividad registrada.</p>`;
  return history.map(h => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--glass-border);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
        ${h.action.startsWith('📝') ? '📝' : h.action.includes('creada') ? '🆕' : '⚙️'}
      </div>
      <div>
        <p style="font-size:13px;margin-bottom:2px;">${escHtml(h.action)}</p>
        <p style="font-size:11px;color:var(--text-muted);">${h.agent_name} · ${formatDate(h.created_at)}</p>
      </div>
    </div>`).join('');
}

function field(label, value) {
  return `
    <div>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em;">${label}</p>
      <p style="font-size:14px;font-weight:500;">${escHtml(String(value ?? '—'))}</p>
    </div>`;
}

function mini(label, value) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <span style="color:var(--text-muted);">${label}</span>
      <span style="font-weight:500;">${value}</span>
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Muestra la tabla de equipos solicitados (requerimientos multi-ítem)
 *  o el campo de cantidad para registros anteriores. */
function renderRequestedItems(req) {
  if (!req.items?.length) {
    return field('Cantidad solicitada', req.quantity);
  }

  const rows = req.items.map((item, i) => `
    <tr style="${i < req.items.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,.06);' : ''}">
      <td style="padding:8px 12px;font-weight:500;">${escHtml(item.equipment_name)}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:600;color:var(--primary);">${item.quantity}</td>
      <td style="padding:8px 12px;color:var(--text-muted);font-size:12px;">${item.serial ? escHtml(item.serial) : '—'}</td>
    </tr>`).join('');

  const total = req.items.reduce((s, i) => s + (i.quantity || 1), 0);

  return `
    <div style="grid-column:1/-1;">
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em;">
        Equipos solicitados
        <span style="background:rgba(99,102,241,.18);color:#818cf8;border-radius:99px;padding:1px 8px;margin-left:6px;font-size:11px;text-transform:none;">
          ${req.items.length} ${req.items.length === 1 ? 'ítem' : 'ítems'} · ${total} und.
        </span>
      </p>
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:rgba(255,255,255,.05);">
              <th style="text-align:left;padding:7px 12px;font-size:11px;color:var(--text-muted);font-weight:600;">Equipo</th>
              <th style="text-align:center;padding:7px 12px;font-size:11px;color:var(--text-muted);font-weight:600;">Cant.</th>
              <th style="text-align:left;padding:7px 12px;font-size:11px;color:var(--text-muted);font-weight:600;">Serial / Inv.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
