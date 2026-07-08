import {
  formatDate,
  getPriorityBadge,
  getStatusBadge,
  getAreaEmoji,
  getAreaName
} from '../core/app.js';

/* ── Iconos SVG inline (Lucide) ──────────────────────────────────────── */
const AREA_ICONS = {
  cartera:        `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  compra:         `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  gestion_humana: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  pqrs:           `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  contabilidad:   `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  farmacia:       `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  cuentas_medicas:`<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  general:        `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
};

/**
 * Tarjeta de estadísticas
 */
export function createStatCard(title, value, icon, colorClass = '') {
  return `
    <div class="card stat-card ${colorClass}">
      <div class="stat-info">
        <span class="stat-value">${value}</span>
        <span class="stat-label">${title}</span>
      </div>
      <div class="stat-icon-container">${icon}</div>
    </div>
  `;
}

/**
 * Fila de tabla de ticket
 */
export function createTicketRow(ticket) {
  const areaName  = getAreaName(ticket.area);
  const areaIcon  = AREA_ICONS[ticket.area] || AREA_ICONS.general;
  const agentName = ticket.agent_name || `<span style="color:var(--text-3);font-style:italic;">Sin asignar</span>`;
  const title = ticket.title?.trim()
    ? ticket.title
    : (ticket.description || '').slice(0, 70) + ((ticket.description?.length > 70) ? '…' : '');

  return `
    <tr onclick="window.location.hash='#ticket/${ticket.id}'">
      <td>
        <span style="font-size:12px;font-weight:600;color:var(--primary);font-family:monospace;letter-spacing:.3px;">${ticket.ticket_number}</span>
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:var(--surface-2);border:1px solid var(--border);border-radius:99px;font-size:11px;color:var(--text-2);white-space:nowrap;">
          <span style="color:var(--text-3);">${areaIcon}</span>
          ${areaName}
        </span>
      </td>
      <td style="max-width:300px;">
        <div style="font-weight:500;font-size:13px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);"
             title="${(ticket.title||'').replace(/"/g,'&quot;')}">${title}</div>
        <div style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:5px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${ticket.requester_name || 'Sin nombre'} · ${ticket.phone}
        </div>
      </td>
      <td>${getPriorityBadge(ticket.priority)}</td>
      <td>${getStatusBadge(ticket.status)}</td>
      <td style="font-size:12px;color:var(--text-2);">${agentName}</td>
      <td style="font-size:12px;color:var(--text-3);white-space:nowrap;">${formatDate(ticket.updated_at)}</td>
    </tr>
  `;
}

/**
 * Estado vacío
 */
export function createEmptyState(message = 'No se encontraron resultados', icon = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <p>${message}</p>
    </div>
  `;
}

/**
 * Spinner de carga
 */
export function createLoadingSpinner() {
  return `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <span>Cargando…</span>
    </div>
  `;
}

/**
 * Toast de notificación
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.innerHTML = icons[type] || icons.info;

  const msgSpan = document.createElement('span');
  msgSpan.style.cssText = 'font-size:13px;font-weight:500;flex:1;';
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(12px)';
    toast.style.transition = 'all .2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

/* ── Sede / Bodega search combobox ────────────────────────────────────── */

let _sedesCache   = null;
let _bodegasCache = null;

async function _fetchSedes() {
  if (_sedesCache) return _sedesCache;
  try {
    const res = await fetch('/api/sedes');
    const data = res.ok ? await res.json() : {};
    _sedesCache = data.grouped || data;
  } catch { _sedesCache = {}; }
  return _sedesCache;
}

async function _fetchBodegas() {
  if (_bodegasCache) return _bodegasCache;
  try {
    const res = await fetch('/api/bodegas');
    const data = res.ok ? await res.json() : {};
    _bodegasCache = data.grouped || data;
  } catch { _bodegasCache = {}; }
  return _bodegasCache;
}

export function invalidateBodegasCache() { _bodegasCache = null; }

let _puntosCache = null;
async function _fetchPuntos() {
  if (_puntosCache) return _puntosCache;
  try {
    const res = await fetch('/api/puntos?activo=1');
    const data = res.ok ? await res.json() : {};
    _puntosCache = data.grouped || {};
  } catch { _puntosCache = {}; }
  return _puntosCache;
}
export function invalidatePuntosCache() { _puntosCache = null; }

export function attachPuntoSearch(inputEl) {
  if (!inputEl) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:block;';
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);

  const icon = document.createElement('div');
  icon.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-3);display:flex;align-items:center;pointer-events:none;';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  wrapper.appendChild(icon);
  inputEl.style.paddingRight = '28px';

  const dropdown = document.createElement('div');
  dropdown.style.cssText =
    'display:none;position:fixed;' +
    'background:var(--surface);border:1px solid var(--border);border-radius:8px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:99999;max-height:220px;overflow-y:auto;';
  document.body.appendChild(dropdown);

  function positionDropdown() {
    const r = inputEl.getBoundingClientRect();
    dropdown.style.top   = `${r.bottom + 2}px`;
    dropdown.style.left  = `${r.left}px`;
    dropdown.style.width = `${r.width}px`;
  }

  function renderDropdown(q) {
    const query = (q || '').toLowerCase().trim();
    dropdown.innerHTML = '';
    let first = true;
    let hasAny = false;

    Object.entries(_puntosCache || {}).forEach(([ciudad, puntos]) => {
      const matches = puntos.filter(p =>
        p.activo !== 0 && (
          !query ||
          ciudad.toLowerCase().includes(query) ||
          (p.nombre || '').toLowerCase().includes(query)
        )
      );
      if (!matches.length) return;
      hasAny = true;

      const hdr = document.createElement('div');
      hdr.style.cssText =
        'padding:5px 12px 3px;font-size:10px;font-weight:700;color:var(--text-3);' +
        `text-transform:uppercase;letter-spacing:.5px;${first ? '' : 'border-top:1px solid var(--border);margin-top:4px;'}`;
      hdr.textContent = ciudad;
      dropdown.appendChild(hdr);
      first = false;

      matches.forEach(p => {
        const item = document.createElement('div');
        item.style.cssText =
          'padding:8px 12px;font-size:13px;color:var(--text);cursor:pointer;transition:background .1s;display:flex;align-items:center;justify-content:space-between;gap:8px;';
        const label = document.createElement('span');
        label.textContent = p.nombre;
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:10px;padding:1px 6px;border-radius:99px;background:var(--surface-3);color:var(--text-3);flex-shrink:0;';
        badge.textContent = p.tipo === 'bodega' ? 'Bodega' : 'Punto';
        item.appendChild(label);
        item.appendChild(badge);
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-2)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          inputEl.value = p.nombre;
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });
    });

    if (!hasAny) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;text-align:center;font-size:13px;color:var(--text-3);';
      empty.textContent = query ? `Sin resultados para "${q}"` : 'No hay puntos registrados';
      dropdown.appendChild(empty);
    }

    dropdown.style.display = '';
  }

  inputEl.addEventListener('focus', async () => {
    await _fetchPuntos();
    positionDropdown();
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener('input', () => {
    if (dropdown.style.display !== 'none') { positionDropdown(); renderDropdown(inputEl.value); }
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => { dropdown.style.display = 'none'; }, 180);
  });
}

export function attachSedeSearch(inputEl) {
  if (!inputEl) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:block;';
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);

  // Lupa icon
  const icon = document.createElement('div');
  icon.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-3);display:flex;align-items:center;pointer-events:none;';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  wrapper.appendChild(icon);

  // Add padding so input text doesn't overlap icon
  inputEl.style.paddingRight = '28px';

  const dropdown = document.createElement('div');
  dropdown.style.cssText =
    'display:none;position:fixed;' +
    'background:var(--surface);border:1px solid var(--border);border-radius:8px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:99999;max-height:220px;overflow-y:auto;';
  document.body.appendChild(dropdown);

  function positionDropdown() {
    const r = inputEl.getBoundingClientRect();
    dropdown.style.top   = `${r.bottom + 2}px`;
    dropdown.style.left  = `${r.left}px`;
    dropdown.style.width = `${r.width}px`;
  }

  function renderDropdown(q) {
    const query = (q || '').toLowerCase().trim();
    dropdown.innerHTML = '';
    let first = true;
    let hasAny = false;

    Object.entries(_sedesCache || {}).forEach(([ciudad, puntos]) => {
      const matches = puntos.filter(p =>
        p.activo !== 0 && (
          !query ||
          ciudad.toLowerCase().includes(query) ||
          p.nombre_punto.toLowerCase().includes(query)
        )
      );
      if (!matches.length) return;
      hasAny = true;

      const hdr = document.createElement('div');
      hdr.style.cssText =
        'padding:5px 12px 3px;font-size:10px;font-weight:700;color:var(--text-3);' +
        `text-transform:uppercase;letter-spacing:.5px;${first ? '' : 'border-top:1px solid var(--border);margin-top:4px;'}`;
      hdr.textContent = ciudad;
      dropdown.appendChild(hdr);
      first = false;

      matches.forEach(p => {
        const item = document.createElement('div');
        item.style.cssText =
          'padding:8px 12px;font-size:13px;color:var(--text);cursor:pointer;transition:background .1s;';
        item.textContent = p.nombre_punto;
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-2)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          inputEl.value = p.nombre_punto;
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });
    });

    if (!hasAny) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;text-align:center;font-size:13px;color:var(--text-3);';
      empty.textContent = query ? `Sin resultados para "${q}"` : 'No hay sedes registradas';
      dropdown.appendChild(empty);
    }

    dropdown.style.display = '';
  }

  inputEl.addEventListener('focus', async () => {
    await _fetchSedes();
    positionDropdown();
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener('input', () => {
    if (dropdown.style.display !== 'none') { positionDropdown(); renderDropdown(inputEl.value); }
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => { dropdown.style.display = 'none'; }, 180);
  });
}

export function attachBodegaSearch(inputEl) {
  if (!inputEl) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:block;';
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);

  const icon = document.createElement('div');
  icon.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-3);display:flex;align-items:center;pointer-events:none;';
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  wrapper.appendChild(icon);
  inputEl.style.paddingRight = '28px';

  const dropdown = document.createElement('div');
  dropdown.style.cssText =
    'display:none;position:fixed;' +
    'background:var(--surface);border:1px solid var(--border);border-radius:8px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:99999;max-height:220px;overflow-y:auto;';
  document.body.appendChild(dropdown);

  function positionDropdown() {
    const r = inputEl.getBoundingClientRect();
    dropdown.style.top   = `${r.bottom + 2}px`;
    dropdown.style.left  = `${r.left}px`;
    dropdown.style.width = `${r.width}px`;
  }

  function renderDropdown(q) {
    const query = (q || '').toLowerCase().trim();
    dropdown.innerHTML = '';
    let first = true;
    let hasAny = false;

    Object.entries(_bodegasCache || {}).forEach(([ciudad, puntos]) => {
      const matches = puntos.filter(p =>
        p.activo !== 0 && (
          !query ||
          ciudad.toLowerCase().includes(query) ||
          p.nombre_punto.toLowerCase().includes(query)
        )
      );
      if (!matches.length) return;
      hasAny = true;

      const hdr = document.createElement('div');
      hdr.style.cssText =
        'padding:5px 12px 3px;font-size:10px;font-weight:700;color:var(--text-3);' +
        `text-transform:uppercase;letter-spacing:.5px;${first ? '' : 'border-top:1px solid var(--border);margin-top:4px;'}`;
      hdr.textContent = ciudad;
      dropdown.appendChild(hdr);
      first = false;

      matches.forEach(p => {
        const item = document.createElement('div');
        item.style.cssText =
          'padding:8px 12px;font-size:13px;color:var(--text);cursor:pointer;transition:background .1s;';
        item.textContent = p.nombre_punto;
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-2)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          inputEl.value = p.nombre_punto;
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });
    });

    if (!hasAny) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;text-align:center;font-size:13px;color:var(--text-3);';
      empty.textContent = query ? `Sin resultados para "${q}"` : 'No hay bodegas registradas';
      dropdown.appendChild(empty);
    }

    dropdown.style.display = '';
  }

  inputEl.addEventListener('focus', async () => {
    await _fetchBodegas();
    positionDropdown();
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener('input', () => {
    if (dropdown.style.display !== 'none') { positionDropdown(); renderDropdown(inputEl.value); }
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => { dropdown.style.display = 'none'; }, 180);
  });
}

/**
 * Copia texto al portapapeles de manera robusta, funcionando incluso en contextos no seguros (HTTP)
 * o en navegadores móviles donde navigator.clipboard no está disponible o falla.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard failed, trying fallback', e);
    }
  }

  // Fallback para contextos no seguros o navegadores sin soporte
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Estilos para ocultar el textarea sin display: none (lo cual prevendría select())
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, 99999); // Soporte para móviles iOS

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    if (successful) {
      return true;
    } else {
      throw new Error('execCommand copy returned false');
    }
  } catch (err) {
    console.error('Error al copiar usando fallback:', err);
    return false;
  }
}

/**
 * Tarjeta de resultado KB para el tab AI.
 * @param {object} item  - item de kb_items con campos: id, titulo, categoria, solucion, comandos, _score
 * @param {boolean} isBestMatch
 */
export function createAiKbCard(item, isBestMatch) {
  let cmds = [];
  try { cmds = JSON.parse(item.comandos || '[]'); } catch {}
  const cmdCount = cmds.length;
  const solucionCorta = item.solucion.length > 120
    ? item.solucion.slice(0, 120) + '…'
    : item.solucion;

  return `
    <div class="ai-kb-card" data-kb-id="${item.id}" style="
      background: var(--surface-2, #1e293b);
      border: 1px solid ${isBestMatch ? 'var(--primary, #3b82f6)' : 'var(--border, #334155)'};
      border-radius: 8px; padding: 12px; margin-bottom: 10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="color:var(--primary,#60a5fa);font-weight:600;font-size:13px;">📚 ${item.titulo}</div>
        ${isBestMatch ? '<span style="background:#166534;color:#4ade80;font-size:9px;padding:2px 7px;border-radius:3px;white-space:nowrap;">MEJOR MATCH</span>' : ''}
      </div>
      <div style="color:var(--text-muted,#94a3b8);font-size:11px;margin-bottom:6px;text-transform:capitalize;">
        ${item.categoria}${cmdCount > 0 ? ` · ${cmdCount} comando${cmdCount > 1 ? 's' : ''}` : ''}
      </div>
      <div class="ai-kb-solucion" style="color:var(--text,#cbd5e1);font-size:12px;margin-bottom:10px;">${solucionCorta}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${cmdCount > 0 ? `<button class="btn btn-primary btn-small ai-btn-exec" data-kb-id="${item.id}" style="font-size:12px;">▶ Ejecutar en equipo</button>` : ''}
        <button class="btn btn-secondary btn-small ai-btn-ver" data-kb-id="${item.id}" style="font-size:12px;">Ver solución completa</button>
      </div>
    </div>
  `;
}

/**
 * Modal de confirmación de ejecución remota.
 * @param {object[]} onlineAgents  - agentes con status='online'
 * @param {string[]} commands      - lista de comandos a ejecutar
 * @param {number|null} linkedAgentId - id del agente vinculado al ticket (null si ninguno)
 * @param {string} kbTitulo        - nombre del item KB para el título
 */
export function createExecutionModal(onlineAgents, commands, linkedAgentId, kbTitulo) {
  const linkedOnline = linkedAgentId
    ? onlineAgents.find(a => a.id === linkedAgentId)
    : null;

  const agentSelectorHtml = linkedOnline
    ? `
      <div style="display:flex;align-items:center;gap:10px;background:rgba(22,101,52,.25);border:1px solid #166534;border-radius:6px;padding:10px;margin-bottom:10px;">
        <span style="font-size:20px;">🖥️</span>
        <div>
          <div style="color:#4ade80;font-weight:600;font-size:13px;">${linkedOnline.name} <span style="background:#166534;color:#4ade80;font-size:9px;padding:1px 5px;border-radius:3px;">Online</span></div>
          <div style="color:#86efac;font-size:11px;">Equipo del solicitante</div>
        </div>
      </div>
      <input type="hidden" id="exec-agent-id" value="${linkedOnline.id}">`
    : `
      <div style="color:#fbbf24;font-size:12px;margin-bottom:8px;">
        ⚠️ ${linkedAgentId ? 'Equipo del solicitante offline.' : 'Sin equipo vinculado.'} Selecciona destino:
      </div>
      <select id="exec-agent-id" style="width:100%;margin-bottom:10px;font-size:12px;">
        ${onlineAgents.length === 0
          ? '<option value="">Sin equipos online disponibles</option>'
          : onlineAgents.map(a =>
              `<option value="${a.id}">${a.name} — Online ✅</option>`
            ).join('')
        }
      </select>`;

  const escapeHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cmdHtml = commands.map(c => `<div>${escapeHtml(c)}</div>`).join('');
  const canExec = linkedOnline || onlineAgents.length > 0;

  return `
    <div id="exec-modal-overlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;
      display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="
        background:var(--surface,#0f172a);border:2px solid var(--primary,#3b82f6);
        border-radius:10px;padding:20px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;">
        <div style="font-weight:700;font-size:15px;margin-bottom:14px;">▶ Ejecutar: ${kbTitulo}</div>
        ${agentSelectorHtml}
        <div style="font-size:11px;color:var(--text-muted,#94a3b8);margin-bottom:4px;">Comandos a ejecutar:</div>
        <div style="background:#0a0a0a;border-radius:4px;padding:10px;font-family:monospace;font-size:11px;color:#4ade80;margin-bottom:14px;white-space:pre-wrap;max-height:120px;overflow-y:auto;">${cmdHtml}</div>
        <!-- Opción de Piloto Automático -->
        <div style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="exec-auto-resolve" checked style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary,#3b82f6);">
          <label for="exec-auto-resolve" style="font-size:12px;color:var(--text-2,#e2e8f0);cursor:pointer;user-select:none;">
            Auto-resolver ticket y guardar en notas al finalizar con éxito
          </label>
        </div>
        <div id="exec-output-section" style="display:none;margin-bottom:12px;">
          <div style="font-size:11px;color:var(--text-muted,#94a3b8);margin-bottom:4px;">Output:</div>
          <div id="exec-output" style="background:#0a0a0a;border-radius:4px;padding:10px;font-family:monospace;font-size:11px;color:#e2e8f0;white-space:pre-wrap;max-height:160px;overflow-y:auto;"></div>
        </div>
        <div id="exec-post-actions" style="display:none;gap:8px;flex-wrap:wrap;margin-bottom:12px;"></div>
        <div style="display:flex;gap:8px;" id="exec-action-buttons">
          <button id="btn-exec-confirm" class="btn btn-primary" style="flex:1;" ${canExec ? '' : 'disabled'}>
            ✓ Confirmar y ejecutar
          </button>
          <button id="btn-exec-cancel" class="btn btn-secondary">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

