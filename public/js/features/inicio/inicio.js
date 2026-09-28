const modules = [
  {
    key: 'administrativo',
    title: 'Administrativo',
    description: 'Indicadores, tickets, soporte y configuración del sistema.',
    items: [
      { title: 'Dashboard', href: '#dashboard', permission: 'metrics:read', icon: 'layout-dashboard' },
      { title: 'Tickets', href: '#tickets', permission: 'tickets:read', icon: 'ticket' },
      { title: 'Requerimientos', href: '#tech-requests', permission: 'tech-requests:read', icon: 'package' },
      { title: 'Base de conocimiento', href: '#faqs', permission: 'faqs:read', icon: 'book-open' },
      { title: 'Configuración', href: '#settings', permission: 'settings:read', icon: 'settings' },
    ],
  },
  {
    key: 'operativo',
    title: 'Operativo',
    description: 'Gestión, despacho, trazabilidad y control del inventario.',
    items: [
      { title: 'Gestión', href: '#gestion', permission: 'despacho:read', icon: 'file-text' },
      { title: 'Despacho', href: '#despacho', permission: 'despacho:read', icon: 'package-check' },
      { title: 'Trazabilidad', href: '#trazabilidad', permission: 'despacho:read', icon: 'route' },
      { title: 'Inventario', href: '#inventario', permission: 'inventario:read', icon: 'package-search' },
      { title: 'Auditoría', href: '#audit', permission: 'audit:read', icon: 'shield-check' },
      { title: 'Monitoreo', href: '#monitoreo', permission: 'full', icon: 'monitor' },
    ],
  },
  {
    key: 'humana',
    title: 'Gestión humana',
    description: 'Personal, usuarios y permisos del sistema.',
    items: [
      { title: 'Usuarios', href: '#users', permission: 'full', icon: 'users' },
      { title: 'Crear usuarios', href: '#employees', permission: 'employees:read', icon: 'user-plus' },
    ],
  },
  {
    key: 'infraestructura',
    title: 'Infraestructura',
    description: 'Sedes, reuniones, red de puntos y soporte de operación.',
    items: [
      { title: 'Red de puntos', href: '#sedes', permission: 'sedes:read', icon: 'map-pin' },
      { title: 'Calendario', href: '#reuniones', permission: 'reuniones:read', icon: 'calendar' },
      { title: 'Farmacias FOMAG', href: '/farmacias.html', permission: 'farmacias:read', icon: 'map' },
    ],
  },
];

function can(permission, userPermissions = []) {
  if (!permission) return true;
  if (userPermissions.includes('full')) return true;
  return userPermissions.includes(permission);
}

function itemCard(item, userPermissions) {
  const allowed = can(item.permission, userPermissions);
  if (!allowed) return '';

  const href = item.href.startsWith('#') ? item.href : item.href;
  return `
    <a href="${href}" class="menu-card" style="text-decoration:none;display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);transition:all .2s ease;min-height:64px;">
      <span style="width:36px;height:36px;border-radius:10px;background:var(--primary-soft, rgba(99,102,241,.12));display:flex;align-items:center;justify-content:center;color:var(--primary);">
        <i data-lucide="${item.icon}" class="lucide"></i>
      </span>
      <span style="font-weight:600;font-size:14px;">${item.title}</span>
    </a>
  `;
}

export function renderInicio(container) {
  const userPermissions = window.__APP_USER_PERMISSIONS__ || [];
  const visibleGroups = modules
    .map(group => ({
      ...group,
      items: group.items.filter(item => can(item.permission, userPermissions)),
    }))
    .filter(group => group.items.length > 0);

  container.innerHTML = `
    <div style="padding: 18px 0 24px;">
      <div style="margin-bottom:22px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--text-3);margin-bottom:8px;">Inicio</div>
        <h2 style="margin:0;font-size:30px;line-height:1.1;letter-spacing:-.8px;">Panel principal</h2>
        <p style="margin:8px 0 0;color:var(--text-3);font-size:14px;">Acceso rápido por área para gestión, soporte y operación.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;">
        ${visibleGroups.map(group => `
          <section class="card" style="padding:18px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
              <div>
                <h3 style="margin:0;font-size:16px;letter-spacing:-.3px;">${group.title}</h3>
                <p style="margin:5px 0 0;color:var(--text-3);font-size:12px;line-height:1.4;">${group.description}</p>
              </div>
            </div>
            <div style="display:grid;gap:10px;">
              ${group.items.map(item => itemCard(item, userPermissions)).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}
