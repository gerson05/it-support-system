import dotenv from 'dotenv';
import whatsappClient from './baileys-client.js';
dotenv.config();

export function isSimulationMode() {
  return !whatsappClient.getStatus().connected;
}

export async function sendWhatsAppMessage(phone, message) {
  return await whatsappClient.sendMessage(phone, message);
}
