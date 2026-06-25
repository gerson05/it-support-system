/**
 * data-service-api.js
 *
 * Online-mode REST API layer:
 *  - Communicates with the backend server via fetch requests.
 */

export const apiService = {
  async getAgents() {
    const res = await fetch('/api/agents');
    if (!res.ok) throw new Error(`agents error ${res.status}`);
    return res.json();
  },

  async getTickets(filters = {}) {
    const res = await fetch(`/api/tickets?${new URLSearchParams(filters)}`);
    if (!res.ok) throw new Error(`tickets error ${res.status}`);
    return res.json();
  },

  async getTicketById(id) {
    const numId = parseInt(id);
    const res = await fetch(`/api/tickets/${numId}`);
    if (!res.ok) throw new Error(`ticket error ${res.status}`);
    return res.json();
  },

  async updateTicket(id, data) {
    const numId = parseInt(id);
    const res = await fetch(`/api/tickets/${numId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`update ticket error ${res.status}`);
    return res.json();
  },

  async addMessage(ticketId, senderType, senderName, content) {
    const numTicketId = parseInt(ticketId);
    // Note: The API only supports posting messages if senderType is 'agent' or if the API accepts it.
    // In the original data-service.js:
    // if (!isOfflineMode && senderType === 'agent') { ... }
    // Let's implement that logic here:
    if (senderType !== 'agent') {
      throw new Error('API only supports sending agent messages');
    }
    const res = await fetch(`/api/tickets/${numTicketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName: senderName, content }),
    });
    if (!res.ok) throw new Error(`add message error ${res.status}`);
    return res.json();
  },

  async addInternalNote(ticketId, agentId, agentName, content) {
    const numTicketId = parseInt(ticketId);
    const res = await fetch(`/api/tickets/${numTicketId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, agentName, content }),
    });
    if (!res.ok) throw new Error(`add note error ${res.status}`);
    return res.json();
  },

  async getMetrics() {
    const res = await fetch('/api/metrics');
    if (!res.ok) throw new Error(`metrics error ${res.status}`);
    return res.json();
  },

  async simulateBotMessage(phone, message) {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message }),
    });
    if (!res.ok) throw new Error(`simulate error ${res.status}`);
    return (await res.json()).response;
  },

  async resetSimulation(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    const res = await fetch('/api/simulate/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone }),
    });
    if (!res.ok) throw new Error(`reset error ${res.status}`);
    return res.json();
  },

  /* ── Online-only: sin fallback offline ──────────────────────────────── */

  async analyzeTicket(problema, ticketId) {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problema, ticket_id: ticketId }),
    });
    if (!res.ok) throw new Error(`analyze error ${res.status}`);
    return res.json(); // { kb: [...], ai: string|null }
  },

  async getOnlineAgents() {
    const res = await fetch('/api/monitoring/agents');
    if (!res.ok) throw new Error(`agents error ${res.status}`);
    return (await res.json()).filter(a => a.status === 'online');
  },

  async executeRemoteCommand(agentId, commands) {
    const parametro = commands.join('\r\n');
    const res = await fetch(`/api/monitoring/agents/${encodeURIComponent(agentId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'shell', parametro }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `command error ${res.status}`);
    }
    return res.json(); // { cmd_id }
  },

  async getCommandStatus(agentId, cmdId) {
    const res = await fetch(`/api/monitoring/agents/${encodeURIComponent(agentId)}/commands`);
    if (!res.ok) throw new Error(`commands error ${res.status}`);
    const list = await res.json();
    return list.find(c => c.id === cmdId) || null;
    // { id, estado: 'pendiente'|'ejecutando'|'completado'|'error', output, exit_code }
  },
};
