import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';
import { formatDate } from '../utils/format';

function DetailModal({ id, onClose, onUpdated }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actaInfo, setActaInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const d = await fetchJson(`/api/despachos/${id}`);
        if (!mounted) return;
        setRecord(d);
        if (d.requiere_acta) {
          const info = await fetchJson(`/api/actas/info/despacho/${id}`);
          if (!mounted) return;
          setActaInfo(info);
        }
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
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1200,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}} onClick={(e)=>{if(e.target.className==='modal-overlay') onClose();}}>
      <div style={{background:'var(--surface)',borderRadius:12,padding:20,width:'100%',maxWidth:720,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Detalle de Despacho</h3>
          <div style={{display:'flex',gap:8}}>
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
  );
}

function CreateModal({ open, onClose, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ destinatario:'', sede:'', area:'', observaciones:'', articulosText:'[]', requiere_acta:false, ticket_id:'' });
  const [draft, setDraft] = useState(null);
  useEffect(()=>{ if (open) { setForm({ destinatario:'', sede:'', area:'', observaciones:'', articulosText:'[]', requiere_acta:false, ticket_id:'' }); setDraft(null); } },[open]);
  useEffect(() => {
    if (!open) return;
    // fetch borrador
    (async () => {
      try {
        const agente = encodeURIComponent(window.appState?.currentAgent?.name || '');
        if (!agente) return;
        const data = await fetchJson(`/api/despachos/borrador?agente=${agente}`);
        if (data && data.borrador) {
          setDraft(data.borrador);
        }
      } catch (e) {}
    })();
  }, [open]);

  async function saveDraft() {
    try {
      const agente = window.appState?.currentAgent?.name || '';
      const payload = serializar();
      await fetchJson('/api/despachos/borrador', { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Borrador guardado ✓', 'success');
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

  function serializar() {
    let articulos = [];
    try { articulos = JSON.parse(form.articulosText); } catch { articulos = []; }
    return { agente: window.appState?.currentAgent?.name || '', destinatario: form.destinatario||'', sede: form.sede||'', area: form.area||'', articulos, observaciones: form.observaciones||'', requiere_acta: form.requiere_acta?1:0, ticket_id: form.ticket_id?parseInt(form.ticket_id):null };
  }

  if (!open) return null;
  async function handleSubmit(e) { e.preventDefault(); setSubmitting(true); try {
    let articulos = [];
    try { articulos = JSON.parse(form.articulosText); } catch { showToast('Artículos: JSON inválido', 'error'); setSubmitting(false); return; }
    const payload = { destinatario: form.destinatario, sede: form.sede || null, area: form.area || null, articulos, observaciones: form.observaciones || null, requiere_acta: form.requiere_acta?1:0, ticket_id: form.ticket_id?parseInt(form.ticket_id):null, agente: window.appState?.currentAgent?.name || '' };
    const res = await fetchJson('/api/despachos', { method: 'POST', body: JSON.stringify(payload) });
    showToast(`Despacho ${res.numero} creado`, 'success');
    // delete draft after create
    try { const agente = encodeURIComponent(window.appState?.currentAgent?.name || ''); await fetchJson(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' }); } catch {}
    onCreated && onCreated(); onClose();
  } catch (err) { showToast(err.message || err, 'error'); } finally { setSubmitting(false); } }

  return (
    <div className="modal-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1200,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:20,overflowY:'auto'}} onClick={(e)=>{if(e.target.className==='modal-overlay') onClose();}}>
      <div style={{background:'var(--surface)',borderRadius:12,padding:20,width:'100%',maxWidth:720}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Nuevo Despacho</h3>
          <div style={{display:'flex',gap:8}}>
            {draft && <button className="btn btn-secondary" onClick={()=>{ const b = draft; setForm({ destinatario:b.destinatario||'', sede:b.sede||'', area:b.area||'', articulosText:JSON.stringify(b.articulos||[]), observaciones:b.observaciones||'', requiere_acta:!!b.requiere_acta, ticket_id:b.ticket_id||'' }); setDraft(null); showToast('Borrador restaurado', 'success'); }}>Restaurar borrador</button>}
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{marginTop:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <input required placeholder="Destinatario" value={form.destinatario} onChange={e=>setForm({...form,destinatario:e.target.value})} />
            <input placeholder="Sede" value={form.sede} onChange={e=>setForm({...form,sede:e.target.value})} />
            <input placeholder="Área" value={form.area} onChange={e=>setForm({...form,area:e.target.value})} />
            <input placeholder="Ticket ID (opcional)" value={form.ticket_id} onChange={e=>setForm({...form,ticket_id:e.target.value})} />
          </div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:13,fontWeight:600}}>Artículos (JSON array)</label>
            <textarea rows={4} style={{width:'100%'}} value={form.articulosText} onChange={e=>setForm({...form,articulosText:e.target.value})} />
          </div>
          <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={form.requiere_acta} onChange={e=>setForm({...form,requiere_acta:e.target.checked})} /> <label>Requiere acta</label>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:12}}>
            <div style={{display:'flex',gap:8}}>
              <button type="button" className="btn btn-secondary" onClick={saveDraft}>💾 Guardar borrador</button>
              <button type="button" className="btn btn-secondary" onClick={discardDraft}>Descartar borrador</button>
            </div>
            <div>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{marginLeft:8}}>{submitting ? 'Creando…' : 'Crear Despacho'}</button>
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
        <input placeholder="Buscar por número, destinatario o sede…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}} />
        <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={pendienteActa} onChange={e=>setPendienteActa(e.target.checked)} /> Solo pendientes de acta</label>
        <button className="btn btn-secondary" onClick={load}>Actualizar</button>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          despachos.length ? (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
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
          ) : <div style={{padding:20}}>No se encontraron despachos.</div>
        )}
      </div>

      <DetailModal id={detailId} onClose={()=>{ setDetailId(null); load(); }} onUpdated={load} />
      <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
