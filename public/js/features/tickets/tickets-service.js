// Tickets API service layer
const TicketsService = (() => {
  const API_BASE = '/api/tickets';

  return {
    // Fetch all tickets with filters
    async list(params = {}) {
      const query = new URLSearchParams(params);
      return API.get(`${API_BASE}?${query}`);
    },

    // Get single ticket by ID
    async getById(id) {
      return API.get(`${API_BASE}/${id}`);
    },

    // Create new ticket
    async create(data) {
      return API.post(API_BASE, data);
    },

    // Update ticket
    async update(id, data) {
      return API.put(`${API_BASE}/${id}`, data);
    },

    // Delete ticket
    async delete(id) {
      return API.delete(`${API_BASE}/${id}`);
    },

    // Add note to ticket
    async addNote(ticketId, note) {
      return API.post(`${API_BASE}/${ticketId}/notes`, { content: note });
    },

    // Add message to ticket
    async addMessage(ticketId, message) {
      return API.post(`${API_BASE}/${ticketId}/messages`, { text: message });
    },

    // Get ticket messages
    async getMessages(ticketId) {
      return API.get(`${API_BASE}/${ticketId}/messages`);
    },

    // Get AI analysis for ticket
    async getAIAnalysis(ticketId) {
      return API.get(`${API_BASE}/${ticketId}/ai-analysis`);
    },

    // Assign ticket
    async assign(ticketId, userId) {
      return API.put(`${API_BASE}/${ticketId}`, { assigned_to: userId });
    },

    // Change ticket status
    async changeStatus(ticketId, status) {
      return API.put(`${API_BASE}/${ticketId}`, { status });
    }
  };
})();
