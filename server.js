import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import https from 'node:https';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'url';
import db from './src/config/database.js';
import webhookRouter from './src/whatsapp/webhook.js';
import ticketRouter from './src/tickets/ticket-routes.js';
import metricsRouter from './src/metrics/metrics-routes.js';
import techRequestRouter from './src/tech-requests/tech-request-routes.js';
import faqRouter from './src/knowledge/faq-routes.js';
import sedesRouter from './src/sedes/sedes-routes.js';
import auditRouter from './src/audit/audit-routes.js';
import despachoRouter from './src/despacho/despacho-routes.js';
import farmaciasRouter from './src/farmacias/farmacias-routes.js';
import actasRouter      from './src/actas/actas-routes.js';
import registrosRouter  from './src/registros/registros-routes.js';
import inventarioRouter from './src/inventario/inventario-routes.js';
import authRouter     from './src/auth/auth-routes.js';
import userRouter     from './src/auth/user-routes.js';
import trackingRouter from './src/tracking/tracking-routes.js';
import monitoringRouter, { startOfflineChecker } from './src/monitoring/monitoring-routes.js';
import aiRouter from './src/ai/ai-routes.js';
import reqRouter from './src/requerimientos/req-routes.js';
import reunionesRouter from './src/reuniones/reuniones-routes.js';
import { initAdminUser } from './src/auth/auth-service.js';
import Chatbot from './src/whatsapp/chatbot.js';
import whatsappClient from './src/whatsapp/baileys-client.js';
import { startInactivityMonitor } from './src/whatsapp/inactivity-monitor.js';
import { addSseClient, removeSseClient } from './src/events/broadcaster.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares estándar
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir el panel web de IT (Frontend vanilla JS)
app.use(express.static(path.join(__dirname, 'public')));

// Registrar routers del sistema
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
app.use(authRouter);
app.use(userRouter);
app.use(trackingRouter);
app.use(monitoringRouter);
app.use(aiRouter);
app.use(reqRouter);
app.use(reunionesRouter);

// Página pública de subida de acta firmada
app.get('/firmar/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'firmar.html'));
});

// Página móvil pública de registro de inventario
app.get('/registrar/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registrar-equipo.html'));
});

// Página pública de seguimiento de paquetes
app.get('/rastrear/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rastrear.html'));
});

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

// Iniciar conexión de WhatsApp manualmente (force: ignora _connecting atascado)
app.post('/api/whatsapp/connect', (req, res) => {
  try {
    const status = whatsappClient.getStatus();
    if (status.connected) {
      return res.json({ success: true, message: 'WhatsApp ya está conectado.', status });
    }
    // forceConnect limpia cualquier estado colgado antes de intentar
    whatsappClient.forceConnect(false);
    res.json({ success: true, message: 'Iniciando conexión. El QR aparecerá en Configuración en unos segundos.' });
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
app.post('/api/whatsapp/reset', (req, res) => {
  try {
    // forceConnect(true) destruye el cliente, borra el auth y reconecta desde cero
    whatsappClient.forceConnect(true);
    res.json({ success: true, message: 'Auth borrado. El QR nuevo aparecerá en Configuración en unos segundos.' });
  } catch (error) {
    console.error('Error en reset de WhatsApp:', error);
    res.status(500).json({ error: 'Error al reiniciar WhatsApp.' });
  }
});

// ── Health check para Docker / load-balancers ─────────────────────────────
app.get('/api/health', (req, res) => {
  try {
    // Verificar que la BD responde
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Manejador global de errores Express (debe ir antes del fallback SPA)
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
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
app.listen(PORT, async () => {
  await initAdminUser();

  console.log(`\n======================================================`);
  console.log(`🚀 Sistema de Tickets IT corriendo exitosamente.`);
  console.log(`🖥️  Panel de Gestión: http://localhost:${PORT}`);
  console.log(`📱 Webhook de WhatsApp: http://localhost:${PORT}/webhook`);
  console.log(`💬 WhatsApp Real: http://localhost:${PORT}/api/whatsapp/status`);
  console.log(`======================================================\n`);

  // Iniciar conexión de WhatsApp automáticamente
  if (process.env.DISABLE_WHATSAPP !== 'true') {
    setTimeout(() => {
      console.log('[WhatsApp] Iniciando conexión automática...');
      whatsappClient.connect().catch(err => {
        console.error('[WhatsApp] Error en conexión automática:', err);
      });
    }, 1000);
  } else {
    console.log('[WhatsApp] Conexión automática desactivada por env var.');
  }

  // Monitor de inactividad en conversaciones
  if (process.env.DISABLE_INACTIVITY_MONITOR !== 'true') {
    startInactivityMonitor();
  } else {
    console.log('[WhatsApp] Monitor de inactividad desactivado por env var.');
  }

  if (process.env.DISABLE_OFFLINE_CHECKER !== 'true') {
    startOfflineChecker();
  } else {
    console.log('[Monitoring] Offline checker desactivado por env var.');
  }

  // Túnel HTTPS público via Cloudflare (habilita cámara en móviles)
  if (process.env.DISABLE_TUNNEL !== 'true') {
    startCloudflaredTunnel(PORT);
  } else {
    console.log('[Tunnel] Túnel Cloudflare desactivado por env var.');
  }
});

function startCloudflaredTunnel(port) {
  let cf;
  try {
    cf = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });
  } catch {
    console.warn('[Tunnel] cloudflared no disponible — cámara solo funciona en HTTPS externo.');
    return;
  }

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      process.env.PUBLIC_TUNNEL_URL = match[0];
      console.log(`\n🌐 Túnel HTTPS activo: ${match[0]}`);
      console.log(`   Usa esta URL en el celular para habilitar la cámara.\n`);
    }
  };

  cf.stdout.on('data', handleOutput);
  cf.stderr.on('data', handleOutput);

  cf.on('error', () =>
    console.warn('[Tunnel] No se pudo iniciar cloudflared.')
  );

  cf.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[Tunnel] cloudflared terminó (código ${code}). Reiniciando en 10s…`);
      setTimeout(() => startCloudflaredTunnel(port), 10_000);
    }
  });

  // Matar túnel limpiamente al cerrar el servidor
  process.on('exit',    () => cf.kill());
  process.on('SIGINT',  () => { cf.kill(); process.exit(0); });
  process.on('SIGTERM', () => { cf.kill(); process.exit(0); });
}

// HTTPS server for Windows-direct mode (mobile camera requires secure context)
// Enable with ENABLE_HTTPS=true in .env — listens on HTTPS_PORT (default 3443)
if (process.env.ENABLE_HTTPS === 'true') {
  const require = createRequire(import.meta.url);
  const selfsigned = require('selfsigned');
  const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'localhost' }],
    { days: 365, algorithm: 'sha256' }
  );
  const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
  httpsServer.listen(HTTPS_PORT, () => {
    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const iface of Object.values(nets)) {
      for (const net of iface) {
        if (net.family === 'IPv4' && !net.internal) { localIp = net.address; break; }
      }
      if (localIp !== '127.0.0.1') break;
    }
    console.log(`[HTTPS] Servidor seguro en https://localhost:${HTTPS_PORT}`);
    console.log(`[HTTPS] Red local:       https://${localIp}:${HTTPS_PORT}`);
    console.log(`[HTTPS] Acepta el cert en el celular para habilitar la camara`);
  });
}
