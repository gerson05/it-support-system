# Sistema de Requerimientos — Medivalle SF S.A.S
**Fecha:** 2026-06-19  
**Estado:** Aprobado para implementación

---

## 1. Visión general

Sistema de levantamiento y gestión de requerimientos internos para Medivalle SF S.A.S. Vive en el mismo servidor Express (`:3000`) pero con identidad visual completamente separada del panel IT Support. Accesible desde un portal compartido con MediCalc.

---

## 2. Arquitectura

### Zona "Herramientas Internas Medivalle"
- Portal de entrada: `/herramientas.html` — landing con tarjetas para cada herramienta
- `/requerimientos.html` — formulario + lista + panel admin
- `/medicalc.html` — ya existe, se actualiza topbar para coincidir

Todas las páginas comparten un **topbar Medivalle** (`#11273C` + logo azul `#05A0D8`) con navegación entre herramientas. No usan el sidebar del panel IT.

### Backend
Nuevo módulo `src/requerimientos/` con rutas propias registradas en `server.js`. Base de datos compartida (SQLite existente), tabla nueva `requerimientos`.

---

## 3. Modelo de datos

```sql
CREATE TABLE IF NOT EXISTS requerimientos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_num        TEXT UNIQUE NOT NULL,          -- REQ-YYYYMM-NNN
  area              TEXT NOT NULL,                 -- texto libre del solicitante
  nombre            TEXT NOT NULL,
  correo            TEXT DEFAULT '',
  punto             TEXT NOT NULL,                 -- nombre del punto/farmacia
  tipo              TEXT NOT NULL,                 -- Locativo|Sistemas|Bodega|Calidad|Mantenimiento|Otro
  descripcion       TEXT NOT NULL,
  fecha_requerida   TEXT DEFAULT '',               -- YYYY-MM-DD
  ticket_relacionado TEXT DEFAULT '',
  observaciones     TEXT DEFAULT '',
  prioridad         TEXT NOT NULL DEFAULT 'NORMAL',-- URGENTE|ALTA|NORMAL
  estado            TEXT NOT NULL DEFAULT 'Recibido',
  -- estados: Recibido|Asignado|En proceso|Pendiente info|Resuelto|Cancelado
  fotos             TEXT DEFAULT '[]',             -- JSON array de rutas relativas
  created_at        TEXT DEFAULT (datetime('now','localtime')),
  updated_at        TEXT DEFAULT (datetime('now','localtime'))
);
```

**Numeración de tickets:** `REQ-YYYYMM-NNN` donde NNN es secuencial global (no por mes). Generado en el backend al insertar.

---

## 4. API endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/req/puntos` | Ninguna | Lista plana de puntos desde farmacias (cache 10 min). Si `GOOGLE_SHEETS_CSV_URL` no está configurado devuelve `[]` — el campo punto queda como texto libre. |
| `POST` | `/api/req` | Ninguna | Crear requerimiento + enviar email |
| `GET` | `/api/req` | Ninguna | Listar con filtros: `?q=&tipo=&estado=&prioridad=&page=` |
| `GET` | `/api/req/:id` | Ninguna | Detalle de un requerimiento |
| `POST` | `/api/req/admin/login` | — | Valida `{usuario, password}` → devuelve token JWT simple |
| `PUT` | `/api/req/:id/estado` | Token admin | Cambiar estado `{estado}` |

**Auth admin:** Token HMAC-SHA256 generado con `crypto` (nativo Node, sin paquetes extra). Al hacer login exitoso el servidor devuelve `HMAC(usuario+timestamp, REQ_ADMIN_SECRET)` junto con el timestamp. El cliente envía `Authorization: Bearer <token>` en cada petición admin; el servidor re-verifica el HMAC. Expira en 8 horas (verificado por timestamp). Credenciales hardcodeadas: usuario `GESTION`, contraseña `GST123`. Token se guarda en `sessionStorage`.

---

## 5. Subida de fotos

- Endpoint de upload: `POST /api/req/upload-foto` (sin auth, antes de crear el requerimiento)
- Multer (ya instalado) guarda en `uploads/requerimientos/`
- Máx 5 archivos, 5 MB cada uno
- El frontend comprime con Canvas API antes de enviar (calidad 0.7, max 1200px)
- El POST final de creación recibe el array de rutas ya subidas

---

## 6. Email de notificación

**Proveedor:** nodemailer + Gmail SMTP  
**Variable de entorno:** `REQ_GMAIL_USER` y `REQ_GMAIL_APP_PASSWORD`  
**Destino fijo:** `gestion.medivallesf@gmail.com`

**Formato del email (texto plano + HTML):**

```
📋 Nuevo Requerimiento — MEDIVALLE SF SAS

Ticket     REQ-YYYYMM-NNN
Área       {area}
Solicitante {nombre} — {correo}
Tipo       {tipo_abrev}  (LOC|SIS|BOD|CAL|MAN|OTR)
Punto      {punto}
Prioridad  {emoji} {prioridad}
Fecha req. {fecha_requerida}

Descripción:
{descripcion}

Obs.: {observaciones}

─────────────────────────────
Sistema de Requerimientos MEDIVALLE SF SAS · {fecha_hora}
```

Si el envío falla, el requerimiento se crea igualmente (el error se loguea pero no bloquea la respuesta al usuario).

---

## 7. Frontend — `/requerimientos.html`

### Estructura de tabs
1. **Nueva Solicitud** — formulario público
2. **Ver Solicitudes** — lista pública con filtros (solo lectura)
3. **Gestión** — requiere login admin, muestra contador de pendientes

### Tab 1 — Formulario
- **Datos del solicitante:** área (texto libre), nombre, correo/extensión (opcional)
- **Punto afectado:** input con búsqueda en tiempo real sobre lista de farmacias + lista desplegable completa. Datos cargados desde `/api/req/puntos` al iniciar.
- **Tipo de requerimiento:** grid 3×2 con botones seleccionables (Locativo, Sistemas, Bodega, Calidad, Mantenimiento, Otro)
- **Detalle:** descripción (textarea requerida), fecha requerida (date opcional), ticket relacionado (texto opcional), observaciones (texto opcional)
- **Prioridad:** 3 botones (Urgente/Alta/Normal), Normal preseleccionado
- **Fotos:** zona drag-drop/tap, compresión Canvas antes de upload, preview de miniaturas, máx 5
- **Submit:** valida campos requeridos → sube fotos si hay → POST `/api/req` → muestra ticket generado en modal de éxito

### Tab 2 — Ver Solicitudes
- Barra de búsqueda (ticket, punto, descripción)
- Filtros: tipo, estado, prioridad
- Tabla/lista de cards con: ticket, fecha, solicitante, punto, tipo chip, prioridad badge, estado badge
- Paginación simple (20 por página)
- Solo lectura — sin acciones

### Tab 3 — Gestión (admin)
- Si no hay token en sessionStorage → muestra modal de login (usuario + contraseña)
- Si hay token válido → muestra panel completo:
  - Banner "GESTION — sesión activa" + botón cerrar sesión
  - Tarjetas de conteo por estado (6 estados)
  - Filtros: búsqueda, tipo, área, estado, prioridad
  - Tabla con columnas: Ticket, Solicitante/Desc, Tipo, Punto, Prioridad, Estado (select inline), Acciones
  - El select de estado cambia color automáticamente al estado seleccionado
  - Botón "Ver detalle" abre modal con todos los campos + fotos

---

## 8. Portal `/herramientas.html`

Landing page simple con branding Medivalle (topbar igual). Dos tarjetas:
- **Sistema de Requerimientos** — descripción breve + botón "Abrir"
- **MediCalc** — calculadora de dispensación + botón "Abrir"

---

## 9. Archivos a crear/modificar

### Nuevos
| Archivo | Descripción |
|---------|-------------|
| `src/requerimientos/req-routes.js` | Todos los endpoints API |
| `src/requerimientos/email-service.js` | Nodemailer + plantilla email |
| `public/requerimientos.html` | Página principal del sistema |
| `public/js/requerimientos.js` | Lógica frontend (form, lista, admin) |
| `public/herramientas.html` | Portal de entrada Medivalle |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `server.js` | Registrar `reqRouter` |
| `src/config/database.js` | Agregar migración tabla `requerimientos` |
| `public/medicalc.html` | Actualizar topbar para coincidir con portal Medivalle |
| `.env.example` | Agregar `REQ_GMAIL_USER`, `REQ_GMAIL_APP_PASSWORD`, `REQ_ADMIN_SECRET` |
| `package.json` | Instalar `nodemailer` |

---

## 10. Variables de entorno nuevas

```env
# Sistema de Requerimientos
REQ_GMAIL_USER=gestion.medivallesf@gmail.com
REQ_GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # App Password de Google
REQ_ADMIN_SECRET=cambiar_este_secreto_en_produccion
```

---

## 11. Decisiones descartadas

- **Google Forms:** descartado por falta de UI personalizada e integración
- **Hosting separado:** descartado por complejidad; mismo servidor es suficiente
- **RBAC existente para admin:** descartado porque el sistema de requerimientos es independiente del panel IT; credencial hardcodeada es suficiente para el caso de uso
- **Email obligatorio para crear:** el requerimiento se crea aunque el email falle
