import { showToast } from '../../ui/components.js';

const esc = str => String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export async function openDetalleModal(token) {
  const existing = document.getElementById('inv-detalle-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'inv-detalle-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;width:100%;max-width:480px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;">
      <div style="padding:30px;text-align:center;color:var(--text-3);">Cargando…</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const res  = await fetch(`/api/inventario/activo/${token}`);
    if (!res.ok) throw new Error('No encontrado');
    const d = await res.json();
    const { _meta } = d;

    const row = (label, val) => val ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span style="font-size:12px;color:var(--text-3);font-weight:500;">${label}</span><span style="font-size:13px;font-weight:600;color:var(--text);text-align:right;max-width:60%;word-break:break-word;">${esc(val)}</span></div>` : '';
    const sec = (title, rows) => { const c = rows.filter(Boolean).join(''); return c ? `<div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;padding:12px 0 4px;margin-top:4px;">${title}</div>${c}` : ''; };

    let fields = '';
    if (_meta.tabla === 'inventario_equipos') {
      fields =
        sec('Identificación', [row('Placa', d.placa), row('Serial', d.serial), row('Serial cargador', d.serial_cargador)]) +
        sec('Equipo', [row('Nombre', d.nombre_equipo), row('Marca', d.marca), row('Procesador', d.procesador),
          row('RAM', d.ram ? `${d.ram}${d.tipo_ram ? ' ' + d.tipo_ram : ''}` : null),
          row('Disco', d.cap_disco ? `${d.cap_disco}${d.tipo_disco ? ' ' + d.tipo_disco : ''}` : null),
          row('Fecha compra', d.fecha_compra)]) +
        sec('Asignación', [row('Área', d.area), row('Responsable', d.responsable)]);
    } else if (_meta.tabla === 'inventario_celulares') {
      fields =
        sec('Identificación', [row('Placa', d.placa), row('IMEI', d.imei), row('IMEI 2', d.imei2), row('Serial', d.serial), row('Línea', d.linea), row('Operador', d.operador)]) +
        sec('Equipo', [row('Modelo', d.modelo), row('Equipo', d.equipo), row('Almacenamiento', d.almacenamiento),
          row('RAM', d.ram), row('Accesorio', d.accesorio), row('Estado', d.estado)]) +
        sec('Asignación', [row('Usuario', d.nombre_completo), row('Cédula', d.cedula),
          row('Área', d.area), row('Ciudad', d.ciudad), row('Entregado por', d.entregado_por), row('Fecha entrega', d.fecha_entrega)]);
    } else {
      fields =
        sec('Identificación', [row('Placa', d.placa), row('Serial', d.serial)]) +
        sec('Equipo', [row('Nombre', d.nombre_equipo), row('Marca', d.marca), row('Voltaje', d.voltaje),
          row('Fecha compra', d.fecha_compra), row('Fecha despacho', d.fecha_despacho)]) +
        sec('Asignación', [row('Área', d.area)]);
    }

    overlay.querySelector('div').innerHTML = `
      <div style="background:var(--primary);padding:18px 20px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;">${esc(_meta.tipo)}</div>
          <div style="font-size:17px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:1px;">${esc(d[_meta.idField] || '—')}</div>
        </div>
        <button id="det-close" style="background:rgba(255,255,255,.2);border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <div style="display:flex;gap:0;max-height:65vh;overflow:hidden;">
        <div style="flex:1;padding:0 20px 20px;overflow-y:auto;">${fields}</div>
        <div style="flex-shrink:0;width:140px;border-left:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:8px;">
          <img src="/activo/${token}/qr" style="width:100px;height:100px;" alt="QR">
          <div style="font-size:10px;color:var(--text-3);text-align:center;line-height:1.4;">Escanea para ver ficha</div>
          <button id="det-print-qr" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:11px;cursor:pointer;width:100%;">🖨️ Etiqueta</button>
        </div>
      </div>`;

    overlay.querySelector('#det-close').onclick = () => overlay.remove();
    overlay.querySelector('#det-print-qr').onclick = () => { overlay.remove(); openEtiquetaModal(token); };
  } catch (e) {
    overlay.querySelector('div').innerHTML = `<div style="padding:30px;text-align:center;color:var(--danger);">${e.message}</div>`;
  }
}

export function openEtiquetaModal(token) {
  const existing = document.getElementById('inv-etiqueta-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'inv-etiqueta-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:24px;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:15px;font-weight:700;color:var(--text);">Etiqueta de activo fijo</h3>
        <button id="etq-close" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;min-height:130px;">
        <iframe id="etq-frame" src="/activo/${token}/etiqueta?preview=1"
          style="width:200px;height:100px;border:none;transform-origin:top left;"
          scrolling="no"></iframe>
      </div>
      <p style="font-size:11px;color:var(--text-3);text-align:center;margin-bottom:14px;">Etiqueta 50×25mm · se imprimirá en tamaño real</p>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="etq-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">Cancelar</button>
        <button id="etq-print" style="padding:8px 18px;border:none;border-radius:7px;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#etq-close').onclick  = close;
  overlay.querySelector('#etq-cancel').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#etq-print').onclick = () => {
    const frame = overlay.querySelector('#etq-frame');
    frame.contentWindow.print();
  };
}

export async function confirmDelete(id, label, apiTab, onRefresh) {
  if (!confirm(`¿Eliminar "${label}"?`)) return;
  try {
    const res = await fetch(`/api/inventario/${apiTab}/${id}`, { method: 'DELETE' });
    const d   = await res.json();
    if (!res.ok) throw new Error(d.error);
    showToast('Registro eliminado.', 'success');
    if (onRefresh) onRefresh();
  } catch (err) {
    showToast(err.message || 'Error al eliminar.', 'error');
  }
}
