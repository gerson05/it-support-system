import { renderDashboard }         from './dashboard.js';
import { renderInventario }         from './inventario.js';
import { renderTicketList }         from './ticket-list.js';
import { renderTicketDetail }       from './ticket-detail.js';
import { renderSettings }           from './settings.js';
import { renderTechRequests }       from './tech-requests.js';
import { renderTechRequestDetail }  from './tech-request-detail.js';
import { renderFaqs }               from './faqs.js';
import { renderSedesAdmin }         from './sedes-admin.js';
import { renderReuniones }          from './reuniones-admin.js';
import { renderAudit }              from './audit.js';
import { renderDespacho }           from './despacho.js';
import { renderTrazabilidad }       from './trazabilidad.js';
import { renderMonitoreo }          from './monitoreo.js';
import { renderUsers }              from './users.js';
import { state, can, firstAccessibleHash } from './app-state.js';

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
    };

    const route = ROUTES[hash] || ROUTES['#dashboard'];
    if (route.perm && !guard(route.perm)) return;
    activate(route.nav, route.page);
    route.render();
  }
}
