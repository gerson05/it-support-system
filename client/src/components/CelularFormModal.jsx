import React, { useState } from 'react';
import Scanner from './Scanner';

export default function CelularFormModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    imei: row.imei || '', imei2: row.imei2 || '', equipo: row.equipo || '', modelo: row.modelo || '', almacenamiento: row.almacenamiento || '', ram: row.ram || '', operador: row.operador || '', linea: row.linea || '', area: row.area || '', ciudad: row.ciudad || '', nombre_completo: row.nombre_completo || '', cedula: row.cedula || '', estado: row.estado || 'nuevo', accesorio: row.accesorio || '', entregado_por: row.entregado_por || '', fecha_registro: row.fecha_registro || '', fecha_entrega: row.fecha_entrega || ''
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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

  function handleDetected(val) {
    if (!val) return;
    setForm(s => ({ ...s, imei: s.imei || val }));
    setScannerOpen(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>Editar celular</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-form-grid">
            <div>
              <label>IMEI</label>
              <input className="form-control" name="imei" value={form.imei} onChange={onChange} required />
            </div>
            <div>
              <label>IMEI 2</label>
              <input className="form-control" name="imei2" value={form.imei2} onChange={onChange} />
            </div>
            <div>
              <label>Marca / Equipo</label>
              <input className="form-control" name="equipo" value={form.equipo} onChange={onChange} />
            </div>
            <div>
              <label>Modelo</label>
              <input className="form-control" name="modelo" value={form.modelo} onChange={onChange} />
            </div>
            <div>
              <label>Área</label>
              <input className="form-control" name="area" value={form.area} onChange={onChange} />
            </div>
            <div>
              <label>Nombre completo</label>
              <input className="form-control" name="nombre_completo" value={form.nombre_completo} onChange={onChange} required />
            </div>
          </div>
          {!row.id && (
            <div style={{marginTop:10}}>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setScannerOpen(true)}>Escanear (cámara)</button>
            </div>
          )}
          {err && <div className="modal-error">{err}</div>}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
      <Scanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleDetected} />
    </div>
  );
}
