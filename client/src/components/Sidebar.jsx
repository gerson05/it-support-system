import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

const MENU = [
  { hash: '#dashboard',    label: 'Dashboard',    perm: 'metrics:read'        },
  { hash: '#tickets',      label: 'Tickets',      perm: 'tickets:read'        },
  { hash: '#tech-requests',label: 'Solicitudes',  perm: 'tech-requests:read'  },
  { hash: '#inventario',   label: 'Inventario',   perm: 'inventario:read'     },
  { hash: '#farmacias',    label: 'Farmacias',    perm: 'farmacias:read'      },
  { hash: '#registros-it', label: 'Registros IT', perm: ''                    },
  { hash: '#despacho',     label: 'Despacho',     perm: 'despacho:read'       },
  { hash: '#sedes',        label: 'Sedes',        perm: 'sedes:read'          },
  { hash: '#audit',        label: 'Audit',        perm: 'audit:read'          },
  { hash: '#faqs',         label: 'FAQs',         perm: 'faqs:read'           },
  { hash: '#users',        label: 'Usuarios',     perm: 'full'                },
  { hash: '#settings',     label: 'Ajustes',      perm: ''                    },
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

  return (
    <aside ref={sidebarRef} className="sidebar" style={{ width:240, background:'#f8fafc', height:'100vh', position:'fixed', left:0, top:0, borderRight:'1px solid #e6eef6', padding:12, zIndex:50 }}>
      <nav>
        {MENU.filter(m => can(m.perm)).map(m => (
          <div
            key={m.hash}
            className={`menu-item ${active === m.hash ? 'active' : ''}`}
            style={{ padding:'8px 12px', cursor:'pointer' }}
            onClick={() => navigate(m.hash)}
          >
            {m.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}
