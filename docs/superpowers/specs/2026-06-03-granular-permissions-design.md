# Granular Permission System — Design Spec
**Date:** 2026-06-03
**Status:** Approved

---

## Overview

Replace the current binary `full`/`farmacias` permission model with a CRUD-per-module permission system using `module:action` strings. The DB schema is unchanged — only new rows are inserted. The `full` permission remains a superuser bypass for the `it` role.

---

## 1. Database

### No schema changes. New seed data only.

All changes are `INSERT OR IGNORE` migrations added to the existing `migrations` array in `src/config/database.js`.

### 1.1 New permissions (28 total)

```sql
INSERT OR IGNORE INTO permissions (name) VALUES
  ('metrics:read'),
  ('tickets:read'),    ('tickets:create'),    ('tickets:edit'),    ('tickets:delete'),
  ('tech-requests:read'), ('tech-requests:create'), ('tech-requests:edit'), ('tech-requests:delete'),
  ('faqs:read'),       ('faqs:create'),       ('faqs:edit'),       ('faqs:delete'),
  ('sedes:read'),      ('sedes:create'),      ('sedes:edit'),      ('sedes:delete'),
  ('despacho:read'),   ('despacho:create'),   ('despacho:edit'),   ('despacho:delete'),
  ('audit:read'),
  ('farmacias:read'),  ('farmacias:create'),  ('farmacias:edit'),  ('farmacias:delete'),
  ('settings:read'),   ('settings:edit');
```

### 1.2 New roles (4)

```sql
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  (3, 'supervisor', 'Gestión de tickets y requerimientos'),
  (4, 'almacen',    'Gestión de despachos'),
  (5, 'auditor',    'Lectura completa + auditoría'),
  (6, 'viewer',     'Solo lectura en todos los módulos');
```

### 1.3 Role-permission matrix

| Permission | farmacias | supervisor | almacen | auditor | viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| metrics:read | — | ✓ | ✓ | ✓ | ✓ |
| tickets:read | — | ✓ | — | ✓ | ✓ |
| tickets:create | — | ✓ | — | — | — |
| tickets:edit | — | ✓ | — | — | — |
| tickets:delete | — | — | — | — | — |
| tech-requests:read | — | ✓ | — | ✓ | ✓ |
| tech-requests:create | — | ✓ | — | — | — |
| tech-requests:edit | — | ✓ | — | — | — |
| tech-requests:delete | — | — | — | — | — |
| faqs:read | — | ✓ | — | ✓ | ✓ |
| faqs:create | — | ✓ | — | — | — |
| faqs:edit | — | ✓ | — | — | — |
| faqs:delete | — | — | — | — | — |
| sedes:read | — | ✓ | ✓ | ✓ | ✓ |
| sedes:create | — | — | — | — | — |
| sedes:edit | — | — | — | — | — |
| sedes:delete | — | — | — | — | — |
| despacho:read | — | ✓ | ✓ | ✓ | ✓ |
| despacho:create | — | — | ✓ | — | — |
| despacho:edit | — | — | ✓ | — | — |
| despacho:delete | — | — | — | — | — |
| audit:read | — | — | — | ✓ | — |
| farmacias:read | ✓ | — | — | — | — |
| farmacias:create | ✓ | — | — | — | — |
| farmacias:edit | ✓ | — | — | — | — |
| farmacias:delete | ✓ | — | — | — | — |
| settings:read | — | — | — | — | — |
| settings:edit | — | — | — | — | — |

> `it` role keeps `full` — implicit bypass, no individual permissions needed.
> `settings:*` reserved for `it` only via `full` bypass.

---

## 2. Backend

### 2.1 `src/auth/auth-middleware.js` — one-line change

Add `full` bypass to `requirePermission`:

```js
export function requirePermission(name) {
  return (req, res, next) => {
    const perms = req.permissions ?? [];
    if (perms.includes('full') || perms.includes(name)) return next();
    return res.status(403).json({ error: 'Acceso denegado.' });
  };
}
```

### 2.2 Route protection map

Every route receives `requireAuth` + `requirePermission(action)` based on HTTP method:

| File | Endpoint pattern | Permission |
|---|---|---|
| `ticket-routes.js` | GET `/api/tickets`, `/api/tickets/:id`, `/api/agents` | `tickets:read` |
| | PUT `/api/tickets/:id`, POST `/:id/messages`, `/:id/notes`, `/:id/send-image` | `tickets:edit` |
| | PUT `/api/agents/:id` | `tickets:edit` |
| `tech-request-routes.js` | GET `/api/tech-requests`, `/api/tech-requests/stats`, `/:id` | `tech-requests:read` |
| | POST `/api/tech-requests` | `tech-requests:create` |
| | PUT `/:id`, POST `/:id/notes`, POST `/:id/acta` | `tech-requests:edit` |
| `faq-routes.js` | GET `/api/faqs` | `faqs:read` |
| | POST `/api/faqs` | `faqs:create` |
| | PUT `/api/faqs/:id` | `faqs:edit` |
| | DELETE `/api/faqs/:id` | `faqs:delete` |
| `sedes-routes.js` | GET `/api/sedes` | `sedes:read` |
| | POST `/api/sedes` | `sedes:create` |
| | PUT `/api/sedes/:id` | `sedes:edit` |
| | DELETE `/api/sedes/:id` | `sedes:delete` |
| `despacho-routes.js` | GET `/api/despachos`, `/:id`, `/borrador` | `despacho:read` |
| | POST `/api/despachos` | `despacho:create` |
| | PUT `/api/despachos/borrador`, `/:id` | `despacho:edit` |
| | DELETE `/api/despachos/borrador` | `despacho:edit` |
| `audit-routes.js` | GET `/api/audit`, `/api/audit/actas` | `audit:read` |
| `farmacias-routes.js` | GET `/api/farmacias` | `farmacias:read` |
| | POST `/api/farmacias/punto` | `farmacias:create` |
| | PUT `/api/farmacias/punto` | `farmacias:edit` |
| | DELETE `/api/farmacias/punto` | `farmacias:delete` |
| `metrics-routes.js` | GET `/api/metrics`, `/api/metrics/trend` | `metrics:read` |

### 2.3 Unchanged routes (intentional)

- `actas-routes.js` — token-based public access (QR signatures from external users)
- `auth-routes.js` — login/logout/me are necessarily public
- `user-routes.js` — already protected by `requirePermission('full')`

---

## 3. Frontend

### 3.1 `public/index.html`

All `<a class="menu-item">` sidebar items get `style="display:none"` by default. Currently only `nav-users` is hidden; all others are always visible. This prevents visual leakage before JS loads.

Items affected: `nav-dashboard`, `nav-tickets`, `nav-tech-requests`, `nav-faqs`, `nav-sedes`, `nav-despacho`, `nav-audit`, `nav-farmacias`, `nav-users`.

`nav-settings` remains always visible for authenticated users (no permission gate on settings nav).

### 3.2 `public/js/app.js` — `_applyUserUI`

Add `can()` helper and show each nav item conditionally:

```js
function _applyUserUI(user) {
  const can = (p) => user.permissions.includes('full') || user.permissions.includes(p);
  const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };

  // Header
  const label = document.getElementById('current-user-label');
  if (label) { label.textContent = user.username; label.style.display = 'inline'; }
  updateAgentAvatar(user.username);
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.style.display = 'inline-block';
    btnLogout.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.replace('/login.html');
    });
  }

  // Sidebar
  if (can('metrics:read'))        show('nav-dashboard');
  if (can('tickets:read'))        show('nav-tickets');
  if (can('tech-requests:read'))  show('nav-tech-requests');
  if (can('faqs:read'))           show('nav-faqs');
  if (can('sedes:read'))          show('nav-sedes');
  if (can('despacho:read'))       show('nav-despacho');
  if (can('audit:read'))          show('nav-audit');
  if (can('farmacias:read'))      show('nav-farmacias');
  if (can('full'))                show('nav-users');
  show('nav-settings');
}
```

### 3.3 Hash routing guard

In `app.js` routing logic, before rendering a section check permissions. If user navigates to an unauthorized hash, redirect to first accessible section.

---

## 4. Scalability Pattern

Adding a future module requires exactly 4 touch points, always the same:

```
1. src/config/database.js
   → INSERT OR IGNORE INTO permissions (name) VALUES ('newmod:read'), ('newmod:create'), ...
   → INSERT OR IGNORE INTO role_permissions ... (assign to relevant roles)

2. src/newmod/newmod-routes.js
   → import { requireAuth, requirePermission } from '../auth/auth-middleware.js'
   → router.get(...)  requireAuth, requirePermission('newmod:read')
   → router.post(...) requireAuth, requirePermission('newmod:create')
   → router.put(...)  requireAuth, requirePermission('newmod:edit')
   → router.delete(...) requireAuth, requirePermission('newmod:delete')

3. public/index.html
   → <a id="nav-newmod" style="display:none">...</a>

4. public/js/app.js  (_applyUserUI)
   → if (can('newmod:read')) show('nav-newmod');
```

No other files need changes. The `full` bypass ensures IT sees the new module automatically without any DB migration for roles.

---

## 5. Out of Scope

- UI for assigning permissions to roles (currently done via DB seed; managed through the Usuarios panel at role creation)
- Per-row data isolation (e.g., agent only sees their own tickets)
- API rate limiting or audit logging of permission denials
