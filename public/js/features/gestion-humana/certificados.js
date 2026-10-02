import { showToast } from '../../ui/components.js';
import { can } from '../../core/state.js';
import { escapeHtml as esc } from '../../utils/sanitize.js';

let _resumen = null;
let _empleado = null;

const CAMPOS_EDITABLES = [
  ['nombre',        'Nombre',            'text'],
  ['genero',        'Sexo',              'select:|M:Masculino|F:Femenino'],
  ['cargo',         'Cargo',             'text'],
  ['tipo_contrato', 'Tipo de contrato',  'select:|a término fijo|a término indefinido|por obra o labor|de aprendizaje'],
  ['fecha_ingreso', 'Fecha de ingreso',  'date'],
  ['fecha_retiro',  'Fecha de retiro',   'date'],
  ['estado',        'Estado',            'select:A:Activo|I:Retirado'],
  ['salario',       'Salario',           'number'],
];

const fmtFecha = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const fmtPesos = (n) => n ? '$' + Number(n).toLocaleString('es-CO') : '';

export async function renderCertificados(container) {
  const editor = can('hr:edit');
  container.innerHTML = `
  <div class="page-header">
    <div>
      <h2 class="page-title">Certificados laborales</h2>
      <p class="page-subtitle">Busca por cédula o nombre y descarga el certificado en Word</p>
    </div>
  </div>

  <div class="card" style="padding:18px;margin-bottom:18px;">
    <div style="position:relative;max-width:520px;">
      <input type="text" id="hr-buscar" class="form-control" placeholder="Cédula o nombre del empleado…" autocomplete="off">
      <div id="hr-buscar-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);
           border:1px solid var(--border);border-radius:6px;max-height:280px;overflow-y:auto;z-index:50;
           box-shadow:0 4px 12px rgba(0,0,0,.18);margin-top:2px;"></div>
    </div>
    <div id="hr-empleado" style="margin-top:16px;"></div>
  </div>

  ${editor ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;">
    <div class="card" style="padding:18px;">
      <h3 style="margin:0 0 4px;font-size:15px;">Datos de personal</h3>
      <p style="margin:0 0 12px;font-size:12px;color:var(--text-3);">
        Sube los Excel de Gestión Humana (nómina, contratos, listado con sexo…). Se complementan por cédula y se pueden volver a subir actualizados.
      </p>
      <div id="hr-resumen" style="font-size:13px;margin-bottom:12px;"></div>
      <label class="btn btn-primary" style="cursor:pointer;">Cargar Excel de personal
        <input type="file" id="hr-file" accept=".xls,.xlsx" style="display:none;">
      </label>
      <div id="hr-cargas" style="margin-top:14px;"></div>
    </div>

    <div class="card" style="padding:18px;">
      <h3 style="margin:0 0 4px;font-size:15px;">Plantilla y valores</h3>
      <div id="hr-plantilla" style="font-size:13px;margin:8px 0 12px;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <label class="btn btn-secondary" style="cursor:pointer;">Cargar plantilla (.docx)
          <input type="file" id="hr-plantilla-file" accept=".docx" style="display:none;">
        </label>
        <button class="btn btn-secondary" id="hr-plantilla-descargar">Descargar plantilla actual</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group" style="margin:0;">
          <label>Auxilio de transporte</label>
          <input type="text" id="hr-aux" class="form-control" inputmode="numeric">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Salario mínimo <span style="color:var(--text-3);font-weight:400;">(opcional)</span></label>
          <input type="text" id="hr-smmlv" class="form-control" inputmode="numeric" placeholder="Vacío = siempre incluir auxilio">
        </div>
      </div>
      <p style="font-size:11.5px;color:var(--text-3);margin:6px 0 10px;">
        El auxilio se incluye a quien gane hasta 2 salarios mínimos. Actualiza ambos valores cada año.
      </p>
      <button class="btn btn-secondary" id="hr-config-guardar">Guardar valores</button>
    </div>
  </div>` : ''}

  <details class="card hr-historial" style="padding:12px 18px;margin-top:18px;">
    <summary>Historial de certificados <span id="hr-ultimos-n"></span></summary>
    <div id="hr-ultimos" class="hr-historial-lista"></div>
  </details>

  <style>
    .hr-historial > summary { cursor:pointer;font-size:13px;font-weight:600;color:var(--text-2);list-style:revert; }
    .hr-historial > summary span { font-weight:400;color:var(--text-3); }
    .hr-historial-lista { margin-top:8px;max-height:220px;overflow-y:auto;font-size:12px;color:var(--text-2); }
    .hr-historial-lista table { width:100%;border-collapse:collapse; }
    .hr-historial-lista td { padding:4px 6px;border-bottom:1px solid var(--border);white-space:nowrap; }
    .hr-historial-lista td.n { white-space:normal; }
    .hr-historial-lista .muted { color:var(--text-3); }
  </style>

  <div id="hr-map-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content" style="max-width:620px;">
      <div class="modal-header">
        <h3>Revisar columnas del archivo</h3>
        <button class="modal-close" id="hr-map-close">&times;</button>
      </div>
      <div class="modal-body" id="hr-map-body"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="hr-map-cancel">Cancelar</button>
        <button class="btn btn-primary" id="hr-map-ok">Cargar datos</button>
      </div>
    </div>
  </div>`;

  _bindBuscar();
  if (editor) _bindAdmin();
  await _cargarResumen();
}

// ── Búsqueda ─────────────────────────────────────────────────────────────────
function _bindBuscar() {
  const input = document.getElementById('hr-buscar');
  const list  = document.getElementById('hr-buscar-list');
  let timer = null, items = [], active = 0;

  const close = () => { list.style.display = 'none'; };
  const pick = (i) => { const it = items[i]; if (!it) return; close(); input.value = `${it.cedula} · ${it.nombre || ''}`; _abrirEmpleado(it.cedula); };
  const paint = () => {
    list.innerHTML = items.length ? items.map((e, i) => `
      <div class="hr-opt" data-i="${i}" style="padding:8px 12px;font-size:13px;cursor:pointer;display:flex;justify-content:space-between;gap:10px;${i === active ? 'background:var(--surface-2);' : ''}">
        <span><strong style="font-family:monospace;">${esc(e.cedula)}</strong> · ${esc(e.nombre || '')}
          <span style="color:var(--text-3);font-size:11px;">${esc(e.cargo || '')}</span></span>
        <span style="font-size:11px;color:${e.estado === 'I' ? 'var(--text-3)' : 'var(--success)'};">${e.estado === 'I' ? 'Retirado' : 'Activo'}</span>
      </div>`).join('')
      : `<div style="padding:9px 12px;font-size:13px;color:var(--text-3);">Sin resultados</div>`;
    list.querySelectorAll('.hr-opt').forEach(el => el.addEventListener('mousedown', ev => { ev.preventDefault(); pick(Number(el.dataset.i)); }));
    list.style.display = 'block';
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { close(); return; }
    timer = setTimeout(async () => {
      try { items = await (await fetch(`/api/hr/empleados?q=${encodeURIComponent(q)}`)).json(); } catch { items = []; }
      active = 0; paint();
    }, 250);
  });
  input.addEventListener('keydown', e => {
    if (list.style.display === 'none' || !items.length) {
      if (e.key === 'Enter' && /^\d{5,15}$/.test(input.value.trim())) _abrirEmpleado(input.value.trim());
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { if (e.key === 'Enter') e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

async function _abrirEmpleado(cedula) {
  const box = document.getElementById('hr-empleado');
  box.innerHTML = '<div style="color:var(--text-3);font-size:13px;">Cargando…</div>';
  try {
    const r = await fetch(`/api/hr/empleados/${encodeURIComponent(cedula)}`);
    const body = await r.json();
    if (!r.ok) { box.innerHTML = `<div style="color:var(--danger);font-size:13px;">${esc(body.error || 'No encontrado.')}</div>`; return; }
    _empleado = body;
    _pintarEmpleado();
  } catch {
    box.innerHTML = '<div style="color:var(--danger);font-size:13px;">Error de conexión.</div>';
  }
}

function _pintarEmpleado(editando = false) {
  const { empleado: e, faltantes, tipo, vista_previa: v } = _empleado;
  const box = document.getElementById('hr-empleado');
  const retirado = tipo === 'retirado';
  const falta = (c) => faltantes.includes(c);
  const fila = (label, valor, campo) => `
    <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span style="width:140px;color:var(--text-3);flex-shrink:0;">${label}</span>
      <span style="${falta(campo) ? 'color:var(--danger);font-weight:600;' : ''}">${valor ? esc(valor) : (falta(campo) ? 'Falta' : '—')}</span>
    </div>`;

  const datos = editando ? _formEdicion(e) : `
    ${fila('Nombre', e.nombre, 'nombre')}
    ${fila('Cédula', e.cedula, 'cedula')}
    ${fila('Sexo', e.genero === 'F' ? 'Femenino' : e.genero === 'M' ? 'Masculino' : '', 'genero')}
    ${fila('Cargo', e.cargo, 'cargo')}
    ${fila('Tipo de contrato', e.tipo_contrato, 'tipo_contrato')}
    ${fila('Fecha de ingreso', fmtFecha(e.fecha_ingreso), 'fecha_ingreso')}
    ${retirado ? fila('Fecha de retiro', fmtFecha(e.fecha_retiro), 'fecha_retiro') : ''}
    ${retirado ? '' : fila('Salario', fmtPesos(e.salario), 'salario')}
    <div style="font-size:11px;color:var(--text-3);margin-top:6px;">Fuente: ${esc(e.fuente || '—')}</div>`;

  const avisos = [];
  if (faltantes.length) avisos.push(`Faltan datos para generar el certificado. ${can('hr:edit') ? 'Usa "Corregir datos".' : 'Pídele a Gestión Humana que los complete.'}`);
  if (!e.genero) avisos.push('No se conoce el sexo: el texto dirá "el(la) señor(a)". Puedes indicarlo con "Corregir datos".');

  box.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-weight:700;font-size:15px;">${esc(e.nombre || e.cedula)}</span>
          <span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;
            background:${retirado ? 'rgba(148,163,184,.18)' : 'rgba(16,185,129,.15)'};color:${retirado ? 'var(--text-2)' : 'var(--success)'};">
            ${retirado ? 'Retirado — carta informativa sin valores' : 'Activo — certificado completo'}</span>
        </div>
        ${datos}
        ${avisos.map(a => `<div style="margin-top:8px;padding:8px 10px;border-radius:6px;font-size:12px;background:rgba(245,158,11,.12);color:#f59e0b;">${esc(a)}</div>`).join('')}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          ${editando
            ? `<button class="btn btn-primary" id="hr-edit-save">Guardar datos</button><button class="btn btn-secondary" id="hr-edit-cancel">Cancelar</button>`
            : `<button class="btn btn-primary" id="hr-generar" ${faltantes.length ? 'disabled' : ''}>Descargar certificado (.docx)</button>
               ${can('hr:edit') ? '<button class="btn btn-secondary" id="hr-edit">Corregir datos</button>' : ''}`}
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;">Vista previa del texto</div>
        <div style="font-size:12.5px;line-height:1.6;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);">
          <p style="margin:0 0 8px;">Santiago de Cali, ${esc(v.fecha_expedicion)}.</p>
          <p style="margin:0 0 8px;">… hace constar que ${esc(v.tratamiento)} <strong>${esc(v.nombre)}</strong>, ${esc(v.identificado)} con la cédula de ciudadanía número ${esc(v.cedula)},
            ${esc(v.verbo_contrato)} con nuestra empresa un contrato laboral ${esc(v.tipo_contrato || '___')} ${esc(v.periodo)}.</p>
          <p style="margin:0;">${esc(v.parrafo_cargo)}</p>
        </div>
      </div>
    </div>`;

  document.getElementById('hr-generar')?.addEventListener('click', _generar);
  document.getElementById('hr-edit')?.addEventListener('click', () => _pintarEmpleado(true));
  document.getElementById('hr-edit-cancel')?.addEventListener('click', () => _pintarEmpleado(false));
  document.getElementById('hr-edit-save')?.addEventListener('click', _guardarEdicion);
}

function _formEdicion(e) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">` + CAMPOS_EDITABLES.map(([campo, label, tipo]) => {
    const val = e[campo] ?? '';
    let control;
    if (tipo.startsWith('select:')) {
      const opts = tipo.slice(7).split('|').map(o => {
        const [v, l] = o.includes(':') ? o.split(':') : [o, o || '—'];
        return `<option value="${esc(v)}" ${String(val) === v ? 'selected' : ''}>${esc(l || '—')}</option>`;
      });
      control = `<select class="form-control" data-campo="${campo}">${opts.join('')}</select>`;
    } else {
      control = `<input class="form-control" data-campo="${campo}" type="${tipo}" value="${esc(val)}">`;
    }
    return `<div class="form-group" style="margin:0;"><label style="font-size:12px;">${label}</label>${control}</div>`;
  }).join('') + `</div>`;
}

async function _guardarEdicion() {
  const datos = {};
  document.querySelectorAll('#hr-empleado [data-campo]').forEach(el => { datos[el.dataset.campo] = el.value; });
  try {
    const r = await fetch(`/api/hr/empleados/${encodeURIComponent(_empleado.empleado.cedula)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
    });
    const body = await r.json();
    if (!r.ok) { showToast(body.error || 'No se pudo guardar.', 'error'); return; }
    showToast('Datos guardados.', 'success');
    await _abrirEmpleado(_empleado.empleado.cedula);
  } catch { showToast('Error de conexión.', 'error'); }
}

async function _generar() {
  const btn = document.getElementById('hr-generar');
  btn.disabled = true; btn.textContent = 'Generando…';
  try {
    const r = await fetch('/api/hr/certificados', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cedula: _empleado.empleado.cedula }),
    });
    if (!r.ok) { const b = await r.json().catch(() => ({})); showToast(b.error || 'No se pudo generar.', 'error'); return; }
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Certificado laboral ${_empleado.empleado.nombre || _empleado.empleado.cedula}.docx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast('Certificado descargado.', 'success');
    _cargarResumen();
  } catch { showToast('Error de conexión.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Descargar certificado (.docx)'; }
}

// ── Administración (Gestión Humana) ─────────────────────────────────────────
async function _cargarResumen() {
  try { _resumen = await (await fetch('/api/hr/resumen')).json(); } catch { return; }
  const r = _resumen;

  const fecha = (d) => esc(String(d || '').slice(0, 16));
  document.getElementById('hr-ultimos-n').textContent = r.certificados?.length ? `(últimos ${r.certificados.length})` : '';
  document.getElementById('hr-ultimos').innerHTML = r.certificados?.length ? `<table>${r.certificados.map(c => `
    <tr><td class="muted">${fecha(c.created_at)}</td><td style="font-family:monospace;">${esc(c.cedula)}</td>
      <td class="n">${esc(c.nombre || '')}</td><td>${c.tipo === 'retirado' ? 'Retirado' : 'Activo'}</td>
      <td class="muted">${esc(c.usuario || '')}</td></tr>`).join('')}</table>`
    : '<span class="muted">Aún no se han generado certificados.</span>';

  if (!can('hr:edit')) return;
  document.getElementById('hr-resumen').innerHTML = `
    <strong>${r.empleados}</strong> empleados (${r.activos} activos · ${r.retirados} retirados) ·
    <strong>${r.con_genero}</strong> con sexo registrado`;
  document.getElementById('hr-cargas').innerHTML = r.cargas?.length ? `
    <details class="hr-historial">
      <summary>Historial de cargas <span>(últimas ${r.cargas.length})</span></summary>
      <div class="hr-historial-lista" style="max-height:170px;"><table>${r.cargas.map(c => `
        <tr><td class="muted">${fecha(c.created_at)}</td><td class="n">${esc(c.archivo)}</td>
          <td>${c.creados} nuevos · ${c.actualizados} actualizados</td><td class="muted">${esc(c.usuario || '')}</td></tr>`).join('')}
      </table></div>
    </details>`
    : '<span style="font-size:12px;color:var(--text-3);">Aún no se ha cargado ningún archivo.</span>';
  document.getElementById('hr-plantilla').innerHTML = r.plantilla
    ? `Plantilla: <strong>${esc(r.plantilla.archivo)}</strong> <span style="color:var(--text-3);">(${esc(String(r.plantilla.updated_at || '').slice(0, 16))} · ${esc(r.plantilla.usuario || '')})</span>`
    : '<span style="color:var(--danger);">Aún no hay plantilla cargada: no se pueden generar certificados.</span>';
  document.getElementById('hr-aux').value = r.config.auxilio_transporte || '';
  document.getElementById('hr-smmlv').value = r.config.salario_minimo || '';
}

function _bindAdmin() {
  document.getElementById('hr-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) _previewExcel(f); });
  document.getElementById('hr-plantilla-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) _subirPlantilla(f); });
  document.getElementById('hr-plantilla-descargar').addEventListener('click', _descargarPlantilla);
  document.getElementById('hr-config-guardar').addEventListener('click', _guardarConfig);
  const cerrar = () => { document.getElementById('hr-map-modal').style.display = 'none'; };
  document.getElementById('hr-map-close').addEventListener('click', cerrar);
  document.getElementById('hr-map-cancel').addEventListener('click', cerrar);
}

let _archivoPendiente = null;

async function _previewExcel(file) {
  const fd = new FormData(); fd.append('file', file);
  let body;
  try {
    const r = await fetch('/api/hr/personal/preview', { method: 'POST', body: fd });
    body = await r.json();
    if (!r.ok) { showToast(body.error || 'No se pudo leer el archivo.', 'error'); return; }
  } catch { showToast('Error de conexión.', 'error'); return; }
  _archivoPendiente = file;

  const opciones = (sel) => `<option value="">— No usar —</option>` +
    Object.entries(body.campos).map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  document.getElementById('hr-map-body').innerHTML = `
    <p style="font-size:13px;margin:0 0 6px;"><strong>${esc(body.archivo)}</strong>: ${body.filas} filas · ${body.personas} personas
      (${body.empleados} con datos laborales)${body.sin_cedula ? ` · ${body.sin_cedula} sin cédula (se omiten)` : ''}.</p>
    <p style="font-size:12px;color:var(--text-3);margin:0 0 12px;">
      ${body.recordado ? 'Se usó la correspondencia guardada para este formato de archivo.' : 'Revisa qué dato tiene cada columna. Se recordará para la próxima vez.'}
      Las columnas en "No usar" se ignoran. Si el archivo solo trae cédula y sexo, solo completa el sexo de los empleados.</p>
    <div style="display:grid;gap:6px;max-height:340px;overflow-y:auto;">
      ${body.columnas.map((col, i) => `
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(col)}">${esc(col) || `<em>Columna ${i + 1}</em>`}</span>
          <select class="form-control hr-map-sel" data-col="${i}" style="width:200px;">${opciones(body.mapeo[i])}</select>
        </div>`).join('')}
    </div>`;
  document.getElementById('hr-map-ok').onclick = _importarExcel;
  document.getElementById('hr-map-modal').style.display = 'flex';
}

async function _importarExcel() {
  const mapeo = {};
  document.querySelectorAll('.hr-map-sel').forEach(s => { if (s.value) mapeo[s.dataset.col] = s.value; });
  const fd = new FormData(); fd.append('file', _archivoPendiente); fd.append('mapeo', JSON.stringify(mapeo));
  const btn = document.getElementById('hr-map-ok');
  btn.disabled = true; btn.textContent = 'Cargando…';
  try {
    const r = await fetch('/api/hr/personal/importar', { method: 'POST', body: fd });
    const body = await r.json();
    if (!r.ok) { showToast(body.error || 'No se pudo cargar.', 'error'); return; }
    document.getElementById('hr-map-modal').style.display = 'none';
    showToast(`Listo: ${body.creados} nuevos y ${body.actualizados} actualizados.`, 'success');
    await _cargarResumen();
    if (_empleado) _abrirEmpleado(_empleado.empleado.cedula);
  } catch { showToast('Error de conexión.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Cargar datos'; }
}

async function _subirPlantilla(file) {
  const fd = new FormData(); fd.append('file', file);
  try {
    const r = await fetch('/api/hr/plantilla', { method: 'POST', body: fd });
    const body = await r.json();
    if (!r.ok) { showToast(body.error || 'No se pudo cargar la plantilla.', 'error'); return; }
    showToast(body.desconocidos?.length
      ? `Plantilla cargada. Campos no reconocidos: ${body.desconocidos.join(', ')}`
      : 'Plantilla cargada.', body.desconocidos?.length ? 'info' : 'success');
    await _cargarResumen();
  } catch { showToast('Error de conexión.', 'error'); }
}

async function _descargarPlantilla() {
  const r = await fetch('/api/hr/plantilla');
  if (!r.ok) { showToast('Aún no hay plantilla cargada.', 'error'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await r.blob());
  a.download = _resumen?.plantilla?.archivo || 'plantilla.docx';
  document.body.appendChild(a); a.click(); a.remove();
}

async function _guardarConfig() {
  try {
    const r = await fetch('/api/hr/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auxilio_transporte: document.getElementById('hr-aux').value, salario_minimo: document.getElementById('hr-smmlv').value }),
    });
    if (!r.ok) { showToast('No se pudo guardar.', 'error'); return; }
    showToast('Valores guardados.', 'success');
    await _cargarResumen();
    if (_empleado) _abrirEmpleado(_empleado.empleado.cedula);
  } catch { showToast('Error de conexión.', 'error'); }
}
