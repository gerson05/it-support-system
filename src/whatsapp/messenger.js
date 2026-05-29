import dotenv from 'dotenv';
import whatsappClient from './baileys-client.js';
dotenv.config();

export function isSimulationMode() {
  return !whatsappClient.getStatus().connected;
}

export async function sendWhatsAppMessage(phone, message) {
  return await whatsappClient.sendMessage(phone, message);
}

export async function sendWhatsAppImage(phone, base64Data, mimetype, caption) {
  return await whatsappClient.sendImage(phone, base64Data, mimetype, caption);
}
