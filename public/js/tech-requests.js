/**
 * Módulo de Requerimientos Tecnológicos e Incidencias.
 * Vista principal: lista filtrable con pestañas y modal de nueva solicitud.
 */

import { showToast } from './components.js';
import { state } from './app.js';
import { formatDate, formatTimeAgo } from './app.js';

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
        <h2 style="font-size:24px;font-weight:700;margin-bottom:4px;">📦 Requerimientos Tecnológicos</h2>
        <p style="color:var(--text-muted);font-size:14px;">Gestiona solicitudes de equipos e incidencias enviadas desde las sedes.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-request">＋ Nueva Solicitud</button>
    </div>

    <!-- Pestañas -->
    <div style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid var(--glass-border);">
      <button id="tab-req" class="tab-btn tab-active" data-tab="requerimiento">
        📋 Requerimientos
        <span class="tab-count" id="count-req">…</span>
      </button>
      <button id="tab-inc" class="tab-btn" data-tab="incidencia">
        🔧 Incidencias
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
          <button class="btn btn-secondary" id="tr-btn-filter">🔍 Filtrar</button>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div id="tr-table-container" style="margin-top:20px;"></div>

    <!-- Modal nuevo -->
    <div id="tr-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1000;align-items:center;justify-content:center;">
      <div id="tr-modal" style="background:#1e1e38;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;width:min(640px,95vw);max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.7);">
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

      /* Modal nueva solicitud — campos opacos */
      #tr-modal input[type="text"],
      #tr-modal input[type="number"],
      #tr-modal textarea,
      #tr-modal select {
        background: #0f0f22 !important;
        color: #e8e8f0 !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: 8px;
      }
      #tr-modal input[type="text"]:focus,
      #tr-modal input[type="number"]:focus,
      #tr-modal textarea:focus,
      #tr-modal select:focus {
        border-color: var(--primary) !important;
        outline: none;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
      }
      #tr-modal label { color: #c4c4d4; font-size: 13px; }
      #tr-modal h3 { color: #e8e8f0; }
      #tr-modal select option { background: #1e1e38; color: #e8e8f0; }
      #tr-modal #lbl-req,
      #tr-modal #lbl-inc {
        background: rgba(255,255,255,0.04);
        color: #e8e8f0;
      }
      #tr-modal #lbl-req:hover,
      #tr-modal #lbl-inc:hover {
        background: rgba(255,255,255,0.07);
      }
    `;
    document.head.appendChild(st);
  }

  /* ── Función de carga de tabla ── */
  async function loadTable() {
    const container2 = document.getElementById('tr-table-container');
    container2.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Cargando…</div>`;

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
            <div style="font-size:48px;margin-bottom:12px;">${activeTab === 'requerimiento' ? '📋' : '🔧'}</div>
            <p>No hay ${activeTab === 'requerimiento' ? 'requerimientos' : 'incidencias'} registradas.</p>
          </div>`;
        return;
      }

      const isInc = activeTab === 'incidencia';
      container2.innerHTML = `
        <div class="card" style="overflow:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--glass-border);">
                <th style="${TH}">N.º Solicitud</th>
                <th style="${TH}">Solicitante</th>
                <th style="${TH}">Cédula</th>
                <th style="${TH}">Cargo</th>
                <th style="${TH}">Sede</th>
                ${isInc ? `<th style="${TH}">Equipo</th>` : `<th style="${TH}">Cantidad</th>`}
                <th style="${TH}">Prioridad</th>
                <th style="${TH}">Estado</th>
                <th style="${TH}">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${data.requests.map(r => `
                <tr class="tr-row" data-id="${r.id}" style="border-bottom:1px solid rgba(255,255,255,.05);">
                  <td style="${TD} font-weight:600;color:var(--primary);">${r.request_number}</td>
                  <td style="${TD}">${r.requester_name}</td>
                  <td style="${TD} color:var(--text-muted);font-size:12px;">${r.cedula}</td>
                  <td style="${TD} font-size:13px;">${r.cargo}</td>
                  <td style="${TD}">${r.sede}</td>
                  ${isInc
                    ? `<td style="${TD} font-size:12px;">${r.equipment_name || '—'}</td>`
                    : `<td style="${TD} text-align:center;">${r.quantity}</td>`}
                  <td style="${TD}">${priorityBadge(r.priority)}</td>
                  <td style="${TD}">${statusBadge(r.status)}</td>
                  <td style="${TD} color:var(--text-muted);font-size:12px;" title="${formatDate(r.created_at)}">${formatTimeAgo(r.created_at)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${renderPagination(data)}
        </div>`;

      // Clicks en filas → detalle
      container2.querySelectorAll('.tr-row').forEach(row => {
        row.addEventListener('click', () => {
          window.location.hash = `#tech-request/${row.dataset.id}`;
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
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
      <h3 style="font-size:18px;font-weight:700;">Nueva Solicitud</h3>
      <button id="tr-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">✕</button>
    </div>

    <!-- Tipo -->
    <div class="form-group" style="margin-bottom:16px;">
      <label style="font-weight:600;">Tipo de solicitud *</label>
      <div style="display:flex;gap:12px;margin-top:8px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border:2px solid ${defaultType==='requerimiento'?'var(--primary)':'var(--glass-border)'};border-radius:8px;flex:1;" id="lbl-req">
          <input type="radio" name="tr-type" value="requerimiento" ${defaultType==='requerimiento'?'checked':''} style="accent-color:var(--primary);">
          📋 Requerimiento
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border:2px solid ${defaultType==='incidencia'?'var(--primary)':'var(--glass-border)'};border-radius:8px;flex:1;" id="lbl-inc">
          <input type="radio" name="tr-type" value="incidencia" ${defaultType==='incidencia'?'checked':''} style="accent-color:var(--primary);">
          🔧 Incidencia
        </label>
      </div>
    </div>

    <!-- Solicitante -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="form-group">
        <label>Nombre completo *</label>
        <input type="text" id="tr-f-name" placeholder="Nombre del solicitante">
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

    <!-- ── EQUIPOS SOLICITADOS (solo requerimientos) ── -->
    <div id="tr-f-items-section" style="margin-top:16px;${defaultType==='incidencia'?'display:none;':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <label style="font-weight:600;font-size:13px;">📦 Equipos solicitados *</label>
        <button type="button" id="tr-btn-add-item"
          style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.35);color:#818cf8;border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer;font-weight:600;">
          + Agregar equipo
        </button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 58px 1fr 30px;gap:6px;padding:0 2px;margin-bottom:6px;">
        <span style="font-size:11px;color:var(--text-muted);">Nombre del equipo *</span>
        <span style="font-size:11px;color:var(--text-muted);text-align:center;">Cant.</span>
        <span style="font-size:11px;color:var(--text-muted);">Serial / Inv. (opc.)</span>
        <span></span>
      </div>
      <div id="tr-f-items-list"></div>
    </div>

    <!-- ── EQUIPO AFECTADO (solo incidencias) ── -->
    <div id="tr-f-equipo-wrap" style="margin-top:16px;${defaultType==='requerimiento'?'display:none;':''}">
      <div class="form-group">
        <label>Equipo afectado <span style="color:var(--text-muted);font-size:12px;">(para incidencias)</span></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px;">
          <input type="text" id="tr-f-equipo" placeholder="Nombre / tipo de equipo">
          <input type="text" id="tr-f-serial" placeholder="Serial o inventario (opcional)">
        </div>
      </div>
    </div>

    <!-- Descripción + controles -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-top:16px;">
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
            <option value="baja">Baja</option>
            <option value="media" selected>Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;">
      <button class="btn btn-secondary" id="tr-modal-cancel">Cancelar</button>
      <button class="btn btn-primary" id="tr-modal-save">💾 Guardar Solicitud</button>
    </div>
  `;

  /* ── Renderizado reactivo de la lista de ítems ── */
  function renderModalItems() {
    const cont = document.getElementById('tr-f-items-list');
    if (!cont) return;

    cont.innerHTML = modalItems.map((item, idx) => `
      <div style="display:grid;grid-template-columns:2fr 58px 1fr 30px;gap:6px;margin-bottom:8px;align-items:center;">
        <input type="text" class="tr-item-name" data-idx="${idx}"
          value="${_esc(item.equipment_name)}"
          placeholder="Ej: Portátil, Monitor, Teclado…">
        <input type="number" class="tr-item-qty" data-idx="${idx}"
          value="${item.quantity}" min="1" style="text-align:center;">
        <input type="text" class="tr-item-serial" data-idx="${idx}"
          value="${_esc(item.serial)}"
          placeholder="Serial (opc.)">
        <button type="button" class="tr-item-remove" data-idx="${idx}"
          title="Quitar equipo"
          style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:6px;width:30px;height:36px;cursor:pointer;font-size:15px;line-height:1;${modalItems.length <= 1 ? 'opacity:.3;cursor:not-allowed;' : ''}"
          ${modalItems.length <= 1 ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');

    cont.querySelectorAll('.tr-item-name').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].equipment_name = e.target.value; })
    );
    cont.querySelectorAll('.tr-item-qty').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].quantity = parseInt(e.target.value) || 1; })
    );
    cont.querySelectorAll('.tr-item-serial').forEach(inp =>
      inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].serial = e.target.value; })
    );
    cont.querySelectorAll('.tr-item-remove').forEach(btn =>
      btn.addEventListener('click', e => {
        const idx = +e.currentTarget.dataset.idx;
        if (modalItems.length > 1) { modalItems.splice(idx, 1); renderModalItems(); }
      })
    );
  }

  renderModalItems();

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
      document.getElementById('lbl-req').style.borderColor         = isReq  ? 'var(--primary)' : 'var(--glass-border)';
      document.getElementById('lbl-inc').style.borderColor         = !isReq ? 'var(--primary)' : 'var(--glass-border)';
      document.getElementById('tr-f-items-section').style.display  = isReq  ? 'block' : 'none';
      document.getElementById('tr-f-equipo-wrap').style.display    = isReq  ? 'none'  : 'block';
      document.getElementById('tr-f-qty-wrap').style.display       = isReq  ? 'none'  : 'block';
    });
  });

  const closeModal = () => { overlay.style.display = 'none'; };
  document.getElementById('tr-modal-close').addEventListener('click', closeModal);
  document.getElementById('tr-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  document.getElementById('tr-modal-save').addEventListener('click', async () => {
    const type   = modal.querySelector('input[name="tr-type"]:checked')?.value;
    const name   = document.getElementById('tr-f-name').value.trim();
    const cedula = document.getElementById('tr-f-cedula').value.trim();
    const cargo  = document.getElementById('tr-f-cargo').value.trim();
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
      btn.textContent = '💾 Guardar Solicitud';
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
