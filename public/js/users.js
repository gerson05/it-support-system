import { showToast } from './components.js';

let _roles = [];

export async function renderUsers(container) {
  container.innerHTML = `
  <div class="page-header">
    <div>
      <h2 class="page-title">Usuarios</h2>
      <p class="page-subtitle">Gestión de cuentas y accesos del panel IT</p>
    </div>
    <button class="btn btn-primary" id="btn-new-user" style="display:none;">+ Nuevo usuario</button>
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
          color:#fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
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

async function loadUsers(tabContainer) {
  tabContainer.innerHTML = `<div class="card"><div id="users-table-wrap"><div class="loading-spinner"></div></div></div>`;
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

    const users = await usersRes.json();
    _roles = await rolesRes.json();

    if (!users.length) {
      wrap.innerHTML = `<p style="color:var(--text-2);padding:20px;">No hay usuarios registrados.</p>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Creado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${escHtml(u.username)}</strong></td>
              <td><span class="badge badge-role">${escHtml(u.role_name)}</span></td>
              <td>
                <span class="badge ${u.active ? 'badge-resuelto' : 'badge-cerrado'}">
                  ${u.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td style="color:var(--text-2);font-size:13px;">${fmtDate(u.created_at)}</td>
              <td style="text-align:right;">
                <button class="btn btn-small btn-secondary btn-edit"
                  data-id="${u.id}" data-username="${escHtml(u.username)}"
                  data-role="${u.role_id}" data-active="${u.active}">
                  Editar
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    wrap.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal({
          id:       Number(btn.dataset.id),
          username: btn.dataset.username,
          role_id:  Number(btn.dataset.role),
          active:   btn.dataset.active === '1',
        });
      });
    });
  } catch (err) {
    if (wrap) wrap.innerHTML = `<p style="color:var(--danger);padding:20px;">Error cargando usuarios.</p>`;
    console.error(err);
  }
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
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
