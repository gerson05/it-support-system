/**
 * Gestión de Red de Puntos desde el panel de administración.
 */
import { showToast } from './components.js';

export async function renderSedesAdmin(container) {
  container.innerHTML = `
    <div style="margin-bottom:28px;">
      <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Red de Puntos</h2>
      <p style="color:var(--text-3);font-size:13px;">Administra las ciudades y puntos de atención disponibles en el bot de WhatsApp.</p>
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

    <!-- Formulario agregar -->
    <div class="card" style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:14px;">Agregar nuevo punto</div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;">
        <div class="form-group" style="margin:0;">
          <label>Ciudad</label>
          <input type="text" id="new-sede-ciudad" placeholder="Ej: CALI, MANIZALES…" autocomplete="off" style="text-transform:uppercase;">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Nombre del punto</label>
          <input type="text" id="new-sede-punto" placeholder="Ej: MI FARMACIA - CALI CENTRO" autocomplete="off">
        </div>
        <button class="btn btn-primary" id="btn-add-sede" style="height:38px;padding:0 18px;">Agregar</button>
      </div>
    </div>

    <!-- Lista de sedes -->
    <div id="sedes-list"></div>
  `;

  let allData = {};
  let showInactive = false;

  async function loadSedes() {
    try {
      const res  = await fetch('/api/sedes');
      const data = await res.json();
      allData = data.grouped;
      // Poblar select de letras
      const letterSel = document.getElementById('sede-filter-letter');
      if (letterSel) {
        const letters = [...new Set(Object.keys(allData).map(c => c[0]))].sort();
        letterSel.innerHTML = `<option value="">Todas las letras</option>` +
          letters.map(l => `<option value="${l}">${l}</option>`).join('');
        letterSel.addEventListener('change', renderList);
      }
      renderList();
    } catch {
      showToast('Error al cargar sedes', 'error');
    }
  }

  function renderList() {
    const search  = (document.getElementById('sede-search')?.value || '').toLowerCase().trim();
    const letter  = document.getElementById('sede-filter-letter')?.value || '';
    const listEl  = document.getElementById('sedes-list');
    const countEl = document.getElementById('sede-count');
    if (!listEl) return;

    const ciudades = Object.keys(allData).sort();
    let totalPuntos = 0;
    let html = '';

    for (const ciudad of ciudades) {
      // Filtro por letra inicial
      if (letter && ciudad[0] !== letter) continue;

      let puntos = allData[ciudad];
      if (!showInactive) puntos = puntos.filter(p => p.activo);

      // Filtro por texto
      if (search) {
        const ciudadMatch = ciudad.toLowerCase().includes(search);
        if (!ciudadMatch && !puntos.some(p => p.nombre_punto.toLowerCase().includes(search))) continue;
        if (!ciudadMatch) {
          puntos = puntos.filter(p => p.nombre_punto.toLowerCase().includes(search));
        }
      }
      if (!puntos.length) continue;
      totalPuntos += puntos.length;

      html += `
        <div class="card" style="margin-bottom:12px;padding:0;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:rgba(99,102,241,.08);border-bottom:1px solid rgba(255,255,255,.06);">
            <span style="font-weight:700;font-size:14px;">📍 ${ciudad}</span>
            <span style="font-size:12px;color:var(--text-muted);">${puntos.length} punto${puntos.length !== 1 ? 's' : ''}</span>
          </div>
          <div>
            ${puntos.map(p => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid rgba(255,255,255,.04);${!p.activo ? 'opacity:.5;' : ''}">
                <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${p.activo ? '#10b981' : '#6b7280'};"></span>
                <span style="flex:1;font-size:13px;">${p.nombre_punto}</span>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  <button class="btn-sede-toggle" data-id="${p.id}" data-activo="${p.activo}"
                    style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--text-muted);cursor:pointer;">
                    ${p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button class="btn-sede-delete" data-id="${p.id}"
                    style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#f87171;cursor:pointer;">
                    Eliminar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    if (!html) html = `<div style="text-align:center;padding:40px;color:var(--text-muted);">No se encontraron resultados.</div>`;
    listEl.innerHTML = html;
    if (countEl) countEl.textContent = `${totalPuntos} punto${totalPuntos !== 1 ? 's' : ''} · ${Object.keys(allData).length} ciudades`;

    // Eventos toggle y delete
    listEl.querySelectorAll('.btn-sede-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const activo = btn.dataset.activo === '1' ? 0 : 1;
        await fetch(`/api/sedes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo }),
        });
        await loadSedes();
      });
    });

    listEl.querySelectorAll('.btn-sede-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Desactivar este punto? El bot dejará de mostrarlo.')) return;
        await fetch(`/api/sedes/${btn.dataset.id}`, { method: 'DELETE' });
        showToast('Punto desactivado', 'success');
        await loadSedes();
      });
    });
  }

  // Agregar nuevo punto
  document.getElementById('btn-add-sede').addEventListener('click', async () => {
    const ciudad = document.getElementById('new-sede-ciudad').value.trim().toUpperCase();
    const punto  = document.getElementById('new-sede-punto').value.trim();
    if (!ciudad || !punto) { showToast('Completa ciudad y nombre del punto', 'error'); return; }

    const res = await fetch('/api/sedes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciudad, nombre_punto: punto }),
    });
    if (res.ok) {
      document.getElementById('new-sede-ciudad').value = '';
      document.getElementById('new-sede-punto').value  = '';
      showToast(`✅ Punto agregado en ${ciudad}`, 'success');
      await loadSedes();
    } else {
      const err = await res.json();
      showToast(err.error, 'error');
    }
  });

  // Enter en los campos de texto
  ['new-sede-ciudad', 'new-sede-punto'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-add-sede').click();
    });
  });

  // Filtros en tiempo real
  document.getElementById('sede-search').addEventListener('input', renderList);
  document.getElementById('show-inactive').addEventListener('change', e => {
    showInactive = e.target.checked;
    renderList();
  });

  await loadSedes();
}
