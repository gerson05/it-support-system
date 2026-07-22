/**
 * despacho-form.js
 *
 * Handles:
 *  - buildArticuloRow(idx, isFirst)
 *  - openCreateModal(onSuccess)
 */
import { state, AREA_MAPPINGS } from '../../core/app.js';
import { showToast, attachPuntoSearch } from '../../ui/components.js';
import {
  fetchDespacho, createDespacho, updateDespacho,
} from './despacho-helpers.js';

const _tc = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const _sc = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };
const escHtml = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function _attachEmpleadoSearch(inputEl, cedulaEl) {
  if (!inputEl) return;
  let _timer = null;
  let _drop  = null;

  function _closeDrop() { _drop?.remove(); _drop = null; }

  function _openDrop(rows) {
    _closeDrop();
    if (!rows.length) return;
    _drop = document.createElement('div');
    _drop.style.cssText = 'position:absolute;z-index:2000;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);max-height:200px;overflow-y:auto;min-width:100%;';
    rows.forEach(r => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);';
      item.innerHTML = `<div style="font-weight:600;color:var(--text);">${escHtml(r.nombre)}</div><div style="color:var(--text-3);">${escHtml(r.cedula)}${r.cargo ? ' · ' + escHtml(r.cargo) : ''}</div>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        inputEl.value = r.nombre;
        if (cedulaEl) cedulaEl.value = r.cedula;
        _closeDrop();
      });
      item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-2)');
      item.addEventListener('mouseleave', () => item.style.background = '');
      _drop.appendChild(item);
    });
    // Position relative to input
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;';
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);
    wrap.appendChild(_drop);
  }

  inputEl.addEventListener('input', () => {
    clearTimeout(_timer);
    const q = inputEl.value.trim();
    if (q.length < 2) { _closeDrop(); return; }
    _timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/erp/empleados?q=${encodeURIComponent(q)}`);
        const rows = await res.json();
        _openDrop(rows);
      } catch {}
    }, 250);
  });

  inputEl.addEventListener('blur', () => setTimeout(_closeDrop, 150));
}

export const PICKER_TABS = [
  { id:'computadores', label:'Computadores', apiTab:'equipos',   categoria:'computadores' },
  { id:'impresoras',   label:'Impresoras',   apiTab:'equipos',   categoria:'impresoras'   },
  { id:'escaner',      label:'Escáneres',    apiTab:'equipos',   categoria:'escaner'      },
  { id:'televisores',  label:'Televisores',  apiTab:'equipos',   categoria:'televisores'  },
  { id:'monitores',    label:'Monitores',    apiTab:'equipos',   categoria:'monitores'    },
  { id:'tablets',      label:'Tablets',      apiTab:'equipos',   categoria:'tablets'      },
  { id:'perifericos',  label:'Periféricos',  apiTab:'equipos',   categoria:'perifericos'  },
  { id:'celulares',    label:'Celulares',    apiTab:'celulares', categoria:''             },
  { id:'ups',          label:'UPS',          apiTab:'ups',       categoria:''             },
];

/* ── Shared row builder ───────────────────────────────────────────────── */

export function buildArticuloRow(idx, isFirst) {
  return `
    <div class="articulo-row" data-row="${idx}"
      style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;background:var(--surface-2);display:flex;flex-direction:column;gap:8px;position:relative;">
      <div style="display:grid;grid-template-columns:1fr 70px auto auto;gap:8px;align-items:center;">
        <input data-field="nombre" type="text" placeholder="Nombre del artículo *" required
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="cantidad" type="number" min="1" value="1"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;text-align:center;">
        <button type="button" class="btn-dup-row"
          style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);cursor:pointer;font-size:13px;line-height:1;"
          title="Duplicar fila">📋</button>
        <button type="button" class="btn-remove-row"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--danger);cursor:pointer;font-size:14px;line-height:1;${isFirst ? 'visibility:hidden;' : ''}"
          title="Eliminar fila">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
        <input data-field="marca"       type="text" placeholder="Marca (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="modelo"      type="text" placeholder="Modelo (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="serial"      type="text" placeholder="Serial (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="descripcion" type="text" placeholder="Descripción (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
      </div>
    </div>`;
}

/* ── Create Modal ─────────────────────────────────────────────────────── */

export async function openCreateModal(onSuccess) {
  const areaOptions = Object.entries(AREA_MAPPINGS)
    .map(([val, { label }]) => `<option value="${val}">${label}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:640px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
        <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Nuevo Despacho</h2>
        <button id="create-modal-close" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
      </div>

      <form id="form-despacho" autocomplete="off">
        <div id="borrador-banner" style="display:none;margin-bottom:16px;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span id="borrador-banner-text" style="font-size:13px;color:var(--text-2);"></span>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button type="button" id="btn-restaurar-borrador" style="padding:5px 12px;border:1px solid var(--primary);border-radius:6px;background:var(--primary-light);color:var(--primary);font-size:12px;font-weight:500;cursor:pointer;">Restaurar</button>
              <button type="button" id="btn-descartar-borrador" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-3);font-size:12px;cursor:pointer;">Descartar</button>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Destinatario *</label>
            <input name="destinatario" required type="text" placeholder="Nombre del receptor"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Cédula</label>
            <input name="cedula" type="text" placeholder="Número de cédula"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Sede</label>
            <input name="sede" type="text" placeholder="Ej. Sede Norte"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Área</label>
            <select name="area"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">Selecciona área...</option>
              ${areaOptions}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">
              Fecha de envío <span style="font-weight:400;color:var(--text-3);">(opcional)</span>
            </label>
            <input name="fecha" type="date"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-2);">Artículos *</label>
            <div style="display:flex;gap:6px;">
              <button type="button" id="btn-from-inventario" style="font-size:12px;padding:4px 10px;border:1px solid var(--primary);border-radius:6px;background:var(--primary-light,rgba(99,102,241,.1));color:var(--primary);cursor:pointer;">📦 Del inventario</button>
              <button type="button" id="btn-add-articulo" style="font-size:12px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;">+ Agregar fila</button>
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
              <select id="inv-picker-tipo" style="width:auto;flex-shrink:0;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;cursor:pointer;">
                ${PICKER_TABS.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
              </select>
            </div>
            <div id="inv-picker-list" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);">
              <span id="inv-picker-count" style="font-size:11px;color:var(--text-3);">0 seleccionados</span>
              <button type="button" id="btn-add-from-inv" disabled
                style="font-size:12px;padding:5px 14px;border:none;border-radius:6px;background:var(--primary);color:#fff;cursor:pointer;opacity:.4;">Agregar al despacho</button>
            </div>
          </div>
          <div id="articulos-list" style="display:flex;flex-direction:column;gap:6px;">
            ${buildArticuloRow(0, true)}
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Accesorios</label>
          <textarea name="observaciones" rows="2" placeholder="Notas adicionales…"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <div style="margin-bottom:8px;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="check-requiere-acta" name="requiere_acta" style="width:16px;height:16px;cursor:pointer;">
          <label for="check-requiere-acta" style="font-size:13px;font-weight:500;color:var(--text);cursor:pointer;">¿Requiere acta de entrega?</label>
        </div>
        <div id="acta-info" style="margin-bottom:14px;display:none;padding:9px 12px;background:var(--surface-2);border-radius:7px;border:1px solid var(--border);">
          <span style="font-size:12px;color:var(--text-2);">✔ Se generará un número de acta automáticamente al crear el despacho. La firma y el archivo se gestionan en la pestaña de Actas de entrega.</span>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">
            Ticket vinculado <span style="font-weight:400;color:var(--text-3);">(opcional)</span>
          </label>
          <input id="ticket-search-input" type="text" placeholder="Buscar por #ID o descripción…"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          <input type="hidden" id="ticket-id-hidden" name="ticket_id">
          <div id="ticket-search-results" style="display:none;margin-top:4px;border:1px solid var(--border);border-radius:8px;background:var(--surface);max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.15);"></div>
          <div id="ticket-selected-info" style="display:none;margin-top:6px;padding:7px 10px;background:var(--surface-2);border-radius:6px;border:1px solid var(--border);font-size:12px;color:var(--text-2);align-items:center;justify-content:space-between;gap:8px;">
            <span id="ticket-selected-label"></span>
            <button type="button" id="btn-clear-ticket" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:14px;line-height:1;padding:0;">✕</button>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" id="btn-cancel-create" class="btn btn-secondary">Cancelar</button>
          <button type="button" id="btn-guardar-borrador" class="btn btn-secondary">💾 Guardar borrador</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-despacho">Crear Despacho</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector('#create-modal-close').onclick = closeModal;
  overlay.querySelector('#btn-cancel-create').onclick  = closeModal;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Formatting
  overlay.querySelector('[name="observaciones"]').addEventListener('blur', e => { e.target.value = _sc(e.target.value); });

  // Destinatario autocomplete from local employee DB
  _attachEmpleadoSearch(
    overlay.querySelector('input[name="destinatario"]'),
    overlay.querySelector('input[name="cedula"]'),
  );

  // Sede autocomplete
  attachPuntoSearch(overlay.querySelector('input[name="sede"]'));

  // Acta toggle
  const checkAcata = overlay.querySelector('#check-requiere-acta');
  const actaInfoEl = overlay.querySelector('#acta-info');
  checkAcata.onchange = () => { actaInfoEl.style.display = checkAcata.checked ? 'block' : 'none'; };

  // Article rows
  let rowCount = 1;

  function wireRow(row) {
    row.querySelector('.btn-remove-row')?.addEventListener('click', function () {
      this.closest('.articulo-row').remove();
    });
    row.querySelector('.btn-dup-row')?.addEventListener('click', function () {
      const curr  = this.closest('.articulo-row');
      const div   = document.createElement('div');
      div.innerHTML = buildArticuloRow(rowCount++, false);
      const newRow  = div.firstElementChild;
      ['nombre','descripcion','marca','modelo'].forEach(f => {
        newRow.querySelector(`[data-field="${f}"]`).value = curr.querySelector(`[data-field="${f}"]`).value;
      });
      curr.insertAdjacentElement('afterend', newRow);
      wireRow(newRow);
      newRow.querySelector('[data-field="nombre"]')?.focus();
    });
    ['nombre','marca','modelo'].forEach(field => {
      row.querySelector(`[data-field="${field}"]`)?.addEventListener('blur', e => {
        e.target.value = _tc(e.target.value.trim());
      });
    });
  }

  overlay.querySelector('#btn-add-articulo').onclick = () => {
    const list = overlay.querySelector('#articulos-list');
    const div  = document.createElement('div');
    div.innerHTML = buildArticuloRow(rowCount++, false);
    const row = div.firstElementChild;
    list.appendChild(row);
    wireRow(row);
    row.querySelector('[data-field="nombre"]')?.focus();
  };

  overlay.querySelectorAll('.articulo-row').forEach(r => wireRow(r));

  // ── Inventory picker ─────────────────────────────────────────────────────
  const invPicker    = overlay.querySelector('#inv-picker');
  const invList      = overlay.querySelector('#inv-picker-list');
  const invSearch    = overlay.querySelector('#inv-picker-search');
  const invTipo      = overlay.querySelector('#inv-picker-tipo');
  const invCount     = overlay.querySelector('#inv-picker-count');
  const btnAddFromInv = overlay.querySelector('#btn-add-from-inv');
  let   invItems     = [];   // full fetched list
  let   invSelected  = new Set(); // set of item IDs

  function renderInvList(items) {
    if (!items.length) {
      invList.innerHTML = `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text-3);">Sin resultados</div>`;
      return;
    }
    const pickerTab = PICKER_TABS.find(t => t.id === invTipo.value) || PICKER_TABS[0];
    invList.innerHTML = items.map(it => {
      const id    = it.id;
      const label = pickerTab.apiTab === 'celulares'
        ? `<b>${it.equipo || it.modelo || '—'}</b> &nbsp;<span style="color:var(--text-3)">${it.marca || ''}</span>`
        : `<b>${it.nombre_equipo || '—'}</b> &nbsp;<span style="color:var(--text-3)">${it.marca || ''}</span>`;
      const sub   = pickerTab.apiTab === 'celulares'
        ? `${it.serial ? `Serial: ${it.serial}` : `IMEI: ${it.imei || '—'}`}`
        : `${it.placa ? `<span style="font-family:monospace;color:var(--primary);">${it.placa}</span> · ` : ''}Serial: ${it.serial || '—'}${pickerTab.apiTab === 'ups' && it.voltaje ? ` · ${it.voltaje}` : ''}`;
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

  let _invSearchTimer = null;

  async function loadInvItems(searchQuery = '') {
    const pickerTab = PICKER_TABS.find(t => t.id === invTipo.value) || PICKER_TABS[0];
    invList.innerHTML = `<div style="text-align:center;padding:16px;font-size:12px;color:var(--text-3);">Cargando…</div>`;
    if (!searchQuery) { invSelected.clear(); updateInvCount(); }
    try {
      const params = new URLSearchParams({ limit: 50, page: 1 });
      if (pickerTab.categoria) params.set('categoria', pickerTab.categoria);
      if (searchQuery)         params.set('search', searchQuery);
      const res  = await fetch(`/api/inventario/${pickerTab.apiTab}?${params}`);
      const json = await res.json();
      invItems   = json.equipos || json.celulares || json.ups || [];
      renderInvList(invItems);
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

  invTipo.onchange = () => loadInvItems(invSearch.value.trim());
  invSearch.addEventListener('input', () => {
    clearTimeout(_invSearchTimer);
    const q = invSearch.value.trim();
    if (q.length === 0) { loadInvItems(); return; }
    // instant local filter for short queries, server search after 350ms
    renderInvList(invItems.filter(it =>
      [it.placa, it.serial, it.marca, it.nombre_equipo, it.equipo, it.modelo, it.imei, it.responsable, String(it.id||'')]
        .join(' ').toLowerCase().includes(q.toLowerCase())
    ));
    _invSearchTimer = setTimeout(() => loadInvItems(q), 350);
  });

  btnAddFromInv.onclick = () => {
    const pickerTab   = PICKER_TABS.find(t => t.id === invTipo.value) || PICKER_TABS[0];
    const artList     = overlay.querySelector('#articulos-list');
    const selected    = invItems.filter(it => invSelected.has(it.id));
    const firstRow    = artList.querySelector('.articulo-row');
    const isFirstEmpty = firstRow && !firstRow.querySelector('[data-field="nombre"]').value.trim();

    selected.forEach((it, i) => {
      const nombre = pickerTab.apiTab === 'celulares' ? (it.equipo || it.modelo || '') : (it.nombre_equipo || '');
      const art = {
        nombre,
        marca:  it.marca  || '',
        modelo: it.modelo || '',
        serial: it.serial || it.imei || '',
        descripcion: pickerTab.apiTab === 'ups' && it.voltaje ? `Voltaje: ${it.voltaje}` : '',
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
        div.innerHTML = buildArticuloRow(rowCount++, false);
        const row = div.firstElementChild;
        fillRow(row);
        artList.appendChild(row);
        wireRow(row);
      }
    });

    invPicker.style.display = 'none';
    invSelected.clear();
    invItems = [];
    showToast(`${selected.length} artículo(s) agregado(s)`, 'success');
  };
  // ── End inventory picker ──────────────────────────────────────────────────

  // Borrador helpers
  function serializarFormulario() {
    const rows     = overlay.querySelectorAll('.articulo-row');
    const articulos = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      if (nombre) articulos.push({
        nombre,
        cantidad:    parseInt(row.querySelector('[data-field="cantidad"]').value) || 1,
        descripcion: row.querySelector('[data-field="descripcion"]').value.trim(),
        marca:       row.querySelector('[data-field="marca"]').value.trim(),
        modelo:      row.querySelector('[data-field="modelo"]').value.trim(),
        serial:      row.querySelector('[data-field="serial"]').value.trim(),
      });
    }
    const fd = new FormData(overlay.querySelector('#form-despacho'));
    return {
      agente:        state.currentUser?.username || 'IT',
      destinatario:  fd.get('destinatario')  || '',
      sede:          fd.get('sede')           || '',
      area:          fd.get('area')           || '',
      fecha:         fd.get('fecha')          || null,
      articulos,
      observaciones: fd.get('observaciones') || '',
      requiere_acta: checkAcata.checked ? 1 : 0,
      ticket_id:     fd.get('ticket_id') ? parseInt(fd.get('ticket_id')) : null,
    };
  }

  function restaurarArticulos(articulos) {
    const list  = overlay.querySelector('#articulos-list');
    list.innerHTML = '';
    rowCount = 0;
    const items = articulos.length ? articulos : [{ nombre:'',cantidad:1,descripcion:'',marca:'',modelo:'',serial:'' }];
    items.forEach((art, idx) => {
      const div = document.createElement('div');
      div.innerHTML = buildArticuloRow(rowCount++, idx === 0);
      const row = div.firstElementChild;
      list.appendChild(row);
      Object.entries({ nombre:'', cantidad:1, descripcion:'', marca:'', modelo:'', serial:'' }).forEach(([f]) => {
        const el = row.querySelector(`[data-field="${f}"]`);
        if (el) el.value = art[f] ?? '';
      });
      wireRow(row);
    });
  }

  async function guardarBorrador() {
    try {
      await fetch('/api/despachos/borrador', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializarFormulario()),
      });
      showToast('Borrador guardado ✓', 'success');
      document.dispatchEvent(new CustomEvent('despacho-borrador-saved'));
    } catch { showToast('No se pudo guardar el borrador', 'error'); }
  }

  async function eliminarBorrador() {
    const agente = encodeURIComponent(state.currentUser?.username || 'IT');
    await fetch(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' }).catch(() => {});
  }

  overlay.querySelector('#btn-guardar-borrador').onclick = guardarBorrador;

  overlay.querySelector('#btn-descartar-borrador').onclick = async () => {
    await eliminarBorrador();
    overlay.querySelector('#borrador-banner').style.display = 'none';
  };

  // Ticket search
  const ticketSearchInput   = overlay.querySelector('#ticket-search-input');
  const ticketResults       = overlay.querySelector('#ticket-search-results');
  const ticketIdHidden      = overlay.querySelector('#ticket-id-hidden');
  const ticketSelectedInfo  = overlay.querySelector('#ticket-selected-info');
  const ticketSelectedLabel = overlay.querySelector('#ticket-selected-label');

  function selectTicket(t) {
    ticketIdHidden.value = t.id;
    ticketSearchInput.style.display = 'none';
    ticketResults.style.display     = 'none';
    ticketSelectedInfo.style.display = 'flex';
    ticketSelectedLabel.textContent  = `#${t.id} — ${t.description || t.subject || ''}`;
  }

  overlay.querySelector('#btn-clear-ticket').onclick = () => {
    ticketIdHidden.value = '';
    ticketSearchInput.value = '';
    ticketSearchInput.style.display = '';
    ticketSelectedInfo.style.display = 'none';
    ticketResults.style.display      = 'none';
  };

  async function searchTickets(q) {
    const params = q ? `search=${encodeURIComponent(q)}&limit=8` : 'status_group=activos&limit=8';
    const res    = await fetch(`/api/tickets?${params}`);
    const json   = await res.json();
    return json.tickets || json.data || [];
  }

  function renderTicketResults(tickets) {
    if (!tickets.length) {
      ticketResults.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:var(--text-3);">Sin resultados</div>`;
    } else {
      ticketResults.innerHTML = tickets.map(t => `
        <div class="ticket-result-row" data-id="${t.id}" data-desc="${(t.description || '').replace(/"/g, '&quot;')}"
          style="padding:9px 14px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;">
          <span style="font-family:monospace;font-weight:700;color:var(--primary);white-space:nowrap;">#${t.id}</span>
          <div style="overflow:hidden;flex:1;min-width:0;">
            <div style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.description || '—'}</div>
            ${t.requester_name ? `<div style="font-size:11px;color:var(--text-3);">${t.requester_name}</div>` : ''}
          </div>
          ${t.status ? `<span style="white-space:nowrap;font-size:11px;color:var(--text-3);padding:2px 7px;border:1px solid var(--border);border-radius:99px;">${t.status}</span>` : ''}
        </div>`).join('');
      ticketResults.querySelectorAll('.ticket-result-row').forEach(row => {
        row.onmouseenter = () => row.style.background = 'var(--surface-2)';
        row.onmouseleave = () => row.style.background = '';
        row.onclick = () => selectTicket({ id: row.dataset.id, description: row.dataset.desc });
      });
    }
    ticketResults.style.display = 'block';
  }

  ticketSearchInput.addEventListener('focus', async () => {
    if (ticketIdHidden.value) return;
    renderTicketResults(await searchTickets(''));
  });

  let ticketSearchTimer;
  ticketSearchInput.addEventListener('input', () => {
    clearTimeout(ticketSearchTimer);
    ticketSearchTimer = setTimeout(async () => {
      renderTicketResults(await searchTickets(ticketSearchInput.value.trim()));
    }, 300);
  });

  document.addEventListener('click', function hideResults(e) {
    if (!overlay.contains(e.target)) return;
    if (!ticketSearchInput.contains(e.target) && !ticketResults.contains(e.target)) {
      ticketResults.style.display = 'none';
    }
  });

  // Load borrador
  try {
    const agente = encodeURIComponent(state.currentUser?.username || 'IT');
    const data   = await fetch(`/api/despachos/borrador?agente=${agente}`)
      .then(r => r.ok ? r.json() : { borrador: null });
    if (data.borrador) {
      const banner    = overlay.querySelector('#borrador-banner');
      const bannerTxt = overlay.querySelector('#borrador-banner-text');
      const diff = Date.now() - new Date(data.borrador.updated_at).getTime();
      const h    = Math.floor(diff / 3_600_000);
      const m    = Math.floor((diff % 3_600_000) / 60_000);
      const label = h > 0 ? `hace ${h}h ${m}m` : `hace ${m}m`;
      bannerTxt.textContent = `📝 Tienes un borrador guardado (${label})`;
      banner.style.display  = 'block';
      if (h >= 8) {
        banner.style.background  = 'rgba(245,158,11,0.08)';
        banner.style.borderColor = '#f59e0b';
        bannerTxt.style.color    = '#f59e0b';
      }
      overlay.querySelector('#btn-restaurar-borrador').onclick = () => {
        const b = data.borrador;
        overlay.querySelector('[name="destinatario"]').value  = b.destinatario  || '';
        overlay.querySelector('[name="sede"]').value          = b.sede          || '';
        overlay.querySelector('[name="observaciones"]').value = b.observaciones || '';
        const areaSelect = overlay.querySelector('[name="area"]');
        if (areaSelect) areaSelect.value = b.area || '';
        checkAcata.checked = !!b.requiere_acta;
        actaInfoEl.style.display = checkAcata.checked ? 'block' : 'none';
        restaurarArticulos(b.articulos || []);
        if (b.ticket_id) {
          ticketIdHidden.value = b.ticket_id;
          ticketSearchInput.style.display = 'none';
          ticketSelectedInfo.style.display = 'flex';
          ticketSelectedLabel.textContent  = `#${b.ticket_id} (restaurado del borrador)`;
        }
        banner.style.display = 'none';
        showToast('Borrador restaurado', 'success');
      };
    }
  } catch {}

  // Form submit
  overlay.querySelector('#form-despacho').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rows = overlay.querySelectorAll('.articulo-row');
    const articulos = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      if (nombre) articulos.push({
        nombre,
        cantidad:    parseInt(row.querySelector('[data-field="cantidad"]').value) || 1,
        descripcion: row.querySelector('[data-field="descripcion"]').value.trim(),
        marca:       row.querySelector('[data-field="marca"]').value.trim(),
        modelo:      row.querySelector('[data-field="modelo"]').value.trim(),
        serial:      row.querySelector('[data-field="serial"]').value.trim(),
      });
    }
    if (!articulos.length) { showToast('Agrega al menos un artículo con nombre.', 'warning'); return; }

    const payload = {
      destinatario: fd.get('destinatario'),
      cedula:       fd.get('cedula')       || null,
      sede:         fd.get('sede')         || null,
      area:         fd.get('area')         || null,
      articulos,
      observaciones: fd.get('observaciones') || null,
      requiere_acta: checkAcata.checked ? 1 : 0,
      ticket_id:     fd.get('ticket_id') ? parseInt(fd.get('ticket_id')) : null,
      agente: state.currentUser?.username || 'IT',
    };

    const btn = e.target.querySelector('#btn-submit-despacho');
    btn.disabled = true; btn.textContent = 'Creando…';

    try {
      const result = await createDespacho(payload);
      eliminarBorrador();
      showToast(`Despacho ${result.numero} creado correctamente`, 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Crear Despacho';
    }
  };
}

