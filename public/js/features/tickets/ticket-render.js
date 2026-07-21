import { formatDate, getPriorityBadge, getStatusBadge, getAreaEmoji, getAreaName } from '../../core/app.js';
import { iconChevronLeft, iconAlert, iconSend, iconMessage, iconSparkle } from '../../utils/icons.js';

export function renderLayout(ticket) {
  const emoji = getAreaEmoji(ticket.area);
  const areaName = getAreaName(ticket.area);

  let faqsTriedHtml = '<span class="text-muted">Ninguna FAQ consultada</span>';
  try {
    const faqsTried = JSON.parse(ticket.faq_tried || '[]');
    if (faqsTried.length > 0) {
      faqsTriedHtml = faqsTried.map(id => `<code>${id}</code>`).join(', ');
    }
  } catch (e) {
    console.error(e);
  }

  return `
    <div style="margin-bottom: 25px;">
      <a href="#tickets" style="text-decoration: none; color: var(--primary); font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
        ${iconChevronLeft(15)} Volver al Listado
      </a>
    </div>

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

    <div class="ticket-detail-grid">
      <div class="card timeline-card">
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border,#334155);margin-bottom:16px;">
          <button id="tab-btn-conv" onclick="window.switchTab('conv')" style="
            padding:8px 16px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;
            color:var(--primary,#60a5fa);border-bottom:2px solid var(--primary,#3b82f6);">
            ${iconMessage(14)} Conversación
          </button>
          <button id="tab-btn-ai" onclick="window.switchTab('ai')" style="
            padding:8px 16px;font-size:13px;font-weight:600;border:none;background:transparent;cursor:pointer;
            color:var(--text-muted,#94a3b8);border-bottom:2px solid transparent;">
            ${iconSparkle(14)} Asistente AI
          </button>
        </div>

        <div id="tab-panel-conv">
          <div class="section-title" style="margin-bottom:14px;">Conversación de WhatsApp</div>
          <div class="timeline-messages" id="timeline-messages-container"></div>

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
        </div>

        <div id="tab-panel-ai" style="display:none;">
          <div id="ai-tab-content"></div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 30px;">
        <div class="card">
          <div class="section-title">Detalles del Caso</div>
          <div class="info-details-list" style="margin-top: 20px;">
            <div class="info-details-item" style="align-items:flex-start;">
              <span class="info-details-label">Solicitante:</span>
              <div style="display:flex;flex-direction:column;gap:6px;flex:1;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="info-details-val" id="requester-display">${ticket.requester_name || 'Sin registrar'}</span>
                  <button id="btn-edit-requester" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:2px 4px;border-radius:4px;font-size:11px;line-height:1;" title="Editar solicitante">✏️</button>
                  <button id="btn-ver-perfil" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:2px 4px;border-radius:4px;font-size:11px;line-height:1;" title="Ver perfil del empleado">👤</button>
                </div>
                <div id="requester-edit-form" style="display:none;flex-direction:column;gap:6px;">
                  <input type="text" id="requester-name-input" placeholder="Nombre del solicitante" style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;width:100%;box-sizing:border-box;" autocomplete="off">
                  <input type="text" id="requester-cedula-input" placeholder="Cédula (auto)" readonly style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:12px;width:100%;box-sizing:border-box;">
                  <div style="display:flex;gap:6px;">
                    <button id="btn-save-requester" class="btn btn-primary" style="padding:5px 12px;font-size:12px;">Guardar</button>
                    <button id="btn-cancel-requester" class="btn btn-secondary" style="padding:5px 12px;font-size:12px;">Cancelar</button>
                  </div>
                </div>
              </div>
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
                <option value="baja"    ${ticket.priority === 'baja'    ? 'selected' : ''}>Baja</option>
                <option value="media"   ${ticket.priority === 'media'   ? 'selected' : ''}>Media</option>
                <option value="alta"    ${ticket.priority === 'alta'    ? 'selected' : ''}>Alta</option>
                <option value="critica" ${ticket.priority === 'critica' ? 'selected' : ''}>Crítica</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Técnico Asignado</label>
              <input type="text" id="assign-tecnico-name" placeholder="Buscar empleado…" autocomplete="off"
                style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;width:100%;box-sizing:border-box;">
              <input type="text" id="assign-tecnico-cedula" readonly placeholder="Cédula (auto)"
                style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:12px;width:100%;box-sizing:border-box;margin-top:4px;">
              <button id="btn-assign-tecnico" class="btn btn-secondary" disabled
                style="width:100%;margin-top:6px;padding:7px;">Asignar técnico</button>
            </div>
            <button class="btn btn-primary" id="btn-save-actions" style="margin-top: 5px;">Guardar Cambios</button>
            <button class="btn btn-secondary" id="btn-add-to-faq" title="Convertir este caso en una FAQ reutilizable">Agregar a Base de Conocimiento</button>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Notas Internas</div>
          <div class="internal-notes-section">
            <div class="notes-list" id="notes-list-container"></div>
            <form id="note-form" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
              <textarea id="note-input" placeholder="Escribe una anotación privada (no visible para el empleado)..." style="min-height: 60px; font-size: 13px;" required></textarea>
              <button type="submit" class="btn btn-secondary" style="padding: 10px; font-size: 13px;">Añadir Nota 📌</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderMessages(messages, requesterName) {
  if (!messages || messages.length === 0) {
    return '<div class="text-muted" style="text-align: center; padding: 40px 0;">No hay historial de mensajes.</div>';
  }

  return messages.map(msg => {
    let senderName = '';
    if (msg.sender_type === 'user')     senderName = requesterName || 'Empleado';
    else if (msg.sender_type === 'bot') senderName = 'Bot IT';
    else                                senderName = msg.sender_name || 'Agente IT';

    let attachment = null;
    try { if (msg.attachment) attachment = JSON.parse(msg.attachment); } catch {}

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
}

export function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    return '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 20px 0;">No hay anotaciones registradas.</div>';
  }

  return notes.map(note => `
    <div class="note-item">
      <div style="word-break: break-word;">${note.content}</div>
      <div class="note-meta">
        <span>📌 por ${note.agent_name || 'Agente'}</span>
        <span>${formatDate(note.created_at)}</span>
      </div>
    </div>
  `).join('');
}
