# Granular Permission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary `full`/`farmacias` permission model with CRUD-per-module `module:action` permissions across all API routes and the frontend sidebar.

**Architecture:** New permissions are inserted as `INSERT OR IGNORE` migrations into the existing `permissions` and `role_permissions` tables — no schema changes. The `requirePermission` middleware gains a `full` bypass so IT always has access. The frontend sidebar starts fully hidden and items are revealed per permission after the auth check.

**Tech Stack:** Node.js ESM, Express.js, `node:sqlite` (`DatabaseSync`), vanilla JS SPA

---

## Task 1: DB migrations — new permissions, roles, role_permissions

**Files:**
- Modify: `src/config/database.js`

- [ ] **Step 1: Add new migrations to the migrations array**

Open `src/config/database.js`. Find the closing of the `migrations` array (the line with the last `INSERT OR IGNORE INTO role_permissions` entry, around line 123). Add these three entries **after** that last entry, before the closing `]`:

```js
  // ── Granular permissions ──────────────────────────────────────────────────
  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (3,  'metrics:read'),
    (4,  'tickets:read'),       (5,  'tickets:create'),
    (6,  'tickets:edit'),       (7,  'tickets:delete'),
    (8,  'tech-requests:read'), (9,  'tech-requests:create'),
    (10, 'tech-requests:edit'), (11, 'tech-requests:delete'),
    (12, 'faqs:read'),          (13, 'faqs:create'),
    (14, 'faqs:edit'),          (15, 'faqs:delete'),
    (16, 'sedes:read'),         (17, 'sedes:create'),
    (18, 'sedes:edit'),         (19, 'sedes:delete'),
    (20, 'despacho:read'),      (21, 'despacho:create'),
    (22, 'despacho:edit'),      (23, 'despacho:delete'),
    (24, 'audit:read'),
    (25, 'farmacias:read'),     (26, 'farmacias:create'),
    (27, 'farmacias:edit'),     (28, 'farmacias:delete'),
    (29, 'settings:read'),      (30, 'settings:edit')`,

  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (3, 'supervisor', 'Gestión de tickets y requerimientos'),
    (4, 'almacen',    'Gestión de despachos'),
    (5, 'auditor',    'Lectura completa + auditoría'),
    (6, 'viewer',     'Solo lectura en todos los módulos')`,

  // supervisor (3): metrics+tickets:rce + tech-requests:rce + faqs:rce + sedes:r + despacho:r
  // almacen   (4): metrics:r + sedes:r + despacho:rce
  // auditor   (5): metrics:r + tickets:r + tech-requests:r + faqs:r + sedes:r + despacho:r + audit:r
  // viewer    (6): metrics:r + tickets:r + tech-requests:r + faqs:r + sedes:r + despacho:r
  // farmacias (2): gains granular farmacias:* (already has old id=2 perm, add new ones)
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (3,3),(3,4),(3,5),(3,6),(3,8),(3,9),(3,10),(3,12),(3,13),(3,14),(3,16),(3,20),
    (4,3),(4,16),(4,20),(4,21),(4,22),
    (5,3),(5,4),(5,8),(5,12),(5,16),(5,20),(5,24),
    (6,3),(6,4),(6,8),(6,12),(6,16),(6,20),
    (2,25),(2,26),(2,27),(2,28)`,
```

- [ ] **Step 2: Verify migrations run without errors**

Start the server: `npm run dev`

Expected: server starts cleanly, no SQLite errors in console output.

- [ ] **Step 3: Verify new data in DB**

In a separate terminal, run:
```bash
node -e "
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./database/tickets.db');
console.log('permissions:', db.prepare('SELECT id,name FROM permissions ORDER BY id').all());
console.log('roles:', db.prepare('SELECT id,name FROM roles ORDER BY id').all());
console.log('rp count:', db.prepare('SELECT COUNT(*) as n FROM role_permissions').get());
"
```

Expected: 30 permissions, 6 roles, role_permissions count ≥ 31.

- [ ] **Step 4: Commit**

```bash
git add src/config/database.js
git commit -m "feat(auth): seed granular module:action permissions and 4 new roles"
```

---

## Task 2: Auth middleware — add `full` bypass to `requirePermission`

**Files:**
- Modify: `src/auth/auth-middleware.js`

- [ ] **Step 1: Update `requirePermission`**

Replace the current body of `requirePermission` in `src/auth/auth-middleware.js`:

```js
export function requirePermission(name) {
  return (req, res, next) => {
    const perms = req.permissions ?? [];
    if (perms.includes('full') || perms.includes(name)) return next();
    return res.status(403).json({ error: 'Acceso denegado.' });
  };
}
```

- [ ] **Step 2: Verify IT user still passes**

With the server running, log in as `admin` (IT role) and hit a route that previously required `full`:

```bash
# Get session cookie first via login, then:
curl -s -b "it_session=<token>" http://localhost:3000/api/users
```

Expected: `200` response with users list (not 403).

- [ ] **Step 3: Commit**

```bash
git add src/auth/auth-middleware.js
git commit -m "feat(auth): add full-bypass to requirePermission for superuser IT role"
```

---

## Task 3: Protect ticket routes

**Files:**
- Modify: `src/tickets/ticket-routes.js`

- [ ] **Step 1: Add import and protect all routes**

Replace the top of `src/tickets/ticket-routes.js` (the import block and router declaration) and add middleware to each route:

```js
import express from 'express';
import db from '../config/database.js';
import {
  getAllTickets,
  getTicketById,
  updateTicket,
  addMessage,
  addInternalNote
} from './ticket-model.js';
import { sendWhatsAppMessage, sendWhatsAppImage } from '../whatsapp/messenger.js';
import { appEvents } from '../events/broadcaster.js';
import { logAudit } from '../audit/audit-logger.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = express.Router();

const canRead  = [requireAuth, requirePermission('tickets:read')];
const canEdit  = [requireAuth, requirePermission('tickets:edit')];
```

Then update each route signature (only the `router.METHOD(path, ...)` line — keep handler body unchanged):

```js
router.get('/api/tickets',                ...canRead,  (req, res) => { ... });
router.get('/api/tickets/:id',            ...canRead,  (req, res) => { ... });
router.put('/api/tickets/:id',            ...canEdit,  (req, res) => { ... });
router.post('/api/tickets/:id/messages',  ...canEdit,  async (req, res) => { ... });
router.post('/api/tickets/:id/notes',     ...canEdit,  (req, res) => { ... });
router.post('/api/tickets/:id/send-image',...canEdit,  async (req, res) => { ... });
router.get('/api/agents',                 ...canRead,  (req, res) => { ... });
router.put('/api/agents/:id',             ...canEdit,  (req, res) => { ... });
```

- [ ] **Step 2: Verify unauthenticated request is rejected**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tickets
```

Expected: `401`

- [ ] **Step 3: Verify IT user can still access**

```bash
curl -s -o /dev/null -w "%{http_code}" -b "it_session=<token>" http://localhost:3000/api/tickets
```

Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add src/tickets/ticket-routes.js
git commit -m "feat(auth): protect ticket and agent routes with tickets:read/edit permissions"
```

---

## Task 4: Protect tech-request routes

**Files:**
- Modify: `src/tech-requests/tech-request-routes.js`

- [ ] **Step 1: Add import and middleware**

Add import after the existing imports:

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const canRead   = [requireAuth, requirePermission('tech-requests:read')];
const canCreate = [requireAuth, requirePermission('tech-requests:create')];
const canEdit   = [requireAuth, requirePermission('tech-requests:edit')];
```

Then update each route signature:

```js
router.get('/api/tech-requests/stats',      ...canRead,   (req, res) => { ... });
router.get('/api/tech-requests',            ...canRead,   (req, res) => { ... });
router.post('/api/tech-requests',           ...canCreate, (req, res) => { ... });
router.get('/api/tech-requests/:id',        ...canRead,   (req, res) => { ... });
router.put('/api/tech-requests/:id',        ...canEdit,   (req, res) => { ... });
router.post('/api/tech-requests/:id/notes', ...canEdit,   (req, res) => { ... });
router.post('/api/tech-requests/:id/acta',  ...canEdit,   async (req, res) => { ... });
```

- [ ] **Step 2: Verify**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tech-requests
```

Expected: `401`

- [ ] **Step 3: Commit**

```bash
git add src/tech-requests/tech-request-routes.js
git commit -m "feat(auth): protect tech-request routes with tech-requests:read/create/edit permissions"
```

---

## Task 5: Protect FAQ routes

**Files:**
- Modify: `src/knowledge/faq-routes.js`

- [ ] **Step 1: Add import and middleware**

Add import after existing imports:

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
```

Update each route signature:

```js
router.get('/api/faqs',      requireAuth, requirePermission('faqs:read'),   (req, res) => { ... });
router.post('/api/faqs',     requireAuth, requirePermission('faqs:create'), (req, res) => { ... });
router.put('/api/faqs/:id',  requireAuth, requirePermission('faqs:edit'),   (req, res) => { ... });
router.delete('/api/faqs/:id',requireAuth,requirePermission('faqs:delete'), (req, res) => { ... });
```

- [ ] **Step 2: Verify**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/faqs
```

Expected: `401`

- [ ] **Step 3: Commit**

```bash
git add src/knowledge/faq-routes.js
git commit -m "feat(auth): protect FAQ routes with faqs:read/create/edit/delete permissions"
```

---

## Task 6: Protect sedes routes

**Files:**
- Modify: `src/sedes/sedes-routes.js`

- [ ] **Step 1: Add import and middleware**

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
```

Update each route signature:

```js
router.get('/api/sedes',        requireAuth, requirePermission('sedes:read'),   (req, res) => { ... });
router.post('/api/sedes',       requireAuth, requirePermission('sedes:create'), (req, res) => { ... });
router.put('/api/sedes/:id',    requireAuth, requirePermission('sedes:edit'),   (req, res) => { ... });
router.delete('/api/sedes/:id', requireAuth, requirePermission('sedes:delete'), (req, res) => { ... });
```

- [ ] **Step 2: Verify**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/sedes
```

Expected: `401`

- [ ] **Step 3: Commit**

```bash
git add src/sedes/sedes-routes.js
git commit -m "feat(auth): protect sedes routes with sedes:read/create/edit/delete permissions"
```

---

## Task 7: Protect despacho routes

**Files:**
- Modify: `src/despacho/despacho-routes.js`

- [ ] **Step 1: Add import and middleware**

Add import after existing imports:

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const canRead   = [requireAuth, requirePermission('despacho:read')];
const canCreate = [requireAuth, requirePermission('despacho:create')];
const canEdit   = [requireAuth, requirePermission('despacho:edit')];
```

Update each route signature (keep all handler bodies unchanged):

```js
router.get('/api/despachos',            ...canRead,   (req, res) => { ... });
router.get('/api/despachos/borrador',   ...canRead,   (req, res) => { ... });
router.put('/api/despachos/borrador',   ...canEdit,   (req, res) => { ... });
router.delete('/api/despachos/borrador',...canEdit,   (req, res) => { ... });
router.get('/api/despachos/:id',        ...canRead,   (req, res) => { ... });
router.post('/api/despachos',           ...canCreate, (req, res) => { ... });
router.put('/api/despachos/:id',        ...canEdit,   (req, res) => { ... });
```

> **Important:** `GET /api/despachos/borrador` must be registered **before** `GET /api/despachos/:id` — Express matches routes in order. The current file already has this ordering; preserve it.

- [ ] **Step 2: Verify**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/despachos
```

Expected: `401`

- [ ] **Step 3: Commit**

```bash
git add src/despacho/despacho-routes.js
git commit -m "feat(auth): protect despacho routes with despacho:read/create/edit permissions"
```

---

## Task 8: Protect audit, metrics, and farmacias routes

**Files:**
- Modify: `src/audit/audit-routes.js`
- Modify: `src/metrics/metrics-routes.js`
- Modify: `src/farmacias/farmacias-routes.js`

- [ ] **Step 1: Protect audit routes**

Add import + middleware to `src/audit/audit-routes.js`:

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
```

Update routes:

```js
router.get('/api/audit',       requireAuth, requirePermission('audit:read'), (req, res) => { ... });
router.get('/api/audit/actas', requireAuth, requirePermission('audit:read'), (req, res) => { ... });
```

- [ ] **Step 2: Protect metrics routes**

Add import + middleware to `src/metrics/metrics-routes.js`:

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
```

Update routes:

```js
router.get('/api/metrics',       requireAuth, requirePermission('metrics:read'), (req, res) => { ... });
router.get('/api/metrics/trend', requireAuth, requirePermission('metrics:read'), (req, res) => { ... });
```

- [ ] **Step 3: Protect farmacias routes**

Add import + middleware to `src/farmacias/farmacias-routes.js`:

```js
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
```

Update routes:

```js
router.get('/api/farmacias',         requireAuth, requirePermission('farmacias:read'),   async (req, res) => { ... });
router.put('/api/farmacias/punto',   requireAuth, requirePermission('farmacias:edit'),   async (req, res) => { ... });
router.post('/api/farmacias/punto',  requireAuth, requirePermission('farmacias:create'), async (req, res) => { ... });
router.delete('/api/farmacias/punto',requireAuth, requirePermission('farmacias:delete'), async (req, res) => { ... });
```

- [ ] **Step 4: Verify all three**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/audit
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/metrics
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/farmacias
```

Expected: `401 401 401`

- [ ] **Step 5: Commit**

```bash
git add src/audit/audit-routes.js src/metrics/metrics-routes.js src/farmacias/farmacias-routes.js
git commit -m "feat(auth): protect audit, metrics and farmacias routes"
```

---

## Task 9: Frontend — hide all sidebar nav items by default

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add `display:none` to all nav items and `id` to farmacias link**

In `public/index.html`, update the `<nav class="sidebar-menu">` block. Apply `style="display:none"` to every `<a class="menu-item">` that doesn't already have it, and add `id="nav-farmacias"` to the farmacias link. Replace the entire nav block (lines 37–78) with:

```html
    <!-- Nav -->
    <nav class="sidebar-menu">
      <a href="#dashboard" class="menu-item" id="nav-dashboard" style="display:none;">
        <span class="menu-icon"><i data-lucide="layout-dashboard" class="lucide"></i></span>
        <span class="menu-label">Dashboard</span>
      </a>
      <a href="#tickets" class="menu-item" id="nav-tickets" style="display:none;">
        <span class="menu-icon"><i data-lucide="ticket" class="lucide"></i></span>
        <span class="menu-label">Tickets</span>
      </a>
      <a href="#tech-requests" class="menu-item" id="nav-tech-requests" style="display:none;">
        <span class="menu-icon"><i data-lucide="package" class="lucide"></i></span>
        <span class="menu-label">Requerimientos</span>
      </a>
      <a href="#faqs" class="menu-item" id="nav-faqs" style="display:none;">
        <span class="menu-icon"><i data-lucide="book-open" class="lucide"></i></span>
        <span class="menu-label">Base de Conocimiento</span>
      </a>
      <a href="#sedes" class="menu-item" id="nav-sedes" style="display:none;">
        <span class="menu-icon"><i data-lucide="map-pin" class="lucide"></i></span>
        <span class="menu-label">Red de Puntos</span>
      </a>
      <a href="#despacho" class="menu-item" id="nav-despacho" style="display:none;">
        <span class="menu-icon"><i data-lucide="package-check" class="lucide"></i></span>
        <span class="menu-label">Despacho</span>
      </a>
      <a href="#audit" class="menu-item" id="nav-audit" style="display:none;">
        <span class="menu-icon"><i data-lucide="shield-check" class="lucide"></i></span>
        <span class="menu-label">Auditoría</span>
      </a>
      <a href="/farmacias.html" class="menu-item" id="nav-farmacias" style="display:none;">
        <span class="menu-icon"><i data-lucide="map-pin" class="lucide"></i></span>
        <span class="menu-label">Farmacias FOMAG</span>
      </a>
      <a href="#users" class="menu-item" id="nav-users" style="display:none;">
        <span class="menu-icon"><i data-lucide="users" class="lucide"></i></span>
        <span class="menu-label">Usuarios</span>
      </a>
      <a href="#settings" class="menu-item" id="nav-settings">
        <span class="menu-icon"><i data-lucide="settings" class="lucide"></i></span>
        <span class="menu-label">Configuración</span>
      </a>
    </nav>
```

> `nav-settings` intentionally keeps no `display:none` — settings is always visible for any authenticated user.

- [ ] **Step 2: Verify sidebar appears empty before login**

Open `http://localhost:3000` without a session. Expected: sidebar shows only "Configuración". All other items invisible.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(auth): hide all sidebar nav items by default — revealed per permission"
```

---

## Task 10: Frontend — `app.js` permission-aware sidebar and routing guard

**Files:**
- Modify: `public/js/app.js`

This task has three sub-changes: (A) module-level `can()` helper, (B) rewrite `_applyUserUI`, (C) add routing guard to `router()` + fix `init()`.

- [ ] **Step 1: Add module-level `can()` and `_firstAccessibleHash()` helpers**

Find the line `export const state = {` (around line 16). Add these two functions **before** it:

```js
function can(permission) {
  const user = state.currentUser;
  if (!user) return false;
  return user.permissions.includes('full') || user.permissions.includes(permission);
}

function _firstAccessibleHash() {
  if (can('metrics:read'))       return '#dashboard';
  if (can('tickets:read'))       return '#tickets';
  if (can('tech-requests:read')) return '#tech-requests';
  if (can('faqs:read'))          return '#faqs';
  if (can('sedes:read'))         return '#sedes';
  if (can('despacho:read'))      return '#despacho';
  if (can('audit:read'))         return '#audit';
  return '#settings';
}
```

> These reference `state.currentUser` which is declared below — hoisting is fine since both functions are only called after `state` is initialized.

- [ ] **Step 2: Rewrite `_applyUserUI`**

Replace the entire `function _applyUserUI(user)` block (lines 504–527) with:

```js
function _applyUserUI(user) {
  const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };

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

  if (can('metrics:read'))       show('nav-dashboard');
  if (can('tickets:read'))       show('nav-tickets');
  if (can('tech-requests:read')) show('nav-tech-requests');
  if (can('faqs:read'))          show('nav-faqs');
  if (can('sedes:read'))         show('nav-sedes');
  if (can('despacho:read'))      show('nav-despacho');
  if (can('audit:read'))         show('nav-audit');
  if (can('farmacias:read'))     show('nav-farmacias');
  if (can('full'))               show('nav-users');
}
```

- [ ] **Step 3: Add routing guard to every `router()` case**

In the `router()` function, add a permission guard before each `renderX()` call. Replace the `switch (hash)` block (lines 138–196) with:

```js
  switch (hash) {
    case '#dashboard':
      if (state.currentUser && !can('metrics:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'dashboard';
      document.getElementById('nav-dashboard')?.classList.add('active');
      renderDashboard(appContainer);
      break;
    case '#tickets':
      if (state.currentUser && !can('tickets:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'tickets';
      document.getElementById('nav-tickets')?.classList.add('active');
      renderTicketList(appContainer);
      break;
    case '#tech-requests':
      if (state.currentUser && !can('tech-requests:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'tech-requests';
      document.getElementById('nav-tech-requests')?.classList.add('active');
      renderTechRequests(appContainer);
      break;
    case '#faqs':
      if (state.currentUser && !can('faqs:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'faqs';
      document.getElementById('nav-faqs')?.classList.add('active');
      renderFaqs(appContainer);
      break;
    case '#settings':
      state.currentPage = 'settings';
      document.getElementById('nav-settings')?.classList.add('active');
      renderSettings(appContainer);
      break;
    case '#sedes':
      if (state.currentUser && !can('sedes:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'sedes';
      document.getElementById('nav-sedes')?.classList.add('active');
      renderSedesAdmin(appContainer);
      break;
    case '#despacho':
      if (state.currentUser && !can('despacho:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'despacho';
      document.getElementById('nav-despacho')?.classList.add('active');
      renderDespacho(appContainer);
      break;
    case '#audit':
      if (state.currentUser && !can('audit:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'audit';
      document.getElementById('nav-audit')?.classList.add('active');
      renderAudit(appContainer);
      break;
    case '#users':
      if (state.currentUser && !can('full')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'users';
      document.getElementById('nav-users')?.classList.add('active');
      renderUsers(appContainer);
      break;
    default:
      if (state.currentUser && !can('metrics:read')) { window.location.hash = _firstAccessibleHash(); break; }
      state.currentPage = 'dashboard';
      document.getElementById('nav-dashboard')?.classList.add('active');
      renderDashboard(appContainer);
  }
```

Also update the two `if (hash.startsWith(...))` blocks above the switch to add guards:

```js
  if (hash.startsWith('#ticket/')) {
    if (state.currentUser && !can('tickets:read')) { window.location.hash = _firstAccessibleHash(); return; }
    const ticketId = hash.split('/')[1];
    state.currentPage = 'ticket-detail';
    document.getElementById('nav-tickets')?.classList.add('active');
    renderTicketDetail(appContainer, ticketId);
  } else if (hash.startsWith('#tech-request/')) {
    if (state.currentUser && !can('tech-requests:read')) { window.location.hash = _firstAccessibleHash(); return; }
    const reqId = hash.split('/')[1];
    state.currentPage = 'tech-request-detail';
    document.getElementById('nav-tech-requests')?.classList.add('active');
    renderTechRequestDetail(appContainer, reqId);
  } else {
    switch (hash) {
      // ... (the switch above)
    }
  }
```

- [ ] **Step 4: Update `init()` — remove deprecated cachedRole block, add offline fallback**

In `init()`, find and remove this stale block (lines 205–209):

```js
  // REMOVE THIS BLOCK:
  const cachedRole = sessionStorage.getItem('it_role');
  if (cachedRole === 'it') {
    const navUsers = document.getElementById('nav-users');
    if (navUsers) navUsers.style.display = 'flex';
  }
```

Then find the `if (isOfflineMode)` block that shows the demo toast (around line 230). Before that block, add offline nav fallback:

```js
  if (isOfflineMode) {
    // Offline/demo mode: show all nav items since there is no auth server
    document.querySelectorAll('.menu-item').forEach(el => el.style.display = 'flex');
  }
```

- [ ] **Step 5: Verify IT user sees all nav items after login**

Log in as `admin` (IT role). Expected: all sidebar items visible including Usuarios.

- [ ] **Step 6: Create a test user with `supervisor` role and verify correct nav**

In the Usuarios panel, create a user with role `supervisor`. Log in as that user.

Expected nav visible: Dashboard, Tickets, Requerimientos, Base de Conocimiento, Red de Puntos, Despacho, Configuración.

Expected nav hidden: Auditoría, Farmacias FOMAG, Usuarios.

Expected: trying to navigate to `#audit` in the URL bar redirects to `#dashboard`.

- [ ] **Step 7: Commit**

```bash
git add public/js/app.js
git commit -m "feat(auth): permission-aware sidebar visibility and routing guard in SPA"
```

---

## Verification Summary

After all tasks complete, run this end-to-end checklist:

| Check | Expected |
|---|---|
| `curl http://localhost:3000/api/tickets` | `401` |
| `curl http://localhost:3000/api/metrics` | `401` |
| `curl http://localhost:3000/api/audit` | `401` |
| `curl http://localhost:3000/api/faqs` | `401` |
| `curl http://localhost:3000/api/despachos` | `401` |
| IT login → all nav items visible | ✓ |
| supervisor login → no Auditoría, no Farmacias, no Usuarios | ✓ |
| almacen login → only Dashboard, Sedes, Despacho, Configuración | ✓ |
| auditor login → no Usuarios, no Farmacias, no write actions | ✓ |
| farmacias login → only Farmacias FOMAG + Configuración | ✓ |
| URL bar `#audit` as supervisor → redirects to first accessible section | ✓ |
| `actas` endpoints remain public (no auth) | ✓ |
| `auth` endpoints remain public (login works) | ✓ |
