import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

const EMPTY_FORM = { username: '', password: '', role_id: '' };

export default function Users() {
  const [users, setUsers]     = useState([]);
  const [roles, setRoles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);  // null | { mode:'new'|'edit', user }
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        fetchJson('/api/users'),
        fetchJson('/api/roles'),
      ]);
      setUsers(Array.isArray(u) ? u : u.users || []);
      setRoles(Array.isArray(r) ? r : r.roles || []);
    } catch { showToast('Error cargando datos', 'error'); }
    finally { setLoading(false); }
  }

  function openNew() {
    setForm(EMPTY_FORM);
    setModal({ mode: 'new' });
  }

  function openEdit(user) {
    setForm({ username: user.username, password: '', role_id: String(user.role_id) });
    setModal({ mode: 'edit', user });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.mode === 'new') {
        if (!form.username || !form.password || !form.role_id) {
          showToast('Completa todos los campos', 'error'); return;
        }
        await fetchJson('/api/users', { method: 'POST', body: JSON.stringify({ username: form.username, password: form.password, role_id: Number(form.role_id) }) });
        showToast('Usuario creado', 'success');
      } else {
        const body = { role_id: Number(form.role_id) };
        if (form.password) body.password = form.password;
        await fetchJson(`/api/users/${modal.user.id}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Usuario actualizado', 'success');
      }
      setModal(null);
      await load();
    } catch (err) { showToast(err.message || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function toggleActive(user) {
    const newActive = user.active ? 0 : 1;
    try {
      await fetchJson(`/api/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ active: newActive }) });
      showToast(newActive ? 'Usuario activado' : 'Usuario desactivado', 'success');
      await load();
    } catch (err) { showToast(err.message || 'Error', 'error'); }
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Usuarios</h2>
          <p>Gestión de acceso al panel IT.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo usuario</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td><span className="badge badge-role">{u.role_name}</span></td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-resuelto' : 'badge-cerrado'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{(u.created_at || '').slice(0, 10)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary btn-small" onClick={() => openEdit(u)}>Editar</button>
                      <button
                        className={`btn btn-small ${u.active ? 'btn-danger' : 'btn-success'}`}
                        style={{ marginLeft: 6 }}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{modal.mode === 'new' ? 'Nuevo usuario' : `Editar — ${modal.user?.username}`}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Usuario</label>
                  <input className="form-control" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={modal.mode === 'edit'} required={modal.mode === 'new'} />
                </div>
                <div className="form-group">
                  <label>{modal.mode === 'new' ? 'Contraseña' : 'Nueva contraseña (dejar en blanco para no cambiar)'}</label>
                  <input className="form-control" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={modal.mode === 'new'} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select className="form-control" value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })} required>
                    <option value="">— Seleccionar rol —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name} — {r.description}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
