import { renderDashboard } from './dashboard.js';
import { renderTicketList } from './ticket-list.js';
import { renderTicketDetail } from './ticket-detail.js';
import { renderSettings } from './settings.js';
import { renderTechRequests } from './tech-requests.js';
import { renderTechRequestDetail } from './tech-request-detail.js';
import { renderFaqs } from './faqs.js';
import { renderSedesAdmin } from './sedes-admin.js';
import { renderAudit } from './audit.js';
import { renderDespacho } from './despacho.js';
import { showToast } from './components.js';
import { DataService, isOfflineMode } from './data-service.js';

// Estado global de la aplicación SPA
export const state = {
  currentAgent: { id: 1, name: 'Agente 1' },
  agents: [],
  currentPage: 'dashboard'
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
    const ticketId = hash.split('/')[1];
    state.currentPage = 'ticket-detail';
    document.getElementById('nav-tickets').classList.add('active');
    renderTicketDetail(appContainer, ticketId);
  } else if (hash.startsWith('#tech-request/')) {
    const reqId = hash.split('/')[1];
    state.currentPage = 'tech-request-detail';
    const navTR = document.getElementById('nav-tech-requests');
    if (navTR) navTR.classList.add('active');
    renderTechRequestDetail(appContainer, reqId);
  } else {
    switch (hash) {
      case '#dashboard':
        state.currentPage = 'dashboard';
        document.getElementById('nav-dashboard').classList.add('active');
        renderDashboard(appContainer);
        break;
      case '#tickets':
        state.currentPage = 'tickets';
        document.getElementById('nav-tickets').classList.add('active');
        renderTicketList(appContainer);
        break;
      case '#tech-requests':
        state.currentPage = 'tech-requests';
        const navTR2 = document.getElementById('nav-tech-requests');
        if (navTR2) navTR2.classList.add('active');
        renderTechRequests(appContainer);
        break;
      case '#faqs':
        state.currentPage = 'faqs';
        const navFaqs = document.getElementById('nav-faqs');
        if (navFaqs) navFaqs.classList.add('active');
        renderFaqs(appContainer);
        break;
      case '#settings':
        state.currentPage = 'settings';
        const navSettings = document.getElementById('nav-settings');
        if (navSettings) navSettings.classList.add('active');
        renderSettings(appContainer);
        break;
      case '#sedes':
        state.currentPage = 'sedes';
        const navSedes = document.getElementById('nav-sedes');
        if (navSedes) navSedes.classList.add('active');
        renderSedesAdmin(appContainer);
        break;
      case '#despacho':
        state.currentPage = 'despacho';
        const navDespacho = document.getElementById('nav-despacho');
        if (navDespacho) navDespacho.classList.add('active');
        renderDespacho(appContainer);
        break;
      case '#audit':
        state.currentPage = 'audit';
        const navAudit = document.getElementById('nav-audit');
        if (navAudit) navAudit.classList.add('active');
        renderAudit(appContainer);
        break;
      default:
        state.currentPage = 'dashboard';
        document.getElementById('nav-dashboard').classList.add('active');
        renderDashboard(appContainer);
    }
  }
}

/* ==========================================================================
   INICIALIZACIÓN DE LA APLICACIÓN
   ========================================================================== */

async function init() {
  // Configurar banner de modo de ejecución en la interfaz
  if (isOfflineMode) {
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
    btnCopy.addEventListener('click', () => {
      const textEl = document.getElementById('wa-qr-text');
      if (textEl && textEl.value) {
        navigator.clipboard.writeText(textEl.value).then(() => {
          showToast('QR copiado al portapapeles!', 'success');
        }).catch(() => {
          textEl.select();
          document.execCommand('copy');
          showToast('QR copiado!', 'success');
        });
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

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
  init();
  startRealTimeUpdates();
  initSidebarToggle();
});
