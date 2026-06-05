import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import fetchJson from '../utils/fetchJson';
import DataService from '../utils/dataService';
import { showToast } from '../utils/ui';
import useModalScrollLock from '../hooks/useModalScrollLock';
import useWhatsAppMonitor from '../hooks/useWhatsAppMonitor';
import { AppContext } from '../context/AppContext';

export default function AppShell({ children }) {
  const [currentUser, setCurrentUser]   = useState(null);
  const [agents, setAgents]             = useState([]);
  const [currentAgent, setCurrentAgent] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const me = await fetchJson('/api/auth/me');
        if (!mounted) return;
        setCurrentUser(me);
      } catch {
        window.location.replace('/login.html');
        return;
      }
      try {
        const res  = await DataService.getAgents();
        const list = res.agents || res || [];
        if (!mounted) return;
        setAgents(list);
        setCurrentAgent(list[0] || null);
      } catch {
        showToast('Fallo al obtener agentes', 'error');
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  useModalScrollLock();
  const wa = useWhatsAppMonitor(3000);

  function onAgentChange(ev) {
    const id    = parseInt(ev.target.value);
    const agent = agents.find(a => a.id === id) || null;
    setCurrentAgent(agent);
    showToast(agent ? `Sesión cambiada a: ${agent.name}` : 'Sesión cambiada', 'info');
  }

  async function logout() {
    try { await fetchJson('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    window.location.replace('/login.html');
  }

  return (
    <AppContext.Provider value={{ currentUser, agents, currentAgent, setCurrentAgent }}>
      <div className="app-shell">
        <Sidebar />
        <div
          id="sidebar-overlay"
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'none', zIndex:40 }}
          onClick={() => document.body.classList.remove('sidebar-open')}
        />
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:12, borderBottom:'1px solid #e6eef6' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button id="sidebar-toggle" onClick={() => document.body.classList.toggle('sidebar-open')}>☰</button>
            <div style={{ fontWeight:700 }}>IT Support</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:12 }}>
              <div style={{ width:10, height:10, borderRadius:6, background: wa.connected ? '#16a34a' : '#ef4444' }} />
              <div style={{ fontSize:13 }}>{wa.status || 'desconectado'}</div>
              {!wa.connected && (
                <button
                  onClick={async () => {
                    const ok = await wa.connect();
                    showToast(ok ? 'Iniciando conexión de WhatsApp' : 'Error al conectar WhatsApp', ok ? 'info' : 'error');
                  }}
                  style={{ marginLeft:8 }}
                >
                  Conectar WhatsApp
                </button>
              )}
            </div>
            {agents.length > 0 && (
              <select value={currentAgent?.id || ''} onChange={onAgentChange}>
                <option value="">-- Agente --</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <div style={{ marginRight:8 }}>{currentUser?.username || ''}</div>
            <button onClick={logout}>Salir</button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </AppContext.Provider>
  );
}
