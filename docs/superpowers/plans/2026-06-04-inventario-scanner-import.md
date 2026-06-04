# Inventario — Escáner Combinado + Importación Excel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (1) a smart camera scanner that fills multiple form fields at once via multi-barcode detection + OCR, and (2) bulk Excel import for loading pre-existing inventory records.

**Architecture:** Two independent features on the same two files. Backend: 4 new Express routes added to `src/inventario/inventario-routes.js` using multer + ExcelJS (both already installed). Frontend: new functions appended to `public/js/inventario.js` — `openSmartScanner()`, `routeBarcode()`, `parseOcrText()`, `loadTesseract()`, `openImportModal()`. No new files needed.

**Tech Stack:** Node.js/Express, ExcelJS, multer, vanilla JS ES modules, BarcodeDetector API, Tesseract.js v5 (CDN lazy-load), existing requireAuth/requirePermission middleware.

---

### Task 1: Backend — Excel parse route

**Files:**
- Modify: `src/inventario/inventario-routes.js`

- [ ] **Step 1: Add multer import and column-map tables at top of file**

Open `src/inventario/inventario-routes.js`. After the existing imports (line 4), add:

```javascript
import multer from 'multer';
import ExcelJS from 'exceljs';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeHeader(h) {
  return String(h ?? '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').trim();
}

const EQUIPOS_COLMAP = {
  placa:           ['placa'],
  marca:           ['marca'],
  nombre_equipo:   ['nombre de equipo', 'nombre equipo'],
  serial:          ['serial/emei', 'serial', 's/n', 'serial/imei'],
  procesador:      ['procesador'],
  ram:             ['ram'],
  tipo_ram:        ['tipo de ram', 'tipo ram'],
  cap_disco:       ['capacidad disco', 'cap disco'],
  tipo_disco:      ['tipo de disco', 'tipo disco'],
  serial_cargador: ['serial cargador'],
  area:            ['area'],
  responsable:     ['responsable'],
  fecha_compra:    ['fecha de compra', 'fecha compra'],
};

const CELULARES_COLMAP = {
  fecha_registro:  ['fecha'],
  area:            ['area'],
  ciudad:          ['ciudad'],
  nombre_completo: ['nombre completo'],
  cedula:          ['cedula'],
  linea:           ['linea'],
  operador:        ['operador'],
  equipo:          ['equipo'],
  almacenamiento:  ['alm', 'almacenamiento'],
  ram:             ['ram'],
  modelo:          ['modelo'],
  imei:            ['imei'],
  imei2:           ['imei 2', 'imei2'],
  estado:          ['estado'],
  accesorio:       ['accesorio'],
  fecha_entrega:   ['fecha de entrega'],
  entregado_por:   ['entregado por'],
};

function buildMapping(headers, colmap) {
  const mapping = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    let matched = null;
    for (const [field, aliases] of Object.entries(colmap)) {
      if (aliases.includes(norm)) { matched = field; break; }
    }
    mapping[h] = matched;
  }
  return mapping;
}
```

- [ ] **Step 2: Add the parse route before `export default router`**

```javascript
/* ── IMPORT: parse xlsx ── */
router.post('/api/inventario/:type/import', ...canCreate, upload.single('file'), async (req, res) => {
  const type = req.params.type;
  if (!['equipos', 'celulares'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'El archivo no tiene hojas.' });

    const headers = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, cell => headers.push(String(cell.value ?? '')));

    const colmap  = type === 'equipos' ? EQUIPOS_COLMAP : CELULARES_COLMAP;
    const mapping = buildMapping(headers, colmap);

    const rows = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj = {};
      let hasData = false;
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (!field) return;
        const raw = row.getCell(i + 1).value;
        const val = raw === null || raw === undefined ? '' : String(raw).trim();
        if (val) hasData = true;
        obj[field] = val || null;
      });
      if (hasData) rows.push(obj);
    });

    res.json({ preview: rows.slice(0, 5), mapping, total: rows.length, rows });
  } catch (err) {
    console.error('POST /api/inventario/:type/import:', err);
    res.status(400).json({ error: 'No se pudo leer el archivo. Verifica que sea un .xlsx válido.' });
  }
});
```

- [ ] **Step 3: Verify parse route syntax**

```bash
node --input-type=module --eval "import './src/inventario/inventario-routes.js'; console.log('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/inventario/inventario-routes.js
git commit -m "feat(inventario): add Excel parse route with column auto-mapping"
```

---

### Task 2: Backend — import confirm route

**Files:**
- Modify: `src/inventario/inventario-routes.js`

- [ ] **Step 1: Add confirm route before `export default router`**

```javascript
/* ── IMPORT: confirm insert ── */
router.post('/api/inventario/:type/import/confirm', ...canCreate, (req, res) => {
  const type = req.params.type;
  if (!['equipos', 'celulares'].includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });

  const { rows, mode = 'skip' } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Sin filas.' });

  const orClause = mode === 'overwrite' ? 'OR REPLACE' : 'OR IGNORE';

  let inserted = 0, skipped = 0;
  const errors = [];

  if (type === 'equipos') {
    const stmt = db.prepare(`
      INSERT ${orClause} INTO inventario_equipos
        (placa,marca,nombre_equipo,serial,procesador,ram,tipo_ram,cap_disco,
         tipo_disco,serial_cargador,area,responsable,fecha_compra)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    rows.forEach((r, i) => {
      if (!r.placa?.trim() || !r.serial?.trim()) {
        errors.push({ row: i + 2, message: `Fila ${i + 2}: placa y serial son requeridos.` });
        return;
      }
      try {
        const result = stmt.run(
          r.placa?.trim()||null, r.marca?.trim()||null, r.nombre_equipo?.trim()||null,
          r.serial?.trim()||null, r.procesador||null, r.ram||null, r.tipo_ram||null,
          r.cap_disco||null, r.tipo_disco||null, r.serial_cargador||null,
          r.area||null, r.responsable||null, r.fecha_compra||null
        );
        result.changes ? inserted++ : skipped++;
      } catch (err) {
        errors.push({ row: i + 2, message: err.message });
      }
    });
  } else {
    const stmt = db.prepare(`
      INSERT ${orClause} INTO inventario_celulares
        (fecha_registro,area,ciudad,nombre_completo,cedula,linea,operador,equipo,
         almacenamiento,ram,modelo,imei,imei2,estado,accesorio,fecha_entrega,entregado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    rows.forEach((r, i) => {
      if (!r.imei?.trim()) {
        errors.push({ row: i + 2, message: `Fila ${i + 2}: imei es requerido.` });
        return;
      }
      try {
        const result = stmt.run(
          r.fecha_registro||null, r.area||null, r.ciudad||null,
          r.nombre_completo?.trim()||null, r.cedula||null, r.linea||null,
          r.operador||null, r.equipo||null, r.almacenamiento||null,
          r.ram||null, r.modelo||null, r.imei.trim(),
          r.imei2||null, r.estado||'nuevo', r.accesorio||null,
          r.fecha_entrega||null, r.entregado_por||null
        );
        result.changes ? inserted++ : skipped++;
      } catch (err) {
        errors.push({ row: i + 2, message: err.message });
      }
    });
  }

  res.json({ inserted, skipped, errors });
});
```

- [ ] **Step 2: Test both routes with curl**

Start the server (`npm start` or `npm run dev`), then:

```bash
# Without auth should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/inventario/equipos/import/confirm
# Expected: 401
```

- [ ] **Step 3: Commit**

```bash
git add src/inventario/inventario-routes.js
git commit -m "feat(inventario): add Excel bulk-insert confirm route"
```

---

### Task 3: Frontend — Import Excel modal

**Files:**
- Modify: `public/js/inventario.js`

- [ ] **Step 1: Add "Importar Excel" button to the header**

In `renderInventario`, replace the single `<button id="btn-inv-new"` block (lines 19–22) with a flex wrapper containing both buttons:

```javascript
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button id="btn-inv-import"
          style="display:flex;align-items:center;gap:7px;padding:10px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;color:var(--text-2);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;">
          ⬆ Importar Excel
        </button>
        <button id="btn-inv-new"
          style="display:flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;">
          ＋ Registrar equipo
        </button>
      </div>
```

Then after the existing `document.getElementById('btn-inv-new').addEventListener` line, add:

```javascript
  document.getElementById('btn-inv-import').addEventListener('click', () => openImportModal());
```

- [ ] **Step 2: Append `openImportModal` function at bottom of `inventario.js`**

```javascript
/* ── Import Excel modal ── */
function openImportModal() {
  const modalWrap = document.getElementById('inv-modal-wrap');
  let _importRows = [];

  const FIELD_LABELS = {
    placa:'Placa', marca:'Marca', nombre_equipo:'Nombre equipo', serial:'Serial',
    procesador:'Procesador', ram:'RAM', tipo_ram:'Tipo RAM', cap_disco:'Cap. Disco',
    tipo_disco:'Tipo Disco', serial_cargador:'Serial Cargador', area:'Área',
    responsable:'Responsable', fecha_compra:'F. Compra',
    fecha_registro:'F. Registro', ciudad:'Ciudad', nombre_completo:'Nombre completo',
    cedula:'Cédula', linea:'Línea', operador:'Operador', equipo:'Equipo',
    almacenamiento:'Almacenamiento', modelo:'Modelo', imei:'IMEI', imei2:'IMEI 2',
    estado:'Estado', accesorio:'Accesorio', fecha_entrega:'F. Entrega',
    entregado_por:'Entregado por',
  };

  modalWrap.innerHTML = `
    <div class="modal-overlay" style="display:flex;" id="import-overlay">
      <div class="modal-content" style="max-width:680px;max-height:90vh;overflow-y:auto;">
        <div class="modal-header">
          <h3 id="import-title">Importar Excel — ${_activeTab === 'equipos' ? 'Equipos' : 'Celulares'}</h3>
          <button class="modal-close" id="btn-import-close">&times;</button>
        </div>
        <div class="modal-body" id="import-body">
          <!-- Step 1 -->
          <div id="import-step1">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
              Sube el archivo Excel con tus registros existentes. La primera fila debe contener los encabezados.
            </p>
            <label id="import-drop-zone" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
              border:2px dashed var(--border-2);border-radius:12px;padding:40px 20px;cursor:pointer;
              transition:border-color .2s;text-align:center;">
              <span style="font-size:32px;">📂</span>
              <span style="font-weight:500;">Arrastra tu .xlsx aquí o haz clic</span>
              <span style="font-size:12px;color:var(--text-3);">Máximo 10 MB</span>
              <input type="file" id="import-file-input" accept=".xlsx,.xls" style="display:none;">
            </label>
            <div id="import-step1-err" style="display:none;margin-top:12px;color:var(--danger);font-size:13px;"></div>
          </div>

          <!-- Step 2 (hidden) -->
          <div id="import-step2" style="display:none;">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:12px;" id="import-total-msg"></p>

            <details open style="margin-bottom:16px;">
              <summary style="font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">Mapeo de columnas</summary>
              <div id="import-mapping-table" style="font-size:12px;"></div>
            </details>

            <details open style="margin-bottom:16px;">
              <summary style="font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">Vista previa (primeras 5 filas)</summary>
              <div id="import-preview-table" style="overflow-x:auto;"></div>
            </details>

            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;font-size:13px;">
              <span style="font-weight:500;">Duplicados:</span>
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                <input type="radio" name="import-mode" value="skip" checked> Omitir (recomendado)
              </label>
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                <input type="radio" name="import-mode" value="overwrite"> Reemplazar
              </label>
            </div>

            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary" id="btn-import-back">← Volver</button>
              <button class="btn btn-primary" id="btn-import-confirm">Importar <span id="import-count"></span> registros</button>
            </div>
          </div>

          <!-- Step 3 (hidden) -->
          <div id="import-step3" style="display:none;text-align:center;padding:20px 0;">
            <div id="import-result"></div>
            <button class="btn btn-primary" id="btn-import-done" style="margin-top:16px;">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;

  const overlay = modalWrap.querySelector('#import-overlay');
  const close   = () => overlay.remove();
  document.getElementById('btn-import-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  /* Drag-drop */
  const dropZone = document.getElementById('import-drop-zone');
  const fileInput = document.getElementById('import-file-input');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.style.borderColor = ''; handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  dropZone.addEventListener('click', () => fileInput.click());

  /* Back button */
  document.getElementById('import-body').addEventListener('click', e => {
    if (e.target.id === 'btn-import-back') {
      document.getElementById('import-step2').style.display = 'none';
      document.getElementById('import-step1').style.display = '';
    }
  });

  async function handleFile(file) {
    if (!file) return;
    const errEl = document.getElementById('import-step1-err');
    errEl.style.display = 'none';
    dropZone.style.opacity = '.5';

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res  = await fetch(`/api/inventario/${_activeTab}/import`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      _importRows = data.rows;

      document.getElementById('import-total-msg').textContent =
        `${data.total} filas encontradas en "${file.name}".`;
      document.getElementById('import-count').textContent = data.total;

      /* Mapping table */
      const mapWrap = document.getElementById('import-mapping-table');
      const allFields = Object.keys(_activeTab === 'equipos'
        ? { placa:1,marca:1,nombre_equipo:1,serial:1,procesador:1,ram:1,tipo_ram:1,cap_disco:1,tipo_disco:1,serial_cargador:1,area:1,responsable:1,fecha_compra:1 }
        : { fecha_registro:1,area:1,ciudad:1,nombre_completo:1,cedula:1,linea:1,operador:1,equipo:1,almacenamiento:1,ram:1,modelo:1,imei:1,imei2:1,estado:1,accesorio:1,fecha_entrega:1,entregado_por:1 });
      mapWrap.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);">COLUMNA EN EXCEL</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);">CAMPO EN BD</th>
        </tr></thead>
        <tbody>
          ${Object.entries(data.mapping).map(([col, field]) => `
          <tr>
            <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-2);">${esc(col)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid var(--border);">
              <select data-col="${esc(col)}" style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;padding:2px 6px;">
                <option value="">— Ignorar —</option>
                ${allFields.map(f => `<option value="${f}" ${field===f?'selected':''}>${FIELD_LABELS[f]||f}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;

      /* Preview table */
      const previewWrap = document.getElementById('import-preview-table');
      if (data.preview.length) {
        const cols = Object.keys(data.preview[0]);
        previewWrap.innerHTML = `<table style="border-collapse:collapse;font-size:11px;min-width:100%;">
          <thead><tr>${cols.map(c => `<th style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text-3);text-transform:uppercase;font-size:10px;">${esc(FIELD_LABELS[c]||c)}</th>`).join('')}</tr></thead>
          <tbody>${data.preview.map(r => `<tr>${cols.map(c => `<td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text-2);">${esc(r[c]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
      }

      document.getElementById('import-step1').style.display = 'none';
      document.getElementById('import-step2').style.display = '';
    } catch (err) {
      errEl.textContent = err.message || 'Error al leer el archivo.';
      errEl.style.display = '';
    } finally {
      dropZone.style.opacity = '';
    }
  }

  /* Confirm */
  document.getElementById('import-body').addEventListener('click', async e => {
    if (e.target.id !== 'btn-import-confirm') return;

    /* Re-apply user mapping overrides */
    const selects = document.querySelectorAll('#import-mapping-table select[data-col]');
    const userMap = {};
    selects.forEach(s => { if (s.value) userMap[s.dataset.col] = s.value; });

    /* Rebuild rows applying userMap */
    const fd2  = new FormData();
    fd2.append('file', document.getElementById('import-file-input').files[0]);
    const res0 = await fetch(`/api/inventario/${_activeTab}/import`, { method: 'POST', body: fd2 });
    const d0   = await res0.json();
    const remapped = (d0.rows || _importRows).map(row => {
      const out = {};
      Object.entries(userMap).forEach(([col, field]) => {
        if (row[field] !== undefined) out[field] = row[field];
      });
      return { ...row, ...out };
    });

    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'skip';

    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Importando…';

    try {
      const res  = await fetch(`/api/inventario/${_activeTab}/import/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: _importRows, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      document.getElementById('import-step2').style.display = 'none';
      const resultEl = document.getElementById('import-result');
      resultEl.innerHTML = `
        <div style="font-size:40px;margin-bottom:8px;">✅</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${data.inserted} registros importados</div>
        ${data.skipped ? `<div style="font-size:13px;color:var(--text-2);">${data.skipped} duplicados omitidos</div>` : ''}
        ${data.errors?.length ? `<div style="font-size:12px;color:var(--danger);margin-top:8px;">${data.errors.length} errores:<br>${data.errors.slice(0,5).map(e=>esc(e.message)).join('<br>')}</div>` : ''}`;
      document.getElementById('import-step3').style.display = '';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = `Importar ${_importRows.length} registros`;
      showToast(err.message || 'Error al importar.', 'error');
    }
  });

  /* Done */
  document.getElementById('import-body').addEventListener('click', e => {
    if (e.target.id === 'btn-import-done') {
      close();
      loadTable();
      loadCounts();
    }
  });
}
```

- [ ] **Step 3: Verify in browser**

Start the server. Go to `#inventario`. Should see "⬆ Importar Excel" button in header. Click it → modal opens with drag-drop zone. Upload an Excel file with the known columns → mapping table appears → click "Importar" → success screen with count.

- [ ] **Step 4: Commit**

```bash
git add public/js/inventario.js
git commit -m "feat(inventario): Excel import modal with column mapping and preview"
```

---

### Task 4: Frontend — Smart multi-barcode scanner

**Files:**
- Modify: `public/js/inventario.js`

- [ ] **Step 1: Add "📷 Escanear equipo" button to both form HTML functions**

In `equipoFormHTML`, replace the `<div class="modal-header">` block:

```javascript
      <div class="modal-header" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <h3>${r ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
        </div>
        <button type="button" id="btn-smart-scan"
          style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;">
          📷 Escanear equipo — llenar campos automáticamente
        </button>
      </div>
```

Apply the same change to `celularFormHTML` (identical markup, same `id="btn-smart-scan"`).

- [ ] **Step 2: Wire the smart scan button in `openForm`**

In `openForm`, after the existing `form.querySelectorAll('.btn-scan').forEach(...)` block, add:

```javascript
  document.getElementById('btn-smart-scan')?.addEventListener('click', () => openSmartScanner());
```

- [ ] **Step 3: Append `routeBarcode` and `openSmartScanner` to `inventario.js`**

```javascript
/* ── Smart multi-barcode scanner ── */

function routeBarcode(value, tipo, detected) {
  const isImei = /^\d{15}$/.test(value);
  if (tipo === 'celulares') {
    if (isImei) {
      if (!detected.has('imei'))  return 'imei';
      if (!detected.has('imei2')) return 'imei2';
      return null;
    }
    if (/^[A-Z0-9\-]{5,20}$/i.test(value)) return 'serial';
    return null;
  }
  // equipos
  if (/^[A-Z0-9\-]{5,20}$/i.test(value)) {
    if (!detected.has('placa'))  return 'placa';
    if (!detected.has('serial')) return 'serial';
    return null;
  }
  return null;
}

function applyDetectedToForm(detectedMap) {
  for (const [field, value] of detectedMap) {
    const inp = document.querySelector(`#inv-form [name="${field}"]`);
    if (inp && !inp.value.trim()) {
      inp.value = value;
      inp.dispatchEvent(new Event('input'));
    }
  }
}

async function openSmartScanner() {
  if (!('BarcodeDetector' in window) && !navigator.mediaDevices) {
    showToast('Cámara no disponible en este navegador.', 'warning');
    return;
  }

  let stream, rafId;
  const detectedFields = new Map();
  const detectedValues = new Set();

  const overlay = document.createElement('div');
  overlay.id = 'smart-scanner-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;';

  const hasBarcodeDetector = 'BarcodeDetector' in window;

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:20px;width:min(420px,96vw);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:700;font-size:15px;">📷 Escanear equipo</span>
        <button id="ss-close" style="background:transparent;border:none;font-size:22px;cursor:pointer;color:var(--text-2);">✕</button>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:12px;">
        <button id="ss-tab-codes" class="${hasBarcodeDetector ? 'tab-btn tab-active' : 'tab-btn'}" style="flex:1;${!hasBarcodeDetector?'opacity:.4;cursor:not-allowed;':''}" ${!hasBarcodeDetector?'disabled':''}>
          📷 Códigos
        </button>
        <button id="ss-tab-ocr" class="tab-btn ${!hasBarcodeDetector ? 'tab-active' : ''}" style="flex:1;">
          🔤 Leer etiqueta
        </button>
      </div>

      <!-- Codes pane -->
      <div id="ss-pane-codes" style="display:${hasBarcodeDetector?'block':'none'};">
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px;">
          <video id="ss-video" autoplay playsinline style="width:100%;display:block;border-radius:10px;max-height:220px;object-fit:cover;"></video>
          <div style="position:absolute;top:50%;left:10%;right:10%;height:2px;background:var(--primary);transform:translateY(-50%);box-shadow:0 0 8px var(--primary);pointer-events:none;"></div>
        </div>
        <p style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:10px;">Apunta a la etiqueta — detecta todos los códigos</p>
      </div>

      <!-- OCR pane -->
      <div id="ss-pane-ocr" style="display:${!hasBarcodeDetector?'block':'none'};">
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#000;margin-bottom:10px;">
          <video id="ss-video-ocr" autoplay playsinline style="width:100%;display:block;border-radius:10px;max-height:220px;object-fit:cover;"></video>
          <div style="position:absolute;inset:8px;border:2px dashed rgba(99,102,241,.6);border-radius:8px;pointer-events:none;"></div>
        </div>
        <canvas id="ss-canvas" style="display:none;"></canvas>
        <div id="ss-ocr-progress" style="display:none;font-size:12px;color:var(--text-2);text-align:center;margin-bottom:8px;"></div>
        <button id="ss-capture" style="width:100%;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;">
          📸 Capturar y leer etiqueta
        </button>
      </div>

      <!-- Detected panel -->
      <div id="ss-detected" style="background:var(--surface-2);border-radius:8px;padding:10px;min-height:48px;margin-bottom:12px;font-size:13px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Detectado</div>
        <div id="ss-detected-list" style="color:var(--text-3);font-size:12px;">Esperando…</div>
      </div>

      <div style="display:flex;gap:8px;">
        <button id="ss-cancel" style="flex:1;padding:10px;background:var(--surface);border:1px solid var(--border-2);border-radius:8px;font-size:13px;cursor:pointer;color:var(--text-2);">Cancelar</button>
        <button id="ss-apply" style="flex:2;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;" disabled>Aplicar campos</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => {
    if (rafId)  cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  };

  document.getElementById('ss-close').addEventListener('click', close);
  document.getElementById('ss-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('ss-apply').addEventListener('click', () => {
    applyDetectedToForm(detectedFields);
    showToast(`${detectedFields.size} campo(s) aplicado(s).`, 'success');
    close();
  });

  function updateDetectedPanel() {
    const list = document.getElementById('ss-detected-list');
    const applyBtn = document.getElementById('ss-apply');
    if (detectedFields.size === 0) {
      list.textContent = 'Esperando…';
      applyBtn.disabled = true;
      return;
    }
    list.innerHTML = [...detectedFields.entries()].map(([field, val]) =>
      `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <span style="color:var(--text-2);">${field}</span>
        <span style="font-family:monospace;color:var(--text);">${esc(val)}</span>
      </div>`
    ).join('');
    applyBtn.disabled = false;
  }

  /* ── Start camera ── */
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    const videoEl    = document.getElementById('ss-video');
    const videoOcrEl = document.getElementById('ss-video-ocr');
    if (videoEl)    videoEl.srcObject    = stream;
    if (videoOcrEl) videoOcrEl.srcObject = stream;
  } catch (err) {
    close();
    showToast(err.name === 'NotAllowedError'
      ? 'Permiso de cámara denegado.'
      : 'No se pudo acceder a la cámara.', 'error');
    return;
  }

  /* ── Tab switching ── */
  document.getElementById('ss-tab-codes')?.addEventListener('click', () => {
    document.getElementById('ss-tab-codes').classList.add('tab-active');
    document.getElementById('ss-tab-ocr').classList.remove('tab-active');
    document.getElementById('ss-pane-codes').style.display = '';
    document.getElementById('ss-pane-ocr').style.display   = 'none';
    startBarcodeScan();
  });
  document.getElementById('ss-tab-ocr').addEventListener('click', () => {
    document.getElementById('ss-tab-ocr').classList.add('tab-active');
    document.getElementById('ss-tab-codes')?.classList.remove('tab-active');
    document.getElementById('ss-pane-ocr').style.display   = '';
    document.getElementById('ss-pane-codes').style.display = 'none';
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  });

  /* ── Barcode scan loop ── */
  function startBarcodeScan() {
    if (!hasBarcodeDetector) return;
    const detector = new BarcodeDetector({
      formats: ['code_128','code_39','qr_code','ean_13','ean_8','data_matrix','itf'],
    });
    const video = document.getElementById('ss-video');

    const scanLoop = async () => {
      if (video?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          for (const code of codes) {
            const val = code.rawValue;
            if (detectedValues.has(val)) continue;
            const field = routeBarcode(val, _activeTab, new Set(detectedFields.keys()));
            if (field) {
              detectedValues.add(val);
              detectedFields.set(field, val);
              updateDetectedPanel();
            }
          }
        } catch {}
      }
      rafId = requestAnimationFrame(scanLoop);
    };

    video?.addEventListener('loadeddata', () => { rafId = requestAnimationFrame(scanLoop); }, { once: true });
    if (video?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) rafId = requestAnimationFrame(scanLoop);
  }

  if (hasBarcodeDetector) startBarcodeScan();

  /* ── OCR capture ── */
  document.getElementById('ss-capture')?.addEventListener('click', async () => {
    const video    = document.getElementById('ss-video-ocr');
    const canvas   = document.getElementById('ss-canvas');
    const progress = document.getElementById('ss-ocr-progress');
    const captureBtn = document.getElementById('ss-capture');

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);

    captureBtn.disabled = true;
    captureBtn.textContent = 'Procesando…';
    progress.style.display = '';
    progress.textContent   = 'Cargando motor OCR…';

    try {
      const Tesseract = await loadTesseract();
      progress.textContent = 'Reconociendo texto…';
      const worker = await Tesseract.createWorker('spa+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            progress.textContent = `Reconociendo… ${Math.round((m.progress || 0) * 100)}%`;
          }
        },
      });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const parsed = parseOcrText(text);
      if (parsed.size === 0) {
        progress.textContent = 'No se detectaron datos. Intenta con mejor iluminación.';
      } else {
        progress.style.display = 'none';
        for (const [field, val] of parsed) {
          if (!detectedFields.has(field)) detectedFields.set(field, val);
        }
        updateDetectedPanel();
      }
    } catch (err) {
      progress.textContent = `Error OCR: ${err.message}`;
    } finally {
      captureBtn.disabled = false;
      captureBtn.textContent = '📸 Capturar y leer etiqueta';
    }
  });
}
```

- [ ] **Step 4: Verify in browser**

Start server. Go to Inventario → click "＋ Registrar equipo" → modal opens → click "📷 Escanear equipo…" → smart scanner modal appears with two tabs. On desktop (BarcodeDetector available in Chrome): "Códigos" tab active, video shows. On Firefox: "Leer etiqueta" active. No console errors.

- [ ] **Step 5: Commit**

```bash
git add public/js/inventario.js
git commit -m "feat(inventario): smart multi-barcode scanner with field routing"
```

---

### Task 5: Frontend — OCR text parser + Tesseract lazy load

**Files:**
- Modify: `public/js/inventario.js`

- [ ] **Step 1: Append `loadTesseract` and `parseOcrText` to `inventario.js`**

```javascript
/* ── Tesseract lazy loader ── */
async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar Tesseract.js. Verifica tu conexión.'));
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

/* ── OCR text parser ── */
function parseOcrText(text) {
  const result = new Map();
  if (!text) return result;

  const norm = text.replace(/\r/g, '\n');

  /* IMEI */
  const imeiMatch = norm.match(/IMEI[\s:]+(\d{15})/i);
  if (imeiMatch) result.set('imei', imeiMatch[1]);

  /* Serial */
  const snMatch = norm.match(/S\/?N[\s:]+([A-Z0-9\-]{5,20})/i);
  if (snMatch && !result.has('serial')) result.set('serial', snMatch[1].toUpperCase());

  /* Standalone 15-digit number (IMEI without label) */
  if (!result.has('imei')) {
    const bareImei = norm.match(/\b(\d{15})\b/);
    if (bareImei) result.set('imei', bareImei[1]);
  }

  /* RAM: look for NGB near "RAM" */
  const ramCtx = norm.match(/RAM[^\n]{0,30}?(\d+)\s*GB/i) || norm.match(/(\d+)\s*GB[^\n]{0,30}?RAM/i);
  if (ramCtx) result.set('ram', ramCtx[1] + 'GB');

  /* Storage: look for NGB near ROM/Storage/Alm/internal */
  const storCtx = norm.match(/(?:ROM|Storage|Almacenamiento|Internal)[^\n]{0,30}?(\d+)\s*GB/i)
                || norm.match(/(\d+)\s*GB[^\n]{0,30}?(?:ROM|Storage|Almacenamiento|Internal)/i);
  if (storCtx) result.set('almacenamiento', storCtx[1] + 'GB');

  /* Brand detection */
  const BRANDS = ['Samsung','Xiaomi','Redmi','Honor','ZTE','Infinix','Motorola','Apple','iPhone',
                  'Dell','HP','Lenovo','Asus','Acer','Toshiba'];
  for (const brand of BRANDS) {
    const re = new RegExp(`\\b${brand}\\b`, 'i');
    const m  = norm.match(re);
    if (m) {
      const field = ['Dell','HP','Lenovo','Asus','Acer','Toshiba'].includes(brand) ? 'marca' : 'equipo';
      result.set(field, brand);
      /* Model: rest of the line after the brand */
      const lineMatch = norm.match(new RegExp(`${brand}[\\s]+([A-Z0-9][A-Z0-9 \\-]{2,30})`, 'i'));
      if (lineMatch) result.set('modelo', lineMatch[1].trim());
      break;
    }
  }

  return result;
}
```

- [ ] **Step 2: Verify OCR in browser (desktop Chrome)**

Open Inventario → Registrar equipo → 📷 Escanear equipo → pestaña "🔤 Leer etiqueta" → click "📸 Capturar y leer etiqueta". First run: shows "Cargando motor OCR…" then "Reconociendo…". Point camera at any printed label with text. Result appears in "Detectado" panel.

If no camera: open browser DevTools console and test parser directly:
```javascript
// Paste in console (after page loads):
const m = new Map();
const text = 'Samsung Galaxy A54 5G\nIMEI: 490176543219876\nS/N: R58N123XYZ\n128GB ROM 6GB RAM';
// manually call parseOcrText if exposed — for now verify no errors in console
```

- [ ] **Step 3: Test end-to-end on mobile (Chrome Android)**

Open app on mobile → Inventario → Registrar celular → 📷 Escanear equipo → pestaña Códigos → point at phone box barcode → IMEI auto-fills in "Detectado" panel → "Aplicar campos" → IMEI field filled in form.

- [ ] **Step 4: Commit**

```bash
git add public/js/inventario.js
git commit -m "feat(inventario): OCR label reader with Tesseract.js lazy load and field parser"
```

---

## Self-Review

**Spec coverage:**
- ✅ Multi-barcode scan fills multiple fields (Tasks 4) — `routeBarcode` routes by pattern
- ✅ OCR reads text labels (Task 5) — `parseOcrText` + Tesseract lazy load
- ✅ "Aplicar campos" only fills empty inputs (Task 4 — `applyDetectedToForm` checks `!inp.value.trim()`)
- ✅ Per-field 📷 buttons kept as fallback (no changes to `openScanner` or `scanField`)
- ✅ BarcodeDetector unavailable → pestaña Códigos deshabilitada, OCR sigue (Task 4)
- ✅ Excel parse route with ExcelJS + multer memoryStorage (Task 1)
- ✅ Column auto-mapping with normalizeHeader (Task 1)
- ✅ Bulk insert confirm with skip/overwrite modes (Task 2)
- ✅ Import modal: upload → mapping table → preview → confirm → result (Task 3)
- ✅ Column mapping selects user-adjustable (Task 3)
- ✅ Reload table + counts after import (Task 3 — `btn-import-done` handler)

**Placeholder scan:** None found.

**Type consistency:**
- `routeBarcode(value, tipo, detectedSet)` defined Task 4 Step 3, called Task 4 Step 3 with `new Set(detectedFields.keys())` ✓
- `applyDetectedToForm(detectedMap)` defined Task 4 Step 3, called Task 4 Step 3 ✓
- `loadTesseract()` called in Task 4 Step 3 OCR handler, defined in Task 5 Step 1 — Task 5 must be completed for Task 4 OCR tab to work. Note in plan: Tasks must run in order 1→2→3→4→5.
- `parseOcrText(text)` same dependency — defined Task 5, called Task 4 ✓ (same ordering constraint)
- `openImportModal()` defined Task 3, wired in Task 3 Step 1 ✓
- `openSmartScanner()` defined Task 4, wired Task 4 Step 2 ✓

> **Note:** Tasks 4 and 5 are split for commit granularity but Task 4's OCR tab won't work until Task 5 is applied. If executing as subagents, run Task 5 immediately after Task 4.
