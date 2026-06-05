import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';

export default function Firmar() {
  const token = window.location.pathname.split('/firmar/')[1]?.trim();
  const [status, setStatus] = useState('loading'); // loading, ready, success, already, invalid
  const [entityRef, setEntityRef] = useState('');
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => { init(); }, []);

  function show(st) { setStatus(st); }

  function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) +
      ' a las ' + d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
  }

  async function init() {
    if (!token) { show('invalid'); return; }
    show('loading');
    try {
      const data = await fetchJson(`/api/actas/status/${token}`);
      if (!data.valid) { show('invalid'); return; }
      if (data.uploaded) {
        setEntityRef(data.entity_ref || '');
        show('already');
        return;
      }
      setEntityRef(data.entity_ref || '');
      show('ready');
    } catch (e) {
      show('invalid');
    }
  }

  function onZoneClick() { fileInputRef.current?.click(); }

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  }

  function setFile(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!['pdf','docx'].includes(ext)) { alert('Solo se aceptan archivos PDF o DOCX.'); return; }
    if (f.size > 10 * 1024 * 1024) { alert('El archivo supera el límite de 10 MB.'); return; }
    setSelectedFile(f); setFileName(f.name);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0]; if (f) setFile(f);
  }

  function onDragOver(e) { e.preventDefault(); }

  async function upload() {
    if (!selectedFile) return;
    setUploading(true);
    const fd = new FormData(); fd.append('acta', selectedFile);
    try {
      await fetchJson(`/api/actas/upload/${token}`, { method: 'POST', body: fd });
      show('success');
    } catch (e) { alert(e.message || 'Error de conexión. Intenta de nuevo.'); setUploading(false); }
  }

  return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'#e2e8f0',padding:20,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{maxWidth:420,width:'100%'}}>
        <div style={{background:'#1e293b',border:'1px solid rgba(255,255,255,.08)',borderRadius:16,padding:28}}>
          <div style={{display: status === 'loading' ? 'block' : 'none', textAlign:'center'}}>
            <div style={{width:32,height:32,border:'3px solid rgba(99,102,241,.2)',borderTopColor:'#6366f1',borderRadius:'50%',margin:'0 auto 16px',animation:'spin .8s linear infinite'}} />
            <p style={{color:'#64748b'}}>Verificando enlace…</p>
          </div>

          {status === 'ready' && (
            <div>
              <h2 style={{fontSize:18,fontWeight:700,marginBottom:6}}>Acta de Entrega</h2>
              <p style={{color:'#94a3b8',marginBottom:16}}>{entityRef}</p>
              <label style={{display:'block',fontSize:13,color:'#94a3b8',marginBottom:8}}>Sube el acta firmada:</label>
              <div onClick={onZoneClick} onDrop={onDrop} onDragOver={onDragOver} style={{border:'2px dashed rgba(255,255,255,.12)',borderRadius:10,padding:28,textAlign:'center',cursor:'pointer',background:selectedFile ? 'rgba(99,102,241,.03)' : 'transparent'}}>
                <div style={{fontSize:28,marginBottom:8}}>📄</div>
                <p style={{color:'#64748b'}}>Toca aquí o arrastra el archivo</p>
                {fileName && <div style={{color:'#6366f1',fontWeight:600,marginTop:8}}>{fileName}</div>}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" style={{display:'none'}} onChange={onFileChange} />
              <button disabled={!selectedFile || uploading} onClick={upload} style={{marginTop:12,width:'100%',padding:12,borderRadius:9,background: !selectedFile ? '#334155' : '#6366f1',color:'#fff',border:'none'}}>{uploading ? 'Subiendo…' : 'Subir acta firmada'}</button>
              <p style={{fontSize:11,color:'#475569',textAlign:'center',marginTop:12}}>Formatos aceptados: PDF, DOCX · Máx. 10 MB</p>
            </div>
          )}

          {status === 'success' && (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>¡Acta recibida!</div>
              <div style={{color:'#94a3b8'}}>El equipo de IT ya recibió tu acta firmada.<br/>Puedes cerrar esta ventana.</div>
            </div>
          )}

          {status === 'already' && (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Acta ya entregada</div>
              <div style={{color:'#94a3b8'}}>{entityRef ? `Ya recibimos tu acta firmada. ${formatDate(entityRef)}` : 'Ya recibimos tu acta firmada.'}</div>
            </div>
          )}

          {status === 'invalid' && (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:12}}>❌</div>
              <div style={{fontSize:20,fontWeight:700,marginBottom:8}}>Enlace no válido</div>
              <div style={{color:'#94a3b8'}}>Este enlace no existe o ya no es válido.<br/>Contacta al equipo de IT.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
