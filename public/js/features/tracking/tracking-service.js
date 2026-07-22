// Tracking/Trazabilidad API service layer
const TrackingService = (() => {
  const API_BASE = '/api/tracking';

  return {
    // Get tracking info by token
    async getByToken(token) {
      return API.get(`${API_BASE}/${token}`);
    },

    // Search tracking
    async search(query) {
      return API.get(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    },

    // Get trazabilidad history
    async getHistory(token) {
      return API.get(`${API_BASE}/${token}/history`);
    },

    // Update tracking status
    async updateStatus(token, status) {
      return API.put(`${API_BASE}/${token}`, { status });
    },

    // Add tracking event
    async addEvent(token, event) {
      return API.post(`${API_BASE}/${token}/events`, event);
    },

  };
})();
