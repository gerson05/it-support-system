import {
  formatDate,
  getPriorityBadge,
  getStatusBadge,
  getAreaEmoji,
  getAreaName,
  state
} from './app.js';
import { showToast, createLoadingSpinner } from './components.js';
import DataService from './data-service.js';
import { openFaqFromTicket } from './faqs.js';

export async function renderTicketDetail(container, ticketId) {
  container.innerHTML = createLoadingSpinner();

  async function loadTicketData() {
    try {
      const ticket = await DataService.getTicketById(ticketId);
      
      if (!ticket) {
        throw new Error('Ticket no encontrado');
      }
      
      const emoji = getAreaEmoji(ticket.area);
      const areaName = getAreaName(ticket.area);
      
      // Parsear FAQs intentadas
      let faqsTriedHtml = '<span class="text-muted">Ninguna FAQ consultada</span>';
      try {
        const faqsTried = JSON.parse(ticket.faq_tried || '[]');
        if (faqsTried.length > 0) {
          faqsTriedHtml = faqsTried.map(id => `<code>${id}</code>`).join(', ');
        }
      } catch (e) {
        console.error(e);
      }

      container.innerHTML = `
        <!-- Botón Volver -->
        <div style="margin-bottom: 25px;">
          <a href="#tickets" style="text-decoration: none; color: var(--primary); font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
            🡨 Volver al Listado
          </a>
        </div>

        <!-- Cabecera Detalle -->
        <div class="card" style="margin-bottom: 30px; padding: 24px 30px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <h2 style="font-size: 24px; font-weight: 700;">Ticket ${ticket.ticket_number}</h2>
                ${getStatusBadge(ticket.status)}
                ${getPriorityBadge(ticket.priority)}
              </div>
              <p style="color: var(--text-muted); font-size: 14px;">
                Creado por <strong>${ticket.requester_name || 'Empleado'}</strong>
              </p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 10px 20px; border-radius: 30px;">
              <span style="font-size: 20px;">${emoji}</span>
              <span style="font-weight: 600; font-size: 14px;">Área: ${areaName}</span>
            </div>
          </div>
        </div>

        <!-- Grid Principal de Detalle -->
        <div class="ticket-detail-grid">
          <!-- Timeline y Mensajes (Izquierda) -->
          <div class="card timeline-card">
            <div class="section-title">Conversación de WhatsApp</div>
            
            <div class="timeline-messages" id="timeline-messages-container">
              <!-- Mensajes se inyectan aquí -->
            </div>
            
            <!-- Responder -->
            <form id="reply-form" class="reply-form">
              <textarea id="reply-input" placeholder="Escribe tu respuesta para el empleado (se enviará a su WhatsApp)..." required autocomplete="off"></textarea>
              <button type="submit" class="btn btn-primary" style="height: 50px;">Enviar respuesta ➔</button>
            </form>
          </div>

          <!-- Información y Acciones (Derecha) -->
          <div style="display: flex; flex-direction: column; gap: 30px;">
            <!-- Ficha Técnica -->
            <div class="card">
              <div class="section-title">Detalles del Caso</div>
              <div class="info-details-list" style="margin-top: 20px;">
                <div class="info-details-item">
                  <span class="info-details-label">Solicitante:</span>
                  <span class="info-details-val">${ticket.requester_name || 'Sin registrar'}</span>
                </div>
                <div class="info-details-item">
                  <span class="info-details-label">WhatsApp/Celular:</span>
                  <span class="info-details-val">${ticket.phone}</span>
                </div>
                <div class="info-details-item">
                  <span class="info-details-label">Categoría:</span>
                  <span class="info-details-val" style="text-transform: capitalize;">${ticket.category || 'General'}</span>
                </div>
                <div class="info-details-item">
                  <span class="info-details-label">FAQs Intentadas:</span>
                  <span class="info-details-val">${faqsTriedHtml}</span>
                </div>
                <div class="info-details-item">
                  <span class="info-details-label">Creado el:</span>
                  <span class="info-details-val">${formatDate(ticket.created_at)}</span>
                </div>
                <div class="info-details-item">
                  <span class="info-details-label">Último Cambio:</span>
                  <span class="info-details-val">${formatDate(ticket.updated_at)}</span>
                </div>
                <div class="info-details-item" style="border-bottom: none; padding-bottom: 0;">
                  <span class="info-details-label">Resolución:</span>
                  <span class="info-details-val" style="color: var(--color-resuelto);">${ticket.resolved_at ? formatDate(ticket.resolved_at) : 'Sin resolver'}</span>
                </div>
              </div>
            </div>

            <!-- Acciones Rápidas (IT) -->
            <div class="card">
              <div class="section-title">Gestión</div>
              <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 15px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="change-status">Estado del Ticket</label>
                  <select id="change-status">
                    <option value="abierto" ${ticket.status === 'abierto' ? 'selected' : ''}>Abierto</option>
                    <option value="en_progreso" ${ticket.status === 'en_progreso' ? 'selected' : ''}>En Progreso</option>
                    <option value="en_espera" ${ticket.status === 'en_espera' ? 'selected' : ''}>En Espera</option>
                    <option value="resuelto" ${ticket.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                    <option value="cerrado" ${ticket.status === 'cerrado' ? 'selected' : ''}>Cerrado</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label for="change-priority">Prioridad</label>
                  <select id="change-priority">
                    <option value="baja" ${ticket.priority === 'baja' ? 'selected' : ''}>Baja</option>
                    <option value="media" ${ticket.priority === 'media' ? 'selected' : ''}>Media</option>
                    <option value="alta" ${ticket.priority === 'alta' ? 'selected' : ''}>Alta</option>
                    <option value="critica" ${ticket.priority === 'critica' ? 'selected' : ''}>Crítica</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label for="assign-agent">Agente Asignado</label>
                  <select id="assign-agent">
                    <option value="">Sin Asignar</option>
                    <!-- Agentes se cargan dinámicamente -->
                  </select>
                </div>

                <button class="btn btn-primary" id="btn-save-actions" style="margin-top: 5px;">Guardar Cambios</button>
                <button class="btn btn-secondary" id="btn-add-to-faq" title="Convertir este caso en una FAQ reutilizable">Agregar a Base de Conocimiento</button>
              </div>
            </div>

            <!-- Notas Internas (Privado IT) -->
            <div class="card">
              <div class="section-title">Notas Internas</div>
              <div class="internal-notes-section">
                <div class="notes-list" id="notes-list-container">
                  <!-- Notas se cargan aquí -->
                </div>
                
                <form id="note-form" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                  <textarea id="note-input" placeholder="Escribe una anotación privada (no visible para el empleado)..." style="min-height: 60px; font-size: 13px;" required></textarea>
                  <button type="submit" class="btn btn-secondary" style="padding: 10px; font-size: 13px;">Añadir Nota 📌</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      `;

      // Pintar Mensajes de la Timeline
      const messagesContainer = document.getElementById('timeline-messages-container');
      if (messagesContainer) {
        if (!ticket.messages || ticket.messages.length === 0) {
          messagesContainer.innerHTML = '<div class="text-muted" style="text-align: center; padding: 40px 0;">No hay historial de mensajes.</div>';
        } else {
          messagesContainer.innerHTML = ticket.messages.map(msg => {
            let senderName = '';
            if (msg.sender_type === 'user') senderName = ticket.requester_name || 'Empleado';
            else if (msg.sender_type === 'bot') senderName = 'Bot de IT 🤖';
            else senderName = msg.sender_name || 'Agente IT 👨‍💻';

            return `
              <div class="message-bubble ${msg.sender_type}">
                <div style="font-weight: 700; font-size: 12px; margin-bottom: 6px; opacity: 0.85;">${senderName}</div>
                <div style="word-break: break-word; white-space: pre-wrap;">${msg.content}</div>
                <div class="message-meta">
                  <span></span>
                  <span>${formatDate(msg.created_at)}</span>
                </div>
              </div>
            `;
          }).join('');
          
          // Auto-scroll al final del chat
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }

      // Pintar Notas Internas
      const notesContainer = document.getElementById('notes-list-container');
      if (notesContainer) {
        if (!ticket.notes || ticket.notes.length === 0) {
          notesContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px 0;">No hay anotaciones registradas.</div>';
        } else {
          notesContainer.innerHTML = ticket.notes.map(note => `
            <div class="note-item">
              <div style="word-break: break-word;">${note.content}</div>
              <div class="note-meta">
                <span>📌 por ${note.agent_name || 'Agente'}</span>
                <span>${formatDate(note.created_at)}</span>
              </div>
            </div>
          `).join('');
          notesContainer.scrollTop = notesContainer.scrollHeight;
        }
      }

      // Rellenar lista de agentes en la sección de asignación
      const assignSelect = document.getElementById('assign-agent');
      if (assignSelect) {
        assignSelect.innerHTML = '<option value="">Sin Asignar</option>' + 
          state.agents.map(a => 
            `<option value="${a.id}" ${ticket.assigned_to === a.id ? 'selected' : ''}>${a.name}</option>`
          ).join('');
      }

      // === EVENTO: ENVIAR MENSAJE AL USUARIO ===
      const replyForm = document.getElementById('reply-form');
      replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('reply-input');
        const content = input.value;
        
        try {
          await DataService.addMessage(ticketId, 'agent', state.currentAgent.name, content);
          input.value = '';
          showToast('Respuesta enviada al WhatsApp del empleado.', 'success');
          
          // Recargar timeline
          await loadTicketData();
        } catch (err) {
          console.error(err);
          showToast('Fallo al enviar la respuesta al usuario.', 'error');
        }
      });

      // === EVENTO: AÑADIR NOTA INTERNA ===
      const noteForm = document.getElementById('note-form');
      noteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('note-input');
        const content = input.value;

        try {
          await DataService.addInternalNote(ticketId, state.currentAgent.id, state.currentAgent.name, content);
          input.value = '';
          showToast('Nota interna registrada.', 'success');
          
          // Recargar timeline
          await loadTicketData();
        } catch (err) {
          console.error(err);
          showToast('Fallo al agregar nota.', 'error');
        }
      });

      // === EVENTO: GUARDAR CONFIGURACIONES DEL TICKET (ESTADO, PRIORIDAD, ASIGNADO) ===
      const btnSave = document.getElementById('btn-save-actions');
      btnSave.addEventListener('click', async () => {
        const status = document.getElementById('change-status').value;
        const priority = document.getElementById('change-priority').value;
        const assigned_to = document.getElementById('assign-agent').value;

        try {
          await DataService.updateTicket(ticketId, { status, priority, assigned_to });
          showToast('Cambios del ticket guardados exitosamente.', 'success');
          await loadTicketData();
        } catch (err) {
          console.error(err);
          showToast('Fallo al aplicar cambios al ticket.', 'error');
        }
      });

      // === EVENTO: AGREGAR A BASE DE CONOCIMIENTO ===
      document.getElementById('btn-add-to-faq')?.addEventListener('click', () => {
        // Usa la descripción del ticket como título sugerido y los mensajes del agente
        // como punto de partida para la solución
        const agentMessages = (ticket.messages || [])
          .filter(m => m.sender_type === 'agent')
          .map(m => m.content)
          .join('\n\n');

        openFaqFromTicket(ticket.description || '', agentMessages);
        showToast('Abriendo editor de FAQ con los datos del ticket...', 'info');
      });

    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="card" style="padding: 40px; text-align: center; color: var(--text-muted);">
        <p style="font-size: 16px; margin-bottom: 15px;">Fallo al cargar el detalle del ticket ${ticketId}. Puede que no exista o haya un problema con el servidor.</p>
        <a href="#tickets" class="btn btn-secondary">Regresar a tickets</a>
      </div>`;
    }
  }

  // Carga inicial
  await loadTicketData();
}
