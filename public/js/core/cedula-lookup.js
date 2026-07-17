/**
 * Attaches cedula validation to an input.
 * On blur: calls GET /api/erp/empleado/:cedula
 * Shows employee name below input if found, warning if not.
 *
 * @param {HTMLInputElement} cedulaInput
 * @param {HTMLInputElement|null} nameInput - auto-filled if found and empty
 * @param {{ onFound?: (emp) => void, onNotFound?: () => void }} options
 */
export function attachCedulaValidation(cedulaInput, nameInput, options = {}) {
  if (!cedulaInput || cedulaInput.dataset.cedulaValidation === '1') return;
  cedulaInput.dataset.cedulaValidation = '1';

  let _hint = null;

  function _removeHint() { _hint?.remove(); _hint = null; }

  function _showHint(text, color) {
    _removeHint();
    _hint = document.createElement('div');
    _hint.style.cssText = `font-size:11px;color:${color};margin-top:3px;`;
    _hint.textContent = text;
    cedulaInput.parentElement.appendChild(_hint);
  }

  cedulaInput.addEventListener('blur', async () => {
    const cedula = cedulaInput.value.trim();
    if (!cedula || cedula.length < 4) { _removeHint(); return; }
    try {
      const res = await fetch(`/api/erp/empleado/${encodeURIComponent(cedula)}`);
      if (res.ok) {
        const emp = await res.json();
        _showHint(`✓ ${emp.nombre} · ${emp.cargo}`, 'var(--success, #10b981)');
        if (nameInput && !nameInput.value.trim()) nameInput.value = emp.nombre;
        options.onFound?.(emp);
      } else {
        _showHint('⚠ Cédula no encontrada en el sistema', '#f59e0b');
        options.onNotFound?.();
      }
    } catch { _removeHint(); }
  });

  cedulaInput.addEventListener('input', _removeHint);
}

/**
 * Opens a modal showing full employee history for a cedula.
 * Calls GET /api/erp/empleado/:cedula/historial
 */
export async function openEmpleadoPerfil(cedula) {
  if (!cedula) return;

  const existing = document.getElementById('empleado-perfil-overlay');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'empleado-perfil-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:3000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
  overlay.innerHTML = `<div style="background:var(--surface);border-radius:16px;padding:28px;max-width:780px;width:100%;margin:auto;"><div style="text-align:center;padding:40px;color:var(--text-3);">Cargando perfil…</div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const res = await fetch(`/api/erp/empleado/${encodeURIComponent(cedula)}/historial`);
    if (!res.ok) throw new Error('No encontrado');
    const d = await res.json();
    const emp = d.empleado;

    const section = (title, rows, cols) => {
      if (!rows?.length) return `<p style="color:var(--text-3);font-size:12px;padding:8px 0;">Sin registros</p>`;
      return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">
        <thead><tr style="border-bottom:1px solid var(--border);">${cols.map(c=>`<th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;">${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr style="border-bottom:1px solid var(--border)20;">${Object.values(r).slice(0,cols.length).map(v=>`<td style="padding:7px 8px;color:var(--text);">${v ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    };

    overlay.querySelector('div').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--text);">${emp?.nombre ?? cedula}</div>
          <div style="font-size:13px;color:var(--text-3);margin-top:4px;">${[emp?.cargo, emp?.area, 'Cédula: '+cedula].filter(Boolean).join(' · ')}</div>
        </div>
        <button id="close-perfil" style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;cursor:pointer;color:var(--text-2);font-size:13px;">✕ Cerrar</button>
      </div>

      <details open style="margin-bottom:14px;">
        <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-2);padding:8px 0;">Tickets reportados (${d.tickets?.length ?? 0})</summary>
        ${section('tickets', d.tickets?.map(t=>({Número:t.ticket_number, Área:t.area, Estado:t.status, Prioridad:t.priority, Fecha:t.created_at?.slice(0,10)})), ['Número','Área','Estado','Prioridad','Fecha'])}
      </details>

      <details open style="margin-bottom:14px;">
        <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-2);padding:8px 0;">Despachos recibidos (${d.despachos?.length ?? 0})</summary>
        ${section('despachos', d.despachos?.map(t=>({Número:t.numero, Sede:t.sede, Fecha:t.fecha, Ítems:(() => { try { return JSON.parse(t.articulos||'[]').length; } catch { return 0; } })()})), ['Número','Sede','Fecha','Ítems'])}
      </details>

      <details open>
        <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-2);padding:8px 0;">Solicitudes IT (${d.tech_requests?.length ?? 0})</summary>
        ${section('tr', d.tech_requests?.map(t=>({Número:t.request_number, Tipo:t.type, Estado:t.status, Sede:t.sede, Fecha:t.created_at?.slice(0,10)})), ['Número','Tipo','Estado','Sede','Fecha'])}
      </details>
    `;

    document.getElementById('close-perfil')?.addEventListener('click', () => overlay.remove());
  } catch {
    overlay.querySelector('div').innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--danger);">Error cargando perfil del empleado.</div>
      <div style="text-align:center;"><button onclick="this.closest('#empleado-perfil-overlay').remove()" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);cursor:pointer;color:var(--text);">Cerrar</button></div>
    `;
  }
}
