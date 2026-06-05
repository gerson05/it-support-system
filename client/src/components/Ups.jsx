import React, { useEffect, useState } from 'react';
import UpsFormModal from './UpsFormModal';

export default function Ups() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventario/ups?page=${page}&limit=${limit}`);
      const data = await res.json();
      setRows(data.ups || []);
    } catch (err) {
      console.error('load ups', err);
    } finally { setLoading(false); }
  }

  function openEdit(row) { setEditing(row); }
  function closeModal() { setEditing(null); }

  async function onSaved() {
    closeModal();
    await load();
  }

  return (
    <div>
      <h3>UPS</h3>
      {loading ? (<div>Cargando…</div>) : (
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th>Placa</th><th>Dispositivo</th><th>Serial</th><th>Área</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{fontFamily:'monospace'}}>{r.placa}</td>
                <td>{r.marca} <div style={{fontSize:12,color:'#666'}}>{r.nombre_equipo}</div></td>
                <td style={{fontFamily:'monospace'}}>{r.serial}</td>
                <td style={{fontSize:12}}>{r.area}</td>
                <td>
                  <button onClick={() => openEdit(r)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <UpsFormModal row={editing} onClose={closeModal} onSaved={onSaved} />
      )}
    </div>
  );
}
