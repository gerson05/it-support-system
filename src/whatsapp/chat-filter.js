/**
 * El chatbot solo atiende chats individuales (persona a persona).
 * Grupos, comunidades, listas de difusión, estados y canales se ignoran.
 *
 * En WhatsApp multi-device un mensaje de grupo no siempre trae el id del grupo
 * en msg.from (puede venir el LID del participante), así que se revisan varias
 * señales y, como confirmación final, el chat real (chat.isGroup).
 */

const INDIVIDUAL = /@(c\.us|lid|s\.whatsapp\.net)$/;
const NO_INDIVIDUAL = /@(g\.us|broadcast|newsletter)$/;

export async function esChatIndividual(msg) {
  if (!msg || msg.fromMe) return false;
  if (msg.isGroupMsg || msg.isStatus || msg.broadcast) return false;
  // En grupos, author = quien escribió; en chats individuales viene vacío
  if (msg.author) return false;

  const ids = [msg.from, msg.to, msg.id?.remote].filter(Boolean).map(String);
  if (ids.some(id => NO_INDIVIDUAL.test(id))) return false;
  if (!INDIVIDUAL.test(String(msg.from || ''))) return false;

  if (typeof msg.getChat === 'function') {
    try {
      const chat = await msg.getChat();
      if (chat?.isGroup || NO_INDIVIDUAL.test(String(chat?.id?._serialized || ''))) return false;
    } catch { /* si no se puede consultar el chat, deciden las señales anteriores */ }
  }
  return true;
}
