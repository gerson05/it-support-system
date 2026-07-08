/**
 * despacho-rotulo.js
 *
 * Handles:
 *  - openTiposArticuloModal()
 *  - openRotuloModal(token, numero)
 *  - printDespacho(d)
 */
import { AREA_MAPPINGS } from '../../core/app.js';
import { state } from '../../core/state.js';
import { showToast } from '../../ui/components.js';
import { articulosList } from './despacho-helpers.js';

let _tiposArticulo = [];

export async function loadTiposArticulo() {
  try {
    const res = await fetch('/api/tipos-articulo');
    if (res.ok) _tiposArticulo = await res.json();
  } catch {}
  return _tiposArticulo;
}

export function openTiposArticuloModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'z-index:10003;';
  overlay.innerHTML = `
    <div class="modal-box modal-box-sm" style="max-width:420px;">
      <div class="modal-header">
        <h3 style="font-size:15px;font-weight:600;">Tipos de artículo</h3>
        <button id="tipos-close" class="modal-close">✕</button>
      </div>
      <div style="padding:16px 0;">
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <input id="tipos-input" class="form-control" placeholder="Nuevo tipo (ej: CABLES)" style="flex:1;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()">
          <button id="tipos-add" class="btn btn-primary" style="white-space:nowrap;">Agregar</button>
        </div>
        <div id="tipos-list" style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#tipos-close').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  async function renderList() {
    const tipos = await loadTiposArticulo();
    const list = overlay.querySelector('#tipos-list');
    if (!tipos.length) {
      list.innerHTML = `<div style="font-size:13px;color:var(--text-3);text-align:center;padding:12px;">Sin tipos registrados.</div>`;
      return;
    }
    list.innerHTML = tipos.map(t => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface-2);border-radius:6px;border:1px solid var(--border);">
        <span style="font-size:13px;font-weight:500;font-family:monospace;">${t.nombre}</span>
        <button class="btn-del-tipo" data-id="${t.id}" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;line-height:1;padding:2px 6px;" title="Eliminar">✕</button>
      </div>`).join('');
    list.querySelectorAll('.btn-del-tipo').forEach(btn => {
      btn.onclick = async () => {
        btn.disabled = true;
        await fetch(`/api/tipos-articulo/${btn.dataset.id}`, { method: 'DELETE' });
        renderList();
      };
    });
  }

  overlay.querySelector('#tipos-add').onclick = async () => {
    const input  = overlay.querySelector('#tipos-input');
    const nombre = input.value.trim();
    if (!nombre) return;
    const res = await fetch('/api/tipos-articulo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    if (res.ok) { input.value = ''; renderList(); }
    else { const d = await res.json(); showToast(d.error || 'Error', 'error'); }
  };

  overlay.querySelector('#tipos-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('#tipos-add').click();
  });

  renderList();
}

const LABEL_SIZES_ROTULO = [
  { v: '10x8',  l: '10 × 8 cm  (apaisado)' },
  { v: '10x10', l: '10 × 10 cm (cuadrado)' },
  { v: '10x15', l: '10 × 15 cm (retrato)' },
  { v: '15x10', l: '15 × 10 cm (apaisado ancho)' },
  { v: '8x5',   l: '8 × 5 cm   (pequeño)' },
];

export async function openRotuloModal(token, numero, destinatario = '') {
  const tipos     = await loadTiposArticulo();
  const tiposOpts = tipos.length
    ? tipos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('')
    : `<option value="ARTÍCULO">ARTÍCULO</option>`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'z-index:10002;';
  overlay.innerHTML = `
    <div class="modal-box modal-box-sm" style="max-width:380px;">
      <div class="modal-header">
        <h3 style="font-size:15px;font-weight:600;">Configurar Rótulo</h3>
        <button id="rotulo-close" class="modal-close">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;padding:16px 0;">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-2);">Tipo de artículo</label>
            <button id="rotulo-manage-tipos" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--primary);text-decoration:underline;padding:0;">Gestionar lista</button>
          </div>
          <select id="rotulo-tipo" class="form-control">${tiposOpts}</select>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Remite (departamento)</label>
          <input id="rotulo-remite" class="form-control" value="DPTO. DE SISTEMAS" style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()" />
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Cajas</label>
          <input id="rotulo-cajas" class="form-control" type="number" min="1" max="99" value="1" />
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;">Modo de impresión</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:6px;">
            <input type="radio" name="rotulo-modo" value="single" checked /> Un solo rótulo (destino del despacho)
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:6px;">
            <input type="radio" name="rotulo-modo" value="todos" /> Todos los puntos activos
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
            <input type="radio" name="rotulo-modo" value="custom" /> Seleccionar sedes específicas
          </label>
          <div id="rotulo-custom-sedes" style="display:none;margin-top:10px;max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;">
            <div id="rotulo-sedes-loading" style="font-size:12px;color:var(--text-3);padding:4px;">Cargando sedes…</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px;">Tipo de impresora</label>
          <div style="display:flex;gap:10px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;">
              <input type="radio" name="rotulo-printer" value="normal" checked />
              <span><span style="display:block;font-weight:600;">Impresora normal</span><span style="font-size:11px;color:var(--text-3);">Hoja A4</span></span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:6px;">
              <input type="radio" name="rotulo-printer" value="etiqueta" />
              <span><span style="display:block;font-weight:600;">Impresora de etiquetas</span><span style="font-size:11px;color:var(--text-3);">Tamaño personalizado</span></span>
            </label>
          </div>
        </div>
        <div id="rotulo-label-sizes" style="display:none;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px;">Tamaño de etiqueta</label>
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${LABEL_SIZES_ROTULO.map((s, i) => `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-family:monospace;">
              <input type="radio" name="rotulo-size" value="${s.v}"${i === 0 ? ' checked' : ''} /> ${s.l}
            </label>`).join('')}
          </div>
          <div style="margin-top:6px;padding:6px 10px;background:var(--surface-2);border-radius:6px;font-size:11px;color:var(--text-3);">
            Configura tu impresora con el mismo tamaño de papel al imprimir.
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button id="rotulo-cancel" class="btn btn-secondary">Cancelar</button>
        <button id="rotulo-print" class="btn btn-primary">Abrir para imprimir</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#rotulo-close').onclick  = close;
  overlay.querySelector('#rotulo-cancel').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#rotulo-manage-tipos').onclick = async () => {
    openTiposArticuloModal();
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[id="tipos-close"]')) {
        observer.disconnect();
        loadTiposArticulo().then(tipos => {
          const sel = overlay.querySelector('#rotulo-tipo');
          if (!sel || !tipos.length) return;
          const cur = sel.value;
          sel.innerHTML = tipos.map(t => `<option value="${t.nombre}"${t.nombre === cur ? ' selected' : ''}>${t.nombre}</option>`).join('');
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: false });
  };

  let sedesCache = null;

  async function loadSedes() {
    if (sedesCache) return sedesCache;
    try {
      const data = await fetch('/api/sedes').then(r => r.json());
      const grouped = data.grouped || {};
      sedesCache = Object.values(grouped).flat().filter(s => s.activo);
      return sedesCache;
    } catch { return []; }
  }

  async function renderSedesCheckboxes() {
    const container = overlay.querySelector('#rotulo-custom-sedes');
    const loading   = overlay.querySelector('#rotulo-sedes-loading');
    loading.textContent = 'Cargando…';
    const sedes = await loadSedes();
    if (!sedes.length) { loading.textContent = 'No hay sedes activas.'; return; }
    loading.remove();
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border);';
    toggleRow.innerHTML = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:600;">
      <input type="checkbox" id="rotulo-sel-all" /> Marcar / desmarcar todas
    </label>`;
    container.appendChild(toggleRow);
    sedes.forEach(s => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:3px 0;';
      row.innerHTML = `<input type="checkbox" class="rotulo-sede-cb" value="${s.nombre_punto}" /> ${s.nombre_punto}`;
      container.appendChild(row);
    });
    overlay.querySelector('#rotulo-sel-all').addEventListener('change', e => {
      overlay.querySelectorAll('.rotulo-sede-cb').forEach(cb => cb.checked = e.target.checked);
    });
  }

  overlay.querySelectorAll('input[name="rotulo-modo"]').forEach(r => {
    r.addEventListener('change', async () => {
      const customDiv = overlay.querySelector('#rotulo-custom-sedes');
      customDiv.style.display = r.value === 'custom' ? 'block' : 'none';
      if (r.value === 'custom' && !sedesCache) await renderSedesCheckboxes();
    });
  });

  overlay.querySelectorAll('input[name="rotulo-printer"]').forEach(r => {
    r.addEventListener('change', () => {
      overlay.querySelector('#rotulo-label-sizes').style.display = r.value === 'etiqueta' ? 'block' : 'none';
    });
  });

  overlay.querySelector('#rotulo-print').onclick = () => {
    const tipo         = overlay.querySelector('#rotulo-tipo').value;
    const remite       = overlay.querySelector('#rotulo-remite').value.toUpperCase();
    const remitente    = (state.currentUser?.username || '').toUpperCase();
    const responsable  = destinatario.toUpperCase();
    const cajas        = overlay.querySelector('#rotulo-cajas').value;
    const modo         = overlay.querySelector('input[name="rotulo-modo"]:checked').value;
    const printer      = overlay.querySelector('input[name="rotulo-printer"]:checked').value;
    const label_size   = overlay.querySelector('input[name="rotulo-size"]:checked')?.value || '10x8';
    const params       = new URLSearchParams({ tipo_articulo: tipo, remite, remitente, responsable, cajas, modo, printer, label_size });
    if (modo === 'custom') {
      const checked = [...overlay.querySelectorAll('.rotulo-sede-cb:checked')].map(cb => cb.value);
      if (!checked.length) { showToast('Selecciona al menos una sede', 'error'); return; }
      params.set('sedes', checked.join(','));
    }
    window.open(`/api/tracking/${token}/rotulo?${params}`, '_blank');
    close();
  };
}

export function printDespacho(d) {
  let arts = [];
  try { arts = JSON.parse(d.articulos || '[]'); } catch {}
  const artRows = arts.map(a => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ccc;">
        <strong>${a.nombre}</strong>
        ${a.descripcion ? `<br><small style="color:#555;">${a.descripcion}</small>` : ''}
      </td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.marca  || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.modelo || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.serial || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.cantidad}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>Despacho ${d.numero}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:30px;max-width:700px;margin:0 auto;}
      h1{font-size:18px;margin:0;} h2{font-size:13px;font-weight:normal;margin:2px 0 0;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:18px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:18px;}
      .meta dt{font-weight:600;font-size:11px;color:#555;text-transform:uppercase;margin:0;}
      .meta dd{margin:0 0 4px;font-size:13px;}
      table{width:100%;border-collapse:collapse;margin-bottom:18px;}
      th{background:#f0f0f0;padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:12px;}
      .firma{margin-top:40px;display:flex;gap:60px;}
      .firma div{flex:1;border-top:1px solid #555;padding-top:6px;font-size:11px;color:#555;}
      @media print{body{padding:10px;}}
    </style>
  </head><body>
    <div class="header">
      <div>
        <h1>Mi Farmacia — IT</h1>
        <h2>Comprobante de Despacho</h2>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:700;letter-spacing:1px;">${d.numero}</div>
        <div style="font-size:12px;color:#555;">${d.fecha || ''}</div>
      </div>
    </div>
    <dl class="meta">
      <dt>Destinatario</dt><dd>${d.destinatario}${d.cedula ? ` — CC ${d.cedula}` : ''}</dd>
      <dt>Sede</dt><dd>${d.sede || '—'}</dd>
      <dt>Área</dt><dd>${d.area ? (AREA_MAPPINGS[d.area]?.label || d.area) : '—'}</dd>
      <dt>Agente</dt><dd>${d.agente || '—'}</dd>
      ${d.ticket_id   ? `<dt>Ticket vinculado</dt><dd>#${d.ticket_id}</dd>` : ''}
      ${d.acta_numero ? `<dt>N° Acta</dt><dd>${d.acta_numero}</dd>`          : ''}
    </dl>
    <table>
      <thead><tr>
        <th>Artículo</th><th style="width:100px;text-align:center;">Marca</th><th style="width:100px;text-align:center;">Modelo</th><th style="width:120px;text-align:center;">Serial</th><th style="width:70px;text-align:center;">Cantidad</th>
      </tr></thead>
      <tbody>${artRows}</tbody>
    </table>
    ${d.observaciones ? `<p style="font-size:12px;color:#555;"><strong>Observaciones:</strong> ${d.observaciones}</p>` : ''}
    ${d.requiere_acta ? `
    <div class="firma">
      <div>Firma del Receptor<br><br>${d.destinatario}</div>
      <div>Firma del Agente IT<br><br>${d.agente || 'Agente IT'}</div>
    </div>` : ''}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
