// Simple router - replaces app-router.js with no imports

const Router = {
  routes: {},
  currentRoute: null,
  appElement: null,

  // Register route handler
  register(path, handler) {
    this.routes[path] = handler;
  },

  // Navigate to route
  async navigate(path) {
    const handler = this.routes[path];
    if (!handler) {
      console.error(`No route handler for ${path}`);
      return;
    }

    this.currentRoute = path;
    if (this.appElement) {
      this.appElement.innerHTML = '<div style="padding:20px;text-align:center;">Cargando...</div>';
      try {
        await handler(this.appElement);
      } catch (err) {
        console.error(`Route handler error for ${path}:`, err);
        this.appElement.innerHTML = `<div style="padding:20px;color:red;">Error: ${err.message}</div>`;
      }
    }

    // Update URL
    window.history.pushState({ path }, '', `#${path}`);
  },

  // Initialize router
  init(appElement = '#app') {
    if (typeof appElement === 'string') {
      this.appElement = document.querySelector(appElement);
    } else {
      this.appElement = appElement;
    }

    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
      const path = window.location.hash.slice(1) || 'dashboard';
      this.navigate(path);
    });

    // Handle menu clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[href^="#"]');
      if (link) {
        e.preventDefault();
        const path = link.getAttribute('href').slice(1);
        this.navigate(path);
      }
    });

    // Load initial route from URL or default
    const initialPath = window.location.hash.slice(1) || 'dashboard';
    this.navigate(initialPath);
  }
};

window.Router = Router;
