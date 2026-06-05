import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

export default function TechRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchJson('/api/tech-requests');
      setRequests(data.requests || data || []);
    } catch (e) { setRequests([]); }
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

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          requests.length === 0 ? <div style={{color:'#94a3b8'}}>No hay solicitudes.</div> : (
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
          )
        )}
      </div>
    </div>
  );
}
