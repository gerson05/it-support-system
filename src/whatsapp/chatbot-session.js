import { generateTicketTitle } from './gemini-service.js';
import { appEvents }           from '../events/broadcaster.js';
import { logAudit }            from '../audit/audit-logger.js';

export function setStep(db, phone, step, area = null, ctx = '{}') {
  db.prepare(`UPDATE conversations SET current_step=?, area=?, context=? WHERE phone=?`)
    .run(step, area, ctx, phone);
}

export function getCtx(session) {
  try { return JSON.parse(session.context || '{}'); } catch { return {}; }
}

export async function crearTicket(db, phone, area, description, {
  priority = 'media', requesterName = 'Empleado WhatsApp', imageCtx = null, chatId = null,
} = {}) {
  const dateStr      = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const like         = `TK-${dateStr}-%`;
  const last         = db.prepare('SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1').get(like);
  const nextNum      = last ? parseInt(last.ticket_number.split('-')[2]) + 1 : 1;
  const ticketNumber = `TK-${dateStr}-${String(nextNum).padStart(3, '0')}`;

  const title = await generateTicketTitle(area, description);

  db.prepare(`
    INSERT INTO tickets (ticket_number, phone, chat_id, requester_name, area, description, title, status, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?)
  `).run(ticketNumber, phone, chatId || phone, requesterName, area, description, title, priority);

  const { id: ticketId } = db.prepare('SELECT last_insert_rowid() as id').get();

  if (imageCtx?.base64) {
    const attachment = JSON.stringify({ type: 'image', mimetype: imageCtx.mimetype || 'image/jpeg', base64: imageCtx.base64 });
    db.prepare(`INSERT INTO messages (ticket_id, sender_type, content, attachment) VALUES (?, 'user', '__IMAGE__', ?)`)
      .run(ticketId, attachment);
  } else {
    db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`)
      .run(ticketId, description);
  }

  logAudit('Bot WhatsApp', 'Ticket creado', 'ticket', ticketId, ticketNumber, { area, phone });
  appEvents.emit('ticket:created', { id: ticketId, ticket_number: ticketNumber, area, phone });
  return ticketId;
}
