/**
 * tech-request-form.js
 *
 * Handles:
 *  - openModal(defaultType, onSuccess)    — Nueva solicitud
 *  - openEditModal(id, onSuccess)         — Editar solicitud
 *  - _esc(str)                            — helper interno compartido
 */
import { showToast, attachSedeSearch } from './components.js';
import { AREA_MAPPINGS } from './app.js';
import {
  iconNote, iconPlus, iconClose, iconEdit,
  iconClipboard, iconWrench, iconCopy, iconSave,
} from './icons.js';

const toTitleCase    = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const toSentenceCase = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };

export function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Item list renderer (shared by create & edit) ─────────────────────── */
function renderItemList(cont, modalItems) {
  cont.innerHTML = modalItems.map((item, idx) => `
    <div class="tr-item-row">
      <input type="text" class="tr-item-name" data-idx="${idx}"
        value="${_esc(item.equipment_name)}" placeholder="Ej: Portátil, Monitor, Teclado…">
      <input type="number" class="tr-item-qty" data-idx="${idx}"
        value="${item.quantity}" min="1" style="text-align:center;">
      <input type="text" class="tr-item-serial" data-idx="${idx}"
        value="${_esc(item.serial)}" placeholder="Serial (opc.)">
      <button type="button" class="tr-item-dup" data-idx="${idx}"
        title="Duplicar fila"
        style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8;border-radius:6px;width:30px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;">${iconCopy(13)}</button>
      <button type="button" class="tr-item-remove" data-idx="${idx}"
        title="Quitar equipo"
        style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:var(--danger);border-radius:6px;width:30px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;${modalItems.length <= 1 ? 'opacity:.3;cursor:not-allowed;' : ''}"
        ${modalItems.length <= 1 ? 'disabled' : ''}>${iconClose(13)}</button>
    </div>`).join('');

  cont.querySelectorAll('.tr-item-name').forEach(inp => {
    inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].equipment_name = e.target.value; });
    inp.addEventListener('blur',  e => {
      e.target.value = toTitleCase(e.target.value.trim());
      modalItems[+e.target.dataset.idx].equipment_name = e.target.value;
    });
  });
  cont.querySelectorAll('.tr-item-qty').forEach(inp =>
    inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].quantity = parseInt(e.target.value) || 1; })
  );
  cont.querySelectorAll('.tr-item-serial').forEach(inp =>
    inp.addEventListener('input', e => { modalItems[+e.target.dataset.idx].serial = e.target.value; })
  );
  cont.querySelectorAll('.tr-item-dup').forEach(btn =>
    btn.addEventListener('click', e => {
      const idx = +e.currentTarget.dataset.idx;
      modalItems.splice(idx + 1, 0, { equipment_name: modalItems[idx].equipment_name, quantity: 1, serial: '' });
      renderItemList(cont, modalItems);
      cont.querySelectorAll('.tr-item-serial')[idx + 1]?.focus();
    })
  );
  cont.querySelectorAll('.tr-item-remove').forEach(btn =>
    btn.addEventListener('click', e => {
      const idx = +e.currentTarget.dataset.idx;
      if (modalItems.length > 1) { modalItems.splice(idx, 1); renderItemList(cont, modalItems); }
    })
  );
}

/* ── Shared modal HTML builders ───────────────────────────────────────── */

function solicitanteFields(r = {}) {
  return `
    <div class="tr-section">
      <div class="tr-section-title">Datos del solicitante</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label>Nombre completo *</label><input type="text" id="tr-f-name" value="${_esc(r.requester_name || '')}" placeholder="Nombre y apellido"></div>
        <div class="form-group"><label>Cédula *</label><input type="text" id="tr-f-cedula" value="${_esc(r.cedula || '')}" placeholder="Número de cédula"></div>
        <div class="form-group"><label>Cargo *</label><input type="text" id="tr-f-cargo" value="${_esc(r.cargo || '')}" placeholder="Ej: Auxiliar contable"></div>
        <div class="form-group"><label>Sede / Punto *</label><input type="text" id="tr-f-sede" value="${_esc(r.sede || '')}" placeholder="Ej: Sede Central, Clínica Norte…"></div>
      </div>
    </div>`;
}

function itemsSection(isReq, r = {}) {
  return `
    <div id="tr-f-items-section" class="tr-section" style="${!isReq ? 'display:none;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="tr-section-title" style="margin-bottom:0;">Equipos solicitados</div>
        <button type="button" id="tr-btn-add-item" style="display:inline-flex;align-items:center;gap:5px;">${iconPlus(12)} Agregar equipo</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 58px 1fr 30px 30px;gap:6px;padding:0 8px;margin-bottom:4px;">
        <span style="font-size:11px;color:#5a607a;">Nombre del equipo *</span>
        <span style="font-size:11px;color:#5a607a;text-align:center;">Cant.</span>
        <span style="font-size:11px;color:#5a607a;">Serial / Inv.</span>
        <span></span><span></span>
      </div>
      <div id="tr-f-items-list"></div>
    </div>
    <div id="tr-f-equipo-wrap" class="tr-section" style="${isReq ? 'display:none;' : ''}">
      <div class="tr-section-title">Equipo afectado</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group"><label>Nombre / tipo de equipo</label><input type="text" id="tr-f-equipo" value="${_esc(r.equipment_name || '')}" placeholder="Ej: Portátil Dell, Impresora…"></div>
        <div class="form-group"><label>Serial o inventario</label><input type="text" id="tr-f-serial" value="${_esc(r.equipment_serial || '')}" placeholder="Opcional"></div>
      </div>
    </div>`;
}

function descPrioSection(r = {}, hideQty = true) {
  return `
    <div class="tr-section">
      <div class="tr-section-title">Descripción y prioridad</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
        <div class="form-group"><label>Descripción *</label><textarea id="tr-f-desc" rows="3" style="resize:vertical;">${_esc(r.description || '')}</textarea></div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="form-group" id="tr-f-qty-wrap" style="${hideQty ? 'display:none;' : ''}">
            <label>Cantidad</label>
            <input type="number" id="tr-f-qty" value="${r.quantity || 1}" min="1">
          </div>
          <div class="form-group"><label>Prioridad</label>
            <select id="tr-f-priority">
              <option value="baja"   ${r.priority==='baja'   ?'selected':''}>🟢 Baja</option>
              <option value="media"  ${r.priority==='media'  ?'selected':(!r.priority?'selected':'')} >🟡 Media</option>
              <option value="alta"   ${r.priority==='alta'   ?'selected':''}>🟠 Alta</option>
              <option value="critica"${r.priority==='critica'?'selected':''}>🔴 Crítica</option>
            </select>
          </div>
        </div>
      </div>
    </div>`;
}

function wireModalCommon(overlay, modal, modalItems) {
  const closeModal = () => { overlay.style.display = 'none'; };
  document.getElementById('tr-modal-close').addEventListener('click', closeModal);
  document.getElementById('tr-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  attachSedeSearch(document.getElementById('tr-f-sede'));

  document.getElementById('tr-f-name')?.addEventListener('blur',  e => { e.target.value = toTitleCase(e.target.value.trim()); });
  document.getElementById('tr-f-cargo')?.addEventListener('blur', e => { e.target.value = toTitleCase(e.target.value.trim()); });
  document.getElementById('tr-f-equipo')?.addEventListener('blur',e => { e.target.value = toTitleCase(e.target.value.trim()); });
  document.getElementById('tr-f-desc')?.addEventListener('blur',  e => { e.target.value = toSentenceCase(e.target.value); });

  const cont = document.getElementById('tr-f-items-list');
  if (cont) {
    renderItemList(cont, modalItems);
    document.getElementById('tr-btn-add-item')?.addEventListener('click', () => {
      modalItems.push({ equipment_name: '', quantity: 1, serial: '' });
      renderItemList(cont, modalItems);
      const inputs = cont.querySelectorAll('.tr-item-name');
      inputs[inputs.length - 1]?.focus();
    });
  }

  return closeModal;
}

/* ── openModal — Nueva solicitud ──────────────────────────────────────── */

export function openModal(defaultType, onSuccess) {
  const overlay = document.getElementById('tr-modal-overlay');
  const modal   = document.getElementById('tr-modal');
  overlay.style.display = 'flex';

  let modalItems = [{ equipment_name: '', quantity: 1, serial: '' }];
  const isReq = defaultType === 'requerimiento';

  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(139,92,246,.12));margin:-32px -32px 24px;padding:24px 28px 20px;border-radius:16px 16px 0 0;border-bottom:1px solid rgba(99,102,241,.2);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;">${iconNote(18)}</div>
            <h3 style="font-size:18px;font-weight:700;color:#e2e8f0;">Nueva Solicitud</h3>
          </div>
          <p style="font-size:12px;color:#6b7a99;margin-left:46px;">Completa los datos para registrar el requerimiento o incidencia</p>
        </div>
        <button id="tr-modal-close" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);width:32px;height:32px;border-radius:8px;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center;transition:all .2s;">${iconClose(14)}</button>
      </div>
    </div>

    <div style="margin-bottom:4px;">
      <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Tipo de solicitud</div>
      <div style="display:flex;gap:12px;">
        <label class="tr-type-card ${isReq?'selected':''}" id="lbl-req" for="tr-type-req">
          <input type="radio" id="tr-type-req" name="tr-type" value="requerimiento" ${isReq?'checked':''} style="display:none;">
          <span class="tc-icon">${iconClipboard(22)}</span>
          <div><div class="tc-title">Requerimiento</div><div class="tc-desc">Solicitud de equipo nuevo</div></div>
        </label>
        <label class="tr-type-card ${!isReq?'selected':''}" id="lbl-inc" for="tr-type-inc">
          <input type="radio" id="tr-type-inc" name="tr-type" value="incidencia" ${!isReq?'checked':''} style="display:none;">
          <span class="tc-icon">${iconWrench(22)}</span>
          <div><div class="tc-title">Incidencia</div><div class="tc-desc">Falla o problema técnico</div></div>
        </label>
      </div>
    </div>

    ${solicitanteFields()}
    ${itemsSection(isReq)}
    ${descPrioSection({}, !isReq)}

    <div class="tr-modal-footer">
      <button class="btn btn-secondary" id="tr-modal-cancel" style="padding:10px 20px;">Cancelar</button>
      <button class="btn btn-primary" id="tr-modal-save" style="padding:10px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;display:inline-flex;align-items:center;gap:7px;">
        ${iconSave(14)} Guardar Solicitud
      </button>
    </div>`;

  const closeModal = wireModalCommon(overlay, modal, modalItems);

  // Toggle tipo
  modal.querySelectorAll('input[name="tr-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isR = modal.querySelector('input[name="tr-type"]:checked')?.value === 'requerimiento';
      document.getElementById('lbl-req').classList.toggle('selected',  isR);
      document.getElementById('lbl-inc').classList.toggle('selected', !isR);
      document.getElementById('tr-f-items-section').style.display = isR  ? 'block' : 'none';
      document.getElementById('tr-f-equipo-wrap').style.display   = isR  ? 'none'  : 'block';
      document.getElementById('tr-f-qty-wrap').style.display      = isR  ? 'none'  : 'block';
    });
  });

  document.getElementById('tr-modal-save').addEventListener('click', async () => {
    const type   = modal.querySelector('input[name="tr-type"]:checked')?.value;
    const name   = toTitleCase(document.getElementById('tr-f-name').value.trim());
    const cedula = document.getElementById('tr-f-cedula').value.trim();
    const cargo  = toTitleCase(document.getElementById('tr-f-cargo').value.trim());
    const sede   = document.getElementById('tr-f-sede').value.trim();
    const desc   = document.getElementById('tr-f-desc').value.trim();
    const prio   = document.getElementById('tr-f-priority').value;

    if (!type || !name || !cedula || !cargo || !sede || !desc) {
      showToast('Completa todos los campos obligatorios (*)', 'error'); return;
    }

    let bodyExtra = {};
    if (type === 'requerimiento') {
      const validItems = modalItems.filter(i => i.equipment_name.trim());
      if (!validItems.length) { showToast('Agrega al menos un equipo al requerimiento', 'error'); return; }
      bodyExtra = { items: validItems.map(i => ({ equipment_name: i.equipment_name.trim(), quantity: parseInt(i.quantity) || 1, serial: i.serial.trim() || null })) };
    } else {
      bodyExtra = {
        equipment_name:   document.getElementById('tr-f-equipo').value.trim() || null,
        equipment_serial: document.getElementById('tr-f-serial').value.trim() || null,
        quantity:         parseInt(document.getElementById('tr-f-qty').value) || 1,
      };
    }

    const btn = document.getElementById('tr-modal-save');
    btn.textContent = 'Guardando…'; btn.disabled = true;

    try {
      const res  = await fetch('/api/tech-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, requester_name: name, cedula, cargo, sede, description: desc, priority: prio, ...bodyExtra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      showToast(`✅ Solicitud ${data.request_number} creada`, 'success');
      closeModal();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = `${iconSave(14)} Guardar Solicitud`; btn.disabled = false;
    }
  });
}

/* ── openEditModal — Editar solicitud ─────────────────────────────────── */

export async function openEditModal(id, onSuccess) {
  let record;
  try {
    const res = await fetch(`/api/tech-requests/${id}`);
    if (!res.ok) throw new Error('No se pudo cargar la solicitud.');
    record = await res.json();
  } catch (err) { showToast(err.message, 'error'); return; }

  const overlay = document.getElementById('tr-modal-overlay');
  const modal   = document.getElementById('tr-modal');
  overlay.style.display = 'flex';

  const isReq = record.type === 'requerimiento';
  let modalItems = (record.items?.length)
    ? record.items.map(i => ({ equipment_name: i.equipment_name, quantity: i.quantity, serial: i.serial || '' }))
    : [{ equipment_name: '', quantity: 1, serial: '' }];

  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(245,158,11,.18),rgba(234,88,12,.12));margin:-32px -32px 24px;padding:24px 28px 20px;border-radius:16px 16px 0 0;border-bottom:1px solid rgba(245,158,11,.2);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;">${iconEdit(18)}</div>
            <h3 style="font-size:18px;font-weight:700;color:#e2e8f0;">Editar Solicitud</h3>
          </div>
          <p style="font-size:12px;color:#6b7a99;margin-left:46px;">${record.request_number} — modifica los datos y guarda los cambios</p>
        </div>
        <button id="tr-modal-close" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);width:32px;height:32px;border-radius:8px;cursor:pointer;color:#94a3b8;display:flex;align-items:center;justify-content:center;">${iconClose(14)}</button>
      </div>
    </div>

    ${solicitanteFields(record)}
    ${itemsSection(isReq, record)}
    ${descPrioSection(record, true)}

    <div class="tr-modal-footer">
      <button class="btn btn-secondary" id="tr-modal-cancel" style="padding:10px 20px;">Cancelar</button>
      <button class="btn btn-primary" id="tr-modal-save"
        style="padding:10px 24px;background:linear-gradient(135deg,#f59e0b,#ea580c);border:none;display:inline-flex;align-items:center;gap:7px;">
        ${iconSave(14)} Guardar Cambios
      </button>
    </div>`;

  const closeModal = wireModalCommon(overlay, modal, modalItems);

  document.getElementById('tr-modal-save').addEventListener('click', async () => {
    const name   = toTitleCase(document.getElementById('tr-f-name').value.trim());
    const cedula = document.getElementById('tr-f-cedula').value.trim();
    const cargo  = toTitleCase(document.getElementById('tr-f-cargo').value.trim());
    const sede   = document.getElementById('tr-f-sede').value.trim();
    const desc   = toSentenceCase(document.getElementById('tr-f-desc').value);
    const prio   = document.getElementById('tr-f-priority').value;

    if (!name || !cedula || !cargo || !sede || !desc) {
      showToast('Completa todos los campos obligatorios (*)', 'error'); return;
    }

    let bodyExtra = {};
    if (isReq) {
      const validItems = modalItems.filter(i => i.equipment_name.trim());
      if (!validItems.length) { showToast('Agrega al menos un equipo al requerimiento', 'error'); return; }
      bodyExtra = { items: validItems.map(i => ({ equipment_name: i.equipment_name.trim(), quantity: parseInt(i.quantity) || 1, serial: i.serial.trim() || null })) };
    } else {
      bodyExtra = {
        equipment_name:   toTitleCase((document.getElementById('tr-f-equipo')?.value || '').trim()) || null,
        equipment_serial: document.getElementById('tr-f-serial')?.value.trim() || null,
      };
    }

    const btn = document.getElementById('tr-modal-save');
    btn.textContent = 'Guardando…'; btn.disabled = true;

    try {
      const res = await fetch(`/api/tech-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_name: name, cedula, cargo, sede, description: desc, priority: prio, agentName: 'Agente', ...bodyExtra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      showToast('✅ Solicitud actualizada', 'success');
      closeModal();
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.innerHTML = `${iconSave(14)} Guardar Cambios`; btn.disabled = false;
    }
  });
}
