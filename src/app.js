import express from 'express';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './config/database.js';
import webhookRouter from './whatsapp/webhook.js';
import ticketRouter from './tickets/ticket-routes.js';
import metricsRouter from './metrics/metrics-routes.js';
import techRequestRouter from './tech-requests/tech-request-routes.js';
import faqRouter from './knowledge/faq-routes.js';
import sedesRouter from './sedes/sedes-routes.js';
import auditRouter from './audit/audit-routes.js';
import despachoRouter from './despacho/despacho-routes.js';
import farmaciasRouter from './farmacias/farmacias-routes.js';
import actasRouter from './actas/actas-routes.js';
import registrosRouter from './registros/registros-routes.js';
import inventarioRouter from './inventario/inventario-routes.js';
import activoRouter from './inventario/activo-publico-routes.js';
import authRouter from './auth/auth-routes.js';
import userRouter from './auth/user-routes.js';
import trackingRouter from './tracking/tracking-routes.js';
import monitoringRouter from './monitoring/monitoring-routes.js';
import aiRouter from './ai/ai-routes.js';
import reqRouter from './requerimientos/req-routes.js';
import reunionesRouter from './reuniones/reuniones-routes.js';
import employeesRouter from './employees/employees-routes.js';
import wpConfigRouter from './config/wp-config-routes.js';
import erpRouter from './erp/erp-routes.js';
import Chatbot from './whatsapp/chatbot.js';
import whatsappClient from './whatsapp/baileys-client.js';
import { addSseClient, removeSseClient } from './events/broadcaster.js';
import { requireAuth } from './auth/auth-middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(PUBLIC_DIR));

// Routers
app.use(webhookRouter);
app.use(ticketRouter);
app.use(metricsRouter);
app.use(techRequestRouter);
app.use(faqRouter);
app.use(sedesRouter);
app.use(auditRouter);
app.use(despachoRouter);
app.use(farmaciasRouter);
app.use(actasRouter);
app.use(registrosRouter);
app.use(inventarioRouter);
app.use(activoRouter);
app.use(authRouter);
app.use(userRouter);
app.use(trackingRouter);
app.use(monitoringRouter);
app.use(aiRouter);
app.use(reqRouter);
app.use(reunionesRouter);
app.use(employeesRouter);
app.use(wpConfigRouter);
app.use(erpRouter);

// Static pages
app.get('/firmar/:token',   (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'firmar.html')));
app.get('/registrar/:token',(_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'registrar-equipo.html')));
app.get('/rastrear/:token', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'rastrear.html')));

// Chatbot simulator
const chatbotSimulator = new Chatbot();

app.post('/api/simulate', requireAuth, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Teléfono y mensaje son obligatorios.' });
    const botResponse = await chatbotSimulator.processMessage(phone, message, db);
    res.json({ response: botResponse });
  } catch (error) {
    console.error('Error en /api/simulate:', error);
    res.status(500).json({ error: 'Error al procesar mensaje en simulador.' });
  }
});

app.post('/api/simulate/reset', requireAuth, (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Teléfono es requerido.' });
    db.prepare('DELETE FROM conversations WHERE phone = ?').run(phone);
    res.json({ success: true, message: 'Sesión del bot reiniciada exitosamente.' });
  } catch (error) {
    console.error('Error en /api/simulate/reset:', error);
    res.status(500).json({ error: 'Error al reiniciar sesión de simulación.' });
  }
});

// SSE
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {}\n\n');
  addSseClient(res);
  req.on('close', () => removeSseClient(res));
  req.on('error', () => removeSseClient(res));
});

// Misc
app.get('/api/public-url', (_req, res) => {
  res.json({ url: process.env.PUBLIC_TUNNEL_URL || process.env.APP_URL || null });
});

app.get('/api/network-info', (_req, res) => {
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) { localIp = net.address; break; }
    }
    if (localIp !== '127.0.0.1') break;
  }
  res.json({ ip: localIp, port: process.env.PORT || 3000 });
});

// WhatsApp
app.get('/api/whatsapp/status', (_req, res) => res.json(whatsappClient.getStatus()));

app.get('/api/whatsapp/qr', (_req, res) => {
  const status = whatsappClient.getStatus();
  res.json(status.qrString ? { qr: status.qrString } : { qr: null, message: 'No hay QR disponible.' });
});

app.post('/api/whatsapp/connect', (req, res) => {
  try {
    const status = whatsappClient.getStatus();
    if (status.connected) return res.json({ success: true, message: 'WhatsApp ya está conectado.', status });
    whatsappClient.forceConnect(false);
    res.json({ success: true, message: 'Iniciando conexión. El QR aparecerá en Configuración en unos segundos.' });
  } catch (error) {
    console.error('Error al conectar WhatsApp:', error);
    res.status(500).json({ error: 'Error al iniciar conexión de WhatsApp.' });
  }
});

app.post('/api/whatsapp/logout', async (_req, res) => {
  try {
    await whatsappClient.logout();
    res.json({ success: true, message: 'WhatsApp desconectado. Los datos de autenticación fueron eliminados.' });
  } catch (error) {
    console.error('Error al cerrar sesión de WhatsApp:', error);
    res.status(500).json({ error: 'Error al cerrar sesión de WhatsApp.' });
  }
});

app.post('/api/whatsapp/reset', (_req, res) => {
  try {
    whatsappClient.forceConnect(true);
    res.json({ success: true, message: 'Auth borrado. El QR nuevo aparecerá en Configuración en unos segundos.' });
  } catch (error) {
    console.error('Error en reset de WhatsApp:', error);
    res.status(500).json({ error: 'Error al reiniciar WhatsApp.' });
  }
});

// Health
app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime(), memory: process.memoryUsage(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || err.statusCode || 500).json({ error: err.message || 'Error interno del servidor.' });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint no encontrado.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

export default app;
