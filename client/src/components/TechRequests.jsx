import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';
import TechRequestModal from './TechRequestModal';

export default function TechRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search:'', status:'', priority:'', sede:'' });
  const [activeTab, setActiveTab] = useState('requerimiento');
  const [counts, setCounts] = useState({ requerimiento:0, incidencia:0 });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [page, filters, activeTab]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15, type: activeTab });
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.sede) params.set('sede', filters.sede);
      const data = await fetchJson(`/api/tech-requests?${params.toString()}`);
      setRequests(data.requests || []);
      setTotalPages(data.total_pages || 1);
      // update counts
      setCounts(c => ({ ...c, [activeTab]: data.total || 0 }));
    } catch (e) { setRequests([]); setTotalPages(1); }
    finally { setLoading(false); }
  }

  async function prefetchCounts() {
    try {
      const r1 = await fetchJson('/api/tech-requests?type=requerimiento&limit=1');
      const r2 = await fetchJson('/api/tech-requests?type=incidencia&limit=1');
      setCounts({ requerimiento: r1.total || 0, incidencia: r2.total || 0 });
    } catch (e) { /* ignore */ }
  }

  useEffect(()=>{ prefetchCounts(); }, []);

  function openNew() { setEditing(null); setShowModal(true); }
  async function openEdit(rec) {
    try {
      const full = await fetchJson(`/api/tech-requests/${rec.id}`);
      setEditing(full);
      setShowModal(true);
    } catch (err) {
      // fallback to shallow record
      setEditing(rec);
      setShowModal(true);
    }
  }

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Requerimientos Tecnológicos</h2>
          <p style={{color:'#94a3b8'}}>Gestiona solicitudes e incidencias desde las sedes.</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={load}>🔄 Refrescar</button>
          <button onClick={openNew} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',border:'none',padding:'8px 12px',borderRadius:8}}>Nueva Solicitud</button>
        </div>
      </div>

      <div style={{display:'flex',gap:0,marginTop:12}}>
        <button onClick={()=>{ setActiveTab('requerimiento'); setPage(1); }} style={{flex:1,padding:10,fontWeight: activeTab==='requerimiento' ? 700 : 600}}>Requerimientos <span style={{marginLeft:8,color:'#94a3b8'}}>{counts.requerimiento ?? '…'}</span></button>
        <button onClick={()=>{ setActiveTab('incidencia'); setPage(1); }} style={{flex:1,padding:10,fontWeight: activeTab==='incidencia' ? 700 : 600}}>Incidencias <span style={{marginLeft:8,color:'#94a3b8'}}>{counts.incidencia ?? '…'}</span></button>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        <input placeholder="Buscar nombre, cédula, sede…" value={filters.search} onChange={e=>setFilters(f=>({...f, search: e.target.value}))} />
        <select value={filters.status} onChange={e=>setFilters(f=>({...f, status: e.target.value}))}>
          <option value="">Estado</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_revision">En Revisión</option>
          <option value="en_proceso">En Proceso</option>
          <option value="completado">Completado</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <select value={filters.priority} onChange={e=>setFilters(f=>({...f, priority: e.target.value}))}>
          <option value="">Prioridad</option>
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>
        <input placeholder="Sede" value={filters.sede} onChange={e=>setFilters(f=>({...f, sede: e.target.value}))} />
        <button onClick={()=>{ setPage(1); load(); }}>Filtrar</button>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          requests.length === 0 ? <div style={{color:'#94a3b8'}}>No hay registros.</div> : (
            <>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid var(--glass-border)'}}>
                      <th style={{padding:8}}>N.º</th>
                      <th style={{padding:8}}>Solicitante</th>
                      <th style={{padding:8}}>Cédula</th>
                      <th style={{padding:8}}>Cargo</th>
                      <th style={{padding:8}}>Sede</th>
                      <th style={{padding:8}}>Cantidad / Equipo</th>
                      <th style={{padding:8}}>Prioridad</th>
                      <th style={{padding:8}}>Estado</th>
                      <th style={{padding:8}}>Fecha</th>
                      <th style={{padding:8}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id} style={{borderBottom:'1px solid rgba(0,0,0,0.03)'}}>
                        <td style={{padding:10,fontWeight:700,color:'var(--primary)'}}>{r.request_number}</td>
                        <td style={{padding:10}}>{r.requester_name}</td>
                        <td style={{padding:10,color:'#94a3b8'}}>{r.cedula}</td>
                        <td style={{padding:10}}>{r.cargo}</td>
                        <td style={{padding:10}}>{r.sede}</td>
                        <td style={{padding:10,textAlign:'center'}}>{activeTab==='incidencia' ? (r.equipment_name || '—') : r.quantity}</td>
                        <td style={{padding:10}}>{r.priority}</td>
                        <td style={{padding:10}}>{r.status}</td>
                        <td style={{padding:10}} title={formatDate(r.created_at)}>{formatDate(r.created_at)}</td>
                        <td style={{padding:10}}>
                          <button onClick={()=>openEdit(r)} className="btn btn-secondary">Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
                <div>Pag {page} / {totalPages}</div>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
              </div>
            </>
          )
        )}
      </div>

      <TechRequestModal open={showModal} onClose={()=>setShowModal(false)} defaultType={activeTab} record={editing} onSaved={() => { setShowModal(false); setPage(1); load(); prefetchCounts(); }} />
    </div>
  );
}
