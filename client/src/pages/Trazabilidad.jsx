import React, { useEffect, useState, useCallback } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

const ESTADOS = {
  creado:      { label: 'Creado',      color: '#6366f1', bg: 'rgba(99,102,241,.15)'  },
  en_transito: { label: 'En tránsito', color: '#f59e0b', bg: 'rgba(245,158,11,.15)'  },
  en_sede:     { label: 'En sede',     color: '#3b82f6', bg: 'rgba(59,130,246,.15)'  },
  entregado:   { label: 'Entregado',   color: '#10b981', bg: 'rgba(16,185,129,.15)'  },
  devuelto:    { label: 'Devuelto',    color: '#ef4444', bg: 'rgba(239,68,68,.15)'   },
};

const PROGRESS = { creado: 10, en_transito: 40, en_sede: 70, entregado: 100, devuelto: 0 };
const STEP_LABELS = ['Creado', 'Despachado', 'En tránsito', 'En sede', 'Entregado'];
const STEP_IDX    = { creado: 0, en_transito: 2, en_sede: 3, entregado: 4, devuelto: 4 };

function Badge({ estado }) {
  const s = ESTADOS[estado] || { label: estado, color: '#94a3b8', bg: 'rgba(148,163,184,.15)' };
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600,color:s.color,background:s.bg}}>
      {s.label}
    </span>
  );
}

function timeAgo(dt) {
  if (!dt) return '—';
  const m = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function TrackingDetail({ token, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchJson(`/api/tracking/${token}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  async function marcarDevuelto() {
    if (!confirm('Marcar este paquete como devuelto?')) return;
    try {
      await fetchJson(`/api/tracking/${token}/estado`, { method: 'PUT', body: JSON.stringify({ estado: 'devuelto' }) });
      const d = await fetchJson(`/api/tracking/${token}`);
      setData(d);
    } catch (e) { showToast(e.message || 'Error', 'error'); }
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Cargando…</div>;
  if (!data)   return <div style={{padding:40,textAlign:'center',color:'#f87171'}}>No se encontro el paquete.</div>;

  const step = STEP_IDX[data.estado] ?? 0;

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <button className="btn btn-secondary" onClick={onBack}>← Volver</button>
        <Badge estado={data.estado} />
        <span style={{fontSize:18,fontWeight:700}}>{data.numero} — Trazabilidad</span>
      </div>

      <div style={{display:'flex',marginBottom:24,overflow:'hidden',borderRadius:10}}>
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{
            flex:1, padding:'10px 6px', textAlign:'center', fontSize:11, fontWeight:600,
            background: i < step ? 'rgba(16,185,129,.15)' : i === step ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.03)',
            color: i < step ? '#6ee7b7' : i === step ? '#818cf8' : '#334155',
            borderRight: i < STEP_LABELS.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
          }}>{label}</div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:24,alignItems:'start'}}>
        <div className="card">
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:16}}>Historial de movimientos</div>
          {data.eventos.map((e, idx) => {
            const isLast = idx === data.eventos.length - 1;
            const dotColor = e.tipo === 'creacion' ? '#6366f1' : e.tipo === 'entrega_final' ? '#10b981' : '#f59e0b';
            return (
              <div key={e.id} style={{display:'flex',gap:0}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:32,flexShrink:0}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:dotColor,marginTop:3,flexShrink:0}} />
                  {!isLast && <div style={{width:2,flex:1,minHeight:20,background:'rgba(255,255,255,.07)'}} />}
                </div>
                <div style={{flex:1,padding:`0 0 ${isLast?0:20}px 10px`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:600}}>
                      {e.tipo === 'creacion' ? 'Despacho creado' : e.tipo === 'entrega_final' ? 'Entrega final' : `Recibido en ${e.ubicacion}`}
                    </span>
                    <span style={{fontSize:11,color:'var(--text-3)',whiteSpace:'nowrap'}}>{timeAgo(e.created_at)}</span>
                  </div>
                  <div style={{fontSize:13,color:'var(--text-3)',marginBottom:4}}>
                    {e.tipo === 'creacion'
                      ? `Creado por ${e.recibido_por}`
                      : <>Recibido por <strong style={{color:'var(--text)'}}>{e.recibido_por}</strong>{e.cargo_receptor ? ` (${e.cargo_receptor})` : ''} · Entregó: {e.entregado_por}</>}
                  </div>
                  {e.observaciones && <div style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>"{e.observaciones}"</div>}
                  {e.tiene_foto && (
                    <img src={`/api/tracking/fotos/${e.foto_filename}`} alt="Evidencia"
                      style={{width:60,height:60,objectFit:'cover',borderRadius:8,marginTop:8,cursor:'pointer',border:'1px solid rgba(255,255,255,.1)'}}
                      onClick={()=>window.open(`/api/tracking/fotos/${e.foto_filename}`, '_blank')} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card">
            <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>QR del paquete</div>
            <img src={`/api/tracking/${token}/qr`} alt="QR" style={{width:'100%',borderRadius:8,background:'#fff',padding:8}} />
            <a href={`/api/tracking/${token}/qr`} download={`QR-${data.numero}.png`}
              className="btn btn-primary" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:12,textDecoration:'none'}}>
              Descargar QR
            </a>
          </div>

          <div className="card" style={{fontSize:13}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>Detalles</div>
            {[
              ['Número',      data.numero],
              ['Destinatario',data.destinatario],
              ['Sede destino',data.sede_destino || '—'],
              ['Eventos',     data.eventos.length],
            ].map(([k, v]) => (
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{color:'var(--text-3)'}}>{k}</span>
                <span style={{fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>

          {data.acta_final && (
            <div className="card">
              <div style={{fontSize:11,fontWeight:700,color:'#10b981',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Acta de recepcion</div>
              <p style={{fontSize:12,color:'var(--text-3)',marginBottom:10}}>Firmada por: {data.acta_final.firmado_por}<br/>Cargo: {data.acta_final.cargo}</p>
              <a href={`/api/tracking/public/${token}/acta-final`} className="btn btn-secondary btn-small" style={{textDecoration:'none'}}>
                Descargar acta
              </a>
            </div>
          )}

          {!['entregado','devuelto'].includes(data.estado) && (
            <button className="btn btn-danger btn-small" onClick={marcarDevuelto}>
              Marcar como devuelto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Trazabilidad() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [estado, setEstado]   = useState('');
  const [detail, setDetail]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: 50 });
      if (search) qs.set('search', search);
      if (estado) qs.set('estado', estado);
      const data = await fetchJson(`/api/tracking?${qs}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) { showToast('Error cargando trazabilidad', 'error'); }
    finally { setLoading(false); }
  }, [search, estado]);

  useEffect(() => { load(); }, [load]);

  if (detail) return (
    <div style={{padding:20}}>
      <TrackingDetail token={detail} onBack={() => setDetail(null)} />
    </div>
  );

  return (
    <div style={{padding:20}}>
      <div style={{marginBottom:20}}>
        <h2 style={{margin:0}}>Trazabilidad de Paquetes</h2>
        <div style={{color:'#94a3b8',marginTop:4}}>Seguimiento en tiempo real de despachos activos.</div>
      </div>

      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:18}}>
        <input className="form-control" placeholder="Buscar por numero, destino…" value={search}
          onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:200}} />
        <select className="form-control" value={estado} onChange={e=>setEstado(e.target.value)} style={{width:'auto'}}>
          <option value="">Todos los estados</option>
          <option value="creado">Creado</option>
          <option value="en_transito">En transito</option>
          <option value="en_sede">En sede</option>
          <option value="entregado">Entregado</option>
          <option value="devuelto">Devuelto</option>
        </select>
        <button className="btn btn-secondary" onClick={load}>Actualizar</button>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="empty-state"><p>No hay paquetes con seguimiento activo.</p></div>
      ) : (
        <div className="card" style={{padding:0}}>
          <div style={{padding:'10px 18px',fontSize:12,color:'var(--text-3)',borderBottom:'1px solid var(--border)'}}>
            {total} paquete(s)
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr style={{background:'var(--surface-2)'}}>
                  <th>Numero</th><th>Destino</th><th>Estado</th><th>Ultimo evento</th><th>Progreso</th><th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.token} style={{cursor:'pointer'}} onClick={()=>setDetail(r.token)}>
                    <td style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)'}}>{r.numero}</td>
                    <td>{r.sede_destino || r.destinatario || '—'}</td>
                    <td><Badge estado={r.estado} /></td>
                    <td style={{fontSize:12,color:'var(--text-3)'}}>{r.ultimo_evento_ubicacion || '—'}</td>
                    <td>
                      <div style={{height:4,background:'rgba(255,255,255,.07)',borderRadius:99,overflow:'hidden',width:80}}>
                        <div style={{height:'100%',borderRadius:99,background:'linear-gradient(90deg,#6366f1,#10b981)',width:`${PROGRESS[r.estado]||0}%`}} />
                      </div>
                    </td>
                    <td style={{fontSize:12,color:'var(--text-3)'}}>{timeAgo(r.ultimo_evento_at || r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
