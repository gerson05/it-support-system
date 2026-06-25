import { setStep, getCtx, crearTicket } from '../chatbot-session.js';
import { detectPriority }               from '../chatbot-utils.js';
import { AREA_MAP_FULL, AREA_MAP_SIMPLE, AREA_NAMES, AREA_EXAMPLES } from '../chatbot-config.js';
import { getAISolution, getAISolutionFromImage } from '../gemini-service.js';
import { searchFaqsAll }  from '../../knowledge/faq-service.js';
import { appEvents }      from '../../events/broadcaster.js';

const SOPORTE_STEPS = new Set([
  'menu_area', 'menu_area_simple', 'ask_ticket_name',
  'awaiting_description', 'ask_resolved', 'confirm_dup_ticket', 'create_ticket',
]);

export async function handleSoporte(step, { text, cleanText, session, phone, db, chatId, media }) {
  if (!SOPORTE_STEPS.has(step)) return null;

  const ctx  = getCtx(session);
  const area = ctx.area || session.area || 'general';

  /* ── Menú de área completo ── */
  if (step === 'menu_area') {
    const a = AREA_MAP_FULL[cleanText];
    if (!a) return `⚠️ Opción no válida. Selecciona tu área (1–7):\n\n*1* Cartera\n*2* Compra\n*3* Gestión Humana\n*4* PQRS\n*5* Contabilidad\n*6* Farmacia\n*7* Cuentas Médicas`;
    setStep(db, phone, 'ask_ticket_name', a, '{}');
    return `👍 Área: *${AREA_NAMES[a]}*\n\n👤 *¿Cuál es tu nombre completo?*`;
  }

  /* ── Menú de área simplificado ── */
  if (step === 'menu_area_simple') {
    const a = AREA_MAP_SIMPLE[cleanText];
    if (!a) return `⚠️ Opción no válida. Responde con:\n\n*1* — Administrativo\n*2* — Farmacia`;
    setStep(db, phone, 'ask_ticket_name', a, '{}');
    return `👍 Área: *${AREA_NAMES[a]}*\n\n*¿Cuál es tu nombre completo?*`;
  }

  /* ── Nombre del solicitante ── */
  if (step === 'ask_ticket_name') {
    ctx.requester_name = text.trim();
    setStep(db, phone, 'awaiting_description', area, JSON.stringify(ctx));
    const ejemplos = AREA_EXAMPLES[area] || '';
    return (
      `✅ Gracias, *${ctx.requester_name}*.\n\n` +
      `📝 *¿Qué problema tienes hoy?*\n\n` +
      (ejemplos ? `Casos frecuentes en tu área:\n${ejemplos}\n\n` : '') +
      `Descríbeme el problema con el mayor detalle posible _(programa, mensaje de error, qué hacías)_.\n\n` +
      `📸 También puedes enviar una *captura de pantalla* del error.`
    );
  }

  /* ── Descripción / imagen → IA / FAQ ── */
  if (step === 'awaiting_description') {
    let aiSolution = null;
    let msgHeader  = '';
    let faqId      = null;
    let description = text;

    if (text === '__IMAGE__' && media?.imageBase64) {
      aiSolution  = await getAISolutionFromImage(area, media.imageBase64, media.mimetype, media.caption || '');
      msgHeader   = aiSolution ? `🔍 *Análisis de tu captura (${AREA_NAMES[area] || area}):*\n\n` : '';
      description = media.caption ? `(captura de pantalla: ${media.caption})` : '(captura de pantalla)';
      ctx._imageBase64   = media.imageBase64;
      ctx._imageMimetype = media.mimetype || 'image/jpeg';
    } else {
      if (!ctx.faq_tried) {
        const results = searchFaqsAll(db, area, text);
        const topFaq  = results[0];
        if (topFaq && topFaq.score >= 5) {
          aiSolution = topFaq.solution;
          msgHeader  = `📋 *${topFaq.title}*\n\n`;
          faqId      = topFaq.id;
          try { db.prepare(`INSERT INTO faq_hits (faq_id, area, resolved, phone) VALUES (?,?,0,?)`).run(String(faqId), area, phone); } catch {}
        }
      }
      if (!aiSolution) {
        aiSolution = await getAISolution(area, text);
        msgHeader  = aiSolution ? `💡 *Pasos sugeridos para ${AREA_NAMES[area] || area}:*\n\n` : '';
      }
    }

    if (aiSolution) {
      const nextCtx = { description, area, faq_shown_id: faqId };
      if (ctx._imageBase64) { nextCtx._imageBase64 = ctx._imageBase64; nextCtx._imageMimetype = ctx._imageMimetype; }
      setStep(db, phone, 'ask_resolved', area, JSON.stringify(nextCtx));
      return (
        msgHeader + aiSolution + `\n\n━━━━━━━━━━━━━━━\n` +
        `*¿Pudiste resolver el problema?*\n\n` +
        `*1️⃣* ✅ Sí, se solucionó\n*2️⃣* ❌ No, el problema continúa\n*3️⃣* 🔄 Mi problema es diferente`
      );
    }
    const nextCtx = { description, area };
    if (ctx._imageBase64) { nextCtx._imageBase64 = ctx._imageBase64; nextCtx._imageMimetype = ctx._imageMimetype; }
    setStep(db, phone, 'create_ticket', area, JSON.stringify(nextCtx));
    return `No encontré solución automática para este caso. 🤔\n\nVoy a crear un *ticket de soporte* directamente.\n¿Tienes algún detalle adicional que agregar?\n\n_(O responde *no* para crear el ticket ahora)_`;
  }

  /* ── ¿Se resolvió? ── */
  if (step === 'ask_resolved') {
    if (cleanText === '1' || /^s[íi]\b/i.test(cleanText)) {
      if (ctx.faq_shown_id) {
        try {
          db.prepare(`UPDATE faq_hits SET resolved=1 WHERE id=(SELECT id FROM faq_hits WHERE phone=? AND faq_id=? AND resolved=0 ORDER BY id DESC LIMIT 1)`)
            .run(phone, String(ctx.faq_shown_id));
        } catch {}
      }
      setStep(db, phone, 'idle', null, '{}');
      return `🎉 *¡Genial, problema resuelto!*\n\nMe alegra haber podido ayudarte. Si tienes otra consulta, solo escribe *Hola*. ¡Buen día! 😊`;
    }

    if (cleanText === '2' || /^no\b/i.test(cleanText)) {
      const existing = db.prepare(`SELECT ticket_number FROM tickets WHERE phone=? AND status IN ('abierto','en_progreso','en_espera') ORDER BY id DESC LIMIT 1`).get(phone);
      if (existing) {
        setStep(db, phone, 'confirm_dup_ticket', area, JSON.stringify(ctx));
        return (
          `⚠️ Ya tienes el ticket *${existing.ticket_number}* activo en el sistema.\n\n` +
          `¿Tu problema actual es *diferente* al de ese ticket?\n\n` +
          `*1️⃣* Sí, es un problema diferente — crear nuevo ticket\n` +
          `*2️⃣* No, es el mismo — agregar este mensaje al ticket existente`
        );
      }
      const priority = detectPriority(ctx.description);
      const imageCtx = ctx._imageBase64 ? { base64: ctx._imageBase64, mimetype: ctx._imageMimetype } : null;
      const ticketId = await crearTicket(db, phone, area, ctx.description || '(sin descripción)', { priority, requesterName: ctx.requester_name, imageCtx, chatId });
      setStep(db, phone, 'idle', null, '{}');
      const { ticket_number } = db.prepare('SELECT ticket_number FROM tickets WHERE id=?').get(ticketId);
      return (
        `😔 Entendido. El equipo de IT tomará el caso directamente.\n\n` +
        `🎟️ *Ticket creado: ${ticket_number}*\n📍 Área: ${AREA_NAMES[area] || area}\n` +
        (priority !== 'media' ? `⚡ Prioridad detectada: *${priority.toUpperCase()}*\n` : '') +
        `\nUn técnico se comunicará contigo a la brevedad. ¡Gracias por tu paciencia!`
      );
    }

    if (cleanText === '3' || /diferente|otro|distint/i.test(cleanText)) {
      setStep(db, phone, 'awaiting_description', area, JSON.stringify({ faq_tried: true }));
      return `Entendido. 🔄\n\n📝 *Descríbeme tu problema con más detalle:*\n\nIncluye el programa o equipo, el mensaje de error exacto y qué acción realizabas.\n\n📸 También puedes enviar una *captura de pantalla* del error.`;
    }

    return `⚠️ Por favor responde con un número:\n\n*1* — Sí, se solucionó ✅\n*2* — No, el problema continúa ❌\n*3* — Mi problema es diferente 🔄`;
  }

  /* ── Ticket duplicado ── */
  if (step === 'confirm_dup_ticket') {
    if (cleanText === '1') {
      const priority = detectPriority(ctx.description);
      const imageCtx = ctx._imageBase64 ? { base64: ctx._imageBase64, mimetype: ctx._imageMimetype } : null;
      const ticketId = await crearTicket(db, phone, area, ctx.description || '(sin descripción)', { priority, requesterName: ctx.requester_name, imageCtx, chatId });
      setStep(db, phone, 'idle', null, '{}');
      const { ticket_number } = db.prepare('SELECT ticket_number FROM tickets WHERE id=?').get(ticketId);
      return `✅ Nuevo ticket creado: *${ticket_number}*\n📍 Área: ${AREA_NAMES[area] || area}\n\nUn técnico se comunicará contigo a la brevedad.`;
    }
    if (cleanText === '2') {
      const existing = db.prepare(`SELECT * FROM tickets WHERE phone=? AND status IN ('abierto','en_progreso','en_espera') ORDER BY id DESC LIMIT 1`).get(phone);
      if (existing) {
        db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`).run(existing.id, ctx.description || '(sin descripción)');
        db.prepare(`UPDATE tickets SET updated_at=datetime('now','localtime') WHERE id=?`).run(existing.id);
        appEvents.emit('ticket:message', { ticketId: existing.id });
      }
      setStep(db, phone, 'idle', null, '{}');
      return `📥 Mensaje agregado al ticket *${existing?.ticket_number || 'existente'}*.\n\nEl equipo de IT revisará la información adicional. ¡Gracias!`;
    }
    return `⚠️ Responde *1* para crear un nuevo ticket o *2* para agregar al ticket existente.`;
  }

  /* ── Ticket directo (sin IA) ── */
  const detail   = /^no$/i.test(cleanText) ? (ctx.description || text) : text;
  const priority = detectPriority(detail);
  const imageCtx = ctx._imageBase64 ? { base64: ctx._imageBase64, mimetype: ctx._imageMimetype } : null;
  const ticketId = await crearTicket(db, phone, area, detail, { priority, requesterName: ctx.requester_name, imageCtx, chatId });
  setStep(db, phone, 'idle', null, '{}');
  const { ticket_number } = db.prepare('SELECT ticket_number FROM tickets WHERE id=?').get(ticketId);
  return `🎟️ *¡Ticket creado exitosamente!*\nNúmero de caso: *${ticket_number}*\n\nEl equipo de IT fue notificado. ¡Gracias por tu paciencia!`;
}
