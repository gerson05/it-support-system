import { appEvents }                   from '../events/broadcaster.js';
import { setStep, getCtx }             from './chatbot-session.js';
import { checkRateLimit, getBusinessStatus, nextBusinessDay } from './chatbot-utils.js';
import { AREA_NAMES, STATUS_LABELS_WA } from './chatbot-config.js';
import { handleOOS }                   from './flows/flujo-oos.js';
import { handleSede }                  from './flows/flujo-sede.js';
import { handleSoporte }               from './flows/flujo-soporte.js';
import { handleRequerimiento }         from './flows/flujo-requerimiento.js';
import { handleIncidencia }            from './flows/flujo-incidencia.js';

export class Chatbot {

  async processMessage(phone, text, db, media = null, chatId = null) {
    if (!checkRateLimit(phone)) {
      console.warn(`[Bot] Rate limit alcanzado para ${phone}`);
      return null;
    }

    /* ── Imagen enviada fuera de flujo ── */
    if (text === '__IMAGE__') {
      const sess = db.prepare('SELECT current_step FROM conversations WHERE phone=?').get(phone);
      if (!sess || sess.current_step !== 'awaiting_description') {
        return `📸 _Imagen recibida._ Para que analicemos el error de tu captura, escribe *Hola*, selecciona *Soporte técnico* y cuando llegues a describir el problema envía la imagen. 📲`;
      }
    }

    const cleanText = text.trim();
    const lower     = cleanText.toLowerCase();
    const isCommand = ['hola', 'menu', 'inicio', 'reiniciar'].includes(lower);

    /* ── Obtener / crear sesión ── */
    let session = db.prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
    if (!session) {
      db.prepare('INSERT INTO conversations (phone, current_step) VALUES (?,?)').run(phone, 'idle');
      session = { phone, current_step: 'idle', area: null, context: '{}' };
    }

    /* ── Persistir chatId en contexto ── */
    if (chatId && chatId !== phone) {
      try {
        const ctxObj = JSON.parse(session.context || '{}');
        if (!ctxObj._chatId) {
          ctxObj._chatId = chatId;
          db.prepare('UPDATE conversations SET context=? WHERE phone=?').run(JSON.stringify(ctxObj), phone);
          session = { ...session, context: JSON.stringify(ctxObj) };
        }
      } catch {}
    }

    let step     = session.current_step;
    let response = '';
    const inBotFlow = step !== 'idle';

    /* ── Comando rápido: consultar estado de tickets ── */
    if (!isCommand && !inBotFlow && /^(estado|mis tickets?|consultar|ver ticket|mi caso)/i.test(lower)) {
      const tickets = db.prepare(`SELECT ticket_number, status, area, created_at FROM tickets WHERE phone=? ORDER BY id DESC LIMIT 3`).all(phone);
      if (!tickets.length) return `📭 No tienes tickets registrados aún.\n\nEscribe *Hola* para iniciar una nueva consulta de soporte.`;
      const lines = tickets.map(t =>
        `🎟️ *${t.ticket_number}*\n   ${STATUS_LABELS_WA[t.status] || t.status}\n   ${AREA_NAMES[t.area] || t.area} · ${new Date(t.created_at).toLocaleDateString('es-CO')}`
      ).join('\n\n');
      return `📋 *Tus últimos tickets:*\n\n${lines}\n\n_Para agregar información escríbenos directamente. Escribe *Hola* para una nueva consulta._`;
    }

    /* ── Ticket activo: agregar mensaje sin entrar al flujo ── */
    if (!isCommand && !inBotFlow) {
      const activeTicket = db.prepare(`SELECT * FROM tickets WHERE phone=? AND status IN ('abierto','en_progreso','en_espera') ORDER BY id DESC LIMIT 1`).get(phone);
      if (activeTicket) {
        if (text === '__IMAGE__' && media?.imageBase64) {
          const attachment = JSON.stringify({ type: 'image', mimetype: media.mimetype || 'image/jpeg', base64: media.imageBase64 });
          db.prepare(`INSERT INTO messages (ticket_id, sender_type, content, attachment) VALUES (?, 'user', '__IMAGE__', ?)`).run(activeTicket.id, attachment);
        } else {
          db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`).run(activeTicket.id, text);
        }
        db.prepare(`UPDATE tickets SET updated_at=datetime('now','localtime') WHERE id=?`).run(activeTicket.id);
        appEvents.emit('ticket:message', { ticketId: activeTicket.id });
        return `📥 *Mensaje agregado al Ticket ${activeTicket.ticket_number}*\n\nTu mensaje fue registrado. El equipo de IT te responderá pronto.\n\n_Para nueva consulta escribe *menu*._`;
      }
    }

    try {
      /* ── Menú inicial ── */
      if (step === 'idle' || isCommand) {
        const bizStatus = getBusinessStatus();
        if (bizStatus !== 'open') {
          const isClosing = bizStatus === 'closing';
          setStep(db, phone, 'oos_name', null, '{}');
          response = isClosing
            ? `⚠️ *Estamos a punto de cerrar*\n\nNuestro horario de atención termina a las *4:40 PM*.\nTu caso quedará agendado para el *${nextBusinessDay()}* a las 7:00 AM.\n\n¿Cuál es tu nombre completo?`
            : `⏰ *Fuera de horario de atención*\n\nNuestro equipo de IT atiende de *lunes a viernes de 7:00 AM a 4:40 PM*.\n\nTu caso quedará registrado y será atendido el *${nextBusinessDay()}* a primera hora.\n\n¿Cuál es tu nombre completo?`;
        } else {
          setStep(db, phone, 'select_type', null, '{}');
          response =
            `🖥️ *¡Hola! Soy el asistente de IT* 🤖\n\n` +
            `¿En qué te puedo ayudar hoy?\n\n` +
            `*1️⃣* 🔧 Tengo un *problema técnico*\n` +
            `*2️⃣* 📋 Necesito *equipos o materiales* (requerimiento)\n` +
            `*3️⃣* ⚠️ Voy a *enviar un equipo con falla* (incidencia)\n\n` +
            `_Responde con el número de tu opción._\n\n` +
            `💡 Escribe *estado* en cualquier momento para consultar tus tickets.`;
        }
      } else {
        /* ── Dispatch por flujo ── */
        const flowArgs = { step, text, cleanText, lower, session, phone, db, chatId, media };
        response =
          (await handleOOS(step, flowArgs)) ??
          (await handleSede(step, flowArgs)) ??
          (await handleSoporte(step, flowArgs)) ??
          (await handleRequerimiento(step, flowArgs)) ??
          (await handleIncidencia(step, flowArgs)) ??
          (() => { setStep(db, phone, 'idle', null, '{}'); return `❓ No entendí eso. Escribe *Hola* para volver al menú principal.`; })();
      }

      /* ── Actualizar actividad ── */
      db.prepare(`UPDATE conversations SET last_activity=datetime('now','localtime'), warned_inactive=0 WHERE phone=?`).run(phone);

    } catch (err) {
      console.error('[Chatbot] Error:', err);
      setStep(db, phone, 'idle', null, '{}');
      response = `❌ Ocurrió un error técnico. Por favor escribe *Hola* para reiniciar.`;
    }

    return response;
  }
}

export default Chatbot;
