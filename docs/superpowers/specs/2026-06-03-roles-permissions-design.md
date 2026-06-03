# Gestor de Roles y Permisos

**Fecha:** 2026-06-03
**Estado:** Aprobado

## Resumen

Añadir un panel de administración de roles y permisos al sistema IT Support. El administrador IT podrá ver todos los roles, editar sus permisos granulares con checkboxes, crear roles nuevos y eliminar roles sin usuarios activos. Todo desde una nueva pestaña dentro de la sección Usuarios.

---

## 1. Ubicación en la app

La sección `#users` pasa de página simple a página con dos pestañas:

- **Usuarios** — funcionalidad existente sin cambios
- **Roles y Permisos** — panel nuevo descrito en este spec

Solo el rol IT puede acceder a ambas pestañas (protegido con `requirePermission('full')`). El ítem de menú lateral `nav-users` no cambia.

---

## 2. UI — Tab "Roles y Permisos"

### 2.1 Lista de tarjetas

Cada rol del sistema se representa como una tarjeta colapsada que muestra:
- Nombre del rol (en mayúsculas)
- Descripción corta
- Cantidad de usuarios activos asignados a ese rol
- Indicador de estado: `▼` para expandir, `—` para bloqueados

**Rol IT:** aparece primero con un badge "🔒 bloqueado". No es expandible ni editable. Siempre tiene acceso completo por bypass (`full`).

**Solo una tarjeta expandida a la vez.** Al intentar expandir otra tarjeta mientras la actual tiene cambios sin guardar, se muestra un `confirm()` del navegador: *"¿Descartar cambios en [nombre rol] y abrir [otro rol]?"*. Si el usuario acepta, se descartan los cambios y se expande la nueva tarjeta. Si cancela, no ocurre nada.

### 2.2 Tarjeta expandida

Al hacer click en una tarjeta se carga `GET /api/roles/:id/permissions` y se muestra:

**Tabla de módulos × acciones:**

| Módulo | Leer | Crear | Editar | Eliminar |
|--------|:----:|:-----:|:------:|:--------:|
| Métricas | ✓ | — | — | — |
| Tickets | ✓ | ✓ | ✓ | ✓ |
| Requerimientos | ✓ | ✓ | ✓ | ✓ |
| Base de conocimiento | ✓ | ✓ | ✓ | ✓ |
| Red de Puntos | ✓ | ✓ | ✓ | ✓ |
| Despacho | ✓ | ✓ | ✓ | ✓ |
| Auditoría | ✓ | — | — | — |
| Farmacias FOMAG | ✓ | ✓ | ✓ | ✓ |

`✓` = checkbox activo. `—` = celda deshabilitada (ese permiso no existe para ese módulo).

Cada checkbox refleja si el permiso está asignado al rol. El usuario puede activar/desactivar libremente en memoria local.

**Pie de la tarjeta:**
- Izquierda: botón "Eliminar rol" (rojo, bloqueado si tiene usuarios activos)
- Derecha: botones "Descartar" y "Guardar cambios"

### 2.3 Crear nuevo rol

Botón `+ Nuevo rol` al final de la lista. Al pulsarlo aparece una nueva tarjeta en modo edición con:
- Campo de texto: nombre del rol (requerido, único)
- Campo de texto: descripción (opcional)
- Tabla de checkboxes en cero
- Botones: "Cancelar" y "Crear rol"

### 2.4 Estados y mensajes de error

| Situación | Comportamiento |
|-----------|---------------|
| Guardar sin cambios | Botón "Guardar" deshabilitado |
| Eliminar rol con usuarios activos | Toast de error: "Este rol tiene N usuarios activos. Reasígnalos antes de eliminar." |
| Nombre de rol duplicado al crear | Toast de error: "Ya existe un rol con ese nombre." |
| Error de red al guardar | Toast de error + checkboxes vuelven al estado anterior |
| Descartar con cambios pendientes | Restaura checkboxes al estado cargado, sin confirmación |

---

## 3. Backend

### 3.1 Endpoints nuevos

Todos requieren `requireAuth`. Los marcados con `full` además requieren `requirePermission('full')`.

#### `GET /api/permissions`
Devuelve todos los permisos del sistema agrupados por módulo. Solo `requireAuth`.

**Respuesta:**
```json
[
  {
    "module": "metrics",
    "label": "Métricas",
    "permissions": [
      { "id": 3, "name": "metrics:read", "action": "read" }
    ]
  },
  {
    "module": "tickets",
    "label": "Tickets",
    "permissions": [
      { "id": 4, "name": "tickets:read",   "action": "read"   },
      { "id": 5, "name": "tickets:create", "action": "create" },
      { "id": 6, "name": "tickets:edit",   "action": "edit"   },
      { "id": 7, "name": "tickets:delete", "action": "delete" }
    ]
  }
]
```

El orden y etiquetas de módulos se definen como array estático en el servidor (no en BD). La función cruza ese array contra los IDs reales de la tabla `permissions`.

#### `GET /api/roles` (modificado)
Ya existe. Se extiende para incluir `user_count` (usuarios activos por rol).

**Respuesta:**
```json
[
  { "id": 1, "name": "it", "description": "Equipo IT — acceso completo", "user_count": 2 },
  { "id": 3, "name": "supervisor", "description": "Gestión de tickets", "user_count": 3 }
]
```

#### `GET /api/roles/:id/permissions`
Devuelve los IDs de permisos asignados al rol. `requireAuth`.

**Respuesta:**
```json
{ "permission_ids": [3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 20] }
```

#### `PUT /api/roles/:id` — `full`
Actualiza nombre y/o descripción de un rol.

**Body:** `{ "name"?: string, "description"?: string }`

**Restricciones:**
- Rol IT (id=1): 403
- Nombre duplicado: 409

#### `PUT /api/roles/:id/permissions` — `full`
Reemplaza en batch todos los permisos del rol dentro de una transacción.

**Body:** `{ "permission_ids": [3, 4, 5, 6] }`

**Restricciones:**
- Rol IT (id=1): 403
- IDs inválidos: 400

**Transacción:**
```sql
DELETE FROM role_permissions WHERE role_id = ?;
INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)...;
```

#### `POST /api/roles` — `full`
Crea un rol nuevo con permisos iniciales opcionales.

**Body:** `{ "name": string, "description"?: string, "permission_ids"?: number[] }`

**Respuesta:** `{ "ok": true, "id": 7 }`

**Restricciones:**
- Nombre vacío: 400
- Nombre duplicado: 409

#### `DELETE /api/roles/:id` — `full`
Elimina un rol.

**Restricciones:**
- Rol IT (id=1): 400
- Rol con usuarios activos: 400 con mensaje "Este rol tiene N usuarios activos."

---

## 4. Frontend — archivos

### 4.1 `src/auth/user-routes.js` (modificado)
Se añaden los 6 endpoints nuevos. Se modifica el `GET /api/roles` existente para incluir `user_count`.

### 4.2 `public/js/users.js` (modificado)
- Se añade sistema de tabs (Usuarios | Roles y Permisos) al HTML del `renderUsers`
- Al cambiar de tab se llama `renderRolesTab(container)` importado de `roles.js`
- La lógica existente de usuarios no cambia

### 4.3 `public/js/roles.js` (nuevo)
Contiene toda la lógica del tab de roles:

| Función | Responsabilidad |
|---------|----------------|
| `renderRolesTab(container)` | Entry point — carga datos y renderiza lista |
| `loadRolesData()` | `GET /api/roles` + `GET /api/permissions` en paralelo |
| `renderRoleCard(role, modules)` | HTML de una tarjeta colapsada |
| `expandCard(roleId)` | Carga permisos del rol y renderiza tabla inline |
| `savePermissions(roleId, ids)` | `PUT /api/roles/:id/permissions` |
| `createRole(name, desc, ids)` | `POST /api/roles` |
| `deleteRole(roleId)` | `DELETE /api/roles/:id` con confirmación |

---

## 5. Protecciones y restricciones

| Regla | Dónde se aplica |
|-------|----------------|
| Solo IT puede gestionar roles | `requirePermission('full')` en todos los endpoints de escritura |
| Rol IT no editable | Check `if (id === 1)` en PUT y DELETE del servidor + tarjeta no expandible en el cliente |
| No eliminar roles con usuarios activos | Verificación en `DELETE /api/roles/:id` en servidor + botón deshabilitado en cliente si `user_count > 0` |
| Permisos legacy (`full`, `farmacias` id=1,2) | No se muestran en la tabla de módulos — son internos del sistema |
| `settings:read`, `settings:edit` (id=29,30) | No se muestran — reservados, el rol IT los accede por bypass |

---

## 6. Flujo de datos completo (cliente)

```
Montar tab
  → GET /api/roles + GET /api/permissions  (paralelo, una vez)
  → Renderizar tarjetas colapsadas

Click en tarjeta
  → GET /api/roles/:id/permissions
  → Guardar estado original en memoria
  → Renderizar tabla con checkboxes

Usuario edita checkboxes
  → Actualizar estado local (sin petición)
  → Habilitar botón "Guardar" si hay cambios vs. original

"Guardar"
  → PUT /api/roles/:id/permissions { permission_ids: [...] }
  → OK: toast éxito + colapsar tarjeta + refrescar lista
  → Error: toast error + restaurar estado original

"Descartar"
  → Restaurar checkboxes desde estado original guardado
  → Sin petición al servidor
```
