import { renderDashboard }         from '../features/dashboard/dashboard.js';
import { renderInventario }         from '../features/inventario/inventario.js';
import { renderTicketList }         from '../features/tickets/ticket-list.js';
import { renderTicketDetail }       from '../features/tickets/ticket-detail.js';
import { renderSettings }           from '../features/settings/settings.js';
import { renderTechRequests }       from '../features/tech-requests/tech-requests-list.js';
import { renderTechRequestDetail }  from '../features/tech-requests/tech-request-detail.js';
import { renderFaqs }               from '../features/herramientas/faqs.js';
import { renderSedesAdmin }         from '../features/settings/sedes-admin.js';
import { renderReuniones }          from '../features/reuniones/reuniones-admin.js';
import { renderAudit }              from '../features/audit/audit.js';
import { renderDespacho }           from '../features/despacho/despacho-list.js';
import { renderTrazabilidad }       from '../features/tracking/trazabilidad.js';
import { renderMonitoreo }          from '../features/monitoreo/monitoreo.js';
import { renderUsers }              from '../features/usuarios/users.js';
import { renderEmployees }          from '../features/usuarios/employees.js';
import { state, can, firstAccessibleHash } from './state.js';

function guard(permission) {
  if (state.currentUser && !can(permission)) {
    window.location.hash = firstAccessibleHash();
    return false;
  }
  return true;
}

function activate(navId, page) {
  state.currentPage = page;
  document.getElementById(navId)?.classList.add('active');
}

export function router() {
  const hash = window.location.hash || '#dashboard';
  const app  = document.getElementById('app');

  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

  if (hash.startsWith('#ticket/')) {
    if (!guard('tickets:read')) return;
    activate('nav-tickets', 'ticket-detail');
    renderTicketDetail(app, hash.split('/')[1]);

  } else if (hash.startsWith('#tech-request/')) {
    if (!guard('tech-requests:read')) return;
    activate('nav-tech-requests', 'tech-request-detail');
    renderTechRequestDetail(app, hash.split('/')[1]);

  } else {
    const ROUTES = {
      '#dashboard':    { perm: 'metrics:read',       nav: 'nav-dashboard',     page: 'dashboard',            render: () => renderDashboard(app) },
      '#tickets':      { perm: 'tickets:read',        nav: 'nav-tickets',       page: 'tickets',              render: () => renderTicketList(app) },
      '#tech-requests':{ perm: 'tech-requests:read',  nav: 'nav-tech-requests', page: 'tech-requests',        render: () => renderTechRequests(app) },
      '#faqs':         { perm: 'faqs:read',           nav: 'nav-faqs',          page: 'faqs',                 render: () => renderFaqs(app) },
      '#settings':     { perm: null,                  nav: 'nav-settings',      page: 'settings',             render: () => renderSettings(app) },
      '#sedes':        { perm: 'sedes:read',          nav: 'nav-sedes',         page: 'sedes',                render: () => renderSedesAdmin(app) },
      '#reuniones':    { perm: 'reuniones:read',      nav: 'nav-reuniones',     page: 'reuniones',            render: () => renderReuniones(app) },
      '#despacho':     { perm: 'despacho:read',       nav: 'nav-despacho',      page: 'despacho',             render: () => renderDespacho(app) },
      '#trazabilidad': { perm: 'despacho:read',       nav: 'nav-trazabilidad',  page: 'trazabilidad',         render: () => renderTrazabilidad(app) },
      '#audit':        { perm: 'audit:read',          nav: 'nav-audit',         page: 'audit',                render: () => renderAudit(app) },
      '#inventario':   { perm: 'inventario:read',     nav: 'nav-inventario',    page: 'inventario',           render: () => renderInventario(app) },
      '#monitoreo':    { perm: 'full',                nav: 'nav-monitoreo',     page: 'monitoreo',            render: () => renderMonitoreo(app) },
      '#users':        { perm: 'full',                nav: 'nav-users',         page: 'users',                render: () => renderUsers(app) },
      '#employees':    { perm: 'employees:read',       nav: 'nav-employees',     page: 'employees',            render: () => renderEmployees(app) },
    };

    const route = ROUTES[hash] || ROUTES['#dashboard'];
    if (route.perm && !guard(route.perm)) return;
    activate(route.nav, route.page);
    try {
      const result = route.render();
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          console.error(`[Router] Error rendering ${hash}:`, err);
          if (app) app.innerHTML = `<div style="padding:24px;color:red;"><h3>Error rendering ${hash}</h3><pre>${err.message}</pre></div>`;
        });
      }
    } catch (err) {
      console.error(`[Router] Sync error rendering ${hash}:`, err);
      if (app) app.innerHTML = `<div style="padding:24px;color:red;"><h3>Error</h3><pre>${err.message}</pre></div>`;
    }
  }
}
