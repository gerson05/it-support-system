import './scroll-lock.js';
import { showToast }                from '../ui/components.js';
import { DataService, isOfflineMode } from './api.js';
import { state, can }               from './state.js';
import { router }                   from './router.js';
import { startRealTimeUpdates, setEmployeeBadge } from './sse.js';
import { startWhatsAppMonitor }     from './whatsapp.js';

// ── Re-exports para backward compat (otros módulos importan de app.js) ──
export { state }                                            from './state.js';
export {
  AREA_MAPPINGS, PRIORITY_LABELS, STATUS_LABELS,
  getAreaEmoji, getAreaName, getPriorityBadge, getStatusBadge,
  formatDate, formatTimeAgo,
}                                                           from './constants.js';

/* ── Inicialización ─────────────────────────────────────────────────── */

function _applyUserUI(user) {
  const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };
  const label = document.getElementById('current-user-label');
  if (label) { label.textContent = user.username; label.style.display = 'inline'; }
  const avatar = document.getElementById('current-agent-avatar');
  if (avatar) avatar.textContent = user.username.charAt(0).toUpperCase();

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login.html');
  });
  const btn = document.getElementById('btn-logout');
  if (btn) btn.style.display = 'inline-block';

  if (can('metrics:read'))       show('nav-dashboard');
  if (can('tickets:read'))       show('nav-tickets');
  if (can('tech-requests:read')) show('nav-tech-requests');
  if (can('faqs:read'))          show('nav-faqs');
  if (can('sedes:read'))         show('nav-sedes');
  if (can('reuniones:read'))     show('nav-reuniones');
  if (can('despacho:read'))      show('nav-gestion');
  if (can('despacho:read'))      show('nav-despacho');
  if (can('despacho:read'))      show('nav-trazabilidad');
  if (can('audit:read'))         show('nav-audit');
  if (can('inventario:read'))    show('nav-inventario');
  if (can('farmacias:read'))     show('nav-farmacias');
  if (can('full'))               show('nav-users');
  if (can('employees:read'))     show('nav-employees');
  if (can('monitoreo:read'))     show('nav-monitoreo');
}

function initSidebarToggle() {
  const toggle  = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggle) return;
  const close = () => document.body.classList.remove('sidebar-open');
  toggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  overlay?.addEventListener('click', close);
  document.querySelectorAll('.menu-item').forEach(el => el.addEventListener('click', close));
}

async function init() {
  if (!isOfflineMode) {
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        sessionStorage.removeItem('it_role');
        window.location.replace('/login.html');
        return;
      }
      if (res.ok) {
        state.currentUser = await res.json();
        _applyUserUI(state.currentUser);
      }
    } catch (_) { /* sin servidor — continuar sin guard */ }
  }

  if (isOfflineMode) {
    document.querySelectorAll('.menu-item').forEach(el => el.style.display = 'flex');
    const pulseInd = document.querySelector('.pulse-indicator');
    if (pulseInd) {
      pulseInd.style.background  = '#f59e0b';
      pulseInd.style.boxShadow   = '0 0 8px #f59e0b';
      const label = document.querySelector('.sidebar-footer span:first-child');
      if (label) label.innerHTML = 'v1.0.0 <strong>(Demo Local)</strong>';
    }
    showToast('Iniciado en Modo Demostración Local (Sin servidor)', 'info');
  } else {
    showToast('Conectado con Servidor Central IT', 'success');
    startWhatsAppMonitor();
  }

  if (can('employees:read')) {
    fetch('/api/employees/pending-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(({ count }) => setEmployeeBadge(count))
      .catch(() => {});
  }

  window.addEventListener('hashchange', () => {
    router();
  });
  router();
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  startRealTimeUpdates();
  initSidebarToggle();
});
