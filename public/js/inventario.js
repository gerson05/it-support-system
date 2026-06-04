import { showToast } from './components.js';

const toTitleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

let _activeTab  = 'equipos';
let _page       = 1;
const _limit    = 20;
let _search     = '';
let _filterArea = '';

export function renderInventario(container) {
  _page = 1; _search = ''; _filterArea = '';
  container.innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Inventario TI</h2>
        <p style="color:var(--text-muted);font-size:14px;">Gestión de equipos, celulares y dispositivos.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button id="btn-inv-enlace"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          📲 Generar enlace
        </button>
        <button id="btn-inv-import"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          ⬆ Importar Excel
        </button>
        <button id="btn-inv-new"
          style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;">
          ＋ Registrar equipo
        </button>
      </div>
    </div>

    <div style="display:flex;gap:0;border-bottom:2px solid var(--glass-border);margin-bottom:0;">
      <button id="tab-equipos" class="tab-btn tab-active" data-tab="equipos">
        🖥 Equipos <span class="tab-count" id="count-equipos">…</span>
      </button>
      <button id="tab-celulares" class="tab-btn" data-tab="celulares">
        📱 Celulares <span class="tab-count" id="count-celulares">…</span>
      </button>
    </div>

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

    <div id="inv-table-wrap" style="margin-top:16px;"></div>
    <div id="inv-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px;"></div>
    <div id="inv-modal-wrap"></div>
  `;

  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      _activeTab = btn.dataset.tab;
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

  document.getElementById('btn-inv-new').addEventListener('click', () => openForm(null));
  document.getElementById('btn-inv-import').addEventListener('click', () => openImportModal());
  document.getElementById('btn-inv-enlace').addEventListener('click', () => openGenerarEnlaceModal());

  loadTable();
  loadCounts();
}

async function loadTable() {
  const wrap = document.getElementById('inv-table-wrap');
  wrap.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>';

  const params = new URLSearchParams({ page: _page, limit: _limit });
  if (_search)     params.set('search', _search);
  if (_filterArea) params.set('area',   _filterArea);

  try {
    const res  = await fetch(`/api/inventario/${_activeTab}?${params}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();

    const rows  = _activeTab === 'equipos' ? data.equipos : data.celulares;

    if (!rows.length) {
      wrap.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-muted);">Sin registros.</div>';
      document.getElementById('inv-pagination').innerHTML = '';
      return;
    }

    wrap.innerHTML = _activeTab === 'equipos' ? renderEquiposTable(rows) : renderCelularesTable(rows);

    wrap.querySelectorAll('.btn-inv-edit').forEach(btn => {
      btn.addEventListener('click', () => openForm(JSON.parse(decodeURIComponent(btn.dataset.row))));
    });
    wrap.querySelectorAll('.btn-inv-del').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.label));
    });

    renderPagination(data.total, data.total_pages);
  } catch (err) {
    wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">Error: ${err.message}</div>`;
  }
}

const _ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const _ICON_DEL  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

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
          ${rows.map(r => `<tr>
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
          ${rows.map(r => `<tr>
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
              <button class="tbl-btn btn-inv-edit" data-row="${encodeURIComponent(JSON.stringify(r))}" title="Editar">${_ICON_EDIT}</button>
              <button class="tbl-btn tbl-btn--del btn-inv-del" data-id="${r.id}" data-label="${esc(r.imei)} — ${esc(r.modelo||r.equipo||'')}" title="Eliminar">${_ICON_DEL}</button>
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
  for (const tab of ['equipos', 'celulares']) {
    try {
      const r = await fetch(`/api/inventario/${tab}?page=1&limit=1`);
      const d = await r.json();
      const el = document.getElementById(`count-${tab}`);
      if (el) el.textContent = d.total ?? '';
    } catch {}
  }
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

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Form modal ── */
function openForm(row) {
  const isEdit    = !!row;
  const isEquipo  = _activeTab === 'equipos';
  const modalWrap = document.getElementById('inv-modal-wrap');

  modalWrap.innerHTML = isEquipo ? equipoFormHTML(row) : celularFormHTML(row);

  const overlay = modalWrap.querySelector('.modal-overlay');
  const form    = modalWrap.querySelector('#inv-form');
  const errEl   = modalWrap.querySelector('#inv-form-err');

  const close = () => { overlay.style.display = 'none'; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalWrap.querySelector('#btn-inv-form-cancel').addEventListener('click', close);

  form.querySelectorAll('input[type=text]').forEach(inp => {
    inp.addEventListener('blur', e => {
      const skip = ['placa','serial','imei','imei2','serial_cargador'];
      if (!skip.includes(e.target.name)) e.target.value = toTitleCase(e.target.value.trim());
    });
  });

  form.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', () => openScanner(btn.dataset.target));
  });
  document.getElementById('btn-smart-scan')?.addEventListener('click', () => openSmartScanner());

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.style.display = 'none';
    const data = Object.fromEntries(new FormData(form));
    const url  = isEdit
      ? `/api/inventario/${_activeTab}/${row.id}`
      : `/api/inventario/${_activeTab}`;
    try {
      const res  = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast(isEdit ? 'Registro actualizado.' : 'Registro creado.', 'success');
      close();
      loadTable();
      loadCounts();
    } catch (err) {
      errEl.textContent  = err.message || 'Error al guardar.';
      errEl.style.display = 'block';
    }
  });
}

function equipoFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <h3>${r ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
        </div>
        <button type="button" id="btn-smart-scan"
          style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;">
          📷 Escanear equipo — llenar campos automáticamente
        </button>
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${scanField('Placa *','placa',v('placa'),true)}
            ${selectField('Marca *','marca',v('marca'),['Lenovo','Dell','HP','Samsung','Toshiba','Acer','Asus','Apple','Otro'])}
            ${inputField('Nombre del equipo *','nombre_equipo',v('nombre_equipo'))}
            ${scanField('Serial *','serial',v('serial'),true)}
            ${selectField('Procesador','procesador',v('procesador'),['Intel Core i3','Intel Core i5','Intel Core i7','Intel Core i9','AMD Ryzen 3','AMD Ryzen 5','AMD Ryzen 7','Otro'])}
            ${selectField('RAM','ram',v('ram'),['4GB','8GB','16GB','32GB','64GB'])}
            ${selectField('Tipo de RAM','tipo_ram',v('tipo_ram'),['DDR3','DDR4','DDR5','LPDDR4','LPDDR5'])}
            ${selectField('Capacidad Disco','cap_disco',v('cap_disco'),['128GB','256GB','512GB','1TB','2TB'])}
            ${selectField('Tipo de Disco','tipo_disco',v('tipo_disco'),['SSD','HDD','M2','SATA','NVMe'])}
            ${inputField('Serial Cargador','serial_cargador',v('serial_cargador'))}
            ${inputField('Área','area',v('area'))}
            ${inputField('Responsable','responsable',v('responsable'))}
          </div>
          <div style="margin-top:12px;">
            ${inputField('Fecha de compra','fecha_compra',v('fecha_compra'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function celularFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <h3>${r ? 'Editar celular' : 'Nuevo celular'}</h3>
          <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
        </div>
        <button type="button" id="btn-smart-scan"
          style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;">
          📷 Escanear equipo — llenar campos automáticamente
        </button>
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${scanField('IMEI *','imei',v('imei'),true)}
            ${inputField('IMEI 2','imei2',v('imei2'))}
            ${selectField('Marca / Equipo','equipo',v('equipo'),['Samsung','Xiaomi Redmi','Honor','ZTE','Infinix','Motorola','iPhone','Otro'])}
            ${inputField('Modelo','modelo',v('modelo'))}
            ${selectField('Almacenamiento','almacenamiento',v('almacenamiento'),['32GB','64GB','128GB','256GB','512GB'])}
            ${selectField('RAM','ram',v('ram'),['2GB','3GB','4GB','6GB','8GB','12GB','16GB'])}
            ${selectField('Operador','operador',v('operador'),['CLARO','TIGO','MOVISTAR','WOM','ETB','AVANTEL'])}
            ${inputField('Línea','linea',v('linea'))}
            ${inputField('Área','area',v('area'))}
            ${inputField('Ciudad','ciudad',v('ciudad'))}
            ${inputField('Nombre completo *','nombre_completo',v('nombre_completo'))}
            ${inputField('Cédula','cedula',v('cedula'))}
            ${selectField('Estado','estado',v('estado')||'nuevo',['nuevo','seminuevo','usado'])}
            ${inputField('Accesorio','accesorio',v('accesorio'))}
            ${inputField('Entregado por','entregado_por',v('entregado_por'))}
          </div>
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${inputField('Fecha de registro','fecha_registro',v('fecha_registro'),'date')}
            ${inputField('Fecha de entrega','fecha_entrega',v('fecha_entrega'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function inputField(label, name, value = '', type = 'text') {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <input type="${type}" name="${name}" class="form-control" value="${esc(value)}" ${label.includes('*')?'required':''}>
  </div>`;
}

function selectField(label, name, value, options) {
  const opts = options.map(o => `<option value="${esc(o)}" ${value===o?'selected':''}>${esc(o)}</option>`).join('');
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <select name="${name}" class="form-control">
      <option value="">— Seleccionar —</option>
      ${opts}
    </select>
  </div>`;
}

function scanField(label, name, value = '', required = false) {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <div style="display:flex;gap:6px;">
      <input type="text" name="${name}" id="scan-input-${name}" class="form-control" value="${esc(value)}" ${required?'required':''} style="flex:1;">
      <button type="button" class="btn-scan" data-target="scan-input-${name}"
        style="padding:0 10px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:16px;flex-shrink:0;"
        title="Escanear código de barras">📷</button>
    </div>
  </div>`;
}

async function openScanner(targetInputId) {
  if (!('BarcodeDetector' in window)) {
    showToast('Tu navegador no soporta BarcodeDetector. Ingresa el dato manualmente.', 'warning');
    return;
  }

  let stream, rafId;

  const overlay = document.createElement('div');
  overlay.id    = 'scanner-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:20px;width:min(380px,94vw);text-align:center;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:600;font-size:15px;">Escanear código</span>
        <button id="btn-close-scan" style="background:transparent;border:none;font-size:20px;cursor:pointer;color:var(--text-2);">✕</button>
      </div>
      <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;">
        <video id="scan-video" autoplay playsinline style="width:100%;display:block;border-radius:10px;"></video>
        <div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:var(--primary);transform:translateY(-50%);box-shadow:0 0 8px var(--primary);pointer-events:none;"></div>
      </div>
      <p style="margin-top:12px;font-size:13px;color:var(--text-muted);">Apunta la cámara al código de barras del equipo</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  };

  document.getElementById('btn-close-scan').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  try {
    const detector = new BarcodeDetector({
      formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
    });

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    const video = document.getElementById('scan-video');
    video.srcObject = stream;

    const scan = async () => {
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const val = codes[0].rawValue;
            const inp = document.getElementById(targetInputId);
            if (inp) { inp.value = val; inp.dispatchEvent(new Event('input')); }
            close();
            showToast(`Escaneado: ${val}`, 'success');
            return;
          }
        } catch {}
      }
      rafId = requestAnimationFrame(scan);
    };

    video.addEventListener('loadeddata', () => { rafId = requestAnimationFrame(scan); });
  } catch (err) {
    close();
    if (err.name === 'NotAllowedError') {
      showToast('Permiso de cámara denegado. Actívalo en ajustes del navegador.', 'error');
    } else {
      showToast('No se pudo acceder a la cámara.', 'error');
    }
  }
}

/* ── Import Excel modal ── */
function openImportModal() {
  const modalWrap = document.getElementById('inv-modal-wrap');
  let _importRows = [];
  let _importTipo = _activeTab;   /* can be overridden in the modal */

  const FIELD_LABELS = {
    placa:'Placa', marca:'Marca', nombre_equipo:'Nombre equipo', serial:'Serial',
    procesador:'Procesador', ram:'RAM', tipo_ram:'Tipo RAM', cap_disco:'Cap. Disco',
    tipo_disco:'Tipo Disco', serial_cargador:'Serial Cargador', area:'Área',
    responsable:'Responsable', fecha_compra:'F. Compra',
    fecha_registro:'F. Registro', ciudad:'Ciudad', nombre_completo:'Nombre completo',
    cedula:'Cédula', linea:'Línea', operador:'Operador', equipo:'Equipo',
    almacenamiento:'Almacenamiento', modelo:'Modelo', imei:'IMEI', imei2:'IMEI 2',
    estado:'Estado', accesorio:'Accesorio', fecha_entrega:'F. Entrega',
    entregado_por:'Entregado por',
  };

  modalWrap.innerHTML = `
    <div class="modal-overlay" style="display:flex;" id="import-overlay">
      <div class="modal-content" style="max-width:680px;max-height:90vh;overflow-y:auto;">
        <div class="modal-header">
          <h3>⬆ Importar Excel</h3>
          <button class="modal-close" id="btn-import-close">&times;</button>
        </div>
        <div class="modal-body" id="import-body">
          <div id="import-step1">
            <div style="display:flex;gap:8px;margin-bottom:16px;">
              <button id="import-tipo-equipos" class="btn ${_activeTab==='equipos'?'btn-primary':'btn-secondary'}" style="flex:1;padding:8px;">
                🖥 Equipos
              </button>
              <button id="import-tipo-celulares" class="btn ${_activeTab==='celulares'?'btn-primary':'btn-secondary'}" style="flex:1;padding:8px;">
                📱 Celulares
              </button>
            </div>
            <p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
              Sube el archivo Excel con tus registros existentes. La primera fila debe contener los encabezados.
            </p>
            <label id="import-drop-zone" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
              border:2px dashed var(--border-2);border-radius:12px;padding:40px 20px;cursor:pointer;
              transition:border-color .2s;text-align:center;">
              <span style="font-size:32px;">📂</span>
              <span style="font-weight:500;">Arrastra tu .xlsx aquí o haz clic</span>
              <span style="font-size:12px;color:var(--text-3);">Máximo 10 MB</span>
              <input type="file" id="import-file-input" accept=".xlsx,.xls" style="display:none;">
            </label>
            <div id="import-step1-err" style="display:none;margin-top:12px;color:var(--danger);font-size:13px;"></div>
          </div>

          <div id="import-step2" style="display:none;">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:12px;" id="import-total-msg"></p>
            <details open style="margin-bottom:16px;">
              <summary style="font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">Mapeo de columnas</summary>
              <div id="import-mapping-table" style="font-size:12px;"></div>
            </details>
            <details open style="margin-bottom:16px;">
              <summary style="font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">Vista previa (primeras 5 filas)</summary>
              <div id="import-preview-table" style="overflow-x:auto;"></div>
            </details>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;font-size:13px;">
              <span style="font-weight:500;">Duplicados:</span>
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                <input type="radio" name="import-mode" value="skip" checked> Omitir (recomendado)
              </label>
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                <input type="radio" name="import-mode" value="overwrite"> Reemplazar
              </label>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary" id="btn-import-back">← Volver</button>
              <button class="btn btn-primary" id="btn-import-confirm">Importar <span id="import-count"></span> registros</button>
            </div>
          </div>

          <div id="import-step3" style="display:none;text-align:center;padding:20px 0;">
            <div id="import-result"></div>
            <button class="btn btn-primary" id="btn-import-done" style="margin-top:16px;">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;

  const overlay = modalWrap.querySelector('#import-overlay');
  const close   = () => overlay.remove();
  document.getElementById('btn-import-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  /* tipo selector */
  const setImportTipo = (t) => {
    _importTipo = t;
    document.getElementById('import-tipo-equipos').className   = `btn ${t==='equipos'  ?'btn-primary':'btn-secondary'}`;
    document.getElementById('import-tipo-celulares').className = `btn ${t==='celulares'?'btn-primary':'btn-secondary'}`;
  };
  document.getElementById('import-tipo-equipos').addEventListener('click',   () => setImportTipo('equipos'));
  document.getElementById('import-tipo-celulares').addEventListener('click', () => setImportTipo('celulares'));

  const dropZone  = document.getElementById('import-drop-zone');
  const fileInput = document.getElementById('import-file-input');
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop',      e => { e.preventDefault(); dropZone.style.borderColor = ''; handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change',   () => handleFile(fileInput.files[0]));
  dropZone.addEventListener('click',     () => fileInput.click());

  document.getElementById('import-body').addEventListener('click', e => {
    if (e.target.id === 'btn-import-back') {
      document.getElementById('import-step2').style.display = 'none';
      document.getElementById('import-step1').style.display = '';
    }
  });

  async function handleFile(file) {
    if (!file) return;
    const errEl = document.getElementById('import-step1-err');
    errEl.style.display = 'none';
    dropZone.style.opacity = '.5';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch(`/api/inventario/${_importTipo}/import`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      _importRows = data.rows;
      document.getElementById('import-total-msg').textContent = `${data.total} filas encontradas en "${file.name}".`;
      document.getElementById('import-count').textContent = data.total;

      const allFields = Object.keys(_importTipo === 'equipos'
        ? { placa:1,marca:1,nombre_equipo:1,serial:1,procesador:1,ram:1,tipo_ram:1,cap_disco:1,tipo_disco:1,serial_cargador:1,area:1,responsable:1,fecha_compra:1 }
        : { fecha_registro:1,area:1,ciudad:1,nombre_completo:1,cedula:1,linea:1,operador:1,equipo:1,almacenamiento:1,ram:1,modelo:1,imei:1,imei2:1,estado:1,accesorio:1,fecha_entrega:1,entregado_por:1 });

      document.getElementById('import-mapping-table').innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);">COLUMNA EN EXCEL</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);">CAMPO EN BD</th>
          </tr></thead>
          <tbody>${Object.entries(data.mapping).map(([col, field]) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-2);">${esc(col)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid var(--border);">
                <select data-col="${esc(col)}" style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;padding:2px 6px;">
                  <option value="">— Ignorar —</option>
                  ${allFields.map(f => `<option value="${f}" ${field===f?'selected':''}>${esc(FIELD_LABELS[f]||f)}</option>`).join('')}
                </select>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      if (data.preview.length) {
        const cols = Object.keys(data.preview[0]);
        document.getElementById('import-preview-table').innerHTML = `
          <table style="border-collapse:collapse;font-size:11px;min-width:100%;">
            <thead><tr>${cols.map(c => `<th style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text-3);text-transform:uppercase;font-size:10px;">${esc(FIELD_LABELS[c]||c)}</th>`).join('')}</tr></thead>
            <tbody>${data.preview.map(r => `<tr>${cols.map(c => `<td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text-2);">${esc(r[c]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>`;
      }

      document.getElementById('import-step1').style.display = 'none';
      document.getElementById('import-step2').style.display = '';
    } catch (err) {
      errEl.textContent  = err.message || 'Error al leer el archivo.';
      errEl.style.display = '';
    } finally {
      dropZone.style.opacity = '';
    }
  }

  document.getElementById('import-body').addEventListener('click', async e => {
    if (e.target.id !== 'btn-import-confirm') return;
    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'skip';
    const btn  = e.target;
    btn.disabled    = true;
    btn.textContent = 'Importando…';
    try {
      const res  = await fetch(`/api/inventario/${_importTipo}/import/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: _importRows, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('import-step2').style.display = 'none';
      document.getElementById('import-result').innerHTML = `
        <div style="font-size:40px;margin-bottom:8px;">✅</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${data.inserted} registros importados</div>
        ${data.skipped ? `<div style="font-size:13px;color:var(--text-2);">${data.skipped} duplicados omitidos</div>` : ''}
        ${data.errors?.length ? `<div style="font-size:12px;color:var(--danger);margin-top:8px;">${data.errors.length} errores:<br>${data.errors.slice(0,5).map(e=>esc(e.message)).join('<br>')}</div>` : ''}`;
      document.getElementById('import-step3').style.display = '';
    } catch (err) {
      btn.disabled    = false;
      btn.textContent = `Importar ${_importRows.length} registros`;
      showToast(err.message || 'Error al importar.', 'error');
    }
  });

  document.getElementById('import-body').addEventListener('click', e => {
    if (e.target.id === 'btn-import-done') { close(); loadTable(); loadCounts(); }
  });
}

/* ── Smart multi-barcode scanner ── */
function routeBarcode(value, tipo, detectedKeys) {
  const isImei = /^\d{15}$/.test(value);
  if (tipo === 'celulares') {
    if (isImei) {
      if (!detectedKeys.has('imei'))  return 'imei';
      if (!detectedKeys.has('imei2')) return 'imei2';
      return null;
    }
    if (/^[A-Z0-9\-]{5,20}$/i.test(value)) return 'serial';
    return null;
  }
  if (/^[A-Z0-9\-]{5,20}$/i.test(value)) {
    if (!detectedKeys.has('placa'))  return 'placa';
    if (!detectedKeys.has('serial')) return 'serial';
    return null;
  }
  return null;
}

function applyDetectedToForm(detectedMap) {
  for (const [field, value] of detectedMap) {
    const inp = document.querySelector(`#inv-form [name="${field}"]`);
    if (inp && !inp.value.trim()) {
      inp.value = value;
      inp.dispatchEvent(new Event('input'));
    }
  }
}

async function openSmartScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Cámara no disponible en este navegador.', 'warning');
    return;
  }

  let stream, rafId;
  const detectedFields = new Map();
  const detectedValues = new Set();
  const hasBarcodeDetector = 'BarcodeDetector' in window;

  const overlay = document.createElement('div');
  overlay.id = 'smart-scanner-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:20px;width:min(420px,96vw);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:700;font-size:15px;">📷 Escanear equipo</span>
        <button id="ss-close" style="background:transparent;border:none;font-size:22px;cursor:pointer;color:var(--text-2);">✕</button>
      </div>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:12px;">
        <button id="ss-tab-codes" class="tab-btn ${hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;${!hasBarcodeDetector ? 'opacity:.4;cursor:not-allowed;' : ''}" ${!hasBarcodeDetector ? 'disabled' : ''}>
          📷 Códigos
        </button>
        <button id="ss-tab-ocr" class="tab-btn ${!hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;">
          🔤 Leer etiqueta
        </button>
      </div>
      <div id="ss-pane-codes" style="display:${hasBarcodeDetector ? 'block' : 'none'};">
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px;">
          <video id="ss-video" autoplay playsinline style="width:100%;display:block;border-radius:10px;max-height:220px;object-fit:cover;"></video>
          <div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:var(--primary);transform:translateY(-50%);box-shadow:0 0 8px var(--primary);pointer-events:none;"></div>
        </div>
        <p style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:10px;">Apunta a la etiqueta — detecta todos los códigos</p>
      </div>
      <div id="ss-pane-ocr" style="display:${!hasBarcodeDetector ? 'block' : 'none'};">
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px;">
          <video id="ss-video-ocr" autoplay playsinline style="width:100%;display:block;border-radius:10px;max-height:220px;object-fit:cover;"></video>
          <div style="position:absolute;inset:8px;border:2px dashed rgba(99,102,241,.6);border-radius:8px;pointer-events:none;"></div>
        </div>
        <canvas id="ss-canvas" style="display:none;"></canvas>
        <div id="ss-ocr-progress" style="display:none;font-size:12px;color:var(--text-2);text-align:center;margin-bottom:8px;"></div>
        <button id="ss-capture" style="width:100%;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;">
          📸 Capturar y leer etiqueta
        </button>
      </div>
      <div id="ss-detected" style="background:var(--surface-2);border-radius:8px;padding:10px;min-height:48px;margin-bottom:12px;font-size:13px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Detectado</div>
        <div id="ss-detected-list" style="color:var(--text-3);font-size:12px;">Esperando…</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="ss-cancel" style="flex:1;padding:10px;background:var(--surface);border:1px solid var(--border-2);border-radius:8px;font-size:13px;cursor:pointer;color:var(--text-2);">Cancelar</button>
        <button id="ss-apply" style="flex:2;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;" disabled>Aplicar campos</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  };
  document.getElementById('ss-close').addEventListener('click', close);
  document.getElementById('ss-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('ss-apply').addEventListener('click', () => {
    applyDetectedToForm(detectedFields);
    showToast(`${detectedFields.size} campo(s) aplicado(s).`, 'success');
    close();
  });

  function updateDetectedPanel() {
    const list    = document.getElementById('ss-detected-list');
    const applyBtn = document.getElementById('ss-apply');
    if (!detectedFields.size) { list.textContent = 'Esperando…'; applyBtn.disabled = true; return; }
    list.innerHTML = [...detectedFields.entries()].map(([field, val]) =>
      `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <span style="color:var(--text-2);">${field}</span>
        <span style="font-family:monospace;color:var(--text);">${esc(val)}</span>
      </div>`
    ).join('');
    applyBtn.disabled = false;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const v1 = document.getElementById('ss-video');
    const v2 = document.getElementById('ss-video-ocr');
    if (v1) v1.srcObject = stream;
    if (v2) v2.srcObject = stream;
  } catch (err) {
    close();
    showToast(err.name === 'NotAllowedError' ? 'Permiso de cámara denegado.' : 'No se pudo acceder a la cámara.', 'error');
    return;
  }

  document.getElementById('ss-tab-codes')?.addEventListener('click', () => {
    document.getElementById('ss-tab-codes').classList.add('tab-active');
    document.getElementById('ss-tab-ocr').classList.remove('tab-active');
    document.getElementById('ss-pane-codes').style.display = '';
    document.getElementById('ss-pane-ocr').style.display   = 'none';
    startBarcodeScan();
  });
  document.getElementById('ss-tab-ocr').addEventListener('click', () => {
    document.getElementById('ss-tab-ocr').classList.add('tab-active');
    document.getElementById('ss-tab-codes')?.classList.remove('tab-active');
    document.getElementById('ss-pane-ocr').style.display   = '';
    document.getElementById('ss-pane-codes').style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  });

  function startBarcodeScan() {
    if (!hasBarcodeDetector) return;
    const detector = new BarcodeDetector({
      formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
    });
    const video = document.getElementById('ss-video');
    const loop  = async () => {
      if (video?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          for (const code of codes) {
            const val = code.rawValue;
            if (detectedValues.has(val)) continue;
            const field = routeBarcode(val, _activeTab, new Set(detectedFields.keys()));
            if (field) { detectedValues.add(val); detectedFields.set(field, val); updateDetectedPanel(); }
          }
        } catch {}
      }
      rafId = requestAnimationFrame(loop);
    };
    if (video?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) { rafId = requestAnimationFrame(loop); }
    else video?.addEventListener('loadeddata', () => { rafId = requestAnimationFrame(loop); }, { once: true });
  }

  if (hasBarcodeDetector) startBarcodeScan();

  document.getElementById('ss-capture')?.addEventListener('click', async () => {
    const video    = document.getElementById('ss-video-ocr');
    const canvas   = document.getElementById('ss-canvas');
    const progress = document.getElementById('ss-ocr-progress');
    const btn      = document.getElementById('ss-capture');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    btn.disabled    = true;
    btn.textContent = 'Procesando…';
    progress.style.display = '';
    progress.textContent   = 'Cargando motor OCR…';
    try {
      const Tesseract = await loadTesseract();
      progress.textContent = 'Reconociendo texto…';
      const worker = await Tesseract.createWorker('spa+eng', 1, {
        logger: m => { if (m.status === 'recognizing text') progress.textContent = `Reconociendo… ${Math.round((m.progress||0)*100)}%`; },
      });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      const parsed = parseOcrText(text);
      if (!parsed.size) {
        progress.textContent = 'No se detectaron datos. Intenta con mejor iluminación.';
      } else {
        progress.style.display = 'none';
        for (const [field, val] of parsed) { if (!detectedFields.has(field)) detectedFields.set(field, val); }
        updateDetectedPanel();
      }
    } catch (err) {
      progress.textContent = `Error OCR: ${err.message}`;
    } finally {
      btn.disabled    = false;
      btn.textContent = '📸 Capturar y leer etiqueta';
    }
  });
}

/* ── Tesseract lazy loader ── */
async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s  = document.createElement('script');
    s.src    = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar Tesseract.js. Verifica tu conexión.'));
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

/* ── OCR text parser ── */
function parseOcrText(text) {
  const result = new Map();
  if (!text) return result;

  const imeiMatch = text.match(/IMEI[\s:]+(\d{15})/i);
  if (imeiMatch) result.set('imei', imeiMatch[1]);

  const snMatch = text.match(/S\/?N[\s:]+([A-Z0-9\-]{5,20})/i);
  if (snMatch) result.set('serial', snMatch[1].toUpperCase());

  if (!result.has('imei')) {
    const bareImei = text.match(/\b(\d{15})\b/);
    if (bareImei) result.set('imei', bareImei[1]);
  }

  const ramCtx = text.match(/RAM[^\n]{0,30}?(\d+)\s*GB/i) || text.match(/(\d+)\s*GB[^\n]{0,30}?RAM/i);
  if (ramCtx) result.set('ram', ramCtx[1] + 'GB');

  const storCtx = text.match(/(?:ROM|Storage|Almacenamiento|Internal)[^\n]{0,30}?(\d+)\s*GB/i)
               || text.match(/(\d+)\s*GB[^\n]{0,30}?(?:ROM|Storage|Almacenamiento|Internal)/i);
  if (storCtx) result.set('almacenamiento', storCtx[1] + 'GB');

  const BRANDS = ['Samsung','Xiaomi','Redmi','Honor','ZTE','Infinix','Motorola','Apple','iPhone',
                  'Dell','HP','Lenovo','Asus','Acer','Toshiba'];
  for (const brand of BRANDS) {
    const m = text.match(new RegExp(`\\b${brand}\\b`, 'i'));
    if (m) {
      const field = ['Dell','HP','Lenovo','Asus','Acer','Toshiba'].includes(brand) ? 'marca' : 'equipo';
      result.set(field, brand);
      const lineMatch = text.match(new RegExp(`${brand}[\\s]+([A-Z0-9][A-Z0-9 \\-]{2,30})`, 'i'));
      if (lineMatch) result.set('modelo', lineMatch[1].trim());
      break;
    }
  }

  return result;
}

/* ── Generar enlace de registro móvil ── */
async function openGenerarEnlaceModal() {
  const modalWrap = document.getElementById('inv-modal-wrap');
  modalWrap.innerHTML = `
    <div class="modal-overlay" style="display:flex;" id="enlace-overlay">
      <div class="modal-content" style="max-width:520px;">
        <div class="modal-header">
          <h3>📲 Generar enlace de registro móvil</h3>
          <button class="modal-close" id="btn-enlace-close">&times;</button>
        </div>
        <div class="modal-body" id="enlace-body">

          <!-- Paso 1: configurar -->
          <div id="enlace-step1">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:18px;">
              Genera un enlace o QR para que tus compañeros registren equipos desde el celular — sin necesidad de iniciar sesión.
            </p>
            <div class="form-group" style="margin-bottom:14px;">
              <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Tipo de registro</label>
              <div style="display:flex;gap:10px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;">
                  <input type="radio" name="enlace-tipo" value="equipos" checked> 🖥 Equipos
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;">
                  <input type="radio" name="enlace-tipo" value="celulares"> 📱 Celulares
                </label>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Nombre / etiqueta (opcional)</label>
              <input type="text" id="enlace-label" class="form-control" placeholder="Ej: Bodega Bogotá, Inventario junio…">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
              <div class="form-group">
                <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Vence en</label>
                <select id="enlace-expires" class="form-control">
                  <option value="">Sin límite de tiempo</option>
                  <option value="24">24 horas</option>
                  <option value="72">3 días</option>
                  <option value="168" selected>7 días</option>
                  <option value="720">30 días</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Máx. registros</label>
                <select id="enlace-uses" class="form-control">
                  <option value="">Sin límite</option>
                  <option value="10">10 usos</option>
                  <option value="25">25 usos</option>
                  <option value="50" selected>50 usos</option>
                  <option value="100">100 usos</option>
                </select>
              </div>
            </div>
            <div id="enlace-step1-err" style="display:none;color:var(--danger);font-size:13px;margin-bottom:12px;"></div>
            <button class="btn btn-primary" id="btn-enlace-generar" style="width:100%;">Generar enlace y QR</button>
          </div>

          <!-- Paso 2: resultado -->
          <div id="enlace-step2" style="display:none;">
            <div style="text-align:center;margin-bottom:18px;">
              <div style="font-size:13px;color:var(--text-2);margin-bottom:12px;">Escanea este QR o comparte el enlace</div>
              <img id="enlace-qr-img" src="" alt="QR" style="border-radius:12px;background:#fff;padding:8px;width:200px;height:200px;display:block;margin:0 auto;">
            </div>
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <input type="text" id="enlace-url" class="form-control" readonly style="flex:1;font-size:12px;font-family:monospace;background:transparent;border:none;padding:0;">
              <button class="btn btn-secondary btn-small" id="btn-enlace-copy">Copiar</button>
            </div>
            <p style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:16px;" id="enlace-info"></p>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary" id="btn-enlace-nuevo" style="flex:1;">Crear otro</button>
              <button class="btn btn-primary"   id="btn-enlace-done"  style="flex:1;">Listo</button>
            </div>
          </div>

        </div>
      </div>
    </div>`;

  const overlay = modalWrap.querySelector('#enlace-overlay');
  const close   = () => overlay.remove();
  document.getElementById('btn-enlace-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('btn-enlace-done').addEventListener('click', close);

  document.getElementById('btn-enlace-nuevo').addEventListener('click', () => {
    document.getElementById('enlace-step2').style.display = 'none';
    document.getElementById('enlace-step1').style.display = '';
  });

  document.getElementById('btn-enlace-copy').addEventListener('click', () => {
    const url = document.getElementById('enlace-url').value;
    navigator.clipboard?.writeText(url).then(() => {
      document.getElementById('btn-enlace-copy').textContent = '✓ Copiado';
      setTimeout(() => { document.getElementById('btn-enlace-copy').textContent = 'Copiar'; }, 2000);
    });
  });

  document.getElementById('btn-enlace-generar').addEventListener('click', async () => {
    const tipo         = document.querySelector('input[name="enlace-tipo"]:checked')?.value || 'equipos';
    const label        = document.getElementById('enlace-label').value.trim();
    const expires_hours= document.getElementById('enlace-expires').value || null;
    const max_uses     = document.getElementById('enlace-uses').value || null;
    const errEl        = document.getElementById('enlace-step1-err');
    const btn          = document.getElementById('btn-enlace-generar');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Generando…';

    try {
      const res  = await fetch('/api/inventario/registro-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tipo, label: label || null, expires_hours, max_uses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      document.getElementById('enlace-url').value = data.url;
      document.getElementById('enlace-qr-img').src = `/api/inventario/registro-qr/${data.token}`;

      const parts = [];
      if (expires_hours) parts.push(`Vence en ${expires_hours >= 168 ? (expires_hours/168)+'d' : expires_hours+'h'}`);
      if (max_uses)      parts.push(`Máx. ${max_uses} registros`);
      document.getElementById('enlace-info').textContent = parts.join(' · ') || 'Sin límites';

      document.getElementById('enlace-step1').style.display = 'none';
      document.getElementById('enlace-step2').style.display = '';
    } catch (err) {
      errEl.textContent  = err.message || 'Error al generar el enlace.';
      errEl.style.display = '';
    } finally {
      btn.disabled = false; btn.textContent = 'Generar enlace y QR';
    }
  });
}
