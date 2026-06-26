/**
 * data-service-mock.js
 *
 * Offline-mode data layer:
 *  - initLocalStorageMock()   — Seed initial localStorage data
 *  - Exported mock implementations of every DataService method
 *
 * This module is only active when isOfflineMode === true.
 * The simulateBotMessage chatbot engine lives here.
 */
import { getFaqsByArea, faqs } from './faq-data.js';

// ── Area mappings (only used in offline chatbot flow) ─────────────────────
const AREA_MAP = {
  '1': 'cartera', '2': 'compra', '3': 'gestion_humana',
  '4': 'pqrs',    '5': 'contabilidad', '6': 'farmacia', '7': 'cuentas_medicas',
};

const AREA_NAMES = {
  cartera: '💰 Cartera', compra: '🛒 Compra', gestion_humana: '👥 Gestión Humana',
  pqrs: '📋 PQRS', contabilidad: '📊 Contabilidad', farmacia: '💊 Farmacia',
  cuentas_medicas: '🏥 Cuentas Médicas',
};

/* ── Seed localStorage with demo data ─────────────────────────────────── */

export function initLocalStorageMock() {
  if (!localStorage.getItem('it_agents')) {
    localStorage.setItem('it_agents', JSON.stringify([
      { id: 1, name: 'Carlos Mendoza' },
      { id: 2, name: 'Diana Guerrero' },
      { id: 3, name: 'Andrés Castro' },
      { id: 4, name: 'Sofía Rincón' },
    ]));
  }

  if (!localStorage.getItem('it_tickets')) {
    const mockTickets = [
      {
        id: 1, ticket_number: 'TK-20260524-001', phone: '573004567890',
        requester_name: 'Martha Gómez', area: 'contabilidad', category: 'software',
        priority: 'alta', status: 'en_progreso',
        description: 'El módulo contable me saca un Error 404 al intentar importar la planilla de pagos del banco.',
        faq_tried: '["cont-001"]', assigned_to: 1,
        created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 2  * 3600000).toISOString(), resolved_at: null,
      },
      {
        id: 2, ticket_number: 'TK-20260525-001', phone: '573159998877',
        requester_name: 'Jorge Eliécer', area: 'farmacia', category: 'hardware',
        priority: 'critica', status: 'abierto',
        description: 'La pistola lectora de códigos de barra no emite el láser rojo y en el biomédico no registra nada.',
        faq_tried: '["farm-001"]', assigned_to: null,
        created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 4 * 3600000).toISOString(), resolved_at: null,
      },
      {
        id: 3, ticket_number: 'TK-20260523-005', phone: '573123456789',
        requester_name: 'Luisa Fernanda', area: 'general', category: 'red',
        priority: 'baja', status: 'resuelto',
        description: 'No tengo conexión al servidor de carpetas compartidas públicas.',
        faq_tried: '["gen-006"]', assigned_to: 2,
        created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        resolved_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
      },
    ];
    localStorage.setItem('it_tickets', JSON.stringify(mockTickets));
  }

  if (!localStorage.getItem('it_messages')) {
    const mockMessages = [
      { id: 1, ticket_id: 1, sender_type: 'user',  sender_name: 'Martha Gómez',   content: 'El módulo contable me saca un Error 404 al intentar importar la planilla de pagos del banco.', created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
      { id: 2, ticket_id: 1, sender_type: 'bot',   sender_name: 'Bot IT',          content: '🎟️ *¡Ticket Creado Exitosamente!*\n\nTu número de caso es: *TK-20260524-001*\n📍 *Área:* 📊 Contabilidad\n\nNuestro equipo se comunicará contigo.',                  created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
      { id: 3, ticket_id: 1, sender_type: 'agent', sender_name: 'Carlos Mendoza',  content: 'Hola Martha, ya estamos revisando los logs en el servidor contable para verificar la importación. Dame 10 minutos.',                                                   created_at: new Date(Date.now() - 2  * 3600000).toISOString() },
      { id: 4, ticket_id: 2, sender_type: 'user',  sender_name: 'Jorge Eliécer',   content: 'La pistola lectora de códigos de barra no emite el láser rojo y en el biomédico no registra nada.',                                                                      created_at: new Date(Date.now() - 4  * 3600000).toISOString() },
      { id: 5, ticket_id: 2, sender_type: 'bot',   sender_name: 'Bot IT',          content: '🎟️ *¡Ticket Creado Exitosamente!*\n\nTu número de caso es: *TK-20260525-001*\n📍 *Área:* 💊 Farmacia\n\nNuestro equipo se comunicará contigo.',                       created_at: new Date(Date.now() - 4  * 3600000).toISOString() },
      { id: 6, ticket_id: 3, sender_type: 'user',  sender_name: 'Luisa Fernanda',  content: 'No tengo conexión al servidor de carpetas compartidas públicas.',                                                                                                           created_at: new Date(Date.now() - 3  * 24 * 3600000).toISOString() },
      { id: 7, ticket_id: 3, sender_type: 'agent', sender_name: 'Diana Guerrero',  content: 'Listo Luisa, agregamos los permisos a tu usuario de Windows. Por favor reinicia tu PC y comprueba.',                                                                       created_at: new Date(Date.now() - 2  * 24 * 3600000).toISOString() },
      { id: 8, ticket_id: 3, sender_type: 'user',  sender_name: 'Luisa Fernanda',  content: 'Excelente, ya pude acceder sin problema. Muchas gracias Diana!',                                                                                                            created_at: new Date(Date.now() - 2  * 24 * 3600000).toISOString() },
    ];
    localStorage.setItem('it_messages', JSON.stringify(mockMessages));
  }

  if (!localStorage.getItem('it_notes')) {
    localStorage.setItem('it_notes', JSON.stringify([
      { id: 1, ticket_id: 1, agent_id: 1, agent_name: 'Carlos Mendoza', content: 'Parece que el servidor SIIGO tuvo una actualización fallida de base de datos anoche. Revisando el pool de conexiones IIS.', created_at: new Date(Date.now() - 3600000).toISOString() },
    ]));
  }

  if (!localStorage.getItem('it_faq_hits')) {
    localStorage.setItem('it_faq_hits', JSON.stringify([
      { id: 1, faq_id: 'gen-001',  area: 'general',      resolved: 1, phone: '573000000001', created_at: new Date().toISOString() },
      { id: 2, faq_id: 'gen-002',  area: 'general',      resolved: 0, phone: '573000000002', created_at: new Date().toISOString() },
      { id: 3, faq_id: 'cont-001', area: 'contabilidad', resolved: 1, phone: '573000000003', created_at: new Date().toISOString() },
    ]));
  }

  if (!localStorage.getItem('it_conversations')) {
    localStorage.setItem('it_conversations', JSON.stringify({}));
  }
}

/* ── Offline implementations of every DataService method ─────────────── */

export const mockGetAgents = () =>
  JSON.parse(localStorage.getItem('it_agents') || '[]');

export function mockGetTickets(filters = {}) {
  let tickets = JSON.parse(localStorage.getItem('it_tickets') || '[]');
  const agents = JSON.parse(localStorage.getItem('it_agents') || '[]');

  if (filters.status)   tickets = tickets.filter(t => t.status   === filters.status);
  if (filters.priority) tickets = tickets.filter(t => t.priority === filters.priority);
  if (filters.area)     tickets = tickets.filter(t => t.area     === filters.area);

  if (filters.assigned_to !== undefined && filters.assigned_to !== '') {
    const isNull = filters.assigned_to === 'null' || filters.assigned_to === null;
    tickets = tickets.filter(t => isNull
      ? (t.assigned_to === null || t.assigned_to === '')
      : t.assigned_to === parseInt(filters.assigned_to));
  }

  if (filters.search) {
    const s = filters.search.toLowerCase();
    tickets = tickets.filter(t =>
      t.ticket_number.toLowerCase().includes(s) ||
      (t.description || '').toLowerCase().includes(s) ||
      (t.phone || '').toLowerCase().includes(s) ||
      (t.requester_name || '').toLowerCase().includes(s));
  }

  tickets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  tickets = tickets.map(t => ({ ...t, agent_name: agents.find(a => a.id === t.assigned_to)?.name || null }));

  const page   = parseInt(filters.page  || 1);
  const limit  = parseInt(filters.limit || 10);
  const offset = (page - 1) * limit;

  return { tickets: tickets.slice(offset, offset + limit), total: tickets.length, page, limit, total_pages: Math.ceil(tickets.length / limit) };
}

export function mockGetTicketById(id) {
  const numId  = parseInt(id);
  const tickets = JSON.parse(localStorage.getItem('it_tickets') || '[]');
  const ticket  = tickets.find(t => t.id === numId);
  if (!ticket) return null;

  const agents   = JSON.parse(localStorage.getItem('it_agents') || '[]');
  const messages = JSON.parse(localStorage.getItem('it_messages') || '[]').filter(m => m.ticket_id === numId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const notes    = JSON.parse(localStorage.getItem('it_notes')   || '[]').filter(n => n.ticket_id === numId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return { ...ticket, agent_name: agents.find(a => a.id === ticket.assigned_to)?.name || null, messages, notes };
}

export async function mockUpdateTicket(id, data, addMessage) {
  const numId = parseInt(id);
  const tickets = JSON.parse(localStorage.getItem('it_tickets') || '[]');
  const idx = tickets.findIndex(t => t.id === numId);
  if (idx === -1) return false;

  const ticket = tickets[idx];
  if (data.status !== undefined) {
    ticket.status     = data.status;
    ticket.resolved_at = data.status === 'resuelto' ? new Date().toISOString() : null;
  }
  if (data.priority   !== undefined) ticket.priority    = data.priority;
  if (data.assigned_to !== undefined) ticket.assigned_to = (data.assigned_to === '' || data.assigned_to === null) ? null : parseInt(data.assigned_to);
  ticket.updated_at = new Date().toISOString();
  tickets[idx] = ticket;
  localStorage.setItem('it_tickets', JSON.stringify(tickets));

  let auditMsg = '⚙️ Cambio en el ticket realizado por IT:';
  if (data.status)   auditMsg += ` [Estado ➔ ${data.status}]`;
  if (data.priority) auditMsg += ` [Prioridad ➔ ${data.priority}]`;
  if (data.assigned_to !== undefined) {
    if (!data.assigned_to) {
      auditMsg += ' [Desasignado del agente]';
    } else {
      const agents = JSON.parse(localStorage.getItem('it_agents') || '[]');
      const agent  = agents.find(a => a.id === parseInt(data.assigned_to));
      if (agent) auditMsg += ` [Asignado a: ${agent.name}]`;
    }
  }

  await addMessage(numId, 'bot', 'Sistema', auditMsg);
  return { success: true };
}

export function mockAddMessage(ticketId, senderType, senderName, content) {
  const numTicketId = parseInt(ticketId);
  const messages    = JSON.parse(localStorage.getItem('it_messages') || '[]');
  messages.push({ id: messages.length + 1, ticket_id: numTicketId, sender_type: senderType, sender_name: senderName, content, created_at: new Date().toISOString() });
  localStorage.setItem('it_messages', JSON.stringify(messages));

  const tickets = JSON.parse(localStorage.getItem('it_tickets') || '[]');
  const idx = tickets.findIndex(t => t.id === numTicketId);
  if (idx !== -1) { tickets[idx].updated_at = new Date().toISOString(); localStorage.setItem('it_tickets', JSON.stringify(tickets)); }

  return { success: true };
}

export function mockAddNote(ticketId, agentId, agentName, content) {
  const numTicketId = parseInt(ticketId);
  const notes = JSON.parse(localStorage.getItem('it_notes') || '[]');
  notes.push({ id: notes.length + 1, ticket_id: numTicketId, agent_id: parseInt(agentId), agent_name: agentName, content, created_at: new Date().toISOString() });
  localStorage.setItem('it_notes', JSON.stringify(notes));
  return { success: true };
}

export function mockGetMetrics() {
  const tickets   = JSON.parse(localStorage.getItem('it_tickets')  || '[]');
  const faqHits   = JSON.parse(localStorage.getItem('it_faq_hits') || '[]');
  const agents    = JSON.parse(localStorage.getItem('it_agents')   || '[]');

  const totalOpen       = tickets.filter(t => t.status === 'abierto').length;
  const totalInProgress = tickets.filter(t => t.status === 'en_progreso').length;
  const todayStr        = new Date().toISOString().slice(0, 10);
  const resolvedToday   = tickets.filter(t => t.status === 'resuelto' && t.resolved_at?.slice(0, 10) === todayStr).length;
  const oneWeekAgo      = new Date(Date.now() - 7 * 24 * 3600000);
  const createdThisWeek = tickets.filter(t => new Date(t.created_at) >= oneWeekAgo).length;

  const areaCounts = {};
  tickets.forEach(t => { areaCounts[t.area] = (areaCounts[t.area] || 0) + 1; });
  const byArea = Object.entries(areaCounts).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);

  const priorityCounts = {};
  tickets.forEach(t => { priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1; });
  const byPriority = Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count }));

  const faqResolvedCount = faqHits.filter(h => h.resolved === 1).length;
  const autoserviceRate  = faqHits.length > 0 ? Math.round((faqResolvedCount / faqHits.length) * 100) : 0;

  const resolvedTickets = tickets.filter(t => t.status === 'resuelto' && t.resolved_at);
  const avgHours = resolvedTickets.length > 0
    ? parseFloat((resolvedTickets.reduce((acc, t) => acc + (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000, 0) / resolvedTickets.length).toFixed(1))
    : 0;

  const recent = tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10)
    .map(t => ({ ...t, agent_name: agents.find(a => a.id === t.assigned_to)?.name || null }));

  return {
    summary: { open_tickets: totalOpen, in_progress_tickets: totalInProgress, resolved_today: resolvedToday, created_this_week: createdThisWeek, autoservice_rate: autoserviceRate, faq_total: faqHits.length, faq_resolved: faqResolvedCount, avg_resolution_hours: avgHours },
    by_area: byArea, by_priority: byPriority, recent_tickets: recent,
  };
}

export async function mockSimulateBot(phone, message, addMessageFn) {
  const cleanText  = message.trim();
  const cleanPhone = phone.replace(/\D/g, '');
  const tickets    = JSON.parse(localStorage.getItem('it_tickets') || '[]');

  // Ticket activo para este teléfono
  const activeTicket = tickets
    .filter(t => t.phone === cleanPhone && ['abierto', 'en_progreso', 'en_espera'].includes(t.status))
    .sort((a, b) => b.id - a.id)[0];

  const isCommand = ['hola', 'menu', 'reiniciar'].includes(cleanText.toLowerCase());

  if (activeTicket && !isCommand) {
    await addMessageFn(activeTicket.id, 'user', activeTicket.requester_name || 'Empleado', cleanText);
    return `📥 *Mensaje agregado al Ticket ${activeTicket.ticket_number}*\n\nHemos registrado tu mensaje en tu caso activo. El equipo de IT responderá pronto a través de este chat.\n\n_Si deseas iniciar una nueva consulta y ver el menú de áreas, escribe *menu*._`;
  }

  const conversations = JSON.parse(localStorage.getItem('it_conversations') || '{}');
  let session = conversations[cleanPhone] || { phone: cleanPhone, current_step: 'idle', area: null, selected_faq_id: null, context: '{}' };
  let step = session.current_step;
  let response = '';

  const ctx = () => { try { return JSON.parse(session.context || '{}'); } catch { return {}; } };

  // ── State machine ─────────────────────────────────────────────────────
  if (step === 'idle' || isCommand) {
    session.current_step = 'select_type'; session.area = null; session.context = '{}';
    response = `🖥️ *¡Hola! Soy el asistente de IT* 🤖\n\n¿En qué te puedo ayudar hoy?\n\n*1️⃣* 🔧 Tengo un *problema técnico*\n*2️⃣* 📋 Necesito *equipos o materiales* (requerimiento)\n*3️⃣* ⚠️ Voy a *enviar un equipo con falla* (incidencia)\n\n_Responde con el número de tu opción (ej. 1)_`;
  } else if (step === 'select_type') {
    if (cleanText === '1') {
      session.current_step = 'menu_area';
      response = `🔧 *Soporte Técnico*\n\n*¿De qué área nos escribes?*\n\n1️⃣ 💰 Cartera\n2️⃣ 🛒 Compra\n3️⃣ 👥 Gestión Humana\n4️⃣ 📋 PQRS\n5️⃣ 📊 Contabilidad\n6️⃣ 💊 Farmacia\n7️⃣ 🏥 Cuentas Médicas\n\n_Responde con el número de tu área (ej. 1)_`;
    } else if (cleanText === '2') {
      session.current_step = 'req_name'; session.context = JSON.stringify({ type: 'requerimiento' });
      response = `📋 *Solicitud de Requerimiento Tecnológico*\n\n*¿Cuál es tu nombre completo?*`;
    } else if (cleanText === '3') {
      session.current_step = 'inc_name'; session.context = JSON.stringify({ type: 'incidencia' });
      response = `⚠️ *Reporte de Equipo con Falla*\n\n*¿Cuál es tu nombre completo?*`;
    } else {
      response = `⚠️ Responde con *1*, *2* o *3*.`;
    }
  } else if (step === 'menu_area') {
    const area = AREA_MAP[cleanText];
    if (!area) {
      response = `⚠️ Opción no válida.\n\nSelecciona tu área del 1 al 7.`;
    } else {
      session.current_step = 'awaiting_description'; session.area = area;
      response = `👍 Área: *${AREA_NAMES[area]}*\n\n📝 *Cuéntame qué problema tienes.*\n\nSé específico — nombre del programa, mensaje de error, qué acción hacías.`;
    }
  } else if (step === 'awaiting_description') {
    session.current_step = 'ask_resolved'; session.context = JSON.stringify({ description: message, area: session.area });
    response = `💡 Descripción registrada.\n\n*¿Pudiste resolver el problema?*\n\n*1️⃣* Sí ✅\n*2️⃣* No, necesito ayuda ❌`;
  } else if (step === 'ask_resolved') {
    const c = ctx();
    if (cleanText === '1' || /^s[íi]/i.test(cleanText)) {
      session.current_step = 'idle'; session.area = null; session.context = '{}';
      response = `🎉 *¡Excelente!* Nos alegra que lo hayas podido resolver. ¡Feliz día!`;
    } else if (cleanText === '2' || /^no/i.test(cleanText)) {
      const area    = c.area || session.area || 'general';
      const desc    = c.description || message;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const numCount = tickets.filter(t => t.ticket_number.startsWith(`TK-${dateStr}-`)).length + 1;
      const ticketNumber = `TK-${dateStr}-${String(numCount).padStart(3, '0')}`;
      const newId   = tickets.length + 1;
      const newTicket = { id: newId, ticket_number: ticketNumber, phone: cleanPhone, requester_name: 'Empleado WhatsApp', area, category: 'general', priority: 'media', status: 'abierto', description: desc, faq_tried: '[]', assigned_to: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), resolved_at: null };
      tickets.push(newTicket); localStorage.setItem('it_tickets', JSON.stringify(tickets));
      await addMessageFn(newId, 'user', 'Empleado', desc);
      session.current_step = 'idle'; session.area = null; session.context = '{}';
      response = `🎟️ *¡Ticket creado!*\nN.º: *${ticketNumber}*\n\nEl equipo de IT fue notificado. ¡Gracias!`;
    } else {
      response = `⚠️ Responde *1* (sí) o *2* (no).`;
    }
  } else if (step === 'req_name')  { const c = ctx(); c.name  = message; session.current_step = 'req_cedula'; session.context = JSON.stringify(c); response = `✅ Nombre: *${message}*\n\n*¿Cuál es tu número de cédula?*`; }
  else if (step === 'req_cedula')  { const c = ctx(); c.cedula = message; session.current_step = 'req_cargo'; session.context = JSON.stringify(c); response = `✅ Cédula: *${message}*\n\n*¿Cuál es tu cargo?*`; }
  else if (step === 'req_cargo')   { const c = ctx(); c.cargo  = message; session.current_step = 'req_sede'; session.context = JSON.stringify(c); response = `✅ Cargo: *${message}*\n\n*¿Desde qué sede o punto nos escribes?*`; }
  else if (step === 'req_sede')    { const c = ctx(); c.sede   = message; session.current_step = 'req_desc'; session.context = JSON.stringify(c); response = `✅ Sede: *${message}*\n\n📝 *¿Qué equipos o materiales necesitas?* (incluye cantidad)`; }
  else if (step === 'req_desc')    {
    const c = ctx(); const fakeNum = `RQ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-SIM`; session.current_step = 'idle'; session.context = '{}';
    response = `✅ *¡Requerimiento registrado!*\n\n📋 *N.º:* ${fakeNum}\n\n• 👤 *Nombre:* ${c.name}\n• 🪪 *Cédula:* ${c.cedula}\n• 💼 *Cargo:* ${c.cargo}\n• 📍 *Sede:* ${c.sede}\n• 📦 *Descripción:* ${message}\n\n_(Modo simulación)_`;
  } else if (step === 'inc_name')  { const c = ctx(); c.name   = message; session.current_step = 'inc_cedula'; session.context = JSON.stringify(c); response = `✅ Nombre: *${message}*\n\n*¿Cuál es tu número de cédula?*`; }
  else if (step === 'inc_cedula')  { const c = ctx(); c.cedula = message; session.current_step = 'inc_cargo'; session.context = JSON.stringify(c); response = `✅ Cédula: *${message}*\n\n*¿Cuál es tu cargo?*`; }
  else if (step === 'inc_cargo')   { const c = ctx(); c.cargo  = message; session.current_step = 'inc_sede'; session.context = JSON.stringify(c); response = `✅ Cargo: *${message}*\n\n*¿Desde qué sede o punto nos escribes?*`; }
  else if (step === 'inc_sede')    { const c = ctx(); c.sede   = message; session.current_step = 'inc_equipo'; session.context = JSON.stringify(c); response = `✅ Sede: *${message}*\n\n🖥️ *¿Cuál es el nombre del equipo con falla?*`; }
  else if (step === 'inc_equipo')  { const c = ctx(); c.equipment_name = message; session.current_step = 'inc_desc'; session.context = JSON.stringify(c); response = `✅ Equipo: *${message}*\n\n⚠️ *Describe la falla del equipo.*`; }
  else if (step === 'inc_desc')    {
    const c = ctx(); const fakeNum = `IN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-SIM`; session.current_step = 'idle'; session.context = '{}';
    response = `✅ *¡Incidencia registrada!*\n\n🔧 *N.º:* ${fakeNum}\n\n• 👤 *Nombre:* ${c.name}\n• 🪪 *Cédula:* ${c.cedula}\n• 💼 *Cargo:* ${c.cargo}\n• 📍 *Sede:* ${c.sede}\n• 🖥️ *Equipo:* ${c.equipment_name}\n• ⚠️ *Falla:* ${message}\n\n_(Modo simulación)_`;
  }

  conversations[cleanPhone] = session;
  localStorage.setItem('it_conversations', JSON.stringify(conversations));
  return response;
}

export function mockResetSimulation(phone) {
  const cleanPhone    = phone.replace(/\D/g, '');
  const conversations = JSON.parse(localStorage.getItem('it_conversations') || '{}');
  delete conversations[cleanPhone];
  localStorage.setItem('it_conversations', JSON.stringify(conversations));
  return { success: true };
}
