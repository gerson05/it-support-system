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
      <button id="btn-inv-new"
        style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;">
        ＋ Registrar equipo
      </button>
    </div>

    <div style="display:flex;gap:0;border-bottom:2px solid var(--glass-border);margin-bottom:0;">
      <button id="tab-equipos" class="tab-btn tab-active" data-tab="equipos">
        🖥 Equipos <span class="tab-count" id="count-equipos">…</span>
      </button>
      <button id="tab-celulares" class="tab-btn" data-tab="celulares">
        📱 Celulares <span class="tab-count" id="count-celulares">…</span>
      </button>
    </div>

    <div class="card" style="margin-top:0;border-radius:0 0 12px 12px;padding:14px 20px;">
      <div class="filter-bar">
        <input type="search" id="inv-search" placeholder="Buscar placa, serial, nombre, área…"
          style="flex:1;min-width:180px;" value="">
        <input type="text" id="inv-area" placeholder="Filtrar por área"
          style="width:160px;">
        <button id="btn-inv-clear" class="btn btn-secondary btn-small">Limpiar</button>
      </div>
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

  let debounce;
  document.getElementById('inv-search').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _search = e.target.value.trim(); _page = 1; loadTable(); }, 300);
  });
  document.getElementById('inv-area').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { _filterArea = e.target.value.trim(); _page = 1; loadTable(); }, 300);
  });
  document.getElementById('btn-inv-clear').addEventListener('click', () => {
    _search = ''; _filterArea = ''; _page = 1;
    document.getElementById('inv-search').value = '';
    document.getElementById('inv-area').value   = '';
    loadTable();
  });

  document.getElementById('btn-inv-new').addEventListener('click', () => openForm(null));

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

function renderEquiposTable(rows) {
  return `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr>
        <th>Placa</th><th>Marca / Equipo</th><th>Serial</th>
        <th>Procesador</th><th>RAM</th><th>Disco</th>
        <th>Área</th><th>Responsable</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td style="font-family:monospace;font-size:12px;">${esc(r.placa)}</td>
          <td><strong>${esc(r.marca)}</strong><br><small style="color:var(--text-muted);">${esc(r.nombre_equipo)}</small></td>
          <td style="font-family:monospace;font-size:12px;">${esc(r.serial)}</td>
          <td style="font-size:12px;">${esc(r.procesador||'—')}</td>
          <td style="font-size:12px;">${esc(r.ram||'—')} ${esc(r.tipo_ram||'')}</td>
          <td style="font-size:12px;">${esc(r.cap_disco||'—')} ${esc(r.tipo_disco||'')}</td>
          <td style="font-size:12px;">${esc(r.area||'—')}</td>
          <td style="font-size:12px;">${esc(r.responsable||'—')}</td>
          <td style="white-space:nowrap;">
            <button class="btn-inv-edit btn btn-small btn-secondary"
              data-row="${encodeURIComponent(JSON.stringify(r))}">✏</button>
            <button class="btn-inv-del btn btn-small" style="background:rgba(239,68,68,.12);color:var(--danger);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;margin-left:4px;"
              data-id="${r.id}" data-label="${esc(r.placa)} — ${esc(r.marca)}">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderCelularesTable(rows) {
  return `
  <div class="card" style="padding:0;overflow:hidden;">
    <table class="data-table">
      <thead><tr>
        <th>IMEI</th><th>Modelo / Equipo</th><th>Asignado a</th>
        <th>Área</th><th>Ciudad</th><th>Estado</th>
        <th>Operador</th><th>F. Entrega</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td style="font-family:monospace;font-size:12px;">${esc(r.imei)}</td>
          <td><strong>${esc(r.modelo||r.equipo||'—')}</strong><br><small style="color:var(--text-muted);">${esc(r.almacenamiento||'')} ${esc(r.ram||'')}</small></td>
          <td style="font-size:12px;">${esc(r.nombre_completo)}<br><small style="color:var(--text-muted);">${esc(r.cedula||'')}</small></td>
          <td style="font-size:12px;">${esc(r.area||'—')}</td>
          <td style="font-size:12px;">${esc(r.ciudad||'—')}</td>
          <td><span class="badge badge-${r.estado||'nuevo'}">${esc(r.estado||'nuevo')}</span></td>
          <td style="font-size:12px;">${esc(r.operador||'—')}</td>
          <td style="font-size:12px;">${esc(r.fecha_entrega||'—')}</td>
          <td style="white-space:nowrap;">
            <button class="btn-inv-edit btn btn-small btn-secondary"
              data-row="${encodeURIComponent(JSON.stringify(r))}">✏</button>
            <button class="btn-inv-del btn btn-small" style="background:rgba(239,68,68,.12);color:var(--danger);border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;margin-left:4px;"
              data-id="${r.id}" data-label="${esc(r.imei)} — ${esc(r.modelo||r.equipo||'')}">🗑</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
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
      <div class="modal-header">
        <h3>${r ? 'Editar equipo' : 'Nuevo equipo'}</h3>
        <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
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
      <div class="modal-header">
        <h3>${r ? 'Editar celular' : 'Nuevo celular'}</h3>
        <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
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
