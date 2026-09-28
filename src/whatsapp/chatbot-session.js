import { generateTicketTitle } from './gemini-service.js';
import { appEvents }           from '../events/broadcaster.js';
import { logAudit }            from '../audit/audit-logger.js';
import { detectPriority }      from './chatbot-utils.js';

export async function setStep(db, phone, step, area = null, ctx = '{}') {
  await db.prepare(`UPDATE conversations SET current_step=?, area=?, context=? WHERE phone=?`)
    .run(step, area, ctx, phone);
}

export function getCtx(session) {
  try { return JSON.parse(session.context || '{}'); } catch { return {}; }
}

export async function crearTicket(db, phone, area, description, {
  priority = 'media', requesterName = 'Empleado WhatsApp', imageCtx = null, chatId = null,
  cedula = null, cargo = null, sede = null, ciudad = null,
  equipmentName = null, equipmentSerial = null, techRequestId = null,
} = {}) {
  const dateStr      = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like         = `TK-${dateStr}-%`;
  const last         = await db.prepare('SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const nextNum      = last ? parseInt(last.ticket_number.split('-')[2]) + 1 : 1;
  const ticketNumber = `TK-${dateStr}-${String(nextNum).padStart(3, '0')}`;

  const title = await generateTicketTitle(area, description);

  const { lastInsertRowid: ticketId } = await db.prepare(`
    INSERT INTO tickets (ticket_number, phone, chat_id, requester_name, area, description, title, status, priority,
                         cedula, cargo, sede, ciudad, equipment_name, equipment_serial, tech_request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ticketNumber, phone, chatId || phone, requesterName || 'Empleado WhatsApp', area, description, title, priority,
    cedula, cargo, sede, ciudad, equipmentName, equipmentSerial, techRequestId);

  if (imageCtx?.base64) {
    const attachment = JSON.stringify({ type: 'image', mimetype: imageCtx.mimetype || 'image/jpeg', base64: imageCtx.base64 });
    await db.prepare(`INSERT INTO messages (ticket_id, sender_type, content, attachment) VALUES (?, 'user', '__IMAGE__', ?)`)
      .run(ticketId, attachment);
  } else {
    await db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`)
      .run(ticketId, description);
  }

  logAudit('Bot WhatsApp', 'Ticket creado', 'ticket', ticketId, ticketNumber, { area, phone });
  appEvents.emit('ticket:created', { id: ticketId, ticket_number: ticketNumber, area, phone });
  return { id: ticketId, ticket_number: ticketNumber };
}

/**
 * Crea el ticket que acompaña a una solicitud técnica (incidencia / requerimiento),
 * para que sus datos aparezcan en la pantalla de Tickets. Si falla, la solicitud
 * ya quedó registrada: se loguea el error y se devuelve null.
 */
export async function crearTicketVinculado(db, phone, chatId, ctx, techRequest, description) {
  try {
    return await crearTicket(db, phone, 'general', `[${techRequest.request_number}] ${description}`, {
      priority:        detectPriority(description),
      requesterName:   ctx.name,
      chatId,
      cedula:          ctx.cedula           || null,
      cargo:           ctx.cargo            || null,
      sede:            ctx.sede             || null,
      ciudad:          ctx.ciudad           || null,
      equipmentName:   ctx.equipment_name   || null,
      equipmentSerial: ctx.equipment_serial || null,
      techRequestId:   techRequest.id,
    });
  } catch (err) {
    console.error(`[Chatbot] No se pudo crear ticket vinculado a ${techRequest.request_number}:`, err.message);
    return null;
  }
}
