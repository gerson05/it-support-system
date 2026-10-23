/**
 * Categoría "Asignaciones" de Inventario: listado de quienes tienen equipos o dispositivos asignados,
 * con filtro por tipo, detalle de lo asignado y acceso directo al acta de paz y salvo.
 * La búsqueda y el filtro de área usan la barra de filtros común de Inventario.
 */
import { openPazSalvoModal } from './inventario-paz-salvo.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TIPOS = [
  ['', 'Todos los tipos'], ['computadores', 'Computadores'], ['impresoras', 'Impresoras'], ['escaner', 'Escáneres'],
  ['televisores', 'Televisores'], ['monitores', 'Monitores'], ['tablets', 'Tablets'], ['perifericos', 'Periféricos'],
  ['celulares', 'Celulares'], ['ups', 'UPS'],
];
let _tipo = '';

const plural = (t, n) => n === 1 || t === 'UPS' ? t : /[aeiouáéíóú]$/i.test(t) ? `${t}s` : `${t}es`;
const resumenTexto = (r) => Object.entries(r || {}).map(([t, n]) => `${n} ${plural(t, n)}`).join(' · ');

/**
 * Pinta el listado en `wrap`. Devuelve { total, total_pages } para la paginación común.
 * @param {HTMLElement} wrap
 * @param {{page, limit, search, area}} filtros
 * @param {Function} recargar vuelve a cargar la vista (al cambiar el tipo)
 */
export async function loadPersonas(wrap, { page, limit, search, area }, recargar) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  if (area) params.set('area', area);
  if (_tipo) params.set('tipo', _tipo);
  const res = await fetch(`/api/inventario/personas?${params}`);
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();

  wrap.innerHTML = `
    <div class="inv-per-bar">
      <select id="inv-per-tipo" class="inv-per-select" title="Mostrar solo quienes tienen este tipo de equipo">
        ${TIPOS.map(([v, l]) => `<option value="${v}"${v === _tipo ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
      <span class="inv-per-total">${data.total} persona${data.total === 1 ? '' : 's'} con equipos asignados</span>
    </div>
    ${data.personas.length ? `
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>Persona</th><th>Área / Sede</th><th>Asignado</th><th style="text-align:right;">Acciones</th></tr></thead>
        <tbody>${data.personas.map((p, i) => `
          <tr class="inv-per-row" data-i="${i}">
            <td style="white-space:normal;min-width:150px;">
              <div style="font-size:13px;font-weight:600;">${esc(p.nombre || 'Sin nombre')}</div>
              <div class="td-sub">${p.cedula ? `C.C. ${esc(p.cedula)}` : 'Sin cédula'}</div>
            </td>
            <td style="font-size:12px;white-space:normal;">${esc(p.areas.join(', ') || '—')}</td>
            <td style="font-size:12.5px;white-space:normal;min-width:140px;"><strong>${p.elementos}</strong><div class="td-sub">${esc(resumenTexto(p.resumen))}</div></td>
            <td class="td-actions" style="white-space:nowrap;text-align:right;">
              <button class="btn btn-small btn-secondary inv-per-ver" data-i="${i}">Ver</button>
              <button class="btn btn-small btn-primary inv-per-acta" data-i="${i}" title="Paz y salvo / acta de devolución">Acta</button>
            </td>
          </tr>
          <tr class="inv-per-det" id="inv-per-det-${i}" style="display:none;"><td colspan="4"></td></tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<div style="padding:60px;text-align:center;color:var(--text-muted);">Nadie coincide con los filtros.</div>'}
    <style>
      .inv-per-bar { display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 12px; }
      .inv-per-select { width:auto;max-width:220px;padding:7px 10px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px; }
      .inv-per-total { font-size:12.5px;color:var(--text-3); }
      .inv-per-row { cursor:pointer; }
      .inv-per-det > td { background:var(--surface-2, rgba(127,127,127,.06));padding:10px 14px; }
      .inv-per-items { width:100%;border-collapse:collapse;font-size:12.5px; }
      .inv-per-items th, .inv-per-items td { padding:5px 8px;border-bottom:1px solid var(--border);text-align:left; }
      .inv-per-items th { font-size:11px;color:var(--text-3);font-weight:600; }
    </style>`;

  wrap.querySelector('#inv-per-tipo').addEventListener('change', e => { _tipo = e.target.value; recargar(true); });
  const persona = (i) => data.personas[Number(i)];
  wrap.querySelectorAll('.inv-per-acta').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); openPazSalvoModal({ cedula: persona(b.dataset.i).cedula, nombre: persona(b.dataset.i).nombre });
  }));
  const toggle = (i) => _toggleDetalle(wrap, i, persona(i));
  wrap.querySelectorAll('.inv-per-ver').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toggle(b.dataset.i); }));
  wrap.querySelectorAll('.inv-per-row').forEach(tr => tr.addEventListener('click', () => toggle(tr.dataset.i)));

  return data;
}

async function _toggleDetalle(wrap, i, p) {
  const fila = wrap.querySelector(`#inv-per-det-${i}`);
  const btn = wrap.querySelector(`.inv-per-ver[data-i="${i}"]`);
  if (fila.style.display !== 'none') { fila.style.display = 'none'; btn.textContent = 'Ver'; return; }
  fila.style.display = '';
  btn.textContent = 'Ocultar';
  const td = fila.firstElementChild;
  if (td.dataset.cargado) return;
  td.innerHTML = '<span style="font-size:12px;color:var(--text-3);">Cargando…</span>';
  try {
    const params = new URLSearchParams();
    if (p.cedula) params.set('cedula', p.cedula);
    if (p.nombre) params.set('nombre', p.nombre);
    const { elementos = [] } = await (await fetch(`/api/inventario/paz-salvo/asignados?${params}`)).json();
    td.innerHTML = elementos.length ? `
      <table class="inv-per-items">
        <thead><tr><th>Tipo</th><th>Equipo</th><th>Marca / Modelo</th><th>Placa</th><th>Serial / IMEI</th><th>Área / Sede</th></tr></thead>
        <tbody>${elementos.map(e => `
          <tr><td>${esc(e.tipo)}</td>
            <td>${esc(e.descripcion)}${e.detalle ? `<div class="td-sub">${esc(e.detalle)}</div>` : ''}</td>
            <td>${esc([e.marca, e.modelo].filter(Boolean).join(' ') || '—')}</td>
            <td>${esc(e.placa || '—')}</td><td>${esc(e.serial || '—')}</td>
            <td>${esc([e.area, e.sede].filter(Boolean).join(' / ') || '—')}</td></tr>`).join('')}
        </tbody>
      </table>` : '<span style="font-size:12px;color:var(--text-3);">Sin elementos.</span>';
    td.dataset.cargado = '1';
  } catch { td.innerHTML = '<span style="font-size:12px;color:var(--danger);">Error de conexión.</span>'; }
}
