# Gestor de Roles y Permisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un panel de administración de roles y permisos con tarjetas expandibles e inline checkboxes dentro de una nueva pestaña en la sección Usuarios.

**Architecture:** Backend añade 6 endpoints nuevos a `user-routes.js` usando la BD SQLite existente. Frontend divide la sección `#users` en dos pestañas: la existente de usuarios y una nueva de roles, cuya lógica completa vive en el nuevo archivo `public/js/roles.js`.

**Tech Stack:** Node.js ESM, Express, node:sqlite (DatabaseSync), Vanilla JS SPA, CSS custom properties del sistema existente.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|----------------|
| `src/auth/user-routes.js` | Modificar | +6 endpoints de roles/permisos, modificar GET /api/roles |
| `public/js/users.js` | Modificar | Añadir sistema de tabs, delegar a roles.js |
| `public/js/roles.js` | Crear | Toda la UI del tab de roles: lista, expand, checkboxes, save, create, delete |

---

## Task 1: Endpoints de lectura — GET /api/roles (extender), GET /api/permissions, GET /api/roles/:id/permissions

**Files:**
- Modify: `src/auth/user-routes.js`

- [ ] **Step 1: Reemplazar GET /api/roles existente con versión que incluye user_count**

En `src/auth/user-routes.js`, línea 9-11, reemplazar:

```js
router.get('/api/roles', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT id, name, description FROM roles').all());
});
```

por:

```js
router.get('/api/roles', requireAuth, (_req, res) => {
  const roles = db.prepare(
    `SELECT r.id, r.name, r.description,
            COUNT(CASE WHEN u.active = 1 THEN 1 END) AS user_count
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id
     ORDER BY r.id`
  ).all();
  res.json(roles);
});
```

- [ ] **Step 2: Añadir el array estático PERMISSION_MODULES justo después de `const itOnly = ...` (línea 7)**

```js
const PERMISSION_MODULES = [
  { module: 'metrics',       label: 'Métricas',             actions: ['read'] },
  { module: 'tickets',       label: 'Tickets',              actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'tech-requests', label: 'Requerimientos',       actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'faqs',          label: 'Base de conocimiento', actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'sedes',         label: 'Red de Puntos',        actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'despacho',      label: 'Despacho',             actions: ['read', 'create', 'edit', 'delete'] },
  { module: 'audit',         label: 'Auditoría',            actions: ['read'] },
  { module: 'farmacias',     label: 'Farmacias FOMAG',      actions: ['read', 'create', 'edit', 'delete'] },
];
```

- [ ] **Step 3: Añadir GET /api/permissions después del GET /api/roles modificado**

```js
router.get('/api/permissions', requireAuth, (_req, res) => {
  const allPerms = db.prepare('SELECT id, name FROM permissions').all();
  const result = PERMISSION_MODULES.map(mod => ({
    module: mod.module,
    label:  mod.label,
    permissions: mod.actions
      .map(action => {
        const perm = allPerms.find(p => p.name === `${mod.module}:${action}`);
        return perm ? { id: perm.id, name: perm.name, action } : null;
      })
      .filter(Boolean),
  }));
  res.json(result);
});
```

- [ ] **Step 4: Añadir GET /api/roles/:id/permissions**

```js
router.get('/api/roles/:id/permissions', requireAuth, (req, res) => {
  const roleId = Number(req.params.id);
  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId)) {
    return res.status(404).json({ error: 'Rol no encontrado.' });
  }
  const ids = db.prepare(
    'SELECT permission_id FROM role_permissions WHERE role_id = ?'
  ).all(roleId).map(r => r.permission_id);
  res.json({ permission_ids: ids });
});
```

- [ ] **Step 5: Iniciar el servidor y verificar los tres endpoints**

```bash
npm start
```

```bash
# Debe incluir user_count en cada rol
curl -s -b "it_session=<TOKEN>" http://localhost:3000/api/roles | node -e "process.stdin|0" 

# Usar las credenciales admin. Primero hacer login:
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<PASSWORD>"}' -c cookies.txt

# Luego probar con cookie:
curl -s -b cookies.txt http://localhost:3000/api/roles
# Esperado: array con id, name, description, user_count

curl -s -b cookies.txt http://localhost:3000/api/permissions
# Esperado: array de 8 módulos, cada uno con permissions[]

curl -s -b cookies.txt http://localhost:3000/api/roles/3/permissions
# Esperado: { "permission_ids": [3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 20] }
```

- [ ] **Step 6: Commit**

```bash
git add src/auth/user-routes.js
git commit -m "feat(roles): read-only endpoints — roles with user_count, permissions by module, role permissions"
```

---

## Task 2: Endpoints de escritura — PUT, POST, DELETE de roles

**Files:**
- Modify: `src/auth/user-routes.js`

- [ ] **Step 1: Añadir PUT /api/roles/:id (renombrar/descripción)**

Insertar antes de `export default router;`:

```js
router.put('/api/roles/:id', ...itOnly, (req, res, next) => {
  const id = Number(req.params.id);
  if (id === 1) return res.status(403).json({ error: 'El rol IT no se puede modificar.' });

  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Rol no encontrado.' });
  }

  const { name, description } = req.body;
  try {
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
      db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(String(name).trim(), id);
    }
    if (description !== undefined) {
      db.prepare('UPDATE roles SET description = ? WHERE id = ?').run(description, id);
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
    next(err);
  }
});
```

- [ ] **Step 2: Añadir PUT /api/roles/:id/permissions (batch update)**

```js
router.put('/api/roles/:id/permissions', ...itOnly, (req, res, next) => {
  const id = Number(req.params.id);
  if (id === 1) return res.status(403).json({ error: 'El rol IT no se puede modificar.' });

  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Rol no encontrado.' });
  }

  const { permission_ids } = req.body;
  if (!Array.isArray(permission_ids)) {
    return res.status(400).json({ error: 'permission_ids debe ser un array.' });
  }

  for (const pid of permission_ids) {
    if (!db.prepare('SELECT id FROM permissions WHERE id = ?').get(pid)) {
      return res.status(400).json({ error: `Permiso con id ${pid} no existe.` });
    }
  }

  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
    const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permission_ids) ins.run(id, pid);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    next(err);
  }
});
```

- [ ] **Step 3: Añadir POST /api/roles (crear)**

```js
router.post('/api/roles', ...itOnly, (req, res, next) => {
  const { name, description = '', permission_ids = [] } = req.body;
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'El nombre es requerido.' });

  try {
    const result = db.prepare(
      'INSERT INTO roles (name, description) VALUES (?, ?)'
    ).run(String(name).trim(), description);
    const roleId = result.lastInsertRowid;

    if (permission_ids.length > 0) {
      db.exec('BEGIN');
      try {
        const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
        for (const pid of permission_ids) ins.run(roleId, pid);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch {}
        throw err;
      }
    }

    res.status(201).json({ ok: true, id: roleId });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
    next(err);
  }
});
```

- [ ] **Step 4: Añadir DELETE /api/roles/:id**

```js
router.delete('/api/roles/:id', ...itOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === 1) return res.status(400).json({ error: 'El rol IT no se puede eliminar.' });

  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Rol no encontrado.' });
  }

  const n = db.prepare(
    'SELECT COUNT(*) AS n FROM users WHERE role_id = ? AND active = 1'
  ).get(id).n;
  if (n > 0) {
    return res.status(400).json({
      error: `Este rol tiene ${n} usuario${n > 1 ? 's' : ''} activo${n > 1 ? 's' : ''}. Reasígnalos antes de eliminar.`,
    });
  }

  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  res.json({ ok: true });
});
```

- [ ] **Step 5: Verificar los endpoints de escritura con curl**

```bash
# Crear un rol de prueba
curl -s -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"test_rol","description":"Solo para prueba","permission_ids":[3,4]}'
# Esperado: {"ok":true,"id":<N>}

# Guardar el ID retornado como TEST_ID

# Actualizar permisos del rol de prueba
curl -s -X PUT http://localhost:3000/api/roles/<TEST_ID>/permissions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"permission_ids":[3,4,5]}'
# Esperado: {"ok":true}

# Verificar que se actualizó
curl -s -b cookies.txt http://localhost:3000/api/roles/<TEST_ID>/permissions
# Esperado: {"permission_ids":[3,4,5]}

# Intentar modificar rol IT — debe dar 403
curl -s -X PUT http://localhost:3000/api/roles/1/permissions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"permission_ids":[]}'
# Esperado: {"error":"El rol IT no se puede modificar."}

# Eliminar el rol de prueba
curl -s -X DELETE http://localhost:3000/api/roles/<TEST_ID> -b cookies.txt
# Esperado: {"ok":true}
```

- [ ] **Step 6: Commit**

```bash
git add src/auth/user-routes.js
git commit -m "feat(roles): write endpoints — create, rename, batch-update permissions, delete"
```

---

## Task 3: Sistema de tabs en users.js

**Files:**
- Modify: `public/js/users.js`

- [ ] **Step 1: Añadir import de renderRolesTab al inicio del archivo**

Al inicio de `public/js/users.js`, añadir la línea:

```js
import { renderRolesTab } from './roles.js';
```

- [ ] **Step 2: Reemplazar el template HTML de renderUsers**

En `renderUsers`, reemplazar todo el bloque `container.innerHTML = \`...\`` (líneas 6-61) por:

```js
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
```

- [ ] **Step 3: Reemplazar los event listeners y la llamada inicial a loadUsers**

Reemplazar las 5 líneas de event listeners (63-71) y la llamada `await loadUsers()` al final por:

```js
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveUser);
  document.getElementById('user-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Tab switching
  container.querySelectorAll('.users-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.users-tab-btn').forEach(b => {
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-2)';
        b.style.fontWeight = '500';
      });
      btn.style.borderBottomColor = 'var(--primary)';
      btn.style.color = 'var(--primary)';
      btn.style.fontWeight = '600';

      const tabContent = document.getElementById('users-tab-content');
      const newUserBtn = document.getElementById('btn-new-user');

      if (btn.dataset.tab === 'users') {
        newUserBtn.style.display = 'block';
        loadUsers(tabContent);
      } else {
        newUserBtn.style.display = 'none';
        renderRolesTab(tabContent);
      }
    });
  });

  // Botón nuevo usuario (ahora dentro del tab)
  document.getElementById('btn-new-user').addEventListener('click', () => openModal());

  // Activar tab de usuarios por defecto
  const tabContent = document.getElementById('users-tab-content');
  document.getElementById('btn-new-user').style.display = 'block';
  await loadUsers(tabContent);
```

- [ ] **Step 4: Actualizar la firma de loadUsers para recibir el contenedor como parámetro**

Cambiar la firma de `loadUsers` en la línea 74 de:

```js
async function loadUsers() {
  const wrap = document.getElementById('users-table-wrap');
```

por:

```js
async function loadUsers(tabContainer) {
  tabContainer.innerHTML = `<div class="card"><div id="users-table-wrap"><div class="loading-spinner"></div></div></div>`;
  const wrap = document.getElementById('users-table-wrap');
```

- [ ] **Step 5: Verificar en el navegador que las dos pestañas aparecen y que la de Usuarios funciona igual que antes**

Navegar a `http://localhost:3000/#users`. Verificar:
- Aparecen dos pestañas: "Usuarios" y "Roles y Permisos"
- La pestaña "Usuarios" está activa y muestra la tabla de usuarios (misma que antes)
- Botón "+ Nuevo usuario" visible solo en tab Usuarios
- Click en "Roles y Permisos" → muestra un error de consola porque `roles.js` no existe todavía — esto es esperado

- [ ] **Step 6: Commit**

```bash
git add public/js/users.js
git commit -m "feat(users): add Roles y Permisos tab, delegate to roles.js"
```

---

## Task 4: roles.js — lista de tarjetas y expand/collapse con checkboxes

**Files:**
- Create: `public/js/roles.js`

- [ ] **Step 1: Crear el archivo con estado, entry point y carga de datos**

Crear `public/js/roles.js` con:

```js
import { showToast } from './components.js';

// ── Estado del módulo ────────────────────────────────────────────────────────
let _modules = [];          // [{ module, label, permissions: [{id, name, action}] }]
let _roles   = [];          // [{ id, name, description, user_count }]
let _expandedId   = null;   // id del rol expandido actualmente
let _originalPerms = {};    // { roleId: number[] } — cargado del servidor al expandir
let _pendingPerms  = {};    // { roleId: number[] } — estado local mientras editas

// ── Entry point ──────────────────────────────────────────────────────────────
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
```

- [ ] **Step 2: Añadir _renderList y _cardHtml**

```js
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
            ${role.user_count} usuario${role.user_count !== 1 ? 's' : ''}
          </span>
          ${isIT ? '' : `<span style="font-size:11px;color:var(--text-3);" id="chevron-${role.id}">▼</span>`}
        </div>
      </div>
      <div id="role-body-${role.id}" style="display:none;"></div>
    </div>`;
}
```

- [ ] **Step 3: Añadir _toggleCard (expand/collapse con carga lazy)**

```js
async function _toggleCard(roleId) {
  // IT bloqueado
  if (roleId === 1) return;

  // Hay otro expandido con cambios pendientes?
  if (_expandedId && _expandedId !== roleId) {
    const orig = _originalPerms[_expandedId] ?? [];
    const pend = _pendingPerms[_expandedId] ?? [];
    const hasChanges = orig.length !== pend.length || orig.some(id => !pend.includes(id));
    if (hasChanges) {
      const role = _roles.find(r => r.id === _expandedId);
      const other = _roles.find(r => r.id === roleId);
      if (!confirm(`¿Descartar cambios en "${role?.name}" y abrir "${other?.name}"?`)) return;
    }
    _collapseCard(_expandedId);
  }

  // Si ya estaba expandido, colapsar
  if (_expandedId === roleId) {
    _collapseCard(roleId);
    _expandedId = null;
    return;
  }

  // Expandir: cargar permisos si no están en caché
  _expandedId = roleId;
  const chevron = document.getElementById(`chevron-${roleId}`);
  if (chevron) chevron.textContent = '▲';

  const body = document.getElementById(`role-body-${roleId}`);
  body.style.display = 'block';
  body.innerHTML = `<div style="padding:12px;"><div class="loading-spinner" style="width:20px;height:20px;"></div></div>`;

  if (!_originalPerms[roleId]) {
    const res = await fetch(`/api/roles/${roleId}/permissions`);
    const data = await res.json();
    _originalPerms[roleId] = data.permission_ids ?? [];
    _pendingPerms[roleId]  = [..._originalPerms[roleId]];
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
```

- [ ] **Step 4: Añadir _renderCardBody con tabla de checkboxes**

```js
function _renderCardBody(roleId) {
  const body = document.getElementById(`role-body-${roleId}`);
  if (!body) return;

  const card = document.getElementById(`role-card-${roleId}`);
  if (card) card.style.borderColor = 'var(--primary)';

  const active = new Set(_pendingPerms[roleId] ?? []);
  const role   = _roles.find(r => r.id === roleId);

  const rows = _modules.map(mod => {
    const ACTIONS = ['read', 'create', 'edit', 'delete'];
    const cells = ACTIONS.map(action => {
      const perm = mod.permissions.find(p => p.action === action);
      if (!perm) {
        return `<td style="text-align:center;"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:var(--surface-3);opacity:.3;"></span></td>`;
      }
      const checked = active.has(perm.id);
      return `<td style="text-align:center;">
        <input type="checkbox" data-perm-id="${perm.id}" data-role-id="${roleId}"
          ${checked ? 'checked' : ''}
          style="width:14px;height:14px;cursor:pointer;accent-color:var(--primary);">
      </td>`;
    }).join('');
    return `<tr>
      <td style="padding:6px 0;font-size:13px;color:var(--text-1);">${escHtml(mod.label)}</td>
      ${cells}
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div style="padding:12px 14px 14px;border-top:1px solid var(--border-subtle,var(--border));">
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

  // Checkboxes → actualizar estado pendiente
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
```

- [ ] **Step 5: Añadir _savePerms y el helper escHtml**

```js
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

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 6: Verificar en el navegador**

Navegar a `#users` → pestaña "Roles y Permisos". Verificar:
- Lista de roles aparece: IT con badge "bloqueado", resto con `▼`
- Click en "Supervisor" → se expande mostrando la tabla de checkboxes con los permisos actuales marcados
- Cambiar un checkbox → click "Descartar" → checkbox vuelve al estado original
- Cambiar un checkbox → click "Guardar cambios" → toast de éxito, tarjeta se colapsa
- Reabrir la tarjeta → el nuevo estado persiste
- Click en tarjeta IT → no pasa nada

- [ ] **Step 7: Commit**

```bash
git add public/js/roles.js
git commit -m "feat(roles): role cards with inline expand, permission checkboxes, save/discard"
```

---

## Task 5: roles.js — crear nuevo rol

**Files:**
- Modify: `public/js/roles.js`

- [ ] **Step 1: Añadir _showNewRoleForm**

```js
function _showNewRoleForm() {
  const area = document.getElementById('new-role-area');
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
    <div style="background:var(--surface-2);border:1px solid var(--primary);border-radius:8px;padding:14px;">
      <div style="font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:12px;">Nuevo rol</div>
      <div id="new-role-error" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
        color:#fca5a5;border-radius:6px;padding:8px 12px;font-size:13px;margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:4px;">Nombre *</label>
          <input id="new-role-name" type="text" class="form-control" placeholder="ej: coordinador" style="width:100%;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:4px;">Descripción</label>
          <input id="new-role-desc" type="text" class="form-control" placeholder="Descripción breve" style="width:100%;">
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
```

- [ ] **Step 2: Añadir _submitNewRole**

```js
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
    showToast(`Rol "${name}" creado.`, 'success');
    await _loadAll();
  } catch {
    errEl.textContent = 'Error de conexión.';
    errEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Crear rol'; }
  }
}
```

- [ ] **Step 3: Verificar creación de roles en el navegador**

Navegar a `#users` → "Roles y Permisos". Verificar:
- Click "+ Nuevo rol" → aparece el formulario con campos nombre/descripción y tabla de checkboxes
- Dejar nombre vacío y click "Crear rol" → mensaje de error "El nombre es requerido."
- Completar nombre "prueba", marcar algunos permisos → "Crear rol" → toast de éxito, lista se recarga con el nuevo rol
- Click "Cancelar" → formulario desaparece
- Intentar crear otro rol con el mismo nombre → error "Ya existe un rol con ese nombre."

- [ ] **Step 4: Commit**

```bash
git add public/js/roles.js
git commit -m "feat(roles): new role creation form with inline permission checkboxes"
```

---

## Task 6: roles.js — eliminar rol

**Files:**
- Modify: `public/js/roles.js`

- [ ] **Step 1: Añadir _deleteRole**

```js
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
    showToast(`Rol "${role.name}" eliminado.`, 'success');
    await _loadAll();
  } catch {
    showToast('Error de conexión.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Eliminar rol'; }
  }
}
```

- [ ] **Step 2: Verificar eliminación de roles en el navegador**

Verificar:
- Rol con `user_count > 0`: botón "Eliminar rol" aparece deshabilitado (opaco, no clickeable)
- Rol con `user_count = 0` (ej: "prueba" creado en Task 5): botón clickeable → confirm → toast de éxito → rol desaparece de la lista
- Rol IT: no aparece botón de eliminar (tarjeta bloqueada)
- Intentar eliminar desde curl un rol con usuarios activos:

```bash
curl -s -X DELETE http://localhost:3000/api/roles/3 -b cookies.txt
# Esperado: {"error":"Este rol tiene 3 usuarios activos. Reasígnalos antes de eliminar."}
```

- [ ] **Step 3: Commit final**

```bash
git add public/js/roles.js
git commit -m "feat(roles): delete role with user-count guard and confirmation"
```

---

## Self-Review

**Spec coverage:**
- [x] Sección 1 — Ubicación en la app: Tab dentro de #users (Task 3)
- [x] Sección 2.1 — Lista de tarjetas con chevron y user_count (Task 4)
- [x] Sección 2.1 — Rol IT bloqueado (Task 4 _cardHtml)
- [x] Sección 2.1 — Solo una tarjeta expandida, confirm si hay cambios (Task 4 _toggleCard)
- [x] Sección 2.2 — Tabla módulos × acciones con checkboxes (Task 4 _renderCardBody)
- [x] Sección 2.2 — Módulos solo-lectura con celdas deshabilitadas (Task 4 _renderCardBody)
- [x] Sección 2.2 — Botón Guardar / Descartar (Task 4)
- [x] Sección 2.2 — Botón Eliminar deshabilitado si user_count > 0 (Task 4 _renderCardBody)
- [x] Sección 2.3 — Formulario nuevo rol con checkboxes en cero (Task 5)
- [x] Sección 2.4 — Mensajes de error: nombre vacío, duplicado, error de red (Tasks 5, 6)
- [x] Sección 3 — Todos los endpoints (Tasks 1, 2)
- [x] Sección 4 — Archivos correctos (Tasks 1-6)
- [x] Sección 5 — Protección IT en servidor (Task 2) y cliente (Task 4)
- [x] Sección 6 — Flujo de datos: carga paralela, carga lazy al expandir, batch save (Tasks 1, 4)
