import React, { useState } from 'react';

export default function EquipoFormModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    placa: row.placa || '', marca: row.marca || '', nombre_equipo: row.nombre_equipo || '', serial: row.serial || '', procesador: row.procesador || '', ram: row.ram || '', tipo_ram: row.tipo_ram || '', cap_disco: row.cap_disco || '', tipo_disco: row.tipo_disco || '', serial_cargador: row.serial_cargador || '', area: row.area || '', responsable: row.responsable || '', fecha_compra: row.fecha_compra || ''
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  function onChange(e) { setForm(s => ({ ...s, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/inventario/equipos/${row.id}`, {
        method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      if (onSaved) onSaved();
    } catch (err) { setErr(err.message || String(err)); } finally { setSaving(false); }
  }

  return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.6)',zIndex:10000}}>
      <div style={{background:'#fff',padding:20,borderRadius:8,width:'min(680px,96vw)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <h3>Editar equipo</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>
              <label style={{display:'block',fontSize:12}}>Placa</label>
              <input name="placa" value={form.placa} onChange={onChange} required />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Marca</label>
              <input name="marca" value={form.marca} onChange={onChange} required />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Nombre equipo</label>
              <input name="nombre_equipo" value={form.nombre_equipo} onChange={onChange} required />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Serial</label>
              <input name="serial" value={form.serial} onChange={onChange} required />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Área</label>
              <input name="area" value={form.area} onChange={onChange} />
            </div>
            <div>
              <label style={{display:'block',fontSize:12}}>Responsable</label>
              <input name="responsable" value={form.responsable} onChange={onChange} />
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
