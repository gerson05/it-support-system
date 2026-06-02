# Spec: Módulo de Autenticación y Roles

**Fecha:** 2026-06-02
**Estado:** Aprobado — listo para implementación

---

## Contexto

El sistema IT Support Panel no tiene autenticación. Se necesita controlar el acceso para que personas externas al equipo IT puedan usar únicamente el módulo de Farmacias FOMAG, mientras el equipo IT mantiene acceso completo. El sistema debe ser extensible para agregar más roles y permisos en el futuro sin cambios de código.

---

## Modelo de datos

Cuatro tablas nuevas añadidas como migraciones incrementales en `src/config/database.js`.

```sql
-- Roles disponibles en el sistema
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Permisos atómicos (módulos o acciones)
CREATE TABLE IF NOT EXISTS permissions (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Relación N:M entre roles y permisos
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

-- Usuarios del sistema (equipo IT + externos)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id       INTEGER NOT NULL,
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now','localtime')),
  updated_at    TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Sesiones activas (cookie httpOnly referencia este token)
CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Datos iniciales (seed)

```sql
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  (1, 'it',        'Equipo IT — acceso completo'),
  (2, 'farmacias', 'Acceso solo al directorio de farmacias');

INSERT OR IGNORE INTO permissions (id, name) VALUES
  (1, 'full'),
  (2, 'farmacias');

-- IT tiene ambos permisos; farmacias solo el suyo
INSERT OR IGNORE INTO role_permissions VALUES (1, 1), (1, 2), (2, 2);
```

**Usuario admin inicial:** al arrancar con la tabla `users` vacía el servidor genera un usuario `admin` con contraseña aleatoria de 12 caracteres y la imprime en consola una sola vez. El equipo IT debe cambiarla desde el panel en el primer acceso.

### Extensibilidad

Para crear un nuevo rol en el futuro (ej. `despacho`, `solo_lectura`) basta con:
1. Insertar fila en `roles`
2. Insertar filas en `role_permissions` con los permisos que corresponda
3. Crear el usuario desde el panel

No requiere cambios de código.

---

## Backend

### Archivos nuevos

```
src/auth/
  auth-service.js      — lógica de negocio (hash, sesiones, permisos)
  auth-middleware.js   — middlewares Express (requireAuth, requirePermission)
  auth-routes.js       — endpoints de sesión
  user-routes.js       — CRUD de usuarios y roles
```

### Endpoints de autenticación (`auth-routes.js`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Recibe `{username, password}`, valida, crea sesión, set-cookie |
| POST | `/api/auth/logout` | Invalida sesión en DB, borra cookie |
| GET  | `/api/auth/me` | Devuelve `{id, username, role, permissions}` o 401 |

### Endpoints de gestión de usuarios (`user-routes.js`, solo rol IT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/api/users`      | Listar usuarios (sin password_hash) |
| POST   | `/api/users`      | Crear usuario `{username, password, role_id}` |
| PUT    | `/api/users/:id`  | Editar (password opcional, role_id, active) |
| DELETE | `/api/users/:id`  | Desactivar (active=0, invalida sus sesiones) |
| GET    | `/api/roles`      | Listar roles disponibles |

**Restricciones de negocio:**
- Un usuario no puede desactivarse ni cambiar su propio rol
- El último usuario con rol `it` no puede ser desactivado
- Contraseña mínimo 6 caracteres
- Al desactivar un usuario se invalidan todas sus sesiones activas

### Cookie de sesión

```
Name:     it_session
HttpOnly: true
SameSite: Lax
Path:     /
MaxAge:   8 horas (28800 segundos)
```

El token es `crypto.randomBytes(32).toString('hex')`. La sesión se extiende automáticamente en cada request válido (sliding window de 8h).

### Protección de rutas existentes

El middleware se aplica en `server.js` antes de registrar los routers:

```
Rutas públicas (sin auth):
  /api/auth/*
  /api/whatsapp/webhook   (webhook externo de Meta)
  /firmar/:token          (página de firma pública)

Rutas semipúblicas (auth + permiso 'farmacias'):
  /api/farmacias/*

Rutas completas (auth + permiso 'full'):
  Todo lo demás en /api/*
```

### `auth-service.js`

Expone funciones puras sin estado:

```
hashPassword(plain)           → hash bcrypt (cost 10)
verifyPassword(plain, hash)   → boolean
createSession(userId)         → { token, expiresAt }
getSession(token)             → { user, permissions } | null
deleteSession(token)
deleteUserSessions(userId)
getUserWithPermissions(userId)
```

### `auth-middleware.js`

```
requireAuth              — extrae cookie, valida sesión, adjunta req.user y req.permissions
requirePermission(name)  — verifica que req.permissions incluya el permiso dado
```

---

## Frontend

### Archivos nuevos / modificados

```
public/login.html        — página de login (nueva)
public/js/auth.js        — guard de autenticación (nuevo)
public/js/usuarios.js    — render del panel de usuarios (nuevo)
public/index.html        — agregar entrada "Usuarios" en sidebar + botón logout
public/js/app.js         — integrar guard auth + ruta #usuarios
public/farmacias.html    — agregar guard auth + botón logout
```

### Flujo de autenticación en el navegador

1. Usuario entra a `index.html` o `farmacias.html`
2. `auth.js` llama `GET /api/auth/me`
3. Si 401 → redirige a `login.html`
4. Si autenticado con rol `farmacias` y está en `index.html` → redirige a `farmacias.html`
5. Si autenticado con rol `it` y está en `farmacias.html` → permite continuar (IT también puede usar farmacias)

### `login.html`

- Página standalone, misma estética del panel (dark mode, Inter, CSS variables existentes)
- Logo + título "IT Support"
- Formulario: campo usuario, campo contraseña (con toggle mostrar/ocultar), botón "Ingresar"
- Mensaje de error inline (credenciales incorrectas, usuario inactivo)
- Sin link de "olvidé mi contraseña" (el equipo IT resetea desde el panel)
- Al login exitoso redirige según rol: `it` → `index.html`, `farmacias` → `farmacias.html`

### Panel de usuarios en `index.html`

Nueva entrada en el sidebar (visible solo para rol `it`):
```html
<a href="#usuarios" id="nav-usuarios">
  <i data-lucide="users"></i> Usuarios
</a>
```

Vista `#usuarios` renderizada por `usuarios.js`:
- **Tabla:** columnas Username, Rol (badge), Estado (activo/inactivo), Acciones (editar, desactivar)
- **Botón "Nuevo usuario"** — abre panel lateral deslizante (mismo patrón que farmacias.html)
- **Panel lateral:** campos Username, Contraseña (+ ojo toggle), Rol (select con opciones de `/api/roles`), toggle Activo
  - Al editar: contraseña vacía = no se modifica
- **Modal de confirmación** antes de desactivar una cuenta
- Badge de estado: verde `Activo` / gris `Inactivo`

### Botón de cerrar sesión

En el header de `index.html` y `farmacias.html`, junto al avatar:
- Ícono `log-out` de Lucide
- Llama `POST /api/auth/logout` y redirige a `login.html`
- El nombre del usuario autenticado reemplaza "Agente de Turno" como identificador principal

---

## Seguridad

- Contraseñas hasheadas con bcrypt (cost 10) — nunca se almacenan ni transmiten en claro
- Tokens de sesión generados con `crypto.randomBytes` (criptográficamente seguros)
- Cookie `httpOnly` — inaccesible desde JavaScript del navegador
- `SameSite=Lax` — protección básica contra CSRF para esta app interna
- Sesiones expiradas se limpian en cada startup del servidor (tarea de mantenimiento en `database.js`)
- Intentos de login fallidos: no se diferencia "usuario no existe" de "contraseña incorrecta" en el mensaje al cliente (evita enumeración de usuarios)

---

## Archivos que se modifican

| Archivo | Cambio |
|---------|--------|
| `src/config/database.js` | Agregar migraciones de las 5 tablas nuevas + seed de roles/permisos/admin |
| `server.js` | Registrar `auth-routes`, `user-routes`; aplicar middlewares de auth antes de los routers existentes |
| `public/index.html` | Entrada sidebar Usuarios + botón logout en header |
| `public/js/app.js` | Guard de auth al init + ruta `#usuarios` en el router |
| `public/farmacias.html` | Guard de auth + botón logout |
| `public/js/farmacias.js` | Mostrar nombre de usuario autenticado |

---

## Fuera de alcance (esta iteración)

- Recuperación de contraseña por correo
- 2FA
- Registro de intentos de login fallidos (rate limiting)
- Permisos granulares por acción (solo por módulo por ahora)
- Panel de administración de roles (solo de usuarios)
