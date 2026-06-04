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
