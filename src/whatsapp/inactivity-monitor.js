/**
 * Monitor de inactividad en conversaciones activas.
 *
 * Lógica:
 *   - Si un usuario lleva más de WARN_AFTER_MIN minutos sin responder
 *     (y su flujo NO está en 'idle'), el bot le envía un aviso.
 *   - Si después del aviso sigue inactivo otros CLOSE_AFTER_MIN minutos,
 *     el bot cierra la conversación y la resetea a 'idle'.
 *
 * El monitor corre cada CHECK_INTERVAL_MS milisegundos.
 */

import db from '../config/database.js';
import { sendWhatsAppMessage } from './messenger.js';
import { getMsg } from './chatbot-messages.js';

const WARN_AFTER_MIN  = 8;    // minutos sin actividad → aviso
const CLOSE_AFTER_MIN = 2;    // minutos adicionales sin respuesta → cierre (total ~10 min)
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // revisar cada 3 minutos

let _timer = null;

export function startInactivityMonitor() {
  if (_timer) return; // ya iniciado
  console.log('[InactivityMonitor] Iniciado — check cada 3 min, aviso a los 8 min, cierre a los 10 min.');
  _timer = setInterval(_check, CHECK_INTERVAL_MS);
  _check(); // primera revisión inmediata al arrancar
}

export function stopInactivityMonitor() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function _check() {
  try {
    const now = new Date();

    /* ── 1. Cerrar conversaciones ya avisadas sin respuesta ────────── */
    const toClose = db.prepare(`
      SELECT phone, current_step FROM conversations
      WHERE current_step != 'idle'
        AND warned_inactive = 1
        AND last_activity <= datetime('now', 'localtime', '-${CLOSE_AFTER_MIN} minutes')
    `).all();

    for (const conv of toClose) {
      try {
        await sendWhatsAppMessage(conv.phone, getMsg(db, 'inactivity_close'));
      } catch { /* no bloquear si falla el envío */ }

      db.prepare(`
        UPDATE conversations
        SET current_step = 'idle', area = NULL, context = '{}', warned_inactive = 0,
            last_activity = datetime('now', 'localtime')
        WHERE phone = ?
      `).run(conv.phone);

      console.log(`[InactivityMonitor] Sesión cerrada: ${conv.phone} (estaba en '${conv.current_step}')`);
    }

    /* ── 2. Avisar a conversaciones inactivas (aún no avisadas) ───── */
    const toWarn = db.prepare(`
      SELECT phone, current_step FROM conversations
      WHERE current_step != 'idle'
        AND warned_inactive = 0
        AND last_activity <= datetime('now', 'localtime', '-${WARN_AFTER_MIN} minutes')
    `).all();

    for (const conv of toWarn) {
      try {
        await sendWhatsAppMessage(conv.phone, getMsg(db, 'inactivity_warn', { closeMin: CLOSE_AFTER_MIN }));
      } catch { /* no bloquear si falla el envío */ }

      db.prepare(`
        UPDATE conversations SET warned_inactive = 1 WHERE phone = ?
      `).run(conv.phone);

      console.log(`[InactivityMonitor] Aviso enviado: ${conv.phone} (flujo: '${conv.current_step}')`);
    }

  } catch (err) {
    console.error('[InactivityMonitor] Error en _check:', err.message);
  }
}
