import { renderDashboard } from './dashboard.js';
import { renderInventario } from './inventario.js';
import { renderTicketList } from './ticket-list.js';
import { renderTicketDetail } from './ticket-detail.js';
import { renderSettings } from './settings.js';
import { renderTechRequests } from './tech-requests.js';
import { renderTechRequestDetail } from './tech-request-detail.js';
import { renderFaqs } from './faqs.js';
import { renderSedesAdmin } from './sedes-admin.js';
import { renderAudit } from './audit.js';
import { renderDespacho } from './despacho.js';
import { renderTrazabilidad } from './trazabilidad.js';
import { renderUsers } from './users.js';
import { showToast, copyToClipboard } from './components.js';
import { DataService, isOfflineMode } from './data-service.js';

function can(permission) {
  const user = state.currentUser;
  if (!user) return false;
  return user.permissions.includes('full') || user.permissions.includes(permission);
}

function _firstAccessibleHash() {
  if (can('metrics:read'))       return '#dashboard';
  if (can('tickets:read'))       return '#tickets';
  if (can('tech-requests:read')) return '#tech-requests';
  if (can('faqs:read'))          return '#faqs';
  if (can('sedes:read'))         return '#sedes';
  if (can('despacho:read'))      return '#despacho';
  if (can('audit:read'))         return '#audit';
  if (can('inventario:read'))     return '#inventario';
  return '#settings';
}

/* ── Global modal scroll lock ──────────────────────────────────────────
   Prevents body from scrolling behind open modals.
   Uses MutationObserver to catch all open/close patterns automatically.
   ──────────────────────────────────────────────────────────────────── */
(function initScrollLock() {
  let _lockedScrollY = 0;
  let _lockCount = 0;

  function lock() {
    if (_lockCount++ > 0) return;
    _lockedScrollY = window.scrollY;
    document.body.style.top = `-${_lockedScrollY}px`;
    document.body.classList.add('modal-open');
  }
  function unlock() {
    if (--_lockCount > 0) return;
    _lockCount = 0;
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, _lockedScrollY);
  }

  function isVisible(el) {
    if (!el) return false;
    const s = el.style.display;
    if (s === 'none') return false;
    if (s === 'flex' || s === 'block') return true;
    if (el.classList.contains('open')) return true;
    /* appended-to-DOM modals (no explicit style) */
    return !s && el.offsetHeight > 0;
  }

  const SELECTORS = [
    '.modal-overlay',
    '#tr-modal-overlay',
    '#faqs-modal-overlay',
    '#user-modal',
    '#acta-modal-overlay',
    '#smart-scanner-overlay',
    '#scanner-overlay',
  ].join(',');

  let _wasOpen = false;

  function syncLock() {
    const isOpen = !![...document.querySelectorAll(SELECTORS)].some(isVisible);
    if (isOpen && !_wasOpen) { lock(); }
    else if (!isOpen && _wasOpen) { unlock(); }
    _wasOpen = isOpen;
  }

  const observer = new MutationObserver(syncLock);
  observer.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['style', 'class'],
  });
})();

// Estado global de la aplicación SPA
export const state = {
  currentAgent: { id: 1, name: 'Agente 1' },
  agents: [],
  currentPage: 'dashboard',
  currentUser: null,
};

// Mapeos de traducción y visualización
export const AREA_MAPPINGS = {
  'cartera':        { label: 'Cartera',        emoji: '' },
  'compra':         { label: 'Compra',          emoji: '' },
  'gestion_humana': { label: 'Gestión Humana',  emoji: '' },
  'pqrs':           { label: 'PQRS',            emoji: '' },
  'contabilidad':   { label: 'Contabilidad',    emoji: '' },
  'farmacia':       { label: 'Farmacia',        emoji: '' },
  'cuentas_medicas':{ label: 'Cuentas Médicas', emoji: '' },
  'general':        { label: 'General / IT',    emoji: '' },
};

export const PRIORITY_LABELS = {
  'baja':    'Baja',
  'media':   'Media',
  'alta':    'Alta',
  'critica': 'Crítica',
};

export const STATUS_LABELS = {
  'abierto':        'Abierto',
  'en_progreso':    'En progreso',
  'en_espera':      'En espera',
  'resuelto':       'Resuelto',
  'cerrado':        'Cerrado',
  'siguiente_dia':  'Siguiente día',
};

/* ==========================================================================
   FUNCIONES UTILITARIAS DE FORMATEO
   ========================================================================== */

export function getAreaEmoji(area) {
  return ''; // Ya no usamos emojis de área
}

export function getAreaName(area) {
  return AREA_MAPPINGS[area]?.label || area;
}

export function getPriorityBadge(priority) {
  const p = priority?.toLowerCase() || 'media';
  const label = PRIORITY_LABELS[p] || p;
  return `<span class="badge badge-${p}">${label}</span>`;
}

export function getStatusBadge(status) {
  const s = status?.toLowerCase() || 'abierto';
  const label = STATUS_LABELS[s] || s;
  return `<span class="badge badge-${s}">${label}</span>`;
}

export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  
  return `${d}/${m}/${y} ${h}:${min}`;
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Hace un momento';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return `Hace ${Math.floor(interval)} años`;
  
  interval = seconds / 2592000;
  if (interval > 1) return `Hace ${Math.floor(interval)} meses`;
  
  interval = seconds / 86400;
  if (interval > 1) return `Hace ${Math.floor(interval)} días`;
  
  interval = seconds / 3600;
  if (interval > 1) return `Hace ${Math.floor(interval)} horas`;
  
  interval = seconds / 60;
  if (interval > 1) return `Hace ${Math.floor(interval)} minutos`;
  
  return 'Hace un momento';
}

/* ==========================================================================
   SISTEMA DE ENRUTAMIENTO (ROUTER SPA)
   ========================================================================== */

function router() {
  const hash = window.location.hash || '#dashboard';
  const appContainer = document.getElementById('app');
  
  // Limpiar clases activas del sidebar
  document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
  
  // Parsear rutas complejas (ej. #ticket/12, #tech-request/5)
  if (hash.startsWith('#ticket/')) {
    if (state.currentUser && !can('tickets:read')) { window.location.hash = _firstAccessibleHash(); return; }
    const ticketId = hash.split('/')[1];
    state.currentPage = 'ticket-detail';
    document.getElementById('nav-tickets')?.classList.add('active');
    renderTicketDetail(appContainer, ticketId);
  } else if (hash.startsWith('#tech-request/')) {
    if (state.currentUser && !can('tech-requests:read')) { window.location.hash = _firstAccessibleHash(); return; }
    const reqId = hash.split('/')[1];
    state.currentPage = 'tech-request-detail';
    document.getElementById('nav-tech-requests')?.classList.add('active');
    renderTechRequestDetail(appContainer, reqId);
  } else {
    switch (hash) {
      case '#dashboard':
        if (state.currentUser && !can('metrics:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'dashboard';
        document.getElementById('nav-dashboard')?.classList.add('active');
        renderDashboard(appContainer);
        break;
      case '#tickets':
        if (state.currentUser && !can('tickets:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'tickets';
        document.getElementById('nav-tickets')?.classList.add('active');
        renderTicketList(appContainer);
        break;
      case '#tech-requests':
        if (state.currentUser && !can('tech-requests:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'tech-requests';
        document.getElementById('nav-tech-requests')?.classList.add('active');
        renderTechRequests(appContainer);
        break;
      case '#faqs':
        if (state.currentUser && !can('faqs:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'faqs';
        document.getElementById('nav-faqs')?.classList.add('active');
        renderFaqs(appContainer);
        break;
      case '#settings':
        state.currentPage = 'settings';
        document.getElementById('nav-settings')?.classList.add('active');
        renderSettings(appContainer);
        break;
      case '#sedes':
        if (state.currentUser && !can('sedes:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'sedes';
        document.getElementById('nav-sedes')?.classList.add('active');
        renderSedesAdmin(appContainer);
        break;
      case '#despacho':
        if (state.currentUser && !can('despacho:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'despacho';
        document.getElementById('nav-despacho')?.classList.add('active');
        renderDespacho(appContainer);
        break;
      case '#trazabilidad':
        if (state.currentUser && !can('despacho:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'trazabilidad';
        document.getElementById('nav-trazabilidad')?.classList.add('active');
        renderTrazabilidad(appContainer);
        break;
      case '#audit':
        if (state.currentUser && !can('audit:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'audit';
        document.getElementById('nav-audit')?.classList.add('active');
        renderAudit(appContainer);
        break;
      case '#inventario':
        if (state.currentUser && !can('inventario:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'inventario';
        document.getElementById('nav-inventario')?.classList.add('active');
        renderInventario(appContainer);
        break;
      case '#users':
        if (state.currentUser && !can('full')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'users';
        document.getElementById('nav-users')?.classList.add('active');
        renderUsers(appContainer);
        break;
      default:
        if (state.currentUser && !can('metrics:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'dashboard';
        document.getElementById('nav-dashboard')?.classList.add('active');
        renderDashboard(appContainer);
    }
  }
}

/* ==========================================================================
   INICIALIZACIÓN DE LA APLICACIÓN
   ========================================================================== */

async function init() {
  // Verificar autenticación en modo online
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
    } catch (_) {
      // Sin servidor — continuar sin guard
    }
  }

  // Configurar banner de modo de ejecución en la interfaz
  if (isOfflineMode) {
    document.querySelectorAll('.menu-item').forEach(el => el.style.display = 'flex');
    const pulseInd = document.querySelector('.pulse-indicator');
    if (pulseInd) {
      pulseInd.style.background = '#f59e0b';
      pulseInd.style.boxShadow = '0 0 8px #f59e0b';
      const label = document.querySelector('.sidebar-footer span:first-child');
      if (label) label.innerHTML = 'v1.0.0 <strong>(Demo Local)</strong>';
    }
    showToast('Iniciado en Modo Demostración Local (Sin servidor)', 'info');
  } else {
    showToast('Conectado con Servidor Central IT', 'success');
    startWhatsAppMonitor();
  }

  try {
    state.agents = await DataService.getAgents();

    const agentSelect = document.getElementById('agent-select');
    if (agentSelect) {
      agentSelect.innerHTML = state.agents.map(a =>
        `<option value="${a.id}">${a.name}</option>`
      ).join('');

      if (state.agents.length > 0) {
        state.currentAgent = state.agents[0];
        updateAgentAvatar(state.currentAgent.name);
      }
    }
  } catch (error) {
    console.error('Error cargando agentes:', error);
    showToast('Fallo al obtener agentes de IT.', 'error');
  }

  // Manejar el selector de agentes
  const agentSel = document.getElementById('agent-select');
  if (agentSel) {
    agentSel.addEventListener('change', (e) => {
      const agentId = parseInt(e.target.value);
      const agent = state.agents.find(a => a.id === agentId);
      if (agent) {
        state.currentAgent = agent;
        updateAgentAvatar(agent.name);
        showToast(`Sesión cambiada a: ${agent.name}`, 'info');
        
        // Refrescar página si está en detalle de ticket
        if (state.currentPage === 'ticket-detail') {
          router();
        }
      }
    });
  }

  // Escuchar cambios en el hash
  window.addEventListener('hashchange', router);
  
  // Ejecutar el enrutador inicialmente
  router();
}

function updateAgentAvatar(name) {
  const avatar = document.getElementById('current-agent-avatar');
  if (avatar && name) {
    avatar.textContent = name.charAt(0).toUpperCase();
  }
}

/* ==========================================================================
   MONITOR DE CONEXIÓN WHATSAPP REAL
   ========================================================================== */
let waPollInterval = null;

function updateWaUI(statusData) {
  const dot = document.getElementById('wa-status-dot');
  const text = document.getElementById('wa-status-text');
  const btn = document.getElementById('btn-wa-connect');
  const qrContainer = document.getElementById('wa-qr-container');
  const qrImg = document.getElementById('wa-qr-image');

  if (!dot || !text) return;

  dot.className = 'wa-status-dot ' + (statusData.status || 'disconnected');

  const labels = {
    connected:    '✅ Conectado',
    awaiting_qr:  '📱 Escanea el QR',
    connecting:   '⏳ Conectando con WhatsApp...',
    disconnected: '❌ Desconectado',
    reconnecting: '🔄 Reconectando...',
  };
  text.textContent = labels[statusData.status] || statusData.status;

  if (statusData.connected) {
    // Conectado — ocultar todo lo de QR, sondeo lento
    qrContainer.style.display = 'none';
    btn.style.display = 'none';
    if (waPollInterval) clearInterval(waPollInterval);
    waPollInterval = setInterval(pollWaStatus, 30000);
  } else if (statusData.status === 'awaiting_qr' && statusData.qrString) {
    // QR disponible para escanear
    btn.style.display = 'none';
    qrContainer.style.display = 'block';
    if (statusData.qrImage) {
      qrImg.src = statusData.qrImage;
      qrImg.style.display = 'block';
      qrImg.onerror = function() { qrImg.style.display = 'none'; };
    }
    const textEl = document.getElementById('wa-qr-text');
    if (textEl) textEl.value = statusData.qrString;
    if (waPollInterval) clearInterval(waPollInterval);
    waPollInterval = setInterval(pollWaStatus, 5000);
  } else if (statusData.status === 'connecting') {
    // QR ya escaneado, esperando que WhatsApp cargue — sondeo rápido
    qrContainer.style.display = 'none';
    btn.style.display = 'none';
    if (waPollInterval) clearInterval(waPollInterval);
    waPollInterval = setInterval(pollWaStatus, 3000);
  } else {
    // Desconectado — mostrar botón para conectar
    qrContainer.style.display = 'none';
    btn.style.display = 'block';
  }
}

async function pollWaStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    if (res.ok) {
      const data = await res.json();
      updateWaUI(data);
    }
  } catch (e) {
    console.warn('Error consultando estado de WhatsApp:', e);
  }
}

function startWhatsAppMonitor() {
  // Monitorear cada 3s mientras no esté conectado
  pollWaStatus();
  waPollInterval = setInterval(pollWaStatus, 3000);

  // Botón conectar
  const btnConnect = document.getElementById('btn-wa-connect');
  if (btnConnect) {
    btnConnect.addEventListener('click', async () => {
      btnConnect.textContent = 'Conectando...';
      btnConnect.disabled = true;
      try {
        await fetch('/api/whatsapp/connect', { method: 'POST' });
        showToast('Iniciando conexión de WhatsApp. Escanea el QR.', 'info');
      } catch (e) {
        showToast('Error al conectar WhatsApp.', 'error');
      }
      btnConnect.textContent = 'Conectar WhatsApp';
      btnConnect.disabled = false;
    });
  }

  // Botón copiar QR
  const btnCopy = document.getElementById('btn-copy-qr');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      const textEl = document.getElementById('wa-qr-text');
      if (textEl && textEl.value) {
        const ok = await copyToClipboard(textEl.value);
        if (ok) {
          showToast('QR copiado al portapapeles!', 'success');
        } else {
          showToast('No se pudo copiar el QR', 'error');
        }
      }
    });
  }
}

/* ==========================================================================
   ACTUALIZACIONES EN TIEMPO REAL (Server-Sent Events)
   ========================================================================== */

function startRealTimeUpdates() {
  if (isOfflineMode) return;

  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('connected', () => {
    console.log('[SSE] Conectado al stream de eventos.');
  });

  evtSource.addEventListener('ticket-created', (e) => {
    const data = JSON.parse(e.data);
    showToast(`🎟️ Nuevo ticket: ${data.ticket_number} (${getAreaName(data.area)})`, 'info');
    if (state.currentPage === 'dashboard') {
      setTimeout(() => router(), 400);
    } else if (state.currentPage === 'tickets') {
      // Only auto-refresh if user is viewing activos (not the archive)
      const appContainer = document.getElementById('app');
      const currentMode = appContainer?._ticketListMode?.();
      if (!currentMode || currentMode === 'activos') {
        setTimeout(() => router(), 400);
      }
    }
  });

  evtSource.addEventListener('ticket-updated', (e) => {
    const data = JSON.parse(e.data);
    if (state.currentPage === 'dashboard' || state.currentPage === 'tickets') {
      setTimeout(() => router(), 400);
    } else if (state.currentPage === 'ticket-detail') {
      const hash = window.location.hash;
      const currentId = hash.split('/')[1];
      if (currentId && parseInt(currentId) === data.id) {
        setTimeout(() => router(), 400);
      }
    }
  });

  evtSource.addEventListener('tech-request-created', (e) => {
    const data = JSON.parse(e.data);
    const label = data.type === 'incidencia' ? '🔧 Incidencia' : '📋 Requerimiento';
    showToast(`${label} nuevo: ${data.request_number}`, 'info');
    if (state.currentPage === 'tech-requests') setTimeout(() => router(), 400);
  });


  evtSource.addEventListener('tech-request-updated', () => {
    if (state.currentPage === 'tech-requests' || state.currentPage === 'tech-request-detail') {
      setTimeout(() => router(), 400);
    }
  });

  evtSource.addEventListener('whatsapp-status', (e) => {
    const data = JSON.parse(e.data);
    // Actualizar el banner de estado WhatsApp en ticket-detail si está visible
    const banner = document.getElementById('wa-status-banner');
    if (banner) banner.style.display = data.connected ? 'none' : 'block';
    if (data.connected) {
      showToast('✅ WhatsApp conectado — los mensajes ahora llegarán al empleado.', 'success');
    }
  });

  evtSource.addEventListener('ticket-message', (e) => {
    const data = JSON.parse(e.data);
    if (state.currentPage === 'ticket-detail') {
      const hash = window.location.hash;
      const currentId = parseInt(hash.split('/')[1]);
      if (currentId === data.ticketId) {
        setTimeout(() => router(), 400);
      }
    }
    if (state.currentPage === 'dashboard') {
      setTimeout(() => router(), 400);
    }
  });

  evtSource.onerror = () => {
    console.warn('[SSE] Conexión perdida, reintentando...');
  };
}

// ── Toggle sidebar en móvil ────────────────────────────────────────────
function initSidebarToggle() {
  const toggle  = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggle) return;

  const close = () => document.body.classList.remove('sidebar-open');

  toggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  overlay.addEventListener('click', close);

  // Cerrar al navegar (click en cualquier ítem del menú)
  document.querySelectorAll('.menu-item').forEach(item => item.addEventListener('click', close));
}

function _applyUserUI(user) {
  const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'flex'; };

  const label = document.getElementById('current-user-label');
  if (label) { label.textContent = user.username; label.style.display = 'inline'; }
  updateAgentAvatar(user.username);

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.style.display = 'inline-block';
    btnLogout.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.replace('/login.html');
    });
  }

  if (can('metrics:read'))       show('nav-dashboard');
  if (can('tickets:read'))       show('nav-tickets');
  if (can('tech-requests:read')) show('nav-tech-requests');
  if (can('faqs:read'))          show('nav-faqs');
  if (can('sedes:read'))         show('nav-sedes');
  if (can('despacho:read'))      show('nav-despacho');
  if (can('audit:read'))         show('nav-audit');
  if (can('inventario:read'))    show('nav-inventario');
  if (can('farmacias:read'))     show('nav-farmacias');
  if (can('full'))               show('nav-users');
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
  init();
  startRealTimeUpdates();
  initSidebarToggle();
});
