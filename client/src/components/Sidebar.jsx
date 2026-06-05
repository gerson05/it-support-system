import React, { useEffect, useState } from 'react';

const MENU = [
  { hash: '#dashboard', label: 'Dashboard', id: 'nav-dashboard', perm: 'metrics:read' },
  { hash: '#tickets', label: 'Tickets', id: 'nav-tickets', perm: 'tickets:read' },
  { hash: '#tech-requests', label: 'Solicitudes', id: 'nav-tech-requests', perm: 'tech-requests:read' },
  { hash: '#inventario', label: 'Inventario', id: 'nav-inventario', perm: 'inventario:read' },
  { hash: '#farmacias', label: 'Farmacias', id: 'nav-farmacias', perm: 'farmacias:read' },
  { hash: '#registros-it', label: 'Registros IT', id: 'nav-registros-it', perm: '' },
  { hash: '#despacho', label: 'Despacho', id: 'nav-despacho', perm: 'despacho:read' },
  { hash: '#sedes', label: 'Sedes', id: 'nav-sedes', perm: 'sedes:read' },
  { hash: '#audit', label: 'Audit', id: 'nav-audit', perm: 'audit:read' },
  { hash: '#faqs', label: 'FAQs', id: 'nav-faqs', perm: 'faqs:read' },
  { hash: '#users', label: 'Usuarios', id: 'nav-users', perm: 'full' },
  { hash: '#settings', label: 'Ajustes', id: 'nav-settings', perm: '' },
];

function can(permission) {
  const user = window.appState?.currentUser;
  if (!permission) return true;
  if (!user || !user.permissions) return false;
  if (user.permissions.includes('full')) return true;
  return user.permissions.includes(permission);
}

export default function Sidebar() {
  const [active, setActive] = useState(window.location.hash || '#dashboard');

  useEffect(() => {
    const overlay = document.getElementById('sidebar-overlay');
    const close = () => document.body.classList.remove('sidebar-open');
    if (overlay) overlay.addEventListener('click', close);

    function onNavClick() { document.body.classList.remove('sidebar-open'); }
    // attach delegated listener to handle dynamically rendered items
    const container = document.querySelector('.sidebar');
    if (container) container.addEventListener('click', onNavClick);

    const onHash = () => setActive(window.location.hash || '#dashboard');
    window.addEventListener('hashchange', onHash);

    return () => {
      if (overlay) overlay.removeEventListener('click', close);
      if (container) container.removeEventListener('click', onNavClick);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  return (
    <aside className="sidebar" style={{width:240,background:'#f8fafc',height:'100vh',position:'fixed',left:0,top:0,borderRight:'1px solid #e6eef6',padding:12,zIndex:50}}>
      <nav>
        {MENU.filter(m => can(m.perm)).map(m => (
          <div key={m.id} id={m.id} className={`menu-item ${active === m.hash ? 'active' : ''}`} style={{padding:'8px 12px',cursor:'pointer'}} onClick={() => { window.location.hash = m.hash; }}>
            {m.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}
