# Spec: Calendario de Reuniones

**Fecha:** 2026-06-22
**Estado:** Aprobado

---

## Objetivo

Módulo para agendar reuniones internas y de sede con:
- Múltiples salas/recursos reservables
- Prevención de solapamiento (conflict check en servidor)
- Generación automática de link Google Meet vía Calendar API
- Acceso admin (sesión interna) y externo (formulario público con token)

---

## Arquitectura

**Source of truth:** SQLite local (same pattern as rest of app).
**Google Calendar API:** side-effect only — crea el evento para obtener Meet link. Si falla, la reunión se guarda igual con `meet_link = null`.

---

## Modelo de datos

### Tabla `salas`
```sql
CREATE TABLE salas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  activo      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

Ejemplos: "Sala física Cali", "Sala virtual", "Sala Bogotá".

### Tabla `reuniones`
```sql
CREATE TABLE reuniones (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  sala_id              INTEGER NOT NULL REFERENCES salas(id),
  titulo               TEXT NOT NULL,
  tipo                 TEXT NOT NULL CHECK(tipo IN ('interna','con_sede','con_proveedor','formacion')),
  fecha_inicio         TEXT NOT NULL,  -- ISO 8601: "2026-06-22T10:00:00"
  fecha_fin            TEXT NOT NULL,  -- ISO 8601: "2026-06-22T11:00:00"
  organizador_nombre   TEXT NOT NULL,
  organizador_correo   TEXT DEFAULT '',
  participantes        TEXT DEFAULT '[]',  -- JSON array de strings
  descripcion          TEXT DEFAULT '',
  sede_id              INTEGER REFERENCES sedes(id),  -- nullable
  meet_link            TEXT DEFAULT NULL,
  google_event_id      TEXT DEFAULT NULL,
  token_externo        TEXT UNIQUE,  -- UUID para acceso público
  estado               TEXT DEFAULT 'activa' CHECK(estado IN ('activa','cancelada')),
  created_at           TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_reuniones_sala_fechas ON reuniones(sala_id, fecha_inicio, fecha_fin);
CREATE INDEX idx_reuniones_token ON reuniones(token_externo);
```

### Conflict check
```sql
SELECT id FROM reuniones
WHERE sala_id = :sala_id
  AND estado  = 'activa'
  AND fecha_inicio < :nueva_fin
  AND fecha_fin    > :nueva_inicio
```
Retorna filas → 409 Conflict. El servidor siempre valida, nunca solo el cliente.

---

## API

### Rutas internas — `requireAuth`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/reuniones/salas` | Listar salas activas |
| POST | `/api/reuniones/salas` | Crear sala (admin) |
| PUT | `/api/reuniones/salas/:id` | Editar sala |
| DELETE | `/api/reuniones/salas/:id` | Desactivar sala (soft) |
| GET | `/api/reuniones` | Listar reuniones — filtros: `sala_id`, `fecha`, `tipo`, `estado` |
| POST | `/api/reuniones` | Crear reunión → conflict check → Calendar API → retorna reunión |
| PUT | `/api/reuniones/:id` | Editar reunión (re-valida conflicto si cambia hora/sala) |
| DELETE | `/api/reuniones/:id` | Cancelar reunión (estado='cancelada', cancela evento Google) |

### Rutas públicas — sin auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/reuniones/public/salas` | Salas activas (para formulario externo) |
| GET | `/api/reuniones/public/disponibilidad` | Slots ocupados por `sala_id` + `fecha` |
| POST | `/api/reuniones/public` | Crear reunión externa → conflict check → Meet link → retorna `token_externo` |
| GET | `/api/reuniones/public/:token` | Ver detalle de reunión (confirmación) |
| DELETE | `/api/reuniones/public/:token` | Cancelar reunión propia vía token |

---

## Google Calendar Service

**Archivo:** `src/reuniones/calendar-service.js`

```javascript
export async function crearEventoConMeet({ titulo, inicio, fin, participantes, descripcion })
// → { meetLink: string, eventId: string }

export async function cancelarEvento(eventId)
// → void
```

**Implementación:**
- Usa `googleapis` (ya instalado) con autenticación via Service Account
- Crea evento con `conferenceData.createRequest` → Google genera Meet link automático
- `calendarId` configurable via env var

**Variables de entorno nuevas:**
```
GOOGLE_CALENDAR_ID=xxx@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./config/service-account.json
# o inline:
GOOGLE_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...}
```

**Setup en Google Cloud (una vez):**
1. Crear proyecto → habilitar Google Calendar API
2. Crear Service Account → descargar JSON key
3. Crear Google Calendar → compartir con service account como editor
4. Copiar Calendar ID al `.env`

**Degradación elegante:** si `GOOGLE_CALENDAR_ID` no está configurado o la API falla, la reunión se crea con `meet_link = null`. Toast de advertencia al usuario, no error fatal.

---

## Frontend Admin

**Archivo:** `public/js/reuniones-admin.js`
**Ruta en sidebar:** "Calendario" (nueva entrada)

**Vista semana:**
- Grid: columnas = días (lun–dom), filas = horas (07:00–20:00)
- Sub-columnas por sala si hay múltiples
- Slots ocupados: tarjeta de color con título + hora
- Slots libres: área clicable → abre modal crear reunión con hora/sala pre-cargada
- Navegación: botones ← semana anterior / semana siguiente →

**Modal crear/editar reunión:**
- Campos: título, tipo, sala (select), fecha inicio, hora inicio, hora fin, organizador, participantes (textarea, uno por línea), descripción, sede relacionada (select opcional)
- Validación de horas (fin > inicio, mínimo 15 min)
- Muestra Meet link generado al guardar

**Vista detalle (clic en evento ocupado):**
- Info completa + Meet link como botón
- Botones: Editar / Cancelar

---

## Frontend Público

**Archivos:** `public/reuniones.html` + `public/js/reuniones-public.js`
**URL:** `/reuniones` (página standalone, sin auth, igual que `/rastrear`)

**Paso 1 — Elegir sala y horario:**
- Select de sala
- Date picker + selector de hora inicio/fin
- Al cambiar sala+fecha: fetch a `/api/reuniones/public/disponibilidad` → grises los slots ocupados

**Paso 2 — Datos del organizador:**
- Nombre, correo, tipo de reunión, participantes, descripción, sede relacionada (opcional)

**Paso 3 — Confirmación:**
- Resumen de la reunión
- Meet link como botón si fue generado
- Token de cancelación (guardar el link para cancelar después)
- Botón copiar link Meet al portapapeles

---

## Archivos nuevos

```
src/reuniones/reuniones-routes.js    — rutas internas + públicas
src/reuniones/calendar-service.js    — Google Calendar API
public/js/reuniones-admin.js         — vista admin (grid semana + modales)
public/js/reuniones-public.js        — formulario público multi-paso
public/reuniones.html                — página pública standalone
```

**Archivos modificados:**
```
src/config/database.js               — migración CREATE TABLE salas + reuniones
server.js                            — registrar reuniones-routes
public/js/app.js                     — agregar ruta 'reuniones' al router
client/src/components/Sidebar.jsx    — agregar entrada Calendario (si se usa React sidebar)
public/js/components.js              — agregar entrada Calendario al sidebar vanilla
.env.example                         — vars GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_*
```

---

## Restricciones

- Duración mínima de reunión: 15 minutos
- Duración máxima: 8 horas
- Rango de horas disponibles: 07:00–20:00
- No se pueden crear reuniones en el pasado (validación servidor)
- El token_externo nunca expira — el creador externo es responsable de guardarlo
- La cancelación por token solo cancela estado local + evento Google; no notifica participantes (fuera de scope)
