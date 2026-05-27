import { showToast, createLoadingSpinner, createEmptyState } from './components.js';

const AREA_OPTIONS = [
  { value: 'general',        label: '🖥️ General / IT' },
  { value: 'cartera',        label: '💰 Cartera' },
  { value: 'compra',         label: '🛒 Compra' },
  { value: 'gestion_humana', label: '👥 Gestión Humana' },
  { value: 'pqrs',           label: '📋 PQRS' },
  { value: 'contabilidad',   label: '📊 Contabilidad' },
  { value: 'farmacia',       label: '💊 Farmacia' },
  { value: 'cuentas_medicas',label: '🏥 Cuentas Médicas' },
];
const AREA_LABEL = Object.fromEntries(AREA_OPTIONS.map(a => [a.value, a.label]));

let _allData = { system: [], custom: [] };

/* ═══════════════════════════════════════════════════════════════
   Render principal
   ═══════════════════════════════════════════════════════════════ */
export async function renderFaqs(container) {
  container.innerHTML = `
    <style>
      #faqs-modal-overlay {
        display:none; position:fixed; inset:0; background:rgba(0,0,0,.6);
        z-index:1000; align-items:center; justify-content:center;
      }
      #faqs-modal-overlay.open { display:flex; }
      #faqs-modal {
        background:#1e1e38; border:1px solid rgba(255,255,255,.1);
        border-radius:12px; padding:28px; width:min(640px,96vw);
        max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:16px;
      }
      #faqs-modal label { font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px; }
      #faqs-modal input, #faqs-modal select, #faqs-modal textarea {
        width:100%; padding:10px 14px; background:#0f0f22;
        border:1px solid rgba(255,255,255,.12); border-radius:8px;
        color:#e8e8f0; font-size:14px; box-sizing:border-box;
      }
      #faqs-modal textarea { min-height:120px; resize:vertical; font-family:inherit; }
      .faq-row { display:grid; grid-template-columns:1fr 100px 80px 60px; gap:8px;
        padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05); align-items:start; }
      .faq-row:last-child { border-bottom:none; }
      .faq-title { font-weight:600; font-size:14px; }
      .faq-area  { font-size:12px; color:var(--text-muted); margin-top:4px; }
      .faq-hits  { font-size:12px; color:var(--text-muted); text-align:center; padding-top:4px; }
      .faq-rate  { font-size:12px; padding-top:4px; text-align:center; }
      .faq-actions { display:flex; flex-direction:column; gap:6px; }
      .btn-icon { padding:6px 10px; border:none; border-radius:6px; cursor:pointer; font-size:12px; }
      .btn-edit   { background:rgba(102,126,234,.2); color:#667eea; }
      .btn-delete { background:rgba(239,68,68,.15); color:#ef4444; }
      .tag-system { font-size:10px; background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.1); border-radius:4px;
        padding:2px 6px; color:var(--text-muted); }
      .tag-custom { font-size:10px; background:rgba(102,126,234,.2);
        border:1px solid rgba(102,126,234,.3); border-radius:4px;
        padding:2px 6px; color:#a5b4fc; }
    </style>

    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 class="page-title">📚 Base de Conocimiento</h2>
        <p class="page-subtitle">Gestiona las respuestas automáticas personalizadas del bot</p>
      </div>
      <button class="btn btn-primary" id="btn-new-faq">+ Nueva FAQ personalizada</button>
    </div>

    <!-- Stats -->
    <div class="grid-4" id="faq-stats" style="margin-bottom:4px;"></div>

    <!-- FAQs personalizadas -->
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div class="section-title" style="margin:0;">🛠️ FAQs Personalizadas</div>
        <select id="faq-filter-area" style="padding:8px 12px;background:#0f0f22;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#e8e8f0;font-size:13px;">
          <option value="">Todas las áreas</option>
          ${AREA_OPTIONS.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
        </select>
      </div>
      <div id="custom-faqs-container">${createLoadingSpinner()}</div>
    </div>

    <!-- FAQs del sistema (colapsable) -->
    <div class="card">
      <details>
        <summary style="cursor:pointer;font-size:14px;font-weight:600;color:var(--text-primary);padding:4px 0;">
          🔒 FAQs del Sistema (${0} entradas, solo lectura)
          <span id="system-count" style="display:none;"></span>
        </summary>
        <div id="system-faqs-container" style="margin-top:16px;">${createLoadingSpinner()}</div>
      </details>
    </div>

    <!-- Modal crear/editar -->
    <div id="faqs-modal-overlay">
      <div id="faqs-modal">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 id="modal-title" style="margin:0;font-size:16px;">Nueva FAQ</h3>
          <button id="btn-close-modal" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
        </div>
        <div>
          <label>Área</label>
          <select id="m-area">
            ${AREA_OPTIONS.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Título / Pregunta <span style="color:#ef4444">*</span></label>
          <input id="m-title" type="text" placeholder="Ej: Cómo restablecer la contraseña del portal de nómina">
        </div>
        <div>
          <label>Palabras clave (separadas por coma)</label>
          <input id="m-keywords" type="text" placeholder="contraseña, clave, nomina, restablecer">
        </div>
        <div>
          <label>Solución / Respuesta <span style="color:#ef4444">*</span></label>
          <textarea id="m-solution" placeholder="Escribe los pasos numerados que el empleado debe seguir..."></textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-secondary" id="btn-cancel-modal">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-faq">Guardar FAQ</button>
        </div>
      </div>
    </div>
  `;

  await loadFaqs();
  bindFaqEvents(container);
}

/* ── Carga y renderizado de FAQs ── */
async function loadFaqs() {
  try {
    const res = await fetch('/api/faqs');
    if (!res.ok) throw new Error('Error de servidor');
    _allData = await res.json();
    renderStats();
    renderCustomFaqs();
    renderSystemFaqs();
  } catch (err) {
    const c = document.getElementById('custom-faqs-container');
    if (c) c.innerHTML = createEmptyState('No se pudo cargar la base de conocimiento.', '❌');
  }
}

function renderStats() {
  const grid = document.getElementById('faq-stats');
  if (!grid) return;

  const totalSystem = _allData.system.length;
  const totalCustom = _allData.custom.length;
  const totalHits   = [..._allData.system, ..._allData.custom].reduce((a, f) => a + (f.hits || 0), 0);
  const resolved    = [..._allData.system, ..._allData.custom].reduce((a, f) => a + (f.resolved || 0), 0);
  const rate        = totalHits > 0 ? Math.round((resolved / totalHits) * 100) : 0;

  grid.innerHTML = `
    <div class="card" style="padding:16px 20px;text-align:center;">
      <div style="font-size:22px;font-weight:700;">${totalSystem}</div>
      <div style="font-size:12px;color:var(--text-muted);">FAQs del Sistema</div>
    </div>
    <div class="card" style="padding:16px 20px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#a5b4fc;">${totalCustom}</div>
      <div style="font-size:12px;color:var(--text-muted);">FAQs Personalizadas</div>
    </div>
    <div class="card" style="padding:16px 20px;text-align:center;">
      <div style="font-size:22px;font-weight:700;">${totalHits}</div>
      <div style="font-size:12px;color:var(--text-muted);">Consultas Totales</div>
    </div>
    <div class="card" style="padding:16px 20px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:${rate >= 50 ? '#22c55e' : '#f59e0b'};">${rate}%</div>
      <div style="font-size:12px;color:var(--text-muted);">Tasa de Resolución</div>
    </div>
  `;
}

function renderCustomFaqs(filterArea = '') {
  const container = document.getElementById('custom-faqs-container');
  if (!container) return;

  let items = _allData.custom;
  if (filterArea) items = items.filter(f => f.area === filterArea || f.area === 'general');

  if (items.length === 0) {
    container.innerHTML = createEmptyState(
      filterArea ? 'No hay FAQs personalizadas para esta área.' : 'Aún no tienes FAQs personalizadas. Crea la primera con el botón de arriba.',
      '📝'
    );
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 110px 90px 80px;gap:8px;padding:8px 0;font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid rgba(255,255,255,.07);">
      <div>Título / Área</div><div style="text-align:center;">Consultas</div><div style="text-align:center;">Resueltos</div><div></div>
    </div>
    ${items.map(f => {
      const rate = f.hits > 0 ? Math.round((f.resolved / f.hits) * 100) : null;
      const rateColor = rate === null ? 'var(--text-muted)' : rate >= 60 ? '#22c55e' : rate >= 30 ? '#f59e0b' : '#ef4444';
      return `
        <div class="faq-row" data-id="${f.id}">
          <div>
            <div class="faq-title">${_esc(f.title)}</div>
            <div class="faq-area">${AREA_LABEL[f.area] || f.area} <span class="tag-custom">personalizada</span></div>
          </div>
          <div class="faq-hits">${f.hits || 0} veces</div>
          <div class="faq-rate" style="color:${rateColor};">${rate !== null ? rate + '%' : '—'}</div>
          <div class="faq-actions">
            <button class="btn-icon btn-edit"  data-action="edit"   data-id="${f.id}">✏️ Editar</button>
            <button class="btn-icon btn-delete" data-action="delete" data-id="${f.id}">🗑️ Borrar</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function renderSystemFaqs() {
  const container = document.getElementById('system-faqs-container');
  const countEl   = document.getElementById('system-count');
  if (!container) return;

  const items = _allData.system;
  if (countEl) countEl.textContent = items.length;

  // Update the summary count
  const details = container.closest('details');
  if (details) {
    const summary = details.querySelector('summary');
    if (summary) {
      summary.innerHTML = `🔒 FAQs del Sistema (${items.length} entradas, solo lectura)`;
    }
  }

  if (items.length === 0) {
    container.innerHTML = createEmptyState('No hay FAQs del sistema disponibles.', '🔒');
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 110px 90px;gap:8px;padding:8px 0;font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid rgba(255,255,255,.07);">
      <div>Título / Área</div><div style="text-align:center;">Consultas</div><div style="text-align:center;">Resueltos</div>
    </div>
    ${items.map(f => {
      const rate = f.hits > 0 ? Math.round((f.resolved / f.hits) * 100) : null;
      const rateColor = rate === null ? 'var(--text-muted)' : rate >= 60 ? '#22c55e' : rate >= 30 ? '#f59e0b' : '#ef4444';
      return `
        <div class="faq-row">
          <div>
            <div class="faq-title">${_esc(f.title)}</div>
            <div class="faq-area">${AREA_LABEL[f.area] || f.area} <span class="tag-system">sistema</span></div>
          </div>
          <div class="faq-hits">${f.hits || 0} veces</div>
          <div class="faq-rate" style="color:${rateColor};">${rate !== null ? rate + '%' : '—'}</div>
        </div>
      `;
    }).join('')}
  `;
}

/* ── Event bindings ── */
function bindFaqEvents(container) {
  // Botón nueva FAQ
  container.addEventListener('click', (e) => {
    if (e.target.id === 'btn-new-faq') openModal();
    if (e.target.id === 'btn-close-modal' || e.target.id === 'btn-cancel-modal') closeModal();
    if (e.target.dataset.action === 'edit')   openModal(_allData.custom.find(f => f.id === parseInt(e.target.dataset.id)));
    if (e.target.dataset.action === 'delete') deleteFaq(parseInt(e.target.dataset.id));
    if (e.target.id === 'btn-save-faq') saveFaq();
  });

  // Cerrar modal al hacer clic fuera
  document.getElementById('faqs-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'faqs-modal-overlay') closeModal();
  });

  // Filtro por área
  document.getElementById('faq-filter-area')?.addEventListener('change', (e) => {
    renderCustomFaqs(e.target.value);
  });
}

let _editingId = null;

function openModal(faq = null) {
  _editingId = faq?.id || null;
  const overlay = document.getElementById('faqs-modal-overlay');
  document.getElementById('modal-title').textContent = faq ? 'Editar FAQ' : 'Nueva FAQ Personalizada';
  document.getElementById('m-area').value     = faq?.area     || 'general';
  document.getElementById('m-title').value    = faq?.title    || '';
  document.getElementById('m-keywords').value = Array.isArray(faq?.keywords) ? faq.keywords.join(', ') : '';
  document.getElementById('m-solution').value = faq?.solution || '';
  overlay?.classList.add('open');
}

function closeModal() {
  document.getElementById('faqs-modal-overlay')?.classList.remove('open');
  _editingId = null;
}

async function saveFaq() {
  const area     = document.getElementById('m-area').value;
  const title    = document.getElementById('m-title').value.trim();
  const kwRaw    = document.getElementById('m-keywords').value;
  const solution = document.getElementById('m-solution').value.trim();

  if (!title || !solution) {
    showToast('El título y la solución son requeridos.', 'error');
    return;
  }

  const keywords = kwRaw.split(',').map(k => k.trim()).filter(Boolean);
  const body = JSON.stringify({ area, title, keywords, solution });

  try {
    const url    = _editingId ? `/api/faqs/${_editingId}` : '/api/faqs';
    const method = _editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error(await res.text());

    showToast(_editingId ? 'FAQ actualizada correctamente.' : 'FAQ creada correctamente.', 'success');
    closeModal();
    await loadFaqs();
  } catch (err) {
    console.error(err);
    showToast('Error al guardar la FAQ. Verifica que el servidor esté activo.', 'error');
  }
}

async function deleteFaq(id) {
  if (!confirm('¿Eliminar esta FAQ personalizada? Esta acción no se puede deshacer.')) return;
  try {
    const res = await fetch(`/api/faqs/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('FAQ eliminada.', 'success');
    await loadFaqs();
  } catch {
    showToast('Error al eliminar la FAQ.', 'error');
  }
}

/** Exponer función para pre-rellenar desde el detalle de ticket */
export function openFaqFromTicket(description, solution) {
  window.location.hash = '#faqs';
  setTimeout(() => openModal({ title: description, solution, area: 'general' }), 300);
}

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
