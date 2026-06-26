// Simple dashboard - works without legacy imports

const Dashboard = {
  async render(container) {
    try {
      // Load user
      const user = await State.loadUser();

      // Build UI
      let html = `
        <div style="padding:24px;max-width:1200px;margin:0 auto;">
          <div style="margin-bottom:24px;">
            <h1 style="font-size:24px;margin-bottom:8px;">Dashboard</h1>
            <p style="color:#666;">Bienvenido${user ? ', ' + user.username : ''}</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:32px;">
      `;

      // Quick access cards
      const cards = [
        { title: 'Tickets', icon: '🎫', href: '#tickets', perm: 'tickets:read' },
        { title: 'Despacho', icon: '📦', href: '#despacho', perm: 'despacho:read' },
        { title: 'Trazabilidad', icon: '🔍', href: '#trazabilidad', perm: 'despacho:read' },
        { title: 'Inventario', icon: '📋', href: '#inventario', perm: 'inventario:read' },
        { title: 'Requerimientos', icon: '📝', href: '#tech-requests', perm: 'tech-requests:read' },
        { title: 'Usuarios', icon: '👥', href: '#users', perm: 'full' }
      ];

      cards.forEach(card => {
        if (!user || State.can(card.perm)) {
          html += `
            <a href="${card.href}" style="
              display:flex;flex-direction:column;gap:12px;padding:20px;
              background:#f5f5f5;border-radius:8px;text-decoration:none;
              cursor:pointer;transition:all 0.2s;border:1px solid #ddd;
            " onmouseover="this.style.background='#efefef'" onmouseout="this.style.background='#f5f5f5'">
              <div style="font-size:32px;">${card.icon}</div>
              <div style="font-weight:600;color:#333;">${card.title}</div>
            </a>
          `;
        }
      });

      html += `
          </div>

          <div style="background:#f0f0f0;padding:16px;border-radius:8px;">
            <h3 style="margin-bottom:8px;">Status</h3>
            <p style="color:#666;font-size:13px;">
              ${user ? `Usuario: ${user.username}` : 'No autenticado'}
              ${user && user.role ? ` | Rol: ${user.role}` : ''}
            </p>
          </div>
        </div>
      `;

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div style="padding:24px;color:red;">Error: ${err.message}</div>`;
    }
  }
};

// Register route
Router.register('dashboard', (container) => Dashboard.render(container));
Router.register('', (container) => Dashboard.render(container)); // Default
