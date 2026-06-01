/* ─────────────────────────────────────────────
   Estado global
───────────────────────────────────────────── */
let _data     = [];
let _panelCtx = null;
let _deleteCtx = null;

/* ─────────────────────────────────────────────
   Inicialización
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadData();
  document.getElementById('search-input').addEventListener('input', onSearch);
  wirePanel();
  wireDeleteModal();
});

async function loadData() {
  const root = document.getElementById('accordion-root');
  root.innerHTML = '<div class="loading-msg">Cargando directorio...</div>';
  try {
    const res = await fetch('/api/farmacias');
    if (!res.ok) throw new Error(res.statusText);
    _data = await res.json();
    renderAll(_data);
  } catch (err) {
    root.innerHTML = `<div class="loading-msg" style="color:var(--danger)">Error cargando datos: ${err.message}</div>`;
  }
}

/* ─────────────────────────────────────────────
   Renderizado
───────────────────────────────────────────── */
function renderAll(data) {
  const root = document.getElementById('accordion-root');
  if (!data.length) {
    root.innerHTML = '<div class="loading-msg">Sin datos en el directorio.</div>';
    return;
  }
  root.innerHTML = data.map(renderDept).join('');
  lucide.createIcons();
  bindAccordions();
  bindFarmaciaActions();
}

function renderDept(dept) {
  const total = dept.municipios.reduce((s, m) => s + m.farmacias.length, 0);
  return `
  <div class="dept-block" data-dept="${esc(dept.nombre)}">
    <div class="dept-header">
      <i data-lucide="map" style="width:15px;height:15px;color:var(--primary)"></i>
      ${esc(dept.nombre)}
      <span class="badge">${dept.municipios.length} municipios · ${total} farmacias</span>
      <i data-lucide="chevron-down" class="chevron" style="width:16px;height:16px;"></i>
    </div>
    <div class="muni-list">
      ${dept.municipios.map(renderMuni).join('') || '<div class="empty-dept">Sin municipios</div>'}
    </div>
  </div>`;
}

function renderMuni(muni) {
  return `
  <div class="muni-block">
    <div class="muni-header">
      <i data-lucide="map-pin" style="width:14px;height:14px;color:var(--text-3)"></i>
      ${esc(muni.nombre)}
      <span class="badge">${muni.farmacias.length}</span>
      <i data-lucide="chevron-down" class="chevron" style="width:14px;height:14px;"></i>
    </div>
    <div class="farmacia-list">
      ${muni.farmacias.map(f => renderFarmacia(muni, f)).join('')}
      <button class="btn-add-farmacia"
        data-action="add" data-row="${muni.sheetRow}" data-muni="${esc(muni.nombre)}">
        <i data-lucide="plus" style="width:13px;height:13px;"></i> Agregar farmacia
      </button>
    </div>
  </div>`;
}

function renderFarmacia(muni, f) {
  return `
  <div class="farmacia-row">
    <i data-lucide="store" style="width:14px;height:14px;color:var(--primary);flex-shrink:0"></i>
    <span class="name">${esc(f.nombre)}</span>
    <span class="dir">${esc(f.direccion)}</span>
    <button class="btn-icon btn-edit" title="Editar"
      data-action="edit" data-row="${muni.sheetRow}" data-idx="${f.index}" data-muni="${esc(muni.nombre)}">
      <i data-lucide="pencil" style="width:13px;height:13px;"></i>
    </button>
    <button class="btn-icon btn-delete" title="Eliminar"
      data-action="delete" data-row="${muni.sheetRow}" data-idx="${f.index}"
      data-muni="${esc(muni.nombre)}" data-fname="${esc(f.nombre)}">
      <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
    </button>
  </div>`;
}

/* ─────────────────────────────────────────────
   Acordeón
───────────────────────────────────────────── */
function bindAccordions() {
  document.querySelectorAll('.dept-header').forEach(h => {
    h.addEventListener('click', () => {
      h.classList.toggle('open');
      h.nextElementSibling.classList.toggle('open');
    });
  });
  document.querySelectorAll('.muni-header').forEach(h => {
    h.addEventListener('click', () => {
      h.classList.toggle('open');
      h.nextElementSibling.classList.toggle('open');
    });
  });
}

/* ─────────────────────────────────────────────
   Búsqueda
───────────────────────────────────────────── */
function onSearch(e) {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderAll(_data); return; }

  const filtered = _data.map(dept => ({
    ...dept,
    municipios: dept.municipios
      .map(m => ({
        ...m,
        farmacias: m.farmacias.filter(f =>
          f.nombre.toLowerCase().includes(q) || f.direccion.toLowerCase().includes(q)
        ),
      }))
      .filter(m => m.nombre.toLowerCase().includes(q) || m.farmacias.length > 0),
  })).filter(d => d.municipios.length > 0);

  renderAll(filtered);

  document.querySelectorAll('.dept-header, .muni-header').forEach(h => {
    h.classList.add('open');
    h.nextElementSibling.classList.add('open');
  });
}

/* ─────────────────────────────────────────────
   Acciones (edit / add / delete)
───────────────────────────────────────────── */
function bindFarmaciaActions() {
  document.getElementById('accordion-root').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action     = btn.dataset.action;
    const sheetRow   = parseInt(btn.dataset.row);
    const muniNombre = btn.dataset.muni;

    if (action === 'edit') {
      const idx = parseInt(btn.dataset.idx);
      const f   = getFarmacia(sheetRow, idx);
      if (!f) return;
      openPanel('edit', sheetRow, muniNombre, idx, f);
    }

    if (action === 'add') {
      openPanel('add', sheetRow, muniNombre, null, {});
    }

    if (action === 'delete') {
      const idx   = parseInt(btn.dataset.idx);
      const fname = btn.dataset.fname;
      openDeleteModal(sheetRow, muniNombre, idx, fname);
    }
  });
}

function getFarmacia(sheetRow, index) {
  for (const dept of _data) {
    for (const muni of dept.municipios) {
      if (muni.sheetRow === sheetRow) return muni.farmacias[index] || null;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────
   Panel lateral
───────────────────────────────────────────── */
function wirePanel() {
  document.getElementById('panel-overlay').addEventListener('click', closePanel);
  document.getElementById('btn-panel-cancel').addEventListener('click', closePanel);
  document.getElementById('btn-panel-save').addEventListener('click', onPanelSave);
}

function openPanel(mode, sheetRow, municipioNombre, index, farmacia) {
  _panelCtx = { mode, sheetRow, municipioNombre, index };

  document.getElementById('panel-title').textContent =
    mode === 'edit' ? `Editar: ${farmacia.nombre || ''}` : 'Agregar farmacia';

  document.getElementById('f-nombre').value    = farmacia.nombre    || '';
  document.getElementById('f-direccion').value = farmacia.direccion || '';
  document.getElementById('f-correo').value    = farmacia.correo    || '';
  document.getElementById('f-horario').value   = farmacia.horario   || '';
  document.getElementById('f-telefono').value  = farmacia.telefono  || '';
  document.getElementById('f-maps').value      = farmacia.mapsUrl   || '';

  document.getElementById('save-status').textContent = '';
  document.getElementById('save-status').className   = 'save-status';

  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('side-panel').classList.add('open');
  document.getElementById('f-nombre').focus();
}

function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('side-panel').classList.remove('open');
  _panelCtx = null;
}

async function onPanelSave() {
  if (!_panelCtx) return;

  const payload = {
    sheetRow:        _panelCtx.sheetRow,
    municipioNombre: _panelCtx.municipioNombre,
    nombre:    document.getElementById('f-nombre').value.trim(),
    direccion: document.getElementById('f-direccion').value.trim(),
    correo:    document.getElementById('f-correo').value.trim(),
    horario:   document.getElementById('f-horario').value.trim(),
    telefono:  document.getElementById('f-telefono').value.trim(),
    mapsUrl:   document.getElementById('f-maps').value.trim(),
  };

  if (!payload.nombre) {
    setStatus('El nombre es obligatorio.', 'err');
    return;
  }

  const saveBtn = document.getElementById('btn-panel-save');
  saveBtn.disabled = true;
  setStatus('Guardando...', '');

  try {
    let method = 'POST';
    if (_panelCtx.mode === 'edit') {
      method = 'PUT';
      payload.index = _panelCtx.index;
    }

    const res = await fetch('/api/farmacias/punto', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || res.statusText);
    }

    setStatus('✅ Guardado en Google Sheets', 'ok');
    setTimeout(async () => {
      closePanel();
      await loadData();
    }, 1200);

  } catch (err) {
    setStatus(`❌ Error: ${err.message}`, 'err');
  } finally {
    saveBtn.disabled = false;
  }
}

function setStatus(msg, cls) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className   = `save-status ${cls}`;
}

/* ─────────────────────────────────────────────
   Modal eliminar
───────────────────────────────────────────── */
function wireDeleteModal() {
  document.getElementById('modal-cancel').addEventListener('click',  closeDeleteModal);
  document.getElementById('modal-confirm').addEventListener('click', onDeleteConfirm);
}

function openDeleteModal(sheetRow, municipioNombre, index, nombre) {
  _deleteCtx = { sheetRow, municipioNombre, index };
  document.getElementById('modal-delete-name').textContent =
    `¿Eliminar "${nombre}" de ${municipioNombre}? Esta acción actualizará el Google Sheet.`;
  document.getElementById('modal-delete').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('modal-delete').classList.remove('open');
  _deleteCtx = null;
}

async function onDeleteConfirm() {
  if (!_deleteCtx) return;

  const btn = document.getElementById('modal-confirm');
  btn.disabled    = true;
  btn.textContent = 'Eliminando...';

  try {
    const res = await fetch('/api/farmacias/punto', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(_deleteCtx),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || res.statusText);
    }

    closeDeleteModal();
    await loadData();

  } catch (err) {
    alert(`Error al eliminar: ${err.message}`);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Eliminar';
  }
}

/* ─────────────────────────────────────────────
   Utilidades
───────────────────────────────────────────── */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
