import express from 'express';
import db from '../config/database.js';
import {
  getAllTickets,
  getTicketById,
  updateTicket,
  addMessage,
  addInternalNote
} from './ticket-model.js';
import { sendWhatsAppMessage } from '../whatsapp/messenger.js';
import { appEvents } from '../events/broadcaster.js';

const router = express.Router();

// Listar todos los tickets con filtros
router.get('/api/tickets', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      area: req.query.area,
      assigned_to: req.query.assigned_to,
      search: req.query.search,
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 10
    };

    const data = getAllTickets(db, filters);
    res.json(data);
  } catch (error) {
    console.error('Error en GET /api/tickets:', error);
    res.status(500).json({ error: 'Error interno del servidor al consultar tickets.' });
  }
});

// Detalle de un ticket por ID
router.get('/api/tickets/:id', (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const ticket = getTicketById(db, ticketId);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error('Error en GET /api/tickets/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor al consultar el detalle del ticket.' });
  }
});

// Actualizar campos de un ticket
router.put('/api/tickets/:id', (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { status, priority, assigned_to, requester_name, category } = req.body;

    const updated = updateTicket(db, ticketId, { status, priority, assigned_to, requester_name, category });
    
    if (!updated) {
      return res.status(404).json({ error: 'Ticket no encontrado o sin cambios que aplicar.' });
    }

    // Registrar un mensaje de auditoría interno sobre el cambio en el historial del chat
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

    // Notificar al usuario por WhatsApp cuando el estado cambia
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
        sendWhatsAppMessage(ticket.phone, fullMsg).catch(() => {});
      }
    }

    appEvents.emit('ticket:updated', { id: ticketId });
    res.json({ success: true, message: 'Ticket actualizado correctamente.' });
  } catch (error) {
    console.error('Error en PUT /api/tickets/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar el ticket.' });
  }
});

// Enviar un mensaje / responder al empleado desde IT (llega a WhatsApp)
router.post('/api/tickets/:id/messages', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { agentName, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'El contenido del mensaje es requerido.' });
    }

    // Buscar ticket
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    // 1. Guardar el mensaje del agente en la base de datos
    const saved = addMessage(db, ticketId, 'agent', agentName || 'Soporte IT', content);
    if (!saved) {
      return res.status(500).json({ error: 'Error al registrar el mensaje en la base de datos.' });
    }

    // 2. Enviar la respuesta directamente al WhatsApp del empleado
    const formattedMessage = `👨‍💻 *Soporte IT (${agentName || 'Agente'}):*\n\n${content}\n\n_Ref. Ticket: ${ticket.ticket_number}_`;
    const waResponse = await sendWhatsAppMessage(ticket.phone, formattedMessage);

    appEvents.emit('ticket:message', { ticketId });
    res.json({
      success: true,
      message: 'Mensaje enviado correctamente.',
      whatsapp: waResponse
    });
  } catch (error) {
    console.error('Error en POST /api/tickets/:id/messages:', error);
    res.status(500).json({ error: 'Error al enviar la respuesta al usuario.' });
  }
});

// Agregar una nota interna privada para el equipo IT
router.post('/api/tickets/:id/notes', (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { agentId, agentName, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'El contenido de la nota es requerido.' });
    }

    const saved = addInternalNote(db, ticketId, agentId, agentName || 'Agente IT', content);
    if (!saved) {
      return res.status(500).json({ error: 'Error al guardar la nota interna.' });
    }

    res.json({ success: true, message: 'Nota interna agregada correctamente.' });
  } catch (error) {
    console.error('Error en POST /api/tickets/:id/notes:', error);
    res.status(500).json({ error: 'Error interno al agregar la nota.' });
  }
});

// Listar los agentes de IT
router.get('/api/agents', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM agents WHERE active = 1').all();
    res.json(agents);
  } catch (error) {
    console.error('Error en GET /api/agents:', error);
    res.status(500).json({ error: 'Error al obtener la lista de agentes.' });
  }
});

// Actualizar nombre de un agente
router.put('/api/agents/:id', (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error en PUT /api/agents/:id:', error);
    res.status(500).json({ error: 'Error al actualizar el agente.' });
  }
});

export default router;
