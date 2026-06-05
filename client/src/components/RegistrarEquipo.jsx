import React, { useEffect, useState, useRef } from 'react';
import fetchJson from '../utils/fetchJson';
import Scanner from './Scanner';

export default function RegistrarEquipo() {
  const token = window.location.pathname.split('/registrar/')[1]?.trim();
  const [status, setStatus] = useState('loading'); // loading, form, success, invalid
  const [tipo, setTipo] = useState('equipos');
  const [label, setLabel] = useState('Cargando…');
  const [uses, setUses] = useState('');
  const [formData, setFormData] = useState({});
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanTargetRef = useRef(null);

  useEffect(() => { init(); }, []);

  async function init() {
    if (!token) { setStatus('invalid'); return; }
    try {
      const data = await fetchJson(`/api/inventario/registro-status/${token}`);
      if (!data.valid) { setStatus('invalid'); return; }
      setTipo(data.tipo || 'equipos');
      setLabel(data.label || (data.tipo === 'equipos' ? '🖥 Equipos' : '📱 Celulares'));
      setUses(data.max_uses ? `${data.use_count}/${data.max_uses} usos` : `${data.use_count} registros`);
      setStatus('form');
    } catch (e) { setStatus('invalid'); }
  }

  function onChange(e) {
    const { name, value } = e.target;
    setFormData(s => ({ ...s, [name]: value }));
  }

  function openScanFor(field) {
    scanTargetRef.current = field;
    setScannerOpen(true);
  }

  function onDetected(val) {
    const field = scanTargetRef.current;
    if (field) setFormData(s => ({ ...s, [field]: val }));
    setScannerOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await fetchJson(`/api/inventario/registrar/${token}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(formData) });
      setStatus('success');
    } catch (err) { setErr(err.message || 'Error al guardar.'); }
    finally { setSaving(false); }
  }

  if (status === 'loading') return (<div style={{padding:20}}>Verificando enlace…</div>);
  if (status === 'invalid') return (
    <div style={{padding:20,maxWidth:640,margin:'0 auto'}}>
      <h3>Enlace no válido</h3>
      <p>Este enlace no existe, expiró o alcanzó el límite de usos.</p>
    </div>
  );

  const brands = tipo === 'equipos'
    ? ['Lenovo','Dell','HP','Samsung','Toshiba','Acer','Asus','Apple','Otro']
    : ['Samsung','Xiaomi Redmi','Honor','ZTE','Infinix','Motorola','iPhone','Otro'];

  return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'#e2e8f0',padding:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{maxWidth:480,width:'100%'}}>
        <div style={{background:'#1e293b',padding:20,borderRadius:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:16,fontWeight:700}}>{label}</div>
              <div style={{fontSize:12,color:'#64748b'}}>{uses}</div>
            </div>
          </div>

          <div style={{marginTop:12}}>
            <button style={{width:'100%',padding:12,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',borderRadius:10,border:'none'}} onClick={() => openScanFor('placa')}>📷 Escanear etiqueta del equipo</button>
          </div>

          <form onSubmit={handleSubmit} style={{marginTop:12}}>
            {tipo === 'equipos' ? (
              <>
                <label style={{fontSize:12}}>Placa *</label>
                <div style={{display:'flex',gap:8}}>
                  <input name="placa" value={formData.placa||''} onChange={onChange} required />
                  <button type="button" onClick={() => openScanFor('placa')}>📷</button>
                </div>
                <label style={{fontSize:12,marginTop:8}}>Serial *</label>
                <div style={{display:'flex',gap:8}}>
                  <input name="serial" value={formData.serial||''} onChange={onChange} required />
                  <button type="button" onClick={() => openScanFor('serial')}>📷</button>
                </div>
                <label style={{fontSize:12,marginTop:8}}>Marca *</label>
                <select name="marca" value={formData.marca||''} onChange={onChange} required>
                  <option value="">— Seleccionar —</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <label style={{fontSize:12,marginTop:8}}>Nombre equipo *</label>
                <input name="nombre_equipo" value={formData.nombre_equipo||''} onChange={onChange} required />
                <label style={{fontSize:12,marginTop:8}}>Área</label>
                <input name="area" value={formData.area||''} onChange={onChange} />
              </>
            ) : (
              <>
                <label style={{fontSize:12}}>IMEI *</label>
                <div style={{display:'flex',gap:8}}>
                  <input name="imei" value={formData.imei||''} onChange={onChange} required />
                  <button type="button" onClick={() => openScanFor('imei')}>📷</button>
                </div>
                <label style={{fontSize:12,marginTop:8}}>Marca</label>
                <select name="equipo" value={formData.equipo||''} onChange={onChange}>
                  <option value="">—</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <label style={{fontSize:12,marginTop:8}}>Nombre completo *</label>
                <input name="nombre_completo" value={formData.nombre_completo||''} onChange={onChange} required />
              </>
            )}

            {err && <div style={{background:'rgba(239,68,68,.1)',color:'#fca5a5',padding:8,borderRadius:8,marginTop:8}}>{err}</div>}

            <div style={{marginTop:12}}>
              <button className="btn-submit" type="submit" disabled={saving} style={{width:'100%',padding:12,background:'#10b981',borderRadius:10,color:'#fff'}}>
                {saving ? 'Guardando…' : 'Guardar registro'}
              </button>
            </div>
          </form>

        </div>
      </div>
      <Scanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={onDetected} />
    </div>
  );
}
