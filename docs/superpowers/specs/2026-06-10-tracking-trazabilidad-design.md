# Sistema de Trazabilidad de Despachos — Spec de Diseño

**Fecha:** 2026-06-10  
**Stack:** Node.js/Express · SQLite (node:sqlite) · Vanilla JS (legacy frontend)  
**Módulo:** `src/tracking/` (independiente, integrado con despachos)

---

## 1. Objetivo

Permitir conocer en tiempo real la ubicación y estado de cada paquete despachado, desde su creación hasta la entrega final, con evidencia fotográfica en cada punto del recorrido y un acta de recepción final firmada digitalmente.

---

## 2. Modelo de Datos

### 2.1 Tablas nuevas

```sql
-- Registro de tracking: 1 por despacho, auto-creado
CREATE TABLE paquete_tracking (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  despacho_id INTEGER NOT NULL UNIQUE,
  token       TEXT    NOT NULL UNIQUE,   -- UUID v4, base del QR
  estado      TEXT    NOT NULL DEFAULT 'creado',
              -- CHECK estado IN ('creado','en_transito','en_sede','entregado','devuelto')
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (despacho_id) REFERENCES despachos(id)
);

-- Eventos de recepción: N por tracking (inmutables, solo INSERT)
CREATE TABLE paquete_eventos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id      INTEGER NOT NULL,
  tipo             TEXT NOT NULL,   -- 'creacion' | 'recepcion' | 'entrega_final'
  recibido_por     TEXT NOT NULL,   -- nombre del receptor
  entregado_por    TEXT NOT NULL,   -- nombre de quien entrega
  ubicacion        TEXT NOT NULL,   -- nombre sede (lista) o texto libre
  sede_id          INTEGER,         -- NULL si texto libre
  cargo_receptor   TEXT,            -- solo en entrega_final
  observaciones    TEXT,
  foto_path        TEXT NOT NULL,   -- ruta en disco, siempre presente
  foto_filename    TEXT NOT NULL,
  estado_paquete   TEXT NOT NULL,   -- estado resultante tras este evento
  ip               TEXT,            -- IP del receptor (anti-fraude)
  created_at       TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
);

-- Checklist de artículos en entrega final
CREATE TABLE paquete_entrega_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id         INTEGER NOT NULL,
  item_index        INTEGER NOT NULL,
  equipment_name    TEXT NOT NULL,
  cantidad          INTEGER NOT NULL DEFAULT 1,
  recibido_conforme INTEGER NOT NULL DEFAULT 1,   -- 0 | 1
  observacion_item  TEXT,
  FOREIGN KEY (evento_id) REFERENCES paquete_eventos(id)
);

-- Acta de recepción final generada
CREATE TABLE paquete_acta_final (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id  INTEGER NOT NULL UNIQUE,
  filepath     TEXT NOT NULL,
  filename     TEXT NOT NULL,
  firmado_por  TEXT NOT NULL,
  cargo        TEXT NOT NULL,
  generated_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
);
```

### 2.2 Índices

```sql
CREATE INDEX idx_paquete_tracking_despacho ON paquete_tracking(despacho_id);
CREATE INDEX idx_paquete_tracking_token    ON paquete_tracking(token);
CREATE INDEX idx_paquete_eventos_tracking  ON paquete_eventos(tracking_id);
```

### 2.3 Almacenamiento de archivos

- Fotos de evidencia: `uploads/tracking-fotos/{token}-{timestamp}.jpg`
- Actas finales:     `uploads/tracking-actas/{token}-acta.docx`

---

## 3. Estados del Paquete

```
creado ──► en_transito ──► en_sede ──► entregado
                │                         ▲
                └────────────────────────►┘
                  (directo si primer evento
                   es en la sede destino)

cualquier estado ──► devuelto  (solo IT, desde la app interna)
```

| Estado | Transición | Color UI |
|--------|-----------|----------|
| `creado` | Al crear el despacho | Gris `#64748b` |
| `en_transito` | Primer evento en lugar distinto al destino | Amarillo `#f59e0b` |
| `en_sede` | Evento en sede que no es el destino final | Azul `#818cf8` |
| `entregado` | Evento `entrega_final` con acta generada | Verde `#10b981` |
| `devuelto` | Marcado manualmente por IT | Rojo `#ef4444` |

**Lógica de transición:** el servidor determina si es `entrega_final` por el flag que envía el cliente (`es_entrega_final: true`). El estado resultante: si `es_entrega_final` → `entregado`; si la ubicación tiene `sede_id` → `en_sede`; si es texto libre → `en_transito`.

---

## 4. Módulo Backend: `src/tracking/`

### 4.1 Archivos

```
src/tracking/
  tracking-model.js      — CRUD sobre las 4 tablas
  tracking-routes.js     — endpoints públicos y autenticados
  tracking-notifier.js   — notificaciones WhatsApp + in-app event
  acta-receptor.js       — generación del acta Word de recepción final
```

### 4.2 Endpoints públicos (sin auth)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/tracking/public/:token` | Info del paquete, estado actual e historial de eventos (sin rutas de archivo) |
| `GET`  | `/api/tracking/public/sedes` | Lista de sedes activas `[{id, ciudad, nombre_punto}]` |
| `POST` | `/api/tracking/public/:token/evento` | Registra recepción intermedia. Body: multipart/form-data con foto |
| `POST` | `/api/tracking/public/:token/entrega-final` | Registra entrega final + items checklist + genera acta |
| `GET`  | `/api/tracking/public/:token/acta-final` | Descarga acta generada (solo si existe) |

**Validaciones en endpoints públicos:**
- Token debe existir y el despacho no estar en estado `entregado` o `devuelto`
- Foto: obligatoria, solo `image/jpeg` o `image/png`, máx 5 MB
- Rate limit: 5 eventos por token en los últimos 60 minutos (por IP)
- Si el estado ya es `entregado`: rechazar nuevos eventos con 409

### 4.3 Endpoints autenticados (requieren sesión)

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| `GET`  | `/api/tracking` | `despacho:read` | Lista trackings con filtros (estado, fecha, search) |
| `GET`  | `/api/tracking/:token` | `despacho:read` | Detalle completo con eventos, fotos y acta |
| `GET`  | `/api/tracking/:token/qr` | `despacho:read` | PNG del QR del paquete |
| `PUT`  | `/api/tracking/:token/estado` | `despacho:edit` | Cambiar estado a `devuelto` (único PUT permitido) |
| `GET`  | `/api/tracking/fotos/:filename` | `despacho:read` | Sirve foto de evidencia |

### 4.4 Integración con despachos

En `src/despacho/despacho-routes.js`, el `POST /api/despachos` llama internamente:

```js
import { createTracking } from '../tracking/tracking-model.js';
// ...después de insertar el despacho:
createTracking(db, despachoId);
```

`createTracking` genera UUID, inserta en `paquete_tracking` con estado `creado`, e inserta el primer evento tipo `creacion` con `entregado_por = agente`, `ubicacion = 'Bodega Central'` (o la sede del agente).

---

## 5. Página Pública: `/rastrear/:token`

### 5.1 Archivo

```
public/rastrear.html      — SPA shell (como firmar.html)
public/js/tracking-public.js  — lógica del formulario
```

### 5.2 Flujo de la página

1. **Carga**: fetch `GET /api/tracking/public/:token` → muestra info del paquete (número, destino, estado, artículos)
2. **Formulario de recepción** (siempre visible si el paquete no está entregado):
   - Campo "¿Quién te entregó?" (texto libre, obligatorio)
   - Campo "Tu nombre" (texto libre, obligatorio)
   - Selector de ubicación con buscador tipo autocomplete (fetch sedes al cargar, filtro client-side). Si no encuentra → campo libre habilitado con texto "No aparece mi ubicación"
   - Observaciones (opcional)
   - Botón de foto (input file + cámara). Preview inline antes de enviar. Obligatorio.
3. **Detección de entrega final**: el formulario incluye siempre un checkbox "Soy el destinatario final / entrega definitiva". Si el usuario lo marca → aparece sección extra:
   - Campo "Tu cargo en la empresa" (texto libre con autocompletado usando cargos ya registrados en tech_requests — no tabla separada)
   - Checklist de artículos del despacho (cada ítem con checkbox "Recibí conforme" y campo de observación opcional)
4. **Envío**: `POST /api/tracking/public/:token/evento` o `/entrega-final`
5. **Pantalla de éxito**: resumen del registro + botón "Descargar acta" (solo en entrega final)

### 5.3 Ruta SPA

En el servidor (`it-tickets.js` o equivalente), añadir:
```js
app.get('/rastrear/:token', (req, res) =>
  res.sendFile(path.join(__dirname, 'public/rastrear.html'))
);
```

---

## 6. Vistas Internas (Frontend Legacy)

### 6.1 Módulo "Trazabilidad" en sidebar

- Nuevo ítem en sidebar: "Trazabilidad" con ícono de camión
- Nuevo archivo: `public/js/trazabilidad.js`
- Ruta hash: `#trazabilidad`
- Permiso: `despacho:read`

**Vista lista:** tabla con columnas Número, Destino, Estado (badge), Último evento, Progreso (barra), Actualizado. Filtros: estado, búsqueda.

**Vista detalle** (click en fila): abre dentro del mismo contenedor con botón "← Volver":
- Barra de progreso de 5 pasos (Creado → Despachado → En tránsito → En sede → Entregado)
- Timeline vertical con cada evento: icono, título, fecha, recibido_por, entregado_por, ubicación, foto (click para ampliar), observaciones
- Panel derecho: QR descargable, datos del despacho, tiempos por etapa
- Botón "Marcar como devuelto" (solo si no está `entregado`)

### 6.2 Sección tracking en detalle de despacho

En `public/js/despacho.js`, en el modal de detalle existente, añadir tab o sección "Tracking":
- Estado actual con badge
- Botón "Descargar QR"
- Mini-timeline (últimos 3 eventos) con link "Ver historial completo" → navega a `#trazabilidad`

### 6.3 Notificación WhatsApp

Usa `messenger.js` existente. Mensaje al registrar cualquier evento:

```
📦 *Movimiento de paquete*
*DES-20260610-004* → Farmacia Aliada

📍 Recibido en: Bodega Norte · Cali
👤 Recibió: Marco Polo
🤝 Entregado por: Carlos Mensajero
🕐 10 jun 2026 · 10:52 am

Estado: 🚚 En tránsito
```

Para `entrega_final`:
```
✅ *Paquete entregado*
*DES-20260610-004* entregado en Farmacia Aliada

👤 Recibió: Diana Lorena Ramírez (Regente)
📋 3/3 artículos confirmados
📄 Acta de recepción generada
🕐 10 jun 2026 · 2:34 pm
```

---

## 7. Acta de Recepción Final

Generada por `src/tracking/acta-receptor.js`. Reutiliza la lógica de `acta-generator.js` existente (docxtemplater/similar). Contenido:

- Encabezado: logo + "Acta de Recepción de Equipos" + número despacho
- Datos del remitente (agente IT, fecha despacho)
- Datos del receptor: nombre, cargo, fecha/hora
- Tabla de artículos con columnas: Artículo, Cantidad, Recibido conforme (✓/✗), Observación
- Observaciones generales
- Campos de firma: receptor + agente IT (líneas en blanco para firma física si se imprime)

Formato: `.docx` (consistente con actas existentes). Guardado en `uploads/tracking-actas/`.

---

## 8. Seguridad

| Riesgo | Mitigación |
|--------|-----------|
| Registro falso sin acceso al paquete | Token UUID 128-bit — solo quien tiene el QR físico puede registrar |
| Doble envío (spam) | Rate limit: 5 eventos/token/hora por IP. Rechaza si último evento < 30s mismo IP |
| Foto falsa | Timestamp del servidor, no del cliente. IP guardada. No se confía en metadatos EXIF |
| Modificar historial | Sin endpoints PUT/DELETE en eventos. Historial 100% inmutable |
| Acceso a fotos ajenas | Nombre de foto = `{token}-{timestamp}-{random}.jpg` — no predecible sin el token |
| Paquete ya entregado | Endpoint rechaza nuevos eventos con HTTP 409 si estado = `entregado` |
| Acceso a fotos sin auth | Endpoint `/api/tracking/fotos/:filename` requiere `despacho:read` |

---

## 9. Casos de Uso

| # | Actor | Acción | Sistema |
|---|-------|--------|---------|
| 1 | IT | Crea despacho | Auto-genera tracking token + evento `creacion` |
| 2 | IT | Abre detalle despacho | Ve QR + estado + mini-timeline |
| 3 | IT | Descarga QR | PNG del QR para imprimir y pegar al paquete |
| 4 | Mensajero | Escanea QR en bodega | Ve formulario → llena → sube foto → confirma |
| 5 | Sistema | Recibe evento | Actualiza estado → notifica WhatsApp + in-app |
| 6 | Receptor final | Escanea QR en farmacia | Ve formulario extendido con checklist |
| 7 | Receptor final | Confirma artículos + cargo | Sistema genera acta → descarga disponible |
| 8 | IT | Ve módulo Trazabilidad | Lista todos los paquetes con estado en tiempo real |
| 9 | IT | Abre timeline | Ve historial completo + fotos + tiempos |
| 10 | IT | Paquete no llegó | Marca como `devuelto` desde la app |

---

## 10. Permisos

No se crean permisos nuevos. El tracking usa `despacho:read` y `despacho:edit` existentes — es una extensión funcional de los despachos, no un módulo de acceso independiente.

---

## 11. Archivos a crear/modificar

### Nuevos
```
src/tracking/tracking-model.js
src/tracking/tracking-routes.js
src/tracking/tracking-notifier.js
src/tracking/acta-receptor.js
public/rastrear.html
public/js/tracking-public.js
public/js/trazabilidad.js
```

### Modificados
```
src/config/database.js          — 4 tablas + 3 índices nuevos
src/despacho/despacho-routes.js — llamar createTracking() en POST
it-tickets.js (o server entry)  — ruta /rastrear/:token
public/js/app.js                — ruta #trazabilidad + sidebar item
public/js/despacho.js           — sección tracking en modal detalle
public/index.html               — item sidebar Trazabilidad
```

---

## 12. Fuera de scope

- App móvil nativa
- Geolocalización GPS automática (el receptor selecciona su ubicación manualmente)
- Integración con transportistas externos (FedEx, etc.)
- Firma digital criptográfica (el acta es un documento descargable, no PKI)
- Notificaciones push
