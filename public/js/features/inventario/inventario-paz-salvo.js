/**
 * Paz y salvo: busca a una persona, muestra todo lo que tiene asignado en el inventario
 * (computadores y demás categorías, celulares, UPS) y descarga el acta de devolución en Word.
 * No modifica el inventario.
 */
import { showToast } from '../../ui/components.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let _elementos = [];

/** @param {{cedula, nombre}} [persona] si se indica, abre directo con lo asignado a esa persona. */
export function openPazSalvoModal(persona = null) {
  document.getElementById('inv-paz-salvo-modal')?.remove();
  _elementos = [];

  const overlay = document.createElement('div');
  overlay.id = 'inv-paz-salvo-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
  overlay.innerHTML = `
    <div class="ps-box">
      <div class="ps-head">
        <div>
          <h3>Paz y salvo</h3>
          <p>Busca a la persona que se retira para ver lo que tiene asignado y descargar el acta.</p>
        </div>
        <button class="modal-close" id="ps-close" title="Cerrar">&times;</button>
      </div>
      <div class="ps-body">
        <input type="search" id="ps-q" class="form-control" placeholder="Cédula o nombre (mínimo 3 caracteres)" autocomplete="off">
        <div id="ps-personas" class="ps-personas"></div>
        <div id="ps-detalle"></div>
      </div>
    </div>
    <style>
      #inv-paz-salvo-modal .ps-box { background:var(--surface);border-radius:16px;width:100%;max-width:820px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.4); }
      #inv-paz-salvo-modal .ps-head { display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 22px;border-bottom:1px solid var(--border); }
      #inv-paz-salvo-modal .ps-head h3 { margin:0 0 4px;font-size:17px; }
      #inv-paz-salvo-modal .ps-head p { margin:0;font-size:12.5px;color:var(--text-3); }
      #inv-paz-salvo-modal .ps-body { padding:18px 22px; }
      #inv-paz-salvo-modal .ps-personas { margin-top:8px;display:flex;flex-direction:column;gap:6px; }
      #inv-paz-salvo-modal .ps-persona { display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left;width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2, transparent);color:var(--text);cursor:pointer;font-size:13px; }
      #inv-paz-salvo-modal .ps-persona:hover { border-color:var(--primary); }
      #inv-paz-salvo-modal .ps-persona small { color:var(--text-3); }
      #inv-paz-salvo-modal .ps-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0; }
      #inv-paz-salvo-modal .ps-grid label { font-size:11.5px;color:var(--text-3);display:block;margin-bottom:3px; }
      #inv-paz-salvo-modal .ps-tabla-wrap { overflow-x:auto;border:1px solid var(--border);border-radius:10px; }
      #inv-paz-salvo-modal table { width:100%;border-collapse:collapse;font-size:12.5px; }
      #inv-paz-salvo-modal th, #inv-paz-salvo-modal td { padding:7px 9px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top; }
      #inv-paz-salvo-modal th { font-size:11px;color:var(--text-3);font-weight:600;white-space:nowrap; }
      #inv-paz-salvo-modal td .sub { color:var(--text-3);font-size:11.5px; }
      #inv-paz-salvo-modal td input[type=text] { width:100%;min-width:120px;font-size:12px;padding:4px 6px; }
      #inv-paz-salvo-modal .ps-estado { margin:12px 0;padding:10px 12px;border-radius:10px;font-size:13px; }
      #inv-paz-salvo-modal .ps-ok { background:rgba(34,197,94,.12);color:var(--success, #16a34a); }
      #inv-paz-salvo-modal .ps-pend { background:rgba(239,68,68,.12);color:var(--danger); }
      #inv-paz-salvo-modal .ps-foot { display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap; }
    </style>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#ps-close').onclick = () => overlay.remove();
  const q = overlay.querySelector('#ps-q');
  let t;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => _buscar(q.value.trim()), 350); });
  if (persona) { q.value = persona.cedula || persona.nombre || ''; _seleccionar(persona); }
  else q.focus();
}

async function _buscar(texto) {
  const cont = document.getElementById('ps-personas');
  document.getElementById('ps-detalle').innerHTML = '';
  if (texto.length < 3) { cont.innerHTML = ''; return; }
  cont.innerHTML = '<span style="font-size:12px;color:var(--text-3);">Buscando…</span>';
  try {
    const r = await fetch(`/api/inventario/paz-salvo/personas?q=${encodeURIComponent(texto)}`);
    const { personas = [] } = await r.json();
    if (!personas.length) {
      cont.innerHTML = `<div style="font-size:12.5px;color:var(--text-3);">Nadie con equipos asignados coincide con "${esc(texto)}".
        <button class="btn btn-secondary" id="ps-sin-equipos" style="margin-left:6px;padding:4px 10px;font-size:12px;">Generar paz y salvo sin equipos</button></div>`;
      document.getElementById('ps-sin-equipos').onclick = () => _seleccionar({ nombre: /\d/.test(texto) ? '' : texto, cedula: /^\d[\d.\s]*$/.test(texto) ? texto.replace(/\D/g, '') : '' }, true);
      return;
    }
    cont.innerHTML = personas.map((p, i) => `
      <button class="ps-persona" data-i="${i}">
        <span><strong>${esc(p.nombre || 'Sin nombre')}</strong> ${p.cedula ? `<small>· C.C. ${esc(p.cedula)}</small>` : '<small>· sin cédula</small>'}</span>
        <small>${p.elementos} elemento${p.elementos === 1 ? '' : 's'}</small>
      </button>`).join('');
    cont.querySelectorAll('.ps-persona').forEach(b => { b.onclick = () => _seleccionar(personas[Number(b.dataset.i)]); });
  } catch { cont.innerHTML = '<span style="font-size:12px;color:var(--danger);">Error de conexión.</span>'; }
}

async function _seleccionar(persona, sinEquipos = false) {
  document.getElementById('ps-personas').innerHTML = '';
  const det = document.getElementById('ps-detalle');
  det.innerHTML = '<span style="font-size:12px;color:var(--text-3);">Cargando…</span>';
  _elementos = [];
  if (!sinEquipos) {
    try {
      const params = new URLSearchParams();
      if (persona.cedula) params.set('cedula', persona.cedula);
      if (persona.nombre) params.set('nombre', persona.nombre);
      const r = await fetch(`/api/inventario/paz-salvo/asignados?${params}`);
      _elementos = ((await r.json()).elementos || []).map(e => ({ ...e, devuelto: true, observacion: '' }));
    } catch { det.innerHTML = '<span style="font-size:12px;color:var(--danger);">Error de conexión.</span>'; return; }
  }
  const area = [...new Set(_elementos.map(e => e.area || e.sede).filter(Boolean))].join(', ');

  det.innerHTML = `
    <div class="ps-grid">
      <div><label>Nombres y apellidos *</label><input type="text" id="ps-nombre" class="form-control" value="${esc(persona.nombre)}"></div>
      <div><label>Cédula</label><input type="text" id="ps-cedula" class="form-control" value="${esc(persona.cedula)}" inputmode="numeric"></div>
      <div><label>Cargo</label><input type="text" id="ps-cargo" class="form-control" placeholder="Opcional"></div>
      <div><label>Área / Sede</label><input type="text" id="ps-area" class="form-control" value="${esc(area)}"></div>
      <div><label>Fecha de retiro</label><input type="date" id="ps-fecha" class="form-control" value="${hoy()}"></div>
    </div>
    ${_elementos.length ? `
      <div style="font-size:12.5px;color:var(--text-2);margin-bottom:6px;">Desmarca lo que la persona <strong>no</strong> devolvió; saldrá como "Pendiente" en el acta.</div>
      <div class="ps-tabla-wrap"><table>
        <thead><tr><th>Devuelto</th><th>Tipo</th><th>Equipo</th><th>Placa</th><th>Serial / IMEI</th><th>Observación</th></tr></thead>
        <tbody>${_elementos.map((e, i) => `
          <tr>
            <td><input type="checkbox" class="ps-dev" data-i="${i}" checked></td>
            <td>${esc(e.tipo)}</td>
            <td>${esc(e.descripcion)}${e.marca || e.modelo ? `<div class="sub">${esc([e.marca, e.modelo].filter(Boolean).join(' '))}</div>` : ''}${e.detalle ? `<div class="sub">${esc(e.detalle)}</div>` : ''}</td>
            <td>${esc(e.placa || '—')}</td>
            <td>${esc(e.serial || '—')}</td>
            <td><input type="text" class="form-control ps-obs" data-i="${i}" maxlength="300" placeholder="Ej: sin cargador"></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`
    : '<div style="font-size:13px;color:var(--text-2);">No registra equipos asignados en el inventario de Sistemas.</div>'}
    <div id="ps-estado" class="ps-estado"></div>
    <div class="form-group" style="margin:0;"><label style="font-size:11.5px;color:var(--text-3);">Observaciones generales</label>
      <textarea id="ps-obs-gral" class="form-control" rows="2" maxlength="1000" placeholder="Opcional"></textarea></div>
    <div class="ps-foot">
      <button class="btn btn-secondary" id="ps-otra">Buscar otra persona</button>
      <button class="btn btn-primary" id="ps-descargar">Descargar acta (Word)</button>
    </div>`;

  det.querySelectorAll('.ps-dev').forEach(c => c.addEventListener('change', () => { _elementos[Number(c.dataset.i)].devuelto = c.checked; _pintarEstado(); }));
  det.querySelectorAll('.ps-obs').forEach(c => c.addEventListener('input', () => { _elementos[Number(c.dataset.i)].observacion = c.value; }));
  document.getElementById('ps-otra').onclick = () => { det.innerHTML = ''; const q = document.getElementById('ps-q'); q.value = ''; q.focus(); };
  document.getElementById('ps-descargar').onclick = _descargar;
  _pintarEstado();
}

function _pintarEstado() {
  const pend = _elementos.filter(e => !e.devuelto).length;
  const el = document.getElementById('ps-estado');
  el.className = `ps-estado ${pend ? 'ps-pend' : 'ps-ok'}`;
  el.textContent = pend
    ? `Tiene ${pend} elemento${pend === 1 ? '' : 's'} pendiente${pend === 1 ? '' : 's'}: el acta dirá que NO está a paz y salvo.`
    : 'Todo devuelto: el acta certificará que está a PAZ Y SALVO con Sistemas.';
}

async function _descargar() {
  const nombre = document.getElementById('ps-nombre').value.trim();
  if (!nombre) { showToast('Escribe el nombre del colaborador.', 'error'); return; }
  const btn = document.getElementById('ps-descargar');
  btn.disabled = true;
  try {
    const r = await fetch('/api/inventario/paz-salvo/acta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        cedula: document.getElementById('ps-cedula').value.trim(),
        cargo: document.getElementById('ps-cargo').value.trim(),
        area: document.getElementById('ps-area').value.trim(),
        fecha_retiro: document.getElementById('ps-fecha').value,
        observaciones: document.getElementById('ps-obs-gral').value.trim(),
        elementos: _elementos.map(e => ({ tabla: e.tabla, id: e.id, devuelto: e.devuelto, observacion: e.observacion })),
      }),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); showToast(e.error || 'No se pudo generar el acta.', 'error'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = `Paz y salvo - ${nombre}.docx`.replace(/[\\/:*?"<>|]/g, '');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    showToast('Acta descargada.', 'success');
  } catch { showToast('Error de conexión.', 'error'); }
  finally { btn.disabled = false; }
}
