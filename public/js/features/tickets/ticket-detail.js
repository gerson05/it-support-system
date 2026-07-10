import {
  formatDate,
  getPriorityBadge,
  getStatusBadge,
  getAreaEmoji,
  getAreaName,
  state
} from '../../core/app.js';
import { showToast, createLoadingSpinner } from '../../ui/components.js';
import { iconChevronLeft, iconAlert, iconSend } from '../../utils/icons.js';
import DataService from '../../core/api.js';
import { openFaqFromTicket } from '../herramientas/faqs.js';
import { initAiTab } from './ticket-ai-panel.js';


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
            ${iconChevronLeft(15)} Volver al Listado
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
            <!-- Tabs -->
            <div style="display:flex;gap:0;border-bottom:1px solid var(--border,#334155);margin-bottom:16px;">
              <button id="tab-btn-conv" onclick="window.switchTab('conv')" style="
                padding:8px 16px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;
                color:var(--primary,#60a5fa);border-bottom:2px solid var(--primary,#3b82f6);">
                💬 Conversación
              </button>
              <button id="tab-btn-ai" onclick="window.switchTab('ai')" style="
                padding:8px 16px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;
                color:var(--text-muted,#94a3b8);border-bottom:2px solid transparent;">
                🤖 Asistente AI
              </button>
            </div>

            <!-- Panel Conversación -->
            <div id="tab-panel-conv">
              <div class="section-title" style="margin-bottom:14px;">Conversación de WhatsApp</div>

              <div class="timeline-messages" id="timeline-messages-container">
                <!-- Mensajes se inyectan aquí -->
              </div>

              <!-- Responder texto -->
              <div id="wa-status-banner" style="display:none;font-size:11px;padding:6px 10px;border-radius:6px;margin-bottom:8px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);color:#fbbf24;">
                ${iconAlert(13)} WhatsApp no está conectado — los mensajes se guardarán pero <strong>no llegarán al empleado</strong>.
              </div>
              <form id="reply-form" class="reply-form">
                <textarea id="reply-input" placeholder="Escribe tu respuesta para el empleado (se enviará a su WhatsApp)..." required autocomplete="off"></textarea>
                <div style="display:flex;flex-direction:column;gap:6px;">
                  <button type="submit" class="btn btn-primary" style="height:42px;display:flex;align-items:center;gap:7px;justify-content:center;">Enviar ${iconSend(14)}</button>
                  <label class="btn btn-secondary" style="height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;" title="Enviar imagen por WhatsApp">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Enviar imagen
                    <input type="file" id="image-input" accept="image/*" style="display:none;">
                  </label>
                </div>
              </form>
              <!-- Preview imagen seleccionada -->
              <div id="image-preview-container" style="display:none;margin-top:8px;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);gap:10px;align-items:flex-start;">
                <img id="image-preview" style="max-width:120px;max-height:120px;border-radius:6px;object-fit:cover;flex-shrink:0;">
                <div style="flex:1;min-width:0;">
                  <input type="text" id="image-caption" placeholder="Añade un texto a la imagen (opcional)…"
                    style="width:100%;margin-bottom:8px;font-size:12px;box-sizing:border-box;">
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-primary btn-small" id="btn-send-image">Enviar imagen</button>
                    <button class="btn btn-secondary btn-small" id="btn-cancel-image">Cancelar</button>
                  </div>
                </div>
              </div>
            </div><!-- /tab-panel-conv -->

            <!-- Panel AI -->
            <div id="tab-panel-ai" style="display:none;">
              <div id="ai-tab-content">
                <!-- se llena por initAiTab() -->
              </div>
            </div>
          </div><!-- /card.timeline-card -->

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
                    <option value="siguiente_dia" ${ticket.status === 'siguiente_dia' ? 'selected' : ''}>Siguiente día</option>
                    <option value="abierto"       ${ticket.status === 'abierto'       ? 'selected' : ''}>Abierto</option>
                    <option value="en_progreso"   ${ticket.status === 'en_progreso'   ? 'selected' : ''}>En Progreso</option>
                    <option value="en_espera"     ${ticket.status === 'en_espera'     ? 'selected' : ''}>En Espera</option>
                    <option value="resuelto"      ${ticket.status === 'resuelto'      ? 'selected' : ''}>Resuelto</option>
                    <option value="cerrado"       ${ticket.status === 'cerrado'       ? 'selected' : ''}>Cerrado</option>
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
            if (msg.sender_type === 'user')      senderName = ticket.requester_name || 'Empleado';
            else if (msg.sender_type === 'bot')  senderName = 'Bot IT';
            else                                  senderName = msg.sender_name || 'Agente IT';

            // Detectar si el mensaje tiene adjunto de imagen
            let attachment = null;
            try { if (msg.attachment) attachment = JSON.parse(msg.attachment); } catch {}

            // Detectar si el usuario envió una imagen (content = '__IMAGE__' o attachment)
            const isIncomingImage = msg.content === '__IMAGE__' || (attachment?.type === 'image' && msg.sender_type === 'user');
            const isOutgoingImage = attachment?.type === 'image' && msg.sender_type === 'agent';

            let bodyHtml = '';
            if (isIncomingImage) {
              if (attachment?.base64) {
                const src = `data:${attachment.mimetype || 'image/jpeg'};base64,${attachment.base64}`;
                bodyHtml = `<img src="${src}" alt="Imagen del empleado" style="max-width:220px;max-height:220px;border-radius:6px;object-fit:contain;display:block;cursor:pointer;" onclick="window.open(this.src)">`;
              } else {
                bodyHtml = `<div style="font-size:12px;color:var(--text-3);font-style:italic;">📎 Imagen recibida del empleado</div>`;
              }
            } else if (isOutgoingImage) {
              bodyHtml = `<div style="font-size:12px;color:var(--text-3);font-style:italic;">📤 Imagen enviada al empleado${attachment.caption ? ': ' + attachment.caption : ''}</div>`;
            } else {
              bodyHtml = `<div style="word-break:break-word;white-space:pre-wrap;">${msg.content}</div>`;
            }

            return `
              <div class="message-bubble ${msg.sender_type}">
                <div style="font-weight:600;font-size:11px;margin-bottom:5px;opacity:.75;text-transform:uppercase;letter-spacing:.3px;">${senderName}</div>
                ${bodyHtml}
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
        const agents = await DataService.getAgents().catch(() => []);
        assignSelect.innerHTML = '<option value="">Sin Asignar</option>' +
          agents.map(a =>
            `<option value="${a.id}" ${ticket.assigned_to === a.id ? 'selected' : ''}>${a.name}</option>`
          ).join('');
      }

      // Banner de estado WhatsApp — actualiza al cargar y via SSE
      function updateWaBanner(connected) {
        const banner = document.getElementById('wa-status-banner');
        if (banner) banner.style.display = connected ? 'none' : 'block';
      }
      fetch('/api/whatsapp/status').then(r => r.json()).then(s => updateWaBanner(s.connected)).catch(() => {});
      // Polling cada 8 s para mantener el banner actualizado aunque no haya SSE
      const _waPoll = setInterval(() => {
        fetch('/api/whatsapp/status').then(r => r.json()).then(s => updateWaBanner(s.connected)).catch(() => {});
      }, 8000);
      // Limpiar el interval cuando el usuario navegue a otra página
      window.addEventListener('hashchange', () => clearInterval(_waPoll), { once: true });

      // === EVENTO: ENVIAR MENSAJE AL USUARIO ===
      const replyForm = document.getElementById('reply-form');
      replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('reply-input');
        const content = input.value;
        
        try {
          const result = await DataService.addMessage(ticketId, 'agent', state.currentUser?.username || 'IT', content);
          input.value = '';
          if (result?.whatsapp?.simulation) {
            showToast('Mensaje guardado, pero WhatsApp no está conectado — no se envió al empleado.', 'warning');
          } else if (result?.whatsapp?.success === false) {
            showToast('Mensaje guardado, pero falló el envío a WhatsApp: ' + (result.whatsapp.error || 'error desconocido'), 'warning');
          } else {
            showToast('Respuesta enviada al WhatsApp del empleado.', 'success');
          }

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
          await DataService.addInternalNote(ticketId, state.currentUser?.id, state.currentUser?.username || 'IT', content);
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

      // === EVENTO: SELECCIONAR IMAGEN ===
      const imageInput = document.getElementById('image-input');
      const previewContainer = document.getElementById('image-preview-container');
      let selectedImageBase64 = null;
      let selectedMimetype = 'image/jpeg';

      imageInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        selectedMimetype = file.type || 'image/jpeg';
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          // Extraer solo el base64 (sin el prefijo data:...;base64,)
          selectedImageBase64 = dataUrl.split(',')[1];
          document.getElementById('image-preview').src = dataUrl;
          previewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      });

      document.getElementById('btn-cancel-image')?.addEventListener('click', () => {
        selectedImageBase64 = null;
        previewContainer.style.display = 'none';
        if (imageInput) imageInput.value = '';
      });

      document.getElementById('btn-send-image')?.addEventListener('click', async () => {
        if (!selectedImageBase64) return;
        const caption = document.getElementById('image-caption')?.value.trim() || '';
        const btn = document.getElementById('btn-send-image');
        btn.textContent = 'Enviando…';
        btn.disabled = true;

        try {
          const res = await fetch(`/api/tickets/${ticketId}/send-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: selectedImageBase64,
              mimetype: selectedMimetype,
              caption,
              agentName: state.currentUser?.username || 'IT',
            }),
          });
          if (!res.ok) {
            let errMsg = 'Error al enviar la imagen.';
            try { errMsg = (await res.json()).error || errMsg; } catch {}
            throw new Error(errMsg);
          }
          showToast('Imagen enviada al WhatsApp del empleado.', 'success');
          selectedImageBase64 = null;
          previewContainer.style.display = 'none';
          if (imageInput) imageInput.value = '';
          await loadTicketData();
        } catch (err) {
          showToast(err.message || 'Error al enviar la imagen.', 'error');
          btn.textContent = 'Enviar imagen';
          btn.disabled = false;
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

      // Exponer switchTab en window para los onclick del HTML
      let _aiTabInitialized = false;
      window.switchTab = function(tab) {
        const conv = document.getElementById('tab-panel-conv');
        const ai   = document.getElementById('tab-panel-ai');
        const btnConv = document.getElementById('tab-btn-conv');
        const btnAi   = document.getElementById('tab-btn-ai');
        if (!conv || !ai) return;

        if (tab === 'conv') {
          conv.style.display = '';
          ai.style.display   = 'none';
          btnConv.style.color = 'var(--primary,#60a5fa)';
          btnConv.style.borderBottomColor = 'var(--primary,#3b82f6)';
          btnAi.style.color = 'var(--text-muted,#94a3b8)';
          btnAi.style.borderBottomColor = 'transparent';
        } else {
          conv.style.display = 'none';
          ai.style.display   = '';
          btnAi.style.color = 'var(--primary,#60a5fa)';
          btnAi.style.borderBottomColor = 'var(--primary,#3b82f6)';
          btnConv.style.color = 'var(--text-muted,#94a3b8)';
          btnConv.style.borderBottomColor = 'transparent';
          if (!_aiTabInitialized) {
            _aiTabInitialized = true;
            initAiTab(ticket);
          }
        }
      };

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
