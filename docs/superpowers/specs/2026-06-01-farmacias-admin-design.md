# Módulo Admin: Directorio de Farmacias FOMAG

**Fecha:** 2026-06-01
**Estado:** Aprobado por usuario

---

## Contexto

El bot FOMAG (Farmy) usa un Google Sheet como fuente de verdad para responder a usuarios que preguntan dónde reclamar medicamentos. El Sheet tiene 3 columnas:

- **Col A:** Keywords/triggers separados por coma (ej: `18,Cali,CALI,cali`)
- **Col B:** Texto de respuesta completo en formato WhatsApp (puede contener N farmacias separadas por `====`)
- **Col C:** Número de paso (metadata del bot externo, no se modifica)

Cada fila del Sheet corresponde a un municipio. Dentro de la columna B, cada farmacia tiene este formato:

```
Municipio: *NOMBRE*
Farmacia: *NOMBRE FARMACIA*
Dir: *DIRECCIÓN*
Correo: correo@ejemplo.com
Hr. Atención: *HORARIO*
Telefónico: NÚMERO
Ubicación: https://maps.app.goo.gl/...
```

Múltiples farmacias en el mismo municipio se separan con `======================`.

---

## Objetivo

Crear un módulo en el panel admin existente que permita:
1. **Ver** todos los municipios y sus farmacias de forma navegable
2. **Editar** los campos de cada farmacia (nombre, dirección, correo, horario, teléfono, link Maps)
3. **Agregar** nuevas farmacias a un municipio
4. **Eliminar** farmacias de un municipio
5. **Auto-sincronizar** cada cambio de vuelta al Google Sheet

El bot FOMAG sigue leyendo del Sheet sin cambios. Esta app solo actualiza el Sheet.

---

## Arquitectura

```
Google Sheets (fuente de verdad)
        ↕  googleapis (Service Account)
src/farmacias/
  ├── sheets-service.js     ← leer, parsear, escribir en el Sheet
  └── farmacias-routes.js   ← API REST montada en server.js

public/
  ├── farmacias.html        ← página del panel admin
  └── js/farmacias.js       ← UI: búsqueda + acordeón + panel lateral
```

No se usa SQLite. El Sheet es la única fuente de datos. La página lee del Sheet al cargar y escribe al Sheet al guardar.

---

## Credenciales

- Archivo: `credentials/google-service-account.json` (en `.gitignore`)
- Variable de entorno: `GOOGLE_SHEETS_ID` en `.env`
- La Service Account debe tener rol **Editor** en el Sheet

---

## API Endpoints

Todos bajo `/api/farmacias`, protegidos por la misma sesión de admin que usa el resto del panel.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/farmacias` | Lee el Sheet completo, devuelve JSON con departamentos → municipios → farmacias |
| `PUT` | `/api/farmacias/punto` | Edita los campos de una farmacia existente |
| `POST` | `/api/farmacias/punto` | Agrega una farmacia nueva a un municipio |
| `DELETE` | `/api/farmacias/punto` | Elimina una farmacia de un municipio |

### Estructura del JSON devuelto por GET /api/farmacias

```json
[
  {
    "nombre": "Valle del Cauca",
    "municipios": [
      {
        "sheetRow": 3,
        "numero": 18,
        "nombre": "Cali",
        "keywords": ["18", "Cali", "CALI", "cali"],
        "farmacias": [
          {
            "index": 0,
            "nombre": "MI FARMACIA CALI NORTE",
            "direccion": "AV 3 BIS # 24N - 47 B/SAN VICENTE",
            "correo": "mifarmacia.calinorte@gmail.com",
            "horario": "LUNES A VIERNES 7:00 AM - 6:00 PM / SABADOS 8:00 AM - 12:00 PM",
            "telefono": "3115594674",
            "mapsUrl": "https://maps.app.goo.gl/ifdMsc7HTmCxi1UY8"
          }
        ]
      }
    ]
  }
]
```

### Body de PUT /api/farmacias/punto

```json
{
  "sheetRow": 3,
  "index": 0,
  "nombre": "MI FARMACIA CALI NORTE",
  "direccion": "AV 3 BIS # 24N - 47",
  "correo": "mifarmacia.calinorte@gmail.com",
  "horario": "LUNES A VIERNES 7:00 AM - 6:00 PM",
  "telefono": "3115594674",
  "mapsUrl": "https://maps.app.goo.gl/ifdMsc7HTmCxi1UY8"
}
```

### Body de POST /api/farmacias/punto

```json
{
  "sheetRow": 3,
  "nombre": "NUEVA FARMACIA",
  "direccion": "CL 10 # 5-20",
  "correo": "",
  "horario": "LUNES A VIERNES 7:00 AM - 5:00 PM",
  "telefono": "3001234567",
  "mapsUrl": ""
}
```

### Body de DELETE /api/farmacias/punto

```json
{
  "sheetRow": 3,
  "index": 1
}
```

---

## Servicio sheets-service.js

### Funciones principales

**`readSheet()`**
- Llama a `sheets.spreadsheets.values.get` para la hoja activa (gid=1516003101)
- Itera filas fila por fila con su número de fila real (para guardar `sheetRow`):
  - Si col B contiene `"Elegiste los municipios de X"` → marca X como departamento activo
  - Si col B contiene `"Farmacia:"` → es una fila de municipio: extrae municipio de col A y parsea farmacias de col B, asigna al departamento activo
  - Cualquier otra fila (saludos, menú inicial) → se ignora
- Devuelve el JSON estructurado

**`parsefarmacias(colBText)`**
- Divide por el separador `======================`
- Por cada bloque extrae con regex: Farmacia, Dir, Correo, Hr, Telefónico, Ubicación
- Devuelve array de objetos farmacia

**`reconstructColB(municipioNombre, farmacias)`**
- Recibe el nombre del municipio y el array de farmacias actualizado
- Reconstruye el texto completo en formato WhatsApp con emojis y separadores
- Devuelve el string listo para escribir en col B

**`writeRow(sheetRow, colBText)`**
- Llama a `sheets.spreadsheets.values.update` en la celda exacta `B{sheetRow}`
- No toca col A ni col C

---

## UI — farmacias.html / farmacias.js

### Layout

```
┌─────────────────────────────────────────────┐
│ 🔍 Buscar municipio o farmacia...            │
├─────────────────────────────────────────────┤
│ ▼ Valle del Cauca                           │
│   ▼ Cali                                    │
│     🏥 MI FARMACIA CALI NORTE  [✏️] [🗑️]   │
│     🏥 MI FARMACIA CALI SUR    [✏️] [🗑️]   │
│     [+ Agregar farmacia]                    │
│   ▶ Palmira                                 │
│   ▶ Buga                                    │
│ ▶ Cauca                                     │
└─────────────────────────────────────────────┘

Panel lateral (al hacer clic en ✏️):
┌───────────────────────────────┐
│ Editando: MI FARMACIA NORTE   │
│ Nombre:    [_______________]  │
│ Dirección: [_______________]  │
│ Correo:    [_______________]  │
│ Horario:   [_______________]  │
│ Teléfono:  [_______________]  │
│ Link Maps: [_______________]  │
│            [Cancelar] [💾 Guardar] │
│ ✅ Guardado en Google Sheets  │
└───────────────────────────────┘
```

### Comportamiento

- Al cargar la página: `GET /api/farmacias` → renderiza la lista
- Búsqueda: filtra en memoria (sin nueva llamada al servidor)
- ✏️ Editar: abre panel lateral con campos pre-llenados
- 💾 Guardar: `PUT /api/farmacias/punto` → muestra spinner → muestra `✅ Guardado` o `❌ Error`
- 🗑️ Eliminar: modal de confirmación `"¿Eliminar [nombre]? Esta acción actualizará el Sheet."` → `DELETE /api/farmacias/punto`
- ➕ Agregar: abre panel lateral con campos vacíos → `POST /api/farmacias/punto`

---

## Dependencia nueva

```bash
npm install googleapis
```

---

## Archivos que se crean o modifican

| Archivo | Acción |
|---------|--------|
| `src/farmacias/sheets-service.js` | Crear |
| `src/farmacias/farmacias-routes.js` | Crear |
| `public/farmacias.html` | Crear |
| `public/js/farmacias.js` | Crear |
| `server.js` | Modificar — montar `/api/farmacias` |
| `.env` | Modificar — agregar `GOOGLE_SHEETS_ID` |
| `.gitignore` | Modificar — agregar `credentials/` |
| `credentials/google-service-account.json` | Crear (manual por el usuario) |

---

## Lo que NO cambia

- `chatbot.js` — sin modificaciones
- `gemini-service.js` — sin modificaciones
- Tablas SQLite existentes — sin modificaciones
- El bot FOMAG externo — sigue leyendo del Sheet sin cambios
