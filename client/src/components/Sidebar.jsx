import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

const IC = ({ d, d2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

const MENU = [
  { hash: '#dashboard',     label: 'Dashboard',    perm: 'metrics:read',       icon: { d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' } },
  { hash: '#tickets',       label: 'Tickets',      perm: 'tickets:read',       icon: { d: 'M15 5H9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z', d2: 'M9 9h6M9 13h4' } },
  { hash: '#tech-requests', label: 'Solicitudes',  perm: 'tech-requests:read', icon: { d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2', d2: 'M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM9 12h6M9 16h4' } },
  { hash: '#inventario',    label: 'Inventario',   perm: 'inventario:read',    icon: { d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', d2: 'M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12' } },
  { hash: '#farmacias',     label: 'Farmacias',    perm: 'farmacias:read',     icon: { d: 'M12 2a3 3 0 0 0-3 3v1H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3z', d2: 'M9 13h6M12 10v6' } },
  { hash: '#registros-it',  label: 'Registros IT', perm: '',                   icon: { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', d2: 'M14 2v6h6M8 13h8M8 17h5' } },
  { hash: '#despacho',      label: 'Despacho',     perm: 'despacho:read',      icon: { d: 'M1 3h15v13H1z', d2: 'M16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z' } },
  { hash: '#trazabilidad', label: 'Trazabilidad', perm: 'despacho:read',      icon: { d: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z', d2: 'M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' } },
  { hash: '#sedes',         label: 'Sedes',        perm: 'sedes:read',         icon: { d: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z', d2: 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' } },
  { hash: '#audit',         label: 'Auditoría',    perm: 'audit:read',         icon: { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' } },
  { hash: '#faqs',          label: 'FAQs',         perm: 'faqs:read',          icon: { d: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', d2: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01' } },
  { hash: '#users',         label: 'Usuarios',     perm: 'full',               icon: { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', d2: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' } },
  { hash: '#settings',      label: 'Ajustes',      perm: '',                   icon: { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', d2: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' } },
];

export default function Sidebar() {
  const { currentUser } = useApp() || {};
  const [active, setActive] = useState(window.location.hash || '#dashboard');
  const sidebarRef = useRef(null);

  function can(permission) {
    if (!permission) return true;
    if (!currentUser?.permissions) return false;
    if (currentUser.permissions.includes('full')) return true;
    return currentUser.permissions.includes(permission);
  }

  useEffect(() => {
    const onHash = () => setActive(window.location.hash || '#dashboard');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(hash) {
    window.location.hash = hash;
    document.body.classList.remove('sidebar-open');
  }

  const initials = currentUser?.username
    ? currentUser.username.slice(0, 2).toUpperCase()
    : 'IT';

  return (
    <aside ref={sidebarRef} className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
          </svg>
        </div>
        <div className="brand-text">
          <h1>IT Support</h1>
          <span>Panel de control</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        {MENU.filter(m => can(m.perm)).map(m => (
          <div
            key={m.hash}
            className={`menu-item${active === m.hash ? ' active' : ''}`}
            onClick={() => navigate(m.hash)}
          >
            {m.icon && <IC d={m.icon.d} d2={m.icon.d2} />}
            {m.label}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>{currentUser?.username || '—'}</span>
        <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{initials}</div>
      </div>
    </aside>
  );
}
