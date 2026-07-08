import { AREA_MAPPINGS } from '../../core/app.js';
import { showToast, attachPuntoSearch } from '../../ui/components.js';
import { fetchDespacho, updateDespacho } from './despacho-helpers.js';

const _tc = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const _sc = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };

export async function openEditDespachoModal(id, onSuccess) {
  let d;
  try { d = await fetchDespacho(id); }
  catch (err) { showToast(err.message, 'error'); return; }

  let articulos = [];
  try { articulos = JSON.parse(d.articulos || '[]'); } catch {}

  const areaOptions = Object.entries(AREA_MAPPINGS)
    .map(([v, { label }]) => `<option value="${v}" ${d.area === v ? 'selected' : ''}>${label}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:32px;width:100%;max-width:680px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div id="edit-modal-close" style="position:absolute;top:14px;right:14px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);cursor:pointer;color:var(--text-2);font-size:16px;">✕</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">✏️</div>
        <div>
          <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Editar Despacho</h2>
          <p style="margin:2px 0 0;font-size:12px;color:var(--text-3);">${d.numero} — modifica los datos y guarda los cambios</p>
        </div>
      </div>
      <form id="form-edit-despacho">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Destinatario *</label>
            <input name="destinatario" required type="text" value="${d.destinatario || ''}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Cédula</label>
            <input name="cedula" type="text" value="${d.cedula || ''}" placeholder="Número de cédula"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Sede</label>
            <input name="sede" type="text" value="${d.sede || ''}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Área</label>
            <select name="area" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">Selecciona área...</option>${areaOptions}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">
              Fecha de envío <span style="font-weight:400;color:var(--text-3);">(opcional)</span>
            </label>
            <input name="fecha" type="date" value="${d.fecha || ''}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-2);">Artículos *</label>
            <div style="display:flex;gap:6px;">
              <button type="button" id="btn-from-inventario" style="font-size:12px;padding:4px 10px;border:1px solid var(--primary);border-radius:6px;background:var(--primary-light,rgba(99,102,241,.1));color:var(--primary);cursor:pointer;">📦 Del inventario</button>
              <button type="button" id="btn-add-art-edit" style="font-size:12px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;">+ Agregar fila</button>
            </div>
          </div>
          <div id="inv-picker" style="display:none;border:1px solid var(--primary);border-radius:8px;background:var(--surface-2);padding:12px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:600;color:var(--primary);">Inventario reciente</span>
              <button type="button" id="btn-close-inv-picker" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;line-height:1;">✕</button>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
              <input id="inv-picker-search" type="text" placeholder="Buscar por placa, serial, marca, modelo…"
                style="flex:1;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
              <select id="inv-picker-tipo" style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;cursor:pointer;">
                <option value="equipos">Equipos</option>
                <option value="celulares">Celulares</option>
                <option value="ups">UPS</option>
              </select>
            </div>
            <div id="inv-picker-list" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
              <span id="inv-picker-count" style="font-size:11px;color:var(--text-3);">0 seleccionados</span>
              <button type="button" id="btn-add-from-inv" disabled
                style="font-size:12px;padding:5px 14px;border:none;border-radius:6px;background:var(--primary);color:#fff;cursor:pointer;opacity:.4;">Agregar al despacho</button>
            </div>
          </div>
          <div id="arts-list-edit" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Accesorios</label>
          <textarea name="observaciones" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;resize:vertical;box-sizing:border-box;">${d.observaciones || ''}</textarea>
        </div>
        <div style="margin-bottom:20px;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="edit-check-acta" name="requiere_acta" style="width:16px;height:16px;" ${d.requiere_acta ? 'checked' : ''}>
          <label for="edit-check-acta" style="font-size:13px;font-weight:500;color:var(--text);cursor:pointer;">¿Requiere acta de entrega?</label>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" id="btn-cancel-edit" class="btn btn-secondary">Cancelar</button>
          <button type="submit" id="btn-submit-edit" class="btn btn-primary" style="background:linear-gradient(135deg,#f59e0b,#ea580c);border:none;">💾 Guardar Cambios</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  attachPuntoSearch(overlay.querySelector('input[name="sede"]'));

  overlay.querySelector('[name="destinatario"]').addEventListener('blur', e => { e.target.value = e.target.value.trim().toUpperCase(); });
  overlay.querySelector('[name="observaciones"]').addEventListener('blur', e => { e.target.value = _sc(e.target.value); });

  const closeEdit = () => overlay.remove();
  overlay.querySelector('#edit-modal-close').onclick  = closeEdit;
  overlay.querySelector('#btn-cancel-edit').onclick   = closeEdit;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeEdit(); });

  let rowCount = 0;

  function buildArtRow(art = {}, isFirst = false) {
    const i = rowCount++;
    return `<div class="art-row-edit" style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface-2);display:flex;flex-direction:column;gap:8px;">
      <div style="display:grid;grid-template-columns:1fr 70px auto auto;gap:8px;align-items:center;">
        <input data-field="nombre"   type="text" value="${art.nombre||''}" placeholder="Nombre del artículo *" required style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="cantidad" type="number" min="1" value="${art.cantidad||1}" style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;text-align:center;">
        <button type="button" class="btn-dup-art" style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);cursor:pointer;" title="Duplicar">📋</button>
        <button type="button" class="btn-rem-art" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--danger);cursor:pointer;${isFirst?'visibility:hidden;':''}" title="Eliminar">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
        <input data-field="marca"       type="text" value="${art.marca||''}"       placeholder="Marca"        style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
        <input data-field="modelo"      type="text" value="${art.modelo||''}"      placeholder="Modelo"       style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
        <input data-field="serial"      type="text" value="${art.serial||''}"      placeholder="Serial"       style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
        <input data-field="descripcion" type="text" value="${art.descripcion||''}" placeholder="Descripción"  style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
      </div>
    </div>`;
  }

  function wireArtRow(row) {
    row.querySelector('.btn-rem-art')?.addEventListener('click', function () { this.closest('.art-row-edit').remove(); });
    row.querySelector('.btn-dup-art')?.addEventListener('click', function () {
      const curr    = this.closest('.art-row-edit');
      const artData = { nombre: curr.querySelector('[data-field="nombre"]').value, cantidad: curr.querySelector('[data-field="cantidad"]').value, marca: curr.querySelector('[data-field="marca"]').value, modelo: curr.querySelector('[data-field="modelo"]').value, serial: curr.querySelector('[data-field="serial"]').value, descripcion: curr.querySelector('[data-field="descripcion"]').value };
      const div     = document.createElement('div');
      div.innerHTML = buildArtRow(artData, false);
      const newRow  = div.firstElementChild;
      curr.insertAdjacentElement('afterend', newRow);
      wireArtRow(newRow);
    });
    ['nombre','marca','modelo'].forEach(f => {
      row.querySelector(`[data-field="${f}"]`)?.addEventListener('blur', e => { e.target.value = _tc(e.target.value.trim()); });
    });
  }

  const artsList = overlay.querySelector('#arts-list-edit');
  (articulos.length ? articulos : [{}]).forEach((art, idx) => {
    const div = document.createElement('div');
    div.innerHTML = buildArtRow(art, idx === 0);
    const row = div.firstElementChild;
    artsList.appendChild(row);
    wireArtRow(row);
  });

  overlay.querySelector('#btn-add-art-edit').onclick = () => {
    const div = document.createElement('div');
    div.innerHTML = buildArtRow({}, false);
    const row = div.firstElementChild;
    artsList.appendChild(row);
    wireArtRow(row);
    row.querySelector('[data-field="nombre"]')?.focus();
  };

  // ── Inventory picker ──────────────────────────────────────────────────────
  const invPicker     = overlay.querySelector('#inv-picker');
  const invList       = overlay.querySelector('#inv-picker-list');
  const invSearch     = overlay.querySelector('#inv-picker-search');
  const invTipo       = overlay.querySelector('#inv-picker-tipo');
  const invCount      = overlay.querySelector('#inv-picker-count');
  const btnAddFromInv = overlay.querySelector('#btn-add-from-inv');
  let   invItems      = [];
  let   invSelected   = new Set();

  function renderInvList(items) {
    if (!items.length) {
      invList.innerHTML = `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text-3);">Sin resultados</div>`;
      return;
    }
    const tipo = invTipo.value;
    invList.innerHTML = items.map(it => {
      const id    = it.id;
      const label = tipo === 'celulares'
        ? `<b>${it.equipo || it.modelo || '—'}</b> &nbsp;<span style="color:var(--text-3)">${it.marca || ''}</span>`
        : `<b>${it.nombre_equipo || '—'}</b> &nbsp;<span style="color:var(--text-3)">${it.marca || ''}</span>`;
      const sub   = tipo === 'celulares'
        ? `IMEI: ${it.imei || '—'}${it.serial ? ` · S/N: ${it.serial}` : ''}`
        : `${it.placa ? `<span style="font-family:monospace;color:var(--primary);">${it.placa}</span> · ` : ''}Serial: ${it.serial || '—'}${tipo === 'ups' && it.voltaje ? ` · ${it.voltaje}` : ''}`;
      const checked = invSelected.has(id) ? 'checked' : '';
      return `<label data-id="${id}" style="display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;border:1px solid ${invSelected.has(id) ? 'var(--primary)' : 'transparent'};background:${invSelected.has(id) ? 'rgba(99,102,241,.08)' : 'var(--surface)'};transition:.1s;">
        <input type="checkbox" data-id="${id}" ${checked} style="margin-top:2px;cursor:pointer;flex-shrink:0;">
        <div style="min-width:0;">
          <div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:1px;">${sub}${it.responsable ? ` · ${it.responsable}` : ''}</div>
        </div>
      </label>`;
    }).join('');

    invList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.onchange = () => {
        const id = parseInt(cb.dataset.id);
        if (cb.checked) invSelected.add(id); else invSelected.delete(id);
        updateInvCount();
        renderInvList(filterInvItems());
      };
    });
  }

  function filterInvItems() {
    const q = invSearch.value.trim().toLowerCase();
    if (!q) return invItems;
    return invItems.filter(it => {
      const txt = [it.placa, it.serial, it.marca, it.nombre_equipo, it.equipo, it.modelo, it.imei, it.responsable, it.voltaje].join(' ').toLowerCase();
      return txt.includes(q);
    });
  }

  function updateInvCount() {
    const n = invSelected.size;
    invCount.textContent = `${n} seleccionado${n !== 1 ? 's' : ''}`;
    btnAddFromInv.disabled = n === 0;
    btnAddFromInv.style.opacity = n > 0 ? '1' : '.4';
  }

  async function loadInvItems() {
    const tipo = invTipo.value;
    invList.innerHTML = `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text-3);">Cargando…</div>`;
    invSelected.clear();
    updateInvCount();
    try {
      const res  = await fetch(`/api/inventario/${tipo}?limit=50&page=1`);
      const json = await res.json();
      invItems   = json.equipos || json.celulares || json.ups || [];
      renderInvList(filterInvItems());
    } catch {
      invList.innerHTML = `<div style="text-align:center;padding:16px;font-size:12px;color:var(--danger);">Error al cargar inventario</div>`;
    }
  }

  overlay.querySelector('#btn-from-inventario').onclick = () => {
    const open = invPicker.style.display !== 'none';
    invPicker.style.display = open ? 'none' : 'block';
    if (!open && !invItems.length) loadInvItems();
  };
  overlay.querySelector('#btn-close-inv-picker').onclick = () => { invPicker.style.display = 'none'; };

  invTipo.onchange = loadInvItems;
  invSearch.addEventListener('input', () => renderInvList(filterInvItems()));

  btnAddFromInv.onclick = () => {
    const tipo     = invTipo.value;
    const selected = invItems.filter(it => invSelected.has(it.id));
    const firstRow = artsList.querySelector('.art-row-edit');
    const isFirstEmpty = firstRow && !firstRow.querySelector('[data-field="nombre"]').value.trim();

    selected.forEach((it, i) => {
      const nombre = tipo === 'celulares' ? (it.equipo || it.modelo || '') : (it.nombre_equipo || '');
      const art = {
        nombre,
        marca:       it.marca  || '',
        modelo:      it.modelo || '',
        serial:      tipo === 'celulares' ? (it.imei || '') : (it.serial || ''),
        descripcion: tipo === 'ups' && it.voltaje ? `Voltaje: ${it.voltaje}` : '',
      };
      const fillRow = (row) => {
        ['nombre','marca','modelo','serial','descripcion'].forEach(f => {
          const el = row.querySelector(`[data-field="${f}"]`);
          if (el) el.value = art[f] || '';
        });
      };
      if (i === 0 && isFirstEmpty) {
        fillRow(firstRow);
      } else {
        const div = document.createElement('div');
        div.innerHTML = buildArtRow(art, false);
        const row = div.firstElementChild;
        fillRow(row);
        artsList.appendChild(row);
        wireArtRow(row);
      }
    });

    invPicker.style.display = 'none';
    invSelected.clear();
    invItems = [];
    showToast(`${selected.length} artículo(s) agregado(s)`, 'success');
  };
  // ── End inventory picker ──────────────────────────────────────────────────

  overlay.querySelector('#form-edit-despacho').onsubmit = async (e) => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const rows = artsList.querySelectorAll('.art-row-edit');
    const arts = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      if (nombre) arts.push({
        nombre,
        cantidad:    parseInt(row.querySelector('[data-field="cantidad"]').value) || 1,
        descripcion: row.querySelector('[data-field="descripcion"]').value.trim(),
        marca:       row.querySelector('[data-field="marca"]').value.trim(),
        modelo:      row.querySelector('[data-field="modelo"]').value.trim(),
        serial:      row.querySelector('[data-field="serial"]').value.trim(),
      });
    }
    if (!arts.length) { showToast('Agrega al menos un artículo.', 'warning'); return; }

    const btn = e.target.querySelector('#btn-submit-edit');
    btn.disabled = true; btn.textContent = 'Guardando…';

    try {
      await updateDespacho(id, {
        destinatario:  fd.get('destinatario'),
        cedula:        fd.get('cedula')  || null,
        sede:          fd.get('sede')    || null,
        area:          fd.get('area')    || null,
        fecha:         fd.get('fecha')   || null,
        articulos:     arts,
        observaciones: fd.get('observaciones') || null,
        requiere_acta: overlay.querySelector('#edit-check-acta').checked ? 1 : 0,
      });
      showToast('Despacho actualizado', 'success');
      closeEdit();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = '💾 Guardar Cambios';
    }
  };
}
