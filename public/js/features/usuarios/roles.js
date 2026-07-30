import { showToast, avatarGradient, initialsOf } from '../../ui/components.js';
import { iconLock, iconChevronDown, iconPlus } from '../../utils/icons.js';

let _modules = [];
let _roles   = [];
let _expandedId   = null;
let _originalPerms = {};
let _pendingPerms  = {};
let _isLoading = false;

const ACTION_LABELS = { read: 'Leer', create: 'Crear', edit: 'Editar', delete: 'Eliminar' };

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
     <div id="btn-add-role" class="add-role-row">${iconPlus(15)} Nuevo rol</div>`;

  wrap.querySelectorAll('[data-role-header]').forEach(h => {
    h.addEventListener('click', () => _toggleCard(Number(h.dataset.roleHeader)));
  });
  document.getElementById('btn-add-role')?.addEventListener('click', _showNewRoleForm);
}

function _cardHtml(role) {
  const isIT = role.id === 1;
  return `
    <div id="role-card-${role.id}" class="role-card">
      <div data-role-header="${role.id}" class="role-head" style="${isIT ? 'cursor:default;' : ''}">
        <div class="role-avatar" style="background:${avatarGradient(role.name)};">${initialsOf(role.name)}</div>
        <div class="role-main">
          <div class="role-name">
            ${escHtml(role.name)}
            ${isIT ? `<span class="lock-badge">${iconLock(10)} bloqueado</span>` : ''}
          </div>
          <div class="role-desc">${escHtml(role.description || '')}</div>
        </div>
        <span class="count-badge">${escHtml(String(role.user_count))} usuario${role.user_count !== 1 ? 's' : ''}</span>
        ${isIT ? '' : `<span class="role-chevron">${iconChevronDown(16)}</span>`}
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
  document.getElementById(`role-card-${roleId}`)?.classList.add('expanded');

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
      document.getElementById(`role-card-${roleId}`)?.classList.remove('expanded');
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
  document.getElementById(`role-card-${roleId}`)?.classList.remove('expanded');
}

function _renderCardBody(roleId) {
  const body = document.getElementById(`role-body-${roleId}`);
  if (!body) return;
  document.getElementById(`role-card-${roleId}`)?.classList.add('expanded');

  const active = new Set(_pendingPerms[roleId] ?? []);
  const role   = _roles.find(r => r.id === roleId);

  const ACTIONS = ['read', 'create', 'edit', 'delete'];
  const rows = _modules.map(mod => {
    const cells = ACTIONS.map(action => {
      const perm = mod.permissions.find(p => p.action === action);
      if (!perm) {
        return `<td data-label="${ACTION_LABELS[action]}"><span class="perm-chk perm-chk-na"></span></td>`;
      }
      return `<td data-label="${ACTION_LABELS[action]}">
        <input type="checkbox" class="perm-chk" data-perm-id="${perm.id}" data-role-id="${roleId}"
          ${active.has(perm.id) ? 'checked' : ''}>
      </td>`;
    }).join('');
    return `<tr>
      <td>${escHtml(mod.label)}</td>
      ${cells}
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="perm-body">
      <table class="perm-table">
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Leer</th>
            <th>Crear</th>
            <th>Editar</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="perm-foot">
        <button id="btn-delete-role-${roleId}" class="link-danger"
          style="${role?.user_count > 0 ? 'opacity:.4;cursor:not-allowed;' : ''}"
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
        return `<td data-label="${ACTION_LABELS[action]}"><span class="perm-chk perm-chk-na"></span></td>`;
      }
      return `<td data-label="${ACTION_LABELS[action]}"><input type="checkbox" class="perm-chk" data-new-perm-id="${perm.id}"></td>`;
    }).join('');
    return `<tr>
      <td>${escHtml(mod.label)}</td>
      ${cells}
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div class="role-card expanded" style="padding:16px 18px 18px;">
      <div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:12px;">Nuevo rol</div>
      <div id="new-role-error" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
        color:var(--danger);border-radius:6px;padding:8px 12px;font-size:13px;margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:4px;">Nombre *</label>
          <input id="new-role-name" type="text" class="form-control" placeholder="ej: coordinador" required>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:4px;">Descripción</label>
          <input id="new-role-desc" type="text" class="form-control" placeholder="Descripción breve">
        </div>
      </div>
      <table class="perm-table" style="margin-bottom:14px;">
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Leer</th>
            <th>Crear</th>
            <th>Editar</th>
            <th>Eliminar</th>
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
  if (!errEl) return;
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

async function _deleteRole(roleId) {
  const role = _roles.find(r => r.id === roleId);
  if (!role) return;

  if (!confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;

  const btn = document.getElementById(`btn-delete-role-${roleId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }

  try {
    const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Error al eliminar.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Eliminar rol'; }
      return;
    }
    showToast(`Rol "${escHtml(role.name)}" eliminado.`, 'success');
    await _loadAll();
  } catch {
    showToast('Error de conexión.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Eliminar rol'; }
  }
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
