/**
 * Cliente de WhatsApp usando whatsapp-web.js (WhatsApp Web real con Chrome headless).
 * Compatible con WhatsApp Business.
 */

import wwebjs from 'whatsapp-web.js';
const { Client, LocalAuth } = wwebjs;

import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Chatbot from './chatbot.js';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../database/wwebjs-auth');

const chatbot = new Chatbot();

/** Borra la carpeta de autenticación local para forzar QR fresco. */
function clearAuthData() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      console.log('[WhatsApp] Datos de auth eliminados — se pedirá QR nuevo.');
    }
  } catch (err) {
    console.warn('[WhatsApp] No se pudo borrar auth:', err.message);
  }
}

class WhatsAppClient {
  constructor() {
    this.client      = null;
    this.status      = 'disconnected';
    this.qrCode      = null;
    this.qrImageDataUrl = null;
    this._connecting = false;
    this._readyTimeout = null;
  }

  async connect() {
    if (this._connecting || this.status === 'connected') return;
    this._connecting = true;
    this.status = 'disconnected';

    console.log('[WhatsApp] Iniciando cliente...');

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
      // Versión estable compatible con WhatsApp Business
      webVersion: '2.2412.54',
      webVersionCache: {
        type: 'remote',
        remotePath:
          'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1280,720',
          '--disable-features=VizDisplayCompositor',
        ],
      },
    });

    // ── QR para escanear ──
    this.client.on('qr', async (qr) => {
      this.qrCode = qr;
      this.status = 'awaiting_qr';
      this.qrImageDataUrl = null;
      console.log('[WhatsApp] QR listo para escanear.');
      try {
        this.qrImageDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      } catch {}
    });

    // ── Sesión autenticada (QR escaneado o sesión restaurada) ──
    this.client.on('authenticated', () => {
      console.log('[WhatsApp] ✔ QR escaneado — cargando WhatsApp Web...');
      // Cambiar estado a "connecting" para que el panel muestre progreso
      // y deje de mostrar el QR (ya fue escaneado)
      this.status = 'connecting';
      this.qrCode = null;
      this.qrImageDataUrl = null;

      // Seguridad: si "ready" no llega en 120 s, forzar reconexión limpia
      if (this._readyTimeout) clearTimeout(this._readyTimeout);
      this._readyTimeout = setTimeout(() => {
        if (this.status !== 'connected') {
          console.warn('[WhatsApp] ⏱ Timeout esperando "ready". Reiniciando...');
          this._forceReconnect(true);
        }
      }, 120_000);
    });

    // ── Cliente listo y conectado ──
    this.client.on('ready', () => {
      if (this._readyTimeout) {
        clearTimeout(this._readyTimeout);
        this._readyTimeout = null;
      }
      console.log('[WhatsApp] ✅ Conectado y listo para recibir mensajes.');
      this.status = 'connected';
      this.qrCode = null;
      this.qrImageDataUrl = null;
      this._connecting = false;
    });

    // ── Error de autenticación ──
    this.client.on('auth_failure', (msg) => {
      console.error('[WhatsApp] ❌ Error de autenticación:', msg);
      this._forceReconnect(true);
    });

    // ── Desconexión ──
    this.client.on('disconnected', (reason) => {
      console.log(`[WhatsApp] Desconectado: ${reason}`);

      const isLogout =
        reason === 'LOGOUT' ||
        reason === 'CONFLICT' ||
        String(reason) === '401' ||
        String(reason).toLowerCase().includes('logout');

      this._forceReconnect(isLogout, isLogout ? 5000 : 8000);
    });

    // ── Mensaje entrante ──
    this.client.on('message', async (msg) => {
      if (msg.isGroupMsg) return;
      if (msg.from === 'status@broadcast') return;
      if (msg.fromMe) return;

      const phone = msg.from.replace('@c.us', '').replace(/\D/g, '');

      // ── Imagen recibida → pasar a chatbot para análisis con Gemini Vision ──
      if (msg.hasMedia && msg.type === 'image') {
        console.log(`[WhatsApp] Imagen recibida de ${phone}`);
        try {
          const media = await msg.downloadMedia();
          if (media?.data) {
            const botResponse = await chatbot.processMessage(phone, '__IMAGE__', db, {
              imageBase64: media.data,
              mimetype:    media.mimetype || 'image/jpeg',
            });
            if (botResponse) await this.client.sendMessage(msg.from, botResponse);
          }
        } catch (err) {
          console.error('[WhatsApp] Error procesando imagen:', err.message);
        }
        return;
      }

      const text = msg.body?.trim();
      if (!text) return;

      console.log(`[WhatsApp] Mensaje de ${phone}: "${text}"`);

      try {
        const botResponse = await chatbot.processMessage(phone, text, db);
        if (botResponse) {
          await this.client.sendMessage(msg.from, botResponse);
          console.log(`[WhatsApp] Respuesta enviada a ${phone}`);
        }
      } catch (err) {
        console.error('[WhatsApp] Error procesando mensaje:', err);
      }
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error('[WhatsApp] Error al inicializar:', err.message);
      this._forceReconnect(false, 8000);
    }
  }

  /** Limpia estado interno y reconecta. Si clearAuth=true borra datos de sesión. */
  _forceReconnect(clearAuth = false, delay = 5000) {
    if (this._readyTimeout) { clearTimeout(this._readyTimeout); this._readyTimeout = null; }
    const c = this.client;
    this.client      = null;
    this.status      = 'disconnected';
    this.qrCode      = null;
    this.qrImageDataUrl = null;
    this._connecting = false;

    if (c) c.destroy().catch(() => {});
    if (clearAuth) clearAuthData();

    console.log(`[WhatsApp] Reconectando en ${delay / 1000}s...`);
    setTimeout(() => this.connect(), delay);
  }

  async sendMessage(phone, text) {
    if (!this.client || this.status !== 'connected') {
      console.log('[WhatsApp] No conectado, mensaje en modo simulación.');
      return { success: true, simulation: true };
    }
    try {
      const chatId = `${phone}@c.us`;
      await this.client.sendMessage(chatId, text);
      console.log(`[WhatsApp] Mensaje enviado a ${phone}`);
      return { success: true, simulation: false };
    } catch (err) {
      console.error('[WhatsApp] Error enviando:', err.message);
      return { success: false, error: err.message };
    }
  }

  async logout() {
    const c = this.client;
    this.client      = null;
    this.status      = 'disconnected';
    this.qrCode      = null;
    this.qrImageDataUrl = null;
    this._connecting = false;
    if (this._readyTimeout) { clearTimeout(this._readyTimeout); this._readyTimeout = null; }

    if (c) {
      try { await c.logout();  } catch {}
      try { await c.destroy(); } catch {}
    }

    clearAuthData();
    console.log('[WhatsApp] Sesión cerrada. Mostrando QR nuevo en 3s...');
    setTimeout(() => this.connect(), 3000);
  }

  getStatus() {
    // Solo exponer QR cuando realmente hay que escanearlo
    const showQr = this.status === 'awaiting_qr';
    return {
      status:    this.status,
      qrString:  showQr ? this.qrCode      : null,
      qrImage:   showQr ? this.qrImageDataUrl : null,
      connected: this.status === 'connected',
    };
  }
}

const whatsappClient = new WhatsAppClient();
export default whatsappClient;
