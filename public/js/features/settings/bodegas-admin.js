import { showToast, invalidateBodegasCache } from '../../ui/components.js';

async function fetchBodegas() {
  const r = await fetch('/api/bodegas');
  if (!r.ok) throw new Error('Error al cargar bodegas');
  return r.json();
}

function openBodegaModal({ bodega = null, onSave }) {
  const isEdit = !!bodega;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text);">${isEdit ? 'Editar bodega' : 'Nueva bodega'}</h3>
        <button id="bm-close" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
      </div>
      <form id="bodega-form" autocomplete="off">
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Nombre *</label>
          <input name="nombre" required type="text" value="${bodega?.nombre || ''}"
            placeholder="Ej. 11 MI FARMACIA AIC CALI"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Ciudad *</label>
          <input name="ciudad" required type="text" value="${bodega?.ciudad || ''}"
            placeholder="Ej. CALI"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;text-transform:uppercase;">
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" id="bm-cancel" style="padding:8px 18px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">Cancelar</button>
          <button type="submit" style="padding:8px 18px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">${isEdit ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#bm-close').onclick = () => overlay.remove();
  overlay.querySelector('#bm-cancel').onclick = () => overlay.remove();

  overlay.querySelector('#bodega-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { nombre: fd.get('nombre').trim(), ciudad: fd.get('ciudad').trim().toUpperCase() };
    try {
      const url    = isEdit ? `/api/bodegas/${bodega.id}` : '/api/bodegas';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json()).error || 'Error');
      showToast(isEdit ? 'Bodega actualizada' : 'Bodega creada', 'success');
      invalidateBodegasCache();
      overlay.remove();
      onSave?.();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export async function renderBodegasPanel(container) {
  container.innerHTML = `
    <div style="padding:0 0 24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:var(--text-3);">Bodegas disponibles para seleccionar en despachos.</p>
        <button id="btn-nueva-bodega" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:7px 14px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva bodega
        </button>
      </div>
      <div id="bodegas-table-wrap" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface);">
        <div style="padding:30px;text-align:center;color:var(--text-3);">Cargando…</div>
      </div>
    </div>`;

  async function load() {
    const wrap = container.querySelector('#bodegas-table-wrap');
    try {
      const { rows } = await fetchBodegas();
      if (!rows?.length) {
        wrap.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-3);">No hay bodegas registradas.</div>`;
        return;
      }
      wrap.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);">
                <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Ciudad</th>
                <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Nombre</th>
                <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Estado</th>
                <th style="padding:9px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(b => `
                <tr data-id="${b.id}" style="border-bottom:1px solid var(--border);">
                  <td style="padding:10px 14px;font-size:12px;color:var(--text-3);">${b.ciudad}</td>
                  <td style="padding:10px 14px;font-size:13px;font-weight:500;color:var(--text);">${b.nombre}</td>
                  <td style="padding:10px 14px;">
                    <span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:600;
                      background:${b.activo ? 'rgba(52,211,153,.15)' : 'rgba(148,163,184,.12)'};
                      color:${b.activo ? '#34d399' : 'var(--text-3)'};">
                      ${b.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style="padding:10px 14px;text-align:right;white-space:nowrap;">
                    <button class="btn-bodega-edit" data-id="${b.id}" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;margin-right:4px;">Editar</button>
                    <button class="btn-bodega-toggle" data-id="${b.id}" data-activo="${b.activo}" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;">
                      ${b.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

      wrap.querySelectorAll('.btn-bodega-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = rows.find(b => b.id === parseInt(btn.dataset.id));
          openBodegaModal({ bodega: row, onSave: load });
        });
      });

      wrap.querySelectorAll('.btn-bodega-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id     = parseInt(btn.dataset.id);
          const activo = btn.dataset.activo === '1' ? 0 : 1;
          try {
            const r = await fetch(`/api/bodegas/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ activo }),
            });
            if (!r.ok) throw new Error((await r.json()).error || 'Error');
            showToast(activo ? 'Bodega activada' : 'Bodega desactivada', 'success');
            invalidateBodegasCache();
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (e) {
      wrap.innerHTML = `<div style="padding:30px;color:var(--danger);text-align:center;">${e.message}</div>`;
    }
  }

  container.querySelector('#btn-nueva-bodega').onclick = () => openBodegaModal({ onSave: load });
  load();
}
