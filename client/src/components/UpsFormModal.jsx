import React, { useState } from 'react';
import Scanner from './Scanner';

export default function UpsFormModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    placa: row.placa || '', marca: row.marca || '', nombre_equipo: row.nombre_equipo || '', serial: row.serial || '', area: row.area || '', voltaje: row.voltaje || '', fecha_compra: row.fecha_compra || '', fecha_despacho: row.fecha_despacho || ''
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  function onChange(e) { setForm(s => ({ ...s, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      await fetchJson(`/api/inventario/ups/${row.id}`, {
        method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form)
      });
      if (onSaved) onSaved();
    } catch (err) { setErr(err.message || String(err)); } finally { setSaving(false); }
  }

  function handleDetected(val) {
    if (!val) return;
    setForm(s => ({ ...s, placa: s.placa || val }));
    setScannerOpen(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <h3>Editar UPS</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-form-grid">
            <div>
              <label>Placa</label>
              <input className="form-control" name="placa" value={form.placa} onChange={onChange} required />
            </div>
            <div>
              <label>Marca</label>
              <input className="form-control" name="marca" value={form.marca} onChange={onChange} />
            </div>
            <div>
              <label>Nombre del equipo</label>
              <input className="form-control" name="nombre_equipo" value={form.nombre_equipo} onChange={onChange} />
            </div>
            <div>
              <label>Serial</label>
              <input className="form-control" name="serial" value={form.serial} onChange={onChange} />
            </div>
            <div>
              <label>Área</label>
              <input className="form-control" name="area" value={form.area} onChange={onChange} />
            </div>
            <div>
              <label>Voltaje</label>
              <input className="form-control" name="voltaje" value={form.voltaje} onChange={onChange} />
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
