import { createEmptyState } from '../../ui/components.js';
import { renderDespachoActasPanel } from '../despacho/despacho-actas.js';
import { iconClipboard, iconFolder } from '../../utils/icons.js';

export function renderGestion(container, options = {}) {
  const initialTab = options.tab === 'documentos' ? 'documentos' : 'actas';
  const focusId = options.focusId ?? null;

  container.innerHTML = `
    <div style="padding:24px;max-width:1200px;margin:0 auto;">
      <div style="margin-bottom:22px;">
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:-.4px;color:var(--text);">Gestión</h1>
        <p style="margin:0;font-size:13px;color:var(--text-3);">Documentación, actas y flujos administrativos.</p>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:22px;flex-wrap:wrap;">
        <button id="gestion-tab-actas" class="gestion-tab-btn" style="display:inline-flex;align-items:center;gap:6px;">${iconClipboard(13)} Actas de entrega</button>
        <button id="gestion-tab-documentos" class="gestion-tab-btn" style="display:inline-flex;align-items:center;gap:6px;">${iconFolder(13)} Documentos</button>
      </div>

      <div id="gestion-panel-actas" style="display:none;"></div>
      <div id="gestion-panel-documentos" style="display:none;"></div>
    </div>`;

  const tabActas = container.querySelector('#gestion-tab-actas');
  const tabDocumentos = container.querySelector('#gestion-tab-documentos');
  const panelActas = container.querySelector('#gestion-panel-actas');
  const panelDocumentos = container.querySelector('#gestion-panel-documentos');

  let actasLoaded = false;

  function activateTab(tab) {
    const isActas = tab === 'actas';
    const isDocs = tab === 'documentos';

    tabActas.classList.toggle('active', isActas);
    tabDocumentos.classList.toggle('active', isDocs);

    panelActas.style.display = isActas ? '' : 'none';
    panelDocumentos.style.display = isDocs ? '' : 'none';

    if (isActas && !actasLoaded) {
      actasLoaded = true;
      renderDespachoActasPanel(panelActas, { focusId });
    }

    if (isDocs) {
      panelDocumentos.innerHTML = `
        <div class="card" style="padding:20px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <h3 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--text);">Documentos</h3>
              <p style="margin:0;font-size:13px;color:var(--text-3);max-width:720px;">Este espacio quedará para otros flujos documentales de la aplicación, como soportes, aprobaciones, formatos o archivos administrativos.</p>
            </div>
          </div>
          <div style="margin-top:18px;">${createEmptyState('Módulo en preparación', iconFolder(32))}</div>
        </div>`;
    }
  }

  tabActas.addEventListener('click', () => activateTab('actas'));
  tabDocumentos.addEventListener('click', () => activateTab('documentos'));

  activateTab(initialTab);
}