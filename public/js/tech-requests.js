/**
 * Módulo de Requerimientos Tecnológicos e Incidencias.
 * Vista principal: lista filtrable con pestañas y modal de nueva solicitud.
 */

import { showToast, attachSedeSearch } from './components.js';
import { state } from './app.js';
import { formatDate, formatTimeAgo } from './app.js';
import { iconSearch, iconPlus, iconClose, iconEdit, iconNote, iconClipboard, iconWrench, iconCopy, iconSave, iconTrash } from './icons.js';

/* ═══════════════════════════════════════════════════
   CONSTANTES DE DOMINIO
   ═══════════════════════════════════════════════════ */

const STATUS_CFG = {
  pendiente:   { label: 'Pendiente',   cls: 'badge-pendiente'  },
  en_revision: { label: 'En Revisión', cls: 'badge-en_espera'  },
  en_proceso:  { label: 'En Proceso',  cls: 'badge-en_progreso'},
  completado:  { label: 'Completado',  cls: 'badge-resuelto'   },
  rechazado:   { label: 'Rechazado',   cls: 'badge-critica'    },
};

const PRIORITY_CFG = {
  baja:   { label: 'Baja',    cls: 'badge-baja'   },
  media:  { label: 'Media',   cls: 'badge-media'  },
  alta:   { label: 'Alta',    cls: 'badge-alta'   },
  critica:{ label: 'Crítica', cls: 'badge-critica'},
};

function statusBadge(s) {
  const c = STATUS_CFG[s] || { label: s, cls: '' };
  return `<span class="badge ${c.cls}">${c.label}</span>`;
}
function priorityBadge(p) {
  const c = PRIORITY_CFG[p] || { label: p, cls: '' };
  return `<span class="badge ${c.cls}">${c.label}</span>`;
}

/* ═══════════════════════════════════════════════════
   RENDER PRINCIPAL
   ═══════════════════════════════════════════════════ */

export async function renderTechRequests(container) {
  let activeTab   = 'requerimiento'; // 'requerimiento' | 'incidencia'
  let currentPage = 1;
  const limit     = 15;
  let filters     = {};

  container.innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Requerimientos Tecnológicos</h2>
        <p style="color:var(--text-muted);font-size:14px;">Gestiona solicitudes de equipos e incidencias enviadas desde las sedes.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button id="btn-ver-registros"
          style="display:flex;align-items:center;gap:7px;padding:10px 18px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;"
          onmouseover="this.style.background='var(--surface-hover)';this.style.color='var(--text)'"
          onmouseout="this.style.background='var(--surface)';this.style.color='var(--text-2)'">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          Ver Registros
        </button>
        <button id="btn-new-request"
          style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;"
          onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 22px rgba(99,102,241,.5)'"
          onmouseout="this.style.transform='';this.style.boxShadow='0 4px 16px rgba(99,102,241,.35)'">
          ${iconPlus(14)} Nueva Solicitud
        </button>
      </div>
    </div>

    <!-- Pestañas -->
    <div style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid var(--glass-border);">
      <button id="tab-req" class="tab-btn tab-active" data-tab="requerimiento">
        ${iconClipboard(13)} Requerimientos
        <span class="tab-count" id="count-req">…</span>
      </button>
      <button id="tab-inc" class="tab-btn" data-tab="incidencia">
        ${iconWrench(13)} Incidencias
        <span class="tab-count" id="count-inc">…</span>
      </button>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-top:0;border-radius:0 0 12px 12px;padding:16px 20px;">
      <div class="filter-bar">
        <div class="form-group">
          <label>Buscar</label>
          <input type="text" id="tr-search" placeholder="Nombre, cédula, sede…" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select id="tr-status">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_revision">En Revisión</option>
            <option value="en_proceso">En Proceso</option>
            <option value="completado">Completado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
        <div class="form-group">
          <label>Prioridad</label>
          <select id="tr-priority">
            <option value="">Todas</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sede</label>
          <input type="text" id="tr-sede" placeholder="Nombre de sede…">
        </div>
        <div class="form-group" style="align-self:flex-end;">
          <button class="btn btn-secondary" id="tr-btn-filter">${iconSearch(13)} Filtrar</button>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div id="tr-table-container" style="margin-top:20px;"></div>

    <!-- Modal nuevo -->
    <div id="tr-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:1000;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;overflow-x:hidden;">
      <div id="tr-modal" style="border-radius:16px;padding:32px;width:min(640px,95vw);margin:0 auto;">
        <!-- contenido inyectado dinámicamente -->
      </div>
    </div>
  `;

  /* ── Injectar estilos de pestaña ── */
  if (!document.getElementById('tr-tab-styles')) {
    const st = document.createElement('style');
    st.id = 'tr-tab-styles';
    st.textContent = `
      .tab-btn { background:none;border:none;padding:10px 24px;font-size:14px;font-weight:600;
        color:var(--text-muted);cursor:pointer;border-bottom:3px solid transparent;transition:.2s; }
      .tab-btn:hover { color:var(--text-primary); }
      .tab-active { color:var(--primary)!important;border-bottom-color:var(--primary)!important; }
      .tab-count { background:var(--glass-border);color:var(--text-muted);font-size:11px;
        padding:1px 7px;border-radius:99px;margin-left:8px; }
      .tr-row:hover { background:rgba(255,255,255,.04);cursor:pointer; }
      .badge-pendiente { background:rgba(245,158,11,.15);color:#f59e0b; }

      /* ── Modal nueva solicitud ── */
      #tr-modal-overlay { backdrop-filter: blur(4px); }

      #tr-modal {
        background: linear-gradient(160deg, #1a1a3e 0%, #16162e 100%) !important;
        border: 1px solid rgba(99,102,241,0.25) !important;
        box-shadow: 0 32px 80px rgba(0,0,0,.85), 0 0 0 1px rgba(99,102,241,0.1) !important;
      }

      #tr-modal input[type="text"],
      #tr-modal input[type="number"],
      #tr-modal textarea,
      #tr-modal select {
        background: rgba(255,255,255,0.05) !important;
        color: #e8e8f0 !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 8px;
        transition: border-color .2s, box-shadow .2s;
      }
      #tr-modal input[type="text"]:focus,
      #tr-modal input[type="number"]:focus,
      #tr-modal textarea:focus,
      #tr-modal select:focus {
        border-color: rgba(99,102,241,0.7) !important;
        outline: none;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
        background: rgba(99,102,241,0.07) !important;
      }
      #tr-modal input::placeholder,
      #tr-modal textarea::placeholder { color: rgba(200,200,220,0.35); }
      #tr-modal label { color: #a8a8c8; font-size: 12px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
      #tr-modal h3 { color: #e8e8f0; }
      #tr-modal select option { background: #1e1e38; color: #e8e8f0; }

      /* Tipo de solicitud cards */
      .tr-type-card {
        display:flex; align-items:center; gap:12px; cursor:pointer;
        padding:14px 16px; border:2px solid rgba(255,255,255,0.1);
        border-radius:12px; flex:1; transition: all .2s;
        background: rgba(255,255,255,0.03);
      }
      .tr-type-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(99,102,241,0.4); }
      .tr-type-card.selected { border-color: var(--primary); background: rgba(99,102,241,0.12); }
      .tr-type-card .tc-icon { font-size:22px; flex-shrink:0; }
      .tr-type-card .tc-title { font-size:13px; font-weight:700; color:#e2e8f0; }
      .tr-type-card .tc-desc { font-size:11px; color:#6b7280; margin-top:2px; }

      /* Sección con línea divisora */
      .tr-section {
        margin-top:20px; padding-top:16px;
        border-top: 1px solid rgba(255,255,255,0.07);
      }
      .tr-section-title {
        font-size:11px; font-weight:700; color:#6366f1;
        text-transform:uppercase; letter-spacing:.08em;
        margin-bottom:12px; display:flex; align-items:center; gap:8px;
      }
      .tr-section-title::after {
        content:''; flex:1; height:1px;
        background:linear-gradient(90deg,rgba(99,102,241,.3),transparent);
      }

      /* Fila de ítem de equipo */
      .tr-item-row {
        display:grid; grid-template-columns:2fr 58px 1fr 30px 30px;
        gap:6px; margin-bottom:8px; align-items:center;
        background:rgba(255,255,255,.03); padding:6px 8px;
        border-radius:8px; border:1px solid rgba(255,255,255,.06);
        transition: border-color .2s;
      }
      .tr-item-row:hover { border-color:rgba(99,102,241,.25); }

      /* Botón add item */
      #tr-btn-add-item {
        background: rgba(99,102,241,.12);
        border: 1px dashed rgba(99,102,241,.45);
        color: #818cf8;
        border-radius: 8px;
        padding: 6px 16px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
        transition: all .2s;
      }
      #tr-btn-add-item:hover {
        background: rgba(99,102,241,.2);
        border-color: rgba(99,102,241,.7);
        color: #a5b4fc;
      }

      /* Footer del modal */
      .tr-modal-footer {
        display:flex; gap:10px; justify-content:flex-end;
        margin-top:24px; padding-top:18px;
        border-top:1px solid rgba(255,255,255,.08);
      }
    `;
    document.head.appendChild(st);
  }

  /* ── Función de carga de tabla ── */
  async function loadTable() {
    const container2 = document.getElementById('tr-table-container');
    container2.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Cargando…</div>`;

    const params = new URLSearchParams({
      type:  activeTab,
      page:  currentPage,
      limit,
      ...filters,
    });

    try {
      const res  = await fetch(`/api/tech-requests?${params}`);
      const data = await res.json();

      // Actualizar contadores de pestaña
      if (activeTab === 'requerimiento') document.getElementById('count-req').textContent = data.total;
      else                               document.getElementById('count-inc').textContent = data.total;

      if (!data.requests?.length) {
        container2.innerHTML = `
          <div style="text-align:center;padding:60px;color:var(--text-muted);">
            <div style="font-size:48px;margin-bottom:12px;">${activeTab === 'requerimiento' ? iconClipboard(40) : iconWrench(40)}</div>
            <p>No hay ${activeTab === 'requerimiento' ? 'requerimientos' : 'incidencias'} registradas.</p>
          </div>`;
        return;
      }

      const isInc = activeTab === 'incidencia';
        container2.innerHTML = `
        <div class="card">
          <!-- Desktop: tabla -->
          <div class="tr-table-wrap" style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid var(--glass-border);">
                  <th style="${TH}">N.º Solicitud</th>
                  <th style="${TH}">Solicitante</th>
                  <th style="${TH}">Cédula</th>
                  <th style="${TH}">Cargo</th>
                  <th style="${TH}">Sede</th>
                  ${isInc ? `<th style="${TH}">Equipo</th>` : `<th style="${TH}">Cantidad</th>`}
                  <th style="${TH}">Estado</th>
                  <th style="${TH}">Fecha</th>
                  <th style="${TH}text-align:right;min-width:100px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${data.requests.map(r => `
                  <tr class="tr-row" data-id="${r.id}" style="border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;">
                    <td style="${TD} font-weight:600;color:var(--primary);">${r.request_number}</td>
                    <td style="${TD}">${r.requester_name}</td>
                    <td style="${TD} color:var(--text-muted);font-size:12px;">${r.cedula}</td>
                    <td style="${TD} font-size:13px;">${r.cargo}</td>
                    <td style="${TD}">${r.sede}</td>
                    ${isInc
                      ? `<td style="${TD} font-size:12px;">${r.equipment_name || '—'}</td>`
                      : `<td style="${TD} text-align:center;">${r.quantity}</td>`}
                    <td style="${TD}">${statusBadge(r.status)}</td>
                    <td style="${TD} color:var(--text-muted);font-size:12px;" title="${formatDate(r.created_at)}">${formatTimeAgo(r.created_at)}</td>
                    <td style="${TD} text-align:right;white-space:nowrap;min-width:130px;">
                      <button class="btn-tr-edit" data-id="${r.id}"
                        style="padding:4px 10px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;gap:5px;"
                        title="Editar solicitud"
                        onclick="event.stopPropagation();">${iconEdit(11)} Editar</button>
                      <button class="btn-tr-delete" data-id="${r.id}" data-ref="${r.request_number}"
                        style="padding:4px 10px;font-size:11px;border:1px solid rgba(239,68,68,.35);border-radius:6px;background:rgba(239,68,68,.1);color:#f87171;cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-left:4px;"
                        title="Eliminar solicitud"
                        onclick="event.stopPropagation();">${iconTrash(11)}</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <!-- Mobile: cards -->
          <div class="tr-cards">
            ${data.requests.map(r => `
              <div class="tr-card tr-row" data-id="${r.id}">
                <div class="tr-card-header">
                  <span class="tr-card-num">${r.request_number}</span>
                  ${statusBadge(r.status)}
                </div>
                <div class="tr-card-name">${r.requester_name}</div>
                <div class="tr-card-meta">${[r.cargo, r.sede].filter(Boolean).join(' · ')}</div>
                ${r.cedula ? `<div class="tr-card-cedula">CC ${r.cedula}</div>` : ''}
                <div class="tr-card-extra">
                  ${isInc
                    ? (r.equipment_name || '—')
                    : `${r.quantity} equipo${r.quantity !== 1 ? 's' : ''}`}
                </div>
                <div class="tr-card-footer">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span class="tr-card-time" title="${formatDate(r.created_at)}">${formatTimeAgo(r.created_at)}</span>
                  </div>
                  <button class="btn-tr-edit" data-id="${r.id}" onclick="event.stopPropagation();" style="display:inline-flex;align-items:center;gap:5px;">${iconEdit(11)} Editar</button>
                  <button class="btn-tr-delete" data-id="${r.id}" data-ref="${r.request_number}" onclick="event.stopPropagation();" style="display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(239,68,68,.35);border-radius:6px;background:rgba(239,68,68,.1);color:#f87171;padding:4px 10px;font-size:11px;cursor:pointer;">${iconTrash(11)}</button>
                </div>
              </div>`).join('')}
          </div>
          ${renderPagination(data)}
        </div>`;

      // Scroll horizontal con rueda del mouse sobre la tabla
      const tableWrap = container2.querySelector('.tr-table-wrap');
      if (tableWrap) {
        tableWrap.addEventListener('wheel', (e) => {
          if (tableWrap.scrollWidth > tableWrap.clientWidth) {
            e.preventDefault();
            tableWrap.scrollLeft += e.deltaY;
          }
        }, { passive: false });
      }

      // Clicks en filas → detalle
      container2.querySelectorAll('.tr-row').forEach(row => {
        row.addEventListener('click', () => {
          window.location.hash = `#tech-request/${row.dataset.id}`;
        });
      });

      // Botones Editar
      container2.querySelectorAll('.btn-tr-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id), loadTable));
      });

      // Botones Eliminar
      container2.querySelectorAll('.btn-tr-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`¿Eliminar ${btn.dataset.ref}? Esta acción no se puede deshacer.`)) return;
          btn.disabled = true;
          try {
            const res = await fetch(`/api/tech-requests/${btn.dataset.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error);
            showToast('Solicitud eliminada', 'success');
            loadTable();
          } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
          }
        });
      });

      // Paginación
      container2.querySelectorAll('.tr-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentPage = parseInt(btn.dataset.page);
          loadTable();
        });
      });

    } catch (err) {
      container2.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;">Error al cargar datos.</div>`;
      console.error(err);
    }
  }

  /* ── Pestañas ── */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      activeTab   = btn.dataset.tab;
      currentPage = 1;
      loadTable();
    });
  });

  /* ── Filtros ── */
  document.getElementById('tr-btn-filter').addEventListener('click', () => {
    filters = {};
    const s = document.getElementById('tr-search').value.trim();
    const st = document.getElementById('tr-status').value;
    const pr = document.getElementById('tr-priority').value;
    const se = document.getElementById('tr-sede').value.trim();
    if (s)  filters.search   = s;
    if (st) filters.status   = st;
    if (pr) filters.priority = pr;
    if (se) filters.sede     = se;
    currentPage = 1;
    loadTable();
  });

  /* ── Enter en campos de filtro ── */
  ['tr-search','tr-sede'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('tr-btn-filter').click();
    });
  });

  /* ── Botón Nueva Solicitud ── */
  /* Botón Ver Registros: abre Google Sheet si está configurado, si no la página interna */
  fetch('/api/registros-it/sheet-url')
    .then(r => r.json())
    .then(({ url }) => {
      document.getElementById('btn-ver-registros').addEventListener('click', () => {
        window.open(url || '/registros-it.html', '_blank');
      });
    })
    .catch(() => {
      document.getElementById('btn-ver-registros').addEventListener('click', () => {
        window.open('/registros-it.html', '_blank');
      });
    });

  document.getElementById('btn-new-request').addEventListener('click', () => {
    openModal(activeTab, loadTable);
  });

  /* ── Carga inicial ── */
  loadTable();
  // Precargar contador de la otra pestaña
  fetch('/api/tech-requests?type=incidencia&limit=1')
    .then(r => r.json()).then(d => { document.getElementById('count-inc').textContent = d.total ?? 0; });
  fetch('/api/tech-requests?type=requerimiento&limit=1')
    .then(r => r.json()).then(d => { document.getElementById('count-req').textContent = d.total ?? 0; });
}

/* ═══════════════════════════════════════════════════
   MODAL NUEVA SOLICITUD
   ═══════════════════════════════════════════════════ */

function openModal(defaultType, onSuccess) {
  const overlay = document.getElementById('tr-modal-overlay');
  const modal   = document.getElementById('tr-modal');
  overlay.style.display = 'flex';

  // Estado de ítems para requerimientos
  let modalItems = [{ equipment_name: '', quantity: 1, serial: '' }];

  modal.innerHTML = `
    <!-- Header con gradiente -->
    <div style="background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(139,92,246,.12));margin:-32px -32px 24px;padding:24px 28px 20px;border-radius:16px 16px 0 0;border-bottom:1px solid rgba(99,102,241,.2);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;">${iconNote(18)}</div>
            <h3 style="font-size:18px;font-weight:700;color:#e2e8f0;">Nueva Solicitud</h3>
          </div>
          <p style="font-size:12px;color:#6b7a99;margin-left:46px;">Completa los datos para registrar el requerimiento o incidencia</p>
        </div>
        <button id="tr-modal-close" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);width:32px;height:32px;border-radius:8px;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center;transition:all .2s;" onmouseover="this.style.background='rgba(255,255,255,.12)'" onmouseout="this.style.background='rgba(255,255,255,.07)'">${iconClose(14)}</button>
      </div>
    </div>

    <!-- Tipo de solicitud -->
    <div style="margin-bottom:4px;">
      <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Tipo de solicitud</div>
      <div style="display:flex;gap:12px;">
        <label class="tr-type-card ${defaultType==='requerimiento'?'selected':''}" id="lbl-req" for="tr-type-req">
          <input type="radio" id="tr-type-req" name="tr-type" value="requerimiento" ${defaultType==='requerimiento'?'checked':''} style="display:none;">
          <span class="tc-icon">${iconClipboard(22)}</span>
          <div>
            <div class="tc-title">Requerimiento</div>
            <div class="tc-desc">Solicitud de equipo nuevo</div>
          </div>
        </label>
        <label class="tr-type-card ${defaultType==='incidencia'?'selected':''}" id="lbl-inc" for="tr-type-inc">
          <input type="radio" id="tr-type-inc" name="tr-type" value="incidencia" ${defaultType==='incidencia'?'checked':''} style="display:none;">
          <span class="tc-icon">${iconWrench(22)}</span>
          <div>
            <div class="tc-title">Incidencia</div>
            <div class="tc-desc">Falla o problema técnico</div>
          </div>
        </label>
      </div>
    </div>

    <!-- Datos del solicitante -->
    <div class="tr-section">
      <div class="tr-section-title">Datos del solicitante</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Nombre completo *</label>
          <input type="text" id="tr-f-name" placeholder="Nombre y apellido">
        </div>
        <div class="form-group">
          <label>Cédula *</label>
          <input type="text" id="tr-f-cedula" placeholder="Número de cédula">
        </div>
        <div class="form-group">
          <label>Cargo *</label>
          <input type="text" id="tr-f-cargo" placeholder="Ej: Auxiliar contable">
        </div>
        <div class="form-group">
          <label>Sede / Punto *</label>
          <input type="text" id="tr-f-sede" placeholder="Ej: Sede Central, Clínica Norte…">
        </div>
      </div>
    </div>

    <!-- EQUIPOS SOLICITADOS (solo requerimientos) -->
    <div id="tr-f-items-section" class="tr-section" style="${defaultType==='incidencia'?'display:none;':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="tr-section-title" style="margin-bottom:0;">Equipos solicitados</div>
        <button type="button" id="tr-btn-add-item" style="display:inline-flex;align-items:center;gap:5px;">${iconPlus(12)} Agregar equipo</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 58px 1fr 30px 30px;gap:6px;padding:0 8px;margin-bottom:4px;">
        <span style="font-size:11px;color:#5a607a;">Nombre del equipo *</span>
        <span style="font-size:11px;color:#5a607a;text-align:center;">Cant.</span>
        <span style="font-size:11px;color:#5a607a;">Serial / Inv.</span>
        <span></span>
        <span></span>
      </div>
      <div id="tr-f-items-list"></div>
    </div>

    <!-- EQUIPO AFECTADO (solo incidencias) -->
    <div id="tr-f-equipo-wrap" class="tr-section" style="${defaultType==='requerimiento'?'display:none;':''}">
      <div class="tr-section-title">Equipo afectado</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Nombre / tipo de equipo</label>
          <input type="text" id="tr-f-equipo" placeholder="Ej: Portátil Dell, Impresora…">
        </div>
        <div class="form-group">
          <label>Serial o inventario</label>
          <input type="text" id="tr-f-serial" placeholder="Opcional">
        </div>
      </div>
    </div>

    <!-- Descripción + prioridad -->
    <div class="tr-section">
      <div class="tr-section-title">Descripción y prioridad</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Descripción *</label>
          <textarea id="tr-f-desc" rows="3" placeholder="Describe el requerimiento o la falla del equipo…" style="resize:vertical;"></textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="form-group" id="tr-f-qty-wrap" style="${defaultType==='requerimiento'?'display:none;':''}">
            <label>Cantidad</label>
            <input type="number" id="tr-f-qty" value="1" min="1">
          </div>
          <div class="form-group">
            <label>Prioridad</label>
            <select id="tr-f-priority">
              <option value="baja">🟢 Baja</option>
              <option value="media" selected>🟡 Media</option>
              <option value="alta">🟠 Alta</option>
              <option value="critica">🔴 Crítica</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="tr-modal-footer">
      <button class="btn btn-secondary" id="tr-modal-cancel" style="padding:10px 20px;">Cancelar</button>
      <button class="btn btn-primary" id="tr-modal-save" style="padding:10px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;display:inline-flex;align-items:center;gap:7px;">
        ${iconSave(14)} Guardar Solicitud
      </button>
    </div>
  `;

  /* ── Utilidades de formateo de texto ──────────────────────────── */
  const toTitleCase   = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const toSentenceCase = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };

  /* ── Renderizado reactivo de la lista de ítems ── */
  function renderModalItems() {
    const cont = document.getElementById('tr-f-items-list');
    if (!cont) return;

    cont.innerHTML = modalItems.map((item, idx) => `
      <div class="tr-item-row">
        <input type="text" class="tr-item-name" data-idx="${idx}"
          value="${_esc(item.equipment_name)}"
          placeholder="Ej: Portátil, Monitor, Teclado…">
        <input type="number" class="tr-item-qty" data-idx="${idx}"
          value="${item.quantity}" min="1" style="text-align:center;">
        <input type="text" class="tr-item-serial" data-idx="${idx}"
          value="${_esc(item.serial)}"
          placeholder="Serial (opc.)">
        <button type="button" class="tr-item-dup" data-idx="${idx}"
          title="Duplicar fila (mismo equipo, serial distinto)"
          style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8;border-radius:6px;width:30px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;">${iconCopy(13)}</button>
        <button type="button" class="tr-item-remove" data-idx="${idx}"
          title="Quitar equipo"
          style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#f87171;border-radius:6px;width:30px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;${modalItems.length <= 1 ? 'opacity:.3;cursor:not-allowed;' : ''}"
          ${modalItems.length <= 1 ? 'disabled' : ''}>${iconClose(13)}</button>
      </div>
    `).join('');

    cont.querySelectorAll('.tr-item-name').forEach(inp => {
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].equipment_name = e.target.value; });
      inp.addEventListener('blur',  e => {
        e.target.value = toTitleCase(e.target.value.trim());
        modalItems[+e.target.dataset.idx].equipment_name = e.target.value;
      });
    });
    cont.querySelectorAll('.tr-item-qty').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].quantity = parseInt(e.target.value) || 1; })
    );
    cont.querySelectorAll('.tr-item-serial').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].serial = e.target.value; })
    );
    cont.querySelectorAll('.tr-item-dup').forEach(btn =>
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        const src = modalItems[idx];
        modalItems.splice(idx + 1, 0, { equipment_name: src.equipment_name, quantity: 1, serial: '' });
        renderModalItems();
        cont.querySelectorAll('.tr-item-serial')[idx + 1]?.focus();
      })
    );
    cont.querySelectorAll('.tr-item-remove').forEach(btn =>
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        if (modalItems.length > 1) { modalItems.splice(idx, 1); renderModalItems(); }
      })
    );
  }

  renderModalItems();
  attachSedeSearch(document.getElementById('tr-f-sede'));

  document.getElementById('tr-btn-add-item')?.addEventListener('click', () => {
    modalItems.push({ equipment_name: '', quantity: 1, serial: '' });
    renderModalItems();
    // Foco al último campo de nombre añadido
    const inputs = document.querySelectorAll('#tr-f-items-list .tr-item-name');
    inputs[inputs.length - 1]?.focus();
  });

  /* ── Toggle tipo: muestra/oculta secciones según selección ── */
  modal.querySelectorAll('input[name="tr-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isReq = modal.querySelector('input[name="tr-type"]:checked')?.value === 'requerimiento';
      document.getElementById('lbl-req').classList.toggle('selected',  isReq);
      document.getElementById('lbl-inc').classList.toggle('selected', !isReq);
      document.getElementById('tr-f-items-section').style.display  = isReq  ? 'block' : 'none';
      document.getElementById('tr-f-equipo-wrap').style.display    = isReq  ? 'none'  : 'block';
      document.getElementById('tr-f-qty-wrap').style.display       = isReq  ? 'none'  : 'block';
    });
  });

  const closeModal = () => { overlay.style.display = 'none'; };
  document.getElementById('tr-modal-close').addEventListener('click', closeModal);
  document.getElementById('tr-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  /* Capitaliza la primera letra de cada palabra al salir del campo */
  document.getElementById('tr-f-name').addEventListener('blur', e => {
    e.target.value = toTitleCase(e.target.value.trim());
  });
  document.getElementById('tr-f-cargo').addEventListener('blur', e => {
    e.target.value = toTitleCase(e.target.value.trim());
  });
  document.getElementById('tr-f-equipo').addEventListener('blur', e => {
    e.target.value = toTitleCase(e.target.value.trim());
  });
  document.getElementById('tr-f-desc').addEventListener('blur', e => {
    e.target.value = toSentenceCase(e.target.value);
  });

  document.getElementById('tr-modal-save').addEventListener('click', async () => {
    const type   = modal.querySelector('input[name="tr-type"]:checked')?.value;
    const name   = toTitleCase(document.getElementById('tr-f-name').value.trim());
    const cedula = document.getElementById('tr-f-cedula').value.trim();
    const cargo  = toTitleCase(document.getElementById('tr-f-cargo').value.trim());
    const sede   = document.getElementById('tr-f-sede').value.trim();
    const desc   = document.getElementById('tr-f-desc').value.trim();
    const prio   = document.getElementById('tr-f-priority').value;

    if (!type || !name || !cedula || !cargo || !sede || !desc) {
      showToast('Completa todos los campos obligatorios (*)', 'error');
      return;
    }

    // Datos de equipos según tipo
    let bodyExtra = {};
    if (type === 'requerimiento') {
      const validItems = modalItems.filter(i => i.equipment_name.trim());
      if (!validItems.length) {
        showToast('Agrega al menos un equipo al requerimiento', 'error');
        return;
      }
      bodyExtra = {
        items: validItems.map(i => ({
          equipment_name: i.equipment_name.trim(),
          quantity:       parseInt(i.quantity) || 1,
          serial:         i.serial.trim() || null,
        })),
      };
    } else {
      const equipo = document.getElementById('tr-f-equipo').value.trim();
      const serial = document.getElementById('tr-f-serial').value.trim();
      const qty    = parseInt(document.getElementById('tr-f-qty').value) || 1;
      bodyExtra = { equipment_name: equipo || null, equipment_serial: serial || null, quantity: qty };
    }

    const btn = document.getElementById('tr-modal-save');
    btn.textContent = 'Guardando…';
    btn.disabled    = true;

    try {
      const res = await fetch('/api/tech-requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, requester_name: name, cedula, cargo, sede, description: desc, priority: prio, ...bodyExtra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      showToast(`✅ Solicitud ${data.request_number} creada`, 'success');
      closeModal();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = `${iconSave(14)} Guardar Solicitud`;
      btn.disabled    = false;
    }
  });
}

/** Escapa atributos HTML dentro del modal */
function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ═══════════════════════════════════════════════════
   PAGINACIÓN
   ═══════════════════════════════════════════════════ */

function renderPagination(data) {
  if (data.total_pages <= 1) return '';
  const pages = [];
  for (let i = 1; i <= data.total_pages; i++) {
    pages.push(`<button class="tr-page-btn btn ${i === data.page ? 'btn-primary' : 'btn-secondary'}"
      data-page="${i}" style="min-width:36px;padding:6px 10px;">${i}</button>`);
  }
  return `<div style="display:flex;gap:8px;justify-content:center;padding:16px;">${pages.join('')}</div>`;
}

/* ─ Estilos de celda reutilizables ─ */
const TH = 'padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;';
const TD = 'padding:12px 14px;font-size:13px;vertical-align:middle;';

/* ═══════════════════════════════════════════════════
   MODAL EDITAR SOLICITUD
   ═══════════════════════════════════════════════════ */

async function openEditModal(id, onSuccess) {
  // Cargar datos existentes
  let record;
  try {
    const res = await fetch(`/api/tech-requests/${id}`);
    if (!res.ok) throw new Error('No se pudo cargar la solicitud.');
    record = await res.json();
  } catch (err) {
    const { showToast } = await import('./components.js');
    showToast(err.message, 'error');
    return;
  }

  // Reutilizar el mismo overlay del modal
  const overlay = document.getElementById('tr-modal-overlay');
  const modal   = document.getElementById('tr-modal');
  overlay.style.display = 'flex';

  const isReq = record.type === 'requerimiento';

  // Estado de ítems para requerimientos
  let modalItems = (record.items && record.items.length)
    ? record.items.map(i => ({ equipment_name: i.equipment_name, quantity: i.quantity, serial: i.serial || '' }))
    : [{ equipment_name: '', quantity: 1, serial: '' }];

  const areaOptions = Object.entries(
    (await import('./app.js').then(m => m.AREA_MAPPINGS))
  ).map(([v, { label }]) => `<option value="${v}">${label}</option>`).join('');

  modal.innerHTML = `
    <!-- Header con gradiente -->
    <div style="background:linear-gradient(135deg,rgba(245,158,11,.18),rgba(234,88,12,.12));margin:-32px -32px 24px;padding:24px 28px 20px;border-radius:16px 16px 0 0;border-bottom:1px solid rgba(245,158,11,.2);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;">${iconEdit(18)}</div>
            <h3 style="font-size:18px;font-weight:700;color:#e2e8f0;">Editar Solicitud</h3>
          </div>
          <p style="font-size:12px;color:#6b7a99;margin-left:46px;">${record.request_number} — modifica los datos y guarda los cambios</p>
        </div>
        <button id="tr-modal-close" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);width:32px;height:32px;border-radius:8px;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center;transition:all .2s;">${iconClose(14)}</button>
      </div>
    </div>

    <!-- Datos del solicitante -->
    <div class="tr-section">
      <div class="tr-section-title">Datos del solicitante</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Nombre completo *</label>
          <input type="text" id="tr-f-name" value="${_esc(record.requester_name)}" placeholder="Nombre y apellido">
        </div>
        <div class="form-group">
          <label>Cédula *</label>
          <input type="text" id="tr-f-cedula" value="${_esc(record.cedula)}" placeholder="Número de cédula">
        </div>
        <div class="form-group">
          <label>Cargo *</label>
          <input type="text" id="tr-f-cargo" value="${_esc(record.cargo)}" placeholder="Ej: Auxiliar contable">
        </div>
        <div class="form-group">
          <label>Sede / Punto *</label>
          <input type="text" id="tr-f-sede" value="${_esc(record.sede)}" placeholder="Ej: Sede Central…">
        </div>
      </div>
    </div>

    <!-- EQUIPOS SOLICITADOS (solo requerimientos) -->
    <div id="tr-f-items-section" class="tr-section" style="${!isReq ? 'display:none;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="tr-section-title" style="margin-bottom:0;">Equipos solicitados</div>
        <button type="button" id="tr-btn-add-item" style="display:inline-flex;align-items:center;gap:5px;">${iconPlus(12)} Agregar equipo</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 58px 1fr 30px 30px;gap:6px;padding:0 8px;margin-bottom:4px;">
        <span style="font-size:11px;color:#5a607a;">Nombre del equipo *</span>
        <span style="font-size:11px;color:#5a607a;text-align:center;">Cant.</span>
        <span style="font-size:11px;color:#5a607a;">Serial / Inv.</span>
        <span></span><span></span>
      </div>
      <div id="tr-f-items-list"></div>
    </div>

    <!-- EQUIPO AFECTADO (solo incidencias) -->
    <div id="tr-f-equipo-wrap" class="tr-section" style="${isReq ? 'display:none;' : ''}">
      <div class="tr-section-title">Equipo afectado</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Nombre / tipo de equipo</label>
          <input type="text" id="tr-f-equipo" value="${_esc(record.equipment_name || '')}" placeholder="Ej: Portátil Dell, Impresora…">
        </div>
        <div class="form-group">
          <label>Serial o inventario</label>
          <input type="text" id="tr-f-serial" value="${_esc(record.equipment_serial || '')}" placeholder="Opcional">
        </div>
      </div>
    </div>

    <!-- Descripción + prioridad -->
    <div class="tr-section">
      <div class="tr-section-title">Descripción y prioridad</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
        <div class="form-group">
          <label>Descripción *</label>
          <textarea id="tr-f-desc" rows="3" style="resize:vertical;">${_esc(record.description)}</textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="form-group">
            <label>Prioridad</label>
            <select id="tr-f-priority">
              <option value="baja"   ${record.priority==='baja'   ?'selected':''}>🟢 Baja</option>
              <option value="media"  ${record.priority==='media'  ?'selected':''}>🟡 Media</option>
              <option value="alta"   ${record.priority==='alta'   ?'selected':''}>🟠 Alta</option>
              <option value="critica"${record.priority==='critica'?'selected':''}>🔴 Crítica</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="tr-modal-footer">
      <button class="btn btn-secondary" id="tr-modal-cancel" style="padding:10px 20px;">Cancelar</button>
      <button class="btn btn-primary" id="tr-modal-save"
        style="padding:10px 24px;background:linear-gradient(135deg,#f59e0b,#ea580c);border:none;display:inline-flex;align-items:center;gap:7px;">
        ${iconSave(14)} Guardar Cambios
      </button>
    </div>
  `;

  /* ── Utilidades de formateo ── */
  const toTitleCase    = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const toSentenceCase = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };

  /* ── Renderizado de ítems ── */
  function renderModalItems() {
    const cont = document.getElementById('tr-f-items-list');
    if (!cont) return;
    cont.innerHTML = modalItems.map((item, idx) => `
      <div class="tr-item-row">
        <input type="text" class="tr-item-name" data-idx="${idx}"
          value="${_esc(item.equipment_name)}" placeholder="Ej: Portátil, Monitor…">
        <input type="number" class="tr-item-qty" data-idx="${idx}"
          value="${item.quantity}" min="1" style="text-align:center;">
        <input type="text" class="tr-item-serial" data-idx="${idx}"
          value="${_esc(item.serial)}" placeholder="Serial (opc.)">
        <button type="button" class="tr-item-dup" data-idx="${idx}"
          style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8;border-radius:6px;width:30px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;">${iconCopy(13)}</button>
        <button type="button" class="tr-item-remove" data-idx="${idx}"
          style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#f87171;border-radius:6px;width:30px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;${modalItems.length <= 1 ? 'opacity:.3;cursor:not-allowed;' : ''}"
          ${modalItems.length <= 1 ? 'disabled' : ''}>${iconClose(13)}</button>
      </div>
    `).join('');

    cont.querySelectorAll('.tr-item-name').forEach(inp => {
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].equipment_name = e.target.value; });
      inp.addEventListener('blur',  e => {
        e.target.value = toTitleCase(e.target.value.trim());
        modalItems[+e.target.dataset.idx].equipment_name = e.target.value;
      });
    });
    cont.querySelectorAll('.tr-item-qty').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].quantity = parseInt(e.target.value) || 1; })
    );
    cont.querySelectorAll('.tr-item-serial').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].serial = e.target.value; })
    );
    cont.querySelectorAll('.tr-item-dup').forEach(btn =>
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        modalItems.splice(idx + 1, 0, { equipment_name: modalItems[idx].equipment_name, quantity: 1, serial: '' });
        renderModalItems();
      })
    );
    cont.querySelectorAll('.tr-item-remove').forEach(btn =>
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        if (modalItems.length > 1) { modalItems.splice(idx, 1); renderModalItems(); }
      })
    );
  }

  renderModalItems();
  attachSedeSearch(document.getElementById('tr-f-sede'));

  document.getElementById('tr-btn-add-item')?.addEventListener('click', () => {
    modalItems.push({ equipment_name: '', quantity: 1, serial: '' });
    renderModalItems();
    document.querySelectorAll('#tr-f-items-list .tr-item-name').forEach((_, i, a) => { if (i === a.length - 1) a[i].focus(); });
  });

  /* ── Blur formateo ── */
  document.getElementById('tr-f-name').addEventListener('blur', e => { e.target.value = toTitleCase(e.target.value.trim()); });
  document.getElementById('tr-f-cargo').addEventListener('blur', e => { e.target.value = toTitleCase(e.target.value.trim()); });
  document.getElementById('tr-f-equipo')?.addEventListener('blur', e => { e.target.value = toTitleCase(e.target.value.trim()); });
  document.getElementById('tr-f-desc').addEventListener('blur', e => { e.target.value = toSentenceCase(e.target.value); });

  /* ── Cerrar ── */
  const closeModal = () => { overlay.style.display = 'none'; };
  document.getElementById('tr-modal-close').addEventListener('click', closeModal);
  document.getElementById('tr-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  /* ── Guardar cambios ── */
  document.getElementById('tr-modal-save').addEventListener('click', async () => {
    const name   = toTitleCase(document.getElementById('tr-f-name').value.trim());
    const cedula = document.getElementById('tr-f-cedula').value.trim();
    const cargo  = toTitleCase(document.getElementById('tr-f-cargo').value.trim());
    const sede   = document.getElementById('tr-f-sede').value.trim();
    const desc   = toSentenceCase(document.getElementById('tr-f-desc').value);
    const prio   = document.getElementById('tr-f-priority').value;

    if (!name || !cedula || !cargo || !sede || !desc) {
      showToast('Completa todos los campos obligatorios (*)', 'error');
      return;
    }

    let bodyExtra = {};
    if (isReq) {
      const validItems = modalItems.filter(i => i.equipment_name.trim());
      if (!validItems.length) { showToast('Agrega al menos un equipo al requerimiento', 'error'); return; }
      bodyExtra = { items: validItems.map(i => ({ equipment_name: i.equipment_name.trim(), quantity: parseInt(i.quantity) || 1, serial: i.serial.trim() || null })) };
    } else {
      bodyExtra = {
        equipment_name:   toTitleCase((document.getElementById('tr-f-equipo')?.value || '').trim()) || null,
        equipment_serial: document.getElementById('tr-f-serial')?.value.trim() || null,
      };
    }

    const btn = document.getElementById('tr-modal-save');
    btn.textContent = 'Guardando…'; btn.disabled = true;

    try {
      const res = await fetch(`/api/tech-requests/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requester_name: name, cedula, cargo, sede, description: desc, priority: prio, agentName: 'Agente', ...bodyExtra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      showToast('✅ Solicitud actualizada', 'success');
      closeModal();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = `${iconSave(14)} Guardar Cambios`; btn.disabled = false;
    }
  });
}

