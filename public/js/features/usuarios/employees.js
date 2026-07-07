import { showToast } from '../../ui/components.js';
import { can } from '../../core/state.js';
import { iconEye } from '../../utils/icons.js';

let _employees = [];
let _cargos = [];
let _areas = [];
let _editingId = null;
let _completingId = null;
let _currentTab = 'pendientes';
let _filterText = '';
let _filterArea = '';
let _filterCargo = '';

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function renderEmployees(container) {
  container.innerHTML = `
  <div class="page-header">
    <div>
      <h2 class="page-title">Creación de Usuarios</h2>
      <p class="page-subtitle">Personal nuevo — flujo Gestión Humana → IT</p>
    </div>
    <button class="btn btn-primary" id="emp-btn-new"
      style="${!can('employees:create') ? 'display:none;' : ''}">+ Nuevo empleado</button>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
    <input type="text" id="emp-filter-text" class="form-control"
      placeholder="Buscar por nombre o cédula..."
      style="flex:1;min-width:200px;max-width:340px;">
    <select id="emp-filter-area" class="form-control" style="min-width:160px;max-width:220px;">
      <option value="">Todas las áreas</option>
    </select>
    <select id="emp-filter-cargo" class="form-control" style="min-width:160px;max-width:220px;">
      <option value="">Todos los cargos</option>
    </select>
    <button id="emp-filter-clear" class="btn btn-secondary" style="white-space:nowrap;display:none;">
      Limpiar filtros
    </button>
  </div>

  <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;">
    <button class="emp-tab-btn active" data-tab="pendientes"
      style="padding:8px 20px;background:transparent;border:none;border-bottom:2px solid var(--primary);
             color:var(--primary);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">
      Pendientes
    </button>
    <button class="emp-tab-btn" data-tab="completados"
      style="padding:8px 20px;background:transparent;border:none;border-bottom:2px solid transparent;
             color:var(--text-2);font-weight:500;font-size:13px;cursor:pointer;font-family:inherit;">
      Completados
    </button>
  </div>

  <div id="emp-tab-content"></div>

  <!-- Modal: crear / editar -->
  <div id="emp-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content" style="max-width:520px;">
      <div class="modal-header">
        <h3 id="emp-modal-title">Nuevo empleado</h3>
        <button class="modal-close" id="emp-modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div id="emp-modal-error" style="
          display:none;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);
          color:var(--danger);border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>

        <form id="emp-form">
          <input type="hidden" id="emp-edit-id">

          <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);
                      border-radius:8px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:11px;font-weight:600;color:var(--success);text-transform:uppercase;
                        letter-spacing:0.5px;margin-bottom:12px;">Gestión Humana</div>
            <div class="form-group">
              <label>Cédula <span style="color:var(--danger)">*</span></label>
              <input type="text" id="emp-cedula" class="form-control" placeholder="Ej: 1130658563"
                     maxlength="12" autocomplete="off" required>
            </div>
            <div class="form-group">
              <label>Nombre completo <span style="color:var(--danger)">*</span></label>
              <input type="text" id="emp-nombre" class="form-control"
                     placeholder="Ej: Kelly Johana Raigoza Herrera" required>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>Cargo <span style="color:var(--danger)">*</span></label>
                <div style="position:relative;">
                  <input type="text" id="emp-cargo-text" class="form-control"
                         placeholder="Escribir o buscar..." autocomplete="off">
                  <input type="hidden" id="emp-cargo" value="">
                  <div id="emp-cargo-list"
                       style="display:none;position:absolute;top:100%;left:0;right:0;
                              background:var(--surface);border:1px solid var(--border);
                              border-radius:6px;max-height:180px;overflow-y:auto;z-index:999;
                              box-shadow:0 4px 12px rgba(0,0,0,.18);margin-top:2px;"></div>
                </div>
              </div>
              <div class="form-group">
                <label>Área / Punto <span style="color:var(--danger)">*</span></label>
                <div style="position:relative;">
                  <input type="text" id="emp-area-text" class="form-control"
                         placeholder="Escribir o buscar..." autocomplete="off">
                  <input type="hidden" id="emp-area" value="">
                  <div id="emp-area-list"
                       style="display:none;position:absolute;top:100%;left:0;right:0;
                              background:var(--surface);border:1px solid var(--border);
                              border-radius:6px;max-height:180px;overflow-y:auto;z-index:999;
                              box-shadow:0 4px 12px rgba(0,0,0,.18);margin-top:2px;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sección IT: solo visible al editar un empleado ya completado -->
          <div id="emp-it-section" style="display:none;background:rgba(99,102,241,0.06);
               border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:14px 16px;">
            <div style="font-size:11px;font-weight:600;color:var(--primary);text-transform:uppercase;
                        letter-spacing:0.5px;margin-bottom:12px;">IT — Credenciales generadas</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>Usuario</label>
                <input type="text" id="emp-usuario" class="form-control" readonly
                       style="background:var(--surface-2);color:var(--text-2);">
              </div>
              <div class="form-group">
                <label>Contraseña</label>
                <input type="text" id="emp-contrasena" class="form-control" readonly
                       style="background:var(--surface-2);color:var(--text-2);">
              </div>
            </div>
            <div class="form-group">
              <label>Fecha completado</label>
              <input type="text" id="emp-fecha-display" class="form-control" readonly
                     style="background:var(--surface-2);color:var(--text-2);">
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="emp-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="emp-btn-save">Guardar</button>
      </div>
    </div>
  </div>

  <!-- Modal: credenciales generadas -->
  <div id="emp-creds-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content" style="max-width:420px;">
      <div class="modal-header">
        <h3>Credenciales generadas</h3>
        <button class="modal-close" id="emp-creds-close">&times;</button>
      </div>
      <div class="modal-body">
        <p id="emp-creds-name"
           style="font-size:13px;color:var(--text-2);margin-bottom:16px;"></p>
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-2);
                          text-transform:uppercase;letter-spacing:.5px;">Usuario</label>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <input type="text" id="emp-creds-user" readonly class="form-control"
                     style="font-family:monospace;font-size:15px;font-weight:600;
                            background:var(--surface-2);">
              <button id="emp-creds-copy-user"
                style="padding:0 14px;background:var(--primary);color:#fff;border:none;
                       border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
                Copiar
              </button>
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-2);
                          text-transform:uppercase;letter-spacing:.5px;">Contraseña</label>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <input type="text" id="emp-creds-pass" readonly class="form-control"
                     style="font-family:monospace;font-size:15px;font-weight:600;
                            background:var(--surface-2);">
              <button id="emp-creds-copy-pass"
                style="padding:0 14px;background:var(--primary);color:#fff;border:none;
                       border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
                Copiar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="emp-creds-done">Listo</button>
      </div>
    </div>
  </div>

  <!-- Modal: completar gestión IT -->
  <div id="emp-complete-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content" style="max-width:420px;">
      <div class="modal-header">
        <h3>Completar gestión IT</h3>
        <button class="modal-close" id="emp-complete-close">&times;</button>
      </div>
      <div class="modal-body">
        <p id="emp-complete-name"
           style="font-size:14px;font-weight:600;color:var(--text-1);margin-bottom:12px;"></p>
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);
                    border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text-2);margin-bottom:16px;">
          Al confirmar se generarán usuario y contraseña automáticamente.
        </div>
        <div class="form-group">
          <label>Fecha de gestión <span style="color:var(--danger)">*</span></label>
          <input type="date" id="emp-complete-fecha" class="form-control">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="emp-complete-cancel">Cancelar</button>
        <button class="btn btn-primary" id="emp-complete-confirm">Completar</button>
      </div>
    </div>
  </div>`;

  // ── event listeners ──────────────────────────────────────────────────────
  document.getElementById('emp-modal-close').addEventListener('click', _closeModal);
  document.getElementById('emp-btn-cancel').addEventListener('click', _closeModal);
  document.getElementById('emp-btn-save').addEventListener('click', _save);
  document.getElementById('emp-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeModal();
  });
  document.getElementById('emp-btn-new').addEventListener('click', () => _openModal(null));

  document.getElementById('emp-creds-close').addEventListener('click', _closeCredsModal);
  document.getElementById('emp-creds-done').addEventListener('click', _closeCredsModal);
  document.getElementById('emp-creds-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeCredsModal();
  });
  document.getElementById('emp-creds-copy-user').addEventListener('click', () =>
    _copyField('emp-creds-user', 'emp-creds-copy-user'));
  document.getElementById('emp-creds-copy-pass').addEventListener('click', () =>
    _copyField('emp-creds-pass', 'emp-creds-copy-pass'));

  document.getElementById('emp-complete-close').addEventListener('click', _closeCompleteModal);
  document.getElementById('emp-complete-cancel').addEventListener('click', _closeCompleteModal);
  document.getElementById('emp-complete-confirm').addEventListener('click', _confirmComplete);
  document.getElementById('emp-complete-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeCompleteModal();
  });

  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _switchTab(btn.dataset.tab));
  });

  document.getElementById('emp-cedula').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
  });

  document.getElementById('emp-filter-text').addEventListener('input', e => {
    _filterText = e.target.value.trim().toLowerCase();
    _updateClearBtn();
    _renderTab();
  });
  document.getElementById('emp-filter-area').addEventListener('change', e => {
    _filterArea = e.target.value;
    _updateClearBtn();
    _renderTab();
  });
  document.getElementById('emp-filter-cargo').addEventListener('change', e => {
    _filterCargo = e.target.value;
    _updateClearBtn();
    _renderTab();
  });
  document.getElementById('emp-filter-clear').addEventListener('click', _clearFilters);

  await Promise.all([_loadCargos(), _loadAreas(), _loadEmployees()]);
}

// ─── Data loaders ─────────────────────────────────────────────────────────────
async function _loadEmployees() {
  try {
    const r = await fetch('/api/employees');
    if (!r.ok) throw new Error(r.status);
    _employees = await r.json();
    _renderTab();
  } catch (e) {
    console.error('employees load error', e);
    showToast('Error cargando empleados', 'error');
  }
}

async function _loadCargos() {
  try {
    const r = await fetch('/api/employees-data/cargos');
    if (!r.ok) return;
    _cargos = await r.json();
    _populateFilterSelect('emp-filter-cargo', _cargos, 'Todos los cargos', _filterCargo);
  } catch { /* silencioso */ }
}

async function _loadAreas() {
  try {
    const r = await fetch('/api/employees-data/areas');
    if (!r.ok) return;
    _areas = await r.json();
    _populateFilterSelect('emp-filter-area', _areas, 'Todas las áreas', _filterArea);
  } catch { /* silencioso */ }
}

function _populateFilterSelect(id, items, placeholder, current) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(i => {
      const label = i.ciudad ? `${_esc(i.nombre)} (${_esc(i.ciudad)})` : _esc(i.nombre);
      return `<option value="${_esc(i.nombre)}">${label}</option>`;
    }).join('');
  sel.value = current;
}

// ─── Filters ─────────────────────────────────────────────────────────────────
function _applyFilters(list) {
  return list.filter(emp => {
    if (_filterText) {
      const hay = `${emp.nombre_completo} ${emp.cedula}`.toLowerCase();
      if (!hay.includes(_filterText)) return false;
    }
    if (_filterArea && emp.area !== _filterArea) return false;
    if (_filterCargo && emp.cargo !== _filterCargo) return false;
    return true;
  });
}

function _updateClearBtn() {
  const has = _filterText || _filterArea || _filterCargo;
  const btn = document.getElementById('emp-filter-clear');
  if (btn) btn.style.display = has ? '' : 'none';
}

function _clearFilters() {
  _filterText = '';
  _filterArea = '';
  _filterCargo = '';
  const t = document.getElementById('emp-filter-text');
  const a = document.getElementById('emp-filter-area');
  const c = document.getElementById('emp-filter-cargo');
  if (t) t.value = '';
  if (a) a.value = '';
  if (c) c.value = '';
  _updateClearBtn();
  _renderTab();
}

// ─── Tab ─────────────────────────────────────────────────────────────────────
function _isPending(emp) {
  return !emp.usuario || !emp.contraseña || !emp.fecha_respuesta_soporte;
}

function _switchTab(tab) {
  _currentTab = tab;
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
    btn.style.color              = active ? 'var(--primary)' : 'var(--text-2)';
    btn.style.fontWeight         = active ? '600' : '500';
  });
  _renderTab();
}

function _renderTab() {
  const base = _employees
    .filter(e => _currentTab === 'pendientes' ? _isPending(e) : !_isPending(e))
    .sort((a, b) => {
      const dateA = _currentTab === 'pendientes' ? a.created_at : a.fecha_respuesta_soporte;
      const dateB = _currentTab === 'pendientes' ? b.created_at : b.fecha_respuesta_soporte;
      return (dateB || '').localeCompare(dateA || '');
    });
  const list = _applyFilters(base);
  const el   = document.getElementById('emp-tab-content');
  if (!el) return;

  if (!list.length) {
    const hasFilters = _filterText || _filterArea || _filterCargo;
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-3);font-size:14px;">
      ${hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay empleados en esta categoría.'}</div>`;
    return;
  }

  const pending = _currentTab === 'pendientes';
  const headers = pending
    ? ['Cédula', 'Nombre', 'Cargo', 'Área', 'Registrado', '']
    : ['Cédula', 'Nombre', 'Cargo', 'Área', 'Usuario', 'Fecha completado', ''];

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          ${headers.map(h =>
            `<th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-2);
                        font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${h}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>
        ${list.map(emp => _renderRow(emp, pending)).join('')}
      </tbody>
    </table>`;
}

const _BTN = (onclick, bg, label) =>
  `<button onclick="${onclick}"
     style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;
            background:${bg};color:#fff;border:none;border-radius:6px;font-size:12px;
            font-weight:500;cursor:pointer;white-space:nowrap;font-family:inherit;
            transition:opacity .15s;"
     onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">${label}</button>`;

function _renderRow(emp, pending) {
  const btnComplete = can('employees:edit')
    ? _BTN(`window._empComplete(${emp.id})`, 'var(--success)', '&#10003; Completar') : '';
  const btnEdit = can('employees:edit')
    ? _BTN(`window._empEdit(${emp.id})`, 'var(--primary)', '&#9998; Editar') : '';
  const btnDelete = can('employees:delete')
    ? _BTN(`window._empDelete(${emp.id})`, 'var(--danger)', '&#10005; Eliminar') : '';
  const btnCreds = !pending && can('employees:read')
    ? _BTN(`window._empCreds(${emp.id})`, '#6366f1', `${iconEye(12)} Ver credenciales`) : '';

  const actions = `<div style="display:flex;gap:6px;flex-wrap:wrap;">
    ${pending ? btnComplete : btnCreds}${btnEdit}${btnDelete}
  </div>`;

  const extraCols = pending
    ? `<td style="padding:10px 12px;font-size:12px;color:var(--text-3);">
         ${emp.created_at ? _fmtDate(emp.created_at) : '—'}
       </td>`
    : `<td style="padding:10px 12px;font-size:13px;font-family:monospace;">${_esc(emp.usuario || '—')}</td>
       <td style="padding:10px 12px;font-size:13px;">
         ${emp.fecha_respuesta_soporte ? _fmtDate(emp.fecha_respuesta_soporte) : '—'}
       </td>`;

  return `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px 12px;font-size:13px;">${_esc(emp.cedula)}</td>
      <td style="padding:10px 12px;font-size:13px;">${_esc(emp.nombre_completo)}</td>
      <td style="padding:10px 12px;font-size:13px;">${_esc(emp.cargo)}</td>
      <td style="padding:10px 12px;font-size:13px;max-width:160px;overflow:hidden;
                 text-overflow:ellipsis;white-space:nowrap;" title="${_esc(emp.area)}">${_esc(emp.area)}</td>
      ${extraCols}
      <td style="padding:10px 12px;">${actions}</td>
    </tr>`;
}

// ─── Modal: crear / editar ────────────────────────────────────────────────────
async function _openModal(id) {
  _editingId = id;
  _clearError();

  const itSection = document.getElementById('emp-it-section');

  if (!id) {
    document.getElementById('emp-modal-title').textContent = 'Nuevo empleado';
    document.getElementById('emp-cedula').readOnly = false;
    document.getElementById('emp-form').reset();
    itSection.style.display = 'none';
    _initCombo('emp-cargo-text', 'emp-cargo-list', 'emp-cargo', _cargos, '');
    _initCombo('emp-area-text',  'emp-area-list',  'emp-area',  _areas,  '');
  } else {
    document.getElementById('emp-modal-title').textContent = 'Editar empleado';
    const emp = _employees.find(e => e.id === id);
    if (emp) {
      document.getElementById('emp-cedula').value    = emp.cedula;
      document.getElementById('emp-cedula').readOnly = true;
      document.getElementById('emp-nombre').value    = emp.nombre_completo || '';
      _initCombo('emp-cargo-text', 'emp-cargo-list', 'emp-cargo', _cargos, emp.cargo || '');
      _initCombo('emp-area-text',  'emp-area-list',  'emp-area',  _areas,  emp.area  || '');

      if (!_isPending(emp)) {
        document.getElementById('emp-usuario').value       = emp.usuario || '';
        document.getElementById('emp-contrasena').value    = emp.contraseña ? '••••••' : '';
        document.getElementById('emp-fecha-display').value =
          emp.fecha_respuesta_soporte ? _fmtDate(emp.fecha_respuesta_soporte) : '';
        itSection.style.display = 'block';
      } else {
        itSection.style.display = 'none';
      }
    }
  }

  document.getElementById('emp-modal').style.display = 'flex';
}

function _closeModal() {
  document.getElementById('emp-modal').style.display = 'none';
  _editingId = null;
}

// ─── Save (solo campos GH) ────────────────────────────────────────────────────
async function _save() {
  _clearError();

  const cedula = document.getElementById('emp-cedula').value.trim();
  const nombre = document.getElementById('emp-nombre').value.trim();
  const cargo  = document.getElementById('emp-cargo').value;
  const area   = document.getElementById('emp-area').value;

  if (!/^\d{8,12}$/.test(cedula)) return _showError('Cédula debe tener 8-12 dígitos.');
  if (nombre.length < 3)          return _showError('Nombre debe tener al menos 3 caracteres.');
  if (!cargo)                     return _showError('Selecciona un cargo.');
  if (!area)                      return _showError('Selecciona un área.');

  const btn = document.getElementById('emp-btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    let res, body;

    if (!_editingId) {
      res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, nombre_completo: nombre, cargo, area }),
      });
    } else {
      res = await fetch(`/api/employees/${_editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: nombre, cargo, area }),
      });
    }

    body = await res.json();
    if (!res.ok) { _showError(body.error || 'Error al guardar.'); return; }

    _closeModal();
    await _loadEmployees();
    showToast(
      _editingId ? 'Empleado actualizado.' : 'Empleado registrado — aparece en pendientes.',
      'success'
    );
  } catch (e) {
    console.error(e);
    _showError('Error de conexión.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

// ─── Modal: completar (IT) ────────────────────────────────────────────────────
function _openCompleteModal(id) {
  _completingId = id;
  const emp = _employees.find(e => e.id === id);
  if (!emp) return;

  document.getElementById('emp-complete-name').textContent = emp.nombre_completo;
  document.getElementById('emp-complete-fecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('emp-complete-modal').style.display = 'flex';
}

function _closeCompleteModal() {
  document.getElementById('emp-complete-modal').style.display = 'none';
  _completingId = null;
}

async function _confirmComplete() {
  const fecha = document.getElementById('emp-complete-fecha').value;
  if (!fecha) { showToast('Selecciona una fecha de gestión.', 'error'); return; }

  const btn = document.getElementById('emp-complete-confirm');
  btn.disabled = true;
  btn.textContent = 'Procesando...';

  try {
    const res = await fetch(`/api/employees/${_completingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha_respuesta_soporte: fecha }),
    });
    const body = await res.json();

    if (!res.ok) { showToast(body.error || 'Error al completar.', 'error'); return; }

    const empName = _employees.find(e => e.id === _completingId)?.nombre_completo || '';
    _closeCompleteModal();
    await _loadEmployees();

    if (body.usuario && body.contraseña) {
      _showCredsModal(empName, body.usuario, body.contraseña);
    } else {
      showToast('Gestión completada.', 'success');
    }
  } catch (e) {
    console.error(e);
    showToast('Error de conexión.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Completar';
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function _delete(id) {
  if (!confirm('¿Eliminar este empleado?')) return;
  try {
    const r = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    if (!r.ok) { showToast('Error al eliminar.', 'error'); return; }
    await _loadEmployees();
    showToast('Empleado eliminado.', 'success');
  } catch { showToast('Error de conexión.', 'error'); }
}

// ─── Globals for inline onclick ───────────────────────────────────────────────
window._empEdit     = id => _openModal(id);
window._empDelete   = id => _delete(id);
window._empComplete = id => _openCompleteModal(id);
window._empCreds    = id => {
  const emp = _employees.find(e => e.id === id);
  if (emp) _showCredsModal(emp.nombre_completo, emp.usuario, emp.contraseña);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _esc(t) {
  if (!t) return '';
  return String(t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function _fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; }
}

// ─── Modal: credenciales ─────────────────────────────────────────────────────
function _showCredsModal(nombre, usuario, contraseña) {
  document.getElementById('emp-creds-name').textContent = nombre;
  document.getElementById('emp-creds-user').value = usuario;
  document.getElementById('emp-creds-pass').value = contraseña;
  document.getElementById('emp-creds-copy-user').textContent = 'Copiar';
  document.getElementById('emp-creds-copy-pass').textContent = 'Copiar';
  document.getElementById('emp-creds-modal').style.display = 'flex';
}

function _closeCredsModal() {
  document.getElementById('emp-creds-modal').style.display = 'none';
}

function _copyField(inputId, btnId) {
  const val = document.getElementById(inputId)?.value;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.textContent = '✓ Copiado';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = 'Copiar';
      btn.style.background = '';
    }, 2000);
  });
}

// ─── Combobox buscable ────────────────────────────────────────────────────────
function _initCombo(textId, listId, hiddenId, items, initialValue) {
  const textEl   = document.getElementById(textId);
  const listEl   = document.getElementById(listId);
  const hiddenEl = document.getElementById(hiddenId);
  if (!textEl || !listEl || !hiddenEl) return;

  textEl.value   = initialValue;
  hiddenEl.value = initialValue;

  function render(filter) {
    const q = (filter || '').toLowerCase();
    const hits = q ? items.filter(i => i.nombre.toLowerCase().includes(q) || (i.ciudad && i.ciudad.toLowerCase().includes(q))) : items;
    if (!hits.length) {
      listEl.innerHTML =
        `<div style="padding:9px 12px;font-size:13px;color:var(--text-3);">Sin resultados</div>`;
    } else {
      listEl.innerHTML = hits.map(i => {
        const nombre = _esc(i.nombre);
        const ciudad = i.ciudad ? _esc(i.ciudad) : '';
        const displayLabel = ciudad ? `${nombre} <span style="color:var(--text-3);font-size:12px;">(${ciudad})</span>` : nombre;
        return `<div class="emp-combo-opt" data-val="${nombre}"
          style="padding:8px 12px;font-size:13px;cursor:pointer;color:var(--text-1);
                 transition:background .1s;">${displayLabel}</div>`;
      }).join('');
      listEl.querySelectorAll('.emp-combo-opt').forEach(opt => {
        opt.addEventListener('mouseover',  () => { opt.style.background = 'var(--surface-2)'; });
        opt.addEventListener('mouseout',   () => { opt.style.background = ''; });
        opt.addEventListener('mousedown', e => {
          e.preventDefault();
          textEl.value   = opt.dataset.val;
          hiddenEl.value = opt.dataset.val;
          listEl.style.display = 'none';
        });
      });
    }
    listEl.style.display = 'block';
  }

  textEl.addEventListener('focus', () => render(textEl.value));
  textEl.addEventListener('input', () => {
    hiddenEl.value = '';
    render(textEl.value);
  });
  textEl.addEventListener('blur', () => {
    setTimeout(() => { listEl.style.display = 'none'; }, 150);
    const match = items.find(i => i.nombre.toLowerCase() === textEl.value.trim().toLowerCase());
    if (match) {
      textEl.value   = match.nombre;
      hiddenEl.value = match.nombre;
    } else if (!items.some(i => i.nombre === hiddenEl.value)) {
      hiddenEl.value = '';
    }
  });
}

function _showError(msg) {
  const el = document.getElementById('emp-modal-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function _clearError() {
  const el = document.getElementById('emp-modal-error');
  if (el) el.style.display = 'none';
}
