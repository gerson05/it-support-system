// Usuarios/Users API service layer
const UsuariosService = (() => {
  const API_BASE = '/api/users';

  return {
    // Fetch all users
    async list(params = {}) {
      const query = new URLSearchParams(params);
      return API.get(`${API_BASE}?${query}`);
    },

    // Get current user
    async getCurrent() {
      return API.get(`${API_BASE}/me`);
    },

    // Get single user
    async getById(id) {
      return API.get(`${API_BASE}/${id}`);
    },

    // Create new user
    async create(data) {
      return API.post(API_BASE, data);
    },

    // Update user
    async update(id, data) {
      return API.put(`${API_BASE}/${id}`, data);
    },

    // Delete user
    async delete(id) {
      return API.delete(`${API_BASE}/${id}`);
    },

    // Update user role
    async updateRole(id, roleId) {
      return API.put(`${API_BASE}/${id}`, { role_id: roleId });
    },

    // Get all roles
    async getRoles() {
      return API.get(`/api/roles`);
    },

    // Get permissions for user
    async getPermissions(id) {
      return API.get(`${API_BASE}/${id}/permissions`);
    },

    // Search employees
    async searchEmployees(query) {
      return API.get(`/api/employees/search?q=${encodeURIComponent(query)}`);
    }
  };
})();
