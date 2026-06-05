import React, { useState } from 'react';

export default function CelularFormModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    imei: row.imei || '', imei2: row.imei2 || '', equipo: row.equipo || '', modelo: row.modelo || '', almacenamiento: row.almacenamiento || '', ram: row.ram || '', operador: row.operador || '', linea: row.linea || '', area: row.area || '', ciudad: row.ciudad || '', nombre_completo: row.nombre_completo || '', cedula: row.cedula || '', estado: row.estado || 'nuevo', accesorio: row.accesorio || '', entregado_por: row.entregado_por || '', fecha_registro: row.fecha_registro || '', fecha_entrega: row.fecha_entrega || ''
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  function onChange(e) { setForm(s => ({ ...s, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      await fetchJson(`/api/inventario/celulares/${row.id}`, {
        method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form)
      });
      if (onSaved) onSaved();
    } catch (err) { setErr(err.message || String(err)); } finally { setSaving(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.6)',zIndex:10000}}>
      <div style={{background:'#fff',padding:20,borderRadius:8,width:'min(680px,96vw)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <h3>Editar celular</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>
              <label style={{display:'block',fontSize:12}}>IMEI</label>
              <input name="imei" value={form.imei} onChange={onChange} required />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>IMEI 2</label>
              <input name="imei2" value={form.imei2} onChange={onChange} />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Marca / Equipo</label>
              <input name="equipo" value={form.equipo} onChange={onChange} />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Modelo</label>
              <input name="modelo" value={form.modelo} onChange={onChange} />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Área</label>
              <input name="area" value={form.area} onChange={onChange} />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Nombre completo</label>
              <input name="nombre_completo" value={form.nombre_completo} onChange={onChange} required />
            </div>
          </div>
          {err && <div style={{color:'crimson',marginTop:8}}>{err}</div>}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
