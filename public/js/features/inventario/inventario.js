/**
 * Módulo de Inventario TI
 * Vista principal: tablas paginadas para equipos, celulares y UPS.
 * Delegados de modales:
 *  - Formulario / edición / enlaces -> inventario-forms.js
 *  - Lógica de escaneo/cámara/OCR -> inventario-scanner.js
 *  - Asistente de importación -> inventario-import.js
 */

import { showToast } from '../../ui/components.js';
import { iconPlus, iconUpload, iconMonitor, iconSmartphone, iconCheck, iconZap, iconQrCode,
         iconCpu, iconTv, iconTablet, iconScan, iconMouse, iconPrinter,
         iconChevronLeft, iconClose, iconMenu } from '../../utils/icons.js';
import { openForm, openGenerarEnlaceModal } from './inventario-forms.js';
import { openImportModal } from './inventario-import.js';

/* Each tab: { id, label, apiTab, categoria, icon } */
const TABS = [
  { id:'computadores', label:'Computadores', apiTab:'equipos', categoria:'computadores', icon: s => iconCpu(s)        },
  { id:'impresoras',   label:'Impresoras',   apiTab:'equipos', categoria:'impresoras',   icon: s => iconPrinter(s)    },
  { id:'escaner',      label:'Escáneres',    apiTab:'equipos', categoria:'escaner',      icon: s => iconScan(s)       },
  { id:'televisores',  label:'Televisores',  apiTab:'equipos', categoria:'televisores',  icon: s => iconTv(s)         },
  { id:'monitores',    label:'Monitores',    apiTab:'equipos', categoria:'monitores',    icon: s => iconMonitor(s)    },
  { id:'tablets',      label:'Tablets',      apiTab:'equipos', categoria:'tablets',      icon: s => iconTablet(s)     },
  { id:'perifericos',  label:'Periféricos',  apiTab:'equipos', categoria:'perifericos',  icon: s => iconMouse(s)      },
  { id:'celulares',    label:'Celulares',    apiTab:'celulares', categoria:'',           icon: s => iconSmartphone(s) },
  { id:'ups',          label:'UPS',          apiTab:'ups',     categoria:'',             icon: s => iconZap(s)        },
];

let _activeTabId      = 'computadores';
let _page             = 1;
const _limit          = 20;
let _search           = '';
let _filterArea       = '';
let _sidebarCollapsed = false;
let _drawerOpen       = false;

function activeTab() { return TABS.find(t => t.id === _activeTabId); }

function _toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const sidebar = document.getElementById('inv-sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed', _sidebarCollapsed);
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function renderInventario(container) {
  _page = 1; _search = ''; _filterArea = '';
  container.innerHTML = `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Inventario TI</h2>
        <p style="color:var(--text-muted);font-size:14px;">Gestión de equipos, celulares y dispositivos.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button id="btn-inv-hamburger" class="inv-hamburger">
          ${iconMenu(16)} Categorías
        </button>
        <button id="btn-inv-enlace"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          ${iconQrCode(14)} Generar enlace
        </button>
        <button id="btn-inv-import"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          ${iconUpload(14)} Importar Excel
        </button>
        <button id="btn-inv-new"
          style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;">
          ${iconPlus(14)} Registrar equipo
        </button>
      </div>
    </div>

    <div class="inv-layout">
      <div class="inv-sidebar${_sidebarCollapsed ? ' collapsed' : ''}" id="inv-sidebar">
        <button class="inv-sidebar-toggle" id="inv-sidebar-toggle" title="Colapsar menú">
          <span class="inv-sidebar-toggle-icon">${iconChevronLeft(14)}</span>
        </button>
        <nav class="inv-sidebar-nav">
          ${TABS.map(t => `
            <button class="inv-cat-btn${t.id === _activeTabId ? ' active' : ''}" data-tabid="${t.id}">
              <span class="inv-cat-icon">${t.icon(15)}</span>
              <span class="inv-cat-label">${t.label}</span>
              <span class="inv-cat-count" id="count-${t.id}">…</span>
            </button>`).join('')}
        </nav>
      </div>

      <div class="inv-content">
        <div class="inv-filter-bar">
          <div class="inv-search-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" id="inv-search" placeholder="Buscar placa, serial, nombre, área…" value="">
          </div>
          <div class="inv-filter-sep"></div>
          <input type="text" id="inv-area" class="inv-area-input" placeholder="Área">
          <button id="btn-inv-clear" class="inv-clear-btn" title="Limpiar filtros">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="inv-table-wrap" style="margin-top:0;"></div>
        <div id="inv-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px;"></div>
        <div id="inv-modal-wrap"></div>
      </div>
    </div>

    <!-- Mobile drawer -->
    <div class="inv-drawer-overlay" id="inv-drawer-overlay">
      <div class="inv-drawer">
        <div class="inv-drawer-header">
          <span>Categorías</span>
          <button class="inv-drawer-close" id="inv-drawer-close">${iconClose(16)}</button>
        </div>
        <nav class="inv-drawer-nav">
          ${TABS.map(t => `
            <button class="inv-cat-btn${t.id === _activeTabId ? ' active' : ''}" data-tabid="${t.id}" data-drawer="true">
              <span class="inv-cat-icon">${t.icon(15)}</span>
              <span class="inv-cat-label">${t.label}</span>
              <span class="inv-cat-count" id="drawer-count-${t.id}">…</span>
            </button>`).join('')}
        </nav>
      </div>
    </div>
  `;

  document.querySelectorAll('.tab-btn[data-tabid]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      _activeTabId = btn.dataset.tabid;
      _page = 1;
      loadTable();
    });
  });

  const updateClearBtn = () => {
    const active = _search || _filterArea;
    document.getElementById('btn-inv-clear').classList.toggle('visible', !!active);
  };

  let debounce;
  document.getElementById('inv-search').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _search = e.target.value.trim(); _page = 1; updateClearBtn(); loadTable(); }, 300);
  });
  document.getElementById('inv-area').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _filterArea = e.target.value.trim(); _page = 1; updateClearBtn(); loadTable(); }, 300);
  });
  document.getElementById('btn-inv-clear').addEventListener('click', () => {
    _search = ''; _filterArea = ''; _page = 1;
    document.getElementById('inv-search').value = '';
    document.getElementById('inv-area').value   = '';
    updateClearBtn();
    loadTable();
  });

  document.getElementById('btn-inv-new').addEventListener('click', () => {
    const t = activeTab();
    openForm(null, t.apiTab, () => { loadTable(); loadCounts(); }, false, t.categoria);
  });
  document.getElementById('btn-inv-import').addEventListener('click', () => openImportModal(activeTab().apiTab, () => { loadTable(); loadCounts(); }));
  document.getElementById('btn-inv-enlace').addEventListener('click', () => openGenerarEnlaceModal());

  document.getElementById('inv-sidebar-toggle').addEventListener('click', _toggleSidebar);

  loadTable();
  loadCounts();
}

async function loadTable() {
  const wrap = document.getElementById('inv-table-wrap');
  wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>';

  const tab = activeTab();
  const params = new URLSearchParams({ page: _page, limit: _limit });
  if (_search)      params.set('search', _search);
  if (_filterArea)  params.set('area',   _filterArea);
  if (tab.categoria) params.set('categoria', tab.categoria);

  try {
    const res  = await fetch(`/api/inventario/${tab.apiTab}?${params}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();

    const rows = tab.apiTab === 'equipos' ? data.equipos : tab.apiTab === 'celulares' ? data.celulares : data.ups;

    if (!rows.length) {
      wrap.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);">Sin registros.</div>';
      document.getElementById('inv-pagination').innerHTML = '';
      return;
    }

    wrap.innerHTML = tab.apiTab === 'celulares' ? renderCelularesTable(rows)
                   : tab.apiTab === 'ups'       ? renderUpsTable(rows)
                   : renderEquiposTable(rows);

    wrap.querySelectorAll('.btn-inv-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openForm(JSON.parse(decodeURIComponent(btn.dataset.row)), tab.apiTab, () => { loadTable(); loadCounts(); }); });
    });
    wrap.querySelectorAll('.btn-inv-del').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); confirmDelete(btn.dataset.id, btn.dataset.label); });
    });
    wrap.querySelectorAll('.btn-inv-dup').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const clone = JSON.parse(decodeURIComponent(btn.dataset.row));
        delete clone.id; delete clone.qr_token;
        if (tab.apiTab === 'celulares') { clone.imei = ''; clone.imei2 = ''; }
        else { clone.placa = ''; clone.serial = ''; }
        openForm(clone, tab.apiTab, () => { loadTable(); loadCounts(); }, true);
      });
    });
    wrap.querySelectorAll('.btn-inv-qr').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openEtiquetaModal(btn.dataset.token); });
    });
    wrap.querySelectorAll('tr[data-token]').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => openDetalleModal(tr.dataset.token));
    });

    renderPagination(data.total, data.total_pages);
  } catch (err) {
    wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">Error: ${err.message}</div>`;
  }
}

const _ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const _ICON_DEL  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const _ICON_DUP  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

function renderEquiposTable(rows) {
  return `
  <div class="inv-table-card">
    <div class="inv-table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>Placa</th>
          <th>Equipo</th>
          <th>Serial</th>
          <th>Procesador</th>
          <th>RAM</th>
          <th>Disco</th>
          <th>Área</th>
          <th>Responsable</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr ${r.qr_token ? `data-token="${r.qr_token}"` : ''} style="transition:background .12s;">
            <td class="td-mono">${esc(r.placa)}</td>
            <td>
              <div class="td-primary">${esc(r.marca)}</div>
              <div class="td-sub">${esc(r.nombre_equipo)}</div>
            </td>
            <td class="td-mono">${esc(r.serial)}</td>
            <td style="font-size:12px;">${esc(r.procesador||'—')}</td>
            <td style="font-size:12px;">
              ${r.ram
                ? `${esc(r.ram)}<span style="color:var(--text-3);margin-left:3px;">${esc(r.tipo_ram||'')}</span>`
                : '<span style="color:var(--text-3)">—</span>'}
            </td>
            <td style="font-size:12px;">
              ${r.cap_disco
                ? `${esc(r.cap_disco)}<span style="color:var(--text-3);margin-left:3px;">${esc(r.tipo_disco||'')}</span>`
                : '<span style="color:var(--text-3)">—</span>'}
            </td>
            <td style="font-size:12px;">${esc(r.area||'—')}</td>
            <td style="font-size:12px;">${esc(r.responsable||'—')}</td>
            <td class="td-actions">
              ${r.qr_token ? `<button class="tbl-btn btn-inv-qr" data-token="${r.qr_token}" title="Imprimir etiqueta QR">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              </button>` : ''}
              <button class="tbl-btn btn-inv-dup" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Duplicar">${_ICON_DUP}</button>
              <button class="tbl-btn btn-inv-edit" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Editar">${_ICON_EDIT}</button>
              <button class="tbl-btn tbl-btn--del btn-inv-del" data-id="${r.id}" data-label="${esc(r.placa)} — ${esc(r.marca)}" title="Eliminar">${_ICON_DEL}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderCelularesTable(rows) {
  return `
  <div class="inv-table-card">
    <div class="inv-table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>IMEI</th>
          <th>Dispositivo</th>
          <th>Asignado a</th>
          <th>Área</th>
          <th>Ciudad</th>
          <th>Estado</th>
          <th>Operador</th>
          <th>F. Entrega</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr ${r.qr_token ? `data-token="${r.qr_token}"` : ''} style="transition:background .12s;">
            <td class="td-mono">${esc(r.imei)}</td>
            <td>
              <div class="td-primary">${esc(r.modelo||r.equipo||'—')}</div>
              <div class="td-sub">${[r.almacenamiento, r.ram].filter(Boolean).map(esc).join(' · ') || ''}</div>
            </td>
            <td>
              <div style="font-size:13px;">${esc(r.nombre_completo||'—')}</div>
              ${r.cedula ? `<div class="td-sub">${esc(r.cedula)}</div>` : ''}
            </td>
            <td style="font-size:12px;">${esc(r.area||'—')}</td>
            <td style="font-size:12px;">${esc(r.ciudad||'—')}</td>
            <td><span class="badge badge-${esc(r.estado||'nuevo')}">${esc(r.estado||'nuevo')}</span></td>
            <td style="font-size:12px;">${esc(r.operador||'—')}</td>
            <td style="font-size:12px;">${esc(r.fecha_entrega||'—')}</td>
            <td class="td-actions">
              ${r.qr_token ? `<button class="tbl-btn btn-inv-qr" data-token="${r.qr_token}" title="Imprimir etiqueta QR">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              </button>` : ''}
              <button class="tbl-btn btn-inv-dup" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Duplicar">${_ICON_DUP}</button>
              <button class="tbl-btn btn-inv-edit" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Editar">${_ICON_EDIT}</button>
              <button class="tbl-btn tbl-btn--del btn-inv-del" data-id="${r.id}" data-label="${esc(r.imei)} — ${esc(r.modelo||r.equipo||'')}" title="Eliminar">${_ICON_DEL}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderUpsTable(rows) {
  return `
  <div class="inv-table-card">
    <div class="inv-table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>Placa</th>
          <th>Dispositivo</th>
          <th>Serial</th>
          <th>Área</th>
          <th>Voltaje</th>
          <th>F. Compra</th>
          <th>F. Despacho</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr ${r.qr_token ? `data-token="${r.qr_token}"` : ''} style="transition:background .12s;">
            <td class="td-mono">${esc(r.placa)}</td>
            <td>
              <div class="td-primary">${esc(r.marca||'—')}</div>
              <div class="td-sub">${esc(r.nombre_equipo||'')}</div>
            </td>
            <td class="td-mono">${esc(r.serial||'—')}</td>
            <td style="font-size:12px;">${esc(r.area||'—')}</td>
            <td style="font-size:12px;">${esc(r.voltaje||'—')}</td>
            <td style="font-size:12px;">${esc(r.fecha_compra||'—')}</td>
            <td style="font-size:12px;">${esc(r.fecha_despacho||'—')}</td>
            <td class="td-actions">
              ${r.qr_token ? `<button class="tbl-btn btn-inv-qr" data-token="${r.qr_token}" title="Imprimir etiqueta QR">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
              </button>` : ''}
              <button class="tbl-btn btn-inv-dup" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Duplicar">${_ICON_DUP}</button>
              <button class="tbl-btn btn-inv-edit" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Editar">${_ICON_EDIT}</button>
              <button class="tbl-btn tbl-btn--del btn-inv-del" data-id="${r.id}" data-label="${esc(r.placa)} — ${esc(r.marca||'')}" title="Eliminar">${_ICON_DEL}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderPagination(total, totalPages) {
  const pg = document.getElementById('inv-pagination');
  if (totalPages <= 1) { pg.innerHTML = ''; return; }
  let html = `<button class="btn btn-small btn-secondary" id="pg-prev" ${_page===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - _page) <= 1)
      html += `<button class="btn btn-small ${i===_page?'btn-primary':'btn-secondary'}" data-p="${i}">${i}</button>`;
    else if (Math.abs(i - _page) === 2)
      html += `<span style="padding:0 4px;color:var(--text-muted);">…</span>`;
  }
  html += `<button class="btn btn-small btn-secondary" id="pg-next" ${_page===totalPages?'disabled':''}>›</button>`;
  pg.innerHTML = html;
  pg.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { _page = parseInt(b.dataset.p); loadTable(); }));
  pg.querySelector('#pg-prev')?.addEventListener('click', () => { _page--; loadTable(); });
  pg.querySelector('#pg-next')?.addEventListener('click', () => { _page++; loadTable(); });
}

async function loadCounts() {
  for (const t of TABS) {
    try {
      const params = `page=1&limit=1${t.categoria ? `&categoria=${t.categoria}` : ''}`;
      const r = await fetch(`/api/inventario/${t.apiTab}?${params}`);
      const d = await r.json();
      const el = document.getElementById(`count-${t.id}`);
      if (el) el.textContent = d.total ?? '';
    } catch {}
  }
}

async function openDetalleModal(token) {
  const existing = document.getElementById('inv-detalle-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'inv-detalle-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;width:100%;max-width:480px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;">
      <div style="padding:30px;text-align:center;color:var(--text-3);">Cargando…</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const res  = await fetch(`/api/inventario/activo/${token}`);
    if (!res.ok) throw new Error('No encontrado');
    const d = await res.json();
    const { _meta } = d;

    // Build field sections per type
    const row = (label, val) => val ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="font-size:12px;color:var(--text-3);font-weight:500;">${label}</span><span style="font-size:13px;font-weight:600;color:var(--text);text-align:right;max-width:60%;word-break:break-word;">${esc(val)}</span></div>` : '';
    const sec = (title, rows) => { const c = rows.filter(Boolean).join(''); return c ? `<div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;padding:12px 0 4px;margin-top:4px;">${title}</div>${c}` : ''; };

    let fields = '';
    if (_meta.tabla === 'inventario_equipos') {
      fields =
        sec('Identificación', [row('Placa', d.placa), row('Serial', d.serial), row('Serial cargador', d.serial_cargador)]) +
        sec('Equipo', [row('Nombre', d.nombre_equipo), row('Marca', d.marca), row('Procesador', d.procesador),
          row('RAM', d.ram ? `${d.ram}${d.tipo_ram ? ' ' + d.tipo_ram : ''}` : null),
          row('Disco', d.cap_disco ? `${d.cap_disco}${d.tipo_disco ? ' ' + d.tipo_disco : ''}` : null),
          row('Fecha compra', d.fecha_compra)]) +
        sec('Asignación', [row('Área', d.area), row('Responsable', d.responsable)]);
    } else if (_meta.tabla === 'inventario_celulares') {
      fields =
        sec('Identificación', [row('IMEI', d.imei), row('IMEI 2', d.imei2), row('Línea', d.linea), row('Operador', d.operador)]) +
        sec('Equipo', [row('Modelo', d.modelo), row('Equipo', d.equipo), row('Almacenamiento', d.almacenamiento),
          row('RAM', d.ram), row('Accesorio', d.accesorio), row('Estado', d.estado)]) +
        sec('Asignación', [row('Usuario', d.nombre_completo), row('Cédula', d.cedula),
          row('Área', d.area), row('Ciudad', d.ciudad), row('Entregado por', d.entregado_por), row('Fecha entrega', d.fecha_entrega)]);
    } else {
      fields =
        sec('Identificación', [row('Placa', d.placa), row('Serial', d.serial)]) +
        sec('Equipo', [row('Nombre', d.nombre_equipo), row('Marca', d.marca), row('Voltaje', d.voltaje),
          row('Fecha compra', d.fecha_compra), row('Fecha despacho', d.fecha_despacho)]) +
        sec('Asignación', [row('Área', d.area)]);
    }

    overlay.querySelector('div').innerHTML = `
      <div style="background:var(--primary);padding:18px 20px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;">${esc(_meta.tipo)}</div>
          <div style="font-size:17px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:1px;">${esc(d[_meta.idField] || '—')}</div>
        </div>
        <button id="det-close" style="background:rgba(255,255,255,.2);border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <div style="display:flex;gap:0;max-height:65vh;overflow:hidden;">
        <!-- Campos -->
        <div style="flex:1;padding:0 20px 20px;overflow-y:auto;">${fields}</div>

        <!-- QR -->
        <div style="flex-shrink:0;width:140px;border-left:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:8px;">
          <img src="/activo/${token}/qr" style="width:100px;height:100px;" alt="QR">
          <div style="font-size:10px;color:var(--text-3);text-align:center;line-height:1.4;">Escanea para ver ficha</div>
          <button id="det-print-qr" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:11px;cursor:pointer;width:100%;">🖨️ Etiqueta</button>
        </div>
      </div>`;

    overlay.querySelector('#det-close').onclick = () => overlay.remove();
    overlay.querySelector('#det-print-qr').onclick = () => { overlay.remove(); openEtiquetaModal(token); };
  } catch (e) {
    overlay.querySelector('div').innerHTML = `<div style="padding:30px;text-align:center;color:var(--danger);">${e.message}</div>`;
  }
}

function openEtiquetaModal(token) {
  const existing = document.getElementById('inv-etiqueta-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'inv-etiqueta-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:24px;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--text);">Etiqueta de activo fijo</h3>
        <button id="etq-close" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;min-height:130px;">
        <iframe id="etq-frame" src="/activo/${token}/etiqueta?preview=1"
          style="width:200px;height:100px;border:none;transform-origin:top left;"
          scrolling="no"></iframe>
      </div>
      <p style="font-size:11px;color:var(--text-3);text-align:center;margin-bottom:14px;">Etiqueta 50×25mm · se imprimirá en tamaño real</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="etq-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">Cancelar</button>
        <button id="etq-print" style="padding:8px 18px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#etq-close').onclick  = close;
  overlay.querySelector('#etq-cancel').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#etq-print').onclick = () => {
    const frame = overlay.querySelector('#etq-frame');
    frame.contentWindow.print();
  };
}

async function confirmDelete(id, label) {
  if (!confirm(`¿Eliminar "${label}"?`)) return;
  try {
    const res = await fetch(`/api/inventario/${_activeTab}/${id}`, { method: 'DELETE' });
    const d   = await res.json();
    if (!res.ok) throw new Error(d.error);
    showToast('Registro eliminado.', 'success');
    loadTable();
    loadCounts();
  } catch (err) {
    showToast(err.message || 'Error al eliminar.', 'error');
  }
}
