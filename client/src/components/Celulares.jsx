import React, { useEffect, useState } from 'react';
import CelularFormModal from './CelularFormModal';

export default function Celulares() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventario/celulares?page=${page}&limit=${limit}`);
      const data = await res.json();
      setRows(data.celulares || []);
    } catch (err) {
      console.error('load celulares', err);
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
      <h3>Celulares</h3>
      {loading ? (<div>Cargando…</div>) : (
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th>IMEI</th><th>Dispositivo</th><th>Asignado a</th><th>Área</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{fontFamily:'monospace'}}>{r.imei}</td>
                <td>{r.modelo || r.equipo} <div style={{fontSize:12,color:'#666'}}>{r.almacenamiento} · {r.ram}</div></td>
                <td>{r.nombre_completo} {r.cedula && (<div style={{fontSize:12,color:'#666'}}>{r.cedula}</div>)}</td>
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
        <CelularFormModal row={editing} onClose={closeModal} onSaved={onSaved} />
      )}
    </div>
  );
}
