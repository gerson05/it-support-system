import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import TicketsList from './components/TicketsList';
import TicketDetail from './components/TicketDetail';
import TechRequests from './components/TechRequests';
import TechRequestDetail from './components/TechRequestDetail';
import Settings from './components/Settings';
import SedesAdmin from './components/SedesAdmin';
import Despacho from './pages/Despacho';
import Roles from './components/Roles';
import Audit from './components/Audit';
import InventarioApp from './components/InventarioApp';
import Users from './components/Users';

export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#dashboard');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#dashboard');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Initialize SSE connection for real-time updates
  useEffect(() => {
    let mounted = true;
    import('./hooks/useSSE').then(mod => { if (mounted) mod.default(); }).catch(()=>{});
    return () => { mounted = false; };
  }, []);

  if (hash.startsWith('#ticket/')) return <TicketDetail />;
  if (hash === '#tickets') return <TicketsList />;
  if (hash.startsWith('#tech-request/')) return <TechRequestDetail />;
  if (hash === '#tech-requests') return <TechRequests />;
  if (hash === '#faqs') return <div style={{padding:20}}>FAQs (migrar)</div>;
  if (hash === '#sedes') return <SedesAdmin />;
  if (hash === '#despacho') return <Despacho />;
  if (hash === '#audit') return <Audit />;
  if (hash === '#inventario') return <InventarioApp />;
  if (hash === '#roles') return <Roles />;
  if (hash === '#users') return <Users />;
  if (hash === '#settings') return <Settings />;
  return <Dashboard />;
}
