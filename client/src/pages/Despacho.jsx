import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';
import { formatDate } from '../utils/format';

const TIPOS_ARTICULO = [
  'TONER','EQUIPO','CARGADOR','IMPRESORA','UPS','MONITOR',
  'TURNERO','TECLADO','ESCANER','MOUSE','VGA',
];

const LABEL_SIZES = [
  { value: '10x8',  label: '10 × 8 cm  (apaisado)' },
  { value: '10x10', label: '10 × 10 cm (cuadrado)' },
  { value: '10x15', label: '10 × 15 cm (retrato)' },
  { value: '15x10', label: '15 × 10 cm (apaisado ancho)' },
  { value: '8x5',   label: '8 × 5 cm   (pequeño)' },
];

function RotuloModal({ trackingToken, onClose }) {
  const [tipo, setTipo] = useState('EQUIPO');
  const [remite, setRemite] = useState('DPTO. DE SISTEMAS');
  const [cajas, setCajas] = useState(1);
  const [modo, setModo] = useState('single');
  const [impresora, setImpresora] = useState('normal');
  const [tamano, setTamano] = useState('10x8');

  function handleImprimir() {
    if (!trackingToken) return;
    const params = new URLSearchParams({ tipo_articulo: tipo, remite, cajas, modo, printer: impresora, label_size: tamano });
    window.open(`/api/tracking/${trackingToken}/rotulo?${params}`, '_blank');
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <h3>Configurar Rotulo</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label className="field-label">Tipo de articulo</label>
            <select className="form-control" value={tipo} onChange={e=>setTipo(e.target.value)}>
              {TIPOS_ARTICULO.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Remite</label>
            <input className="form-control" value={remite} onChange={e=>setRemite(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Cajas</label>
            <input className="form-control" type="number" min={1} max={99} value={cajas} onChange={e=>setCajas(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Modo de impresion</label>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:6}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                <input type="radio" name="rotulo-modo" value="single" checked={modo==='single'} onChange={()=>setModo('single')} />
                Un solo rotulo (destino del despacho)
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
                <input type="radio" name="rotulo-modo" value="todos" checked={modo==='todos'} onChange={()=>setModo('todos')} />
                Todos los puntos
              </label>
            </div>
            {modo==='todos' && (
              <div style={{marginTop:8,padding:'8px 12px',background:'var(--surface-2)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--text-3)'}}>
                Se genera un rotulo por cada sede activa. El QR es el mismo para todos.
              </div>
            )}
          </div>

          <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
            <label className="field-label">Tipo de impresora</label>
            <div style={{display:'flex',gap:12,marginTop:6}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,flex:1,padding:'8px 10px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',background:impresora==='normal'?'var(--primary-10, color-mix(in srgb, var(--primary) 10%, transparent))':'var(--surface)'}}>
                <input type="radio" name="rotulo-printer" value="normal" checked={impresora==='normal'} onChange={()=>setImpresora('normal')} />
                <span>
                  <span style={{display:'block',fontWeight:600}}>Impresora normal</span>
                  <span style={{fontSize:11,color:'var(--text-3)'}}>Hoja A4</span>
                </span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,flex:1,padding:'8px 10px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',background:impresora==='etiqueta'?'var(--primary-10, color-mix(in srgb, var(--primary) 10%, transparent))':'var(--surface)'}}>
                <input type="radio" name="rotulo-printer" value="etiqueta" checked={impresora==='etiqueta'} onChange={()=>setImpresora('etiqueta')} />
                <span>
                  <span style={{display:'block',fontWeight:600}}>Impresora de etiquetas</span>
                  <span style={{fontSize:11,color:'var(--text-3)'}}>Tamaño personalizado</span>
                </span>
              </label>
            </div>
          </div>

          {impresora==='etiqueta' && (
            <div>
              <label className="field-label">Tamaño de etiqueta</label>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6}}>
                {LABEL_SIZES.map(s=>(
                  <label key={s.value} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,padding:'7px 10px',border:'1.5px solid var(--border)',borderRadius:'var(--radius-sm)',background:tamano===s.value?'var(--primary-10, color-mix(in srgb, var(--primary) 10%, transparent))':'var(--surface)'}}>
                    <input type="radio" name="rotulo-size" value={s.value} checked={tamano===s.value} onChange={()=>setTamano(s.value)} />
                    <span style={{fontFamily:'monospace',fontWeight:600}}>{s.label}</span>
                  </label>
                ))}
              </div>
              <div style={{marginTop:8,padding:'7px 10px',background:'var(--surface-2)',borderRadius:'var(--radius-sm)',fontSize:11,color:'var(--text-3)'}}>
                El rótulo se ajusta al tamaño exacto. Configura tu impresora con el mismo tamaño de papel al imprimir.
              </div>
            </div>
          )}

          {!trackingToken && <div className="modal-error">Este despacho no tiene trazabilidad activa.</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleImprimir} disabled={!trackingToken}>
            Abrir para imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ id, onClose, onUpdated }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actaInfo, setActaInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [trackingToken, setTrackingToken] = useState(null);
  const [rotuloOpen, setRotuloOpen] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setTrackingToken(null);
      try {
        const d = await fetchJson(`/api/despachos/${id}`);
        if (!mounted) return;
        setRecord(d);
        if (d.requiere_acta) {
          const info = await fetchJson(`/api/actas/info/despacho/${id}`);
          if (!mounted) return;
          setActaInfo(info);
        }
        try {
          const tInfo = await fetchJson(`/api/tracking/by-despacho/${id}`);
          if (mounted && tInfo?.token) setTrackingToken(tInfo.token);
        } catch {}
      } catch (e) {
        // ignore
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  // Poll acta status when token present and not uploaded
  useEffect(() => {
    if (!id) return;
    let timer = null;
    async function poll() {
      try {
        const info = await fetchJson(`/api/actas/info/despacho/${id}`);
        setActaInfo(info);
        if (info && info.uploaded) {
          onUpdated && onUpdated();
          clearInterval(timer);
        }
      } catch {}
    }
    if (actaInfo && actaInfo.token && !actaInfo.uploaded) {
      timer = setInterval(poll, 8000);
    }
    return () => clearInterval(timer);
  }, [id, actaInfo, onUpdated]);

  if (!id) return null;
  async function getToken() {
    try {
      const res = await fetchJson('/api/actas/token', { method: 'POST', body: JSON.stringify({ entity_type: 'despacho', entity_id: id, entity_ref: record?.numero || id }) });
      const info = await fetchJson(`/api/actas/info/despacho/${id}`);
      setActaInfo(info);
      showToast('Link de firma generado', 'success');
    } catch (e) { showToast(e.message || 'Error', 'error'); }
  }

  async function uploadFile(file) {
    if (!file || !actaInfo?.token) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf','docx'].includes(ext)) { showToast('Solo PDF o DOCX', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('Límite 10MB', 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('acta', file);
      const res = await fetch(`/api/actas/upload/${actaInfo.token}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error upload');
      const info = await fetchJson(`/api/actas/info/despacho/${id}`);
      setActaInfo(info);
      showToast('Acta subida correctamente', 'success');
      onUpdated && onUpdated();
    } catch (e) { showToast(e.message || 'Error', 'error'); }
    finally { setUploading(false); }
  }

  async function markFirmada() {
    try {
      const actaNumero = prompt('N° de acta (opcional)') || null;
      await fetchJson(`/api/despachos/${id}`, { method: 'PUT', body: JSON.stringify({ acta_firmada: 1, acta_numero: actaNumero, agente: window.appState?.currentAgent?.name || 'IT' }) });
      showToast('Acta marcada como firmada', 'success');
      onUpdated && onUpdated();
    } catch (e) { showToast(e.message || 'Error', 'error'); }
  }

  return (
    <>
      <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1200,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}} onClick={(e)=>{if(e.target.className==='modal-overlay') onClose();}}>
        <div style={{background:'var(--surface)',borderRadius:12,padding:20,width:'100%',maxWidth:720,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3 style={{margin:0}}>Detalle de Despacho</h3>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-secondary" onClick={()=>setRotuloOpen(true)}>Rotulo</button>
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
              {record && record.requiere_acta && (<button className="btn btn-primary" onClick={markFirmada}>Marcar como firmada</button>)}
            </div>
          </div>
          <div style={{marginTop:12}}>
            {loading ? <div>Cargando…</div> : (record ? (
              <div style={{display:'grid',gridTemplateColumns:'1fr 260px',gap:16}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>Número</div>
                  <div style={{fontFamily:'monospace',fontSize:15,color:'var(--primary)'}}>{record.numero}</div>
                  <div style={{marginTop:8}}><strong>Destinatario:</strong> {record.destinatario}</div>
                  <div><strong>Sede:</strong> {record.sede || '—'}</div>
                  <div style={{marginTop:12}}><strong>Artículos</strong>
                    <div style={{marginTop:8}}>{(record.articulos && Array.isArray(record.articulos) ? record.articulos : JSON.parse(record.articulos||'[]')).map((a,i)=>(<div key={i} style={{padding:'6px 0',borderBottom:'1px solid var(--border)'}}><strong>{a.nombre}</strong> · {a.cantidad}</div>))}</div>
                  </div>
                </div>
                <aside style={{background:'var(--surface-2)',padding:12,borderRadius:8}}>
                  <div style={{fontSize:13,fontWeight:700}}>Acta</div>
                  <div style={{marginTop:8}}>{record.requiere_acta ? (record.acta_firmada ? `Firmada · N° ${record.acta_numero || '—'}` : 'Pendiente de firma') : 'No requiere acta'}</div>
                  <div style={{marginTop:10}}>
                    {actaInfo?.token ? (
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{fontSize:12}}>Link: <input readOnly value={actaInfo.url || ''} style={{width:'100%',fontFamily:'monospace'}} /></div>
                        <div style={{display:'flex',gap:8}}>
                          <a href={`/api/actas/download/${actaInfo.token}`} className="btn btn-secondary">Descargar</a>
                          <button className="btn btn-secondary" onClick={async()=>{ await navigator.clipboard.writeText(actaInfo.url || ''); showToast('Link copiado', 'success'); }}>Copiar</button>
                          <button className="btn btn-secondary" onClick={async()=>{ await fetchJson('/api/actas/token', { method: 'POST', body: JSON.stringify({ entity_type: 'despacho', entity_id: id, entity_ref: record.numero }) }); const info = await fetchJson(`/api/actas/info/despacho/${id}`); setActaInfo(info); showToast('Link regenerado', 'success'); }}>Regenerar</button>
                        </div>
                        <div>
                          <input id="acta-file-input" type="file" accept=".pdf,.docx" style={{display:'none'}} onChange={(e)=>{ if (e.target.files[0]) uploadFile(e.target.files[0]); }} />
                          <button className="btn btn-primary" onClick={()=>document.getElementById('acta-file-input')?.click()} disabled={uploading}>{uploading ? 'Subiendo…' : 'Subir acta firmada'}</button>
                        </div>
                      </div>
                    ) : (
                      record.requiere_acta ? <button className="btn btn-secondary" onClick={getToken}>Obtener link de firma</button> : <div style={{color:'#94a3b8'}}>Este despacho no requiere acta.</div>
                    )}
                  </div>
                </aside>
              </div>
            ) : <div>No se encontró.</div>)}
          </div>
        </div>
      </div>
      {rotuloOpen && <RotuloModal trackingToken={trackingToken} onClose={()=>setRotuloOpen(false)} />}
    </>
  );
}

function CreateModal({ open, onClose, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ destinatario:'', sede:'', area:'', observaciones:'', articulos:[], requiere_acta:false, ticket_id:'' });
  const [draft, setDraft] = useState(null);

  useEffect(()=>{ if (open) { setForm({ destinatario:'', sede:'', area:'', observaciones:'', articulos:[], requiere_acta:false, ticket_id:'' }); setDraft(null); } },[open]);
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const agente = encodeURIComponent(window.appState?.currentAgent?.name || '');
        if (!agente) return;
        const data = await fetchJson(`/api/despachos/borrador?agente=${agente}`);
        if (data && data.borrador) setDraft(data.borrador);
      } catch (e) {}
    })();
  }, [open]);

  function addArticulo() { setForm(f=>({...f, articulos:[...f.articulos, {nombre:'', cantidad:1}]})); }
  function removeArticulo(i) { setForm(f=>({...f, articulos:f.articulos.filter((_,j)=>j!==i)})); }
  function updateArticulo(i, key, val) { setForm(f=>({...f, articulos:f.articulos.map((a,j)=>j===i?{...a,[key]:val}:a)})); }

  function serializar() {
    return { agente: window.appState?.currentAgent?.name || '', destinatario: form.destinatario||'', sede: form.sede||'', area: form.area||'', articulos: form.articulos, observaciones: form.observaciones||'', requiere_acta: form.requiere_acta?1:0, ticket_id: form.ticket_id?parseInt(form.ticket_id):null };
  }

  async function saveDraft() {
    try {
      await fetchJson('/api/despachos/borrador', { method: 'PUT', body: JSON.stringify(serializar()) });
      showToast('Borrador guardado', 'success');
    } catch (e) { showToast('No se pudo guardar borrador', 'error'); }
  }

  async function discardDraft() {
    try {
      const agente = encodeURIComponent(window.appState?.currentAgent?.name || '');
      await fetchJson(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' });
      setDraft(null);
      showToast('Borrador descartado', 'success');
    } catch { showToast('No se pudo descartar', 'error'); }
  }

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { destinatario: form.destinatario, sede: form.sede || null, area: form.area || null, articulos: form.articulos, observaciones: form.observaciones || null, requiere_acta: form.requiere_acta?1:0, ticket_id: form.ticket_id?parseInt(form.ticket_id):null, agente: window.appState?.currentAgent?.name || '' };
      const res = await fetchJson('/api/despachos', { method: 'POST', body: JSON.stringify(payload) });
      showToast(`Despacho ${res.numero} creado`, 'success');
      try { const agente = encodeURIComponent(window.appState?.currentAgent?.name || ''); await fetchJson(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' }); } catch {}
      onCreated && onCreated(); onClose();
    } catch (err) { showToast(err.message || err, 'error'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Nuevo Despacho</h3>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {draft && (
              <button className="btn btn-secondary btn-small" onClick={()=>{
                const b = draft;
                setForm({ destinatario:b.destinatario||'', sede:b.sede||'', area:b.area||'', articulos:b.articulos||[], observaciones:b.observaciones||'', requiere_acta:!!b.requiere_acta, ticket_id:b.ticket_id||'' });
                setDraft(null);
                showToast('Borrador restaurado', 'success');
              }}>Restaurar borrador</button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{padding:'16px 0 0'}}>
            <div className="modal-form-grid">
              <div>
                <label className="field-label">Destinatario *</label>
                <input className="form-control" required placeholder="Nombre del destinatario" value={form.destinatario} onChange={e=>setForm({...form,destinatario:e.target.value})} />
              </div>
              <div>
                <label className="field-label">Sede</label>
                <input className="form-control" placeholder="Nombre de la sede" value={form.sede} onChange={e=>setForm({...form,sede:e.target.value})} />
              </div>
              <div>
                <label className="field-label">Area</label>
                <input className="form-control" placeholder="Area o departamento" value={form.area} onChange={e=>setForm({...form,area:e.target.value})} />
              </div>
              <div>
                <label className="field-label">Ticket ID (opcional)</label>
                <input className="form-control" placeholder="ID del ticket relacionado" value={form.ticket_id} onChange={e=>setForm({...form,ticket_id:e.target.value})} />
              </div>
            </div>

            <div style={{marginTop:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <label className="field-label" style={{marginBottom:0}}>Artículos</label>
                <button type="button" className="btn btn-secondary btn-small" onClick={addArticulo}>+ Agregar</button>
              </div>
              {form.articulos.length === 0 && (
                <div style={{padding:'10px 12px',background:'var(--surface-2)',borderRadius:'var(--radius-sm)',fontSize:12,color:'var(--text-3)',textAlign:'center'}}>
                  Sin artículos. Usa el botón para agregar.
                </div>
              )}
              {form.articulos.map((a, i) => (
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 90px 34px',gap:6,marginBottom:6}}>
                  <input className="form-control" placeholder="Nombre / descripción" value={a.nombre} onChange={e=>updateArticulo(i,'nombre',e.target.value)} />
                  <input className="form-control" type="number" min={1} placeholder="Cant." value={a.cantidad} onChange={e=>updateArticulo(i,'cantidad',parseInt(e.target.value)||1)} />
                  <button type="button" className="btn btn-danger btn-small" onClick={()=>removeArticulo(i)} style={{padding:'0 8px',fontSize:15,lineHeight:1}}>✕</button>
                </div>
              ))}
            </div>

            <div style={{marginTop:12,display:'flex',alignItems:'center',gap:8}}>
              <input type="checkbox" id="requiere-acta-cb" checked={form.requiere_acta} onChange={e=>setForm({...form,requiere_acta:e.target.checked})} />
              <label htmlFor="requiere-acta-cb" style={{fontSize:13,cursor:'pointer'}}>Requiere acta</label>
            </div>
          </div>

          <div className="modal-footer" style={{justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:8}}>
              <button type="button" className="btn btn-secondary btn-small" onClick={saveDraft}>Guardar borrador</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={discardDraft}>Descartar</button>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creando…' : 'Crear Despacho'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Despacho() {
  const [despachos, setDespachos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendienteActa, setPendienteActa] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = { limit: 50, offset: 0 };
      if (search) params.search = search;
      if (pendienteActa) { params.requiere_acta = 1; params.acta_firmada = 0; }
      const res = await fetchJson('/api/despachos?' + new URLSearchParams(params).toString());
      setDespachos(res.despachos || res.data || []);
      setTotal(res.total || res.total_count || 0);
    } catch (err) { showToast('Error cargando despachos', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(); }, []);

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2 style={{margin:0}}>Despacho</h2>
          <div style={{color:'#94a3b8'}}>Gestión de despachos</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" onClick={()=>setCreateOpen(true)}>Nuevo Despacho</button>
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center'}}>
        <input className="form-control" placeholder="Buscar por número, destinatario o sede…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}} />
        <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={pendienteActa} onChange={e=>setPendienteActa(e.target.checked)} /> Solo pendientes de acta</label>
        <button className="btn btn-secondary" onClick={load}>Actualizar</button>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
          despachos.length ? (
            <div className="card" style={{padding:0}}>
            <div className="table-container">
              <table>
                <thead>
                  <tr style={{background:'var(--surface-2)'}}>
                    <th>Número</th><th>Fecha</th><th>Destinatario</th><th>Sede</th><th>Artículos</th><th>Acta</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {despachos.map(d => (
                    <tr key={d.id}>
                      <td style={{fontFamily:'monospace'}}>{d.numero}</td>
                      <td>{d.fecha || '—'}</td>
                      <td>{d.destinatario}</td>
                      <td>{d.sede || '—'}</td>
                      <td>{(d.articulos && Array.isArray(d.articulos) ? d.articulos.length : (JSON.parse(d.articulos||'[]').length || 0))}</td>
                      <td>{d.requiere_acta ? (d.acta_firmada ? 'Firmada' : 'Pendiente') : '—'}</td>
                      <td style={{textAlign:'right'}}>
                        <button className="btn btn-secondary" onClick={()=>setDetailId(d.id)}>Ver</button>
                        <button className="btn" style={{marginLeft:8}} onClick={async()=>{ try { await fetchJson(`/api/despachos/${d.id}`); setDetailId(d.id); } catch(e){ showToast('No se pudo cargar', 'error'); } }}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          ) : <div className="empty-state"><p>No se encontraron despachos.</p></div>
        )}
      </div>

      <DetailModal id={detailId} onClose={()=>{ setDetailId(null); load(); }} onUpdated={load} />
      <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
