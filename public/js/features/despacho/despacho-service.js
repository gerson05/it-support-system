// Despacho API service layer
const DespachoService = (() => {
  const API_BASE = '/api/despacho';

  return {
    // Fetch all despachos with filters
    async list(params = {}) {
      const query = new URLSearchParams(params);
      const res = await API.get(`${API_BASE}?${query}`);
      return res;
    },

    // Get single despacho by ID
    async getById(id) {
      return API.get(`${API_BASE}/${id}`);
    },

    // Create new despacho
    async create(data) {
      return API.post(API_BASE, data);
    },

    // Update despacho
    async update(id, data) {
      return API.put(`${API_BASE}/${id}`, data);
    },

    // Delete despacho
    async delete(id) {
      return API.delete(`${API_BASE}/${id}`);
    },

    // Add article to despacho
    async addArticle(despachoId, article) {
      return API.post(`${API_BASE}/${despachoId}/articulos`, article);
    },

    // Update article
    async updateArticle(despachoId, articuloId, data) {
      return API.put(`${API_BASE}/${despachoId}/articulos/${articuloId}`, data);
    },

    // Delete article
    async deleteArticle(despachoId, articuloId) {
      return API.delete(`${API_BASE}/${despachoId}/articulos/${articuloId}`);
    },

    // Get bodegas (warehouses)
    async getBodegas() {
      return API.get(`${API_BASE}/bodegas`);
    },

    // Update bodega config
    async updateBodega(bodegaId, data) {
      return API.put(`${API_BASE}/bodegas/${bodegaId}`, data);
    }
  };
})();
