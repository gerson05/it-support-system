import dotenv from 'dotenv';
import whatsappClient from './baileys-client.js';
dotenv.config();

export function isSimulationMode() {
  return !whatsappClient.getStatus().connected;
}

export async function sendWhatsAppMessage(phone, message, chatId = null) {
  return await whatsappClient.sendMessage(phone, message, chatId);
}

export async function sendWhatsAppImage(phone, base64Data, mimetype, caption) {
  return await whatsappClient.sendImage(phone, base64Data, mimetype, caption);
}
