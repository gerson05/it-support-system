// LocalStorage wrapper utilities
const Storage = {
  set(key, value, prefix = 'app_') {
    try {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage.set failed:', e);
    }
  },

  get(key, prefix = 'app_') {
    try {
      const item = localStorage.getItem(prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Storage.get failed:', e);
      return null;
    }
  },

  remove(key, prefix = 'app_') {
    localStorage.removeItem(prefix + key);
  },

  clear(prefix = 'app_') {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  },

  // Session storage (shorter lifetime)
  setSession(key, value, prefix = 'session_') {
    try {
      sessionStorage.setItem(prefix + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage.setSession failed:', e);
    }
  },

  getSession(key, prefix = 'session_') {
    try {
      const item = sessionStorage.getItem(prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Storage.getSession failed:', e);
      return null;
    }
  }
};
