/**
 * Vista de detalle de un Requerimiento / Incidencia.
 * Delegados de actas y firmas:
 *  - tech-request-acta.js -> openActaModal, setupFirmaSection
 */

import { showToast } from '../../ui/components.js';
import { state, formatDate, formatTimeAgo } from '../../core/app.js';
import {
  iconDocument, iconClose, iconNote, iconSave, iconClipboard,
  iconWrench, iconCheck, iconSettings, iconTrash
} from '../../utils/icons.js';
import { openActaModal, setupFirmaSection } from './tech-request-acta.js';

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
  container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">Cargando solicitud…</div>`;

  let req;
  try {
    const res = await fetch(`/api/tech-requests/${id}`);
    if (!res.ok) throw new Error('No encontrado');
    req = await res.json();
  } catch {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:#ef4444;">No se pudo cargar la solicitud.</div>`;
    return;
  }

  const isInc  = req.type === 'incidencia';
  const typeLabel = isInc ? `${iconWrench(13)} Incidencia` : `${iconClipboard(13)} Requerimiento`;

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
    <div style="background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.06));border:1px solid rgba(99,102,241,.18);border-radius:14px;padding:18px 22px;margin-bottom:24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <button onclick="history.back()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);padding:7px 14px;border-radius:8px;color:#94a3b8;font-size:13px;cursor:pointer;transition:all .2s;flex-shrink:0;"
        onmouseover="this.style.background='rgba(255,255,255,.12)'" onmouseout="this.style.background='rgba(255,255,255,.07)'">← Volver</button>
      <div style="flex:1;min-width:0;">
        <h2 style="font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${typeLabel} — ${req.request_number}</h2>
        <p style="color:var(--text-muted);font-size:12px;margin-top:2px;">Creado ${formatTimeAgo(req.created_at)} · ${formatDate(req.created_at)}</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;">
        ${sb(req.status)} ${pb(req.priority)}
        <button id="btn-generar-acta"
            style="display:flex;align-items:center;gap:7px;padding:9px 18px;background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,.3);transition:all .2s;"
            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,.4)'"
            onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(16,185,129,.3)'">
            ${iconDocument(13)} Generar Acta
          </button>
          <button id="btn-eliminar-solicitud"
            style="display:flex;align-items:center;gap:7px;padding:9px 18px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:9px;color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;"
            onmouseover="this.style.background='rgba(239,68,68,.22)';this.style.borderColor='rgba(239,68,68,.6)'"
            onmouseout="this.style.background='rgba(239,68,68,.12)';this.style.borderColor='rgba(239,68,68,.35)'">
            ${iconTrash(13)} Eliminar
          </button>
      </div>
    </div>

    <!-- Modal Acta de Entrega (todos los equipos) -->
    <div id="acta-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(5px);z-index:2000;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;overflow-x:hidden;">
      <div style="background:linear-gradient(160deg,#141428 0%,#111122 100%);border:1px solid rgba(99,102,241,.2);border-radius:18px;width:min(800px,96vw);margin:0 auto;max-height:calc(100vh - 40px);display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.85),0 0 0 1px rgba(99,102,241,.08);">
        <!-- Header fijo -->
        <div style="background:linear-gradient(135deg,rgba(16,185,129,.15),rgba(5,150,105,.08));padding:22px 28px 18px;border-radius:18px 18px 0 0;border-bottom:1px solid rgba(16,185,129,.15);flex-shrink:0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;background:linear-gradient(135deg,#10b981,#059669);border-radius:11px;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 12px rgba(16,185,129,.35);">
                ${iconDocument(20)}
              </div>
              <div>
                <h3 style="font-size:17px;font-weight:700;color:#e2e8f0;margin-bottom:2px;">Acta de Entrega</h3>
                <p style="font-size:12px;color:#6ee7b7;opacity:.8;">${escHtml(req.requester_name)} · ${req.request_number}</p>
              </div>
            </div>
            <button id="acta-modal-close" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);width:32px;height:32px;border-radius:8px;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center;transition:all .2s;" onmouseover="this.style.background='rgba(255,255,255,.13)'" onmouseout="this.style.background='rgba(255,255,255,.07)'">
              &times;
            </button>
          </div>
          <!-- Info pill -->
          <div style="display:flex;align-items:center;gap:8px;margin-top:14px;padding:8px 12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.15);border-radius:8px;">
            <span style="color:#6ee7b7;">ℹ️</span>
            <span style="font-size:12px;color:#6ee7b7;">Verifica marca, modelo y serial de cada equipo antes de generar. El documento incluirá todos los ítems en una sola acta.</span>
          </div>
        </div>
        <!-- Cuerpo scrollable -->
        <div style="overflow-y:auto;padding:22px 28px;flex:1;">
          <!-- Tabla de equipos -->
          <div style="margin-bottom:20px;">
            <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
              📦 Equipos a entregar
              <span style="flex:1;height:1px;background:linear-gradient(90deg,rgba(16,185,129,.3),transparent);display:inline-block;"></span>
            </div>
            <div style="overflow-x:auto;border-radius:10px;border:1px solid rgba(255,255,255,.07);">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:linear-gradient(90deg,rgba(16,185,129,.12),rgba(5,150,105,.07));">
                    <th style="padding:10px 12px;text-align:left;color:#6ee7b7;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid rgba(16,185,129,.15);">Equipo</th>
                    <th style="padding:10px 8px;text-align:center;color:#6ee7b7;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid rgba(16,185,129,.15);width:50px;">Cant.</th>
                    <th style="padding:10px 12px;text-align:left;color:#6ee7b7;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid rgba(16,185,129,.15);">Marca</th>
                    <th style="padding:10px 12px;text-align:left;color:#6ee7b7;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid rgba(16,185,129,.15);">Modelo</th>
                    <th style="padding:10px 12px;text-align:left;color:#6ee7b7;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid rgba(16,185,129,.15);">Serial</th>
                  </tr>
                </thead>
                <tbody id="acta-items-table"></tbody>
              </table>
            </div>
          </div>
          <!-- Campos comunes -->
          <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            📝 Información adicional
            <span style="flex:1;height:1px;background:linear-gradient(90deg,rgba(16,185,129,.3),transparent);display:inline-block;"></span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:#8b9ab0;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px;">Accesorios entregados</label>
              <input type="text" id="acta-accesorios" placeholder="Ej: Cargador, Cable HDMI, Mouse…"
                style="width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f1f5f9;font-size:12px;box-sizing:border-box;transition:border-color .2s,box-shadow .2s;"
                onfocus="this.style.borderColor='rgba(16,185,129,.6)';this.style.boxShadow='0 0 0 3px rgba(16,185,129,.12)'"
                onblur="this.style.borderColor='rgba(255,255,255,.1)';this.style.boxShadow='none'">
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#8b9ab0;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px;">Observaciones <span style="color:#4b5563;text-transform:none;font-weight:400;">(opcional)</span></label>
              <textarea id="acta-obs" rows="1"
                style="width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f1f5f9;font-size:12px;box-sizing:border-box;resize:none;transition:border-color .2s,box-shadow .2s;"
                placeholder="Estado del equipo, condiciones especiales…"
                onfocus="this.style.borderColor='rgba(16,185,129,.6)';this.style.boxShadow='0 0 0 3px rgba(16,185,129,.12)'"
                onblur="this.style.borderColor='rgba(255,255,255,.1)';this.style.boxShadow='none'"></textarea>
            </div>
          </div>
        </div>
        <!-- Footer fijo -->
        <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,.07);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0;background:rgba(0,0,0,.2);border-radius:0 0 18px 18px;">
          <button class="btn btn-secondary" id="acta-modal-cancel" style="padding:10px 20px;font-size:13px;">Cancelar</button>
          <button id="acta-btn-download"
            style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,.35);transition:all .2s;"
            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,.45)'"
            onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(16,185,129,.35)'">
            Descargar Acta (.docx)
          </button>
        </div>
      </div>
    </div>

    <!-- Sección link de firma -->
    ${!isInc ? `
    <div id="firma-section" style="background:var(--surface-2,#141422);border:1px solid var(--border,rgba(255,255,255,.07));border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        📝 Acta Firmada
      </div>
      <div id="firma-content"></div>
    </div>` : ''}

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
          <h4 style="font-size:14px;font-weight:700;color:var(--success);margin-bottom:8px;display:flex;align-items:center;gap:6px;">${iconCheck(14)} Notas de Resolución</h4>
          <p style="line-height:1.7;white-space:pre-wrap;">${escHtml(req.resolution_notes)}</p>
        </div>` : ''}

        <!-- Historial -->
        <div class="card">
          <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:6px;">${iconClipboard(13)} Historial de Actividad</h4>
          <div id="tr-history">
            ${renderHistory(req.history)}
          </div>

          <!-- Agregar nota -->
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--glass-border);">
            <textarea id="tr-note-input" rows="2" placeholder="Agregar nota interna…"
              style="width:100%;resize:vertical;margin-bottom:10px;"></textarea>
            <button class="btn btn-secondary" id="tr-btn-add-note" style="display:inline-flex;align-items:center;gap:6px;">${iconNote(13)} Agregar Nota</button>
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

          <button class="btn btn-primary" id="tr-btn-save" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;">${iconSave(14)} Guardar Cambios</button>
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
          agentName:        state.currentUser?.username || 'IT',
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('✅ Solicitud actualizada', 'success');
      renderTechRequestDetail(container, id); // recargar
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = `${iconSave(14)} Guardar Cambios`;
      btn.disabled    = false;
    }
  });

  /* ── Eliminar solicitud ── */
  document.getElementById('btn-eliminar-solicitud').addEventListener('click', async () => {
    if (!confirm(`¿Eliminar ${req.request_number}? Esta acción no se puede deshacer.`)) return;
    const btn = document.getElementById('btn-eliminar-solicitud');
    btn.textContent = 'Eliminando…';
    btn.disabled = true;
    try {
      const res = await fetch(`/api/tech-requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Solicitud eliminada', 'success');
      window.location.hash = '#tech-requests';
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = `${iconTrash(13)} Eliminar`;
      btn.disabled = false;
    }
  });

  /* ── Acta Modal Trigger ── */
  document.getElementById('btn-generar-acta').addEventListener('click', () => {
    openActaModal(req, () => {
      renderTechRequestDetail(container, id);
    });
  });

  /* ── Firma Section setup ── */
  if (!isInc) {
    setupFirmaSection(container, req);
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
        body: JSON.stringify({ agentName: state.currentUser?.username || 'IT', content: note }),
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
      <div style="width:32px;height:32px;border-radius:50%;background:var(--glass-border);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text-muted);">
        ${h.action.startsWith('📝') || h.action.toLowerCase().includes('nota') ? iconNote(14) : h.action.includes('creada') ? iconNote(14) : iconSettings(14)}
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
