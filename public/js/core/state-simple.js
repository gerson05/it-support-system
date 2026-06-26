// Simple state management - replaces app-state.js with no imports

const State = {
  currentUser: null,
  currentPage: 'dashboard',
  data: {},

  // Load current user from API or session
  async loadUser() {
    try {
      this.currentUser = await API.get('/auth/me');
      return this.currentUser;
    } catch (err) {
      console.warn('Failed to load user:', err);
      return null;
    }
  },

  // Check if user has permission
  can(permission) {
    if (!this.currentUser) return false;
    if (!this.currentUser.permissions) return false;
    return this.currentUser.permissions.includes(permission);
  },

  // Get current user or null
  getUser() {
    return this.currentUser;
  },

  // Set page
  setPage(page) {
    this.currentPage = page;
  },

  // Cache data
  set(key, value) {
    this.data[key] = value;
  },

  get(key) {
    return this.data[key];
  }
};

window.State = State;
