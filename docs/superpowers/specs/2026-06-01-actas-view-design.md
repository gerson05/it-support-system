# Vista de Actas Firmadas en Audit — Design Spec

**Date:** 2026-06-01  
**Feature:** Tabla de todas las actas (subidas y pendientes) dentro del módulo de Auditoría  
**Scope:** Backend endpoint + UI pestaña en audit.js

---

## Objetivo

Agregar una pestaña "Actas" al módulo de Auditoría que muestre todas las entradas de `acta_uploads` — tanto las ya recibidas como las pendientes — con filtros por texto, tipo y estado, y descarga directa desde la tabla.

---

## Arquitectura

### Archivos modificados

| Archivo | Acción |
|---------|--------|
| `src/audit/audit-routes.js` | Agregar `GET /api/audit/actas` |
| `public/js/audit.js` | Agregar tabs + tabla Actas |

### Archivos sin cambios

- `src/config/database.js` — no requiere migración
- `src/actas/actas-routes.js` — descarga sigue en `/api/actas/download/:token`

---

## Backend — GET /api/audit/actas

**Ruta:** `GET /api/audit/actas`

**Query params:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `q` | string | Busca en `entity_ref`, `filename`, `persona` (destinatario o requester_name) |
| `type` | string | `despacho` \| `tech_request` \| vacío (todos) |
| `status` | string | `uploaded` \| `pending` \| vacío (todos) |
| `limit` | int | Máx filas, default 50 |
| `offset` | int | Paginación, default 0 |

**SQL:**

```sql
SELECT
  a.id,
  a.token,
  a.entity_type,
  a.entity_ref,
  a.filename,
  a.uploaded_at,
  a.created_at,
  CASE
    WHEN a.entity_type = 'despacho'      THEN d.destinatario
    WHEN a.entity_type = 'tech_request'  THEN tr.requester_name
  END AS persona,
  CASE
    WHEN a.entity_type = 'despacho'      THEN d.agente
    WHEN a.entity_type = 'tech_request'  THEN tr.agent_name
  END AS agente
FROM acta_uploads a
LEFT JOIN despachos d
  ON a.entity_type = 'despacho' AND a.entity_id = d.id
LEFT JOIN tech_requests tr
  ON a.entity_type = 'tech_request' AND a.entity_id = tr.id
WHERE <filtros dinámicos>
ORDER BY a.created_at DESC
LIMIT ? OFFSET ?
```

**Filtros dinámicos:**
- `type` → `AND a.entity_type = ?`
- `status=uploaded` → `AND a.uploaded_at IS NOT NULL`
- `status=pending` → `AND a.uploaded_at IS NULL`
- `q` → `AND (a.entity_ref LIKE ? OR a.filename LIKE ? OR persona LIKE ?)` — usando subquery o CASE inline

**Respuesta:**

```json
{
  "actas": [
    {
      "id": 1,
      "token": "uuid",
      "entity_type": "despacho",
      "entity_ref": "DES-20260601-001",
      "filename": "acta_firmada.pdf",
      "uploaded_at": "2026-06-01 15:14:07",
      "created_at": "2026-06-01 15:13:00",
      "persona": "Carlos Prueba",
      "agente": "Gerson IT"
    }
  ],
  "total": 1
}
```

---

## Frontend — audit.js

### Tabs

Reemplazar el header actual por dos pestañas:

```
[ Actividad ]  [ Actas ]
```

- Estilo idéntico al de ticket-list (border-bottom activo en `var(--primary)`)
- Tab activo por defecto: **Actividad** (sin cambio de comportamiento actual)
- Al cambiar de tab se renderiza el contenido correspondiente sin recargar la página

### Tabla Actas

**Filtros (fila superior):**

- Input texto: placeholder "Buscar por documento, persona o archivo…"
- Select Tipo: Todos los tipos / Despacho / Requerimiento
- Select Estado: Todos / Recibidas / Pendientes
- Botón "Actualizar"
- Debounce 350ms en el input

**Columnas:**

| Columna | Fuente | Notas |
|---------|--------|-------|
| Fecha | `uploaded_at` o `created_at` | Si uploaded: fecha subida. Si pending: fecha creación del token |
| Documento | `entity_ref` | Monospace, color primary |
| Tipo | `entity_type` | Badge "Despacho" / "Requerimiento" |
| Persona | `persona` | Destinatario o solicitante |
| Agente | `agente` | Quien generó el link |
| Estado | `uploaded_at` | Badge verde "Recibida ✓" / amarillo "Pendiente" |
| Archivo | `filename` | Nombre del archivo o "—" |
| Acción | `token` | Botón "↓ Descargar" → `/api/actas/download/:token`, solo si uploaded |

**Estados vacíos:**
- Sin actas: "No hay actas registradas" con ícono 📋
- Sin resultados de filtro: "Sin resultados para los filtros aplicados"

---

## Spec Self-Review

- ✅ Sin TBDs ni secciones incompletas
- ✅ El SQL usa LEFT JOIN — si un despacho fue borrado, la fila de acta aún aparece con `persona = NULL`
- ✅ El filtro `q` sobre `persona` requiere CASE inline en WHERE o CTE — se resuelve en implementación con subquery
- ✅ La descarga usa el endpoint existente `/api/actas/download/:token` sin cambios
- ✅ Scope acotado: 2 archivos, 0 migraciones
