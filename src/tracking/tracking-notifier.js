import { broadcast, appEvents } from '../events/broadcaster.js';
import { sendWhatsAppMessage } from '../whatsapp/messenger.js';

const IT_PHONE = process.env.IT_PHONE;

export async function notifyTrackingEvento(tracking, evento) {
  appEvents.emit('tracking:evento', {
    token:    tracking.token,
    estado:   tracking.estado,
    numero:   tracking.numero,
    ubicacion: evento.ubicacion,
  });

  if (!IT_PHONE) return;

  const estadoEmoji = {
    en_transito: '🚚',
    en_sede:     '📍',
    entregado:   '✅',
    devuelto:    '↩️',
  }[evento.estado_paquete] || '📦';

  let msg;
  if (evento.tipo === 'entrega_final') {
    msg =
      `✅ *Paquete entregado*\n` +
      `*${tracking.numero}* entregado en ${evento.ubicacion}\n\n` +
      `👤 Recibió: ${evento.recibido_por}${evento.cargo_receptor ? ` (${evento.cargo_receptor})` : ''}\n` +
      `🤝 Entregado por: ${evento.entregado_por}\n` +
      `📄 Acta de recepción generada\n` +
      `🕐 ${new Date().toLocaleString('es-CO')}`;
  } else {
    msg =
      `${estadoEmoji} *Movimiento de paquete*\n` +
      `*${tracking.numero}* → ${tracking.sede_destino || tracking.destinatario}\n\n` +
      `📍 Recibido en: ${evento.ubicacion}\n` +
      `👤 Recibió: ${evento.recibido_por}\n` +
      `🤝 Entregado por: ${evento.entregado_por}\n` +
      `🕐 ${new Date().toLocaleString('es-CO')}\n\n` +
      `Estado: ${estadoEmoji} ${evento.estado_paquete.replace('_', ' ')}`;
  }

  try {
    await sendWhatsAppMessage(IT_PHONE, msg);
  } catch (err) {
    console.error('[tracking-notifier] WhatsApp error:', err.message);
  }
}
