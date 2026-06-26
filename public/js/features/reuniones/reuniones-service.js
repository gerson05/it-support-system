// Reuniones API service layer
const ReunionesService = (() => {
  const API_BASE = '/api/reuniones';

  return {
    // Fetch all reuniones
    async list(params = {}) {
      const query = new URLSearchParams(params);
      return API.get(`${API_BASE}?${query}`);
    },

    // Get single reunion
    async getById(id) {
      return API.get(`${API_BASE}/${id}`);
    },

    // Create new reunion
    async create(data) {
      return API.post(API_BASE, data);
    },

    // Update reunion
    async update(id, data) {
      return API.put(`${API_BASE}/${id}`, data);
    },

    // Delete reunion
    async delete(id) {
      return API.delete(`${API_BASE}/${id}`);
    },

    // Add attendee
    async addAttendee(reunionId, userId) {
      return API.post(`${API_BASE}/${reunionId}/attendees`, { user_id: userId });
    },

    // Get attendees
    async getAttendees(reunionId) {
      return API.get(`${API_BASE}/${reunionId}/attendees`);
    },

    // Add note to reunion
    async addNote(reunionId, note) {
      return API.post(`${API_BASE}/${reunionId}/notes`, { content: note });
    }
  };
})();
