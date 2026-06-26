/**
 * inventario-import.js
 *
 * Handles:
 *  - openImportModal(activeTab, onSuccess) — Import Excel modal wizard
 */

import { showToast } from '../../ui/components.js';
import { iconUpload, iconMonitor, iconSmartphone, iconCheck } from '../../utils/icons.js';

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openImportModal(activeTab, onSuccess) {
  const modalWrap = document.getElementById('inv-modal-wrap');
  let _importRows = [];
  let _importTipo = activeTab;   /* can be overridden in the modal */

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
          <h3>${iconUpload(15)} Importar Excel</h3>
          <button class="modal-close" id="btn-import-close">&times;</button>
        </div>
        <div class="modal-body" id="import-body">
          <div id="import-step1">
            <div style="display:flex;gap:8px;margin-bottom:16px;">
              <button id="import-tipo-equipos" class="btn ${activeTab==='equipos'?'btn-primary':'btn-secondary'}" style="flex:1;padding:8px;display:flex;align-items:center;gap:6px;justify-content:center;">
                ${iconMonitor(13)} Equipos
              </button>
              <button id="import-tipo-celulares" class="btn ${activeTab==='celulares'?'btn-primary':'btn-secondary'}" style="flex:1;padding:8px;display:flex;align-items:center;gap:6px;justify-content:center;">
                ${iconSmartphone(13)} Celulares
              </button>
            </div>
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

  /* tipo selector */
  const setImportTipo = (t) => {
    _importTipo = t;
    document.getElementById('import-tipo-equipos').className   = `btn ${t==='equipos'  ?'btn-primary':'btn-secondary'}`;
    document.getElementById('import-tipo-celulares').className = `btn ${t==='celulares'?'btn-primary':'btn-secondary'}`;
  };
  document.getElementById('import-tipo-equipos').addEventListener('click',   () => setImportTipo('equipos'));
  document.getElementById('import-tipo-celulares').addEventListener('click', () => setImportTipo('celulares'));

  const dropZone  = document.getElementById('import-drop-zone');
  const fileInput = document.getElementById('import-file-input');
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop',      e => { e.preventDefault(); dropZone.style.borderColor = ''; handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change',   () => handleFile(fileInput.files[0]));
  dropZone.addEventListener('click',     () => fileInput.click());

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
      const res  = await fetch(`/api/inventario/${_importTipo}/import`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      _importRows = data.rows;
      document.getElementById('import-total-msg').textContent = `${data.total} filas encontradas en "${file.name}".`;
      document.getElementById('import-count').textContent = data.total;

      const allFields = Object.keys(_importTipo === 'equipos'
        ? { placa:1,marca:1,nombre_equipo:1,serial:1,procesador:1,ram:1,tipo_ram:1,cap_disco:1,tipo_disco:1,serial_cargador:1,area:1,responsable:1,fecha_compra:1 }
        : { fecha_registro:1,area:1,ciudad:1,nombre_completo:1,cedula:1,linea:1,operador:1,equipo:1,almacenamiento:1,ram:1,modelo:1,imei:1,imei2:1,estado:1,accesorio:1,fecha_entrega:1,entregado_por:1 });

      document.getElementById('import-mapping-table').innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);">COLUMNA EN EXCEL</th>
            <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);">CAMPO EN BD</th>
          </tr></thead>
          <tbody>${Object.entries(data.mapping).map(([col, field]) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid var(--border);color:var(--text-2);">${esc(col)}</td>
              <td style="padding:4px 8px;border-bottom:1px solid var(--border);">
                <select data-col="${esc(col)}" style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;padding:2px 6px;">
                  <option value="">— Ignorar —</option>
                  ${allFields.map(f => `<option value="${f}" ${field===f?'selected':''}>${esc(FIELD_LABELS[f]||f)}</option>`).join('')}
                </select>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      if (data.preview.length) {
        const cols = Object.keys(data.preview[0]);
        document.getElementById('import-preview-table').innerHTML = `
          <table style="border-collapse:collapse;font-size:11px;min-width:100%;">
            <thead><tr>${cols.map(c => `<th style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text-3);text-transform:uppercase;font-size:10px;">${esc(FIELD_LABELS[c]||c)}</th>`).join('')}</tr></thead>
            <tbody>${data.preview.map(r => `<tr>${cols.map(c => `<td style="padding:4px 8px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text-2);">${esc(r[c]||'')}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>`;
      }

      document.getElementById('import-step1').style.display = 'none';
      document.getElementById('import-step2').style.display = '';
    } catch (err) {
      errEl.textContent  = err.message || 'Error al leer el archivo.';
      errEl.style.display = '';
    } finally {
      dropZone.style.opacity = '';
    }
  }

  document.getElementById('import-body').addEventListener('click', async e => {
    if (e.target.id !== 'btn-import-confirm') return;
    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'skip';
    const btn  = e.target;
    btn.disabled    = true;
    btn.textContent = 'Importando…';
    try {
      const res  = await fetch(`/api/inventario/${_importTipo}/import/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: _importRows, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('import-step2').style.display = 'none';
      document.getElementById('import-result').innerHTML = `
        <div style="font-size:40px;margin-bottom:8px;color:#22c55e;">${iconCheck(40)}</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${data.inserted} registros importados</div>
        ${data.skipped ? `<div style="font-size:13px;color:var(--text-2);">${data.skipped} duplicados omitidos</div>` : ''}
        ${data.errors?.length ? `<div style="font-size:12px;color:var(--danger);margin-top:8px;">${data.errors.length} errores:<br>${data.errors.slice(0,5).map(e=>esc(e.message)).join('<br>')}</div>` : ''}`;
      document.getElementById('import-step3').style.display = '';
    } catch (err) {
      btn.disabled    = false;
      btn.textContent = `Importar ${_importRows.length} registros`;
      showToast(err.message || 'Error al importar.', 'error');
    }
  });

  document.getElementById('import-body').addEventListener('click', e => {
    if (e.target.id === 'btn-import-done') { close(); onSuccess(); }
  });
}
