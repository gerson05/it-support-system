import express from 'express';
import db from '../config/database.js';
import { ticketService } from './ticket-service.js';
import { sendWhatsAppMessage, sendWhatsAppImage } from '../whatsapp/messenger.js';
import { appEvents } from '../events/broadcaster.js';
import { logAudit } from '../audit/audit-logger.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const canRead  = [requireAuth, requirePermission('tickets:read')];
const canEdit  = [requireAuth, requirePermission('tickets:edit')];

const router = express.Router();

router.get('/api/tickets', ...canRead, wrap(async (req, res) => {
  const filters = {
    status: req.query.status,
    status_group: req.query.status_group,
    priority: req.query.priority,
    area: req.query.area,
    assigned_to: req.query.assigned_to,
    search: req.query.search,
    page: req.query.page ? parseInt(req.query.page) : 1,
    limit: req.query.limit ? parseInt(req.query.limit) : 10
  };

  const data = ticketService.getAll(filters);
  res.json(data);
}));

router.get('/api/tickets/:id', ...canRead, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const ticket = ticketService.getById(ticketId);

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket no encontrado.' });
  }

  res.json(ticket);
}));

router.put('/api/tickets/:id', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { status, priority, assigned_to, requester_name, category } = req.body;

  const updated = ticketService.update(ticketId, { status, priority, assigned_to, requester_name, category });

  if (!updated) {
    return res.status(404).json({ error: 'Ticket no encontrado o sin cambios que aplicar.' });
  }

  let auditMsg = '⚙️ Cambio en el ticket realizado por IT:';
  if (status) auditMsg += ` [Estado ➔ ${status}]`;
  if (priority) auditMsg += ` [Prioridad ➔ ${priority}]`;
  if (assigned_to !== undefined) {
    if (assigned_to === '' || assigned_to === null) {
      auditMsg += ` [Desasignado del agente]`;
    } else {
      const agent = db.prepare('SELECT name FROM agents WHERE id = ?').get(assigned_to);
      if (agent) auditMsg += ` [Asignado a: ${agent.name}]`;
    }
  }

  db.prepare(`
    INSERT INTO messages (ticket_id, sender_type, content)
    VALUES (?, 'bot', ?)
  `).run(ticketId, auditMsg);

  const ticket = db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
  if (status && ticket) {
    const WA_STATUS_MSGS = {
      en_progreso: `🔧 *Tu caso está siendo atendido por el equipo de IT.*`,
      en_espera:   `⏳ *Tu caso está en espera de información adicional.*\n\nPor favor responde a la consulta de nuestro técnico.`,
      resuelto:    `✅ *Tu caso ha sido marcado como resuelto.*\n\n¿Fue solucionado correctamente? Escríbenos si aún tienes problemas.`,
      cerrado:     `📁 *Tu caso ha sido cerrado.*\n\nSi necesitas reabrirlo, escríbenos al chat.`,
    };
    const waMsg = WA_STATUS_MSGS[status];
    if (waMsg) {
      const fullMsg = `${waMsg}\n\n🎟️ Ticket: *${ticket.ticket_number}*`;
      sendWhatsAppMessage(ticket.phone, fullMsg, ticket.chat_id || null).catch(() => {});
    }
  }

  const agentName = db.prepare('SELECT name FROM agents WHERE id = ?').get(req.body.agent_id)?.name;
  logAudit(agentName || 'Sistema', 'Ticket actualizado', 'ticket', ticketId, ticket?.ticket_number, { status, priority, assigned_to });

  appEvents.emit('ticket:updated', { id: ticketId });
  res.json({ success: true, message: 'Ticket actualizado correctamente.' });
}));

router.post('/api/tickets/:id/messages', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { agentName, content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'El contenido del mensaje es requerido.' });
  }

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket no encontrado.' });
  }

  const saved = ticketService.addMessage(ticketId, 'agent', agentName || 'Soporte IT', content);
  if (!saved) {
    return res.status(500).json({ error: 'Error al registrar el mensaje en la base de datos.' });
  }

  const formattedMessage = `👨‍💻 *Soporte IT (${agentName || 'Agente'}):*\n\n${content}\n\n_Ref. Ticket: ${ticket.ticket_number}_`;
  const waResponse = await sendWhatsAppMessage(ticket.phone, formattedMessage, ticket.chat_id || null);

  logAudit(agentName || 'Agente', 'Mensaje enviado', 'ticket', ticketId, ticket.ticket_number, { content: content.slice(0, 100), wa_simulation: waResponse.simulation });

  appEvents.emit('ticket:message', { ticketId });
  res.json({
    success: true,
    message: 'Mensaje enviado correctamente.',
    whatsapp: waResponse
  });
}));

router.post('/api/tickets/:id/notes', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { agentId, agentName, content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'El contenido de la nota es requerido.' });
  }

  const saved = ticketService.addNote(ticketId, agentId, agentName || 'Agente IT', content);
  if (!saved) {
    return res.status(500).json({ error: 'Error al guardar la nota interna.' });
  }

  res.json({ success: true, message: 'Nota interna agregada correctamente.' });
}));

router.post('/api/tickets/:id/send-image', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const ticket   = ticketService.getById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });

  const { base64, mimetype = 'image/jpeg', caption = '', agentName = 'Agente IT' } = req.body;
  if (!base64) return res.status(400).json({ error: 'Se requiere la imagen en base64.' });

  const result = await sendWhatsAppImage(ticket.phone, base64, mimetype, caption);

  const attachment = JSON.stringify({ type: 'image', mimetype, caption });
  db.prepare(`
    INSERT INTO messages (ticket_id, sender_type, sender_name, content, attachment)
    VALUES (?, 'agent', ?, ?, ?)
  `).run(ticketId, agentName, caption || '[Imagen]', attachment);

  db.prepare(`UPDATE tickets SET updated_at = datetime('now','localtime') WHERE id = ?`).run(ticketId);
  logAudit(agentName, 'Imagen enviada', 'ticket', ticketId, ticket.ticket_number);
  appEvents.emit('ticket:message', { ticketId });

  res.json({ success: true, simulation: result.simulation });
}));

router.get('/api/agents', ...canRead, wrap(async (req, res) => {
  const agents = db.prepare('SELECT * FROM agents WHERE active = 1').all();
  res.json(agents);
}));

router.put('/api/tickets/:id/requester', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { requester_name, cedula, agentName = 'Agente' } = req.body;

  if (!requester_name?.trim()) {
    return res.status(400).json({ error: 'El nombre del solicitante es requerido.' });
  }

  const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });

  db.prepare(`UPDATE tickets SET requester_name = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(requester_name.trim(), ticketId);

  logAudit(agentName, 'Solicitante actualizado', 'ticket', ticketId, ticket.ticket_number, { requester_name, cedula });

  res.json({ success: true });
}));

router.put('/api/tickets/:id/assign', ...canEdit, wrap(async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { nombre, cedula, agentName = 'Agente' } = req.body;

  if (!nombre?.trim() || !cedula?.trim()) {
    return res.status(400).json({ error: 'Nombre y cédula son requeridos.' });
  }

  const ticket = db.prepare('SELECT id, ticket_number FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });

  let agent = db.prepare('SELECT id FROM agents WHERE name = ?').get(nombre.trim());
  if (!agent) {
    const result = db.prepare('INSERT INTO agents (name) VALUES (?)').run(nombre.trim());
    agent = { id: result.lastInsertRowid };
  }

  db.prepare(`UPDATE tickets SET assigned_to = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(agent.id, ticketId);

  logAudit(agentName, 'Técnico asignado', 'ticket', ticketId, ticket.ticket_number, { nombre, cedula });

  res.json({ success: true, agent_id: agent.id, agent_name: nombre.trim() });
}));

router.put('/api/agents/:id', ...canEdit, wrap(async (req, res) => {
  const agentId = parseInt(req.params.id);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del agente es requerido.' });
  }

  const result = db.prepare('UPDATE agents SET name = ? WHERE id = ?').run(name.trim(), agentId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Agente no encontrado.' });
  }

  res.json({ success: true, message: 'Nombre actualizado correctamente.' });
}));

export default router;
