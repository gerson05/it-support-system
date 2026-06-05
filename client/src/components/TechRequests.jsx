import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

export default function TechRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ area:'', status:'' });

  useEffect(() => { load(); }, [page, filters]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (filters.area) params.set('area', filters.area);
      if (filters.status) params.set('status', filters.status);
      const data = await fetchJson(`/api/tech-requests?${params.toString()}`);
      setRequests(data.requests || data || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) { setRequests([]); setTotalPages(1); }
    finally { setLoading(false); }
  }

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Solicitudes Técnicas</h2>
          <p style={{color:'#94a3b8'}}>Casos escalados desde distintas áreas.</p>
        </div>
        <button onClick={load}>🔄 Refrescar</button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <select value={filters.area} onChange={e=>setFilters(f=>({...f, area: e.target.value}))}>
          <option value="">Área</option>
          <option value="it">IT</option>
          <option value="farmacia">Farmacia</option>
        </select>
        <select value={filters.status} onChange={e=>setFilters(f=>({...f, status: e.target.value}))}>
          <option value="">Estado</option>
          <option value="abierto">Abierto</option>
          <option value="en_progreso">En Progreso</option>
          <option value="resuelto">Resuelto</option>
        </select>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          requests.length === 0 ? <div style={{color:'#94a3b8'}}>No hay solicitudes.</div> : (
            <>
              <table style={{width:'100%'}}>
                <thead>
                  <tr><th>ID</th><th>Área</th><th>Asunto</th><th>Estado</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                  {requests.map(r=> (
                    <tr key={r.id} style={{cursor:'pointer'}} onClick={()=> window.location.hash = `#ticket/${r.ticket_id || r.id}`}>
                      <td style={{padding:8}}>{r.id}</td>
                      <td style={{padding:8}}>{r.area}</td>
                      <td style={{padding:8}}>{r.title || r.summary}</td>
                      <td style={{padding:8}}>{r.status}</td>
                      <td style={{padding:8}}>{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
                <div>Pag {page} / {totalPages}</div>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
