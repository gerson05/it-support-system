/**
 * despacho-helpers.js
 *
 * Shared helpers used across all despacho modules:
 *  - _timeAgo(dateStr)
 *  - actaBadge(d)
 *  - articulosCount(d)
 *  - articulosList(d)
 *  - API fetch wrappers
 */
import { AREA_MAPPINGS } from '../../core/app.js';

export function _timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const old = h >= 8;
  const label = h > 0 ? `hace ${h}h ${m}m` : `hace ${m}m`;
  return { label, old };
}

export function actaBadge(d) {
  if (!d.requiere_acta) {
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;white-space:nowrap;background:var(--surface-2);color:var(--text-3);border:1px solid var(--border);">No requiere</span>`;
  }
  if (d.acta_firmada) {
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;white-space:nowrap;background:rgba(16,185,129,.12);color:var(--success);border:1px solid rgba(16,185,129,.3);">Firmada ✓</span>`;
  }
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;white-space:nowrap;background:rgba(245,158,11,.12);color:var(--warning);border:1px solid rgba(245,158,11,.3);">Pendiente firma</span>`;
}

export function articulosCount(d) {
  try {
    const arr = JSON.parse(d.articulos || '[]');
    const total = arr.reduce((s, a) => s + (parseInt(a.cantidad) || 1), 0);
    return `${arr.length} ítem(s) · ${total} ud.`;
  } catch { return '—'; }
}

export function articulosList(d) {
  try {
    const arr = JSON.parse(d.articulos || '[]');
    if (!arr.length) return '<em style="color:var(--text-3);">Sin artículos</em>';
    return arr.map(a => `
      <div style="display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="font-weight:600;min-width:32px;color:var(--primary);">${a.cantidad}×</span>
          <span style="font-weight:500;color:var(--text);">${a.nombre}</span>
          ${a.descripcion ? `<span style="font-size:12px;color:var(--text-3);">${a.descripcion}</span>` : ''}
        </div>
        ${(a.marca || a.modelo || a.serial) ? `
        <div style="display:flex;gap:12px;font-size:11px;color:var(--text-3);padding-left:42px;">
          ${a.marca  ? `<span><strong>Marca:</strong> ${a.marca}</span>`  : ''}
          ${a.modelo ? `<span><strong>Modelo:</strong> ${a.modelo}</span>` : ''}
          ${a.serial ? `<span><strong>Serial:</strong> ${a.serial}</span>` : ''}
        </div>` : ''}
      </div>`).join('');
  } catch { return '<em style="color:var(--text-3);">Error al leer artículos</em>'; }
}

/* ── API wrappers ─────────────────────────────────────────────────────── */

export async function fetchDespachos(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/despachos?${qs}`);
  if (!res.ok) throw new Error('Error al cargar despachos');
  return res.json();
}

export async function fetchDespacho(id) {
  const res = await fetch(`/api/despachos/${id}`);
  if (!res.ok) throw new Error('Despacho no encontrado');
  return res.json();
}

export async function createDespacho(data) {
  const res = await fetch('/api/despachos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error al crear despacho');
  return json;
}

export async function updateDespacho(id, data) {
  const res = await fetch(`/api/despachos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error al actualizar');
  return json;
}

export async function fetchActaInfo(entityType, entityId) {
  try {
    const res = await fetch(`/api/actas/info/${entityType}/${entityId}`);
    if (!res.ok) return { token: null };
    return res.json();
  } catch { return { token: null }; }
}

export async function fetchConfirmacion(despachoId) {
  try {
    const res = await fetch(`/api/despachos/${despachoId}/confirmacion`);
    if (!res.ok) return { token: null, confirmed: false };
    return res.json();
  } catch { return { token: null, confirmed: false }; }
}
