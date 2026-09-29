/**
 * Obtiene el número de celular real de quien escribe.
 *
 * En WhatsApp multi-device muchos chats llegan con un LID ("237...@lid"),
 * un identificador interno que NO es el número. `getContact().number` en esos
 * casos devuelve los dígitos del LID, así que primero se traduce LID → número
 * con `client.getContactLidAndPhone`.
 */

const TIMEOUT_MS = 2000;

const digits = (id) => String(id || '').split('@')[0].split(':')[0].replace(/\D/g, '');

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);
}

/**
 * @param {object} client - cliente de whatsapp-web.js
 * @param {object} msg    - mensaje entrante
 * @returns {Promise<string>} número (solo dígitos) o, si no se pudo resolver, los dígitos del chatId
 */
export async function resolvePhone(client, msg) {
  const chatId = msg.from;

  if (chatId?.endsWith('@lid')) {
    try {
      const [res] = await withTimeout(client.getContactLidAndPhone([chatId]));
      if (res?.pn) return digits(res.pn);
    } catch (err) {
      console.warn(`[WhatsApp] No se pudo traducir LID ${chatId} a número:`, err.message);
    }
  }

  try {
    const contact = await withTimeout(msg.getContact());
    // Solo es un número real si el contacto es de tipo teléfono (@c.us), no LID
    if (contact?.number && contact.id?.server !== 'lid') return digits(contact.number);
  } catch {}

  return digits(chatId) || chatId;
}
