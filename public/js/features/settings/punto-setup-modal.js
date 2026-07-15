import { state } from '../../core/app.js';
import { showToast, copyToClipboard } from '../../ui/components.js';
import { buildArticuloRow } from '../despacho/despacho-form.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function collectArticulos(wrap) {
  return [...wrap.querySelectorAll('.articulo-row')].map(row => ({
    nombre:      row.querySelector('[data-field="nombre"]').value.trim(),
    cantidad:    parseInt(row.querySelector('[data-field="cantidad"]').value) || 1,
    marca:       row.querySelector('[data-field="marca"]').value.trim(),
    modelo:      row.querySelector('[data-field="modelo"]').value.trim(),
    serial:      row.querySelector('[data-field="serial"]').value.trim(),
    descripcion: row.querySelector('[data-field="descripcion"]').value.trim(),
  })).filter(a => a.nombre);
}

function wireRow(row, wrap, rowCount) {
  row.querySelector('.btn-remove-row')?.addEventListener('click', () => row.remove());
  row.querySelector('.btn-dup-row')?.addEventListener('click', () => {
    const div = document.createElement('div');
    div.innerHTML = buildArticuloRow(rowCount.value++, false);
    const newRow = div.firstElementChild;
    row.after(newRow);
    wireRow(newRow, wrap, rowCount);
  });
}

function stepsHtml(steps, activeIdx) {
  return steps.map((s, i) => {
    const n = i + 1;
    const done = n < activeIdx;
    const curr = n === activeIdx;
    return `<span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
      background:${curr ? 'var(--primary)' : done ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.06)'};
      color:${curr ? '#fff' : done ? '#818cf8' : 'var(--text-3)'};">
      ${done ? '✓' : n} · ${s}</span>`;
  }).join('');
}

export function openPuntoSetupModal(onSuccess, ciudadesExistentes = []) {
  let currentStep = 1;
  const data = { ciudad: '', nombre_punto: '', responsable: '', articulos: [], addItems: false };
  let step2rowCount = { value: 1 };

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';

  function render() {
    const steps = data.addItems
      ? ['Punto', 'Artículos', 'Confirmar']
      : ['Punto', 'Confirmar'];

    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:580px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Nuevo punto de atención</h2>
          <button id="ps-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
        </div>
        <div id="ps-body"></div>
      </div>`;

    overlay.querySelector('#ps-x').addEventListener('click', () => overlay.remove());
    const body = overlay.querySelector('#ps-body');

    if (currentStep === 1) {
      const visualStep = 1;
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:22px;">${stepsHtml(steps, visualStep)}</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">CIUDAD *</label>
            <select id="ps-ciudad-sel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">-- Seleccionar ciudad --</option>
              ${ciudadesExistentes.map(c => `<option value="${esc(c)}"${data.ciudad === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
              <option value="__nueva__"${data.ciudad && !ciudadesExistentes.includes(data.ciudad) ? ' selected' : ''}>+ Nueva ciudad…</option>
            </select>
            <input id="ps-ciudad-nueva" type="text" value="${esc(!ciudadesExistentes.includes(data.ciudad) ? data.ciudad : '')}"
              placeholder="Nombre de la ciudad (ej: CALI)"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;text-transform:uppercase;margin-top:6px;${data.ciudad && !ciudadesExistentes.includes(data.ciudad) ? '' : 'display:none;'}">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">NOMBRE DEL PUNTO *</label>
            <input id="ps-nombre" type="text" value="${esc(data.nombre_punto)}" placeholder="Ej: MI FARMACIA - CALI CENTRO"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">RESPONSABLE EN PUNTO <span style="font-weight:400;color:var(--text-3);">(opcional)</span></label>
            <input id="ps-responsable" type="text" value="${esc(data.responsable)}" placeholder="Nombre del receptor en destino"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div style="padding:14px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18);border-radius:8px;">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
              <input type="checkbox" id="ps-add-items" ${data.addItems ? 'checked' : ''}
                style="width:16px;height:16px;margin-top:1px;accent-color:var(--primary);flex-shrink:0;">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text);">¿Adicionar artículos a este punto?</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Si activas esta opción, podrás registrar los artículos a despachar y se generará trazabilidad automáticamente.</div>
              </div>
            </label>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px;gap:8px;">
          <button id="ps-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">Cancelar</button>
          <button id="ps-next1" class="btn btn-primary">Siguiente →</button>
        </div>`;

      body.querySelector('#ps-cancel').addEventListener('click', () => overlay.remove());

      const sel = body.querySelector('#ps-ciudad-sel');
      const nuevaInput = body.querySelector('#ps-ciudad-nueva');
      sel.addEventListener('change', () => {
        nuevaInput.style.display = sel.value === '__nueva__' ? '' : 'none';
        if (sel.value === '__nueva__') setTimeout(() => nuevaInput.focus(), 30);
      });

      body.querySelector('#ps-next1').addEventListener('click', () => {
        const ciudad = sel.value === '__nueva__'
          ? nuevaInput.value.trim().toUpperCase()
          : sel.value;
        const nombre = body.querySelector('#ps-nombre').value.trim();
        if (!ciudad) { showToast('Selecciona o escribe una ciudad', 'error'); return; }
        if (!nombre) { showToast('El nombre del punto es obligatorio', 'error'); return; }
        data.ciudad       = ciudad;
        data.nombre_punto = nombre;
        data.responsable  = body.querySelector('#ps-responsable').value.trim();
        data.addItems     = body.querySelector('#ps-add-items').checked;
        data.articulos    = [];
        currentStep = data.addItems ? 2 : 3;
        render();
      });
      setTimeout(() => body.querySelector('#ps-ciudad-sel')?.focus(), 50);
    }

    else if (currentStep === 2) {
      step2rowCount = { value: 1 };
      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:22px;">${stepsHtml(steps, 2)}</div>
        <p style="font-size:12px;color:var(--text-3);margin-bottom:12px;">Si agregas artículos se crea un despacho + trazabilidad automáticamente. Puedes omitir este paso.</p>
        <div id="ps-articulos-wrap">${buildArticuloRow(0, true)}</div>
        <button type="button" id="ps-add-row" style="font-size:12px;color:var(--primary);background:none;border:none;cursor:pointer;padding:4px 0;margin-top:4px;">+ Agregar artículo</button>
        <div style="display:flex;justify-content:space-between;margin-top:20px;gap:8px;">
          <button id="ps-back2" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">← Anterior</button>
          <div style="display:flex;gap:8px;">
            <button id="ps-skip2" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">Omitir artículos</button>
            <button id="ps-next2" class="btn btn-primary">Siguiente →</button>
          </div>
        </div>`;

      const wrap = body.querySelector('#ps-articulos-wrap');
      wireRow(wrap.querySelector('.articulo-row'), wrap, step2rowCount);

      body.querySelector('#ps-add-row').addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = buildArticuloRow(step2rowCount.value++, false);
        const row = div.firstElementChild;
        wrap.appendChild(row);
        wireRow(row, wrap, step2rowCount);
      });

      body.querySelector('#ps-back2').addEventListener('click', () => { currentStep = 1; render(); });
      body.querySelector('#ps-skip2').addEventListener('click', () => {
        data.articulos = [];
        currentStep = 3;
        render();
      });
      body.querySelector('#ps-next2').addEventListener('click', () => {
        data.articulos = collectArticulos(wrap);
        currentStep = 3;
        render();
      });
    }

    else if (currentStep === 3) {
      const arts = data.articulos;
      const visualStep = data.addItems ? 3 : 2;
      const articulosHtml = arts.length
        ? arts.map(a => `
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:4px;">
              <span style="width:14px;height:14px;border:1px solid var(--primary);border-radius:3px;display:inline-block;flex-shrink:0;"></span>
              ${esc(a.nombre)} × ${a.cantidad}${a.marca ? ' — ' + esc(a.marca) : ''}
            </div>`).join('')
        : '';

      body.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:22px;">${stepsHtml(steps, visualStep)}</div>
        <div style="background:var(--surface-2);border-radius:8px;padding:14px;margin-bottom:12px;font-size:13px;display:flex;flex-direction:column;gap:6px;">
          <div>✅ Punto: <strong>${esc(data.nombre_punto)}</strong></div>
          <div>📍 Ciudad: <strong>${esc(data.ciudad)}</strong></div>
          ${data.responsable ? `<div>👤 Responsable: <strong>${esc(data.responsable)}</strong></div>` : ''}
          ${arts.length ? `
            <div>📦 Despacho automático (${arts.length} artículo${arts.length !== 1 ? 's' : ''})</div>
            <div>🔗 Trazabilidad con link público para confirmación en destino</div>` : ''}
        </div>
        ${arts.length ? `
        <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#818cf8;margin-bottom:8px;">Checklist que se generará</div>
          ${articulosHtml}
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-top:20px;gap:8px;">
          <button id="ps-back3" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">← Anterior</button>
          <button id="ps-submit" class="btn btn-primary" style="background:#10b981;border-color:#10b981;">✓ Crear punto</button>
        </div>`;

      body.querySelector('#ps-back3').addEventListener('click', () => {
        currentStep = data.addItems ? 2 : 1;
        render();
      });

      body.querySelector('#ps-submit').addEventListener('click', async () => {
        const btn = body.querySelector('#ps-submit');
        btn.disabled = true;
        btn.textContent = 'Creando…';
        try {
          let res, json;
          if (data.addItems) {
            res  = await fetch('/api/sedes/setup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ciudad:       data.ciudad,
                nombre_punto: data.nombre_punto,
                responsable:  data.responsable,
                articulos:    data.articulos,
                agente:       state.currentUser?.username || 'IT',
              }),
            });
            json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error al crear el punto');
            overlay.remove();
            showToast(`Punto ${data.nombre_punto} creado · Despacho generado`, 'success');
            if (json.tracking_url) {
              copyToClipboard(json.tracking_url);
              showToast('Link de trazabilidad copiado al portapapeles', 'info');
            }
          } else {
            res  = await fetch('/api/sedes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ciudad:       data.ciudad,
                nombre_punto: data.nombre_punto,
              }),
            });
            json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error al crear el punto');
            overlay.remove();
            showToast(`Punto ${data.nombre_punto} creado`, 'success');
          }
          onSuccess?.();
        } catch (e) {
          showToast(e.message, 'error');
          btn.disabled = false;
          btn.textContent = '✓ Crear punto';
        }
      });
    }
  }

  document.body.appendChild(overlay);
  render();
}

export async function openChecklistModal(sedeId) {
  let data;
  try {
    const res = await fetch(`/api/sedes/${sedeId}/checklist`);
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar checklist');
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  if (!data.checklist) {
    showToast('Este punto no tiene despacho asociado', 'info');
    return;
  }

  const cl = data.checklist;
  const BADGE = {
    creado:      { label: 'Pendiente envío', color: '#facc15', bg: 'rgba(234,179,8,.12)',    border: 'rgba(234,179,8,.2)',    icon: '📦' },
    en_transito: { label: 'En tránsito',     color: '#818cf8', bg: 'rgba(99,102,241,.1)',     border: 'rgba(99,102,241,.2)',   icon: '🚚' },
    en_sede:     { label: 'En sede',          color: '#34d399', bg: 'rgba(16,185,129,.1)',     border: 'rgba(16,185,129,.2)',   icon: '📍' },
    entregado:   { label: 'Entregado',        color: '#34d399', bg: 'rgba(16,185,129,.1)',     border: 'rgba(16,185,129,.2)',   icon: '✅' },
  };
  const est = BADGE[cl.estado] || BADGE.creado;
  const rowIcon = cl.estado === 'entregado' ? '✅' : cl.estado === 'en_transito' ? '🚚' : '📦';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px;">
        <div>
          <h2 style="margin:0 0 6px;font-size:16px;font-weight:700;color:var(--text);">${esc(cl.nombre_punto)}</h2>
          <span style="font-size:12px;padding:3px 10px;border-radius:12px;background:${est.bg};color:${est.color};border:1px solid ${est.border};">${est.icon} ${est.label}</span>
        </div>
        <button id="cl-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;flex-shrink:0;">✕</button>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);margin-bottom:8px;">Artículos despachados</div>
        ${cl.articulos.map(a => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="font-size:16px;">${rowIcon}</span>
            <div style="flex:1;">
              <div style="font-size:13px;">${esc(a.nombre)}</div>
              ${a.marca ? `<div style="font-size:11px;color:var(--text-3);">${esc(a.marca)}${a.modelo ? ' · ' + esc(a.modelo) : ''}${a.serial ? ' · SN: ' + esc(a.serial) : ''}</div>` : ''}
            </div>
            <span style="font-size:12px;color:var(--text-3);">× ${a.cantidad}</span>
          </div>`).join('')}
      </div>

      <div id="cl-actions"></div>
    </div>`;

  overlay.querySelector('#cl-x').addEventListener('click', () => overlay.remove());

  const actionsEl = overlay.querySelector('#cl-actions');

  if (cl.estado === 'creado') {
    actionsEl.innerHTML = `
      <button id="cl-enviado" class="btn btn-primary" style="width:100%;justify-content:center;">✓ Marcar como enviado</button>`;
    actionsEl.querySelector('#cl-enviado').addEventListener('click', async () => {
      const btn = actionsEl.querySelector('#cl-enviado');
      btn.disabled = true;
      btn.textContent = 'Marcando…';
      try {
        const res = await fetch(`/api/sedes/${sedeId}/marcar-enviado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agente: state.currentUser?.username || 'IT' }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error');
        showToast('Marcado como enviado · Comparte el link con el punto', 'success');
        overlay.remove();
      } catch (e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = '✓ Marcar como enviado';
      }
    });
  } else if (cl.estado === 'en_transito' || cl.estado === 'en_sede') {
    actionsEl.innerHTML = `
      <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:12px;">
        <div style="font-size:11px;font-weight:600;color:#818cf8;margin-bottom:6px;">Link para confirmar recepción en el punto:</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input readonly value="${esc(cl.tracking_url)}" id="cl-link-input"
            style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:11px;min-width:0;">
          <button id="cl-copy" style="padding:6px 12px;border:1px solid var(--primary);border-radius:6px;background:rgba(99,102,241,.15);color:#818cf8;font-size:12px;cursor:pointer;white-space:nowrap;">Copiar</button>
        </div>
      </div>`;
    actionsEl.querySelector('#cl-copy').addEventListener('click', () => {
      copyToClipboard(cl.tracking_url).then(ok => ok && showToast('Link copiado', 'success'));
    });
  }

  document.body.appendChild(overlay);
}
