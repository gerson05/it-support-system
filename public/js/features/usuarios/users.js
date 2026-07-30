import { showToast, avatarGradient, initialsOf } from '../../ui/components.js';
import { iconPlus, iconEdit } from '../../utils/icons.js';

let _roles = [];

export async function renderUsers(container) {
  container.innerHTML = `
  <div class="page-header">
    <div>
      <h2 class="page-title">Usuarios</h2>
      <p class="page-subtitle">Gestión de cuentas y accesos del panel IT</p>
    </div>
    <button class="btn btn-primary btn-create" id="btn-new-user" style="display:none;">${iconPlus(14)} Nuevo usuario</button>
  </div>

  <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;">
    <button class="users-tab-btn active" data-tab="users"
      style="padding:8px 20px;background:transparent;border:none;border-bottom:2px solid var(--primary);
             color:var(--primary);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">
      Usuarios
    </button>
    <button class="users-tab-btn" data-tab="roles"
      style="padding:8px 20px;background:transparent;border:none;border-bottom:2px solid transparent;
             color:var(--text-2);font-weight:500;font-size:13px;cursor:pointer;font-family:inherit;">
      Roles y Permisos
    </button>
  </div>

  <div id="users-tab-content"></div>

  <!-- Modal usuario -->
  <div id="user-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content" style="max-width:420px;">
      <div class="modal-header">
        <h3 id="modal-title">Nuevo usuario</h3>
        <button class="modal-close" id="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div id="modal-error" style="
          display:none;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);
          color:var(--danger);border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="user-form">
          <input type="hidden" id="edit-id">
          <div class="form-group">
            <label>Usuario</label>
            <input type="text" id="field-username" class="form-control" placeholder="nombre.apellido" required>
          </div>
          <div class="form-group">
            <label id="pass-label">Contraseña</label>
            <input type="password" id="field-password" class="form-control" placeholder="Mínimo 6 caracteres">
            <small id="pass-hint" style="color:var(--text-3);font-size:12px;display:none;">
              Deja en blanco para mantener la contraseña actual.
            </small>
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select id="field-role" class="form-control"></select>
          </div>
          <div class="form-group" id="active-group" style="display:none;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="field-active" style="width:16px;height:16px;cursor:pointer;">
              Cuenta activa
            </label>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="btn-cancel">Cancelar</button>
        <button class="btn btn-primary" id="btn-save">Guardar</button>
      </div>
    </div>
  </div>`;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveUser);
  document.getElementById('user-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Tab switching
  container.querySelectorAll('.users-tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      container.querySelectorAll('.users-tab-btn').forEach(b => {
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-2)';
        b.style.fontWeight = '500';
        b.classList.remove('active');
      });
      btn.style.borderBottomColor = 'var(--primary)';
      btn.style.color = 'var(--primary)';
      btn.style.fontWeight = '600';
      btn.classList.add('active');

      const tabContent = document.getElementById('users-tab-content');
      const newUserBtn = document.getElementById('btn-new-user');

      if (btn.dataset.tab === 'users') {
        newUserBtn.style.display = 'block';
        await loadUsers(tabContent);
      } else {
        newUserBtn.style.display = 'none';
        import('./roles.js').then(m => m.renderRolesTab(tabContent)).catch(err => {
          console.error('roles.js not found:', err);
          tabContent.innerHTML = `<p style="color:var(--text-2);padding:20px;">Módulo de roles no disponible aún.</p>`;
        });
      }
    });
  });

  // Botón nuevo usuario
  document.getElementById('btn-new-user').addEventListener('click', () => openModal());

  // Activar tab de usuarios por defecto
  const tabContent = document.getElementById('users-tab-content');
  document.getElementById('btn-new-user').style.display = 'block';
  await loadUsers(tabContent);
}

let _allUsers = [];

async function loadUsers(tabContainer) {
  tabContainer.innerHTML = `<div class="card"><div id="users-table-wrap" style="padding:40px;"><div class="loading-spinner"></div></div></div>`;
  const wrap = tabContainer.querySelector('#users-table-wrap');
  if (!wrap) return;

  try {
    const [usersRes, rolesRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/roles'),
    ]);

    if (usersRes.status === 401 || usersRes.status === 403) {
      wrap.innerHTML = `<p style="color:var(--text-2);padding:20px;">Sin permiso para ver usuarios.</p>`;
      return;
    }

    _allUsers = await usersRes.json();
    _roles    = await rolesRes.json();

    if (!_allUsers.length) {
      tabContainer.innerHTML = `<p style="color:var(--text-2);padding:20px;">No hay usuarios registrados.</p>`;
      return;
    }

    renderUsersShell(tabContainer);
  } catch (err) {
    if (wrap) wrap.innerHTML = `<p style="color:var(--danger);padding:20px;">Error cargando usuarios.</p>`;
    console.error(err);
  }
}

function renderUsersShell(tabContainer) {
  const total    = _allUsers.length;
  const activos  = _allUsers.filter(u => u.active).length;
  const roleOpts = [...new Map(_roles.map(r => [r.id, r])).values()];

  tabContainer.innerHTML = `
    <div class="stat-strip">
      <div class="stat"><b>${total}</b><span>Total</span></div>
      <div class="stat ok"><b>${activos}</b><span>Activos</span></div>
      <div class="stat"><b>${total - activos}</b><span>Inactivos</span></div>
      <div class="stat accent"><b>${roleOpts.length}</b><span>Roles</span></div>
    </div>
    <div class="toolbar">
      <input type="text" id="users-search" placeholder="Buscar por usuario…">
      <select id="users-filter-role">
        <option value="">Todos los roles</option>
        ${roleOpts.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
      </select>
      <select id="users-filter-status">
        <option value="">Todos los estados</option>
        <option value="1">Activos</option>
        <option value="0">Inactivos</option>
      </select>
    </div>
    <div class="card" id="users-list-wrap" style="overflow:hidden;"></div>`;

  const search = tabContainer.querySelector('#users-search');
  const roleF  = tabContainer.querySelector('#users-filter-role');
  const statF  = tabContainer.querySelector('#users-filter-status');
  const rerender = () => renderUserRows(tabContainer, search.value, roleF.value, statF.value);

  search.addEventListener('input', rerender);
  roleF.addEventListener('change', rerender);
  statF.addEventListener('change', rerender);

  renderUserRows(tabContainer, '', '', '');
}

function renderUserRows(tabContainer, query, roleId, status) {
  const listWrap = tabContainer.querySelector('#users-list-wrap');
  if (!listWrap) return;

  const q = query.trim().toLowerCase();
  const filtered = _allUsers.filter(u => {
    if (q && !u.username.toLowerCase().includes(q)) return false;
    if (roleId && String(u.role_id) !== roleId) return false;
    if (status && String(u.active ? 1 : 0) !== status) return false;
    return true;
  });

  if (!filtered.length) {
    listWrap.innerHTML = `<p style="color:var(--text-3);padding:24px;text-align:center;">Sin usuarios que coincidan.</p>`;
    return;
  }

  listWrap.innerHTML = filtered.map(u => `
    <div class="user-row">
      <div class="avatar" style="background:${avatarGradient(u.username)};">${initialsOf(u.username)}</div>
      <div class="u-main">
        <div class="u-name">${escHtml(u.username)}</div>
        <div class="u-meta"><span class="role-pill">${escHtml(u.role_name)}</span></div>
      </div>
      <div class="status-dot" style="--dot:${u.active ? 'var(--success)' : 'var(--text-3)'};">${u.active ? 'Activo' : 'Inactivo'}</div>
      <div class="u-created">${fmtDate(u.created_at)}</div>
      <button class="icon-btn btn-edit" title="Editar"
        data-id="${u.id}" data-username="${escHtml(u.username)}"
        data-role="${u.role_id}" data-active="${u.active}">${iconEdit(14)}</button>
    </div>`).join('');

  listWrap.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal({
        id:       Number(btn.dataset.id),
        username: btn.dataset.username,
        role_id:  Number(btn.dataset.role),
        active:   btn.dataset.active === '1',
      });
    });
  });
}

function openModal(user = null) {
  const modal = document.getElementById('user-modal');
  if (!modal) return;

  const isEdit = user !== null;
  document.getElementById('modal-title').textContent = isEdit ? 'Editar usuario' : 'Nuevo usuario';
  document.getElementById('edit-id').value = isEdit ? user.id : '';
  document.getElementById('field-username').value = isEdit ? user.username : '';
  document.getElementById('field-username').readOnly = isEdit;
  document.getElementById('field-password').value = '';
  document.getElementById('field-password').required = !isEdit;
  document.getElementById('pass-label').textContent = isEdit ? 'Nueva contraseña' : 'Contraseña';
  document.getElementById('pass-hint').style.display = isEdit ? 'block' : 'none';
  document.getElementById('active-group').style.display = isEdit ? 'block' : 'none';
  if (isEdit) document.getElementById('field-active').checked = user.active;
  document.getElementById('modal-error').style.display = 'none';

  // Poblar roles
  const roleSelect = document.getElementById('field-role');
  roleSelect.innerHTML = _roles.map(r =>
    `<option value="${r.id}" ${isEdit && r.id === user.role_id ? 'selected' : ''}>${r.name}</option>`
  ).join('');

  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('field-username').focus(), 50);
}

function closeModal() {
  const modal = document.getElementById('user-modal');
  if (modal) modal.style.display = 'none';
}

async function saveUser() {
  const errEl = document.getElementById('modal-error');
  errEl.style.display = 'none';

  const id       = document.getElementById('edit-id').value;
  const username = document.getElementById('field-username').value.trim();
  const password = document.getElementById('field-password').value;
  const role_id  = Number(document.getElementById('field-role').value);
  const active   = document.getElementById('field-active').checked ? 1 : 0;
  const isEdit   = !!id;

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    let res;
    if (isEdit) {
      const body = { role_id, active };
      if (password) body.password = password;
      res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role_id }),
      });
    }

    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Error al guardar.';
      errEl.style.display = 'block';
      return;
    }

    showToast(isEdit ? 'Usuario actualizado.' : 'Usuario creado.', 'success');
    closeModal();
    const tabContent = document.getElementById('users-tab-content');
    if (tabContent) await loadUsers(tabContent);
  } catch (err) {
    errEl.textContent = 'Error de conexión.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmtDate(str) {
  if (!str) return '—';
  const iso = str.length === 10 ? str + 'T00:00:00' : str.replace(' ', 'T');
  const d = new Date(iso);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
