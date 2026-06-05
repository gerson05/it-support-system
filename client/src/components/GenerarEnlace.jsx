import React, { useState } from 'react';
import fetchJson from '../utils/fetchJson';

export default function GenerarEnlace({ open, onClose }) {
  const [identity, setIdentity] = useState('');
  const [tipo, setTipo] = useState('equipos');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setErr(null); setResult(null);
    try {
      const data = await fetchJson('/api/inventario/registro-token', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: identity, tipo }) });
      setResult(data);
    } catch (err) { setErr(err.message || String(err)); } finally { setLoading(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)'}}>
      <form onSubmit={submit} style={{background:'#fff',padding:16,minWidth:320,borderRadius:6}}>
        <h3>Generar enlace</h3>
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <select value={tipo} onChange={e=>setTipo(e.target.value)}>
            <option value="equipos">Equipos</option>
            <option value="celulares">Celulares</option>
            <option value="ups">UPS</option>
          </select>
          <input placeholder="ID" value={identity} onChange={e=>setIdentity(e.target.value)} />
        </div>
        {err && <div style={{color:'red'}}>{err}</div>}
        {result && <div style={{marginBottom:8}}>Enlace: <a href={result.url} target="_blank" rel="noreferrer">{result.url}</a></div>}
        <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'flex-end'}}>
          <button type="button" onClick={onClose}>Cerrar</button>
          <button type="submit" disabled={loading}>{loading? 'Generando...':'Generar'}</button>
        </div>
      </form>
    </div>
  );
}
