import { setStep, getCtx, crearTicket } from '../chatbot-session.js';
import { detectPriority }               from '../chatbot-utils.js';
import { createTechRequest }            from '../../tech-requests/tech-request-model.js';
import { appEvents }                    from '../../events/broadcaster.js';

const REQ_STEPS = new Set(['req_name', 'req_cedula', 'req_cargo', 'req_desc']);

export async function handleRequerimiento(step, { text, session, phone, db }) {
  if (!REQ_STEPS.has(step)) return null;

  const ctx = getCtx(session);

  if (step === 'req_name') {
    ctx.name = text;
    setStep(db, phone, 'req_cedula', null, JSON.stringify(ctx));
    return `✅ Nombre: *${text}*\n\n*¿Cuál es tu número de cédula?*`;
  }

  if (step === 'req_cedula') {
    ctx.cedula = text;
    setStep(db, phone, 'req_cargo', null, JSON.stringify(ctx));
    return `✅ Cédula: *${text}*\n\n*¿Cuál es tu cargo dentro de la empresa?*`;
  }

  if (step === 'req_cargo') {
    ctx.cargo = text;
    setStep(db, phone, 'req_desc', null, JSON.stringify(ctx));
    return (
      `✅ Cargo: *${text}*\n\n` +
      `📝 *¿Qué equipos o materiales necesitas?*\n\n` +
      `Incluye la cantidad y una descripción clara\n` +
      `(ej: _"2 mouses inalámbricos"_ o _"1 monitor 24 pulgadas"_).`
    );
  }

  // req_desc — crear requerimiento tecnológico
  const qtyMatch  = text.match(/^\s*(\d+)\s+/);
  ctx.description = text;
  ctx.quantity    = qtyMatch ? parseInt(qtyMatch[1]) : 1;

  const result = createTechRequest(db, {
    type:           'requerimiento',
    requester_name: ctx.name,
    cedula:         ctx.cedula,
    cargo:          ctx.cargo,
    sede:           ctx.sede,
    description:    text,
    quantity:       ctx.quantity,
    priority:       detectPriority(text),
  });

  appEvents.emit('tech-request:created', { id: result.id, request_number: result.request_number, type: 'requerimiento' });
  setStep(db, phone, 'idle', null, '{}');

  return (
    `✅ *¡Requerimiento registrado exitosamente!*\n\n` +
    `📋 *N.º de solicitud:* ${result.request_number}\n\n` +
    `• 👤 *Nombre:* ${ctx.name}\n` +
    `• 🪪 *Cédula:* ${ctx.cedula}\n` +
    `• 💼 *Cargo:* ${ctx.cargo}\n` +
    `• 📍 *Sede:* ${ctx.sede}\n` +
    `• 📦 *Descripción:* ${text}\n\n` +
    `El equipo de IT revisará tu solicitud y te informará. ¡Gracias!`
  );
}
