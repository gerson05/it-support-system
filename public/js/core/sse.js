import { state }       from './state.js';
import { showToast }   from '../ui/components.js';
import { getAreaName } from './constants.js';
import { router }      from './router.js';

function safeParse(e) {
  try { return JSON.parse(e.data); } catch { return null; }
}

export function startRealTimeUpdates() {
  if (window._offlineMode) return;

  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('connected', () => {
    console.log('[SSE] Conectado al stream de eventos.');
  });

  evtSource.addEventListener('ticket-created', (e) => {
    const data = safeParse(e); if (!data) return;
    showToast(`🎟️ Nuevo ticket: ${data.ticket_number} (${getAreaName(data.area)})`, 'info');
    if (state.currentPage === 'dashboard') {
      setTimeout(router, 400);
    } else if (state.currentPage === 'tickets') {
      const app         = document.getElementById('app');
      const currentMode = app?._ticketListMode?.();
      if (!currentMode || currentMode === 'activos') setTimeout(router, 400);
    }
  });

  evtSource.addEventListener('ticket-updated', (e) => {
    const data = safeParse(e); if (!data) return;
    if (state.currentPage === 'dashboard' || state.currentPage === 'tickets') {
      setTimeout(router, 400);
    } else if (state.currentPage === 'ticket-detail') {
      const currentId = window.location.hash.split('/')[1];
      if (currentId && parseInt(currentId) === data.id) setTimeout(router, 400);
    }
  });

  evtSource.addEventListener('tech-request-created', (e) => {
    const data = safeParse(e); if (!data) return;
    const label = data.type === 'incidencia' ? '🔧 Incidencia' : '📋 Requerimiento';
    showToast(`${label} nuevo: ${data.request_number}`, 'info');
    if (state.currentPage === 'tech-requests') setTimeout(router, 400);
  });

  evtSource.addEventListener('tech-request-updated', () => {
    if (state.currentPage === 'tech-requests' || state.currentPage === 'tech-request-detail') {
      setTimeout(router, 400);
    }
  });

  evtSource.addEventListener('whatsapp-status', (e) => {
    const data = safeParse(e); if (!data) return;
    const banner = document.getElementById('wa-status-banner');
    if (banner) banner.style.display = data.connected ? 'none' : 'block';
    if (data.connected) showToast('✅ WhatsApp conectado — los mensajes ahora llegarán al empleado.', 'success');
  });

  evtSource.addEventListener('ticket-message', (e) => {
    const data = safeParse(e); if (!data) return;
    if (state.currentPage === 'ticket-detail') {
      const currentId = parseInt(window.location.hash.split('/')[1]);
      if (currentId === data.ticketId) setTimeout(router, 400);
    }
    if (state.currentPage === 'dashboard') setTimeout(router, 400);
  });

  evtSource.addEventListener('employee-created', (e) => {
    const data = safeParse(e); if (!data) return;
    showToast(`👤 Nuevo empleado pendiente de credenciales: ${data.nombre_completo}`, 'warning');
    _shiftEmployeeBadge(1);
  });

  evtSource.addEventListener('employee-credentialed', (e) => {
    const data = safeParse(e); if (!data) return;
    const { pending } = data;
    setEmployeeBadge(pending);
  });

  evtSource.onerror = () => console.warn('[SSE] Conexión perdida, reintentando...');
}

export function setEmployeeBadge(n) {
  const badge = document.getElementById('badge-employees');
  if (!badge) return;
  if (n > 0) { badge.textContent = n; badge.style.display = 'flex'; }
  else        { badge.textContent = ''; badge.style.display = 'none'; }
}

function _shiftEmployeeBadge(delta) {
  const badge = document.getElementById('badge-employees');
  if (!badge) return;
  const current = parseInt(badge.textContent || '0', 10);
  setEmployeeBadge(current + delta);
}
