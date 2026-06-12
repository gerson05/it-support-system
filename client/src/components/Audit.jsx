import React, { useEffect, useState } from 'react';
import fetchJson from '../utils/fetchJson';

function formatDate(s) {
  if (!s) return '—';
  return s.replace('T', ' ').slice(0, 16);
}

export default function Audit() {
  const [tab, setTab]           = useState('actividad');
  const [logs, setLogs]         = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [actas, setActas]       = useState([]);
  const [actasTotal, setActasTotal] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [actasSearch, setActasSearch] = useState('');
  const [actasType, setActasType]     = useState('');
  const [actasStatus, setActasStatus] = useState('');

  useEffect(() => {
    if (tab === 'actividad') loadLogs();
    else loadActas();
  }, [tab]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetchJson('/api/audit?limit=50&offset=0');
      setLogs(res.logs || []);
      setLogsTotal(res.total || 0);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }

  async function loadActas() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (actasSearch) params.set('q', actasSearch);
      if (actasType)   params.set('entity_type', actasType);
      if (actasStatus) params.set('status', actasStatus);
      const res = await fetchJson(`/api/actas?${params.toString()}`);
      setActas(res.actas || res.data || []);
      setActasTotal(res.total || 0);
    } catch { setActas([]); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h2>Auditoría</h2>
        <p>Historial completo de acciones y actas del sistema.</p>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button className={tab === 'actividad' ? 'tab-btn tab-active' : 'tab-btn'} onClick={() => setTab('actividad')}>
          Actividad
        </button>
        <button className={tab === 'actas' ? 'tab-btn tab-active' : 'tab-btn'} onClick={() => setTab('actas')}>
          Actas
        </button>
      </div>

      {tab === 'actividad' && (
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : logs.length === 0 ? (
            <div className="empty-state"><p>No hay eventos registrados aún.</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Actor</th>
                    <th>Acción</th>
                    <th>Documento</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    let detail = '';
                    try {
                      const d = JSON.parse(log.details || 'null');
                      if (d) detail = Object.entries(d).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join(' · ');
                    } catch {}
                    return (
                      <tr key={log.id}>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-3)' }}>{log.created_at}</td>
                        <td style={{ fontWeight: 500 }}>{log.actor}</td>
                        <td>{log.action}</td>
                        <td>
                          {log.entity_number
                            ? <a href={`#ticket/${log.entity_id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{log.entity_number}</a>
                            : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>
                {logsTotal} eventos totales
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'actas' && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-control"
                style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
                placeholder="Buscar por documento, persona o archivo…"
                value={actasSearch}
                onChange={e => setActasSearch(e.target.value)}
              />
              <select className="form-control" style={{ width: 'auto' }} value={actasType} onChange={e => setActasType(e.target.value)}>
                <option value="">Todos los tipos</option>
                <option value="despacho">Despacho</option>
                <option value="tech_request">Requerimiento</option>
              </select>
              <select className="form-control" style={{ width: 'auto' }} value={actasStatus} onChange={e => setActasStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="uploaded">Recibidas</option>
                <option value="pending">Pendientes</option>
              </select>
              <button className="btn btn-secondary" onClick={loadActas}>Actualizar</button>
            </div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {loading ? (
              <div className="loading-spinner"><div className="spinner" /></div>
            ) : actas.length === 0 ? (
              <div className="empty-state"><p>No se encontraron actas.</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Referencia</th>
                      <th>Archivo</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {actas.map(a => (
                      <tr key={a.id}>
                        <td><span className="badge badge-role">{a.entity_type}</span></td>
                        <td style={{ fontFamily: 'monospace' }}>{a.entity_ref}</td>
                        <td style={{ fontSize: 12 }}>{a.filename || '—'}</td>
                        <td>
                          <span className={`badge ${a.uploaded_at ? 'badge-resuelto' : 'badge-pendiente'}`}>
                            {a.uploaded_at ? 'Recibida' : 'Pendiente'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{formatDate(a.uploaded_at || a.created_at)}</td>
                        <td>
                          {a.filename && (
                            <a href={`/api/actas/download/${a.token}`} className="btn btn-secondary btn-small">
                              Descargar
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>
                  {actasTotal} actas totales
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
