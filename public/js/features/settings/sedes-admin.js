/**
 * Gestión de Red de Puntos desde el panel de administración.
 */
import { showToast } from '../../ui/components.js';
import { iconMapPin } from '../../utils/icons.js';
import { openPuntoSetupModal, openChecklistModal } from './punto-setup-modal.js';

export async function renderSedesAdmin(container) {
  container.innerHTML = `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Red de Puntos</h2>
      <p style="color:var(--text-3);font-size:13px;">Administra los puntos de atención y bodegas disponibles en la red.</p>
    </div>

    <!-- Barra de búsqueda y filtros -->
    <div class="card" style="margin-bottom:16px;padding:16px 20px;">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <!-- Búsqueda principal -->
        <div style="flex:1;min-width:200px;position:relative;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-3);pointer-events:none;">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="sede-search" placeholder="Buscar ciudad o punto de atención…"
            style="padding-left:32px;width:100%;padding-top:8px;padding-bottom:8px;padding-right:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;"
            onfocus="this.style.borderColor='var(--border-focus)';this.style.boxShadow='0 0 0 3px var(--primary-light)'"
            onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
        </div>
        <!-- Filtro por inicial -->
        <select id="sede-filter-letter" style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none;cursor:pointer;min-width:130px;">
          <option value="">Todas las letras</option>
        </select>
        <!-- Toggle inactivos -->
        <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-2);cursor:pointer;white-space:nowrap;">
          <input type="checkbox" id="show-inactive" style="accent-color:var(--primary);width:14px;height:14px;"> Mostrar inactivos
        </label>
        <!-- Contador -->
        <span id="sede-count" style="font-size:12px;color:var(--text-3);white-space:nowrap;"></span>
      </div>
    </div>

    <!-- Filtro tipo -->
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
      <select id="rdp-filter-tipo" style="padding:8px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:inherit;outline:none;cursor:pointer;">
        <option value="">Todos</option>
        <option value="punto">Puntos de atención</option>
        <option value="bodega">Bodegas</option>
      </select>
    </div>

    <!-- Botones nuevo punto / nueva bodega -->
    <div style="margin-bottom:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button id="btn-nueva-bodega" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:7px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nueva bodega
      </button>
      <button id="btn-nuevo-punto" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:7px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo punto
      </button>
    </div>

    <!-- Lista unificada -->
    <div id="sedes-list"></div>
  `;

  let allPuntos = [];
  let showInactive = false;
  let _filterTipo = '';

  async function loadPuntos() {
    try {
      const res  = await fetch('/api/puntos');
      const json = await res.json();
      allPuntos = json.puntos || [];

      // Poblar select de letras a partir de ciudades únicas
      const letterSel = container.querySelector('#sede-filter-letter');
      if (letterSel) {
        const cities  = [...new Set(allPuntos.map(p => p.ciudad))].sort();
        const letters = [...new Set(cities.map(c => c[0]))].sort();
        letterSel.innerHTML = `<option value="">Todas las letras</option>` +
          letters.map(l => `<option value="${l}">${l}</option>`).join('');
        letterSel.addEventListener('change', renderList);
      }
      renderList();
    } catch {
      showToast('Error al cargar puntos', 'error');
    }
  }

  function renderList() {
    const search  = (container.querySelector('#sede-search')?.value || '').toLowerCase().trim();
    const letter  = container.querySelector('#sede-filter-letter')?.value || '';
    const listEl  = container.querySelector('#sedes-list');
    const countEl = container.querySelector('#sede-count');
    if (!listEl) return;

    // Filtrar array plano
    let filtered = allPuntos.filter(p => {
      if (!showInactive && !p.activo) return false;
      const matchTipo = !_filterTipo || p.tipo === _filterTipo;
      if (!matchTipo) return false;
      if (letter && (!p.ciudad || p.ciudad[0] !== letter)) return false;
      if (search) {
        const nameMatch   = (p.nombre || '').toLowerCase().includes(search);
        const ciudadMatch = (p.ciudad || '').toLowerCase().includes(search);
        if (!nameMatch && !ciudadMatch) return false;
      }
      return true;
    });

    // Agrupar por ciudad para el render
    const grouped = {};
    for (const p of filtered) {
      const ciudad = p.ciudad || '(Sin ciudad)';
      if (!grouped[ciudad]) grouped[ciudad] = [];
      grouped[ciudad].push(p);
    }

    const ciudades = Object.keys(grouped).sort();
    let html = '';

    for (const ciudad of ciudades) {
      const puntos = grouped[ciudad];

      html += `
        <div class="card" style="margin-bottom:12px;padding:0;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:rgba(99,102,241,.08);border-bottom:1px solid rgba(255,255,255,.06);">
            <span style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;">${iconMapPin(14)} ${ciudad}</span>
            <span style="font-size:12px;color:var(--text-muted);">${puntos.length} registro${puntos.length !== 1 ? 's' : ''}</span>
          </div>
          <div>
            ${puntos.map(p => {
              const tipoBadge = p.tipo === 'bodega'
                ? `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:var(--surface-3);color:var(--text-2);font-weight:600;margin-left:6px;">Bodega</span>`
                : `<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:var(--primary-light);color:var(--primary);font-weight:600;margin-left:6px;">Punto</span>`;

              const trackingEstado = p.tracking_estado;
              const badgeHtml = trackingEstado === 'creado'
                ? `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(234,179,8,.12);color:#facc15;border:1px solid rgba(234,179,8,.2);">📦 Pendiente envío</span>`
                : trackingEstado === 'en_transito'
                ? `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.2);">🚚 En tránsito</span>`
                : (trackingEstado === 'en_sede' || trackingEstado === 'entregado')
                ? `<span style="font-size:11px;padding:3px 8px;border-radius:12px;background:rgba(16,185,129,.1);color:#34d399;border:1px solid rgba(16,185,129,.2);">✅ Entregado</span>`
                : '';

              const checklistBtn = p.despacho_id
                ? `<button class="btn-ver-checklist" data-id="${p.id}" style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);font-size:11px;cursor:pointer;">Ver checklist</button>`
                : '';

              return `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.04);flex-wrap:wrap;${!p.activo ? 'opacity:.5;' : ''}">
                <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${p.activo ? '#10b981' : '#6b7280'};"></span>
                <span style="flex:1;font-size:13px;min-width:120px;">${p.nombre}${tipoBadge}</span>
                ${badgeHtml}
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  ${checklistBtn}
                  <button class="btn-sede-toggle" data-id="${p.id}" data-activo="${p.activo ? '1' : '0'}"
                    style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);font-size:11px;cursor:pointer;">
                    ${p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button class="btn-sede-delete" data-id="${p.id}"
                    style="padding:4px 10px;border:1px solid rgba(239,68,68,.3);border-radius:6px;background:rgba(239,68,68,.1);color:var(--danger);font-size:11px;cursor:pointer;">
                    Eliminar
                  </button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    if (!html) html = `<div style="text-align:center;padding:40px;color:var(--text-muted);">No se encontraron resultados.</div>`;
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = `${filtered.length} registro${filtered.length !== 1 ? 's' : ''} · ${ciudades.length} ciudad${ciudades.length !== 1 ? 'es' : ''}`;

    // Eventos toggle
    listEl.querySelectorAll('.btn-sede-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id     = btn.dataset.id;
        const activo = btn.dataset.activo === '1' ? 0 : 1;
        await fetch(`/api/puntos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo }),
        });
        await loadPuntos();
      });
    });

    // Eventos delete
    listEl.querySelectorAll('.btn-sede-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Desactivar este punto? El bot dejará de mostrarlo.')) return;
        await fetch(`/api/puntos/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Punto desactivado', 'success');
        await loadPuntos();
      });
    });

    // Eventos checklist (solo para puntos de atención)
    listEl.querySelectorAll('.btn-ver-checklist').forEach(btn => {
      btn.addEventListener('click', () => openChecklistModal(parseInt(btn.dataset.id)));
    });
  }

  // Nuevo punto — abre modal multi-paso
  container.querySelector('#btn-nuevo-punto').addEventListener('click', () => {
    const ciudades = [...new Set(allPuntos.map(p => p.ciudad))].sort();
    openPuntoSetupModal(() => loadPuntos(), ciudades);
  });

  // Nueva bodega
  container.querySelector('#btn-nueva-bodega').addEventListener('click', () => {
    const nombre = prompt('Nombre de la bodega:');
    const ciudad = prompt('Ciudad:');
    if (!nombre?.trim() || !ciudad?.trim()) return;
    fetch('/api/puntos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), ciudad: ciudad.trim().toUpperCase(), tipo: 'bodega' }),
    }).then(r => r.json()).then(d => {
      if (d.success) { showToast('Bodega creada', 'success'); loadPuntos(); }
      else showToast(d.error || 'Error al crear bodega', 'error');
    }).catch(() => showToast('Error de red', 'error'));
  });

  // Filtros en tiempo real
  container.querySelector('#sede-search').addEventListener('input', renderList);
  container.querySelector('#show-inactive').addEventListener('change', e => {
    showInactive = e.target.checked;
    renderList();
  });
  container.querySelector('#rdp-filter-tipo')?.addEventListener('change', e => {
    _filterTipo = e.target.value;
    renderList();
  });

  await loadPuntos();
}
