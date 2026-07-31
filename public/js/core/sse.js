import { state }       from './state.js';
import { showToast }   from '../ui/components.js';
import { getAreaName } from './constants.js';
import { router }      from './router.js';

function safeParse(e) {
  try { return JSON.parse(e.data); } catch { return null; }
}

let _audioCtx = null;
function playChime(notes, gap = 0.13, vol = 0.25) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    notes.forEach((freq, i) => {
      const osc  = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = _audioCtx.currentTime + i * gap;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + gap);
      osc.start(t);
      osc.stop(t + gap + 0.01);
    });
  } catch {}
}

export function startRealTimeUpdates() {
  if (window._offlineMode) return;

  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('connected', () => {
    console.log('[SSE] Conectado al stream de eventos.');
  });

  evtSource.addEventListener('ticket-created', (e) => {
    const data = safeParse(e); if (!data) return;
    playChime([880, 1100, 1320]);
    showToast(`🎟️ Nuevo ticket: ${data.ticket_number} (${getAreaName(data.area)})`, 'info');
    setTimeout(() => {
      if (window.location.hash !== '#tickets') {
        window.location.hash = '#tickets'; // hashchange → router()
      } else {
        router();
      }
    }, 400);
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
    playChime([660, 880]);
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
    playChime([550, 770, 990, 1210]);
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
