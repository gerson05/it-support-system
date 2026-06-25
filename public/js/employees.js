import { showToast } from './components.js';

let _employees = [];
let _cargos = [];
let _areas = [];
let _editingId = null;
let _currentTab = 'pendientes';

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function renderEmployees(container) {
  container.innerHTML = `
  <div class="page-header">
    <div>
      <h2 class="page-title">Creación de Usuarios</h2>
      <p class="page-subtitle">Personal nuevo — flujo Gestión Humana → IT</p>
    </div>
    <button class="btn btn-primary" id="emp-btn-new">+ Nuevo empleado</button>
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

  <!-- Modal -->
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
                <select id="emp-cargo" class="form-control" required>
                  <option value="">Seleccionar...</option>
                </select>
              </div>
              <div class="form-group">
                <label>Área / Punto <span style="color:var(--danger)">*</span></label>
                <select id="emp-area" class="form-control" required>
                  <option value="">Seleccionar...</option>
                </select>
              </div>
            </div>
          </div>

          <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);
                      border-radius:8px;padding:14px 16px;">
            <div style="font-size:11px;font-weight:600;color:var(--danger);text-transform:uppercase;
                        letter-spacing:0.5px;margin-bottom:12px;">IT — Acceso al sistema</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label>Usuario</label>
                <input type="text" id="emp-usuario" class="form-control" readonly
                       placeholder="Auto-generado" style="background:var(--surface-2);color:var(--text-2);">
              </div>
              <div class="form-group">
                <label>Contraseña</label>
                <input type="text" id="emp-contrasena" class="form-control" readonly
                       placeholder="Auto-generada" style="background:var(--surface-2);color:var(--text-2);">
              </div>
            </div>
            <div class="form-group">
              <label>Fecha respuesta soporte</label>
              <input type="date" id="emp-fecha" class="form-control">
              <small style="color:var(--text-3);font-size:12px;margin-top:4px;display:block;">
                Al guardar con fecha, se generan usuario y contraseña automáticamente.
              </small>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="emp-btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="emp-btn-save">Guardar</button>
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
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => _switchTab(btn.dataset.tab));
  });

  // cédula — solo dígitos
  document.getElementById('emp-cedula').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
  });

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
  } catch { /* silencioso */ }
}

async function _loadAreas() {
  try {
    const r = await fetch('/api/employees-data/areas');
    if (!r.ok) return;
    _areas = await r.json();
  } catch { /* silencioso */ }
}

// ─── Tab ─────────────────────────────────────────────────────────────────────
function _switchTab(tab) {
  _currentTab = tab;
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
    btn.style.color = active ? 'var(--primary)' : 'var(--text-2)';
    btn.style.fontWeight = active ? '600' : '500';
  });
  _renderTab();
}

function _renderTab() {
  const isPending = emp => !emp.usuario || !emp.contraseña || !emp.fecha_respuesta_soporte;
  const list = _employees.filter(e => _currentTab === 'pendientes' ? isPending(e) : !isPending(e));
  const el = document.getElementById('emp-tab-content');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-3);font-size:14px;">
      No hay empleados en esta categoría.</div>`;
    return;
  }

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          ${['Cédula','Nombre','Cargo','Área','Estado','Usuario','Fecha',''].map(h =>
            `<th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text-2);
                        font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${h}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>
        ${list.map(emp => {
          const done = !isPending(emp);
          const badge = done
            ? `<span style="background:rgba(16,185,129,.15);color:var(--success);
                            padding:3px 8px;border-radius:99px;font-size:11px;font-weight:500;">Completado</span>`
            : `<span style="background:rgba(245,158,11,.15);color:var(--warning);
                            padding:3px 8px;border-radius:99px;font-size:11px;font-weight:500;">Pendiente</span>`;
          return `
          <tr style="border-bottom:1px solid var(--border);" class="emp-row">
            <td style="padding:10px 12px;font-size:13px;">${_esc(emp.cedula)}</td>
            <td style="padding:10px 12px;font-size:13px;">${_esc(emp.nombre_completo)}</td>
            <td style="padding:10px 12px;font-size:13px;">${_esc(emp.cargo)}</td>
            <td style="padding:10px 12px;font-size:13px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                title="${_esc(emp.area)}">${_esc(emp.area)}</td>
            <td style="padding:10px 12px;">${badge}</td>
            <td style="padding:10px 12px;font-size:13px;font-family:monospace;">${_esc(emp.usuario || '—')}</td>
            <td style="padding:10px 12px;font-size:13px;">${emp.fecha_respuesta_soporte ? _fmtDate(emp.fecha_respuesta_soporte) : '—'}</td>
            <td style="padding:10px 12px;">
              <div style="display:flex;gap:6px;">
                <button onclick="window._empEdit(${emp.id})"
                  style="padding:4px 10px;background:var(--primary);color:white;border:none;
                         border-radius:4px;font-size:12px;cursor:pointer;">Editar</button>
                <button onclick="window._empDelete(${emp.id})"
                  style="padding:4px 10px;background:var(--danger);color:white;border:none;
                         border-radius:4px;font-size:12px;cursor:pointer;">Eliminar</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
async function _openModal(id) {
  _editingId = id;
  _clearError();

  // populate dropdowns fresh
  const cargoSel = document.getElementById('emp-cargo');
  const areaSel  = document.getElementById('emp-area');
  cargoSel.innerHTML = '<option value="">Seleccionar...</option>' +
    _cargos.map(c => `<option value="${_esc(c.nombre)}">${_esc(c.nombre)}</option>`).join('');
  areaSel.innerHTML = '<option value="">Seleccionar...</option>' +
    _areas.map(a => `<option value="${_esc(a.nombre)}">${_esc(a.nombre)}</option>`).join('');

  if (!id) {
    document.getElementById('emp-modal-title').textContent = 'Nuevo empleado';
    document.getElementById('emp-cedula').readOnly = false;
    document.getElementById('emp-form').reset();
  } else {
    document.getElementById('emp-modal-title').textContent = 'Editar empleado';
    const emp = _employees.find(e => e.id === id);
    if (emp) {
      document.getElementById('emp-cedula').value = emp.cedula;
      document.getElementById('emp-cedula').readOnly = true;
      document.getElementById('emp-nombre').value = emp.nombre_completo || '';
      document.getElementById('emp-cargo').value  = emp.cargo || '';
      document.getElementById('emp-area').value   = emp.area  || '';
      document.getElementById('emp-usuario').value   = emp.usuario  || '';
      document.getElementById('emp-contrasena').value = emp.contraseña ? '••••' : '';
      document.getElementById('emp-fecha').value  = emp.fecha_respuesta_soporte || '';
    }
  }

  document.getElementById('emp-modal').style.display = 'flex';
}

function _closeModal() {
  document.getElementById('emp-modal').style.display = 'none';
  _editingId = null;
}

// ─── Save ─────────────────────────────────────────────────────────────────────
async function _save() {
  _clearError();

  const cedula  = document.getElementById('emp-cedula').value.trim();
  const nombre  = document.getElementById('emp-nombre').value.trim();
  const cargo   = document.getElementById('emp-cargo').value;
  const area    = document.getElementById('emp-area').value;
  const fecha   = document.getElementById('emp-fecha').value;

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
      const payload = { nombre_completo: nombre, cargo, area };
      if (fecha) payload.fecha_respuesta_soporte = fecha;
      res = await fetch(`/api/employees/${_editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    body = await res.json();

    if (!res.ok) {
      _showError(body.error || 'Error al guardar.');
      return;
    }

    _closeModal();
    await _loadEmployees();

    // Mostrar credenciales si se completó
    if (body.usuario && body.contraseña) {
      showToast(`✅ Completado — Usuario: ${body.usuario} | Contraseña: ${body.contraseña}`, 'success');
    } else {
      showToast(_editingId ? 'Empleado actualizado.' : 'Empleado creado.', 'success');
    }
  } catch (e) {
    console.error(e);
    _showError('Error de conexión.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
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
window._empEdit   = id => _openModal(id);
window._empDelete = id => _delete(id);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _esc(t) {
  if (!t) return '';
  return String(t).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}

function _fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; }
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
