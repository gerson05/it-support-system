/**
 * tech-requests.js â€” Entry point (slim orchestrator)
 *
 * Only exports: renderTechRequests(container)
 * Form modals are now in:
 *  - tech-request-form.js â†’ openModal, openEditModal
 */
import { showToast } from '../../ui/components.js';
import { formatDate, formatTimeAgo } from '../../core/app.js';
import {
  iconSearch, iconPlus, iconEdit, iconClipboard, iconWrench, iconTrash,
} from '../../utils/icons.js';
import { openModal, openEditModal } from './tech-request-form.js';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONSTANTES DE DOMINIO
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

const TH = 'padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;';
const TD = 'padding:10px 12px;font-size:13px;';

function renderPagination(data) {
  if (!data || data.total_pages <= 1) return '';
  const pages = [];
  for (let i = 1; i <= data.total_pages; i++) {
    const active = i === data.page;
    pages.push(`<button class="tr-page-btn" data-page="${i}"
      style="padding:4px 10px;font-size:12px;border:1px solid ${active ? 'var(--primary)' : 'var(--border)'};
             border-radius:6px;background:${active ? 'var(--primary)' : 'var(--surface)'};
             color:${active ? '#fff' : 'var(--text-2)'};cursor:pointer;">${i}</button>`);
  }
  return `<div style="display:flex;gap:6px;justify-content:center;padding:16px 0;">${pages.join('')}</div>`;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER PRINCIPAL
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

  /* â”€â”€ Injectar estilos de pestaÃ±a â”€â”€ */
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

      /* â”€â”€ Modal nueva solicitud â”€â”€ */
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

      /* SecciÃ³n con lÃ­nea divisora */
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

      /* Fila de Ã­tem de equipo */
      .tr-item-row {
        display:grid; grid-template-columns:2fr 58px 1fr 30px 30px;
        gap:6px; margin-bottom:8px; align-items:center;
        background:rgba(255,255,255,.03); padding:6px 8px;
        border-radius:8px; border:1px solid rgba(255,255,255,.06);
        transition: border-color .2s;
      }
      .tr-item-row:hover { border-color:rgba(99,102,241,.25); }

      /* BotÃ³n add item */
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

  /* â”€â”€ FunciÃ³n de carga de tabla â”€â”€ */
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

      // Actualizar contadores de pestaÃ±a
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
                      ? `<td style=”${TD} font-size:12px;”>${r.equipment_name || '—'}</td>`
                      : `<td style="${TD} text-align:center;">${r.quantity}</td>`}
                    <td style="${TD}">${statusBadge(r.status)}</td>
                    <td style="${TD} color:var(--text-muted);font-size:12px;" title="${formatDate(r.created_at)}">${formatTimeAgo(r.created_at)}</td>
                    <td style="${TD} text-align:right;white-space:nowrap;min-width:130px;">
                      <button class="btn-tr-edit" data-id="${r.id}"
                        style="padding:4px 10px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;gap:5px;"
                        title="Editar solicitud"
                        onclick="event.stopPropagation();">${iconEdit(11)} Editar</button>
                      <button class="btn-tr-delete" data-id="${r.id}" data-ref="${r.request_number}"
                        style="padding:4px 10px;font-size:11px;border:1px solid rgba(239,68,68,.35);border-radius:6px;background:rgba(239,68,68,.1);color:var(--danger);cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-left:4px;"
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
                  <button class="btn-tr-delete" data-id="${r.id}" data-ref="${r.request_number}" onclick="event.stopPropagation();" style="display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(239,68,68,.35);border-radius:6px;background:rgba(239,68,68,.1);color:var(--danger);padding:4px 10px;font-size:11px;cursor:pointer;">${iconTrash(11)}</button>
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

      // Clicks en filas â†’ detalle
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

      // PaginaciÃ³n
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

  /* â”€â”€ PestaÃ±as â”€â”€ */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      activeTab   = btn.dataset.tab;
      currentPage = 1;
      loadTable();
    });
  });

  /* â”€â”€ Filtros â”€â”€ */
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

  /* â”€â”€ Enter en campos de filtro â”€â”€ */
  ['tr-search','tr-sede'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('tr-btn-filter').click();
    });
  });

  /* â”€â”€ BotÃ³n Nueva Solicitud â”€â”€ */
  /* BotÃ³n Ver Registros: abre Google Sheet si estÃ¡ configurado, si no la pÃ¡gina interna */
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

  /* â”€â”€ Carga inicial â”€â”€ */
  loadTable();
  // Precargar contador de la otra pestaÃ±a
  fetch('/api/tech-requests?type=incidencia&limit=1')
    .then(r => r.json()).then(d => { document.getElementById('count-inc').textContent = d.total ?? 0; });
  fetch('/api/tech-requests?type=requerimiento&limit=1')
    .then(r => r.json()).then(d => { document.getElementById('count-req').textContent = d.total ?? 0; });
}

