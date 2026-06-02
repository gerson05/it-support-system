# Auth & Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar autenticación usuario/contraseña con RBAC — usuarios externos solo acceden a Farmacias, equipo IT tiene acceso completo; gestión de usuarios desde el panel.

**Architecture:** Sesiones en SQLite con token en cookie `httpOnly`. RBAC via tablas `roles/permissions/role_permissions`. Guard frontend en `auth.js` (ES module) que protege `index.html` y `farmacias.html`. Panel de usuarios en la SPA de IT (solo rol `it`).

**Tech Stack:** Express + SQLite DatabaseSync (existentes), bcryptjs (nuevo), vanilla JS ESM (existente).

---

## File Map

### Archivos nuevos
- `src/auth/auth-service.js` — hashing bcrypt, CRUD de sesiones, initAdminUser
- `src/auth/auth-middleware.js` — requireAuth, requirePermission middlewares
- `src/auth/auth-routes.js` — POST /api/auth/login, /api/auth/logout, GET /api/auth/me
- `src/auth/user-routes.js` — CRUD /api/users, GET /api/roles
- `public/login.html` — página de login standalone
- `public/js/auth.js` — guard ESM: initAuth(), logout()
- `public/js/usuarios.js` — panel de gestión de usuarios (renderUsuarios)

### Archivos modificados
- `src/config/database.js` — 5 tablas nuevas + seed roles/permisos + limpieza sesiones
- `server.js` — registrar auth/user routers; proteger rutas existentes con middleware
- `public/index.html` — entrada "Usuarios" en sidebar + botón logout + id en avatar
- `public/js/app.js` — import initAuth + guard al init + ruta `#usuarios`
- `public/farmacias.html` — `<script type="module">` + ids para auth + botón logout
- `public/js/farmacias.js` — import initAuth + llamada al guard al inicio del DOMContentLoaded

---

## Task 1: Instalar bcryptjs y agregar tablas de auth a la DB

**Files:**
- Modify: `src/config/database.js`

- [ ] **Step 1: Instalar bcryptjs**

```bash
cd "C:\Users\equipo sitemas 1\.gemini\antigravity\scratch\it-tickets"
npm install bcryptjs
```

Salida esperada: `added 1 package` (o similar), sin errores.

- [ ] **Step 2: Agregar las 5 tablas y seed al array `migrations` en `database.js`**

Abrir `src/config/database.js`. Agregar al **final** del array `migrations` (después de la última entrada `CREATE INDEX IF NOT EXISTS idx_acta_uploads_entity...`):

```js
  `CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id       INTEGER NOT NULL,
    active        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    updated_at    TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (1, 'it',        'Equipo IT — acceso completo'),
    (2, 'farmacias', 'Acceso solo al directorio de farmacias')`,
  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (1, 'full'),
    (2, 'farmacias')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1,1),(1,2),(2,2)`,
```

- [ ] **Step 3: Agregar limpieza de sesiones expiradas al arranque**

Después del `for (const sql of migrations)` loop (pero antes del bloque de sedes), agregar:

```js
// Limpiar sesiones expiradas al arrancar
try {
  db.exec("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')");
} catch {}
```

- [ ] **Step 4: Commit**

```bash
git add src/config/database.js package.json package-lock.json
git commit -m "chore: instalar bcryptjs y agregar tablas auth/roles/sessions a la DB"
```

---

## Task 2: Crear src/auth/auth-service.js

**Files:**
- Create: `src/auth/auth-service.js`

- [ ] **Step 1: Crear el directorio y el archivo**

```bash
mkdir "src\auth"
```

Crear `src/auth/auth-service.js` con el siguiente contenido completo:

```js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/database.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function getSession(token) {
  if (!token) return null;

  const session = db.prepare(
    `SELECT s.user_id, s.expires_at, u.username, u.active, u.role_id,
            r.name AS role_name
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
  ).get(token);

  if (!session || !session.active) return null;

  const permissions = db.prepare(
    `SELECT p.name FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ?`
  ).all(session.role_id).map(p => p.name);

  // Sliding window — extender sesión 8h más en cada uso
  const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);

  return {
    id:          session.user_id,
    username:    session.username,
    role:        session.role_name,
    permissions,
  };
}

export function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export async function initAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const pass = crypto.randomBytes(6).toString('hex'); // 12 chars
  const hash = await hashPassword(pass);
  db.prepare(
    'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)'
  ).run('admin', hash, 1);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  [Auth] Usuario admin creado                 ║');
  console.log(`║  Usuario:    admin                           ║`);
  console.log(`║  Contraseña: ${pass}                   ║`);
  console.log('║  Cámbiala desde el panel → Usuarios          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/auth-service.js
git commit -m "feat: auth-service — hashing bcrypt, sesiones SQLite, initAdminUser"
```

---

## Task 3: Crear src/auth/auth-middleware.js

**Files:**
- Create: `src/auth/auth-middleware.js`

- [ ] **Step 1: Crear el archivo**

```js
import { getSession } from './auth-service.js';

function extractToken(cookieHeader) {
  if (!cookieHeader) return null;
  const part = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('it_session='));
  return part ? decodeURIComponent(part.slice('it_session='.length)) : null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req.headers.cookie);
  const user = getSession(token);
  if (!user) return res.status(401).json({ error: 'No autenticado.' });
  req.user = user;
  req.permissions = user.permissions;
  next();
}

export function requirePermission(name) {
  return (req, res, next) => {
    if (!req.permissions?.includes(name)) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }
    next();
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/auth-middleware.js
git commit -m "feat: auth-middleware — requireAuth y requirePermission"
```

---

## Task 4: Crear src/auth/auth-routes.js

**Files:**
- Create: `src/auth/auth-routes.js`

- [ ] **Step 1: Crear el archivo**

```js
import express from 'express';
import db from '../config/database.js';
import { verifyPassword, createSession, deleteSession } from './auth-service.js';
import { requireAuth } from './auth-middleware.js';

const router = express.Router();

const COOKIE = 'it_session';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 };

router.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const user = db.prepare(
    'SELECT id, password_hash, active, role_id FROM users WHERE username = ?'
  ).get(username);

  const valid = user && await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas.' });
  if (!user.active) return res.status(403).json({ error: 'Cuenta desactivada. Contacta al equipo IT.' });

  const { token } = createSession(user.id);
  res.cookie(COOKIE, token, COOKIE_OPTS);

  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
  res.json({ ok: true, role: role.name });
});

router.post('/api/auth/logout', (req, res) => {
  const part = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='));
  if (part) deleteSession(decodeURIComponent(part.slice(COOKIE.length + 1)));
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id:          req.user.id,
    username:    req.user.username,
    role:        req.user.role,
    permissions: req.permissions,
  });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/auth-routes.js
git commit -m "feat: auth-routes — login, logout, me endpoints"
```

---

## Task 5: Crear src/auth/user-routes.js

**Files:**
- Create: `src/auth/user-routes.js`

- [ ] **Step 1: Crear el archivo**

```js
import express from 'express';
import db from '../config/database.js';
import { hashPassword, deleteUserSessions } from './auth-service.js';
import { requireAuth, requirePermission } from './auth-middleware.js';

const router = express.Router();
const itOnly = [requireAuth, requirePermission('full')];

router.get('/api/roles', requireAuth, (_req, res) => {
  res.json(db.prepare('SELECT id, name, description FROM roles').all());
});

router.get('/api/users', ...itOnly, (_req, res) => {
  const users = db.prepare(
    `SELECT u.id, u.username, u.active, u.created_at, u.updated_at,
            r.id AS role_id, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  ).all();
  res.json(users);
});

router.post('/api/users', ...itOnly, async (req, res) => {
  const { username, password, role_id } = req.body;
  if (!username || !password || !role_id) {
    return res.status(400).json({ error: 'username, password y role_id son requeridos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id)) {
    return res.status(400).json({ error: 'Rol no válido.' });
  }
  try {
    const hash = await hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)'
    ).run(username, hash, role_id);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    }
    throw err;
  }
});

router.put('/api/users/:id', ...itOnly, async (req, res) => {
  const targetId = Number(req.params.id);
  const { password, role_id, active } = req.body;

  const target = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  if (targetId === req.user.id && (role_id !== undefined || active === 0)) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol ni desactivar tu cuenta.' });
  }

  if (active === 0) {
    const itRole = db.prepare("SELECT id FROM roles WHERE name = 'it'").get();
    if (itRole && target.role_id === itRole.id) {
      const itCount = db.prepare(
        'SELECT COUNT(*) AS n FROM users WHERE role_id = ? AND active = 1'
      ).get(itRole.id).n;
      if (itCount <= 1) {
        return res.status(400).json({ error: 'No puedes desactivar al único usuario IT activo.' });
      }
    }
  }

  if (password !== undefined && password !== '') {
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const hash = await hashPassword(password);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(hash, targetId);
  }
  if (role_id !== undefined) {
    if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id)) {
      return res.status(400).json({ error: 'Rol no válido.' });
    }
    db.prepare("UPDATE users SET role_id = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(role_id, targetId);
  }
  if (active !== undefined) {
    db.prepare("UPDATE users SET active = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(active ? 1 : 0, targetId);
    if (!active) deleteUserSessions(targetId);
  }

  res.json({ ok: true });
});

router.delete('/api/users/:id', ...itOnly, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
  }
  const target = db.prepare('SELECT id, role_id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const itRole = db.prepare("SELECT id FROM roles WHERE name = 'it'").get();
  if (itRole && target.role_id === itRole.id) {
    const itCount = db.prepare(
      'SELECT COUNT(*) AS n FROM users WHERE role_id = ? AND active = 1'
    ).get(itRole.id).n;
    if (itCount <= 1) {
      return res.status(400).json({ error: 'No puedes desactivar al único usuario IT activo.' });
    }
  }

  db.prepare("UPDATE users SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(targetId);
  deleteUserSessions(targetId);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/user-routes.js
git commit -m "feat: user-routes — CRUD de usuarios y GET /api/roles"
```

---

## Task 6: Integrar auth en server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Agregar los 4 imports de auth al bloque de imports existente**

Después de `import actasRouter from './src/actas/actas-routes.js';`, agregar:

```js
import authRouter   from './src/auth/auth-routes.js';
import userRouter   from './src/auth/user-routes.js';
import { requireAuth, requirePermission } from './src/auth/auth-middleware.js';
import { initAdminUser } from './src/auth/auth-service.js';
```

- [ ] **Step 2: Reemplazar el bloque de `app.use(router)` existente**

Localizar el bloque actual (líneas ~38-47 en server.js):

```js
// Registrar routers del sistema
app.use(webhookRouter);
app.use(ticketRouter);
app.use(metricsRouter);
app.use(techRequestRouter);
app.use(faqRouter);
app.use(sedesRouter);
app.use(auditRouter);
app.use(despachoRouter);
app.use(farmaciasRouter);
app.use(actasRouter);
```

Reemplazarlo por:

```js
// Registrar routers del sistema
app.use(authRouter);                                              // público: /api/auth/*
app.use(webhookRouter);                                           // público: webhook WhatsApp

const itOnly = [requireAuth, requirePermission('full')];

app.use(requireAuth, requirePermission('farmacias'), farmaciasRouter); // auth + permiso farmacias
app.use(...itOnly, ticketRouter);
app.use(...itOnly, metricsRouter);
app.use(...itOnly, techRequestRouter);
app.use(...itOnly, faqRouter);
app.use(...itOnly, sedesRouter);
app.use(...itOnly, auditRouter);
app.use(...itOnly, despachoRouter);
app.use(...itOnly, actasRouter);
app.use(...itOnly, userRouter);
```

- [ ] **Step 3: Proteger los endpoints inline de server.js**

Buscar y modificar cada uno de estos endpoints inline para añadir `...itOnly` (o los dos middleware explícitos) como segundo argumento:

```js
// /api/simulate
app.post('/api/simulate', ...itOnly, async (req, res) => {

// /api/simulate/reset
app.post('/api/simulate/reset', ...itOnly, (req, res) => {

// /api/events
app.get('/api/events', ...itOnly, (req, res) => {

// /api/network-info
app.get('/api/network-info', ...itOnly, (req, res) => {

// /api/whatsapp/status
app.get('/api/whatsapp/status', ...itOnly, (req, res) => {

// /api/whatsapp/qr
app.get('/api/whatsapp/qr', ...itOnly, (req, res) => {

// /api/whatsapp/connect
app.post('/api/whatsapp/connect', ...itOnly, (req, res) => {

// /api/whatsapp/logout
app.post('/api/whatsapp/logout', ...itOnly, async (req, res) => {

// /api/whatsapp/reset
app.post('/api/whatsapp/reset', ...itOnly, (req, res) => {
```

- [ ] **Step 4: Llamar a initAdminUser en el callback del app.listen**

Localizar el callback de `app.listen(PORT, () => {`. Cambiar la firma a `async` y agregar la llamada al inicio del callback:

```js
app.listen(PORT, async () => {
  // Crear usuario admin si la tabla users está vacía
  await initAdminUser();

  console.log(`\n======================================================`);
  // ... resto del console.log existente ...
```

- [ ] **Step 5: Verificar que el servidor arranca y muestra las credenciales admin**

```bash
node server.js
```

Salida esperada (primera ejecución):
```
╔══════════════════════════════════════════════╗
║  [Auth] Usuario admin creado                 ║
║  Usuario:    admin                           ║
║  Contraseña: <12-chars-hex>                  ║
║  Cámbiala desde el panel → Usuarios          ║
╚══════════════════════════════════════════════╝
```

- [ ] **Step 6: Verificar endpoints de auth con curl**

```bash
# Login — debe retornar { ok: true, role: "it" }
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"<contraseña-de-consola>\"}"

# Me — debe retornar datos del usuario
curl -s -b cookies.txt http://localhost:3000/api/auth/me

# Ruta protegida sin auth — debe retornar 401
curl -s http://localhost:3000/api/tickets
```

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "feat: aplicar middleware de auth a todas las rutas en server.js"
```

---

## Task 7: Crear public/login.html

**Files:**
- Create: `public/login.html`

- [ ] **Step 1: Crear el archivo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Iniciar sesión — IT Support</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <style>
    body {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: var(--bg); font-family: 'Inter', sans-serif;
    }
    .login-card {
      background: var(--surface-2); border: 1px solid var(--border-2);
      border-radius: var(--radius-lg); padding: 40px 36px;
      width: 100%; max-width: 380px; box-shadow: var(--shadow-lg);
    }
    .login-brand {
      display: flex; align-items: center; gap: 12px; margin-bottom: 32px;
    }
    .login-brand-logo {
      width: 40px; height: 40px; background: var(--primary);
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .login-brand h1 { font-size: 18px; font-weight: 600; margin: 0; }
    .login-brand span { font-size: 12px; color: var(--text-3); }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block; font-size: 12px; font-weight: 500;
      color: var(--text-2); margin-bottom: 6px;
    }
    .input-wrap { position: relative; }
    .form-group input {
      width: 100%; padding: 10px 14px;
      background: var(--surface-3); border: 1px solid var(--border-2);
      border-radius: var(--radius-sm); color: var(--text); font-size: 14px;
      font-family: inherit; outline: none; transition: var(--transition);
      box-sizing: border-box;
    }
    .form-group input:focus { border-color: var(--border-focus); }
    .input-wrap input { padding-right: 42px; }
    .btn-eye {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: var(--text-3);
      padding: 4px; display: flex; align-items: center;
    }
    .btn-eye:hover { color: var(--text); }
    .btn-login {
      width: 100%; padding: 11px; background: var(--primary); color: #fff;
      border: none; border-radius: var(--radius-sm); font-size: 14px;
      font-weight: 500; cursor: pointer; transition: var(--transition);
      margin-top: 8px; font-family: inherit;
    }
    .btn-login:hover:not(:disabled) { background: var(--primary-dark); }
    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
    .login-error {
      margin-top: 12px; font-size: 13px; color: var(--danger);
      text-align: center; min-height: 20px;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-brand">
      <div class="login-brand-logo">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
             fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div>
        <h1>IT Support</h1>
        <span>Panel de Gestión</span>
      </div>
    </div>

    <form id="login-form">
      <div class="form-group">
        <label for="username">Usuario</label>
        <input type="text" id="username" autocomplete="username"
               placeholder="nombre de usuario" required>
      </div>
      <div class="form-group">
        <label for="password">Contraseña</label>
        <div class="input-wrap">
          <input type="password" id="password" autocomplete="current-password"
                 placeholder="••••••••" required>
          <button type="button" class="btn-eye" id="btn-eye" aria-label="Mostrar contraseña">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>
      <button type="submit" class="btn-login" id="btn-login">Ingresar</button>
      <div class="login-error" id="login-error"></div>
    </form>
  </div>

  <script type="module">
    // Redirigir si ya está autenticado
    try {
      const r = await fetch('/api/auth/me');
      if (r.ok) {
        const u = await r.json();
        window.location.href = u.role === 'farmacias' ? '/farmacias.html' : '/';
      }
    } catch {}

    const form     = document.getElementById('login-form');
    const errorEl  = document.getElementById('login-error');
    const btn      = document.getElementById('btn-login');
    const passInp  = document.getElementById('password');
    const btnEye   = document.getElementById('btn-eye');

    btnEye.addEventListener('click', () => {
      const show = passInp.type === 'password';
      passInp.type = show ? 'text' : 'password';
      btnEye.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Ingresando...';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('username').value.trim(),
            password: passInp.value,
          }),
        });
        const data = await res.json();
        if (!res.ok) { errorEl.textContent = data.error || 'Error al iniciar sesión.'; return; }
        window.location.href = data.role === 'farmacias' ? '/farmacias.html' : '/';
      } catch {
        errorEl.textContent = 'No se pudo conectar con el servidor.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verificar en el navegador**

Abrir `http://localhost:3000/login.html`. Debe mostrar el formulario de login con el tema oscuro. Intentar login con credenciales incorrectas — debe mostrar "Credenciales incorrectas." sin recargar página.

- [ ] **Step 3: Commit**

```bash
git add public/login.html
git commit -m "feat: login.html — página de autenticación standalone"
```

---

## Task 8: Crear public/js/auth.js

**Files:**
- Create: `public/js/auth.js`

- [ ] **Step 1: Crear el archivo**

```js
export async function initAuth({ requiredPermission } = {}) {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return null;
    }
    const user = await res.json();

    if (requiredPermission && !user.permissions.includes(requiredPermission)) {
      // Farmacias users que intentan entrar al panel IT → redirigir a farmacias
      window.location.href = user.role === 'farmacias' ? '/farmacias.html' : '/login.html';
      return null;
    }

    return user;
  } catch {
    window.location.href = '/login.html';
    return null;
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/auth.js
git commit -m "feat: auth.js — guard ESM initAuth y logout para frontend"
```

---

## Task 9: Crear public/js/usuarios.js

**Files:**
- Create: `public/js/usuarios.js`

- [ ] **Step 1: Crear el archivo**

```js
import { showToast } from './components.js';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function renderUsuarios(container) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <h2 style="font-size:20px;font-weight:600;margin:0;">Usuarios</h2>
      <button class="btn btn-primary" id="btn-new-user" style="display:flex;align-items:center;gap:6px;">
        <i data-lucide="user-plus" style="width:15px;height:15px;"></i> Nuevo usuario
      </button>
    </div>
    <div id="u-table-wrap"></div>

    <div class="panel-overlay" id="u-overlay"></div>
    <aside class="side-panel" id="u-panel">
      <div class="panel-title" id="u-panel-title">Nuevo usuario</div>

      <div class="form-group">
        <label>Nombre de usuario</label>
        <input type="text" id="u-username" class="form-input" placeholder="nombre.apellido"
          style="width:100%;padding:9px 12px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">
      </div>

      <div class="form-group">
        <label id="u-pass-label">Contraseña</label>
        <div style="position:relative;">
          <input type="password" id="u-password" placeholder="Mínimo 6 caracteres"
            style="width:100%;padding:9px 42px 9px 12px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;">
          <button type="button" id="u-btn-eye"
            style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-3);padding:4px;display:flex;align-items:center;">
            <i data-lucide="eye" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>Rol</label>
        <select id="u-role"
          style="width:100%;padding:9px 12px;background:var(--surface-3);border:1px solid var(--border-2);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none;"></select>
      </div>

      <div class="form-group" id="u-active-group" style="display:none;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="u-active">
          <span>Cuenta activa</span>
        </label>
      </div>

      <div class="panel-actions">
        <button class="btn-cancel" id="u-btn-cancel">Cancelar</button>
        <button class="btn-save"   id="u-btn-save">💾 Guardar</button>
      </div>
      <div class="save-status" id="u-save-status"></div>
    </aside>

    <div class="modal-overlay" id="u-modal">
      <div class="modal-box">
        <h3>¿Desactivar usuario?</h3>
        <p id="u-modal-msg" style="font-size:13px;color:var(--text-2);margin-bottom:20px;"></p>
        <div class="modal-actions">
          <button class="btn-cancel" id="u-modal-cancel">Cancelar</button>
          <button id="u-modal-confirm"
            style="background:var(--danger);color:#fff;border:none;border-radius:var(--radius-sm);padding:10px 20px;cursor:pointer;font-size:14px;">
            Desactivar
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  let roles = [];
  let editingId = null;
  let deleteId  = null;

  const overlay     = document.getElementById('u-overlay');
  const panel       = document.getElementById('u-panel');
  const panelTitle  = document.getElementById('u-panel-title');
  const passLabel   = document.getElementById('u-pass-label');
  const activeGroup = document.getElementById('u-active-group');
  const saveStatus  = document.getElementById('u-save-status');
  const roleSelect  = document.getElementById('u-role');

  async function loadData() {
    const wrap = document.getElementById('u-table-wrap');
    wrap.innerHTML = '<div class="loading-msg">Cargando usuarios...</div>';
    try {
      const [uRes, rRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles')]);
      const users = await uRes.json();
      roles = await rRes.json();

      roleSelect.innerHTML = roles.map(r =>
        `<option value="${r.id}">${esc(r.name)}${r.description ? ` — ${esc(r.description)}` : ''}</option>`
      ).join('');

      if (!users.length) {
        wrap.innerHTML = '<div class="loading-msg">No hay usuarios registrados.</div>';
        return;
      }

      wrap.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              ${['Usuario','Rol','Estado',''].map(h =>
                `<th style="text-align:left;padding:10px 12px;font-size:12px;color:var(--text-3);
                  border-bottom:1px solid var(--border);font-weight:500;">${h}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td style="padding:10px 12px;font-size:13px;font-weight:500;">${esc(u.username)}</td>
                <td style="padding:10px 12px;">
                  <span class="badge" style="background:${u.role_name==='it'?'var(--primary-light)':'var(--surface-3)'};color:${u.role_name==='it'?'var(--primary)':'var(--text-3)'};">
                    ${esc(u.role_name)}
                  </span>
                </td>
                <td style="padding:10px 12px;">
                  <span class="badge" style="background:${u.active?'rgba(34,197,94,.12)':'var(--surface-3)'};color:${u.active?'var(--success)':'var(--text-3)'};">
                    ${u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
                  <button class="btn-icon btn-edit" data-edit="${u.id}" title="Editar">
                    <i data-lucide="pencil" style="width:14px;height:14px;"></i>
                  </button>
                  ${u.active ? `
                  <button class="btn-icon btn-delete" data-del="${u.id}" title="Desactivar" style="margin-left:4px;">
                    <i data-lucide="user-x" style="width:14px;height:14px;"></i>
                  </button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      if (window.lucide) lucide.createIcons();

      wrap.querySelectorAll('[data-edit]').forEach(btn =>
        btn.addEventListener('click', () => openEdit(Number(btn.dataset.edit), users))
      );
      wrap.querySelectorAll('[data-del]').forEach(btn =>
        btn.addEventListener('click', () => openDelete(Number(btn.dataset.del), users))
      );
    } catch (err) {
      wrap.innerHTML = `<div class="loading-msg" style="color:var(--danger)">Error: ${esc(err.message)}</div>`;
    }
  }

  function openPanel() {
    overlay.classList.add('open');
    panel.classList.add('open');
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
  }

  function closePanel() {
    overlay.classList.remove('open');
    panel.classList.remove('open');
    editingId = null;
    document.getElementById('u-username').value = '';
    document.getElementById('u-password').value = '';
    document.getElementById('u-active').checked = true;
    activeGroup.style.display = 'none';
    passLabel.textContent = 'Contraseña';
  }

  function openEdit(id, users) {
    const u = users.find(x => x.id === id);
    if (!u) return;
    editingId = id;
    panelTitle.textContent = `Editar: ${u.username}`;
    document.getElementById('u-username').value = u.username;
    document.getElementById('u-username').disabled = true;
    document.getElementById('u-password').value = '';
    passLabel.textContent = 'Nueva contraseña (vacío = no cambiar)';
    roleSelect.value = u.role_id;
    document.getElementById('u-active').checked = !!u.active;
    activeGroup.style.display = 'block';
    openPanel();
  }

  function openDelete(id, users) {
    const u = users.find(x => x.id === id);
    if (!u) return;
    deleteId = id;
    document.getElementById('u-modal-msg').textContent =
      `"${u.username}" perderá acceso de inmediato y sus sesiones activas se cerrarán.`;
    document.getElementById('u-modal').classList.add('open');
  }

  // Botón nuevo usuario
  document.getElementById('btn-new-user').addEventListener('click', () => {
    editingId = null;
    panelTitle.textContent = 'Nuevo usuario';
    passLabel.textContent = 'Contraseña';
    document.getElementById('u-username').disabled = false;
    activeGroup.style.display = 'none';
    openPanel();
  });

  document.getElementById('u-btn-cancel').addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);

  // Toggle mostrar contraseña
  document.getElementById('u-btn-eye').addEventListener('click', () => {
    const inp = document.getElementById('u-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Guardar usuario
  document.getElementById('u-btn-save').addEventListener('click', async () => {
    const username = document.getElementById('u-username').value.trim();
    const password = document.getElementById('u-password').value;
    const role_id  = Number(roleSelect.value);
    const active   = document.getElementById('u-active').checked ? 1 : 0;

    saveStatus.className = 'save-status';
    saveStatus.textContent = 'Guardando...';

    try {
      let res;
      if (editingId) {
        const body = { role_id, active };
        if (password) body.password = password;
        res = await fetch(`/api/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        if (!username) { saveStatus.className = 'save-status err'; saveStatus.textContent = 'El nombre de usuario es requerido.'; return; }
        if (!password) { saveStatus.className = 'save-status err'; saveStatus.textContent = 'La contraseña es requerida.'; return; }
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role_id }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        saveStatus.className = 'save-status err';
        saveStatus.textContent = data.error;
        return;
      }
      saveStatus.className = 'save-status ok';
      saveStatus.textContent = '✓ Guardado';
      setTimeout(closePanel, 800);
      await loadData();
      showToast('Usuario guardado correctamente.', 'success');
    } catch {
      saveStatus.className = 'save-status err';
      saveStatus.textContent = 'Error de conexión.';
    }
  });

  // Modal desactivar
  document.getElementById('u-modal-cancel').addEventListener('click', () => {
    document.getElementById('u-modal').classList.remove('open');
    deleteId = null;
  });

  document.getElementById('u-modal-confirm').addEventListener('click', async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: 'DELETE' });
      document.getElementById('u-modal').classList.remove('open');
      const data = await res.json();
      if (!res.ok) { showToast(data.error, 'error'); return; }
      showToast('Usuario desactivado.', 'success');
      deleteId = null;
      await loadData();
    } catch {
      showToast('Error al desactivar usuario.', 'error');
    }
  });

  await loadData();
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/usuarios.js
git commit -m "feat: usuarios.js — panel CRUD de usuarios con panel lateral y modal"
```

---

## Task 10: Modificar index.html y app.js

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/app.js`

- [ ] **Step 1: Agregar entrada "Usuarios" en el sidebar de index.html**

En `public/index.html`, dentro del `<nav class="sidebar-menu">`, agregar **antes** del enlace a Configuración (`#settings`):

```html
      <a href="#usuarios" class="menu-item" id="nav-usuarios" style="display:none;">
        <span class="menu-icon"><i data-lucide="users" class="lucide"></i></span>
        <span class="menu-label">Usuarios</span>
      </a>
```

- [ ] **Step 2: Agregar botón logout y span de username en el header de index.html**

Localizar en `public/index.html`:
```html
      <div class="header-profile">
        <span class="agent-badge" id="header-connection-badge">Conectado</span>
        <div class="avatar" id="current-agent-avatar">A</div>
      </div>
```

Reemplazar por:
```html
      <div class="header-profile">
        <span class="agent-badge" id="header-connection-badge">Conectado</span>
        <span id="auth-username" style="font-size:13px;color:var(--text-2);margin-right:4px;"></span>
        <button id="btn-logout" title="Cerrar sesión"
          style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:4px 6px;display:flex;align-items:center;border-radius:var(--radius-sm);transition:var(--transition);"
          onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-3)'">
          <i data-lucide="log-out" style="width:16px;height:16px;"></i>
        </button>
        <div class="avatar" id="current-agent-avatar">A</div>
      </div>
```

- [ ] **Step 3: Agregar imports de auth y usuarios en app.js**

Al inicio de `public/js/app.js`, agregar en el bloque de imports existente:

```js
import { initAuth, logout } from './auth.js';
import { renderUsuarios }   from './usuarios.js';
```

- [ ] **Step 4: Agregar guard de auth al inicio de la función `init()` en app.js**

Localizar la función `async function init()`. Al **inicio** del cuerpo, antes de cualquier otra línea, agregar:

```js
  const user = await initAuth({ requiredPermission: 'full' });
  if (!user) return;

  // Mostrar nombre del usuario autenticado en el header
  const usernameEl = document.getElementById('auth-username');
  if (usernameEl) usernameEl.textContent = user.username;

  // Mostrar entrada Usuarios en sidebar (solo rol IT tiene permiso 'full')
  const navUsuarios = document.getElementById('nav-usuarios');
  if (navUsuarios) navUsuarios.style.display = '';

  // Botón logout
  document.getElementById('btn-logout')?.addEventListener('click', logout);
```

- [ ] **Step 5: Agregar ruta `#usuarios` al router switch en app.js**

En la función `router()`, dentro del `switch (hash)`, agregar **antes** del `default:`:

```js
      case '#usuarios':
        state.currentPage = 'usuarios';
        const navU = document.getElementById('nav-usuarios');
        if (navU) navU.classList.add('active');
        renderUsuarios(appContainer);
        break;
```

- [ ] **Step 6: Verificar en el navegador**

1. Abrir `http://localhost:3000/` — debe redirigir a `/login.html`
2. Hacer login con admin — debe llegar al panel IT con "Usuarios" en el sidebar
3. Navegar a `#usuarios` — debe mostrar la tabla con el usuario admin
4. Hacer clic en logout — debe redirigir a `/login.html`

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/js/app.js
git commit -m "feat: index.html y app.js — guard auth, entrada Usuarios, logout"
```

---

## Task 11: Modificar farmacias.html y farmacias.js

**Files:**
- Modify: `public/farmacias.html`
- Modify: `public/js/farmacias.js`

- [ ] **Step 1: Convertir el script a módulo y agregar botón logout en farmacias.html**

En `public/farmacias.html`, localizar:
```html
  <script src="js/farmacias.js"></script>
```

Reemplazar por:
```html
  <script type="module" src="js/farmacias.js"></script>
```

Agregar `id="it-panel-link"` al enlace de vuelta al panel, y agregar botón logout. Localizar:
```html
    <div class="page-header">
      <a href="/">← Panel IT</a>
      <h1 class="page-title">📍 Directorio Farmacias FOMAG</h1>
    </div>
```

Reemplazar por:
```html
    <div class="page-header">
      <a href="/" id="it-panel-link">← Panel IT</a>
      <h1 class="page-title">📍 Directorio Farmacias FOMAG</h1>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
        <span id="auth-username" style="font-size:13px;color:var(--text-3);"></span>
        <button id="btn-logout" title="Cerrar sesión"
          style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:4px;display:flex;align-items:center;">
          <i data-lucide="log-out" style="width:16px;height:16px;"></i>
        </button>
      </div>
    </div>
```

- [ ] **Step 2: Agregar import auth y llamada al guard al inicio de farmacias.js**

En `public/js/farmacias.js`, agregar **al inicio del archivo** (antes de las variables globales):

```js
import { initAuth, logout } from './auth.js';
```

Luego, dentro del callback de `document.addEventListener('DOMContentLoaded', async () => {`, agregar **al principio** (antes de `lucide.createIcons()`):

```js
  const user = await initAuth({ requiredPermission: 'farmacias' });
  if (!user) return;

  // Mostrar nombre de usuario
  const usernameEl = document.getElementById('auth-username');
  if (usernameEl) usernameEl.textContent = user.username;

  // Ocultar enlace al panel IT para usuarios que no son IT
  if (user.role !== 'it') {
    const itLink = document.getElementById('it-panel-link');
    if (itLink) itLink.style.display = 'none';
  }

  // Botón logout
  document.getElementById('btn-logout')?.addEventListener('click', logout);
```

- [ ] **Step 3: Verificar en el navegador**

1. Abrir `http://localhost:3000/farmacias.html` sin sesión — redirige a login.html
2. Login con admin → redirige a `/` (rol IT). Navegar manualmente a `/farmacias.html` — debe mostrar el directorio con "← Panel IT" visible
3. Crear un usuario con rol `farmacias`, hacer logout y login con ese usuario — debe llegar directamente a `farmacias.html` sin ver "← Panel IT"

- [ ] **Step 4: Commit**

```bash
git add public/farmacias.html public/js/farmacias.js
git commit -m "feat: farmacias.html/js — guard auth, mostrar usuario, logout"
```

---

## Task 12: Smoke test end-to-end

**Files:** ninguno — solo verificación

- [ ] **Step 1: Flujo IT completo**

```bash
# 1. Login como admin (usar la contraseña mostrada al arrancar el servidor)
curl -s -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"CONTRASEÑA\"}"
# Esperado: {"ok":true,"role":"it"}

# 2. Crear usuario farmacias
curl -s -b jar.txt -c jar.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"farmacia_test\",\"password\":\"test123\",\"role_id\":2}"
# Esperado: {"ok":true,"id":2}

# 3. Acceder a tickets (IT only) — debe funcionar
curl -s -b jar.txt http://localhost:3000/api/tickets | head -c 100
# Esperado: JSON con tickets (no 401/403)

# 4. Logout
curl -s -b jar.txt -c jar.txt -X POST http://localhost:3000/api/auth/logout
# Esperado: {"ok":true}

# 5. Acceder a tickets sin sesión — debe retornar 401
curl -s http://localhost:3000/api/tickets
# Esperado: {"error":"No autenticado."}
```

- [ ] **Step 2: Flujo usuario farmacias**

```bash
# Login como farmacia_test
curl -s -c jar2.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"farmacia_test\",\"password\":\"test123\"}"
# Esperado: {"ok":true,"role":"farmacias"}

# Acceder a farmacias — debe funcionar
curl -s -b jar2.txt http://localhost:3000/api/farmacias | head -c 50
# Esperado: JSON con datos (no 401/403)

# Intentar acceder a tickets — debe retornar 403
curl -s -b jar2.txt http://localhost:3000/api/tickets
# Esperado: {"error":"Acceso denegado."}

# Intentar crear usuario — debe retornar 403
curl -s -b jar2.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"x\",\"password\":\"x\",\"role_id\":1}"
# Esperado: {"error":"Acceso denegado."}
```

- [ ] **Step 3: Verificar protecciones de negocio**

```bash
# Login como admin
curl -s -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"CONTRASEÑA\"}"

# Intentar desactivar la propia cuenta (admin tiene id=1)
curl -s -b jar.txt -X DELETE http://localhost:3000/api/users/1
# Esperado: {"error":"No puedes desactivar tu propia cuenta."}

# Intentar desactivar al único IT activo via PUT
curl -s -b jar.txt -X PUT http://localhost:3000/api/users/2 \
  -H "Content-Type: application/json" \
  -d "{\"active\":0}"
# (esto sí debe funcionar porque el target es farmacia_test, no IT)
# Esperado: {"ok":true}
```

- [ ] **Step 4: Limpiar archivos temporales de curl**

```bash
del jar.txt jar2.txt 2>nul
```

- [ ] **Step 5: Commit final**

```bash
git add -A
git status
# Verificar que no haya archivos inesperados antes de commitear
git commit -m "feat: módulo de autenticación y roles completo — sesiones SQLite, RBAC, panel de usuarios"
```

---

## Resumen de rutas protegidas

| Endpoint | Protección |
|----------|-----------|
| `POST /api/auth/login` | Pública |
| `POST /api/auth/logout` | Pública |
| `GET /api/auth/me` | requireAuth |
| `GET /api/roles` | requireAuth |
| `GET /api/farmacias` | requireAuth + farmacias |
| `PUT /api/farmacias/punto` | requireAuth + farmacias |
| `POST /api/farmacias/punto` | requireAuth + farmacias |
| `DELETE /api/farmacias/punto` | requireAuth + farmacias |
| `/api/users/*` | requireAuth + full |
| `/api/tickets/*` | requireAuth + full |
| `/api/tech-requests/*` | requireAuth + full |
| Todos los demás `/api/*` | requireAuth + full |
| `/webhook` | Pública (WhatsApp Meta) |
| `/firmar/:token` | Pública |
