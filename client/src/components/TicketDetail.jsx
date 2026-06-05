import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

function getTicketIdFromHash() {
  const m = window.location.hash.match(/#ticket\/(\d+)/);
  return m ? m[1] : null;
}

export default function TicketDetail() {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const id = getTicketIdFromHash();

  useEffect(() => {
    if (!id) return setError('Ticket ID no disponible');
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchJson(`/api/tickets/${id}`);
        if (!cancelled) setTicket(data.ticket || data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Error al cargar ticket');
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div style={{padding:20}}>Cargando ticket…</div>;
  if (error) return <div style={{padding:20,color:'crimson'}}>{error}</div>;
  if (!ticket) return <div style={{padding:20}}>No se encontró el ticket.</div>;

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Ticket {ticket.ticket_number || ticket.id}</h2>
          <div style={{color:'#64748b'}}>{ticket.title || ''}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:12,color:'#94a3b8'}}>Actualizado: {formatDate(ticket.updated_at)}</div>
          <button onClick={() => window.history.back()}>Volver</button>
        </div>
      </div>

      <div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
        <div>
          <section className="card" style={{padding:12}}>
            <h3>Descripción</h3>
            <div style={{whiteSpace:'pre-wrap'}}>{ticket.description || '—'}</div>
          </section>

          <section className="card" style={{padding:12,marginTop:12}}>
            <h3>Historial / Mensajes</h3>
            {Array.isArray(ticket.messages) && ticket.messages.length > 0 ? (
              ticket.messages.map((m, idx) => (
                <div key={idx} style={{padding:8,borderBottom:'1px solid #eef2f7'}}>
                  <div style={{fontSize:13,fontWeight:600}}>{m.author_name || m.author}</div>
                  <div style={{fontSize:12,color:'#64748b'}}>{formatDate(m.created_at)}</div>
                  <div style={{marginTop:6,whiteSpace:'pre-wrap'}}>{m.text}</div>
                </div>
              ))
            ) : (
              <div style={{color:'#94a3b8'}}>No hay mensajes registrados.</div>
            )}
          </section>
        </div>

        <aside>
          <div className="card" style={{padding:12}}>
            <h4>Meta</h4>
            <div><strong>Área:</strong> {ticket.area || '-'}</div>
            <div><strong>Prioridad:</strong> {ticket.priority || '-'}</div>
            <div><strong>Estado:</strong> {ticket.status || '-'}</div>
            <div><strong>Asignado:</strong> {ticket.agent_name || 'Sin asignar'}</div>
          </div>

          <div className="card" style={{padding:12,marginTop:12}}>
            <h4>Acciones</h4>
            <button style={{display:'block',width:'100%',marginBottom:8}} onClick={async()=>{ await fetchJson(`/api/tickets/${id}/refresh`); window.location.reload(); }}>Refrescar</button>
            <button style={{display:'block',width:'100%'}} onClick={async()=>{ await fetchJson(`/api/tickets/${id}/close`, { method:'POST' }); window.location.reload(); }}>Cerrar ticket</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
