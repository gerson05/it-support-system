# Inventario — Escáner Combinado + Importación Excel

**Fecha:** 2026-06-04
**Módulo:** inventario
**Archivos afectados:**
- `public/js/inventario.js` (modificar)
- `src/inventario/inventario-routes.js` (modificar)

---

## Contexto

El módulo Inventario ya tiene CRUD completo para equipos y celulares con un escáner de un campo a la vez. Los usuarios (técnicos de IT) registran dispositivos físicamente desde el celular. Se necesita:

1. **Escáner combinado** — llenar el máximo de campos posibles con la cámara en un solo gesto
2. **Importación Excel** — cargar registros existentes de los archivos Excel que se venían usando antes de esta app

---

## Feature 1: Escáner combinado (multi-código + OCR)

### Cambio de UX en el formulario

El botón "📷" por campo se reemplaza por un único botón **"📷 Escanear equipo"** en el header del modal de registro (equipos y celulares). Los botones individuales por campo se conservan como fallback para correcciones puntuales.

### Modal del escáner

Dos pestañas dentro del mismo modal de cámara:

#### Pestaña "Códigos" (BarcodeDetector)

- Cámara continua con `requestAnimationFrame`. En cada frame, `BarcodeDetector.detect(video)` devuelve todos los códigos visibles simultáneamente.
- Cada valor detectado pasa por `routeBarcode(value, tipo)`:

| Patrón | Campo destino (celulares) | Campo destino (equipos) |
|---|---|---|
| `^\d{15}$` | `imei` (si vacío) → `imei2` (si imei ya detectado) | `serial` |
| Alfanumérico 5–20 chars | — | `placa` (primer scan) → `serial` (segundo) |

- Un `Set` deduplicado acumula los valores detectados.
- Panel debajo del video muestra en tiempo real: `Campo → valor` para cada detección.
- Botón **"Aplicar campos"** vuelca todos los valores al formulario y cierra el modal.
- Si `BarcodeDetector` no está disponible: toast de advertencia, pestaña deshabilitada.

#### Pestaña "Leer etiqueta" (Tesseract.js OCR)

- Tesseract.js v5 se carga **lazy** desde CDN solo al activar esta pestaña por primera vez. Los datos de idioma (~30 MB) se cachean en el browser tras la primera descarga.
- El video se mantiene activo. El usuario encuadra la etiqueta y toca **"Capturar"**: se captura el frame actual en un `<canvas>` oculto.
- `Tesseract.createWorker('spa+eng')` procesa el canvas. Barra de progreso durante el reconocimiento.
- El texto resultante se parsea con estas reglas (en orden de prioridad):

| Regex / patrón | Campo |
|---|---|
| `IMEI[\s:]+(\d{15})` | `imei` |
| `S\/?N[\s:]+([A-Z0-9\-]{5,20})` | `serial` |
| `(\d+)\s*GB` precedido de "RAM" en ±30 chars | `ram` |
| `(\d+)\s*GB` precedido de "ROM\|Storage\|Alm" en ±30 chars | `almacenamiento` |
| Marcas conocidas: Samsung, Xiaomi, Redmi, Dell, HP, Lenovo, Asus, Acer, Apple | `marca` / `equipo` |
| Texto tras la marca en la misma línea | `modelo` |

- Se muestran los campos extraídos con sus valores. Botón **"Aplicar campos"** los vuelca al formulario.
- Si la confianza OCR es baja o el texto no matchea ningún campo: mensaje "No se detectaron datos. Intenta con mejor iluminación." + botón "Reintentar".
- Botón "Reintentar" descarta el canvas y reactiva la cámara sin recargar Tesseract.

### Comportamiento de "Aplicar campos"

- Solo sobreescribe campos que estén **vacíos** en el formulario. Si el campo ya tiene valor, se omite (no pisar edición manual del usuario).
- Excepción: si el usuario hace scan mientras edita un registro existente (modo editar), aplica igual solo sobre campos vacíos.

### Fallback por campo

Los botones 📷 individuales permanecen. Llaman a `openScanner(targetInputId)` (función ya existente, sin cambios) para escanear un solo código y dirigirlo a un campo específico.

---

## Feature 2: Importación Excel

### Backend — nuevas rutas en `src/inventario/inventario-routes.js`

#### `POST /api/inventario/:type/import`

- `:type` = `equipos` | `celulares`
- Requiere permiso `inventario:create`
- `multer({ storage: multer.memoryStorage(), limits: { fileSize: 10MB } })` — sin escritura a disco
- ExcelJS lee `req.file.buffer` directamente: `wb.xlsx.load(buffer)`
- Lee la primera hoja. Primera fila = encabezados.
- Normaliza cada encabezado: `toLowerCase().normalize('NFD').replace(/\p{Mn}/gu,'').trim()`
- Mapea columnas usando tablas hardcodeadas (ver abajo). Columnas sin match → ignoradas.
- Parsea todas las filas (omite filas completamente vacías).
- Devuelve:
```json
{
  "preview": [ /* primeras 5 filas como objetos campo→valor */ ],
  "mapping": { "NombreColumnaExcel": "campo_bd | null" },
  "total": 247
}
```

#### `POST /api/inventario/:type/import/confirm`

- Body: `{ rows: [...], mode: "skip" | "overwrite" }`
- `rows` = array de objetos `{ campo_bd: valor }` — los mismos que devolvió `/import` (el frontend los guarda en memoria y los reenvía)
- Inserta en bulk. Por cada fila:
  - `skip`: `INSERT OR IGNORE` — duplicados (UNIQUE constraint en placa/serial/imei) se cuentan como `skipped`
  - `overwrite`: `INSERT OR REPLACE`
- Devuelve: `{ inserted: N, skipped: M, errors: [{ row: N, message: "..." }] }`
- Errores de validación (campos requeridos vacíos) se reportan en `errors[]` sin detener el batch.

#### Tablas de mapeo de columnas

**Equipos:**
```
placa            ← "placa"
marca            ← "marca"
nombre_equipo    ← "nombre de equipo", "nombre equipo"
serial           ← "serial/emei", "serial", "s/n", "serial/imei"
procesador       ← "procesador"
ram              ← "ram"
tipo_ram         ← "tipo de ram", "tipo ram"
cap_disco        ← "capacidad disco", "cap disco"
tipo_disco       ← "tipo de disco", "tipo disco"
serial_cargador  ← "serial cargador"
area             ← "area"
responsable      ← "responsable"
fecha_compra     ← "fecha de compra", "fecha compra"
```

**Celulares:**
```
fecha_registro   ← "fecha"
area             ← "area"
ciudad           ← "ciudad"
nombre_completo  ← "nombre completo"
cedula           ← "cedula"
linea            ← "linea"
operador         ← "operador"
equipo           ← "equipo"
almacenamiento   ← "alm", "almacenamiento"
ram              ← "ram"
modelo           ← "modelo"
imei             ← "imei"
imei2            ← "imei 2", "imei2"
estado           ← "estado"
accesorio        ← "accesorio"
fecha_entrega    ← "fecha de entrega"
entregado_por    ← "entregado por"
```

Columnas sin match (DIA, MES, ACTA FIRMADA, GENERAR, Merged Doc*, Document Merge*) → ignoradas silenciosamente.

### Frontend — modal de importación en `public/js/inventario.js`

**Botón de entrada:** "⬆ Importar Excel" junto al botón "＋ Registrar equipo" en el header de inventario.

**Modal en 3 pasos secuenciales:**

**Paso 1 — Subir archivo:**
- `<input type="file" accept=".xlsx,.xls">` con zona de drag-drop
- Al seleccionar: POST a `/api/inventario/:type/import` con `FormData`
- Spinner de carga. Si error (formato no reconocido, > 10MB): mensaje de error.

**Paso 2 — Revisar mapeo y preview:**
- Tabla de mapeo: una fila por columna del Excel. Columna izquierda = nombre original, columna derecha = `<select>` con el campo BD auto-seleccionado (o "Ignorar" si no hubo match).
- Tabla preview con las primeras 5 filas usando el mapeo activo.
- Selector "Duplicados:" radio `skip` (omitir, default) / `overwrite` (reemplazar).
- Total de filas a importar visible.
- Botón "Importar N registros".

**Paso 3 — Resultado:**
- POST a `/api/inventario/:type/import/confirm` con `{ rows, mode }` (rows guardadas en closure desde paso 1).
- Muestra: `N registros importados`, `M duplicados omitidos`, errores con número de fila si los hay.
- Botón "Cerrar" recarga la tabla de inventario y los contadores de tabs.

---

## Restricciones

- El escáner OCR requiere HTTPS o `localhost` (restricción del browser para `navigator.mediaDevices`). La app ya corre en contexto seguro.
- `BarcodeDetector` disponible en Chrome/Edge ≥ 83 y Safari ≥ 17. En Firefox: pestaña "Códigos" deshabilitada, OCR sigue funcionando.
- Tesseract.js requiere conexión para la primera descarga del modelo de idioma. Offline después.
- Importación máxima: 10 MB por archivo (configurable en multer). Archivos típicos de inventario caben holgadamente.
