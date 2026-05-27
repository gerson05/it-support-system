import { 
  formatDate, 
  getPriorityBadge, 
  getStatusBadge, 
  getAreaEmoji, 
  getAreaName 
} from './app.js';

/**
 * Crea una tarjeta de estadísticas
 */
export function createStatCard(title, value, icon, colorClass = '') {
  return `
    <div class="card stat-card ${colorClass}">
      <div class="stat-info">
        <span class="stat-value">${value}</span>
        <span class="stat-label">${title}</span>
      </div>
      <div class="stat-icon-container">
        ${icon}
      </div>
    </div>
  `;
}

/**
 * Crea una fila de la tabla de tickets
 */
export function createTicketRow(ticket) {
  const emoji = getAreaEmoji(ticket.area);
  const areaName = getAreaName(ticket.area);
  const agentName = ticket.agent_name || '<span class="text-muted">Sin asignar</span>';
  
  return `
    <tr onclick="window.location.hash = '#ticket/${ticket.id}'">
      <td style="font-weight: 700; color: #667eea;">${ticket.ticket_number}</td>
      <td>
        <span class="flex-align" style="display: flex; align-items: center; gap: 8px;">
          <span>${emoji}</span>
          <span>${areaName}</span>
        </span>
      </td>
      <td>
        <div style="font-weight: 500;">${ticket.requester_name || 'Sin nombre'}</div>
        <div style="font-size: 11px; color: var(--text-muted);">${ticket.phone}</div>
      </td>
      <td>${getPriorityBadge(ticket.priority)}</td>
      <td>${getStatusBadge(ticket.status)}</td>
      <td>👤 ${agentName}</td>
      <td style="color: var(--text-muted); font-size: 13px;">${formatDate(ticket.updated_at)}</td>
    </tr>
  `;
}

/**
 * Crea un estado vacío cuando no hay información para mostrar
 */
export function createEmptyState(message = 'No se encontraron resultados', icon = '🔍') {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-text">${message}</div>
    </div>
  `;
}

/**
 * Crea un spinner de carga
 */
export function createLoadingSpinner() {
  return `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
    </div>
  `;
}

/**
 * Muestra un Toast de notificación flotante
 * @param {string} message Mensaje de la notificación
 * @param {string} type Tipo: 'success' | 'error' | 'info'
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  
  toast.innerHTML = `
    <span style="font-size: 16px;">${icon}</span>
    <span style="font-size: 13.5px; font-weight: 500;">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Quitar con animación
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}
