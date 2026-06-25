import { setStep, getCtx } from '../chatbot-session.js';
import { detectPriority }  from '../chatbot-utils.js';
import { createTechRequest } from '../../tech-requests/tech-request-model.js';
import { appEvents }         from '../../events/broadcaster.js';

const INC_STEPS = new Set(['inc_name', 'inc_cedula', 'inc_cargo', 'inc_equipo', 'inc_desc']);

export async function handleIncidencia(step, { text, session, phone, db }) {
  if (!INC_STEPS.has(step)) return null;

  const ctx = getCtx(session);

  if (step === 'inc_name') {
    ctx.name = text;
    setStep(db, phone, 'inc_cedula', null, JSON.stringify(ctx));
    return `✅ Nombre: *${text}*\n\n*¿Cuál es tu número de cédula?*`;
  }

  if (step === 'inc_cedula') {
    ctx.cedula = text;
    setStep(db, phone, 'inc_cargo', null, JSON.stringify(ctx));
    return `✅ Cédula: *${text}*\n\n*¿Cuál es tu cargo dentro de la empresa?*`;
  }

  if (step === 'inc_cargo') {
    ctx.cargo = text;
    setStep(db, phone, 'inc_equipo', null, JSON.stringify(ctx));
    return (
      `✅ Cargo: *${text}*\n\n` +
      `🖥️ *¿Cuál es el nombre o tipo del equipo con falla?*\n\n` +
      `Si conoces el serial o número de inventario, inclúyelo separado con un guión\n` +
      `(ej: _"PC HP EliteDesk - serial HP2024001"_).`
    );
  }

  if (step === 'inc_equipo') {
    const serialMatch = text.match(/[—\-–]\s*(?:serial|inv\.?|inventario)?\s*([A-Z0-9\-]+)\s*$/i);
    if (serialMatch) {
      ctx.equipment_name   = text.slice(0, text.lastIndexOf(serialMatch[0])).trim();
      ctx.equipment_serial = serialMatch[1].trim();
    } else {
      ctx.equipment_name   = text;
      ctx.equipment_serial = null;
    }
    setStep(db, phone, 'inc_desc', null, JSON.stringify(ctx));
    return (
      `✅ Equipo: *${ctx.equipment_name}*` +
      (ctx.equipment_serial ? `\n✅ Serial: *${ctx.equipment_serial}*` : '') +
      `\n\n⚠️ *Describe la falla del equipo.*\n\n` +
      `Indica qué sucede, desde cuándo ocurre y si muestra algún error.`
    );
  }

  // inc_desc — crear incidencia
  ctx.description = text;
  const result = createTechRequest(db, {
    type:             'incidencia',
    requester_name:   ctx.name,
    cedula:           ctx.cedula,
    cargo:            ctx.cargo,
    sede:             ctx.sede,
    description:      text,
    equipment_name:   ctx.equipment_name   || null,
    equipment_serial: ctx.equipment_serial || null,
    quantity:         1,
    priority:         detectPriority(text),
  });

  appEvents.emit('tech-request:created', { id: result.id, request_number: result.request_number, type: 'incidencia' });
  setStep(db, phone, 'idle', null, '{}');

  return (
    `✅ *¡Incidencia registrada exitosamente!*\n\n` +
    `🔧 *N.º de solicitud:* ${result.request_number}\n\n` +
    `• 👤 *Nombre:* ${ctx.name}\n` +
    `• 🪪 *Cédula:* ${ctx.cedula}\n` +
    `• 💼 *Cargo:* ${ctx.cargo}\n` +
    `• 📍 *Sede:* ${ctx.sede}\n` +
    `• 🖥️ *Equipo:* ${ctx.equipment_name || 'N/A'}` +
    (ctx.equipment_serial ? ` (serial: ${ctx.equipment_serial})` : '') + `\n` +
    `• ⚠️ *Falla:* ${text}\n\n` +
    `El equipo de IT revisará el equipo y te informará. ¡Gracias!`
  );
}
