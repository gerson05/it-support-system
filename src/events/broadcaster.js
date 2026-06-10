/**
 * Broadcaster de Server-Sent Events (SSE).
 * Módulo singleton compartido por server.js, chatbot.js y ticket-routes.js.
 */

import { EventEmitter } from 'events';

// Bus interno de eventos de la app
export const appEvents = new EventEmitter();
appEvents.setMaxListeners(50);

// Conjunto de clientes SSE conectados (objetos res de Express)
const sseClients = new Set();

/** Registra un cliente SSE nuevo */
export function addSseClient(res) {
  sseClients.add(res);
}

/** Elimina un cliente SSE (cuando cierra el navegador) */
export function removeSseClient(res) {
  sseClients.delete(res);
}

/** Envía un evento SSE a todos los paneles abiertos */
export function broadcast(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
}

// Escuchar eventos internos y retransmitirlos a los clientes SSE
appEvents.on('ticket:created',         (data) => broadcast('ticket-created', data));
appEvents.on('ticket:updated',         (data) => broadcast('ticket-updated', data));
appEvents.on('ticket:message',         (data) => broadcast('ticket-message', data));
appEvents.on('tech-request:created',   (data) => broadcast('tech-request-created', data));
appEvents.on('tech-request:updated',   (data) => broadcast('tech-request-updated', data));
appEvents.on('tracking:evento',        (data) => broadcast('tracking-evento', data));
