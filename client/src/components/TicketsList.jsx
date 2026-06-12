import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

export default function TicketsList() {
  const [mode, setMode]           = useState('activos');
  const [page, setPage]           = useState(1);
  const [tickets, setTickets]     = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(false);
  const searchRef = useRef();
  const [filters, setFilters] = useState({ priority:'', area:'', status:'', assigned_to:'' });

  useEffect(() => { fetchTickets(); }, [mode, page, filters]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (searchRef.current?.value) params.set('search', searchRef.current.value);
      if (filters.priority)    params.set('priority', filters.priority);
      if (filters.area)        params.set('area', filters.area);
      if (filters.status)      params.set('status', filters.status);
      if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
      if (mode === 'archivo')  params.set('status_group', 'archivo');
      const data = await fetchJson(`/api/tickets?${params.toString()}`);
      setTickets(data.tickets || []);
      setTotalPages(data.total_pages || 1);
    } catch { setTickets([]); setTotalPages(1); }
    finally { setLoading(false); }
  }

  function onFilterChange(key, value) { setFilters(f => ({ ...f, [key]: value })); setPage(1); }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h2 style={{ marginBottom:4 }}>Tickets</h2>
          <p style={{ color:'var(--text-3)', fontSize:13 }}>Administra y responde los casos técnicos.</p>
        </div>
        <button className="btn btn-secondary btn-small" onClick={fetchTickets}>Refrescar</button>
      </div>

      <div style={{ display:'flex', gap:0, borderBottom:'2px solid var(--border)', marginBottom:12 }}>
        <button className={mode==='activos' ? 'tab-btn tab-active' : 'tab-btn'} onClick={() => { setMode('activos'); setPage(1); }}>Activos</button>
        <button className={mode==='archivo' ? 'tab-btn tab-active' : 'tab-btn'} onClick={() => { setMode('archivo'); setPage(1); }}>Archivo</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <input
          ref={searchRef}
          className="form-control"
          style={{ flex:1, minWidth:180 }}
          placeholder="Buscar ID, teléfono, descripción…"
          onChange={() => { setPage(1); fetchTickets(); }}
        />
        <select className="form-control" style={{ width:'auto' }} value={filters.status} onChange={e => onFilterChange('status', e.target.value)}>
          <option value="">Estado</option>
          <option value="siguiente_dia">Siguiente día</option>
          <option value="abierto">Abierto</option>
          <option value="en_progreso">En Progreso</option>
          <option value="en_espera">En Espera</option>
        </select>
        <select className="form-control" style={{ width:'auto' }} value={filters.priority} onChange={e => onFilterChange('priority', e.target.value)}>
          <option value="">Prioridad</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>
        <select className="form-control" style={{ width:'auto' }} value={filters.area} onChange={e => onFilterChange('area', e.target.value)}>
          <option value="">Área</option>
          <option value="cartera">Cartera</option>
          <option value="compra">Compra</option>
          <option value="gestion_humana">Gestión Humana</option>
          <option value="pqrs">PQRS</option>
          <option value="contabilidad">Contabilidad</option>
          <option value="farmacia">Farmacia</option>
          <option value="general">General</option>
        </select>
        <select className="form-control" style={{ width:'auto' }} value={filters.assigned_to} onChange={e => onFilterChange('assigned_to', e.target.value)}>
          <option value="">Asignado</option>
          <option value="null">Sin asignar</option>
          <option value="me">Asignados a mí</option>
        </select>
      </div>

      <div className="card" style={{ padding:0 }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : tickets.length === 0 ? (
          <div className="empty-state"><p>Sin resultados.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Área</th><th>Asunto</th><th>Prioridad</th><th>Estado</th><th>Asignado</th><th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} style={{ cursor:'pointer' }} onClick={() => window.location.hash = `#ticket/${t.id}`}>
                    <td style={{ fontFamily:'monospace', color:'var(--primary)' }}>{t.ticket_number}</td>
                    <td>{t.area}</td>
                    <td>{t.title || (t.description||'').slice(0,80)}</td>
                    <td><span className={`badge badge-${t.priority?.toLowerCase()}`}>{t.priority}</span></td>
                    <td><span className={`badge badge-${t.status?.toLowerCase()}`}>{t.status}</span></td>
                    <td style={{ color:'var(--text-3)' }}>{t.agent_name || 'Sin asignar'}</td>
                    <td style={{ color:'var(--text-3)', fontSize:12 }}>{formatDate(t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:12 }}>
        <button className="btn btn-secondary btn-small" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>‹ Anterior</button>
        <span style={{ fontSize:13, color:'var(--text-3)' }}>Pág {page} / {totalPages}</span>
        <button className="btn btn-secondary btn-small" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Siguiente ›</button>
      </div>
    </div>
  );
}
