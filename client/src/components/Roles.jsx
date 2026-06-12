import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';
import { showToast } from '../utils/ui';

export default function Roles() {
  const [roles, setRoles]           = useState([]);
  const [allPerms, setAllPerms]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);   // role object
  const [rolePerms, setRolePerms]   = useState([]);     // permission_ids for editing role
  const [saving, setSaving]         = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        fetchJson('/api/roles'),
        fetchJson('/api/permissions'),
      ]);
      setRoles(Array.isArray(r) ? r : r.roles || []);
      setAllPerms(Array.isArray(p) ? p : []);
    } catch { showToast('Error cargando roles', 'error'); }
    finally { setLoading(false); }
  }

  async function openEdit(role) {
    try {
      const res = await fetchJson(`/api/roles/${role.id}/permissions`);
      setRolePerms(res.permission_ids || []);
      setEditing(role);
    } catch { showToast('Error al cargar permisos', 'error'); }
  }

  function togglePerm(id) {
    setRolePerms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function savePerms() {
    setSaving(true);
    try {
      await fetchJson(`/api/roles/${editing.id}/permissions`, { method: 'PUT', body: JSON.stringify({ permission_ids: rolePerms }) });
      showToast('Permisos actualizados', 'success');
      setEditing(null);
      await load();
    } catch (err) { showToast(err.message || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  const ROLE_PROTECTED = 1;

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h2>Roles y Permisos</h2>
        <p>Define qué puede hacer cada perfil de usuario.</p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Descripción</th>
                  <th>Usuarios activos</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}><span className="badge badge-role">{r.name}</span></td>
                    <td style={{ color: 'var(--text-3)', fontSize: 13 }}>{r.description || '—'}</td>
                    <td style={{ fontSize: 13 }}>{r.user_count ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.id !== ROLE_PROTECTED ? (
                        <button className="btn btn-secondary btn-small" onClick={() => openEdit(r)}>
                          Editar permisos
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Acceso completo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Permisos — {editing.name}</h3>
              <button className="modal-close" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="modal-body">
              {allPerms.map(mod => (
                <div key={mod.module} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text-3)', marginBottom: 8 }}>
                    {mod.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {mod.permissions.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '4px 10px', borderRadius: 6, border: `1px solid ${rolePerms.includes(p.id) ? 'var(--primary)' : 'var(--border)'}`, background: rolePerms.includes(p.id) ? 'var(--primary-light)' : 'transparent', color: rolePerms.includes(p.id) ? 'var(--primary)' : 'var(--text-2)' }}>
                        <input type="checkbox" style={{ display: 'none' }} checked={rolePerms.includes(p.id)} onChange={() => togglePerm(p.id)} />
                        {p.action}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={savePerms} disabled={saving}>{saving ? 'Guardando…' : 'Guardar permisos'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
