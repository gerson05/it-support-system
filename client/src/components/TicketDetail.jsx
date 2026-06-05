import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';

function getTicketIdFromHash() {
  const m = window.location.hash.match(/#ticket\/(\d+)/);
  return m ? m[1] : null;
}

export default function TicketDetail() {
  const id = getTicketIdFromHash();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [statusVal, setStatusVal] = useState('');
  const [waConnected, setWaConnected] = useState(true);
  const [imagePreview, setImagePreview] = useState(null);
  const imageRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      if (!id) return;
      setLoading(true);
      try {
        const [t, a] = await Promise.all([
          fetchJson(`/api/tickets/${id}`),
          fetchJson('/api/agents')
        ]);
        if (!mounted) return;
        const ticketData = t.ticket || t;
        setTicket(ticketData);
        setAgents(a.agents || a || []);
        setAssignTo(ticketData.assigned_to || ticketData.assigned || '');
        setStatusVal(ticketData.status || '');
      } catch (e) {
        console.error('load ticket', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();

    // whatsapp banner polling (fallback)
    let poll = null;
    async function checkWa() {
      try {
        const s = await fetchJson('/api/whatsapp/status');
        if (mounted) setWaConnected(Boolean(s.connected));
      } catch (e) { if (mounted) setWaConnected(false); }
    }
    checkWa();
    poll = setInterval(checkWa, 8000);

    return () => { mounted = false; clearInterval(poll); };
  }, [id]);

  async function reloadTicket() {
    try {
      const t = await fetchJson(`/api/tickets/${id}`);
      setTicket(t.ticket || t);
    } catch (e) { console.error(e); }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      await fetchJson(`/api/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ text: replyText }) });
      setReplyText('');
      await reloadTicket();
    } catch (err) { console.error(err); alert('Error al enviar mensaje'); }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await fetchJson(`/api/tickets/${id}/notes`, { method: 'POST', body: JSON.stringify({ content: noteText }) });
      setNoteText('');
      await reloadTicket();
    } catch (err) { console.error(err); alert('Error al agregar nota'); }
  }

  async function handleSaveActions() {
    try {
      await fetchJson(`/api/tickets/${id}`, { method: 'PUT', body: JSON.stringify({ status: statusVal, assigned_to: assignTo }) });
      await reloadTicket();
      alert('Cambios guardados');
    } catch (e) { console.error(e); alert('Error al guardar cambios'); }
  }

  async function handleSendImage() {
    if (!imageRef.current?.files?.[0]) return;
    const file = imageRef.current.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        await fetchJson(`/api/tickets/${id}/send-image`, { method: 'POST', body: JSON.stringify({ base64, mimetype: file.type }) });
        setImagePreview(null);
        if (imageRef.current) imageRef.current.value = '';
        await reloadTicket();
        alert('Imagen enviada');
      } catch (err) { console.error(err); alert('Error al enviar imagen'); }
    };
    reader.readAsDataURL(file);
  }

  if (!id) return <div style={{padding:20}}>Ticket ID no disponible</div>;
  if (loading) return <div style={{padding:20}}>Cargando ticket…</div>;
  if (!ticket) return <div style={{padding:20}}>Ticket no encontrado.</div>;

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
            <h3>Conversación de WhatsApp</h3>
            {!waConnected && <div style={{fontSize:11,padding:6,marginBottom:8,background:'rgba(251,191,36,.12)',border:'1px solid rgba(251,191,36,.35)',borderRadius:6}}>⚠️ WhatsApp no está conectado — los mensajes se guardarán pero no se enviarán.</div>}

            <div style={{maxHeight:340,overflowY:'auto'}}>
              {Array.isArray(ticket.messages) && ticket.messages.length > 0 ? (
                ticket.messages.map((m, idx) => (
                  <div key={idx} style={{padding:8,borderBottom:'1px solid #eef2f7'}}>
                    <div style={{fontSize:13,fontWeight:600}}>{m.sender_name || m.sender || (m.sender_type==='user' ? ticket.requester_name : 'Agente')}</div>
                    <div style={{fontSize:12,color:'#64748b'}}>{formatDate(m.created_at)}</div>
                    <div style={{marginTop:6,whiteSpace:'pre-wrap'}}>{m.content || m.text}</div>
                  </div>
                ))
              ) : (
                <div style={{color:'#94a3b8',padding:12}}>No hay historial de mensajes.</div>
              )}
            </div>

            <form onSubmit={handleReply} style={{marginTop:12}}>
              <textarea placeholder="Escribe tu respuesta para el empleado..." value={replyText} onChange={e=>setReplyText(e.target.value)} style={{width:'100%',minHeight:80}} required />
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button type="submit" className="btn btn-primary">Enviar ➔</button>
                <label className="btn btn-secondary" style={{display:'inline-flex',alignItems:'center',gap:8}}>
                  Enviar imagen
                  <input type="file" ref={imageRef} accept="image/*" style={{display:'none'}} onChange={(e)=>{
                    const f = e.target.files && e.target.files[0];
                    if (!f) return; const reader = new FileReader(); reader.onload = () => setImagePreview(reader.result); reader.readAsDataURL(f);
                  }} />
                </label>
                {imagePreview && <button type="button" className="btn btn-primary" onClick={handleSendImage}>Enviar imagen</button>}
              </div>
              {imagePreview && <div style={{marginTop:8}}><img src={imagePreview} alt="preview" style={{maxWidth:160,maxHeight:160,borderRadius:6}} /></div>}
            </form>
          </section>
        </div>

        <aside>
          <div className="card" style={{padding:12}}>
            <h4>Detalles</h4>
            <div><strong>Solicitante:</strong> {ticket.requester_name || '—'}</div>
            <div><strong>WhatsApp:</strong> {ticket.phone || '—'}</div>
            <div><strong>Categoría:</strong> {ticket.category || 'General'}</div>
            <div><strong>Creado:</strong> {formatDate(ticket.created_at)}</div>
            <div><strong>Último cambio:</strong> {formatDate(ticket.updated_at)}</div>
          </div>

          <div className="card" style={{padding:12,marginTop:12}}>
            <h4>Gestión</h4>
            <div style={{marginTop:8}}>
              <label>Asignar a</label>
              <select value={assignTo} onChange={e=>setAssignTo(e.target.value)} style={{width:'100%'}}>
                <option value="">Sin asignar</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div style={{marginTop:8}}>
              <label>Estado</label>
              <select value={statusVal} onChange={e=>setStatusVal(e.target.value)} style={{width:'100%'}}>
                <option value="siguiente_dia">Siguiente día</option>
                <option value="abierto">Abierto</option>
                <option value="en_progreso">En Progreso</option>
                <option value="en_espera">En Espera</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>

            <div style={{display:'flex',gap:8,flexDirection:'column',marginTop:12}}>
              <button className="btn btn-primary" onClick={handleSaveActions}>Guardar Cambios</button>
              <button className="btn btn-secondary" onClick={async()=>{ await fetchJson(`/api/tickets/${id}/refresh`); await reloadTicket(); }}>Refrescar</button>
              <button className="btn btn-secondary" onClick={async()=>{ await fetchJson(`/api/tickets/${id}/close`, { method:'POST' }); await reloadTicket(); }}>Cerrar ticket</button>
            </div>
          </div>

          <div className="card" style={{padding:12,marginTop:12}}>
            <h4>Notas Internas</h4>
            <div style={{minHeight:80}}>
              {Array.isArray(ticket.notes) && ticket.notes.length > 0 ? (
                ticket.notes.map((n, i) => (
                  <div key={i} style={{padding:8,borderBottom:'1px solid #eef2f7'}}>
                    <div style={{fontSize:12}}>{n.content}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>{n.agent_name || 'Agente'} · {formatDate(n.created_at)}</div>
                  </div>
                ))
              ) : (
                <div style={{color:'#94a3b8'}}>No hay anotaciones registradas.</div>
              )}
            </div>

            <form onSubmit={handleAddNote} style={{marginTop:12}}>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Escribe una anotación privada…" style={{width:'100%',minHeight:60}} />
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn btn-secondary" type="submit">Añadir Nota</button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
