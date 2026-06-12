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
    showToast(agent ? `Sesión: ${agent.name}` : 'Sesión cambiada', 'info');
  }

  async function logout() {
    try { await fetchJson('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    window.location.replace('/login.html');
  }

  const initials = currentUser?.username
    ? currentUser.username.slice(0, 2).toUpperCase()
    : 'IT';

  return (
    <AppContext.Provider value={{ currentUser, agents, currentAgent, setCurrentAgent }}>
      <div className="app-shell">
        <Sidebar />

        <div
          id="sidebar-overlay"
          className="sidebar-overlay"
          onClick={() => document.body.classList.remove('sidebar-open')}
        />

        <div className="main-content">
          <header className="app-header">
            <div className="header-search">
              <button
                className="hamburger"
                id="sidebar-toggle"
                aria-label="Menú"
                onClick={() => document.body.classList.toggle('sidebar-open')}
              >
                <span /><span /><span />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>
                {currentUser?.username ? `Hola, ${currentUser.username}` : 'IT Support'}
              </span>
            </div>

            <div className="header-profile">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={wa.connected ? 'var(--success)' : 'var(--text-3)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, flexShrink: 0 }}>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: wa.connected ? 'var(--success)' : 'var(--danger)',
                  boxShadow: wa.connected ? '0 0 0 2px rgba(16,185,129,.25)' : 'none',
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {wa.status || 'desconectado'}
                </span>
                {!wa.connected && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={async () => {
                      const ok = await wa.connect();
                      showToast(ok ? 'Conectando WhatsApp…' : 'Error al conectar', ok ? 'info' : 'error');
                    }}
                  >
                    Conectar
                  </button>
                )}
              </div>

              {agents.length > 0 && (
                <select
                  className="agent-select"
                  style={{ width: 'auto', padding: '5px 10px' }}
                  value={currentAgent?.id || ''}
                  onChange={onAgentChange}
                >
                  <option value="">— Agente —</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}

              <div className="avatar" title={currentUser?.username}>{initials}</div>

              <button className="btn btn-ghost btn-small" onClick={logout}>
                Salir
              </button>
            </div>
          </header>

          <div className="page-container">
            {children}
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}
