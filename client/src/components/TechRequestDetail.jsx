import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { formatDate } from '../utils/format';
import TechRequestModal from './TechRequestModal';
import { showToast } from '../utils/ui';

export default function TechRequestDetail() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#tech-request\/(\d+)/);
  const id = match ? match[1] : null;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const data = await fetchJson(`/api/tech-requests/${id}`, { signal: ctrl.signal });
      setRecord(data);
    } catch (err) {
      const msg = err.name === 'AbortError' ? 'Tiempo agotado al cargar la solicitud' : (err.message || 'Error al cargar');
      showToast(msg, 'error');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (!id) return <div style={{padding:20}}>ID inválido</div>;

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2>Solicitud #{record?.request_number || id}</h2>
          <div style={{color:'#94a3b8'}}>{record?.requester_name} · {record?.sede}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => { window.location.hash = '#tech-requests'; }} className="btn btn-secondary">← Volver</button>
          <button onClick={async () => { if (!record) await load(); setEditing(record); setShowModal(true); }} className="btn btn-primary">Editar</button>
        </div>
      </div>

      <div style={{marginTop:16}}>
        {loading ? <div>Cargando…</div> : (record ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
            <div>
              <h3>Descripción</h3>
              <p style={{whiteSpace:'pre-wrap'}}>{record.description}</p>

              <h4 style={{marginTop:16}}>Detalles</h4>
              <table style={{width:'100%'}}>
                <tbody>
                  <tr><td style={{padding:6,fontWeight:700}}>Solicitante</td><td style={{padding:6}}>{record.requester_name}</td></tr>
                  <tr><td style={{padding:6,fontWeight:700}}>Cédula</td><td style={{padding:6}}>{record.cedula}</td></tr>
                  <tr><td style={{padding:6,fontWeight:700}}>Cargo</td><td style={{padding:6}}>{record.cargo}</td></tr>
                  <tr><td style={{padding:6,fontWeight:700}}>Sede</td><td style={{padding:6}}>{record.sede}</td></tr>
                  <tr><td style={{padding:6,fontWeight:700}}>Prioridad</td><td style={{padding:6}}>{record.priority}</td></tr>
                  <tr><td style={{padding:6,fontWeight:700}}>Estado</td><td style={{padding:6}}>{record.status}</td></tr>
                  <tr><td style={{padding:6,fontWeight:700}}>Creado</td><td style={{padding:6}}>{formatDate(record.created_at)}</td></tr>
                </tbody>
              </table>

              {record.items && record.items.length > 0 && (
                <div style={{marginTop:16}}>
                  <h4>Ítems solicitados</h4>
                  <ul>
                    {record.items.map((it, idx) => <li key={idx}>{it.equipment_name} — {it.quantity} {it.serial ? ` · ${it.serial}` : ''}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <aside style={{background:'var(--surface-2)',padding:12,borderRadius:8}}>
              <div style={{fontSize:13,fontWeight:700}}>Historial</div>
              <div style={{marginTop:8}}>
                {record.history && record.history.length ? record.history.map((h, i) => (
                  <div key={i} style={{padding:'8px 0',borderBottom:'1px solid rgba(0,0,0,0.04)'}}>
                    <div style={{fontSize:12,fontWeight:600}}>{h.agent_name || 'Sistema'} · <span style={{fontSize:11,fontWeight:400,color:'#94a3b8'}}>{formatDate(h.created_at)}</span></div>
                    <div style={{fontSize:13}}>{h.action}</div>
                  </div>
                )) : <div style={{color:'#94a3b8'}}>Sin historial disponible.</div> }
              </div>
            </aside>
          </div>
        ) : <div style={{color:'#ef4444'}}>No se encontró la solicitud.</div>)}
      </div>

      <TechRequestModal open={showModal} onClose={() => { setShowModal(false); }} record={editing} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
