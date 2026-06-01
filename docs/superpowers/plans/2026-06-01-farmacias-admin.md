# Módulo Admin: Directorio Farmacias FOMAG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un módulo en el panel admin que permita ver, editar, agregar y eliminar farmacias del directorio FOMAG, sincronizando cambios automáticamente con el Google Sheet fuente del bot externo.

**Architecture:** La app lee el Google Sheet via googleapis (Service Account), parsea el contenido de cada celda en JSON estructurado, y al guardar reconstruye el texto formateado y lo escribe de vuelta a la celda exacta del Sheet. No hay base de datos local — el Sheet es la única fuente de verdad.

**Tech Stack:** Node.js ESM, Express, googleapis v6+, HTML/CSS/JS vanilla (mismo design system del panel existente)

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/farmacias/sheets-service.js` | Crear | Auth, leer Sheet, parsear, reconstruir, escribir |
| `src/farmacias/farmacias-routes.js` | Crear | API REST GET/PUT/POST/DELETE |
| `public/farmacias.html` | Crear | Página admin (layout standalone) |
| `public/js/farmacias.js` | Crear | UI: carga, acordeón, búsqueda, panel lateral |
| `server.js` | Modificar | Importar y montar farmacias-routes |
| `.env` | Modificar | Agregar GOOGLE_SHEETS_ID |
| `.gitignore` | Modificar | Agregar credentials/ |
| `credentials/google-service-account.json` | Crear (manual) | Credenciales Service Account |

---

## Task 1: Instalar googleapis + configurar credenciales

**Files:**
- Modify: `.env`
- Modify: `.gitignore`
- Create: `credentials/.gitkeep`

- [ ] **Step 1: Instalar la dependencia**

```bash
cd "C:\Users\equipo sitemas 1\.gemini\antigravity\scratch\it-tickets"
npm install googleapis
```

Esperado: `added N packages` sin errores.

- [ ] **Step 2: Agregar GOOGLE_SHEETS_ID al .env**

Abrir `.env` y agregar al final:

```
# Módulo Farmacias FOMAG
GOOGLE_SHEETS_ID=1kRlv94_UFYNkAogmpoC0A0D7RNfoQ5ajwIf4nveTX6g
```

- [ ] **Step 3: Agregar credentials/ al .gitignore**

Abrir `.gitignore` y agregar:

```
# Credenciales Google (nunca subir al repo)
credentials/
!credentials/.gitkeep
```

- [ ] **Step 4: Crear la carpeta de credenciales**

```bash
mkdir -p credentials && touch credentials/.gitkeep
```

- [ ] **Step 5: Crear la Service Account en Google Cloud**

Instrucciones para el usuario:
1. Ir a https://console.cloud.google.com/
2. Crear proyecto nuevo o usar uno existente
3. Habilitar la API: **Google Sheets API** (buscarla en "APIs y servicios")
4. Ir a "Credenciales" → "Crear credencial" → "Cuenta de servicio"
5. Nombre: `farmacias-admin`, rol: Editor
6. Una vez creada, hacer clic en la cuenta → "Claves" → "Agregar clave" → JSON
7. Guardar el archivo descargado como `credentials/google-service-account.json`
8. Copiar el campo `client_email` del JSON (ej: `farmacias-admin@mi-proyecto.iam.gserviceaccount.com`)
9. Abrir el Google Sheet → Compartir → pegar ese email → rol **Editor** → Enviar

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env credentials/.gitkeep package.json package-lock.json
git commit -m "chore: instalar googleapis y estructura de credenciales farmacias"
```

---

## Task 2: sheets-service.js — auth + readSheet() + parseBlock()

**Files:**
- Create: `src/farmacias/sheets-service.js`

- [ ] **Step 1: Crear el archivo con auth y readSheet()**

Crear `src/farmacias/sheets-service.js`:

```js
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const TARGET_GID     = 1516003101;

let _sheetsClient = null;
let _sheetName    = null;

async function _auth() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../../credentials/google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

async function _getSheetName() {
  if (_sheetName) return _sheetName;
  const sheets = await _auth();
  const meta   = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  const found = meta.data.sheets.find(s => s.properties.sheetId === TARGET_GID);
  _sheetName  = found?.properties?.title || 'Hoja1';
  return _sheetName;
}

/**
 * Lee el Sheet completo y devuelve un array de departamentos con sus municipios y farmacias.
 * Estructura: [{ nombre, municipios: [{ sheetRow, nombre, keywords, farmacias: [...] }] }]
 */
export async function readSheet() {
  const sheets    = await _auth();
  const sheetName = await _getSheetName();

  const res  = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:B`,
  });

  const rows        = res.data.values || [];
  const result      = [];
  let   currentDept = null;

  rows.forEach((row, idx) => {
    const sheetRow = idx + 1;
    const colA = (row[0] || '').trim();
    const colB = (row[1] || '').trim();

    if (!colA || !colB) return;

    // ── Fila de departamento: col B contiene "Elegiste los municipios"
    if (/elegiste los municipios/i.test(colB)) {
      const match = colB.match(/municipios\s+del?\s+\*?([^*\n]+)\*?/i);
      const nombre = match ? match[1].trim() : `Departamento ${result.length + 1}`;
      currentDept = { nombre, municipios: [] };
      result.push(currentDept);
      return;
    }

    // ── Fila de municipio: col B contiene "Farmacia:"
    if (/farmacia:/i.test(colB) && currentDept) {
      const keywords = colA.split(',').map(k => k.trim()).filter(Boolean);
      // El primer keyword numérico es el número del municipio
      const numKw    = keywords.find(k => /^\d+$/.test(k));
      const nombre   = keywords.find(k => !/^\d+$/.test(k)) || `Municipio ${numKw}`;

      currentDept.municipios.push({
        sheetRow,
        nombre,
        keywords,
        farmacias: parseBlock(colB, nombre),
      });
    }
  });

  return result;
}

/**
 * Parsea el texto de una celda col B y extrae las farmacias individuales.
 * Devuelve: [{ index, nombre, direccion, correo, horario, telefono, mapsUrl }]
 */
export function parseBlock(cellText, municipioNombre) {
  // Dividir por el separador de farmacias
  const blocks = cellText
    .split(/={3,}/)
    .map(b => b.trim())
    .filter(b => /farmacia:/i.test(b));

  return blocks.map((block, index) => {
    const get = (pattern) => {
      const m = block.match(pattern);
      return m ? m[1].replace(/\*/g, '').trim() : '';
    };

    const urlMatch = block.match(/https?:\/\/[^\s\n]+/);

    return {
      index,
      nombre:    get(/Farmacia:\s*\*?(.+?)(?:\*?\s*$|\n)/im),
      direccion: get(/Dir:\s*\*?(.+?)(?:\*?\s*$|\n)/im),
      correo:    get(/Correo:\s*(.+?)(?:\s*$|\n)/im),
      horario:   get(/Hr\.?\s*Atenci[oó]n:\s*\*?(.+?)(?:\*?\s*$|\n)/im),
      telefono:  get(/Telef[oó]nico:\s*\*?:?\s*(.+?)(?:\*?\s*$|\n)/im),
      mapsUrl:   urlMatch ? urlMatch[0].trim() : '',
    };
  });
}
```

- [ ] **Step 2: Verificar que el módulo importa sin errores**

Crear `test-sheets-read.mjs` en la raíz:

```js
import dotenv from 'dotenv';
dotenv.config();
import { readSheet } from './src/farmacias/sheets-service.js';

const data = await readSheet();
console.log('Departamentos encontrados:', data.length);
data.forEach(dept => {
  console.log(`\n📍 ${dept.nombre} (${dept.municipios.length} municipios)`);
  dept.municipios.slice(0, 2).forEach(m => {
    console.log(`   ${m.nombre} — fila ${m.sheetRow} — ${m.farmacias.length} farmacia(s)`);
    console.log('   Primera farmacia:', m.farmacias[0]);
  });
});
```

```bash
node test-sheets-read.mjs
```

Esperado: lista de departamentos con municipios y campos parseados correctamente. Si `farmacias.length` es 0 en todos los municipios, ajustar el regex de parseBlock según el formato real que muestre el log de `colB`.

- [ ] **Step 3: Eliminar el script de prueba**

```bash
rm test-sheets-read.mjs
```

- [ ] **Step 4: Commit**

```bash
git add src/farmacias/sheets-service.js
git commit -m "feat: sheets-service readSheet y parseBlock"
```

---

## Task 3: sheets-service.js — reconstructColB() + writeRow()

**Files:**
- Modify: `src/farmacias/sheets-service.js`

- [ ] **Step 1: Agregar reconstructColB() y writeRow() al final del archivo**

Abrir `src/farmacias/sheets-service.js` y agregar después de `parseBlock`:

```js
const SEP = '======================';

/**
 * Reconstruye el texto de la celda col B a partir del array de farmacias.
 * Produce el mismo formato WhatsApp que el bot externo espera.
 */
export function reconstructColB(municipioNombre, farmacias) {
  if (!farmacias.length) return '';

  const blocks = farmacias.map(f => [
    `*FARMACIA*`,
    SEP,
    `📗Municipio: *${municipioNombre}*`,
    `📋Farmacia: *${f.nombre}*`,
    `📍Dir: *${f.direccion}*`,
    `📧Correo: ${f.correo || ''}`,
    `⏰Hr. Atención: *${f.horario || ''}*`,
    `📱Telefonico: ${f.telefono || ''}`,
    `📍 *Ubicación*`,
    f.mapsUrl || '',
    SEP,
  ].join('\n'));

  return blocks.join('\n\n') + '\n\nEscribe🔢 *00* para volver al menu principal';
}

/**
 * Escribe el texto reconstruido en la celda B{sheetRow} del Sheet.
 */
export async function writeRow(sheetRow, cellText) {
  const sheets    = await _auth();
  const sheetName = await _getSheetName();

  await sheets.spreadsheets.values.update({
    spreadsheetId:   SPREADSHEET_ID,
    range:           `${sheetName}!B${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody:     { values: [[cellText]] },
  });
}

/**
 * Helpers de alto nivel usados por las rutas.
 * Reciben la lista de farmacias ya modificada y hacen el write.
 */
export async function saveFarmacias(sheetRow, municipioNombre, farmacias) {
  const text = reconstructColB(municipioNombre, farmacias);
  await writeRow(sheetRow, text);
}
```

- [ ] **Step 2: Verificar escritura con script rápido**

Crear `test-sheets-write.mjs`:

```js
import dotenv from 'dotenv';
dotenv.config();
import { readSheet, reconstructColB, writeRow } from './src/farmacias/sheets-service.js';

// Lee el primer municipio con al menos 1 farmacia
const data   = await readSheet();
const dept   = data[0];
const muni   = dept.municipios.find(m => m.farmacias.length > 0);
if (!muni) { console.error('No hay municipios con farmacias'); process.exit(1); }

console.log('Reconstruyendo fila', muni.sheetRow, 'municipio:', muni.nombre);
const text = reconstructColB(muni.nombre, muni.farmacias);
console.log('Preview (primeros 200 chars):\n', text.slice(0, 200));

// Escribe de vuelta (sin cambios reales — solo verifica que no lanza error)
await writeRow(muni.sheetRow, text);
console.log('✅ Escritura exitosa');
```

```bash
node test-sheets-write.mjs
```

Esperado: `✅ Escritura exitosa` sin errores. Verificar en el Google Sheet que la celda siga viéndose correcta.

- [ ] **Step 3: Ajustar formato si es necesario**

Si el bot externo muestra texto diferente al esperado, abrir el Sheet, ver el contenido real de la celda B de un municipio, y ajustar `reconstructColB` para que coincida exactamente con ese formato (emojis, saltos de línea, separadores).

- [ ] **Step 4: Eliminar el script de prueba**

```bash
rm test-sheets-write.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/farmacias/sheets-service.js
git commit -m "feat: sheets-service reconstructColB y writeRow"
```

---

## Task 4: farmacias-routes.js — GET /api/farmacias

**Files:**
- Create: `src/farmacias/farmacias-routes.js`

- [ ] **Step 1: Crear el router con el endpoint GET**

Crear `src/farmacias/farmacias-routes.js`:

```js
import express from 'express';
import { readSheet, parseBlock, reconstructColB, saveFarmacias } from './sheets-service.js';

const router = express.Router();

/* ── GET /api/farmacias
   Devuelve todos los departamentos con municipios y farmacias parseadas ── */
router.get('/api/farmacias', async (req, res) => {
  try {
    const data = await readSheet();
    res.json(data);
  } catch (err) {
    console.error('[Farmacias] GET error:', err.message);
    res.status(500).json({ error: 'No se pudo leer el directorio de farmacias.' });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add src/farmacias/farmacias-routes.js
git commit -m "feat: farmacias-routes GET /api/farmacias"
```

---

## Task 5: Montar el router en server.js

**Files:**
- Modify: `server.js` (líneas 1–44 aprox.)

- [ ] **Step 1: Agregar import y app.use en server.js**

Abrir `server.js`. Después de la línea `import despachoRouter from './src/despacho/despacho-routes.js';` agregar:

```js
import farmaciasRouter from './src/farmacias/farmacias-routes.js';
```

Después de la línea `app.use(despachoRouter);` agregar:

```js
app.use(farmaciasRouter);
```

- [ ] **Step 2: Reiniciar el servidor y probar el endpoint**

```bash
node server.js
```

En otra terminal:

```bash
curl http://localhost:3000/api/farmacias
```

Esperado: JSON con array de departamentos. Si hay error 500, revisar `credentials/google-service-account.json` y que el email de la Service Account tenga acceso al Sheet.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: montar farmacias-routes en server.js"
```

---

## Task 6: farmacias-routes.js — PUT, POST, DELETE

**Files:**
- Modify: `src/farmacias/farmacias-routes.js`

- [ ] **Step 1: Agregar los tres endpoints de escritura**

Abrir `src/farmacias/farmacias-routes.js` y agregar antes de `export default router`:

```js
/* ── PUT /api/farmacias/punto
   Edita los campos de una farmacia existente en un municipio.
   Body: { sheetRow, municipioNombre, index, nombre, direccion, correo, horario, telefono, mapsUrl } ── */
router.put('/api/farmacias/punto', async (req, res) => {
  try {
    const { sheetRow, municipioNombre, index, nombre, direccion, correo, horario, telefono, mapsUrl } = req.body;
    if (!sheetRow || index === undefined || !municipioNombre) {
      return res.status(400).json({ error: 'sheetRow, municipioNombre e index son obligatorios.' });
    }

    // Leer estado actual del municipio
    const data  = await readSheet();
    const muni  = data.flatMap(d => d.municipios).find(m => m.sheetRow === sheetRow);
    if (!muni) return res.status(404).json({ error: 'Municipio no encontrado.' });

    // Actualizar la farmacia en el índice dado
    if (index < 0 || index >= muni.farmacias.length) {
      return res.status(404).json({ error: 'Farmacia no encontrada en ese índice.' });
    }
    muni.farmacias[index] = { ...muni.farmacias[index], nombre, direccion, correo, horario, telefono, mapsUrl };

    await saveFarmacias(sheetRow, municipioNombre, muni.farmacias);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Farmacias] PUT error:', err.message);
    res.status(500).json({ error: 'No se pudo guardar el cambio.' });
  }
});

/* ── POST /api/farmacias/punto
   Agrega una farmacia nueva a un municipio.
   Body: { sheetRow, municipioNombre, nombre, direccion, correo, horario, telefono, mapsUrl } ── */
router.post('/api/farmacias/punto', async (req, res) => {
  try {
    const { sheetRow, municipioNombre, nombre, direccion, correo, horario, telefono, mapsUrl } = req.body;
    if (!sheetRow || !municipioNombre || !nombre) {
      return res.status(400).json({ error: 'sheetRow, municipioNombre y nombre son obligatorios.' });
    }

    const data  = await readSheet();
    const muni  = data.flatMap(d => d.municipios).find(m => m.sheetRow === sheetRow);
    if (!muni) return res.status(404).json({ error: 'Municipio no encontrado.' });

    muni.farmacias.push({ index: muni.farmacias.length, nombre, direccion, correo, horario, telefono, mapsUrl });
    await saveFarmacias(sheetRow, municipioNombre, muni.farmacias);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Farmacias] POST error:', err.message);
    res.status(500).json({ error: 'No se pudo agregar la farmacia.' });
  }
});

/* ── DELETE /api/farmacias/punto
   Elimina una farmacia de un municipio por índice.
   Body: { sheetRow, municipioNombre, index } ── */
router.delete('/api/farmacias/punto', async (req, res) => {
  try {
    const { sheetRow, municipioNombre, index } = req.body;
    if (!sheetRow || index === undefined || !municipioNombre) {
      return res.status(400).json({ error: 'sheetRow, municipioNombre e index son obligatorios.' });
    }

    const data  = await readSheet();
    const muni  = data.flatMap(d => d.municipios).find(m => m.sheetRow === sheetRow);
    if (!muni) return res.status(404).json({ error: 'Municipio no encontrado.' });
    if (index < 0 || index >= muni.farmacias.length) {
      return res.status(404).json({ error: 'Farmacia no encontrada en ese índice.' });
    }

    muni.farmacias.splice(index, 1);
    // Re-indexar
    muni.farmacias.forEach((f, i) => { f.index = i; });

    await saveFarmacias(sheetRow, municipioNombre, muni.farmacias);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Farmacias] DELETE error:', err.message);
    res.status(500).json({ error: 'No se pudo eliminar la farmacia.' });
  }
});
```

- [ ] **Step 2: Probar los tres endpoints con curl**

```bash
# Obtener sheetRow y index de prueba del GET primero:
curl http://localhost:3000/api/farmacias | node -e "
  const d=[];process.stdin.on('data',c=>d.push(c));
  process.stdin.on('end',()=>{
    const j=JSON.parse(d.join(''));
    const m=j[0].municipios[0];
    console.log('sheetRow:', m.sheetRow, 'municipio:', m.nombre, 'farmacias:', m.farmacias.length);
  });"
```

```bash
# PUT — editar farmacia índice 0 (reemplazar SHEETROW con el valor real)
curl -X PUT http://localhost:3000/api/farmacias/punto \
  -H "Content-Type: application/json" \
  -d '{"sheetRow":SHEETROW,"municipioNombre":"MUNICIPIO","index":0,"nombre":"TEST FARMACIA","direccion":"CL 1 # 1-1","correo":"test@test.com","horario":"LUNES A VIERNES 8AM-5PM","telefono":"3001234567","mapsUrl":""}'
```

Esperado: `{"ok":true}`. Verificar en el Google Sheet que la celda cambió.

```bash
# PUT de vuelta con los valores originales para restaurar
# DELETE — eliminar (solo si hay más de 1 farmacia en el municipio)
# POST — agregar y luego borrar para dejar el Sheet limpio
```

- [ ] **Step 3: Commit**

```bash
git add src/farmacias/farmacias-routes.js
git commit -m "feat: farmacias-routes PUT POST DELETE /api/farmacias/punto"
```

---

## Task 7: farmacias.html + link en sidebar de index.html

**Files:**
- Create: `public/farmacias.html`
- Modify: `public/index.html` (agregar link en sidebar)

- [ ] **Step 1: Crear public/farmacias.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Directorio Farmacias FOMAG</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <style>
    /* ── Layout ── */
    body { display: flex; min-height: 100vh; background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }
    .content { flex: 1; padding: 32px; max-width: 900px; margin: 0 auto; }

    /* ── Header ── */
    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
    .page-header a { color: var(--text-3); text-decoration: none; font-size: 13px; }
    .page-header a:hover { color: var(--primary); }
    .page-title { font-size: 22px; font-weight: 600; }

    /* ── Buscador ── */
    .search-wrap { position: relative; margin-bottom: 24px; }
    .search-wrap input {
      width: 100%; padding: 10px 16px 10px 40px;
      background: var(--surface-2); border: 1px solid var(--border-2);
      border-radius: var(--radius); color: var(--text); font-size: 14px;
      outline: none; transition: var(--transition);
    }
    .search-wrap input:focus { border-color: var(--border-focus); }
    .search-wrap .icon-search {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: var(--text-3); pointer-events: none;
    }

    /* ── Acordeón ── */
    .dept-block { margin-bottom: 12px; }
    .dept-header {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: var(--radius); cursor: pointer; font-weight: 600;
      font-size: 14px; transition: var(--transition);
    }
    .dept-header:hover { background: var(--surface-hover); }
    .dept-header .chevron { margin-left: auto; color: var(--text-3); transition: transform 0.2s; }
    .dept-header.open .chevron { transform: rotate(180deg); }

    .muni-list { padding: 4px 0 0 16px; display: none; }
    .muni-list.open { display: block; }

    .muni-block { margin-bottom: 8px; }
    .muni-header {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-sm); cursor: pointer; font-size: 13px;
      font-weight: 500; transition: var(--transition);
    }
    .muni-header:hover { background: var(--surface-hover); }
    .muni-header .chevron { margin-left: auto; color: var(--text-3); transition: transform 0.2s; }
    .muni-header.open .chevron { transform: rotate(180deg); }

    .farmacia-list { padding: 6px 0 0 14px; display: none; }
    .farmacia-list.open { display: block; }

    .farmacia-row {
      display: flex; align-items: center; gap: 8px; padding: 9px 12px;
      background: var(--surface-3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); margin-bottom: 6px; font-size: 13px;
    }
    .farmacia-row .name { flex: 1; font-weight: 500; }
    .farmacia-row .dir  { color: var(--text-3); font-size: 12px; flex: 2; }

    /* ── Botones ── */
    .btn-icon {
      width: 28px; height: 28px; border: none; border-radius: var(--radius-sm);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: var(--transition); flex-shrink: 0;
    }
    .btn-edit   { background: var(--primary-light); color: var(--primary); }
    .btn-edit:hover { background: var(--primary); color: #fff; }
    .btn-delete { background: rgba(239,68,68,.1); color: var(--danger); }
    .btn-delete:hover { background: var(--danger); color: #fff; }

    .btn-add-farmacia {
      display: flex; align-items: center; gap: 6px; padding: 7px 12px;
      background: transparent; border: 1px dashed var(--border-2);
      border-radius: var(--radius-sm); cursor: pointer; font-size: 12px;
      color: var(--text-3); margin-bottom: 4px; transition: var(--transition);
    }
    .btn-add-farmacia:hover { border-color: var(--primary); color: var(--primary); }

    /* ── Panel lateral ── */
    .panel-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5);
      z-index: 100; display: none; opacity: 0; transition: opacity 0.2s;
    }
    .panel-overlay.open { display: block; opacity: 1; }
    .side-panel {
      position: fixed; right: -440px; top: 0; bottom: 0; width: 420px;
      background: var(--surface-2); border-left: 1px solid var(--border-2);
      z-index: 101; padding: 28px 24px; overflow-y: auto;
      transition: right 0.25s cubic-bezier(.4,0,.2,1);
      display: flex; flex-direction: column; gap: 0;
    }
    .side-panel.open { right: 0; }
    .panel-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; }

    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 12px; font-weight: 500; color: var(--text-2); margin-bottom: 5px; }
    .form-group input, .form-group textarea {
      width: 100%; padding: 9px 12px;
      background: var(--surface-3); border: 1px solid var(--border-2);
      border-radius: var(--radius-sm); color: var(--text); font-size: 13px;
      font-family: inherit; outline: none; transition: var(--transition); box-sizing: border-box;
    }
    .form-group textarea { resize: vertical; min-height: 64px; }
    .form-group input:focus, .form-group textarea:focus { border-color: var(--border-focus); }

    .panel-actions { display: flex; gap: 10px; margin-top: 8px; }
    .btn-save {
      flex: 1; padding: 10px; background: var(--primary); color: #fff;
      border: none; border-radius: var(--radius-sm); font-size: 14px;
      font-weight: 500; cursor: pointer; transition: var(--transition);
    }
    .btn-save:hover { background: var(--primary-dark); }
    .btn-cancel {
      padding: 10px 16px; background: var(--surface-3); color: var(--text-2);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      font-size: 14px; cursor: pointer; transition: var(--transition);
    }
    .btn-cancel:hover { background: var(--surface-hover); }

    .save-status { margin-top: 10px; font-size: 13px; text-align: center; min-height: 20px; }
    .save-status.ok  { color: var(--success); }
    .save-status.err { color: var(--danger); }

    /* ── Modal confirmación eliminar ── */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.6);
      z-index: 200; display: none; align-items: center; justify-content: center;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: var(--surface-2); border: 1px solid var(--border-2);
      border-radius: var(--radius-lg); padding: 28px; max-width: 360px; width: 90%;
    }
    .modal-box h3 { font-size: 16px; margin-bottom: 8px; }
    .modal-box p  { font-size: 13px; color: var(--text-2); margin-bottom: 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

    /* ── Estado de carga ── */
    .loading-msg { text-align: center; padding: 60px; color: var(--text-3); font-size: 15px; }
    .empty-dept  { color: var(--text-3); font-size: 12px; padding: 8px 14px; }

    /* ── Contador ── */
    .badge {
      background: var(--surface-3); color: var(--text-3); font-size: 11px;
      padding: 2px 7px; border-radius: 99px; font-weight: 500;
    }
  </style>
</head>
<body>

  <!-- Panel overlay -->
  <div class="panel-overlay" id="panel-overlay"></div>

  <!-- Panel lateral -->
  <aside class="side-panel" id="side-panel">
    <div class="panel-title" id="panel-title">Editar farmacia</div>
    <div class="form-group">
      <label>Nombre de la farmacia</label>
      <input type="text" id="f-nombre" placeholder="MI FARMACIA CALI NORTE">
    </div>
    <div class="form-group">
      <label>Dirección</label>
      <input type="text" id="f-direccion" placeholder="CL 4 # 24C-22 B/SAN FERNANDO">
    </div>
    <div class="form-group">
      <label>Correo</label>
      <input type="email" id="f-correo" placeholder="farmacia@ejemplo.com">
    </div>
    <div class="form-group">
      <label>Horario de atención</label>
      <textarea id="f-horario" placeholder="LUNES A VIERNES 7:00 AM - 5:00 PM"></textarea>
    </div>
    <div class="form-group">
      <label>Teléfono</label>
      <input type="text" id="f-telefono" placeholder="3001234567">
    </div>
    <div class="form-group">
      <label>Link Google Maps</label>
      <input type="url" id="f-maps" placeholder="https://maps.app.goo.gl/...">
    </div>
    <div class="panel-actions">
      <button class="btn-cancel" id="btn-panel-cancel">Cancelar</button>
      <button class="btn-save"   id="btn-panel-save">💾 Guardar</button>
    </div>
    <div class="save-status" id="save-status"></div>
  </aside>

  <!-- Modal eliminar -->
  <div class="modal-overlay" id="modal-delete">
    <div class="modal-box">
      <h3>¿Eliminar farmacia?</h3>
      <p id="modal-delete-name"></p>
      <div class="modal-actions">
        <button class="btn-cancel" id="modal-cancel">Cancelar</button>
        <button class="btn-save" style="background:var(--danger);flex:unset;padding:10px 20px;" id="modal-confirm">Eliminar</button>
      </div>
    </div>
  </div>

  <!-- Contenido principal -->
  <main class="content">
    <div class="page-header">
      <a href="/">← Panel IT</a>
      <h1 class="page-title">📍 Directorio Farmacias FOMAG</h1>
    </div>

    <div class="search-wrap">
      <i data-lucide="search" class="icon-search" style="width:16px;height:16px;"></i>
      <input type="text" id="search-input" placeholder="Buscar municipio o farmacia...">
    </div>

    <div id="accordion-root">
      <div class="loading-msg">Cargando directorio...</div>
    </div>
  </main>

  <script src="js/farmacias.js"></script>
</body>
</html>
```

- [ ] **Step 2: Agregar link en el sidebar de index.html**

Abrir `public/index.html`. Buscar el último `<a href="#settings"...>` en el sidebar nav y agregar ANTES de él:

```html
      <a href="/farmacias.html" class="menu-item" target="_self">
        <span class="menu-icon"><i data-lucide="map-pin" class="lucide"></i></span>
        <span class="menu-label">Farmacias FOMAG</span>
      </a>
```

- [ ] **Step 3: Verificar que la página carga**

Con el servidor corriendo, abrir `http://localhost:3000/farmacias.html` en el navegador. Debe mostrar "Cargando directorio..." (porque `farmacias.js` aún no existe).

- [ ] **Step 4: Commit**

```bash
git add public/farmacias.html public/index.html
git commit -m "feat: farmacias.html página admin y link en sidebar"
```

---

## Task 8: farmacias.js — carga, acordeón y búsqueda

**Files:**
- Create: `public/js/farmacias.js`

- [ ] **Step 1: Crear farmacias.js con carga de datos y renderizado**

Crear `public/js/farmacias.js`:

```js
/* ─────────────────────────────────────────────
   Estado global de la página
───────────────────────────────────────────── */
let _data    = [];   // array de departamentos (mismo formato que GET /api/farmacias)
let _panelCtx = null; // { mode:'edit'|'add', sheetRow, municipioNombre, index|null }

/* ─────────────────────────────────────────────
   Inicialización
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadData();
  document.getElementById('search-input').addEventListener('input', onSearch);
  wirePanel();
  wireDeleteModal();
});

async function loadData() {
  const root = document.getElementById('accordion-root');
  root.innerHTML = '<div class="loading-msg">Cargando directorio...</div>';
  try {
    const res  = await fetch('/api/farmacias');
    if (!res.ok) throw new Error(res.statusText);
    _data = await res.json();
    renderAll(_data);
  } catch (err) {
    root.innerHTML = `<div class="loading-msg" style="color:var(--danger)">Error cargando datos: ${err.message}</div>`;
  }
}

/* ─────────────────────────────────────────────
   Renderizado
───────────────────────────────────────────── */
function renderAll(data) {
  const root = document.getElementById('accordion-root');
  if (!data.length) {
    root.innerHTML = '<div class="loading-msg">Sin datos en el directorio.</div>';
    return;
  }
  root.innerHTML = data.map(renderDept).join('');
  lucide.createIcons();
  bindAccordions();
  bindFarmaciaActions();
}

function renderDept(dept) {
  const totalFarmacias = dept.municipios.reduce((s, m) => s + m.farmacias.length, 0);
  return `
  <div class="dept-block" data-dept="${esc(dept.nombre)}">
    <div class="dept-header">
      <i data-lucide="map" style="width:15px;height:15px;color:var(--primary)"></i>
      ${esc(dept.nombre)}
      <span class="badge">${dept.municipios.length} municipios · ${totalFarmacias} farmacias</span>
      <i data-lucide="chevron-down" class="chevron" style="width:16px;height:16px;"></i>
    </div>
    <div class="muni-list">
      ${dept.municipios.map(m => renderMuni(m)).join('') || '<div class="empty-dept">Sin municipios</div>'}
    </div>
  </div>`;
}

function renderMuni(muni) {
  return `
  <div class="muni-block" data-row="${muni.sheetRow}">
    <div class="muni-header">
      <i data-lucide="map-pin" style="width:14px;height:14px;color:var(--text-3)"></i>
      ${esc(muni.nombre)}
      <span class="badge">${muni.farmacias.length}</span>
      <i data-lucide="chevron-down" class="chevron" style="width:14px;height:14px;"></i>
    </div>
    <div class="farmacia-list">
      ${muni.farmacias.map(f => renderFarmacia(muni, f)).join('')}
      <button class="btn-add-farmacia"
        data-action="add" data-row="${muni.sheetRow}" data-muni="${esc(muni.nombre)}">
        <i data-lucide="plus" style="width:13px;height:13px;"></i> Agregar farmacia
      </button>
    </div>
  </div>`;
}

function renderFarmacia(muni, f) {
  return `
  <div class="farmacia-row"
    data-row="${muni.sheetRow}" data-idx="${f.index}" data-muni="${esc(muni.nombre)}">
    <i data-lucide="store" style="width:14px;height:14px;color:var(--primary);flex-shrink:0"></i>
    <span class="name">${esc(f.nombre)}</span>
    <span class="dir">${esc(f.direccion)}</span>
    <button class="btn-icon btn-edit"   title="Editar"
      data-action="edit" data-row="${muni.sheetRow}" data-idx="${f.index}" data-muni="${esc(muni.nombre)}">
      <i data-lucide="pencil" style="width:13px;height:13px;"></i>
    </button>
    <button class="btn-icon btn-delete" title="Eliminar"
      data-action="delete" data-row="${muni.sheetRow}" data-idx="${f.index}"
      data-muni="${esc(muni.nombre)}" data-fname="${esc(f.nombre)}">
      <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
    </button>
  </div>`;
}

/* ─────────────────────────────────────────────
   Acordeón
───────────────────────────────────────────── */
function bindAccordions() {
  document.querySelectorAll('.dept-header').forEach(h => {
    h.addEventListener('click', () => {
      h.classList.toggle('open');
      h.nextElementSibling.classList.toggle('open');
    });
  });
  document.querySelectorAll('.muni-header').forEach(h => {
    h.addEventListener('click', () => {
      h.classList.toggle('open');
      h.nextElementSibling.classList.toggle('open');
    });
  });
}

/* ─────────────────────────────────────────────
   Búsqueda
───────────────────────────────────────────── */
function onSearch(e) {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { renderAll(_data); return; }

  const filtered = _data.map(dept => ({
    ...dept,
    municipios: dept.municipios
      .map(m => ({
        ...m,
        farmacias: m.farmacias.filter(f =>
          f.nombre.toLowerCase().includes(q) || f.direccion.toLowerCase().includes(q)
        ),
      }))
      .filter(m =>
        m.nombre.toLowerCase().includes(q) || m.farmacias.length > 0
      ),
  })).filter(d => d.municipios.length > 0);

  renderAll(filtered);

  // Auto-expandir resultados de búsqueda
  document.querySelectorAll('.dept-header, .muni-header').forEach(h => {
    h.classList.add('open');
    h.nextElementSibling.classList.add('open');
  });
}

/* ─────────────────────────────────────────────
   Utilidades
───────────────────────────────────────────── */
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getFarmacia(sheetRow, index) {
  for (const dept of _data) {
    for (const muni of dept.municipios) {
      if (muni.sheetRow === sheetRow) return muni.farmacias[index] || null;
    }
  }
  return null;
}
```

- [ ] **Step 2: Recargar la página y verificar que el acordeón funciona**

Con el servidor corriendo, abrir `http://localhost:3000/farmacias.html`. Debe mostrar la lista de departamentos. Al hacer clic en un departamento, se expande para mostrar los municipios. Al hacer clic en un municipio, se expanden las farmacias. La búsqueda debe filtrar en tiempo real.

- [ ] **Step 3: Commit**

```bash
git add public/js/farmacias.js
git commit -m "feat: farmacias.js renderizado acordeón y búsqueda"
```

---

## Task 9: farmacias.js — panel lateral (editar / agregar / eliminar)

**Files:**
- Modify: `public/js/farmacias.js`

- [ ] **Step 1: Agregar wirePanel(), wireDeleteModal() y bindFarmaciaActions()**

Abrir `public/js/farmacias.js` y agregar al final del archivo:

```js
/* ─────────────────────────────────────────────
   Acciones de farmacias (edit / add / delete)
───────────────────────────────────────────── */
function bindFarmaciaActions() {
  document.getElementById('accordion-root').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action   = btn.dataset.action;
    const sheetRow = parseInt(btn.dataset.row);
    const muniNombre = btn.dataset.muni;

    if (action === 'edit') {
      const idx = parseInt(btn.dataset.idx);
      const f   = getFarmacia(sheetRow, idx);
      if (!f) return;
      openPanel('edit', sheetRow, muniNombre, idx, f);
    }

    if (action === 'add') {
      openPanel('add', sheetRow, muniNombre, null, {});
    }

    if (action === 'delete') {
      const idx   = parseInt(btn.dataset.idx);
      const fname = btn.dataset.fname;
      openDeleteModal(sheetRow, muniNombre, idx, fname);
    }
  });
}

/* ─────────────────────────────────────────────
   Panel lateral
───────────────────────────────────────────── */
function wirePanel() {
  document.getElementById('panel-overlay').addEventListener('click', closePanel);
  document.getElementById('btn-panel-cancel').addEventListener('click', closePanel);
  document.getElementById('btn-panel-save').addEventListener('click', onPanelSave);
}

function openPanel(mode, sheetRow, municipioNombre, index, farmacia) {
  _panelCtx = { mode, sheetRow, municipioNombre, index };

  document.getElementById('panel-title').textContent =
    mode === 'edit' ? `Editar: ${farmacia.nombre || ''}` : 'Agregar farmacia';

  document.getElementById('f-nombre').value    = farmacia.nombre    || '';
  document.getElementById('f-direccion').value = farmacia.direccion || '';
  document.getElementById('f-correo').value    = farmacia.correo    || '';
  document.getElementById('f-horario').value   = farmacia.horario   || '';
  document.getElementById('f-telefono').value  = farmacia.telefono  || '';
  document.getElementById('f-maps').value      = farmacia.mapsUrl   || '';
  document.getElementById('save-status').textContent = '';
  document.getElementById('save-status').className   = 'save-status';

  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('side-panel').classList.add('open');
  document.getElementById('f-nombre').focus();
}

function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('side-panel').classList.remove('open');
  _panelCtx = null;
}

async function onPanelSave() {
  if (!_panelCtx) return;

  const payload = {
    sheetRow:        _panelCtx.sheetRow,
    municipioNombre: _panelCtx.municipioNombre,
    nombre:    document.getElementById('f-nombre').value.trim(),
    direccion: document.getElementById('f-direccion').value.trim(),
    correo:    document.getElementById('f-correo').value.trim(),
    horario:   document.getElementById('f-horario').value.trim(),
    telefono:  document.getElementById('f-telefono').value.trim(),
    mapsUrl:   document.getElementById('f-maps').value.trim(),
  };

  if (!payload.nombre) {
    setStatus('El nombre es obligatorio.', 'err');
    return;
  }

  const saveBtn = document.getElementById('btn-panel-save');
  saveBtn.disabled = true;
  setStatus('Guardando...', '');

  try {
    let method = 'POST';
    if (_panelCtx.mode === 'edit') {
      method = 'PUT';
      payload.index = _panelCtx.index;
    }

    const res = await fetch('/api/farmacias/punto', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || res.statusText);
    }

    setStatus('✅ Guardado en Google Sheets', 'ok');
    setTimeout(async () => {
      closePanel();
      await loadData();
    }, 1200);

  } catch (err) {
    setStatus(`❌ Error: ${err.message}`, 'err');
  } finally {
    saveBtn.disabled = false;
  }
}

function setStatus(msg, cls) {
  const el = document.getElementById('save-status');
  el.textContent  = msg;
  el.className    = `save-status ${cls}`;
}

/* ─────────────────────────────────────────────
   Modal de confirmación para eliminar
───────────────────────────────────────────── */
let _deleteCtx = null;

function wireDeleteModal() {
  document.getElementById('modal-cancel').addEventListener('click',  closeDeleteModal);
  document.getElementById('modal-confirm').addEventListener('click', onDeleteConfirm);
}

function openDeleteModal(sheetRow, municipioNombre, index, nombre) {
  _deleteCtx = { sheetRow, municipioNombre, index };
  document.getElementById('modal-delete-name').textContent =
    `¿Eliminar "${nombre}" de ${municipioNombre}? Esta acción actualizará el Google Sheet.`;
  document.getElementById('modal-delete').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('modal-delete').classList.remove('open');
  _deleteCtx = null;
}

async function onDeleteConfirm() {
  if (!_deleteCtx) return;

  const btn = document.getElementById('modal-confirm');
  btn.disabled = true;
  btn.textContent = 'Eliminando...';

  try {
    const res = await fetch('/api/farmacias/punto', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_deleteCtx),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || res.statusText);
    }

    closeDeleteModal();
    await loadData();

  } catch (err) {
    alert(`Error al eliminar: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Eliminar';
  }
}
```

- [ ] **Step 2: Probar el flujo completo en el navegador**

Con el servidor corriendo, abrir `http://localhost:3000/farmacias.html`:

1. Expandir un departamento → expandir un municipio → ver las farmacias
2. Hacer clic en ✏️ → panel lateral se abre con los datos pre-llenados
3. Cambiar un campo (ej: teléfono) → clic en "💾 Guardar"
4. Esperar mensaje "✅ Guardado en Google Sheets"
5. Verificar en el Google Sheet que la celda cambió
6. Probar ➕ Agregar farmacia → llenar campos → guardar
7. Probar 🗑️ Eliminar → confirmar → verificar en Sheet
8. Probar búsqueda → escribir "Cali" → solo aparece el municipio Cali

- [ ] **Step 3: Commit final**

```bash
git add public/js/farmacias.js
git commit -m "feat: farmacias.js panel lateral editar agregar eliminar"
```

---

## Checklist de verificación final

- [ ] `GET /api/farmacias` devuelve JSON con departamentos, municipios y farmacias parseadas
- [ ] Editar una farmacia actualiza la celda correcta en Google Sheets
- [ ] Agregar una farmacia la añade al final del bloque del municipio en el Sheet
- [ ] Eliminar una farmacia la quita del bloque del municipio en el Sheet
- [ ] La búsqueda filtra correctamente por municipio y nombre de farmacia
- [ ] El panel lateral cierra al cancelar o al guardar exitosamente
- [ ] El modal de confirmación aparece antes de eliminar
- [ ] En caso de error de red o API, el usuario ve un mensaje claro (no una pantalla rota)
- [ ] `credentials/google-service-account.json` está en `.gitignore` y NO se commitea
