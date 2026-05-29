import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import db from './src/config/database.js';
import webhookRouter from './src/whatsapp/webhook.js';
import ticketRouter from './src/tickets/ticket-routes.js';
import metricsRouter from './src/metrics/metrics-routes.js';
import techRequestRouter from './src/tech-requests/tech-request-routes.js';
import faqRouter from './src/knowledge/faq-routes.js';
import sedesRouter from './src/sedes/sedes-routes.js';
import Chatbot from './src/whatsapp/chatbot.js';
import whatsappClient from './src/whatsapp/baileys-client.js';
import { addSseClient, removeSseClient } from './src/events/broadcaster.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares estándar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir el panel web de IT (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Registrar routers del sistema
app.use(webhookRouter);
app.use(ticketRouter);
app.use(metricsRouter);
app.use(techRequestRouter);
app.use(faqRouter);
app.use(sedesRouter);

// Al arrancar, resetear todas las conversaciones al estado inicial para
// evitar que sesiones del flujo viejo interfieran con el nuevo menú.
try {
  const resetResult = db.prepare(
    "UPDATE conversations SET current_step='idle', area=NULL, context='{}'"
  ).run();
  if (resetResult.changes > 0) {
    console.log(`[Server] ${resetResult.changes} sesión(es) de conversación reiniciadas.`);
  }
} catch (e) {
  console.warn('[Server] No se pudo limpiar conversaciones:', e.message);
}

// Instancia global del chatbot para la simulación
const chatbotSimulator = new Chatbot();

// Endpoint especial para el simulador de WhatsApp de la UI
app.post('/api/simulate', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Teléfono y mensaje son obligatorios.' });
    }

    console.log(`[Simulador WhatsApp] Mensaje recibido de ${phone}: "${message}"`);

    // Procesar con el chatbot
    const botResponse = await chatbotSimulator.processMessage(phone, message, db);

    res.json({ response: botResponse });
  } catch (error) {
    console.error('Error en /api/simulate:', error);
    res.status(500).json({ error: 'Error al procesar mensaje en simulador.' });
  }
});

// Endpoint especial para reiniciar la conversación en el simulador
app.post('/api/simulate/reset', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Teléfono es requerido.' });
    }

    db.prepare('DELETE FROM conversations WHERE phone = ?').run(phone);
    console.log(`[Simulador WhatsApp] Sesión de conversación reiniciada para: ${phone}`);
    
    res.json({ success: true, message: 'Sesión del bot reiniciada exitosamente.' });
  } catch (error) {
    console.error('Error en /api/simulate/reset:', error);
    res.status(500).json({ error: 'Error al reiniciar sesión de simulación.' });
  }
});

// ====== SERVER-SENT EVENTS — actualizaciones en tiempo real ======
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {}\n\n');

  addSseClient(res);
  req.on('close',  () => removeSseClient(res));
  req.on('error',  () => removeSseClient(res));
});

// Información de red para la página de configuración
app.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }
  res.json({ ip: localIp, port: process.env.PORT || 3000 });
});

// ====== ENDPOINTS DE WHATSAPP ======

// Estado de conexión de WhatsApp
app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappClient.getStatus());
});

// Obtener QR code (string crudo) para renderizar del lado del cliente
app.get('/api/whatsapp/qr', (req, res) => {
  const status = whatsappClient.getStatus();
  if (status.qrString) {
    res.json({ qr: status.qrString });
  } else {
    res.json({ qr: null, message: 'No hay QR disponible.' });
  }
});

// Iniciar conexión de WhatsApp manualmente
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const status = whatsappClient.getStatus();
    if (status.connected) {
      return res.json({ success: true, message: 'WhatsApp ya está conectado.', status });
    }
    whatsappClient.connect().catch(err => console.error('Error conectando WhatsApp:', err));
    res.json({ success: true, message: 'Iniciando conexión de WhatsApp...' });
  } catch (error) {
    console.error('Error al conectar WhatsApp:', error);
    res.status(500).json({ error: 'Error al iniciar conexión de WhatsApp.' });
  }
});

// Desconectar WhatsApp
app.post('/api/whatsapp/logout', async (req, res) => {
  try {
    await whatsappClient.logout();
    res.json({ success: true, message: 'WhatsApp desconectado. Los datos de autenticación fueron eliminados.' });
  } catch (error) {
    console.error('Error al cerrar sesión de WhatsApp:', error);
    res.status(500).json({ error: 'Error al cerrar sesión de WhatsApp.' });
  }
});

// Reinicio completo: borra auth y genera QR nuevo (para sesiones corruptas)
app.post('/api/whatsapp/reset', async (req, res) => {
  try {
    await whatsappClient.logout();
    setTimeout(() => {
      whatsappClient.connect().catch(err => console.error('Error reconectando tras reset:', err));
    }, 1500);
    res.json({ success: true, message: 'Auth borrado. Escanea el nuevo QR en el panel.' });
  } catch (error) {
    console.error('Error en reset de WhatsApp:', error);
    res.status(500).json({ error: 'Error al reiniciar WhatsApp.' });
  }
});

// SPA fallback: cualquier ruta no coincidente sirve index.html (va al final)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo global de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Error global no capturado:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada no manejada:', reason);
});

// Levantar el servidor
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Sistema de Tickets IT corriendo exitosamente.`);
  console.log(`🖥️  Panel de Gestión: http://localhost:${PORT}`);
  console.log(`📱 Webhook de WhatsApp: http://localhost:${PORT}/webhook`);
  console.log(`💬 WhatsApp Real: http://localhost:${PORT}/api/whatsapp/status`);
  console.log(`======================================================\n`);

  // Iniciar conexión de WhatsApp automáticamente
  setTimeout(() => {
    console.log('[WhatsApp] Iniciando conexión automática...');
    whatsappClient.connect().catch(err => {
      console.error('[WhatsApp] Error en conexión automática:', err);
    });
  }, 1000);
});
