import { showToast } from './components.js';

let _modules = [];
let _roles   = [];
let _expandedId   = null;
let _originalPerms = {};
let _pendingPerms  = {};
let _isLoading = false;

export async function renderRolesTab(container) {
  container.innerHTML = `
    <div class="card">
      <div id="roles-wrap" style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
        <div class="loading-spinner"></div>
      </div>
    </div>`;
  await _loadAll();
}

async function _loadAll() {
  const wrap = document.getElementById('roles-wrap');
  try {
    const [rolesRes, permsRes] = await Promise.all([
      fetch('/api/roles'),
      fetch('/api/permissions'),
    ]);
    if (!rolesRes.ok || !permsRes.ok) throw new Error('Error del servidor');
    _roles   = await rolesRes.json();
    _modules = await permsRes.json();
    _expandedId = null;
    _originalPerms = {};
    _pendingPerms  = {};
    _renderList();
  } catch {
    if (wrap) wrap.innerHTML = `<p style="color:var(--danger);padding:20px;">Error cargando roles.</p>`;
  }
}

function _renderList() {
  const wrap = document.getElementById('roles-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    _roles.map(r => _cardHtml(r)).join('') +
    `<div id="new-role-area"></div>
     <div id="btn-add-role" style="
       display:flex;align-items:center;gap:6px;padding:10px 14px;
       border:1px dashed var(--border);border-radius:8px;cursor:pointer;
       color:var(--primary);font-size:13px;font-weight:600;
       transition:all .15s ease;">+ Nuevo rol</div>`;

  wrap.querySelectorAll('[data-role-header]').forEach(h => {
    h.addEventListener('click', () => _toggleCard(Number(h.dataset.roleHeader)));
  });
  document.getElementById('btn-add-role')?.addEventListener('click', _showNewRoleForm);
}

function _cardHtml(role) {
  const isIT = role.id === 1;
  return `
    <div id="role-card-${role.id}" style="
      background:var(--surface-2);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <div data-role-header="${role.id}" style="
        display:flex;justify-content:space-between;align-items:center;
        padding:10px 14px;cursor:${isIT ? 'default' : 'pointer'};
        transition:background .15s ease;"
        ${isIT ? '' : 'onmouseenter="this.style.background=\'var(--surface-3)\'" onmouseleave="this.style.background=\'\'"'}>
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.4px;">
              ${escHtml(role.name)}
            </span>
            ${isIT ? `<span style="font-size:10px;background:var(--surface-3);border:1px solid var(--border);color:var(--text-3);border-radius:4px;padding:1px 7px;">🔒 bloqueado</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${escHtml(role.description || '')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:11px;color:var(--text-3);background:var(--surface-3);border:1px solid var(--border);border-radius:4px;padding:2px 8px;">
            ${escHtml(String(role.user_count))} usuario${role.user_count !== 1 ? 's' : ''}
          </span>
          ${isIT ? '' : `<span style="font-size:11px;color:var(--text-3);" id="chevron-${role.id}">▼</span>`}
        </div>
      </div>
      <div id="role-body-${role.id}" style="display:none;"></div>
    </div>`;
}

async function _toggleCard(roleId) {
  if (_isLoading) return;
  if (roleId === 1) return;

  if (_expandedId && _expandedId !== roleId) {
    const orig = _originalPerms[_expandedId] ?? [];
    const pend = _pendingPerms[_expandedId] ?? [];
    const origSet = new Set(orig);
    const pendSet = new Set(pend);
    const hasChanges = origSet.size !== pendSet.size || [...origSet].some(id => !pendSet.has(id));
    if (hasChanges) {
      const role  = _roles.find(r => r.id === _expandedId);
      const other = _roles.find(r => r.id === roleId);
      if (!confirm(`¿Descartar cambios en "${role?.name}" y abrir "${other?.name}"?`)) return;
    }
    _collapseCard(_expandedId);
  }

  if (_expandedId === roleId) {
    _collapseCard(roleId);
    _expandedId = null;
    return;
  }

  _expandedId = roleId;
  const chevron = document.getElementById(`chevron-${roleId}`);
  if (chevron) chevron.textContent = '▲';

  const body = document.getElementById(`role-body-${roleId}`);
  body.style.display = 'block';
  body.innerHTML = `<div style="padding:12px;"><div class="loading-spinner" style="width:20px;height:20px;"></div></div>`;

  if (!_originalPerms[roleId]) {
    _isLoading = true;
    try {
      const res  = await fetch(`/api/roles/${roleId}/permissions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _originalPerms[roleId] = data.permission_ids ?? [];
      _pendingPerms[roleId]  = [..._originalPerms[roleId]];
    } catch {
      const body = document.getElementById(`role-body-${roleId}`);
      if (body) body.innerHTML = `<p style="color:var(--danger);padding:12px;">Error cargando permisos.</p>`;
      _expandedId = null;
      const chevron = document.getElementById(`chevron-${roleId}`);
      if (chevron) chevron.textContent = '▼';
      const card = document.getElementById(`role-card-${roleId}`);
      if (card) card.style.borderColor = 'var(--border)';
      _isLoading = false;
      return;
    } finally {
      _isLoading = false;
    }
  }

  _renderCardBody(roleId);
}

function _collapseCard(roleId) {
  const body = document.getElementById(`role-body-${roleId}`);
  if (body) body.style.display = 'none';
  const chevron = document.getElementById(`chevron-${roleId}`);
  if (chevron) chevron.textContent = '▼';
  const card = document.getElementById(`role-card-${roleId}`);
  if (card) card.style.borderColor = 'var(--border)';
}

function _renderCardBody(roleId) {
  const body = document.getElementById(`role-body-${roleId}`);
  if (!body) return;

  const card = document.getElementById(`role-card-${roleId}`);
  if (card) card.style.borderColor = 'var(--primary)';

  const active = new Set(_pendingPerms[roleId] ?? []);
  const role   = _roles.find(r => r.id === roleId);

  const ACTIONS = ['read', 'create', 'edit', 'delete'];
  const rows = _modules.map(mod => {
    const cells = ACTIONS.map(action => {
      const perm = mod.permissions.find(p => p.action === action);
      if (!perm) {
        return `<td style="text-align:center;"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:var(--surface-3);opacity:.3;"></span></td>`;
      }
      return `<td style="text-align:center;">
        <input type="checkbox" data-perm-id="${perm.id}" data-role-id="${roleId}"
          ${active.has(perm.id) ? 'checked' : ''}
          style="width:14px;height:14px;cursor:pointer;accent-color:var(--primary);">
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:6px 0;font-size:13px;color:var(--text-1);">${escHtml(mod.label)}</td>
      ${cells}
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div style="padding:12px 14px 14px;border-top:1px solid var(--border);">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:var(--text-3);font-weight:600;padding-bottom:8px;">Módulo</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Leer</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Crear</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Editar</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Eliminar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border);">
        <button id="btn-delete-role-${roleId}"
          style="background:transparent;border:none;color:var(--danger,#ef4444);font-size:12px;cursor:pointer;font-family:inherit;
                 ${role?.user_count > 0 ? 'opacity:.4;cursor:not-allowed;' : ''}"
          ${role?.user_count > 0 ? 'disabled title="Tiene usuarios activos"' : ''}>
          Eliminar rol
        </button>
        <div style="display:flex;gap:8px;">
          <button id="btn-discard-${roleId}" class="btn btn-secondary btn-small">Descartar</button>
          <button id="btn-save-perms-${roleId}" class="btn btn-primary btn-small">Guardar cambios</button>
        </div>
      </div>
    </div>`;

  body.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const pid = Number(cb.dataset.permId);
      const rid = Number(cb.dataset.roleId);
      if (cb.checked) {
        _pendingPerms[rid] = [...(_pendingPerms[rid] ?? []), pid];
      } else {
        _pendingPerms[rid] = (_pendingPerms[rid] ?? []).filter(id => id !== pid);
      }
    });
  });

  document.getElementById(`btn-discard-${roleId}`)?.addEventListener('click', () => {
    _pendingPerms[roleId] = [...(_originalPerms[roleId] ?? [])];
    _renderCardBody(roleId);
  });
  document.getElementById(`btn-save-perms-${roleId}`)?.addEventListener('click', () => _savePerms(roleId));
  document.getElementById(`btn-delete-role-${roleId}`)?.addEventListener('click', () => _deleteRole(roleId));
}

async function _savePerms(roleId) {
  const btn = document.getElementById(`btn-save-perms-${roleId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const res = await fetch(`/api/roles/${roleId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_ids: _pendingPerms[roleId] ?? [] }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Error al guardar.', 'error'); return; }

    _originalPerms[roleId] = [...(_pendingPerms[roleId] ?? [])];
    showToast('Permisos guardados.', 'success');
    _collapseCard(roleId);
    _expandedId = null;
  } catch {
    showToast('Error de conexión.', 'error');
    _pendingPerms[roleId] = [...(_originalPerms[roleId] ?? [])];
    _renderCardBody(roleId);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}

// Stubs — implemented in Tasks 5 & 6
function _showNewRoleForm() {
  const area   = document.getElementById('new-role-area');
  const addBtn = document.getElementById('btn-add-role');
  if (!area) return;
  if (addBtn) addBtn.style.display = 'none';

  const ACTIONS = ['read', 'create', 'edit', 'delete'];
  const rows = _modules.map(mod => {
    const cells = ACTIONS.map(action => {
      const perm = mod.permissions.find(p => p.action === action);
      if (!perm) {
        return `<td style="text-align:center;"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:var(--surface-3);opacity:.3;"></span></td>`;
      }
      return `<td style="text-align:center;">
        <input type="checkbox" data-new-perm-id="${perm.id}"
          style="width:14px;height:14px;cursor:pointer;accent-color:var(--primary);">
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:6px 0;font-size:13px;color:var(--text-1);">${escHtml(mod.label)}</td>
      ${cells}
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--primary);border-radius:8px;padding:14px;margin-bottom:8px;">
      <div style="font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:12px;">Nuevo rol</div>
      <div id="new-role-error" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
        color:#fca5a5;border-radius:6px;padding:8px 12px;font-size:13px;margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:4px;">Nombre *</label>
          <input id="new-role-name" type="text" class="form-control" placeholder="ej: coordinador">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:4px;">Descripción</label>
          <input id="new-role-desc" type="text" class="form-control" placeholder="Descripción breve">
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:var(--text-3);font-weight:600;padding-bottom:8px;">Módulo</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Leer</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Crear</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Editar</th>
            <th style="text-align:center;font-size:11px;color:var(--text-3);font-weight:600;width:60px;">Eliminar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="btn-cancel-new-role" class="btn btn-secondary btn-small">Cancelar</button>
        <button id="btn-create-role" class="btn btn-primary btn-small">Crear rol</button>
      </div>
    </div>`;

  document.getElementById('btn-cancel-new-role')?.addEventListener('click', () => {
    area.innerHTML = '';
    if (addBtn) addBtn.style.display = 'flex';
  });
  document.getElementById('btn-create-role')?.addEventListener('click', _submitNewRole);
  setTimeout(() => document.getElementById('new-role-name')?.focus(), 50);
}

async function _submitNewRole() {
  const errEl = document.getElementById('new-role-error');
  const name  = document.getElementById('new-role-name')?.value?.trim();
  const desc  = document.getElementById('new-role-desc')?.value?.trim() ?? '';

  if (!name) {
    errEl.textContent = 'El nombre es requerido.';
    errEl.style.display = 'block';
    return;
  }

  const permIds = [...document.querySelectorAll('[data-new-perm-id]:checked')]
    .map(cb => Number(cb.dataset.newPermId));

  const btn = document.getElementById('btn-create-role');
  if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }

  try {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc, permission_ids: permIds }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Error al crear.';
      errEl.style.display = 'block';
      return;
    }
    showToast(`Rol "${escHtml(name)}" creado.`, 'success');
    await _loadAll();
  } catch {
    errEl.textContent = 'Error de conexión.';
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear rol'; }
  }
}

function _deleteRole(_roleId) {}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
