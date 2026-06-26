// Tech Requests API service layer
const TechRequestService = (() => {
  const API_BASE = '/api/tech-requests';

  return {
    // Fetch all tech requests
    async list(params = {}) {
      const query = new URLSearchParams(params);
      return API.get(`${API_BASE}?${query}`);
    },

    // Get single tech request
    async getById(id) {
      return API.get(`${API_BASE}/${id}`);
    },

    // Create new tech request
    async create(data) {
      return API.post(API_BASE, data);
    },

    // Update tech request
    async update(id, data) {
      return API.put(`${API_BASE}/${id}`, data);
    },

    // Delete tech request
    async delete(id) {
      return API.delete(`${API_BASE}/${id}`);
    },

    // Generate acta (official document)
    async generateActa(id, params = {}) {
      const query = new URLSearchParams(params);
      return `${API_BASE}/${id}/acta?${query}`;
    },

    // Get acta document
    async getActa(id) {
      return API.get(`${API_BASE}/${id}/acta`);
    },

    // Sign acta
    async signActa(id, signatureData) {
      return API.post(`${API_BASE}/${id}/acta/sign`, signatureData);
    },

    // Get acta PDF
    async getActaPDF(id) {
      return `${API_BASE}/${id}/acta/pdf`;
    }
  };
})();
