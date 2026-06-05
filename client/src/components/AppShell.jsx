import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import fetchJson from '../utils/fetchJson';
import DataService from '../utils/dataService';
import { showToast } from '../utils/ui';
import useModalScrollLock from '../hooks/useModalScrollLock';
import useWhatsAppMonitor from '../hooks/useWhatsAppMonitor';

export default function AppShell({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const me = await fetchJson('/api/auth/me');
        if (!mounted) return;
        setCurrentUser(me);
        window.appState = window.appState || {};
        window.appState.currentUser = me;
      } catch (e) {
        // if unauthorized, redirect to login page
        window.location.replace('/login.html');
        return;
      }

      try {
        const res = await DataService.getAgents();
        const list = res.agents || res || [];
        if (!mounted) return;
        setAgents(list);
        const initial = list.length ? list[0] : null;
        setCurrentAgent(initial);
        window.appState = window.appState || {};
        window.appState.currentAgent = initial;
      } catch (err) {
        showToast('Fallo al obtener agentes', 'error');
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  // Modal scroll lock (legacy behavior)
  useModalScrollLock();

  // WhatsApp monitor
  const wa = useWhatsAppMonitor(3000);


  function onAgentChange(ev) {
    const id = parseInt(ev.target.value);
    const agent = agents.find(a => a.id === id) || null;
    setCurrentAgent(agent);
    window.appState = window.appState || {};
    window.appState.currentAgent = agent;
    showToast(agent ? `Sesión cambiada a: ${agent.name}` : 'Sesión cambiada', 'info');
  }

  async function logout() {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    window.location.replace('/login.html');
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div id="sidebar-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'none',zIndex:40}} onClick={()=>document.body.classList.remove('sidebar-open')} />
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:12,borderBottom:'1px solid #e6eef6'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button id="sidebar-toggle" onClick={()=>document.body.classList.toggle('sidebar-open')}>☰</button>
          <div style={{fontWeight:700}}>IT Support</div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginRight:12}}>
            <div id="wa-status-dot" style={{width:10,height:10,borderRadius:6,background: wa.connected ? '#16a34a' : '#ef4444'}} />
            <div id="wa-status-text" style={{fontSize:13}}>{wa.status || 'desconectado'}</div>
            {!wa.connected && (
              <button id="btn-wa-connect" onClick={async()=>{ const ok = await wa.connect(); showToast(ok? 'Iniciando conexión de WhatsApp':'Error al conectar WhatsApp', ok? 'info':'error'); }} style={{marginLeft:8}}>Conectar WhatsApp</button>
            )}
          </div>

          {agents.length > 0 && (
            <select id="agent-select" value={currentAgent?.id || ''} onChange={onAgentChange}>
              <option value="">-- Agente --</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          <div id="current-user-label" style={{marginRight:8}}>{currentUser?.username || ''}</div>
          <button id="btn-logout" onClick={logout}>Salir</button>
        </div>
      </header>

      <main>
        {children}
      </main>
    </div>
  );
}
