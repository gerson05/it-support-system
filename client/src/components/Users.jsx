import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchJson('/api/users?limit=200');
      setUsers(res.users || res.data || res || []);
    } catch (err) { showToast('Error cargando usuarios', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2 style={{margin:0}}>Usuarios</h2>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={load}>Actualizar</button>
        </div>
      </div>

      <div style={{marginTop:12}}>
        {loading ? <div>Cargando…</div> : (
          users.length ? (
            <table style={{width:'100%'}}>
              <thead><tr><th>Nombre</th><th>Email</th><th>Roles</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.name || u.username}</td>
                    <td>{u.email || '—'}</td>
                    <td>{(u.roles||[]).join?.(', ') || (Array.isArray(u.roles) ? u.roles.join(', ') : u.roles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div>No hay usuarios.</div>
        )}
      </div>
    </div>
  );
}

