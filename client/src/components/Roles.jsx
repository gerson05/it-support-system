import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchJson('/api/roles');
      setRoles(res.roles || res || []);
    } catch (err) { showToast('Error cargando roles', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2 style={{margin:0}}>Roles</h2>
        <div>
          <button className="btn btn-secondary" onClick={load}>Actualizar</button>
        </div>
      </div>
      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          roles.length ? (
            <ul>{roles.map(r => <li key={r.name || r.id}>{r.name || r.label || JSON.stringify(r)}</li>)}</ul>
          ) : <div>No hay roles definidos.</div>
        )}
      </div>
    </div>
  );
}
