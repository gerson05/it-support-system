import { showToast, copyToClipboard } from '../../ui/components.js';
import { can } from '../../core/state.js';
import { iconEye, iconPlus } from '../../utils/icons.js';

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
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-secondary" id="emp-btn-catalogos"
        style="${!can('employees:edit') ? 'display:none;' : ''}">Catálogos Mantis</button>
      <button class="btn btn-primary btn-create" id="emp-btn-new"
        style="${!can('employees:create') ? 'display:none;' : ''}">${iconPlus(14)} Nuevo empleado</button>
    </div>
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
            <div id="emp-legacy-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
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

            <!-- Flujo Mantis: usuario/clave automáticos + catálogos -->
            <div id="emp-mantis-fields" style="display:none;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                  <label>Usuario <span style="color:var(--text-3);font-weight:400;">(automático)</span></label>
                  <div style="display:flex;gap:6px;">
                    <input type="text" id="emp-m-usuario" class="form-control" autocomplete="off"
                           style="font-family:monospace;text-transform:uppercase;">
                    <button type="button" id="emp-m-usuario-regen" class="btn btn-secondary" title="Volver a generar"
                            style="padding:0 10px;">↻</button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Clave (4 dígitos) <span style="color:var(--text-3);font-weight:400;">(automática)</span></label>
                  <div style="display:flex;gap:6px;">
                    <input type="text" id="emp-m-clave" class="form-control" autocomplete="off" maxlength="4"
                           inputmode="numeric" style="font-family:monospace;">
                    <button type="button" id="emp-m-clave-regen" class="btn btn-secondary" title="Generar otra"
                            style="padding:0 10px;">↻</button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Cargo <span style="color:var(--danger)">*</span></label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <div style="position:relative;flex:1;">
                    <input type="text" id="emp-m-cargo" class="form-control" placeholder="Escribe para buscar…" autocomplete="off">
                    <div id="emp-m-cargo-list" class="emp-async-list"></div>
                  </div>
                  <span title="Código de perfil en Mantis" class="emp-code-badge" id="emp-m-perfil">—</span>
                </div>
              </div>

              <div class="form-group">
                <label>Sede <span style="color:var(--danger)">*</span></label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <div style="position:relative;flex:1;">
                    <input type="text" id="emp-m-sede" class="form-control" placeholder="Escribe para buscar…" autocomplete="off">
                    <div id="emp-m-sede-list" class="emp-async-list"></div>
                  </div>
                  <span title="Número de bodega" class="emp-code-badge" id="emp-m-bodega">—</span>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0;">
                <label>Comprobante <span style="color:var(--text-3);font-weight:400;">(automático según la sede)</span></label>
                <input type="text" id="emp-m-comprobante" class="form-control" autocomplete="off" maxlength="20"
                       style="font-family:monospace;text-transform:uppercase;max-width:160px;">
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
        <h3 id="emp-creds-title">Credenciales generadas</h3>
        <button class="modal-close" id="emp-creds-close">&times;</button>
      </div>
      <div class="modal-body">
        <p id="emp-creds-name"
           style="font-size:13px;color:var(--text-2);margin-bottom:16px;"></p>
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-2);
                          text-transform:uppercase;letter-spacing:.5px;">Cédula</label>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <input type="text" id="emp-creds-cedula" readonly class="form-control"
                     style="font-family:monospace;font-size:15px;font-weight:600;
                            background:var(--surface-2);">
              <button id="emp-creds-copy-cedula"
                style="padding:0 14px;background:var(--primary);color:#fff;border:none;
                       border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
                Copiar
              </button>
            </div>
          </div>
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
          <div id="emp-creds-extra" style="display:grid;gap:12px;"></div>
        </div>
        <div id="emp-creds-mantis-note" style="display:none;margin-top:14px;font-size:12px;color:var(--text-3);">
          Copia estos datos en Mantis para crear el usuario. Cuando quede creado, márcalo con
          <strong>"✓ Creado en Mantis"</strong> en la lista de pendientes.
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
        <h3 id="emp-complete-title">Completar gestión IT</h3>
        <button class="modal-close" id="emp-complete-close">&times;</button>
      </div>
      <div class="modal-body">
        <p id="emp-complete-name"
           style="font-size:14px;font-weight:600;color:var(--text-1);margin-bottom:12px;"></p>
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);
                    border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text-2);margin-bottom:16px;">
          <span id="emp-complete-info">Al confirmar se generarán usuario y contraseña automáticamente.</span>
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
  </div>

  <!-- Modal: catálogos de Mantis -->
  <div id="emp-cat-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content" style="max-width:640px;">
      <div class="modal-header">
        <h3>Catálogos de Mantis</h3>
        <button class="modal-close" id="emp-cat-close">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-2);margin:0 0 14px;">
          Carga los Excel tal como se exportan de Mantis (.xls o .xlsx). Cada carga reemplaza el catálogo anterior.
        </p>
        <div id="emp-cat-rows" style="display:grid;gap:10px;"></div>
        <div id="emp-cat-sin" style="margin-top:18px;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="emp-cat-done">Cerrar</button>
      </div>
    </div>
  </div>

  <style>
    .emp-async-list { display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);
      border:1px solid var(--border);border-radius:6px;max-height:220px;overflow-y:auto;z-index:999;
      box-shadow:0 4px 12px rgba(0,0,0,.18);margin-top:2px; }
    .emp-async-opt { padding:8px 12px;font-size:13px;cursor:pointer;display:flex;justify-content:space-between;gap:10px; }
    .emp-async-opt.active, .emp-async-opt:hover { background:var(--surface-2); }
    .emp-async-opt .code { font-family:monospace;color:var(--primary);font-weight:600;white-space:nowrap; }
    .emp-code-badge { min-width:58px;text-align:center;padding:7px 10px;border:1px solid var(--border);
      border-radius:6px;font-family:monospace;font-weight:700;color:var(--primary);background:var(--surface-2); }
    .emp-mantis-badge { display:inline-block;margin-top:3px;padding:1px 7px;border-radius:99px;font-size:10.5px;font-weight:600; }
  </style>`;

  // ── event listeners ──────────────────────────────────────────────────────
  document.getElementById('emp-modal-close').addEventListener('click', _closeModal);
  document.getElementById('emp-btn-cancel').addEventListener('click', _closeModal);
  document.getElementById('emp-btn-save').addEventListener('click', _save);
  // El cierre por backdrop está deshabilitado; solo cierra con la X o Cancelar.
  document.getElementById('emp-btn-new').addEventListener('click', () => _openModal(null));

  document.getElementById('emp-creds-close').addEventListener('click', _closeCredsModal);
  document.getElementById('emp-creds-done').addEventListener('click', _closeCredsModal);
  // El cierre por backdrop está deshabilitado; solo cierra con la X o el botón de cierre.
  document.getElementById('emp-creds-copy-cedula').addEventListener('click', () =>
    _copyField('emp-creds-cedula', 'emp-creds-copy-cedula'));
  document.getElementById('emp-creds-copy-user').addEventListener('click', () =>
    _copyField('emp-creds-user', 'emp-creds-copy-user'));
  document.getElementById('emp-creds-copy-pass').addEventListener('click', () =>
    _copyField('emp-creds-pass', 'emp-creds-copy-pass'));

  document.getElementById('emp-complete-close').addEventListener('click', _closeCompleteModal);
  document.getElementById('emp-complete-cancel').addEventListener('click', _closeCompleteModal);
  document.getElementById('emp-complete-confirm').addEventListener('click', _confirmComplete);
  // El cierre por backdrop está deshabilitado; solo cierra con la X o Cancelar.

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

  // ── Flujo Mantis ──
  document.getElementById('emp-btn-catalogos').addEventListener('click', _openCatalogos);
  document.getElementById('emp-cat-close').addEventListener('click', _closeCatalogos);
  document.getElementById('emp-cat-done').addEventListener('click', _closeCatalogos);
  document.getElementById('emp-m-usuario-regen').addEventListener('click', () => _suggestUsuario(true));
  document.getElementById('emp-m-clave-regen').addEventListener('click', _suggestClave);
  document.getElementById('emp-m-usuario').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    _usuarioTouched = true;
  });
  document.getElementById('emp-m-clave').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
  document.getElementById('emp-m-comprobante').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase();
  });
  let _nombreTimer = null;
  document.getElementById('emp-nombre').addEventListener('input', () => {
    clearTimeout(_nombreTimer);
    _nombreTimer = setTimeout(() => _suggestUsuario(false), 350);
  });
  _asyncCombo('emp-m-cargo', 'emp-m-cargo-list', '/api/mantis/perfiles',
    p => ({ label: p.nombre, code: p.codigo }),
    p => {
      _mantisSel.perfil = p;
      document.getElementById('emp-m-perfil').textContent = p ? p.codigo : '—';
    });
  _asyncCombo('emp-m-sede', 'emp-m-sede-list', '/api/mantis/bodegas',
    b => ({ label: b.nombre, code: b.codigo, hint: b.ciudad }),
    b => {
      _mantisSel.bodega = b;
      document.getElementById('emp-m-bodega').textContent = b ? b.codigo : '—';
      document.getElementById('emp-m-comprobante').value = b?.comprobante || '';
      if (b && !b.comprobante) showToast('Esta sede no tiene comprobante asignado: escríbelo a mano.', 'info');
    });

  await Promise.all([_loadCargos(), _loadAreas(), _loadEmployees(), _loadMantisStatus()]);
}

let _usuarioTouched = false;
let _mantisConfigured = false;
const _mantisSel = { perfil: null, bodega: null };

async function _loadMantisStatus() {
  try {
    const r = await fetch('/api/employees/mantis-status');
    if (r.ok) _mantisConfigured = Boolean((await r.json()).configured);
  } catch { /* silencioso */ }
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
  if (emp.mantis_estado) return emp.mantis_estado !== 'creado';
  return !emp.usuario || !emp.contraseña || !emp.fecha_respuesta_soporte;
}

const _MANTIS_BADGE = {
  pendiente: ['Mantis: pendiente', 'rgba(245,158,11,.15)', '#f59e0b'],
  creado:    ['Mantis: creado',    'rgba(16,185,129,.15)', 'var(--success)'],
  error:     ['Mantis: error',     'rgba(239,68,68,.15)',  'var(--danger)'],
};

function _mantisBadge(emp) {
  const b = _MANTIS_BADGE[emp.mantis_estado];
  if (!b) return '';
  const title = emp.mantis_error ? ` title="${_esc(emp.mantis_error)}"` : '';
  return `<br><span class="emp-mantis-badge" style="background:${b[1]};color:${b[2]};"${title}>${b[0]}</span>`;
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
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
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
    </table>
    </div>`;
}

const _BTN = (onclick, bg, label) =>
  `<button onclick="${onclick}"
     style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;
            background:${bg};color:#fff;border:none;border-radius:6px;font-size:12px;
            font-weight:500;cursor:pointer;white-space:nowrap;font-family:inherit;
            transition:opacity .15s;"
     onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">${label}</button>`;

function _renderRow(emp, pending) {
  const mantis = Boolean(emp.mantis_estado);
  const btnComplete = can('employees:edit')
    ? _BTN(`window._empComplete(${emp.id})`, 'var(--success)', mantis ? '&#10003; Creado en Mantis' : '&#10003; Completar') : '';
  const btnFicha = mantis && can('employees:read')
    ? _BTN(`window._empCreds(${emp.id})`, '#6366f1', `${iconEye(12)} Ficha Mantis`) : '';
  const btnEnviar = mantis && _mantisConfigured && can('employees:edit')
    ? _BTN(`window._empSendMantis(${emp.id})`, '#0ea5e9', 'Enviar a Mantis') : '';
  const btnEdit = can('employees:edit')
    ? _BTN(`window._empEdit(${emp.id})`, 'var(--primary)', '&#9998; Editar') : '';
  const btnDelete = can('employees:delete')
    ? _BTN(`window._empDelete(${emp.id})`, 'var(--danger)', '&#10005; Eliminar') : '';
  const btnCreds = !pending && can('employees:read')
    ? _BTN(`window._empCreds(${emp.id})`, '#6366f1', `${iconEye(12)} Ver credenciales`) : '';

  const actions = `<div style="display:flex;gap:6px;flex-wrap:wrap;">
    ${pending ? `${mantis ? btnFicha + btnEnviar : ''}${btnComplete}` : btnCreds}${btnEdit}${btnDelete}
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
      <td style="padding:10px 12px;font-size:13px;">${_esc(emp.nombre_completo)}${_mantisBadge(emp)}</td>
      <td style="padding:10px 12px;font-size:13px;">${_esc(emp.cargo)}${emp.perfil_codigo != null
        ? ` <span style="font-family:monospace;color:var(--primary);font-size:12px;">(${_esc(emp.perfil_codigo)})</span>` : ''}</td>
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
  const emp = id ? _employees.find(e => e.id === id) : null;
  _setMantisMode(!id || Boolean(emp?.mantis_estado));

  if (!id) {
    document.getElementById('emp-modal-title').textContent = 'Nuevo empleado';
    document.getElementById('emp-cedula').readOnly = false;
    document.getElementById('emp-form').reset();
    itSection.style.display = 'none';
    _resetMantisFields();
    _suggestClave();
  } else if (emp?.mantis_estado) {
    document.getElementById('emp-modal-title').textContent = 'Editar empleado';
    document.getElementById('emp-cedula').value    = emp.cedula;
    document.getElementById('emp-cedula').readOnly = true;
    document.getElementById('emp-nombre').value    = emp.nombre_completo || '';
    itSection.style.display = 'none';
    _resetMantisFields({
      usuario: emp.usuario, clave: emp.contraseña, comprobante: emp.comprobante,
      perfil: emp.perfil_codigo != null ? { codigo: emp.perfil_codigo, nombre: emp.cargo } : null,
      bodega: emp.bodega_codigo != null ? { codigo: emp.bodega_codigo, nombre: emp.sede || emp.area, comprobante: emp.comprobante } : null,
    });
    _usuarioTouched = true;
  } else {
    document.getElementById('emp-modal-title').textContent = 'Editar empleado';
    if (emp) {
      document.getElementById('emp-cedula').value    = emp.cedula;
      document.getElementById('emp-cedula').readOnly = true;
      document.getElementById('emp-nombre').value    = emp.nombre_completo || '';
      _initCombo('emp-cargo-text', 'emp-cargo-list', 'emp-cargo', _cargos, emp.cargo || '', _addCargo);
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

  if (!/^\d{8,12}$/.test(cedula)) return _showError('Cédula debe tener 8-12 dígitos.');
  if (nombre.length < 3)          return _showError('Nombre debe tener al menos 3 caracteres.');

  if (_isMantisMode()) return _saveMantis(cedula, nombre);

  const cargo  = document.getElementById('emp-cargo').value;
  const area   = document.getElementById('emp-area').value;
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
  const mantis = Boolean(emp.mantis_estado);
  document.getElementById('emp-complete-title').textContent = mantis ? 'Marcar como creado en Mantis' : 'Completar gestión IT';
  document.getElementById('emp-complete-info').textContent = mantis
    ? `Confirma que el usuario ${emp.usuario} ya quedó creado en Mantis. Pasará a "Completados".`
    : 'Al confirmar se generarán usuario y contraseña automáticamente.';
  document.getElementById('emp-complete-confirm').textContent = mantis ? 'Marcar creado' : 'Completar';
  const _t = new Date();
  document.getElementById('emp-complete-fecha').value =
    `${_t.getFullYear()}-${String(_t.getMonth()+1).padStart(2,'0')}-${String(_t.getDate()).padStart(2,'0')}`;
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

    const empRec  = _employees.find(e => e.id === _completingId);
    const empName = empRec?.nombre_completo || '';
    const empCedula = empRec?.cedula || '';
    _closeCompleteModal();
    await _loadEmployees();

    if (empRec?.mantis_estado) {
      showToast(`${empRec.usuario} marcado como creado en Mantis.`, 'success');
    } else if (body.usuario && body.contraseña) {
      _showCredsModal(empName, empCedula, body.usuario, body.contraseña);
    } else {
      showToast('Gestión completada.', 'success');
    }
  } catch (e) {
    console.error(e);
    showToast('Error de conexión.', 'error');
  } finally {
    btn.disabled = false;
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
  if (emp) _showCredsModal(emp.nombre_completo, emp.cedula, emp.usuario, emp.contraseña, _mantisExtra(emp));
};
window._empSendMantis = id => _sendMantis(id);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _esc(t) {
  if (!t) return '';
  return String(t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function _fmtDate(d) {
  if (!d) return '';
  try {
    const iso = d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T');
    return new Date(iso).toLocaleDateString('es-CO');
  } catch { return d; }
}

// ─── Modal: credenciales ─────────────────────────────────────────────────────
function _showCredsModal(nombre, cedula, usuario, contraseña, extra = null) {
  document.getElementById('emp-creds-name').textContent = nombre;
  document.getElementById('emp-creds-cedula').value = cedula;
  document.getElementById('emp-creds-user').value = usuario;
  document.getElementById('emp-creds-pass').value = contraseña;
  document.getElementById('emp-creds-copy-cedula').textContent = 'Copiar';
  document.getElementById('emp-creds-copy-user').textContent = 'Copiar';
  document.getElementById('emp-creds-copy-pass').textContent = 'Copiar';

  // Datos adicionales que pide Mantis (perfil, bodega, comprobante)
  const extraEl = document.getElementById('emp-creds-extra');
  extraEl.innerHTML = (extra || []).map(([label, value], i) => `
    <div>
      <label style="font-size:11px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;">${_esc(label)}</label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <input type="text" id="emp-creds-x${i}" readonly class="form-control" value="${_esc(value ?? '')}"
               style="font-family:monospace;font-size:15px;font-weight:600;background:var(--surface-2);">
        <button type="button" id="emp-creds-copy-x${i}"
          style="padding:0 14px;background:var(--primary);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;">
          Copiar
        </button>
      </div>
    </div>`).join('');
  (extra || []).forEach((_, i) => {
    document.getElementById(`emp-creds-copy-x${i}`).addEventListener('click', () => _copyField(`emp-creds-x${i}`, `emp-creds-copy-x${i}`));
  });
  document.getElementById('emp-creds-mantis-note').style.display = extra?.length ? 'block' : 'none';
  document.getElementById('emp-creds-title').textContent = extra?.length ? 'Ficha para Mantis' : 'Credenciales generadas';
  document.getElementById('emp-creds-modal').style.display = 'flex';
}

/** Filas extra de la ficha de Mantis para un empleado del flujo Mantis. */
function _mantisExtra(emp) {
  if (!emp?.mantis_estado) return null;
  return [
    ['Código de perfil', emp.perfil_codigo != null ? `${emp.perfil_codigo}` : ''],
    ['Cargo / perfil',   emp.cargo],
    ['Bodega',           emp.bodega_codigo != null ? `${emp.bodega_codigo}` : ''],
    ['Sede',             emp.sede || emp.area],
    ['Comprobante',      emp.comprobante],
  ];
}

function _closeCredsModal() {
  document.getElementById('emp-creds-modal').style.display = 'none';
}

async function _copyField(inputId, btnId) {
  const val = document.getElementById(inputId)?.value;
  if (!val) return;
  const ok = await copyToClipboard(val);
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (ok) {
    btn.textContent = '✓ Copiado';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = 'Copiar';
      btn.style.background = '';
    }, 2000);
  } else {
    showToast('No se pudo copiar', 'error');
  }
}

// ─── Cargo creator ───────────────────────────────────────────────────────────
async function _addCargo(nombre) {
  try {
    const res = await fetch('/api/employees-data/cargos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) { showToast('Error al crear cargo.', 'error'); return null; }
    const cargo = await res.json();
    if (!_cargos.some(c => c.id === cargo.id)) {
      _cargos.push(cargo);
      _cargos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      _populateFilterSelect('emp-filter-cargo', _cargos, 'Todos los cargos', _filterCargo);
    }
    return cargo;
  } catch {
    showToast('Error al crear cargo.', 'error');
    return null;
  }
}

// ─── Combobox buscable ────────────────────────────────────────────────────────
function _initCombo(textId, listId, hiddenId, items, initialValue, onCreate = null) {
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
      const addBtn = onCreate && filter.trim()
        ? `<div class="emp-combo-create"
             style="padding:8px 12px;font-size:13px;cursor:pointer;color:var(--primary);
                    border-top:1px solid var(--border);font-weight:500;transition:background .1s;">
             + Agregar &quot;${_esc(filter.trim())}&quot;
           </div>`
        : '';
      listEl.innerHTML =
        `<div style="padding:9px 12px;font-size:13px;color:var(--text-3);">Sin resultados</div>${addBtn}`;
      const createEl = listEl.querySelector('.emp-combo-create');
      if (createEl) {
        createEl.addEventListener('mouseover', () => { createEl.style.background = 'var(--surface-2)'; });
        createEl.addEventListener('mouseout',  () => { createEl.style.background = ''; });
        createEl.addEventListener('mousedown', async e => {
          e.preventDefault();
          const newName = filter.trim();
          createEl.textContent = 'Guardando...';
          const created = await onCreate(newName);
          if (created) {
            textEl.value   = created.nombre;
            hiddenEl.value = created.nombre;
            listEl.style.display = 'none';
          }
        });
      }
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

// ─── Flujo Mantis: formulario ────────────────────────────────────────────────
function _setMantisMode(on) {
  document.getElementById('emp-mantis-fields').style.display = on ? 'block' : 'none';
  document.getElementById('emp-legacy-fields').style.display = on ? 'none' : 'grid';
}

function _isMantisMode() {
  return document.getElementById('emp-mantis-fields').style.display !== 'none';
}

function _resetMantisFields({ usuario = '', clave = '', comprobante = '', perfil = null, bodega = null } = {}) {
  _usuarioTouched = false;
  _mantisSel.perfil = perfil;
  _mantisSel.bodega = bodega;
  document.getElementById('emp-m-usuario').value     = usuario || '';
  document.getElementById('emp-m-clave').value       = clave || '';
  document.getElementById('emp-m-comprobante').value = comprobante || '';
  document.getElementById('emp-m-cargo').value       = perfil?.nombre || '';
  document.getElementById('emp-m-perfil').textContent = perfil ? perfil.codigo : '—';
  document.getElementById('emp-m-sede').value        = bodega?.nombre || '';
  document.getElementById('emp-m-bodega').textContent = bodega ? bodega.codigo : '—';
}

/** Usuario según la regla de Mantis. No pisa uno escrito a mano salvo que se pida (botón ↻). */
async function _suggestUsuario(force) {
  if (!_isMantisMode() || (_usuarioTouched && !force)) return;
  const nombre = document.getElementById('emp-nombre').value.trim();
  if (nombre.split(/\s+/).length < 2) return;
  try {
    const r = await fetch(`/api/employees/sugerir-usuario?nombre=${encodeURIComponent(nombre)}`);
    if (!r.ok) return;
    const { usuario } = await r.json();
    document.getElementById('emp-m-usuario').value = usuario || '';
    if (force) _usuarioTouched = false;
  } catch { /* silencioso */ }
}

async function _suggestClave() {
  try {
    const r = await fetch('/api/employees/sugerir-clave');
    if (!r.ok) return;
    document.getElementById('emp-m-clave').value = (await r.json()).clave || '';
  } catch { /* silencioso */ }
}

async function _saveMantis(cedula, nombre) {
  const usuario     = document.getElementById('emp-m-usuario').value.trim();
  const contraseña  = document.getElementById('emp-m-clave').value.trim();
  const comprobante = document.getElementById('emp-m-comprobante').value.trim();

  if (!_mantisSel.perfil)        return _showError('Selecciona el cargo de la lista.');
  if (!_mantisSel.bodega)        return _showError('Selecciona la sede de la lista.');
  if (!comprobante)              return _showError('Falta el comprobante de la sede.');
  if (contraseña && !/^\d{4}$/.test(contraseña)) return _showError('La clave debe tener 4 dígitos.');

  const payload = {
    nombre_completo: nombre, usuario, contraseña, comprobante,
    perfil_codigo: _mantisSel.perfil.codigo,
    bodega_codigo: _mantisSel.bodega.codigo,
  };

  const btn = document.getElementById('emp-btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    const editing = _editingId;
    const res = await fetch(editing ? `/api/employees/${editing}` : '/api/employees', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? payload : { cedula, ...payload }),
    });
    const body = await res.json();
    if (!res.ok) { _showError(body.error || 'Error al guardar.'); return; }

    _closeModal();
    await _loadEmployees();
    if (editing) {
      showToast('Empleado actualizado.', 'success');
    } else {
      const emp = body.empleado;
      _showCredsModal(emp.nombre_completo, emp.cedula, emp.usuario, emp.contraseña, _mantisExtra(emp));
      showToast('Empleado registrado — pendiente de crear en Mantis.', 'success');
    }
  } catch (e) {
    console.error(e);
    _showError('Error de conexión.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function _sendMantis(id) {
  try {
    const r = await fetch(`/api/employees/${id}/mantis`, { method: 'POST' });
    const body = await r.json();
    if (!r.ok) { showToast(body.error || 'No se pudo enviar a Mantis.', 'error'); }
    else showToast('Usuario creado en Mantis.', 'success');
    await _loadEmployees();
  } catch { showToast('Error de conexión.', 'error'); }
}

/**
 * Lista que busca en el servidor mientras se escribe. Flechas para moverse,
 * Enter / Tab / clic para seleccionar, Esc para cerrar.
 * @param {(item) => {label, code, hint?}} toOption
 * @param {(item|null) => void} onSelect  null cuando se borra o cambia el texto
 */
function _asyncCombo(inputId, listId, url, toOption, onSelect) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(listId);
  let items = [], active = -1, timer = null, seq = 0;

  const close = () => { list.style.display = 'none'; active = -1; };
  const pick = (i) => {
    const item = items[i];
    if (!item) return;
    input.value = toOption(item).label;
    close();
    onSelect(item);
  };
  const paint = () => {
    if (!items.length) {
      list.innerHTML = `<div style="padding:9px 12px;font-size:13px;color:var(--text-3);">Sin resultados</div>`;
    } else {
      list.innerHTML = items.map((it, i) => {
        const o = toOption(it);
        return `<div class="emp-async-opt${i === active ? ' active' : ''}" data-i="${i}">
          <span>${_esc(o.label)}${o.hint ? ` <span style="color:var(--text-3);font-size:11px;">· ${_esc(o.hint)}</span>` : ''}</span>
          <span class="code">${_esc(o.code)}</span></div>`;
      }).join('');
      list.querySelectorAll('.emp-async-opt').forEach(el =>
        el.addEventListener('mousedown', e => { e.preventDefault(); pick(Number(el.dataset.i)); }));
    }
    list.style.display = 'block';
  };
  const search = async () => {
    const mySeq = ++seq;
    try {
      const r = await fetch(`${url}?q=${encodeURIComponent(input.value.trim())}`);
      if (!r.ok || mySeq !== seq) return;
      items = await r.json();
      active = items.length ? 0 : -1;
      paint();
    } catch { /* silencioso */ }
  };

  input.addEventListener('input', () => {
    onSelect(null);
    clearTimeout(timer);
    timer = setTimeout(search, 200);
  });
  input.addEventListener('focus', () => { if (!input.value.trim() || list.style.display === 'none') search(); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', e => {
    if (list.style.display === 'none' || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(active < 0 ? 0 : active); }
    else if (e.key === 'Tab') { pick(active < 0 ? 0 : active); }
    else if (e.key === 'Escape') { close(); }
  });
}

// ─── Flujo Mantis: catálogos ─────────────────────────────────────────────────
const _CATALOGOS = [
  ['perfiles',     'Códigos de perfil', 'Cargos'],
  ['bodegas',      'Bodegas',           'Sedes activas'],
  ['comprobantes', 'Comprobantes',      'Comprobantes'],
];

function _closeCatalogos() {
  document.getElementById('emp-cat-modal').style.display = 'none';
}

async function _openCatalogos() {
  document.getElementById('emp-cat-modal').style.display = 'flex';
  await _renderCatalogos();
}

async function _renderCatalogos() {
  const rowsEl = document.getElementById('emp-cat-rows');
  let estado = {};
  try { estado = await (await fetch('/api/mantis/catalogos')).json(); } catch { /* silencioso */ }

  rowsEl.innerHTML = _CATALOGOS.map(([tipo, titulo, unidad]) => {
    const st = estado[tipo] || {};
    const ultima = st.ultima
      ? `Última carga: ${_fmtDate(st.ultima.created_at)} · ${_esc(st.ultima.archivo || '')} · ${_esc(st.ultima.usuario || '')}`
      : 'Sin cargar todavía';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;">${titulo} <span style="color:var(--primary);">(${st.total ?? 0} ${unidad.toLowerCase()})</span></div>
          <div style="font-size:11.5px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ultima}</div>
        </div>
        <label class="btn btn-secondary" style="cursor:pointer;white-space:nowrap;">
          Cargar Excel
          <input type="file" accept=".xls,.xlsx" data-tipo="${tipo}" style="display:none;">
        </label>
      </div>`;
  }).join('');

  rowsEl.querySelectorAll('input[type=file]').forEach(inp =>
    inp.addEventListener('change', () => _uploadCatalog(inp.dataset.tipo, inp.files[0])));

  await _renderSinComprobante(estado.sin_comprobante ?? 0);
}

async function _uploadCatalog(tipo, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  showToast(`Cargando ${file.name}…`, 'info');
  try {
    const r = await fetch(`/api/mantis/catalogos/${tipo}`, { method: 'POST', body: fd });
    const body = await r.json();
    if (!r.ok) { showToast(body.error || 'No se pudo cargar el archivo.', 'error'); }
    else {
      const extra = body.enlazadas !== undefined ? ` · ${body.enlazadas} bodegas con comprobante` : '';
      showToast(`${body.filas} registros cargados${extra}.`, 'success');
    }
  } catch { showToast('Error de conexión.', 'error'); }
  await _renderCatalogos();
}

async function _renderSinComprobante(total) {
  const el = document.getElementById('emp-cat-sin');
  if (!total) { el.innerHTML = ''; return; }
  let rows = [];
  try { rows = await (await fetch('/api/mantis/bodegas/sin-comprobante')).json(); } catch { /* silencioso */ }

  el.innerHTML = `
    <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Sedes sin comprobante (${rows.length})</div>
    <p style="font-size:12px;color:var(--text-3);margin:0 0 8px;">
      No se pudieron enlazar automáticamente. Escribe el código del comprobante (ej. PAS) y guarda; se recuerda en las próximas cargas.
    </p>
    <div style="display:grid;gap:6px;max-height:260px;overflow-y:auto;">
      ${rows.map(b => `
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;">
          <span style="font-family:monospace;color:var(--primary);min-width:40px;">${_esc(b.codigo)}</span>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(b.nombre)}">${_esc(b.nombre)}</span>
          <input type="text" class="form-control" data-bodega="${_esc(b.codigo)}" maxlength="20" placeholder="Código"
                 style="width:90px;font-family:monospace;text-transform:uppercase;">
          <button type="button" class="btn btn-secondary" data-save="${_esc(b.codigo)}" style="padding:5px 10px;">Guardar</button>
        </div>`).join('')}
    </div>`;

  el.querySelectorAll('button[data-save]').forEach(btn => btn.addEventListener('click', async () => {
    const codigo = btn.dataset.save;
    const value = el.querySelector(`input[data-bodega="${codigo}"]`).value.trim().toUpperCase();
    if (!value) return;
    try {
      const r = await fetch(`/api/mantis/bodegas/${codigo}/comprobante`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comprobante: value }),
      });
      const body = await r.json();
      if (!r.ok) { showToast(body.error || 'No se pudo guardar.', 'error'); return; }
      showToast(`Bodega ${codigo} → ${body.comprobante}`, 'success');
      await _renderCatalogos();
    } catch { showToast('Error de conexión.', 'error'); }
  }));
}
