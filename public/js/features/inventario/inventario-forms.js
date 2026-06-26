/**
 * inventario-forms.js
 *
 * Handles:
 *  - openForm(row, activeTab, onSuccess) — Nuevo / Editar equipo, celular o UPS
 *  - equipoFormHTML, celularFormHTML, upsFormHTML, inputField, selectField, scanField
 *  - openGenerarEnlaceModal()
 */

import { showToast, copyToClipboard, attachBodegaSearch } from './components.js';
import { iconMonitor, iconSmartphone } from './icons.js';
import { openScanner, openSmartScanner } from './inventario-scanner.js';
import { AREA_MAPPINGS } from './app-constants.js';

const toTitleCase = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openForm(row, activeTab, onSuccess) {
  const isEdit    = !!row;
  const isEquipo  = activeTab === 'equipos';
  const isUps     = activeTab === 'ups';
  const modalWrap = document.getElementById('inv-modal-wrap');

  modalWrap.innerHTML = isUps ? upsFormHTML(row) : isEquipo ? equipoFormHTML(row) : celularFormHTML(row);

  // Bodega autocomplete para campo ciudad en celulares
  const ciudadInput = modalWrap.querySelector('#inv-input-ciudad');
  if (ciudadInput) attachBodegaSearch(ciudadInput);

  const overlay = modalWrap.querySelector('.modal-overlay');
  const form    = modalWrap.querySelector('#inv-form');
  const errEl   = modalWrap.querySelector('#inv-form-err');

  const close = () => { overlay.style.display = 'none'; };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modalWrap.querySelectorAll('#btn-inv-form-cancel').forEach(b => b.addEventListener('click', close));

  // ── Auto-placa por sede (solo Nuevo equipo) ────────────────────────────────
  const sedeSelect  = modalWrap.querySelector('#inv-sede-placa');
  const placaInput  = modalWrap.querySelector('#inv-placa');
  const refreshBtn  = modalWrap.querySelector('#btn-refresh-placa');

  async function fetchNextPlaca(sede) {
    if (!sede) return;
    try {
      const res  = await fetch(`/api/inventario/${activeTab}/next-placa?sede=${encodeURIComponent(sede)}`);
      const data = await res.json();
      if (placaInput) placaInput.value = data.placa || '';
    } catch {}
  }

  if (sedeSelect && placaInput) {
    sedeSelect.addEventListener('change', () => fetchNextPlaca(sedeSelect.value));
    refreshBtn?.addEventListener('click', () => fetchNextPlaca(sedeSelect.value));
  }
  // ─────────────────────────────────────────────────────────────────────────

  form.querySelectorAll('input[type=text]').forEach(inp => {
    inp.addEventListener('blur', e => {
      // Excluir identificadores técnicos y valores numéricos/especiales
      const skip = ['placa','serial','imei','imei2','serial_cargador','cedula','linea','voltaje'];
      if (!skip.includes(e.target.name)) e.target.value = toTitleCase(e.target.value.trim());
    });
  });

  form.querySelectorAll('.btn-scan').forEach(btn => {
    btn.addEventListener('click', () => openScanner(btn.dataset.target));
  });
  document.getElementById('btn-smart-scan')?.addEventListener('click', () => openSmartScanner(activeTab));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.style.display = 'none';
    const raw  = Object.fromEntries(new FormData(form));
    // sede_placa es solo UI — no se persiste
    const { sede_placa: _drop, ...data } = raw;
    const url  = isEdit
      ? `/api/inventario/${activeTab}/${row.id}`
      : `/api/inventario/${activeTab}`;
    try {
      const res  = await fetch(url, {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (!isEdit && json.qr_token) {
        // Reemplazar el form con confirmación + botón de etiqueta
        const content = modalWrap.querySelector('.modal-content');
        content.innerHTML = `
          <div class="modal-header">
            <h3>✅ Registro creado</h3>
          </div>
          <div class="modal-body" style="text-align:center;padding:24px 16px;">
            <p style="font-size:14px;color:var(--text-2);margin-bottom:20px;">
              El activo fue registrado con su código QR de activo fijo.
            </p>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
              <a href="/activo/${json.qr_token}/etiqueta" target="_blank"
                style="display:inline-flex;align-items:center;gap:7px;padding:10px 20px;background:var(--primary);color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
                🖨️ Imprimir etiqueta (50×25mm)
              </a>
              <button id="btn-inv-done" style="padding:10px 20px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">
                Cerrar
              </button>
            </div>
          </div>`;
        content.querySelector('#btn-inv-done').onclick = () => { close(); onSuccess(); };
      } else {
        showToast(isEdit ? 'Registro actualizado.' : 'Registro creado.', 'success');
        close();
        onSuccess();
      }
    } catch (err) {
      errEl.textContent  = err.message || 'Error al guardar.';
      errEl.style.display = 'block';
    }
  });
}

export function equipoFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <h3>${r ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
        </div>
        ${r ? '' : `<button type="button" id="btn-smart-scan"
          style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;">
          📷 Escanear equipo — llenar campos automáticamente
        </button>`}
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:var(--danger);border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          ${placaBlock(v('placa'), true)}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${selectField('Marca *','marca',v('marca'),['Lenovo','Dell','HP','Samsung','Toshiba','Acer','Asus','Apple','Kalley','Otro'])}
            ${inputField('Nombre del equipo *','nombre_equipo',v('nombre_equipo'))}
            ${scanField('Serial *','serial',v('serial'),true,!r)}
            ${selectField('Procesador','procesador',v('procesador'),['Intel Core i3','Intel Core i5','Intel Core i7','Intel Core i9','AMD Ryzen 3','AMD Ryzen 5','AMD Ryzen 7','Otro'])}
            ${selectField('RAM','ram',v('ram'),['4GB','8GB','16GB','32GB','64GB'])}
            ${selectField('Tipo de RAM','tipo_ram',v('tipo_ram'),['DDR3','DDR4','DDR5','LPDDR4','LPDDR5'])}
            ${selectField('Capacidad Disco','cap_disco',v('cap_disco'),['128GB','256GB','512GB','1TB','2TB'])}
            ${selectField('Tipo de Disco','tipo_disco',v('tipo_disco'),['SSD','HDD','M2','SATA','NVMe'])}
            ${inputField('Serial Cargador','serial_cargador',v('serial_cargador'))}
            ${areaSelectField(v('area'))}
            ${inputField('Responsable','responsable',v('responsable'))}
          </div>
          <div style="margin-top:12px;">
            ${inputField('Fecha de creacion','fecha_compra',v('fecha_compra'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

export function celularFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:580px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <h3>${r ? 'Editar celular' : 'Nuevo celular'}</h3>
          <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
        </div>
        ${r ? '' : `<button type="button" id="btn-smart-scan"
          style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;">
          📷 Escanear equipo — llenar campos automáticamente
        </button>`}
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:var(--danger);border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          ${placaBlock(v('placa'), false)}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${scanField('IMEI *','imei',v('imei'),true,!r)}
            ${inputField('IMEI 2','imei2',v('imei2'))}
            ${selectField('Marca / Equipo','equipo',v('equipo'),['Samsung','Xiaomi Redmi','Honor','ZTE','Infinix','Motorola','iPhone','Otro'])}
            ${inputField('Modelo','modelo',v('modelo'))}
            ${selectField('Almacenamiento','almacenamiento',v('almacenamiento'),['32GB','64GB','128GB','256GB','512GB'])}
            ${selectField('RAM','ram',v('ram'),['2GB','3GB','4GB','6GB','8GB','12GB','16GB'])}
            ${selectField('Operador','operador',v('operador'),['CLARO','TIGO','MOVISTAR','WOM','ETB','AVANTEL'])}
            ${inputField('Línea','linea',v('linea'))}
            ${areaSelectField(v('area'))}
            ${bodegaInputField(v('ciudad'))}
            ${inputField('Nombre completo *','nombre_completo',v('nombre_completo'))}
            ${inputField('Cédula','cedula',v('cedula'))}
            ${selectField('Estado','estado',v('estado')||'nuevo',['nuevo','seminuevo','usado'])}
            ${inputField('Accesorio','accesorio',v('accesorio'))}
            ${inputField('Entregado por','entregado_por',v('entregado_por'))}
          </div>
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${inputField('Fecha de registro','fecha_registro',v('fecha_registro'),'date')}
            ${inputField('Fecha de entrega','fecha_entrega',v('fecha_entrega'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

export function upsFormHTML(r) {
  const v = k => esc(r?.[k] ?? '');
  return `
  <div class="modal-overlay" style="display:flex;">
    <div class="modal-content" style="max-width:480px;max-height:90vh;overflow-y:auto;">
      <div class="modal-header" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <h3>${r ? 'Editar UPS' : 'Nueva UPS'}</h3>
          <button class="modal-close" id="btn-inv-form-cancel">&times;</button>
        </div>
        ${r ? '' : `<button type="button" id="btn-smart-scan"
          style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;justify-content:center;">
          📷 Escanear etiqueta — llenar campos automáticamente
        </button>`}
      </div>
      <div class="modal-body">
        <div id="inv-form-err" style="display:none;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:var(--danger);border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>
        <form id="inv-form">
          ${placaBlock(v('placa'), true)}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${inputField('Marca','marca',v('marca'))}
            ${inputField('Nombre del equipo','nombre_equipo',v('nombre_equipo'))}
            ${scanField('Serial','serial',v('serial'),false,!r)}
            ${areaSelectField(v('area'))}
            ${inputField('Voltaje','voltaje',v('voltaje'))}
          </div>
          <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${inputField('Fecha de compra','fecha_compra',v('fecha_compra'),'date')}
            ${inputField('Fecha de despacho','fecha_despacho',v('fecha_despacho'),'date')}
          </div>
          <div class="modal-footer" style="margin-top:16px;padding:0;">
            <button type="button" class="btn btn-secondary" id="btn-inv-form-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function placaBlock(currentPlaca = '', required = true) {
  const req = required ? 'required' : '';
  return `
  <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
    <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Sede — genera la placa automáticamente</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;">
      ${sedeSelectField('')}
      <div class="form-group">
        <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">Placa${required ? ' *' : ''}</label>
        <div style="display:flex;gap:6px;">
          <input type="text" name="placa" id="inv-placa" class="form-control" value="${esc(currentPlaca)}" ${req}
            placeholder="${currentPlaca ? '' : 'Selecciona sede…'}"
            style="flex:1;font-family:monospace;font-weight:700;color:var(--primary);letter-spacing:1px;">
          <button type="button" id="btn-refresh-placa"
            title="Recalcular consecutivo"
            style="padding:0 10px;background:var(--surface-3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:15px;flex-shrink:0;">↺</button>
        </div>
      </div>
    </div>
  </div>`;
}

function sedeSelectField(value = '') {
  const grupos = [
    { label: '— Administrativo —', opts: [
      ['BODEGA',           'Bodega'],
      ['BOGOTA',           'Bogotá'],
      ['CARSON',           'Carson  · CRS'],
      ['OFICINA',          'Oficina'],
      ['SEDE PRINCIPAL',   'Sede Principal (Medivalle)'],
    ]},
    { label: '— Caldas —', opts: [
      ['AGUADAS','Aguadas'],['ANSERMA','Anserma'],['ARANZAZU','Aranzazu'],
      ['CHINCHINA','Chinchiná'],['LA DORADA','La Dorada'],['MANIZALES','Manizales'],
      ['MARQUETALIA','Marquetalia'],['PENSILVANIA','Pensilvania'],['RIOSUCIO','Riosucio'],
      ['SALAMINA','Salamina'],['SAMANA','Samaná'],['SUPIA','Supía'],
    ]},
    { label: '— Cauca —', opts: [
      ['ARGELIA','Argelia'],['CORINTO','Corinto'],['GUAPI','Guapi'],
      ['JAMBALO','Jambaló'],['MIRANDA','Miranda'],['MORALES','Morales'],
      ['PIENDAMO','Piendamó'],['POPAYAN','Popayán'],['SANTANDER DE QUILICHAO','Santander de Quilichao'],
      ['SILVIA','Silvia'],['TORIBIO','Toribio'],['TOTORO','Tótoró'],
    ]},
    { label: '— Nariño / Putumayo —', opts: [
      ['LA UNION NARINO','La Unión Nariño'],['MOCOA','Mocoa'],['PASTO','Pasto'],['TUMACO','Tumaco'],
    ]},
    { label: '— Quindío —', opts: [['QUIMBAYA','Quimbaya']] },
    { label: '— Risaralda —', opts: [
      ['APIA','Apía'],['DOSQUEBRADAS','Dosquebradas'],['GUATICA','Guática'],
      ['LA VIRGINIA','La Virginia'],['PEREIRA','Pereira'],['SANTA ROSA','Santa Rosa'],
    ]},
    { label: '— Cali (sub-sedes) —', opts: [
      ['CALI SUR',              'Cali Sur  · CSR'],
      ['CALI NORTE',            'Cali Norte  · CNR'],
      ['CALI AIC',              'Cali AIC  · CAI'],
      ['PASOANCHO',             'Pasoancho  · PAS'],
      ['SEDE HOSPITALARIA 24H', 'Hospitalaria 24H Fomag  · SHF'],
      ['LA FAVORITA',           'La Favorita  · CFV'],
      ['CALI',                  'Cali (genérico)  · CAL'],
    ]},
    { label: '— Buenaventura —', opts: [
      ['BUENAVENTURA',   'Buenaventura (principal)  · BNV'],
      ['BUENAVENTURA 2', 'Buenaventura 2  · BN2'],
      ['LA VERDAD 2',    'La Verdad 2 (horario extendido)  · BVD'],
    ]},
    { label: '— Buga —', opts: [
      ['BUGA',           'Buga (principal)  · BGA'],
      ['SAN JOSE BUGA',  'San José – Buga  · BGJ'],
    ]},
    { label: '— Candelaria —', opts: [
      ['VILLAGORGONA',   'Villagorgona  · VLG'],
      ['EL MANANTIAL',   'El Manantial  · ELM'],
    ]},
    { label: '— Cartago —', opts: [
      ['CARTAGO FOMAG',  'Cartago Fomag  · CTF'],
      ['ZARAGOZA',       'Zaragoza (Cartago)  · ZRG'],
      ['CIPRES',         'Ciprés (Cartago)  · CIP'],
      ['CARTAGO',        'Cartago (genérico)  · CTG'],
    ]},
    { label: '— El Cerrito —', opts: [
      ['EL CERRITO VALLEJO',   'Vallejo  · ECV'],
      ['EL CERRITO EXITO 1',   'Éxito 1  · CE1'],
      ['EL CERRITO EXITO 2',   'Éxito 2  · CE2'],
      ['EL CERRITO EXITO 3',   'Éxito 3  · CE3'],
      ['EL CERRITO',           'El Cerrito (genérico)  · ECE'],
    ]},
    { label: '— Ginebra —', opts: [
      ['GINEBRA EXITO 4', 'Éxito 4  · GN4'],
      ['GINEBRA EXITO 5', 'Éxito 5  · GN5'],
    ]},
    { label: '— Jamundí —', opts: [
      ['JAMUNDI',           'Jamundí (principal)  · JMD'],
      ['ALPHAHEALTH JAMUNDI','Alphahealth  · JMA'],
    ]},
    { label: '— Palmira —', opts: [
      ['PALMIRA',              'Palmira (principal)  · PLM'],
      ['PALMIRA A SU SALUD',   'A Su Salud  · PLS'],
    ]},
    { label: '— Roldanillo —', opts: [
      ['ROLDANILLO FOMAG', 'Roldanillo Fomag  · RLF'],
      ['ROLDANILLO JM',    'J&M Urgencias  · RJM'],
    ]},
    { label: '— Tuluá —', opts: [
      ['TULUA',              'Tuluá (principal)  · TLU'],
      ['TULUA SAMARITANA',   'Samaritana  · TLS'],
      ['TULUA FARMAPRECIOS', 'Farmaprecios  · TLF'],
    ]},
    { label: '— Yumbo —', opts: [
      ['YUMBO',            'Yumbo (principal)  · YMB'],
      ['YUMBO RAPI DROGAS','Rapi Drogas  · YRD'],
      ['BODEGA YUMBO',     'Bodega Yumbo  · BOD'],
    ]},
    { label: '— Otros Valle del Cauca —', opts: [
      ['ALCALA','Alcalá'],['ANDALUCIA','Andalucía'],['ANSERMANUEVO','Ansermanuevo'],
      ['BUGALAGRANDE','Bugalagrande'],['CAICEDONIA','Caicedonia'],['CALIMA','Calima'],
      ['DAGUA','Dagua'],['EL AGUILA','El Águila'],['EL DOVIO','El Dovio'],
      ['FLORIDA','Florida'],['GUACARI','Guacarí'],['LA CUMBRE','La Cumbre'],
      ['LA UNION VALLE','La Unión Valle'],['LA VICTORIA','La Victoria'],['OBANDO','Obando'],
      ['PRADERA','Pradera'],['RESTREPO','Restrepo'],['RIOFRIO','Riofrío'],
      ['SAN PEDRO','San Pedro'],['SELIA','Selia'],['SEVILLA','Sevilla'],
      ['TORO','Toro'],['TRUJILLO','Trujillo'],['ULLOA','Ulloa'],
      ['VERSALLES','Versalles'],['VIJES','Vijes'],['YOTOCO','Yotoco'],['ZARZAL','Zarzal'],
    ]},
  ];

  const optionsHTML = grupos.map(g => `
    <optgroup label="${esc(g.label)}">
      ${g.opts.map(([val, lbl]) => `<option value="${esc(val)}" ${value === val ? 'selected' : ''}>${esc(lbl)}</option>`).join('')}
    </optgroup>`).join('');

  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">Sede *</label>
    <select name="sede_placa" id="inv-sede-placa" class="form-control" required>
      <option value="">— Seleccionar sede —</option>
      ${optionsHTML}
    </select>
  </div>`;
}

function areaSelectField(value = '') {
  const opts = Object.entries(AREA_MAPPINGS)
    .map(([k, { label }]) => `<option value="${k}" ${value === k ? 'selected' : ''}>${label}</option>`)
    .join('');
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">Área</label>
    <select name="area" class="form-control">
      <option value="">— Seleccionar área —</option>
      ${opts}
    </select>
  </div>`;
}

function bodegaInputField(value = '') {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">Sede / Bodega</label>
    <input type="text" name="ciudad" id="inv-input-ciudad" class="form-control" value="${esc(value)}" placeholder="Buscar sede…">
  </div>`;
}

export function comboField(label, name, value = '', options = []) {
  const id   = `combo-${name}-${Math.random().toString(36).slice(2,7)}`;
  const opts = options.filter(o => o !== 'Otro').map(o => `<option value="${esc(o)}">`).join('');
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <input type="text" name="${name}" class="form-control" value="${esc(value)}" list="${id}" autocomplete="off" ${label.includes('*')?'required':''}>
    <datalist id="${id}">${opts}</datalist>
  </div>`;
}

export function inputField(label, name, value = '', type = 'text') {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <input type="${type}" name="${name}" class="form-control" value="${esc(value)}" ${label.includes('*')?'required':''}>
  </div>`;
}

export function selectField(label, name, value, options) {
  const opts = options.map(o => `<option value="${esc(o)}" ${value===o?'selected':''}>${esc(o)}</option>`).join('');
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <select name="${name}" class="form-control">
      <option value="">— Seleccionar —</option>
      ${opts}
    </select>
  </div>`;
}

export function scanField(label, name, value = '', required = false, showScan = true) {
  return `
  <div class="form-group">
    <label style="font-size:12px;font-weight:500;color:var(--text-muted);margin-bottom:4px;display:block;">${esc(label)}</label>
    <div style="display:flex;gap:6px;">
      <input type="text" name="${name}" id="scan-input-${name}" class="form-control" value="${esc(value)}" ${required?'required':''} style="flex:1;">
      ${showScan ? `<button type="button" class="btn-scan" data-target="scan-input-${name}"
        style="padding:0 10px;background:var(--primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:16px;flex-shrink:0;"
        title="Escanear código de barras">📷</button>` : ''}
    </div>
  </div>`;
}

export async function openGenerarEnlaceModal() {
  const modalWrap = document.getElementById('inv-modal-wrap');
  modalWrap.innerHTML = `
    <div class="modal-overlay" style="display:flex;" id="enlace-overlay">
      <div class="modal-content" style="max-width:520px;">
        <div class="modal-header">
          <h3>📲 Generar enlace de registro móvil</h3>
          <button class="modal-close" id="btn-enlace-close">&times;</button>
        </div>
        <div class="modal-body" id="enlace-body">

          <!-- Paso 1: configurar -->
          <div id="enlace-step1">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:18px;">
              Genera un enlace o QR para que tus compañeros registren equipos desde el celular — sin necesidad de iniciar sesión.
            </p>
            <div class="form-group" style="margin-bottom:14px;">
              <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Tipo de registro</label>
              <div style="display:flex;gap:10px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;">
                  <input type="radio" name="enlace-tipo" value="equipos" checked> ${iconMonitor(13)} Equipos
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;">
                  <input type="radio" name="enlace-tipo" value="celulares"> ${iconSmartphone(13)} Celulares
                </label>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Nombre / etiqueta (opcional)</label>
              <input type="text" id="enlace-label" class="form-control" placeholder="Ej: Bodega Bogotá, Inventario junio…">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
              <div class="form-group">
                <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Vence en</label>
                <select id="enlace-expires" class="form-control">
                  <option value="">Sin límite de tiempo</option>
                  <option value="24">24 horas</option>
                  <option value="72">3 días</option>
                  <option value="168" selected>7 días</option>
                  <option value="720">30 días</option>
                </select>
              </div>
              <div class="form-group">
                <label style="font-size:12px;font-weight:500;color:var(--text-muted);display:block;margin-bottom:6px;">Máx. registros</label>
                <select id="enlace-uses" class="form-control">
                  <option value="">Sin límite</option>
                  <option value="10">10 usos</option>
                  <option value="25">25 usos</option>
                  <option value="50" selected>50 usos</option>
                  <option value="100">100 usos</option>
                </select>
              </div>
            </div>
            <div id="enlace-step1-err" style="display:none;color:var(--danger);font-size:13px;margin-bottom:12px;"></div>
            <button class="btn btn-primary" id="btn-enlace-generar" style="width:100%;">Generar enlace y QR</button>
          </div>

          <!-- Paso 2: resultado -->
          <div id="enlace-step2" style="display:none;">
            <div style="text-align:center;margin-bottom:18px;">
              <div style="font-size:13px;color:var(--text-2);margin-bottom:12px;">Escanea este QR o comparte el enlace</div>
              <img id="enlace-qr-img" src="" alt="QR" style="border-radius:12px;background:#fff;padding:8px;width:200px;height:200px;display:block;margin:0 auto;">
            </div>
            <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:14px;">
              <input type="text" id="enlace-url" class="form-control" readonly style="flex:1;font-size:12px;font-family:monospace;background:transparent;border:none;padding:0;">
              <button class="btn btn-secondary btn-small" id="btn-enlace-copy">Copiar</button>
            </div>
            <p style="font-size:12px;color:var(--text-3);text-align:center;margin-bottom:16px;" id="enlace-info"></p>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary" id="btn-enlace-nuevo" style="flex:1;">Crear otro</button>
              <button class="btn btn-primary"   id="btn-enlace-done"  style="flex:1;">Listo</button>
            </div>
          </div>

        </div>
      </div>
    </div>`;

  const overlay = modalWrap.querySelector('#enlace-overlay');
  const close   = () => overlay.remove();
  document.getElementById('btn-enlace-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('btn-enlace-done').addEventListener('click', close);

  document.getElementById('btn-enlace-nuevo').addEventListener('click', () => {
    document.getElementById('enlace-step2').style.display = 'none';
    document.getElementById('enlace-step1').style.display = '';
  });

  document.getElementById('btn-enlace-copy').addEventListener('click', async () => {
    const url = document.getElementById('enlace-url').value;
    const ok = await copyToClipboard(url);
    if (ok) {
      document.getElementById('btn-enlace-copy').textContent = '✓ Copiado';
      setTimeout(() => { document.getElementById('btn-enlace-copy').textContent = 'Copiar'; }, 2000);
    } else {
      showToast('No se pudo copiar el enlace', 'error');
    }
  });

  document.getElementById('btn-enlace-generar').addEventListener('click', async () => {
    const tipo         = document.querySelector('input[name="enlace-tipo"]:checked')?.value || 'equipos';
    const label        = document.getElementById('enlace-label').value.trim();
    const expires_hours= document.getElementById('enlace-expires').value || null;
    const max_uses     = document.getElementById('enlace-uses').value || null;
    const errEl        = document.getElementById('enlace-step1-err');
    const btn          = document.getElementById('btn-enlace-generar');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Generando…';

    try {
      const res  = await fetch('/api/inventario/registro-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tipo, label: label || null, expires_hours, max_uses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      document.getElementById('enlace-url').value = data.url;
      document.getElementById('enlace-qr-img').src = `/api/inventario/registro-qr/${data.token}`;

      const parts = [];
      if (expires_hours) parts.push(`Vence en ${expires_hours >= 168 ? (expires_hours/168)+'d' : expires_hours+'h'}`);
      if (max_uses)      parts.push(`Máx. ${max_uses} registros`);
      document.getElementById('enlace-info').textContent = parts.join(' · ') || 'Sin límites';

      document.getElementById('enlace-step1').style.display = 'none';
      document.getElementById('enlace-step2').style.display = '';
    } catch (err) {
      errEl.textContent  = err.message || 'Error al generar el enlace.';
      errEl.style.display = '';
    } finally {
      btn.disabled = false; btn.textContent = 'Generar enlace y QR';
    }
  });
}
