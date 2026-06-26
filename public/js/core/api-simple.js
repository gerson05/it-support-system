// Simple API client - replaces data-service.js with no imports
// Global: window.API or just API

const API = {
  baseURL: '/api',
  token: null,

  // Get auth token from session
  getToken() {
    if (!this.token) {
      this.token = sessionStorage.getItem('auth_token');
    }
    return this.token;
  },

  // Build request headers
  headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  // Generic fetch wrapper
  async request(method, endpoint, data = null) {
    const url = `${this.baseURL}${endpoint}`;
    const opts = {
      method,
      headers: this.headers(),
      credentials: 'include'
    };

    if (data) {
      opts.body = JSON.stringify(data);
    }

    try {
      const res = await fetch(url, opts);

      // Handle auth errors
      if (res.status === 401) {
        sessionStorage.removeItem('auth_token');
        window.location.href = '/login.html';
        return null;
      }

      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      // Try to parse JSON, fallback to text
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      console.error(`API ${method} ${endpoint} failed:`, err);
      throw err;
    }
  },

  // Convenience methods
  async get(endpoint) {
    return this.request('GET', endpoint);
  },

  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },

  async put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  },

  async patch(endpoint, data) {
    return this.request('PATCH', endpoint, data);
  },

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
};

// Expose globally
window.API = API;
