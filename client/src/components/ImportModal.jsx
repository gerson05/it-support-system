import React, { useState } from 'react';
import fetchJson from '../utils/fetchJson';

export default function ImportModal({ open, type='equipos', onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    if (!file) return setErr('Selecciona un archivo');
    setLoading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await fetchJson(`/api/inventario/${type}/import`, { method: 'POST', body: fd });
      if (onImported) onImported(data);
    } catch (err) {
      setErr(err.message || String(err));
    } finally { setLoading(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)'}}>
      <form onSubmit={submit} style={{background:'#fff',padding:16,minWidth:320,borderRadius:6}}>
        <h3>Importar {type}</h3>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setFile(e.target.files[0]||null)} />
        {err && <div style={{color:'red'}}>{err}</div>}
        <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'flex-end'}}>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={loading}>{loading? 'Importando...':'Importar'}</button>
        </div>
      </form>
    </div>
  );
}
