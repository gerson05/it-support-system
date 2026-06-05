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
    const [agents, setAgents] = useState([]);
    const [comment, setComment] = useState('');
    const [assignTo, setAssignTo] = useState(ticket.agent_id || '');
    const [statusVal, setStatusVal] = useState(ticket.status || '');

    useEffect(() => {
      let cancelled = false;
      async function loadAgents(){
        try {
          const data = await fetchJson('/api/agents');
          if (!cancelled) setAgents(data.agents || data || []);
        } catch (e) { /* ignore */ }
      }
      loadAgents();
      return ()=>{ cancelled = true; };
    }, []);

    async function postComment() {
      if (!comment.trim()) return;
      try {
        await fetchJson(`/api/tickets/${id}/messages`, { method:'POST', body: JSON.stringify({ text: comment }) });
        setComment('');
        // reload messages
        const refreshed = await fetchJson(`/api/tickets/${id}`);
        setTicket(refreshed.ticket || refreshed);
      } catch (e) { alert('Error al enviar mensaje'); }
    }

    async function doAssign() {
      try {
        await fetchJson(`/api/tickets/${id}/assign`, { method:'POST', body: JSON.stringify({ agent_id: assignTo }) });
        const refreshed = await fetchJson(`/api/tickets/${id}`);
        setTicket(refreshed.ticket || refreshed);
      } catch (e) { alert('Error al asignar'); }
    }

    async function changeStatus() {
      try {
        await fetchJson(`/api/tickets/${id}/status`, { method:'POST', body: JSON.stringify({ status: statusVal }) });
        const refreshed = await fetchJson(`/api/tickets/${id}`);
        setTicket(refreshed.ticket || refreshed);
      } catch (e) { alert('Error al cambiar estado'); }
    }

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

        <div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 360px',gap:16}}>
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

              <div style={{marginTop:12}}>
                <textarea placeholder="Escribe un mensaje..." value={comment} onChange={e=>setComment(e.target.value)} style={{width:'100%',minHeight:80}} />
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button onClick={postComment}>Enviar</button>
                  <button onClick={()=>setComment('')}>Cancelar</button>
                </div>
              </div>
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
              <div style={{marginBottom:8}}>
                <label>Asignar a</label>
                <select value={assignTo} onChange={e=>setAssignTo(e.target.value)} style={{width:'100%'}}>
                  <option value="">-- Ninguno --</option>
                  {agents.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button style={{marginTop:8,width:'100%'}} onClick={doAssign}>Asignar</button>
              </div>

              <div style={{marginTop:8}}>
                <label>Estado</label>
                <select value={statusVal} onChange={e=>setStatusVal(e.target.value)} style={{width:'100%'}}>
                  <option value="abierto">Abierto</option>
                  <option value="en_progreso">En Progreso</option>
                  <option value="en_espera">En Espera</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
                <button style={{marginTop:8,width:'100%'}} onClick={changeStatus}>Cambiar estado</button>
              </div>

              <div style={{marginTop:12}}>
                <button style={{display:'block',width:'100%',marginBottom:8}} onClick={async()=>{ await fetchJson(`/api/tickets/${id}/refresh`); window.location.reload(); }}>Refrescar</button>
                <button style={{display:'block',width:'100%'}} onClick={async()=>{ await fetchJson(`/api/tickets/${id}/close`, { method:'POST' }); window.location.reload(); }}>Cerrar ticket</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
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
