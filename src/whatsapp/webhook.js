import express from 'express';
import dotenv from 'dotenv';
import Chatbot from './chatbot.js';
import { sendWhatsAppMessage } from './messenger.js';
import db from '../config/database.js';

dotenv.config();

const router = express.Router();
const chatbot = new Chatbot();

// Verificación de webhook para Meta (WhatsApp Business Cloud API)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_123';

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verificado exitosamente por Meta.');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Manejo de mensajes entrantes de WhatsApp desde Meta
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // Verificar si es un evento válido de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const phone = message.from; // Teléfono del remitente
        const text = message.text?.body; // Cuerpo del mensaje

        if (text) {
          console.log(`[WhatsApp Webhook] Mensaje recibido de ${phone}: "${text}"`);
          
          // Procesar mensaje con el chatbot
          const botResponse = await chatbot.processMessage(phone, text, db);
          
          // Enviar respuesta por WhatsApp (real o simulación)
          await sendWhatsAppMessage(phone, botResponse);
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Error en webhook POST /webhook:', error);
    res.sendStatus(500);
  }
});

export default router;
