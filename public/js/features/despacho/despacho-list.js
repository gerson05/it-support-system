/**
 * despacho.js  — Entry point (slim orchestrator)
 *
 * Only exports: renderDespacho(container)
 * All logic is now in dedicated sub-modules:
 *  - despacho-helpers.js   → helpers + API fetch wrappers
 *  - despacho-rotulo.js    → openRotuloModal, printDespacho, openTiposArticuloModal
 *  - despacho-detail.js    → openDetailModal, renderActaSection, setupActaInteraction
 *  - despacho-form.js      → openCreateModal, openEditDespachoModal, buildArticuloRow
 */
import { state } from '../../core/app.js';
import { createLoadingSpinner, createEmptyState } from '../../ui/components.js';
import { fetchDespachos, actaBadge, articulosCount, _timeAgo } from './despacho-helpers.js';
import { openDetailModal } from './despacho-detail.js';
import { openCreateModal, openEditDespachoModal } from './despacho-form.js';
import { renderBodegasPanel } from '../settings/bodegas-admin.js';

export async function renderDespacho(container) {
  container.innerHTML = `
    <div style="padding:24px;max-width:1100px;margin:0 auto;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:var(--text);">Despacho</h1>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-3);">Gestión de despachos físicos de equipos y materiales IT</p>
        </div>
        <button id="btn-nuevo-despacho" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:7px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Despacho
        </button>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:20px;">
        <button id="tab-despachos" style="padding:8px 18px;border:none;border-radius:8px 8px 0 0;background:var(--primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid var(--primary);">Despachos</button>
        <button id="tab-bodegas" style="padding:8px 18px;border:none;border-radius:8px 8px 0 0;background:transparent;color:var(--text-3);font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;">Bodegas</button>
      </div>

      <!-- Tab: Despachos -->
      <div id="panel-despachos">
        <!-- Borrador activo -->
        <div id="borrador-main-banner" style="display:none;margin-bottom:16px;padding:12px 16px;border-radius:10px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.08);align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span id="borrador-main-txt" style="font-size:13px;color:var(--text-2);"></span>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button id="btn-continuar-borrador" style="padding:5px 14px;border:1px solid rgba(99,102,241,.5);border-radius:6px;background:rgba(99,102,241,.15);color:#818cf8;font-size:12px;font-weight:600;cursor:pointer;">Continuar borrador</button>
            <button id="btn-descartar-main-borrador" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:12px;cursor:pointer;">Descartar</button>
          </div>
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;align-items:center;">
          <input id="filter-search" type="text" placeholder="Buscar por número, destinatario o sede…"
            style="flex:1;min-width:220px;max-width:340px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-2);cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);user-select:none;">
            <input type="checkbox" id="filter-pendiente-acta" style="width:14px;height:14px;">
            Solo pendientes de acta
          </label>
          <button id="btn-refresh-despachos" class="btn btn-secondary" style="padding:7px 14px;font-size:13px;">
            Actualizar
          </button>
        </div>

        <!-- Table -->
        <div class="card" style="padding:0;overflow:hidden;">
          <div id="despacho-table-wrap">
            ${createLoadingSpinner()}
          </div>
        </div>
      </div>

      <!-- Tab: Bodegas -->
      <div id="panel-bodegas" style="display:none;"></div>

    </div>`;

  function buildParams() {
    const search    = container.querySelector('#filter-search').value.trim();
    const pendiente = container.querySelector('#filter-pendiente-acta').checked;
    const p = { limit: 50, offset: 0 };
    if (search)    p.search = search;
    if (pendiente) { p.requiere_acta = 1; p.acta_firmada = 0; }
    return p;
  }

  async function loadTable() {
    const wrap = container.querySelector('#despacho-table-wrap');
    wrap.innerHTML = createLoadingSpinner();
    try {
      const { despachos, total } = await fetchDespachos(buildParams());
      renderTable(wrap, despachos, total);
    } catch (e) {
      wrap.innerHTML = `<div style="padding:30px;color:var(--danger);text-align:center;">${e.message}</div>`;
    }
  }

  function renderTable(wrap, despachos, total) {
    if (!despachos.length) {
      wrap.innerHTML = createEmptyState('No se encontraron despachos', '📦');
      return;
    }
    wrap.innerHTML = `
      <div style="padding:12px 18px;font-size:12px;color:var(--text-3);border-bottom:1px solid var(--border);">
        ${total} despacho(s) en total
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);">
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;white-space:nowrap;">Número</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Fecha</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Destinatario</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Sede</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Artículos</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Acta</th>
              <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${despachos.map(d => `
              <tr style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;"
                  onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''"
                  onclick="document.dispatchEvent(new CustomEvent('open-despacho', {detail:${d.id}}))">
                <td style="padding:11px 14px;font-family:monospace;font-size:12px;font-weight:700;color:var(--primary);white-space:nowrap;">${d.numero}</td>
                <td style="padding:11px 14px;font-size:12px;color:var(--text-2);white-space:nowrap;">${d.fecha || '—'}</td>
                <td style="padding:11px 14px;font-size:13px;font-weight:500;color:var(--text);">${d.destinatario}${d.cedula ? `<div style="font-size:11px;font-weight:400;color:var(--text-3);">CC ${d.cedula}</div>` : ''}</td>
                <td style="padding:11px 14px;font-size:12px;color:var(--text-2);">${d.sede || '—'}</td>
                <td style="padding:11px 14px;font-size:12px;color:var(--text-2);">${articulosCount(d)}</td>
                <td style="padding:11px 14px;white-space:nowrap;">${actaBadge(d)}</td>
                <td style="padding:11px 14px;text-align:right;white-space:nowrap;">
                  <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;margin-right:4px;"
                    onclick="event.stopPropagation();document.dispatchEvent(new CustomEvent('open-despacho', {detail:${d.id}}))">Ver</button>
                  <button class="btn-despacho-edit" data-id="${d.id}"
                    style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;"
                    onclick="event.stopPropagation();">✏️ Editar</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    wrap.querySelectorAll('.btn-despacho-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditDespachoModal(parseInt(btn.dataset.id), loadTable));
    });
  }

  // Borrador banner
  const mainBanner    = container.querySelector('#borrador-main-banner');
  const mainBannerTxt = container.querySelector('#borrador-main-txt');

  async function checkBorrador() {
    if (!state.currentUser?.username) return;
    try {
      const agente = encodeURIComponent(state.currentUser?.username);
      const data   = await fetch(`/api/despachos/borrador?agente=${agente}`)
        .then(r => r.ok ? r.json() : { borrador: null });
      if (data.borrador) {
        const { label } = _timeAgo(data.borrador.updated_at);
        const dest = data.borrador.destinatario ? ` · ${data.borrador.destinatario}` : '';
        mainBannerTxt.textContent = `📝 Borrador guardado (${label})${dest}`;
        mainBanner.style.display = 'flex';
      } else {
        mainBanner.style.display = 'none';
      }
    } catch { mainBanner.style.display = 'none'; }
  }

  container.querySelector('#btn-nuevo-despacho').onclick = () => openCreateModal(() => loadTable());
  container.querySelector('#btn-refresh-despachos').onclick = () => loadTable();
  container.querySelector('#btn-continuar-borrador').onclick = () => openCreateModal(() => { loadTable(); checkBorrador(); });
  container.querySelector('#btn-descartar-main-borrador').onclick = async () => {
    if (!state.currentUser?.username) return;
    const agente = encodeURIComponent(state.currentUser?.username);
    await fetch(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' }).catch(() => {});
    mainBanner.style.display = 'none';
  };

  let searchTimer;
  container.querySelector('#filter-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTable, 350);
  });
  container.querySelector('#filter-pendiente-acta').addEventListener('change', loadTable);

  const openHandler    = (e) => openDetailModal(e.detail);
  const borradorHandler = () => checkBorrador();
  document.addEventListener('open-despacho', openHandler);
  document.addEventListener('despacho-borrador-saved', borradorHandler);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container.querySelector('#btn-nuevo-despacho'))) {
      document.removeEventListener('open-despacho', openHandler);
      document.removeEventListener('despacho-borrador-saved', borradorHandler);
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true, subtree: false });

  // Tab switching
  const tabDespachos = container.querySelector('#tab-despachos');
  const tabBodegas   = container.querySelector('#tab-bodegas');
  const panelDespachos = container.querySelector('#panel-despachos');
  const panelBodegas   = container.querySelector('#panel-bodegas');
  const btnNuevo       = container.querySelector('#btn-nuevo-despacho');

  function activateTab(tab) {
    const isDespachos = tab === 'despachos';
    tabDespachos.style.background    = isDespachos ? 'var(--primary)' : 'transparent';
    tabDespachos.style.color         = isDespachos ? '#fff' : 'var(--text-3)';
    tabDespachos.style.borderBottom  = isDespachos ? '2px solid var(--primary)' : '2px solid transparent';
    tabBodegas.style.background      = !isDespachos ? 'var(--primary)' : 'transparent';
    tabBodegas.style.color           = !isDespachos ? '#fff' : 'var(--text-3)';
    tabBodegas.style.borderBottom    = !isDespachos ? '2px solid var(--primary)' : '2px solid transparent';
    panelDespachos.style.display     = isDespachos ? '' : 'none';
    panelBodegas.style.display       = !isDespachos ? '' : 'none';
    btnNuevo.style.display           = isDespachos ? '' : 'none';
    if (!isDespachos) renderBodegasPanel(panelBodegas);
  }

  tabDespachos.addEventListener('click', () => activateTab('despachos'));
  tabBodegas.addEventListener('click',   () => activateTab('bodegas'));

  checkBorrador();
  loadTable();
}
