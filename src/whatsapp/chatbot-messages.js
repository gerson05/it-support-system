/**
 * chatbot-messages.js
 * Textos por defecto de todos los mensajes automáticos de WhatsApp.
 * Para editarlos desde el panel: Configuración → Mensajes WP.
 * Los valores guardados en DB (app_config) sobreescriben los defaults.
 *
 * Variables disponibles según mensaje (usar {varName} en el texto):
 *   greeting        — sin variables
 *   oos_closing     — {nextDay}
 *   oos_closed      — {nextDay}
 *   ticket_added    — {ticketNumber}
 *   estado_no_tickets — sin variables
 *   image_out_of_flow — sin variables
 *   inactivity_warn — {closeMin}
 *   inactivity_close — sin variables
 *   error_fallback  — sin variables
 */

export const WP_MSG_LABELS = {
  greeting:          { label: 'Saludo / Menú principal',           vars: [] },
  oos_closing:       { label: 'A punto de cerrar (tarde)',          vars: ['{nextDay}'] },
  oos_closed:        { label: 'Fuera de horario',                   vars: ['{nextDay}'] },
  ticket_added:      { label: 'Mensaje agregado a ticket activo',   vars: ['{ticketNumber}'] },
  estado_no_tickets: { label: 'Sin tickets registrados',            vars: [] },
  image_out_of_flow: { label: 'Imagen recibida fuera de flujo',     vars: [] },
  inactivity_warn:   { label: 'Aviso de inactividad',               vars: ['{closeMin}'] },
  inactivity_close:  { label: 'Sesión cerrada por inactividad',     vars: [] },
  error_fallback:    { label: 'Error técnico',                      vars: [] },
};

export const DEFAULTS = {
  greeting:
    `🖥️ *¡Hola! Soy el asistente de IT* 🤖\n\n` +
    `¿En qué te puedo ayudar hoy?\n\n` +
    `*1️⃣* 🔧 Tengo un *problema técnico*\n` +
    `*2️⃣* 📋 Necesito *equipos o materiales* (requerimiento)\n` +
    `*3️⃣* ⚠️ Voy a *enviar un equipo con falla* (incidencia)\n\n` +
    `_Responde con el número de tu opción._\n\n` +
    `💡 Escribe *estado* en cualquier momento para consultar tus tickets.`,

  oos_closing:
    `⚠️ *Estamos a punto de cerrar*\n\n` +
    `Nuestro horario de atención termina a las *4:40 PM*.\n` +
    `Tu caso quedará agendado para el *{nextDay}* a las 7:00 AM.\n\n` +
    `¿Cuál es tu nombre completo?`,

  oos_closed:
    `⏰ *Fuera de horario de atención*\n\n` +
    `Nuestro equipo de IT atiende de *lunes a viernes de 7:00 AM a 4:40 PM*.\n\n` +
    `Tu caso quedará registrado y será atendido el *{nextDay}* a primera hora.\n\n` +
    `¿Cuál es tu nombre completo?`,

  ticket_added:
    `📥 *Mensaje agregado al Ticket {ticketNumber}*\n\n` +
    `Tu mensaje fue registrado. El equipo de IT te responderá pronto.\n\n` +
    `_Para nueva consulta escribe *menu*._`,

  estado_no_tickets:
    `📭 No tienes tickets registrados aún.\n\nEscribe *Hola* para iniciar una nueva consulta de soporte.`,

  image_out_of_flow:
    `📸 _Imagen recibida._ Para que analicemos el error de tu captura, escribe *Hola*, selecciona *Soporte técnico* y cuando llegues a describir el problema envía la imagen. 📲`,

  inactivity_warn:
    `⏳ ¿Sigues ahí? Llevas un momento sin responder.\n\n` +
    `Si deseas continuar, responde cualquier cosa.\n` +
    `Si no, en *{closeMin} minutos* cerramos esta sesión.\n\n` +
    `_(Escribe *menu* para volver al inicio)_`,

  inactivity_close:
    `⏱️ Tu sesión fue cerrada por inactividad.\n\nSi necesitas ayuda, escribe *Hola* para iniciar de nuevo.`,

  error_fallback:
    `❌ Ocurrió un error técnico. Por favor escribe *Hola* para reiniciar.`,
};

/**
 * Obtiene un mensaje: primero busca override en DB, si no usa el default.
 * Reemplaza {var} con los valores de `vars`.
 * @param {object} db  — instancia de DB (node:sqlite)
 * @param {string} key — clave del mensaje (ver WP_MSG_LABELS)
 * @param {object} vars — variables a reemplazar, e.g. { nextDay: 'lunes 14' }
 */
export function getMsg(db, key, vars = {}) {
  let text = DEFAULTS[key] ?? '';
  try {
    const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(`wp_msg_${key}`);
    if (row?.value) text = row.value;
  } catch { /* tabla no existe aún, usa default */ }
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, String(v)), text);
}
