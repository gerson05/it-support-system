import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

export default function TicketsList() {
  const [mode, setMode] = useState('activos');
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef();
  const [filters, setFilters] = useState({ priority:'', area:'', status:'', assigned_to:'' });

  useEffect(() => { fetchTickets(); }, [mode, page, filters]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (searchRef.current?.value) params.set('search', searchRef.current.value);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.area) params.set('area', filters.area);
      if (filters.status) params.set('status', filters.status);
      if (filters.assigned_to) {
        // backend accepts 'me' or explicit agent id or 'null'
        params.set('assigned_to', filters.assigned_to);
      }
      if (mode === 'archivo') params.set('status_group','archivo');
      const data = await fetchJson(`/api/tickets?${params.toString()}`);
      setTickets(data.tickets || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) { setTickets([]); setTotalPages(1); }
    finally { setLoading(false); }
  }

  function onFilterChange(key, value) { setFilters(f => ({ ...f, [key]: value })); setPage(1); }

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Tickets</h2>
          <p style={{color:'#94a3b8'}}>Administra y responde los casos técnicos.</p>
        </div>
        <button onClick={fetchTickets}>🔄 Refrescar</button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={()=>{ setMode('activos'); setPage(1); }} style={{fontWeight: mode==='activos'?'700':'400'}}>Activos</button>
        <button onClick={()=>{ setMode('archivo'); setPage(1); }} style={{fontWeight: mode==='archivo'?'700':'400'}}>Archivo</button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center',flexWrap:'wrap'}}>
        <input ref={searchRef} placeholder="Buscar ID, teléfono, descripción..." onChange={()=>{ setPage(1); }} />
        <select onChange={e=>onFilterChange('status', e.target.value)} value={filters.status}>
          <option value="">Estado</option>
          <option value="siguiente_dia">Siguiente día</option>
          <option value="abierto">Abiertos</option>
          <option value="en_progreso">En Progreso</option>
          <option value="en_espera">En Espera</option>
        </select>
        <select onChange={e=>onFilterChange('priority', e.target.value)} value={filters.priority}>
          <option value="">Prioridad</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>
        <select onChange={e=>onFilterChange('area', e.target.value)} value={filters.area}>
          <option value="">Área</option>
          <option value="cartera">Cartera</option>
          <option value="compra">Compra</option>
          <option value="gestion_humana">Gestión Humana</option>
          <option value="pqrs">PQRS</option>
          <option value="contabilidad">Contabilidad</option>
          <option value="farmacia">Farmacia</option>
          <option value="general">General</option>
        </select>
        <select onChange={e=>onFilterChange('assigned_to', e.target.value)} value={filters.assigned_to}>
          <option value="">Asignado</option>
          <option value="null">Sin asignar</option>
          <option value="me">Asignados a mí</option>
        </select>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Loading…</div> : (
          tickets.length === 0 ? <div style={{color:'#94a3b8'}}>Sin resultados.</div> : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr><th>ID</th><th>Área</th><th>Asunto</th><th>Prioridad</th><th>Estado</th><th>Asignado</th><th>Actualizado</th></tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} style={{cursor:'pointer'}} onClick={() => window.location.hash = `#ticket/${t.id}`}>
                    <td style={{padding:8,fontFamily:'monospace'}}>{t.ticket_number}</td>
                    <td style={{padding:8}}>{t.area}</td>
                    <td style={{padding:8}}>{t.title || (t.description||'').slice(0,80)}</td>
                    <td style={{padding:8}}>{t.priority}</td>
                    <td style={{padding:8}}>{t.status}</td>
                    <td style={{padding:8}}>{t.agent_name||'Sin asignar'}</td>
                    <td style={{padding:8}}>{formatDate(t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
        <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
        <div>Pag {page} / {totalPages}</div>
        <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
      </div>
    </div>
  );
}
