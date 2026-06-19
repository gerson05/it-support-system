# Spec: Crear Punto con Despacho + Checklist + Trazabilidad

**Fecha:** 2026-06-19  
**Módulo:** Red de Puntos (`sedes-admin.js`)  
**Estado:** Aprobado

---

## Problema

Al crear un nuevo punto de atención, el técnico IT debe enviar equipos y artículos a ese punto. Hoy, ese proceso es manual y desconectado: se crea el punto (2 campos), luego se genera un despacho por separado, y no hay forma de verificar que todo llegó.

## Solución

Expandir "Agregar nuevo punto" en un modal multi-paso que opcionalmente crea un despacho + tracking en una sola operación atómica. El checklist se genera automáticamente de los artículos del despacho. La recepción en destino se confirma por el link público de trazabilidad existente.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Despacho en creación de punto | Opcional | Algunos puntos ya existen sin envío pendiente |
| Quién marca enviado | IT admin desde sedes-admin | Es el que despacha |
| Quién marca recibido | Responsable en punto vía link público | Reutiliza `/rastrear?token=XXX` existente |
| Checklist items | Auto-generado de artículos del despacho | Solo artículos, no tareas |
| Almacenamiento checklist | No tabla nueva — usa `despachos.articulos` (JSON) + estado `tracking` | Mínima superficie de datos |

---

## Cambios en DB

```sql
ALTER TABLE sedes ADD COLUMN despacho_id    INTEGER REFERENCES despachos(id);
ALTER TABLE sedes ADD COLUMN tracking_token TEXT;
```

Ambas columnas nullable. Si el punto se crea sin artículos, quedan NULL.

---

## Backend — 3 endpoints nuevos en `src/sedes/sedes-routes.js`

### `POST /api/sedes/setup`

Operación atómica (transacción SQLite):

1. Valida `ciudad` y `nombre_punto` (obligatorios)
2. Valida `responsable` (opcional, se pasa al despacho como `destinatario`)
3. Si `articulos` presente y no vacío:
   - `INSERT INTO despachos` con `destinatario=responsable`, `sede=nombre_punto`, `articulos=JSON`
   - `createTracking({ despacho_id, numero, destinatario, sede, articulos })` → genera token
   - Guarda `despacho_id` y `tracking_token` en la sede
4. `INSERT INTO sedes (ciudad, nombre_punto, despacho_id, tracking_token)`

**Request:**
```json
{
  "ciudad": "CALI",
  "nombre_punto": "MI FARMACIA - CALI CENTRO",
  "responsable": "Juan Pérez",
  "articulos": [
    { "nombre": "Computador portátil", "cantidad": 2, "marca": "Dell", "modelo": "Latitude", "serial": "" },
    { "nombre": "Mouse inalámbrico", "cantidad": 2 }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "sede_id": 42,
  "despacho_id": 17,
  "tracking_token": "abc123",
  "tracking_url": "https://host/rastrear?token=abc123"
}
```

**Permisos:** `requireAuth` + `requirePermission('sedes:create')`

---

### `GET /api/sedes/:id/checklist`

Devuelve artículos del despacho vinculado + estado actual del tracking.

**Response:**
```json
{
  "sede_id": 42,
  "nombre_punto": "MI FARMACIA - CALI CENTRO",
  "despacho_id": 17,
  "tracking_token": "abc123",
  "tracking_url": "https://host/rastrear?token=abc123",
  "estado": "creado",
  "articulos": [
    { "nombre": "Computador portátil", "cantidad": 2, "marca": "Dell" },
    { "nombre": "Mouse inalámbrico", "cantidad": 2 }
  ]
}
```

Si `despacho_id` es NULL devuelve `{ "checklist": null }`.

**Permisos:** `requireAuth` + `requirePermission('sedes:read')`

---

### `POST /api/sedes/:id/marcar-enviado`

Registra evento `en_transito` en tracking para el despacho de este punto.

- Busca `tracking_id` via `SELECT id FROM paquete_tracking WHERE token = ?`
- Llama `addEvento(db, trackingId, { tipo: 'en_transito', entregado_por: agentName, observaciones: 'Enviado desde IT' })`
- Solo válido si `tracking.estado === 'creado'` (previene doble-click)

**Permisos:** `requireAuth` + `requirePermission('sedes:edit')`

---

## Frontend

### Nuevo archivo: `public/js/punto-setup-modal.js`

Exporta:

**`openPuntoSetupModal(onSuccess)`** — Modal 3 pasos:

- **Paso 1:** Ciudad + Nombre punto + Responsable (opcional)
- **Paso 2:** Lista de artículos con `buildArticuloRow` importado de `despacho-form.js`. Texto informativo: "Si agregas artículos se crea un despacho + trazabilidad automáticamente". Botón "Omitir" para saltar sin artículos.
- **Paso 3:** Resumen de lo que se creará. Checklist visual (solo lectura) de los artículos ingresados. Botón "Crear punto".
- Llama `POST /api/sedes/setup`
- En éxito: muestra toast con número de despacho + link de trazabilidad (copiable). Llama `onSuccess()`.

**`openChecklistModal(sede)`** — Modal de detalle del checklist:

- Muestra artículos del despacho como lista con íconos de estado
- Estado general (badge): Pendiente envío / En tránsito / Entregado
- Si `estado === 'creado'`: botón "✓ Marcar como enviado" → llama `POST /api/sedes/:id/marcar-enviado`
- Si `estado === 'en_transito'` o posterior: muestra link público copiable para el punto
- Si `estado === 'entregado'`: muestra fecha de entrega

---

### Modificado: `public/js/sedes-admin.js`

1. Importar `openPuntoSetupModal`, `openChecklistModal` de `./punto-setup-modal.js`
2. Reemplazar form inline "Agregar nuevo punto" por botón `btn-add-sede` que llama `openPuntoSetupModal(loadSedes)`
3. En el render de cada punto en la lista:
   - Añadir badge de estado del despacho (si `despacho_id` no null):
     - `creado` → `📦 Pendiente envío` (amarillo)
     - `en_transito` → `🚚 En tránsito` (índigo)
     - `en_sede` / `entregado` → `✅ Entregado` (verde)
   - Botón "Ver checklist" → `openChecklistModal(p)` (solo si `p.despacho_id`)
4. El endpoint `GET /api/sedes` debe actualizar su query de `SELECT id, ciudad, nombre_punto, activo, created_at` a incluir `despacho_id, tracking_token` para que los badges funcionen

---

## Flujo de estados (trazabilidad)

```
Punto creado con artículos
        ↓
   [creado] ← estado inicial del tracking
        ↓ IT presiona "Marcar enviado" en sedes-admin
  [en_transito]
        ↓ Responsable del punto confirma en /rastrear?token=XXX
   [entregado]
```

El tracking aparece automáticamente en el módulo de Trazabilidad (`trazabilidad.js`) — misma tabla, mismo API `/api/tracking`.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/config/database.js` | Migración: 2 columnas en `sedes` |
| `src/sedes/sedes-routes.js` | 3 endpoints nuevos |
| `public/js/punto-setup-modal.js` | Nuevo — modal setup + modal checklist |
| `public/js/sedes-admin.js` | Reemplaza form inline, añade badges y botones |

**No se crean tablas nuevas.** El checklist reutiliza `despachos.articulos` + `tracking.estado`.

---

## Fuera de alcance

- Checklist con ítems tipo tarea (solo artículos físicos)
- Confirmación de recepción por login del punto (solo link público)
- Edición de artículos post-creación del despacho
