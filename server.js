import dotenv from 'dotenv';
import os from 'os';
import { spawn } from 'child_process';
import https from 'node:https';
import { createRequire } from 'node:module';
import db from './src/config/database.js';
import { initAdminUser } from './src/auth/auth-service.js';
import whatsappClient from './src/whatsapp/baileys-client.js';
import { startInactivityMonitor } from './src/whatsapp/inactivity-monitor.js';
import { startOfflineChecker } from './src/monitoring/monitoring-routes.js';
import { app } from './src/app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

process.on('uncaughtException',  (err)    => console.error('Error global no capturado:', err));
process.on('unhandledRejection', (reason) => console.error('Promesa rechazada no manejada:', reason));

app.listen(PORT, async () => {
  await initAdminUser();

  // Reset conversaciones al arrancar para evitar sesiones colgadas
  try {
    const r = db.prepare("UPDATE conversations SET current_step='idle', area=NULL, context='{}'").run();
    if (r.changes > 0) console.log(`[Server] ${r.changes} sesión(es) de conversación reiniciadas.`);
  } catch (e) {
    console.warn('[Server] No se pudo limpiar conversaciones:', e.message);
  }

  console.log(`\n======================================================`);
  console.log(`🚀 Sistema de Tickets IT corriendo exitosamente.`);
  console.log(`🖥️  Panel de Gestión: http://localhost:${PORT}`);
  console.log(`📱 Webhook de WhatsApp: http://localhost:${PORT}/webhook`);
  console.log(`💬 WhatsApp Real: http://localhost:${PORT}/api/whatsapp/status`);
  console.log(`======================================================\n`);

  if (process.env.DISABLE_WHATSAPP !== 'true') {
    setTimeout(() => {
      console.log('[WhatsApp] Iniciando conexión automática...');
      whatsappClient.connect().catch(err => console.error('[WhatsApp] Error en conexión automática:', err));
    }, 1000);
  } else {
    console.log('[WhatsApp] Conexión automática desactivada por env var.');
  }

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

  if (process.env.DISABLE_TUNNEL !== 'true') {
    startCloudflaredTunnel(PORT);
  } else {
    console.log('[Tunnel] Túnel Cloudflare desactivado por env var.');
  }

  const { scheduleSync } = await import('./src/erp/erp-sync.js');
  const { ERPClient }    = await import('./src/erp/erp-client.js');
  scheduleSync(new ERPClient(), parseInt(process.env.ERP_SYNC_INTERVAL_HOURS || '24'));
});

function startCloudflaredTunnel(port) {
  let cf;
  try {
    cf = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch {
    console.warn('[Tunnel] cloudflared no disponible — cámara solo funciona en HTTPS externo.');
    return;
  }

  const handleOutput = (data) => {
    const text  = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      process.env.PUBLIC_TUNNEL_URL = match[0];
      console.log(`\n🌐 Túnel HTTPS activo: ${match[0]}`);
      console.log(`   Usa esta URL en el celular para habilitar la cámara.\n`);
    }
  };

  cf.stdout.on('data', handleOutput);
  cf.stderr.on('data', handleOutput);
  cf.on('error', () => console.warn('[Tunnel] No se pudo iniciar cloudflared.'));
  cf.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[Tunnel] cloudflared terminó (código ${code}). Reiniciando en 10s…`);
      setTimeout(() => startCloudflaredTunnel(port), 10_000);
    }
  });

  process.on('exit',    () => cf.kill());
  process.on('SIGINT',  () => { cf.kill(); process.exit(0); });
  process.on('SIGTERM', () => { cf.kill(); process.exit(0); });
}

// HTTPS server para Windows-direct mode (cámara móvil requiere contexto seguro)
if (process.env.ENABLE_HTTPS === 'true') {
  const require    = createRequire(import.meta.url);
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
