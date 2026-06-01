# Subida de Acta Firmada — Design Spec

**Fecha:** 2026-06-01
**Estado:** Aprobado por usuario

---

## Problema

Después de generar un acta de entrega, el receptor la firma físicamente y actualmente debe subirla vía Google Forms para que IT pueda acceder al archivo firmado. Se necesita un mecanismo propio: un link/QR único por documento que el receptor usa para subir el archivo directamente al sistema, y visualización del acta firmada desde el panel.

---

## Alcance

Aplica a **ambos** módulos:
- **tech-requests** — actas de entrega de equipos (requerimientos, genera `.docx`)
- **despachos** — despachos que requieren acta (`requiere_acta = 1`)

---

## Archivos nuevos y modificados

| Archivo | Acción |
|---------|--------|
| `src/config/database.js` | Modificar — agregar migración `acta_uploads` |
| `src/actas/actas-routes.js` | Crear — API de tokens, upload, download, QR, status |
| `server.js` | Modificar — montar `/api/actas` y servir `/firmar/*` |
| `public/firmar.html` | Crear — página pública sin login para el receptor |
| `public/js/firmar.js` | Crear — lógica de la página de subida |
| `public/js/despacho.js` | Modificar — sección de acta firmada en modal de detalle |
| `uploads/actas-firmadas/` | Crear — directorio para archivos subidos |

Los módulos de tech-requests también necesitan integración en su UI (panel), pero dado que ese JS vive en `public/js/app.js` o similar, se evalúa al momento de implementar.

---

## Base de datos

Nueva tabla `acta_uploads` (migración en `database.js`):

```sql
CREATE TABLE IF NOT EXISTS acta_uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('tech_request','despacho')),
  entity_id   INTEGER NOT NULL,
  entity_ref  TEXT NOT NULL,
  filename    TEXT,
  filepath    TEXT,
  uploaded_at TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

**Reglas:**
- `token` — UUID v4 generado en Node.js con `crypto.randomUUID()`
- `entity_ref` — número legible del documento (ej: `REQ-2026-001`, `DES-20260601-001`)
- `filename` / `filepath` / `uploaded_at` — `NULL` hasta que el receptor suba el archivo
- Un documento puede tener solo un token activo. Si IT genera otro token para el mismo documento, se sobreescribe el anterior (`INSERT OR REPLACE` por `entity_type + entity_id`)
- Índice único compuesto en `(entity_type, entity_id)` para facilitar el upsert

---

## API Endpoints

Todos bajo `/api/actas`, montados en `server.js`.

### POST /api/actas/token
**Protegido** (solo acceso desde el panel IT — mismo servidor).

Body:
```json
{ "entity_type": "tech_request", "entity_id": 5, "entity_ref": "REQ-2026-001" }
```

Comportamiento: upsert — si ya existe un token para ese documento, lo actualiza (nuevo UUID, borra el archivo previo si existía).

Respuesta:
```json
{ "token": "uuid-v4", "url": "http://HOST/firmar/TOKEN" }
```

El `HOST` se detecta desde `req.headers.host` para funcionar tanto en local como en producción.

---

### GET /api/actas/status/:token
**Público** — usado por `firmar.html` al cargar.

Respuesta (token válido, sin archivo):
```json
{
  "valid": true,
  "uploaded": false,
  "entity_ref": "REQ-2026-001",
  "entity_type": "tech_request"
}
```

Respuesta (token válido, archivo subido):
```json
{ "valid": true, "uploaded": true, "uploaded_at": "2026-06-01 14:32:00" }
```

Respuesta (token inválido):
```json
{ "valid": false }
```

---

### POST /api/actas/upload/:token
**Público** — usado por `firmar.html`.

- `multipart/form-data` con campo `acta` (el archivo)
- Validaciones:
  - Token debe existir y `uploaded_at` debe ser `NULL` (no permite re-subida)
  - Extensión: solo `.pdf` o `.docx`
  - MIME type: `application/pdf` o `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - Tamaño máximo: 10 MB
- El archivo se guarda en `uploads/actas-firmadas/{token}.{ext}`
- Se actualiza `filename`, `filepath`, `uploaded_at` en la tabla

Respuesta exitosa: `{ "ok": true }`

Errores:
- `400` — archivo ya subido, tipo no permitido, tamaño excedido
- `404` — token no encontrado

---

### GET /api/actas/download/:token
**Protegido** (solo panel IT).

- Si `filepath` existe → sirve el archivo con `Content-Disposition: attachment`
- Si no existe → `404`

---

### GET /api/actas/qr/:token
**Protegido** (solo panel IT).

- Genera imagen PNG del QR apuntando a `http://HOST/firmar/TOKEN` usando el paquete `qrcode` (ya instalado)
- Devuelve `Content-Type: image/png`

---

### GET /api/actas/info/:entityType/:entityId
**Protegido** (solo panel IT).

Devuelve el estado del token para un documento específico:
```json
{
  "token": "uuid-v4",
  "url": "http://HOST/firmar/TOKEN",
  "uploaded": false,
  "uploaded_at": null,
  "filename": null
}
```
Si no existe token: `{ "token": null }`.

---

## Página pública `/firmar/:token`

Servida por Express con `express.static` para `firmar.html`. La ruta dinámica `/firmar/:token` se maneja con un redirect o ruta catch-all que sirve `firmar.html`, pasando el token como parte de la URL (leído con `window.location.pathname` en el JS).

### Estados de la UI (`firmar.html` + `firmar.js`)

**Estado inicial — cargando:**
Muestra spinner mientras llama `GET /api/actas/status/:token`.

**Estado: token válido, sin archivo subido:**
```
Logo Mi Farmacia IT
📋 Acta de Entrega — [entity_ref]
Por favor sube el acta firmada:
[ Seleccionar archivo (PDF o DOCX) ]
[ Subir acta firmada ]
Formatos aceptados: PDF, DOCX | Máx. 10 MB
```

**Estado: subida exitosa:**
```
✅ ¡Acta recibida exitosamente!
El equipo de IT ya recibió tu acta firmada.
Puedes cerrar esta ventana.
```

**Estado: ya fue subida previamente:**
```
✅ Acta ya entregada
Ya recibimos tu acta firmada el [fecha].
Si hay un error, contacta a IT.
```

**Estado: token inválido:**
```
❌ Link no válido
Este link no existe o ya no es válido.
Contacta al equipo de IT.
```

La página es responsive (celular primero — el receptor generalmente escanea el QR con su teléfono).

---

## Integración en el panel IT

### En despachos (`despacho.js` — `renderActaSection` y `setupActaInteraction`)

Cuando `requiere_acta = 1`, la sección del acta en el modal de detalle muestra:

**Sin token:**
```
[ 🔗 Obtener link de firma ]
```

**Token activo, sin archivo:**
```
🔗 Link de firma activo — pendiente de subida
https://servidor/firmar/TOKEN  [ 📋 Copiar ]
[QR image 120x120px]
[ 🔄 Regenerar link ]
```

**Archivo subido:**
```
✅ Acta firmada recibida el 01/06/2026 a las 2:30 PM
[ 📥 Descargar acta firmada ]
```

El botón "Marcar como firmada" existente se mantiene para casos donde el receptor entregó el papel en mano y IT lo escanea directamente.

### En tech-requests

Se agrega la misma sección en el detalle de requerimientos completados (cuando `type = 'requerimiento'`). La integración exacta depende de la estructura del panel de tech-requests al momento de implementar.

---

## Almacenamiento de archivos

- Directorio: `uploads/actas-firmadas/` (en la raíz del proyecto)
- Nombre del archivo: `{token}.pdf` o `{token}.docx` (el token es el nombre — sin datos personales en el path)
- El directorio debe existir antes de subir (crearlo si no existe en la ruta de upload)
- El directorio debe estar en `.gitignore`

---

## Dependencias

- `qrcode` — ya instalado (`^1.5.4`)
- `multer` — necesario para manejar `multipart/form-data`. **Debe instalarse:** `npm install multer`
- No se requieren otras dependencias nuevas

---

## Seguridad

- Los endpoints de download, QR e info están en rutas `/api/actas/...` que solo el panel IT usa (mismo servidor, sin autenticación adicional necesaria — igual que el resto del panel)
- Los endpoints `status` y `upload` son públicos (sin auth) — diseñado así para que el receptor pueda subir sin login
- El token UUID es suficientemente aleatorio para prevenir adivinanza
- Se valida el tipo de archivo tanto por extensión como por MIME type
- El nombre del archivo en disco es el token (no el nombre original) — evita path traversal

---

## Lo que NO cambia

- Tablas `despachos` y `tech_requests` — sin modificaciones de columnas
- Flujo de generación del `.docx` en `acta-generator.js` — sin cambios
- La funcionalidad "Marcar como firmada" existente — se conserva como opción alternativa
