// Main app entry point - orchestrates all modules in correct order
// This file must be loaded with type="module" in HTML

// 1. CORE
import './core/constants.js';
import './core/api.js';
import './core/state.js';
import './core/router.js';
import './core/sse.js';
import './core/whatsapp.js';
import './core/scroll-lock.js';

// 2. UI COMPONENTS
import './ui/modal.js';
import './ui/forms.js';
import './ui/toast.js';
import './ui/components.js';

// 3. UTILS
import './utils/format.js';
import './utils/validators.js';
import './utils/dom.js';
import './utils/storage.js';
import './utils/logger.js';
import './utils/icons.js';

// 4. FEATURE SERVICES
import './features/tickets/tickets-service.js';
import './features/despacho/despacho-service.js';
import './features/tech-requests/tech-request-service.js';
import './features/tracking/tracking-service.js';
import './features/inventario/inventario-service.js';
import './features/reuniones/reuniones-service.js';
import './features/usuarios/usuarios-service.js';

// 5. FEATURE MODULES
import './features/dashboard/dashboard.js';
import './features/tickets/ticket-list.js';
import './features/tickets/ticket-detail.js';
import './features/tickets/ticket-ai-panel.js';
import './features/despacho/despacho-list.js';
import './features/despacho/despacho-detail.js';
import './features/despacho/despacho-form.js';
import './features/despacho/despacho-rotulo.js';
import './features/despacho/despacho-helpers.js';
import './features/tech-requests/tech-requests-list.js';
import './features/tech-requests/tech-request-detail.js';
import './features/tech-requests/tech-request-form.js';
import './features/tech-requests/tech-request-acta.js';
import './features/tracking/tracking-public.js';
import './features/tracking/trazabilidad.js';
import './features/inventario/inventario.js';
import './features/inventario/inventario-forms.js';
import './features/inventario/inventario-import.js';
import './features/inventario/inventario-scanner.js';
import './features/reuniones/reuniones-admin.js';
import './features/reuniones/reuniones-public.js';
import './features/usuarios/users.js';
import './features/usuarios/roles.js';
import './features/usuarios/employees.js';
import './features/usuarios/employees-form.js';
import './features/settings/settings.js';
import './features/settings/punto-setup-modal.js';
import './features/settings/sedes-admin.js';
import './features/settings/bodegas-admin.js';
import './features/audit/audit.js';
import './features/farmacias/farmacias.js';
import './features/firmar/firmar.js';
import './features/monitoreo/monitoreo.js';
import './features/herramientas/faqs.js';

// 6. INIT - Everything is loaded, initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle
  const toggle = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  const close = () => document.body.classList.remove('sidebar-open');

  if (toggle) {
    toggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  }
  if (overlay) {
    overlay.addEventListener('click', close);
  }
  document.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', close);
  });

  // Theme toggle
  document.getElementById('btn-theme-toggle')?.addEventListener('click', function () {
    var html = document.documentElement;
    var isLight = html.getAttribute('data-theme') === 'light';
    if (isLight) {
      html.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      html.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  });

  // Lucide icons
  if (window.lucide) lucide.createIcons();
  const observer = new MutationObserver(() => {
    if (window.lucide) lucide.createIcons();
  });
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: false });

  // Initialize router
  if (typeof Router !== 'undefined') {
    Router.init();
  }
});
