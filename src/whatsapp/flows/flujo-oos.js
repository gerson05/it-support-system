import { setStep, getCtx } from '../chatbot-session.js';
import { nextBusinessDay }  from '../chatbot-utils.js';
import { appEvents }        from '../../events/broadcaster.js';
import { generateTicketTitle } from '../gemini-service.js';

const OOS_STEPS = new Set(['oos_name', 'oos_desc']);

export async function handleOOS(step, { text, session, phone, db }) {
  if (!OOS_STEPS.has(step)) return null;

  if (step === 'oos_name') {
    const ctx = getCtx(session);
    ctx.name = text.trim();
    setStep(db, phone, 'oos_desc', null, JSON.stringify(ctx));
    return (
      `✅ Gracias, *${ctx.name}*.\n\n` +
      `📝 Descríbeme brevemente el problema o lo que necesitas.\n` +
      `_(Lo atenderemos el *${nextBusinessDay()}* a partir de las 7:00 AM)_`
    );
  }

  // oos_desc — crea ticket y cierra
  const ctx      = getCtx(session);
  const title    = await generateTicketTitle('general', text);
  const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last     = db.prepare(`SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`TK-${dateStr}-%`);
  const nextNum  = last ? parseInt(last.ticket_number.split('-')[2]) + 1 : 1;
  const ticketNumber = `TK-${dateStr}-${String(nextNum).padStart(3, '0')}`;

  db.prepare(`
    INSERT INTO tickets (ticket_number, phone, requester_name, area, description, title, status, priority)
    VALUES (?, ?, ?, 'general', ?, ?, 'siguiente_dia', 'media')
  `).run(ticketNumber, phone, ctx.name || 'Sin nombre', text, title);

  const { id: ticketId } = db.prepare('SELECT last_insert_rowid() as id').get();
  db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`).run(ticketId, text);
  appEvents.emit('ticket:created', { id: ticketId, ticket_number: ticketNumber, area: 'general', phone });

  setStep(db, phone, 'idle', null, '{}');
  return (
    `✅ *Caso agendado para el ${nextBusinessDay()}*\n\n` +
    `🎟️ Número de caso: *${ticketNumber}*\n` +
    `👤 Nombre: ${ctx.name}\n\n` +
    `Nuestro equipo lo atenderá a primera hora. ¡Gracias por tu paciencia! 🙏`
  );
}
