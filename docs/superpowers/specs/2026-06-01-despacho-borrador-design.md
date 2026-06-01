# Borrador de Despacho — Design Spec

**Fecha:** 2026-06-01
**Estado:** Aprobado por usuario

---

## Problema

Al crear un despacho, si el agente comete un error debe recrear todo el formulario desde cero. Se necesita una función de borrador que guarde el progreso en la base de datos, persistente entre sesiones, con restauración al volver a abrir el modal.

---

## Alcance

Solo cubre el **formulario de creación de despachos** (`openCreateModal` en `public/js/despacho.js`). No afecta edición de despachos existentes.

---

## Base de datos

Nueva tabla `despacho_borradores`:

```sql
CREATE TABLE IF NOT EXISTS despacho_borradores (
  id            INTEGER PRIMARY KEY,
  agente        TEXT NOT NULL UNIQUE,
  destinatario  TEXT,
  sede          TEXT,
  area          TEXT,
  articulos     TEXT DEFAULT '[]',
  observaciones TEXT,
  requiere_acta INTEGER DEFAULT 0,
  ticket_id     INTEGER,
  updated_at    TEXT DEFAULT (datetime('now','localtime'))
);
```

**Reglas:**
- Un borrador por agente (`UNIQUE` en `agente`).
- Guardar usa `INSERT OR REPLACE` (UPSERT) — sobreescribe el borrador anterior.
- No hay expiración automática en BD. La UI muestra advertencia si `updated_at` tiene más de 8 horas.
- El borrador se elimina automáticamente cuando el despacho se crea exitosamente.

---

## API

Tres endpoints nuevos en `src/despacho/despacho-routes.js`:

### GET /api/despachos/borrador
Query param: `agente` (string, requerido)

**Respuesta exitosa:**
```json
{ "borrador": { "agente": "Juan IT", "destinatario": "...", "articulos": [...], "updated_at": "2026-06-01 14:32:00", ... } }
```
Si no existe: `{ "borrador": null }`

### PUT /api/despachos/borrador
Body JSON:
```json
{
  "agente": "Juan IT",
  "destinatario": "Carlos Pérez",
  "sede": "Sede Norte",
  "area": "farmacia",
  "articulos": [{ "nombre": "Mouse", "cantidad": 2, "descripcion": "" }],
  "observaciones": "Urgente",
  "requiere_acta": 0,
  "ticket_id": null
}
```
Validación: `agente` es obligatorio. Devuelve `{ "ok": true }`.

### DELETE /api/despachos/borrador
Query param: `agente` (string, requerido)

Devuelve `{ "ok": true }`. Si no existe borrador, igual devuelve `{ "ok": true }` (idempotente).

---

## Frontend

### Cambios en `public/js/despacho.js` — `openCreateModal`

**Al abrir el modal:**
1. Llama `GET /api/despachos/borrador?agente={state.currentAgent.name}`
2. Si `borrador !== null` → inyecta banner de restauración en la parte superior del formulario (antes del primer campo)
3. Si `borrador === null` → el formulario abre vacío normalmente

**Banner de restauración:**
```
┌─────────────────────────────────────────────────────────┐
│ 📝 Tienes un borrador guardado (hace 2h 15m)            │
│                        [Restaurar]  [Descartar]         │
└─────────────────────────────────────────────────────────┘
```
- Fondo: `var(--surface-2)`, borde `var(--border)`, border-radius `8px`
- Si `updated_at` tiene más de 8 horas: fondo `rgba(245,158,11,0.1)`, borde `#f59e0b`, texto de aviso naranja
- **Restaurar:** rellena todos los campos del formulario con los datos del borrador (incluyendo filas de artículos) y oculta el banner
- **Descartar:** llama `DELETE /api/despachos/borrador`, oculta el banner, el formulario queda limpio

**Footer del formulario** — tres botones:
```
[Cancelar]   [💾 Guardar borrador]   [Crear Despacho →]
```

**Al hacer clic en "Guardar borrador":**
1. Lee todos los campos actuales del formulario
2. Llama `PUT /api/despachos/borrador` con los datos serializados
3. Muestra toast: *"Borrador guardado ✓"* (tipo `success`)
4. El modal permanece abierto

**Al crear el despacho exitosamente** (dentro del handler `form submit`):
1. Crea el despacho normalmente (`POST /api/despachos`)
2. Si exitoso: llama `DELETE /api/despachos/borrador?agente=X` en background (sin bloquear)
3. Cierra el modal y refresca la lista

---

## Archivos que se crean o modifican

| Archivo | Acción |
|---------|--------|
| `src/config/database.js` | Modificar — agregar `CREATE TABLE IF NOT EXISTS despacho_borradores` |
| `src/despacho/despacho-routes.js` | Modificar — agregar GET, PUT, DELETE `/api/despachos/borrador` |
| `public/js/despacho.js` | Modificar — `openCreateModal`: banner, botón guardar borrador, restauración, limpieza al submit |

---

## Lo que NO cambia

- Tabla `despachos` — sin modificaciones
- Flujo de creación de despacho — idéntico, solo se agrega la limpieza del borrador al final
- Resto del panel (tickets, FAQs, sedes) — sin cambios
