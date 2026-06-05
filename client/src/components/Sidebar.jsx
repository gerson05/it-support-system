import React, { useEffect } from 'react';

const MENU = [
  { hash: '#dashboard', label: 'Dashboard', id: 'nav-dashboard' },
  { hash: '#tickets', label: 'Tickets', id: 'nav-tickets' },
  { hash: '#tech-requests', label: 'Solicitudes', id: 'nav-tech-requests' },
  { hash: '#inventario', label: 'Inventario', id: 'nav-inventario' },
  { hash: '#despacho', label: 'Despacho', id: 'nav-despacho' },
  { hash: '#settings', label: 'Ajustes', id: 'nav-settings' },
];

export default function Sidebar() {
  useEffect(() => {
    const overlay = document.getElementById('sidebar-overlay');
    const close = () => document.body.classList.remove('sidebar-open');
    if (overlay) overlay.addEventListener('click', close);

    // Close sidebar when any menu item is clicked
    const onNavClick = () => { document.body.classList.remove('sidebar-open'); };
    const items = document.querySelectorAll('.menu-item');
    items.forEach(i => i.addEventListener('click', onNavClick));

    return () => {
      if (overlay) overlay.removeEventListener('click', close);
      items.forEach(i => i.removeEventListener('click', onNavClick));
    };
  }, []);

  return (
    <aside className="sidebar" style={{width:240,background:'#f8fafc',height:'100vh',position:'fixed',left:0,top:0,borderRight:'1px solid #e6eef6',padding:12}}>
      <nav>
        {MENU.map(m => (
          <div key={m.id} id={m.id} className="menu-item" style={{padding:'8px 12px',cursor:'pointer'}} onClick={() => window.location.hash = m.hash}>
            {m.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}
