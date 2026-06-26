import { state }       from './state.js';
import { showToast }   from '../ui/components.js';
import { getAreaName } from './constants.js';
import { router }      from './router.js';

export function startRealTimeUpdates() {
  if (window._offlineMode) return;

  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('connected', () => {
    console.log('[SSE] Conectado al stream de eventos.');
  });

  evtSource.addEventListener('ticket-created', (e) => {
    const data = JSON.parse(e.data);
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
    const data = JSON.parse(e.data);
    if (state.currentPage === 'dashboard' || state.currentPage === 'tickets') {
      setTimeout(router, 400);
    } else if (state.currentPage === 'ticket-detail') {
      const currentId = window.location.hash.split('/')[1];
      if (currentId && parseInt(currentId) === data.id) setTimeout(router, 400);
    }
  });

  evtSource.addEventListener('tech-request-created', (e) => {
    const data  = JSON.parse(e.data);
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
    const data   = JSON.parse(e.data);
    const banner = document.getElementById('wa-status-banner');
    if (banner) banner.style.display = data.connected ? 'none' : 'block';
    if (data.connected) showToast('✅ WhatsApp conectado — los mensajes ahora llegarán al empleado.', 'success');
  });

  evtSource.addEventListener('ticket-message', (e) => {
    const data = JSON.parse(e.data);
    if (state.currentPage === 'ticket-detail') {
      const currentId = parseInt(window.location.hash.split('/')[1]);
      if (currentId === data.ticketId) setTimeout(router, 400);
    }
    if (state.currentPage === 'dashboard') setTimeout(router, 400);
  });

  evtSource.onerror = () => console.warn('[SSE] Conexión perdida, reintentando...');
}
