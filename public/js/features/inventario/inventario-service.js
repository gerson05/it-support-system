// Inventario API service layer
const InventarioService = (() => {
  const API_BASE = '/api/inventario';

  return {
    // Fetch all items
    async list(params = {}) {
      const query = new URLSearchParams(params);
      return API.get(`${API_BASE}?${query}`);
    },

    // Get single item
    async getById(id) {
      return API.get(`${API_BASE}/${id}`);
    },

    // Create new item
    async create(data) {
      return API.post(API_BASE, data);
    },

    // Update item
    async update(id, data) {
      return API.put(`${API_BASE}/${id}`, data);
    },

    // Delete item
    async delete(id) {
      return API.delete(`${API_BASE}/${id}`);
    },

    // Import from Excel
    async importExcel(file) {
      const formData = new FormData();
      formData.append('file', file);
      return API.post(`${API_BASE}/import`, formData);
    },

    // Scan QR/barcode
    async scanCode(code) {
      return API.post(`${API_BASE}/scan`, { code });
    },

    // Get bodegas (warehouses)
    async getBodegas() {
      return API.get(`${API_BASE}/bodegas`);
    }
  };
})();
